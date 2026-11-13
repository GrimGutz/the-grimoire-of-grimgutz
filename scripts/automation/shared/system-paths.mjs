// D&D5e data paths that moved between the system versions this module supports.
//
// - 5.3 moved senses to `attributes.senses.ranges.*` (the module minimum, so
//   always use the new location).
// - 6.0 moved movement to `attributes.movement.speeds.*` and roll bonuses to
//   `*.roll.bonus` / `rolls.*`. 6.0 still redirects the old Active Effect keys
//   and keeps deprecated getters on prepared data (removed in 6.1 for senses
//   and 7.0 for movement and bonuses), so code written against the old layout
//   works today and silently stops working later.
//
// Write legacy paths through `effectKey()` and read moved values through
// `movementSpeed()` / `senseRange()`; both pick the layout of the running system.

const SENSES = new Set(["darkvision", "blindsight", "tremorsense", "truesight"]);
const SPEEDS = new Set(["walk", "burrow", "climb", "fly", "swim", "jump"]);
const ATTACK_BONUSES = new Set(["mwak", "rwak", "msak", "rsak"]);
const MOVED_IN_6 = {
  "system.attributes.movement.speed": "system.attributes.movement.speeds.walk",
  "system.attributes.concentration.bonuses.save": "system.attributes.concentration.roll.bonus",
  "system.attributes.death.bonuses.save": "system.attributes.death.roll.bonus",
  "system.attributes.init.bonus": "system.attributes.init.roll.bonus",
  "system.bonuses.abilities.check": "system.rolls.ability.check.bonus",
  "system.bonuses.abilities.save": "system.rolls.ability.save.bonus",
  "system.bonuses.abilities.skill": "system.rolls.ability.skill.bonus"
};

/** Compare dotted numeric versions ("6.0.6" >= "6.0"). */
export function versionAtLeast(current, minimum) {
  const a = String(current).split(".").map(Number),
    b = String(minimum).split(".").map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    const left = a[index] || 0,
      right = b[index] || 0;
    if (left !== right) return left > right;
  }
  return true;
}

/** Whether the running D&D5e system is at least `version`. Unknown (tests, early init) counts as the 5.x layout. */
export function dnd5eAtLeast(version) {
  const current =
    globalThis.game?.system?.id === "dnd5e" || globalThis.game?.system?.version ? globalThis.game.system.version : null;
  return current ? versionAtLeast(current, version) : false;
}

/** Current location of a (possibly legacy) Actor data path or Active Effect key. Unknown paths pass through. */
export function effectKey(key) {
  const sense = /^system\.attributes\.senses\.(\w+)$/.exec(key);
  if (sense && SENSES.has(sense[1])) return `system.attributes.senses.ranges.${sense[1]}`;
  if (!dnd5eAtLeast("6.0")) return key;
  if (MOVED_IN_6[key]) return MOVED_IN_6[key];
  const speed = /^system\.attributes\.movement\.(\w+)$/.exec(key);
  if (speed && SPEEDS.has(speed[1])) return `system.attributes.movement.speeds.${speed[1]}`;
  const attack = /^system\.bonuses\.(\w+)\.(attack|damage)$/.exec(key);
  if (attack && ATTACK_BONUSES.has(attack[1])) return `system.rolls.${attack[2]}.${attack[1]}.bonus`;
  const bonus = /^system\.(abilities|skills|tools)\.(\w+)\.bonuses\.(check|save)$/.exec(key);
  if (bonus) return `system.${bonus[1]}.${bonus[2]}.${bonus[1] === "abilities" ? `${bonus[3]}.` : ""}roll.bonus`;
  return key;
}

/** Raw movement speed (unchanged type, may be undefined) from either layout. */
export function movementSpeed(actor, type) {
  const movement = actor?.system?.attributes?.movement;
  return movement?.speeds?.[type] ?? movement?.[type];
}

/** Prepared saving-throw proficiency of an ability (6.0 `save.prof`, earlier `saveProf`). */
export function abilitySaveProficiency(ability) {
  return ability?.save?.prof ?? ability?.saveProf;
}

/** Source formula of an ability's own saving-throw bonus (6.0 `save.roll.bonus`, earlier `bonuses.save`). */
export function abilitySaveBonus(ability) {
  return ability?.save?.roll?.bonus ?? ability?.bonuses?.save;
}

/** Source formula of the actor-wide saving-throw bonus (6.0 `rolls.ability.save.bonus`, earlier `bonuses.abilities.save`). */
export function globalSaveBonus(actor) {
  return actor?.system?.rolls?.ability?.save?.bonus ?? actor?.system?.bonuses?.abilities?.save;
}

/** Whether the actor has a death-save bonus to modify (6.0 `death.roll`, earlier `death.bonuses.save`), without the deprecated getter. */
export function hasDeathSaveBonus(actor) {
  const death = actor?.system?.attributes?.death;
  return Boolean(death?.roll) || death?.bonuses?.save !== undefined;
}

/** Raw sense range (unchanged type, may be undefined) from either layout. */
export function senseRange(actor, sense) {
  const senses = actor?.system?.attributes?.senses;
  return senses?.ranges?.[sense] ?? senses?.[sense];
}
