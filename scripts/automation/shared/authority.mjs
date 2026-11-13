import { isAutomationAuthority, reportFailure } from "./helpers.mjs";
import { isGmAuthority } from "./gm-requests.mjs";

// Document and combat hooks (`create*`, `update*`, `delete*`, `updateCombat`,
// `deleteCombat`, ...) fire on every connected client. A handler that changes
// documents must run on exactly one of them, or the GM and the owning player
// both write (duplicate effects, failed second deletes, double damage).

export { isAutomationAuthority, isGmAuthority };

/**
 * Register `hook` so `handler(actor, ...args)` runs only on the automation
 * authority of the actor the event concerns (the active GM, or an owner when no
 * GM is connected). `actorOf(...args)` resolves that actor; returning nothing
 * skips the event. A returned promise is reported instead of left floating.
 */
export function onAuthority(hook, actorOf, handler, label = hook) {
  const report = reportFailure(`${label} failed`);
  return Hooks.on(hook, (...args) => {
    const actor = actorOf(...args);
    if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
    report(handler(actor, ...args));
  });
}

/**
 * Register `hook` so `handler(...args)` runs only on the active GM's client
 * (or any GM when none is marked active). For events with no single actor,
 * such as combat turns or scene changes.
 */
export function onGmAuthority(hook, handler, label = hook) {
  const report = reportFailure(`${label} failed`);
  return Hooks.on(hook, (...args) => {
    if (!isGmAuthority()) return;
    report(handler(...args));
  });
}
