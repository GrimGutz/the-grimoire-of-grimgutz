import { automationData, findFeature, isAutomationAuthority, notify } from "../shared/helpers.mjs";
import { clamp } from "../shared/dnd5e.mjs";
import { ownedAreaActivity, useAreaActivity } from "../shared/area-activities.mjs";
import { slotLevelDialog } from "../shared/dialogs.mjs";
import {
  createWeaponBuff,
  postWeaponBuffMessage
} from "../shared/weapon-buffs.mjs";
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

export async function activateWitchHunterEmpower(actor, activity) {
  if (!actor || !witchBladeClass(actor)) {
    notify("Эта активность требует класс «Ведьмин клинок».", "warn");
    return false;
  }
  if (!await useWitchBladeRage(actor, activity)) return false;
  const feature = findFeature(actor, "witch-hunter");
  await createWeaponBuff(actor, {
    key: "witch-hunter-empower",
    name: "Вспыхивающее оружие",
    sourceItem: feature,
    img: feature?.img,
    duration: { seconds: 60 },
    data: {
      advantageAgainstSpellcasters: true,
      advantageLabel: "Вспыхивающее оружие: цель имеет ячейки заклинаний"
    },
    description: "<p>Пока эффект активен, weapon attacks получают преимущество против целей, у которых есть ячейки заклинаний. Проверка цели выполняется по выбранным target токенам.</p>"
  });
  await postWeaponBuffMessage(actor, "Вспыхивающее оружие", "Оружейный бафф активен на 1 минуту. Weapon attacks получают преимущество против выбранных целей с ячейками заклинаний.");
  return true;
}

export async function activateWitchCrystallization(actor) {
  if (!actor || !witchBladeClass(actor)) {
    notify("Эта активность требует класс «Ведьмин клинок».", "warn");
    return false;
  }
  const feature = findFeature(actor, "witch-crystallization");
  if (!feature) {
    notify("Для кристаллизации нужна особенность «Колдовская кристаллизация».", "warn");
    return false;
  }
  const slotLevel = await slotLevelDialog({
    title: "Колдовская кристаллизация",
    label: "Потраченная ячейка",
    maximum: 5,
    confirmLabel: "Применить"
  });
  if (!slotLevel) return false;
  const reduction = Math.floor(slotLevel / 2);
  await createWeaponBuff(actor, {
    key: "witch-crystallization",
    name: `Колдовская кристаллизация (${slotLevel} круг)`,
    sourceItem: feature,
    img: feature.img,
    duration: { seconds: 60 },
    data: {
      criticalThresholdReduction: reduction,
      slotLevel
    },
    description: `<p>Критический порог melee weapon attacks уменьшается на ${reduction} от потраченной ячейки ${slotLevel}-го круга. Условие «одно рукопашное оружие в одной руке и нет другого оружия» подтверждается игроком/Мастером.</p>`
  });
  await postWeaponBuffMessage(actor, "Колдовская кристаллизация", reduction > 0
    ? `Критический порог melee weapon attacks снижен на ${reduction} на 1 минуту.`
    : "Ячейка 1-го круга не снижает критический порог по правилу «за каждые два уровня ячейки»; marker-эффект создан как напоминание.");
  return true;
}

export async function activateEtherealStorm(actor, activity) {
  if (!actor || !witchBladeClass(actor)) {
    notify("Эта активность требует класс «Ведьмин клинок».", "warn");
    return false;
  }
  if (!await useWitchBladeRage(actor, activity)) return false;
  const feature = findFeature(actor, "ethereal-storm");
  await createWeaponBuff(actor, {
    key: "ethereal-storm",
    name: "Эфирная буря",
    sourceItem: feature,
    img: feature?.img,
    duration: { seconds: 60 },
    data: {
      reach: 30,
      reminderOnly: true
    },
    description: "<p>Маркер: при сражении двумя оружиями досягаемость оружия увеличена до 30 футов. Изменение reach проверяется вручную, потому что Foundry не может безопасно изменить дальность только для конкретной пары оружий.</p>"
  });
  await postWeaponBuffMessage(actor, "Эфирная буря", "Маркер досягаемости 30 футов активен на 1 минуту. Атаки двумя оружиями и выбор подходящего оружия подтверждаются вручную.");
  return true;
}

export async function openImmaterialWhirlwind(actor, activity) {
  const chosen = activity?.item ? activity : ownedAreaActivity(actor, "immaterial-whirlwind", "open-immaterial-whirlwind");
  if (!chosen) { notify("Не найдена активность Нематериального вихря на персонаже.", "warn"); return false; }
  return Boolean(await useAreaActivity(chosen, { validate: () => validateWitchBladeRageUse(actor, chosen) }));
}

export async function useWitchBladeSealEvil(actor, activity) {
  const chosen = activity?.item ? activity : ownedAreaActivity(actor, "witch-blade-seal", "use-witch-blade-seal-evil");
  if (!chosen) { notify("Не найдена злая Печать Ведьминого клинка на персонаже.", "warn"); return false; }
  return Boolean(await useAreaActivity(chosen, { validate: () => validateWitchBladeRageUse(actor, chosen) }));
}
