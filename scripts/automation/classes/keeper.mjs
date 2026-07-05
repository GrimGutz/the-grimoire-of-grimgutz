import { MODULE_ID, SETTINGS } from "../shared/constants.mjs";
import {
  automationData,
  findFeature,
  isAutomationAuthority,
  itemIdentifier,
  notify
} from "../shared/helpers.mjs";
import { abilityMod } from "../shared/dnd5e.mjs";

const keeperSyncs = new Set();

const SPECIALIZATION_REQUIREMENTS = {
  golem: {
    name: "Создатель големов",
    skills: ["arc", "inv", "med", "rel"],
    tools: ["alchemist", "alch", "tinker", "tink"]
  },
  myth: {
    name: "Искатель мифов",
    skills: ["ani", "arc", "dec", "rel"],
    tools: ["forg", "forgery", "game"]
  },
  spirit: {
    name: "Духовный медиум",
    skills: ["arc", "dec", "his", "ins", "rel"],
    tools: ["music", "instrument"]
  },
  wild: {
    name: "Дикий укротитель",
    skills: ["ani", "ins", "nat", "sur"],
    tools: ["herb", "herbalism", "music", "instrument"]
  }
};

const SUBCLASS_SPECIALIZATIONS = {
  "keeper-golem-maker": "golem",
  "keeper-myth-seeker": "myth",
  "keeper-spirit-medium": "spirit",
  "keeper-wild-tamer": "wild"
};

export function keeperClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "keeper");
}

export function keeperLevel(actor) {
  return Number(keeperClass(actor)?.system?.levels ?? 0);
}

function hasSkillProficiency(actor, key) {
  const skill = actor?.system?.skills?.[key];
  const value = Number(skill?.value ?? skill?.proficient ?? 0);
  return value > 0 || skill?.proficient === true;
}

function matchingToolProficiencyCount(actor, fragments) {
  const tools = actor?.system?.tools ?? {};
  const fragmentList = fragments.map(fragment => fragment.toLowerCase());
  let count = 0;
  for (const [key, tool] of Object.entries(tools)) {
    const value = Number(tool?.value ?? tool?.proficient ?? 0);
    if (value <= 0 && tool?.proficient !== true) continue;
    const search = `${key} ${tool?.label ?? ""} ${tool?.ability ?? ""}`.toLowerCase();
    if (fragmentList.some(fragment => search.includes(fragment))) count += 1;
  }
  const custom = String(actor?.system?.traits?.toolProf?.custom ?? actor?.system?.tools?.custom ?? "").toLowerCase();
  if (fragmentList.some(fragment => custom.includes(fragment))) count += 1;
  return count;
}

function specializationMatches(actor, specializationKey) {
  const requirement = SPECIALIZATION_REQUIREMENTS[specializationKey];
  if (!requirement) return 0;
  let count = 0;
  for (const skill of requirement.skills) {
    if (hasSkillProficiency(actor, skill)) count += 1;
  }
  count += matchingToolProficiencyCount(actor, requirement.tools);
  return count;
}

function bestKeeperAbility(actor) {
  return Math.max(abilityMod(actor, "int"), abilityMod(actor, "wis"), abilityMod(actor, "cha"));
}

export function keeperPrerequisiteFailures(actor) {
  const failures = [];
  const hasAbility = ["int", "wis", "cha"].some(ability => Number(actor?.system?.abilities?.[ability]?.value ?? 0) >= 13);
  if (!hasAbility) failures.push("Интеллект, Мудрость или Харизма 13");
  if (Number(actor?.system?.details?.level ?? 0) < 3) failures.push("3-й уровень персонажа");
  return failures;
}

export function keeperSubclassPrerequisiteFailures(actor, subclassIdentifier) {
  const specialization = SUBCLASS_SPECIALIZATIONS[subclassIdentifier] ?? subclassIdentifier;
  const requirement = SPECIALIZATION_REQUIREMENTS[specialization];
  if (!requirement) return [];
  const matches = specializationMatches(actor, specialization);
  if (matches >= 2) return [];
  return [`специализация «${requirement.name}»: минимум два подходящих владения навыками или инструментами, найдено ${matches}`];
}

export function validateKeeperPrerequisites(item, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  if (!actor || item.type !== "class" || itemIdentifier(item) !== "keeper") return true;
  const failures = keeperPrerequisiteFailures(actor);
  if (failures.length) {
    notify(`Нельзя добавить класс «Хранитель». Не выполнено: ${failures.join(", ")}. Требования специализации проверяются при её выборе.`, "error");
    return false;
  }
  return true;
}

