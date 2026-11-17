import { MODULE_ID } from "./constants.mjs";
import { enabled, isAutomationAuthority } from "./helpers.mjs";

/** Passes in one synchronization that may still change the actor before it counts as a loop. */
export const MAX_SETTLING_PASSES = 5;
/** Passes per actor allowed inside `RATE_WINDOW_MS`, across separate synchronizations. */
export const MAX_PASSES_PER_WINDOW = 40;
const RATE_WINDOW_MS = 10000;
/** How long hook-triggered synchronization of a looping actor stays paused. */
export const LOOP_PAUSE_MS = 60000;

/**
 * Serialize updates per actor and coalesce feedback from document hooks.
 *
 * Every task's own writes fire update hooks that call `schedule()` again. A
 * change that arrives while a pass runs requests one more pass, so the sync
 * repeats until a pass changes nothing (normally the second pass). If passes
 * keep changing the actor — a task that is not idempotent, or two tasks undoing
 * each other — the loop guard stops after `MAX_SETTLING_PASSES`, or after
 * `MAX_PASSES_PER_WINDOW` passes in 10 s (writes that land after a pass,
 * e.g. from a deferred task), names the tasks that were writing,
 * and pauses hook-triggered syncs for that actor. Explicit `synchronize()`
 * calls (world start, migration) still run.
 */
export function createActorSynchronizer(
  tasks,
  {
    onError = (actor, task, error) => console.error(`${MODULE_ID} | ${task} failed for ${actor.uuid}`, error),
    onLoop = (actor, writers) =>
      console.warn(
        `${MODULE_ID} | Automation sync for ${actor.name ?? actor.uuid} kept changing the actor; paused for ${
          LOOP_PAUSE_MS / 1000
        } s. Tasks writing in the last pass: ${writers.join(", ") || "unknown"}.`
      ),
    now = () => Date.now()
  } = {}
) {
  const running = new Map();
  const requested = new Map();
  const timers = new Map();
  const currentTask = new Map();
  const writers = new Map();
  const history = new Map();
  const paused = new Map();

  const allowed = actor => actor?.uuid && actor.isOwner && enabled() && isAutomationAuthority(actor);
  const isPaused = uuid => (paused.get(uuid) ?? 0) > now();

  function recordPass(uuid) {
    const since = now() - RATE_WINDOW_MS;
    const passes = (history.get(uuid) ?? []).filter(time => time > since);
    passes.push(now());
    history.set(uuid, passes);
    return passes.length;
  }

  function stopLoop(actor) {
    const names = [...(writers.get(actor.uuid) ?? [])];
    requested.delete(actor.uuid);
    paused.set(actor.uuid, now() + LOOP_PAUSE_MS);
    history.delete(actor.uuid);
    onLoop(actor, names);
  }

  /** `fromHook`: started by `schedule()`; explicit calls always get their first pass. */
  async function synchronize(actor, { fromHook = false } = {}) {
    if (!allowed(actor) || (fromHook && isPaused(actor.uuid))) return;
    requested.set(actor.uuid, actor);
    if (running.has(actor.uuid)) return running.get(actor.uuid);
    // Started in a microtask so `running` is set before the first task runs.
    const operation = Promise.resolve()
      .then(async () => {
        let passes = 0;
        while (requested.has(actor.uuid)) {
          const current = requested.get(actor.uuid);
          passes++;
          const recent = recordPass(actor.uuid);
          if ((fromHook || passes > 1) && (passes > MAX_SETTLING_PASSES || recent > MAX_PASSES_PER_WINDOW)) {
            stopLoop(current);
            break;
          }
          requested.delete(actor.uuid);
          writers.set(actor.uuid, new Set());
          for (const task of tasks) {
            currentTask.set(actor.uuid, task.name || "anonymous task");
            try {
              await task(current);
            } catch (error) {
              onError(current, task.name, error);
            }
          }
          currentTask.delete(actor.uuid);
        }
      })
      .finally(() => {
        running.delete(actor.uuid);
        currentTask.delete(actor.uuid);
      });
    running.set(actor.uuid, operation);
    return operation;
  }

  function schedule(actor) {
    if (!allowed(actor) || isPaused(actor.uuid)) return;
    if (running.has(actor.uuid)) {
      // A change during a pass, usually a task's own write: run one more pass
      // once this one ends, and remember which task was writing.
      requested.set(actor.uuid, actor);
      writers.get(actor.uuid)?.add(currentTask.get(actor.uuid) ?? "external change");
      return;
    }
    clearTimeout(timers.get(actor.uuid));
    timers.set(
      actor.uuid,
      setTimeout(() => {
        timers.delete(actor.uuid);
        if (!isPaused(actor.uuid))
          void synchronize(actor, { fromHook: true }).catch(error => onError(actor, "synchronize", error));
      }, 50)
    );
  }

  /** Actors whose hook-triggered sync is paused by the loop guard, with the pause end (ms epoch). */
  function pausedActors() {
    return [...paused].filter(([uuid]) => isPaused(uuid)).map(([uuid, until]) => ({ uuid, until }));
  }

  return { synchronize, schedule, pausedActors };
}
