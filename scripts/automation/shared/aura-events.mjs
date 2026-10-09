import { MODULE_ID } from "./constants.mjs";
import { automationActors, isEffectActive } from "../effects/temporary-effects.mjs";
import { enabled, findFeature, itemIdentifier, notify } from "./helpers.mjs";
import { auraFeature } from "./aura-definitions.mjs";
import { tokensInAuraTemplate } from "./aura-templates.mjs";
import { feetToSceneUnits, tokenSceneDistance } from "./spatial.mjs";
import { isForwardTurn } from "./combat-flow.mjs";
import { choiceDialog } from "./dialogs.mjs";
import { registerGmRequest, requestGm } from "./gm-requests.mjs";
import { dispatchAutomationPulse } from "../midi/aura-workflow.mjs";
import { inspiringTemporaryHp } from "./leader-presence-definitions.mjs";

const flag = (actor, key) => actor?.getFlag?.(MODULE_ID, key) ?? actor?.flags?.[MODULE_ID]?.[key];
const field = (data, path) => Object.hasOwn(data ?? {}, path) ? data[path] : path.split(".").reduce((v, key) => v?.[key], data);
const tokenUuid = token => token.document?.uuid ?? token.uuid;
const SOUL_TEMP_HP = "soulAuraTempHp";
let installedEngine;

export async function chooseCarnageAuraType(actor) {
  if (!actor?.isOwner || !findFeature(actor, "aura-of-carnage")) return false;
  const type = await choiceDialog({ title: "Аура резни", label: "Тип уязвимости после продолжительного отдыха",
    choices: [["bludgeoning", "Дробящий"], ["piercing", "Колющий"], ["slashing", "Рубящий"]], defaultValue: flag(actor, "carnageAuraDamageType") });
  if (!type) return false;
  await actor.setFlag(MODULE_ID, "carnageAuraDamageType", type); return true;
}

export async function grantSoulAuraTemporaryHp(actor, amount, sourceItem = null) {
  const current = Number(actor.system?.attributes?.hp?.temp ?? 0), value = inspiringTemporaryHp(actor, Math.max(0, Number(amount)));
  if (!value || value <= current) return false;
  await actor.update({ "system.attributes.hp.temp": value,
    [`flags.${MODULE_ID}.${SOUL_TEMP_HP}`]: { remaining: value, sourceItem: sourceItem?.uuid ?? null } });
  return true;
}

export function trackSoulAuraTemporaryHp(actor, changes, { damage = false } = {}) {
  const record = flag(actor, SOUL_TEMP_HP), next = field(changes, "system.attributes.hp.temp");
  if (!record || next === undefined || field(changes, `flags.${MODULE_ID}.${SOUL_TEMP_HP}`) !== undefined) return;
  const current = Number(actor.system?.attributes?.hp?.temp ?? 0);
  if (Number(next) === current) return;
  if (!damage || current !== record.remaining || Number(next) > current) changes[`flags.${MODULE_ID}.-=${SOUL_TEMP_HP}`] = null;
  else changes[`flags.${MODULE_ID}.${SOUL_TEMP_HP}`] = { ...record, remaining: Math.max(0, Number(next)) };
}

export async function clearSoulAuraTemporaryHpOnRest(actor) {
  const record = flag(actor, SOUL_TEMP_HP);
  if (!actor?.isOwner || !record) return;
  const update = { [`flags.${MODULE_ID}.-=${SOUL_TEMP_HP}`]: null };
  if (Number(actor.system?.attributes?.hp?.temp ?? 0) === record.remaining) update["system.attributes.hp.temp"] = 0;
  await actor.update(update);
}

