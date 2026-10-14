import {MODULE_ID} from "../shared/constants.mjs";
import {enabled,automationData,findFeature} from "../shared/helpers.mjs";
import {factoryAugment,factoryState,patchFactory,factoryHas,factoryAscended} from "./factory.mjs";
import {factoryChildSnapshot} from "./factory-homunculi.mjs";
import {factoryArc} from "./factory-areas.mjs";
import {factoryPulse} from "./factory-use.mjs";
import {registerGmRequest,requestGm,isGmAuthority} from "../shared/gm-requests.mjs";
import {confirmOwner} from "../shared/owner-prompts.mjs";
import {applyNativeOnce} from "../shared/native-applications.mjs";
import {serialMutation} from "../shared/transactions.mjs";
import {encounterForScene,combatantToken} from "../shared/combat-flow.mjs";
import {inFeet} from "../shared/combat-benefits.mjs";
const keyFor=(combat)=>combat?.started?`${combat.id}:${combat.round}:${combat.turn}`:null;

registerGmRequest("factory-first-attack",(actor,data)=>serialMutation(`factory-first:${actor.uuid}`,async()=>{
  if(!enabled()||!isGmAuthority()||!factoryAugment(actor,"berserk")||!factoryAugment(actor,"reflexes"))return false;
  const activity=await fromUuid(data.activityUuid),source=await fromUuid(data.sourceUuid);if(activity?.actor?.uuid!==actor.uuid||source?.actor?.uuid!==actor.uuid||activity.type!=="attack")return false;
  const combat=encounterForScene(source.parent,source),key=keyFor(combat);if(!key||combatantToken(combat,combat.combatant)?.uuid!==source.uuid)return false;
  const claim=factoryState(actor).firstAttack;if(claim?.key===key)return {status:"success",advantage:claim.workflowId===data.workflowId};
  await patchFactory(actor,{firstAttack:{key,workflowId:data.workflowId}});return {status:"success",advantage:true};
}));
export async function prepareFactoryFirstAttack(workflow){if(!enabled()||workflow?.aborted||workflow?.activity?.type!=="attack"||!factoryAugment(workflow.actor,"berserk")||!factoryAugment(workflow.actor,"reflexes"))return;
  const source=workflow.token?.document??workflow.token,result=await requestGm("factory-first-attack",workflow.actor,{activityUuid:workflow.activity.uuid,sourceUuid:source?.uuid,workflowId:workflow.id},{requestId:`factory-first:${workflow.id}`});if(result.advantage){workflow.attackAdvAttribution?.add?.("Фабрика: первая атака хода");workflow.attackRollModifierTracker?.advantage?.add?.(`${MODULE_ID}.factory-first`,"Ярость берсерка + Улучшенные рефлексы");}
}
registerGmRequest("factory-attenuation",(caster,data)=>serialMutation(`factory-attenuation:${data.targetUuid}`,async()=>{
  if(!enabled()||!isGmAuthority())return false;const activity=await fromUuid(data.activityUuid),target=await fromUuid(data.targetUuid),source=await fromUuid(data.sourceUuid),actor=target?.actor;
  if(!actor||activity?.actor?.uuid!==caster.uuid||activity.item?.type!=="spell"||!source||source.parent.id!==target.parent.id||!factoryAugment(actor,"attenuation")&&factoryChildSnapshot(actor)?.material!=="mithral")return false;
  if(!["line","ray"].includes(activity.target?.template?.type)&&!(activity.type==="attack"&&activity.attack?.type?.value==="ranged"))return false;
  const combat=encounterForScene(target.parent,target),key=keyFor(combat);if(!key)return false;
  const state=factoryState(actor),old=state.attenuationClaims?.[data.workflowId];if(old)return old;
  if(state.attenuationAttempt===key||state.attenuationLocked)return false;
  // Reserve the application before prompting, so repeated callbacks cannot offer it again.
  await patchFactory(actor,{attenuationClaims:{...state.attenuationClaims,[data.workflowId]:{status:"cancelled"}}});
  if(!await confirmOwner(actor,"Ослабление магии", "Это линейное заклинание или заклинание с дальнобойной атакой. Бросить к6 (раз за ход); на 5–6 оно на вас не действует?"))return false;
  const roll=await new Roll("1d6").evaluate();await roll.toMessage({speaker:ChatMessage.getSpeaker({actor}),flavor:"Ослабление магии: 5–6"});const blocked=Number(roll.total)>=5,reply={status:"success",blocked};
  await patchFactory(actor,{attenuationAttempt:key,attenuationLocked:blocked,attenuationClaims:Object.fromEntries([...Object.entries(factoryState(actor).attenuationClaims??{}),[data.workflowId,reply]].slice(-50))});return reply;
}));
export async function prepareFactoryAttenuation(workflow){if(!enabled()||workflow?.aborted||workflow?.item?.type!=="spell")return;const source=workflow.token?.document??workflow.token;
  for(const target of [...(workflow.targets??[])]){if(!factoryAugment(target.actor,"attenuation")&&factoryChildSnapshot(target.actor)?.material!=="mithral")continue;
    const uuid=target.document?.uuid??target.uuid,result=await requestGm("factory-attenuation",workflow.actor,{activityUuid:workflow.activity.uuid,sourceUuid:source?.uuid,targetUuid:uuid,workflowId:workflow.id},{requestId:`factory-attenuation:${workflow.id}:${uuid}`,timeoutMs:180000});if(result.blocked){workflow.targets.delete(target);workflow.grimgutzFactoryBlocked??=new Set();workflow.grimgutzFactoryBlocked.add(uuid);}
  }
}
registerGmRequest("factory-hit",async(caster,data,{requestId})=>{
  if(!enabled()||!isGmAuthority())return false;const activity=await fromUuid(data.activityUuid),source=await fromUuid(data.sourceUuid);if(activity?.actor?.uuid!==caster.uuid||source?.actor?.uuid!==caster.uuid||activity.type!=="attack"||activity.attack?.type?.value!=="melee"||automationData(activity).factoryRetaliation)return false;
  const targets=(await Promise.all((data.targets??[]).map(uuid=>fromUuid(uuid)))).filter(t=>t?.actor&&t.parent.id===source.parent.id);
  for(const target of targets){const defender=target.actor,child=factoryChildSnapshot(defender),ascended=factoryAscended(defender),heated=child?.material==="iron"&&inFeet(source,target,5,source.parent);if(!ascended&&!heated)continue;
    await applyNativeOnce(defender,{requestId:`${requestId}:retaliation:${target.uuid}`,action:"factory-melee-retaliation",activityUuid:activity.uuid},async()=>true,()=>factoryPulse(target,ascended?findFeature(defender,"factory-ascension"):defender.items.find(i=>i.getFlag?.(MODULE_ID,"managedSummonFeature")==="factory-material"),[source],{damage:[{formula:"1d10",type:ascended?"lightning":"fire"}],requestId:`${requestId}:retaliation:${target.uuid}`,metadata:{factoryRetaliation:true}}));
  }
  if(factoryHas(caster,"arc")&&factoryState(caster).arcReady!==false&&targets.length)return applyNativeOnce(caster,{requestId:`${requestId}:arc-offer`,action:"factory-arc-offer",activityUuid:activity.uuid},()=>confirmOwner(caster,"Электрическая дуга","Подтверждено рукопашное попадание. Выбрать цепочку и применить готовую Электрическую дугу?"),async()=>{const item=findFeature(caster,"factory-arc"),use=[...item.system.activities.values()].find(a=>automationData(a).factoryOperation==="arc");return factoryArc(caster,use,source,`${requestId}:arc`);});
  return true;
});
export function finishFactoryHit(workflow){if(!enabled()||workflow?.aborted||workflow?.activity?.type!=="attack"||workflow.activity.attack?.type?.value!=="melee"||!workflow.hitTargets?.size)return;const source=workflow.token?.document??workflow.token;return requestGm("factory-hit",workflow.actor,{activityUuid:workflow.activity.uuid,sourceUuid:source?.uuid,targets:[...workflow.hitTargets].map(t=>t.document?.uuid??t.uuid)},{requestId:`factory-hit:${workflow.id}`,timeoutMs:180000});}
registerGmRequest("factory-first-cancel",(actor,data)=>serialMutation(`factory-first:${actor.uuid}`,async()=>{if(!enabled()||!isGmAuthority()||factoryState(actor).firstAttack?.workflowId!==data.workflowId)return false;await patchFactory(actor,{firstAttack:null});return true;}));
export function finishFactoryFirstAttack(workflow){if(!enabled()||!workflow?.actor||workflow.attackRoll||workflow.attackRolls?.length)return;if(factoryState(workflow.actor).firstAttack?.workflowId===workflow.id)return requestGm("factory-first-cancel",workflow.actor,{workflowId:workflow.id},{requestId:`factory-first-cancel:${workflow.id}`});}
