import { FLAGS, MODULE_ID } from "./constants.mjs";
import { isEffectActive, temporaryEffectTiming } from "../effects/temporary-effects.mjs";
import {
  activityActor,
  activityItem,
  enabled,
  notify
} from "./helpers.mjs";

function weaponBuffEffect(actor, key) {
  return actor?.effects?.find(effect =>
    effect.getFlag?.(MODULE_ID, FLAGS.WEAPON_BUFF_EFFECT) === key
  );
}

export function activeWeaponBuffs(actor) {
  return [...(actor?.effects ?? [])]
    .filter(effect => isEffectActive(effect) && effect.getFlag?.(MODULE_ID, FLAGS.WEAPON_BUFF_EFFECT))
    .map(effect => ({
      effect,
      key: effect.getFlag(MODULE_ID, FLAGS.WEAPON_BUFF_EFFECT),
      data: effect.getFlag(MODULE_ID, FLAGS.WEAPON_BUFF_DATA) ?? {}
    }));
}

export async function createWeaponBuff(actor, {
  key,
  name,
  sourceItem = null,
  img = null,
  data = {},
  duration = {},
  description = "",
  changes = [],
  replace = true
}) {
  if (!actor) return false;
  const effectData = {
    name,
    img: img ?? sourceItem?.img ?? "icons/magic/weapon/sword-runes-glowing.webp",
    origin: sourceItem?.uuid ?? actor.uuid,
    transfer: false,
    disabled: false,
    showIcon: 1,
    statuses: [],
    description,
    flags: {
      [MODULE_ID]: {
        [FLAGS.WEAPON_BUFF_EFFECT]: key,
        [FLAGS.WEAPON_BUFF_DATA]: data
      }
    },
    ...temporaryEffectTiming({ seconds: 60, ...duration }),
    system: { changes }
  };
  const current = replace ? weaponBuffEffect(actor, key) : null;
  if (current) await current.update(effectData);
  else await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
  return true;
}

function appendRollPart(roll, part) {
  if (!roll || !part) return;
  roll.parts ??= [];
  roll.parts.push(String(part));
}

function isWeaponItem(item) {
  return item?.type === "weapon";
}

function activityClassification(activity) {
  return activity?.attack?.type?.classification
    ?? activity?.system?.attack?.type?.classification
    ?? "";
}

function isWeaponAttack(activity, item) {
  if (!isWeaponItem(item)) return false;
  const classification = activityClassification(activity);
  return !classification || classification === "weapon";
}

function attackType(activity) {
  return activity?.attack?.type?.value
    ?? activity?.system?.attack?.type?.value
    ?? "";
}

function isMeleeWeaponAttack(activity, item) {
  if (!isWeaponAttack(activity, item)) return false;
  const type = attackType(activity);
  if (type) return type === "melee";
  const range = item?.system?.range;
  return !Number(range?.value ?? 0) && !Number(range?.long ?? 0);
}

function spellSlotObject(actor) {
  return actor?.system?.spells ?? {};
}

function hasSpellSlots(actor) {
  for (const value of Object.values(spellSlotObject(actor))) {
    const max = Number(value?.max ?? value?.override ?? value?.value ?? 0);
    if (Number.isFinite(max) && max > 0) return true;
  }
  return false;
}

function targetsHaveSpellSlots(targets) {
  return [...(targets ?? [])].some(token => hasSpellSlots(token?.actor));
}

export function weaponBuffApplies(data, item) {
  return !data.weaponUuids || data.weaponUuids.includes(item?.uuid);
}

function applyCriticalReduction(roll, reduction) {
  const value = Number(reduction ?? 0);
  if (!Number.isFinite(value) || value <= 0 || !roll) return;
  roll.options ??= {};
  const current = Number(roll.options.criticalSuccess ?? 20);
  const threshold = Math.max(1, Math.min(Number.isFinite(current) ? current : 20, 20 - value));
  roll.options.criticalSuccess = threshold;
}

export function applyWeaponBuffAttackAutomation(config) {
  if (!enabled()) return;
  const activity = config?.subject;
  const item = activityItem(activity);
  const actor = activityActor(activity);
  const roll = config?.rolls?.[0];
  if (!actor || !isWeaponAttack(activity, item) || !roll) return;

  for (const { data } of activeWeaponBuffs(actor)) {
    if (!weaponBuffApplies(data, item)) continue;
    if (data.advantageAgainstSpellcasters && config.workflow?.targets?.size === 1 && targetsHaveSpellSlots(config.workflow.targets)) {
      roll.options ??= {};
      roll.options.advantage = true;
    }
    if (data.criticalThresholdReduction && isMeleeWeaponAttack(activity, item)) {
      applyCriticalReduction(roll, data.criticalThresholdReduction);
    }
    if (data.attackBonus) appendRollPart(roll, data.attackBonus);
  }
}

export function applyWeaponBuffDamageAutomation(config) {
  if (!enabled()) return;
  const activity = config?.subject;
  const item = activityItem(activity);
  const actor = activityActor(activity);
  const roll = config?.rolls?.[0];
  if (!actor || !isWeaponAttack(activity, item) || !roll) return;

  for (const { data } of activeWeaponBuffs(actor)) {
    if (!weaponBuffApplies(data, item)) continue;
    if (data.damageBonus) appendRollPart(roll, data.damageBonus);
  }
}

export function applyMidiWeaponBuffAttackAutomation(workflow) {
  if (!enabled()) return;
  if (!workflow?.actor || !isWeaponItem(workflow.item)) return;
  const buffs = activeWeaponBuffs(workflow.actor);
  if (!buffs.length) return;

  const hasSpellcasterTarget = workflow.targets?.size === 1 && targetsHaveSpellSlots(workflow.targets);
  for (const { key, data } of buffs) {
    if (!weaponBuffApplies(data, workflow.item)) continue;
    if (data.advantageAgainstSpellcasters && hasSpellcasterTarget) {
      workflow.attackRollModifierTracker?.advantage?.add?.(
        `${MODULE_ID}.${key}.spellcaster`,
        data.advantageLabel ?? "Оружейный бафф: цель имеет ячейки заклинаний"
      );
    }
  }
}

export function applyWeaponBuffReach(activity) {
  if (!enabled() || !isMeleeWeaponAttack(activity, activity?.item)) return;
  // Native activity hooks receive ephemeral Item clones, never edit owned data.
  if (activity.item === activity.actor?.items?.get?.(activity.item.id)) return;
  const reach = Math.max(0, ...activeWeaponBuffs(activity.actor).filter(({data}) => weaponBuffApplies(data, activity.item)).map(({data}) => Number(data.reach) || 0));
  if (reach) activity.updateSource?.({"range.value": reach, "range.units": "ft", "range.override": true});
}

export async function postWeaponBuffMessage(actor, title, content) {
  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p><strong>${actor?.name ?? "Персонаж"}: ${title}.</strong> ${content}</p>`
  });
}

export function requireWeaponBuffActor(actor, className) {
  if (actor) return true;
  notify(`Эта активность требует персонажа${className ? ` класса «${className}»` : ""}.`, "warn");
  return false;
}
