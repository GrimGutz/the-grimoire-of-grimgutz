import {MODULE_ID} from "../shared/constants.mjs";
import {enabled,findFeature,itemUses,notify} from "../shared/helpers.mjs";
import {hunterLevel,hunterPool,selectedHunterTrophy} from "./bounty-hunter.mjs";
import {onConfirmedDamage} from "../shared/damage-events.mjs";
import {isGmAuthority,registerGmRequest,requestGm} from "../shared/gm-requests.mjs";
import {serialMutation} from "../shared/transactions.mjs";
import {isEffectActive} from "../effects/temporary-effects.mjs";
import {isForwardTurn,combatTurnSnapshot,encounterForScene} from "../shared/combat-flow.mjs";
import {runAutomationEvent,registerAutomationEvent} from "../shared/event-ledger.mjs";
import {applyNativeOnce} from "../shared/native-applications.mjs";
import {useHunterNative} from "./bounty-hunter-cost.mjs";
import {areaDamagePart} from "../shared/area-definitions.mjs";
import {confirmOwner} from "../shared/owner-prompts.mjs";
import {turnKey} from "../shared/combat-benefits.mjs";

// User clarification: a critical that also kills is ONE recovery trigger.
export const hunterRecoveryKey=({workflowId,targetTokenUuid,critical=false})=>critical?`${workflowId}:critical`:`${workflowId}:${targetTokenUuid}:zero`;
export function hunterHealingBlocked(actor) {return [...(actor.effects??[])].some(e=>isEffectActive(e)&&e.getFlag?.(MODULE_ID,"hunterHealingBlocked"));}
export async function recoverHunter(actor,key) {
  if(!enabled()||!isGmAuthority()||hunterLevel(actor)<5||!findFeature(actor,"hunter-rekindle"))return false;
  return serialMutation(`hunter-recovery:${actor.uuid}`,async()=>{
    const used=actor.getFlag(MODULE_ID,"hunterRecoveryClaims")??[];if(used.includes(key))return false;
    const pool=hunterPool(actor);if(!pool)return false;
    await actor.setFlag(MODULE_ID,"hunterRecoveryClaims",[...used,key].slice(-100));
    const resource=itemUses(pool);if(!resource.spent)return true;
    const roll=await new Roll("1d4").evaluate();
    await pool.update({"system.uses.spent":Math.max(0,itemUses(pool).spent-Number(roll.total))});
    await roll.toMessage?.({speaker:ChatMessage.getSpeaker({actor}),flavor:"Разжигание охоты — восстановление использований трофеев"});return true;
  });
}
registerGmRequest("hunter-critical",async(actor,data)=>{
  const activity=await fromUuid(data.activityUuid),source=await fromUuid(data.sourceUuid);
  if(activity?.actor?.uuid!==actor.uuid||source?.actor?.uuid!==actor.uuid||activity.type!=="attack"||!data.hit)return false;
  return recoverHunter(actor,hunterRecoveryKey({workflowId:data.workflowId,critical:true}));
});
export async function handleHunterCritical(workflow) {
  if(!enabled()||workflow?.aborted||!workflow.attackRoll||!workflow.isCritical||!workflow.hitTargets?.size||hunterLevel(workflow.actor)<5)return;
  return requestGm("hunter-critical",workflow.actor,{activityUuid:workflow.activity.uuid,sourceUuid:workflow.token.document?.uuid??workflow.token.uuid,
    workflowId:workflow.id,hit:true},{requestId:`hunter-critical:${workflow.id}`});
}
onConfirmedDamage(async({actor,amount,event})=>{
  if(amount>0&&(event.damageTypes??[event.damageType]).includes("fire")&&hunterLevel(actor)){
    const token=await fromUuid(event.targetTokenUuid),combat=token&&encounterForScene(token.parent,token);
    await actor.setFlag(MODULE_ID,"hunterFireDamage",{combatId:combat?.id??null,key:event.key,time:Number(game.time.worldTime)});
  }
  if(amount>0&&Number(event.beforeHp)>0&&Number(actor.system.attributes.hp.value)<=0){
    const source=await fromUuid(event.sourceActorUuid);if(source&&hunterLevel(source)){
      const token=await fromUuid(event.sourceTokenUuid),combat=token&&encounterForScene(token.parent,token);
      await source.setFlag(MODULE_ID,"hunterLastKill",{workflowId:event.workflowId,targetUuid:event.targetTokenUuid,sourceUuid:event.sourceTokenUuid,
        turn:turnKey(combat)});
      await recoverHunter(source,hunterRecoveryKey(event));
    }
  }
  // Only this module's sleep instance ends; other unconsciousness/effects survive.
  if(amount>0)for(const effect of [...(actor.effects??[])])if(effect.getFlag?.(MODULE_ID,"hunterSleep")&&isEffectActive(effect))await effect.delete();
});
export function hunterRegenSnapshot(actor,combatId) {
  const hp=actor.system.attributes.hp;
  return {fire:structuredClone(actor.getFlag(MODULE_ID,"hunterFireDamage")??null),combatId,
    amount:Number(hp.value)>0?Math.max(0,Math.min(Number(hp.max)-Number(hp.value),Number(actor.system.attributes.prof)+2)):0};
}
export async function regenerateHunter(actor,combatId,snapshot=hunterRegenSnapshot(actor,combatId)) {
  const active=[...(actor.effects??[])].find(e=>isEffectActive(e)&&e.getFlag?.(MODULE_ID,"hunterRegeneration"));
  const blocked=snapshot.fire?.combatId===combatId;
  // A new fire hit received AFTER turn-start belongs to the NEXT interval.
  if(snapshot.fire&&JSON.stringify(actor.getFlag(MODULE_ID,"hunterFireDamage"))===JSON.stringify(snapshot.fire))await actor.unsetFlag(MODULE_ID,"hunterFireDamage");
  if(!active)return false;
  const state=active.getFlag(MODULE_ID,"hunterRegeneration"),trophy=selectedHunterTrophy(actor,"hunter-plant-major");
  if(!trophy||trophy.item.uuid!==state.itemUuid){await active.delete();return false;}
  const hp=actor.system.attributes.hp;
  if(blocked||Number(hp.value)<=0||hunterHealingBlocked(actor))return false;
  const amount=Math.max(0,Math.min(Number(hp.max)-Number(hp.value),snapshot.amount));
  if(amount>0)await actor.update({"system.attributes.hp.value":Number(hp.value)+amount});return true;
}
registerAutomationEvent("hunter-regeneration",async record=>{
  const actor=await fromUuid(record.sourceActorUuid);if(!actor)return false;return regenerateHunter(actor,record.input.combatId,record.input.snapshot);
});
registerGmRequest("hunter-kill-temp",async(actor,data,{requestId})=>{
  const activity=await fromUuid(data.activityUuid),source=await fromUuid(data.sourceUuid),last=actor.getFlag(MODULE_ID,"hunterLastKill");
  const trophy=selectedHunterTrophy(actor,"hunter-fiend-medium"),target=last?.targetUuid&&await fromUuid(last.targetUuid);
  if(!trophy||activity?.item.id!==trophy.item.id||source?.actor?.uuid!==actor.uuid||last?.sourceUuid!==source.uuid||!target||target.parent.id!==source.parent.id)return false;
  if(!source.disposition||!target.disposition||source.disposition===target.disposition)return false;
  if(last.turn!==turnKey(encounterForScene(source.parent,source))||actor.getFlag(MODULE_ID,"hunterKillTempClaims")?.includes?.(`${last.workflowId}:${last.targetUuid}`))return false;
  if(!await confirmOwner(actor,activity.item.name,"Получить временные хиты за эту подтверждённую враждебную цель и переместиться до 20 футов вручную без атак возможности этого движения?"))return false;
  return applyNativeOnce(actor,{requestId,action:"hunter-kill-temp",activityUuid:activity.uuid},()=>useHunterNative(activity,{type:"heal",
    healing:areaDamagePart({formula:`4d8 + ${Number(actor.system.abilities[actor.getFlag(MODULE_ID,"hunterConfiguration").ability].mod)}`,type:"temphp"}),
    range:{units:"self",override:true},target:{template:{type:""},affects:{type:"self"},override:true,prompt:false}},[source],{activation:"special"}),async()=>{
      await actor.setFlag(MODULE_ID,"hunterKillTempClaims",[...(actor.getFlag(MODULE_ID,"hunterKillTempClaims")??[]),`${last.workflowId}:${last.targetUuid}`].slice(-50));return true;
    });
});
export function installHunterEventHooks() {
  Hooks.on("midi-qol.RollComplete",workflow=>{void handleHunterCritical(workflow).catch(error=>notify(error.message,"warn"));});
  Hooks.on("updateCombat",(combat,changes)=>{
    if(!enabled()||!isGmAuthority()||!isForwardTurn(combat,changes))return;
    const snapshot=combatTurnSnapshot(combat),token=snapshot.current.token;if(!token?.actor||!hunterLevel(token.actor))return;
    if(!token.actor.getFlag(MODULE_ID,"hunterFireDamage")&&![...(token.actor.effects??[])].some(e=>isEffectActive(e)&&e.getFlag?.(MODULE_ID,"hunterRegeneration")))return;
    const parameters=hunterRegenSnapshot(token.actor,snapshot.id);
    void runAutomationEvent({id:`hunter-regen:${token.uuid}:${snapshot.id}:${snapshot.current.round}:${snapshot.current.turn}`,kind:"hunter-regeneration",
      sourceActorUuid:token.actor.uuid,sceneId:token.parent.id,name:"Трофей растения: регенерация",input:{combatId:snapshot.id,snapshot:parameters}},()=>regenerateHunter(token.actor,snapshot.id,parameters))
      .catch(error=>notify(error.message,"warn"));
  });
  Hooks.on("dnd5e.preApplyDamage",(actor,amount,changes)=>{
    const hp=changes["system.attributes.hp.value"]??changes.system?.attributes?.hp?.value;
    if(hunterHealingBlocked(actor)&&Number(hp)>Number(actor.system.attributes.hp.value)){
      if(changes.system?.attributes?.hp)changes.system.attributes.hp.value=actor.system.attributes.hp.value;
      else changes["system.attributes.hp.value"]=actor.system.attributes.hp.value;
    }
    const record=actor.getFlag?.(MODULE_ID,"hunterUndeadTemp"),temp=changes["system.attributes.hp.temp"]??changes.system?.attributes?.hp?.temp;
    if(record&&amount>0&&temp!==undefined&&Number(temp)<=Number(actor.system.attributes.hp.temp))
      changes[`flags.${MODULE_ID}.hunterUndeadTemp`]={remaining:Number(temp)};
  });
  Hooks.on("preUpdateActor",(actor,changes)=>{
    const record=actor.getFlag?.(MODULE_ID,"hunterUndeadTemp"),temp=changes["system.attributes.hp.temp"]??changes.system?.attributes?.hp?.temp;
    if(record&&temp!==undefined&&!changes[`flags.${MODULE_ID}.hunterUndeadTemp`]&&!changes.flags?.[MODULE_ID]?.hunterUndeadTemp)
      changes[`flags.${MODULE_ID}.-=hunterUndeadTemp`]=null;
  });
}
