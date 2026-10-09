import { FLAGS, MODULE_ID, SETTINGS } from "../shared/constants.mjs";
import {
  activityItem,
  automationData,
  findFeature,
  itemIdentifier,
  itemUses,
  isAutomationAuthority,
  notify
} from "../shared/helpers.mjs";
import { createSummonedCreature } from "../shared/summons.mjs";
import { quasitFamiliarSummon } from "../shared/summon-templates.mjs";
import { isEffectActive } from "../effects/temporary-effects.mjs";

const DEMONOLOGIST_ACTIONS = new Set([
  "show-demonologist-demon-charm",
  "show-demonologist-infernal-familiar",
  "use-demonologist-master-summoner",
  "cast-demonologist-protection",
  "cast-demonologist-spirit-guardians",
  "activate-demonic-vitality",
  "cast-demonologist-detect-thoughts",
  "use-demonologist-double-summon",
  "show-demonologist-domination"
]);

const ACTION_LEVELS = {
  "show-demonologist-demon-charm": 1,
  "show-demonologist-infernal-familiar": 1,
  "use-demonologist-master-summoner": 2,
  "cast-demonologist-protection": 2,
  "cast-demonologist-spirit-guardians": 5,
  "activate-demonic-vitality": 3,
  "cast-demonologist-detect-thoughts": 4,
  "use-demonologist-double-summon": 5,
  "show-demonologist-domination": 5
};

const USE_ACTIONS = new Set([
  "use-demonologist-master-summoner",
  "cast-demonologist-spirit-guardians",
  "activate-demonic-vitality",
  "cast-demonologist-detect-thoughts",
  "use-demonologist-double-summon"
]);

export function demonologistClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "demonologist");
}

export function demonologistLevel(actor) {
  return Number(demonologistClass(actor)?.system?.levels ?? 0);
}

function hasArcanaOrReligion(actor) {
  const arcana = actor?.system?.skills?.arc;
  const religion = actor?.system?.skills?.rel;
  return Number(arcana?.value ?? arcana?.proficient ?? 0) > 0
    || Number(religion?.value ?? religion?.proficient ?? 0) > 0;
}

function searchableSpellText(item) {
  return [
    item?.name,
    item?.system?.identifier,
    item?.system?.description?.value
  ].filter(Boolean).join(" ").toLocaleLowerCase("ru");
}

function isPreparedOrAlwaysAvailableSpell(item) {
  if (item?.type !== "spell") return false;
  const preparation = item.system?.preparation;
  if (!preparation) return true;
  if (preparation.prepared === true) return true;
  return ["always", "atwill", "innate", "pact"].includes(String(preparation.mode ?? ""));
}

function isDemonSummonOrPlanarTravelSpell(item) {
  if (!isPreparedOrAlwaysAvailableSpell(item)) return false;
  const text = searchableSpellText(item);
  return [
    "призыв младших демонов",
    "призыв хезроу",
    "призыв высшего демона",
    "призыв демона",
    "summon lesser demons",
    "summon greater demon",
    "summon demon",
    "infernal calling",
    "plane shift",
    "planar",
    "gate",
    "врата",
    "планар",
    "планами",
    "планов",
    "между план",
    "астральн",
    "эфирн"
  ].some(needle => text.includes(needle));
}

function hasDemonSummonOrPlanarTravelSpell(actor) {
  return actor?.items?.some(isDemonSummonOrPlanarTravelSpell) ?? false;
}

export function demonologistPrerequisiteFailures(actor) {
  const failures = [];
  if (Number(actor?.system?.abilities?.cha?.value ?? 0) < 15) failures.push("Харизма 15");
  if (!hasArcanaOrReligion(actor)) failures.push("владение навыком Магия или Религия");
  if (!hasDemonSummonOrPlanarTravelSpell(actor)) {
    failures.push("подготовленное или известное заклинание призыва демонов либо планарного перемещения");
  }
  return failures;
}

