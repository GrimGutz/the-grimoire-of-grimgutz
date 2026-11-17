// Runtime wiring for every self-registering class and transformation, in
// registration order (hook installers, sync tasks and diagnostics follow it).
// Add new content here after writing its *-content.mjs descriptor.
import { MASTER_CONTENT } from "./classes/master-content.mjs";
import { BOUNTY_HUNTER_CONTENT } from "./classes/bounty-hunter-content.mjs";
import { JESTER_CONTENT } from "./classes/jester-content.mjs";
import { FLAGELLANT_CONTENT } from "./classes/flagellant-content.mjs";
import { DOOMED_CONTENT } from "./classes/doomed-content.mjs";
import { NIGHTMARE_CONTENT } from "./classes/nightmare-content.mjs";
import { EMPATH_CONTENT } from "./classes/empath-content.mjs";
import { ARKANE_CONTENT } from "./transformations/arkane-content.mjs";
import { AUTOMATON_CONTENT } from "./transformations/automaton-content.mjs";
import { BROODMOTHER_CONTENT } from "./transformations/broodmother-content.mjs";
import { CHIMERA_CONTENT } from "./transformations/chimera-content.mjs";
import { DEATHKNIGHT_CONTENT } from "./transformations/deathknight-content.mjs";
import { DULLAHAN_CONTENT } from "./transformations/dullahan-content.mjs";
import { FACTORY_CONTENT } from "./transformations/factory-content.mjs";
import { GOD_CONTENT } from "./transformations/god-content.mjs";
import { HAG_CONTENT } from "./transformations/hag-content.mjs";
import { HALFDRAGON_CONTENT } from "./transformations/halfdragon-content.mjs";
import { ILLITHID_CONTENT } from "./transformations/illithid-content.mjs";
import { DATA_TRANSFORMATION_CONTENT } from "./transformations/data-content.mjs";

export const CONTENT = Object.freeze([
  MASTER_CONTENT,
  BOUNTY_HUNTER_CONTENT,
  JESTER_CONTENT,
  FLAGELLANT_CONTENT,
  DOOMED_CONTENT,
  NIGHTMARE_CONTENT,
  EMPATH_CONTENT,
  ARKANE_CONTENT,
  AUTOMATON_CONTENT,
  BROODMOTHER_CONTENT,
  CHIMERA_CONTENT,
  DEATHKNIGHT_CONTENT,
  DULLAHAN_CONTENT,
  FACTORY_CONTENT,
  GOD_CONTENT,
  HAG_CONTENT,
  HALFDRAGON_CONTENT,
  ILLITHID_CONTENT,
  ...DATA_TRANSFORMATION_CONTENT
]);

/** Descriptors of one kind ("class" or "transformation"), in registry order. */
export const contentOfKind = kind => CONTENT.filter(content => content.kind === kind);

/** Merge every descriptor's actions into `registry`, refusing silent overrides. */
export function registerContentActions(registry) {
  for (const content of CONTENT) {
    for (const [action, handler] of Object.entries(content.actions)) {
      if (registry.has(action))
        throw new Error(`Activity action "${action}" from "${content.id}" is already registered`);
      registry.set(action, handler);
    }
  }
  return registry;
}

/** Install each descriptor's own hooks, then its item and advancement validators. */
export function installContent() {
  for (const content of CONTENT) content.install?.();
  for (const content of CONTENT) for (const validate of content.itemValidators) Hooks.on("preCreateItem", validate);
  for (const content of CONTENT)
    for (const validate of content.advancementValidators) Hooks.on("dnd5e.preAdvancementManagerComplete", validate);
}

/** Midi-QOL handlers by name; MIDI_QOL_HOOKS decides when each runs. */
export const contentMidiHandlers = () => Object.assign({}, ...CONTENT.map(content => content.midi));

/** Functions every descriptor exposes on the module API. */
export const contentApi = () => Object.assign({}, ...CONTENT.map(content => content.api));

/** Synchronization tasks of one kind, in registry order. */
export const contentSyncs = kind =>
  contentOfKind(kind)
    .map(content => content.sync)
    .filter(Boolean);

/** Read-only diagnostics sections keyed by content id. */
export function inspectContent(actor) {
  return Object.fromEntries(
    CONTENT.filter(content => content.inspect).map(content => [content.id, content.inspect(actor)])
  );
}
