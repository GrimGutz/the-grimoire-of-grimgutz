import { FLAGS, MODULE_ID } from "../shared/constants.mjs";
import {
  activityActor,
  activityItem,
  automationData,
  findFeature,
  hasFeature,
  isAutomationAuthority,
  itemIdentifier,
  notify
} from "../shared/helpers.mjs";
import { abilityMod } from "../shared/dnd5e.mjs";
import { choiceDialog, numberDialog } from "../shared/dialogs.mjs";
import { hereticClass } from "../shared/selectors.mjs";
import { flaggedPassiveEffectData, syncFlaggedPassiveEffects } from "../effects/passive-helpers.mjs";

const hereticPassiveSyncs = new Set();

const OCCULT_ABILITIES = {
  int: "Интеллект",
  wis: "Мудрость",
  cha: "Харизма"
};

function occultAbility(actor) {
  const stored = actor?.getFlag(MODULE_ID, FLAGS.OCCULT_ABILITY);
  if (stored in OCCULT_ABILITIES) return stored;
  return Object.keys(OCCULT_ABILITIES).reduce((best, ability) => {
    const value = Number(actor?.system?.abilities?.[ability]?.value ?? 0);
    const bestValue = Number(actor?.system?.abilities?.[best]?.value ?? 0);
    return value > bestValue ? ability : best;
  }, "int");
}

function occultModifier(actor) {
  return abilityMod(actor, occultAbility(actor));
}

function occultGift(actor) {
  return findFeature(actor, "occult-gifts");
}

function occultPoints(gift) {
  const maximum = Number(gift?.system?.uses?.max ?? 0);
  const spent = Number(gift?.system?.uses?.spent ?? 0);
  return {
    maximum: Number.isFinite(maximum) ? maximum : 0,
    spent: Number.isFinite(spent) ? spent : 0,
    remaining: Math.max(0, (Number.isFinite(maximum) ? maximum : 0) - (Number.isFinite(spent) ? spent : 0))
  };
}

export async function chooseOccultAbility(actor) {
  if (!actor || !hereticClass(actor)) return false;
  const current = occultAbility(actor);
  const selected = await choiceDialog({
    title: "Характеристика оккультизма",
    label: "Характеристика",
    choices: Object.entries(OCCULT_ABILITIES).map(([key, label]) => ({ value: key, label, selected: key === current })),
    defaultValue: current,
    confirmIcon: "fa-solid fa-wand-magic-sparkles"
  });
  if (!(selected in OCCULT_ABILITIES)) return false;
  await actor.setFlag(MODULE_ID, FLAGS.OCCULT_ABILITY, selected);
  notify(`${actor.name}: характеристика оккультизма — ${OCCULT_ABILITIES[selected]}.`);
  return true;
}

async function chooseOccultCost(activity, available) {
  const data = automationData(activity);
  const fixed = Number(data.occultCost);
  if (Number.isFinite(fixed) && fixed > 0) return fixed;

  const minimum = Math.max(1, Number(data.occultMin ?? 1));
  const configuredMaximum = Number(data.occultMax ?? available);
  const maximum = Math.min(
    available,
    Number.isFinite(configuredMaximum) && configuredMaximum > 0 ? configuredMaximum : available
  );
  if (maximum < minimum) return null;

  const selected = await numberDialog({
    title: "Очки оккультизма",
    label: "Потратить очков",
    min: minimum,
    max: maximum,
    defaultValue: minimum,
    hint: `Доступно: ${available}. Допустимый расход: ${minimum}–${maximum}.`,
    confirmLabel: "Потратить",
    confirmIcon: "fa-solid fa-fire-flame-curved"
  });
  const cost = Number(selected);
  if (!Number.isInteger(cost) || cost < minimum || cost > maximum) return null;
  return cost;
}

function occultFormula(formula, cost, modifier) {
  return String(formula)
    .replaceAll("{costPlusOne}", String(cost + 1))
    .replaceAll("{doubleCost}", String(cost * 2))
    .replaceAll("{occultMod}", String(modifier))
    .replaceAll("{cost}", String(cost));
}

async function rollOccultFormula(actor, activity, cost) {
  const data = automationData(activity);
  if (!data.occultFormula) return null;
  const formula = occultFormula(data.occultFormula, cost, occultModifier(actor));
  const item = activityItem(activity);
  const options = {
    flavor: `${item?.name ?? activity.name}: ${cost} очк. оккультизма`
  };
  if (data.occultDamageType) options.type = data.occultDamageType;
  const RollClass = data.occultDamageType ? CONFIG.Dice.DamageRoll : Roll;
  const roll = await new RollClass(formula, actor.getRollData(), options).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: options.flavor
  });
  if (data.occultApplyTempHp) {
    const current = Number(actor.system.attributes?.hp?.temp ?? 0);
    await actor.update({ "system.attributes.hp.temp": Math.max(current, Number(roll.total ?? 0)) });
  }
  return roll;
}

