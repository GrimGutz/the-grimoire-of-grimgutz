import { MODULE_ID } from "./constants.mjs";
import { isEffectActive, automationActors, temporaryEffectTiming } from "../effects/temporary-effects.mjs";
import { enabled, findFeature } from "./helpers.mjs";
import { isGmAuthority, registerGmRequest, requestGm } from "./gm-requests.mjs";
import { isForwardTurn } from "./combat-flow.mjs";
import { tokenSceneDistance, feetToSceneUnits } from "./spatial.mjs";
import { calculatedDamage, commitCalculatedDamage } from "../midi/damage-packet.mjs";

export const benefitData = effect => effect?.getFlag?.(MODULE_ID, "combatBenefit") ?? effect?.flags?.[MODULE_ID]?.combatBenefit;
export const activeBenefits = actor => [...(actor?.effects ?? [])].filter(effect => isEffectActive(effect) && benefitData(effect));
const attackProviders = new Set();
export function onPrepareAttack(provider) { attackProviders.add(provider); }
export const tokenRef = token => token?.document ?? token;
export const turnKey = combat => combat?.started ? `${combat.id}:${combat.round}:${combat.turn}` : null;
export function sceneToken(scene, uuid) { return [...(scene?.tokens ?? [])].find(token => token.uuid === uuid); }
export function inFeet(a, b, feet, scene) { return tokenSceneDistance(a?.object ?? a, b?.object ?? b, scene) <= feetToSceneUnits(feet, scene); }
export function meleeReach(actor) {
  return Math.max(5, ...[...(actor.items ?? [])].filter(item => item.type === "weapon").map(item => Number(item.system?.range?.reach ?? item.system?.range?.value ?? 5)));
}
export function canReact(actor) {
  return !["incapacitated", "unconscious", "stunned", "paralyzed", "petrified"].some(status => actor.statuses?.has?.(status))
    && !globalThis.MidiQOL?.hasUsedReaction?.(actor);
}
export async function addCombatBenefit(source, target, item, { kind, name = item.name, remaining = null, expiry = "sourceStart", changes = [], ...data }) {
  if (!isGmAuthority()) throw Error("Боевые бонусы создаёт активный GM.");
  const sourceDoc = tokenRef(source), targetDoc = tokenRef(target), actor = targetDoc.actor;
  const combat = game.combats?.find?.(combat => combat.started && combat.scene?.id === sourceDoc.parent?.id) ?? game.combat;
  const state = { kind, sourceTokenUuid: sourceDoc.uuid, sourceActorUuid: sourceDoc.actor.uuid, sourceItemUuid: item.uuid,
    targetTokenUuid: targetDoc.uuid, remaining, expiry, combatId: combat?.started ? combat.id : null,
    createdTurn: turnKey(combat), skipCurrentEnd: expiry === "targetEnd" && combat?.combatant?.tokenId === targetDoc.id,
    claims: [], ...data };
  const timing = combat?.started ? { start: null, duration: { value: null, units: "seconds", expiry: null, expired: false } }
    : temporaryEffectTiming({ seconds: 6 });
  const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [{ name, img: item.img, type: "base", origin: item.uuid,
    transfer: false, disabled: false, showIcon: 1, statuses: [], ...timing,
    flags: { [MODULE_ID]: { combatBenefit: state } }, system: { changes } }]);
  return effect;
}
export async function consumeBenefit(effect, key) {
  const data = benefitData(effect);
  if (!isEffectActive(effect) || !data || data.claims?.includes(key)) return false;
  const next = { ...data, claims: [...(data.claims ?? []), key].slice(-100) };
  if (next.remaining != null) next.remaining = Math.max(0, Number(next.remaining) - 1);
  if (next.remaining === 0) await effect.delete();
  else await effect.setFlag(MODULE_ID, "combatBenefit", next);
  return true;
}
export function matchesAttackBenefit(effect, { attacker, target, weapon = false, opportunity = false, scene, workflowId = null }) {
  const data = benefitData(effect);
  if (!isEffectActive(effect) || !data || data.remaining === 0) return false;
  if (data.workflowId && workflowId !== data.workflowId) return false;
  const recipient = data.targetTokenUuid;
  if (recipient) {
    const defending = ["dodge", "direct-attack", "opportunity-ac", "caution"].includes(data.kind);
    if (recipient !== tokenRef(defending ? target : attacker)?.uuid) return false;
  }
  if (data.weaponOnly && !weapon) return false;
  if (data.opportunityOnly && !opportunity) return false;
  if (data.against && !data.against.includes(tokenRef(data.kind === "caution" ? attacker : target)?.uuid)) return false;
  if (data.attackers && !data.attackers.includes(tokenRef(attacker)?.uuid)) return false;
  if (data.protectedBy) {
    const protector = sceneToken(scene, data.protectedBy);
    if (!protector || protector.actor.statuses?.has?.("incapacitated") || tokenRef(target).uuid === protector.uuid
      || !inFeet(attacker, protector, meleeReach(protector.actor), scene)) return false;
  }
  if (data.rangeSource != null) {
    const source = sceneToken(scene, data.sourceTokenUuid);
    if (!source || !inFeet(source, target, data.rangeSource, scene)) return false;
  }
  return true;
}
export async function cleanupCombatBenefits(combat, changes) {
  if (!enabled() || !isGmAuthority() || !isForwardTurn(combat, changes)) return;
  const previous = combat.combatants?.get?.(combat.previous?.combatantId) ?? combat.turns?.[combat.previous?.turn];
  for (const actor of automationActors()) for (const effect of activeBenefits(actor)) {
    const data = benefitData(effect);
    if (data.combatId !== combat.id || data.createdTurn === turnKey(combat)) continue;
    const source = sceneToken(combat.scene, data.sourceTokenUuid), target = sceneToken(combat.scene, data.targetTokenUuid);
    if (!source || !target) { await effect.delete(); continue; }
    const matches = (data.expiry === "sourceStart" && combat.combatant?.tokenId === source.id)
      || (data.expiry === "targetStart" && combat.combatant?.tokenId === target.id)
      || (data.expiry === "targetEnd" && previous?.tokenId === target.id);
    if (!matches) continue;
    if (data.skipCurrentEnd) await effect.setFlag(MODULE_ID, "combatBenefit", { ...data, skipCurrentEnd: false });
    else await effect.delete();
  }
}

