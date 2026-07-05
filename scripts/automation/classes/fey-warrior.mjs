import { FLAGS, MODULE_ID, SETTINGS } from "../shared/constants.mjs";
import {
  automationData,
  enabled,
  findFeature,
  hasFeature,
  isAutomationAuthority,
  itemIdentifier,
  notify
} from "../shared/helpers.mjs";
import { abilityMod } from "../shared/dnd5e.mjs";
import {
  flaggedPassiveEffectData,
  syncFlaggedPassiveEffects
} from "../effects/passive-helpers.mjs";

const feyWarriorSyncs = new Set();
const feyWarriorPassiveSyncs = new Set();

export function feyWarriorClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "fey-warrior");
}

export function feyWarriorLevel(actor) {
  return Number(feyWarriorClass(actor)?.system?.levels ?? 0);
}

export function feyWarriorPrerequisiteFailures(actor) {
  const failures = [];
  if (Number(actor?.system?.abilities?.dex?.value ?? 0) < 13) failures.push("Ловкость 13");
  if (Number(actor?.system?.abilities?.cha?.value ?? 0) < 13) failures.push("Харизма 13");
  if (Number(actor?.system?.details?.level ?? 0) < 5) failures.push("5-й уровень персонажа");
  return failures;
}

export function validateFeyWarriorPrerequisites(item, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  if (!actor || item.type !== "class" || itemIdentifier(item) !== "fey-warrior") return true;
  const failures = feyWarriorPrerequisiteFailures(actor);
  if (failures.length) {
    notify(`Нельзя добавить класс «Воитель фей». Не выполнено: ${failures.join(", ")}. Пребывание в Стране Фей подтверждает Мастер.`, "error");
    return false;
  }
  return true;
}

export function validateFeyWarriorFeaturePrerequisites(item, options, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  const data = automationData(item);
  if (!actor || data.feyWarriorFeature !== true || options?.isAdvancement) return true;
  const level = feyWarriorLevel(actor);
  if (!level) {
    notify(`Особенность «${item.name}» требует класс «Воитель фей».`, "error");
    return false;
  }
  const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
  if (requiredLevel && level < requiredLevel) {
    notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Воителя фей.`, "error");
    return false;
  }
  return true;
}

function equippedArmor(actor) {
  return actor?.items?.some(item => {
    if (item.type !== "equipment" || item.system?.equipped !== true) return false;
    const type = String(
      item.system?.type?.value
      ?? item.system?.armor?.type
      ?? item.system?.type
      ?? ""
    ).toLowerCase();
    return ["light", "medium", "heavy", "lgt", "med", "hvy"].includes(type);
  }) ?? false;
}

function feyWarriorPassiveDefinitions(actor) {
  if (!feyWarriorClass(actor)) return [];
  const definitions = [];

  const charmingDefense = findFeature(actor, "charming-defense");
  const charismaBonus = Math.max(0, abilityMod(actor, "cha"));
  if (charmingDefense && charismaBonus > 0 && !equippedArmor(actor)) {
    definitions.push(flaggedPassiveEffectData(MODULE_ID, FLAGS.FEY_WARRIOR_PASSIVE, {
      key: "charming-defense",
      feature: charmingDefense,
      changes: [{
        key: "system.attributes.ac.bonus",
        type: "add",
        value: String(charismaBonus),
        phase: "final",
        priority: 20
      }]
    }));
  }

  return definitions;
}

export async function syncFeyWarriorPassiveEffects(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  return syncFlaggedPassiveEffects(actor, feyWarriorPassiveSyncs, MODULE_ID, FLAGS.FEY_WARRIOR_PASSIVE, feyWarriorPassiveDefinitions);
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

export async function syncFeyWarriorResources(actor, { notifyResult = false } = {}) {
  if (!actor?.isOwner || !isAutomationAuthority(actor) || feyWarriorSyncs.has(actor.uuid)) return false;
  if (!feyWarriorClass(actor)) return false;

  feyWarriorSyncs.add(actor.uuid);
  try {
    const changed = await syncUses(findFeature(actor, "permanent-manifestation"), Math.max(1, abilityMod(actor, "cha")));
    if (notifyResult && changed) notify(`${actor.name}: ресурсы Воителя фей синхронизированы.`);
    return changed;
  } finally {
    feyWarriorSyncs.delete(actor.uuid);
  }
}

function activityItem(activity) {
  return activity?.item ?? activity?.parent;
}

function activityActor(activity) {
  return activity?.actor ?? activityItem(activity)?.actor;
}

function appendRollPart(roll, part) {
  if (!roll || !part) return;
  roll.parts ??= [];
  roll.parts.push(String(part));
}

export function applyFeyWarriorDamageAutomation(config) {
  if (!enabled()) return;
  const activity = config?.subject;
  const item = activityItem(activity);
  const actor = activityActor(activity);
  if (!actor || !item || item.type !== "weapon" || !hasFeature(actor, "chimeric-weapon")) return;
  const bonus = abilityMod(actor, "cha");
  if (bonus <= 0) return;
  appendRollPart(config.rolls?.[0], `${bonus}[psychic]`);
}