export async function useOccultPoints(actor, activity) {
  const gift = occultGift(actor);
  if (!actor || !gift) {
    notify("Для этой силы требуется особенность «Оккультные дары».", "warn");
    return false;
  }
  const before = occultPoints(gift);
  const cost = await chooseOccultCost(activity, before.remaining);
  if (!cost) return false;
  if (cost > before.remaining) {
    notify(`Недостаточно очков оккультизма: требуется ${cost}, доступно ${before.remaining}.`, "warn");
    return false;
  }

  await gift.update({ "system.uses.spent": before.spent + cost });
  await rollOccultFormula(actor, activity, cost);
  const message = automationData(activity).occultMessage;
  notify(
    `${actor.name}: потрачено ${cost} очк. оккультизма, осталось ${before.remaining - cost}.${message ? ` ${message}` : ""}`
  );
  return true;
}

export function validateHereticActivityUse(activity) {
  const actor = activityActor(activity);
  const action = automationData(activity).moduleAction;
  if (action === "choose-occult-ability") {
    if (actor && hereticClass(actor)) return true;
    notify("Выбор характеристики оккультизма требует класс «Еретик».", "warn");
    return false;
  }
  if (action === "use-occult-points") {
    const gift = occultGift(actor);
    const available = occultPoints(gift).remaining;
    const data = automationData(activity);
    const required = Number(data.occultCost ?? data.occultMin ?? 1);
    if (gift && available >= required) return true;
    notify(`Недостаточно очков оккультизма: требуется минимум ${required}, доступно ${available}.`, "warn");
    return false;
  }
  return true;
}

const HERETIC_PASSIVE_CHANGES = {
  "mark-cursed-flesh": [
    { key: "system.traits.ci.value", type: "custom", value: "diseased", phase: "initial", priority: 20 }
  ],
  "mark-sharp-darkvision": [
    { key: "system.attributes.senses.ranges.darkvision", type: "add", value: "120", phase: "final", priority: 20 }
  ],
  "mark-undead": [
    { key: "system.details.type.value", type: "override", value: "undead", phase: "initial", priority: 100 }
  ],
  "distortion-beyond-sight": [
    { key: "system.attributes.senses.ranges.darkvision", type: "upgrade", value: "120", phase: "final", priority: 20 },
    { key: "system.attributes.senses.ranges.blindsight", type: "upgrade", value: "30", phase: "final", priority: 20 }
  ],
  "distortion-forbidden-flesh": [
    { key: "system.traits.dr.value", type: "custom", value: "necrotic", phase: "initial", priority: 20 },
    { key: "system.traits.dv.value", type: "custom", value: "radiant", phase: "initial", priority: 50 }
  ],
  "distortion-ghost-flight": [
    { key: "system.attributes.movement.fly", type: "upgrade", value: "40", phase: "final", priority: 20 }
  ],
  "distortion-ghoulish-might": [
    { key: "system.attributes.hp.bonuses.level", type: "add", value: "2", phase: "initial", priority: 20 },
    { key: "system.abilities.str.check.roll.mode", type: "upgrade", value: "1", phase: "final", priority: 20 },
    { key: "system.abilities.str.save.roll.mode", type: "upgrade", value: "1", phase: "final", priority: 20 }
  ]
};

function hereticPassiveDefinitions(actor) {
  if (!hereticClass(actor)) return [];
  const definitions = [];
  for (const item of actor.items ?? []) {
    const data = automationData(item);
    if (data.hereticFeature !== true) continue;
    const key = data.feature ?? itemIdentifier(item);
    const changes = (HERETIC_PASSIVE_CHANGES[key] ?? []).map(change => ({ ...change }));
    if (!changes.length) continue;
    definitions.push(flaggedPassiveEffectData(MODULE_ID, FLAGS.HERETIC_PASSIVE, { key, feature: item, changes }));
  }
  return definitions;
}

export async function syncHereticPassiveEffects(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  return syncFlaggedPassiveEffects(
    actor,
    hereticPassiveSyncs,
    MODULE_ID,
    FLAGS.HERETIC_PASSIVE,
    hereticPassiveDefinitions
  );
}

export async function restoreDefiledHeart(actor, result, { automationEnabled = true } = {}) {
  if (!automationEnabled || result?.type !== "short" || !actor?.isOwner) return;
  if (!hasFeature(actor, "distortion-defiled-heart")) return;
  const gift = occultGift(actor);
  if (!gift) return;
  const points = occultPoints(gift);
  const restored = Math.min(4, points.maximum);
  if (points.remaining >= restored) return;
  await gift.update({ "system.uses.spent": Math.max(0, points.maximum - restored) });
  notify(`${actor.name}: «Осквернённое сердце» восстановило очки оккультизма до ${restored}.`);
}
