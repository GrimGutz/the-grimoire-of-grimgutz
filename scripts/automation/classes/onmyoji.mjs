import { MODULE_ID, SETTINGS } from "../shared/constants.mjs";
import {
  automationData,
  findFeature,
  isAutomationAuthority,
  itemIdentifier,
  itemUses,
  notify,
} from "../shared/helpers.mjs";
import { abilityMod } from "../shared/dnd5e.mjs";

const onmyojiSyncs = new Set();

export function onmyojiClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "onmyoji");
}

export function onmyojiLevel(actor) {
  return Number(onmyojiClass(actor)?.system?.levels ?? 0);
}

function hasReligionProficiency(actor) {
  const religion = actor?.system?.skills?.rel;
  const value = Number(religion?.value ?? religion?.proficient ?? 0);
  return value > 0 || religion?.proficient === true;
}

export function onmyojiPrerequisiteFailures(actor) {
  const failures = [];
  if (Number(actor?.system?.abilities?.wis?.value ?? 0) < 15) failures.push("Мудрость 15");
  if (Number(actor?.system?.abilities?.cha?.value ?? 0) < 13) failures.push("Харизма 13");
  if (!hasReligionProficiency(actor)) failures.push("владение навыком Религия");
  if (Number(actor?.system?.details?.level ?? 0) < 5) failures.push("5-й уровень персонажа");
  return failures;
}

export function validateOnmyojiPrerequisites(item, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  if (!actor || item.type !== "class" || itemIdentifier(item) !== "onmyoji") return true;
  const failures = onmyojiPrerequisiteFailures(actor);
  if (failures.length) {
    notify(`Нельзя добавить класс «Онмёджи». Не выполнено: ${failures.join(", ")}. Разговор с Мировым Духом и уничтожение разумной нежити подтверждает Мастер.`, "error");
    return false;
  }
  return true;
}

export function validateOnmyojiFeaturePrerequisites(item, options, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  const data = automationData(item);
  if (!actor || data.onmyojiFeature !== true || options?.isAdvancement) return true;
  const level = onmyojiLevel(actor);
  if (!level) {
    notify(`Особенность «${item.name}» требует класс «Онмёджи».`, "error");
    return false;
  }
  const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
  if (requiredLevel && level < requiredLevel) {
    notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Онмёджи.`, "error");
    return false;
  }
  return true;
}

function currentMax(item) {
  return String(item?.system?.uses?.max ?? "");
}

async function syncUses(feature, maximum) {
  if (!feature) return false;
  const max = String(Math.max(0, maximum));
  const spent = Number(feature.system?.uses?.spent ?? 0);
  const update = {};
  if (currentMax(feature) !== max) update["system.uses.max"] = max;
  if (Number.isFinite(spent) && spent > Number(max)) update["system.uses.spent"] = Number(max);
  if (!Object.keys(update).length) return false;
  await feature.update(update);
  return true;
}

export async function syncOnmyojiResources(actor, { notifyResult = false } = {}) {
  if (!actor?.isOwner || !isAutomationAuthority(actor) || onmyojiSyncs.has(actor.uuid)) return false;
  const level = onmyojiLevel(actor);
  if (!level) return false;

  onmyojiSyncs.add(actor.uuid);
  try {
    const updates = [
      await syncUses(findFeature(actor, "onmyoji-ki"), level),
      await syncUses(findFeature(actor, "purification-rite"), Math.max(1, abilityMod(actor, "wis"))),
    ];
    const changed = updates.some(Boolean);
    if (notifyResult && changed) notify(`${actor.name}: ресурсы Онмёджи синхронизированы.`);
    return changed;
  } finally {
    onmyojiSyncs.delete(actor.uuid);
  }
}

function onmyojiKi(actor) {
  const feature = findFeature(actor, "onmyoji-ki");
  const uses = itemUses(feature);
  return {
    feature,
    ...uses,
  };
}

export function validateOnmyojiKiUse(actor, activity) {
  const level = onmyojiLevel(actor);
  const data = automationData(activity);
  const cost = Math.max(1, Number(data.onmyojiKiCost ?? 1));
  if (!actor || !level) {
    notify("Эта активность требует класс «Онмёджи».", "warn");
    return false;
  }
  if (cost >= 3 && level < 3) {
    notify(`${actor.name}: Великие Чары доступны только с 3-го уровня Онмёджи.`, "warn");
    return false;
  }
  const ki = onmyojiKi(actor);
  if (!ki.feature) {
    notify("Для использования чар требуется особенность «Ки».", "warn");
    return false;
  }
  if (ki.remaining < cost) {
    notify(`${actor.name}: недостаточно Ки, требуется ${cost}, доступно ${ki.remaining}.`, "warn");
    return false;
  }
  return true;
}

export async function useOnmyojiKi(actor, activity) {
  if (!validateOnmyojiKiUse(actor, activity)) return false;
  const data = automationData(activity);
  const cost = Math.max(1, Number(data.onmyojiKiCost ?? 1));
  const ki = onmyojiKi(actor);
  await ki.feature.update({
    "system.uses.max": String(ki.maximum),
    "system.uses.spent": ki.spent + cost,
  });

  const formula = String(data.onmyojiRollFormula ?? "");
  if (formula) {
    const roll = await new Roll(formula, actor.getRollData()).evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `${activity.name}: ${data.onmyojiRollName ?? "Бросок"}`,
    });
  }
  notify(`${actor.name}: потрачено ${cost} Ки, осталось ${Math.max(0, ki.remaining - cost)}.`);
  return true;
}
