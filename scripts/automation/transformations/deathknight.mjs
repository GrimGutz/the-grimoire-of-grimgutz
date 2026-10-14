import {MODULE_ID,SETTINGS} from "../shared/constants.mjs";
import {enabled,automationData,findFeature,isAutomationAuthority,notify} from "../shared/helpers.mjs";
import {baseAbilityValue} from "../shared/dnd5e.mjs";
import {DK_FEATURES,dkUnlockedTier} from "../shared/deathknight-definitions.mjs";
import {flaggedPassiveEffectData,syncFlaggedPassiveEffects} from "../effects/passive-helpers.mjs";
import {isEffectActive} from "../effects/temporary-effects.mjs";
import {serialMutation} from "../shared/transactions.mjs";
export const dkState=actor=>actor?.getFlag?.(MODULE_ID,"deathknightState")??{};
export async function dkPatch(actor,patch){return serialMutation(`deathknight-state:${actor.uuid}`,()=>actor.setFlag(MODULE_ID,"deathknightState",{...structuredClone(dkState(actor)),...patch}));}
export const dkCharacterLevel=actor=>[...(actor?.items??[])].filter(i=>i.type==="class").reduce((n,i)=>n+Number(i.system.levels??0),0);
export function dkTransformationLevel(actor){const highest=Math.max(0,...[...(actor?.items??[])].filter(i=>automationData(i).transformation==="deathknight").map(i=>Number(automationData(i).transformationLevel??(i.system?.identifier==="deathknight-transformation"?1:0))));const total=dkCharacterLevel(actor);return Math.min(highest,total?dkUnlockedTier(total):4);}
export const dkAnchor=actor=>[...(actor?.items??[])].find(i=>i.type==="weapon"&&i.id===dkState(actor).anchorItemId);
export const dkAnchorAvailable=actor=>Boolean(dkAnchor(actor)&&Number(dkAnchor(actor).system.quantity??1)>0&&!dkState(actor).anchorAway);
export function dkHas(actor,id){const row=DK_FEATURES.find(r=>r.id===id),item=row&&findFeature(actor,row.key);return Boolean(item&&!item.isSuppressed&&dkTransformationLevel(actor)>=row.level&&(row.flaw||id==="form"||dkAnchorAvailable(actor)));}
export const dkAvailable=(actor,item)=>!item?.isSuppressed&&(item?.system?.identifier==="deathknight-transformation"?dkTransformationLevel(actor)>0:DK_FEATURES.some(r=>r.key===item?.system?.identifier&&dkHas(actor,r.id)));
export const dkDC=actor=>8+Number(actor.system?.attributes?.prof??0)+Number(actor.system?.abilities?.cha?.mod??0);
export const dkChange=(key,value,type="add",phase="initial",priority=20)=>({key,value:String(value),type,phase,priority});
export const dkPassiveActive=(actor,key)=>[...(actor?.effects??[])].some(e=>e.getFlag?.(MODULE_ID,"deathknightPassive")===key&&isEffectActive(e));
export const dkReaperActive=actor=>dkHas(actor,"reaper")&&[...(actor?.effects??[])].some(e=>e.getFlag?.(MODULE_ID,"deathknightReaper")&&isEffectActive(e));
export function dkPassiveDefinitions(actor){const result=[],add=(key,id,changes)=>result.push(flaggedPassiveEffectData(MODULE_ID,"deathknightPassive",{key,feature:findFeature(actor,`deathknight-${id}`),changes}));
  if(dkHas(actor,"form")){const own=[...(actor.effects??[])].find(e=>e.getFlag?.(MODULE_ID,"deathknightPassive")==="form"&&isEffectActive(e)),changes=[dkChange("system.details.type.value","undead","override")];
    for(const key of ["str","cha"]){const previous=Number(own?.system?.changes?.find(c=>c.key===`system.abilities.${key}.value`)?.value??0),raw=baseAbilityValue(actor,key),base=raw>=20?raw:Math.max(raw,Number(actor.system.abilities[key].value)-previous),amount=Math.max(0,Math.min(2,20-base));if(amount)changes.push(dkChange(`system.abilities.${key}.value`,amount));}add("form","form",changes);}
  if(dkHas(actor,"souls"))add("souls","souls",[]);
  return result;
}
const syncing=new Set();
export async function syncDeathknight(actor){if(!enabled()||!isAutomationAuthority(actor)||!actor.system?.attributes)return;if(!dkTransformationLevel(actor)&&![...(actor.effects??[])].some(e=>e.getFlag?.(MODULE_ID,"deathknightPassive")))return;await syncFlaggedPassiveEffects(actor,syncing,MODULE_ID,"deathknightPassive",dkPassiveDefinitions);
  const state=dkState(actor);if(dkHas(actor,"outcast")&&state.anchorAway&&state.outcastSince==null)await dkPatch(actor,{outcastSince:Number(game.time.worldTime),outcastBaseClaim:Number(state.exhaustionClaim??0)});
}
export function dkPrerequisiteFailures(actor){const failures=[];if(Number(actor.system.abilities.cha.value)<15)failures.push("Харизма 15");if(![...(actor.items??[])].some(i=>i.type==="class"&&i.system.identifier==="paladin"&&Number(i.system.levels)>=10))failures.push("10 уровней Паладина");
  if(!Object.entries(actor.system.spells??{}).some(([key,s])=>Number(key==="pact"?s.level:key.replace("spell",""))>=4&&Number(s.max??s.override??0)>0))failures.push("возможность накладывать заклинания 4-го уровня");return failures;
}
export function validateDeathknightItem(item,_data,_options,userId){if(userId!==game.user.id||!enabled()||!game.settings.get(MODULE_ID,SETTINGS.STRICT_PREREQUISITES)||item.system?.identifier!=="deathknight-transformation"||!item.parent)return;const failures=dkPrerequisiteFailures(item.parent);if(failures.length){notify(`Трансформация Рыцарь Смерти: ${failures.join("; ")}.`,"warn");return false;}}
export function validateDeathknightAdvancement(manager,_updates,toCreate,_toUpdate,toDelete){if(!enabled())return;const removed=new Set(toDelete);for(const d of toCreate){if(!automationData(d).deathknightBoon)continue;if(toCreate.filter(i=>i.system?.identifier===d.system.identifier).length>1||[...manager.actor.items].some(i=>!removed.has(i.id)&&i.system?.identifier===d.system.identifier)){notify(`«${d.name}» уже получено.`,"warn");return false;}}}
export function inspectDeathknight(actor){return {level:dkTransformationLevel(actor),dc:dkTransformationLevel(actor)?dkDC(actor):null,anchorAvailable:dkAnchorAvailable(actor),state:structuredClone(dkState(actor)),unavailable:DK_FEATURES.filter(r=>findFeature(actor,r.key)&&!dkHas(actor,r.id)).map(r=>({id:r.id,reason:!r.flaw&&r.id!=="form"&&!dkAnchorAvailable(actor)?"Нет Якоря при персонаже":"Ступень/подавление"}))};}
