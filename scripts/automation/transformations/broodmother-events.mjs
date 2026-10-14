import {MODULE_ID} from "../shared/constants.mjs";
import {enabled,automationData,automationAction,findFeature,notify} from "../shared/helpers.mjs";
import {broodmotherState,broodmotherHas,broodmotherAvailable,broodmotherTransformationLevel,broodmotherChange} from "./broodmother.mjs";
import {controlBroodmother,broodmotherContempt} from "./broodmother-actions.mjs";
import {prepareBroodmotherSpell,prepareBroodmotherSpellSave,prepareBroodmotherPoisonSave} from "./broodmother-combat.mjs";
import {broodmotherGm,broodmotherPulse,broodmotherCondition} from "./broodmother-use.mjs";
import {summonBroodmotherHorror} from "./broodmother-summons.mjs";
import {onConfirmedDamage} from "../shared/damage-events.mjs";
import {isGmAuthority} from "../shared/gm-requests.mjs";
import {confirmOwner} from "../shared/owner-prompts.mjs";
import {addCombatBenefit} from "../shared/combat-benefits.mjs";
import {combatTurnSnapshot,isForwardTurn,encounterForScene} from "../shared/combat-flow.mjs";
import {runAutomationEvent,registerAutomationEvent} from "../shared/event-ledger.mjs";
import {isEffectActive,automationActors} from "../effects/temporary-effects.mjs";
import {protectiveZoneContains} from "../classes/ritualist-zones.mjs";

export async function revealBroodmother(actor){if(!enabled()||!isGmAuthority()||!broodmotherHas(actor,"appearance")||broodmotherState(actor).appearance==="true")return;
  if(actor.statuses?.has?.("unconscious")||actor.concentration?.effects?.size)await actor.setFlag(MODULE_ID,"broodmotherState",{...structuredClone(broodmotherState(actor)),appearance:"true"});}
export async function enhanceBroodmotherPoison(effect){
  if(!enabled()||!isGmAuthority()||!effect?.statuses?.has?.("poisoned")||effect.statuses.has("paralyzed")||!isEffectActive(effect))return;
  const item=effect.origin&&await fromUuid(effect.origin);if(!broodmotherHas(item?.actor,"toxicologist"))return;
  await effect.update({statuses:[...effect.statuses,"paralyzed"],[`flags.${MODULE_ID}.broodmotherToxicologistSource`]:item.actor.uuid});
}
export async function observeBroodmotherMimic(actor){
  if(!enabled()||!isGmAuthority()||!actor?.getFlag?.(MODULE_ID,"broodmotherMimicOwner")||Number(actor.system?.attributes?.hp?.value)>0)return;
  const owner=await fromUuid(actor.getFlag(MODULE_ID,"broodmotherMimicOwner"));if(!owner||broodmotherState(owner).mimicActorUuid!==actor.uuid||!broodmotherState(owner).mimicControl)return;
  await owner.setFlag(MODULE_ID,"broodmotherState",{...structuredClone(broodmotherState(owner)),mimicControl:false});
  for(const e of [...(owner.effects??[])])if(e.getFlag?.(MODULE_ID,"broodmotherMimicBody"))await e.delete();
}
export async function rechargeBroodmotherWeb(actor){const item=findFeature(actor,"broodmother-web");if(!broodmotherHas(actor,"web")||!item||Number(item.system.uses.spent)<=0)return true;
  const roll=await new Roll("1d6").evaluate();await roll.toMessage({speaker:ChatMessage.getSpeaker({actor}),flavor:"Выброс паутины: перезарядка на 6"});if(Number(roll.total)===6)await item.update({"system.uses.spent":0});return true;}
