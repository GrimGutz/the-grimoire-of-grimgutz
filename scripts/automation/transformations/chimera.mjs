import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, findFeature, automationData, isAutomationAuthority, notify } from "../shared/helpers.mjs";
import { baseAbilityValue } from "../shared/dnd5e.mjs";
import { CHIMERA_FEATURES } from "../shared/chimera-definitions.mjs";
import { flaggedPassiveEffectData, syncFlaggedPassiveEffects } from "../effects/passive-helpers.mjs";
import { isEffectActive } from "../effects/temporary-effects.mjs";
import {
  characterLevel,
  transformationTier,
  transformationState,
  effectChange,
  enforcesTransformationPrerequisites,
  advancementSurvivors,
  advancementResult,
  isDuplicateGrant,
  rejectDuplicateBoons
} from "../shared/transformation-core.mjs";
import { effectKey, movementSpeed } from "../shared/system-paths.mjs";
export const chimeraState = actor => actor?.getFlag?.(MODULE_ID, "chimeraState") ?? {};
export const chimeraCharacterLevel = characterLevel;
export const chimeraShared = item => item?.getFlag?.(MODULE_ID, "chimeraShared");
export const chimeraSharedActive = item => {
  const s = chimeraShared(item);
  return Boolean(s && !s.disabled && Number(s.expiresAt) > Number(game.time.worldTime));
};
export function chimeraTransformationLevel(actor) {
  return transformationTier(actor, "chimera", { include: i => !chimeraShared(i) });
}
export function chimeraItem(actor, id) {
  return [...(actor?.items ?? [])].find(
    i => i.system?.identifier === `chimera-${id}` && !i.isSuppressed && (!chimeraShared(i) || chimeraSharedActive(i))
  );
}
export function chimeraHas(actor, id) {
  const e = CHIMERA_FEATURES.find(e => e.id === id),
    item = e && chimeraItem(actor, id);
  return Boolean(item && (chimeraSharedActive(item) || chimeraTransformationLevel(actor) >= e.level));
}
export const chimeraLevelFor = (actor, id) =>
  Number(chimeraShared(chimeraItem(actor, id))?.tier ?? chimeraTransformationLevel(actor));
export const chimeraAvailable = (actor, item) =>
  !item?.isSuppressed &&
  (!chimeraShared(item) || chimeraSharedActive(item)) &&
  (item?.system?.identifier === "chimera-transformation"
    ? chimeraTransformationLevel(actor) > 0
    : CHIMERA_FEATURES.some(e => e.key === item?.system?.identifier && chimeraHas(actor, e.id)));
export const chimeraDC = actor =>
  8 + Number(actor?.system?.attributes?.prof ?? 0) + Number(actor?.system?.abilities?.con?.mod ?? 0);
export const chimeraChange = effectChange;
export const chimeraAdaptation = (actor, id) =>
  chimeraHas(actor, "menagerie") &&
  (chimeraState(actor).menagerie ?? []).slice(0, Math.max(0, Number(actor.system.attributes.prof))).includes(id);
export const chimeraMutation = actor => (chimeraHas(actor, "aberration") ? chimeraState(actor).mutation?.id : null);
export const chimeraKnowledge = (actor, id) =>
  chimeraHas(actor, "knowledge") && chimeraState(actor).knowledge?.adaptation === id;
