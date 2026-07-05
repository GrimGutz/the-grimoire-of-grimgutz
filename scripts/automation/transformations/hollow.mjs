import { FLAGS, MODULE_ID } from "../shared/constants.mjs";
import {
  activityActor,
  activityItem,
  automationData,
  findFeature,
  isAutomationAuthority,
  itemUses,
  notify
} from "../shared/helpers.mjs";
import { abilityMod, baseAbilityValue } from "../shared/dnd5e.mjs";
import { passiveEffectSignature } from "../effects/passive-helpers.mjs";

const hollowPassiveSyncs = new Set();

export function hollowFeatureLevel(item) {
  const data = automationData(item);
  if (data.transformation !== "hollow" && data.hollowFeature !== true) return 0;
  const flagged = Number(data.transformationLevel ?? 0);
  if (Number.isFinite(flagged) && flagged > 0) return flagged;
  const match = String(item?.system?.requirements ?? "").match(/Полый\s+([1-4])/iu);
  return match ? Number(match[1]) : 0;
}

export function hollowTransformationLevel(actor) {
  return Math.max(0, ...[...(actor?.items ?? [])].map(hollowFeatureLevel));
}

function hollowChargeFeature(actor) {
  return findFeature(actor, "magic-eradicator");
}

function hollowCharges(feature) {
  return itemUses(feature);
}

async function chooseHollowCost(activity, available) {
  const data = automationData(activity);
  if (data.hollowCost === "all") return available > 0 ? available : null;

  const fixed = Number(data.hollowCost);
  if (Number.isFinite(fixed) && fixed > 0) return fixed;

  const minimum = Math.max(1, Number(data.hollowMin ?? 1));
  const configuredMaximum = Number(data.hollowMax ?? available);
  const maximum = Math.min(
    available,
    Number.isFinite(configuredMaximum) && configuredMaximum > 0 ? configuredMaximum : available
  );
  if (maximum < minimum) return null;

  const selected = await foundry.applications.api.DialogV2.wait({
    window: { title: "Заряды Анти-Магии" },
    position: { width: 420 },
    content: `
      <div class="form-group">
        <label>Потратить зарядов</label>
        <div class="form-fields">
          <input type="number" name="cost" value="${minimum}" min="${minimum}" max="${maximum}" step="1">
        </div>
        <p class="hint">Доступно: ${available}. Допустимый расход: ${minimum}–${maximum}.</p>
      </div>
    `,
    buttons: [
      {
        action: "spend",
        label: "Потратить",
        icon: "fa-solid fa-bolt",
        default: true,
        callback: (_event, _button, dialog) => {
          return Number(dialog.element.querySelector('input[name="cost"]')?.value);
        }
      },
      {
        action: "cancel",
        label: "Отмена",
        icon: "fa-solid fa-xmark",
        callback: () => null
      }
    ]
  });
  const cost = Number(selected);
  if (!Number.isInteger(cost) || cost < minimum || cost > maximum) return null;
  return cost;
}

function hollowFormula(formula, cost, level) {
  return String(formula)
    .replaceAll("{level}", String(level))
    .replaceAll("{cost}", String(cost))
    .replaceAll("{halfCost}", String(Math.floor(cost / 2)));
}

async function rollHollowFormula(actor, activity, cost) {
  const data = automationData(activity);
  if (!data.hollowFormula) return null;
  const level = Math.max(1, hollowTransformationLevel(actor));
  const formula = hollowFormula(data.hollowFormula, cost, level);
  const item = activityItem(activity);
  const options = {
    flavor: `${item?.name ?? activity.name}: ${cost} Зарядов Анти-Магии`
  };
  if (data.hollowDamageType) options.type = data.hollowDamageType;
  const RollClass = data.hollowDamageType ? CONFIG.Dice.DamageRoll : Roll;
  const roll = await new RollClass(formula, actor.getRollData(), options).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: options.flavor
  });
  return roll;
}

