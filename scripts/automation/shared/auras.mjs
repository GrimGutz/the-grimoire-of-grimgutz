import { FLAGS, MODULE_ID, SETTINGS } from "./constants.mjs";
import { automationActors, isEffectActive, isExpiredTemporaryEffect } from "../effects/temporary-effects.mjs";
import { feetToSceneUnits, tokenSceneDistance } from "./spatial.mjs";
import { isForwardTurn } from "./combat-flow.mjs";
import {
  enabled,
  findFeature,
  hasFeature,
  isAutomationAuthority
} from "./helpers.mjs";

const AURA_SYNC_DELAY = 100;
const INCAPACITATED_STATUSES = new Set(["incapacitated", "unconscious", "paralyzed", "petrified", "stunned"]);
const AURA_INDICATOR_FLAG = "auraIndicator";
const DEFAULT_AURA_COLOR = "#7f5cff";

let auraSyncTimeout = null;
let lastProcessedTurn = null;
let auraSyncRunning = null;
const pendingAuraScenes = new Map();
const scheduledAuraScenes = new Map();
const sceneActorCache = new Map();

const AURA_DEFINITIONS = [
  {
    id: "hollow-masking-aura", name: "Аура маскировки", radius: 10,
    indicatorColor: "#b7d6e8", sourceFeature: "masking-aura", sourceEffectFlag: FLAGS.HOLLOW_PASSIVE,
    sourceEffectValue: "masking-aura", affects: "allies", stacking: "highest",
    effect: sourceToken => ({ name: "Аура маскировки: бонус спасбросков", img: findFeature(sourceToken.actor, "masking-aura")?.img,
      description: "Бонус союзнику от Полого. Магическое обнаружение разрешает Мастер.",
      changes: [{ key: "system.bonuses.abilities.save", type: "add", value: String(sourceToken.actor.system?.abilities?.con?.mod ?? 0), phase: "initial", priority: 20 }] })
  },
  {
    id: "death-knight-battle-undead",
    name: "Боевая нежить",
    radius: 60,
    indicatorColor: "#50c878",
    sourceFeature: "battle-undead",
    affects: "selfAndAllies",
    targetType: "undead",
    sourceCondition: sourceToken => !isDefeated(sourceToken) && !isIncapacitated(sourceToken.actor),
    effect: sourceToken => {
      const feature = findFeature(sourceToken.actor, "battle-undead");
      return {
        name: "Боевая нежить: в ауре",
        img: feature?.img ?? "icons/magic/death/undead-skeleton-fire-green.webp",
        origin: feature?.uuid ?? sourceToken.actor?.uuid,
        description: `<p>Вы в пределах 60 футов от ${sourceToken.actor?.name ?? "Рыцаря смерти"}. Преимущество применяется только к спасброскам против эффектов, направленных непосредственно против нежити; выберите преимущество вручную при таком спасброске.</p>`,
        changes: []
      };
    }
  },
  {
    id: "spirit-vessel-fiend-flames",
    name: "Пламя исчадия",
    radius: 5,
    indicatorColor: "#ff5a36",
    sourceEffectFlag: FLAGS.SPIRIT_VESSEL_FIEND_FLAMES_EFFECT,
    affects: "nonSelf",
    startTurnDamage: {
      formula: "1d6",
      type: "fire",
      flavor: "Пламя исчадия"
    }
  }
];

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

