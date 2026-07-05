import { FLAGS, MODULE_ID } from "../shared/constants.mjs";
import { findFeature, hasFeature, isAutomationAuthority, itemIdentifier, notify } from "../shared/helpers.mjs";
import { deathKnightClass, paladinClass } from "../shared/selectors.mjs";
import {
  flaggedPassiveEffectData,
  syncFlaggedPassiveEffects
} from "../effects/passive-helpers.mjs";

const deathKnightPassiveSyncs = new Set();
const mysticalPowerSyncs = new Set();

function deathKnightPassiveDefinitions(actor) {
  if (!deathKnightClass(actor)) return [];
  const definitions = [];

  const undeadNature = findFeature(actor, "undead-nature");
  if (undeadNature) {
    definitions.push(flaggedPassiveEffectData(MODULE_ID, FLAGS.DEATH_KNIGHT_PASSIVE, {
      key: "undead-nature",
      feature: undeadNature,
      changes: [
        { key: "system.details.type.value", type: "override", value: "undead", phase: "initial", priority: 100 },
        { key: "system.attributes.senses.ranges.darkvision", type: "upgrade", value: "120", phase: "final", priority: 20 },
        { key: "system.traits.di.value", type: "custom", value: "poison", phase: "initial", priority: 20 },
        { key: "system.traits.ci.value", type: "custom", value: "poisoned", phase: "initial", priority: 20 },
        { key: "system.traits.ci.value", type: "custom", value: "diseased", phase: "initial", priority: 20 }
      ]
    }));
  }

  const magicResistance = findFeature(actor, "death-knight-magic-resistance");
  if (magicResistance) {
    definitions.push(flaggedPassiveEffectData(MODULE_ID, FLAGS.DEATH_KNIGHT_PASSIVE, {
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
    definitions.push(flaggedPassiveEffectData(MODULE_ID, FLAGS.DEATH_KNIGHT_PASSIVE, {
      key: "strong-undead",
      feature: strongUndead,
      changes: [
        { key: "system.traits.di.value", type: "custom", value: "necrotic", phase: "initial", priority: 20 },
        { key: "system.traits.ci.value", type: "custom", value: "exhaustion", phase: "initial", priority: 20 },
        { key: "system.traits.ci.value", type: "custom", value: "frightened", phase: "initial", priority: 20 }
      ]
    }));
  }

  return definitions;
}

export async function syncDeathKnightPassiveEffects(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  return syncFlaggedPassiveEffects(actor, deathKnightPassiveSyncs, MODULE_ID, FLAGS.DEATH_KNIGHT_PASSIVE, deathKnightPassiveDefinitions);
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

export function isDeathKnightHealingBlocked(workflow, targetActor) {
  if (!hasFeature(targetActor, "undead-nature")) return false;
  const ownLayOnHands = itemIdentifier(workflow?.item) === "lay-on-hands"
    && workflow?.actor?.uuid === targetActor?.uuid;
  if (ownLayOnHands) return false;
  const isHealingPotion = workflow?.item?.type === "consumable" && workflow.item.system?.type?.value === "potion";
  return workflow?.item?.type === "spell" || isHealingPotion;
}
