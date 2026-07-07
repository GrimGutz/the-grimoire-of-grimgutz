import { FLAGS, MODULE_ID } from "./constants.mjs";
import {
  enabled,
  findFeature,
  hasFeature,
  isAutomationAuthority
} from "./helpers.mjs";

const AURA_SYNC_DELAY = 100;
const INCAPACITATED_STATUSES = new Set(["incapacitated", "unconscious", "paralyzed", "petrified", "stunned"]);

let auraSyncTimeout = null;
let lastProcessedTurn = null;

const AURA_DEFINITIONS = [
  {
    id: "death-knight-battle-undead",
    name: "Боевая нежить",
    radius: 60,
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

function hasActiveEffectFlag(actor, flag) {
  return actorEffects(actor).some(effect => !effect.disabled && effectFlag(effect, flag));
}

function activeTokens() {
  return canvas?.tokens?.placeables?.filter(token => token?.actor && !token.document?.hidden) ?? [];
}

function tokenUuid(token) {
  return token?.document?.uuid ?? token?.document?.id ?? token?.id ?? "";
}

function auraKey(definition, sourceToken) {
  return `${definition.id}:${tokenUuid(sourceToken)}`;
}

function tokenCenter(token) {
  return token?.center ?? {
    x: Number(token?.document?.x ?? 0) + Number(token?.w ?? 0) / 2,
    y: Number(token?.document?.y ?? 0) + Number(token?.h ?? 0) / 2
  };
}

function tokenDistance(sourceToken, targetToken) {
  if (!sourceToken || !targetToken) return Number.POSITIVE_INFINITY;
  if (sourceToken === targetToken) return 0;
  const source = tokenCenter(sourceToken);
  const target = tokenCenter(targetToken);
  const gridSize = Number(canvas?.dimensions?.size ?? canvas?.scene?.grid?.size ?? 100) || 100;
  const gridDistance = Number(canvas?.scene?.grid?.distance ?? canvas?.dimensions?.distance ?? 5) || 5;
  return Math.hypot(source.x - target.x, source.y - target.y) / gridSize * gridDistance;
}

function sameToken(sourceToken, targetToken) {
  return tokenUuid(sourceToken) === tokenUuid(targetToken);
}

function sameDisposition(sourceToken, targetToken) {
  const sourceDisposition = Number(sourceToken?.document?.disposition ?? 0);
  const targetDisposition = Number(targetToken?.document?.disposition ?? 0);
  return sourceDisposition === targetDisposition;
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
    if (effect.disabled) return false;
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
    || token?.actor?.effects?.some?.(effect => effect.statuses?.has?.("dead")) === true;
}

function sourceMatches(definition, sourceToken) {
  const actor = sourceToken?.actor;
  if (!actor) return false;
  if (!isAutomationAuthority(actor)) return false;
  if (definition.sourceFeature && !hasFeature(actor, definition.sourceFeature)) return false;
  if (definition.sourceEffectFlag && !hasActiveEffectFlag(actor, definition.sourceEffectFlag)) return false;
  if (definition.sourceCondition && !definition.sourceCondition(sourceToken)) return false;
  return true;
}

function targetsForAura(definition, sourceToken, tokens = activeTokens()) {
  return tokens.filter(targetToken =>
    targetToken?.actor
    && relationMatches(definition, sourceToken, targetToken)
    && targetTypeMatches(definition, targetToken)
    && tokenDistance(sourceToken, targetToken) <= Number(definition.radius ?? 0)
  );
}

function baseEffectData(definition, sourceToken, targetToken) {
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
    origin: provided.origin ?? sourceToken.actor?.uuid ?? null,
    transfer: false,
    disabled: false,
    showIcon: 1,
    statuses: provided.statuses ?? [],
    tint: provided.tint ?? "#ffffff",
    start: null,
    duration: {
      value: null,
      units: "seconds",
      expiry: null,
      expired: false
    },
    flags: {
      [MODULE_ID]: {
        [FLAGS.AURA_EFFECT]: definition.id,
        [FLAGS.AURA_SOURCE]: tokenUuid(sourceToken),
        [FLAGS.AURA_KEY]: key
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
    system: data?.system ?? {}
  });
}

async function reconcileActorAuraEffects(actor, desiredEffects) {
  if (!actor?.isOwner && !game.user?.isGM) return;

  const existing = new Map();
  for (const effect of actorEffects(actor)) {
    const key = effectFlag(effect, FLAGS.AURA_KEY);
    if (key) existing.set(key, effect);
  }

  const creates = [];
  const updates = [];
  for (const [key, data] of desiredEffects) {
    const current = existing.get(key);
    if (!current) creates.push(data);
    else if (effectSignature(current) !== effectSignature(data)) updates.push({ _id: current.id, ...data });
    existing.delete(key);
  }

  const deletes = [...existing.values()].map(effect => effect.id);
  if (deletes.length) await actor.deleteEmbeddedDocuments("ActiveEffect", deletes);
  if (updates.length) await actor.updateEmbeddedDocuments("ActiveEffect", updates);
  if (creates.length) await actor.createEmbeddedDocuments("ActiveEffect", creates);
}

export async function syncSceneAuras() {
  if (!enabled() || !isAuraAuthority() || !canvas?.ready) return false;

  const tokens = activeTokens();
  const desiredByActor = new Map();
  for (const token of tokens) {
    if (token.actor) desiredByActor.set(token.actor.uuid, { actor: token.actor, effects: new Map() });
  }

  for (const definition of AURA_DEFINITIONS) {
    if (!definition.effect) continue;
    for (const sourceToken of tokens) {
      if (!sourceMatches(definition, sourceToken)) continue;
      for (const targetToken of targetsForAura(definition, sourceToken, tokens)) {
        const data = baseEffectData(definition, sourceToken, targetToken);
        if (!data) continue;
        const bucket = desiredByActor.get(targetToken.actor.uuid);
        if (bucket) bucket.effects.set(data.flags[MODULE_ID][FLAGS.AURA_KEY], data);
      }
    }
  }

  for (const { actor, effects } of desiredByActor.values()) {
    await reconcileActorAuraEffects(actor, effects);
  }
  return true;
}

export function scheduleAuraSync() {
  if (!enabled() || !isAuraAuthority()) return;
  if (auraSyncTimeout) window.clearTimeout(auraSyncTimeout);
  auraSyncTimeout = window.setTimeout(() => {
    auraSyncTimeout = null;
    void syncSceneAuras().catch(error => console.error(`${MODULE_ID} | Aura sync failed`, error));
  }, AURA_SYNC_DELAY);
}

async function damageWithMidi({ sourceActor, sourceToken, targetTokens, formula, type, flavor }) {
  const RollClass = CONFIG.Dice?.DamageRoll ?? Roll;
  const roll = await new RollClass(formula, sourceActor.getRollData(), { type, flavor }).evaluate();
  const Workflow = globalThis.MidiQOL?.DamageOnlyWorkflow;
  if (Workflow && targetTokens.length) {
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
  return roll;
}

async function processStartTurnAuras(sourceToken) {
  if (!enabled() || !isAuraAuthority() || !sourceToken?.actor) return false;
  const tokens = activeTokens();
  let processed = false;
  for (const definition of AURA_DEFINITIONS) {
    const damage = definition.startTurnDamage;
    if (!damage || !sourceMatches(definition, sourceToken)) continue;
    const targetTokens = targetsForAura(definition, sourceToken, tokens);
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
  return combatant?.token?.object ?? canvas?.tokens?.get(combatant?.tokenId);
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
  Hooks.on("createItem", scheduleAuraSync);
  Hooks.on("updateItem", scheduleAuraSync);
  Hooks.on("deleteItem", scheduleAuraSync);
  Hooks.on("updateCombat", (combat, changes) => {
    if (!enabled() || (!Object.hasOwn(changes, "turn") && !Object.hasOwn(changes, "round"))) return;
    scheduleAuraSync();
    const key = turnKey(combat);
    if (lastProcessedTurn === key) return;
    lastProcessedTurn = key;
    void processStartTurnAuras(currentCombatToken(combat)).catch(error => {
      console.error(`${MODULE_ID} | Aura start-turn automation failed`, error);
    });
  });
  Hooks.on("deleteCombat", () => {
    lastProcessedTurn = null;
    scheduleAuraSync();
  });
}

export const auraDefinitions = AURA_DEFINITIONS;
