import { MODULE_ID } from "./constants.mjs";

// Which actors carry this module's data (flags, items or effects), so frequent
// events (world time, token moves, actor updates, turns) can visit those few
// actors instead of every actor and every token on every scene.
//
// Unlinked tokens are judged from their base actor and the token's own delta
// source, so the synthetic actor is only built for tokens that carry module
// data. The cached list is rebuilt lazily after a change that can alter
// membership: creating or deleting a document that carries module data, or
// an update that touches this module's flags or a token's actor binding/delta.

const COMPENDIUM_PREFIX = `Compendium.${MODULE_ID}.`;
const MAX_AGE_MS = 60_000; // defense in depth against a missed invalidation
let cached = null;
let builtAt = 0;
let installed = false;

// Documents mirror their source; read either so partial objects work too.
const hasModuleFlags = data => {
  const flags = (data?.flags ?? data?._source?.flags)?.[MODULE_ID];
  return Boolean(flags && typeof flags === "object" && Object.keys(flags).length);
};

/** An item or effect (document or source data) that belongs to this module. */
export function isModuleEmbedded(data) {
  const stats = data?._stats ?? data?._source?._stats;
  return hasModuleFlags(data) || String(stats?.compendiumSource ?? "").startsWith(COMPENDIUM_PREFIX);
}

/** Whether an actor (document or source data) carries any of this module's data. */
export function hasModuleData(actor) {
  if (!actor) return false;
  if (hasModuleFlags(actor)) return true;
  for (const item of actor.items ?? []) if (isModuleEmbedded(item)) return true;
  for (const effect of actor.effects ?? []) if (isModuleEmbedded(effect)) return true;
  return false;
}

/** Every world actor and every token's actor on every scene (builds all synthetic actors). */
export function everyActor() {
  const actors = new Map();
  const add = actor => {
    if (actor?.uuid) actors.set(actor.uuid, actor);
  };
  for (const actor of game.actors ?? []) add(actor);
  for (const scene of game.scenes ?? []) for (const token of scene.tokens ?? []) add(token.actor);
  return [...actors.values()];
}

function worldActor(id) {
  return game.actors?.get?.(id) ?? [...(game.actors ?? [])].find(actor => actor.id === id) ?? null;
}

function buildIndex() {
  const actors = new Map(),
    baseRelevance = new Map();
  const add = actor => {
    if (actor?.uuid && !actors.has(actor.uuid) && hasModuleData(actor)) actors.set(actor.uuid, actor);
  };
  for (const actor of game.actors ?? []) add(actor);
  for (const scene of game.scenes ?? [])
    for (const token of scene.tokens ?? []) {
      // Linked tokens resolve to world actors, already visited.
      if (token.actorLink === true) continue;
      const source = token._source ?? token,
        knowsBinding = "actorLink" in source || "actorId" in source || "delta" in source;
      if (knowsBinding) {
        const id = source.actorId ?? token.actorId;
        if (!id) continue;
        if (!baseRelevance.has(id)) baseRelevance.set(id, hasModuleData(worldActor(id)));
        if (!baseRelevance.get(id) && !hasModuleData(source.delta ?? token.delta?._source)) continue;
      }
      add(token.actor);
    }
  return [...actors.values()];
}

/**
 * Actors carrying this module's data, world and synthetic. Cached once the
 * invalidation hooks are installed and the world is ready; otherwise (tests,
 * early init) computed fresh on every call.
 */
export function automationActors() {
  if (!installed || !game.ready) return buildIndex();
  if (!cached || Date.now() - builtAt > MAX_AGE_MS) {
    cached = buildIndex();
    builtAt = Date.now();
  }
  return [...cached];
}

/** Drop the cached index; the next automationActors() call rebuilds it. */
export function invalidateActorIndex() {
  cached = null;
}

const touchesModuleFlags = changes => {
  const flags = changes?.flags;
  if (flags && (Object.hasOwn(flags, MODULE_ID) || Object.hasOwn(flags, `-=${MODULE_ID}`))) return true;
  return Object.keys(changes ?? {}).some(key => key.startsWith(`flags.${MODULE_ID}`) || key === `flags.-=${MODULE_ID}`);
};
const touchesDelta = changes => {
  if (!changes) return false;
  if (Object.hasOwn(changes, "actorId") || Object.hasOwn(changes, "actorLink")) return true;
  const delta = changes.delta;
  if (!delta) return false;
  return touchesModuleFlags(delta) || Array.isArray(delta.items) || Array.isArray(delta.effects);
};

/** Keep the index current. Membership changes only with module data, so ordinary HP or movement updates are free. */
export function installActorIndexHooks() {
  if (installed) return;
  installed = true;
  const always = () => invalidateActorIndex();
  for (const hook of [
    "createActor",
    "deleteActor",
    "createToken",
    "deleteToken",
    "createScene",
    "deleteScene",
    "ready"
  ])
    Hooks.on(hook, always);
  for (const hook of ["createItem", "deleteItem", "createActiveEffect", "deleteActiveEffect"])
    Hooks.on(hook, document => {
      if (isModuleEmbedded(document)) invalidateActorIndex();
    });
  for (const hook of ["updateActor", "updateItem", "updateActiveEffect"])
    Hooks.on(hook, (_document, changes) => {
      if (touchesModuleFlags(changes)) invalidateActorIndex();
    });
  Hooks.on("updateToken", (_token, changes) => {
    if (touchesDelta(changes)) invalidateActorIndex();
  });
  // A synthetic actor's own changes, when the core reports them on its delta.
  Hooks.on("updateActorDelta", (_delta, changes) => {
    if (touchesModuleFlags(changes) || Array.isArray(changes?.items) || Array.isArray(changes?.effects))
      invalidateActorIndex();
  });
}
