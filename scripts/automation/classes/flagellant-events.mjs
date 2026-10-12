import {MODULE_ID} from "../shared/constants.mjs";
import {enabled,automationData,automationAction,findFeature,notify} from "../shared/helpers.mjs";
import {flagellantPain,flagellantDie} from "../shared/flagellant-definitions.mjs";
import {flagellantLevel,flagellantAvailable,flagellantTechniques,flagellantDC,flagellantRestCompleted} from "./flagellant.mjs";
import {controlFlagellant,activeStates,useFlagellantTechnique,nativeFlagellantHeal,rollFlagellantPain} from "./flagellant-actions.mjs";
import {isGmAuthority,registerGmRequest} from "../shared/gm-requests.mjs";
import {serialMutation} from "../shared/transactions.mjs";
import {onPrepareDamage,onConfirmedDamage} from "../shared/damage-events.mjs";
import {onPrepareAttack,benefitData,inFeet,canReact,turnKey} from "../shared/combat-benefits.mjs";
import {encounterForScene,combatTurnSnapshot,isForwardTurn} from "../shared/combat-flow.mjs";
import {isEffectActive,automationActors} from "../effects/temporary-effects.mjs";
import {runAutomationEvent,registerAutomationEvent} from "../shared/event-ledger.mjs";
import {applyNativeOnce} from "../shared/native-applications.mjs";
import {confirmOwner,chooseSceneTokens,promptOwner} from "../shared/owner-prompts.mjs";
import {useAuraPulse} from "../midi/aura-workflow.mjs";

const object=doc=>doc.object??{actor:doc.actor,document:doc};
const hpCache=new Map(),feasts=new Map(),liveAccumulated=new Map(),accumulationClaims=new Map(),lossSeen=new Set();
export function trackFlagellantState(effect){const state=benefitData(effect);if(state?.kind==="flagellant-feast")feasts.set(effect.uuid,effect);else feasts.delete(effect.uuid);
  if(state?.kind==="flagellant-retribution")liveAccumulated.set(effect.uuid,Math.max(liveAccumulated.get(effect.uuid)??0,Number(state.accumulated??0)));}
export function seedFlagellantTracking(){hpCache.clear();feasts.clear();liveAccumulated.clear();accumulationClaims.clear();lossSeen.clear();for(const actor of automationActors()){
  if(actor.system?.attributes?.hp)hpCache.set(actor.uuid,Number(actor.system.attributes.hp.value));for(const effect of actor.effects??[])trackFlagellantState(effect);}}
