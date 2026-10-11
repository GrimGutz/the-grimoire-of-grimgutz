import {MODULE_ID} from "../shared/constants.mjs";
import {enabled, automationData, notify} from "../shared/helpers.mjs";
import {isGmAuthority, registerGmRequest, requestGm} from "../shared/gm-requests.mjs";
import {askOwner, chooseSceneTokens} from "../shared/owner-prompts.mjs";
import {onConfirmedDamage} from "../shared/damage-events.mjs";
import {dispatchAutomationPulse} from "../midi/aura-workflow.mjs";
import {combatTurnSnapshot, isForwardTurn} from "../shared/combat-flow.mjs";
import {runAutomationEvent} from "../shared/event-ledger.mjs";
import {temporaryEffectTiming} from "../effects/temporary-effects.mjs";
import {inFeet} from "../shared/combat-benefits.mjs";
import {inspiringTemporaryHp} from "../shared/leader-presence-definitions.mjs";

export const ritualSpiritRules = actor => actor.getFlag?.(MODULE_ID, "summonTemplate")?.ritualistRules ?? null;
const variant = actor => actor.getFlag?.(MODULE_ID, "summonSource") === "binding-ritual" ? actor.getFlag(MODULE_ID, "summonTemplate")?.variant : null;
export function spiritIsFriendly(source, target) {return source.disposition === target.disposition;}
export function spiritIsEnemy(source, target) {return Number(source.disposition) * Number(target.disposition) < 0;}
export const bloodSongHealing = damage => Math.max(0, Math.floor(Number(damage) / 2));
const spiritItem = actor => [...(actor.items ?? [])].find(item => item.system?.activities?.size) ?? [...(actor.items ?? [])][0];
export async function applyAgony(scene, target, workflowId) {
  for (const source of scene.tokens ?? []) {
    const rules = source.actor && ritualSpiritRules(source.actor);
    if (!rules || variant(source.actor) !== "agony" || Number(source.actor.system.attributes.hp.value) <= 0
      || !spiritIsEnemy(source, target) || !inFeet(source, target, 30, scene)) continue;
    await dispatchAutomationPulse({scene, sourceToken: source.object ?? {actor: source.actor, document: source}, sourceItem: spiritItem(source.actor),
      targets: [target.object ?? {actor: target.actor, document: target}], event: {save: "wis", dc: String(rules.dc), damage: [{formula: `${rules.level}d6`, type: "psychic"}]},
      eventKey: `ritual-agony:${source.uuid}:${workflowId}:${target.uuid}`});
  }
}
onConfirmedDamage(async ({amount, event}) => {
  const source = await fromUuid(event.sourceTokenUuid), target = await fromUuid(event.targetTokenUuid), activity = await fromUuid(event.activityUuid);
  if (!source || !target || amount <= 0) return;
  if (variant(source.actor) === "blood-song" && automationData(activity).ritualistBloodSong) {
    const owner = await fromUuid(source.actor.getFlag(MODULE_ID, "summonedBy"));
    const healing = bloodSongHealing(amount);
    if (owner && healing) await owner.applyDamage([{value: healing, type: "healing"}], {invertHealing: true});
  }
  if (!event.automatic && (activity?.type === "attack" || activity?.item?.type === "spell")) await applyAgony(target.parent, target, event.workflowId);
});
registerGmRequest("ritualist-agony-hit", async (actor, data) => {
  const activity = await fromUuid(data.activityUuid), source = await fromUuid(data.sourceUuid);
  if (activity?.actor?.uuid !== actor.uuid || source?.actor?.uuid !== actor.uuid || activity.type !== "attack") return false;
  for (const uuid of data.targets) {const target = await fromUuid(uuid); if (target?.parent?.id === source.parent.id) await applyAgony(source.parent, target, data.workflowId);}
  return true;
});
registerGmRequest("ritualist-spirit-recipients", async (actor, data) => {
  const source = await fromUuid(data.sourceUuid), rules = ritualSpiritRules(actor);
  if (!rules || variant(actor) !== "possibilities" || source?.actor?.uuid !== actor.uuid) return false;
  const targets = await chooseSceneTokens(actor, source.parent, {title: "Дух великих возможностей", min: 0, max: rules.level, relation: token => spiritIsFriendly(source, token)});
  if (targets == null) return false;
  await actor.setFlag(MODULE_ID, "ritualistRecipients", targets.map(token => token.uuid)); return true;
});
export async function chooseRitualistSpiritRecipients(actor) {
  const source = actor.getActiveTokens?.()[0]?.document;
  if (!source) return false; return requestGm("ritualist-spirit-recipients", actor, {sourceUuid: source.uuid});
}
registerGmRequest("ritualist-sorrow-outcomes", async (actor, data) => {
  const activity = await fromUuid(data.activityUuid), source = await fromUuid(data.sourceUuid), rules = ritualSpiritRules(actor);
  if (activity?.actor?.uuid !== actor.uuid || !automationData(activity).ritualistSorrow || !rules || !["blinded", "deafened"].includes(data.status)) return false;
  for (const uuid of data.failed) {
    const target = await fromUuid(uuid); if (target?.parent?.id !== source?.parent?.id || target.actor.system.traits?.ci?.value?.has?.(data.status)) continue;
    await runAutomationEvent({id: `ritual-sorrow:${data.workflowId}:${uuid}`, kind: "ritualist-sorrow", sceneId: target.parent.id, sourceActorUuid: actor.uuid}, async () => {
      await target.actor.createEmbeddedDocuments("ActiveEffect", [{name: "Скорбная песня", type: "base", origin: activity.item.uuid, transfer: false, disabled: false,
        statuses: [data.status], ...temporaryEffectTiming({rounds: Math.max(1, rules.wisMod), expiry: "turnEnd", actor: target.actor}),
        flags: {[MODULE_ID]: {repeatSave: {ability: "con", dc: rules.dc, sourceItemUuid: activity.item.uuid, event: "turnEnd"}}, dae: {expiryMode: "delete"}}, system: {changes: []}}]); return true;
    });
  } return true;
});
export async function processSpiritPossibilities(snapshot) {
  const token = snapshot.current.token, scene = token?.parent;
  if (!token?.actor || !scene) return;
  for (const source of scene.tokens ?? []) {
    const actor = source.actor, rules = actor && ritualSpiritRules(actor);
    if (!rules || variant(actor) !== "possibilities" || Number(actor.system.attributes.hp.value) <= 0
      || !spiritIsFriendly(source, token) || !actor.getFlag(MODULE_ID, "ritualistRecipients")?.includes(token.uuid)) continue;
    await runAutomationEvent({id: `ritual-temp:${source.uuid}:${token.uuid}:${snapshot.id}:${snapshot.current.round}:${snapshot.current.turn}`,
      kind: "ritualist-possibilities", sceneId: scene.id, sourceActorUuid: actor.uuid}, async () => {
      const temp = inspiringTemporaryHp(token.actor, Math.max(1, rules.conMod));
      if (temp > Number(token.actor.system.attributes.hp.temp ?? 0)) await token.actor.update({"system.attributes.hp.temp": temp}); return true;
    });
  }
}
export function installRitualistSpiritHooks() {
  Hooks.on("midi-qol.preTargetingV2", async ({workflow}) => {
    const activity = workflow?.activity;
    if (enabled() && automationData(activity).ritualistBloodSong) {
      activity.updateSource?.({"range.value": automationData(activity).longRange ?? 60, "range.override": true});
    }
    if (!enabled() || automationData(activity).areaResolved || !automationData(activity).ritualistSorrow || automationData(activity).sorrowStatus) return;
    const status = await askOwner(activity.actor, {title: "Скорбная песня", choices: [["blinded", "Ослепление"], ["deafened", "Глухота"]]});
    if (!status) return false;
    activity.updateSource({[`flags.${MODULE_ID}.sorrowStatus`]: status});
  });
  Hooks.on("midi-qol.preAttackRollConfig", workflow => {
    const data = automationData(workflow.activity);
    if (!enabled() || !data.ritualistBloodSong || workflow.targets?.size !== 1) return;
    const target = [...workflow.targets][0], source = workflow.token;
    if (source && !inFeet(source, target, data.normalRange ?? 30, source.document?.parent ?? source.parent))
      workflow.attackRollModifierTracker?.disadvantage?.add?.(`${MODULE_ID}.bloodSongRange`, "Кровавая песня: дальняя дистанция");
  });
  Hooks.on("midi-qol.RollComplete", workflow => {
    if (!enabled() || workflow.aborted || workflow.workflowOptions?.grimgutzAuraPulse || !workflow.token) return;
    const source = workflow.token.document ?? workflow.token;
    if (workflow.attackRoll && workflow.hitTargets?.size) void requestGm("ritualist-agony-hit", workflow.actor, {activityUuid: workflow.activity.uuid, sourceUuid: source.uuid,
      workflowId: workflow.id, targets: [...workflow.hitTargets].map(t => (t.document ?? t).uuid)}).catch(error => notify(error.message, "warn"));
    if (automationData(workflow.activity).ritualistSorrow && workflow.failedSaves?.size) void requestGm("ritualist-sorrow-outcomes", workflow.actor,
      {activityUuid: workflow.activity.uuid, sourceUuid: source.uuid, workflowId: workflow.id, status: automationData(workflow.activity).sorrowStatus,
        failed: [...workflow.failedSaves].map(t => (t.document ?? t).uuid)}).catch(error => notify(error.message, "warn"));
  });
  Hooks.on("updateCombat", (combat, changes) => {if (enabled() && isGmAuthority() && isForwardTurn(combat, changes))
    void processSpiritPossibilities(combatTurnSnapshot(combat)).catch(error => console.error(`${MODULE_ID} | Spirit temporary HP`, error));});
}
