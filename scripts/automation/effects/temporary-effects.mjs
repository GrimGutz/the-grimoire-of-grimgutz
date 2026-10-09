import { MODULE_ID } from "../shared/constants.mjs";

const TIME_UNITS = new Set(["seconds", "minutes", "hours", "days", "weeks", "months", "years"]);
let cleanupRunning = null;
const cleanupEvents = new Map();

function sourceData(document) {
  return document?._source ?? document?.toObject?.() ?? document ?? {};
}

function field(data, path) {
  if (Object.hasOwn(data ?? {}, path)) return data[path];
  return path.split(".").reduce((value, key) => value?.[key], data);
}

function setField(data, path, value) {
  if (Object.hasOwn(data, path)) data[path] = value;
  else foundry.utils.setProperty(data, path, value);
}

function durationSpec(duration) {
  if (duration?.value != null && Number.isFinite(Number(duration.value))) {
    return { value: Number(duration.value), units: duration.units ?? "seconds" };
  }
  // Accept legacy inputs, but do not read Foundry's compatibility getters as new input.
  for (const units of ["rounds", "turns", "seconds"]) {
    const descriptor = Object.getOwnPropertyDescriptor(duration ?? {}, units);
    if (descriptor && !descriptor.get && descriptor.value != null && Number.isFinite(Number(descriptor.value))) {
      return { value: Number(descriptor.value), units };
    }
  }
  return null;
}

function durationPatch(update) {
  const result = {};
  for (const key of ["value", "units", "seconds", "rounds", "turns", "expiry", "expired", "startTime", "startRound", "startTurn"]) {
    const value = field(update, `duration.${key}`);
    if (value !== undefined) result[key] = value;
  }
  return result;
}

function hasModuleFlag(effect, update) {
  return Boolean(sourceData(effect).flags?.[MODULE_ID] || field(update, `flags.${MODULE_ID}`));
}

function defaultExpiry(units) {
  const elapsedTime = game.modules?.get("dae")?.active && CONFIG.ActiveEffect?.expiryEvents?.updateWorldTime;
  return TIME_UNITS.has(units) && elapsedTime ? "updateWorldTime" : "turnStart";
}

export function temporaryEffectTiming({ seconds = null, rounds = null, turns = null, expiry = null } = {}) {
  const spec = durationSpec({ seconds, rounds, turns });
  if (!spec) return { duration: { value: null, units: "seconds", expiry: null, expired: false } };
  return {
    start: CONFIG.ActiveEffect.documentClass.getEffectStart(game.combat?.started ? game.combat : null),
    duration: { ...spec, expiry: expiry ?? defaultExpiry(spec.units), expired: false }
  };
}

/** Normalize module effects without restarting the timer on unrelated document updates. */
export function prepareModuleTemporaryEffectExpiry(effect, update = null, options = {}, creationData = null) {
  // An Item effect is a template. Its timer starts when applied to an Actor.
  if (effect?.parent?.documentName && effect.parent.documentName !== "Actor") return;
  if (options["expiry-reason"] || !hasModuleFlag(effect, update ?? creationData)) return;
  const patch = durationPatch(update ?? creationData ?? {});
  if (patch.expired === true) return;

  const base = sourceData(effect).duration ?? {};
  const explicitTimer = ["value", "units", "seconds", "rounds", "turns", "startTime", "startRound", "startTurn"]
    .some(key => Object.hasOwn(patch, key));
  const spec = durationSpec(patch) ?? durationSpec({ ...base, ...patch });
  const oldSpec = durationSpec(base);
  const timerChanged = spec && (spec.value !== oldSpec?.value || spec.units !== oldSpec?.units);
  const startChanged = ["time", "combat", "combatant", "round", "turn"].some(key => {
    const value = field(update, `start.${key}`);
    return value !== undefined && value !== sourceData(effect).start?.[key];
  }) || ["startTime", "startRound", "startTurn"].some(key => {
    const startKey = { startTime: "time", startRound: "round", startTurn: "turn" }[key];
    return patch[key] !== undefined && patch[key] !== sourceData(effect).start?.[startKey];
  });
  const restarting = update && (
    timerChanged || startChanged || options?.[MODULE_ID]?.reactivate === true
    || (base.expired && (explicitTimer || patch.expired === false))
    || (field(update, "disabled") === false && (effect.disabled || base.expired))
  );
  if (update && !restarting) return;

  if (!spec) return;
  const target = update ?? {};
  setField(target, "duration.value", spec.value);
  setField(target, "duration.units", spec.units);
  setField(target, "duration.expired", false);
  setField(target, "duration.expiry", patch.expiry ?? (update && !explicitTimer ? base.expiry : null) ?? defaultExpiry(spec.units));
  setField(target, "flags.dae.expiryMode", "delete");

  const suppliedStart = (update ?? creationData)?.start;
  const start = suppliedStart ?? (update ? null : sourceData(effect).start)
    ?? CONFIG.ActiveEffect.documentClass.getEffectStart(game.combat?.started ? game.combat : null);
  for (const [key, value] of Object.entries(start)) setField(target, `start.${key}`, value);
  if (!update) effect.updateSource(target);
}

