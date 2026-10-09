import { MODULE_ID } from "./constants.mjs";
import { enabled, automationData } from "./helpers.mjs";
import { isGmAuthority, registerGmRequest, requestGm } from "./gm-requests.mjs";
import { activeBenefits, benefitData, matchesAttackBenefit, consumeBenefit, tokenRef, appendCalculatedBonus, canReact } from "./combat-benefits.mjs";
import { calculatedDamage } from "../midi/damage-packet.mjs";

const confirmed = new Set(), listeners = new Set(), prepared = new Map();
let reservationChain = Promise.resolve();
export function onConfirmedDamage(handler) { listeners.add(handler); }
export async function emitConfirmedDamage(actor, amount, options) {
  if (!enabled() || !isGmAuthority()) return;
  const event = options?.[MODULE_ID]?.damageEvent;
  if (!event || confirmed.has(event.key)) return;
  confirmed.add(event.key);
  if (confirmed.size > 1000) confirmed.delete(confirmed.values().next().value);
  for (const uuid of event.benefits ?? []) {
    const effect = await fromUuid(uuid);
    if (effect) {
      const bonus = benefitData(effect), item = await fromUuid(bonus.sourceItemUuid);
      const source = await fromUuid(event.sourceActorUuid);
      if (automationData(item).stratagem && source) await source.setFlag(MODULE_ID, "leaderStratagemReceived", { commandId: bonus.commandId });
      await consumeBenefit(effect, event.key);
    }
  }
  const packet = prepared.get(event.key);
  if (packet) prepared.delete(event.key);
  const source = await fromUuid(event.sourceActorUuid);
  if (amount > 0) await actor.setFlag(MODULE_ID, "lastReceivedDamage", { amount,
    turn: game.combat?.started ? `${game.combat.id}:${game.combat.round}:${game.combat.turn}` : null, time: game.time?.worldTime ?? 0 });
  if (source && amount > 0) await source.setFlag(MODULE_ID, "lastConfirmedDamage", { ...event, amount,
    turn: game.combat?.started ? `${game.combat.id}:${game.combat.round}:${game.combat.turn}` : null, time: game.time?.worldTime ?? 0 });
  for (const handler of listeners) {
    try { await handler({ actor, amount, event, options }); }
    catch (error) { console.error(`${MODULE_ID} | Confirmed damage handler failed`, error); }
  }
}
registerGmRequest("prepare-damage-event", (actor, data) => {
  const operation = reservationChain.catch(() => {}).then(async () => {
    if (prepared.has(data.key)) return prepared.get(data.key);
    const activity = await fromUuid(data.activityUuid), attacker = await fromUuid(data.attackerUuid), target = await fromUuid(data.targetUuid);
    if ((activity?.actor ?? activity?.item?.actor)?.uuid !== actor.uuid || attacker?.actor?.uuid !== actor.uuid
      || !target?.actor || target.parent?.id !== attacker.parent?.id) throw Error("Неверный пакет урона.");
    const bonuses = [], effects = [...activeBenefits(actor), ...activeBenefits(target.actor)];
    for (const effect of effects) {
      const bonus = benefitData(effect);
      const origin = await fromUuid(bonus.sourceItemUuid), received = actor.getFlag?.(MODULE_ID, "leaderStratagemReceived");
      if (automationData(origin).stratagem && received && received.commandId !== bonus.commandId) continue;
      if (automationData(origin).stratagem && !canReact(actor)) continue;
      if (!["damage-bonus", "direct-attack"].includes(bonus.kind) || !matchesAttackBenefit(effect,
        { attacker, target, scene: attacker.parent, weapon: !data.automatic && activity.item.type === "weapon", opportunity: data.opportunity })) continue;
      if (bonus.reserved && bonus.reserved !== data.key) continue;
      const value = bonus.reserved === data.key && Number.isFinite(bonus.reservedValue) ? bonus.reservedValue : Number.isFinite(Number(bonus.amount)) ? Number(bonus.amount)
        : Number((await new Roll(bonus.formula, actor.getRollData()).evaluate()).total);
      if (!Number.isFinite(value)) continue;
      if (bonus.remaining != null) await effect.setFlag(MODULE_ID, "combatBenefit", { ...bonus, reserved: data.key, reservedValue: value });
      bonuses.push({ effectUuid: effect.uuid, value, name: effect.name });
    }
    const result = { status: "success", bonuses, context: { key: data.key, sourceActorUuid: actor.uuid,
      sourceTokenUuid: attacker.uuid, targetTokenUuid: target.uuid, activityUuid: activity.uuid, workflowId: data.workflowId,
      bloodSpell: data.bloodSpell === true, bloodDrain: data.bloodDrain === true, automatic: data.automatic === true,
      damageType: data.damageType,
      benefits: bonuses.map(bonus => bonus.effectUuid) } };
    prepared.set(data.key, result); if (prepared.size > 500) prepared.delete(prepared.keys().next().value);
    return result;
  });
  reservationChain = operation; return operation;
});
export async function prepareConfirmedDamage(token, { workflow, damageItem }) {
  if (!enabled() || !workflow?.actor || !token?.actor || workflow.aborted) return;
  const selector = damageItem.damageSelector ?? "combinedDamage";
  const key = `${workflow.id}:${tokenRef(token).uuid}:${selector}`;
  if (damageItem.grimgutzDamagePrepared === key) return;
  const parts = calculatedDamage(damageItem);
  if (!parts.some(part => Number(part.value) > 0 && !["healing", "temphp", "maximum", "midi-none"].includes(part.type))) return;
  const result = await requestGm("prepare-damage-event", workflow.actor, { key, workflowId: workflow.id,
    activityUuid: workflow.activity.uuid, attackerUuid: tokenRef(workflow.token).uuid, targetUuid: tokenRef(token).uuid,
    opportunity: workflow.workflowOptions?.isOpportunityAttack === true, bloodSpell: workflow.grimgutzBloodSpell === true,
    bloodDrain: workflow.activity.flags?.[MODULE_ID]?.bloodDrain === true,
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
  Hooks.on("dnd5e.applyDamage", (actor, amount, options) => { void emitConfirmedDamage(actor, amount, options)
    .catch(error => console.error(`${MODULE_ID} | Damage confirmation failed`, error)); });
}
