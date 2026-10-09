import { FLAGS, MODULE_ID, SETTINGS } from "./constants.mjs";
import { automationActors, isEffectActive, isExpiredTemporaryEffect } from "../effects/temporary-effects.mjs";
import { feetToSceneUnits, tokenSceneDistance } from "./spatial.mjs";
import { installAuraEventHooks } from "./aura-events.mjs";
import { AURA_DEFINITIONS, auraFeature } from "./aura-definitions.mjs";
import { auraKey, auraIndicatorData, reconcileAuraIndicators, tokensInAuraTemplate } from "./aura-templates.mjs";
import {
  enabled,
  isAutomationAuthority
} from "./helpers.mjs";

const AURA_SYNC_DELAY = 100;
let auraSyncTimeout = null;
let auraSyncRunning = null;
const pendingAuraScenes = new Map();
const scheduledAuraScenes = new Map();
const sceneActorCache = new Map();
const sceneAuraFrames = new Map();

function isAuraAuthority() {
  const activeGM = game.users?.activeGM;
  if (activeGM) return activeGM.id === game.user.id;
  return game.user?.isGM === true;
}

function actorEffects(actor) {
  return [...(actor?.effects ?? [])];
}

function effectFlag(effect, key) {
  return effect?.getFlag?.(MODULE_ID, key) ?? effect?.flags?.[MODULE_ID]?.[key];
}

function hasActiveEffectFlag(actor, flag, value) {
  return actorEffects(actor).some(effect => isEffectActive(effect) && effectFlag(effect, flag)
    && (value === undefined || effectFlag(effect, flag) === value));
}

function activeTokens(scene = canvas?.scene) {
  if (canvas?.scene === scene && canvas?.ready) return canvas?.tokens?.placeables?.filter(token => token?.actor) ?? [];
  return [...(scene?.tokens ?? [])].filter(document => document.actor).map(document => document.object ?? {
    id: document.id, document, actor: document.actor, combatant: document.combatant,
    center: document.getCenterPoint?.() ?? { x: document.x + document.width * scene.grid.size / 2, y: document.y + document.height * scene.grid.size / 2 }
  });
}

function tokenUuid(token) {
  return token?.document?.uuid ?? token?.document?.id ?? token?.id ?? "";
}

function auraIndicatorEnabled(definition) {
  return definition.indicator !== false && Number(definition.radius ?? 0) > 0;
}

function tokenDistance(sourceToken, targetToken, scene) {
  return tokenSceneDistance(sourceToken, targetToken, scene);
}

function sameToken(sourceToken, targetToken) {
  return tokenUuid(sourceToken) === tokenUuid(targetToken);
}

function sameDisposition(sourceToken, targetToken) {
  const sourceDisposition = Number(sourceToken?.document?.disposition ?? 0);
  const targetDisposition = Number(targetToken?.document?.disposition ?? 0);
  return sourceDisposition !== 0 && sourceDisposition === targetDisposition;
}

function hostileDisposition(sourceToken, targetToken) {
  const sourceDisposition = Number(sourceToken?.document?.disposition ?? 0);
  const targetDisposition = Number(targetToken?.document?.disposition ?? 0);
  return sourceDisposition !== 0 && targetDisposition !== 0 && sourceDisposition !== targetDisposition;
}

function relationMatches(definition, sourceToken, targetToken) {
  switch (definition.affects ?? "all") {
    case "self":
      return sameToken(sourceToken, targetToken);
    case "nonSelf":
      return !sameToken(sourceToken, targetToken);
    case "allies":
      return !sameToken(sourceToken, targetToken) && sameDisposition(sourceToken, targetToken);
    case "selfAndAllies":
      return sameToken(sourceToken, targetToken) || sameDisposition(sourceToken, targetToken);
    case "enemies":
      return hostileDisposition(sourceToken, targetToken);
    case "all":
    default:
      return true;
  }
}

function normalizedCreatureType(actor) {
  const type = actor?.system?.details?.type;
  if (typeof type === "string") return type.toLocaleLowerCase("ru");
  return [
    type?.value,
    type?.subtype,
    type?.custom,
    type?.label
  ].filter(Boolean).join(" ").toLocaleLowerCase("ru");
}

function isUndead(actor) {
  const type = normalizedCreatureType(actor);
  return type.includes("undead") || type.includes("нежит");
}

function targetTypeMatches(definition, targetToken) {
  switch (definition.targetType) {
    case "undead":
      return isUndead(targetToken.actor);
    default:
      return true;
  }
}

