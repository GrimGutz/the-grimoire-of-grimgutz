import {MODULE_ID} from "../shared/constants.mjs";
import {enabled,automationData,automationAction,findFeature,notify,reportFailure} from "../shared/helpers.mjs";
import {dkHas,dkState,dkPatch,dkTransformationLevel,dkAvailable,dkAnchor} from "./deathknight.mjs";
import {controlDeathknight} from "./deathknight-actions.mjs";
import {dkLevelEffects,dkLevelData,addDeathLevels,healDeathLevels,tickDeathLevels,dkCreatureType} from "./deathknight-levels.mjs";
import {dkGm,dkPulse} from "./deathknight-use.mjs";
import {onConfirmedDamage,onPrepareDamage} from "../shared/damage-events.mjs";
import {askOwner,confirmOwner} from "../shared/owner-prompts.mjs";
import {isGmAuthority} from "../shared/gm-requests.mjs";
import {applyNativeOnce} from "../shared/native-applications.mjs";
import {combatTurnSnapshot,isForwardTurn} from "../shared/combat-flow.mjs";
import {runAutomationEvent,registerAutomationEvent} from "../shared/event-ledger.mjs";
import {protectiveZoneContains} from "../classes/ritualist-zones.mjs";
import {inFeet} from "../shared/combat-benefits.mjs";
import {prepareDeathknightDamageRoll,prepareDeathknightReach,offerDeathknightCritical,prepareDeathknightSave,prepareDeathknightAttack} from "./deathknight-combat.mjs";
import {prepareDeathknightSpell} from "./deathknight-spells.mjs";
export function deathknightRegeneration(actor){const hp=actor?.system?.attributes?.hp;return dkHas(actor,"quick")&&Number(hp?.value)>0&&Number(hp.value)<=Number(hp.effectiveMax??hp.max)/2?Math.min(10,Number(hp.effectiveMax??hp.max)-Number(hp.value)):0;}
export async function runDeathknightRecord(record){
  if(record.operation==="healing"){
    const actor=await fromUuid(record.actorUuid);if(!actor)return false;await healDeathLevels(actor);
    if(record.wasZero&&dkHas(actor,"form")&&Number(actor.system.attributes.hp.value)>0){if(!actor.statuses?.has?.("unconscious"))await actor.createEmbeddedDocuments("ActiveEffect",[{name:"Форма нежити: 1 HP, без сознания (GM)",img:findFeature(actor,"deathknight-form")?.img,type:"base",transfer:false,disabled:false,statuses:["unconscious"],start:null,duration:{value:null,units:"seconds",expiry:null,expired:false},flags:{[MODULE_ID]:{deathknightRecovery:true}},system:{changes:[]}}]);}return true;
  }
  if(record.operation==="levels")return tickDeathLevels(record);
  const source=await fromUuid(record.sourceTokenUuid),actor=source?.actor;if(!actor||source.parent.id!==record.sceneId)throw Error("Источник события трансформации Рыцаря Смерти недоступен.");
  if(record.operation==="regeneration"){const amount=Math.min(Number(record.amount),deathknightRegeneration(actor));if(amount>0)await actor.update({"system.attributes.hp.value":Number(actor.system.attributes.hp.value)+amount});return true;}
  const item=await fromUuid(record.sourceItemUuid);if(!item)return {status:"needs-review"};
  if(record.operation==="smog"){const zone=await fromUuid(record.zoneUuid),target=await fromUuid(record.targetTokenUuid);if(!zone||!target?.actor)return false;const result=await dkPulse(source,item,[target],{save:"con",dc:record.dc,requestId:record.id});if(result.status!=="success")return {status:"needs-review"};if(result.failedSaves.includes(target.uuid))return addDeathLevels(source,target,findFeature(actor,"deathknight-grave"),1);return true;}
  if(record.operation==="backlash"){
    let type;if(record.primary){type=await askOwner(dkGm(actor),{title:"GM: тип дополнительного урона Существования Смерти (в PDF не указан)",choices:Object.entries(CONFIG.DND5E.damageTypes??{}).map(([id,c])=>[id,game.i18n?.localize(c.label??id)??id])});if(!Object.hasOwn(CONFIG.DND5E.damageTypes??{},type))return false;}
    const damage=[...(record.primary?[{formula:record.dice,type}]:[]),...(record.holySilver?[{formula:"1d8",type:"radiant"}]:[])];return dkPulse(source,item,[source],{damage,requestId:record.id,metadata:{deathknightBacklash:true}});
  }return false;
}
registerAutomationEvent("deathknight-periodic",runDeathknightRecord);
export async function handleDeathknightTurn(combat,changes){if(!enabled()||!isGmAuthority()||!isForwardTurn(combat,changes))return;const snapshot=combatTurnSnapshot(combat),current=snapshot.current.token,previous=snapshot.previous.token,moment=`${snapshot.id}:${snapshot.current.round}:${snapshot.current.turn}`,records=[];
  if(current?.actor){const amount=deathknightRegeneration(current.actor);if(amount)records.push({id:`deathknight-heal:${moment}:${current.uuid}`,kind:"deathknight-periodic",operation:"regeneration",name:"Быстрое исцеление",sourceActorUuid:current.actor.uuid,sourceTokenUuid:current.uuid,sceneId:current.parent.id,amount});
    for(const zone of [...(current.parent.regions??[]),...(current.parent.templates??[])]){const state=zone.getFlag?.(MODULE_ID,"deathknightSmog");if(!state||!protectiveZoneContains(zone,current,current.parent))continue;const until=zone.getFlag?.(MODULE_ID,"zoneExpiresAt");if(until!=null&&Number(until)<=Number(game.time.worldTime))continue;
      records.push({id:`deathknight-smog:${zone.uuid}:${moment}:${current.uuid}`,kind:"deathknight-periodic",operation:"smog",name:"Смертельный смог",sceneId:current.parent.id,sourceActorUuid:state.sourceActorUuid,sourceTokenUuid:state.sourceTokenUuid,sourceItemUuid:state.sourceItemUuid,targetTokenUuid:current.uuid,zoneUuid:zone.uuid,dc:state.dc});}
  }
  if(previous?.actor)for(const effect of dkLevelEffects(previous.actor))records.push({id:`deathknight-levels:${effect.uuid}:${moment}`,kind:"deathknight-periodic",operation:"levels",name:"Уровни Смерти: конец хода",sceneId:previous.parent.id,effectUuid:effect.uuid,sourceTokenUuid:dkLevelData(effect).sourceTokenUuid,sourceActorUuid:dkLevelData(effect).sourceActorUuid,targetTokenUuid:previous.uuid});
  for(const record of records)await runAutomationEvent(record,()=>runDeathknightRecord(record),{queued:!canvas.ready||canvas.scene?.id!==record.sceneId});
}
export function captureDeathknightHealing(actor,changes,options={}){if(!enabled())return;
  const exhaustion=changes["system.attributes.exhaustion"]??changes.system?.attributes?.exhaustion,minimum=Number(dkState(actor).lockedExhaustion??0);if(exhaustion!==undefined&&Number(exhaustion)<minimum)changes["system.attributes.exhaustion"]=minimum;
  const value=changes["system.attributes.hp.value"]??changes.system?.attributes?.hp?.value,before=Number(actor.system?.attributes?.hp?.value);if(value===undefined||Number(value)<=before||options[MODULE_ID]?.skipDeathknightHealing||(!dkLevelEffects(actor).length&&!dkHas(actor,"form")))return;
  options[MODULE_ID]??={};options[MODULE_ID].deathknightHealing={id:foundry.utils.randomID(),actorUuid:actor.uuid,next:Number(value),wasZero:before===0};
}
export async function observeDeathknightHealing(actor,_changes,options){if(!enabled()||!isGmAuthority())return;const state=options?.[MODULE_ID]?.deathknightHealing;if(!state||state.actorUuid!==actor.uuid||Number(actor.system.attributes.hp.value)!==state.next)return;
  const record={id:`deathknight-healing:${state.id}`,kind:"deathknight-periodic",operation:"healing",name:"Лечение: УС и Форма нежити",actorUuid:actor.uuid,wasZero:state.wasZero};return applyNativeOnce(actor,{requestId:record.id,action:"deathknight-healing",activityUuid:null},async()=>true,()=>runDeathknightRecord(record));
}
export async function revealDeathknight(actor){if(enabled()&&isGmAuthority()&&dkHas(actor,"appearance")&&dkState(actor).appearance!=="true"&&(actor.statuses?.has?.("unconscious")||actor.concentration?.effects?.size))await dkPatch(actor,{appearance:"true"});}
onConfirmedDamage(async({actor,amount,event})=>{
  if(!enabled()||!isGmAuthority()||amount<=0)return;const activity=event.activityUuid&&await fromUuid(event.activityUuid);if(automationData(activity).deathknightBacklash||activity?.item?.system?.identifier==="deathknight-existence")return;
  const source=await fromUuid(event.sourceTokenUuid),target=await fromUuid(event.targetTokenUuid);
  if(source?.actor&&target?.actor&&dkHas(source.actor,"grave")&&activity?.type==="attack"&&activity.item?.type==="weapon"&&activity.item.id===dkAnchor(source.actor)?.id)await applyNativeOnce(source.actor,{requestId:`deathknight-hit:${event.workflowId??event.key}:${target.uuid}`,action:"deathknight-grave-hit",activityUuid:activity.uuid},async()=>true,()=>addDeathLevels(source,target,findFeature(source.actor,"deathknight-grave"),1));
  if(source?.actor&&target?.actor&&dkState(source.actor).annihilationWorkflow===event.workflowId&&Number(actor.system.attributes.hp.value)<=40){
    await applyNativeOnce(source.actor,{requestId:`deathknight-execute:${event.workflowId}:${target.uuid}`,action:"deathknight-execute",activityUuid:activity.uuid},()=>confirmOwner(dkGm(source.actor),"Искореняющий удар: порог 40","Подтверждён итоговый урон этого усиленного попадания: HP цели снизились до 40 или меньше? Применить мгновенную смерть (не удаляя актёра)?"),async()=>{
      await actor.update({"system.attributes.hp.value":0});if(!actor.statuses?.has?.("dead"))await actor.createEmbeddedDocuments("ActiveEffect",[{name:"Искореняющий удар: смерть",type:"base",transfer:false,disabled:false,statuses:["dead"],system:{changes:[]}}]);await dkPatch(source.actor,{annihilatedTarget:target.uuid});
      return true;
    });
  }
  if(!dkHas(actor,"existence")||!target?.actor)return;const attacker=event.sourceActorUuid&&await fromUuid(event.sourceActorUuid),outcast=dkHas(actor,"outcast"),item=activity?.item;
  const primary=dkCreatureType(attacker)==="celestial"||(event.damageTypes??[event.damageType]).includes("radiant")||item?.getFlag?.(MODULE_ID,"deathknightBlessed"),holySilver=outcast&&(attacker?.getFlag?.(MODULE_ID,"deathknightHolyAgent")||item?.getFlag?.(MODULE_ID,"deathknightSilver")||item?.system?.properties?.has?.("sil"));if(!primary&&!holySilver)return;
  const record={id:`deathknight-backlash:${event.key}`,kind:"deathknight-periodic",operation:"backlash",name:"Существование Смерти / Отверженный",sceneId:target.parent.id,sourceTokenUuid:target.uuid,sourceActorUuid:actor.uuid,sourceItemUuid:findFeature(actor,"deathknight-existence").uuid,primary:Boolean(primary),holySilver:Boolean(holySilver),dice:`${dkTransformationLevel(actor)}d${outcast?8:6}`};
  await runAutomationEvent(record,()=>runDeathknightRecord(record),{queued:!canvas.ready||canvas.scene?.id!==record.sceneId});
});
onPrepareDamage(async({actor,attacker,target,activity,data})=>{
  if(!enabled()||activity.type!=="attack"||(actor.getFlag?.(MODULE_ID,"deathknightSpecialization")??actor.getFlag?.(MODULE_ID,"summonTemplate")?.snapshot?.specialization)!=="assassin")return null;
  const ally=[...(attacker.parent.tokens??[])].some(t=>t.actor&&t.uuid!==attacker.uuid&&t.disposition!==0&&t.disposition===attacker.disposition&&inFeet(t,target,5,attacker.parent));
  if(!ally&&!await confirmOwner(dkGm(actor),"Убийца: преимущество","Именно эта атака имеет преимущество? Без преимущества и союзника в 5 футах дополнительные 2к6 не применяются."))return null;
  const roll=await new Roll(`${data.critical?4:2}d6`).evaluate();await roll.toMessage({speaker:ChatMessage.getSpeaker({actor}),flavor:"Скелет-Убийца"});return {bonuses:[{value:Number(roll.total),name:"Убийца: условный дополнительный урон"}]};
});
export function installDeathknightHooks(){const report = reportFailure("Death knight transformation");const intercept=activity=>{
  if(!enabled()||!activity)return;const flags=automationData(activity);if(flags.deathknightResolved||flags.leaderResolved||flags.auraPulse)return;if(automationAction(activity)!=="deathknight-control")return;
  if(!dkAvailable(activity.actor,activity.item)){notify("Трансформация Рыцарь Смерти: не открыта ступень, подавлена особенность или отсутствует Якорь.","warn");return false;}report(controlDeathknight(activity.actor,activity));return false;
  };
  Hooks.on("dnd5e.preUseActivity",a=>{const result=intercept(a);if(result===false)return false;prepareDeathknightReach(a);});Hooks.on("midi-qol.preTargetingV2",({workflow})=>intercept(workflow?.activity));
  Hooks.on("dnd5e.preRollDamage",prepareDeathknightDamageRoll);Hooks.on("midi-qol.preDamageRoll",offerDeathknightCritical);Hooks.on("midi-qol.prePreambleComplete",prepareDeathknightSpell);Hooks.on("midi-qol.preTargetSave",prepareDeathknightSave);Hooks.on("midi-qol.preAttackRollConfig",prepareDeathknightAttack);
  Hooks.on("updateCombat",(combat,changes)=>report(handleDeathknightTurn(combat,changes)));Hooks.on("preUpdateActor",captureDeathknightHealing);Hooks.on("updateActor",(actor,changes,options)=>{report(observeDeathknightHealing(actor,changes,options));report(revealDeathknight(actor));});
  for(const hook of ["createActiveEffect","updateActiveEffect","deleteActiveEffect"])Hooks.on(hook,e=>{if(e.parent?.documentName==="Actor")report(revealDeathknight(e.parent));});
}
