import { MODULE_ID } from "./constants.mjs";

const FIELDS = new Set([
  "id",
  "kind",
  "actions",
  "itemValidators",
  "advancementValidators",
  "install",
  "sync",
  "inspect",
  "midi",
  "api"
]);
const KINDS = new Set(["class", "transformation"]);

/**
 * Declare the runtime wiring of one prestige class or transformation.
 *
 * - `actions`: activity action id → handler `(actor, activity, context)`.
 * - `itemValidators` / `advancementValidators`: `preCreateItem` and
 *   `dnd5e.preAdvancementManagerComplete` hooks (return false to cancel).
 * - `install()`: registers the content's own hooks once at init.
 * - `sync(actor)`: serialized actor synchronization task (classes run after the
 *   legacy tasks, transformations inside `syncTransformations`).
 * - `inspect(actor)`: read-only diagnostics section, keyed by `id`.
 * - `midi`: handler name → function; the order they run in is the global
 *   `MIDI_QOL_HOOKS` table, so new names must also be placed there.
 * - `api`: functions exposed on `game.modules.get(id).api`.
 *
 * Adding content means writing one descriptor and listing it in
 * `content-registry.mjs`; runtime.mjs loops over the registry.
 */
export function defineContent(spec) {
  for (const key of Object.keys(spec)) {
    if (!FIELDS.has(key)) throw new Error(`${MODULE_ID} | Unknown content field "${key}" in "${spec.id}"`);
  }
  if (!spec.id) throw new Error(`${MODULE_ID} | Content descriptor needs an id`);
  if (!KINDS.has(spec.kind)) throw new Error(`${MODULE_ID} | Content "${spec.id}" has an unknown kind "${spec.kind}"`);
  for (const [name, value] of Object.entries({ ...spec.actions, ...spec.midi, ...spec.api })) {
    if (typeof value !== "function") throw new Error(`${MODULE_ID} | Content "${spec.id}": ${name} is not a function`);
  }
  return Object.freeze({
    actions: {},
    itemValidators: [],
    advancementValidators: [],
    midi: {},
    api: {},
    ...spec
  });
}
