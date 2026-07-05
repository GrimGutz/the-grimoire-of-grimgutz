import { FLAGS, MODULE_ID, SETTINGS } from "../shared/constants.mjs";
import {
  activityActor,
  activityItem,
  automationData,
  enabled,
  findFeature,
  isAutomationAuthority,
  itemIdentifier,
  itemUses,
  notify
} from "../shared/helpers.mjs";
import { abilityMod } from "../shared/dnd5e.mjs";

const darkWarriorSyncs = new Set();

export function darkWarriorClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "dark-warrior");
}

export function darkWarriorLevel(actor) {
  return Number(darkWarriorClass(actor)?.system?.levels ?? 0);
}

function hasArcanaProficiency(actor) {
  const arcana = actor?.system?.skills?.arc;
  return Number(arcana?.value ?? arcana?.proficient ?? 0) > 0;
}

export function darkWarriorPrerequisiteFailures(actor) {
  const failures = [];
  if (Number(actor?.system?.abilities?.str?.value ?? 0) < 15) failures.push("Сила 15");
  if (!hasArcanaProficiency(actor)) failures.push("владение навыком Магия");
  return failures;
}

export function validateDarkWarriorPrerequisites(item, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  if (!actor || item.type !== "class" || itemIdentifier(item) !== "dark-warrior") return true;
  const failures = darkWarriorPrerequisiteFailures(actor);
  if (failures.length) {
    notify(`Нельзя добавить класс «Воин тьмы». Не выполнено: ${failures.join(", ")}. Недельный ритуал, исследования и ритуальные отметины подтверждает Мастер.`, "error");
    return false;
  }
  return true;
}

