import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, automationData, automationAction, findFeature, notify, reportFailure } from "../shared/helpers.mjs";
import {
  doomedLevel,
  doomedState,
  doomedCurseActive,
  doomedGiftActive,
  doomedEmpowered
} from "../shared/doomed-state.mjs";
import { doomedCritical, doomedMaximum } from "../shared/doomed-definitions.mjs";
import { syncDoomed, doomedAvailable, prepareDoomedRest, doomedRestCompleted } from "./doomed.mjs";
import { controlDoomed } from "./doomed-actions.mjs";
import { isGmAuthority, registerGmRequest, requestGm } from "../shared/gm-requests.mjs";
import { onPrepareDamage, onConfirmedDamage } from "../shared/damage-events.mjs";
import { onPrepareAttack, turnKey, activeBenefits, benefitData, inFeet } from "../shared/combat-benefits.mjs";
import { encounterForScene, combatTurnSnapshot } from "../shared/combat-flow.mjs";
import { isEffectActive } from "../effects/temporary-effects.mjs";
import { isAuraIncapacitated } from "../shared/aura-conditions.mjs";
import { confirmOwner } from "../shared/owner-prompts.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { applyNativeOnce } from "../shared/native-applications.mjs";

export function doomedDrawbackActive(actor, id) {
  return (
    doomedCurseActive(actor, id) ||
    [...(actor?.effects ?? [])].some(
      e => isEffectActive(e) && e.getFlag?.(MODULE_ID, "doomedTransferred")?.curse === id
    )
  );
}
export function applyDoomedAttackConfig(config) {
  const activity = config.subject,
    actor = activity?.actor;
  if (!enabled() || !doomedGiftActive(actor, "rage")) return;
  for (const roll of config.rolls ?? []) {
    roll.options ??= {};
    roll.options.criticalSuccess = doomedCritical(roll.options.criticalSuccess ?? 20, {
      hp: Number(actor.system.attributes.hp.value),
      maximum: doomedMaximum(actor),
      empowered: doomedEmpowered(actor, "rage")
    });
  }
}
export function applyDoomedDeathSave(rolls, details) {
  const actor = details?.subject,
    roll = rolls?.[0];
  if (!enabled() || !doomedDrawbackActive(actor, "wounds") || !roll || roll.total >= Number(roll.options?.target ?? 10))
    return;
  const key = "system.attributes.death.failure";
  if (details.doomedDeathApplied || details.updates?.[key] == null) return;
  details.doomedDeathApplied = true;
  details.updates[key] = Math.min(3, Number(details.updates[key]) + (doomedEmpowered(actor, "wounds") ? 2 : 1));
  if (details.updates[key] >= 3) details.chatString = "DND5E.DeathSaveFailure";
}
export function applyDoomedChainsSave(_target, workflow, details) {
  if (!enabled() || !automationData(workflow?.activity).doomedChainsDisadvantage) return;
  details.disadvantage = true;
  details.modifierTracker?.disadvantage?.add?.(`${MODULE_ID}.doomed-chains`, "Усиленные цепи: первый спасбросок");
}
export function prepareDoomedHealing(token, { workflow, damageItem } = {}) {
  if (!enabled() || !token?.actor || !workflow?.activity || !damageItem) return;
  const activity = workflow.activity,
    data = automationData(activity);
  if (
    activity.item?.system.identifier !== "doomed-curse-hunger" ||
    !data.doomedHungerHealing ||
    activity.actor?.uuid !== token.actor.uuid ||
    !doomedGiftActive(activity.actor, "hunger")
  )
    return;
  const selector = damageItem.damageSelector ?? "combinedDamage",
    options = damageItem.damageDetails?.calcDamageOptions?.[selector] ?? damageItem.calcDamageOptions ?? {};
  options[MODULE_ID] = { ...options[MODULE_ID], doomedHungerHealing: data.doomedHungerHealing };
  damageItem.calcDamageOptions = options;
  damageItem.damageDetails ??= {};
  damageItem.damageDetails.calcDamageOptions ??= {};
  damageItem.damageDetails.calcDamageOptions[selector] = options;
}
export function applyDoomedHealthRules(actor, _amount, updates, options = {}) {
  if (!enabled() || !actor.system?.attributes?.hp) return;
  const hp = actor.system.attributes.hp,
    temp = updates["system.attributes.hp.temp"];
  if (doomedDrawbackActive(actor, "heart") && Number(temp) > Number(hp.temp ?? 0))
    updates["system.attributes.hp.temp"] = Number(hp.temp ?? 0);
  const value = updates["system.attributes.hp.value"],
    rest = options.isRest && !doomedEmpowered(actor, "hunger"),
    gift = options[MODULE_ID]?.doomedHungerHealing;
  if (
    doomedDrawbackActive(actor, "hunger") &&
    Number(value) > Number(hp.value) &&
    !rest &&
    !(gift && doomedGiftActive(actor, "hunger"))
  )
    updates["system.attributes.hp.value"] = Number(hp.value);
}
export function blockDoomedActivity(activity) {
  if (!enabled() || !activity?.actor) return;
  const actor = activity.actor,
    type = activity.activation?.type ?? "";
  if (
    doomedDrawbackActive(actor, "moment") &&
    (type.startsWith("reaction") || (doomedEmpowered(actor, "moment") && type === "bonus"))
  ) {
    notify("Украденный миг запрещает это действие.", "warn");
    return false;
  }
  if (doomedEmpowered(actor, "buried") && activity.type === "attack") {
    notify("Погребённая душа: усиленный недостаток запрещает атаки.", "warn");
    return false;
  }
  if (doomedDrawbackActive(actor, "disruption") && activity.duration?.concentration) {
    notify("Срыв чар запрещает поддерживать концентрацию.", "warn");
    return false;
  }
}
onPrepareDamage(({ actor, attacker, activity, data }) => {
  if (!doomedLevel(actor)) return null;
  const combat = encounterForScene(attacker.parent, attacker),
    snapshot = combat && combatTurnSnapshot(combat);
  return {
    context: {
      doomedApplication: {
        id: data.workflowId,
        turn: turnKey(combat),
        own: snapshot?.current.token?.uuid === attacker.uuid,
        suitable: activity.type === "attack" || activity.item.type === "spell",
        automatic: data.automatic === true,
        decayBonus: activity.item.system.identifier === "doomed-curse-decay",
        decayLoss: doomedCurseActive(actor, "decay")
          ? Number(actor.system.attributes.prof) * (doomedEmpowered(actor, "decay") ? 2 : 1)
          : 0,
        name: activity.item.name
      }
    }
  };
});
export async function recordDoomedDamage({ amount, event }) {
  const saved = event.doomedApplication;
  if (amount <= 0 || !saved?.own || !saved.turn) return;
  const actor = await fromUuid(event.sourceActorUuid),
    target = await fromUuid(event.targetTokenUuid);
  if (!actor || !target || actor.uuid === target.actor?.uuid) return;
  await serialMutation(`doomed:${actor.uuid}`, async () => {
    if (saved.suitable && !saved.automatic) {
      const rows = structuredClone(actor.getFlag(MODULE_ID, "doomedDamageApplications") ?? []);
      let row = rows.find(r => r.id === saved.id);
      if (!row) {
        row = { ...saved, sourceUuid: event.sourceTokenUuid, amount, targets: [] };
        rows.push(row);
      }
      let receiver = row.targets.find(t => t.uuid === target.uuid);
      if (!receiver) {
        receiver = { uuid: target.uuid, name: target.hidden ? "Цель подтверждённого урона" : target.name, types: [] };
        row.targets.push(receiver);
      }
      receiver.types = [
        ...new Set(
          [...receiver.types, ...(event.damageTypes ?? [event.damageType])].filter(
            type => type && !["healing", "temphp", "maximum", "midi-none"].includes(type)
          )
        )
      ];
      await actor.setFlag(MODULE_ID, "doomedDamageApplications", rows.slice(-30));
    }
    if (!saved.decayBonus && Number(saved.decayLoss) > 0) {
      const claims = actor.getFlag(MODULE_ID, "doomedDecayTurns") ?? [];
      if (claims.includes(saved.turn)) return;
      await actor.setFlag(MODULE_ID, "doomedDecayTurns", [...claims, saved.turn].slice(-40));
      const amount = Number(saved.decayLoss);
      await actor.update(
        { "system.attributes.hp.value": Math.max(0, Number(actor.system.attributes.hp.value) - amount) },
        { [MODULE_ID]: { doomedHpLoss: true } }
      );
    }
  });
}
onConfirmedDamage(recordDoomedDamage);
const outcastDecisions = new Map();
let outcastGame;
export async function doomedOutcastAttack({ actor, attacker, target, data }) {
  if (outcastGame !== game) {
    outcastDecisions.clear();
    outcastGame = game;
  }
  const key = `${actor.uuid}:${data.workflowId}:${target.uuid}`;
  if (outcastDecisions.has(key)) return outcastDecisions.get(key);
  const task = (async () => {
    const result = [];
    for (const token of attacker.parent.tokens ?? []) {
      const source = token.actor;
      if (
        !source ||
        source.uuid === target.actor.uuid ||
        source.uuid === actor.uuid ||
        !doomedGiftActive(source, "outcast") ||
        isAuraIncapacitated(source)
      )
        continue;
      if (!inFeet(token, attacker, doomedEmpowered(source, "outcast") ? 15 : 5, attacker.parent)) continue;
      const gm = { uuid: source.uuid, testUserPermission: user => user.isGM };
      if (
        await confirmOwner(
          gm,
          "Клеймо отверженного (GM)",
          `Атакующий враждебен ${token.name ?? source.name} и видит его? Эта атака направлена по другой цели.`
        )
      )
        result.push({
          kind: "attack-disadvantage",
          effectUuid: `doomed-outcast:${token.uuid}`,
          name: "Клеймо отверженного"
        });
    }
    return result;
  })();
  outcastDecisions.set(key, task);
  if (outcastDecisions.size > 200) outcastDecisions.delete(outcastDecisions.keys().next().value);
  return task;
}
onPrepareAttack(doomedOutcastAttack);
registerGmRequest("doomed-initiative", (actor, data, { requestId }) =>
  serialMutation(`doomed:${actor.uuid}`, async () => {
    if (!enabled() || !isGmAuthority() || !doomedCurseActive(actor, "luck")) return false;
    const message = await fromUuid(data.messageUuid),
      item = findFeature(actor, "doomed-curse-luck");
    if (!message?.flags?.core?.initiativeRoll || !item || message.speaker?.actor !== actor.id) return false;
    return applyNativeOnce(
      actor,
      { requestId, action: "doomed-initiative", activityUuid: null },
      async () => true,
      async () => {
        await item.update({ "system.uses.spent": 0 });
        return true;
      }
    );
  })
);
export function handleDoomedInitiative(message) {
  if (!enabled() || !isGmAuthority() || !message.flags?.core?.initiativeRoll) return Promise.resolve(false);
  const scene = game.scenes?.get?.(message.speaker?.scene),
    token =
      scene?.tokens?.get?.(message.speaker?.token) ??
      [...(scene?.tokens ?? [])].find(t => t.id === message.speaker?.token),
    actor = token?.actor ?? game.actors?.get?.(message.speaker?.actor);
  if (!actor || !doomedCurseActive(actor, "luck")) return Promise.resolve(false);
  return requestGm(
    "doomed-initiative",
    actor,
    { messageUuid: message.uuid },
    { requestId: `doomed-initiative:${message.uuid}` }
  );
}
export async function endDoomedInvisibility(workflow) {
  const actor = workflow?.actor,
    activity = workflow?.activity;
  if (
    !enabled() ||
    !isGmAuthority() ||
    workflow.aborted ||
    !actor ||
    !(activity?.type === "attack" || activity?.item?.type === "spell")
  )
    return;
  for (const effect of activeBenefits(actor)) {
    const data = benefitData(effect);
    if (data.kind === "doomed-invisibility" && !(data.doomedShadow?.empowered && doomedEmpowered(actor, "shadow")))
      await effect.delete();
  }
}
export function installDoomedHooks() {
  const report = reportFailure("Doomed automation");
  const intercept = activity => {
    if (blockDoomedActivity(activity) === false) return false;
    if (
      !enabled() ||
      automationData(activity).leaderResolved ||
      automationData(activity).auraPulse ||
      automationAction(activity) !== "doomed-control"
    )
      return;
    if (!doomedAvailable(activity.actor, activity.item)) return false;
    report(controlDoomed(activity.actor, activity));
    return false;
  };
  Hooks.on("midi-qol.preTargetingV2", ({ workflow }) => intercept(workflow?.activity));
  Hooks.on("dnd5e.preUseActivity", intercept);
  Hooks.on("dnd5e.preRollAttack", applyDoomedAttackConfig);
  Hooks.on("dnd5e.rollDeathSaveV2", applyDoomedDeathSave);
  Hooks.on("midi-qol.preTargetSave", applyDoomedChainsSave);
  Hooks.on("midi-qol.preTargetDamageApplication", prepareDoomedHealing);
  Hooks.on("dnd5e.preApplyDamage", applyDoomedHealthRules);
  Hooks.on("preUpdateActor", (actor, changes) => {
    if (!enabled() || !doomedDrawbackActive(actor, "heart")) return;
    const value = changes["system.attributes.hp.temp"] ?? changes.system?.attributes?.hp?.temp;
    if (Number(value) > 0) {
      if (Object.hasOwn(changes, "system.attributes.hp.temp")) changes["system.attributes.hp.temp"] = 0;
      else changes.system.attributes.hp.temp = 0;
    }
  });
  Hooks.on("preCreateActiveEffect", effect => {
    if (
      enabled() &&
      doomedDrawbackActive(effect.parent, "disruption") &&
      [...(effect.statuses ?? [])].includes("concentrating")
    )
      return false;
  });
  Hooks.on("dnd5e.preRestCompleted", prepareDoomedRest);
  Hooks.on("dnd5e.restCompleted", (actor, result) => report(doomedRestCompleted(actor, result)));
  Hooks.on("createChatMessage", message => report(handleDoomedInitiative(message)));
  Hooks.on("midi-qol.RollComplete", workflow => report(endDoomedInvisibility(workflow)));
  for (const hook of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect"])
    Hooks.on(hook, effect => {
      if (effect.getFlag?.(MODULE_ID, "doomedAmplification") && effect.parent) report(syncDoomed(effect.parent));
    });
}