export function validateDemonologistPrerequisites(item, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  if (!actor || item.type !== "class" || itemIdentifier(item) !== "demonologist") return true;
  const failures = demonologistPrerequisiteFailures(actor);
  if (failures.length) {
    notify(`Нельзя добавить класс «Демонолог». Не выполнено: ${failures.join(", ")}.`, "error");
    return false;
  }
  return true;
}

export function validateDemonologistFeaturePrerequisites(item, options, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  const data = automationData(item);
  if (!actor || data.demonologistFeature !== true || options?.isAdvancement) return true;
  const level = demonologistLevel(actor);
  if (!level) {
    notify(`Особенность «${item.name}» требует класс «Демонолог».`, "error");
    return false;
  }
  const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
  if (requiredLevel && level < requiredLevel) {
    notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Демонолога.`, "error");
    return false;
  }
  return true;
}

async function chat(actor, content) {
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content
  });
}

function demonicVitalityEffect(actor) {
  return actor?.effects?.find(effect => effect.getFlag(MODULE_ID, FLAGS.DEMONOLOGIST_VITALITY_EFFECT));
}

async function ensureDemonicVitalityTempHp(actor) {
  const current = Number(actor?.system?.attributes?.hp?.temp ?? 0);
  if (current >= 10) return false;
  await actor.update({ "system.attributes.hp.temp": 10 });
  return true;
}

async function rollDemonicVitalityDamage(actor) {
  const RollClass = CONFIG.Dice?.DamageRoll ?? Roll;
  const roll = await new RollClass("3d10", actor.getRollData(), {
    type: "fire",
    flavor: "Демоническая живучесть: урон огнём"
  }).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: "Демоническая живучесть: 3к10 огнём атакующему в 5 футах, сопротивление огню игнорируется"
  });
  return roll;
}

export async function activateDemonicVitality(actor) {
  if (!actor || !demonologistClass(actor)) {
    notify("Эта активность требует класс «Демонолог».", "warn");
    return false;
  }
  const feature = findFeature(actor, "demonic-vitality");
  if (!feature) {
    notify("Для активации нужна особенность «Демоническая живучесть».", "warn");
    return false;
  }
  const data = {
    name: "Демоническая живучесть",
    img: feature.img,
    origin: feature.uuid,
    transfer: false,
    disabled: false,
    showIcon: 1,
    statuses: [],
    flags: {
      [MODULE_ID]: {
        [FLAGS.DEMONOLOGIST_VITALITY_EFFECT]: true
      }
    },
    duration: {
      seconds: 60,
      startTime: game.time?.worldTime ?? 0
    },
    system: { changes: [] }
  };
  const current = demonicVitalityEffect(actor);
  if (current) await current.update(data);
  else await actor.createEmbeddedDocuments("ActiveEffect", [data]);
  await ensureDemonicVitalityTempHp(actor);
  await rollDemonicVitalityDamage(actor);
  await chat(actor, `<p><strong>${actor.name}: Демоническая живучесть.</strong> Эффект активен 1 минуту. В начале каждого вашего хода временные хиты становятся минимум 10. Существо в пределах 5 футов, которое совершает по вам рукопашную атаку, получает 3к10 огненного урона; сопротивление огню игнорируется.</p>`);
  return true;
}

export async function beginDemonologistTurn(actor) {
  if (!actor || !isAutomationAuthority(actor) || !isEffectActive(demonicVitalityEffect(actor))) return false;
  return ensureDemonicVitalityTempHp(actor);
}

async function showDemonCharm(actor) {
  await chat(actor, `<p><strong>${actor.name}: Очарование демонов.</strong> Ваши <em>Очарование личности</em> и <em>Очарование монстра</em> действуют на демонов, даже если у них есть иммунитет к подобным попыткам подчинения. Подтвердите тип цели и заклинание с Мастером.</p>`);
  return true;
}

export async function summonDemonologistInfernalFamiliar(actor) {
  if (!actor || !demonologistClass(actor)) {
    notify("Эта активность требует класс «Демонолог».", "warn");
    return false;
  }
  if (!findFeature(actor, "infernal-familiar")) {
    notify("Для призыва нужен «Инфернальный фамильяр».", "warn");
    return false;
  }
  return createSummonedCreature(actor, quasitFamiliarSummon(actor));
}

async function showInfernalFamiliar(actor) {
  await chat(actor, `<p><strong>${actor.name}: Инфернальный фамильяр.</strong> Вы получаете квазита-фамильяра. Если фамильяр уже был, квазит пожирает его и занимает его место. Создание/замена актёра выполняется вручную.</p>`);
  return true;
}

async function useMasterSummoner(actor) {
  await chat(actor, `<p><strong>${actor.name}: Мастер призыва.</strong> Следующее подходящее заклинание призыва демонов можно наложить без траты ячейки. Конкретное заклинание и призванные существа выбираются отдельно.</p>`);
  return true;
}

async function castProtection(actor) {
  await chat(actor, `<p><strong>${actor.name}: Защита от добра и зла.</strong> Вы накладываете <em>Защиту от добра и зла</em> без траты ячейки и без компонентов.</p>`);
  return true;
}

async function castSpiritGuardians(actor) {
  await chat(actor, `<p><strong>${actor.name}: Духовные стражи.</strong> Вы накладываете <em>Духовных стражей</em> без траты ячейки и без компонентов. Стражи выглядят как бесы или младшие демоны и наносят некротический урон.</p>`);
  return true;
}

async function castDetectThoughts(actor) {
  await chat(actor, `<p><strong>${actor.name}: Обнаружение мыслей.</strong> Вы накладываете <em>Обнаружение мыслей</em> без траты ячейки и без компонентов.</p>`);
  return true;
}

async function useDoubleSummon(actor) {
  await chat(actor, `<p><strong>${actor.name}: Удвоенный призыв.</strong> При применении подходящего заклинания призыва демонов призовите вдвое больше существ, чем обычно.</p>`);
  return true;
}

async function showDomination(actor) {
  await chat(actor, `<p><strong>${actor.name}: Доминация.</strong> Вы можете использовать <em>Подчинение личности</em> на демонов, игнорируя их сопротивления и иммунитеты к таким эффектам очарования. Подтвердите тип цели и заклинание с Мастером.</p>`);
  return true;
}

export async function handleDemonologistAction(actor, activity, action) {
  switch (action) {
    case "show-demonologist-demon-charm":
      return showDemonCharm(actor);
    case "show-demonologist-infernal-familiar":
      return summonDemonologistInfernalFamiliar(actor);
    case "use-demonologist-master-summoner":
      return useMasterSummoner(actor);
    case "cast-demonologist-protection":
      return castProtection(actor);
    case "cast-demonologist-spirit-guardians":
      return castSpiritGuardians(actor);
    case "activate-demonic-vitality":
      return activateDemonicVitality(actor);
    case "cast-demonologist-detect-thoughts":
      return castDetectThoughts(actor);
    case "use-demonologist-double-summon":
      return useDoubleSummon(actor);
    case "show-demonologist-domination":
      return showDomination(actor);
    default:
      return false;
  }
}

export function isDemonologistAction(action) {
  return DEMONOLOGIST_ACTIONS.has(action);
}

export function validateDemonologistActivityUse(actor, activity, action) {
  if (!actor || !demonologistClass(actor)) {
    notify("Эта активность требует класс «Демонолог».", "warn");
    return false;
  }
  const requiredLevel = ACTION_LEVELS[action] ?? 0;
  const level = demonologistLevel(actor);
  if (requiredLevel && level < requiredLevel) {
    notify(`Эта активность требует ${requiredLevel}-й уровень Демонолога.`, "warn");
    return false;
  }
  if (USE_ACTIONS.has(action)) {
    const uses = itemUses(activityItem(activity));
    if (uses.maximum > 0 && uses.remaining <= 0) {
      notify(`${actor.name}: нет доступных использований этой особенности.`, "warn");
      return false;
    }
  }
  return true;
}