export function validateDarkWarriorFeaturePrerequisites(item, options, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  const data = automationData(item);
  if (!actor || data.darkWarriorFeature !== true || options?.isAdvancement) return true;
  const level = darkWarriorLevel(actor);
  if (!level) {
    notify(`Особенность «${item.name}» требует класс «Воин тьмы».`, "error");
    return false;
  }
  const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
  if (requiredLevel && level < requiredLevel) {
    notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Воина тьмы.`, "error");
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

export async function syncDarkWarriorResources(actor, { notifyResult = false } = {}) {
  if (!actor?.isOwner || !isAutomationAuthority(actor) || darkWarriorSyncs.has(actor.uuid)) return false;
  if (!darkWarriorClass(actor)) return false;

  darkWarriorSyncs.add(actor.uuid);
  try {
    const level = darkWarriorLevel(actor);
    const updates = [
      await syncUses(findFeature(actor, "black-magic-oil"), 1),
      await syncUses(findFeature(actor, "black-magic-elixir"), level >= 4 ? 2 : 1)
    ];
    const changed = updates.some(Boolean);
    if (notifyResult && changed) notify(`${actor.name}: ресурсы Воина тьмы синхронизированы.`);
    return changed;
  } finally {
    darkWarriorSyncs.delete(actor.uuid);
  }
}

function activityFeature(activity) {
  return activityItem(activity);
}

export function validateDarkWarriorActivityUse(actor, activity, action) {
  if (!actor || !darkWarriorClass(actor)) {
    notify("Эта активность требует класс «Воин тьмы».", "warn");
    return false;
  }
  const feature = activityFeature(activity);
  if (["apply-black-magic-oil", "drink-dark-warrior-elixir"].includes(action)) {
    const uses = itemUses(feature);
    if (uses.remaining <= 0) {
      notify(`${actor.name}: недостаточно использований «${feature?.name ?? "способности"}».`, "warn");
      return false;
    }
  }
  return true;
}

function existingOilEffect(actor) {
  return actor?.effects?.find(effect => effect.getFlag(MODULE_ID, FLAGS.DARK_WARRIOR_OIL_EFFECT));
}

export async function applyBlackMagicOil(actor) {
  if (!actor || !darkWarriorClass(actor)) {
    notify("Эта активность требует класс «Воин тьмы».", "warn");
    return false;
  }
  const feature = findFeature(actor, "black-magic-oil");
  if (!feature) {
    notify("Для нанесения масла нужна особенность «Масло чёрной магии».", "warn");
    return false;
  }
  const data = {
    name: "Масло чёрной магии",
    img: feature.img,
    origin: feature.uuid,
    transfer: false,
    disabled: false,
    showIcon: 1,
    statuses: [],
    flags: {
      [MODULE_ID]: {
        [FLAGS.DARK_WARRIOR_OIL_EFFECT]: true
      }
    },
    duration: {
      seconds: 60,
      startTime: game.time?.worldTime ?? 0,
      value: 1,
      units: "minute",
      expiry: null,
      expired: false
    },
    system: { changes: [] }
  };
  const current = existingOilEffect(actor);
  if (current) await current.update(data);
  else await actor.createEmbeddedDocuments("ActiveEffect", [data]);
  notify(`${actor.name}: чёрное масло активно на 1 минуту. Выбранное оружие/боеприпасы подтвердите вручную.`);
  return true;
}

function elixirEffect(actor, type) {
  return actor?.effects?.find(effect =>
    effect.getFlag(MODULE_ID, FLAGS.DARK_WARRIOR_ELIXIR_EFFECT) === type
  );
}

function spellSaveDC(actor) {
  const dc = Number(actor?.system?.attributes?.spell?.dc ?? 0);
  if (Number.isFinite(dc) && dc > 0) return dc;
  return 8 + Number(actor?.system?.attributes?.prof ?? 0) + abilityMod(actor, "cha");
}

async function chat(actor, content) {
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content
  });
}

function elixirData(actor, feature, type) {
  const base = {
    img: feature.img,
    origin: feature.uuid,
    transfer: false,
    disabled: false,
    showIcon: 1,
    statuses: [],
    flags: {
      [MODULE_ID]: {
        [FLAGS.DARK_WARRIOR_ELIXIR_EFFECT]: type
      }
    },
    duration: {
      seconds: 3600,
      startTime: game.time?.worldTime ?? 0,
      value: 1,
      units: "hour",
      expiry: null,
      expired: false
    }
  };
  switch (type) {
    case "strength":
      return {
        ...base,
        name: "Эликсир чёрной магии: Адская сила",
        system: {
          changes: [{
            key: "system.abilities.str.value",
            type: "add",
            value: "3",
            phase: "initial",
            priority: 20
          }]
        }
      };
    case "shield":
      return {
        ...base,
        name: "Эликсир чёрной магии: Адский щит",
        system: {
          changes: [{
            key: "system.attributes.ac.bonus",
            type: "add",
            value: "1",
            phase: "final",
            priority: 20
          }]
        }
      };
    case "eye":
      return {
        ...base,
        name: "Эликсир чёрной магии: Демонический глаз",
        system: {
          changes: [{
            key: "system.attributes.senses.ranges.truesight",
            type: "upgrade",
            value: "30",
            phase: "final",
            priority: 20
          }]
        }
      };
    case "horrifying":
    default:
      return {
        ...base,
        name: "Эликсир чёрной магии: Ужасающий облик",
        system: { changes: [] }
      };
  }
}

export async function drinkDarkWarriorElixir(actor, activity) {
  if (!actor || !darkWarriorClass(actor)) {
    notify("Эта активность требует класс «Воин тьмы».", "warn");
    return false;
  }
  const feature = findFeature(actor, "black-magic-elixir");
  if (!feature) {
    notify("Для эликсира нужна особенность «Эликсир чёрной магии».", "warn");
    return false;
  }
  const type = String(automationData(activity).darkWarriorElixir ?? "strength");
  const data = elixirData(actor, feature, type);
  const current = elixirEffect(actor, type);
  if (current) await current.update(data);
  else await actor.createEmbeddedDocuments("ActiveEffect", [data]);

  if (type === "horrifying") {
    await chat(actor, `<p><strong>${actor.name}: Ужасающий облик.</strong> Существа в пределах 30 футов совершают спасбросок Мудрости против СЛ ${spellSaveDC(actor)}. При провале они напуганы; при успехе получают иммунитет к этому эффекту на 24 часа.</p>`);
  }
  notify(`${actor.name}: активирован эффект «${data.name}» на 1 час.`);
  return true;
}

function appendRollPart(roll, part) {
  if (!roll || !part) return;
  roll.parts ??= [];
  roll.parts.push(String(part));
}

export function applyDarkWarriorDamageAutomation(config) {
  if (!enabled()) return;
  const activity = config?.subject;
  const item = activityItem(activity);
  const actor = activityActor(activity);
  if (!actor || !item || item.type !== "weapon") return;
  if (!darkWarriorClass(actor) || !existingOilEffect(actor)) return;
  const bonus = abilityMod(actor, "cha");
  if (bonus <= 0) return;
  appendRollPart(config.rolls?.[0], `${bonus}[necrotic]`);
}
