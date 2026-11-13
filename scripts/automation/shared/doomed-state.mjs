import { MODULE_ID } from "./constants.mjs";
import { findFeature } from "./helpers.mjs";
import { classLevel } from "./selectors.mjs";
import { isEffectActive } from "../effects/temporary-effects.mjs";
import { DOOMED_CURSES, doomedSlots } from "./doomed-definitions.mjs";
export const doomedLevel = actor => classLevel(actor, "doomed");
export const doomedState = actor =>
  actor?.getFlag?.(MODULE_ID, "doomedState") ?? { accepted: [], suppressed: [], freeLevels: [] };
export const doomedAccepted = actor =>
  DOOMED_CURSES.filter(entry => (doomedState(actor).accepted ?? []).includes(entry.id));
export const doomedOccupied = actor => doomedAccepted(actor).reduce((sum, entry) => sum + entry.cost, 0);
export const doomedCapacity = actor => ({ maximum: doomedSlots(doomedLevel(actor)), occupied: doomedOccupied(actor) });
export const doomedCurseActive = (actor, id) =>
  doomedLevel(actor) > 0 &&
  doomedAccepted(actor).some(entry => entry.id === id) &&
  Boolean(findFeature(actor, `doomed-curse-${id}`));
export function doomedGiftActive(actor, id) {
  if (!doomedCurseActive(actor, id) || (doomedState(actor).suppressed ?? []).includes(id)) return false;
  const effect = [...(actor.effects ?? [])].find(e => e.getFlag?.(MODULE_ID, "doomedPassive") === `${id}:gift`);
  return !effect || isEffectActive(effect);
}
export function doomedEmpowered(actor, id) {
  const state = doomedState(actor),
    amp = state.amplification;
  if (amp?.curse !== id || Number(amp.until) <= Number(game.time?.worldTime ?? 0) || !doomedCurseActive(actor, id))
    return false;
  return [...(actor.effects ?? [])].some(
    effect => effect.getFlag?.(MODULE_ID, "doomedAmplification") === amp.id && isEffectActive(effect)
  );
}
export const doomedAbility = actor => doomedState(actor).ability;
export const doomedDC = actor =>
  ["wis", "cha"].includes(doomedAbility(actor))
    ? 8 +
      Number(actor.system.attributes.prof) +
      Number(actor.system.abilities[doomedAbility(actor)].mod) +
      (doomedGiftActive(actor, "moment") ? (doomedEmpowered(actor, "moment") ? 2 : 1) : 0)
    : null;
