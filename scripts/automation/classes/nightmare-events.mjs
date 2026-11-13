import { MODULE_ID } from "../shared/constants.mjs";
import { NIGHTMARE_FEARS, nightmareMaximumHP } from "../shared/nightmare-definitions.mjs";
import {
  nightmareLevel,
  nightmareFears,
  nightmareFearData,
  nightmareFrightened,
  nightmarePool,
  nightmarePoints,
  nightmareResourceState
} from "../shared/nightmare-state.mjs";
import { enabled, automationData, automationAction, reportFailure } from "../shared/helpers.mjs";
import { nightmareAvailable, changeNightmarePoints, nightmareRestCompleted } from "./nightmare.mjs";
import { controlNightmare } from "./nightmare-actions.mjs";
import { triggerNightmareFear, nightmareTargetEpoch } from "./nightmare-fears.mjs";
import {
  controlNightmareSummon,
  cleanNightmareSummonEffects,
  expireNightmaresForDeadOwner
} from "./nightmare-summons.mjs";
import { onPrepareDamage, onConfirmedDamage } from "../shared/damage-events.mjs";
import { onPrepareAttack, inFeet, turnKey, activeBenefits, benefitData } from "../shared/combat-benefits.mjs";
import { combatTurnSnapshot, encounterForScene, isForwardTurn } from "../shared/combat-flow.mjs";
import { isGmAuthority, registerGmRequest, requestGm } from "../shared/gm-requests.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { runAutomationEvent, registerAutomationEvent } from "../shared/event-ledger.mjs";
import { confirmOwner } from "../shared/owner-prompts.mjs";
import { automationActors } from "../effects/temporary-effects.mjs";

const gm = actor => ({ uuid: actor.uuid, testUserPermission: user => user.isGM });
const latent = token =>
  nightmareFears(token.actor).filter(effect => {
    const data = nightmareFearData(effect);
    return !data.manifested && data.targetTokenUuid === token.uuid;
  });
const tokenMatches = (entry, token) =>
  entry.tokenUuid ? entry.tokenUuid === token.uuid : entry.tokenId === token.id && entry.scene?.id === token.parent.id;
function triggerRecord(
  effect,
  target,
  key,
  { epoch = nightmareTargetEpoch(target), timing = "normal", hint = "" } = {}
) {
  const data = nightmareFearData(effect);
  return {
    id: `nightmare-trigger:${effect.uuid}:${data.nonce}:${key}`,
    kind: "nightmare-trigger",
    name: effect.name,
    sceneId: target.parent.id,
    sourceActorUuid: data.sourceActorUuid,
    sourceTokenUuid: data.sourceTokenUuid,
    sourceItemUuid: data.sourceItemUuid,
    targetTokenUuid: target.uuid,
    effectUuid: effect.uuid,
    nonce: data.nonce,
    dc: data.dc,
    epoch,
    timing,
    hint
  };
}
registerAutomationEvent("nightmare-trigger", triggerNightmareFear);
export const runNightmareTrigger = record =>
  runAutomationEvent(record, () => triggerNightmareFear(record), {
    queued: canvas.scene?.id !== record.sceneId || !canvas.ready
  });
