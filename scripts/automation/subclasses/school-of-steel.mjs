import { FLAGS, MODULE_ID } from "../shared/constants.mjs";
import {
  findFeature,
  hasFeature,
  isAutomationAuthority,
  itemIdentifier,
  notify
} from "../shared/helpers.mjs";
import { abilityMod } from "../shared/dnd5e.mjs";
import { choiceDialog, multiChoiceDialog } from "../shared/dialogs.mjs";
import {
  schoolOfSteelLevel,
  schoolOfSteelSubclass
} from "../shared/selectors.mjs";

export const SCHOOL_OF_STEEL_ACTIONS = new Set([
  "school-steel-choose-weapons",
  "school-steel-bonus-attack",
  "sync-school-steel"
]);

const schoolSteelSyncs = new Set();

function schoolSteelBattleTrainingFeature(actor) {
  return findFeature(actor, "steel-battle-training");
}

function schoolSteelWeaponLimit(actor) {
  return hasFeature(actor, "steel-signature-technique") || schoolOfSteelLevel(actor) >= 14 ? 3 : 1;
}

function schoolSteelBattleTrainingMaximum(actor) {
  return Math.max(1, abilityMod(actor, "int"));
}

function schoolSteelBattleTrainingUses(actor) {
  const feature = schoolSteelBattleTrainingFeature(actor);
  const maximum = schoolSteelBattleTrainingMaximum(actor);
  const spent = Number(feature?.system?.uses?.spent ?? 0);
  return {
    feature,
    maximum,
    spent: Number.isFinite(spent) ? spent : 0,
    remaining: Math.max(0, maximum - (Number.isFinite(spent) ? spent : 0))
  };
}

function schoolSteelWeaponIds(actor) {
  const value = actor?.getFlag(MODULE_ID, FLAGS.SCHOOL_STEEL_WEAPONS);
  return Array.isArray(value) ? value.filter(id => actor.items?.get(id)?.type === "weapon") : [];
}

function schoolSteelWeaponNames(actor) {
  return schoolSteelWeaponIds(actor)
    .map(id => actor.items.get(id)?.name)
    .filter(Boolean);
}

function animateObjectsSpell(actor) {
  return actor?.items?.find(item => {
    if (item.type !== "spell") return false;
    const identifier = itemIdentifier(item);
    const name = String(item.name ?? "").toLocaleLowerCase("ru");
    return identifier === "animate-objects"
      || name.includes("animate objects")
      || name.includes("оживление предметов")
      || name.includes("оживление вещей");
  });
}

export async function syncSchoolOfSteel(actor, { notifyResult = false } = {}) {
  if (!actor?.isOwner || !isAutomationAuthority(actor) || schoolSteelSyncs.has(actor.uuid)) return;
  schoolSteelSyncs.add(actor.uuid);
  try {
    if (!schoolOfSteelSubclass(actor)) return;

    const battleTraining = schoolSteelBattleTrainingUses(actor);
    if (battleTraining.feature) {
      const update = {};
      const maximum = String(battleTraining.maximum);
      if (String(battleTraining.feature.system?.uses?.max ?? "") !== maximum) {
        update["system.uses.max"] = maximum;
      }
      if (battleTraining.spent > battleTraining.maximum) {
        update["system.uses.spent"] = battleTraining.maximum;
      }
      if (Object.keys(update).length) await battleTraining.feature.update(update);
    }

    if (hasFeature(actor, "steel-master-of-metal")) {
      const spell = animateObjectsSpell(actor);
      if (spell?.system?.preparation) {
        const update = {};
        if (spell.system.preparation.mode !== "prepared") update["system.preparation.mode"] = "prepared";
        if (spell.system.preparation.prepared !== true) update["system.preparation.prepared"] = true;
        if (Object.keys(update).length) await spell.update(update);
      }
    }

    if (notifyResult) {
      notify(`${actor.name}: Школа стали синхронизирована. Бонусные атаки: ${battleTraining.maximum}.`);
    }
  } finally {
    schoolSteelSyncs.delete(actor.uuid);
  }
}

