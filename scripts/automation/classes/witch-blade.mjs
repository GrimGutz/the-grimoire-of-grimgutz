import { automationData, findFeature, isAutomationAuthority, notify } from "../shared/helpers.mjs";
import { abilityMod, clamp } from "../shared/dnd5e.mjs";
import { slotLevelDialog } from "../shared/dialogs.mjs";
import { applyTargetEffect } from "../shared/target-effects.mjs";
import {
  createWeaponBuff,
  postWeaponBuffMessage
} from "../shared/weapon-buffs.mjs";
import { witchBladeClass, witchBladeLevel } from "../shared/selectors.mjs";
import {
  createCircleTemplate,
  firstTargetToken,
  groupTokensByDisposition,
  postZoneSummary,
  rollZoneDamage,
  sourceTokenForActor,
  tokensWithinRadius
} from "../shared/zones.mjs";

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

function proficiencyBonus(actor) {
  const value = Number(actor?.system?.attributes?.prof ?? actor?.system?.prof ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function witchBladeSaveDc(actor) {
  return 8 + proficiencyBonus(actor) + abilityMod(actor, "int");
}

function alignmentText(actor) {
  const alignmentData = actor?.system?.details?.alignment;
  return String(
    typeof alignmentData === "object" ? alignmentData?.value ?? alignmentData?.label ?? "" : alignmentData ?? ""
  ).toLocaleLowerCase("ru");
}

function witchBladeAlignmentDamage(actor) {
  const alignment = alignmentText(actor);
  if (alignment.includes("evil") || alignment.includes("зл")) return { type: "necrotic", label: "некротический" };
  if (alignment.includes("good") || alignment.includes("добр")) return { type: "radiant", label: "излучение" };
  return { type: "", label: "излучение/некротический — выберите по мировоззрению" };
}

export async function openImmaterialWhirlwind(actor, activity) {
  if (!actor || !witchBladeClass(actor)) {
    notify("Эта активность требует класс «Ведьмин клинок».", "warn");
    return false;
  }

  const sourceToken = sourceTokenForActor(actor);
  if (!sourceToken) {
    notify("Для автоматизации «Нематериального вихря» нужен токен Witch Blade на активной сцене.", "warn");
    return false;
  }

  if (!await useWitchBladeRage(actor, activity)) return false;

  const radius = 30;
  const originToken = firstTargetToken() ?? sourceToken;
  const damage = witchBladeAlignmentDamage(actor);
  const roll = await rollZoneDamage({
    actor,
    sourceToken,
    formula: "8d8",
    damageType: damage.type,
    flavor: "Нематериальный вихрь"
  });

  await createCircleTemplate({
    actor,
    originToken,
    radius,
    label: "Нематериальный вихрь",
    color: "#7f5cff"
  });

  const tokens = tokensWithinRadius(originToken, radius, { includeOrigin: true });
  const groups = groupTokensByDisposition(sourceToken, tokens, { includeSelfAsAlly: true });
  const saveDc = witchBladeSaveDc(actor);
  const originWasTarget = originToken !== sourceToken;

  await postZoneSummary({
    actor,
    sourceToken,
    title: "Нематериальный вихрь",
    radius,
    originToken,
    rows: [
      { label: "Урон", value: `${roll.total} (${damage.label})` },
      { label: "Враги", tokens: groups.enemies },
      { label: "Союзники / вы", tokens: groups.allies },
      ...(groups.neutral.length ? [{ label: "Нейтральные токены", tokens: groups.neutral }] : [])
    ],
    notes: [
      `Цели в зоне должны пройти спасбросок Ловкости СЛ ${saveDc}; при провале получают урон.`,
      "Урон не применяется автоматически, потому что нужен спасбросок и повторные проверки в конце хода.",
      originWasTarget
        ? "Шаблон создан по первой выбранной цели."
        : "Цель не была выбрана: шаблон создан на вашем токене, передвиньте его на нужную точку при необходимости."
    ]
  });
  return true;
}

export async function useWitchBladeSealEvil(actor, activity) {
  if (!actor || !witchBladeClass(actor)) {
    notify("Эта активность требует класс «Ведьмин клинок».", "warn");
    return false;
  }
  if (!await useWitchBladeRage(actor, activity)) return false;

  const feature = findFeature(actor, "witch-blade-seal");
  const saveDc = witchBladeSaveDc(actor);
  return applyTargetEffect({
    sourceActor: actor,
    sourceItem: feature,
    key: "witch-blade-seal-evil-stunned",
    name: "Ошеломлён: Печать Ведьминого клинка",
    img: feature?.img,
    status: "stunned",
    statusLabel: "Ошеломлён",
    duration: { seconds: 6, rounds: 1, turns: 1 },
    title: "Печать: Злой",
    saveText: `Харизма СЛ ${saveDc}; выбирайте только цели, провалившие спасбросок.`,
    note: "Эффект длится 1 раунд. Для конуса выберите токенами все цели, которые действительно провалили спасбросок.",
    description: "<p>Цель провалила спасбросок Харизмы против Печати: Злой и ошеломлена на 1 раунд.</p>"
  });
}
