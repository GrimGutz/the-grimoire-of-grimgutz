import { MODULE_ID, SETTINGS } from "../shared/constants.mjs";
import { automationData, findFeature, isAutomationAuthority, itemIdentifier, notify } from "../shared/helpers.mjs";
import { abilityMod } from "../shared/dnd5e.mjs";

const guardianSyncs = new Set();

export function guardianClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "guardian");
}

export function guardianLevel(actor) {
  return Number(guardianClass(actor)?.system?.levels ?? 0);
}

function hasExtraAttack(actor) {
  return (
    actor?.items?.some(item => {
      const identifier = itemIdentifier(item).replaceAll("_", "-");
      const name = String(item.name ?? "").toLocaleLowerCase("ru");
      return (
        identifier === "extra-attack" ||
        identifier.endsWith("-extra-attack") ||
        name.includes("extra attack") ||
        name.includes("дополнительная атака")
      );
    }) ?? false
  );
}

function hasShieldProficiency(actor) {
  const value = actor?.system?.traits?.armorProf?.value;
  if (typeof value?.has === "function") return value.has("shl");
  if (Array.isArray(value)) return value.includes("shl");
  return false;
}

export function guardianPrerequisiteFailures(actor) {
  const failures = [];
  if (Number(actor?.system?.abilities?.con?.value ?? 0) < 15) failures.push("Телосложение 15");
  if (Number(actor?.system?.details?.level ?? 0) < 6) failures.push("6-й уровень персонажа");
  if (!hasExtraAttack(actor) && !hasShieldProficiency(actor)) {
    failures.push("Дополнительная атака или владение щитами");
  }
  return failures;
}

export function validateGuardianPrerequisites(item, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  if (!actor || item.type !== "class" || itemIdentifier(item) !== "guardian") return true;
  const failures = guardianPrerequisiteFailures(actor);
  if (failures.length) {
    notify(`Нельзя добавить класс «Страж». Не выполнено: ${failures.join(", ")}.`, "error");
    return false;
  }
  return true;
}

export function validateGuardianFeaturePrerequisites(item, options, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  const data = automationData(item);
  if (!actor || data.guardianFeature !== true || options?.isAdvancement) return true;
  const level = guardianLevel(actor);
  if (!level) {
    notify(`Особенность «${item.name}» требует класс «Страж».`, "error");
    return false;
  }
  const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
  if (requiredLevel && level < requiredLevel) {
    notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Стража.`, "error");
    return false;
  }
  return true;
}

function guardianMarkAttacks(level) {
  if (level >= 5) return 4;
  if (level >= 3) return 3;
  if (level >= 1) return 2;
  return 0;
}

function powerfulRetributionUses(level) {
  if (level >= 5) return 3;
  if (level >= 3) return 2;
  return 0;
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

export async function syncGuardianResources(actor, { notifyResult = false } = {}) {
  if (!actor?.isOwner || !isAutomationAuthority(actor) || guardianSyncs.has(actor.uuid)) return false;
  const level = guardianLevel(actor);
  if (!level) return false;

  guardianSyncs.add(actor.uuid);
  try {
    const updates = [
      await syncUses(findFeature(actor, "guardian-mark"), guardianMarkAttacks(level)),
      await syncUses(findFeature(actor, "endure-pain"), Math.max(1, abilityMod(actor, "con"))),
      await syncUses(findFeature(actor, "powerful-retribution"), powerfulRetributionUses(level))
    ];
    const changed = updates.some(Boolean);
    if (notifyResult && changed) notify(`${actor.name}: ресурсы Стража синхронизированы.`);
    return changed;
  } finally {
    guardianSyncs.delete(actor.uuid);
  }
}
