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
import { abilityMod, clamp } from "../shared/dnd5e.mjs";
import {
  flaggedPassiveEffectData,
  syncFlaggedPassiveEffects
} from "../effects/passive-helpers.mjs";

const spiritVesselSyncs = new Set();
const spiritVesselPassiveSyncs = new Set();

const SPIRIT_VESSEL_ACTIONS = new Set([
  "choose-spirit-vessel-ability",
  "choose-spirit-vessel-strike-damage",
  "roll-spirit-vessel-concentrated-strike",
  "show-spirit-vessel-ability-improvement",
  "activate-spirit-flow",
  "spirit-vessel-aberration-charm",
  "spirit-vessel-fey-charm",
  "spirit-vessel-fiend-flames",
  "spirit-vessel-undead-frighten"
]);

const ABILITY_LABELS = {
  str: "Сила",
  dex: "Ловкость",
  con: "Телосложение",
  int: "Интеллект",
  wis: "Мудрость",
  cha: "Харизма"
};

const SPIRIT_LABELS = {
  aberration: "Абберация",
  celestial: "Небожитель",
  "elemental-earth": "Элементаль Земли",
  "elemental-air": "Элементаль Воздуха",
  "elemental-fire": "Элементаль Огня",
  "elemental-water": "Элементаль Воды",
  fey: "Фея",
  fiend: "Исчадие",
  undead: "Нежить"
};

const STRIKE_DAMAGE_OPTIONS = {
  aberration: [["psychic", "психический"]],
  celestial: [["radiant", "излучение"]],
  "elemental-earth": [["bludgeoning", "дробящий"]],
  "elemental-air": [["piercing", "колющий"], ["cold", "холод"]],
  "elemental-fire": [["fire", "огонь"], ["lightning", "молния"]],
  "elemental-water": [["slashing", "режущий"], ["acid", "кислота"]],
  fey: [["force", "силовое поле"]],
  fiend: [["fire", "огонь"]],
  undead: [["poison", "яд"]]
};

const INCARNATION_ABILITY = {
  aberration: "int",
  celestial: "wis",
  "elemental-earth": "str",
  "elemental-air": "str",
  "elemental-fire": "str",
  "elemental-water": "str",
  fey: "dex",
  fiend: "cha",
  undead: "con"
};

function change(key, type, value, phase = "initial", priority = 20) {
  return { key, type, value: String(value), phase, priority };
}

function appendRollPart(roll, part) {
  if (!roll || !part) return;
  roll.parts ??= [];
  roll.parts.push(String(part));
}

export function spiritVesselClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "spirit-vessel");
}

export function spiritVesselLevel(actor) {
  return Number(spiritVesselClass(actor)?.system?.levels ?? 0);
}

function spiritVesselSubclass(actor) {
  return actor?.items?.find(item =>
    item.type === "subclass"
    && (item.system?.classIdentifier === "spirit-vessel" || automationData(item).spiritVesselSubclass)
  );
}

function spiritVesselSpirit(actor) {
  const subclass = spiritVesselSubclass(actor);
  const subclassSpirit = automationData(subclass).spiritVesselSubclass;
  if (subclassSpirit) return subclassSpirit;
  const feature = actor?.items?.find(item => automationData(item).spiritVesselSpirit);
  return automationData(feature).spiritVesselSpirit ?? null;
}

function spiritFeature(actor) {
  return actor?.items?.find(item => automationData(item).spiritVesselSpirit === spiritVesselSpirit(actor));
}

function currentMax(item) {
  return String(item?.system?.uses?.max ?? "");
}

async function syncUses(feature, maximum) {
  if (!feature) return false;
  const max = String(Math.max(1, maximum));
  const spent = Number(feature.system?.uses?.spent ?? 0);
  const update = {};
  if (currentMax(feature) !== max) update["system.uses.max"] = max;
  if (Number.isFinite(spent) && spent > Number(max)) update["system.uses.spent"] = Number(max);
  if (!Object.keys(update).length) return false;
  await feature.update(update);
  return true;
}