function sceneDocuments(collection) {
  if (!collection) return [];
  if (Array.isArray(collection.contents)) return collection.contents;
  if (typeof collection.filter === "function") return collection.filter(document => document);
  if (typeof collection.values === "function") return [...collection.values()];
  return [...collection];
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

function auraKey(definition, sourceToken) {
  return `${definition.id}:${tokenUuid(sourceToken)}`;
}

function auraIndicatorEnabled(definition) {
  return definition.indicator !== false && Number(definition.radius ?? 0) > 0;
}

function tokenCenter(token) {
  return token?.center ?? {
    x: Number(token?.document?.x ?? 0) + Number(token?.w ?? 0) / 2,
    y: Number(token?.document?.y ?? 0) + Number(token?.h ?? 0) / 2
  };
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

function isIncapacitated(actor) {
  return actorEffects(actor).some(effect => {
    if (!isEffectActive(effect)) return false;
    const statuses = effect.statuses ?? effect.statuses?.value ?? [];
    if (typeof statuses.has === "function") {
      for (const status of INCAPACITATED_STATUSES) if (statuses.has(status)) return true;
      return false;
    }
    return [...statuses].some(status => INCAPACITATED_STATUSES.has(String(status)));
  });
}

function isDefeated(token) {
  return token?.combatant?.defeated === true
    || token?.document?.combatant?.defeated === true
    || token?.actor?.statuses?.has?.("dead") === true
    || token?.actor?.effects?.some?.(effect => isEffectActive(effect) && effect.statuses?.has?.("dead")) === true;
}

function sourceMatches(definition, sourceToken) {
  const actor = sourceToken?.actor;
  if (!actor) return false;
  if (!isAutomationAuthority(actor)) return false;
  if (definition.sourceFeature && !hasFeature(actor, definition.sourceFeature)) return false;
  if (definition.sourceEffectFlag && !hasActiveEffectFlag(actor, definition.sourceEffectFlag, definition.sourceEffectValue)) return false;
  if (definition.sourceCondition && !definition.sourceCondition(sourceToken)) return false;
  return true;
}

function targetsForAura(definition, sourceToken, tokens = activeTokens(), scene = canvas?.scene) {
  return tokens.filter(targetToken =>
    targetToken?.actor
    && relationMatches(definition, sourceToken, targetToken)
    && targetTypeMatches(definition, targetToken)
    && tokenDistance(sourceToken, targetToken, scene) <= feetToSceneUnits(definition.radius ?? 0, scene)
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
    origin: targetToken.actor?.uuid ?? null,
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

function auraIndicatorData(definition, sourceToken, scene) {
  const center = tokenCenter(sourceToken);
  const color = definition.indicatorColor ?? DEFAULT_AURA_COLOR;
  const key = auraKey(definition, sourceToken);
  return {
    t: "circle",
    author: game.user.id,
    x: center.x,
    y: center.y,
    direction: 0,
    distance: feetToSceneUnits(definition.radius ?? 0, scene),
    hidden: Boolean(sourceToken.document?.hidden),
    borderColor: definition.indicatorBorderColor ?? color,
    fillColor: definition.indicatorFillColor ?? color,
    flags: {
      [MODULE_ID]: {
        [AURA_INDICATOR_FLAG]: true,
        [FLAGS.AURA_EFFECT]: definition.id,
        [FLAGS.AURA_SOURCE]: tokenUuid(sourceToken),
        [FLAGS.AURA_KEY]: key,
        auraName: definition.name,
        sourceActor: sourceToken.actor?.uuid ?? null
      }
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

function auraIndicatorSignature(templateOrData) {
  const data = templateOrData?.toObject ? templateOrData.toObject() : templateOrData;
  return JSON.stringify({
    t: data?.t,
    x: Number(data?.x ?? 0),
    y: Number(data?.y ?? 0),
    direction: Number(data?.direction ?? 0),
    distance: Number(data?.distance ?? 0),
    borderColor: data?.borderColor ?? "",
    fillColor: data?.fillColor ?? "",
    hidden: Boolean(data?.hidden),
    flags: data?.flags?.[MODULE_ID] ?? {}
  });
}

async function reconcileAuraIndicators(desiredIndicators, scene = canvas?.scene) {
  if (!scene || !game.user?.isGM) return;

  const existing = new Map();
  const deletes = [];
  for (const template of sceneDocuments(scene.templates)) {
    if (!effectFlag(template, AURA_INDICATOR_FLAG)) continue;
    const key = effectFlag(template, FLAGS.AURA_KEY);
    if (!key || existing.has(key)) deletes.push(template.id);
    else existing.set(key, template);
  }

  const creates = [];
  const updates = [];
  for (const [key, data] of desiredIndicators) {
    const current = existing.get(key);
    if (!current) creates.push(data);
    else if (auraIndicatorSignature(current) !== auraIndicatorSignature(data)) updates.push({ _id: current.id, ...data });
    existing.delete(key);
  }

  deletes.push(...[...existing.values()].map(template => template.id));
  if (deletes.length) await scene.deleteEmbeddedDocuments("MeasuredTemplate", deletes);
  if (updates.length) await scene.updateEmbeddedDocuments("MeasuredTemplate", updates);
  if (creates.length) await scene.createEmbeddedDocuments("MeasuredTemplate", creates);
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
    return false;
  }

  const tokens = activeTokens(scene);
  const desiredByActor = new Map();
  const desiredIndicators = new Map();
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
      if (!definition.effect) continue;
      for (const targetToken of targetsForAura(definition, sourceToken, tokens, scene)) {
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
  }

  for (const { actor, effects } of desiredByActor.values()) {
    try { await reconcileActorAuraEffects(actor, effects, scene.id); }
    catch (error) { console.error(`${MODULE_ID} | Aura effects failed for ${actor.uuid}`, error); }
    if (!effects.size && !actorEffects(actor).some(effect => effectScene(effect) === scene.id)) cached.delete(actor.uuid);
  }
  await reconcileAuraIndicators(desiredIndicators, scene);
  return true;
}

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

async function damageWithMidi({ sourceActor, sourceToken, targetTokens, formula, type, flavor }) {
  const RollClass = CONFIG.Dice?.DamageRoll ?? Roll;
  const roll = await new RollClass(formula, sourceActor.getRollData(), { type, flavor }).evaluate();
  const Workflow = globalThis.MidiQOL?.DamageOnlyWorkflow;
  if (Workflow && targetTokens.length && sourceToken?.document?.object) {
    new Workflow(sourceActor, sourceToken, roll.total, type, targetTokens, roll, {
      flavor,
      itemCardId: "new",
      itemData: {
        name: flavor,
        type: "feat",
        img: "icons/magic/fire/flame-burning-creature-skeleton.webp",
        system: {
          actionType: "other",
          damage: { parts: [[formula, type]] }
        }
      }
    });
    return roll;
  }

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: sourceActor, token: sourceToken }),
    flavor: `${flavor}: ${targetTokens.map(token => token.name).join(", ") || "нет целей"}`
  });
  for (const token of targetTokens) {
    await token.actor.applyDamage([{ value: roll.total, type }], { invertHealing: false });
  }
  return roll;
}

async function processStartTurnAuras(sourceToken, scene = canvas?.scene) {
  if (!enabled() || !isAuraAuthority() || !sourceToken?.actor) return false;
  const tokens = activeTokens(scene);
  let processed = false;
  for (const definition of AURA_DEFINITIONS) {
    const damage = definition.startTurnDamage;
    if (!damage || !sourceMatches(definition, sourceToken)) continue;
    const targetTokens = targetsForAura(definition, sourceToken, tokens, scene);
    if (!targetTokens.length) continue;
    await damageWithMidi({
      sourceActor: sourceToken.actor,
      sourceToken,
      targetTokens,
      formula: damage.formula,
      type: damage.type,
      flavor: damage.flavor ?? definition.name
    });
    processed = true;
  }
  return processed;
}

function currentCombatToken(combat) {
  const combatant = combat?.combatant;
  return activeTokens(combat.scene ?? canvas?.scene).find(token => token.document.id === combatant?.tokenId)
    ?? combatant?.token?.object ?? canvas?.tokens?.get(combatant?.tokenId);
}

function turnKey(combat) {
  return `${combat?.id ?? "combat"}:${combat?.round ?? 0}:${combat?.turn ?? 0}`;
}

export function installAuraHooks() {
  Hooks.once("ready", scheduleAuraSync);
  Hooks.on("canvasReady", scheduleAuraSync);
  Hooks.on("createToken", scheduleAuraSync);
  Hooks.on("deleteToken", scheduleAuraSync);
  Hooks.on("updateToken", (_tokenDocument, changes) => {
    if (["x", "y", "elevation", "hidden", "disposition", "width", "height"].some(key => Object.hasOwn(changes, key))) {
      scheduleAuraSync();
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
    if (!enabled() || !isForwardTurn(combat, changes)) return;
    scheduleAuraSync(combat.scene);
    const key = turnKey(combat);
    if (lastProcessedTurn === key) return;
    lastProcessedTurn = key;
    void processStartTurnAuras(currentCombatToken(combat), combat.scene ?? canvas?.scene).catch(error => {
      console.error(`${MODULE_ID} | Aura start-turn automation failed`, error);
    });
  });
  Hooks.on("deleteCombat", () => {
    lastProcessedTurn = null;
    scheduleAuraSync();
  });
}

export const auraDefinitions = AURA_DEFINITIONS;
