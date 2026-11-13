import { FLAGS, MODULE_ID, SETTINGS } from "../shared/constants.mjs";
import { isEffectActive, temporaryEffectTiming } from "../effects/temporary-effects.mjs";
import {
  activityActor,
  activityItem,
  automationData,
  findFeature,
  hasFeature,
  isAutomationAuthority,
  itemIdentifier,
  itemUses,
  notify
} from "../shared/helpers.mjs";

const blinkerSyncs = new Set();

export function blinkerClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "blinker");
}

export function blinkerLevel(actor) {
  return Number(blinkerClass(actor)?.system?.levels ?? 0);
}

function hasArcanaProficiency(actor) {
  const arcana = actor?.system?.skills?.arc;
  const value = Number(arcana?.value ?? arcana?.proficient ?? 0);
  return value > 0 || arcana?.proficient === true;
}

export function blinkerPrerequisiteFailures(actor) {
  const failures = [];
  if (Number(actor?.system?.abilities?.int?.value ?? 0) < 13) failures.push("Интеллект 13");
  if (Number(actor?.system?.abilities?.wis?.value ?? 0) < 13) failures.push("Мудрость 13");
  if (!hasArcanaProficiency(actor)) failures.push("владение навыком Магия");
  if (Number(actor?.system?.details?.level ?? 0) < 3) failures.push("3-й уровень персонажа");
  return failures;
}

export function validateBlinkerPrerequisites(item, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  if (!actor || item.type !== "class" || itemIdentifier(item) !== "blinker") return true;
  const failures = blinkerPrerequisiteFailures(actor);
  if (failures.length) {
    notify(
      `Нельзя добавить класс «Мерцающий». Не выполнено: ${failures.join(", ")}. Специальное задание или учителя подтверждает Мастер.`,
      "error"
    );
    return false;
  }
  return true;
}

