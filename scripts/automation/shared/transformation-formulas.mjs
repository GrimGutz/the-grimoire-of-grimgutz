// Pure helpers shared by the compendium sources (Node) and the runtime kit
// (Foundry) of data-defined transformations (see transformation-kit.mjs).
//
// The runtime kit stores each transformation's current tier and save DC on the
// actor as flags.the-grimoire-of-grimgutz.tf.<id>.{tier,dc}. dnd5e puts actor
// flags into roll data, so native activities and item uses can read them in
// formulas: "@flags.the-grimoire-of-grimgutz.tf.sphinx.tier".
const MODULE_ID = "the-grimoire-of-grimgutz";

/** Roll-data reference to a transformation value ("tier" or "dc"). */
export const tfRef = (id, value) => `@flags.${MODULE_ID}.tf.${id}.${value}`;
export const tierRef = id => tfRef(id, "tier");
export const dcRef = id => tfRef(id, "dc");

/** Flag path (relative to the module scope) holding a transformation's roll values. */
export const tfFlag = id => `tf.${id}`;

/**
 * Feature rows of a definition with their compendium identifiers:
 * `{ id, key, name, level, flaw, extra, requires, page, spec }`.
 */
export function featureRows(definition) {
  return definition.features.map(spec => ({
    id: spec.id,
    key: `${definition.id}-${spec.id}`,
    name: spec.name,
    level: spec.level,
    flaw: Boolean(spec.flaw),
    extra: Boolean(spec.extra),
    requires: spec.requires ?? null,
    page: spec.page ?? definition.pages,
    spec
  }));
}

/** Character level at which each transformation tier unlocks (module model). */
export const TIER_LEVELS = [1, 6, 11, 16];
