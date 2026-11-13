import { FLAGS, MODULE_ID, SETTINGS } from "../shared/constants.mjs";
import {
  automationData,
  findFeature,
  isAutomationAuthority,
  itemIdentifier,
  itemUses,
  notify
} from "../shared/helpers.mjs";
import { abilityMod } from "../shared/dnd5e.mjs";
import { ownedAreaActivity, useAreaActivity } from "../shared/area-activities.mjs";
import { applyTargetEffect } from "../shared/target-effects.mjs";

const crusaderSyncs = new Set();

export function crusaderClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "crusader");
}

export function crusaderLevel(actor) {
  return Number(crusaderClass(actor)?.system?.levels ?? 0);
}

function hasReligionProficiency(actor) {
  const religion = actor?.system?.skills?.rel;
  return Number(religion?.value ?? religion?.proficient ?? 0) > 0;
}

function hasLawfulAlignment(actor) {
  const alignmentData = actor?.system?.details?.alignment;
  const alignment = String(
    typeof alignmentData === "object" ? (alignmentData?.value ?? alignmentData?.label ?? "") : (alignmentData ?? "")
  ).toLocaleLowerCase("ru");
  return alignment.includes("lawful") || alignment.includes("законн");
}

export function crusaderPrerequisiteFailures(actor) {
  const failures = [];
  if (Number(actor?.system?.abilities?.str?.value ?? 0) < 13) failures.push("Сила 13");
  if (Number(actor?.system?.abilities?.cha?.value ?? 0) < 13) failures.push("Харизма 13");
  if (!hasReligionProficiency(actor)) failures.push("владение навыком Религия");
  if (Number(actor?.system?.details?.level ?? 0) < 5) failures.push("5-й уровень персонажа");
  if (!hasLawfulAlignment(actor)) failures.push("законное мировоззрение");
  return failures;
}

export function validateCrusaderPrerequisites(item, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  if (!actor || item.type !== "class" || itemIdentifier(item) !== "crusader") return true;
  const failures = crusaderPrerequisiteFailures(actor);
  if (failures.length) {
    notify(`Нельзя добавить класс «Крестоносец». Не выполнено: ${failures.join(", ")}.`, "error");
    return false;
  }
  return true;
}

