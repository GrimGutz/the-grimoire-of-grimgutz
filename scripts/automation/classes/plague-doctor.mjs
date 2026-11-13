import { FLAGS, MODULE_ID, SETTINGS } from "../shared/constants.mjs";
import { automationData, findFeature, isAutomationAuthority, itemIdentifier, notify } from "../shared/helpers.mjs";
import { effectKey } from "../shared/system-paths.mjs";

const plagueDoctorSyncs = new Set();

export function plagueDoctorClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "plague-doctor");
}

export function plagueDoctorLevel(actor) {
  return Number(plagueDoctorClass(actor)?.system?.levels ?? 0);
}

function hasMedicineProficiency(actor) {
  const medicine = actor?.system?.skills?.med;
  const value = Number(medicine?.value ?? medicine?.proficient ?? 0);
  return value > 0 || medicine?.proficient === true;
}

export function plagueDoctorPrerequisiteFailures(actor) {
  const failures = [];
  if (Number(actor?.system?.abilities?.con?.value ?? 0) < 15) failures.push("Телосложение 15");
  if (!hasMedicineProficiency(actor)) failures.push("владение навыком Медицина");
  if (Number(actor?.system?.details?.level ?? 0) < 5) failures.push("5-й уровень персонажа");
  return failures;
}

export function validatePlagueDoctorPrerequisites(item, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  if (!actor || item.type !== "class" || itemIdentifier(item) !== "plague-doctor") return true;
  const failures = plagueDoctorPrerequisiteFailures(actor);
  if (failures.length) {
    notify(
      `Нельзя добавить класс «Чумной маг». Не выполнено: ${failures.join(", ")}. Выживание после смертельной или магической инфекции подтверждает Мастер.`,
      "error"
    );
    return false;
  }
  return true;
}

export function validatePlagueDoctorFeaturePrerequisites(item, options, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  const data = automationData(item);
  if (!actor || data.plagueDoctorFeature !== true || options?.isAdvancement) return true;
  const level = plagueDoctorLevel(actor);
  if (!level) {
    notify(`Особенность «${item.name}» требует класс «Чумной маг».`, "error");
    return false;
  }
  const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
  if (requiredLevel && level < requiredLevel) {
    notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Чумного мага.`, "error");
    return false;
  }
  return true;
}

function sneakAttackFormula(actor) {
  return plagueDoctorLevel(actor) >= 4 ? "3d6" : "2d6";
}

export async function rollPlagueSneakAttack(actor) {
  if (!actor || !findFeature(actor, "plague-sneak-attack")) {
    notify("Для броска требуется особенность «Скрытая атака Чумного мага».", "warn");
    return false;
  }
  const formula = sneakAttackFormula(actor);
  const roll = await new Roll(formula, actor.getRollData()).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `Скрытая атака Чумного мага: ${formula}`
  });
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

export async function syncPlagueDoctorResources(actor, { notifyResult = false } = {}) {
  if (!actor?.isOwner || !isAutomationAuthority(actor) || plagueDoctorSyncs.has(actor.uuid)) return false;
  if (!plagueDoctorClass(actor)) return false;

  plagueDoctorSyncs.add(actor.uuid);
  try {
    const updates = [
      await syncUses(findFeature(actor, "touch-of-disease"), 1),
      await syncUses(findFeature(actor, "disease-form"), 1)
    ];
    const changed = updates.some(Boolean);
    if (notifyResult && changed) notify(`${actor.name}: ресурсы Чумного мага синхронизированы.`);
    return changed;
  } finally {
    plagueDoctorSyncs.delete(actor.uuid);
  }
}

function smartInfectionEffects(actor) {
  return actor?.effects?.filter(effect => effect.getFlag(MODULE_ID, FLAGS.SMART_INFECTION_EFFECT)) ?? [];
}

export async function createSmartInfection(actor, activity) {
  if (!actor || !plagueDoctorClass(actor)) {
    notify("Эта активность требует класс «Чумной маг».", "warn");
    return false;
  }
  const feature = findFeature(actor, "smart-infection");
  if (!feature) {
    notify("Для создания агента требуется особенность «Умная инфекция».", "warn");
    return false;
  }
  const cost = Number(automationData(activity).intCost ?? 0);
  if (![1, 2, 3].includes(cost)) {
    notify("Неверная стоимость Умной инфекции.", "warn");
    return false;
  }
  const intelligence = Number(actor.system?.abilities?.int?.value ?? 0);
  if (intelligence - cost < 4) {
    notify(`${actor.name}: Умная инфекция не может снизить Интеллект ниже 4.`, "warn");
    return false;
  }

  await actor.createEmbeddedDocuments("ActiveEffect", [
    {
      name: `Умная инфекция: вложено ${cost} Инт`,
      img: feature.img,
      origin: feature.uuid,
      transfer: false,
      disabled: false,
      showIcon: 1,
      statuses: [],
      flags: {
        [MODULE_ID]: {
          [FLAGS.SMART_INFECTION_EFFECT]: true,
          intCost: cost
        }
      },
      system: {
        changes: [
          {
            key: "system.abilities.int.value",
            type: "add",
            value: String(-cost),
            phase: "initial",
            priority: 20
          }
        ]
      }
    }
  ]);
  notify(`${actor.name}: создан вирусный агент, Интеллект временно снижен на ${cost}.`);
  return true;
}

export async function clearSmartInfections(actor) {
  if (!actor?.isOwner) return false;
  const effects = smartInfectionEffects(actor);
  if (!effects.length) {
    notify(`${actor.name}: активных эффектов «Умной инфекции» нет.`, "info");
    return false;
  }
  await actor.deleteEmbeddedDocuments(
    "ActiveEffect",
    effects.map(effect => effect.id)
  );
  notify(`${actor.name}: Интеллект от Умной инфекции возвращён.`);
  return true;
}

function diseaseFormEffect(actor) {
  return actor?.effects?.find(effect => effect.getFlag(MODULE_ID, FLAGS.DISEASE_FORM_EFFECT));
}

export async function activateDiseaseForm(actor) {
  if (!actor || !plagueDoctorClass(actor)) {
    notify("Эта активность требует класс «Чумной маг».", "warn");
    return false;
  }
  const feature = findFeature(actor, "disease-form");
  if (!feature) {
    notify("Для Формы болезни требуется одноимённая особенность.", "warn");
    return false;
  }

  const changes = ["walk", "fly", "climb", "swim", "burrow"].map(mode => ({
    key: effectKey(`system.attributes.movement.${mode}`),
    type: "override",
    value: "0",
    phase: "final",
    priority: 100
  }));
  const data = {
    name: "Форма болезни",
    img: feature.img,
    origin: feature.uuid,
    transfer: false,
    disabled: false,
    showIcon: 1,
    statuses: [],
    flags: {
      [MODULE_ID]: {
        [FLAGS.DISEASE_FORM_EFFECT]: true
      }
    },
    system: { changes }
  };
  const current = diseaseFormEffect(actor);
  if (current) await current.update(data);
  else await actor.createEmbeddedDocuments("ActiveEffect", [data]);
  notify(`${actor.name}: активирована «Форма болезни». Скорости передвижения обнулены.`);
  return true;
}

export async function endDiseaseForm(actor) {
  const effect = diseaseFormEffect(actor);
  if (!effect || !actor?.isOwner) return false;
  await effect.delete();
  notify(`${actor.name}: «Форма болезни» завершена.`);
  return true;
}
