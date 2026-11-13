import {MODULE_ID} from "../shared/constants.mjs";
import {enabled,automationData,findFeature,isAutomationAuthority,notify} from "../shared/helpers.mjs";
import {ILLITHID_FEATURES,ILLITHID_RULE_DEFAULTS,ILLITHID_ABILITIES} from "../shared/illithid-definitions.mjs";
import {baseAbilityValue} from "../shared/dnd5e.mjs";
import {flaggedPassiveEffectData,syncFlaggedPassiveEffects} from "../effects/passive-helpers.mjs";
import {isEffectActive} from "../effects/temporary-effects.mjs";
import {characterLevel,transformationTier,transformationState,effectChange,enforcesTransformationPrerequisites,advancementSurvivors,isDuplicateGrant,rejectDuplicateBoons} from "../shared/transformation-core.mjs";
const ilStore=transformationState("illithidState","illithid-state");
export const ilState=ilStore.read;
export const ilPatch=ilStore.patch;
export const ilRules=a=>Object.fromEntries(Object.entries(ILLITHID_RULE_DEFAULTS).map(([k,v])=>[k,ilState(a)[k]??v]));
export const ilCharLevel=characterLevel;
export const ilLevel=a=>transformationTier(a,"illithid");
export const ilCanCast=(a,items=a?.items??[])=>ilState(a).spellcastingConfirmed===true||[...items].some(i=>i.type==="spell"||i.type==="class"&&i.system?.spellcasting?.progression&&i.system.spellcasting.progression!=="none");
export function ilHas(a,id){const r=ILLITHID_FEATURES.find(r=>r.id===id),i=r&&findFeature(a,r.key);return Boolean(i&&!i.isSuppressed&&ilLevel(a)>=r.level&&(!r.requires||(id==="spellcasting"?ilCanCast(a):ilHas(a,r.requires))));}
export const ilDC=a=>8+Number(a?.system?.attributes?.prof??0)+Number(a?.system?.abilities?.int?.mod??0);
export const ilAvailable=(a,i)=>!i?.isSuppressed&&(i?.system?.identifier==="illithid-transformation"?ilLevel(a)>0:ILLITHID_FEATURES.some(r=>r.key===i?.system?.identifier&&ilHas(a,r.id)));
export const ilChange=(key,value,type="add",phase="initial")=>({key,value:String(value),type,phase,priority:phase==="final"?40:20});
export const ilHungerDays=a=>ilHas(a,"hunger")&&Number.isFinite(ilState(a).lastFedAt)?Math.max(0,Math.floor((Number(game.time.worldTime)-ilState(a).lastFedAt)/86400)-7):0;
export const ilRefuge=a=>ilHas(a,"refuge")&&[...(a.effects??[])].find(e=>e.getFlag?.(MODULE_ID,"illithidRefuge")&&isEffectActive(e)&&(!e.getFlag(MODULE_ID,"illithidCondition")?.concentrationUuid||[...a.effects].some(c=>c.uuid===e.getFlag(MODULE_ID,"illithidCondition").concentrationUuid&&isEffectActive(c))));
export function illithidPassiveDefinitions(a){const rows=[],add=(id,changes)=>{if(changes.length)rows.push(flaggedPassiveEffectData(MODULE_ID,"illithidPassive",{key:id,feature:findFeature(a,`illithid-${id}`),changes}));};
  if(ilHas(a,"form"))add("form",["int","wis"].map(k=>[k,Math.max(0,Math.min(2,20-baseAbilityValue(a,k)))]).filter(([,n])=>n>0).map(([k,n])=>ilChange(`system.abilities.${k}.value`,n)));
  if(ilHas(a,"bond"))add("bond",[ilChange("system.attributes.death.roll.mode",-1,"downgrade")]);
  if(ilHas(a,"flight"))add("flight",[ilChange("system.attributes.movement.fly",Number(a.system.attributes.movement.walk??0),"upgrade","final")]);
  if(ilHas(a,"mind")){const base=ilState(a).skillBaseline??{},grades=Object.fromEntries(["ins","arc"].map(k=>[k,Math.max(Number(base[k]??0),Number(a._source?.system?.skills?.[k]?.value??0))])),expert=Object.values(grades).some(n=>n>=2);add("mind",[...Object.entries(grades).map(([k,n])=>ilChange(`system.skills.${k}.value`,n>=1?2:1,"upgrade")),...(expert?["ins","arc"].map(k=>ilChange(`system.skills.${k}.bonuses.check`,2)):[])]);}
  if(ilHas(a,"fortress")){const base=ilState(a).saveBaseline??{},changes=[ilChange("system.traits.di.value","psychic"),... ["charmed","frightened"].map(s=>ilChange("system.traits.ci.value",s))];for(const k of ["int","wis"]){const proficient=Math.max(Number(base[k]??0),Number(a._source?.system?.abilities?.[k]?.proficient??0))>=1;changes.push(ilChange(`system.abilities.${k}.proficient`,1,"upgrade"));if(proficient)changes.push(ilChange(`system.abilities.${k}.bonuses.save`,2));}add("fortress",changes);}
  const days=ilHungerDays(a);if(days)add("hunger",ILLITHID_ABILITIES.map(k=>ilChange(`system.abilities.${k}.value`,-Math.min(3*days,baseAbilityValue(a,k)+(ilHas(a,"form")&&["int","wis"].includes(k)?Math.max(0,Math.min(2,20-baseAbilityValue(a,k))):0)),"add","final")));
  return rows;
}
const syncing=new Set();
export async function syncIllithid(a){if(!enabled()||!isAutomationAuthority(a)||!a.system?.attributes)return;if(!ilLevel(a)&&![...(a.effects??[])].some(e=>e.getFlag?.(MODULE_ID,"illithidPassive")))return;
  const p={};if(ilHas(a,"mind")&&!ilState(a).skillBaseline)p.skillBaseline=Object.fromEntries(["ins","arc"].map(k=>[k,Number(a.system.skills?.[k]?.value??0)]));if(ilHas(a,"fortress")&&!ilState(a).saveBaseline)p.saveBaseline=Object.fromEntries(["int","wis"].map(k=>[k,Number(a.system.abilities[k].proficient??0)]));if(Object.keys(p).length)await ilPatch(a,p);
  await syncFlaggedPassiveEffects(a,syncing,MODULE_ID,"illithidPassive",illithidPassiveDefinitions);
  if(ilHas(a,"appearance")&&(a.statuses?.has?.("unconscious")||a.concentration?.effects?.size)&&ilState(a).appearance!=="true")await ilPatch(a,{appearance:"true"});
}
export function validateIllithidItem(i,_d,_o,userId){if(!enforcesTransformationPrerequisites(i,userId,"illithid-transformation"))return;if(ilCharLevel(i.parent)<10||baseAbilityValue(i.parent,"int")<15){notify("Иллитид: требуется Интеллект 15 и 10-й уровень персонажа.","warn");return false;}}
export function validateIllithidAdvancement(manager,_u,toCreate,_up,toDelete){if(!enabled())return;const owned=advancementSurvivors(manager,toDelete),all=[...owned,...toCreate];for(const d of toCreate){const f=automationData(d);if(!f.illithidBoon)continue;if(isDuplicateGrant(d,owned,toCreate)){notify(`«${d.name}» уже получено.`,"warn");return false;}if(d.system.identifier==="illithid-supreme"&&!all.some(i=>i.system?.identifier==="illithid-spellcasting")){notify("Высшая Псионика требует Псионического Колдовства.","warn");return false;}if(d.system.identifier==="illithid-spellcasting"&&!ilCanCast(manager.actor,all)){notify("Псионическое Колдовство требует способности накладывать заклинания; нестандартный источник подтверждает GM.","warn");return false;}}}
export const inspectIllithid=a=>({level:ilLevel(a),dc:ilLevel(a)?ilDC(a):null,additionalType:ilHas(a,"form")?"aberration":null,telepathy:ilHas(a,"mind")?{feet:120,minimumIntelligence:7}:null,hungerDays:ilHungerDays(a),hungerDeathDue:ilHungerDays(a)>0&&ILLITHID_ABILITIES.some(k=>Number(a.system.abilities[k].value)<=0),refugeActive:Boolean(ilRefuge(a)),rules:ilRules(a),state:structuredClone(ilState(a)),unavailable:ILLITHID_FEATURES.filter(r=>findFeature(a,r.key)&&!ilHas(a,r.id)).map(r=>r.id)});