export function validateBlinkerFeaturePrerequisites(item, options, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  const data = automationData(item);
  if (!actor || data.blinkerFeature !== true || options?.isAdvancement) return true;
  const level = blinkerLevel(actor);
  if (!level) {
    notify(`Особенность «${item.name}» требует класс «Мерцающий».`, "error");
    return false;
  }
  const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
  if (requiredLevel && level < requiredLevel) {
    notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Мерцающего.`, "error");
    return false;
  }
  return true;
}

function currentMax(item) {
  return String(item?.system?.uses?.max ?? "");
}

async function syncUses(feature, maximum) {
  if (!feature) return false;
  const max = String(Math.max(0, maximum));
  const spent = Number(feature.system?.uses?.spent ?? 0);
  const update = {};
  if (currentMax(feature) !== max) update["system.uses.max"] = max;
  if (Number.isFinite(spent) && spent > Number(max)) update["system.uses.spent"] = Number(max);
  if (!Object.keys(update).length) return false;
  await feature.update(update);
  return true;
}

export async function syncBlinkerResources(actor, { notifyResult = false } = {}) {
  if (!actor?.isOwner || !isAutomationAuthority(actor) || blinkerSyncs.has(actor.uuid)) return false;
  const level = blinkerLevel(actor);
  if (!level) return false;

  blinkerSyncs.add(actor.uuid);
  try {
    const updates = [
      await syncUses(findFeature(actor, "inner-blink"), level),
      await syncUses(findFeature(actor, "turnaround-blink"), 1),
      await syncUses(findFeature(actor, "blinking-step"), 1),
      await syncUses(findFeature(actor, "blinking-wrist"), 2),
      await syncUses(findFeature(actor, "shift-sense"), 3),
      await syncUses(findFeature(actor, "miraculous-homecoming"), 2)
    ];
    const changed = updates.some(Boolean);
    if (notifyResult && changed) notify(`${actor.name}: ресурсы Мерцающего синхронизированы.`);
    return changed;
  } finally {
    blinkerSyncs.delete(actor.uuid);
  }
}

export function blinkDistance(actor) {
  const walk = Number(actor?.system?.attributes?.movement?.walk ?? 0);
  const base = Number.isFinite(walk) && walk > 0 ? walk : 30;
  const level = blinkerLevel(actor);
  if (level >= 5 || hasFeature(actor, "disappearance")) return base * 2;
  if (level >= 3 || hasFeature(actor, "improved-technique")) return base;
  return base / 2;
}

function blinkDistanceText(actor) {
  const distance = blinkDistance(actor);
  const value = Number.isInteger(distance) ? String(distance) : distance.toFixed(1);
  return `${value} фут.`;
}

function blinkResource(actor) {
  return findFeature(actor, "inner-blink");
}

export function validateBlinkUse(actor) {
  if (!actor || !blinkerClass(actor)) {
    notify("Эта активность требует класс «Мерцающий».", "warn");
    return false;
  }
  const feature = blinkResource(actor);
  const uses = itemUses(feature);
  if (feature && uses.remaining > 0) return true;
  notify("Недостаточно очков мерцания. Завершите короткий или продолжительный отдых.", "warn");
  return false;
}

async function spendBlink(actor, label) {
  const feature = blinkResource(actor);
  const uses = itemUses(feature);
  if (!feature || uses.remaining <= 0) {
    notify("Недостаточно очков мерцания. Завершите короткий или продолжительный отдых.", "warn");
    return false;
  }
  await feature.update({ "system.uses.spent": uses.spent + 1 });
  notify(`${actor.name}: ${label}. Дистанция мерцания сейчас ${blinkDistanceText(actor)}.`);
  return true;
}

export async function useInnerBlink(actor) {
  return spendBlink(actor, "использовано «Внутреннее Мерцание»");
}

export async function useOuterBlink(actor) {
  return spendBlink(actor, "использовано «Внешнее Мерцание»");
}

function sideShiftEffect(actor) {
  return actor?.effects?.find(effect => effect.getFlag(MODULE_ID, FLAGS.BLINKER_SIDE_SHIFT_EFFECT));
}

export async function activateSidewaysShift(actor) {
  if (!actor || !blinkerClass(actor)) {
    notify("Эта активность требует класс «Мерцающий».", "warn");
    return false;
  }
  const feature = findFeature(actor, "sideways-shift");
  if (!feature) {
    notify("Для Сдвига в сторону требуется одноимённая особенность.", "warn");
    return false;
  }

  const data = {
    name: "Сдвиг в сторону",
    img: feature.img,
    origin: feature.uuid,
    transfer: false,
    disabled: false,
    showIcon: 1,
    statuses: [],
    flags: {
      [MODULE_ID]: {
        [FLAGS.BLINKER_SIDE_SHIFT_EFFECT]: true
      }
    },
    ...temporaryEffectTiming(game.combat?.started ? { turns: 0, expiry: "turnEnd" } : { seconds: 6 }),
    system: {
      changes: [
        {
          key: "flags.midi-qol.advantage.attack.all",
          type: "custom",
          value: "true",
          phase: "initial",
          priority: 20
        }
      ]
    }
  };

  const current = sideShiftEffect(actor);
  if (current) await current.update(data);
  else await actor.createEmbeddedDocuments("ActiveEffect", [data]);
  notify(`${actor.name}: активирован «Сдвиг в сторону» до конца хода.`);
  return true;
}

function appendRollPart(roll, part) {
  if (!roll || !part) return;
  roll.parts ??= [];
  roll.parts.push(String(part));
}

function isAttackActivity(activity, item) {
  if (activity?.type === "attack") return true;
  if (activity?.attack?.type) return true;
  return item?.type === "weapon";
}

export function applyBlinkerDamageAutomation(config) {
  const activity = config?.subject;
  const actor = activityActor(activity);
  const item = activityItem(activity);
  if (!actor || !isEffectActive(sideShiftEffect(actor)) || !isAttackActivity(activity, item)) return;
  const bonus = Number(actor.system?.attributes?.prof ?? 0);
  if (!Number.isFinite(bonus) || bonus <= 0) return;
  appendRollPart(config.rolls?.[0], `${bonus}`);
}
