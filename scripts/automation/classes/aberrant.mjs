import { FLAGS, MODULE_ID } from "../shared/constants.mjs";
import {
  activityActor,
  activityItem,
  findFeature,
  hasFeature,
  isAutomationAuthority,
  notify
} from "../shared/helpers.mjs";
import { abilityMod, clamp, sizeNumber } from "../shared/dnd5e.mjs";
import { aberrantLevel } from "../shared/selectors.mjs";
import { flaggedPassiveEffectData, syncFlaggedPassiveEffects } from "../effects/passive-helpers.mjs";

const aberrantPassiveSyncs = new Set();

function appendRollPart(roll, part) {
  if (!roll || !part) return;
  roll.parts ??= [];
  roll.parts.push(String(part));
}

export function applyAberrantNativeAttackAutomation(config) {
  const activity = config?.subject;
  const actor = activityActor(activity);
  const attackItem = activityItem(activity);
  const roll = config.rolls?.[0];
  const properties = attackItem?.system?.properties;
  const heavy =
    typeof properties?.has === "function" ? properties.has("hvy") : Array.from(properties ?? []).includes("hvy");
  if (
    actor?.getFlag(MODULE_ID, FLAGS.DEADLY_PRECISION_ARMED) &&
    attackItem?.type === "weapon" &&
    Number(attackItem.system?.proficient ?? 0) > 0 &&
    !heavy &&
    roll
  ) {
    const denomination = [4, 6, 8, 10, 12][clamp(aberrantLevel(actor), 1, 5) - 1];
    appendRollPart(roll, `1d${denomination}`);
    void actor.unsetFlag(MODULE_ID, FLAGS.DEADLY_PRECISION_ARMED);
  }
}

function aberrantPassiveDefinitions(actor) {
  const definitions = [];
  const level = clamp(aberrantLevel(actor), 0, 5);
  const reflexes = findFeature(actor, "monster-reflexes");
  if (reflexes && level > 0) {
    const bonus = [0, 5, 10, 10, 15, 15][level];
    definitions.push(
      flaggedPassiveEffectData(MODULE_ID, FLAGS.ABERRANT_PASSIVE, {
        key: "monster-reflexes",
        feature: reflexes,
        name: "Рефлексы чудовища",
        img: reflexes.img,
        changes: [
          {
            key: "system.attributes.movement.walk",
            type: "add",
            value: String(bonus),
            phase: "final",
            priority: 20
          }
        ]
      })
    );
  }

  const toxicBlood = findFeature(actor, "toxic-blood");
  if (toxicBlood) {
    definitions.push(
      flaggedPassiveEffectData(MODULE_ID, FLAGS.ABERRANT_PASSIVE, {
        key: "toxic-blood",
        feature: toxicBlood,
        name: "Токсичная кровь",
        img: toxicBlood.img,
        changes: [
          { key: "system.traits.dr.value", type: "custom", value: "poison", phase: "initial", priority: 20 },
          { key: "system.traits.ci.value", type: "custom", value: "poisoned", phase: "initial", priority: 20 }
        ]
      })
    );
  }

  const burnedVeins = findFeature(actor, "aberrant-burned-veins");
  if (burnedVeins) {
    definitions.push(
      flaggedPassiveEffectData(MODULE_ID, FLAGS.ABERRANT_PASSIVE, {
        key: "aberrant-burned-veins",
        feature: burnedVeins,
        name: "Сгоревшие вены",
        img: burnedVeins.img,
        changes: [{ key: "system.traits.dr.value", type: "custom", value: "acid", phase: "initial", priority: 20 }]
      })
    );
  }

  const catEyes = findFeature(actor, "aberrant-cat-eyes");
  if (catEyes) {
    definitions.push(
      flaggedPassiveEffectData(MODULE_ID, FLAGS.ABERRANT_PASSIVE, {
        key: "aberrant-cat-eyes",
        feature: catEyes,
        name: "Кошачьи глаза",
        img: catEyes.img,
        changes: [
          { key: "system.attributes.senses.ranges.darkvision", type: "add", value: "30", phase: "final", priority: 20 }
        ]
      })
    );
  }

  const albino = findFeature(actor, "aberrant-albino");
  if (albino) {
    definitions.push(
      flaggedPassiveEffectData(MODULE_ID, FLAGS.ABERRANT_PASSIVE, {
        key: "aberrant-albino",
        feature: albino,
        name: "Альбинос",
        img: albino.img,
        changes: [{ key: "system.skills.itm.roll.mode", type: "upgrade", value: "1", phase: "final", priority: 20 }]
      })
    );
  }

  const finalStrength = findFeature(actor, "final-changes-strength");
  const finalDexterity = findFeature(actor, "final-changes-dexterity");
  const finalChange = finalStrength ?? finalDexterity;
  if (finalChange) {
    const ability = finalStrength ? "str" : "dex";
    definitions.push(
      flaggedPassiveEffectData(MODULE_ID, FLAGS.ABERRANT_PASSIVE, {
        key: finalStrength ? "final-changes-strength" : "final-changes-dexterity",
        feature: finalChange,
        name: finalChange.name,
        img: finalChange.img,
        changes: [
          { key: `system.abilities.${ability}.value`, type: "add", value: "2", phase: "initial", priority: 20 },
          {
            key: "system.attributes.senses.ranges.blindsight",
            type: "upgrade",
            value: "30",
            phase: "final",
            priority: 20
          }
        ]
      })
    );
  }

  return definitions;
}

export async function syncAberrantPassiveEffects(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  return syncFlaggedPassiveEffects(
    actor,
    aberrantPassiveSyncs,
    MODULE_ID,
    FLAGS.ABERRANT_PASSIVE,
    aberrantPassiveDefinitions
  );
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
  const roll = await new Roll(`1d${denomination} + @abilities.con.mod`, actor.getRollData(), {
    flavor: "Энергичная природа"
  }).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: "Энергичная природа: временные хиты"
  });
  const current = Number(actor.system.attributes?.hp?.temp ?? 0);
  await actor.update({ "system.attributes.hp.temp": Math.max(current, Number(roll.total ?? 0)) });
  return true;
}

export function validateAberrantAction(actor, action) {
  if (action === "arm-deadly-precision" && actor?.getFlag(MODULE_ID, FLAGS.DEADLY_PRECISION_ARMED)) {
    notify(`${actor.name}: Смертельная точность уже подготовлена.`, "warn");
    return false;
  }
  return true;
}

export async function applyGiantKiller(
  token,
  { workflow, damageItem },
  { automationEnabled = true, isMassiveWeapon, recalculateDamageItem }
) {
  if (!automationEnabled || !workflow?.actor || !token?.actor || !isMassiveWeapon(workflow.item)) return;
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
  const rawDamage = foundry.utils.deepClone(damageItem.damageDetails?.[rawKey] ?? damageItem.rawDamageDetail ?? []);
  const type =
    workflow.defaultDamageType ??
    rawDamage.find(detail => !["midi-none", "temphp", "healing"].includes(detail.type))?.type ??
    "bludgeoning";
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
