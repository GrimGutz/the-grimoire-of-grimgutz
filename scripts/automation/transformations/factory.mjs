import {MODULE_ID} from "../shared/constants.mjs";
import {enabled,automationData,findFeature,isAutomationAuthority,notify} from "../shared/helpers.mjs";
import {FACTORY_FEATURES,FACTORY_CAPACITY} from "../shared/factory-definitions.mjs";
import {FACTORY_AUGMENTS} from "../shared/factory-augments.mjs";
import {automationActors,isEffectActive} from "../effects/temporary-effects.mjs";
import {characterLevel,transformationTier,transformationState,effectChange,enforcesTransformationPrerequisites,advancementSurvivors,advancementResult,isDuplicateGrant,rejectDuplicateBoons} from "../shared/transformation-core.mjs";
const factoryStore=transformationState("factoryState","factory-state");
export const factoryState=factoryStore.read;
export const factoryRecords=actor=>actor?.getFlag?.(MODULE_ID,"factoryAugments")??[];
export const factoryCharacterLevel=characterLevel;
export function factoryLevel(actor){return transformationTier(actor,"factory",{include:i=>!automationData(i).factoryOption&&!automationData(i).factoryMaterial});}
export function factoryHas(actor,id){const row=FACTORY_FEATURES.find(r=>r.id===id),item=row&&findFeature(actor,row.key);return Boolean(item&&!item.isSuppressed&&factoryLevel(actor)>=row.level&&(!row.requires||factoryHas(actor,row.requires)));}
export const factoryDC=actor=>8+Number(actor.system?.attributes?.prof??0)+factoryLevel(actor)+Number(actor.system?.abilities?.int?.mod??0);
export const patchFactory=factoryStore.patch;
export function factoryOwner(actor,record){return record.ownerUuid===actor.uuid?actor:automationActors().find(a=>a.uuid===record.ownerUuid);}
export function factoryContext(actor,record){const owner=factoryOwner(actor,record);return owner?{owner,int:Number(owner.system.abilities.int.mod),tier:factoryLevel(owner),dc:factoryDC(owner),prof:Number(owner.system.attributes.prof),imperfections:factoryHas(owner,"imperfections")}:record.snapshot;}
export const factoryInstalledItem=(actor,record)=>[...(actor.items??[])].find(i=>i.getFlag?.(MODULE_ID,"factoryInstalled")?.recordId===record.id);
export function factoryActiveRecords(actor){return factoryRecords(actor).filter(r=>{
  const item=factoryInstalledItem(actor,r);return item&&!item.isSuppressed&&!r.disabled&&![...(actor.effects??[])].some(e=>e.getFlag?.(MODULE_ID,"factoryMalfunction")?.ownerUuid===r.ownerUuid&&isEffectActive(e));
});}
export const factoryAugment=(actor,id)=>factoryActiveRecords(actor).find(r=>r.augmentId===id);
export function factoryCapacity(owner,target){const own=owner.uuid===target.uuid;return !own&&!factoryHas(owner,"sculptor")?{total:1}:Object.fromEntries(Object.entries(FACTORY_CAPACITY).map(([k,n])=>[k,n+(own&&factoryHas(owner,"deus")?1:0)]));}
export function factoryInstallFailures(owner,target,upgrade,replaceId=null){const records=factoryRecords(target).filter(r=>r.id!==replaceId),capacity=factoryCapacity(owner,target),errors=[];
  if(!factoryHas(owner,"innovation"))errors.push("нужна Фабрика инноваций");if(upgrade.tier===3&&!factoryHas(owner,"sculptor"))errors.push("нужен Скульптор плоти");if(upgrade.tier===4&&!factoryHas(owner,"deus"))errors.push("нужен Deus Ex Machanicus");
  if(records.some(r=>r.augmentId===upgrade.id))errors.push("это улучшение уже установлено");
  if(capacity.total?records.length>=capacity.total:records.filter(r=>FACTORY_AUGMENTS.find(a=>a.id===r.augmentId)?.area===upgrade.area).length>=capacity[upgrade.area])errors.push("нет свободного слота");return errors;
}
export function factoryAddicted(actor){const at=factoryState(actor).lastAugmentAt;return factoryHas(actor,"addiction")&&at!=null&&Number(game.time.worldTime)>=Number(at)+(factoryHas(actor,"withdrawal")?86400:259200);}
export const factoryAscended=actor=>factoryHas(actor,"ascension")&&[...(actor.effects??[])].some(e=>e.getFlag?.(MODULE_ID,"factoryAscension")&&isEffectActive(e));
export function factoryRegeneration(actor){if(!factoryHas(actor,"living"))return 0;const hp=actor.system.attributes.hp,half=Math.floor(Number(hp.effectiveMax??hp.max)/2);return Number(hp.value)>0&&Number(hp.value)<half?Math.min(10,half-Number(hp.value)):0;}
export function validateFactoryItem(item,_data,_options,userId){if(!enforcesTransformationPrerequisites(item,userId,"factory-transformation"))return;if(Number(item.parent.system.abilities.int.value)<13){notify("Фабрика: требуется Интеллект 13.","warn");return false;}}
export function validateFactoryAdvancement(manager,_updates,toCreate,_toUpdate,toDelete){if(!enabled())return;const owned=advancementSurvivors(manager,toDelete);for(const d of toCreate){if(!automationData(d).factoryBoon)continue;const row=FACTORY_FEATURES.find(r=>r.key===d.system.identifier);
  if(isDuplicateGrant(d,owned,toCreate)){notify(`«${d.name}» уже получено.`,"warn");return false;}
  if(row?.requires&&![...owned,...toCreate].some(i=>i.system?.identifier===`factory-${row.requires}`)){notify(`«${d.name}»: требуется ${FACTORY_FEATURES.find(r=>r.id===row.requires).name}.`,"warn");return false;}
}}
export function factoryAvailable(actor,item){const installed=item?.getFlag?.(MODULE_ID,"factoryInstalled");if(installed)return factoryActiveRecords(actor).some(r=>r.id===installed.recordId);return item?.system?.identifier==="factory-transformation"?factoryLevel(actor)>0:FACTORY_FEATURES.some(r=>r.key===item?.system?.identifier&&factoryHas(actor,r.id));}
export function inspectFactory(actor){return {level:factoryLevel(actor),dc:factoryLevel(actor)?factoryDC(actor):null,state:structuredClone(factoryState(actor)),augments:factoryRecords(actor).map(r=>({...structuredClone(r),active:factoryActiveRecords(actor).some(a=>a.id===r.id)})),addicted:factoryAddicted(actor),regeneration:factoryRegeneration(actor),ascended:factoryAscended(actor)};}
