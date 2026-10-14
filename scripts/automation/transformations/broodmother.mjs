import {MODULE_ID,SETTINGS} from "../shared/constants.mjs";
import {enabled,automationData,findFeature,isAutomationAuthority,notify} from "../shared/helpers.mjs";
import {baseAbilityValue} from "../shared/dnd5e.mjs";
import {BROODMOTHER_FEATURES,broodmotherUnlockedTier} from "../shared/broodmother-definitions.mjs";
import {flaggedPassiveEffectData,syncFlaggedPassiveEffects} from "../effects/passive-helpers.mjs";
import {isEffectActive} from "../effects/temporary-effects.mjs";
export const broodmotherState=actor=>actor?.getFlag?.(MODULE_ID,"broodmotherState")??{};
export const broodmotherCharacterLevel=actor=>[...(actor?.items??[])].filter(i=>i.type==="class").reduce((n,i)=>n+Number(i.system.levels??0),0);
export function broodmotherTransformationLevel(actor){const highest=Math.max(0,...[...(actor?.items??[])].filter(i=>automationData(i).transformation==="broodmother").map(i=>Number(automationData(i).transformationLevel??(i.system?.identifier==="broodmother-transformation"?1:0))));
  const total=broodmotherCharacterLevel(actor);return Math.min(highest,total>0?broodmotherUnlockedTier(total):4);}
export function broodmotherHas(actor,id){const e=BROODMOTHER_FEATURES.find(e=>e.id===id),item=e&&findFeature(actor,e.key);return Boolean(item&&!item.isSuppressed&&broodmotherTransformationLevel(actor)>=e.level&&(!e.requires||broodmotherHas(actor,e.requires)));}
export function broodmotherAvailable(actor,item){return item?.system?.identifier==="broodmother-transformation"?broodmotherTransformationLevel(actor)>0:BROODMOTHER_FEATURES.some(e=>e.key===item?.system?.identifier&&broodmotherHas(actor,e.id));}
export const broodmotherDC=actor=>8+Number(actor.system?.attributes?.prof??0)+Number(actor.system?.abilities?.con?.mod??0);
export const broodmotherChange=(key,value,type="add",phase="initial",priority=20)=>({key,value:String(value),type,phase,priority});
export function broodmotherPassiveDefinitions(actor){const result=[];
  const add=(key,id,changes)=>result.push(flaggedPassiveEffectData(MODULE_ID,"broodmotherPassive",{key,feature:findFeature(actor,`broodmother-${id}`),changes}));
  if(broodmotherHas(actor,"form")){const current=[...(actor.effects??[])].find(e=>e.getFlag?.(MODULE_ID,"broodmotherPassive")==="form"&&isEffectActive(e)),changes=[broodmotherChange("system.details.type.value","monstrosity","override")];
    for(const key of ["con","dex"]){const own=Number(current?.system?.changes?.find(c=>c.key===`system.abilities.${key}.value`)?.value??0),raw=baseAbilityValue(actor,key),base=raw>=20?raw:Math.max(raw,Number(actor.system.abilities[key].value)-own),amount=Math.max(0,Math.min(2,20-base));if(amount)changes.push(broodmotherChange(`system.abilities.${key}.value`,amount));}
    add("form","form",changes);}
  if(broodmotherHas(actor,"spider")){const ac=actor.system.attributes.ac??{},floor=13+Number(actor.system.abilities.dex.mod)+Number(ac.shield??0)+Number(ac.bonus??0);
    add("spider","spider",[broodmotherChange("system.attributes.ac.value",floor,"upgrade","final",40),broodmotherChange("system.attributes.movement.climb",Number(actor.system.attributes.movement.walk??0),"upgrade","final",40)]);}
  return result;
}
const syncing=new Set();
export async function syncBroodmother(actor){if(!enabled()||!isAutomationAuthority(actor)||!actor.system?.attributes)return;
  if(!broodmotherTransformationLevel(actor)&&![...(actor.effects??[])].some(e=>e.getFlag?.(MODULE_ID,"broodmotherPassive")))return;
  await syncFlaggedPassiveEffects(actor,syncing,MODULE_ID,"broodmotherPassive",broodmotherPassiveDefinitions);
}
export function broodmotherPrerequisiteFailures(actor){const failures=[];if(Number(actor.system?.abilities?.con?.value??0)<15)failures.push("Телосложение 15");if(![...(actor.items??[])].some(i=>i.type==="class"&&Number(i.system.levels)>=10))failures.push("не менее 10 уровней в одном классе");return failures;}
export function validateBroodmotherItem(item,_data,_options,userId){if(userId!==game.user.id||!enabled()||!game.settings.get(MODULE_ID,SETTINGS.STRICT_PREREQUISITES)||item.system?.identifier!=="broodmother-transformation"||!item.parent)return;
  const failures=broodmotherPrerequisiteFailures(item.parent);if(failures.length){notify(`Королева Улья: ${failures.join("; ")}.`,"warn");return false;}}
export function validateBroodmotherAdvancement(manager,_updates,toCreate,toUpdate,toDelete){if(!enabled())return;const created=toCreate.filter(i=>automationData(i).transformation==="broodmother");if(!created.length)return;
  const removed=new Set(toDelete),documents=new Map([...manager.actor.items].filter(i=>!removed.has(i.id)).map(i=>[i.id,i.toObject?.()??i]));
  for(const data of toUpdate)documents.set(data._id,foundry.utils.mergeObject(documents.get(data._id)??{},data,{inplace:false}));for(const [i,data] of toCreate.entries())documents.set(data._id??`new-${i}`,data);
  for(const item of created){const e=BROODMOTHER_FEATURES.find(e=>e.key===item.system?.identifier);if(!e||e.flaw)continue;
    if(e.requires&&![...documents.values()].some(i=>i.system?.identifier===`broodmother-${e.requires}`)){notify(`«${e.name}»: требуется ${BROODMOTHER_FEATURES.find(f=>f.id===e.requires).name}.`,"warn");return false;}
    if([...documents.values()].filter(i=>i.system?.identifier===e.key).length>1||[...manager.actor.items].some(i=>!removed.has(i.id)&&i.system?.identifier===e.key)){notify(`«${e.name}» уже получено.`,"warn");return false;}}
}
export function inspectBroodmother(actor){return {level:broodmotherTransformationLevel(actor),dc:broodmotherTransformationLevel(actor)?broodmotherDC(actor):null,state:structuredClone(broodmotherState(actor)),
  unavailable:BROODMOTHER_FEATURES.filter(e=>findFeature(actor,e.key)&&!broodmotherHas(actor,e.id)).map(e=>({id:e.id,reason:e.requires&&!broodmotherHas(actor,e.requires)?`Требуется ${e.requires}`:"Не открыт уровень или особенность подавлена"}))};}
