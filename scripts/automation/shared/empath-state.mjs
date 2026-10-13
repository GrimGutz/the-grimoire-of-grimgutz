import {MODULE_ID} from "./constants.mjs";
import {classLevel} from "./selectors.mjs";
import {findFeature} from "./helpers.mjs";
import {isEffectActive} from "../effects/temporary-effects.mjs";
import {EMPATH_MASKS} from "./empath-definitions.mjs";
export const empathLevel=actor=>classLevel(actor,"empath");
export const empathState=actor=>actor?.getFlag?.(MODULE_ID,"empathState")??{};
export const empathMask=actor=>EMPATH_MASKS.find(mask=>mask.id===empathState(actor).mask)??EMPATH_MASKS[1];
export const empathEffects=actor=>[...(actor?.effects??[])].filter(effect=>isEffectActive(effect)&&effect.getFlag?.(MODULE_ID,"empathEffect"));
export const empathEffectData=effect=>effect?.getFlag?.(MODULE_ID,"empathEffect")??{};
export function empathAvailable(actor,item){const level=empathLevel(actor),key=item?.system?.identifier;return level>0&&(key==="empath-wave-spell"?level>=3:
  item?.getFlag?.(MODULE_ID,"empathFeature")===true&&level>=Number(item.getFlag(MODULE_ID,"minimumLevel")??1));}
export function empathSnapshot(actor){return {mask:empathMask(actor).id,level:empathLevel(actor),prof:Number(actor.system.attributes.prof),cha:Number(actor.system.abilities.cha.mod),dc:8+Number(actor.system.attributes.prof)+Number(actor.system.abilities.cha.mod)};}
export const empathMaskActive=actor=>Boolean(empathLevel(actor)&&findFeature(actor,"empath-masks"));
