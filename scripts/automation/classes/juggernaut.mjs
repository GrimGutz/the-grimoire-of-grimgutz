import { MODULE_ID, SETTINGS } from "../shared/constants.mjs";
import { automationData, itemIdentifier, notify } from "../shared/helpers.mjs";

export function juggernautClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "juggernaut");
}

export function juggernautLevel(actor) {
  return Number(juggernautClass(actor)?.system?.levels ?? 0);
}

export function juggernautPrerequisiteFailures(actor) {
  const failures = [];
  if (Number(actor?.system?.abilities?.con?.value ?? 0) < 16) failures.push("Телосложение 16");
  if (Number(actor?.system?.details?.level ?? 0) < 15) failures.push("15-й уровень персонажа");
  return failures;
}

export function validateJuggernautPrerequisites(item, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  if (!actor || item.type !== "class" || itemIdentifier(item) !== "juggernaut") return true;
  const failures = juggernautPrerequisiteFailures(actor);
  if (failures.length) {
    notify(`Нельзя добавить класс «Джаггернаут». Не выполнено: ${failures.join(", ")}. Способность исцелять себя и прошлую натуральную 20 на спасброске от смерти подтверждает Мастер.`, "error");
    return false;
  }
  return true;
}

export function validateJuggernautFeaturePrerequisites(item, options, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  const data = automationData(item);
  if (!actor || data.juggernautFeature !== true || options?.isAdvancement) return true;
  const level = juggernautLevel(actor);
  if (!level) {
    notify(`Особенность «${item.name}» требует класс «Джаггернаут».`, "error");
    return false;
  }
  const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
  if (requiredLevel && level < requiredLevel) {
    notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Джаггернаута.`, "error");
    return false;
  }
  return true;
}
