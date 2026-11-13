import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, findFeature, automationData, isAutomationAuthority, notify, itemUses } from "../shared/helpers.mjs";
import { baseAbilityValue } from "../shared/dnd5e.mjs";
import { ARKANE_FEATURES, arkaneUnlockedTier, arkaneDailyCost } from "../shared/arkane-definitions.mjs";
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
const arkaneStore = transformationState("arkaneState", "arkane-state");
export const arkaneState = arkaneStore.read;
export const patchArkane = arkaneStore.patch;
export const arkaneCharacterLevel = characterLevel;
export function arkaneTransformationLevel(actor) {
  return transformationTier(actor, "arkane", { unlocked: arkaneUnlockedTier });
}
export function arkaneHas(actor, id) {
  const entry = ARKANE_FEATURES.find(entry => entry.id === id);
  return Boolean(
    entry &&
    findFeature(actor, entry.key) &&
    arkaneTransformationLevel(actor) >= entry.level &&
    (!entry.requires || arkaneHas(actor, entry.requires))
  );
}
export function arkaneAvailable(actor, item) {
  if (item?.system?.identifier === "arkane-transformation") return arkaneTransformationLevel(actor) > 0;
  const id = ARKANE_FEATURES.find(entry => entry.key === item?.system?.identifier)?.id;
  return id ? arkaneHas(actor, id) : false;
}
export const arkaneDC = actor =>
  8 + Number(actor.system.attributes.prof) + arkaneTransformationLevel(actor) + Number(actor.system.abilities.int.mod);
