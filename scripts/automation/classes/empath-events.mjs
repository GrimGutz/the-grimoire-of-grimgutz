import {MODULE_ID} from "../shared/constants.mjs";
import {enabled,automationData,automationAction,notify} from "../shared/helpers.mjs";
import {empathEffects,empathEffectData,empathMask} from "../shared/empath-state.mjs";
import {empathAvailable} from "../shared/empath-state.mjs";
import {controlEmpath,empathGm} from "./empath-actions.mjs";
import {empathPulse} from "./empath-effects.mjs";
import {onConfirmedDamage} from "../shared/damage-events.mjs";
import {onPrepareAttack,inFeet,turnKey} from "../shared/combat-benefits.mjs";
import {encounterForScene,combatTurnSnapshot,isForwardTurn} from "../shared/combat-flow.mjs";
import {isGmAuthority} from "../shared/gm-requests.mjs";
import {askOwner,confirmOwner} from "../shared/owner-prompts.mjs";
import {runAutomationEvent,registerAutomationEvent} from "../shared/event-ledger.mjs";
import {automationActors} from "../effects/temporary-effects.mjs";
import {serialMutation} from "../shared/transactions.mjs";
export function blockEmpathActivity(activity){if(!enabled()||!activity?.actor||automationData(activity).auraPulse)return;
  const data=automationData(activity),operation=data.empathOperation,kind=operation==="impulse"?"bonus":operation==="empathy"?"reaction":operation==="outside-mask"||["voice","wave-free","wave-slot","catharsis"].includes(operation)?"action":activity.activation?.type??"",reaction=kind.startsWith("reaction"),effects=empathEffects(activity.actor),mask=empathMask(activity.actor).id;
  if(reaction&&effects.some(effect=>{const d=empathEffectData(effect);return d.feature==="impulse"&&d.mask==="calm"||d.feature==="wave"&&d.mask==="sorrow";}))return false;
  if(effects.some(effect=>{const d=empathEffectData(effect);return d.feature==="wave"&&d.mask==="calm";})&&(activity.type==="attack"||activity.type==="save"||activity.type==="damage"||activity.damage?.parts?.length||activity.healing?.type==="damage"
    ||["wave-free","wave-slot"].includes(operation)||operation==="impulse"&&mask!=="joy"||["voice","catharsis"].includes(operation)&&["anger","sorrow"].includes(mask)))return false;
  const lost=activity.actor.getFlag?.(MODULE_ID,"empathLostActions");if(lost&&["action","bonus"].includes(kind)&&lost.turn===turnKey(encounterForScene(game.scenes?.get?.(lost.sceneId))))return false;
}
export function applyEmpathHealingBan(actor,_amount,updates){if(!enabled()||!empathEffects(actor).some(effect=>{const d=empathEffectData(effect);return d.feature==="catharsis"&&d.mask==="sorrow";}))return;
  const key="system.attributes.hp.value";if(Number(updates[key])>Number(actor.system.attributes.hp.value))updates[key]=Number(actor.system.attributes.hp.value);}
export function applyEmpathSave(_target,workflow,details){if(!enabled()||!automationData(workflow?.activity).empathSaveAdvantage||details.empathAdvantageApplied)return;
  details.empathAdvantageApplied=true;details.advantage=true;details.modifierTracker?.advantage?.add?.(`${MODULE_ID}.empath-wave-damage`,"Волна чувств: урон прерывает смех");}
export async function resolveEmpathEvent(record){if(!enabled()||!isGmAuthority())return false;const effect=await fromUuid(record.effectUuid),data=empathEffectData(effect);
  if(!effect||data.nonce!==record.input.nonce||!empathEffects(effect.parent).includes(effect))return true;
  const source=await fromUuid(data.sourceTokenUuid),target=await fromUuid(data.targetTokenUuid),item=await fromUuid(data.sourceItemUuid);
  if(!source?.actor||!target?.actor||!item)return {status:"needs-review"};
  if(record.operation==="wave-damage"){
    if(data.mask==="calm"){await effect.delete();return true;}
    return empathPulse(source,item,[target],data,{save:"wis",eventKey:record.id,advantage:true,removeEffectOnSaveUuid:effect.uuid});
  }
  if(record.operation==="despair"){
    const choice=await askOwner(target.actor,{title:"Тяжесть отчаяния: начало хода",choices:[["damage","Получить 4к8 психического урона"],["actions","Не совершать действий и бонусных действий до конца хода"]]});
    if(choice==="damage")return empathPulse(source,item,[target],data,{damage:[{formula:"4d8",type:"psychic"}],eventKey:record.id});
    if(choice==="actions"){await target.actor.setFlag(MODULE_ID,"empathLostActions",{turn:record.input.turn,sceneId:record.sceneId,targetTokenUuid:target.uuid});return true;}return {status:"needs-review"};
  }
  if(record.operation==="retaliation")return serialMutation(`empath-retaliation:${effect.uuid}`,async()=>{
    const attacker=await fromUuid(record.input.attackerUuid),claims=effect.getFlag(MODULE_ID,"empathRetaliationClaims")??[];
    if(!record.input.turn||claims.includes(record.input.turn)||!attacker?.actor||attacker.parent.id!==target.parent.id||!inFeet(target,attacker,5,target.parent))return true;
    if(!await confirmOwner(empathGm(source.actor),"Сопричастность: Гнев", "Подтверждён урон именно атакой ближнего боя от существа в 5 футах получателя? Провести 2к6 силовым полем один раз за этот ход?"))return true;
    await effect.setFlag(MODULE_ID,"empathRetaliationClaims",[...claims,record.input.turn].slice(-100));
    return empathPulse(source,item,[attacker],data,{damage:[{formula:"2d6",type:"force"}],eventKey:record.id});
  });return false;
}
registerAutomationEvent("empath-event",resolveEmpathEvent);
export function empathTurnRecords(combat,changes){if(!enabled()||!isGmAuthority()||!isForwardTurn(combat,changes))return [];const snapshot=combatTurnSnapshot(combat),token=snapshot.current.token;if(!token?.actor)return [];
  return empathEffects(token.actor).filter(effect=>{const d=empathEffectData(effect);return d.feature==="catharsis"&&d.mask==="sorrow"&&d.targetTokenUuid===token.uuid;}).map(effect=>({
    id:`empath-despair:${effect.uuid}:${snapshot.id}:${snapshot.current.round}:${snapshot.current.turn}`,kind:"empath-event",name:"Тяжесть отчаяния: выбор в начале хода",operation:"despair",
    sceneId:token.parent.id,sourceActorUuid:empathEffectData(effect).sourceActorUuid,sourceTokenUuid:empathEffectData(effect).sourceTokenUuid,targetTokenUuid:token.uuid,effectUuid:effect.uuid,input:{nonce:empathEffectData(effect).nonce,turn:`${snapshot.id}:${snapshot.current.round}:${snapshot.current.turn}`}}));}