export async function runBroodmotherRecord(record){
  const token=await fromUuid(record.sourceTokenUuid),actor=token?.actor;if(!actor||token.parent.id!==record.sceneId)throw Error("Источник события Королевы Улья недоступен.");
  if(record.operation==="recharge")return rechargeBroodmotherWeb(actor);
  const item=await fromUuid(record.sourceItemUuid),target=await fromUuid(record.targetTokenUuid);if(!item||!target?.actor||target.parent.id!==record.sceneId)throw Error("Цель/карточка больше недоступна; проверьте событие вручную.");
  if(record.effectUuid){const e=await fromUuid(record.effectUuid);if(!e||!isEffectActive(e))return false;}
  if(record.zoneUuid){const z=await fromUuid(record.zoneUuid);if(!z?.getFlag?.(MODULE_ID,"broodmotherPool"))return false;}
  return broodmotherPulse(token,item,[target],{damage:[{formula:record.damage,type:"acid"}],requestId:record.id});
}
registerAutomationEvent("broodmother-periodic",runBroodmotherRecord);
export async function handleBroodmotherTurn(combat,changes){if(!enabled()||!isGmAuthority()||!isForwardTurn(combat,changes))return;
  const snapshot=combatTurnSnapshot(combat),target=snapshot.current.token;if(!target?.actor)return;
  const moment=`${snapshot.id}:${snapshot.current.round}:${snapshot.current.turn}`,records=[];
  if(broodmotherHas(target.actor,"web")&&Number(findFeature(target.actor,"broodmother-web")?.system.uses.spent)>0)records.push({id:`broodmother-recharge:${moment}:${target.uuid}`,kind:"broodmother-periodic",sceneId:target.parent.id,sourceTokenUuid:target.uuid,sourceActorUuid:target.actor.uuid,name:"Выброс паутины: перезарядка",operation:"recharge"});
  for(const effect of target.actor.effects??[]){const state=effect.getFlag?.(MODULE_ID,"broodmotherCondition");if(state?.kind!=="acid"||!isEffectActive(effect))continue;
    records.push({id:`broodmother-acid:${effect.uuid}:${moment}`,kind:"broodmother-periodic",name:"Кислота на существе",sceneId:target.parent.id,sourceActorUuid:state.sourceActorUuid,sourceTokenUuid:state.sourceTokenUuid,sourceItemUuid:state.sourceItemUuid,targetTokenUuid:target.uuid,effectUuid:effect.uuid,damage:state.damage});}
  for(const record of records)await runAutomationEvent(record,()=>runBroodmotherRecord(record),{queued:!canvas.ready||canvas.scene?.id!==record.sceneId});
}
export function captureBroodmotherMovement(token,changes,options={}){if(!enabled()||!token.actor||!(Object.hasOwn(changes,"x")||Object.hasOwn(changes,"y")||Object.hasOwn(changes,"elevation")))return;
  options[MODULE_ID]??={};options[MODULE_ID].broodmotherMovement={id:foundry.utils.randomID(),uuid:token.uuid,previous:{x:token.x,y:token.y,elevation:token.elevation,width:token.width,height:token.height},next:{x:changes.x??token.x,y:changes.y??token.y,elevation:changes.elevation??token.elevation}};
}
export async function applyBroodmotherMovement(token,_changes,options){if(!enabled()||!isGmAuthority())return;const move=options?.[MODULE_ID]?.broodmotherMovement;if(!move||move.uuid!==token.uuid||token.x!==move.next.x||token.y!==move.next.y||token.elevation!==move.next.elevation)return;
  const scene=token.parent,before={...move.previous,id:token.id,uuid:token.uuid};
  for(const zone of scene.regions??[]){const state=zone.getFlag?.(MODULE_ID,"broodmotherPool");if(!state||protectiveZoneContains(zone,before,scene)||!protectiveZoneContains(zone,token,scene))continue;
    const record={id:`broodmother-pool:${zone.uuid}:${move.id}:${token.uuid}`,kind:"broodmother-periodic",name:"Вход в кислотную лужу",sceneId:scene.id,sourceTokenUuid:state.sourceTokenUuid,sourceItemUuid:state.sourceItemUuid,targetTokenUuid:token.uuid,zoneUuid:zone.uuid,damage:"1d6"};
    await runAutomationEvent(record,()=>runBroodmotherRecord(record),{queued:!canvas.ready||canvas.scene?.id!==scene.id});}
}
onConfirmedDamage(async({actor,amount,event})=>{
  if(!enabled()||!isGmAuthority()||amount<=0)return;
  const target=await fromUuid(event.targetTokenUuid);if(!target?.actor)return;
  if(broodmotherHas(actor,"pyrophobia")&&(event.damageTypes??[event.damageType]).includes("fire")){
    await actor.setFlag(MODULE_ID,"broodmotherState",{...structuredClone(broodmotherState(actor)),appearance:"true"});
    const combat=encounterForScene(target.parent,target),item=findFeature(actor,"broodmother-pyrophobia");
    await addCombatBenefit(target,target,item,{kind:"attack-disadvantage",expiry:combat?.started?"sourceEnd":null,changes:["str","dex","con","int","wis","cha"].map(k=>broodmotherChange(`system.abilities.${k}.save.roll.mode`,-1,"override"))});
  }
  if(broodmotherHas(actor,"blood")){
    const activity=await fromUuid(event.activityUuid),attacker=await fromUuid(event.sourceTokenUuid);
    if(activity?.type==="attack"&&activity.attack?.type?.value==="melee"&&attacker?.actor&&attacker.parent.id===target.parent.id){
      const item=findFeature(actor,"broodmother-blood"),result=await broodmotherPulse(target,item,[attacker],{save:"con",poison:true,damage:[{formula:String(broodmotherTransformationLevel(actor)),type:"poison"}],onSave:"full",requestId:`broodmother-blood:${event.key}`});
      if(result.status==="success"&&result.failedSaves.includes(attacker.uuid))await broodmotherCondition(target,attacker,item,{kind:"blood-poison",statuses:["poisoned"]});
    }
  }
  if(Number(event.beforeHp)>0&&Number(actor.system.attributes.hp.value)<=0){
    if(broodmotherHas(actor,"horror")&&Number(broodmotherState(actor).horrorReadyAt??0)<=Number(game.time.worldTime)){const item=findFeature(actor,"broodmother-horror"),activity=[...item.system.activities.values()][0];
      if(await confirmOwner(actor,"Потомство ужаса","Хиты только что снизились до 0. Призвать БМ роёв и определить восстановление через 1к4 игровых дня?"))await summonBroodmotherHorror(actor,activity,target,`broodmother-horror:${event.key}`);}
    const ownerUuid=actor.getFlag?.(MODULE_ID,"summonedBy"),family=actor.getFlag?.(MODULE_ID,"summonSource");
    if(ownerUuid&&["broodmother-brood","broodmother-horror"].includes(family)&&event.sourceActorUuid!==ownerUuid){const owner=await fromUuid(ownerUuid);
      const source=[...(target.parent.tokens??[])].find(t=>t.actor?.uuid===ownerUuid);if(owner&&source&&broodmotherHas(owner,"contempt")){const item=findFeature(owner,"broodmother-contempt");await broodmotherContempt(owner,[...item.system.activities.values()][0],source,`broodmother-death:${event.key}`,{killerUuid:event.sourceTokenUuid});}}
    for(const a of automationActors())for(const e of [...(a.effects??[])])if(e.getFlag?.(MODULE_ID,"broodmotherCondition")?.kind==="rage"&&e.getFlag(MODULE_ID,"broodmotherCondition").killerUuid===target.uuid)await e.delete();
  }
});
export function installBroodmotherHooks(){const report=p=>{if(p?.catch)void p.catch(e=>console.error(`${MODULE_ID} | Broodmother automation`,e));};
  const intercept=activity=>{if(!enabled()||!activity)return;const flags=automationData(activity),op=flags.broodmotherOperation;
    if(flags.leaderResolved||flags.auraPulse||flags.broodmotherResolved)return;
    if(broodmotherState(activity.actor).mimicControl&&!["mimic-end","mimic-explode"].includes(op)){notify("Сейчас контролируется мимик: исходное тело не действует. Завершите управление через Мимикрию.","warn");return false;}
    if(activity.actor?.getFlag?.(MODULE_ID,"broodmotherMimicOwner")&&["brood","mimic"].includes(op)){notify("Мимик не использует Выводок потомства и Мимикрию.","warn");return false;}
    if(automationAction(activity)!=="broodmother-control")return;
    if(!broodmotherAvailable(activity.actor,activity.item)){notify("Не открыт уровень Королевы Улья или не получен обязательный бонус.","warn");return false;}
    report(controlBroodmother(activity.actor,activity));return false;
  };
  Hooks.on("dnd5e.preUseActivity",intercept);Hooks.on("midi-qol.preTargetingV2",({workflow})=>intercept(workflow?.activity));
  Hooks.on("midi-qol.prePreambleComplete",prepareBroodmotherSpell);Hooks.on("midi-qol.preTargetSave",prepareBroodmotherSpellSave);Hooks.on("midi-qol.preTargetSave",prepareBroodmotherPoisonSave);
  Hooks.on("updateCombat",(combat,changes)=>report(handleBroodmotherTurn(combat,changes)));
  Hooks.on("preUpdateToken",captureBroodmotherMovement);Hooks.on("updateToken",(token,changes,options)=>{report(applyBroodmotherMovement(token,changes,options));if(token.actor)report(revealBroodmother(token.actor));});
  Hooks.on("updateActor",actor=>{report(revealBroodmother(actor));report(observeBroodmotherMimic(actor));});
  for(const hook of ["createActiveEffect","updateActiveEffect","deleteActiveEffect"])Hooks.on(hook,e=>{if(e.parent?.documentName==="Actor")report(revealBroodmother(e.parent));if(hook!=="deleteActiveEffect")report(enhanceBroodmotherPoison(e));});
}