registerGmRequest("combat-attack-benefits", async (actor, data) => {
  const activity = await fromUuid(data.activityUuid), attacker = await fromUuid(data.attackerUuid), target = await fromUuid(data.targetUuid);
  if ((activity?.actor ?? activity?.item?.actor)?.uuid !== actor.uuid || attacker?.actor?.uuid !== actor.uuid
    || target?.parent?.id !== attacker.parent?.id || activity.type !== "attack") throw Error("Неверный контекст атаки.");
  const effects = [...activeBenefits(actor), ...activeBenefits(target.actor)], results = [];
  for (const effect of effects) if (matchesAttackBenefit(effect, { attacker, target, scene: attacker.parent,
    weapon: activity.item.type === "weapon", opportunity: data.opportunity === true, workflowId: data.workflowId })) {
    const bonus = benefitData(effect);
    if (["attack-advantage", "attack-disadvantage", "mark", "attack-bonus", "dodge", "caution"].includes(bonus.kind))
      results.push({ effectUuid: effect.uuid, kind: bonus.kind, amount: bonus.amount ?? 0, name: effect.name });
  }
  for (const provider of attackProviders) results.push(...await provider({ actor, attacker, target, activity, data }));
  attackReservations.set(`${actor.uuid}:${data.workflowId}`, results.map(result => result.effectUuid));
  return { status: "success", results };
});

