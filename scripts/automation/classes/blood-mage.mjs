import { FLAGS, MODULE_ID, SETTINGS } from "../shared/constants.mjs";
import { automationData, findFeature, itemIdentifier, notify } from "../shared/helpers.mjs";

const BLOOD_MAGIC_COSTS = {
  1: "2d8",
  2: "3d8",
  3: "5d8",
  4: "6d8",
  5: "7d8"
};

export function bloodMageClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "blood-mage");
}

export function bloodMageLevel(actor) {
  return Number(bloodMageClass(actor)?.system?.levels ?? 0);
}

function textParts(...values) {
  return values
    .flatMap(value => {
      if (!value) return [];
      if (typeof value === "string") return [value];
      if (Array.isArray(value)) return value;
      if (typeof value === "object") return Object.values(value);
      return [];
    })
    .map(value => String(value ?? "").toLocaleLowerCase("ru"))
    .filter(Boolean);
}

function actorTypeText(actor) {
  return textParts(actor?.system?.details?.type, actor?.system?.details?.race, actor?.system?.details?.species).join(
    " "
  );
}

export function isBloodlessActor(actor) {
  const text = actorTypeText(actor);
  if (!text) return false;
  if (/\bliving construct\b/.test(text)) return true;
  if (/\b(construct|elemental|ooze|slime|plant|undead)\b/.test(text)) return true;
  return ["живой конструкт", "конструкт", "элементаль", "элементал", "слиз", "растен", "нежит"].some(pattern =>
    text.includes(pattern)
  );
}

function spellSlotMax(actor, level) {
  const slot = actor?.system?.spells?.[`spell${level}`];
  return Math.max(Number(slot?.max ?? 0), Number(slot?.override ?? 0), Number(slot?.value ?? 0));
}

function pactSlotCanCastThirdLevel(actor) {
  const pact = actor?.system?.spells?.pact;
  return Number(pact?.level ?? 0) >= 3 && Math.max(Number(pact?.max ?? 0), Number(pact?.value ?? 0)) > 0;
}

function hasThirdLevelSpellSlot(actor) {
  return pactSlotCanCastThirdLevel(actor) || [3, 4, 5, 6, 7, 8, 9].some(level => spellSlotMax(actor, level) > 0);
}

function canCastSpellItem(item) {
  if (item?.type !== "spell" || Number(item?.system?.level ?? 0) < 3) return false;
  const preparation = item.system?.preparation;
  if (!preparation) return true;
  if (preparation.prepared === true) return true;
  return ["always", "atwill", "innate", "pact"].includes(String(preparation.mode ?? ""));
}

function canCastThirdLevelSpell(actor) {
  return hasThirdLevelSpellSlot(actor) || (actor?.items?.some(canCastSpellItem) ?? false);
}

export function bloodMagePrerequisiteFailures(actor) {
  const failures = [];
  if (Number(actor?.system?.abilities?.con?.value ?? 0) < 13) failures.push("Телосложение 13");
  if (isBloodlessActor(actor)) failures.push("существо с кровью");
  if (!canCastThirdLevelSpell(actor)) failures.push("способность накладывать заклинание 3-го уровня или выше");
  return failures;
}

export function validateBloodMagePrerequisites(item, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  if (!actor || item.type !== "class" || itemIdentifier(item) !== "blood-mage") return true;
  const failures = bloodMagePrerequisiteFailures(actor);
  if (failures.length) {
    notify(
      `Нельзя добавить класс «Маг крови». Не выполнено: ${failures.join(", ")}. Доступ к тайне магии крови подтверждает Мастер.`,
      "error"
    );
    return false;
  }
  return true;
}

