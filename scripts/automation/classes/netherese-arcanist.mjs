import { FLAGS, MODULE_ID, SETTINGS } from "../shared/constants.mjs";
import {
  activityItem,
  automationData,
  findFeature,
  itemIdentifier,
  itemUses,
  notify
} from "../shared/helpers.mjs";

export function nethereseArcanistClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "netherese-arcanist");
}

export function nethereseArcanistLevel(actor) {
  return Number(nethereseArcanistClass(actor)?.system?.levels ?? 0);
}

function classLevel(actor, identifier) {
  return Number(actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === identifier)?.system?.levels ?? 0);
}

function hasArcanaProficiency(actor) {
  const arcana = actor?.system?.skills?.arc;
  return Number(arcana?.value ?? arcana?.proficient ?? 0) > 0;
}

export function nethereseArcanistPrerequisiteFailures(actor) {
  const failures = [];
  if (classLevel(actor, "wizard") < 15 && classLevel(actor, "sorcerer") < 15) {
    failures.push("Волшебник 15-го уровня или Чародей 15-го уровня");
  }
  const intelligence = Number(actor?.system?.abilities?.int?.value ?? 0);
  const charisma = Number(actor?.system?.abilities?.cha?.value ?? 0);
  if (intelligence < 16 && charisma < 16) failures.push("Интеллект или Харизма 16");
  if (!hasArcanaProficiency(actor)) failures.push("владение навыком Магия");
  return failures;
}

export function validateNethereseArcanistPrerequisites(item, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  if (!actor || item.type !== "class" || itemIdentifier(item) !== "netherese-arcanist") return true;
  const failures = nethereseArcanistPrerequisiteFailures(actor);
  if (failures.length) {
    notify(`Нельзя добавить класс «Нетерильский арканист». Не выполнено: ${failures.join(", ")}. Происхождение гримуара и связь с Нетерилом подтверждает Мастер.`, "error");
    return false;
  }
  return true;
}