export function spiritVesselSpellAbility(actor) {
  const flag = actor?.getFlag?.(MODULE_ID, FLAGS.SPIRIT_VESSEL_ABILITY);
  if (["int", "wis", "cha"].includes(flag)) return flag;
  const classAbility = spiritVesselClass(actor)?.system?.spellcasting?.ability;
  if (["int", "wis", "cha"].includes(classAbility)) return classAbility;
  const best = ["int", "wis", "cha"].sort((a, b) => abilityMod(actor, b) - abilityMod(actor, a))[0];
  return best ?? "cha";
}

function spiritVesselSpellModifier(actor) {
  return abilityMod(actor, spiritVesselSpellAbility(actor));
}

function spiritVesselSaveDC(actor) {
  return 8 + Number(actor?.system?.attributes?.prof ?? 0) + spiritVesselSpellModifier(actor);
}

function flowEffect(actor) {
  return actor?.effects?.find(effect => effect.getFlag(MODULE_ID, FLAGS.SPIRIT_VESSEL_FLOW_EFFECT));
}

function fiendFlamesEffect(actor) {
  return actor?.effects?.find(effect => effect.getFlag(MODULE_ID, FLAGS.SPIRIT_VESSEL_FIEND_FLAMES_EFFECT));
}

function effectDuration(seconds = 60) {
  return {
    seconds,
    startTime: game.time?.worldTime ?? 0,
    value: seconds / 60,
    units: "minute",
    expiry: null,
    expired: false
  };
}

async function chat(actor, content) {
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content
  });
}

export function spiritVesselPrerequisiteFailures(actor) {
  const failures = [];
  if (Number(actor?.system?.abilities?.wis?.value ?? 0) < 13) failures.push("Мудрость 13");
  if (Number(actor?.system?.abilities?.cha?.value ?? 0) < 13) failures.push("Харизма 13");
  if (Number(actor?.system?.details?.level ?? 0) < 5) failures.push("5-й уровень персонажа");
  return failures;
}

export function validateSpiritVesselPrerequisites(item, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  if (!actor || item.type !== "class" || itemIdentifier(item) !== "spirit-vessel") return true;
  const failures = spiritVesselPrerequisiteFailures(actor);
  if (failures.length) {
    notify(`Нельзя добавить класс «Сосуд Духа». Не выполнено: ${failures.join(", ")}. Получение духа ПО 2+ подтверждает Мастер.`, "error");
    return false;
  }
  return true;
}

export function validateSpiritVesselSubclassPrerequisites(item, options, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  const spirit = automationData(item).spiritVesselSubclass;
  if (!actor || item.type !== "subclass" || !spirit) return true;
  if (!spiritVesselClass(actor) && !options?.isAdvancement) {
    notify(`Подкласс «${item.name}» требует класс «Сосуд Духа».`, "error");
    return false;
  }
  const existing = actor.items?.filter(existingItem =>
    existingItem.id !== item.id
    && existingItem.type === "subclass"
    && (existingItem.system?.classIdentifier === "spirit-vessel" || automationData(existingItem).spiritVesselSubclass)
  ) ?? [];
  if (existing.length && !options?.isAdvancement) {
    notify("Сосуд Духа может иметь только один тип духа.", "error");
    return false;
  }
  return true;
}