/** One authoritative, serialized event queue; movement sync never rolls damage. */
export function createAuraEventEngine({ synchronize, framesForScene, tokensForScene, isAuthority, pulse = dispatchAutomationPulse }) {
  let queue = Promise.resolve();
  const claims = new Set(), health = new Map(), deadActors = new Set();
  const enqueue = task => {
    const next = queue.catch(() => {}).then(() => isAuthority() && enabled() ? task() : false);
    queue = next; return next;
  };
  async function once(frame, event, key, targets, scene) {
    if (!frame.isActive() || !targets.length) return false;
    const condition = event.condition?.key;
    if (condition) targets = targets.filter(token => ![...(token.actor.effects ?? [])]
      .some(effect => isEffectActive(effect) && flag(effect, "auraPersistentCondition") === condition)
      && !flag(token.actor, "auraDiseaseImmune")
      && ![...(token.actor.system?.traits?.ci?.value ?? [])].some(type => ["disease", "diseased"].includes(type)));
    if (!targets.length) return false;
    const claimKey = `${frame.definition.id}:${tokenUuid(frame.sourceToken)}:${key}`;
    const stored = flag(frame.sourceToken.document, "auraEventClaims") ?? [];
    if (claims.has(claimKey) || stored.includes(claimKey)) return false;
    claims.add(claimKey);
    if (claims.size > 1000) claims.delete(claims.values().next().value);
    if (frame.sourceToken.document.setFlag) await frame.sourceToken.document.setFlag(MODULE_ID, "auraEventClaims", [...stored, claimKey].slice(-128));
    if (!isAuthority()) { notify("GM аур сменился во время срабатывания; результат нужно проверить вручную.", "warn"); return false; }
    return pulse({ sourceToken: frame.sourceToken, sourceItem: auraFeature(frame.sourceToken.actor, frame.definition),
      template: frame.template, targets, event, eventKey: claimKey, scene });
  }
  async function turn(combat, changes) {
    if (!isAuthority() || !enabled() || !isForwardTurn(combat, changes) || !combat.scene) return false;
    const scene = combat.scene, turnId = `${combat.id}:${combat.round}:${combat.turn}`;
    const currentId = combat.combatant?.tokenId, previousId = combat.previous?.tokenId
      ?? combat.combatants?.get?.(combat.previous?.combatantId)?.tokenId ?? combat.turns?.[combat.previous?.turn]?.tokenId;
    await synchronize(scene);
    const frames = [...framesForScene(scene)];
    return enqueue(async () => {
      for (const frame of frames) for (const event of frame.definition.events ?? []) {
        let targets = [];
        if (event.trigger === "sourceStart" && frame.sourceToken.document.id === currentId) targets = frame.targets;
        if (event.trigger === "sourceEnd" && frame.sourceToken.document.id === previousId) targets = frame.targets;
        if (event.trigger === "targetStart") targets = frame.targets.filter(token => token.document.id === currentId);
        if (event.trigger === "targetEnd") targets = frame.targets.filter(token => token.document.id === previousId);
        await once(frame, event, `${event.trigger}:${turnId}:${event.trigger.startsWith("target") ? (event.trigger === "targetStart" ? currentId : previousId) : ""}`, targets, scene);
      }
      return true;
    });
  }
  async function meleeAttempt({ attacker, targets, scene, eventKey }) {
    if (!isAuthority() || !enabled() || !attacker?.actor || !scene) return false;
    await synchronize(scene);
    const frames = [...framesForScene(scene)];
    return enqueue(async () => {
      for (const frame of frames) {
        if (!targets.includes(tokenUuid(frame.sourceToken)) || tokenUuid(attacker) === tokenUuid(frame.sourceToken)) continue;
        for (const event of frame.definition.events ?? []) if (event.trigger === "meleeAttempt"
          && (!event.requiresInside || frame.targets.some(token => tokenUuid(token) === tokenUuid(attacker))))
          await once(frame, event, `melee:${eventKey}`, [attacker], scene);
      }
      return true;
    });
  }
  function seed(actor) {
    health.set(actor.uuid, Number(actor.system?.attributes?.hp?.value ?? 0));
    if (actor.statuses?.has?.("dead") || (actor.type === "npc" && !flag(actor, "auraDeathRequiresStatus") && health.get(actor.uuid) <= 0)) deadActors.add(actor.uuid);
    else deadActors.delete(actor.uuid);
  }
  async function death(actor) {
    if (!isAuthority() || !enabled() || deadActors.has(actor.uuid) || flag(actor, "auraDeathProcessed")) return false;
    deadActors.add(actor.uuid);
    // Summon cleanup can delete its token/Actor while the flag update awaits.
    // Capture the actual death locations and size first, not a later corpse position.
    const corpse = { size: actor.system?.traits?.size, type: actor.system?.details?.type?.value };
    const locations = [...(game.scenes ?? [])].map(scene => ({ scene,
      deceased: tokensForScene(scene).filter(token => token.actor.uuid === actor.uuid).map(token => ({ actor,
        center: { ...token.center }, w: token.w, h: token.h, document: Object.fromEntries(["id", "uuid", "x", "y", "width", "height", "elevation"]
          .map(key => [key, token.document[key]])) })) })).filter(entry => entry.deceased.length);
    try { await actor.setFlag?.(MODULE_ID, "auraDeathProcessed", true); }
    catch (error) {
      if (!globalThis.fromUuid || await fromUuid(actor.uuid)) throw error;
      // The Actor really was removed; the in-memory claim still prevents repeats.
    }
    return enqueue(async () => {
      for (const { scene, deceased } of locations) {
        await synchronize(scene);
        for (const frame of framesForScene(scene)) {
          if (!frame.isActive() || !frame.definition.events?.some(event => event.trigger === "death")) continue;
          const eligible = tokensInAuraTemplate(frame.template, frame.sourceToken, deceased, scene, { native: false });
          const inRange = deceased.some(token => tokenUuid(token) !== tokenUuid(frame.sourceToken) && (eligible ? eligible.has(token)
            : tokenSceneDistance(frame.sourceToken, token, scene) <= feetToSceneUnits(frame.definition.radius, scene)));
          if (!inRange) continue;
          const sourceItem = auraFeature(frame.sourceToken.actor, frame.definition), npc = itemIdentifier(sourceItem) === "аура-опустоше-нных-душ-6";
          if (npc && ["undead", "construct"].includes(corpse.type)) continue;
          let amount = { sm: 10, med: 20, lg: 30, huge: 40, grg: 50 }[corpse.size] ?? 0;
          if (npc) amount = Math.min(40, amount);
          if (amount) await grantSoulAuraTemporaryHp(frame.sourceToken.actor, amount, sourceItem);
        }
      }
      return true;
    });
  }
  async function observeActor(actor, changes, options = {}) {
    const next = field(changes, "system.attributes.hp.value");
    if (next === undefined) return false;
    const before = health.get(actor.uuid) ?? options[MODULE_ID]?.auraOldHp, after = Number(actor.system?.attributes?.hp?.value ?? next);
    health.set(actor.uuid, after);
    if (after > 0 && (deadActors.has(actor.uuid) || flag(actor, "auraDeathProcessed"))) {
      deadActors.delete(actor.uuid);
      if (isAuthority()) await actor.unsetFlag?.(MODULE_ID, "auraDeathProcessed");
    }
    // PCs at 0 HP are unconscious, not dead. NPCs can opt into explicit-death-only.
    if (actor.type === "npc" && !flag(actor, "auraDeathRequiresStatus") && Number(before) > 0 && after <= 0) return death(actor);
    return false;
  }
  return { turn, meleeAttempt, observeActor, death, seed };
}

