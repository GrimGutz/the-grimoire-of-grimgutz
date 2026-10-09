import { MODULE_ID } from "./constants.mjs";
import { enabled, isAutomationAuthority } from "./helpers.mjs";

/** Serialize updates per actor and coalesce feedback from document hooks. */
export function createActorSynchronizer(tasks, { onError = (actor, task, error) => console.error(`${MODULE_ID} | ${task} failed for ${actor.uuid}`, error) } = {}) {
  const running = new Map();
  const requested = new Map();
  const timers = new Map();
  async function synchronize(actor) {
    if (!actor?.uuid || !actor.isOwner || !enabled() || !isAutomationAuthority(actor)) return;
    requested.set(actor.uuid, actor);
    if (running.has(actor.uuid)) return running.get(actor.uuid);
    const operation = (async () => {
      while (requested.has(actor.uuid)) {
        const current = requested.get(actor.uuid);
        requested.delete(actor.uuid);
        for (const task of tasks) {
          try { await task(current); }
          catch (error) { onError(current, task.name, error); }
        }
      }
    })().finally(() => running.delete(actor.uuid));
    running.set(actor.uuid, operation);
    return operation;
  }
  function schedule(actor) {
    if (!actor?.uuid || !actor.isOwner || !enabled() || !isAutomationAuthority(actor)) return;
    clearTimeout(timers.get(actor.uuid));
    timers.set(actor.uuid, setTimeout(() => {
      timers.delete(actor.uuid);
      void synchronize(actor).catch(error => onError(actor, "synchronize", error));
    }, 50));
  }
  return { synchronize, schedule };
}