export async function observeEmpathDamage({actor,amount,event}){if(!enabled()||!isGmAuthority()||amount<=0)return;
  const scene=game.scenes?.get?.(event.sceneId??event.targetTokenUuid?.split(".")[1]),turn=turnKey(encounterForScene(scene));
  const target=await fromUuid(event.targetTokenUuid),attacker=await fromUuid(event.sourceTokenUuid),activity=await fromUuid(event.activityUuid);if(!target?.actor||target.actor.uuid!==actor.uuid)return;
  const records=[];
  // Capture the turn before any owner prompts or queued async work.
  const effects=empathEffects(actor);
  for(const effect of effects){const data=empathEffectData(effect);if(data.targetTokenUuid!==target.uuid)continue;
    let operation=null;if(data.feature==="wave"&&["calm","joy"].includes(data.mask))operation="wave-damage";
    if(data.feature==="empathy"&&data.mask==="anger"&&activity?.type==="attack"&&activity.attack?.type?.value==="melee"&&!event.automatic&&attacker&&inFeet(target,attacker,5,target.parent))operation="retaliation";
    if(operation)records.push({id:`empath-damage:${event.key}:${effect.uuid}`,kind:"empath-event",name:effect.name,sceneId:target.parent.id,sourceActorUuid:data.sourceActorUuid,sourceTokenUuid:data.sourceTokenUuid,targetTokenUuid:target.uuid,effectUuid:effect.uuid,operation,input:{nonce:data.nonce,turn,attackerUuid:attacker?.uuid}});
  }
  for(const record of records)await runAutomationEvent(record,()=>resolveEmpathEvent(record),{queued:canvas.scene?.id!==record.sceneId});
}
onConfirmedDamage(observeEmpathDamage);
onPrepareAttack(async({actor})=>empathEffects(actor).filter(effect=>{const d=empathEffectData(effect);return d.feature==="wave"&&d.mask==="sorrow";}).map(effect=>({kind:"attack-disadvantage",effectUuid:effect.uuid,name:"Волна чувств: Печаль"})));
export async function removeEmpathConcentration(effect){if(!enabled()||!isGmAuthority())return;for(const actor of automationActors())for(const own of empathEffects(actor))if(empathEffectData(own).concentrationUuid===effect.uuid)await own.delete();}
export function installEmpathHooks(){const report=promise=>{if(promise?.catch)void promise.catch(error=>console.error(`${MODULE_ID} | Empath automation`,error));};
  const intercept=activity=>{if(blockEmpathActivity(activity)===false){notify("Активный эффект Эмпата запрещает это действие.","warn");return false;}
    if(!enabled()||automationData(activity).leaderResolved||automationData(activity).auraPulse||automationData(activity).empathResolved||automationAction(activity)!=="empath-control")return;
    if(!empathAvailable(activity.actor,activity.item))return false;report(controlEmpath(activity.actor,activity));return false;};
  Hooks.on("midi-qol.preTargetingV2",({workflow})=>intercept(workflow?.activity));Hooks.on("dnd5e.preUseActivity",intercept);Hooks.on("midi-qol.preTargetSave",applyEmpathSave);
  Hooks.on("dnd5e.preApplyDamage",applyEmpathHealingBan);Hooks.on("dnd5e.preRestCompleted",(actor,result)=>applyEmpathHealingBan(actor,0,result.updateData??{}));
  Hooks.on("deleteActiveEffect",effect=>report(removeEmpathConcentration(effect)));
  Hooks.on("updateCombat",(combat,changes)=>{const records=empathTurnRecords(combat,changes);for(const record of records)report(runAutomationEvent(record,()=>resolveEmpathEvent(record),{queued:canvas.scene?.id!==record.sceneId}));});
}
