import { FLAGS, MODULE_ID, SETTINGS } from "../shared/constants.mjs";
import { automationData, itemIdentifier, notify } from "../shared/helpers.mjs";

const fallenPriestSyncs = new Set();

export function fallenPriestClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "fallen-priest");
}

export function fallenPriestLevel(actor) {
  return Number(fallenPriestClass(actor)?.system?.levels ?? 0);
}

function clericClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "cleric");
}

function clericLevel(actor) {
  return Number(clericClass(actor)?.system?.levels ?? 0);
}

function hasReligionProficiency(actor) {
  const religion = actor?.system?.skills?.rel;
  const value = Number(religion?.value ?? religion?.proficient ?? 0);
  return value > 0 || religion?.proficient === true;
}

export function fallenPriestPrerequisiteFailures(actor) {
  const failures = [];
  if (!hasReligionProficiency(actor)) failures.push("владение навыком Религия");
  return failures;
}

export function validateFallenPriestPrerequisites(item, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  if (!actor || item.type !== "class" || itemIdentifier(item) !== "fallen-priest") return true;
  const failures = fallenPriestPrerequisiteFailures(actor);
  if (failures.length) {
    notify(
      `Нельзя добавить класс «Падший жрец». Не выполнено: ${failures.join(", ")}. Отступничество и прежний доступ к божественной магии 3-го круга подтверждает Мастер.`,
      "error"
    );
    return false;
  }
  return true;
}

export function validateFallenPriestFeaturePrerequisites(item, options, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  const data = automationData(item);
  if (!actor || data.fallenPriestFeature !== true || options?.isAdvancement) return true;
  const level = fallenPriestLevel(actor);
  if (!level) {
    notify(`Особенность «${item.name}» требует класс «Падший жрец».`, "error");
    return false;
  }
  const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
  if (requiredLevel && level < requiredLevel) {
    notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Падшего жреца.`, "error");
    return false;
  }
  return true;
}

function hasStoredItemFlag(item, key) {
  return Object.hasOwn(item?.flags?.[MODULE_ID] ?? {}, key);
}

export async function syncFallenPriestSpellcasting(actor, { notifyResult = false } = {}) {
  if (!actor?.isOwner || fallenPriestSyncs.has(actor.uuid)) return false;
  fallenPriestSyncs.add(actor.uuid);
  try {
    const cleric = clericClass(actor);
    const active = Boolean(fallenPriestClass(actor) && cleric);
    const updates = [];

    if (cleric) {
      const current = String(cleric.system.spellcasting?.preparation?.formula ?? "");
      const stored = hasStoredItemFlag(cleric, FLAGS.FALLEN_PRIEST_ORIGINAL_PREPARATION);
      if (active) {
        const formula = "@abilities.wis.mod + @classes.cleric.levels + @classes.fallen-priest.levels";
        const update = { _id: cleric.id };
        let changed = false;
        if (!stored) {
          update[`flags.${MODULE_ID}.${FLAGS.FALLEN_PRIEST_ORIGINAL_PREPARATION}`] = current;
          changed = true;
        }
        if (current !== formula) {
          update["system.spellcasting.preparation.formula"] = formula;
          changed = true;
        }
        if (changed) updates.push(update);
      } else if (stored) {
        updates.push({
          _id: cleric.id,
          "system.spellcasting.preparation.formula":
            cleric.getFlag(MODULE_ID, FLAGS.FALLEN_PRIEST_ORIGINAL_PREPARATION) ?? "",
          [`flags.${MODULE_ID}.-=${FLAGS.FALLEN_PRIEST_ORIGINAL_PREPARATION}`]: null
        });
      }
    }

    if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
    if (notifyResult) {
      if (active) notify(`${actor.name}: «Чтение заклинаний» Падшего жреца синхронизировано с Жрецом.`);
      else notify(`${actor.name}: для автоматической прогрессии Падшего жреца нужен класс «Жрец» на листе.`);
    }
    return updates.length > 0;
  } finally {
    fallenPriestSyncs.delete(actor.uuid);
  }
}

export function applyFallenPriestSpellProgression(progression, actor, cls, extraLevels = 0) {
  if (!fallenPriestClass(actor) || itemIdentifier(cls) !== "cleric") return true;
  const effectiveLevel = clericLevel(actor) + fallenPriestLevel(actor) + extraLevels;
  progression.spell += effectiveLevel;
  return false;
}