export async function prepareCombatAttackBenefits(workflow, config) {
  if (!enabled() || workflow?.targets?.size !== 1 || workflow.grimgutzBenefitsPrepared) return;
  const target = [...workflow.targets][0];
  const result = await requestGm("combat-attack-benefits", workflow.actor, { activityUuid: workflow.activity.uuid,
    attackerUuid: tokenRef(workflow.token).uuid, targetUuid: tokenRef(target).uuid,
    workflowId: workflow.id, opportunity: workflow.workflowOptions?.isOpportunityAttack === true }, { requestId: `attack-benefits:${workflow.id}`, timeoutMs: 120000 });
  if (result.status !== "success") return;
  workflow.grimgutzBenefitsPrepared = true; workflow.grimgutzAttackBenefits = result.results;
  for (const bonus of result.results) {
    if (["attack-advantage"].includes(bonus.kind)) workflow.attackRollModifierTracker?.advantage?.add?.(bonus.effectUuid, bonus.name);
    if (["attack-disadvantage", "mark", "dodge", "caution"].includes(bonus.kind)) workflow.attackRollModifierTracker?.disadvantage?.add?.(bonus.effectUuid, bonus.name);
    if (bonus.kind === "attack-bonus") for (const roll of config?.rolls ?? []) { roll.parts ??= []; roll.parts.push(String(bonus.amount)); }
  }
}
const attackReservations = new Map();
registerGmRequest("commit-attack-benefits", async (actor, data) => {
  const activity = await fromUuid(data.activityUuid);
  if ((activity?.actor ?? activity?.item?.actor)?.uuid !== actor.uuid) throw Error("Неверная атака.");
  const reserved = attackReservations.get(`${actor.uuid}:${data.workflowId}`) ?? [];
  for (const uuid of reserved) {
    const effect = await fromUuid(uuid), bonus = benefitData(effect);
    if (bonus && ["attack-advantage", "attack-disadvantage", "attack-bonus", "caution"].includes(bonus.kind)) {
      if (bonus.presenceKind === "insightful") {
        const source = await fromUuid(bonus.sourceActorUuid);
        const claims = source.getFlag(MODULE_ID, "insightfulPresenceClaims") ?? {};
        claims[bonus.protectedTarget] = data.workflowId; await source.setFlag(MODULE_ID, "insightfulPresenceClaims", claims);
      }
      await consumeBenefit(effect, data.key);
    }
  }
  return { status: "success" };
});
export async function commitCombatAttackBenefits(workflow) {
  if (!enabled() || workflow?.aborted || !workflow?.attackRoll || !workflow.grimgutzAttackBenefits?.length) return;
  return requestGm("commit-attack-benefits", workflow.actor, { activityUuid: workflow.activity.uuid,
    workflowId: workflow.id, key: `${workflow.id}:attack` });
}

export async function appendCalculatedBonus(token, damageItem, value, type) {
  const selector = damageItem.damageSelector ?? "combinedDamage";
  const options = damageItem.damageDetails?.calcDamageOptions?.[selector] ?? damageItem.calcDamageOptions ?? { invertHealing: true };
  const raw = structuredClone(damageItem.damageDetails?.[`raw${selector}`] ?? damageItem.rawDamageDetail ?? []);
  if (!raw.length) throw Error("Нет исходного пакета урона для безопасного бонуса.");
  raw.push({ value, type, properties: new Set() });
  const calculated = token.actor.calculateDamage(raw, options);
  damageItem.rawDamageDetail = raw; damageItem.damageDetails ??= {}; damageItem.damageDetails[`raw${selector}`] = raw;
  commitCalculatedDamage(token, damageItem, calculated);
}
export function installCombatBenefitHooks() {
  Hooks.on("updateCombat", (combat, changes) => { void cleanupCombatBenefits(combat, changes).catch(error => console.error(`${MODULE_ID} | Benefit expiry failed`, error)); });
  Hooks.on("deleteCombat", combat => { if (isGmAuthority()) for (const actor of automationActors()) for (const effect of activeBenefits(actor))
    if (benefitData(effect).combatId === combat.id) void effect.delete(); });
}
