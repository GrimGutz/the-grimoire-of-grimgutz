import { MODULE_ID, SETTINGS } from "../shared/constants.mjs";
import { enabled, isAutomationAuthority, findFeature, itemUses, notify } from "../shared/helpers.mjs";
import { EMPATH_MASKS, empathTotalLevel } from "../shared/empath-definitions.mjs";
import { empathLevel, empathState, empathMask, empathMaskActive } from "../shared/empath-state.mjs";
import { flaggedPassiveEffectData, syncFlaggedPassiveEffects } from "../effects/passive-helpers.mjs";
import { isEffectActive } from "../effects/temporary-effects.mjs";
export const empathFeet = (feet, units) =>
  /^(m|м|метр)$/u.test(String(units ?? "ft").toLowerCase()) ? Number(feet) * 0.3048 : Number(feet);
export const empathChange = (key, value, type = "add", phase = "initial", priority = 20) => ({
  key,
  value: String(value),
  type,
  phase,
  priority
});
export function empathPrerequisiteFailures(actor) {
  const result = [],
    wis = Number(actor.system?.abilities?.wis?.value ?? 0),
    cha = Number(actor.system?.abilities?.cha?.value ?? 0);
  if (empathTotalLevel(actor) < 5) result.push("общий уровень 5 до первого уровня Эмпата");
  if (Math.min(wis, cha) < 14 || Math.max(wis, cha) < 16) result.push("Харизма и Мудрость 14; хотя бы одна 16");
  return result;
}
export function validateEmpathItem(item, _data, _options, userId) {
  if (
    userId !== game.user.id ||
    !enabled() ||
    !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES) ||
    item.type !== "class" ||
    item.system.identifier !== "empath" ||
    !item.parent
  )
    return;
  const failed = empathPrerequisiteFailures(item.parent);
  if (failed.length) {
    notify(`Эмпат: ${failed.join("; ")}.`, "warn");
    return false;
  }
}
export function empathPassiveDefinitions(actor) {
  if (!empathMaskActive(actor)) return [];
  const mask = empathMask(actor),
    changes = [],
    make = (key, feature, list) =>
      flaggedPassiveEffectData(MODULE_ID, "empathPassive", {
        key,
        feature: findFeature(actor, feature),
        name: `Эмпат: ${mask.name}`,
        img: mask.img,
        changes: list
      });
  if (mask.id === "calm") changes.push(empathChange("system.attributes.ac.bonus", 1, "add", "final"));
  if (mask.id === "joy")
    changes.push(
      empathChange(
        "system.attributes.movement.walk",
        empathFeet(10, actor.system.attributes.movement?.units),
        "add",
        "final"
      )
    );
  const existingNature = [...(actor.effects ?? [])].find(
      e => e.getFlag?.(MODULE_ID, "empathPassive") === "nature" && isEffectActive(e)
    ),
    oldWisdom = Number(existingNature?.system?.changes?.find(c => c.key === "system.abilities.wis.value")?.value ?? 0),
    newWisdom =
      empathLevel(actor) >= 4 &&
      findFeature(actor, "empath-nature") &&
      empathState(actor).nature !== "feat" &&
      mask.id === "calm"
        ? 2
        : 0;
  if (mask.id === "calm" && empathLevel(actor) >= 5 && findFeature(actor, "empath-facets"))
    changes.push(
      empathChange(
        "system.attributes.init.bonus",
        Math.floor((Number(actor.system.abilities.wis.value) - oldWisdom + newWisdom - 10) / 2),
        "add",
        "final"
      )
    );
  const definitions = changes.length ? [make("mask", "empath-masks", changes)] : [];
  if (empathLevel(actor) >= 4 && findFeature(actor, "empath-nature") && empathState(actor).nature !== "feat") {
    const ability = mask.ability,
      cap = Number(actor._source?.system?.abilities?.[ability]?.max ?? globalThis.CONFIG?.DND5E?.maxAbilityScore ?? 20);
    definitions.push(
      make("nature", "empath-nature", [
        empathChange(`system.abilities.${ability}.max`, cap + 2, "override"),
        empathChange(`system.abilities.${ability}.value`, 2)
      ])
    );
  }
  return definitions;
}
const syncing = new Set();
export async function syncEmpath(actor) {
  if (!enabled() || !isAutomationAuthority(actor) || !actor.system?.attributes) return;
  if (!empathLevel(actor) && ![...(actor.effects ?? [])].some(e => e.getFlag?.(MODULE_ID, "empathPassive"))) return;
  await syncFlaggedPassiveEffects(actor, syncing, MODULE_ID, "empathPassive", empathPassiveDefinitions);
  if (!empathLevel(actor)) return;
  if (!EMPATH_MASKS.some(mask => mask.id === empathState(actor).mask))
    await actor.setFlag(MODULE_ID, "empathState", { ...structuredClone(empathState(actor)), mask: "calm" });
  for (const id of ["masks", "impulse"]) {
    const item = findFeature(actor, `empath-${id}`);
    if (item && itemUses(item).maximum !== Number(actor.system.attributes.prof))
      await item.update({ "system.uses.max": String(actor.system.attributes.prof) });
  }
}
