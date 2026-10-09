import { MODULE_ID } from "./constants.mjs";
import { isEffectActive } from "../effects/temporary-effects.mjs";
const INCAPACITATED = new Set(["incapacitated", "unconscious", "paralyzed", "petrified", "stunned"]);
export function isAuraIncapacitated(actor) {
  return [...(actor?.statuses ?? [])].some(status => INCAPACITATED.has(status))
    || [...(actor?.effects ?? [])].some(effect => isEffectActive(effect) && [...(effect.statuses ?? [])].some(status => INCAPACITATED.has(status)));
}
export function isAuraDefeated(token) {
  const actor = token?.actor, explicitDeath = actor?.getFlag?.(MODULE_ID, "auraDeathRequiresStatus") ?? actor?.flags?.[MODULE_ID]?.auraDeathRequiresStatus;
  if (actor?.type === "npc" && !explicitDeath && Number(actor.system?.attributes?.hp?.value) <= 0) return true;
  return token?.combatant?.defeated === true || token?.document?.combatant?.defeated === true || actor?.statuses?.has?.("dead") === true
    || [...(actor?.effects ?? [])].some(effect => isEffectActive(effect) && effect.statuses?.has?.("dead"));
}