export function isExpiredTemporaryEffect(effect, { elapsed = false } = {}) {
  const raw = sourceData(effect).duration ?? {};
  if (!durationSpec(raw)) return false;
  if (raw.expired === true) return true;
  const duration = effect.updateDuration?.() ?? effect.duration ?? raw;
  if (duration.expired === true) return true;
  // A zero-turn effect may remain active until turnEnd/sourceEnd. The native
  // registry or cleanup event, not a damage roll, decides that boundary.
  if (!elapsed && !TIME_UNITS.has(raw.units) && raw.expiry) return false;
  const remaining = duration.secondsRemaining ?? duration.remaining;
  return remaining != null && Number.isFinite(Number(remaining)) && Number(remaining) <= 0;
}

export function isEffectActive(effect) {
  return Boolean(effect && !effect.disabled && effect.active !== false && !effect.isSuppressed && !isExpiredTemporaryEffect(effect));
}

/** Include synthetic actors from every scene; the canvas need not be open. */
export function automationActors() {
  const actors = new Map();
  const add = actor => { if (actor?.uuid) actors.set(actor.uuid, actor); };
  for (const actor of game.actors ?? []) add(actor);
  for (const scene of game.scenes ?? []) {
    for (const token of scene.tokens ?? []) add(token.actor);
  }
  return [...actors.values()];
}

function expiryEventReached(effect, event, context) {
  const raw = sourceData(effect).duration ?? {};
  if (raw.expired || effect.duration?.expired) return true;
  // Startup only clears elapsed real-time timers, not effects waiting for a specific turn event.
  if (event === "ready" || event === "canvasReady") {
    return TIME_UNITS.has(raw.units) && (!raw.expiry || ["turnStart", "updateWorldTime"].includes(raw.expiry));
  }
  if (event === "updateWorldTime" && raw.expiry === "updateWorldTime") return true;
  return effect.isExpiryEvent?.(event, context) ?? (TIME_UNITS.has(raw.units) && event === "updateWorldTime");
}

async function cleanupPass(event, context) {
  for (const actor of automationActors()) {
    // Only disposable actor-owned module effects. Item passives are never deleted here.
    const ids = [...(actor.effects ?? [])]
      .filter(effect => hasModuleFlag(effect) && effect.transfer !== true
        && isExpiredTemporaryEffect(effect, { elapsed: true }) && expiryEventReached(effect, event, context))
      .map(effect => effect.id);
    if (!ids.length) continue;
    try {
      await actor.deleteEmbeddedDocuments("ActiveEffect", ids, {
        "expiry-reason": `${MODULE_ID}:expired-temporary-effect`
      });
    } catch (error) {
      console.error(`${MODULE_ID} | Expired effect cleanup failed for ${actor.uuid}`, error);
    }
  }
}

export function deleteExpiredModuleTemporaryEffects(event = "ready", context = {}) {
  if (!game.users?.activeGM?.isSelf) return Promise.resolve();
  cleanupEvents.set(event, context);
  if (cleanupRunning) return cleanupRunning;
  cleanupRunning = (async () => {
    while (cleanupEvents.size) {
      const [nextEvent, nextContext] = cleanupEvents.entries().next().value;
      cleanupEvents.delete(nextEvent);
      await cleanupPass(nextEvent, nextContext);
    }
  })().finally(() => { cleanupRunning = null; });
  return cleanupRunning;
}

export function installTemporaryEffectHooks() {
  Hooks.on("preCreateActiveEffect", (effect, data, options) => {
    prepareModuleTemporaryEffectExpiry(effect, null, options, data);
  });
  Hooks.on("preUpdateActiveEffect", prepareModuleTemporaryEffectExpiry);
  const cleanup = (event, context) => {
    void deleteExpiredModuleTemporaryEffects(event, context).catch(error => console.error(`${MODULE_ID} | Effect cleanup failed`, error));
  };
  Hooks.once("ready", () => cleanup("ready"));
  Hooks.on("canvasReady", () => cleanup("canvasReady"));
  Hooks.on("updateWorldTime", () => cleanup("updateWorldTime"));
  Hooks.on("updateCombat", (combat, changes) => {
    if (Object.hasOwn(changes, "turn") || Object.hasOwn(changes, "round")) {
      cleanup("turnEnd", { combat });
      cleanup("turnStart", { combat });
    }
  });
  // DAE marks source/target and other custom expiry events; do not reset them.
  Hooks.on("updateActiveEffect", (effect, update) => {
    if (hasModuleFlag(effect) && field(update, "duration.expired") === true) cleanup("expired");
  });
}
