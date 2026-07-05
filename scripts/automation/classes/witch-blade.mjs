import { MODULE_ID } from "../shared/constants.mjs";
import { automationData, findFeature, isAutomationAuthority, notify } from "../shared/helpers.mjs";
import { clamp } from "../shared/dnd5e.mjs";
import { witchBladeClass, witchBladeLevel } from "../shared/selectors.mjs";

const witchBladeRageSyncs = new Set();

function witchHunterFeature(actor) {
  return findFeature(actor, "witch-hunter");
}

function witchBladeRageMaximum(actor) {
  return [0, 3, 4, 5, 6, 7][clamp(witchBladeLevel(actor), 0, 5)] ?? 0;
}

export function witchBladeRagePoints(actor) {
  const feature = witchHunterFeature(actor);
  const maximum = witchBladeRageMaximum(actor);
  const spent = Number(feature?.system?.uses?.spent ?? 0);
  return {
    feature,
    maximum,
    spent: Number.isFinite(spent) ? spent : 0,
    remaining: Math.max(0, maximum - (Number.isFinite(spent) ? spent : 0))
  };
}

export async function syncWitchBladeRage(actor, { notifyResult = false } = {}) {
  if (!actor?.isOwner || !isAutomationAuthority(actor) || witchBladeRageSyncs.has(actor.uuid)) return;
  witchBladeRageSyncs.add(actor.uuid);
  try {
    const rage = witchBladeRagePoints(actor);
    if (!rage.feature || !witchBladeClass(actor)) return;
    const update = {};
    const maximum = String(rage.maximum);
    if (String(rage.feature.system?.uses?.max ?? "") !== maximum) {
      update["system.uses.max"] = maximum;
    }
    if (rage.spent > rage.maximum) {
      update["system.uses.spent"] = rage.maximum;
    }
    if (Object.keys(update).length) await rage.feature.update(update);
    if (notifyResult) notify(`${actor.name}: Очки Гнева Ведьминого клинка синхронизированы (${rage.maximum}).`);
  } finally {
    witchBladeRageSyncs.delete(actor.uuid);
  }
}

export async function useWitchBladeRage(actor, activity) {
  if (!actor || !witchBladeClass(actor)) {
    notify("Эта активность требует класс «Ведьмин клинок».", "warn");
    return false;
  }
  const data = automationData(activity);
  const cost = Math.max(1, Number(data.witchBladeRageCost ?? 1));
  const rage = witchBladeRagePoints(actor);
  if (!rage.feature) {
    notify("Для траты Очков Гнева требуется особенность «Охотник на ведьм».", "warn");
    return false;
  }
  if (rage.remaining < cost) {
    notify(`Недостаточно Очков Гнева: требуется ${cost}, доступно ${rage.remaining}.`, "warn");
    return false;
  }
  await rage.feature.update({
    "system.uses.max": String(rage.maximum),
    "system.uses.spent": rage.spent + cost
  });
  notify(`${actor.name}: потрачено ${cost} Очк. Гнева, осталось ${rage.remaining - cost}.`);
  return true;
}

export function validateWitchBladeRageUse(actor, activity) {
  const rage = witchBladeRagePoints(actor);
  const required = Math.max(1, Number(automationData(activity).witchBladeRageCost ?? 1));
  if (actor && witchBladeClass(actor) && rage.feature && rage.remaining >= required) return true;
  notify(`Недостаточно Очков Гнева: требуется ${required}, доступно ${rage.remaining}.`, "warn");
  return false;
}
