import { MODULE_ID } from "./constants.mjs";
import { serialMutation } from "./transactions.mjs";

/**
 * Object-valued module flag with serialized read-modify-write.
 *
 * `read(document)` never returns null (`fallback()` when unset). `patch(document, changes)` runs under a
 * per-document lock (`<lock>:<uuid>`) and computes the new value from the
 * latest stored one, so two concurrent writers cannot overwrite each other with
 * stale copies:
 *
 * - `patch(doc, { key: value })` merges the keys into the latest state;
 * - `patch(doc, state => next)` receives a clone of the latest state and either
 *   returns the next state or edits the clone in place (return nothing).
 *
 * Keep `changes` functions synchronous and free of other patches on the same
 * flag: the lock is not re-entrant. Resolves to the stored state.
 */
export function flagState(flag, lock = flag, fallback = () => ({})) {
  const read = document => document?.getFlag?.(MODULE_ID, flag) ?? fallback();
  const patch = (document, changes) =>
    serialMutation(`${lock}:${document.uuid}`, async () => {
      const current = structuredClone(read(document));
      const next = typeof changes === "function" ? (changes(current) ?? current) : { ...current, ...changes };
      await document.setFlag(MODULE_ID, flag, next);
      return next;
    });
  return { read, patch };
}
