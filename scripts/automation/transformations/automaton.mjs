import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, findFeature, automationData, isAutomationAuthority, notify, itemUses } from "../shared/helpers.mjs";
import { baseAbilityValue } from "../shared/dnd5e.mjs";
import { AUTOMATON_FEATURES, AUTOMATON_MODELS } from "../shared/automaton-definitions.mjs";
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

export const automatonState = actor => actor?.getFlag?.(MODULE_ID, "automatonState") ?? {};
export const automatonCharacterLevel = characterLevel;
export function automatonTransformationLevel(actor) {
  return transformationTier(actor, "automaton");
}
export function automatonHas(actor, id) {
  const entry = AUTOMATON_FEATURES.find(e => e.id === id),
    item = entry && findFeature(actor, entry.key);
  return Boolean(item && !item.isSuppressed && automatonTransformationLevel(actor) >= entry.level);
}
export function automatonAvailable(actor, item) {
  return item?.system?.identifier === "automaton-transformation"
    ? automatonTransformationLevel(actor) > 0
    : AUTOMATON_FEATURES.some(e => e.key === item?.system?.identifier && automatonHas(actor, e.id));
}
export const automatonDC = actor =>
  8 + Number(actor.system?.attributes?.prof ?? 0) + Number(actor.system?.abilities?.str?.mod ?? 0);
export const automatonChange = effectChange;
export const automatonPassiveActive = (actor, key) =>
  [...(actor?.effects ?? [])].some(e => e.getFlag?.(MODULE_ID, "automatonPassive") === key && isEffectActive(e));
export const automatonResistanceActive = actor =>
  automatonHas(actor, "resistance") && automatonPassiveActive(actor, "resistance");
