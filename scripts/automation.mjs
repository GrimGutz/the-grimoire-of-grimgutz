export const MODULE_ID = "the-grimoire-of-grimgutz";

const SETTINGS = {
  AUTOMATION: "automationEnabled",
  STRICT_PREREQUISITES: "strictPrerequisites"
};

const FLAGS = {
  ACTIVE_STYLE: "activeStyle",
  GWM_ENABLED: "greatWeaponMasterEnabled",
  STEEL_WILL_ARMED: "steelWillArmed",
  SMITHING_REDUCED: "smithingReduced",
  SMITHING_ORIGINAL_WEIGHT: "smithingOriginalWeight",
  STEEL_GIANT_EFFECT: "steelGiantEffect",
  LEADER_STRATAGEM_LOCK: "leaderStratagemLock",
  GLIMPSE_ARMED: "glimpseOfGeniusArmed",
  FRONTLINE_EFFECT: "frontlineCommanderEffect",
  MYSTIC_ORIGINAL_PREPARATION: "mysticOriginalPreparation",
  MYSTIC_ORIGINAL_LAY_ON_HANDS: "mysticOriginalLayOnHands",
  OCCULT_ABILITY: "occultAbility",
  FOREST_BASE_CLASS: "forestBaseClass",
  FOREST_ORIGINAL_PREPARATION: "forestOriginalPreparation",
  FOREST_ROOT_EFFECT: "forestRootEffect",
  FOREST_ROOT_FIRE_BLOCK: "forestRootFireBlock",
  FOREST_ROOT_CLEAR_AT_TURN: "forestRootClearAtTurn",
  DEADLY_PRECISION_ARMED: "deadlyPrecisionArmed",
  DARK_GUARD_EFFECT: "darkGuardEffect",
  PASSIVE_SOURCE: "passiveSource",
  CRUSHER_PASSIVE: "crusherPassive",
  LEADER_PASSIVE: "leaderPassive",
  DEATH_KNIGHT_PASSIVE: "deathKnightPassive",
  HERETIC_PASSIVE: "hereticPassive",
  ABERRANT_PASSIVE: "aberrantPassive",
  FOREST_PASSIVE: "forestPassive"
};

const STYLES = {
  CLEAVING: "cleaving",
  CRUSHING: "crushing"
};

const FEATURE_NAMES = {
  [STYLES.CLEAVING]: "Раскалывание",
  [STYLES.CRUSHING]: "Сокрушение"
};

const pendingSteelWillSaves = new Set();
const steelGiantSyncs = new Set();
const mysticalPowerSyncs = new Set();
const natureMagicSyncs = new Set();
const passiveEffectSyncs = new Set();
const crusherPassiveSyncs = new Set();
const leaderPassiveSyncs = new Set();
const deathKnightPassiveSyncs = new Set();
const hereticPassiveSyncs = new Set();
const aberrantPassiveSyncs = new Set();
const forestPassiveSyncs = new Set();
let migrationSourcesPromise;

function enabled() {
  return game.settings.get(MODULE_ID, SETTINGS.AUTOMATION);
}

function automationData(document) {
  return document?.flags?.[MODULE_ID] ?? {};
}

function activityItem(activity) {
  return activity?.item ?? activity?.parent;
}

function activityActor(activity) {
  return activity?.actor ?? activityItem(activity)?.actor;
}

function itemIdentifier(item) {
  return String(item?.system?.identifier ?? "").toLowerCase();
}

function hasFeature(actor, key) {
  return actor?.items?.some(item => {
    const data = automationData(item);
    return data.feature === key || itemIdentifier(item) === key;
  }) ?? false;
}

function findFeature(actor, key) {
  return actor?.items?.find(item => {
    const data = automationData(item);
    return data.feature === key || itemIdentifier(item) === key;
  });
}

function crusherClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "crusher");
}

function crusherLevel(actor) {
  return Number(crusherClass(actor)?.system?.levels ?? 0);
}

function leaderClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "leader");
}

function leaderLevel(actor) {
  return Number(leaderClass(actor)?.system?.levels ?? 0);
}

function paladinClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "paladin");
}

function paladinLevel(actor) {
  return Number(paladinClass(actor)?.system?.levels ?? 0);
}

function deathKnightClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "death-knight");
}

function deathKnightLevel(actor) {
  return Number(deathKnightClass(actor)?.system?.levels ?? 0);
}

function hereticClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "heretic");
}

function hereticLevel(actor) {
  return Number(hereticClass(actor)?.system?.levels ?? 0);
}

function forestLordClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "forest-lord");
}

function forestLordLevel(actor) {
  return Number(forestLordClass(actor)?.system?.levels ?? 0);
}

function druidClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "druid");
}

function rangerClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "ranger");
}

function aberrantClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "aberrant");
}

function aberrantLevel(actor) {
  return Number(aberrantClass(actor)?.system?.levels ?? 0);
}

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

function isMassiveWeapon(item) {
  return item?.type === "weapon" && automationData(item).massiveWeapon === true;
}

function massiveWeapons(actor) {
  return actor?.items?.filter(isMassiveWeapon) ?? [];
}

function weaponDie(item) {
  const base = item?.system?.damage?.base;
  const denomination = Number(base?.denomination);
  const number = Number(base?.number);
  if (!Number.isFinite(denomination) || denomination <= 0) return null;
  return {
    number: Number.isFinite(number) && number > 0 ? number : 1,
    denomination
  };
}

function abilityMod(actor, ability) {
  return Number(actor?.system?.abilities?.[ability]?.mod ?? 0);
}

function strengthValue(actor) {
  return Number(actor?.system?.abilities?.str?.value ?? 0);
}

function canUseMassiveWeapon(actor) {
  return strengthValue(actor) >= 18 && massiveWeapons(actor).length > 0;
}

function canUseStyle(actor, style) {
  if (hasFeature(actor, "adaptability")) return true;
  return hasFeature(actor, style);
}

function activeStyle(actor) {
  const stored = actor?.getFlag(MODULE_ID, FLAGS.ACTIVE_STYLE);
  if (stored && canUseStyle(actor, stored)) return stored;

  const cleaving = hasFeature(actor, STYLES.CLEAVING);
  const crushing = hasFeature(actor, STYLES.CRUSHING);
  if (cleaving && !crushing) return STYLES.CLEAVING;
  if (crushing && !cleaving) return STYLES.CRUSHING;
  return hasFeature(actor, "adaptability") ? STYLES.CLEAVING : null;
}

function gwmEnabled(actor) {
  return hasFeature(actor, "great-weapon-style")
    && actor?.getFlag(MODULE_ID, FLAGS.GWM_ENABLED) === true;
}

function notify(message, type = "info") {
  ui.notifications?.[type]?.(message);
}

export async function setStyle(actor, style) {
  if (!actor || !Object.values(STYLES).includes(style)) return false;
  if (!canUseStyle(actor, style)) {
    notify(`У ${actor.name} нет доступа к стилю «${FEATURE_NAMES[style]}».`, "warn");
    return false;
  }
  await actor.setFlag(MODULE_ID, FLAGS.ACTIVE_STYLE, style);
  notify(`${actor.name}: активный стиль — «${FEATURE_NAMES[style]}».`);
  return true;
}

export async function toggleStyle(actor) {
  const style = activeStyle(actor) === STYLES.CLEAVING ? STYLES.CRUSHING : STYLES.CLEAVING;
  return setStyle(actor, style);
}

export async function toggleGreatWeaponMaster(actor) {
  if (!actor || !hasFeature(actor, "great-weapon-style")) return false;
  const active = !gwmEnabled(actor);
  await actor.setFlag(MODULE_ID, FLAGS.GWM_ENABLED, active);
  notify(`${actor.name}: режим −5 к атаке / +10 к урону ${active ? "включён" : "выключен"}.`);
  return active;
}

export async function armSteelWill(actor) {
  if (!actor || !hasFeature(actor, "steel-will")) return false;
  if (!canUseMassiveWeapon(actor)) {
    notify("Стальная воля требует Силу 18 и массивное оружие в инвентаре.", "warn");
    return false;
  }
  await actor.setFlag(MODULE_ID, FLAGS.STEEL_WILL_ARMED, true);
  notify(`${actor.name}: следующий спасбросок Ловкости будет заменён спасброском Силы.`);
  return true;
}

export async function armGlimpseOfGenius(actor) {
  if (!actor || !hasFeature(actor, "glimpse-of-genius")) return false;
  await actor.setFlag(MODULE_ID, FLAGS.GLIMPSE_ARMED, true);
  notify(`${actor.name}: следующая стратагема использует «Проблеск гения».`);
  return true;
}

