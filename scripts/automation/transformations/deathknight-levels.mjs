import {MODULE_ID} from "../shared/constants.mjs";
import {enabled} from "../shared/helpers.mjs";
import {isEffectActive} from "../effects/temporary-effects.mjs";
import {migrationFingerprint} from "../shared/owned-item-migration.mjs";
import {serialMutation} from "../shared/transactions.mjs";
import {askOwner} from "../shared/owner-prompts.mjs";
import {dkHas,dkChange,dkDC} from "./deathknight.mjs";
import {dkPulse} from "./deathknight-use.mjs";
export const dkLevelData=effect=>effect?.getFlag?.(MODULE_ID,"deathknightLevels");
export const dkLevelEffects=actor=>[...(actor?.effects??[])].filter(e=>dkLevelData(e)&&isEffectActive(e));
export const dkCreatureType=actor=>String(actor?.system?.details?.type?.value??"").toLowerCase();
export function dkLevelChanges(state){const changes=[];if(state.levels>=4&&state.ability)changes.push(dkChange(`system.abilities.${state.ability}.value`,-Math.min(5,state.levels,Number(state.abilityBase??30))));if(state.levels>=6&&state.hpBase>0)changes.push(dkChange("system.attributes.hp.tempmax",-Math.ceil(state.hpBase/2)));return changes;}
export async function setDeathLevels(target,state,effect=null){const actor=target.actor;
  if(effect&&state.managed!==migrationFingerprint(effect.system?.changes??[]))return {status:"needs-review",reason:"Ручные изменения эффекта УС сохранены"};
  if(state.levels<=0){if(effect)await effect.delete();return true;}
  state.levels=Math.min(6,state.levels);const changes=dkLevelChanges(state);state.managed=migrationFingerprint(changes);
  const data={name:`Уровни Смерти: ${state.levels}`,img:"icons/skills/melee/sword-damaged-broken-glow-red.webp",type:"base",disabled:effect?.disabled??false,transfer:false,origin:state.sourceItemUuid,statuses:[],start:null,duration:{value:null,units:"seconds",expiry:null,expired:false},flags:{[MODULE_ID]:{deathknightLevels:state}},system:{changes}};
  if(effect)await effect.update(data);else await actor.createEmbeddedDocuments("ActiveEffect",[data]);
  // dnd5e clamps prepared HP only. Persist the cap so removing this max-HP
  // penalty cannot reveal old source HP and grant an unintended free heal.
  const rawHp=Number(actor._source?.system?.attributes?.hp?.value??actor.system.attributes.hp.value),cap=Math.floor(Number(state.hpBase??0)/2);
  if(state.levels>=6&&rawHp>cap)await actor.update({"system.attributes.hp.value":cap},{[MODULE_ID]:{skipDeathknightHealing:true}});return true;
}
export async function addDeathLevels(source,target,item,amount=1,{choose=true}={}){return serialMutation(`deathknight-levels:${target.actor.uuid}`,async()=>{
  if(!enabled()||!dkHas(source.actor,"grave")||["undead","construct"].includes(dkCreatureType(target.actor)))return false;
  if([...(target.actor.effects??[])].some(e=>dkLevelData(e)&&!isEffectActive(e)))return {status:"needs-review",reason:"УС вручную отключены/подавлены; автоматизация не заменяет их новой активной копией"};
  const all=dkLevelEffects(target.actor);if(all.some(e=>dkLevelData(e).sourceActorUuid!==source.actor.uuid))return {status:"needs-review",reason:"Другой источник УС: порядок и складывание решает GM"};
  const effect=all[0],old=dkLevelData(effect),state=structuredClone(old??{sourceActorUuid:source.actor.uuid,sourceTokenUuid:source.uuid,sourceItemUuid:item.uuid,targetTokenUuid:target.uuid,levels:0,dc:dkDC(source.actor),prof:Number(source.actor.system.attributes.prof)});
  state.levels=Math.min(6,Math.max(0,state.levels+amount));
  if(state.levels>=4&&!state.ability&&choose){const key=await askOwner(source.actor,{title:"Поражённый могилой: ослабляемая характеристика",choices:[ ["str","Сила"],["dex","Ловкость"],["con","Телосложение"],["int","Интеллект"],["wis","Мудрость"],["cha","Харизма"] ]});if(["str","dex","con","int","wis","cha"].includes(key)){state.ability=key;state.abilityBase=Number(target.actor._source?.system?.abilities?.[key]?.value??target.actor.system.abilities[key].value);}}
  if(state.levels>=6&&!(old?.levels>=6)){state.hpBase=Number(target.actor.system.attributes.hp.effectiveMax??target.actor.system.attributes.hp.max);}
  return setDeathLevels(target,state,effect);
});}
export async function healDeathLevels(actor){for(const effect of dkLevelEffects(actor))await serialMutation(`deathknight-levels:${actor.uuid}`,async()=>{const state=structuredClone(dkLevelData(effect));if(!state)return false;state.levels-=1;return setDeathLevels({actor},state,effect);});return true;}
export async function tickDeathLevels(record){const effect=await fromUuid(record.effectUuid);if(!effect||!isEffectActive(effect))return false;const state=dkLevelData(effect),source=await fromUuid(state.sourceTokenUuid),target=await fromUuid(state.targetTokenUuid),item=await fromUuid(state.sourceItemUuid);if(!source?.actor||!target?.actor||!item)return {status:"needs-review"};
  return dkPulse(source,item,[target],{save:"con",dc:state.dc,damage:[{formula:String(state.prof),type:"necrotic"}],requestId:record.id});
}
