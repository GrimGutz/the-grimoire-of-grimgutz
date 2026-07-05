import { FEATURE_NAMES, FLAGS, MODULE_ID, STYLES } from "../shared/constants.mjs";
import {
  activityActor,
  activityItem,
  automationData,
  enabled,
  findFeature,
  hasFeature,
  isAutomationAuthority,
  notify
} from "../shared/helpers.mjs";
import { abilityMod, strengthValue } from "../shared/dnd5e.mjs";
import { crusherClass, crusherLevel } from "../shared/selectors.mjs";
import {
  flaggedPassiveEffectData,
  syncFlaggedPassiveEffects
} from "../effects/passive-helpers.mjs";

const pendingSteelWillSaves = new Set();
const crusherPassiveSyncs = new Set();
const steelGiantSyncs = new Set();

export function isMassiveWeapon(item) {
  return item?.type === "weapon" && automationData(item).massiveWeapon === true;
}

export function massiveWeapons(actor) {
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

export function canUseMassiveWeapon(actor) {
  return strengthValue(actor) >= 18 && massiveWeapons(actor).length > 0;
}

export function canUseStyle(actor, style) {
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

async function clearSteelWill(actor) {
  if (actor?.getFlag(MODULE_ID, FLAGS.STEEL_WILL_ARMED)) {
    await actor.unsetFlag(MODULE_ID, FLAGS.STEEL_WILL_ARMED);
  }
}

function crusherPassiveDefinitions(actor) {
  if (!crusherClass(actor)) return [];
  const definitions = [];

  const greatWeaponStyle = findFeature(actor, "great-weapon-style");
  if (greatWeaponStyle) {
    definitions.push(flaggedPassiveEffectData(MODULE_ID, FLAGS.CRUSHER_PASSIVE, {
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
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  return syncFlaggedPassiveEffects(actor, crusherPassiveSyncs, MODULE_ID, FLAGS.CRUSHER_PASSIVE, crusherPassiveDefinitions);
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

function targetWithinFiveFeet(actor) {
  if (!globalThis.MidiQOL?.computeDistance) return false;
  const source = actor.getActiveTokens?.(true, true)?.[0];
  if (!source) return false;
  return Array.from(game.user?.targets ?? []).some(target => {
    const distance = globalThis.MidiQOL.computeDistance(source, target, { wallsBlock: false });
    return Number.isFinite(distance) && distance <= 5;
  });
}

export function applyCrusherNativeAttackAutomation(config) {
  if (!enabled()) return;
  const context = attackContext(config);
  if (!context) return;
  const { actor, item } = context;
  const roll = config.rolls?.[0];
  if (!roll) return;

  if (strengthValue(actor) < 18) {
    roll.options ??= {};
    roll.options.disadvantage = true;
  }

  if (automationData(item).closeRangeDisadvantage && targetWithinFiveFeet(actor)) {
    roll.options ??= {};
    roll.options.disadvantage = true;
  }

  if (gwmEnabled(actor)) appendRollPart(roll, "-5");
}

export function applyMidiAttackDisadvantage(workflow) {
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

export function applyCrusherDamageAutomation(config) {
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

export async function applyPowerfulCleaving(workflow) {
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

export function replaceDexteritySave(config, dialog, message) {
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

export function prepareMidiSteelWill(workflow) {
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

export async function finishMidiSteelWill(workflow) {
  for (const token of workflow?._grimgutzSteelWillTargets ?? []) {
    await clearSteelWill(token.actor);
    pendingSteelWillSaves.delete(token.actor?.uuid);
  }
}

export async function clearPendingSteelWill(actor) {
  if (pendingSteelWillSaves.delete(actor?.uuid)) {
    await clearSteelWill(actor);
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

export function prepareMassiveWeaponProficiency(item) {
  const actor = item.parent;
  if (!actor || !isMassiveWeapon(item) || !crusherClass(actor)) return;
  item.updateSource({ "system.proficient": 1 });
}

export async function updateOwnedMassiveWeaponProficiency(actor) {
  if (!actor?.isOwner || !crusherClass(actor)) return;
  const updates = massiveWeapons(actor)
    .filter(item => Number(item.system.proficient) !== 1)
    .map(item => ({ _id: item.id, "system.proficient": 1 }));
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
}

export function validateSteelWillUse(actor) {
  if (actor && hasFeature(actor, "steel-will") && canUseMassiveWeapon(actor)) return true;
  notify("Стальная воля требует Силу 18, массивное оружие и соответствующую технику.", "warn");
  return false;
}