export async function gainHollowCharge(actor) {
  const feature = hollowChargeFeature(actor);
  if (!actor || !feature) {
    notify("Для накопления зарядов требуется особенность «Истребитель магии».", "warn");
    return false;
  }
  const before = hollowCharges(feature);
  if (before.remaining >= before.maximum) {
    notify(`${actor.name}: запас Зарядов Анти-Магии уже заполнен (${before.remaining}/${before.maximum}).`, "warn");
    return false;
  }
  await feature.update({ "system.uses.spent": Math.max(0, before.spent - 1) });
  notify(`${actor.name}: Заряды Анти-Магии ${before.remaining + 1}/${before.maximum}.`);
  return true;
}

export async function useHollowCharges(actor, activity) {
  const feature = hollowChargeFeature(actor);
  if (!actor || !feature) {
    notify("Для этой способности требуется особенность «Истребитель магии».", "warn");
    return false;
  }

  const before = hollowCharges(feature);
  const data = automationData(activity);
  const item = activityItem(activity);
  if (data.hollowConsumeFeatureUse === true && itemUses(item).remaining < 1) {
    notify(`${item?.name ?? activity.name}: нет доступных применений.`, "warn");
    return false;
  }

  const cost = await chooseHollowCost(activity, before.remaining);
  if (!cost) return false;
  if (cost > before.remaining) {
    notify(`Недостаточно Зарядов Анти-Магии: требуется ${cost}, доступно ${before.remaining}.`, "warn");
    return false;
  }

  if (data.hollowConsumeFeatureUse === true) {
    const uses = itemUses(item);
    await item.update({ "system.uses.spent": uses.spent + 1 });
  }
  await feature.update({ "system.uses.spent": before.spent + cost });
  await rollHollowFormula(actor, activity, cost);
  const message = data.hollowMessage;
  notify(`${actor.name}: потрачено ${cost} Зарядов Анти-Магии, осталось ${before.remaining - cost}.${message ? ` ${message}` : ""}`);
  return true;
}

export function validateHollowActivityUse(activity) {
  const data = automationData(activity);
  const action = data.moduleAction;
  const actor = activityActor(activity);
  const item = activityItem(activity);
  if (action === "gain-hollow-charge") {
    if (hollowChargeFeature(actor)) return true;
    notify("Накопление зарядов требует особенность «Истребитель магии».", "warn");
    return false;
  }
  if (!data.hollowCharges && action !== "use-hollow-charges") return true;
  if (data.hollowConsumeFeatureUse === true && itemUses(item).remaining < 1) {
    notify(`${item?.name ?? activity.name}: нет доступных применений.`, "warn");
    return false;
  }
  const feature = hollowChargeFeature(actor);
  const charges = hollowCharges(feature);
  if (!feature || charges.remaining < Math.max(1, Number(data.hollowMinimumCost ?? data.hollowCost ?? 1))) {
    notify(`${item?.name ?? activity.name}: недостаточно Зарядов Анти-Магии.`, "warn");
    return false;
  }
  return true;
}

export async function syncHollowTransformation(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  const level = hollowTransformationLevel(actor);
  const storedLevel = Number(actor.getFlag(MODULE_ID, FLAGS.HOLLOW_LEVEL) ?? 0);
  if (storedLevel !== level) {
    if (level > 0) await actor.setFlag(MODULE_ID, FLAGS.HOLLOW_LEVEL, level);
    else await actor.unsetFlag(MODULE_ID, FLAGS.HOLLOW_LEVEL);
  }
}

function hollowPassiveSource(effect) {
  return effect?.getFlag?.(MODULE_ID, FLAGS.HOLLOW_PASSIVE)
    ?? effect?.flags?.[MODULE_ID]?.[FLAGS.HOLLOW_PASSIVE];
}

function hollowPassiveEffectData({ key, feature, name = feature?.name, img = feature?.img, changes = [], description = "" }) {
  return {
    name,
    img,
    type: "base",
    description,
    origin: feature?.uuid ?? null,
    transfer: false,
    disabled: false,
    showIcon: 1,
    statuses: [],
    tint: "#ffffff",
    start: null,
    duration: {
      value: null,
      units: "seconds",
      expiry: null,
      expired: false
    },
    flags: {
      [MODULE_ID]: {
        [FLAGS.HOLLOW_PASSIVE]: key
      }
    },
    system: { changes }
  };
}