function sourceMatches(definition, sourceToken) {
  const actor = sourceToken?.actor;
  if (!actor) return false;
  if (!isAutomationAuthority(actor)) return false;
  if ((definition.sourceFeature || definition.sourceFeatures) && !auraFeature(actor, definition)) return false;
  if (definition.sourceEffectFlag && !hasActiveEffectFlag(actor, definition.sourceEffectFlag, definition.sourceEffectValue)) return false;
  if (definition.sourceCondition && !definition.sourceCondition(sourceToken)) return false;
  return true;
}

function targetsForAura(definition, sourceToken, tokens = activeTokens(), scene = canvas?.scene, template = null) {
  const inside = tokensInAuraTemplate(template, sourceToken, tokens, scene);
  return tokens.filter(targetToken =>
    targetToken?.actor
    && relationMatches(definition, sourceToken, targetToken)
    && targetTypeMatches(definition, targetToken)
    && (!definition.targetCondition || definition.targetCondition(sourceToken, targetToken))
    && (inside ? inside.has(targetToken) : tokenDistance(sourceToken, targetToken, scene) <= feetToSceneUnits(definition.radius ?? 0, scene))
  );
}

function baseEffectData(definition, sourceToken, targetToken, scene) {
  const provided = typeof definition.effect === "function"
    ? definition.effect(sourceToken, targetToken)
    : definition.effect;
  if (!provided) return null;

  const key = auraKey(definition, sourceToken);
  return {
    name: provided.name ?? definition.name,
    img: provided.img ?? "icons/magic/control/silhouette-aura-energy.webp",
    type: "base",
    description: provided.description ?? "",
    origin: provided.origin ?? auraFeature(sourceToken.actor, definition)?.uuid ?? sourceToken.actor?.uuid ?? null,
    transfer: false,
    disabled: false,
    showIcon: 1,
    statuses: provided.statuses ?? [],
    tint: provided.tint ?? "#ffffff",
    start: null,
    flags: {
      [MODULE_ID]: {
        [FLAGS.AURA_EFFECT]: definition.id,
        [FLAGS.AURA_SOURCE]: tokenUuid(sourceToken),
        [FLAGS.AURA_KEY]: key,
        auraScene: scene.id,
        ...(definition.stacking === "highest" ? { auraOriginalChanges: provided.changes ?? [] } : {})
      }
    },
    system: {
      changes: provided.changes ?? []
    }
  };
}

function effectSignature(effectOrData) {
  const data = effectOrData?.toObject ? effectOrData.toObject() : effectOrData;
  return JSON.stringify({
    name: data?.name,
    img: data?.img,
    description: data?.description ?? "",
    disabled: data?.disabled,
    showIcon: data?.showIcon,
    flags: data?.flags?.[MODULE_ID] ?? {},
    origin: data?.origin ?? null,
    statuses: [...(data?.statuses ?? [])].sort(),
    system: data?.system ?? {}
  });
}

function effectScene(effect) {
  return effectFlag(effect, "auraScene") ?? String(effectFlag(effect, FLAGS.AURA_SOURCE) ?? "").match(/^Scene\.([^.]+)/)?.[1];
}

async function reconcileActorAuraEffects(actor, desiredEffects, sceneId = canvas.scene.id) {
  if (!actor?.isOwner && !game.user?.isGM) return;

  const existing = new Map();
  const deletes = [];
  for (const effect of actorEffects(actor)) {
    const key = effectFlag(effect, FLAGS.AURA_KEY);
    if (!key) continue;
    if (sceneId && effectScene(effect) !== sceneId) continue;
    if (existing.has(key)) deletes.push(effect.id);
    else existing.set(key, effect);
  }

  const creates = [];
  const updates = [];
  // Linked actors share a sheet across scenes: retain records, but never add
  // multiple copies of the same bonus to that sheet.
  for (const definition of AURA_DEFINITIONS.filter(definition => definition.stacking === "highest")) {
    const desired = [...desiredEffects.values()].filter(data => data.flags[MODULE_ID][FLAGS.AURA_EFFECT] === definition.id);
    const foreign = actorEffects(actor).filter(effect => effectScene(effect) !== sceneId && isEffectActive(effect) && effectFlag(effect, FLAGS.AURA_EFFECT) === definition.id);
    const candidates = [...desired, ...foreign].map(data => ({ data, key: effectFlag(data, FLAGS.AURA_KEY),
      value: Number((effectFlag(data, "auraOriginalChanges") ?? data.system?.changes)?.[0]?.value ?? -Infinity) }))
      .sort((a, b) => b.value - a.value || String(a.key).localeCompare(String(b.key)));
    for (const data of desired) if (effectFlag(data, FLAGS.AURA_KEY) !== candidates[0]?.key) data.system.changes = [];
  }
  for (const [key, data] of desiredEffects) {
    const current = existing.get(key);
    if (!current) creates.push(data);
    else if (current.disabled || isExpiredTemporaryEffect(current)) {
      deletes.push(current.id);
      creates.push(data);
    }
    else if (effectSignature(current) !== effectSignature(data)) updates.push({ _id: current.id, ...data });
    existing.delete(key);
  }

  deletes.push(...[...existing.values()].map(effect => effect.id));
  if (deletes.length) await actor.deleteEmbeddedDocuments("ActiveEffect", deletes);
  if (updates.length) await actor.updateEmbeddedDocuments("ActiveEffect", updates);
  if (creates.length) await actor.createEmbeddedDocuments("ActiveEffect", creates);
  const stackingUpdates = [];
  for (const definition of AURA_DEFINITIONS.filter(definition => definition.stacking === "highest")) {
    const candidates = actorEffects(actor).filter(effect => effectFlag(effect, FLAGS.AURA_EFFECT) === definition.id && isEffectActive(effect))
      .sort((a, b) => Number(effectFlag(b, "auraOriginalChanges")?.[0]?.value ?? -Infinity) - Number(effectFlag(a, "auraOriginalChanges")?.[0]?.value ?? -Infinity)
        || String(effectFlag(a, FLAGS.AURA_KEY)).localeCompare(String(effectFlag(b, FLAGS.AURA_KEY))));
    for (const effect of candidates) {
      const changes = effect === candidates[0] ? effectFlag(effect, "auraOriginalChanges") ?? [] : [];
      const current = effect.toObject?.().system?.changes ?? effect.system?.changes ?? [];
      if (JSON.stringify(current) !== JSON.stringify(changes)) stackingUpdates.push({ _id: effect.id, "system.changes": changes });
    }
  }
  if (stackingUpdates.length) await actor.updateEmbeddedDocuments("ActiveEffect", stackingUpdates);
}

