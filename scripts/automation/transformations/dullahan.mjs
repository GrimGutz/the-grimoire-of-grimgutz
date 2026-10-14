import {MODULE_ID,SETTINGS} from "../shared/constants.mjs";
import {enabled,automationData,findFeature,isAutomationAuthority,notify} from "../shared/helpers.mjs";
import {DULLAHAN_FEATURES,dullahanUnlockedTier} from "../shared/dullahan-definitions.mjs";
import {flaggedPassiveEffectData,syncFlaggedPassiveEffects} from "../effects/passive-helpers.mjs";
import {isEffectActive} from "../effects/temporary-effects.mjs";
import {serialMutation} from "../shared/transactions.mjs";
import {feetToSceneUnits} from "../shared/spatial.mjs";
import {inFeet} from "../shared/combat-benefits.mjs";
export const dullahanState=actor=>actor?.getFlag?.(MODULE_ID,"dullahanState")??{};
export const dullahanCharacterLevel=actor=>[...(actor?.items??[])].filter(i=>i.type==="class").reduce((n,i)=>n+Number(i.system.levels??0),0);
export async function patchDullahan(actor,patch){return serialMutation(`dullahan-state:${actor.uuid}`,()=>actor.setFlag(MODULE_ID,"dullahanState",{...structuredClone(dullahanState(actor)),...patch}));}
export function dullahanLevel(actor){const highest=Math.max(0,...[...(actor?.items??[])].filter(i=>automationData(i).transformation==="dullahan").map(i=>Number(automationData(i).transformationLevel??(i.system?.identifier==="dullahan-transformation"?1:0))));const total=dullahanCharacterLevel(actor);return Math.min(highest,total?dullahanUnlockedTier(total):4);}
export const dullahanDC=actor=>8+Number(actor.system?.attributes?.prof??0)+dullahanLevel(actor)+Number(actor.system?.abilities?.str?.mod??0);
export function dullahanHas(actor,id){const row=DULLAHAN_FEATURES.find(r=>r.id===id),item=row&&findFeature(actor,row.key);return Boolean(item&&!item.isSuppressed&&dullahanLevel(actor)>=row.level&&(!row.requires||dullahanHas(actor,row.requires)));}
export const dullahanAvailable=(actor,item)=>item?.system?.identifier==="dullahan-transformation"?dullahanLevel(actor)>0:DULLAHAN_FEATURES.some(r=>r.key===item?.system?.identifier&&dullahanHas(actor,r.id));
export const dullahanPassiveActive=(actor,key)=>[...(actor?.effects??[])].some(e=>e.getFlag?.(MODULE_ID,"dullahanPassive")===key&&isEffectActive(e));
export function dullahanPactWaives(actor){const s=dullahanState(actor);return dullahanHas(actor,"pawn")&&s.pawn?.active&&s.pawn.holderActorUuid===s.oath?.targetActorUuid;}
export const dullahanChange=(key,value,type="add")=>({key,value:String(value),type,phase:"initial",priority:20});
export function dullahanMounted(actor){const riding=dullahanState(actor).riding;if(!riding||!dullahanHas(actor,"mount"))return false;
  const tokens=[...(game.scenes??[])].flatMap(s=>[...(s.tokens??[])]),source=tokens.find(t=>t.uuid===riding.sourceTokenUuid),mount=tokens.find(t=>t.uuid===riding.mountTokenUuid);
  return Boolean(source?.actor?.uuid===actor.uuid&&mount?.actor&&!mount.actor.statuses?.has("dead")&&source.parent.id===mount.parent.id&&inFeet(source,mount,5,source.parent)
    &&[...(mount.actor.effects??[])].some(e=>e.getFlag?.(MODULE_ID,"dullahanMount")?.sourceActorUuid===actor.uuid&&isEffectActive(e)));
}
export function dullahanPassiveDefinitions(actor){const rows=[],add=(id,changes)=>rows.push(flaggedPassiveEffectData(MODULE_ID,"dullahanPassive",{key:id,feature:findFeature(actor,`dullahan-${id}`),changes}));
  if(dullahanHas(actor,"form"))add("form",[dullahanChange("system.details.type.value","undead","override")]);
  const units=actor.system.attributes.senses?.units??actor.system.attributes.movement?.units??"ft";
  for(const [id,sense,feet] of [["sight","truesight",120],["defiant","blindsight",20]])if(dullahanHas(actor,id))add(id,[dullahanChange(`system.attributes.senses.${sense}`,feetToSceneUnits(feet,{grid:{units}}),"upgrade")]);
  if(dullahanMounted(actor))add("mount",Object.keys(CONFIG.DND5E.damageTypes??{}).filter(t=>!["radiant","healing","temphp","maximum","midi-none"].includes(t)).map(t=>dullahanChange("system.traits.dr.value",t)));
  const state=dullahanState(actor),oath=state.oath;
  if(dullahanHas(actor,"broken")&&oath?.withered&&!oath.deathConfirmed&& !dullahanPactWaives(actor)){
    const tier=dullahanLevel(actor),hp=actor.system.attributes.hp,own=[...(actor.effects??[])].find(e=>e.getFlag?.(MODULE_ID,"dullahanPassive")==="broken"&&isEffectActive(e)),previous=Number(own?.system?.changes?.find(c=>c.key==="system.attributes.hp.tempmax")?.value??0),base=Math.max(1,Number(hp.effectiveMax??(Number(hp.max)+Number(hp.tempmax??0)))-previous);
    const basic=Number(oath.cr)+tier,afterBasic=Math.max(0,base-basic),remaining=dullahanHas(actor,"fading")?Math.floor(afterBasic/2):afterBasic;
    add("broken",[dullahanChange("system.attributes.hp.tempmax",remaining-base),...["str","dex","con","int","wis","cha"].map(a=>dullahanChange(`system.abilities.${a}.bonuses.save`,-tier))]);
  }return rows;
}
const syncing=new Set();
export async function syncDullahan(actor){if(!enabled()||!isAutomationAuthority(actor)||!actor.system?.attributes)return;
  if(!dullahanLevel(actor)&&![...(actor.effects??[])].some(e=>e.getFlag?.(MODULE_ID,"dullahanPassive")))return;
  await syncFlaggedPassiveEffects(actor,syncing,MODULE_ID,"dullahanPassive",dullahanPassiveDefinitions);
  const hp=actor.system.attributes.hp,max=Number(hp.effectiveMax??(Number(hp.max)+Number(hp.tempmax??0)));if(Number(hp.value)>max)await actor.update({"system.attributes.hp.value":Math.max(0,max)});
}
export function validateDullahanItem(item,_data,_options,userId){if(userId!==game.user.id||!enabled()||!game.settings.get(MODULE_ID,SETTINGS.STRICT_PREREQUISITES)||item.system?.identifier!=="dullahan-transformation"||!item.parent)return;
  if(Number(item.parent.system.abilities.con.value)<13){notify("Дуллахан: требуется Телосложение 13.","warn");return false;}}
