import { FLAGS, MODULE_ID, SETTINGS } from "../shared/constants.mjs";
import {
  automationData,
  findFeature,
  hasFeature,
  isAutomationAuthority,
  itemIdentifier,
  notify
} from "../shared/helpers.mjs";

export function soulEaterClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "soul-eater");
}

export function soulEaterLevel(actor) {
  return Number(soulEaterClass(actor)?.system?.levels ?? 0);
}

export function soulEaterPrerequisiteFailures(actor) {
  const failures = [];
  if (Number(actor?.system?.details?.level ?? 0) < 5) failures.push("5-й уровень персонажа");
  return failures;
}

export function validateSoulEaterPrerequisites(item, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  if (!actor || item.type !== "class" || itemIdentifier(item) !== "soul-eater") return true;
  const failures = soulEaterPrerequisiteFailures(actor);
  if (failures.length) {
    notify(
      `Нельзя добавить класс «Пожиратель душ». Не выполнено: ${failures.join(", ")}. Событие на грани смерти и особый ритуал подтверждает Мастер.`,
      "error"
    );
    return false;
  }
  return true;
}

export function validateSoulEaterFeaturePrerequisites(item, options, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  const data = automationData(item);
  if (!actor || data.soulEaterFeature !== true || options?.isAdvancement) return true;
  const level = soulEaterLevel(actor);
  if (!level) {
    notify(`Особенность «${item.name}» требует класс «Пожиратель душ».`, "error");
    return false;
  }
  const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
  if (requiredLevel && level < requiredLevel) {
    notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Пожирателя душ.`, "error");
    return false;
  }
  return true;
}

function soulShardEffect(actor) {
  return actor?.effects?.find(effect => effect.getFlag(MODULE_ID, FLAGS.SOUL_SHARD_EFFECT));
}

export async function activateSoulShard(actor) {
  if (!actor?.isOwner || !hasFeature(actor, "soul-shard")) return false;
  const feature = findFeature(actor, "soul-shard");
  const changes = [
    {
      key: "system.abilities.str.value",
      type: "add",
      value: "2",
      phase: "initial",
      priority: 20
    },
    {
      key: "system.abilities.con.value",
      type: "add",
      value: "2",
      phase: "initial",
      priority: 20
    }
  ];
  const current = soulShardEffect(actor);
  if (current) {
    await current.update({
      name: "Осколок души",
      img: feature?.img ?? "icons/magic/unholy/hand-claw-fire-blue.webp",
      origin: feature?.uuid ?? null,
      "system.changes": changes
    });
    notify(`${actor.name}: эффект «Осколок души» обновлён.`);
    return true;
  }
  await actor.createEmbeddedDocuments("ActiveEffect", [
    {
      name: "Осколок души",
      img: feature?.img ?? "icons/magic/unholy/hand-claw-fire-blue.webp",
      origin: feature?.uuid ?? null,
      transfer: false,
      disabled: false,
      showIcon: 1,
      statuses: [],
      flags: {
        [MODULE_ID]: {
          [FLAGS.SOUL_SHARD_EFFECT]: true
        }
      },
      system: {
        changes
      }
    }
  ]);
  notify(`${actor.name}: активирован «Осколок души» (+2 Сила, +2 Телосложение до конца боя).`);
  return true;
}

// deleteCombat fires on every client: only the automation authority may delete,
// otherwise the GM and the owning player both try and the second delete fails.
export async function clearSoulShard(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  const effect = soulShardEffect(actor);
  if (effect) await effect.delete();
}