async function syncSceneAurasPass(scene) {
  if (!isAuraAuthority() || !scene) return false;
  if (!enabled()) {
    for (const actor of automationActors()) await reconcileActorAuraEffects(actor, new Map(), null);
    for (const scene of game.scenes ?? []) await reconcileAuraIndicators(new Map(), scene);
    sceneActorCache.clear();
    sceneAuraFrames.clear();
    return false;
  }

  const tokens = activeTokens(scene);
  const desiredByActor = new Map();
  const desiredIndicators = new Map();
  const sources = [];
  let cached = sceneActorCache.get(scene.id);
  if (!cached) {
    cached = new Map(automationActors().filter(actor => actorEffects(actor).some(effect => effectScene(effect) === scene.id)).map(actor => [actor.uuid, actor]));
    sceneActorCache.set(scene.id, cached);
  }
  for (const token of tokens) if (token.actor) cached.set(token.actor.uuid, token.actor);
  for (const actor of cached.values()) {
    desiredByActor.set(actor.uuid, { actor, effects: new Map() });
  }

  for (const definition of AURA_DEFINITIONS) {
    for (const sourceToken of tokens) {
      if (!sourceMatches(definition, sourceToken)) continue;
      if (auraIndicatorEnabled(definition)) {
        desiredIndicators.set(auraKey(definition, sourceToken), auraIndicatorData(definition, sourceToken, scene));
      }
      sources.push({ definition, sourceToken });
    }
  }
  const indicators = await reconcileAuraIndicators(desiredIndicators, scene);
  const frames = sources.map(({ definition, sourceToken }) => {
    const template = indicators.get(auraKey(definition, sourceToken));
    return { definition, sourceToken, template, targets: targetsForAura(definition, sourceToken, tokens, scene, template),
      isActive: () => enabled() && sourceMatches(definition, sourceToken) };
  });
  sceneAuraFrames.set(scene.id, frames);
  for (const { definition, sourceToken, targets } of frames) {
    if (!definition.effect) continue;
    for (const targetToken of targets) {
      const data = baseEffectData(definition, sourceToken, targetToken, scene);
      if (!data) continue;
      const bucket = desiredByActor.get(targetToken.actor.uuid);
      if (bucket) {
        if (definition.stacking === "highest") {
          const previous = [...bucket.effects.entries()].find(([, effect]) => effect.flags[MODULE_ID][FLAGS.AURA_EFFECT] === definition.id);
          if (previous && Number(previous[1].system.changes[0]?.value) >= Number(data.system.changes[0]?.value)) continue;
          if (previous) bucket.effects.delete(previous[0]);
        }
        bucket.effects.set(data.flags[MODULE_ID][FLAGS.AURA_KEY], data);
      }
    }
  }

  for (const { actor, effects } of desiredByActor.values()) {
    try { await reconcileActorAuraEffects(actor, effects, scene.id); }
    catch (error) { console.error(`${MODULE_ID} | Aura effects failed for ${actor.uuid}`, error); }
    if (!effects.size && !actorEffects(actor).some(effect => effectScene(effect) === scene.id)) cached.delete(actor.uuid);
  }
  return true;
}