export function validateBloodMageFeaturePrerequisites(item, options, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  const data = automationData(item);
  if (!actor || data.bloodMageFeature !== true || options?.isAdvancement) return true;
  const level = bloodMageLevel(actor);
  if (!level) {
    notify(`Особенность «${item.name}» требует класс «Маг крови».`, "error");
    return false;
  }
  const requiredLevel = Number(data.minimumLevel ?? data.requiredLevel ?? item.system?.prerequisites?.level ?? 0);
  if (requiredLevel && level < requiredLevel) {
    notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Мага крови.`, "error");
    return false;
  }
  return true;
}

function bloodMagicEffect(actor) {
  return actor?.effects?.find(effect => effect.getFlag(MODULE_ID, FLAGS.BLOOD_MAGIC_COST_EFFECT));
}

function bloodMagicAmount(effect) {
  return Math.max(0, Number(effect?.getFlag(MODULE_ID, "bloodMagicCostAmount") ?? 0));
}

function bloodMagicFormula(activity) {
  const data = automationData(activity);
  const slotLevel = Number(data.bloodMagicSlotLevel ?? 0);
  return BLOOD_MAGIC_COSTS[slotLevel] ?? String(data.bloodMagicFormula ?? "");
}

export function validateBloodMagicCostUse(actor, activity) {
  const data = automationData(activity);
  const slotLevel = Number(data.bloodMagicSlotLevel ?? 0);
  const level = bloodMageLevel(actor);
  if (!actor || !level) {
    notify("Эта активность требует класс «Маг крови».", "warn");
    return false;
  }
  if (!findFeature(actor, "blood-magic")) {
    notify("Для цены крови требуется особенность «Магия крови».", "warn");
    return false;
  }
  if (!BLOOD_MAGIC_COSTS[slotLevel]) {
    notify("Неверный уровень цены крови.", "warn");
    return false;
  }
  if (slotLevel > level) {
    notify(
      `${actor.name}: Магия крови не может использовать ячейку ${slotLevel}-го уровня при ${level}-м уровне Мага крови.`,
      "warn"
    );
    return false;
  }
  return true;
}

export async function applyBloodMagicCost(actor, activity) {
  if (!validateBloodMagicCostUse(actor, activity)) return false;
  const feature = findFeature(actor, "blood-magic");
  const slotLevel = Number(automationData(activity).bloodMagicSlotLevel ?? 0);
  const formula = bloodMagicFormula(activity);
  const roll = await new Roll(formula, actor.getRollData()).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `Магия крови: цена ячейки ${slotLevel}-го уровня (${formula})`
  });

  const damage = Math.max(0, Number(roll.total ?? 0));
  const hp = actor.system?.attributes?.hp ?? {};
  const currentHP = Math.max(0, Number(hp.value ?? 0));
  await actor.update({ "system.attributes.hp.value": Math.max(0, currentHP - damage) });

  const currentEffect = bloodMagicEffect(actor);
  const totalReduction = bloodMagicAmount(currentEffect) + damage;
  const effectData = {
    name: "Магия крови: снижение максимума хитов",
    img: feature?.img ?? "icons/magic/unholy/hand-claw-fire-blue.webp",
    origin: feature?.uuid ?? null,
    transfer: false,
    disabled: false,
    showIcon: 1,
    statuses: [],
    flags: {
      [MODULE_ID]: {
        [FLAGS.BLOOD_MAGIC_COST_EFFECT]: true,
        bloodMagicCostAmount: totalReduction
      }
    },
    system: {
      changes: [
        {
          key: "system.attributes.hp.max",
          type: "add",
          value: String(-totalReduction),
          phase: "final",
          priority: 20
        }
      ]
    }
  };
  if (currentEffect) await currentEffect.update(effectData);
  else await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
  notify(
    `${actor.name}: Магия крови нанесла ${damage} некротического урона и снизила максимум хитов на ${totalReduction} до продолжительного отдыха.`
  );
  return true;
}

export async function clearBloodMagicCosts(actor, result, { automationEnabled = true } = {}) {
  if (!automationEnabled || result?.type !== "long" || !actor?.isOwner) return false;
  const effects = actor.effects?.filter(effect => effect.getFlag(MODULE_ID, FLAGS.BLOOD_MAGIC_COST_EFFECT)) ?? [];
  if (!effects.length) return false;
  await actor.deleteEmbeddedDocuments(
    "ActiveEffect",
    effects.map(effect => effect.id)
  );
  notify(`${actor.name}: снижение максимума хитов от Магии крови снято после продолжительного отдыха.`);
  return true;
}

export function validateBloodMageSacrificeUse(actor) {
  const level = bloodMageLevel(actor);
  if (!actor || !level) {
    notify("Эта активность требует класс «Маг крови».", "warn");
    return false;
  }
  if (level < 4 || !findFeature(actor, "blood-mage-sacrifice")) {
    notify("Для «Жертвы» требуется 4-й уровень Мага крови и одноименная особенность.", "warn");
    return false;
  }
  return true;
}

export async function rollBloodMageSacrifice(actor) {
  if (!validateBloodMageSacrificeUse(actor)) return false;
  const roll = await new Roll("4d8", actor.getRollData()).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: "Жертва: некротический урон цели при провале спасброска Телосложения"
  });
  if (bloodMageLevel(actor) >= 5) {
    const extra = await new Roll("2d8", actor.getRollData()).evaluate();
    await extra.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: "Жертва: дополнительное исцеление, если цель умерла или потеряла сознание"
    });
  }
  return true;
}
