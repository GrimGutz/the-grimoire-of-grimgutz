import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, isAutomationAuthority, findFeature } from "../shared/helpers.mjs";
import { baseAbilityValue } from "../shared/dnd5e.mjs";
import { flaggedPassiveEffectData, syncFlaggedPassiveEffects } from "../effects/passive-helpers.mjs";
import { isEffectActive } from "../effects/temporary-effects.mjs";
import { feetToSceneUnits } from "../shared/spatial.mjs";
import { encounterForActor } from "../shared/combat-flow.mjs";
import {
  factoryHas,
  factoryState,
  factoryLevel,
  factoryCharacterLevel,
  factoryActiveRecords,
  factoryContext,
  factoryAugment,
  factoryInstalledItem,
  factoryAddicted,
  factoryAscended
} from "./factory.mjs";
import { syncFactoryItems } from "./factory-items.mjs";
import { effectKey, movementSpeed } from "../shared/system-paths.mjs";
export const factoryChange = (key, value, type = "add", phase = "initial", priority = 20) => ({
  key,
  value: String(value),
  type,
  phase,
  priority
});
export function factoryPassiveDefinitions(actor) {
  const effects = [],
    add = (key, item, changes) => {
      if (changes.length)
        effects.push(flaggedPassiveEffectData(MODULE_ID, "factoryPassive", { key, feature: item, changes }));
    };
  if (factoryHas(actor, "form")) {
    const s = factoryState(actor),
      changes = [];
    if (["construct", "undead"].includes(s.bodyType))
      changes.push(factoryChange("system.details.type.value", s.bodyType, "override"));
    for (const [ability, bonus] of [["int", 2], ...(s.physical ? [[s.physical, 1]] : [])]) {
      const previous = [...(actor.effects ?? [])]
        .filter(e => e.getFlag?.(MODULE_ID, "factoryPassive") && isEffectActive(e))
        .reduce(
          (n, e) =>
            n +
            (e.system?.changes ?? [])
              .filter(c => c.key === `system.abilities.${ability}.value` && c.type === "add")
              .reduce((v, c) => v + Number(c.value), 0),
          0
        );
      const raw = baseAbilityValue(actor, ability),
        base = Math.max(raw, Number(actor.system.abilities[ability].value) - previous),
        amount = Math.max(0, Math.min(bonus, 16 - base));
      if (amount) changes.push(factoryChange(`system.abilities.${ability}.value`, amount));
    }
    add("form", findFeature(actor, "factory-form"), changes);
  }
  if (factoryHas(actor, "armor"))
    add("armor", findFeature(actor, "factory-armor"), [
      factoryChange("system.attributes.hp.bonuses.overall", factoryCharacterLevel(actor))
    ]);
  if (factoryHas(actor, "grounding"))
    add("grounding", findFeature(actor, "factory-grounding"), [factoryChange("system.traits.dr.value", "lightning")]);
  if (factoryHas(actor, "perfection"))
    add("perfection", findFeature(actor, "factory-perfection"), [
      factoryChange("system.traits.dr.value", "poison"),
      ...["frightened", "poisoned", "paralyzed", "charmed"].map(s => factoryChange("system.traits.ci.value", s))
    ]);
  if (factoryAddicted(actor)) {
    const changes = [factoryChange("system.traits.dv.value", "psychic")];
    if (factoryHas(actor, "withdrawal"))
      changes.push(factoryChange("flags.midi-qol.disadvantage.attack.all", "true", "override"));
    add("addiction", findFeature(actor, "factory-addiction"), changes);
  }
  for (const record of factoryActiveRecords(actor)) {
    const id = record.augmentId,
      ctx = factoryContext(actor, record),
      item = factoryInstalledItem(actor, record),
      c = [],
      walk = Number(movementSpeed(actor, "walk") ?? 0),
      units = actor.system.attributes.movement.units ?? "ft";
    if (id === "senses") c.push(factoryChange("system.skills.prc.roll.mode", 1, "override"));
    if (id === "reflexes") c.push(factoryChange(effectKey("system.attributes.init.bonus"), ctx.int));
    if (id === "neural" && record.save)
      c.push(factoryChange(effectKey(`system.abilities.${record.save}.bonuses.save`), ctx.int));
    if (id === "spikes")
      c.push(factoryChange(effectKey("system.attributes.movement.climb"), walk, "upgrade", "final", 40));
    if (id === "tendons")
      c.push(factoryChange(effectKey("system.attributes.movement.walk"), feetToSceneUnits(10, { grid: { units } })));
    if (id === "skin")
      c.push(
        factoryChange("system.attributes.ac.calc", "custom", "override"),
        factoryChange(
          "system.attributes.ac.formula",
          `${factoryAugment(actor, "adamant-skin") ? 15 : 13} + @abilities.dex.mod`,
          "override"
        )
      );
    if (id === "adamant-skin") c.push(factoryChange("flags.midi-qol.grants.noCritical.all", "true", "override"));
    if (id === "sturdy")
      c.push(
        factoryChange(
          "system.attributes.hp.bonuses.overall",
          Math.floor(Number(record.recipientLevel ?? factoryCharacterLevel(actor)) / 2)
        )
      );
    if (id === "focus") c.push(factoryChange("system.attributes.concentration.roll.mode", 1, "override"));
    if (id === "transplant" && record.damageType && record.damageType !== "psychic")
      c.push(factoryChange("system.traits.dr.value", record.damageType));
    if (id === "second-mind") c.push(factoryChange("system.attributes.concentration.limit", 2, "upgrade"));
    if (id === "immovable" && factoryAugment(actor, "skin")) c.push(factoryChange("system.traits.ci.value", "prone"));
    if (["con", "str", "dex"].includes(id))
      c.push(
        factoryChange(`system.abilities.${id}.value`, 2),
        factoryChange(
          `system.abilities.${id}.max`,
          Number(actor._source?.system?.abilities?.[id]?.max ?? CONFIG.DND5E.maxAbilityScore ?? 20) + 2,
          "upgrade"
        )
      );
    if (id === "air-walkers") {
      const combat = encounterForActor(actor);
      if (combat?.combatant?.actor?.uuid === actor.uuid)
        c.push(factoryChange(effectKey("system.attributes.movement.fly"), walk, "upgrade", "final", 40));
    }
    add(`augment:${record.id}`, item, c);
  }
  return effects;
}
const syncing = new Set();
export async function syncFactory(actor) {
  if (!enabled() || !isAutomationAuthority(actor) || !actor.system?.attributes) return;
  if (
    !factoryLevel(actor) &&
    !factoryActiveRecords(actor).length &&
    ![...(actor.effects ?? [])].some(e => e.getFlag?.(MODULE_ID, "factoryPassive"))
  )
    return;
  await syncFlaggedPassiveEffects(actor, syncing, MODULE_ID, "factoryPassive", factoryPassiveDefinitions);
  await syncFactoryItems(actor);
  if (factoryAddicted(actor))
    for (const effect of [...(actor.concentration?.effects ?? [])]) await actor.endConcentration(effect);
}