export function automatonPassiveDefinitions(actor) {
  const result = [],
    level = automatonTransformationLevel(actor),
    state = automatonState(actor);
  const add = (key, id, changes, description = "") =>
    result.push(
      flaggedPassiveEffectData(MODULE_ID, "automatonPassive", {
        key,
        feature: findFeature(actor, `automaton-${id}`),
        changes,
        description
      })
    );
  if (automatonHas(actor, "form")) {
    const effect = [...(actor.effects ?? [])].find(
      e => e.getFlag?.(MODULE_ID, "automatonPassive") === "form" && isEffectActive(e)
    );
    const changes = [automatonChange("system.details.type.value", "construct", "override")];
    for (const [ability, bonus] of [
      ["str", 2],
      ["con", 1]
    ]) {
      const own = Number(effect?.system?.changes?.find(c => c.key === `system.abilities.${ability}.value`)?.value ?? 0),
        raw = baseAbilityValue(actor, ability);
      const base = raw >= 16 ? raw : Math.max(raw, Number(actor.system.abilities[ability].value) - own),
        amount = Math.max(0, Math.min(bonus, 16 - base));
      if (amount) changes.push(automatonChange(`system.abilities.${ability}.value`, amount));
    }
    add("form", "form", changes);
  }
  if (automatonHas(actor, "model") && AUTOMATON_MODELS[state.model]) {
    const changes = [];
    if (state.model === "agile") {
      const units = actor.system.attributes.movement.units,
        ten = units === "m" || units === "meters" ? 3 : 10;
      changes.push(
        automatonChange("system.attributes.movement.walk", ten),
        automatonChange("system.abilities.dex.bonuses.save", level)
      );
    }
    if (state.model === "juggernaut")
      changes.push(
        automatonChange("system.attributes.ac.calc", "flat", "override"),
        automatonChange("system.attributes.ac.flat", 19, "override"),
        automatonChange("system.abilities.con.bonuses.save", level)
      );
    // Warrior's state is used by conditional attack hooks, not a global advantage.
    add("model", "model", changes, "Выбранная модель и её условные атаки.");
  }
  if (automatonHas(actor, "armor") && automatonCharacterLevel(actor))
    add("armor", "armor", [automatonChange("system.attributes.hp.bonuses.overall", automatonCharacterLevel(actor))]);
  if (automatonHas(actor, "flight"))
    add("flight", "flight", [
      automatonChange(
        "system.attributes.movement.fly",
        Number(actor.system.attributes.movement.walk ?? 0),
        "upgrade",
        "final",
        40
      )
    ]);
  if (automatonHas(actor, "resistance") && AUTOMATON_MODELS[state.model])
    add(
      "resistance",
      "resistance",
      [],
      "Источник иммунитета/сопротивления/преимущества: только подходящие заклинания и магические эффекты Midi."
    );
  return result;
}
const syncing = new Set();
export async function syncAutomaton(actor) {
  if (!enabled() || !isAutomationAuthority(actor) || !actor.system?.attributes) return;
  if (
    !automatonTransformationLevel(actor) &&
    ![...(actor.effects ?? [])].some(e => e.getFlag?.(MODULE_ID, "automatonPassive"))
  )
    return;
  await syncFlaggedPassiveEffects(actor, syncing, MODULE_ID, "automatonPassive", automatonPassiveDefinitions);
  for (const effect of [...(actor.effects ?? [])]) {
    const key = effect.getFlag?.(MODULE_ID, "automatonStateEffect"),
      dependency = { bastion: "bastion", equipment: "equipment", antimagic: "antimagic" }[key];
    if (dependency && !automatonHas(actor, dependency)) await effect.delete();
  }
  const item = findFeature(actor, "automaton-steel");
  if (item && automatonHas(actor, "steel") && itemUses(item).maximum !== Number(actor.system.attributes.prof))
    await item.update({ "system.uses.max": String(actor.system.attributes.prof) });
}
export function automatonRegeneration(actor) {
  if (!automatonHas(actor, "living")) return 0;
  const hp = actor.system.attributes.hp,
    maximum = Number(hp.effectiveMax ?? Number(hp.max) + Number(hp.tempmax ?? 0)),
    threshold = Math.floor(maximum / 2);
  return Number(hp.value) > 0 && Number(hp.value) < threshold ? Math.min(10, threshold - Number(hp.value)) : 0;
}
export function validateAutomatonItem(item, _data, _options, userId) {
  if (!enforcesTransformationPrerequisites(item, userId, "automaton-transformation")) return;
  if (Number(item.parent.system?.abilities?.str?.value ?? 0) < 13) {
    notify("Автоматон: требуется Сила 13.", "warn");
    return false;
  }
}
export function validateAutomatonAdvancement(manager, _updates, toCreate, toUpdate, toDelete) {
  if (!enabled()) return;
  const created = toCreate.filter(i => automationData(i).transformation === "automaton");
  if (!created.length) return;
  const removed = new Set(toDelete),
    all = advancementResult(manager, toCreate, toUpdate, toDelete);
  for (const item of created) {
    const entry = AUTOMATON_FEATURES.find(e => e.key === item.system?.identifier);
    if (!entry || entry.flaw) continue;
    if (
      all.filter(i => i.system?.identifier === entry.key).length > 1 ||
      [...manager.actor.items].some(i => !removed.has(i.id) && i.system?.identifier === entry.key)
    ) {
      notify(`«${entry.name}» уже получено: выберите другой бонус.`, "warn");
      return false;
    }
  }
}
export function inspectAutomaton(actor) {
  return {
    level: automatonTransformationLevel(actor),
    dc: automatonTransformationLevel(actor) ? automatonDC(actor) : null,
    state: structuredClone(automatonState(actor)),
    regeneration: automatonRegeneration(actor),
    passiveEffects: [...(actor.effects ?? [])]
      .filter(e => e.getFlag?.(MODULE_ID, "automatonPassive") || e.getFlag?.(MODULE_ID, "automatonStateEffect"))
      .map(e => ({ uuid: e.uuid, name: e.name, active: isEffectActive(e) })),
    unavailable: AUTOMATON_FEATURES.filter(e => findFeature(actor, e.key) && !automatonHas(actor, e.id)).map(e => ({
      id: e.id,
      reason: "Уровень ещё не открыт или особенность подавлена"
    }))
  };
}