function hollowAbilityIncrease(actor, ability, increase, maximum = 16) {
  const base = baseAbilityValue(actor, ability);
  if (!Number.isFinite(base)) return 0;
  return Math.max(0, Math.min(increase, maximum - base));
}

function hollowPassiveDefinitions(actor) {
  const definitions = [];

  const negativeBody = findFeature(actor, "negative-body");
  if (negativeBody) {
    const changes = [];
    const conIncrease = hollowAbilityIncrease(actor, "con", 2, 16);
    const wisIncrease = hollowAbilityIncrease(actor, "wis", 1, 16);
    if (conIncrease > 0) {
      changes.push({
        key: "system.abilities.con.value",
        type: "add",
        value: String(conIncrease),
        phase: "initial",
        priority: 20
      });
    }
    if (wisIncrease > 0) {
      changes.push({
        key: "system.abilities.wis.value",
        type: "add",
        value: String(wisIncrease),
        phase: "initial",
        priority: 20
      });
    }
    definitions.push(hollowPassiveEffectData({
      key: "negative-body",
      feature: negativeBody,
      changes,
      description: "Телосложение +2 и Мудрость +1, но каждая характеристика повышается этим эффектом максимум до 16."
    }));
  }

  const maskingAura = findFeature(actor, "masking-aura");
  if (maskingAura) {
    definitions.push(hollowPassiveEffectData({
      key: "masking-aura",
      feature: maskingAura,
      description: `Существа в пределах 10 футов не обнаруживаются магическими средствами. Союзники в ауре получают бонус к спасброскам, равный модификатору Телосложения владельца (${abilityMod(actor, "con")}).`
    }));
  }

  const negativeGaze = findFeature(actor, "negative-gaze");
  if (negativeGaze) {
    definitions.push(hollowPassiveEffectData({
      key: "negative-gaze",
      feature: negativeGaze,
      description: "Владелец постоянно находится под эффектом обнаружения магии и может использовать определение по изменённым правилам способности."
    }));
  }

  const fortifiedSoul = findFeature(actor, "fortified-soul");
  if (fortifiedSoul) {
    definitions.push(hollowPassiveEffectData({
      key: "fortified-soul",
      feature: fortifiedSoul,
      changes: [{
        key: "system.traits.dr.value",
        type: "custom",
        value: "spell",
        phase: "initial",
        priority: 20
      }],
      description: "Сопротивление урону от заклинаний. dnd5e хранит сопротивления по типам урона, поэтому эффект добавляет кастомное сопротивление «spell» и требует подтверждения Мастера при расчёте урона."
    }));
  }

  const woundInMagic = findFeature(actor, "wound-in-magic");
  if (woundInMagic) {
    definitions.push(hollowPassiveEffectData({
      key: "wound-in-magic",
      feature: woundInMagic,
      description: "Враг в 10 футах, накладывающий заклинание, бросает d20; при 9 или ниже заклинание не срабатывает."
    }));
  }

  return definitions;
}

export async function syncHollowPassiveEffects(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor) || hollowPassiveSyncs.has(actor.uuid)) return;
  hollowPassiveSyncs.add(actor.uuid);
  try {
    const desired = new Map(
      hollowPassiveDefinitions(actor).map(effect => [hollowPassiveSource(effect), effect])
    );
    const existing = new Map();
    for (const effect of actor.effects ?? []) {
      const source = hollowPassiveSource(effect);
      if (source) existing.set(source, effect);
    }

    const creates = [];
    const updates = [];
    for (const [key, data] of desired) {
      const current = existing.get(key);
      if (!current) {
        creates.push(data);
      } else if (passiveEffectSignature(current) !== passiveEffectSignature(data)) {
        updates.push({ _id: current.id, ...data });
      }
      existing.delete(key);
    }

    const deletes = [...existing.values()].map(effect => effect.id);
    if (deletes.length) await actor.deleteEmbeddedDocuments("ActiveEffect", deletes);
    if (updates.length) await actor.updateEmbeddedDocuments("ActiveEffect", updates);
    if (creates.length) await actor.createEmbeddedDocuments("ActiveEffect", creates);
  } finally {
    hollowPassiveSyncs.delete(actor.uuid);
  }
}