export function chimeraPassiveDefinitions(actor) {
  const result = [],
    state = chimeraState(actor),
    change = chimeraChange;
  const add = (key, id, changes) =>
    result.push(
      flaggedPassiveEffectData(MODULE_ID, "chimeraPassive", { key, feature: chimeraItem(actor, id), changes })
    );
  if (chimeraHas(actor, "form")) {
    const current = [...(actor.effects ?? [])].find(
        e => e.getFlag?.(MODULE_ID, "chimeraPassive") === "form" && isEffectActive(e)
      ),
      changes = [change("system.details.type.value", "monstrosity", "override")];
    for (const [key, bonus] of [
      ["con", 2],
      ["str", 1]
    ]) {
      const own = Number(current?.system?.changes?.find(c => c.key === `system.abilities.${key}.value`)?.value ?? 0),
        raw = baseAbilityValue(actor, key),
        base = raw >= 16 ? raw : Math.max(raw, Number(actor.system.abilities[key].value) - own),
        amount = Math.max(0, Math.min(bonus, 16 - base));
      if (amount) changes.push(change(`system.abilities.${key}.value`, amount));
    }
    add("form", "form", changes);
  }
  const level = chimeraCharacterLevel(actor),
    walk = Number(movementSpeed(actor, "walk") ?? 0);
  for (const [id, changes] of [
    ["turtle", [change("system.attributes.ac.bonus", 1)]],
    ["bear", [change("system.attributes.hp.bonuses.overall", level)]],
    ["ram", [change(effectKey("system.attributes.movement.walk"), 10)]],
    ["fly", [change("flags.midi-qol.actions.reactionsMax", 2, "upgrade")]]
  ])
    if (chimeraAdaptation(actor, id)) add(`adaptation-${id}`, "menagerie", changes);
  if (chimeraHas(actor, "knowledge") && state.knowledge) {
    const k = state.knowledge,
      changes = [];
    if (k.skill && actor.system.skills?.[k.skill])
      changes.push(
        k.grade === 3
          ? change(effectKey(`system.skills.${k.skill}.bonuses.check`), 2)
          : change(`system.skills.${k.skill}.value`, k.grade, "upgrade")
      );
    if (chimeraKnowledge(actor, "spider"))
      changes.push(change(effectKey("system.attributes.movement.climb"), walk, "upgrade", "final", 40));
    if (chimeraKnowledge(actor, "fish"))
      changes.push(change(effectKey("system.attributes.movement.swim"), walk, "upgrade", "final", 40));
    if (changes.length) add("knowledge", "knowledge", changes);
  }
  if (chimeraHas(actor, "wings"))
    add("wings", "wings", [change(effectKey("system.attributes.movement.fly"), walk, "upgrade", "final", 40)]);
  if (chimeraHas(actor, "resistance"))
    add("resistance", "resistance", [
      change("system.attributes.hp.bonuses.overall", 2 * level),
      ...(state.resistance ? [change("system.traits.dr.value", state.resistance)] : [])
    ]);
  // This marker is necessary: disabling/suppressing it switches source-specific
  // resistance/reflection off. No broad DR against non-spell damage is granted.
  if (chimeraHas(actor, "carapace")) add("carapace", "carapace", []);
  const mutation = chimeraMutation(actor),
    changes = {
      fire: [change("system.traits.dv.value", "fire")],
      wisdom: [change("system.abilities.wis.save.roll.mode", -1, "override")],
      beast: [change("system.details.type.value", "beast", "override", "final", 60)],
      reactions: [change("flags.midi-qol.actions.reactionsMax", 0, "override", "final", 100)],
      initiative:
        (actor.system.attributes.init?.ability || globalThis.CONFIG?.DND5E?.defaultAbilities?.initiative || "dex") ===
        "dex"
          ? [change("system.attributes.init.roll.mode", -1, "override")]
          : [],
      poison: [change("system.traits.dr.value", "poison"), change("system.traits.ci.value", "poisoned")]
    };
  if (changes[mutation]?.length || ["hitdice", "perception", "healing"].includes(mutation))
    add("mutation", "aberration", changes[mutation] ?? []);
  return result;
}
export const chimeraPassiveActive = (actor, key) =>
  [...(actor?.effects ?? [])].some(e => e.getFlag?.(MODULE_ID, "chimeraPassive") === key && isEffectActive(e));
export const chimeraCarapaceActive = actor => chimeraHas(actor, "carapace") && chimeraPassiveActive(actor, "carapace");
const syncing = new Set();
export async function syncChimera(actor) {
  if (!enabled() || !isAutomationAuthority(actor) || !actor.system?.attributes) return;
  if (
    ![...(actor.items ?? [])].some(i => automationData(i).transformation === "chimera") &&
    ![...(actor.effects ?? [])].some(e => e.getFlag?.(MODULE_ID, "chimeraPassive"))
  )
    return;
  await syncFlaggedPassiveEffects(actor, syncing, MODULE_ID, "chimeraPassive", chimeraPassiveDefinitions);
}
export function validateChimeraItem(item, _data, _options, userId) {
  if (!enforcesTransformationPrerequisites(item, userId, "chimera-transformation")) return;
  if (Number(item.parent.system.abilities.con.value) < 13) {
    notify("Химера: требуется Телосложение 13.", "warn");
    return false;
  }
}
export function validateChimeraAdvancement(manager, _updates, toCreate, _toUpdate, toDelete) {
  if (!enabled()) return;
  return rejectDuplicateBoons(
    manager,
    toCreate,
    toDelete,
    d => automationData(d).transformation === "chimera" && automationData(d).chimeraBoon,
    i => !chimeraShared(i)
  );
}
export function inspectChimera(actor) {
  return {
    level: chimeraTransformationLevel(actor),
    dc: chimeraDC(actor),
    state: structuredClone(chimeraState(actor)),
    shared: [...(actor.items ?? [])]
      .filter(chimeraShared)
      .map(i => ({ uuid: i.uuid, active: chimeraSharedActive(i), ...structuredClone(chimeraShared(i)) })),
    unavailable: CHIMERA_FEATURES.filter(e => findFeature(actor, e.key) && !chimeraHas(actor, e.id)).map(e => ({
      id: e.id,
      reason: "Ступень не открыта, особенность подавлена или срок передачи истёк"
    }))
  };
}