export async function recordFlagellantHpLoss(actor,before,after,{id}={}){
  const amount=Math.max(0,Number(before)-Number(after));if(!enabled()||!isGmAuthority()||!id||!amount||lossSeen.has(id))return false;
  lossSeen.add(id);if(lossSeen.size>1500)lossSeen.delete(lossSeen.values().next().value);
  const accumulating=activeStates(actor).filter(e=>benefitData(e).kind==="flagellant-retribution");
  for(const effect of accumulating){const state=benefitData(effect),claims=accumulationClaims.get(effect.uuid)??new Set(state.lossClaims??[]);accumulationClaims.set(effect.uuid,claims);
    if(claims.has(id))continue;claims.add(id);liveAccumulated.set(effect.uuid,(liveAccumulated.get(effect.uuid)??Number(state.accumulated??0))+amount);}
  await serialMutation(`flagellant-loss:${actor.uuid}`,async()=>{
    for(const effect of accumulating){const state=benefitData(effect);if(!isEffectActive(effect)||state.lossClaims?.includes(id))continue;
      await effect.setFlag(MODULE_ID,"combatBenefit",{...state,accumulated:Math.max(Number(state.accumulated??0),liveAccumulated.get(effect.uuid)??0),lossClaims:[...(accumulationClaims.get(effect.uuid)??[])].slice(-150)});}
  });
  for(const effect of feasts.values()){
    if(!isEffectActive(effect))continue;const state=benefitData(effect),source=await fromUuid(state.sourceTokenUuid);if(!source?.actor)continue;
    if(["blinded","unconscious","dead"].some(s=>source.actor.statuses?.has?.(s)))continue;
    const owner=promptOwner(source.actor),target=[...(source.parent.tokens??[])].find(t=>t.actor?.uuid===actor.uuid&&inFeet(source,t,30,source.parent)
      &&(!t.hidden||owner.isGM||t.actor.testUserPermission?.(owner,"OWNER")));if(!target)continue;
    const record={id:`flagellant-feast:${effect.uuid}:${id}`,kind:"flagellant-feast",sceneId:source.parent.id,sourceActorUuid:source.actor.uuid,sourceTokenUuid:source.uuid,
      targetTokenUuid:target.uuid,name:"Пир страданий",input:{itemUuid:state.sourceItemUuid,side:flagellantDie(flagellantLevel(source.actor)),validAtEvent:true}};
    await runAutomationEvent(record,()=>resolveFlagellantFeast(record),{queued:canvas.scene?.id!==source.parent.id});
  }
  return true;
}
export function observeFlagellantHp(actor,changes,options={}){
  if(!enabled()||!isGmAuthority()||!actor?.uuid)return;
  const explicit=changes["system.attributes.hp.value"]??changes.system?.attributes?.hp?.value;
  if(explicit===undefined)return;const after=Number(actor.system.attributes.hp.value),before=hpCache.get(actor.uuid);hpCache.set(actor.uuid,after);
  if(before===undefined||before<=after)return;
  const key=options[MODULE_ID]?.flagellantPrice?`price:${actor.uuid}:${options[MODULE_ID].flagellantPrice}`
    :`hp:${actor.uuid}:${foundry.utils.randomID()}:${before}:${after}`;
  return recordFlagellantHpLoss(actor,before,after,{id:key});
}
async function resolveFlagellantFeast(record){const source=await fromUuid(record.sourceTokenUuid),target=await fromUuid(record.targetTokenUuid),item=await fromUuid(record.input.itemUuid),actor=source?.actor;
  if(!actor||!target?.actor||!item||!record.input.validAtEvent||canvas.scene?.id!==record.sceneId)return {status:"needs-review"};
  if(!await confirmOwner(actor,"Пир страданий","В момент этого изменения HP вы видели существо в 30 футах? Применить одну кость боли лечения за это событие?"))return false;
  const activity=[...(item.system.activities.values())].find(a=>automationData(a).flagellantOperation==="feast");if(!activity)return {status:"needs-review"};
  return applyNativeOnce(actor,{requestId:record.id,action:"flagellant-feast-heal",activityUuid:activity.uuid},async()=>true,async()=>{
    const dice=await rollFlagellantPain(actor,1,record.input.side),native=await nativeFlagellantHeal(activity,source,dice.amount);
    return native!==false&&!native?.aborted&&native!=null?true:{status:"needs-review"};
  });
}
registerAutomationEvent("flagellant-feast",resolveFlagellantFeast);
export async function releaseFlagellantRetribution(record){const source=await fromUuid(record.sourceTokenUuid),item=await fromUuid(record.input.itemUuid),actor=source?.actor;
  if(!actor||!item||canvas.scene?.id!==record.sceneId||!record.input.validAtEvent)return {status:"needs-review"};
  if(record.input.amount<=0)return true;
  if(!await confirmOwner(actor,"Воздаяние","Начался ваш следующий ход. Выплеснуть накопленную боль без действия в видимого врага в 30 футах?"))return false;
  const targets=await chooseSceneTokens(actor,source.parent,{title:"Видимый враг для Воздаяния",min:1,max:1,exclude:[source.uuid],relation:t=>inFeet(source,t,30,source.parent)});if(!targets?.length)return false;
  if(!await confirmOwner({uuid:actor.uuid,testUserPermission:user=>user.isGM},"Воздаяние (GM)","Подтверждены враждебность и видимость цели в момент выплеска?"))return false;
  return applyNativeOnce(actor,{requestId:record.id,action:"flagellant-retribution-release",activityUuid:item.uuid},async()=>true,async()=>{
    const result=await useAuraPulse({scene:source.parent,sourceToken:object(source),sourceItem:item,targets:[object(targets[0])],eventKey:`${record.id}:save`,
      event:{save:"con",dc:String(record.input.dc),damage:[{formula:String(record.input.amount),type:"necrotic"}],onSave:"none",returnSaveOutcome:true,metadata:{flagellantRetributionDisadvantage:record.input.thirst}}});
    return result?.status==="success"?true:{status:"needs-review"};
  });
}
registerAutomationEvent("flagellant-retribution",releaseFlagellantRetribution);
export function captureFlagellantTurn(combat,changes){if(!enabled()||!isGmAuthority()||!isForwardTurn(combat,changes))return [];
  const snapshot=combatTurnSnapshot(combat),source=snapshot.current.token;if(!source?.actor)return [];
  return activeStates(source.actor).filter(e=>{const state=benefitData(e);return state.kind==="flagellant-retribution"&&state.sourceTokenUuid===source.uuid&&state.combatId===snapshot.id&&state.createdTurn!==`${snapshot.id}:${snapshot.current.round}:${snapshot.current.turn}`;})
    .map(effect=>({id:`flagellant-retribution:${effect.uuid}:${snapshot.id}:${snapshot.current.round}:${snapshot.current.turn}`,kind:"flagellant-retribution",sceneId:source.parent.id,sourceActorUuid:source.actor.uuid,sourceTokenUuid:source.uuid,
      name:"Воздаяние",input:{validAtEvent:true,itemUuid:benefitData(effect).sourceItemUuid,amount:liveAccumulated.get(effect.uuid)??Number(benefitData(effect).accumulated??0),dc:flagellantDC(source.actor),thirst:flagellantPain(source.actor).thirst}}));
}
onPrepareDamage(({actor,attacker,activity,data})=>{
  if((!flagellantLevel(actor)&&!flagellantTechniques(actor).some(e=>benefitData(e).flagellantTechnique.kind==="onslaught"))||!(activity.type==="attack"||activity.item.type==="spell"))return null;
  const combat=encounterForScene(attacker.parent,attacker),snapshot=combat&&combatTurnSnapshot(combat);
  return {context:{flagellantApplication:{id:data.workflowId,turn:turnKey(combat),own:snapshot?.current.token?.uuid===attacker.uuid,name:activity.item.name}}};
});
onConfirmedDamage(async({amount,event})=>{
  if(amount<=0||!event.flagellantApplication?.own)return;const actor=await fromUuid(event.sourceActorUuid),target=await fromUuid(event.targetTokenUuid);if(!actor||!target)return;
  await serialMutation(`flagellant-applications:${actor.uuid}`,async()=>{
    const rows=actor.getFlag(MODULE_ID,"flagellantApplications")??[],saved=event.flagellantApplication;let entry=rows.find(r=>r.id===saved.id);
    if(!entry){entry={...saved,sourceUuid:event.sourceTokenUuid,used:false,targets:[]};rows.push(entry);}
    let receiver=entry.targets.find(t=>t.uuid===target.uuid);if(!receiver){receiver={uuid:target.uuid,types:[]};entry.targets.push(receiver);}
    receiver.types=[...new Set([...receiver.types,...(event.damageTypes??[event.damageType])].filter(type=>type&&!['healing','temphp','maximum','midi-none'].includes(type)))];
    await actor.setFlag(MODULE_ID,"flagellantApplications",rows.slice(-40));
  });
});
onPrepareAttack(async({actor,attacker,target,data})=>{
  const surge=flagellantTechniques(target.actor).find(e=>benefitData(e).flagellantTechnique.kind==="surge");
  if(data.opportunity&&surge&&flagellantPain(target.actor).taste)return [{kind:"prevent-attack",effectUuid:surge.uuid,name:"Порыв: это перемещение не провоцирует атаку возможности"}];
  const feature=findFeature(target.actor,"flagellant-endurance");if(!feature||!flagellantAvailable(target.actor,feature)||!canReact(target.actor))return [];
  const activity=[...(feature.system.activities.values())].find(a=>automationData(a).flagellantOperation==="endurance");
  const requestId=`flagellant-endurance:${data.workflowId}:${target.uuid}`;
  await serialMutation(`flagellant-action:${target.actor.uuid}`,async()=>{
    // Reserve optional decision per actual attack; repeated provider callbacks do not prompt again.
    const decisions=target.actor.getFlag(MODULE_ID,"flagellantReactionDecisions")??[];if(decisions.includes(requestId))return;
    await target.actor.setFlag(MODULE_ID,"flagellantReactionDecisions",[...decisions,requestId].slice(-100));
    if(!await confirmOwner(target.actor,"Стойкость","До броска этой атаки применить реакцию и принять цену двух костей боли?"))return;
    await useFlagellantTechnique(target.actor,activity,target,"endurance",requestId,{confirmed:true});
  });return [];
});
export function applyFlagellantRetributionSave(_target,workflow,details){if(!enabled()||!automationData(workflow?.activity).flagellantRetributionDisadvantage)return;
  details.disadvantage=true;details.modifierTracker?.disadvantage?.add?.(`${MODULE_ID}.flagellant-thirst`,"Воздаяние: Жажда боли");details.tracker?.disadvantage?.add?.(`${MODULE_ID}.flagellant-thirst`,"Воздаяние: Жажда боли");}
