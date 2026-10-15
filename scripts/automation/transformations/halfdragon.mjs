import {MODULE_ID,SETTINGS} from "../shared/constants.mjs";
import {enabled,automationData,findFeature,isAutomationAuthority,notify} from "../shared/helpers.mjs";
import {baseAbilityValue} from "../shared/dnd5e.mjs";
import {HALFDRAGON_FEATURES,HALFDRAGON_ANCESTRIES,halfdragonUnlockedTier} from "../shared/halfdragon-definitions.mjs";
import {flaggedPassiveEffectData,syncFlaggedPassiveEffects} from "../effects/passive-helpers.mjs";
import {isEffectActive} from "../effects/temporary-effects.mjs";
import {feetToSceneUnits} from "../shared/spatial.mjs";
import {serialMutation} from "../shared/transactions.mjs";
export const hdState=actor=>actor?.getFlag?.(MODULE_ID,"halfdragonState")??{};
export const hdRules=actor=>({breathRecovery:"sr",roarRecovery:"sr",livingHpMode:"roll",graspSeconds:60,...hdState(actor)});
export const hdPatch=(actor,patch)=>serialMutation(`halfdragon-state:${actor.uuid}`,()=>actor.setFlag(MODULE_ID,"halfdragonState",{...structuredClone(hdState(actor)),...patch}));
export const hdCharLevel=actor=>[...(actor?.items??[])].filter(i=>i.type==="class").reduce((n,i)=>n+Number(i.system.levels??0),0);
export function hdLevel(actor){const max=Math.max(0,...[...(actor?.items??[])].filter(i=>automationData(i).transformation==="halfdragon").map(i=>Number(automationData(i).transformationLevel??(i.system?.identifier==="halfdragon-transformation"?1:0)))),level=hdCharLevel(actor);return Math.min(max,level?halfdragonUnlockedTier(level):4);}
export const hdHas=(actor,id)=>{const r=HALFDRAGON_FEATURES.find(r=>r.id===id),i=r&&findFeature(actor,r.key);return Boolean(i&&!i.isSuppressed&&hdLevel(actor)>=r.level);};
export const hdAncestry=actor=>HALFDRAGON_ANCESTRIES.find(r=>r.id===hdState(actor).ancestry)??null;
export const hdDC=actor=>8+Number(actor?.system?.attributes?.prof??0)+Number(actor?.system?.abilities?.con?.mod??0);
export const hdPool=actor=>findFeature(actor,"halfdragon-breath");
export const hdPoolMaximum=actor=>hdCharLevel(actor)+(hdHas(actor,"empowered")?hdLevel(actor):0);
export const hdAvailable=(actor,item)=>!item?.isSuppressed&&(item?.system?.identifier==="halfdragon-transformation"?hdLevel(actor)>0:HALFDRAGON_FEATURES.some(r=>r.key===item?.system?.identifier&&hdHas(actor,r.id)));
export const hdChange=(key,value,type="add",phase="initial")=>({key,value:String(value),type,phase,priority:20});
export const hdArmorType=item=>item.system?.type?.value??item.system?.armor?.type??"";
export const hdWorn=actor=>[...(actor?.items??[])].filter(i=>i.type==="equipment"&&i.system?.equipped);
export const hdArmored=actor=>hdWorn(actor).some(i=>["light","medium","heavy"].includes(hdArmorType(i)));
export const hdWingGearReady=actor=>!hdWorn(actor).some(i=>["light","medium","heavy","clothing"].includes(hdArmorType(i))&&!i.getFlag?.(MODULE_ID,"halfdragonWingAdapted"));
export const hdGuardActive=actor=>hdHas(actor,"guard")&&[...(actor?.effects??[])].some(e=>e.getFlag?.(MODULE_ID,"halfdragonGuard")&&isEffectActive(e));
export const hdElementArmor=actor=>hdHas(actor,"fundamentum")&&[...(actor?.effects??[])].find(e=>e.getFlag?.(MODULE_ID,"halfdragonElementArmor")&&isEffectActive(e));
export function hdBreathSpec(actor,count){const a=hdAncestry(actor);if(!a)throw Error("Сначала выберите драконье происхождение.");return {shape:a.family==="chromatic"?"line":"cone",size:(a.family==="chromatic"?60:30)*(hdHas(actor,"empowered")?2:1),...(a.family==="chromatic"?{width:5}:{}),origin:"self",excludeSelf:true,save:"dex",dc:String(hdDC(actor)),damage:[{formula:`${count}d6`,type:a.damageType}],onSave:"half"};}
export function halfdragonPassiveDefinitions(actor){const rows=[],add=(id,changes)=>{if(changes.length)rows.push(flaggedPassiveEffectData(MODULE_ID,"halfdragonPassive",{key:id,feature:findFeature(actor,`halfdragon-${id}`),changes}));};
  if(hdHas(actor,"form")){const changes=[];for(const [a,n] of [["con",4],["cha",2]]){const bonus=Math.max(0,Math.min(n,22-baseAbilityValue(actor,a)));if(bonus)changes.push(hdChange(`system.abilities.${a}.value`,bonus),hdChange(`system.abilities.${a}.max`,22,"upgrade"));}add("form",changes);}
  if(hdHas(actor,"scales")&&!hdArmored(actor)&&hdState(actor).scalesEnabled!==false)add("scales",[hdChange("system.attributes.ac.calc","custom","override"),hdChange("system.attributes.ac.formula","13 + @abilities.dex.mod + @abilities.cha.mod","override")]);
  if(hdHas(actor,"senses")){const raw=Number(actor._source?.system?.skills?.prc?.value??0),baseline=Number(hdState(actor).perceptionBaseline??raw),grade=Math.max(raw,baseline)>=1?2:1,units=actor.system.attributes.senses?.units??"ft";add("senses",[hdChange("system.skills.prc.value",grade,"upgrade"),hdChange("system.attributes.senses.blindsight",feetToSceneUnits(30,{grid:{units}}),"upgrade")]);}
  if(hdHas(actor,"wings")&&hdWingGearReady(actor))add("wings",[hdChange("system.attributes.movement.fly",Number(actor.system.attributes.movement.walk??0),"upgrade","final")]);
  if(hdHas(actor,"guard")&&hdAncestry(actor))add("guard",[hdChange("system.traits.di.value",hdAncestry(actor).damageType)]);
  return rows;
}
const syncing=new Set();
export async function syncHalfdragon(actor){if(!enabled()||!isAutomationAuthority(actor)||!actor.system?.attributes)return;if(!hdLevel(actor)&&![...(actor.effects??[])].some(e=>e.getFlag?.(MODULE_ID,"halfdragonPassive")))return;
  if(hdHas(actor,"senses")&&hdState(actor).perceptionBaseline===undefined)await hdPatch(actor,{perceptionBaseline:Number(actor.system.skills?.prc?.value??actor._source?.system?.skills?.prc?.value??0)});
  await syncFlaggedPassiveEffects(actor,syncing,MODULE_ID,"halfdragonPassive",halfdragonPassiveDefinitions);
  const pool=hdPool(actor);if(pool){const current=Number(pool.system.uses.max),old=pool.getFlag?.(MODULE_ID,"halfdragonManagedMaximum")??1,next=hdPoolMaximum(actor);if(current===old&&current!==next)await pool.update({"system.uses.max":String(next),[`flags.${MODULE_ID}.halfdragonManagedMaximum`]:next});}
  if(hdHas(actor,"appearance")&&(actor.statuses?.has?.("unconscious")||actor.concentration?.effects?.size)&&hdState(actor).appearance!=="true")await hdPatch(actor,{appearance:"true"});
}
export function validateHalfdragonItem(item,_data,_options,userId){if(userId!==game.user.id||!enabled()||!game.settings.get(MODULE_ID,SETTINGS.STRICT_PREREQUISITES)||item.system?.identifier!=="halfdragon-transformation"||!item.parent)return;if(hdCharLevel(item.parent)<13||baseAbilityValue(item.parent,"con")<16){notify("Дракон: требуется 13-й уровень персонажа и Телосложение16.","warn");return false;}}
export function validateHalfdragonAdvancement(manager,_updates,toCreate,_toUpdate,toDelete){if(!enabled())return;const deleted=new Set(toDelete),owned=[...(manager.actor.items??[])].filter(i=>!deleted.has(i.id));for(const d of toCreate)if(automationData(d).halfdragonBoon&&(owned.some(i=>i.system?.identifier===d.system?.identifier)||toCreate.filter(i=>i.system?.identifier===d.system?.identifier).length>1)){notify(`«${d.name}» уже получено.`,"warn");return false;}}
export const inspectHalfdragon=actor=>({level:hdLevel(actor),dc:hdLevel(actor)?hdDC(actor):null,ancestry:hdAncestry(actor),additionalType:hdHas(actor,"form")?"dragon":null,poolMaximum:hdPoolMaximum(actor),guardActive:hdGuardActive(actor),wingGearReady:hdWingGearReady(actor),rules:hdRules(actor),state:structuredClone(hdState(actor)),unavailable:HALFDRAGON_FEATURES.filter(r=>findFeature(actor,r.key)&&!hdHas(actor,r.id)).map(r=>r.id)});