export const arkaneSnapshot = actor => ({
  level: arkaneTransformationLevel(actor),
  dc: arkaneDC(actor),
  characterLevel: arkaneCharacterLevel(actor),
  int: Number(actor.system.abilities.int.mod)
});
export const arkaneChange = effectChange;
export function arkaneBodyActive(actor) {
  return (
    arkaneHas(actor, "body") &&
    [...(actor.effects ?? [])].some(
      effect => effect.getFlag?.(MODULE_ID, "arkanePassive") === "body" && isEffectActive(effect)
    )
  );
}
export function arkanePassiveDefinitions(actor) {
  const result = [];
  if (arkaneHas(actor, "form")) {
    const current = [...(actor.effects ?? [])].find(
        e => e.getFlag?.(MODULE_ID, "arkanePassive") === "form" && isEffectActive(e)
      ),
      changes = [];
    for (const [ability, bonus] of [
      ["int", 4],
      ["con", 2]
    ]) {
      const own = Number(
          current?.system?.changes?.find(c => c.key === `system.abilities.${ability}.value`)?.value ?? 0
        ),
        raw = baseAbilityValue(actor, ability),
        base = raw >= 22 ? raw : Math.max(0, Number(actor.system.abilities[ability].value) - own),
        amount = Math.max(0, Math.min(bonus, 22 - base));
      if (!amount) continue;
      changes.push(arkaneChange(`system.abilities.${ability}.value`, amount));
      const cap = Number(actor._source?.system?.abilities?.[ability]?.max ?? 20);
      if (base + amount > cap) changes.push(arkaneChange(`system.abilities.${ability}.max`, base + amount, "upgrade"));
    }
    if (changes.length)
      result.push(
        flaggedPassiveEffectData(MODULE_ID, "arkanePassive", {
          key: "form",
          feature: findFeature(actor, "arkane-form"),
          changes
        })
      );
  }
  // Necessary source-scoped resistance state: no unconditional resistance to
  // mundane damage, nor advantage on non-spell saving throws.
  if (arkaneHas(actor, "body"))
    result.push(
      flaggedPassiveEffectData(MODULE_ID, "arkanePassive", {
        key: "body",
        feature: findFeature(actor, "arkane-body"),
        description: "Сопротивление урону и преимущество спасбросков только от заклинаний (Midi-QOL).",
        changes: []
      })
    );
  return result;
}
const syncing = new Set();
export async function syncArkane(actor) {
  if (!enabled() || !isAutomationAuthority(actor) || !actor.system?.attributes) return;
  if (
    !arkaneTransformationLevel(actor) &&
    ![...(actor.effects ?? [])].some(e => e.getFlag?.(MODULE_ID, "arkanePassive"))
  )
    return;
  await syncFlaggedPassiveEffects(actor, syncing, MODULE_ID, "arkanePassive", arkanePassiveDefinitions);
  for (const entry of ARKANE_FEATURES.filter(entry => entry.intUses)) {
    const item = findFeature(actor, entry.key);
    if (!item || !arkaneHas(actor, entry.id)) continue;
    const maximum = Math.max(0, Number(actor.system.abilities.int.mod));
    if (itemUses(item).maximum !== maximum) await item.update({ "system.uses.max": String(maximum) });
  }
  if (arkaneTransformationLevel(actor) && !Number.isFinite(arkaneState(actor).fusion))
    await patchArkane(actor, latest =>
      Number.isFinite(latest.fusion) ? latest : { ...latest, fusion: 0, totalFusion: 0 }
    );
}
export async function changeArkaneFusion(actor, amount) {
  // Concurrent gains and costs must add up, not overwrite each other.
  return patchArkane(actor, state => {
    state.fusion = Math.max(0, Number(state.fusion ?? 0) + Number(amount));
    if (amount > 0) state.totalFusion = Number(state.totalFusion ?? 0) + Number(amount);
  });
}
export function arkanePrerequisiteFailures(actor) {
  const result = [];
  if (arkaneCharacterLevel(actor) < 13) result.push("уровень персонажа 13");
  if (Number(actor.system?.abilities?.int?.value ?? 0) < 16) result.push("Интеллект 16");
  return result;
}
export function validateArkaneItem(item, _data, _options, userId) {
  if (!enforcesTransformationPrerequisites(item, userId, "arkane-transformation")) return;
  const failures = arkanePrerequisiteFailures(item.parent);
  if (failures.length) {
    notify(`Присутствие: ${failures.join("; ")}.`, "warn");
    return false;
  }
}
export function validateArkaneAdvancement(manager, _updates, toCreate, toUpdate, toDelete) {
  if (!enabled()) return;
  const created = toCreate.filter(item => automationData(item).transformation === "arkane");
  if (!created.length) return;
  const removed = new Set(toDelete),
    all = advancementResult(manager, toCreate, toUpdate, toDelete);
  for (const item of created) {
    const entry = ARKANE_FEATURES.find(entry => entry.key === item.system?.identifier);
    if (!entry || entry.flaw) continue;
    if (entry.requires && !all.some(item => item.system?.identifier === `arkane-${entry.requires}`)) {
      notify(
        `${entry.name}: требуется ${ARKANE_FEATURES.find(e => e.id === entry.requires).name}. Выберите другой бонус.`,
        "warn"
      );
      return false;
    }
    if (
      all.filter(item => item.system?.identifier === entry.key).length > 1 ||
      [...manager.actor.items].some(item => !removed.has(item.id) && item.system?.identifier === entry.key)
    ) {
      notify(`Бонус «${entry.name}» уже получен: выберите другой.`, "warn");
      return false;
    }
  }
}
export function inspectArkane(actor) {
  return {
    level: arkaneTransformationLevel(actor),
    dc: arkaneTransformationLevel(actor) ? arkaneDC(actor) : null,
    state: structuredClone(arkaneState(actor)),
    dailyCost: arkaneDailyCost(arkaneTransformationLevel(actor)),
    barrier: structuredClone(actor?.getFlag?.(MODULE_ID, "arkaneBarrier") ?? null),
    unavailable: ARKANE_FEATURES.filter(entry => findFeature(actor, entry.key) && !arkaneHas(actor, entry.id)).map(
      entry => ({
        id: entry.id,
        reason:
          entry.requires && !arkaneHas(actor, entry.requires)
            ? `Требуется ${entry.requires}`
            : "Уровень трансформации ещё не открыт"
      })
    )
  };
}
