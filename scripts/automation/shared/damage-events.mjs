import { MODULE_ID } from "./constants.mjs";
import { enabled, automationData } from "./helpers.mjs";
import { isGmAuthority, registerGmRequest, requestGm } from "./gm-requests.mjs";
import { activeBenefits, benefitData, matchesAttackBenefit, consumeBenefit, tokenRef, appendCalculatedBonus, canReact, combatForScene, turnKey } from "./combat-benefits.mjs";
import { runAutomationEvent } from "./event-ledger.mjs";
import { chooseSceneTokens } from "./owner-prompts.mjs";
import { serialMutation } from "./transactions.mjs";
import {leaderReceipt, leaderReceiptData} from "./leader-receipts.mjs";
import { calculatedDamage } from "../midi/damage-packet.mjs";

const confirmed = new Set(), listeners = new Set(), prepared = new Map();
const providers = new Set();
export function onPrepareDamage(provider) { providers.add(provider); }
let reservationChain = Promise.resolve();
export function onConfirmedDamage(handler) { listeners.add(handler); }
export async function emitConfirmedDamage(actor, amount, options) {
  if (!enabled() || !isGmAuthority()) return;
  const event = options?.[MODULE_ID]?.damageEvent;
  if (!event || confirmed.has(event.key)) return;
  confirmed.add(event.key);
  if (confirmed.size > 1000) confirmed.delete(confirmed.values().next().value);
  return runAutomationEvent({id: `confirmed-damage:${event.key}`, kind: "confirmed-damage", name: "Подтверждённое применение урона",
    sourceActorUuid: event.sourceActorUuid, targetTokenUuid: event.targetTokenUuid, sceneId: event.sceneId}, async () => {
  if (event.itemCardUuid) {
    const card = await fromUuid(event.itemCardUuid);
    if (card) {
      const fresh = await serialMutation(`damage-card:${card.uuid}`, async () => {
        const claims = card.getFlag(MODULE_ID, "confirmedDamageKeys") ?? [];
        if (claims.includes(event.key)) return false;
        await card.setFlag(MODULE_ID, "confirmedDamageKeys", [...claims, event.key]); return true;
      });
      if (!fresh) return false;
    }
  }
  for (const uuid of event.benefits ?? []) {
    const effect = await fromUuid(uuid);
    if (effect) {
      const bonus = benefitData(effect), item = await fromUuid(bonus.sourceItemUuid);
      const source = await fromUuid(event.sourceActorUuid);
      if (automationData(item).stratagem && source) await source.setFlag(MODULE_ID, "leaderStratagemReceived", leaderReceiptData(game.scenes?.get?.(event.sceneId), bonus.commandId));
      await consumeBenefit(effect, event.key);
    }
  }
  const packet = prepared.get(event.key);
  if (packet) prepared.delete(event.key);
  const source = await fromUuid(event.sourceActorUuid);
  const turn = turnKey(combatForScene(game.scenes?.get?.(event.sceneId)));
  if (amount > 0) await actor.setFlag(MODULE_ID, "lastReceivedDamage", { amount,
    turn, time: game.time?.worldTime ?? 0 });
  if (source && amount > 0) await source.setFlag(MODULE_ID, "lastConfirmedDamage", { ...event, amount,
    turn, time: game.time?.worldTime ?? 0 });
  let failed = false;
  for (const handler of listeners) {
    try { await handler({ actor, amount, event, options }); }
    catch (error) { failed = true; console.error(`${MODULE_ID} | Confirmed damage handler failed`, error); }
  }
  return failed ? {status: "needs-review"} : true;
  });
}
registerGmRequest("prepare-damage-event", (actor, data, context) => {
  const operation = reservationChain.catch(() => {}).then(async () => {
    if (prepared.has(data.key)) return prepared.get(data.key);
    const activity = await fromUuid(data.activityUuid), attacker = await fromUuid(data.attackerUuid), target = await fromUuid(data.targetUuid);
    if ((activity?.actor ?? activity?.item?.actor)?.uuid !== actor.uuid || attacker?.actor?.uuid !== actor.uuid
      || !target?.actor || target.parent?.id !== attacker.parent?.id) throw Error("Неверный пакет урона.");
    const bonuses = [], effects = [...activeBenefits(actor), ...activeBenefits(target.actor)];
    for (const effect of effects) {
      const bonus = benefitData(effect);
      const origin = await fromUuid(bonus.sourceItemUuid), received = leaderReceipt(actor, attacker.parent);
      if (automationData(origin).stratagem && received && received.commandId !== bonus.commandId) continue;
      if (automationData(origin).stratagem && !canReact(actor)) continue;
      if (!["damage-bonus", "direct-attack"].includes(bonus.kind) || !matchesAttackBenefit(effect,
        { attacker, target, scene: attacker.parent, weapon: !data.automatic && activity.item.type === "weapon", opportunity: data.opportunity })) continue;
      if (bonus.reserved && bonus.reserved !== data.key) continue;
      if (bonus.remaining === 1 && bonus.kind === "damage-bonus" && data.eligibleTargetUuids?.length > 1) {
        if (bonus.choiceWorkflowId !== data.workflowId) {
          const selected = await chooseSceneTokens(actor, attacker.parent, {title: `${effect.name}: одна цель для бонуса`,
            relation: token => data.eligibleTargetUuids.includes(token.uuid)});
          await effect.setFlag(MODULE_ID, "combatBenefit", {...bonus, choiceWorkflowId: data.workflowId, chosenTargetUuid: selected?.[0]?.uuid ?? null});
          bonus.choiceWorkflowId = data.workflowId; bonus.chosenTargetUuid = selected?.[0]?.uuid ?? null;
        }
        if (bonus.chosenTargetUuid !== target.uuid) continue;
      }
      const value = bonus.reserved === data.key && Number.isFinite(bonus.reservedValue) ? bonus.reservedValue : Number.isFinite(Number(bonus.amount)) ? Number(bonus.amount)
        : Number((await new Roll(bonus.formula, actor.getRollData()).evaluate()).total);
      if (!Number.isFinite(value)) continue;
      if (bonus.remaining != null) await effect.setFlag(MODULE_ID, "combatBenefit", { ...bonus, reserved: data.key, reservedValue: value });
      bonuses.push({ effectUuid: effect.uuid, value, name: effect.name });
    }
    const extra = {};
    for (const provider of providers) { const result = await provider({ actor, attacker, target, activity, data });
      if (result) { bonuses.push(...(result.bonuses ?? [])); Object.assign(extra, result.context ?? {}); } }
    const card = data.itemCardUuid && await fromUuid(data.itemCardUuid);
    const cardUuid = card?.documentName === "ChatMessage" && (card.getAssociatedActor?.()?.uuid === actor.uuid || card.speaker?.actor === actor.id) ? card.uuid : null;
    const result = { status: "success", bonuses, context: { key: data.key, sourceActorUuid: actor.uuid, itemCardUuid: cardUuid,
      confirmationNonce: foundry.utils.randomID(),
      sourceTokenUuid: attacker.uuid, targetTokenUuid: target.uuid, activityUuid: activity.uuid, workflowId: data.workflowId, sceneId: attacker.parent.id,
      bloodSpell: data.bloodSpell === true,
      bloodDrain: data.bloodDrain === true && (actor.getFlag(MODULE_ID, "bloodDrainLink")?.targetTokenUuid === target.uuid
        || (data.authorityBloodDrain && game.users?.get?.(context.requesterId)?.isGM && activity.item.system.identifier === "blood-drain")),
      automatic: data.automatic === true,
      damageType: data.damageType,
      benefits: bonuses.map(bonus => bonus.effectUuid).filter(Boolean), ...extra } };
    prepared.set(data.key, result); if (prepared.size > 500) prepared.delete(prepared.keys().next().value);
    if (cardUuid) {
      const pending = card.getFlag(MODULE_ID, "preparedDamageEvents") ?? {};
      await card.setFlag(MODULE_ID, "preparedDamageEvents", {...pending, [data.key]: result.context});
    }
    return result;
  });
  reservationChain = operation; return operation;
});
registerGmRequest("release-damage-reservations", async (actor, data) => {
  for (const effect of activeBenefits(actor)) {
    const bonus = benefitData(effect);
    if (bonus.reserved?.startsWith(`${data.workflowId}:`)) await effect.setFlag(MODULE_ID, "combatBenefit", { ...bonus, reserved: null, reservedValue: null });
  }
  // Shared pools live on a target actor, not on the attacker.
  for (const uuid of data.targets ?? []) {
    const token = await fromUuid(uuid);
    if (!token?.actor) continue;
    for (const effect of activeBenefits(token.actor)) {
      const bonus = benefitData(effect);
      if (bonus.reserved?.startsWith(`${data.workflowId}:`)) await effect.setFlag(MODULE_ID, "combatBenefit", { ...bonus, reserved: null, reservedValue: null });
    }
  }
  const reservation = actor.getFlag(MODULE_ID, "tacticalPresenceReservation");
  if (reservation?.key?.startsWith(`${data.workflowId}:`)) await actor.unsetFlag(MODULE_ID, "tacticalPresenceReservation");
  return {status: "success"};
});
export async function finishDamageReservations(workflow) {
  // A completed workflow may leave a manual damage card awaiting Apply. Keep
  // its claim until confirmed application or explicit Abort, never consume it.
  if (!workflow?.aborted || !workflow.actor) return;
  return requestGm("release-damage-reservations", workflow.actor, {workflowId: workflow.id,
    targets: [...(workflow.targets ?? [])].map(token => tokenRef(token).uuid)});
}
export function damageHealthSignature(actor, nonce) {
  const hp = actor.system?.attributes?.hp ?? {}, input = JSON.stringify([nonce, hp.value, hp.temp ?? 0]);
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}
registerGmRequest("confirm-damage-event", async (actor, data) => {
  const event = data.event, cached = prepared.get(event?.key)?.context;
  const card = event?.itemCardUuid && await fromUuid(event.itemCardUuid);
  const context = cached ?? card?.getFlag(MODULE_ID, "preparedDamageEvents")?.[event?.key];
  const target = context && await fromUuid(context.targetTokenUuid);
  if (!context || context.confirmationNonce !== event.confirmationNonce || target?.actor?.uuid !== actor.uuid
    || data.healthSignature !== damageHealthSignature(actor, context.confirmationNonce) || !Number.isFinite(data.amount)) {
    if (event?.key && event.sceneId) await runAutomationEvent({id: `damage-review:${event.key}`, kind: "confirmed-damage-review", sceneId: event.sceneId,
      sourceActorUuid: event.sourceActorUuid, targetTokenUuid: event.targetTokenUuid, name: "Подтверждение урона: нужна проверка"}, () => ({status: "needs-review"}));
    return {status: "needs-review"};
  }
  // Never broadcast hidden NPC HP. The zero-HP transition needs only a boolean.
  const verified = {...context, beforeHp: data.wasAlive ? 1 : 0};
  return emitConfirmedDamage(actor, data.amount, {[MODULE_ID]: {damageEvent: verified}});
});
export async function confirmDamageApplication(actor, amount, options) {
  const event = options?.[MODULE_ID]?.damageEvent;
  if (!enabled() || !event) return;
  if (isGmAuthority()) return emitConfirmedDamage(actor, amount, options);
  return requestGm("confirm-damage-event", actor, {amount, event: {key: event.key, confirmationNonce: event.confirmationNonce,
    itemCardUuid: event.itemCardUuid, sceneId: event.sceneId, sourceActorUuid: event.sourceActorUuid, targetTokenUuid: event.targetTokenUuid},
    wasAlive: Number(event.beforeHp) > 0, healthSignature: damageHealthSignature(actor, event.confirmationNonce)},
    {requestId: `confirm-damage:${event.key}`});
}
export async function prepareConfirmedDamage(token, { workflow, damageItem }) {
  if (!enabled() || !workflow?.actor || !token?.actor || workflow.aborted) return;
  const selector = damageItem.damageSelector ?? "combinedDamage";
  const key = `${workflow.id}:${tokenRef(token).uuid}:${selector}`;
  if (damageItem.grimgutzDamagePrepared === key) return;
  const parts = calculatedDamage(damageItem);
  if (!parts.some(part => Number(part.value) > 0 && !["healing", "temphp", "maximum", "midi-none"].includes(part.type))) return;
  const result = await requestGm("prepare-damage-event", workflow.actor, { key, workflowId: workflow.id,
    itemCardUuid: workflow.itemCardUuid,
    activityUuid: workflow.activity.uuid, attackerUuid: tokenRef(workflow.token).uuid, targetUuid: tokenRef(token).uuid,
    eligibleTargetUuids: [...(workflow.hitTargets?.size ? workflow.hitTargets : workflow.targets ?? [])].map(token => tokenRef(token).uuid),
    opportunity: workflow.workflowOptions?.isOpportunityAttack === true, bloodSpell: workflow.grimgutzBloodSpell === true,
    bloodDrain: workflow.activity.flags?.[MODULE_ID]?.bloodDrain === true,
    authorityBloodDrain: workflow.workflowOptions?.grimgutzValidatedDrain === true,
    automatic: workflow.workflowOptions?.grimgutzAuraPulse === true,
    damageType: parts.find(part => part.value > 0 && !["healing", "temphp", "maximum", "midi-none"].includes(part.type))?.type }, { requestId: key, timeoutMs: 120000 });
  if (result.status !== "success") return;
  const type = parts.find(part => part.value > 0 && !["healing", "temphp", "maximum", "midi-none"].includes(part.type))?.type;
  const bonus = result.bonuses.reduce((total, bonus) => total + bonus.value, 0);
  if (bonus) await appendCalculatedBonus(token, damageItem, bonus, type);
  const options = damageItem.damageDetails?.calcDamageOptions?.[selector] ?? damageItem.calcDamageOptions ?? {};
  // Persist correlation through Midi's damage card to the confirmed Actor update.
  options[MODULE_ID] = { ...(options[MODULE_ID] ?? {}), damageEvent: result.context };
  damageItem.calcDamageOptions = options; damageItem.damageDetails ??= {}; damageItem.damageDetails.calcDamageOptions ??= {};
  damageItem.damageDetails.calcDamageOptions[selector] = options;
  damageItem.grimgutzDamagePrepared = key;
}
export function installDamageEventHooks() {
  Hooks.on("dnd5e.preApplyDamage", (actor, _amount, _updates, options) => {
    if (options?.[MODULE_ID]?.damageEvent) options[MODULE_ID].damageEvent.beforeHp = Number(actor.system.attributes.hp.value);
  });
  Hooks.on("dnd5e.applyDamage", (actor, amount, options) => { void confirmDamageApplication(actor, amount, options)
    .catch(error => console.error(`${MODULE_ID} | Damage confirmation failed`, error)); });
}
