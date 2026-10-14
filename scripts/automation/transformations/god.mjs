import {MODULE_ID,SETTINGS} from "../shared/constants.mjs";
import {enabled,automationData,findFeature,isAutomationAuthority,notify} from "../shared/helpers.mjs";
import {GOD_FEATURES,GOD_ABILITIES,godUnlockedTier} from "../shared/god-definitions.mjs";
import {baseAbilityValue} from "../shared/dnd5e.mjs";
import {flaggedPassiveEffectData,syncFlaggedPassiveEffects} from "../effects/passive-helpers.mjs";
import {isEffectActive} from "../effects/temporary-effects.mjs";
import {serialMutation} from "../shared/transactions.mjs";
import {feetToSceneUnits} from "../shared/spatial.mjs";
export const godState=actor=>actor?.getFlag?.(MODULE_ID,"godState")??{};
export const godCharacterLevel=actor=>[...(actor?.items??[])].filter(i=>i.type==="class").reduce((n,i)=>n+Number(i.system.levels??0),0);
export function godLevel(actor){const highest=Math.max(0,...[...(actor?.items??[])].filter(i=>automationData(i).transformation==="god").map(i=>Number(automationData(i).transformationLevel??(i.system?.identifier==="god-transformation"?1:0))));const total=godCharacterLevel(actor);return Math.min(highest,total?godUnlockedTier(total):4);}
export const godFunctional=actor=>godLevel(actor)>0&&!godState(actor).apathy;
export function godHas(actor,id){const r=GOD_FEATURES.find(r=>r.id===id),i=r&&findFeature(actor,r.key);return Boolean(i&&!i.isSuppressed&&godLevel(actor)>=r.level&&(r.flaw||godFunctional(actor)));}
export const godDC=actor=>8+Number(actor.system?.attributes?.prof??0)+godLevel(actor)+Math.max(...GOD_ABILITIES.map(k=>Number(actor.system?.abilities?.[k]?.mod??0)));
export const godAlignment=actor=>["good","evil"].includes(godState(actor).alignment)?godState(actor).alignment:null;
export const godPool=actor=>findFeature(actor,"god-zeal");
export async function patchGod(actor,patch){return serialMutation(`god-state:${actor.uuid}`,()=>actor.setFlag(MODULE_ID,"godState",{...structuredClone(godState(actor)),...patch}));}
export function godAvailable(actor,item){if(["god-apathy","god-form","god-transformation","god-zeal"].includes(item?.system?.identifier))return godLevel(actor)>0&&!item.isSuppressed;return GOD_FEATURES.some(r=>r.key===item?.system?.identifier&&godHas(actor,r.id));}
export const godChange=(key,value,type="add",phase="initial")=>({key,value:String(value),type,phase,priority:20});
export function godFormBonuses(actor){const allocation=godState(actor).allocation??{},result={};for(const a of GOD_ABILITIES){const n=Number(allocation[a]??0);if(!Number.isInteger(n)||n<0)continue;
  const own=[...(actor.effects??[])].filter(e=>e.getFlag?.(MODULE_ID,"godPassive")==="form"&&isEffectActive(e)).flatMap(e=>e.system?.changes??[]).filter(c=>c.key===`system.abilities.${a}.value`&&c.type==="add").reduce((s,c)=>s+Number(c.value),0);
  // A temporary bonus from another source must not consume this allocation.
  // The 26 limit applies to the form's increase, not to every later effect.
  const base=baseAbilityValue(actor,a);result[a]=Math.max(0,Math.min(n,26-base));}return result;}
export function godPassiveDefinitions(actor){const rows=[],add=(id,changes)=>{if(changes.length)rows.push(flaggedPassiveEffectData(MODULE_ID,"godPassive",{key:id,feature:findFeature(actor,`god-${id}`),changes}));};
  if(godHas(actor,"form")){const changes=[];for(const [a,n]of Object.entries(godFormBonuses(actor)))if(n)changes.push(godChange(`system.abilities.${a}.value`,n),godChange(`system.abilities.${a}.max`,26,"upgrade"));add("form",changes);}
  if(godHas(actor,"strain"))add("strain",[godChange("system.attributes.death.roll.mode",-1,"downgrade")]);
  if(godHas(actor,"apotheosis")){const n=godLevel(actor),changes=[godChange("system.traits.dr.value","all"),godChange("system.attributes.hp.bonuses.overall",10*n),godChange("system.bonuses.abilities.save",n)];if(actor.system.attributes.death?.bonuses?.save!==undefined)changes.push(godChange("system.attributes.death.bonuses.save",n));add("apotheosis",changes);}
  if(godHas(actor,"demiscience")){const units=actor.system.attributes.senses?.units??actor.system.attributes.movement?.units??"ft";add("demiscience",[godChange("system.attributes.senses.truesight",feetToSceneUnits(120,{grid:{units}}),"upgrade"),godChange("system.traits.ci.value","surprised")]);}
  return rows;
}
const syncing=new Set();
export async function syncGod(actor){if(!enabled()||!isAutomationAuthority(actor)||!actor.system?.attributes)return;if(!godLevel(actor)&&![...(actor.effects??[])].some(e=>e.getFlag?.(MODULE_ID,"godPassive")))return;
  await syncFlaggedPassiveEffects(actor,syncing,MODULE_ID,"godPassive",godPassiveDefinitions);
  const pool=godPool(actor),n=100*godLevel(actor);if(pool){const known=pool.getFlag?.(MODULE_ID,"godManagedMaximum"),current=Number(pool.system.uses.max);if(current===(known??100)&&current!==n)await pool.update({"system.uses.max":String(n),[`flags.${MODULE_ID}.godManagedMaximum`]:n});}
  const hp=actor.system.attributes.hp,max=Number(hp.effectiveMax??hp.max);if(Number(hp.value)>max)await actor.update({"system.attributes.hp.value":Math.max(0,max)});
}
export function validateGodItem(item,_data,_options,userId){if(userId!==game.user.id||!enabled()||!game.settings.get(MODULE_ID,SETTINGS.STRICT_PREREQUISITES)||item.system?.identifier!=="god-transformation"||!item.parent)return;
  if(godCharacterLevel(item.parent)<20||!GOD_ABILITIES.some(k=>Number(item.parent.system.abilities[k].value)>=22)){notify("Божество: требуется 20-й уровень и хотя бы одна характеристика 22.","warn");return false;}}
export function validateGodAdvancement(manager,_updates,toCreate,_toUpdate,toDelete){if(!enabled())return;const removed=new Set(toDelete),owned=[...(manager.actor.items??[])].filter(i=>!removed.has(i.id));for(const d of toCreate)if(automationData(d).godBoon&&(owned.some(i=>i.system.identifier===d.system.identifier)||toCreate.filter(i=>i.system?.identifier===d.system.identifier).length>1)){notify(`«${d.name}» уже получено.`,"warn");return false;}}
export function godDomain(actor){const d=godState(actor).domain,e=d&&[...(actor?.effects??[])].find(e=>e.uuid===d.effectUuid),c=d&&[...(actor?.effects??[])].find(e=>e.uuid===d.concentrationUuid);return godHas(actor,"domain")&&e&&isEffectActive(e)&&c&&isEffectActive(c)?d:null;}
export function inspectGod(actor){return {level:godLevel(actor),dc:godLevel(actor)?godDC(actor):null,functional:godFunctional(actor),alignment:godAlignment(actor),state:structuredClone(godState(actor)),domain:structuredClone(godDomain(actor)),unavailable:GOD_FEATURES.filter(r=>findFeature(actor,r.key)&&!godHas(actor,r.id)).map(r=>r.id)};}