export function validateKeeperSubclassPrerequisites(item, options, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  if (!actor || item.type !== "subclass") return true;
  const specialization = automationData(item).keeperSubclass ?? SUBCLASS_SPECIALIZATIONS[itemIdentifier(item)];
  if (!specialization) return true;
  if (!keeperClass(actor) && !options?.isAdvancement) {
    notify(`Подкласс «${item.name}» требует класс «Хранитель».`, "error");
    return false;
  }
  const failures = keeperSubclassPrerequisiteFailures(actor, specialization);
  if (failures.length) {
    notify(`Нельзя выбрать специализацию Хранителя «${item.name}». Не выполнено: ${failures.join(", ")}.`, "error");
    return false;
  }
  return true;
}

export function validateKeeperFeaturePrerequisites(item, options, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  const data = automationData(item);
  if (!actor || data.keeperFeature !== true) return true;
  if (options?.isAdvancement && !data.keeperSpecialization) return true;
  const level = keeperLevel(actor);
  if (!level) {
    notify(`Особенность «${item.name}» требует класс «Хранитель».`, "error");
    return false;
  }
  const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
  if (requiredLevel && level < requiredLevel) {
    notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Хранителя.`, "error");
    return false;
  }
  const specialization = data.keeperSpecialization;
  if (specialization) {
    const matches = specializationMatches(actor, specialization);
    if (matches < 2) {
      const name = SPECIALIZATION_REQUIREMENTS[specialization]?.name ?? item.name;
      notify(`Специализация «${name}» требует минимум два подходящих владения навыками или инструментами. Найдено: ${matches}.`, "error");
      return false;
    }
  }
  return true;
}

export function keeperAllyPoints(actor) {
  const level = keeperLevel(actor);
  if (level >= 5) return 12;
  if (level >= 4) return 10;
  if (level >= 3) return 9;
  if (level >= 2) return 7;
  if (level >= 1) return 6;
  return 0;
}

function allyDamageDie(actor) {
  const level = keeperLevel(actor);
  if (level >= 5) return "d8";
  if (level >= 3) return "d6";
  return "d4";
}

function currentMax(item) {
  return String(item?.system?.uses?.max ?? "");
}

async function syncUses(feature, maximum) {
  if (!feature) return false;
  const max = String(Math.max(0, maximum));
  const update = {};
  if (currentMax(feature) !== max) update["system.uses.max"] = max;
  if (!Object.keys(update).length) return false;
  await feature.update(update);
  return true;
}

export async function syncKeeperResources(actor, { notifyResult = false } = {}) {
  if (!actor?.isOwner || !isAutomationAuthority(actor) || keeperSyncs.has(actor.uuid)) return false;
  if (!keeperClass(actor)) return false;

  keeperSyncs.add(actor.uuid);
  try {
    const changed = await syncUses(findFeature(actor, "keeper-ward-and-warded"), keeperAllyPoints(actor));
    if (notifyResult && changed) notify(`${actor.name}: очки союзника Хранителя синхронизированы.`);
    return changed;
  } finally {
    keeperSyncs.delete(actor.uuid);
  }
}

async function rollToChat(actor, formula, flavor) {
  const roll = await new Roll(formula, actor.getRollData()).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor
  });
  return roll;
}

export async function rollKeeperAllyStrike(actor) {
  if (!actor || !keeperClass(actor)) {
    notify("Эта активность требует класс «Хранитель».", "warn");
    return false;
  }
  const level = keeperLevel(actor);
  const formula = `1${allyDamageDie(actor)} - 1 + ${level}`;
  const attackBonus = Number(actor?.system?.attributes?.prof ?? 0) + level;
  await rollToChat(actor, formula, `Удар союзника Хранителя: урон. Бонус атаки союзника: +${attackBonus}.`);
  return true;
}

export async function syncKeeperAllyPoints(actor) {
  const changed = await syncKeeperResources(actor, { notifyResult: true });
  if (!changed && actor) notify(`${actor.name}: максимум очков союзника уже равен ${keeperAllyPoints(actor)}.`);
  return true;
}

export async function rollKeeperRestRecovery(actor) {
  if (!actor || !keeperClass(actor)) {
    notify("Эта активность требует класс «Хранитель».", "warn");
    return false;
  }
  const healing = 5 * keeperLevel(actor);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p><strong>${actor.name}: Отдых и восстановление.</strong> После короткого отдыха союзник восстанавливает <strong>${healing}</strong> хитов. Сл талантов союзника: ${8 + Number(actor?.system?.attributes?.prof ?? 0) + Math.max(bestKeeperAbility(actor), keeperLevel(actor))}.</p>`
  });
  return true;
}

export async function rollKeeperMightDamage(actor) {
  if (!actor || !findFeature(actor, "might-and-magic")) {
    notify("Для броска требуется особенность «Могущество и магия».", "warn");
    return false;
  }
  await rollToChat(actor, "1d6", "Могущество и магия: дополнительный урон союзника выбранного типа");
  return true;
}