export function validateSpiritVesselFeaturePrerequisites(item, options, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  const data = automationData(item);
  if (!actor || data.spiritVesselFeature !== true || options?.isAdvancement) return true;
  const level = spiritVesselLevel(actor);
  if (!level) {
    notify(`Особенность «${item.name}» требует класс «Сосуд Духа».`, "error");
    return false;
  }
  const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
  if (requiredLevel && level < requiredLevel) {
    notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Сосуда Духа.`, "error");
    return false;
  }
  return true;
}

function spiritVesselPassiveDefinitions(actor) {
  const definitions = [];
  const level = clamp(spiritVesselLevel(actor), 0, 5);
  if (!level) return definitions;

  const halvedEgo = findFeature(actor, "halved-ego");
  if (halvedEgo) {
    definitions.push(flaggedPassiveEffectData(MODULE_ID, FLAGS.SPIRIT_VESSEL_PASSIVE, {
      key: "halved-ego",
      feature: halvedEgo,
      name: "Уполовиненное эго: устойчивое присутствие",
      img: halvedEgo.img,
      changes: [change("system.attributes.init.roll.mode", "upgrade", "1", "final")]
    }));
  }

  const spirit = spiritVesselSpirit(actor);
  const feature = spiritFeature(actor);
  if (feature && spirit) {
    const changes = [];
    if (spirit === "aberration" && level >= 3) {
      changes.push(
        change("system.traits.di.value", "custom", "psychic"),
        change("system.traits.ci.value", "custom", "stunned")
      );
    }
    if (spirit === "celestial") {
      changes.push(
        change("system.attributes.senses.ranges.darkvision", "upgrade", "120", "final"),
        change("system.attributes.movement.fly", "upgrade", level >= 3 ? "120" : level >= 2 ? "60" : "30", "final")
      );
      if (level >= 2) changes.push(change("system.traits.di.value", "custom", "radiant"));
      if (level >= 3) {
        changes.push(
          change("system.traits.ci.value", "custom", "charmed"),
          change("system.traits.ci.value", "custom", "frightened")
        );
      }
    }
    if (spirit === "elemental-earth") {
      if (level >= 2) {
        changes.push(
          change("system.attributes.movement.burrow", "upgrade", "30", "final"),
          change("system.attributes.senses.ranges.tremorsense", "upgrade", "15", "final")
        );
      }
      if (level >= 3) {
        changes.push(
          change("system.traits.dr.value", "custom", "bludgeoning"),
          change("system.traits.ci.value", "custom", "petrified")
        );
      }
    }
    if (spirit === "elemental-air") {
      if (level >= 2) changes.push(change("system.attributes.movement.fly", "upgrade", "30", "final"));
      if (level >= 3) {
        changes.push(
          change("system.traits.dr.value", "custom", "piercing"),
          change("system.traits.dr.value", "custom", "cold")
        );
      }
    }
    if (spirit === "elemental-fire") {
      if (level >= 2) changes.push(change("system.attributes.movement.walk", "add", "15", "final"));
      if (level >= 3) {
        changes.push(
          change("system.traits.dr.value", "custom", "fire"),
          change("system.traits.dr.value", "custom", "lightning")
        );
      }
    }
    if (spirit === "elemental-water") {
      if (level >= 1) changes.push(change("system.attributes.movement.swim", "upgrade", level >= 2 ? "60" : "30", "final"));
      if (level >= 3) {
        changes.push(
          change("system.traits.dr.value", "custom", "slashing"),
          change("system.traits.dr.value", "custom", "acid")
        );
      }
    }
    if (spirit === "fey" && level >= 3) {
      changes.push(
        change("system.traits.di.value", "custom", "force"),
        change("system.traits.ci.value", "custom", "poisoned"),
        change("system.traits.ci.value", "custom", "charmed")
      );
    }
    if (spirit === "fiend" && level >= 3) {
      changes.push(change("system.traits.di.value", "custom", "fire"));
    }
    if (spirit === "undead" && level >= 3) {
      changes.push(
        change("system.traits.di.value", "custom", "poison"),
        change("system.traits.ci.value", "custom", "poisoned")
      );
    }
    if (changes.length) {
      definitions.push(flaggedPassiveEffectData(MODULE_ID, FLAGS.SPIRIT_VESSEL_PASSIVE, {
        key: `spirit-${spirit}`,
        feature,
        name: `${feature.name}: пассивные эффекты`,
        img: feature.img,
        changes
      }));
    }
  }

  const incarnation = findFeature(actor, "metaphysical-incarnation");
  const ability = INCARNATION_ABILITY[spirit];
  if (incarnation && level >= 5 && ability) {
    definitions.push(flaggedPassiveEffectData(MODULE_ID, FLAGS.SPIRIT_VESSEL_PASSIVE, {
      key: `metaphysical-incarnation-${spirit}`,
      feature: incarnation,
      name: `Метафизическое воплощение: ${ABILITY_LABELS[ability]} 21`,
      img: incarnation.img,
      changes: [change(`system.abilities.${ability}.value`, "upgrade", "21")]
    }));
  }

  return definitions;
}

export async function syncSpiritVesselPassiveEffects(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  return syncFlaggedPassiveEffects(actor, spiritVesselPassiveSyncs, MODULE_ID, FLAGS.SPIRIT_VESSEL_PASSIVE, spiritVesselPassiveDefinitions);
}

export async function syncSpiritVesselResources(actor, { notifyResult = false } = {}) {
  if (!actor?.isOwner || !isAutomationAuthority(actor) || spiritVesselSyncs.has(actor.uuid)) return false;
  if (!spiritVesselClass(actor)) return false;
  spiritVesselSyncs.add(actor.uuid);
  try {
    const changed = await syncUses(findFeature(actor, "flow-state"), Math.max(1, spiritVesselSpellModifier(actor)));
    if (notifyResult && changed) notify(`${actor.name}: использования Потока Сосуда Духа синхронизированы.`);
    return changed;
  } finally {
    spiritVesselSyncs.delete(actor.uuid);
  }
}

async function chooseOption({ title, label, options }) {
  const htmlOptions = options
    .map(([value, optionLabel]) => `<option value="${value}">${foundry.utils.escapeHTML(optionLabel)}</option>`)
    .join("");
  return foundry.applications.api.DialogV2.wait({
    window: { title },
    position: { width: 420 },
    content: `
      <div class="form-group">
        <label>${label}</label>
        <div class="form-fields">
          <select name="choice">${htmlOptions}</select>
        </div>
      </div>
    `,
    buttons: [
      {
        action: "choose",
        label: "Выбрать",
        icon: "fa-solid fa-check",
        default: true,
        callback: (_event, _button, dialog) => dialog.element.querySelector('select[name="choice"]')?.value
      },
      {
        action: "cancel",
        label: "Отмена",
        icon: "fa-solid fa-xmark",
        callback: () => null
      }
    ]
  });
}

export async function chooseSpiritVesselAbility(actor) {
  if (!actor || !spiritVesselClass(actor)) return false;
  const ability = await chooseOption({
    title: "Магия договора Сосуда Духа",
    label: "Заклинательная характеристика",
    options: [["int", "Интеллект"], ["wis", "Мудрость"], ["cha", "Харизма"]]
  });
  if (!ability) return false;
  await actor.setFlag(MODULE_ID, FLAGS.SPIRIT_VESSEL_ABILITY, ability);
  await spiritVesselClass(actor)?.update({ "system.spellcasting.ability": ability });
  await syncSpiritVesselResources(actor);
  notify(`${actor.name}: заклинательная характеристика Сосуда Духа — ${ABILITY_LABELS[ability]}.`);
  return true;
}

function currentStrikeDamage(actor) {
  const stored = actor?.getFlag?.(MODULE_ID, FLAGS.SPIRIT_VESSEL_STRIKE_DAMAGE);
  if (stored) return stored;
  const spirit = spiritVesselSpirit(actor);
  return STRIKE_DAMAGE_OPTIONS[spirit]?.[0]?.[0] ?? "force";
}

function damageLabel(actor, damageType) {
  const options = STRIKE_DAMAGE_OPTIONS[spiritVesselSpirit(actor)] ?? [];
  return options.find(([value]) => value === damageType)?.[1] ?? damageType;
}

export async function chooseSpiritVesselStrikeDamage(actor) {
  if (!actor || !spiritVesselClass(actor)) return false;
  const spirit = spiritVesselSpirit(actor);
  const options = STRIKE_DAMAGE_OPTIONS[spirit];
  if (!options?.length) {
    notify("Сначала выберите тип духа Сосуда Духа.", "warn");
    return false;
  }
  if (options.length === 1) {
    await actor.setFlag(MODULE_ID, FLAGS.SPIRIT_VESSEL_STRIKE_DAMAGE, options[0][0]);
    notify(`${actor.name}: тип урона Концентрированного удара — ${options[0][1]}.`);
    return true;
  }
  const damageType = await chooseOption({
    title: "Концентрированный удар",
    label: "Тип урона",
    options
  });
  if (!damageType) return false;
  await actor.setFlag(MODULE_ID, FLAGS.SPIRIT_VESSEL_STRIKE_DAMAGE, damageType);
  notify(`${actor.name}: тип урона Концентрированного удара — ${damageLabel(actor, damageType)}.`);
  return true;
}

export async function rollSpiritVesselConcentratedStrike(actor, activity) {
  if (!actor || !findFeature(actor, "concentrated-strike")) return false;
  const slotLevel = clamp(Number(automationData(activity).slotLevel ?? 1), 1, 4);
  const dice = Math.min(5, 1 + slotLevel);
  const damageType = currentStrikeDamage(actor);
  const roll = await new Roll(`${dice}d12`, actor.getRollData(), { flavor: "Концентрированный удар" }).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `Концентрированный удар: ${dice}к12, тип урона — ${damageLabel(actor, damageType)}. Спишите ячейку ${slotLevel}-го круга вручную.`
  });
  return true;
}

export async function showSpiritVesselAbilityImprovement(actor) {
  if (!actor || !findFeature(actor, "spirit-ability-improvement")) return false;
  await chat(actor, `<p><strong>${actor.name}: Улучшение характеристики.</strong> В конце длительного отдыха распределите +2 к одной характеристике или +1 к двум характеристикам. После следующего длительного отдыха эти очки можно перераспределить.</p>`);
  return true;
}

export async function activateSpiritFlow(actor) {
  if (!actor || !findFeature(actor, "flow-state")) return false;
  const feature = findFeature(actor, "flow-state");
  const data = {
    name: "Поток",
    img: feature.img,
    origin: feature.uuid,
    transfer: false,
    disabled: false,
    showIcon: 1,
    statuses: [],
    flags: {
      [MODULE_ID]: {
        [FLAGS.SPIRIT_VESSEL_FLOW_EFFECT]: true
      }
    },
    duration: effectDuration(60),
    system: {
      changes: [
        change("system.abilities.dex.check.roll.mode", "upgrade", "1", "final"),
        change("system.abilities.dex.save.roll.mode", "upgrade", "1", "final")
      ]
    }
  };
  const current = flowEffect(actor);
  if (current) await current.update(data);
  else await actor.createEmbeddedDocuments("ActiveEffect", [data]);
  notify(`${actor.name}: Поток активирован на 1 минуту.`);
  return true;
}

export function applySpiritVesselDamageAutomation(config) {
  if (!enabled()) return;
  const actor = activityActor(config?.subject);
  if (!actor || !flowEffect(actor)) return;
  const bonus = spiritVesselSpellModifier(actor);
  if (bonus <= 0) return;
  appendRollPart(config.rolls?.[0], String(bonus));
}

export async function beginSpiritVesselTurn(actor) {
  if (!enabled() || !actor || !flowEffect(actor)) return;
  const bonus = spiritVesselSpellModifier(actor);
  if (bonus <= 0) return;
  const current = Number(actor.system?.attributes?.hp?.temp ?? 0);
  if (current >= bonus) return;
  await actor.update({ "system.attributes.hp.temp": bonus });
}

async function showSpiritSave(actor, title, saveAbility, extra = "") {
  await chat(actor, `<p><strong>${actor.name}: ${title}.</strong> Цель совершает спасбросок ${saveAbility} против СЛ <strong>${spiritVesselSaveDC(actor)}</strong>. ${extra}</p>`);
}

async function activateFiendFlames(actor) {
  const feature = findFeature(actor, "spirit-fiend");
  if (!actor || !feature) return false;
  const data = {
    name: "Пламя исчадия",
    img: feature.img,
    origin: feature.uuid,
    transfer: false,
    disabled: false,
    showIcon: 1,
    statuses: [],
    flags: {
      [MODULE_ID]: {
        [FLAGS.SPIRIT_VESSEL_FIEND_FLAMES_EFFECT]: true
      }
    },
    duration: effectDuration(60),
    system: { changes: [] }
  };
  const current = fiendFlamesEffect(actor);
  if (current) await current.update(data);
  else await actor.createEmbeddedDocuments("ActiveEffect", [data]);
  const roll = await new Roll("1d6", actor.getRollData(), { flavor: "Пламя исчадия" }).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: "Пламя исчадия: огненный урон существам в 5 футах в начале вашего хода или существу, атакующему вас в ближнем бою"
  });
  return true;
}

export async function handleSpiritVesselAction(actor, activity, action) {
  switch (action) {
    case "choose-spirit-vessel-ability":
      return chooseSpiritVesselAbility(actor);
    case "choose-spirit-vessel-strike-damage":
      return chooseSpiritVesselStrikeDamage(actor);
    case "roll-spirit-vessel-concentrated-strike":
      return rollSpiritVesselConcentratedStrike(actor, activity);
    case "show-spirit-vessel-ability-improvement":
      return showSpiritVesselAbilityImprovement(actor);
    case "activate-spirit-flow":
      return activateSpiritFlow(actor);
    case "spirit-vessel-aberration-charm":
      return showSpiritSave(actor, "Телепатическое очарование", "Мудрости", "Цель должна недавно общаться с вами телепатически; состояние очарования и лимит целей применяются вручную.");
    case "spirit-vessel-fey-charm":
      return showSpiritSave(actor, "Очарование феи", "Харизмы", "Цель должна видеть вас. Очарование, лимиты и 24-часовая невосприимчивость применяются вручную.");
    case "spirit-vessel-fiend-flames":
      return activateFiendFlames(actor);
    case "spirit-vessel-undead-frighten":
      return showSpiritSave(actor, "Ужасающая старость", "Мудрости", "При провале на 5+ цель стареет на 1к4×10 лет. Испуг, повторные спасброски и старение применяются вручную.");
    default:
      return false;
  }
}

export function isSpiritVesselAction(action) {
  return SPIRIT_VESSEL_ACTIONS.has(action);
}

export function validateSpiritVesselActivityUse(actor, activity, action) {
  if (!actor || !spiritVesselClass(actor)) {
    notify("Эта активность требует класс «Сосуд Духа».", "warn");
    return false;
  }
  const level = spiritVesselLevel(actor);
  const item = activityItem(activity);
  if (action === "roll-spirit-vessel-concentrated-strike" && level < 2) {
    notify("Концентрированный удар требует 2-й уровень Сосуда Духа.", "warn");
    return false;
  }
  if (action === "activate-spirit-flow") {
    if (level < 4) {
      notify("Поток требует 4-й уровень Сосуда Духа.", "warn");
      return false;
    }
    const uses = itemUses(item);
    if (uses.remaining <= 0) {
      notify(`${actor.name}: нет доступных использований Потока.`, "warn");
      return false;
    }
  }
  if ([
    "spirit-vessel-aberration-charm",
    "spirit-vessel-fey-charm",
    "spirit-vessel-fiend-flames",
    "spirit-vessel-undead-frighten"
  ].includes(action) && level < 2) {
    notify("Это действие духа требует 2-й уровень Сосуда Духа.", "warn");
    return false;
  }
  if (action === "spirit-vessel-fiend-flames") {
    const uses = itemUses(item);
    if (uses.remaining <= 0) {
      notify(`${actor.name}: Пламя исчадия восстановится после короткого отдыха.`, "warn");
      return false;
    }
  }
  return true;
}
