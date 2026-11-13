import {MODULE_ID} from "../shared/constants.mjs";
import {enabled,automationData,automationAction,findFeature,notify,reportFailure} from "../shared/helpers.mjs";
import {factoryState,patchFactory,factoryRecords,factoryContext,factoryHas,factoryAddicted,factoryAvailable,factoryRegeneration,factoryAugment,factoryAscended} from "./factory.mjs";
import {syncFactory} from "./factory-passives.mjs";
import {controlFactory,rechargeFactoryArc} from "./factory-actions.mjs";
import {factoryChildSnapshot,controlFactoryHomunculus,syncFactoryHomunculi} from "./factory-homunculi.mjs";
import {runFactoryFortitude,prepareFactorySave,finishFactorySaves} from "./factory-defense.mjs";
import {prepareFactoryDrive,finishFactoryDrive,filterFactorySpellTargets,prepareFactorySpellSave} from "./factory-spells.mjs";
import {endFactoryAscension} from "./factory-forms.mjs";
import {prepareFactoryFirstAttack,finishFactoryFirstAttack,prepareFactoryAttenuation,finishFactoryHit} from "./factory-attacks.mjs";
import {factorySupportDamage} from "./factory-support.mjs";
import {factoryPulse} from "./factory-use.mjs";
import {automationActors,isEffectActive,temporaryEffectTiming} from "../effects/temporary-effects.mjs";
import {onConfirmedDamage} from "../shared/damage-events.mjs";
import {registerGmRequest,requestGm,isGmAuthority} from "../shared/gm-requests.mjs";
import {applyNativeOnce} from "../shared/native-applications.mjs";
import {registerAutomationEvent,runAutomationEvent} from "../shared/event-ledger.mjs";
import {combatTurnSnapshot,isForwardTurn} from "../shared/combat-flow.mjs";
import {inFeet,canReact,recordModuleReaction} from "../shared/combat-benefits.mjs";
import {confirmOwner} from "../shared/owner-prompts.mjs";
import {serialMutation} from "../shared/transactions.mjs";

export async function malfunctionFactory(actor,requestId){
  const contexts=new Map();for(const r of factoryRecords(actor)){const ctx=factoryContext(actor,r);if(ctx?.imperfections)contexts.set(r.ownerUuid,ctx);}
  for(const [ownerUuid,ctx]of contexts)await applyNativeOnce(actor,{requestId:`${requestId}:${ownerUuid}`,action:"factory-malfunction",activityUuid:null},async()=>true,async()=>{
    for(const e of [...actor.effects])if(e.getFlag?.(MODULE_ID,"factoryMalfunction")?.ownerUuid===ownerUuid)await e.delete();
    await actor.createEmbeddedDocuments("ActiveEffect",[{name:"Несовершенства: все улучшения отключены",type:"base",disabled:false,transfer:false,statuses:[],...temporaryEffectTiming({seconds:60,actor,expiry:"updateWorldTime"}),flags:{[MODULE_ID]:{factoryMalfunction:{ownerUuid,dc:ctx.dc}},dae:{expiryMode:"delete"}},system:{changes:[]}}]);return true;
  });await syncFactory(actor);
}
export async function runFactoryTurn(record){const source=await fromUuid(record.sourceTokenUuid),actor=source?.actor;if(!actor||source.parent.id!==record.sceneId)return false;
  if(record.operation==="start"){
    if(factoryState(actor).attenuationLocked)await patchFactory(actor,{attenuationLocked:false});
    const amount=Math.min(Number(record.healing??0),factoryRegeneration(actor));if(amount>0)await actor.update({"system.attributes.hp.value":Number(actor.system.attributes.hp.value)+amount});
    if(factoryHas(actor,"arc")&&factoryState(actor).arcReady===false)await rechargeFactoryArc(actor);
    await syncFactory(actor);
    return true;
  }
  for(const uuid of record.effects??[]){const e=await fromUuid(uuid),m=e?.getFlag?.(MODULE_ID,"factoryMalfunction");if(!m||!isEffectActive(e))continue;
    const rolls=await actor.rollSavingThrow({ability:"int",target:m.dc},{configure:false});if(rolls?.length&&Number(rolls[0].total)>=m.dc)await e.delete();
  }
  for(const e of [...(actor.effects??[])])if(e.getFlag?.(MODULE_ID,"factoryAgility"))await e.delete();await syncFactory(actor);return true;
}
registerAutomationEvent("factory-turn",runFactoryTurn);
export async function handleFactoryTurn(combat,changes){if(!enabled()||!isGmAuthority()||!isForwardTurn(combat,changes))return;
  const snapshot=combatTurnSnapshot(combat),moment=`${snapshot.id}:${snapshot.current.round}:${snapshot.current.turn}`,records=[];
  const current=snapshot.current.token,previous=snapshot.previous.token;
  if(current?.actor&&(factoryHas(current.actor,"living")||factoryHas(current.actor,"arc")||factoryAugment(current.actor,"air-walkers")||factoryState(current.actor).attenuationLocked))records.push({id:`factory-start:${moment}:${current.uuid}`,kind:"factory-turn",name:"Фабрика: начало хода",operation:"start",sceneId:current.parent.id,sourceTokenUuid:current.uuid,healing:factoryRegeneration(current.actor)});
  if(previous?.actor){const effects=[...(previous.actor.effects??[])].filter(e=>e.getFlag?.(MODULE_ID,"factoryMalfunction")&&isEffectActive(e)).map(e=>e.uuid);if(effects.length||factoryAugment(previous.actor,"air-walkers")||[...previous.actor.effects].some(e=>e.getFlag?.(MODULE_ID,"factoryAgility")))records.push({id:`factory-end:${moment}:${previous.uuid}`,kind:"factory-turn",name:"Фабрика: восстановление улучшений",operation:"end",sceneId:previous.parent.id,sourceTokenUuid:previous.uuid,effects});}
  for(const record of records)await runAutomationEvent(record,()=>runFactoryTurn(record),{queued:!canvas.ready||canvas.scene?.id!==record.sceneId});
}
registerGmRequest("factory-rest",(actor,data,{requestId})=>serialMutation(`factory-rest:${actor.uuid}`,()=>applyNativeOnce(actor,{requestId,action:"factory-rest",activityUuid:null},async()=>Boolean(enabled()&&isGmAuthority()),async()=>{
  const state=factoryState(actor),ticket={id:requestId,used:false,at:Number(game.time.worldTime)};await patchFactory(actor,{shortRest:ticket,...(data.long?{longRest:ticket,ascensionRests:Math.max(0,Number(state.ascensionRests??0)-1)}:{})});return true;
})));

