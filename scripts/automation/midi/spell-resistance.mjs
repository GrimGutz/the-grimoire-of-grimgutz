import { FLAGS, MODULE_ID } from "../shared/constants.mjs";
import { enabled } from "../shared/helpers.mjs";
import { isEffectActive } from "../effects/temporary-effects.mjs";
import { calculatedDamage, commitCalculatedDamage } from "./damage-packet.mjs";
import {arkaneBodyActive} from "../transformations/arkane.mjs";
import {automatonResistanceActive,automatonState} from "../transformations/automaton.mjs";
import {chimeraCarapaceActive} from "../transformations/chimera.mjs";

export function applySpellSourceResistance(token, { workflow, damageItem }) {
  if (!enabled() || !token?.actor || workflow?.item?.type !== "spell") return;
  const active = [...(token.actor.effects ?? [])].some(effect => isEffectActive(effect)
    && effect.getFlag?.(MODULE_ID, FLAGS.HOLLOW_PASSIVE) === "fortified-soul");
  const automaton=automatonResistanceActive(token.actor)&&automatonState(token.actor).model==="juggernaut";
  const chimera=chimeraCarapaceActive(token.actor);
  if (!active && !arkaneBodyActive(token.actor) && !automaton && !chimera) return;
  const parts = calculatedDamage(damageItem);
  let changed = false;
  for (const part of parts) {
    if (Number(part.value) <= 0 || ["healing", "temphp", "maximum", "midi-none"].includes(part.type)) continue;
    if (part.active?.[MODULE_ID]?.ignoreResistance === true) continue;
    if (part.active?.resistance === true || Object.values(part.active ?? {}).some(value => value?.resistance === true)) continue;
    part.value = Math.floor(Number(part.value) / 2);
    part.active ??= {}; part.active[MODULE_ID] = { ...(part.active[MODULE_ID] ?? {}), resistance: true };
    changed = true;
  }
  if (changed) {
    commitCalculatedDamage(token, damageItem, parts);
    damageItem.details ??= []; damageItem.details.push(active ? "Укреплённая душа: сопротивление урону заклинания" : automaton ? "Модель джаггернаута: сопротивление урону заклинания" : chimera ? "Панцирь Тараска: сопротивление урону заклинания" : "Сверхъестественное тело: сопротивление урону заклинания");
  }
}
