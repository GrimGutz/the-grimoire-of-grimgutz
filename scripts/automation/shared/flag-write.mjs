import { MODULE_ID } from "./constants.mjs";

// Writing object-valued module flags.
//
// Foundry merges an object written with setFlag/update into the stored one, so
// a key left out of the new value is kept: a ledger pruned with slice() or
// filter() never shrank. It also expands dot-notation keys inside the object,
// so a map keyed by a uuid ("Scene.x.Token.y") was stored nested and the
// lookup by that uuid never matched. Encode such keys with flagKey() and write
// whole values with replaceFlag().

/** A map key that survives Foundry's dot-notation expansion (uuids contain dots). Reversible. */
export const flagKey = key => String(key).replaceAll("%", "%25").replaceAll(".", "%2E");

/** Replace the whole value of a module flag, so keys missing from `value` are removed. */
export async function replaceFlag(document, flag, value) {
  const Forced = globalThis.foundry?.data?.operators?.ForcedReplacement;
  if (Forced?.create && typeof document?.update === "function")
    return document.update({ [`flags.${MODULE_ID}.${flag}`]: Forced.create(value) });
  return document.setFlag(MODULE_ID, flag, value);
}

/** The newest `limit` entries of a ledger object (insertion order), as an object. */
export function newestEntries(map, limit) {
  return Object.fromEntries(Object.entries(map ?? {}).slice(-limit));
}
