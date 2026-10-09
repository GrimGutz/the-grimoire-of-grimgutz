import { MODULE_ID } from "./constants.mjs";
import { findFeature } from "./helpers.mjs";
import { isAuraDefeated, isAuraIncapacitated } from "./aura-conditions.mjs";
import { feetToSceneUnits } from "./spatial.mjs";

export const LEADER_PRESENCE_KEYS = ["calming-presence", "distracting-presence", "boisterous-presence", "tactical-presence", "insightful-presence", "inspiring-presence"];
export const presenceChoices = actor => actor?.getFlag?.(MODULE_ID, "leaderPresenceRecipients") ?? actor?.flags?.[MODULE_ID]?.leaderPresenceRecipients ?? [];
export function presenceRecipients(source, key) {
  const doc = source.document ?? source;
  return presenceChoices(source.actor).find(record => record.sourceTokenUuid === doc.uuid && record.key === key)?.targetUuids ?? null;
}
export function presenceApplies(source, target, key) {
  const sourceDoc = source.document ?? source, targetDoc = target.document ?? target;
  const recipients = presenceRecipients(source, key);
  if (!recipients || sourceDoc.parent?.id !== targetDoc.parent?.id || isAuraDefeated(source) || isAuraIncapacitated(source.actor) || !findFeature(source.actor, key)) return false;
  // Deliberately NO perception or walls checks, per the user's choice.
  const self = sourceDoc.uuid === targetDoc.uuid;
  if (self && !["calming-presence", "boisterous-presence", "tactical-presence"].includes(key)) return false;
  if (self && key === "boisterous-presence" && source.actor.getFlag?.(MODULE_ID, "leaderLegacyBoiConflict")) return false;
  if (key === "tactical-presence" && target.actor.statuses?.has?.("surprised")) return false;
  return self || recipients.includes(targetDoc.uuid);
}
export function inspiringTemporaryHp(actor, base) {
  let bonus = 0;
  for (const scene of game.scenes ?? []) for (const target of scene.tokens ?? []) if (target.actor?.uuid === actor.uuid)
    for (const source of scene.tokens ?? []) if (presenceApplies(source, target, "inspiring-presence"))
      bonus = Math.max(bonus, Math.max(1, Number(source.actor.system?.abilities?.cha?.mod ?? 0)));
  return base + bonus;
}
const change = (key, value, phase = "initial") => ({ key, value: String(value), type: "add", phase, priority: 20 });
const mod = (actor, ability) => Math.max(1, Number(actor.system?.abilities?.[ability]?.mod ?? 0));
const movement = actor => ["walk", "climb", "fly", "swim", "burrow"].filter(type => Number(actor.system?.attributes?.movement?.[type]) > 0)
  .map(type => change(`system.attributes.movement.${type}`, feetToSceneUnits(10, { grid: { units: actor.system.attributes.movement.units ?? "ft" } }), "final"));
const effects = {
  "boisterous-presence": (_source, target) => movement(target.actor),
  "tactical-presence": source => [change("system.attributes.init.bonus", mod(source.actor, "int"))],
  "insightful-presence": source => ["prc", "ins", "inv"].map(skill => change(`system.skills.${skill}.bonuses.check`, mod(source.actor, "wis"))),
  "inspiring-presence": () => [change("system.abilities.cha.bonuses.check", 2), change("system.abilities.cha.bonuses.save", 2)]
};
export const LEADER_PRESENCE_DEFINITIONS = LEADER_PRESENCE_KEYS.map(key => ({
  id: `leader-${key}`, sourceFeature: key, name: `Присутствие Лидера: ${key}`, indicator: false, unlimitedRange: true, affects: "all", stacking: "highest",
  sourceCondition: source => presenceRecipients(source, key) !== null && !isAuraDefeated(source) && !isAuraIncapacitated(source.actor),
  targetCondition: (source, target) => presenceApplies(source, target, key),
  ...(effects[key] ? { effect: (source, target) => ({ name: findFeature(source.actor, key)?.name ?? key,
    img: findFeature(source.actor, key)?.img, changes: effects[key](source, target) }) } : {})
}));