export function nightmareCombatRecords(combat, changes) {
  if (!enabled() || !isGmAuthority() || !isForwardTurn(combat, changes)) return [];
  const snapshot = combatTurnSnapshot(combat),
    records = [];
  for (const [timing, entry] of [
    ["start", snapshot.current],
    ["end", snapshot.previous]
  ]) {
    const target = entry.token;
    if (!target?.actor) continue;
    const epoch = `${snapshot.id}:${entry.round}:${entry.turn}`;
    for (const effect of latent(target)) {
      const data = nightmareFearData(effect),
        definition = NIGHTMARE_FEARS.find(e => e.id === data.fear);
      if (definition?.trigger !== timing) continue;
      if (timing === "end") {
        const rows = (target.actor.getFlag(MODULE_ID, "nightmareAttackRows") ?? []).filter(
          row => row.epoch === epoch && row.fears.some(fear => fear.uuid === effect.uuid && fear.nonce === data.nonce)
        );
        if (!rows.length || rows.some(row => row.hit)) continue;
      }
      records.push(
        triggerRecord(effect, target, `${snapshot.id}:${timing}:${entry.round}:${entry.turn}`, {
          epoch,
          timing,
          hint:
            timing === "start"
              ? "Начало хода цели; отношения, зрение, предметы и укрытие подтверждаются GM."
              : "В конце хода: была хотя бы одна подтверждённая Midi-атака после наложения, без попаданий. После проявления сразу спасбросок снятия."
        })
      );
    }
  }
  return records;
}
onPrepareDamage(({ actor, attacker, target, activity, data }) => {
  const combat = encounterForScene(attacker.parent, attacker),
    snapshot = combat && combatTurnSnapshot(combat),
    fears = latent(target).map(effect => ({ uuid: effect.uuid, nonce: nightmareFearData(effect).nonce }));
  return {
    context: {
      nightmareDamage: {
        id: data.workflowId,
        own: snapshot?.current.token?.uuid === attacker.uuid,
        turn: turnKey(combat),
        attack: activity.type === "attack",
        spell: activity.item.type === "spell",
        automatic: data.automatic === true,
        epoch: nightmareTargetEpoch(target),
        targetMaximum: nightmareMaximumHP(target.actor),
        fears
      }
    }
  };
});
export async function recordNightmareDamage({ actor: damaged, amount, event }) {
  if (!enabled() || !isGmAuthority() || amount <= 0) return;
  const context = event.nightmareDamage,
    scene = game.scenes?.get?.(event.sceneId),
    target =
      scene?.tokens?.get?.(event.targetTokenUuid?.split(".")[3]) ??
      [...(scene?.tokens ?? [])].find(token => token.uuid === event.targetTokenUuid);
  if (!target?.actor) return;
  const records = [];
  if (context && !context.automatic && (context.attack || context.spell))
    for (const effect of latent(target)) {
      const data = nightmareFearData(effect),
        valid = context.fears?.some(row => row.uuid === effect.uuid && row.nonce === data.nonce);
      if (
        valid &&
        ((data.fear === "algo" && amount >= Math.ceil(context.targetMaximum / 4)) ||
          (data.fear === "nycto" && context.attack))
      )
        records.push(
          triggerRecord(effect, target, event.key, {
            epoch: context.epoch,
            hint:
              data.fear === "algo"
                ? "Подтверждённый урон атакой/заклинанием ≥ четверти максимума (вверх)."
                : "Атака нанесла урон; GM проверяет, что цель была в темноте и не видела именно атакующего."
          })
        );
    }
  if (Number(event.beforeHp) > 0 && Number(damaged.system.attributes.hp.value) === 0) {
    const combat = encounterForScene(scene, target),
      participant = (combat?.turns ?? []).some(entry =>
        tokenMatches({ tokenUuid: entry.token?.uuid, tokenId: entry.tokenId ?? entry.token?.id, scene }, target)
      );
    if (combat?.started && participant)
      for (const bearer of scene.tokens ?? []) {
        if (
          bearer.uuid === target.uuid ||
          Number(bearer.actor?.system?.attributes?.hp?.value) > nightmareMaximumHP(bearer.actor) / 2 ||
          !inFeet(target, bearer, 30, scene)
        )
          continue;
        for (const effect of latent(bearer).filter(effect => nightmareFearData(effect).fear === "thanato"))
          records.push(
            triggerRecord(effect, bearer, event.key, {
              hint: "Другое участвующее в бою существо упало до 0 в 30 футах; у носителя ≤ половины хитов. GM подтверждает, что носитель видел именно это падение."
            })
          );
      }
  }
  const source = await fromUuid(event.sourceActorUuid);
  if (source && nightmareLevel(source) && context?.own && !context.automatic && (context.attack || context.spell))
    await serialMutation(`nightmare-damage:${source.uuid}`, async () => {
      const rows = structuredClone(source.getFlag(MODULE_ID, "nightmareDamageApplications") ?? []);
      let row = rows.find(row => row.id === context.id);
      if (!row) {
        row = { ...context, sourceUuid: event.sourceTokenUuid, targets: [] };
        rows.push(row);
      }
      if (!row.targets.some(entry => entry.uuid === target.uuid))
        row.targets.push({ uuid: target.uuid, name: target.hidden ? "Цель подтверждённого урона" : target.name });
      await source.setFlag(MODULE_ID, "nightmareDamageApplications", rows.slice(-30));
    });
  for (const record of records) await runNightmareTrigger(record);
}
onConfirmedDamage(recordNightmareDamage);
export function captureNightmareAttack(workflow) {
  if (!enabled() || !workflow?.actor || !workflow.token || workflow.activity?.type !== "attack") return;
  const token = workflow.token.document ?? workflow.token;
  workflow.grimgutzNightmareAttack = {
    sourceUuid: token.uuid,
    epoch: nightmareTargetEpoch(token),
    fears: latent(token).map(effect => ({ uuid: effect.uuid, nonce: nightmareFearData(effect).nonce }))
  };
}
registerGmRequest("nightmare-attack-observed", (actor, data) =>
  serialMutation(`nightmare-attacks:${actor.uuid}`, async () => {
    if (!enabled() || !isGmAuthority() || typeof data.hit !== "boolean") return false;
    const source = await fromUuid(data.sourceUuid),
      activity = await fromUuid(data.activityUuid);
    if (source?.actor?.uuid !== actor.uuid || activity?.actor?.uuid !== actor.uuid || activity.type !== "attack")
      return false;
    const rows = actor.getFlag(MODULE_ID, "nightmareAttackRows") ?? [];
    if (rows.some(row => row.id === data.id)) return true;
    await actor.setFlag(
      MODULE_ID,
      "nightmareAttackRows",
      [...rows, { id: data.id, hit: data.hit, epoch: data.epoch, fears: data.fears ?? [] }].slice(-50)
    );
    return true;
  })
);
export function finishNightmareAttack(workflow) {
  const snapshot = workflow?.grimgutzNightmareAttack;
  if (
    !enabled() ||
    workflow.aborted ||
    !workflow.attackRoll ||
    !snapshot?.fears.length ||
    typeof workflow.hitTargets?.size !== "number"
  )
    return Promise.resolve(false);
  return requestGm(
    "nightmare-attack-observed",
    workflow.actor,
    { ...snapshot, id: workflow.id, activityUuid: workflow.activity.uuid, hit: workflow.hitTargets.size > 0 },
    { requestId: `nightmare-attack:${workflow.id}` }
  );
}
export async function grantNightmareFear(record) {
  if (!enabled() || !isGmAuthority()) return false;
  const source = await fromUuid(record.sourceTokenUuid),
    target = await fromUuid(record.targetTokenUuid);
  if (!source?.actor || !target?.actor) return false;
  return serialMutation(`nightmare-feed:${source.actor.uuid}`, async () => {
    const actor = source.actor,
      claims = actor.getFlag(MODULE_ID, "nightmareFeedRounds") ?? [];
    if (
      !nightmareLevel(actor) ||
      !nightmarePool(actor) ||
      claims.includes(record.round) ||
      nightmarePoints(actor) >= nightmareResourceState(actor).maximum
    )
      return false;
    if (
      !(await confirmOwner(
        gm(actor),
        "Поглощение испуга (GM)",
        "В момент нового испуга существо имело ≥1 хита, было видно Кошмару в 60 футах, и Кошмар участвовал в бою с враждебным ему существом? Повтор уже имеющегося испуга не подходит."
      ))
    )
      return false;
    await actor.setFlag(MODULE_ID, "nightmareFeedRounds", [...claims, record.round].slice(-40));
    await changeNightmarePoints(actor, 1);
    return true;
  });
}
registerAutomationEvent("nightmare-feeding", grantNightmareFear);
let fearGame;
const frightenedCache = new Map();
export function seedNightmareFearTracking() {
  if (fearGame !== game) {
    frightenedCache.clear();
    fearGame = game;
  }
  for (const actor of automationActors()) frightenedCache.set(actor.uuid, Boolean(nightmareFrightened(actor)));
}
export async function observeNightmareFrightened(actor) {
  if (!enabled() || !isGmAuthority() || !actor?.uuid) return;
  if (fearGame !== game) {
    frightenedCache.clear();
    fearGame = game;
  }
  const current = Boolean(nightmareFrightened(actor)),
    previous = frightenedCache.get(actor.uuid);
  frightenedCache.set(actor.uuid, current);
  if (previous !== false || !current || Number(actor.system?.attributes?.hp?.value) < 1) return;
  const nonce = foundry.utils.randomID(),
    records = [];
  for (const scene of game.scenes ?? [])
    for (const target of scene.tokens ?? []) {
      if (target.actor?.uuid !== actor.uuid) continue;
      for (const source of scene.tokens ?? []) {
        if (!nightmareLevel(source.actor) || !inFeet(source, target, 60, scene)) continue;
        const combat = encounterForScene(scene, source),
          snapshot = combat && combatTurnSnapshot(combat);
        if (!snapshot?.id || !combat.started) continue;
        records.push({
          id: `nightmare-feed:${nonce}:${source.actor.uuid}:${combat.id}`,
          kind: "nightmare-feeding",
          name: "Поглощение испуга",
          sourceActorUuid: source.actor.uuid,
          sourceTokenUuid: source.uuid,
          targetTokenUuid: target.uuid,
          sceneId: scene.id,
          round: `${combat.id}:${snapshot.current.round}`
        });
      }
    }
  for (const record of records)
    await runAutomationEvent(record, () => grantNightmareFear(record), { queued: canvas.scene?.id !== record.sceneId });
}
export function applyNightmareSave(_target, workflow, details) {
  const data = automationData(workflow?.activity);
  if (
    !enabled() ||
    details.nightmareModifiersApplied ||
    !(data.nightmareOverrideAdvantage || data.nightmareRepeatDisadvantage)
  )
    return;
  details.nightmareModifiersApplied = true;
  if (data.nightmareOverrideAdvantage) {
    details.advantage = true;
    details.modifierTracker?.advantage?.add?.(
      `${MODULE_ID}.nightmare-override`,
      "Иммунитет заменён сопротивлением этого испуга"
    );
  }
  if (data.nightmareRepeatDisadvantage) {
    details.disadvantage = true;
    details.modifierTracker?.disadvantage?.add?.(`${MODULE_ID}.nightmare-thanato`, "Танатофобия: спасбросок снятия");
  }
}
export function blockNightmareActivity(activity) {
  if (!enabled() || !activity?.actor || automationData(activity).auraPulse) return;
  if (activity.actor.getFlag?.(MODULE_ID, "summonSource") === "nightmare-call") {
    const lifecycle = activity.actor.getFlag(MODULE_ID, "summonLifecycle");
    if (
      Number(activity.actor.system?.attributes?.hp?.value) <= 0 ||
      lifecycle?.expiresAt <= Number(game.time.worldTime)
    )
      return false;
    if (activity.item?.type && activity.item.type !== "feat") return false;
  }
  const actor = activity.actor,
    ids = new Set(
      nightmareFears(actor)
        .filter(e => nightmareFearData(e).manifested)
        .map(e => nightmareFearData(e).fear)
    ),
    activation = activity.activation?.type ?? "";
  if (
    (ids.has("auto") && activation.startsWith("reaction")) ||
    (ids.has("ochlo") && activation === "bonus") ||
    (ids.has("rhabdo") && activity.item?.type === "spell")
  )
    return false;
  const mute = activeBenefits(actor).some(effect => benefitData(effect).kind === "nightmare-silence"),
    properties = activity.item?.system?.properties;
  if (mute && activity.item?.type === "spell" && (properties?.has?.("vocal") || properties?.includes?.("vocal")))
    return false;
}
export function applyNightmareHealingBan(actor, _amount, updates) {
  if (
    enabled() &&
    nightmareFears(actor).some(e => nightmareFearData(e).manifested && nightmareFearData(e).fear === "algo") &&
    Number(updates["system.attributes.hp.value"]) > Number(actor.system.attributes.hp.value)
  )
    updates["system.attributes.hp.value"] = Number(actor.system.attributes.hp.value);
}
export async function endNightmareBlindSpot(workflow) {
  if (
    !enabled() ||
    !isGmAuthority() ||
    workflow?.aborted ||
    !(workflow?.activity?.type === "attack" || workflow?.activity?.item?.type === "spell") ||
    automationData(workflow.activity).auraPulse
  )
    return;
  for (const effect of [...(workflow.actor?.concentration?.effects ?? [])])
    if (effect.getFlag?.(MODULE_ID, "nightmareBlindSpot")) await workflow.actor.endConcentration(effect);
}
onPrepareAttack(async ({ target, activity }) =>
  activity.attack?.type?.value === "ranged"
    ? nightmareFears(target.actor)
        .filter(effect => nightmareFearData(effect).manifested && nightmareFearData(effect).fear === "hoplo")
        .map(effect => ({ kind: "attack-advantage", effectUuid: effect.uuid, name: "Гоплофобия" }))
    : []
);
export function installNightmareHooks() {
  const report = reportFailure("Nightmare automation");
  const intercept = activity => {
    if (blockNightmareActivity(activity) === false) return false;
    if (!enabled() || automationData(activity).leaderResolved || automationData(activity).auraPulse) return;
    const action = automationAction(activity);
    if (action === "nightmare-summon-control") {
      report(controlNightmareSummon(activity.actor, activity));
      return false;
    }
    if (action !== "nightmare-control") return;
    if (!nightmareAvailable(activity.actor, activity.item)) return false;
    report(controlNightmare(activity.actor, activity));
    return false;
  };
  Hooks.on("midi-qol.preTargetingV2", ({ workflow }) => intercept(workflow?.activity));
  Hooks.on("dnd5e.preUseActivity", intercept);
  Hooks.on("midi-qol.preAttackRoll", captureNightmareAttack);
  Hooks.on("midi-qol.preTargetSave", applyNightmareSave);
  Hooks.on("midi-qol.RollComplete", workflow => {
    report(finishNightmareAttack(workflow));
    report(endNightmareBlindSpot(workflow));
  });
  Hooks.on("dnd5e.preApplyDamage", applyNightmareHealingBan);
  Hooks.on("dnd5e.preRestCompleted", (actor, result) => applyNightmareHealingBan(actor, 0, result.updateData ?? {}));
  Hooks.on("dnd5e.restCompleted", (actor, result) => report(nightmareRestCompleted(actor, result)));
  Hooks.on("ready", seedNightmareFearTracking);
  Hooks.on("canvasReady", () => {
    for (const actor of automationActors())
      if (!frightenedCache.has(actor.uuid)) frightenedCache.set(actor.uuid, Boolean(nightmareFrightened(actor)));
  });
  Hooks.on("createActor", actor => {
    frightenedCache.set(actor.uuid, Boolean(nightmareFrightened(actor)));
  });
  Hooks.on("createToken", token => {
    if (token.actor && !frightenedCache.has(token.actor.uuid))
      frightenedCache.set(token.actor.uuid, Boolean(nightmareFrightened(token.actor)));
  });
  Hooks.on("updateActor", actor => {
    report(observeNightmareFrightened(actor));
    report(expireNightmaresForDeadOwner(actor));
  });
  Hooks.on("updateToken", (token, changes) => {
    if (token.actor && (changes.delta || Object.keys(changes).some(key => key.startsWith("delta.")))) {
      report(observeNightmareFrightened(token.actor));
      report(expireNightmaresForDeadOwner(token.actor));
    }
  });
  for (const hook of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect"])
    Hooks.on(hook, effect => {
      if (effect.parent?.documentName === "Actor") {
        report(observeNightmareFrightened(effect.parent));
        report(expireNightmaresForDeadOwner(effect.parent));
      }
    });
  Hooks.on("deleteActor", actor => {
    if (actor.getFlag?.(MODULE_ID, "summonSource") === "nightmare-call")
      report(cleanNightmareSummonEffects(actor.getFlag(MODULE_ID, "summonRequestId")));
  });
  Hooks.on("deleteToken", token => {
    if (token.actor?.getFlag?.(MODULE_ID, "summonSource") === "nightmare-call")
      report(cleanNightmareSummonEffects(token.actor.getFlag(MODULE_ID, "summonRequestId")));
  });
  Hooks.on("updateCombat", (combat, changes) => {
    const records = nightmareCombatRecords(combat, changes);
    for (const record of records) report(runNightmareTrigger(record));
  });
}