async function chooseSingleSchoolSteelWeapon(actor, weapons, current) {
  if (weapons.length === 1) return [weapons[0].id];
  const selectedId = await choiceDialog({
    title: "Боевая тренировка",
    label: "Зачарованное оружие",
    choices: weapons.map(weapon => ({ value: weapon.id, label: weapon.name, selected: current.has(weapon.id) })),
    confirmLabel: "Зачаровать",
    confirmIcon: "fa-solid fa-wand-magic-sparkles"
  });
  return selectedId ? [selectedId] : [];
}

async function chooseMultipleSchoolSteelWeapons(actor, weapons, current, limit) {
  const selectedIds = await multiChoiceDialog({
    title: "Боевая тренировка",
    label: "Зачарованное оружие",
    choices: weapons.map(weapon => ({ value: weapon.id, label: weapon.name })),
    selected: [...current],
    max: limit,
    hint: `Выберите до ${limit} зачарованных оружий.`,
    confirmLabel: "Зачаровать",
    confirmIcon: "fa-solid fa-wand-magic-sparkles",
    inputName: "weapon"
  });
  return selectedIds ?? [];
}

export async function chooseSchoolSteelWeapons(actor) {
  if (!actor || !hasFeature(actor, "steel-battle-training")) return false;
  const weapons = actor.items.filter(item => item.type === "weapon");
  if (!weapons.length) {
    notify("У персонажа нет оружия для зачарования Боевой тренировкой.", "warn");
    return false;
  }

  const limit = schoolSteelWeaponLimit(actor);
  const current = new Set(schoolSteelWeaponIds(actor));
  const selectedIds = limit <= 1
    ? await chooseSingleSchoolSteelWeapon(actor, weapons, current)
    : await chooseMultipleSchoolSteelWeapons(actor, weapons, current, limit);
  const uniqueIds = [...new Set(selectedIds)].filter(id => actor.items.get(id)?.type === "weapon");
  if (!uniqueIds.length) return false;
  if (uniqueIds.length > limit) {
    notify(`Боевая тренировка позволяет зачаровать максимум ${limit} оруж.`, "warn");
    return false;
  }

  await actor.setFlag(MODULE_ID, FLAGS.SCHOOL_STEEL_WEAPONS, uniqueIds);
  const names = uniqueIds.map(id => actor.items.get(id)?.name).filter(Boolean).join(", ");
  notify(`${actor.name}: зачарованное оружие Школы стали — ${names}.`);
  return true;
}

export function reportSchoolSteelBonusAttack(actor) {
  const names = schoolSteelWeaponNames(actor);
  if (!names.length) return;
  notify(`${actor.name}: бонусная атака Боевой тренировки должна быть совершена одним из зачарованных оружий: ${names.join(", ")}.`);
}
export function isSchoolOfSteelAction(action) {
  return SCHOOL_OF_STEEL_ACTIONS.has(action);
}

export async function handleSchoolOfSteelAction(actor, _activity, action) {
  switch (action) {
    case "school-steel-choose-weapons":
      return chooseSchoolSteelWeapons(actor);
    case "school-steel-bonus-attack":
      reportSchoolSteelBonusAttack(actor);
      return true;
    case "sync-school-steel":
      await syncSchoolOfSteel(actor, { notifyResult: true });
      return true;
    default:
      return false;
  }
}
export function validateSchoolOfSteelAction(actor, action) {
  if (action === "school-steel-choose-weapons") {
    if (actor && schoolOfSteelSubclass(actor) && hasFeature(actor, "steel-battle-training")) return true;
    notify("Выбор зачарованного оружия требует подкласс «Школа стали» и особенность «Боевая тренировка».", "warn");
    return false;
  }
  if (action === "school-steel-bonus-attack") {
    const resource = schoolSteelBattleTrainingUses(actor);
    if (!actor || !schoolOfSteelSubclass(actor) || !resource.feature) {
      notify("Бонусная атака требует подкласс «Школа стали» и особенность «Боевая тренировка».", "warn");
      return false;
    }
    if (!schoolSteelWeaponIds(actor).length) {
      notify("Сначала выберите зачарованное оружие действием «Зачаровать оружие».", "warn");
      return false;
    }
    if (resource.remaining < 1) {
      notify("Нет доступных использований бонусной атаки Боевой тренировки.", "warn");
      return false;
    }
    return true;
  }
  if (action === "sync-school-steel") {
    if (actor && schoolOfSteelSubclass(actor)) return true;
    notify("Синхронизация Школы стали требует подкласс «Школа стали».", "warn");
    return false;
  }
  return true;
}