registerGmRequest("aura-melee-attempt", async (actor, data) => {
  if (!installedEngine || !Array.isArray(data.targetUuids) || data.targetUuids.length > 20 || typeof data.eventKey !== "string" || data.eventKey.length > 512)
    throw Error("Неверный запрос срабатывания ауры.");
  const activity = await fromUuid(data.activityUuid), attackerDocument = await fromUuid(data.attackerTokenUuid);
  if ((activity?.actor ?? activity?.item?.actor)?.uuid !== actor.uuid || attackerDocument?.actor?.uuid !== actor.uuid
    || activity.attack?.type?.value !== "melee") throw Error("Не найдена рукопашная атака владельца.");
  const scene = attackerDocument.parent;
  return { status: "success", result: await installedEngine.meleeAttempt({ attacker: attackerDocument.object ?? { actor, document: attackerDocument },
    targets: data.targetUuids.filter(uuid => String(uuid).startsWith(`${scene.uuid}.Token.`)), scene, eventKey: data.eventKey }) };
});

export async function handleAuraMeleeAttack(workflow) {
  if (!enabled() || workflow?.aborted || !workflow?.attackRoll || workflow.activity?.attack?.type?.value !== "melee") return;
  const actor = workflow.actor, token = workflow.token, targets = [...(workflow.targets ?? [])].map(tokenUuid);
  if (!actor || !token || !targets.length) return;
  return requestGm("aura-melee-attempt", actor, { attackerTokenUuid: tokenUuid(token), activityUuid: workflow.activity.uuid,
    targetUuids: targets, eventKey: workflow.id ?? workflow.activity.uuid }, { requestId: `aura-melee:${workflow.id ?? workflow.activity.uuid}` });
}

export function installAuraEventHooks(context) {
  const engine = installedEngine = createAuraEventEngine(context);
  const report = promise => void promise.catch(error => console.error(`${MODULE_ID} | Aura event failed`, error));
  Hooks.once("ready", () => { for (const actor of automationActors()) engine.seed(actor); });
  Hooks.on("createActor", actor => engine.seed(actor));
  Hooks.on("createToken", token => { if (token.actor) engine.seed(token.actor); });
  Hooks.on("dnd5e.preApplyDamage", (actor, amount, updates) => {
    if (enabled()) trackSoulAuraTemporaryHp(actor, updates, { damage: amount > 0 });
  });
  Hooks.on("preUpdateActor", (actor, changes, options) => {
    if (!enabled()) return;
    options[MODULE_ID] ??= {}; options[MODULE_ID].auraOldHp = Number(actor.system?.attributes?.hp?.value ?? 0);
    trackSoulAuraTemporaryHp(actor, changes);
  });
  Hooks.on("updateActor", (actor, changes, options) => report(engine.observeActor(actor, changes, options)));
  Hooks.on("createActiveEffect", effect => {
    if (effect.parent?.documentName === "Actor" && isEffectActive(effect) && effect.statuses?.has?.("dead")) report(engine.death(effect.parent));
  });
  Hooks.on("updateCombat", (combat, changes) => report(engine.turn(combat, changes)));
  Hooks.on("dnd5e.restCompleted", (actor, result) => {
    if (!enabled()) return;
    report(clearSoulAuraTemporaryHpOnRest(actor));
    if (result.longRest && actor.isOwner && findFeature(actor, "aura-of-carnage")) report(chooseCarnageAuraType(actor));
  });
}
