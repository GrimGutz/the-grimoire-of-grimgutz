import { FLAGS, MODULE_ID } from "../shared/constants.mjs";
import {
  findFeature,
  hasFeature,
  isAutomationAuthority,
  itemIdentifier,
  notify
} from "../shared/helpers.mjs";
import { abilityMod } from "../shared/dnd5e.mjs";
import { isEffectActive } from "../effects/temporary-effects.mjs";
import { choiceDialog } from "../shared/dialogs.mjs";
import {
  druidClass,
  forestLordClass,
  forestLordLevel,
  rangerClass
} from "../shared/selectors.mjs";
import {
  flaggedPassiveEffectData,
  syncFlaggedPassiveEffects
} from "../effects/passive-helpers.mjs";

const forestPassiveSyncs = new Set();
const natureMagicSyncs = new Set();

function forestNatureClasses(actor) {
  return [druidClass(actor), rangerClass(actor)].filter(Boolean);
}

export function forestBaseClassIdentifier(actor) {
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
  const selected = await choiceDialog({
    title: "Базовый природный класс",
    label: "Продолжить прогрессию",
    choices: candidates.map(cls => {
      const identifier = itemIdentifier(cls);
      return {
        value: identifier,
        label: `${labels[identifier] ?? cls.name} ${cls.system.levels}`,
        selected: identifier === current
      };
    }),
    defaultValue: current,
    confirmIcon: "fa-solid fa-leaf"
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
      flavor: "Сила дуба"
    }
  ).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: "Сила дуба: безоружный удар"
  });
  return true;
}

export function forestRootEffect(actor, { activeOnly = true } = {}) {
  return actor?.effects?.find(effect => effect.getFlag(MODULE_ID, FLAGS.FOREST_ROOT_EFFECT) && (!activeOnly || isEffectActive(effect)));
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

export async function syncDarkGuard(actor) {
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

function forestPassiveDefinitions(actor) {
  const definitions = [];

  const barkskin = findFeature(actor, "forest-barkskin");
  if (barkskin) {
    definitions.push(flaggedPassiveEffectData(MODULE_ID, FLAGS.FOREST_PASSIVE, {
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
    definitions.push(flaggedPassiveEffectData(MODULE_ID, FLAGS.FOREST_PASSIVE, {
      key: "oak-heart",
      feature: oakHeart,
      name: "Сердце дуба",
      img: oakHeart.img,
      changes: [
        { key: "system.details.type.value", type: "override", value: "plant", phase: "initial", priority: 100 },
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
    definitions.push(flaggedPassiveEffectData(MODULE_ID, FLAGS.FOREST_PASSIVE, {
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
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  return syncFlaggedPassiveEffects(actor, forestPassiveSyncs, MODULE_ID, FLAGS.FOREST_PASSIVE, forestPassiveDefinitions);
}

export async function takeRoot(actor) {
  if (!actor || !hasFeature(actor, "take-root")) return false;
  if (forestRootEffect(actor)) {
    notify(`${actor.name} уже укоренён.`, "warn");
    return false;
  }
  const data = {
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
  };
  const existing = forestRootEffect(actor, { activeOnly: false });
  if (existing) await existing.update(data, { [MODULE_ID]: { reactivate: true } });
  else await actor.createEmbeddedDocuments("ActiveEffect", [data]);
  notify(`${actor.name} пустил корни: скорость 0, эффективная Ловкость 1.`);
  return true;
}

export async function withdrawRoots(actor) {
  const effect = forestRootEffect(actor, { activeOnly: false });
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

export function validateForestAction(actor, action) {
  if (action === "choose-forest-base-class") {
    if (actor && forestLordClass(actor) && forestNatureClasses(actor).length) return true;
    notify("Выбор базового природного класса требует Лесного владыку и класс Друид или Следопыт.", "warn");
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
  return true;
}

function hasStoredItemFlag(item, key) {
  return Object.hasOwn(item?.flags?.[MODULE_ID] ?? {}, key);
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

export function applyForestLordSpellProgression(progression, actor, cls, count) {
  const identifier = itemIdentifier(cls);
  const baseClass = forestBaseClassIdentifier(actor);
  if (!forestLordClass(actor) || identifier !== baseClass) return true;
  const rounding = count === 1 ? Math.ceil : Math.floor;
  const effectiveLevel = Number(cls.system?.levels ?? 0) + forestLordLevel(actor);
  progression.spell += identifier === "druid" ? effectiveLevel : rounding(effectiveLevel / 2);
  return false;
}

export async function beginForestTurn(actor, combat) {
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

export async function endForestTurn(actor, combat) {
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

export async function clearForestCombatState(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  if (actor.getFlag(MODULE_ID, FLAGS.FOREST_ROOT_FIRE_BLOCK)) {
    await actor.unsetFlag(MODULE_ID, FLAGS.FOREST_ROOT_FIRE_BLOCK);
  }
  if (actor.getFlag(MODULE_ID, FLAGS.FOREST_ROOT_CLEAR_AT_TURN)) {
    await actor.unsetFlag(MODULE_ID, FLAGS.FOREST_ROOT_CLEAR_AT_TURN);
  }
}

export async function markForestRootFireDamage(token, { damageItem }, { automationEnabled = true } = {}) {
  const actor = token?.actor;
  if (!automationEnabled || !actor || !forestRootEffect(actor)) return;
  const calculatedDamage = damageItem?.damageDetails?.combinedDamage
    ?? damageItem?.damageDetail
    ?? [];
  const tookFireDamage = calculatedDamage.some(
    detail => detail.type === "fire" && Number(detail.value ?? detail.damage ?? 0) > 0
  );
  if (tookFireDamage) {
    await actor.setFlag(MODULE_ID, FLAGS.FOREST_ROOT_FIRE_BLOCK, true);
    await actor.unsetFlag(MODULE_ID, FLAGS.FOREST_ROOT_CLEAR_AT_TURN);
  }
}

function actorFromEffect(effect) {
  if (effect?.parent instanceof Actor) return effect.parent;
  if (effect?.parent instanceof Item) return effect.parent.actor;
  return null;
}

export async function clearForestRootStateFromEffect(effect) {
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