export function validateCrusaderFeaturePrerequisites(item, options, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  const data = automationData(item);
  if (!actor || data.crusaderFeature !== true || options?.isAdvancement) return true;
  const level = crusaderLevel(actor);
  if (!level) {
    notify(`Особенность «${item.name}» требует класс «Крестоносец».`, "error");
    return false;
  }
  const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
  if (requiredLevel && level < requiredLevel) {
    notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Крестоносца.`, "error");
    return false;
  }
  return true;
}

function crusaderRageEffect(actor) {
  return actor?.effects?.find(effect => effect.getFlag(MODULE_ID, FLAGS.CRUSADER_RAGE_EFFECT));
}

export async function activateCrusaderRage(actor) {
  if (!actor || !crusaderClass(actor)) {
    notify("Эта активность требует класс «Крестоносец».", "warn");
    return false;
  }
  const feature = findFeature(actor, "crusader-rage");
  if (!feature) {
    notify("Для Ярости требуется особенность «Ярость».", "warn");
    return false;
  }

  const changes = [
    {
      key: "system.abilities.cha.check.roll.mode",
      type: "upgrade",
      value: "1",
      phase: "final",
      priority: 20
    },
    {
      key: "system.abilities.cha.save.roll.mode",
      type: "upgrade",
      value: "1",
      phase: "final",
      priority: 20
    }
  ];
  const data = {
    name: "Ярость Крестоносца",
    img: feature.img,
    origin: feature.uuid,
    transfer: false,
    disabled: false,
    showIcon: 1,
    statuses: [],
    flags: {
      [MODULE_ID]: {
        [FLAGS.CRUSADER_RAGE_EFFECT]: true
      }
    },
    duration: {
      seconds: 60,
      startTime: game.time?.worldTime ?? 0
    },
    system: { changes }
  };

  const current = crusaderRageEffect(actor);
  if (current) await current.update(data);
  else await actor.createEmbeddedDocuments("ActiveEffect", [data]);
  notify(`${actor.name}: активирована «Ярость Крестоносца» на 1 минуту.`);
  return true;
}

function proficiencyBonus(actor) {
  const value = Number(actor?.system?.attributes?.prof ?? actor?.system?.prof ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function crusaderSpellSaveDc(actor) {
  return 8 + proficiencyBonus(actor) + abilityMod(actor, "cha");
}

export async function useCrusaderConsecration(actor, activity = null) {
  const chosen = activity?.item ? activity : ownedAreaActivity(actor, "consecration");
  if (!chosen || !validateCrusaderConsecrationUse(actor)) return false;
  return Boolean(await useAreaActivity(chosen));
}

export async function condemnCrusaderTarget(actor) {
  if (!validateCrusaderCondemnationUse(actor)) return false;
  const feature = findFeature(actor, "condemnation");
  const saveDc = crusaderSpellSaveDc(actor);
  return applyTargetEffect({
    sourceActor: actor,
    sourceItem: feature,
    key: "crusader-condemnation",
    name: "Осуждён",
    img: feature?.img,
    statusLabel: "Осуждён",
    duration: { seconds: 60 },
    title: "Осуждение",
    saveText: `Мудрость СЛ ${saveDc}; накладывайте эффект только на цели, провалившие спасбросок.`,
    note: "Маркер напоминает: атаки по цели совершаются с преимуществом, цель не получает преимуществ от невидимости и не может использовать телепортацию/экстрапланарное перемещение. Механически эти части проверяются вручную.",
    description: `<p>Осуждённая цель светится тусклым контуром 1 минуту. Атаки по ней совершаются с преимуществом, если атакующий видит цель; цель не получает преимуществ от невидимости и не может использовать телепортацию или экстрапланарное перемещение.</p>`
  });
}

export function validateCrusaderRageUse(actor) {
  if (!actor || !crusaderClass(actor)) {
    notify("Эта активность требует класс «Крестоносец».", "warn");
    return false;
  }
  const rage = findFeature(actor, "crusader-rage");
  const uses = itemUses(rage);
  if (rage && uses.remaining > 0) return true;
  notify("Недостаточно использований «Ярости». Завершите короткий или продолжительный отдых.", "warn");
  return false;
}

export function validateCrusaderConsecrationUse(actor) {
  if (!actor || !crusaderClass(actor)) {
    notify("Эта активность требует класс «Крестоносец».", "warn");
    return false;
  }
  if (!findFeature(actor, "consecration")) {
    notify("Для автоматизации требуется особенность «Освящение».", "warn");
    return false;
  }
  return true;
}

export function validateCrusaderCondemnationUse(actor) {
  if (!actor || !crusaderClass(actor)) {
    notify("Эта активность требует класс «Крестоносец».", "warn");
    return false;
  }
  if (!findFeature(actor, "condemnation")) {
    notify("Для автоматизации требуется особенность «Осуждение».", "warn");
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

export async function syncCrusaderResources(actor, { notifyResult = false } = {}) {
  if (!actor?.isOwner || !isAutomationAuthority(actor) || crusaderSyncs.has(actor.uuid)) return false;
  if (!crusaderClass(actor)) return false;

  crusaderSyncs.add(actor.uuid);
  try {
    const updates = [
      await syncUses(findFeature(actor, "crusader-rage"), 1),
      await syncUses(findFeature(actor, "condemnation"), Math.max(1, abilityMod(actor, "cha")))
    ];
    const changed = updates.some(Boolean);
    if (notifyResult && changed) notify(`${actor.name}: ресурсы Крестоносца синхронизированы.`);
    return changed;
  } finally {
    crusaderSyncs.delete(actor.uuid);
  }
}