export async function factoryDamageEvent({actor,amount,event}){if(!enabled()||!isGmAuthority()||amount<=0)return;
  if(event.critical)await malfunctionFactory(actor,`factory-critical:${event.workflowId}:${event.targetTokenUuid}`);
  if(factoryHas(actor,"fortitude")&&Number(event.beforeHp)>0&&Number(actor.system.attributes.hp.value)===0)await runFactoryFortitude(actor,{amount,radiant:(event.damageTypes??[event.damageType]).includes("radiant"),critical:event.critical,requestId:`factory-fortitude:${event.workflowId}:${event.targetTokenUuid}`});
  if(factoryAscended(actor)&&Number(actor.system.attributes.hp.value)===0)await endFactoryAscension(actor);
  await factorySupportDamage({actor,amount,event});
  const source=await fromUuid(event.sourceTokenUuid),target=await fromUuid(event.targetTokenUuid),activity=await fromUuid(event.activityUuid);
  if(!source?.actor||target?.actor?.uuid!==actor.uuid||source.parent.id!==target.parent.id)return;
  const flags=automationData(activity);if(event.factoryReflection||event.factoryRetaliation||flags.factoryReflection||flags.factoryRetaliation)return;
  const types=event.damageTypes??[event.damageType],blood=factoryAugment(actor,"blood"),melee=activity?.type==="attack"&&activity.attack?.type?.value==="melee";
  if(blood&&melee&&types.some(t=>["piercing","slashing"].includes(t))&&inFeet(target,source,5,target.parent))await applyNativeOnce(actor,{requestId:`factory-blood:${event.workflowId}:${target.uuid}`,action:"factory-blood",activityUuid:event.activityUuid},async()=>true,()=>factoryPulse(target,findFeature(actor,"factory-installed-blood"),[source],{damage:[{formula:String(factoryContext(actor,blood).tier),type:"poison"}],requestId:`${event.key}:blood`,metadata:{factoryRetaliation:true}}));
  if(factoryHas(actor,"grounding")&&types.length===1&&types[0]==="lightning"&&canReact(actor))await applyNativeOnce(actor,{requestId:`factory-grounding:${event.workflowId}:${target.uuid}`,action:"factory-grounding",activityUuid:event.activityUuid},async()=>{if(!await confirmOwner(actor,"Заземление: ответная реакция",`Получено ${amount} электричества после защит. Потратить реакцию: все остальные существа в 15 футах CON, при провале ${amount} электричества?`))return false;await recordModuleReaction(actor,target.parent);return true;},async()=>{const targets=[...(target.parent.tokens??[])].filter(t=>t.actor&&t.uuid!==target.uuid&&inFeet(target,t,15,target.parent));if(!targets.length)return true;return factoryPulse(target,findFeature(actor,"factory-grounding"),targets,{save:"con",damage:[{formula:String(amount),type:"lightning"}],requestId:`${event.key}:grounding`,metadata:{factoryReflection:true}});});
  const child=factoryChildSnapshot(actor);
  if(child?.material==="crystal"&&types.length===1&&types[0]==="radiant")await applyNativeOnce(actor,{requestId:`factory-crystal:${event.workflowId}:${target.uuid}`,action:"factory-crystal",activityUuid:event.activityUuid},async()=>true,async()=>{const targets=[...(target.parent.tokens??[])].filter(t=>t.actor&&t.uuid!==target.uuid&&inFeet(target,t,20,target.parent));if(!targets.length)return true;return factoryPulse(target,actor.items.find(i=>i.getFlag?.(MODULE_ID,"managedSummonFeature")==="factory-material"),targets,{damage:[{formula:String(amount),type:"radiant"}],requestId:`${event.key}:crystal`,metadata:{factoryReflection:true}});});
}
onConfirmedDamage(factoryDamageEvent);
export function installFactoryHooks(){const report = reportFailure("Factory automation");
  const intercept=activity=>{if(!enabled()||!activity)return;const flags=automationData(activity);if(flags.factoryResolved||flags.leaderResolved||flags.auraPulse)return;
    if(activity.item?.getFlag?.(MODULE_ID,"factoryInstalled")&&!factoryAvailable(activity.actor,activity.item)){notify("Улучшение Фабрики не установлено, подавлено или временно отключено.","warn");return false;}
    const action=automationAction(activity);if(action==="factory-homunculus"){report(controlFactoryHomunculus(activity.actor,activity));return false;}
    if(action!=="factory-control")return;if(!factoryAvailable(activity.actor,activity.item)){notify("Фабрика: ступень/подавление/предварительный бонус не позволяют применение.","warn");return false;}report(controlFactory(activity.actor,activity));return false;
  };
  Hooks.on("dnd5e.preUseActivity",intercept);Hooks.on("midi-qol.preTargetingV2",({workflow})=>intercept(workflow?.activity));
  Hooks.on("dnd5e.preBeginConcentrating",actor=>{if(enabled()&&factoryAddicted(actor)){notify("Зависимость Фабрики запрещает концентрацию.","warn");return false;}});
  Hooks.on("midi-qol.preDamageRoll",prepareFactoryDrive);Hooks.on("midi-qol.preCleanup",finishFactoryDrive);
  Hooks.on("midi-qol.preAttackRollConfig",prepareFactoryFirstAttack);Hooks.on("midi-qol.prePreambleComplete",prepareFactoryAttenuation);Hooks.on("midi-qol.AttackRollComplete",finishFactoryHit);
  Hooks.on("midi-qol.preCleanup",finishFactoryFirstAttack);
  Hooks.on("midi-qol.prePreambleComplete",filterFactorySpellTargets);Hooks.on("midi-qol.preTargetSave",prepareFactorySave);Hooks.on("midi-qol.preTargetSave",prepareFactorySpellSave);Hooks.on("midi-qol.postCheckSaves",finishFactorySaves);
  Hooks.on("updateCombat",(combat,changes)=>report(handleFactoryTurn(combat,changes)));
  for(const h of ["ready","updateWorldTime"])Hooks.on(h,()=>{if(enabled()&&isGmAuthority())for(const actor of automationActors())if(factoryHas(actor,"addiction")||factoryRecords(actor).length)report(syncFactory(actor));});
  for(const h of ["updateActiveEffect","deleteActiveEffect","createActiveEffect"])Hooks.on(h,e=>{if(!enabled()||!isGmAuthority()||e.parent?.documentName!=="Actor")return;if(e.getFlag?.(MODULE_ID,"factoryMalfunction"))report(syncFactory(e.parent));if(h==="deleteActiveEffect"&&e.getFlag?.(MODULE_ID,"factoryAscension"))report(endFactoryAscension(e.parent));});
  Hooks.on("updateActor",(actor,changes)=>{if(!enabled()||!isGmAuthority()||!factoryHas(actor,"homunculus"))return;if(Object.keys(changes).some(k=>k.startsWith("system.abilities")||k.startsWith("system.attributes.prof"))||changes.system?.abilities)report(syncFactoryHomunculi(actor));});
  for(const h of ["updateItem","createItem","deleteItem"])Hooks.on(h,item=>{if(enabled()&&isGmAuthority()&&item.type==="class"&&item.parent)report(syncFactoryHomunculi(item.parent));});
  Hooks.on("dnd5e.restCompleted",(actor,result,config)=>{if(!enabled()||!factoryHas(actor,"form"))return;const long=Boolean(result.longRest||result.type==="long"||config?.type==="long"),id=result.factoryRestId??=result.message?.uuid??foundry.utils.randomID();report(requestGm("factory-rest",actor,{long},{requestId:`factory-rest:${id}`}));});
}