export async function chooseOccultAbility(actor) {
  if (!actor || !hereticClass(actor)) return false;
  const current = occultAbility(actor);
  const options = Object.entries(OCCULT_ABILITIES)
    .map(([key, label]) => `<option value="${key}"${key === current ? " selected" : ""}>${label}</option>`)
    .join("");
  const selected = await foundry.applications.api.DialogV2.wait({
    window: { title: "Характеристика оккультизма" },
    position: { width: 420 },
    content: `
      <div class="form-group">
        <label>Характеристика</label>
        <div class="form-fields">
          <select name="ability">${options}</select>
        </div>
      </div>
    `,
    buttons: [
      {
        action: "choose",
        label: "Выбрать",
        icon: "fa-solid fa-wand-magic-sparkles",
        default: true,
        callback: (_event, _button, dialog) => {
          return dialog.element.querySelector('select[name="ability"]')?.value;
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

  const selected = await foundry.applications.api.DialogV2.wait({
    window: { title: "Очки оккультизма" },
    position: { width: 420 },
    content: `
      <div class="form-group">
        <label>Потратить очков</label>
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
        icon: "fa-solid fa-fire-flame-curved",
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
  notify(`${actor.name}: потрачено ${cost} очк. оккультизма, осталось ${before.remaining - cost}.${message ? ` ${message}` : ""}`);
  return true;
}

function forestNatureClasses(actor) {
  return [druidClass(actor), rangerClass(actor)].filter(Boolean);
}

function forestBaseClassIdentifier(actor) {
  const candidates = forestNatureClasses(actor);
  const stored = actor?.getFlag(MODULE_ID, FLAGS.FOREST_BASE_CLASS);
  if (candidates.some(cls => itemIdentifier(cls) === stored)) return stored;
  if (candidates.length === 1) return itemIdentifier(candidates[0]);
  return candidates
    .slice()
    .sort((left, right) => Number(right.system.levels ?? 0) - Number(left.system.levels ?? 0))
    .map(itemIdentifier)
    .at(0) ?? null;
}

export async function chooseForestBaseClass(actor) {
  if (!actor || !forestLordClass(actor)) return false;
  const candidates = forestNatureClasses(actor);
  if (!candidates.length) {
    notify("Для автоматической «Магии природы» требуется класс Друид или Следопыт.", "warn");
    return false;
  }
  const current = forestBaseClassIdentifier(actor);
  const labels = {
    druid: "Друид",
    ranger: "Следопыт"
  };
  const options = candidates
    .map(cls => {
      const identifier = itemIdentifier(cls);
      return `<option value="${identifier}"${identifier === current ? " selected" : ""}>${labels[identifier] ?? cls.name} ${cls.system.levels}</option>`;
    })
    .join("");
  const selected = await foundry.applications.api.DialogV2.wait({
    window: { title: "Базовый природный класс" },
    position: { width: 420 },
    content: `
      <div class="form-group">
        <label>Продолжить прогрессию</label>
        <div class="form-fields">
          <select name="baseClass">${options}</select>
        </div>
      </div>
    `,
    buttons: [
      {
        action: "choose",
        label: "Выбрать",
        icon: "fa-solid fa-leaf",
        default: true,
        callback: (_event, _button, dialog) => {
          return dialog.element.querySelector('select[name="baseClass"]')?.value;
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
  if (!candidates.some(cls => itemIdentifier(cls) === selected)) return false;
  await actor.setFlag(MODULE_ID, FLAGS.FOREST_BASE_CLASS, selected);
  await syncNatureMagic(actor);
  notify(`${actor.name}: «Магия природы» продолжает класс «${labels[selected]}».`);
  return true;
}

export async function rollForestUnarmedDamage(actor) {
  if (!actor || !hasFeature(actor, "oak-strength")) return false;
  const denomination = forestLordLevel(actor) >= 5 ? 8 : 6;
  const roll = await new CONFIG.Dice.DamageRoll(
    `1d${denomination} + @abilities.str.mod`,
    actor.getRollData(),
    {
      type: "bludgeoning",
      flavor: "Сила дуба: безоружный удар"
    }
  ).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: "Сила дуба: безоружный удар"
  });
  return true;
}

function forestRootEffect(actor) {
  return actor?.effects?.find(effect => effect.getFlag(MODULE_ID, FLAGS.FOREST_ROOT_EFFECT));
}

function darkGuardEffect(actor) {
  return actor?.effects?.find(effect => effect.getFlag(MODULE_ID, FLAGS.DARK_GUARD_EFFECT));
}

function hasShieldProficiency(actor) {
  const proficiencies = actor?.system?.traits?.armorProf?.value;
  return typeof proficiencies?.has === "function"
    ? proficiencies.has("shl")
    : Array.from(proficiencies ?? []).includes("shl");
}

function usesShield(actor) {
  return actor?.items?.some(item => (
    item.type === "equipment"
    && item.system?.type?.value === "shield"
    && item.system?.equipped === true
  )) ?? false;
}

async function syncDarkGuard(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  const current = darkGuardEffect(actor);
  const active = hasFeature(actor, "distortion-dark-guard")
    && hasShieldProficiency(actor)
    && !usesShield(actor);
  if (active && !current) {
    await actor.createEmbeddedDocuments("ActiveEffect", [{
      name: "Тёмная стража",
      img: "icons/magic/defensive/shield-barrier-glowing-triangle-purple.webp",
      origin: findFeature(actor, "distortion-dark-guard")?.uuid,
      transfer: false,
      disabled: false,
      showIcon: 1,
      flags: {
        [MODULE_ID]: {
          [FLAGS.DARK_GUARD_EFFECT]: true
        }
      },
      system: {
        changes: [{
          key: "system.attributes.ac.bonus",
          type: "add",
          value: "1",
          phase: "final",
          priority: 20
        }]
      }
    }]);
  } else if (!active && current) {
    await current.delete();
  }
}

function passiveSource(effect) {
  return effect?.getFlag?.(MODULE_ID, FLAGS.PASSIVE_SOURCE)
    ?? effect?.flags?.[MODULE_ID]?.[FLAGS.PASSIVE_SOURCE];
}

function passiveEffectSignature(effect) {
  const data = effect?.toObject ? effect.toObject() : effect;
  return JSON.stringify({
    name: data?.name,
    img: data?.img,
    disabled: data?.disabled,
    showIcon: data?.showIcon,
    system: data?.system
  });
}

async function moduleItemSources() {
  migrationSourcesPromise ??= (async () => {
    const sourceDocuments = [];
    for (const packName of ["classes", "features", "spells", "equipment"]) {
      const pack = game.packs.get(`${MODULE_ID}.${packName}`);
      if (pack) sourceDocuments.push(...await pack.getDocuments());
    }
    return new Map(sourceDocuments.map(item => [itemIdentifier(item), item]));
  })();
  return migrationSourcesPromise;
}

function normalizePassiveChanges(actor, item, changes) {
  const feature = automationData(item).feature ?? itemIdentifier(item);
  return changes.map(change => {
    const normalized = foundry.utils.deepClone(change);
    normalized.key = normalized.key
      .replace("system.attributes.senses.darkvision", "system.attributes.senses.ranges.darkvision")
      .replace("system.attributes.senses.blindsight", "system.attributes.senses.ranges.blindsight");
    if (feature === "forest-barkskin" && normalized.key === "system.attributes.ac.bonus") {
      normalized.value = String(Math.max(1, Number(actor.system?.abilities?.con?.mod ?? 0)));
    }
    return normalized;
  });
}

function actorPassiveEffectData(actor, item, effect) {
  const data = effect.toObject();
  delete data._id;
  data.transfer = false;
  data.origin = item.uuid;
  data.system ??= {};
  data.system.changes = normalizePassiveChanges(actor, item, data.system.changes ?? []);
  data.flags ??= {};
  data.flags[MODULE_ID] = {
    ...(data.flags[MODULE_ID] ?? {}),
    [FLAGS.PASSIVE_SOURCE]: {
      itemId: item.id,
      effectId: effect.id
    }
  };
  return data;
}

async function syncModulePassiveEffects(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor) || passiveEffectSyncs.has(actor.uuid)) return;
  passiveEffectSyncs.add(actor.uuid);
  try {
    const sources = await moduleItemSources();
    const desired = new Map();
    for (const item of actor.items) {
      if (automationData(item).aberrantFeature === true) continue;
      if (automationData(item).forestLordFeature === true) continue;
      if (automationData(item).deathKnightFeature === true) continue;
      if (automationData(item).leaderFeature === true) continue;
      if (automationData(item).hereticFeature === true) continue;
      const source = sources.get(itemIdentifier(item));
      const sourceEffects = source && isLikelyModuleItem(item, source)
        ? [...(source.effects ?? [])]
        : [];
      const effects = sourceEffects.some(effect => effect.getFlag(MODULE_ID, "passiveEffect") === true)
        ? sourceEffects
        : [...(item.effects ?? [])];
      for (const effect of effects) {
        if (effect.getFlag(MODULE_ID, "passiveEffect") !== true) continue;
        const key = `${item.id}:${effect.id}`;
        desired.set(key, actorPassiveEffectData(actor, item, effect));
      }
    }
    const existing = new Map();
    for (const effect of actor.effects ?? []) {
      const source = passiveSource(effect);
      if (!source?.itemId || !source?.effectId) continue;
      existing.set(`${source.itemId}:${source.effectId}`, effect);
    }

    const creates = [];
    const updates = [];
    for (const [key, data] of desired) {
      const current = existing.get(key);
      if (!current) {
        creates.push(data);
        continue;
      }
      if (passiveEffectSignature(current) !== passiveEffectSignature(data)) {
        updates.push({ _id: current.id, ...data });
      }
      existing.delete(key);
    }

    const deletes = [...existing.values()].map(effect => effect.id);
    if (deletes.length) await actor.deleteEmbeddedDocuments("ActiveEffect", deletes);
    if (updates.length) await actor.updateEmbeddedDocuments("ActiveEffect", updates);
    if (creates.length) await actor.createEmbeddedDocuments("ActiveEffect", creates);
  } finally {
    passiveEffectSyncs.delete(actor.uuid);
  }
}

function crusherPassiveSource(effect) {
  return effect?.getFlag?.(MODULE_ID, FLAGS.CRUSHER_PASSIVE)
    ?? effect?.flags?.[MODULE_ID]?.[FLAGS.CRUSHER_PASSIVE];
}

function crusherPassiveEffectData({ key, feature, name = feature?.name, img = feature?.img, changes = [] }) {
  return {
    name,
    img,
    type: "base",
    description: "",
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
        [FLAGS.CRUSHER_PASSIVE]: key
      }
    },
    system: { changes }
  };
}

function crusherPassiveDefinitions(actor) {
  if (!crusherClass(actor)) return [];
  const definitions = [];

  const greatWeaponStyle = findFeature(actor, "great-weapon-style");
  if (greatWeaponStyle) {
    definitions.push(crusherPassiveEffectData({
      key: "great-weapon-style",
      feature: greatWeaponStyle,
      changes: [{
        key: "system.traits.weaponProf.custom",
        type: "custom",
        value: "Массивное оружие",
        phase: "initial",
        priority: 20
      }]
    }));
  }

  return definitions;
}

export async function syncCrusherPassiveEffects(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor) || crusherPassiveSyncs.has(actor.uuid)) return;
  crusherPassiveSyncs.add(actor.uuid);
  try {
    const desired = new Map(
      crusherPassiveDefinitions(actor).map(effect => [crusherPassiveSource(effect), effect])
    );
    const existing = new Map();
    for (const effect of actor.effects ?? []) {
      const source = crusherPassiveSource(effect);
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
    crusherPassiveSyncs.delete(actor.uuid);
  }
}

function leaderPassiveSource(effect) {
  return effect?.getFlag?.(MODULE_ID, FLAGS.LEADER_PASSIVE)
    ?? effect?.flags?.[MODULE_ID]?.[FLAGS.LEADER_PASSIVE];
}

function leaderPassiveEffectData({ key, feature, name = feature?.name, img = feature?.img, changes = [] }) {
  return {
    name,
    img,
    type: "base",
    description: "",
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
        [FLAGS.LEADER_PASSIVE]: key
      }
    },
    system: { changes }
  };
}

function leaderMovementBonusChanges(actor, bonus = 10) {
  const movement = actor.system.attributes?.movement ?? {};
  return ["walk", "burrow", "climb", "fly", "swim"]
    .filter(type => Number(movement[type] ?? 0) > 0)
    .map(type => ({
      key: `system.attributes.movement.${type}`,
      type: "add",
      value: String(bonus),
      phase: "final",
      priority: 20
    }));
}

function leaderPassiveDefinitions(actor) {
  if (!leaderClass(actor)) return [];
  const definitions = [];

  const boisterous = findFeature(actor, "boisterous-presence");
  if (boisterous) {
    const changes = leaderMovementBonusChanges(actor, 10);
    if (changes.length) {
      definitions.push(leaderPassiveEffectData({
        key: "boisterous-presence",
        feature: boisterous,
        changes
      }));
    }
  }

  return definitions;
}

export async function syncLeaderPassiveEffects(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor) || leaderPassiveSyncs.has(actor.uuid)) return;
  leaderPassiveSyncs.add(actor.uuid);
  try {
    const desired = new Map(
      leaderPassiveDefinitions(actor).map(effect => [leaderPassiveSource(effect), effect])
    );
    const existing = new Map();
    for (const effect of actor.effects ?? []) {
      const source = leaderPassiveSource(effect);
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
    leaderPassiveSyncs.delete(actor.uuid);
  }
}

function deathKnightPassiveSource(effect) {
  return effect?.getFlag?.(MODULE_ID, FLAGS.DEATH_KNIGHT_PASSIVE)
    ?? effect?.flags?.[MODULE_ID]?.[FLAGS.DEATH_KNIGHT_PASSIVE];
}

function deathKnightPassiveEffectData({ key, feature, name = feature?.name, img = feature?.img, changes = [] }) {
  return {
    name,
    img,
    type: "base",
    description: "",
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
        [FLAGS.DEATH_KNIGHT_PASSIVE]: key
      }
    },
    system: { changes }
  };
}

function deathKnightPassiveDefinitions(actor) {
  if (!deathKnightClass(actor)) return [];
  const definitions = [];

  const undeadNature = findFeature(actor, "undead-nature");
  if (undeadNature) {
    definitions.push(deathKnightPassiveEffectData({
      key: "undead-nature",
      feature: undeadNature,
      changes: [
        {
          key: "system.details.type.value",
          type: "override",
          value: "undead",
          phase: "initial",
          priority: 100
        },
        {
          key: "system.attributes.senses.ranges.darkvision",
          type: "upgrade",
          value: "120",
          phase: "final",
          priority: 20
        },
        {
          key: "system.traits.di.value",
          type: "custom",
          value: "poison",
          phase: "initial",
          priority: 20
        },
        {
          key: "system.traits.ci.value",
          type: "custom",
          value: "poisoned",
          phase: "initial",
          priority: 20
        },
        {
          key: "system.traits.ci.value",
          type: "custom",
          value: "diseased",
          phase: "initial",
          priority: 20
        }
      ]
    }));
  }

  const magicResistance = findFeature(actor, "death-knight-magic-resistance");
  if (magicResistance) {
    definitions.push(deathKnightPassiveEffectData({
      key: "death-knight-magic-resistance",
      feature: magicResistance,
      changes: [{
        key: "flags.midi-qol.magicResistance.all",
        type: "custom",
        value: "true",
        phase: "initial",
        priority: 20
      }]
    }));
  }

  const strongUndead = findFeature(actor, "strong-undead");
  if (strongUndead) {
    definitions.push(deathKnightPassiveEffectData({
      key: "strong-undead",
      feature: strongUndead,
      changes: [
        {
          key: "system.traits.di.value",
          type: "custom",
          value: "necrotic",
          phase: "initial",
          priority: 20
        },
        {
          key: "system.traits.ci.value",
          type: "custom",
          value: "exhaustion",
          phase: "initial",
          priority: 20
        },
        {
          key: "system.traits.ci.value",
          type: "custom",
          value: "frightened",
          phase: "initial",
          priority: 20
        }
      ]
    }));
  }

  return definitions;
}

export async function syncDeathKnightPassiveEffects(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor) || deathKnightPassiveSyncs.has(actor.uuid)) return;
  deathKnightPassiveSyncs.add(actor.uuid);
  try {
    const desired = new Map(
      deathKnightPassiveDefinitions(actor).map(effect => [deathKnightPassiveSource(effect), effect])
    );
    const existing = new Map();
    for (const effect of actor.effects ?? []) {
      const source = deathKnightPassiveSource(effect);
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
    deathKnightPassiveSyncs.delete(actor.uuid);
  }
}

function hereticPassiveSource(effect) {
  return effect?.getFlag?.(MODULE_ID, FLAGS.HERETIC_PASSIVE)
    ?? effect?.flags?.[MODULE_ID]?.[FLAGS.HERETIC_PASSIVE];
}

function hereticPassiveEffectData({ key, feature, name = feature?.name, img = feature?.img, changes = [] }) {
  return {
    name,
    img,
    type: "base",
    description: "",
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
        [FLAGS.HERETIC_PASSIVE]: key
      }
    },
    system: { changes }
  };
}

const HERETIC_PASSIVE_CHANGES = {
  "mark-cursed-flesh": [
    {
      key: "system.traits.ci.value",
      type: "custom",
      value: "diseased",
      phase: "initial",
      priority: 20
    }
  ],
  "mark-sharp-darkvision": [
    {
      key: "system.attributes.senses.ranges.darkvision",
      type: "add",
      value: "120",
      phase: "final",
      priority: 20
    }
  ],
  "mark-undead": [
    {
      key: "system.details.type.value",
      type: "override",
      value: "undead",
      phase: "initial",
      priority: 100
    }
  ],
  "distortion-beyond-sight": [
    {
      key: "system.attributes.senses.ranges.darkvision",
      type: "upgrade",
      value: "120",
      phase: "final",
      priority: 20
    },
    {
      key: "system.attributes.senses.ranges.blindsight",
      type: "upgrade",
      value: "30",
      phase: "final",
      priority: 20
    }
  ],
  "distortion-forbidden-flesh": [
    {
      key: "system.traits.dr.value",
      type: "custom",
      value: "necrotic",
      phase: "initial",
      priority: 20
    },
    {
      key: "system.traits.dv.value",
      type: "custom",
      value: "radiant",
      phase: "initial",
      priority: 50
    }
  ],
  "distortion-ghost-flight": [
    {
      key: "system.attributes.movement.fly",
      type: "upgrade",
      value: "40",
      phase: "final",
      priority: 20
    }
  ],
  "distortion-ghoulish-might": [
    {
      key: "system.attributes.hp.bonuses.level",
      type: "add",
      value: "2",
      phase: "initial",
      priority: 20
    },
    {
      key: "system.abilities.str.check.roll.mode",
      type: "upgrade",
      value: "1",
      phase: "final",
      priority: 20
    },
    {
      key: "system.abilities.str.save.roll.mode",
      type: "upgrade",
      value: "1",
      phase: "final",
      priority: 20
    }
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
    definitions.push(hereticPassiveEffectData({ key, feature: item, changes }));
  }
  return definitions;
}

export async function syncHereticPassiveEffects(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor) || hereticPassiveSyncs.has(actor.uuid)) return;
  hereticPassiveSyncs.add(actor.uuid);
  try {
    const desired = new Map(
      hereticPassiveDefinitions(actor).map(effect => [hereticPassiveSource(effect), effect])
    );
    const existing = new Map();
    for (const effect of actor.effects ?? []) {
      const source = hereticPassiveSource(effect);
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
    hereticPassiveSyncs.delete(actor.uuid);
  }
}

function aberrantPassiveSource(effect) {
  return effect?.getFlag?.(MODULE_ID, FLAGS.ABERRANT_PASSIVE)
    ?? effect?.flags?.[MODULE_ID]?.[FLAGS.ABERRANT_PASSIVE];
}

function aberrantPassiveEffectData({ key, feature, name, img, changes }) {
  return {
    name,
    img,
    type: "base",
    description: "",
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
        [FLAGS.ABERRANT_PASSIVE]: key
      }
    },
    system: { changes }
  };
}

function aberrantPassiveDefinitions(actor) {
  const definitions = [];
  const level = clamp(aberrantLevel(actor), 0, 5);
  const reflexes = findFeature(actor, "monster-reflexes");
  if (reflexes && level > 0) {
    const bonus = [0, 5, 10, 10, 15, 15][level];
    definitions.push(aberrantPassiveEffectData({
      key: "monster-reflexes",
      feature: reflexes,
      name: "Рефлексы чудовища",
      img: reflexes.img,
      changes: [{
        key: "system.attributes.movement.walk",
        type: "add",
        value: String(bonus),
        phase: "final",
        priority: 20
      }]
    }));
  }

  const toxicBlood = findFeature(actor, "toxic-blood");
  if (toxicBlood) {
    definitions.push(aberrantPassiveEffectData({
      key: "toxic-blood",
      feature: toxicBlood,
      name: "Токсичная кровь",
      img: toxicBlood.img,
      changes: [
        {
          key: "system.traits.dr.value",
          type: "custom",
          value: "poison",
          phase: "initial",
          priority: 20
        },
        {
          key: "system.traits.ci.value",
          type: "custom",
          value: "poisoned",
          phase: "initial",
          priority: 20
        }
      ]
    }));
  }

  const burnedVeins = findFeature(actor, "aberrant-burned-veins");
  if (burnedVeins) {
    definitions.push(aberrantPassiveEffectData({
      key: "aberrant-burned-veins",
      feature: burnedVeins,
      name: "Сгоревшие вены",
      img: burnedVeins.img,
      changes: [{
        key: "system.traits.dr.value",
        type: "custom",
        value: "acid",
        phase: "initial",
        priority: 20
      }]
    }));
  }

  const catEyes = findFeature(actor, "aberrant-cat-eyes");
  if (catEyes) {
    definitions.push(aberrantPassiveEffectData({
      key: "aberrant-cat-eyes",
      feature: catEyes,
      name: "Кошачьи глаза",
      img: catEyes.img,
      changes: [{
        key: "system.attributes.senses.ranges.darkvision",
        type: "add",
        value: "30",
        phase: "final",
        priority: 20
      }]
    }));
  }

  const albino = findFeature(actor, "aberrant-albino");
  if (albino) {
    definitions.push(aberrantPassiveEffectData({
      key: "aberrant-albino",
      feature: albino,
      name: "Альбинос",
      img: albino.img,
      changes: [{
        key: "system.skills.itm.roll.mode",
        type: "upgrade",
        value: "1",
        phase: "final",
        priority: 20
      }]
    }));
  }

  const finalStrength = findFeature(actor, "final-changes-strength");
  const finalDexterity = findFeature(actor, "final-changes-dexterity");
  const finalChange = finalStrength ?? finalDexterity;
  if (finalChange) {
    const ability = finalStrength ? "str" : "dex";
    definitions.push(aberrantPassiveEffectData({
      key: finalStrength ? "final-changes-strength" : "final-changes-dexterity",
      feature: finalChange,
      name: finalChange.name,
      img: finalChange.img,
      changes: [
        {
          key: `system.abilities.${ability}.value`,
          type: "add",
          value: "2",
          phase: "initial",
          priority: 20
        },
        {
          key: "system.attributes.senses.ranges.blindsight",
          type: "upgrade",
          value: "30",
          phase: "final",
          priority: 20
        }
      ]
    }));
  }

  return definitions;
}

export async function syncAberrantPassiveEffects(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor) || aberrantPassiveSyncs.has(actor.uuid)) return;
  aberrantPassiveSyncs.add(actor.uuid);
  try {
    const desired = new Map(
      aberrantPassiveDefinitions(actor).map(effect => [aberrantPassiveSource(effect), effect])
    );
    const existing = new Map();
    for (const effect of actor.effects ?? []) {
      const source = aberrantPassiveSource(effect);
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
    aberrantPassiveSyncs.delete(actor.uuid);
  }
}

function forestPassiveSource(effect) {
  return effect?.getFlag?.(MODULE_ID, FLAGS.FOREST_PASSIVE)
    ?? effect?.flags?.[MODULE_ID]?.[FLAGS.FOREST_PASSIVE];
}

function forestPassiveEffectData({ key, feature, name, img, changes }) {
  return {
    name,
    img,
    type: "base",
    description: "",
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
        [FLAGS.FOREST_PASSIVE]: key
      }
    },
    system: { changes }
  };
}

function forestPassiveDefinitions(actor) {
  const definitions = [];

  const barkskin = findFeature(actor, "forest-barkskin");
  if (barkskin) {
    definitions.push(forestPassiveEffectData({
      key: "forest-barkskin",
      feature: barkskin,
      name: "Коракожа",
      img: barkskin.img,
      changes: [{
        key: "system.attributes.ac.bonus",
        type: "add",
        value: Math.max(1, abilityMod(actor, "con")),
        phase: "initial",
        priority: 20
      }]
    }));
  }

  const oakHeart = findFeature(actor, "oak-heart");
  if (oakHeart) {
    definitions.push(forestPassiveEffectData({
      key: "oak-heart",
      feature: oakHeart,
      name: "Сердце дуба",
      img: oakHeart.img,
      changes: [
        {
          key: "system.details.type.value",
          type: "override",
          value: "plant",
          phase: "initial",
          priority: 100
        },
        ...["piercing", "bludgeoning", "radiant", "poison"].map(value => ({
          key: "system.traits.dr.value",
          type: "custom",
          value,
          phase: "initial",
          priority: 20
        })),
        ...["fire", "slashing"].map(value => ({
          key: "system.traits.dv.value",
          type: "custom",
          value,
          phase: "initial",
          priority: 50
        }))
      ]
    }));
  }

  const forestMight = findFeature(actor, "forest-might");
  if (forestMight) {
    definitions.push(forestPassiveEffectData({
      key: "forest-might",
      feature: forestMight,
      name: "Лесная мощь",
      img: forestMight.img,
      changes: [{
        key: "system.attributes.exhaustion",
        type: "add",
        value: -2,
        phase: "initial",
        priority: 20
      }]
    }));
  }

  return definitions;
}

export async function syncForestPassiveEffects(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor) || forestPassiveSyncs.has(actor.uuid)) return;
  forestPassiveSyncs.add(actor.uuid);
  try {
    const desired = new Map(
      forestPassiveDefinitions(actor).map(effect => [forestPassiveSource(effect), effect])
    );
    const existing = new Map();
    for (const effect of actor.effects ?? []) {
      const source = forestPassiveSource(effect);
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
    forestPassiveSyncs.delete(actor.uuid);
  }
}

export async function takeRoot(actor) {
  if (!actor || !hasFeature(actor, "take-root")) return false;
  if (forestRootEffect(actor)) {
    notify(`${actor.name} уже укоренён.`, "warn");
    return false;
  }
  await actor.createEmbeddedDocuments("ActiveEffect", [{
    name: "Пустить корни",
    img: "icons/magic/nature/root-vines-face-glow-green.webp",
    origin: findFeature(actor, "take-root")?.uuid,
    transfer: false,
    disabled: false,
    showIcon: 1,
    flags: {
      [MODULE_ID]: {
        [FLAGS.FOREST_ROOT_EFFECT]: true
      }
    },
    system: {
      changes: [
        { key: "system.abilities.dex.value", type: "override", value: "1", phase: "initial", priority: 100 },
        { key: "system.attributes.movement.walk", type: "override", value: "0", phase: "final", priority: 100 },
        { key: "system.attributes.movement.burrow", type: "override", value: "0", phase: "final", priority: 100 },
        { key: "system.attributes.movement.climb", type: "override", value: "0", phase: "final", priority: 100 },
        { key: "system.attributes.movement.fly", type: "override", value: "0", phase: "final", priority: 100 },
        { key: "system.attributes.movement.swim", type: "override", value: "0", phase: "final", priority: 100 }
      ]
    }
  }]);
  notify(`${actor.name} пустил корни: скорость 0, эффективная Ловкость 1.`);
  return true;
}

export async function withdrawRoots(actor) {
  const effect = forestRootEffect(actor);
  if (!effect) {
    notify(`${actor?.name ?? "Персонаж"} не укоренён.`, "warn");
    return false;
  }
  await effect.delete();
  await actor.unsetFlag(MODULE_ID, FLAGS.FOREST_ROOT_FIRE_BLOCK);
  await actor.unsetFlag(MODULE_ID, FLAGS.FOREST_ROOT_CLEAR_AT_TURN);
  notify(`${actor.name} втянул корни.`);
  return true;
}

export async function armDeadlyPrecision(actor) {
  if (!actor || !hasFeature(actor, "deadly-precision")) return false;
  await actor.setFlag(MODULE_ID, FLAGS.DEADLY_PRECISION_ARMED, true);
  notify(`${actor.name}: Смертельная точность подготовлена для следующей подходящей атаки.`);
  return true;
}

export async function useVigorousNature(actor) {
  if (!actor || !hasFeature(actor, "vigorous-nature")) return false;
  const denomination = aberrantLevel(actor) >= 5 ? 12 : aberrantLevel(actor) >= 4 ? 10 : 8;
  const roll = await new Roll(
    `1d${denomination} + @abilities.con.mod`,
    actor.getRollData(),
    { flavor: "Энергичная природа" }
  ).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: "Энергичная природа: временные хиты"
  });
  const current = Number(actor.system.attributes?.hp?.temp ?? 0);
  await actor.update({ "system.attributes.hp.temp": Math.max(current, Number(roll.total ?? 0)) });
  return true;
}

async function clearSteelWill(actor) {
  if (actor?.getFlag(MODULE_ID, FLAGS.STEEL_WILL_ARMED)) {
    await actor.unsetFlag(MODULE_ID, FLAGS.STEEL_WILL_ARMED);
  }
}

function actionFromActivity(activity) {
  return automationData(activity).action;
}

async function handleActivityAction(activity) {
  if (!enabled()) return;
  const actor = activityActor(activity);
  const action = actionFromActivity(activity);
  if (!actor || !action) return;

  switch (action) {
    case "toggle-gwm":
      await toggleGreatWeaponMaster(actor);
      break;
    case "set-style-cleaving":
      await setStyle(actor, STYLES.CLEAVING);
      break;
    case "set-style-crushing":
      await setStyle(actor, STYLES.CRUSHING);
      break;
    case "toggle-style":
      await toggleStyle(actor);
      break;
    case "arm-steel-will":
      await armSteelWill(actor);
      break;
    case "sync-steel-giant":
      await syncSteelGiant(actor, { notifyResult: true });
      break;
    case "smithing":
      await applySmithing(actor);
      break;
    case "arm-glimpse-of-genius":
      await armGlimpseOfGenius(actor);
      break;
    case "choose-occult-ability":
      await chooseOccultAbility(actor);
      break;
    case "use-occult-points":
      await useOccultPoints(actor, activity);
      break;
    case "choose-forest-base-class":
      await chooseForestBaseClass(actor);
      break;
    case "forest-unarmed-damage":
      await rollForestUnarmedDamage(actor);
      break;
    case "take-root":
      await takeRoot(actor);
      break;
    case "withdraw-roots":
      await withdrawRoots(actor);
      break;
    case "arm-deadly-precision":
      await armDeadlyPrecision(actor);
      break;
    case "vigorous-nature":
      await useVigorousNature(actor);
      break;
  }
}

function validateActivityUse(activity) {
  if (!enabled()) return true;
  const actor = activityActor(activity);
  const action = actionFromActivity(activity);
  if (action === "choose-forest-base-class") {
    if (actor && forestLordClass(actor) && forestNatureClasses(actor).length) return true;
    notify("«Магия природы» требует Лесного владыку и базовый класс Друид или Следопыт.", "warn");
    return false;
  }
  if (action === "take-root" && forestRootEffect(actor)) {
    notify(`${actor.name} уже укоренён.`, "warn");
    return false;
  }
  if (action === "withdraw-roots" && !forestRootEffect(actor)) {
    notify(`${actor?.name ?? "Персонаж"} не укоренён.`, "warn");
    return false;
  }
  if (action === "arm-deadly-precision" && actor?.getFlag(MODULE_ID, FLAGS.DEADLY_PRECISION_ARMED)) {
    notify(`${actor.name}: Смертельная точность уже подготовлена.`, "warn");
    return false;
  }
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
  if (action === "arm-steel-will") {
    if (actor && hasFeature(actor, "steel-will") && canUseMassiveWeapon(actor)) return true;
    notify("Стальная воля требует Силу 18 и массивное оружие в инвентаре.", "warn");
    return false;
  }
  if (action === "arm-glimpse-of-genius") {
    if (!actor?.getFlag(MODULE_ID, FLAGS.GLIMPSE_ARMED)) return true;
    notify(`${actor.name}: «Проблеск гения» уже подготовлен.`, "warn");
    return false;
  }

  const item = activityItem(activity);
  if (automationData(item).stratagem !== true || !game.combat?.started) return true;
  if (!actor?.getFlag(MODULE_ID, FLAGS.LEADER_STRATAGEM_LOCK)) return true;
  if (actor.getFlag(MODULE_ID, FLAGS.GLIMPSE_ARMED)) return true;
  notify(`${actor.name}: новую стратагему можно использовать в начале следующего хода или через «Проблеск гения».`, "warn");
  return false;
}

function frontlineCommanderEffect(actor) {
  return actor?.effects?.find(effect => effect.getFlag(MODULE_ID, FLAGS.FRONTLINE_EFFECT));
}

async function applyFrontlineCommander(actor) {
  if (!hasFeature(actor, "frontline-commander") || !actor.isOwner) return;
  const movement = actor.system.attributes?.movement ?? {};
  const changes = ["walk", "burrow", "climb", "fly", "swim"]
    .filter(type => Number(movement[type] ?? 0) > 0)
    .map(type => ({
      key: `system.attributes.movement.${type}`,
      type: "add",
      value: 10,
      phase: "final",
      priority: 20
    }));
  if (!changes.length) return;

  const current = frontlineCommanderEffect(actor);
  const usedDuringOwnTurn = game.combat?.combatant?.actor?.uuid === actor.uuid;
  if (current) {
    await current.update({
      "system.changes": changes,
      [`flags.${MODULE_ID}.${FLAGS.FRONTLINE_EFFECT}.skipCurrentTurnEnd`]: usedDuringOwnTurn
    });
    return;
  }

  await actor.createEmbeddedDocuments("ActiveEffect", [{
    name: "Командир на передовой",
    img: "icons/skills/movement/arrow-upward-yellow.webp",
    origin: findFeature(actor, "frontline-commander")?.uuid,
    transfer: false,
    disabled: false,
    showIcon: 1,
    flags: {
      [MODULE_ID]: {
        [FLAGS.FRONTLINE_EFFECT]: {
          skipCurrentTurnEnd: usedDuringOwnTurn
        }
      }
    },
    system: {
      changes,
      duration: {
        rounds: 1
      }
    }
  }]);
}

async function handleStratagemUse(activity) {
  if (!enabled()) return;
  const item = activityItem(activity);
  const actor = activityActor(activity);
  if (!actor || automationData(item).stratagem !== true) return;

  if (actor.getFlag(MODULE_ID, FLAGS.GLIMPSE_ARMED)) {
    await actor.unsetFlag(MODULE_ID, FLAGS.GLIMPSE_ARMED);
    notify(`${actor.name}: стратагема применена через «Проблеск гения».`);
  } else if (game.combat?.started) {
    await actor.setFlag(MODULE_ID, FLAGS.LEADER_STRATAGEM_LOCK, {
      combat: game.combat.id,
      round: game.combat.round,
      turn: game.combat.turn
    });
  }

  await applyFrontlineCommander(actor);
}

async function beginLeaderTurn(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  if (actor.getFlag(MODULE_ID, FLAGS.LEADER_STRATAGEM_LOCK)) {
    await actor.unsetFlag(MODULE_ID, FLAGS.LEADER_STRATAGEM_LOCK);
  }
}

async function endLeaderTurn(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  if (actor.getFlag(MODULE_ID, FLAGS.GLIMPSE_ARMED)) {
    await actor.unsetFlag(MODULE_ID, FLAGS.GLIMPSE_ARMED);
  }
  const effect = frontlineCommanderEffect(actor);
  if (!effect) return;
  const state = effect.getFlag(MODULE_ID, FLAGS.FRONTLINE_EFFECT);
  if (state?.skipCurrentTurnEnd) {
    await effect.update({
      [`flags.${MODULE_ID}.${FLAGS.FRONTLINE_EFFECT}.skipCurrentTurnEnd`]: false
    });
  } else {
    await effect.delete();
  }
}

async function clearLeaderCombatState(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  if (actor.getFlag(MODULE_ID, FLAGS.LEADER_STRATAGEM_LOCK)) {
    await actor.unsetFlag(MODULE_ID, FLAGS.LEADER_STRATAGEM_LOCK);
  }
  if (actor.getFlag(MODULE_ID, FLAGS.GLIMPSE_ARMED)) {
    await actor.unsetFlag(MODULE_ID, FLAGS.GLIMPSE_ARMED);
  }
  const effect = frontlineCommanderEffect(actor);
  if (effect) await effect.delete();
}

async function beginForestTurn(actor, combat) {
  if (!actor?.isOwner || !isAutomationAuthority(actor) || !forestRootEffect(actor)) return;
  if (actor.getFlag(MODULE_ID, FLAGS.FOREST_ROOT_FIRE_BLOCK)) {
    await actor.setFlag(MODULE_ID, FLAGS.FOREST_ROOT_CLEAR_AT_TURN, {
      combat: combat.id,
      round: combat.round,
      turn: combat.turn
    });
    notify(`${actor.name}: лечение от корней подавлено огнём.`);
    return;
  }

  const hp = actor.system.attributes?.hp;
  const current = Number(hp?.value ?? 0);
  const maximum = Number(hp?.max ?? current);
  const healed = Math.min(5, Math.max(0, maximum - current));
  if (!healed) return;
  await actor.update({ "system.attributes.hp.value": current + healed });
  notify(`${actor.name}: корни восстанавливают ${healed} хитов.`);
}

async function endForestTurn(actor, combat) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  const marker = actor.getFlag(MODULE_ID, FLAGS.FOREST_ROOT_CLEAR_AT_TURN);
  if (!marker) return;
  const previous = combat.previous ?? {};
  if (
    marker.combat !== combat.id
    || Number(marker.round) !== Number(previous.round)
    || Number(marker.turn) !== Number(previous.turn)
  ) return;
  await actor.unsetFlag(MODULE_ID, FLAGS.FOREST_ROOT_FIRE_BLOCK);
  await actor.unsetFlag(MODULE_ID, FLAGS.FOREST_ROOT_CLEAR_AT_TURN);
}

async function clearForestCombatState(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  if (actor.getFlag(MODULE_ID, FLAGS.FOREST_ROOT_FIRE_BLOCK)) {
    await actor.unsetFlag(MODULE_ID, FLAGS.FOREST_ROOT_FIRE_BLOCK);
  }
  if (actor.getFlag(MODULE_ID, FLAGS.FOREST_ROOT_CLEAR_AT_TURN)) {
    await actor.unsetFlag(MODULE_ID, FLAGS.FOREST_ROOT_CLEAR_AT_TURN);
  }
}

function attackContext(config) {
  const activity = config?.subject;
  const item = activityItem(activity);
  const actor = activityActor(activity);
  if (!item || !actor || !isMassiveWeapon(item)) return null;
  return { activity, actor, item };
}

function appendRollPart(roll, part) {
  if (!roll || !part) return;
  roll.parts ??= [];
  roll.parts.push(String(part));
}

function applyNativeAttackAutomation(config) {
  if (!enabled()) return;
  const activity = config?.subject;
  const actor = activityActor(activity);
  const attackItem = activityItem(activity);
  const roll = config.rolls?.[0];
  const properties = attackItem?.system?.properties;
  const heavy = typeof properties?.has === "function"
    ? properties.has("hvy")
    : Array.from(properties ?? []).includes("hvy");
  if (
    actor?.getFlag(MODULE_ID, FLAGS.DEADLY_PRECISION_ARMED)
    && attackItem?.type === "weapon"
    && Number(attackItem.system?.proficient ?? 0) > 0
    && !heavy
    && roll
  ) {
    const denomination = [4, 6, 8, 10, 12][clamp(aberrantLevel(actor), 1, 5) - 1];
    appendRollPart(roll, `1d${denomination}`);
    void actor.unsetFlag(MODULE_ID, FLAGS.DEADLY_PRECISION_ARMED);
  }

  const context = attackContext(config);
  if (!context) return;
  const { actor: crusherActor, item } = context;
  if (!roll) return;

  if (strengthValue(crusherActor) < 18) {
    roll.options ??= {};
    roll.options.disadvantage = true;
  }

  if (automationData(item).closeRangeDisadvantage && targetWithinFiveFeet(crusherActor)) {
    roll.options ??= {};
    roll.options.disadvantage = true;
  }

  if (gwmEnabled(crusherActor)) appendRollPart(roll, "-5");
}

function targetWithinFiveFeet(actor) {
  if (!globalThis.MidiQOL?.computeDistance) return false;
  const source = actor.getActiveTokens?.(true, true)?.[0];
  if (!source) return false;
  return Array.from(game.user?.targets ?? []).some(target => {
    const distance = globalThis.MidiQOL.computeDistance(source, target, { wallsBlock: false });
    return Number.isFinite(distance) && distance <= 5;
  });
}

function applyMidiAttackDisadvantage(workflow) {
  if (!enabled() || !workflow?.actor || !isMassiveWeapon(workflow.item)) return;
  const tracker = workflow.attackRollModifierTracker?.disadvantage;
  if (!tracker) return;

  if (strengthValue(workflow.actor) < 18) {
    tracker.add(`${MODULE_ID}.massive-strength`, "Массивное оружие: требуется Сила 18");
  }

  if (!automationData(workflow.item).closeRangeDisadvantage) return;
  const closeTarget = Array.from(workflow.targets ?? []).some(target => {
    const distance = globalThis.MidiQOL?.computeDistance?.(workflow.token, target, { wallsBlock: false });
    return Number.isFinite(distance) && distance <= 5;
  });
  if (closeTarget) tracker.add(`${MODULE_ID}.odachi-close`, "Одачи: цель в пределах 5 футов");
}

function replaceFirstWeaponDice(formula, denomination, modifier) {
  const pattern = new RegExp(`(\\d+)d${denomination}(?!\\d)(?![a-z])`, "i");
  return String(formula).replace(pattern, `$1d${denomination}${modifier}`);
}

function applyDamageAutomation(config) {
  if (!enabled()) return;
  const context = attackContext(config);
  if (!context) return;
  const { actor, item } = context;
  const roll = config.rolls?.[0];
  const die = weaponDie(item);
  if (!roll || !die) return;

  const style = activeStyle(actor);
  const level = crusherLevel(actor);

  if (style === STYLES.CRUSHING && canUseStyle(actor, STYLES.CRUSHING)) {
    const modifier = level >= 5 ? "x" : "xo";
    const index = roll.parts?.findIndex(part => new RegExp(`\\d+d${die.denomination}`, "i").test(String(part))) ?? -1;
    if (index >= 0) {
      roll.parts[index] = replaceFirstWeaponDice(roll.parts[index], die.denomination, modifier);
    }
  }

  if (gwmEnabled(actor)) {
    appendRollPart(roll, "10");
    if (style === STYLES.CLEAVING && canUseStyle(actor, STYLES.CLEAVING)) {
      appendRollPart(roll, `${level >= 5 ? 2 : 1}d${die.denomination}`);
    }
  }

  if (hasFeature(actor, "momentum")) {
    const bonus = Math.ceil(abilityMod(actor, "str") / 2);
    if (bonus) appendRollPart(roll, bonus);
  }

  if (hasFeature(actor, "superior-control")) {
    const bonus = abilityMod(actor, "con");
    if (bonus) appendRollPart(roll, bonus);
  }

  if (
    style === STYLES.CRUSHING
    && hasFeature(actor, "powerful-crushing")
    && canUseStyle(actor, STYLES.CRUSHING)
  ) {
    roll.options ??= {};
    roll.options.critical ??= {};
    roll.options.critical.bonusDamage = [
      roll.options.critical.bonusDamage,
      `1d${die.denomination}`
    ].filter(Boolean).join(" + ");
  }
}

async function applyPowerfulCleaving(workflow) {
  if (!enabled() || workflow?._grimgutzPowerfulCleaving) return;
  if (!workflow?.isCritical || !workflow.actor || !isMassiveWeapon(workflow.item)) return;
  if (activeStyle(workflow.actor) !== STYLES.CLEAVING || !hasFeature(workflow.actor, "powerful-cleaving")) return;
  if ((workflow.targets?.size ?? 0) > 0 && (workflow.hitTargets?.size ?? 0) === 0 && (workflow.hitTargetsEC?.size ?? 0) === 0) return;

  workflow._grimgutzPowerfulCleaving = true;
  const improvements = new Map();
  const rolls = [
    ...(workflow.damageRolls ?? []),
    ...(workflow.bonusDamageRolls ?? [])
  ];
  for (const damageRoll of rolls) {
    let improvement = 0;
    for (const die of damageRoll.dice ?? []) {
      for (const result of die.results ?? []) {
        if (result.active === false || !Number.isFinite(Number(result.result))) continue;
        const reroll = await new Roll(`1d${die.faces}`).evaluate();
        improvement += Math.max(0, Number(reroll.total) - Number(result.result));
      }
    }
    if (improvement <= 0) continue;
    const type = damageRoll.options?.type
      ?? workflow.defaultDamageType
      ?? workflow.rawDamageDetail?.find(
        detail => !["midi-none", "temphp", "healing"].includes(detail.type)
      )?.type;
    const properties = Array.from(damageRoll.options?.properties ?? []);
    const key = `${type ?? ""}:${properties.slice().sort().join(",")}`;
    const current = improvements.get(key) ?? { value: 0, type, properties };
    current.value += improvement;
    improvements.set(key, current);
  }
  if (!improvements.size) return;

  const bonusRolls = [];
  for (const { value, type, properties } of improvements.values()) {
    bonusRolls.push(await new CONFIG.Dice.DamageRoll(
      String(value),
      workflow.actor.getRollData(),
      {
        type,
        properties,
        flavor: "Мощное раскалывание"
      }
    ).evaluate());
  }
  await workflow.setBonusDamageRolls([...(workflow.bonusDamageRolls ?? []), ...bonusRolls]);
}

function sizeNumber(actor) {
  const size = actor?.system?.traits?.size;
  const configured = CONFIG.DND5E.actorSizes?.[size]?.numerical;
  if (Number.isFinite(configured)) return configured;
  return { tiny: 0, sm: 1, med: 2, lg: 3, huge: 4, grg: 5 }[size] ?? 2;
}

function clamp(number, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, number));
}

function recalculateDamageItem(token, damageItem, rawDamage) {
  const actor = token.actor;
  const selector = damageItem.damageSelector ?? "combinedDamage";
  const options = damageItem.damageDetails?.calcDamageOptions?.[selector]
    ?? damageItem.calcDamageOptions
    ?? { invertHealing: true, multiplier: 1 };
  const calculated = foundry.utils.deepClone(actor.calculateDamage(rawDamage, options));

  damageItem.rawDamageDetail = rawDamage;
  damageItem.damageDetail = calculated;
  damageItem.damageDetails ??= { calcDamageOptions: {} };
  damageItem.damageDetails[`raw${selector}`] = rawDamage;
  damageItem.damageDetails[selector] = calculated;

  let damage = 0;
  let healing = 0;
  let temporary = 0;
  for (const detail of calculated) {
    if (detail.type === "temphp") temporary += Number(detail.value ?? 0);
    else if (detail.type === "healing") healing += Number(detail.value ?? 0);
    else if (!["midi-none", "vitality", "maximum"].includes(detail.type)) damage += Number(detail.value ?? 0);
  }

  damage = Math.max(0, damage);
  const adjusted = damage + healing;
  const rounded = adjusted < 0 ? Math.ceil(adjusted) : Math.floor(adjusted);
  const hp = actor.system.attributes.hp;
  const oldHP = Number(hp.value ?? 0);
  const oldTempHP = Number(hp.temp ?? 0);
  const absorbed = rounded > 0 ? Math.min(oldTempHP, rounded) : 0;
  const hpDamage = clamp(rounded - absorbed, -(Number(hp.damage ?? 0)), oldHP);

  damageItem.oldHP = oldHP;
  damageItem.newHP = oldHP - hpDamage;
  damageItem.oldTempHP = oldTempHP;
  damageItem.newTempHP = Math.floor(Math.max(0, oldTempHP - absorbed, temporary));
  damageItem.hpDamage = hpDamage;
  damageItem.tempDamage = oldTempHP - damageItem.newTempHP;
  damageItem.totalDamage = damage;
  damageItem.healingAdjustedTotalDamage = rounded;
}

async function applyGiantKiller(token, { workflow, damageItem }) {
  if (!enabled() || !workflow?.actor || !token?.actor || !isMassiveWeapon(workflow.item)) return;
  if (!hasFeature(workflow.actor, "giant-killer")) return;
  if (damageItem.damageSelector && damageItem.damageSelector !== "combinedDamage") return;

  const targetKey = token.document?.uuid ?? token.id;
  workflow._grimgutzGiantKillerTargets ??= new Set();
  if (workflow._grimgutzGiantKillerTargets.has(targetKey)) return;

  const difference = sizeNumber(token.actor) - sizeNumber(workflow.actor);
  if (difference <= 0) return;
  workflow._grimgutzGiantKillerTargets.add(targetKey);

  let bonus = difference;
  if (workflow.isCritical && hasFeature(workflow.actor, "giant-crushing")) {
    bonus += Math.max(0, abilityMod(workflow.actor, "str") * 3);
  }
  if (bonus <= 0) return;

  const selector = damageItem.damageSelector ?? "combinedDamage";
  const rawKey = `raw${selector}`;
  const rawDamage = foundry.utils.deepClone(
    damageItem.damageDetails?.[rawKey] ?? damageItem.rawDamageDetail ?? []
  );
  const type = workflow.defaultDamageType
    ?? rawDamage.find(detail => !["midi-none", "temphp", "healing"].includes(detail.type))?.type
    ?? "bludgeoning";
  const properties = rawDamage.find(detail => detail.type === type)?.properties ?? new Set();
  rawDamage.push({
    value: bonus,
    damage: bonus,
    type,
    properties,
    formula: String(bonus),
    active: {}
  });

  recalculateDamageItem(token, damageItem, rawDamage);
  damageItem.details ??= [];
  damageItem.details.push(`Убийца гигантов: +${bonus}`);
}

function isHealingPotion(item) {
  return item?.type === "consumable" && item.system?.type?.value === "potion";
}

function isOwnLayOnHands(workflow, targetActor) {
  return itemIdentifier(workflow?.item) === "lay-on-hands"
    && workflow?.actor?.uuid === targetActor?.uuid;
}

function applyDeathKnightHealingRestriction(token, { workflow, damageItem }) {
  if (!enabled() || !token?.actor || !hasFeature(token.actor, "undead-nature")) return;
  if (isOwnLayOnHands(workflow, token.actor)) return;
  if (workflow?.item?.type !== "spell" && !isHealingPotion(workflow?.item)) return;
  if (damageItem.damageSelector && damageItem.damageSelector !== "combinedDamage") return;

  const selector = damageItem.damageSelector ?? "combinedDamage";
  const rawKey = `raw${selector}`;
  const rawDamage = foundry.utils.deepClone(
    damageItem.damageDetails?.[rawKey] ?? damageItem.rawDamageDetail ?? []
  );
  if (!rawDamage.some(detail => detail.type === "healing")) return;

  const filtered = rawDamage.filter(detail => detail.type !== "healing");
  recalculateDamageItem(token, damageItem, filtered);
  damageItem.details ??= [];
  damageItem.details.push("Нежить: лечение заклинанием или зельем не действует");
}

async function markForestRootFireDamage(token, { damageItem }) {
  const actor = token?.actor;
  if (!enabled() || !actor || !forestRootEffect(actor)) return;
  const calculatedDamage = damageItem?.damageDetails?.combinedDamage
    ?? damageItem?.damageDetail
    ?? [];
  const tookFireDamage = calculatedDamage.some(
    detail => detail.type === "fire" && Number(detail.value ?? detail.damage ?? 0) > 0
  );
  if (!tookFireDamage) return;
  await actor.setFlag(MODULE_ID, FLAGS.FOREST_ROOT_FIRE_BLOCK, true);
  if (actor.getFlag(MODULE_ID, FLAGS.FOREST_ROOT_CLEAR_AT_TURN)) {
    await actor.unsetFlag(MODULE_ID, FLAGS.FOREST_ROOT_CLEAR_AT_TURN);
  }
}

function applyMysticalPowerProgression(progression, actor, cls, _spellcasting, count) {
  if (!enabled()) return;
  const identifier = itemIdentifier(cls);
  const rounding = count === 1 ? Math.ceil : Math.floor;

  if (identifier === "paladin" && deathKnightClass(actor)) {
    const effectivePaladinLevel = paladinLevel(actor) + deathKnightLevel(actor);
    progression.spell += rounding(effectivePaladinLevel / 2);
    return false;
  }

  const baseClass = forestBaseClassIdentifier(actor);
  if (!forestLordClass(actor) || identifier !== baseClass) return;
  const effectiveLevel = Number(cls.system?.levels ?? 0) + forestLordLevel(actor);
  progression.spell += identifier === "druid" ? effectiveLevel : rounding(effectiveLevel / 2);
  return false;
}

function hasStoredItemFlag(item, key) {
  return Object.hasOwn(item?.flags?.[MODULE_ID] ?? {}, key);
}

function layOnHandsItems(actor) {
  return actor?.items?.filter(item => itemIdentifier(item) === "lay-on-hands") ?? [];
}

export async function syncMysticalPower(actor, { notifyResult = false } = {}) {
  if (!actor?.isOwner || mysticalPowerSyncs.has(actor.uuid)) return;
  mysticalPowerSyncs.add(actor.uuid);
  try {
    const paladin = paladinClass(actor);
    const deathKnight = deathKnightClass(actor);
    const active = Boolean(paladin && deathKnight);
    const updates = [];

    if (paladin) {
      const current = String(paladin.system.spellcasting?.preparation?.formula ?? "");
      const stored = hasStoredItemFlag(paladin, FLAGS.MYSTIC_ORIGINAL_PREPARATION);
      if (active) {
        const formula = "@abilities.cha.mod + floor((@classes.paladin.levels + @classes.death-knight.levels) / 2)";
        const update = { _id: paladin.id };
        let changed = false;
        if (!stored) {
          update[`flags.${MODULE_ID}.${FLAGS.MYSTIC_ORIGINAL_PREPARATION}`] = current;
          changed = true;
        }
        if (current !== formula) {
          update["system.spellcasting.preparation.formula"] = formula;
          changed = true;
        }
        if (changed) updates.push(update);
      } else if (stored) {
        updates.push({
          _id: paladin.id,
          "system.spellcasting.preparation.formula": paladin.getFlag(
            MODULE_ID,
            FLAGS.MYSTIC_ORIGINAL_PREPARATION
          ) ?? "",
          [`flags.${MODULE_ID}.-=${FLAGS.MYSTIC_ORIGINAL_PREPARATION}`]: null
        });
      }
    }

    for (const layOnHands of layOnHandsItems(actor)) {
      const current = String(layOnHands.system.uses?.max ?? "");
      const stored = hasStoredItemFlag(layOnHands, FLAGS.MYSTIC_ORIGINAL_LAY_ON_HANDS);
      if (active) {
        const formula = "5 * (@classes.paladin.levels + @classes.death-knight.levels)";
        const update = { _id: layOnHands.id };
        let changed = false;
        if (!stored) {
          update[`flags.${MODULE_ID}.${FLAGS.MYSTIC_ORIGINAL_LAY_ON_HANDS}`] = current;
          changed = true;
        }
        if (current !== formula) {
          update["system.uses.max"] = formula;
          changed = true;
        }
        if (changed) updates.push(update);
      } else if (stored) {
        updates.push({
          _id: layOnHands.id,
          "system.uses.max": layOnHands.getFlag(MODULE_ID, FLAGS.MYSTIC_ORIGINAL_LAY_ON_HANDS) ?? "",
          [`flags.${MODULE_ID}.-=${FLAGS.MYSTIC_ORIGINAL_LAY_ON_HANDS}`]: null
        });
      }
    }

    if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
    if (notifyResult) {
      notify(active
        ? `${actor.name}: «Мистическая сила» синхронизирована с Паладином.`
        : `${actor.name}: исходные формулы Паладина восстановлены.`);
    }
  } finally {
    mysticalPowerSyncs.delete(actor.uuid);
  }
}

export async function syncNatureMagic(actor, { notifyResult = false } = {}) {
  if (!actor?.isOwner || natureMagicSyncs.has(actor.uuid)) return;
  natureMagicSyncs.add(actor.uuid);
  try {
    const druid = druidClass(actor);
    const selected = forestBaseClassIdentifier(actor);
    const active = Boolean(forestLordClass(actor) && selected);
    const updates = [];

    if (druid) {
      const current = String(druid.system.spellcasting?.preparation?.formula ?? "");
      const stored = hasStoredItemFlag(druid, FLAGS.FOREST_ORIGINAL_PREPARATION);
      if (active && selected === "druid") {
        const formula = "@abilities.wis.mod + @classes.druid.levels + @classes.forest-lord.levels";
        const update = { _id: druid.id };
        let changed = false;
        if (!stored) {
          update[`flags.${MODULE_ID}.${FLAGS.FOREST_ORIGINAL_PREPARATION}`] = current;
          changed = true;
        }
        if (current !== formula) {
          update["system.spellcasting.preparation.formula"] = formula;
          changed = true;
        }
        if (changed) updates.push(update);
      } else if (stored) {
        updates.push({
          _id: druid.id,
          "system.spellcasting.preparation.formula": druid.getFlag(
            MODULE_ID,
            FLAGS.FOREST_ORIGINAL_PREPARATION
          ) ?? "",
          [`flags.${MODULE_ID}.-=${FLAGS.FOREST_ORIGINAL_PREPARATION}`]: null
        });
      }
    }

    if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
    if (notifyResult) {
      notify(active
        ? `${actor.name}: «Магия природы» синхронизирована с ${selected === "druid" ? "Друидом" : "Следопытом"}.`
        : `${actor.name}: исходная формула природной магии восстановлена.`);
    }
  } finally {
    natureMagicSyncs.delete(actor.uuid);
  }
}

function constructStrengthSave(actor, existingRoll) {
  const ability = actor.system.abilities?.str;
  const rollData = actor.getRollData();
  const { parts, data } = CONFIG.Dice.D20Roll.constructParts({
    mod: ability?.mod,
    prof: ability?.saveProf?.hasProficiency ? ability.saveProf.term : null,
    strSaveBonus: ability?.bonuses?.save,
    saveBonus: actor.system.bonuses?.abilities?.save
  }, rollData);
  actor.addRollExhaustion?.(parts, data);

  return {
    ...(existingRoll ?? {}),
    parts,
    data: {
      ...(existingRoll?.data ?? {}),
      ...data,
      abilityId: "str"
    },
    options: {
      ...(existingRoll?.options ?? {}),
      advantage: ability?.save?.roll?.mode === CONFIG.Dice.D20Roll.ADV_MODE.ADVANTAGE,
      disadvantage: ability?.save?.roll?.mode === CONFIG.Dice.D20Roll.ADV_MODE.DISADVANTAGE,
      maximum: ability?.save?.roll?.max,
      minimum: ability?.save?.roll?.min
    }
  };
}

function replaceDexteritySave(config, dialog, message) {
  if (!enabled() || config?.ability !== "dex") return;
  const actor = config.subject;
  if (!actor?.getFlag(MODULE_ID, FLAGS.STEEL_WILL_ARMED)) return;
  if (!hasFeature(actor, "steel-will") || !canUseMassiveWeapon(actor)) return;

  config.rolls[0] = constructStrengthSave(actor, config.rolls[0]);
  config.ability = "str";
  const label = CONFIG.DND5E.abilities?.str?.label ?? "Сила";
  if (dialog?.options?.window) dialog.options.window.title = `Спасбросок ${label}`;
  foundry.utils.setProperty(message, "data.flags.dnd5e.roll.ability", "str");
  if (message?.data) message.data.flavor = `Стальная воля — спасбросок ${label}`;
  pendingSteelWillSaves.add(actor.uuid);
}

function midiSaveAbilities(workflow) {
  const values = workflow?.activity?.save?.ability
    ?? workflow?.activity?.save?.abilities
    ?? workflow?.saveItem?.system?.save?.ability;
  if (values instanceof Set) return values;
  if (Array.isArray(values)) return new Set(values);
  return values ? new Set([values]) : new Set();
}

function prepareMidiSteelWill(workflow) {
  if (!enabled() || !midiSaveAbilities(workflow).has("dex")) return;
  workflow._grimgutzSteelWillTargets ??= new Set();
  for (const token of workflow.hitTargets ?? workflow.targets ?? []) {
    const actor = token.actor;
    if (!actor?.getFlag(MODULE_ID, FLAGS.STEEL_WILL_ARMED)) continue;
    if (!hasFeature(actor, "steel-will") || !canUseMassiveWeapon(actor)) continue;
    workflow._grimgutzSteelWillTargets.add(token);
    if (hasFeature(actor, "indestructibility")) workflow.superSavers.add(token);
  }
}

async function finishMidiSteelWill(workflow) {
  for (const token of workflow?._grimgutzSteelWillTargets ?? []) {
    await clearSteelWill(token.actor);
    pendingSteelWillSaves.delete(token.actor?.uuid);
  }
}

function hasStrengthOverride(actor) {
  return actor?.appliedEffects?.some(effect => {
    if (!(effect.parent instanceof Item)) return false;
    return effect.system?.changes?.some(change => {
      return change.key === "system.abilities.str.value" && change.type === "override";
    });
  }) ?? false;
}

function steelGiantEffect(actor) {
  return actor?.effects?.find(effect => effect.getFlag(MODULE_ID, FLAGS.STEEL_GIANT_EFFECT));
}

export async function syncSteelGiant(actor, { notifyResult = false } = {}) {
  if (!actor || steelGiantSyncs.has(actor.uuid) || !actor.isOwner) return;
  steelGiantSyncs.add(actor.uuid);
  try {
    const shouldApply = hasFeature(actor, "steel-giant") && hasStrengthOverride(actor);
    const current = steelGiantEffect(actor);
    if (shouldApply && !current) {
      const origin = findFeature(actor, "steel-giant")?.uuid;
      await actor.createEmbeddedDocuments("ActiveEffect", [{
        name: "Стальной гигант: магический предмет",
        img: "icons/skills/melee/hand-grip-sword-orange.webp",
        origin,
        transfer: false,
        disabled: false,
        showIcon: 1,
        flags: {
          [MODULE_ID]: {
            [FLAGS.STEEL_GIANT_EFFECT]: true
          }
        },
        system: {
          changes: [{
            key: "system.abilities.str.value",
            type: "add",
            value: 1,
            priority: 100
          }]
        }
      }]);
      if (notifyResult) notify(`${actor.name}: значение Силы от магического предмета увеличено на 1.`);
    } else if (!shouldApply && current) {
      await current.delete();
      if (notifyResult) notify(`${actor.name}: усиление магического предмета снято.`);
    } else if (notifyResult) {
      notify(`${actor.name}: Стальной гигант уже синхронизирован.`);
    }
  } finally {
    steelGiantSyncs.delete(actor.uuid);
  }
}

async function chooseWeaponForSmithing(weapons) {
  if (weapons.length === 1) return weapons[0];
  const options = weapons
    .map(weapon => `<option value="${weapon.id}">${foundry.utils.escapeHTML(weapon.name)}</option>`)
    .join("");
  const selectedId = await foundry.applications.api.DialogV2.wait({
    window: { title: "Кузнечное ремесло" },
    position: { width: 420 },
    content: `
      <div class="form-group">
        <label>Массивное оружие</label>
        <div class="form-fields">
          <select name="weapon">${options}</select>
        </div>
      </div>
    `,
    buttons: [
      {
        action: "apply",
        label: "Облегчить",
        icon: "fa-solid fa-hammer",
        default: true,
        callback: (_event, _button, dialog) => {
          return dialog.element.querySelector('select[name="weapon"]')?.value;
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
  return weapons.find(weapon => weapon.id === selectedId);
}

export async function applySmithing(actor) {
  if (!actor || !hasFeature(actor, "smithing")) return false;
  const candidates = massiveWeapons(actor).filter(
    weapon => weapon.getFlag(MODULE_ID, FLAGS.SMITHING_REDUCED) !== true
  );
  if (!candidates.length) {
    notify("Нет массивного оружия, которое ещё можно облегчить.", "warn");
    return false;
  }

  const weapon = await chooseWeaponForSmithing(candidates);
  if (!weapon) return false;
  const original = Number(weapon.system.weight?.value ?? 0);
  await weapon.update({
    "system.weight.value": Math.max(0, original - 5),
    [`flags.${MODULE_ID}.${FLAGS.SMITHING_REDUCED}`]: true,
    [`flags.${MODULE_ID}.${FLAGS.SMITHING_ORIGINAL_WEIGHT}`]: original
  });
  notify(`${weapon.name}: вес уменьшен на 5 фунтов.`);
  return true;
}

function hasGreatWeaponMaster(actor) {
  return actor?.items?.some(item => {
    const identifier = itemIdentifier(item).replaceAll("_", "-");
    const name = String(item.name ?? "").toLowerCase();
    return identifier === "great-weapon-master"
      || name.includes("great weapon master")
      || name.includes("мастер большого оружия")
      || name.includes("мастер тяжёлого оружия")
      || name.includes("мастер тяжелого оружия");
  }) ?? false;
}

function actorSizeAtLeastMedium(actor) {
  return sizeNumber(actor) >= 2;
}

function crusherPrerequisiteFailures(actor) {
  const failures = [];
  if (strengthValue(actor) < 18) failures.push("Сила 18");
  if (Number(actor.system.details?.level ?? 0) < 5) failures.push("5-й уровень персонажа");
  if (!actorSizeAtLeastMedium(actor)) failures.push("Средний или больший размер");
  if (!hasGreatWeaponMaster(actor)) failures.push("черта «Мастер большого оружия»");
  if (!massiveWeapons(actor).length) failures.push("массивное оружие");
  return failures;
}

const LEADERSHIP_SKILLS = ["ani", "dec", "his", "ins", "itm", "inv", "rel", "prf", "per"];

function hasLeadershipSkill(actor) {
  return LEADERSHIP_SKILLS.some(skill => {
    const data = actor?.system?.skills?.[skill];
    return Number(data?.value ?? data?.proficient ?? 0) > 0;
  });
}

function leaderPrerequisiteFailures(actor) {
  const failures = [];
  const planningAbility = Math.max(
    Number(actor?.system?.abilities?.int?.value ?? 0),
    Number(actor?.system?.abilities?.wis?.value ?? 0),
    Number(actor?.system?.abilities?.cha?.value ?? 0)
  );
  if (planningAbility < 13) failures.push("Интеллект, Мудрость или Харизма 13");
  if (Number(actor?.system?.abilities?.wis?.value ?? 0) < 11) failures.push("Мудрость 11");
  if (Number(actor?.system?.abilities?.cha?.value ?? 0) < 11) failures.push("Харизма 11");
  if (Number(actor?.system?.details?.level ?? 0) < 5) failures.push("5-й уровень персонажа");
  if (!hasLeadershipSkill(actor)) failures.push("владение навыком лидерства");
  return failures;
}

function deathKnightPrerequisiteFailures(actor) {
  const failures = [];
  if (paladinLevel(actor) < 5) failures.push("5 уровней Паладина");
  return failures;
}

function hereticPrerequisiteFailures(actor) {
  const failures = [];
  const occultAbilityValue = Math.max(
    Number(actor?.system?.abilities?.int?.value ?? 0),
    Number(actor?.system?.abilities?.wis?.value ?? 0),
    Number(actor?.system?.abilities?.cha?.value ?? 0)
  );
  if (occultAbilityValue < 13) failures.push("Интеллект, Мудрость или Харизма 13");
  if (Number(actor?.system?.details?.level ?? 0) < 4) failures.push("4-й уровень персонажа");

  const alignmentData = actor?.system?.details?.alignment;
  const alignment = String(
    typeof alignmentData === "object" ? alignmentData?.value ?? alignmentData?.label ?? "" : alignmentData ?? ""
  ).toLocaleLowerCase("ru");
  if (
    alignment.includes("lawful good")
    || alignment.includes("законно-добр")
    || alignment.includes("законный добр")
  ) {
    failures.push("мировоззрение не законно-доброе");
  }
  return failures;
}

function hasNaturePath(actor) {
  if (druidClass(actor) || rangerClass(actor)) return true;
  return actor?.items?.some(item => {
    if (!["class", "subclass"].includes(item.type)) return false;
    const text = `${itemIdentifier(item)} ${item.name ?? ""}`.toLocaleLowerCase("ru");
    return [
      "green-heart",
      "green heart",
      "зелёного сердца",
      "зеленого сердца",
      "nature",
      "природ"
    ].some(fragment => text.includes(fragment));
  }) ?? false;
}

function forestLordPrerequisiteFailures(actor) {
  const failures = [];
  if (Number(actor?.system?.details?.level ?? 0) < 5) failures.push("5-й уровень персонажа");
  if (Number(actor?.system?.abilities?.wis?.value ?? 0) < 13) failures.push("Мудрость 13");
  if (!hasNaturePath(actor)) failures.push("класс Друид, Следопыт или природный архетип");
  return failures;
}

function aberrantPrerequisiteFailures(actor) {
  const failures = [];
  if (Number(actor?.system?.abilities?.con?.value ?? 0) < 17) failures.push("Телосложение 17");
  const physical = Math.max(
    Number(actor?.system?.abilities?.str?.value ?? 0),
    Number(actor?.system?.abilities?.dex?.value ?? 0)
  );
  if (physical < 15) failures.push("Сила или Ловкость 15");
  if (Number(actor?.system?.details?.level ?? 0) < 5) failures.push("5-й уровень персонажа");
  return failures;
}

function validateCrusherPrerequisites(item, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  if (!actor || item.type !== "class" || itemIdentifier(item) !== "crusher") return true;

  const failures = crusherPrerequisiteFailures(actor);
  if (failures.length) {
    notify(`Нельзя добавить класс «Сокрушитель». Не выполнено: ${failures.join(", ")}.`, "error");
    return false;
  }
  return true;
}

function validateLeaderPrerequisites(item, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  if (!actor || item.type !== "class" || itemIdentifier(item) !== "leader") return true;

  const failures = leaderPrerequisiteFailures(actor);
  if (failures.length) {
    notify(`Нельзя добавить класс «Лидер». Не выполнено: ${failures.join(", ")}. Сюжетное требование командования проверяет Мастер.`, "error");
    return false;
  }
  return true;
}

function validateDeathKnightPrerequisites(item, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  if (!actor || item.type !== "class" || itemIdentifier(item) !== "death-knight") return true;

  const failures = deathKnightPrerequisiteFailures(actor);
  if (failures.length) {
    notify(`Нельзя добавить класс «Рыцарь смерти». Не выполнено: ${failures.join(", ")}. Нарушение клятвы и смерть подтверждает Мастер.`, "error");
    return false;
  }
  return true;
}

function validateHereticPrerequisites(item, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  if (!actor || item.type !== "class" || itemIdentifier(item) !== "heretic") return true;

  const failures = hereticPrerequisiteFailures(actor);
  if (failures.length) {
    notify(`Нельзя добавить класс «Еретик». Не выполнено: ${failures.join(", ")}. Наличие магической порчи подтверждает Мастер.`, "error");
    return false;
  }
  return true;
}

function validateForestLordPrerequisites(item, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  if (!actor || item.type !== "class" || itemIdentifier(item) !== "forest-lord") return true;

  const failures = forestLordPrerequisiteFailures(actor);
  if (failures.length) {
    notify(`Нельзя добавить класс «Лесной владыка». Не выполнено: ${failures.join(", ")}. Благословение трента или дриады подтверждает Мастер.`, "error");
    return false;
  }
  return true;
}

function validateAberrantPrerequisites(item, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  if (!actor || item.type !== "class" || itemIdentifier(item) !== "aberrant") return true;
  const failures = aberrantPrerequisiteFailures(actor);
  if (failures.length) {
    notify(`Нельзя добавить класс «Абберант». Не выполнено: ${failures.join(", ")}. Компоненты и завершение ритуала подтверждает Мастер.`, "error");
    return false;
  }
  return true;
}

function validateLeaderFeaturePrerequisites(item, options, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  const data = automationData(item);
  if (!actor || data.leaderFeature !== true || options?.isAdvancement) return true;

  const level = leaderLevel(actor);
  if (!level) {
    notify(`Особенность «${item.name}» требует класс «Лидер».`, "error");
    return false;
  }
  const requiredLevel = Number(item.system?.prerequisites?.level ?? 0);
  if (requiredLevel && level < requiredLevel) {
    notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Лидера.`, "error");
    return false;
  }
  return true;
}

function validateDeathKnightFeaturePrerequisites(item, options, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  const data = automationData(item);
  if (!actor || data.deathKnightFeature !== true || options?.isAdvancement) return true;

  const level = deathKnightLevel(actor);
  if (!level) {
    notify(`Особенность «${item.name}» требует класс «Рыцарь смерти».`, "error");
    return false;
  }
  const requiredLevel = Number(item.system?.prerequisites?.level ?? 0);
  if (requiredLevel && level < requiredLevel) {
    notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Рыцаря смерти.`, "error");
    return false;
  }
  return true;
}

function validateHereticFeaturePrerequisites(item, options, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  const data = automationData(item);
  if (!actor || data.hereticFeature !== true || options?.isAdvancement) return true;

  const level = hereticLevel(actor);
  if (!level) {
    notify(`Особенность «${item.name}» требует класс «Еретик».`, "error");
    return false;
  }
  const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
  if (requiredLevel && level < requiredLevel) {
    notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Еретика.`, "error");
    return false;
  }
  return true;
}

function validateForestLordFeaturePrerequisites(item, options, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  const data = automationData(item);
  if (!actor || data.forestLordFeature !== true || options?.isAdvancement) return true;

  const level = forestLordLevel(actor);
  if (!level) {
    notify(`Особенность «${item.name}» требует класс «Лесной владыка».`, "error");
    return false;
  }
  const requiredLevel = Number(item.system?.prerequisites?.level ?? 0);
  if (requiredLevel && level < requiredLevel) {
    notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Лесного владыки.`, "error");
    return false;
  }
  return true;
}

function validateAberrantFeaturePrerequisites(item, options, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  const data = automationData(item);
  if (!actor || data.aberrantFeature !== true || data.unnaturalTrait === true || options?.isAdvancement) return true;
  const level = aberrantLevel(actor);
  if (!level) {
    notify(`Особенность «${item.name}» требует класс «Абберант».`, "error");
    return false;
  }
  const requiredLevel = Number(item.system?.prerequisites?.level ?? 0);
  if (requiredLevel && level < requiredLevel) {
    notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Абберанта.`, "error");
    return false;
  }
  return true;
}

function validateTechniquePrerequisites(item, options, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  const data = automationData(item);
  if (!actor || data.technique !== true) return true;
  if (options?.isAdvancement) return true;

  const level = crusherLevel(actor);
  if (!level) {
    notify(`Техника «${item.name}» требует класс «Сокрушитель».`, "error");
    return false;
  }
  if (data.minimumLevel && level < Number(data.minimumLevel)) {
    notify(`Техника «${item.name}» требует ${data.minimumLevel}-й уровень Сокрушителя.`, "error");
    return false;
  }
  if (data.requiredStyle && !canUseStyle(actor, data.requiredStyle)) {
    notify(`Техника «${item.name}» требует стиль «${FEATURE_NAMES[data.requiredStyle]}».`, "error");
    return false;
  }
  return true;
}

function finalAdvancementItems(actor, toCreate, toUpdate, toDelete) {
  const deleted = new Set(toDelete);
  const items = new Map(
    actor.items
      .filter(item => !deleted.has(item.id))
      .map(item => [item.id, item.toObject()])
  );
  for (const update of toUpdate) items.set(update._id, update);
  for (const item of toCreate) items.set(item._id, item);
  return [...items.values()];
}

function validateAdvancement(_manager, _actorUpdates, toCreate, toUpdate, toDelete) {
  if (!enabled() || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = _manager.actor;
  const createsCrusher = toCreate.some(
    item => item.type === "class" && itemIdentifier(item) === "crusher"
  );
  if (createsCrusher) {
    const failures = crusherPrerequisiteFailures(actor);
    if (failures.length) {
      notify(`Нельзя добавить класс «Сокрушитель». Не выполнено: ${failures.join(", ")}.`, "error");
      return false;
    }
  }
  const createsLeader = toCreate.some(
    item => item.type === "class" && itemIdentifier(item) === "leader"
  );
  if (createsLeader) {
    const failures = leaderPrerequisiteFailures(actor);
    if (failures.length) {
      notify(`Нельзя добавить класс «Лидер». Не выполнено: ${failures.join(", ")}. Сюжетное требование командования проверяет Мастер.`, "error");
      return false;
    }
  }
  const createsDeathKnight = toCreate.some(
    item => item.type === "class" && itemIdentifier(item) === "death-knight"
  );
  if (createsDeathKnight) {
    const failures = deathKnightPrerequisiteFailures(actor);
    if (failures.length) {
      notify(`Нельзя добавить класс «Рыцарь смерти». Не выполнено: ${failures.join(", ")}. Нарушение клятвы и смерть подтверждает Мастер.`, "error");
      return false;
    }
  }
  const createsHeretic = toCreate.some(
    item => item.type === "class" && itemIdentifier(item) === "heretic"
  );
  if (createsHeretic) {
    const failures = hereticPrerequisiteFailures(actor);
    if (failures.length) {
      notify(`Нельзя добавить класс «Еретик». Не выполнено: ${failures.join(", ")}. Наличие магической порчи подтверждает Мастер.`, "error");
      return false;
    }
  }
  const createsForestLord = toCreate.some(
    item => item.type === "class" && itemIdentifier(item) === "forest-lord"
  );
  if (createsForestLord) {
    const failures = forestLordPrerequisiteFailures(actor);
    if (failures.length) {
      notify(`Нельзя добавить класс «Лесной владыка». Не выполнено: ${failures.join(", ")}. Благословение трента или дриады подтверждает Мастер.`, "error");
      return false;
    }
  }
  const createsAberrant = toCreate.some(
    item => item.type === "class" && itemIdentifier(item) === "aberrant"
  );
  if (createsAberrant) {
    const failures = aberrantPrerequisiteFailures(actor);
    if (failures.length) {
      notify(`Нельзя добавить класс «Абберант». Не выполнено: ${failures.join(", ")}. Компоненты и завершение ритуала подтверждает Мастер.`, "error");
      return false;
    }
  }

  const items = finalAdvancementItems(actor, toCreate, toUpdate, toDelete);
  const crusher = items.find(item => item.type === "class" && itemIdentifier(item) === "crusher");
  const level = Number(crusher?.system?.levels ?? 0);
  const adaptability = items.some(item => automationData(item).feature === "adaptability");
  const styles = new Set(
    items.map(item => automationData(item).style).filter(Boolean)
  );

  for (const item of items.filter(item => automationData(item).technique === true)) {
    const data = automationData(item);
    if (!crusher) {
      notify(`Техника «${item.name}» требует класс «Сокрушитель».`, "error");
      return false;
    }
    if (data.minimumLevel && level < Number(data.minimumLevel)) {
      notify(`Техника «${item.name}» требует ${data.minimumLevel}-й уровень Сокрушителя.`, "error");
      return false;
    }
    if (data.requiredStyle && !adaptability && !styles.has(data.requiredStyle)) {
      notify(`Техника «${item.name}» требует стиль «${FEATURE_NAMES[data.requiredStyle]}».`, "error");
      return false;
    }
  }

  const leader = items.find(item => item.type === "class" && itemIdentifier(item) === "leader");
  const currentLeaderLevel = Number(leader?.system?.levels ?? 0);
  for (const item of items.filter(item => automationData(item).leaderFeature === true)) {
    if (!leader) {
      notify(`Особенность «${item.name}» требует класс «Лидер».`, "error");
      return false;
    }
    const requiredLevel = Number(item.system?.prerequisites?.level ?? 0);
    if (requiredLevel && currentLeaderLevel < requiredLevel) {
      notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Лидера.`, "error");
      return false;
    }
  }

  const deathKnight = items.find(
    item => item.type === "class" && itemIdentifier(item) === "death-knight"
  );
  const currentDeathKnightLevel = Number(deathKnight?.system?.levels ?? 0);
  for (const item of items.filter(item => automationData(item).deathKnightFeature === true)) {
    if (!deathKnight) {
      notify(`Особенность «${item.name}» требует класс «Рыцарь смерти».`, "error");
      return false;
    }
    const requiredLevel = Number(item.system?.prerequisites?.level ?? 0);
    if (requiredLevel && currentDeathKnightLevel < requiredLevel) {
      notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Рыцаря смерти.`, "error");
      return false;
    }
  }

  const heretic = items.find(item => item.type === "class" && itemIdentifier(item) === "heretic");
  const currentHereticLevel = Number(heretic?.system?.levels ?? 0);
  const hereticPowers = items.filter(item => automationData(item).vilePower === true);
  for (const item of items.filter(item => automationData(item).hereticFeature === true)) {
    const data = automationData(item);
    if (!heretic) {
      notify(`Особенность «${item.name}» требует класс «Еретик».`, "error");
      return false;
    }
    const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
    if (requiredLevel && currentHereticLevel < requiredLevel) {
      notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Еретика.`, "error");
      return false;
    }
  }
  if (heretic && hereticPowers.length) {
    const corePowers = new Set(["vile-unholy-power", "vile-unholy-smite", "vile-unholy-vigor"]);
    if (!hereticPowers.some(item => corePowers.has(itemIdentifier(item)))) {
      notify("Еретик должен знать хотя бы одну основную гнусную силу: «Нечестивая сила», «Нечестивая кара» или «Нечестивая мощь».", "error");
      return false;
    }
  }

  const forestLord = items.find(
    item => item.type === "class" && itemIdentifier(item) === "forest-lord"
  );
  const currentForestLordLevel = Number(forestLord?.system?.levels ?? 0);
  for (const item of items.filter(item => automationData(item).forestLordFeature === true)) {
    if (!forestLord) {
      notify(`Особенность «${item.name}» требует класс «Лесной владыка».`, "error");
      return false;
    }
    const requiredLevel = Number(item.system?.prerequisites?.level ?? 0);
    if (requiredLevel && currentForestLordLevel < requiredLevel) {
      notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Лесного владыки.`, "error");
      return false;
    }
  }

  const aberrant = items.find(item => item.type === "class" && itemIdentifier(item) === "aberrant");
  const currentAberrantLevel = Number(aberrant?.system?.levels ?? 0);
  for (const item of items.filter(
    item => automationData(item).aberrantFeature === true && automationData(item).unnaturalTrait !== true
  )) {
    if (!aberrant) {
      notify(`Особенность «${item.name}» требует класс «Абберант».`, "error");
      return false;
    }
    const requiredLevel = Number(item.system?.prerequisites?.level ?? 0);
    if (requiredLevel && currentAberrantLevel < requiredLevel) {
      notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Абберанта.`, "error");
      return false;
    }
  }
  return true;
}

async function restoreDefiledHeart(actor, result) {
  if (!enabled() || result?.type !== "short" || !actor?.isOwner) return;
  if (!hasFeature(actor, "distortion-defiled-heart")) return;
  const gift = occultGift(actor);
  if (!gift) return;
  const points = occultPoints(gift);
  const restored = Math.min(4, points.maximum);
  if (points.remaining >= restored) return;
  await gift.update({ "system.uses.spent": Math.max(0, points.maximum - restored) });
  notify(`${actor.name}: «Осквернённое сердце» восстановило очки оккультизма до ${restored}.`);
}

function prepareMassiveWeaponProficiency(item) {
  const actor = item.parent;
  if (!actor || !isMassiveWeapon(item) || !crusherClass(actor)) return;
  item.updateSource({ "system.proficient": 1 });
}

async function updateOwnedMassiveWeaponProficiency(actor) {
  if (!actor?.isOwner || !crusherClass(actor)) return;
  const updates = massiveWeapons(actor)
    .filter(item => Number(item.system.proficient) !== 1)
    .map(item => ({ _id: item.id, "system.proficient": 1 }));
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
}

function actorFromEffect(effect) {
  if (effect?.parent instanceof Actor) return effect.parent;
  if (effect?.parent instanceof Item) return effect.parent.actor;
  return null;
}

async function clearForestRootStateFromEffect(effect) {
  if (!effect?.getFlag(MODULE_ID, FLAGS.FOREST_ROOT_EFFECT)) return;
  const actor = actorFromEffect(effect);
  if (!actor?.isOwner) return;
  if (actor.getFlag(MODULE_ID, FLAGS.FOREST_ROOT_FIRE_BLOCK)) {
    await actor.unsetFlag(MODULE_ID, FLAGS.FOREST_ROOT_FIRE_BLOCK);
  }
  if (actor.getFlag(MODULE_ID, FLAGS.FOREST_ROOT_CLEAR_AT_TURN)) {
    await actor.unsetFlag(MODULE_ID, FLAGS.FOREST_ROOT_CLEAR_AT_TURN);
  }
}

function isAutomationAuthority(actor) {
  const activeGM = game.users?.activeGM;
  return activeGM ? activeGM.id === game.user.id : actor?.isOwner;
}

function scheduleSteelGiantSync(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  setTimeout(() => {
    void syncSteelGiant(actor).catch(error => {
      console.error(`${MODULE_ID} | Steel Giant sync failed`, error);
    });
  }, 50);
}

function scheduleMysticalPowerSync(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  setTimeout(() => {
    void syncMysticalPower(actor).catch(error => {
      console.error(`${MODULE_ID} | Mystical Power sync failed`, error);
    });
  }, 50);
}

function scheduleNatureMagicSync(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  setTimeout(() => {
    void syncNatureMagic(actor).catch(error => {
      console.error(`${MODULE_ID} | Nature Magic sync failed`, error);
    });
  }, 50);
}

function schedulePassiveSync(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  setTimeout(() => {
    void (async () => {
      await syncCrusherPassiveEffects(actor);
      await syncLeaderPassiveEffects(actor);
      await syncDeathKnightPassiveEffects(actor);
      await syncHereticPassiveEffects(actor);
      await syncForestPassiveEffects(actor);
      await syncAberrantPassiveEffects(actor);
      await syncModulePassiveEffects(actor);
      await syncDarkGuard(actor);
    })().catch(error => {
      console.error(`${MODULE_ID} | Passive feature sync failed`, error);
    });
  }, 50);
}

function activitiesOf(item) {
  const activities = item?.system?.activities;
  if (!activities) return [];
  if (typeof activities.values === "function") return [...activities.values()];
  return Object.values(activities);
}

function hasModuleAction(item) {
  return activitiesOf(item).some(activity => Boolean(actionFromActivity(activity)));
}

function isLikelyModuleItem(item, source) {
  const compendiumSource = String(item?._stats?.compendiumSource ?? "");
  if (compendiumSource.startsWith(`Compendium.${MODULE_ID}.`)) return true;
  return itemIdentifier(item) === itemIdentifier(source) && item.name === source.name;
}

async function migrateOwnedItems(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  const sources = await moduleItemSources();
  const updates = [];
  const effectSyncs = [];

  const effectSignature = effects => effects.map(effect => ({
    name: effect.name,
    transfer: effect.transfer,
    changes: effect.system?.changes ?? effect.system?.toObject?.().changes ?? []
  }));

  for (const item of actor.items) {
    const source = sources.get(itemIdentifier(item));
    if (!source || !isLikelyModuleItem(item, source)) continue;
    const sourceData = source.toObject();
    const update = { _id: item.id };
    let changed = false;

    if (!automationData(item).feature && !automationData(item).massiveWeapon) {
      update[`flags.${MODULE_ID}`] = sourceData.flags?.[MODULE_ID] ?? {};
      changed = true;
    }
    if (hasModuleAction(source) && !hasModuleAction(item)) {
      update["system.activities"] = sourceData.system.activities;
      changed = true;
    }
    if (item.system.description?.value !== sourceData.system.description?.value) {
      update["system.description"] = sourceData.system.description;
      changed = true;
    }
    const currentEffects = item.effects?.map(effect => effect.toObject()) ?? [];
    if (
      (sourceData.effects?.length ?? 0) > 0
      && JSON.stringify(effectSignature(currentEffects)) !== JSON.stringify(effectSignature(sourceData.effects))
    ) {
      effectSyncs.push({
        item,
        effects: sourceData.effects
      });
    }
    if (changed) updates.push(update);
  }

  if (updates.length) {
    await actor.updateEmbeddedDocuments("Item", updates);
    console.log(`${MODULE_ID} | Migrated ${updates.length} owned items on ${actor.name}`);
  }
  for (const { item, effects } of effectSyncs) {
    const updates = [];
    const creates = [];
    for (const effect of effects) {
      if (item.effects.get(effect._id)) updates.push(effect);
      else creates.push(effect);
    }
    if (updates.length) await item.updateEmbeddedDocuments("ActiveEffect", updates);
    if (creates.length) await item.createEmbeddedDocuments("ActiveEffect", creates, { keepId: true });
  }
  if (effectSyncs.length) {
    console.log(`${MODULE_ID} | Synchronized effects on ${effectSyncs.length} owned items for ${actor.name}`);
  }
}

function installHooks() {
  Hooks.on("dnd5e.preAdvancementManagerComplete", validateAdvancement);
  Hooks.on("dnd5e.preUseActivity", validateActivityUse);
  Hooks.on("dnd5e.postUseActivity", activity => {
    void handleActivityAction(activity).catch(error => console.error(`${MODULE_ID} | Activity automation failed`, error));
    void handleStratagemUse(activity).catch(error => console.error(`${MODULE_ID} | Stratagem automation failed`, error));
  });
  Hooks.on("dnd5e.preRollAttack", applyNativeAttackAutomation);
  Hooks.on("dnd5e.preRollDamage", applyDamageAutomation);
  Hooks.on("dnd5e.preRollSavingThrow", replaceDexteritySave);
  Hooks.on("dnd5e.computeLeveledProgression", applyMysticalPowerProgression);
  Hooks.on("dnd5e.computeSpellProgression", applyMysticalPowerProgression);
  Hooks.on("dnd5e.restCompleted", (actor, result) => {
    void restoreDefiledHeart(actor, result).catch(
      error => console.error(`${MODULE_ID} | Defiled Heart recovery failed`, error)
    );
  });
  Hooks.on("dnd5e.rollSavingThrow", (_rolls, { subject }) => {
    if (!pendingSteelWillSaves.has(subject?.uuid)) return;
    pendingSteelWillSaves.delete(subject.uuid);
    void clearSteelWill(subject);
  });

  Hooks.on("midi-qol.preAttackRollConfig", applyMidiAttackDisadvantage);
  Hooks.on("midi-qol.DamageRollComplete", applyPowerfulCleaving);
  Hooks.on("midi-qol.preTargetDamageApplication", applyGiantKiller);
  Hooks.on("midi-qol.preTargetDamageApplication", applyDeathKnightHealingRestriction);
  Hooks.on("midi-qol.preTargetDamageApplication", markForestRootFireDamage);
  Hooks.on("midi-qol.preCheckSaves", prepareMidiSteelWill);
  Hooks.on("midi-qol.postCheckSaves", finishMidiSteelWill);

  Hooks.on("preCreateItem", (item, _data, options, userId) => {
    if (!enabled()) return true;
    if (validateCrusherPrerequisites(item, userId) === false) return false;
    if (validateLeaderPrerequisites(item, userId) === false) return false;
    if (validateDeathKnightPrerequisites(item, userId) === false) return false;
    if (validateHereticPrerequisites(item, userId) === false) return false;
    if (validateForestLordPrerequisites(item, userId) === false) return false;
    if (validateAberrantPrerequisites(item, userId) === false) return false;
    if (validateTechniquePrerequisites(item, options, userId) === false) return false;
    if (validateLeaderFeaturePrerequisites(item, options, userId) === false) return false;
    if (validateDeathKnightFeaturePrerequisites(item, options, userId) === false) return false;
    if (validateHereticFeaturePrerequisites(item, options, userId) === false) return false;
    if (validateForestLordFeaturePrerequisites(item, options, userId) === false) return false;
    if (validateAberrantFeaturePrerequisites(item, options, userId) === false) return false;
    prepareMassiveWeaponProficiency(item);
    return true;
  });
  Hooks.on("createItem", item => {
    const actor = item.parent;
    if (!actor) return;
    if (item.type === "class" && itemIdentifier(item) === "crusher") {
      if (isAutomationAuthority(actor)) void updateOwnedMassiveWeaponProficiency(actor);
    }
    scheduleSteelGiantSync(actor);
    scheduleMysticalPowerSync(actor);
    scheduleNatureMagicSync(actor);
    schedulePassiveSync(actor);
  });
  Hooks.on("updateItem", item => {
    scheduleSteelGiantSync(item.parent);
    scheduleMysticalPowerSync(item.parent);
    scheduleNatureMagicSync(item.parent);
    schedulePassiveSync(item.parent);
  });
  Hooks.on("deleteItem", item => {
    scheduleSteelGiantSync(item.parent);
    scheduleMysticalPowerSync(item.parent);
    scheduleNatureMagicSync(item.parent);
    schedulePassiveSync(item.parent);
  });
  Hooks.on("updateActor", actor => schedulePassiveSync(actor));
  Hooks.on("createActiveEffect", effect => scheduleSteelGiantSync(actorFromEffect(effect)));
  Hooks.on("updateActiveEffect", effect => scheduleSteelGiantSync(actorFromEffect(effect)));
  Hooks.on("deleteActiveEffect", effect => {
    scheduleSteelGiantSync(actorFromEffect(effect));
    void clearForestRootStateFromEffect(effect);
  });
  Hooks.on("updateCombat", (combat, changes) => {
    if (!enabled() || (!Object.hasOwn(changes, "turn") && !Object.hasOwn(changes, "round"))) return;
    const previousActor = combat.turns?.[combat.previous?.turn]?.actor;
    const currentActor = combat.combatant?.actor;
    if (previousActor) {
      void endLeaderTurn(previousActor);
      void endForestTurn(previousActor, combat);
    }
    if (currentActor) {
      void beginLeaderTurn(currentActor);
      void beginForestTurn(currentActor, combat);
    }
  });
  Hooks.on("deleteCombat", combat => {
    if (!enabled()) return;
    for (const combatant of combat.combatants ?? []) {
      if (combatant.actor) {
        void clearLeaderCombatState(combatant.actor);
        void clearForestCombatState(combatant.actor);
      }
    }
  });
}

export function registerAutomation() {
  game.settings.register(MODULE_ID, SETTINGS.AUTOMATION, {
    name: "Автоматизация правил престиж-классов",
    hint: "Включает интеграцию всех престиж-классов Гриммуара с dnd5e, Midi-QOL и активными эффектами.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    restricted: true
  });
  game.settings.register(MODULE_ID, SETTINGS.STRICT_PREREQUISITES, {
    name: "Строго проверять требования",
    hint: "Запрещает добавлять престиж-класс и техники персонажам, которые не выполняют требования.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    restricted: true
  });
  installHooks();
}

export function exposeApi() {
  const module = game.modules.get(MODULE_ID);
  if (!module) return;
  module.api = {
    setStyle,
    toggleStyle,
    toggleGreatWeaponMaster,
    armSteelWill,
    armGlimpseOfGenius,
    chooseOccultAbility,
    useOccultPoints,
    chooseForestBaseClass,
    rollForestUnarmedDamage,
    takeRoot,
    withdrawRoots,
    armDeadlyPrecision,
    useVigorousNature,
    syncSteelGiant,
    syncMysticalPower,
    syncNatureMagic,
    syncModulePassiveEffects,
    syncCrusherPassiveEffects,
    syncLeaderPassiveEffects,
    syncDeathKnightPassiveEffects,
    syncHereticPassiveEffects,
    syncAberrantPassiveEffects,
    syncForestPassiveEffects,
    syncDarkGuard,
    applySmithing
  };
}

export async function initializeOwnedActors() {
  exposeApi();
  if (!enabled()) return;
  for (const actor of game.actors ?? []) {
    if (!actor.isOwner || !isAutomationAuthority(actor)) continue;
    await syncCrusherPassiveEffects(actor);
    await syncLeaderPassiveEffects(actor);
    await syncDeathKnightPassiveEffects(actor);
    await syncHereticPassiveEffects(actor);
    await syncForestPassiveEffects(actor);
    await syncAberrantPassiveEffects(actor);
    await migrateOwnedItems(actor);
    await updateOwnedMassiveWeaponProficiency(actor);
    await syncSteelGiant(actor);
    await syncMysticalPower(actor);
    await syncNatureMagic(actor);
    await syncModulePassiveEffects(actor);
    await syncDarkGuard(actor);
  }

  if (!game.modules.get("midi-qol")?.active) {
    notify("Для полной автоматизации престиж-классов включите Midi-QOL.", "warn");
  }
}