export function getSceneAuraFrames(scene = canvas?.scene) { return sceneAuraFrames.get(scene?.id) ?? []; }

export function syncSceneAuras(scene = canvas?.scene) {
  if (!scene) return Promise.resolve(false);
  pendingAuraScenes.set(scene.id, scene);
  if (auraSyncRunning) return auraSyncRunning;
  auraSyncRunning = (async () => {
    let result;
    while (pendingAuraScenes.size) {
      const [id, next] = pendingAuraScenes.entries().next().value;
      pendingAuraScenes.delete(id);
      result = await syncSceneAurasPass(next);
    }
    return result;
  })().finally(() => { auraSyncRunning = null; });
  return auraSyncRunning;
}

export function scheduleAuraSync(document) {
  if (!isAuraAuthority()) return;
  const exact = document?.documentName === "Scene" ? document : document?.parent?.documentName === "Scene" ? document.parent : null;
  const effectSceneId = effectScene(document);
  if (exact) scheduledAuraScenes.set(exact.id, exact);
  else if (effectSceneId) {
    const scene = game.scenes?.get?.(effectSceneId) ?? [...(game.scenes ?? [])].find(scene => scene.id === effectSceneId);
    if (scene) scheduledAuraScenes.set(scene.id, scene);
  } else {
    if (canvas?.scene) scheduledAuraScenes.set(canvas.scene.id, canvas.scene);
    for (const id of sceneActorCache.keys()) {
      const scene = game.scenes?.get?.(id) ?? [...(game.scenes ?? [])].find(scene => scene.id === id);
      if (scene) scheduledAuraScenes.set(id, scene);
    }
    for (const combat of game.combats ?? []) if (combat.started && combat.scene) scheduledAuraScenes.set(combat.scene.id, combat.scene);
  }
  if (auraSyncTimeout) window.clearTimeout(auraSyncTimeout);
  auraSyncTimeout = window.setTimeout(() => {
    auraSyncTimeout = null;
    const scenes = [...scheduledAuraScenes.values()]; scheduledAuraScenes.clear();
    void Promise.all(scenes.map(scene => syncSceneAuras(scene))).catch(error => console.error(`${MODULE_ID} | Aura sync failed`, error));
  }, AURA_SYNC_DELAY);
}

export function installAuraHooks() {
  installAuraEventHooks({ synchronize: syncSceneAuras, framesForScene: getSceneAuraFrames, tokensForScene: activeTokens, isAuthority: isAuraAuthority });
  Hooks.once("ready", scheduleAuraSync);
  Hooks.on("canvasReady", scheduleAuraSync);
  Hooks.on("createToken", scheduleAuraSync);
  Hooks.on("deleteToken", scheduleAuraSync);
  Hooks.on("updateToken", (_tokenDocument, changes) => {
    if (["x", "y", "elevation", "hidden", "disposition", "width", "height"].some(key => Object.hasOwn(changes, key))) {
      scheduleAuraSync(_tokenDocument);
      // Native Region animation handles every visual frame. Recheck mechanical
      // membership once at the final position, not with an actor sweep per frame.
      queueMicrotask(() => {
        const animation = _tokenDocument.object?.movementAnimationPromise;
        if (animation) void animation.then(() => scheduleAuraSync(_tokenDocument))
          .catch(error => console.error(`${MODULE_ID} | Aura movement sync failed`, error));
      });
    }
  });
  Hooks.on("createActiveEffect", scheduleAuraSync);
  Hooks.on("updateActiveEffect", scheduleAuraSync);
  Hooks.on("deleteActiveEffect", scheduleAuraSync);
  Hooks.on("updateWorldTime", scheduleAuraSync);
  Hooks.on("createItem", scheduleAuraSync);
  Hooks.on("updateItem", scheduleAuraSync);
  Hooks.on("deleteItem", scheduleAuraSync);
  Hooks.on("updateActor", scheduleAuraSync);
  Hooks.on("updateSetting", setting => {
    if (setting.key === `${MODULE_ID}.${SETTINGS.AUTOMATION}`) scheduleAuraSync();
  });
  Hooks.on("updateCombat", (combat, changes) => {
    scheduleAuraSync(combat.scene);
  });
  Hooks.on("deleteCombat", () => {
    scheduleAuraSync();
  });
  for (const name of ["createRegion", "updateRegion", "deleteRegion", "createMeasuredTemplate", "updateMeasuredTemplate", "deleteMeasuredTemplate"])
    Hooks.on(name, document => { if (effectFlag(document, "auraIndicator")) scheduleAuraSync(document); });
}

export const auraDefinitions = AURA_DEFINITIONS;