export function validateDullahanAdvancement(manager,_updates,toCreate,_toUpdate,toDelete){if(!enabled())return;const removed=new Set(toDelete),owned=[...(manager.actor.items??[])].filter(i=>!removed.has(i.id));
  for(const d of toCreate){if(!automationData(d).dullahanBoon)continue;const row=DULLAHAN_FEATURES.find(r=>r.key===d.system.identifier);
    if(toCreate.filter(i=>i.system?.identifier===d.system.identifier).length>1||owned.some(i=>i.system.identifier===d.system.identifier)){notify(`«${d.name}» уже получено.`,"warn");return false;}
    if(row?.requires&&![...owned,...toCreate].some(i=>i.system?.identifier===`dullahan-${row.requires}`)){notify(`«${d.name}»: требуется ${DULLAHAN_FEATURES.find(r=>r.id===row.requires).name}.`,"warn");return false;}
  }}
export function inspectDullahan(actor){return {level:dullahanLevel(actor),dc:dullahanLevel(actor)?dullahanDC(actor):null,state:structuredClone(dullahanState(actor)),mounted:dullahanMounted(actor),pactWaives:Boolean(dullahanPactWaives(actor)),unavailable:DULLAHAN_FEATURES.filter(r=>findFeature(actor,r.key)&&!dullahanHas(actor,r.id)).map(r=>({id:r.id,reason:"Ступень, подавление или не получен требуемый бонус"}))};}