export function validateNethereseArcanistFeaturePrerequisites(item, options, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  const data = automationData(item);
  if (!actor || data.nethereseArcanistFeature !== true || options?.isAdvancement) return true;
  const level = nethereseArcanistLevel(actor);
  if (!level) {
    notify(`Особенность «${item.name}» требует класс «Нетерильский арканист».`, "error");
    return false;
  }
  const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
  if (requiredLevel && level < requiredLevel) {
    notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Нетерильского арканиста.`, "error");
    return false;
  }
  return true;
}

function effectByFlag(actor, flag) {
  return actor?.effects?.find(effect => effect.getFlag(MODULE_ID, flag));
}

async function chat(actor, content) {
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content
  });
}

function spellSaveDC(actor) {
  const dc = Number(actor?.system?.attributes?.spell?.dc ?? 0);
  if (Number.isFinite(dc) && dc > 0) return dc;
  const intMod = Number(actor?.system?.abilities?.int?.mod ?? 0);
  const chaMod = Number(actor?.system?.abilities?.cha?.mod ?? 0);
  return 8 + Number(actor?.system?.attributes?.prof ?? 0) + Math.max(intMod, chaMod);
}

export function validateNethereseArcanistActivityUse(actor, activity, action) {
  if (!actor || !nethereseArcanistClass(actor)) {
    notify("Эта активность требует класс «Нетерильский арканист».", "warn");
    return false;
  }
  const feature = activityItem(activity);
  if (["activate-mini-mythal", "use-ancient-knowledge", "cast-netherese-great-spell"].includes(action)) {
    const uses = itemUses(feature);
    if (uses.remaining <= 0) {
      notify(`${actor.name}: недостаточно использований «${feature?.name ?? "способности"}».`, "warn");
      return false;
    }
  }
  if (["teleport-in-mini-mythal", "overload-mini-mythal"].includes(action) && !effectByFlag(actor, FLAGS.NETHERIL_MINI_MYTHAL_EFFECT)) {
    notify(`${actor.name}: сначала создайте мини-мифаль.`, "warn");
    return false;
  }
  return true;
}

export async function showScholarArcanist(actor) {
  if (!actor || !nethereseArcanistClass(actor)) return false;
  await chat(actor, `<p><strong>${actor.name}: Учёный арканист.</strong> При броске инициативы можно использовать Интеллект вместо Ловкости. Если История уже была владением до получения класса, переведите её в экспертность вручную.</p>`);
  return true;
}

export async function activateMiniMythal(actor) {
  if (!actor || !nethereseArcanistClass(actor)) return false;
  const feature = findFeature(actor, "mini-mythal");
  if (!feature) {
    notify("Для создания мини-мифаля нужна особенность «Мини-мифаль».", "warn");
    return false;
  }
  const data = {
    name: "Мини-мифаль",
    img: feature.img,
    origin: feature.uuid,
    transfer: false,
    disabled: false,
    showIcon: 1,
    statuses: [],
    flags: {
      [MODULE_ID]: {
        [FLAGS.NETHERIL_MINI_MYTHAL_EFFECT]: true
      }
    },
    duration: {
      seconds: 60,
      startTime: game.time?.worldTime ?? 0
    },
    system: { changes: [] }
  };
  const current = effectByFlag(actor, FLAGS.NETHERIL_MINI_MYTHAL_EFFECT);
  if (current) await current.update(data);
  else await actor.createEmbeddedDocuments("ActiveEffect", [data]);
  notify(`${actor.name}: мини-мифаль создан на 1 минуту.`);
  return true;
}

export async function teleportInMiniMythal(actor) {
  if (!actor || !nethereseArcanistClass(actor)) return false;
  await chat(actor, `<p><strong>${actor.name}: Мини-мифаль.</strong> Бонусным действием можно телепортировать одно существо внутри мифаля в другую точку внутри него. Несогласное существо совершает спасбросок Харизмы против СЛ ${spellSaveDC(actor)}.</p>`);
  return true;
}

export async function overloadMiniMythal(actor) {
  if (!actor || !nethereseArcanistClass(actor)) return false;
  const effect = effectByFlag(actor, FLAGS.NETHERIL_MINI_MYTHAL_EFFECT);
  if (!effect) {
    notify(`${actor.name}: сначала создайте мини-мифаль.`, "warn");
    return false;
  }
  const roll = await new Roll("10d6 + 40", actor.getRollData(), { flavor: "Мини-мифаль: перегрузка" }).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: "Мини-мифаль: 10к6+40 урона силовым полем"
  });
  await effect.delete();
  const feature = findFeature(actor, "mini-mythal");
  if (feature) {
    const max = Math.max(0, Number(feature.system?.uses?.max ?? 0));
    if (max > 0) await feature.update({ "system.uses.spent": max });
  }
  notify(`${actor.name}: мини-мифаль перегружен. До длительного отдыха новый мини-мифаль создать нельзя.`);
  return true;
}

export async function useAncientKnowledge(actor) {
  if (!actor || !nethereseArcanistClass(actor)) return false;
  await chat(actor, `<p><strong>${actor.name}: Древнее знание.</strong> Выберите одно заклинание 5-го круга или ниже из списка любого класса. Оно считается для вас заклинанием волшебника до момента наложения, затем исчезает из сознания.</p>`);
  return true;
}

export async function castNethereseGreatSpell(actor, activity) {
  if (!actor || !nethereseArcanistClass(actor)) return false;
  const feature = findFeature(actor, "great-spells");
  const spellName = String(automationData(activity).nethereseGreatSpell ?? "Великое заклинание");
  const data = {
    name: `Отрыв от Плетения: ${spellName}`,
    img: feature?.img ?? "icons/magic/symbols/rune-sigil-black-pink.webp",
    origin: feature?.uuid ?? null,
    transfer: false,
    disabled: false,
    showIcon: 1,
    statuses: [],
    flags: {
      [MODULE_ID]: {
        [FLAGS.NETHERIL_WEAVE_SEVERED_EFFECT]: spellName
      }
    },
    duration: {
      seconds: 864000,
      startTime: game.time?.worldTime ?? 0
    },
    system: { changes: [] }
  };
  const current = effectByFlag(actor, FLAGS.NETHERIL_WEAVE_SEVERED_EFFECT);
  if (current) await current.update(data);
  else await actor.createEmbeddedDocuments("ActiveEffect", [data]);
  await chat(actor, `<p><strong>${actor.name}: ${spellName}.</strong> Великое заклинание произнесено. Примените 4 уровня истощения, запрет на произнесение заклинаний и 10-дневный отрыв от Плетения. Ограничения чудесных предметов, Клона, воскресения и мифаллара подтверждает Мастер.</p>`);
  return true;
}
