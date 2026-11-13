import { MODULE_ID, SETTINGS } from "./constants.mjs";
import { automationData, enabled, notify } from "./helpers.mjs";
import { flagState } from "./flag-state.mjs";

// Building blocks shared by the tiered transformations (Arkane, Automaton,
// Broodmother, Chimera, Death Knight, Dullahan, Factory, God, Hag, Dragon,
// Illithid). Each transformation keeps its own exported names; only the
// copy-pasted bodies live here, so a rules fix lands everywhere at once.

/** Sum of class levels: transformation tiers unlock from the whole character. */
export function characterLevel(actor) {
  return [...(actor?.items ?? [])]
    .filter(item => item.type === "class")
    .reduce((total, item) => total + Number(item.system.levels ?? 0), 0);
}

/** Default unlock: one tier per five character levels, between 1 and 4. */
export const unlockedTier = level => Math.max(1, Math.min(4, Math.ceil(Number(level) / 5)));

/**
 * Current tier: the highest tier granted by owned items of transformation `id`,
 * capped by the tier the character level unlocks. A classless actor is not
 * capped. `include` excludes items that carry the transformation flag but must
 * not grant tiers (shared Chimera boons, Factory options and materials).
 */
export function transformationTier(actor, id, { unlocked = unlockedTier, include = () => true } = {}) {
  const root = `${id}-transformation`;
  const highest = Math.max(
    0,
    ...[...(actor?.items ?? [])]
      .filter(item => automationData(item).transformation === id && include(item))
      .map(item => Number(automationData(item).transformationLevel ?? (item.system?.identifier === root ? 1 : 0)))
  );
  const total = characterLevel(actor);
  return Math.min(highest, total ? unlocked(total) : 4);
}

/** Flag-backed transformation state; see flagState for the serialized `patch` contract. */
export const transformationState = (flag, lock) => flagState(flag, lock);

/** One Active Effect change in the Foundry v14 `{type, phase}` format. */
export const effectChange = (key, value, type = "add", phase = "initial", priority = 20) => ({
  key,
  value: String(value),
  type,
  phase,
  priority
});

/** Whether a preCreateItem call must enforce the optional prerequisites of this transformation root. */
export function enforcesTransformationPrerequisites(item, userId, identifier) {
  return (
    userId === game.user.id &&
    enabled() &&
    Boolean(game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) &&
    item.system?.identifier === identifier &&
    Boolean(item.parent)
  );
}

/** Owned items that survive an advancement (everything not in `toDelete`). */
export function advancementSurvivors(manager, toDelete) {
  const removed = new Set(toDelete);
  return [...(manager.actor.items ?? [])].filter(item => !removed.has(item.id));
}

/** Owned items as they will be after an advancement: deletions removed, updates merged, creations added. */
export function advancementResult(manager, toCreate, toUpdate, toDelete) {
  const removed = new Set(toDelete);
  const documents = new Map(
    [...manager.actor.items].filter(item => !removed.has(item.id)).map(item => [item.id, item.toObject?.() ?? item])
  );
  for (const data of toUpdate)
    documents.set(data._id, foundry.utils.mergeObject(documents.get(data._id) ?? {}, data, { inplace: false }));
  for (const [index, data] of toCreate.entries()) documents.set(data._id ?? `new-${index}`, data);
  return [...documents.values()];
}

/** A granted document duplicates one that is already owned or granted twice in the same advancement. */
export function isDuplicateGrant(document, owned, toCreate) {
  const identifier = document.system?.identifier;
  return (
    toCreate.filter(item => item.system?.identifier === identifier).length > 1 ||
    owned.some(item => item.system?.identifier === identifier)
  );
}

/**
 * Cancel an advancement that grants a one-time boon twice. Returns false after
 * warning (Foundry hook cancellation), undefined otherwise. `keepOwned` filters
 * owned items that should not count as copies (e.g. temporarily shared boons).
 */
export function rejectDuplicateBoons(manager, toCreate, toDelete, isBoon, keepOwned = () => true) {
  const owned = advancementSurvivors(manager, toDelete).filter(keepOwned);
  const duplicate = toCreate.find(document => isBoon(document) && isDuplicateGrant(document, owned, toCreate));
  if (!duplicate) return;
  notify(`«${duplicate.name}» уже получено.`, "warn");
  return false;
}