export function installFlagellantHooks(){const report=promise=>{if(promise?.catch)void promise.catch(error=>console.error(`${MODULE_ID} | Flagellant automation`,error));};
  const intercept=activity=>{if(!enabled()||automationData(activity).leaderResolved||automationData(activity).auraPulse||automationData(activity).flagellantResolved||automationAction(activity)!=="flagellant-control")return;
    if(!flagellantAvailable(activity.actor,activity.item))return false;report(controlFlagellant(activity.actor,activity));return false;};
  Hooks.on("midi-qol.preTargetingV2",({workflow})=>intercept(workflow?.activity));Hooks.on("dnd5e.preUseActivity",intercept);Hooks.on("midi-qol.preTargetSave",applyFlagellantRetributionSave);
  Hooks.on("dnd5e.restCompleted",(actor,result)=>report(flagellantRestCompleted(actor,result)));
  Hooks.on("ready",seedFlagellantTracking);Hooks.on("canvasReady",()=>{if(isGmAuthority())for(const actor of automationActors())if(actor.system?.attributes?.hp&&!hpCache.has(actor.uuid))hpCache.set(actor.uuid,Number(actor.system.attributes.hp.value));});
  Hooks.on("createActor",actor=>{if(actor.system?.attributes?.hp)hpCache.set(actor.uuid,Number(actor.system.attributes.hp.value));});
  Hooks.on("createToken",token=>{if(token.actor?.system?.attributes?.hp)hpCache.set(token.actor.uuid,Number(token.actor.system.attributes.hp.value));});
  Hooks.on("updateActor",(actor,changes,options)=>report(observeFlagellantHp(actor,changes,options)));
  Hooks.on("updateToken",(token,changes,options)=>{const value=changes["delta.system.attributes.hp.value"]??changes.delta?.system?.attributes?.hp?.value;if(value!==undefined&&token.actor)report(observeFlagellantHp(token.actor,{"system.attributes.hp.value":value},options));});
  const effectChanged=effect=>{trackFlagellantState(effect);const actor=effect.parent;if(actor?.system?.attributes?.hp)report(observeFlagellantHp(actor,{"system.attributes.hp.value":actor.system.attributes.hp.value}));};
  Hooks.on("createActiveEffect",effectChanged);Hooks.on("updateActiveEffect",effectChanged);
  Hooks.on("deleteActiveEffect",effect=>{feasts.delete(effect.uuid);liveAccumulated.delete(effect.uuid);accumulationClaims.delete(effect.uuid);if(!isGmAuthority())return;
    const actor=effect.parent,items=[...(actor?.items??[])].filter(i=>automationData(i).flagellantBorrowed===effect.uuid);
    if(actor?.system?.attributes?.hp)report(observeFlagellantHp(actor,{"system.attributes.hp.value":actor.system.attributes.hp.value}));
    if(items.length)report(actor.deleteEmbeddedDocuments("Item",items.map(i=>i.id)));
  });
  Hooks.on("updateCombat",(combat,changes)=>{const records=captureFlagellantTurn(combat,changes);for(const record of records)report(runAutomationEvent(record,()=>releaseFlagellantRetribution(record),{queued:canvas.scene?.id!==record.sceneId}));});
}
