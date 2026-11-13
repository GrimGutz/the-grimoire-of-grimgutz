import {MODULE_ID} from "../shared/constants.mjs";
import {enabled,automationData,automationAction,notify,reportFailure} from "../shared/helpers.mjs";
import {chimeraAvailable,chimeraHas,chimeraItem,chimeraState,chimeraMutation,chimeraPassiveActive,chimeraAdaptation,chimeraKnowledge} from "./chimera.mjs";
import {controlChimera} from "./chimera-actions.mjs";
import {saveChimeraState,rollChimeraMutation,chimeraGm} from "./chimera-choices.mjs";
import {chimeraPulse,chimeraCondition} from "./chimera-use.mjs";
import {expireChimeraShares} from "./chimera-sharing.mjs";
import {onConfirmedDamage} from "../shared/damage-events.mjs";
import {registerGmRequest,requestGm,isGmAuthority} from "../shared/gm-requests.mjs";
import {applyNativeOnce} from "../shared/native-applications.mjs";
import {serialMutation} from "../shared/transactions.mjs";
import {combatTurnSnapshot,isForwardTurn} from "../shared/combat-flow.mjs";
import {runAutomationEvent,registerAutomationEvent} from "../shared/event-ledger.mjs";
import {isEffectActive,automationActors} from "../effects/temporary-effects.mjs";
import {inFeet} from "../shared/combat-benefits.mjs";
import {confirmOwner} from "../shared/owner-prompts.mjs";
import {prepareChimeraSpellTargets,prepareChimeraBronzeAttack,finishChimeraMagicalSaves,filterChimeraHearingTargets} from "./chimera-spells.mjs";

export function chimeraRegeneration(actor){const hp=actor?.system?.attributes?.hp;return chimeraHas(actor,"hydra")&&Number(hp?.value)>0?Math.max(0,Math.min(10,Number(hp.effectiveMax??hp.max)-Number(hp.value))):0;}
export async function regenerateChimera(actor,record={}){if(!enabled()||!isGmAuthority()||!chimeraHas(actor,"hydra")||Number(actor.system.attributes.hp.value)<=0)return false;
  const state=chimeraState(actor),fireEpoch=Number(record.fireEpoch??state.fireEpoch??0),used=Number(state.hydraConsumedFire??0);
  if(fireEpoch>used){await saveChimeraState(actor,{hydraConsumedFire:fireEpoch});return true;}
  const amount=Math.min(Number(record.amount??10),chimeraRegeneration(actor));if(amount>0)await actor.update({"system.attributes.hp.value":Number(actor.system.attributes.hp.value)+amount});return true;
}
export async function runChimeraRecord(record){const source=await fromUuid(record.sourceTokenUuid),actor=source?.actor;if(!actor||source.parent.id!==record.sceneId)throw Error("Источник события Химеры недоступен.");
  if(record.operation==="hydra")return regenerateChimera(actor,record);
  if(record.operation==="instinct"){
    const victim=await fromUuid(record.targetTokenUuid);if(!victim?.actor||!chimeraHas(actor,"personality")||!inFeet(source,victim,60,source.parent))return false;
    const hp=victim.actor.system.attributes.hp;if(Number(hp.value)<=0||Number(hp.value)>Number(hp.effectiveMax??hp.max)/2)return false;
    if([...actor.effects].some(e=>isEffectActive(e)&&e.getFlag?.(MODULE_ID,"chimeraCondition")?.kind==="personality"))return false;
    let blood=victim.actor.getFlag?.(MODULE_ID,"chimeraHasBlood");
    if(typeof blood!=="boolean"){blood=await confirmOwner(chimeraGm(actor),"Нестабильная личность: кровь","У существа, чьи хиты упали ниже половины, есть кровь? Отказ пропускает это событие; неизвестное правило не выводится из типа существа.");if(!blood)return false;await victim.actor.setFlag(MODULE_ID,"chimeraHasBlood",true);}
    if(!blood)return false;const item=chimeraItem(actor,"personality"),result=await chimeraPulse(source,item,[source],{save:"wis",requestId:record.id});if(result.status!=="success")return {status:"needs-review"};
    if(result.failedSaves.includes(source.uuid))await chimeraCondition(source,source,item,{kind:"personality",repeat:"wis",extra:{victimUuid:victim.uuid}});return true;
  }
  const effect=await fromUuid(record.effectUuid),state=effect?.getFlag?.(MODULE_ID,"chimeraCondition");if(state?.kind!=="medusa"||!isEffectActive(effect))return false;
  const target=await fromUuid(state.targetTokenUuid),item=await fromUuid(state.sourceItemUuid);if(!target?.actor||!item)throw Error("Медуза: карточка или цель недоступна.");
  const result=await chimeraPulse(source,item,[target],{save:"con",dc:state.dc,requestId:record.id});if(result.status!=="success")return {status:"needs-review"};
  if(result.failedSaves.includes(target.uuid))await chimeraCondition(source,target,item,{kind:"petrified",statuses:["petrified"]});await effect.delete();return true;
}
registerAutomationEvent("chimera-periodic",runChimeraRecord);
export async function handleChimeraTurn(combat,changes){if(!enabled()||!isGmAuthority()||!isForwardTurn(combat,changes))return;
  const snapshot=combatTurnSnapshot(combat),current=snapshot.current.token,previous=snapshot.previous.token,moment=`${snapshot.id}:${snapshot.current.round}:${snapshot.current.turn}`,records=[];
  if(current?.actor&&chimeraHas(current.actor,"hydra"))records.push({id:`chimera-hydra:${moment}:${current.uuid}`,kind:"chimera-periodic",name:"Регенерация гидры",operation:"hydra",sceneId:current.parent.id,sourceTokenUuid:current.uuid,sourceActorUuid:current.actor.uuid,amount:10,fireEpoch:Number(chimeraState(current.actor).fireEpoch??0)});
  if(previous?.actor)for(const effect of previous.actor.effects??[]){const state=effect.getFlag?.(MODULE_ID,"chimeraCondition");if(state?.kind!=="medusa"||!isEffectActive(effect))continue;
    const skip=state.skipEndMoment;if(skip?.combatId===snapshot.id&&Number(skip.round)===Number(snapshot.previous.round)&&Number(skip.turn)===Number(snapshot.previous.turn))continue;
    records.push({id:`chimera-medusa:${effect.uuid}:${moment}`,kind:"chimera-periodic",name:"Волосы Медузы: последний спасбросок",operation:"medusa",sceneId:previous.parent.id,sourceTokenUuid:state.sourceTokenUuid,sourceActorUuid:state.sourceActorUuid,effectUuid:effect.uuid});
  }
  for(const record of records)await runAutomationEvent(record,()=>runChimeraRecord(record),{queued:!canvas.ready||canvas.scene?.id!==record.sceneId});
}
export function captureChimeraHp(actor,changes,options={}){if(!enabled())return;const value=changes["system.attributes.hp.value"]??changes.system?.attributes?.hp?.value;if(value===undefined||Number(value)>=Number(actor.system.attributes.hp.value))return;
  const max=Number(actor.system.attributes.hp.effectiveMax??actor.system.attributes.hp.max),old=Number(actor.system.attributes.hp.value);if(!(old>=max/2&&Number(value)<max/2&&Number(value)>0))return;
  options[MODULE_ID]??={};options[MODULE_ID].chimeraHp={id:foundry.utils.randomID(),actorUuid:actor.uuid,next:Number(value),max};
}
export async function observeChimeraHp(actor,_changes,options){if(!enabled()||!isGmAuthority())return;const captured=options?.[MODULE_ID]?.chimeraHp;if(!captured||captured.actorUuid!==actor.uuid||Number(actor.system.attributes.hp.value)!==captured.next)return;
  for(const scene of game.scenes??[]){const victims=[...(scene.tokens??[])].filter(t=>t.actor?.uuid===actor.uuid);for(const victim of victims)for(const source of scene.tokens??[]){if(source.uuid===victim.uuid||!chimeraHas(source.actor,"personality")||!inFeet(source,victim,60,scene))continue;
    const record={id:`chimera-instinct:${captured.id}:${source.uuid}:${victim.uuid}`,kind:"chimera-periodic",name:"Нестабильная личность: падение хитов",operation:"instinct",sceneId:scene.id,sourceTokenUuid:source.uuid,sourceActorUuid:source.actor.uuid,targetTokenUuid:victim.uuid,hp:captured.next,max:captured.max};
    await runAutomationEvent(record,()=>runChimeraRecord(record),{queued:!canvas.ready||canvas.scene?.id!==scene.id});}}
}
export async function cleanupChimeraInstincts(){if(!enabled()||!isGmAuthority())return;for(const actor of automationActors())for(const effect of [...(actor.effects??[])]){const state=effect.getFlag?.(MODULE_ID,"chimeraCondition");if(state?.kind!=="personality")continue;
    const victim=await fromUuid(state.victimUuid),hp=victim?.actor?.system?.attributes?.hp;if(!hp||Number(hp.value)<=0||Number(hp.value)>Number(hp.effectiveMax??hp.max)/2)await effect.delete();
  }}
onConfirmedDamage(async({actor,amount,event})=>{if(!enabled()||!isGmAuthority()||amount<=0||!chimeraHas(actor,"hydra")||!(event.damageTypes??[event.damageType]).includes("fire"))return;
  await serialMutation(`chimera-fire:${actor.uuid}`,()=>saveChimeraState(actor,{fireEpoch:Number(chimeraState(actor).fireEpoch??0)+1}));
});
registerGmRequest("chimera-rest",(actor,data,{requestId})=>serialMutation(`chimera-rest:${actor.uuid}`,async()=>{if(!enabled()||!isGmAuthority()||!data.long)return false;
  return applyNativeOnce(actor,{requestId,action:"chimera-rest",activityUuid:null},async()=>true,async()=>{await saveChimeraState(actor,{restEpoch:Number(chimeraState(actor).restEpoch??0)+1});if(chimeraHas(actor,"aberration"))await rollChimeraMutation(actor);return true;});
}));
export function prepareChimeraHitDie(config){const actor=config?.subject;if(!enabled()||chimeraMutation(actor)!=="hitdice"||!chimeraPassiveActive(actor,"mutation"))return;
  for(const roll of config.rolls??[])roll.parts=(roll.parts??[]).map(part=>typeof part==="string"?part.replace(/@abilities\.con\.mod\b/g,"0"):part);
}
export function prepareChimeraPerception(config){const actor=config?.subject;if(!enabled()||config?.skill!=="prc"||config[MODULE_ID]?.chimeraPerception)return;
  if(chimeraMutation(actor)==="perception"&&chimeraPassiveActive(actor,"mutation")&&(config.ability??"wis")==="wis")config.disadvantage=true;
  if(!chimeraAdaptation(actor,"wolf")&&!chimeraKnowledge(actor,"hawk"))return;
  void (async()=>{const applies=await confirmOwner(actor,"Чувства Химеры",`Эта проверка основана на ${[chimeraAdaptation(actor,"wolf")?"слухе/запахе":null,chimeraKnowledge(actor,"hawk")?"зрении":null].filter(Boolean).join(" или ")}?`);
    await actor.rollSkill({...config,advantage:config.advantage||applies,[MODULE_ID]:{...config[MODULE_ID],chimeraPerception:true}});
  })().catch(e=>console.error(`${MODULE_ID} | Chimera perception`,e));return false;
}
export function installChimeraHooks(){const report = reportFailure("Chimera automation");
  const intercept=activity=>{if(!enabled()||!activity)return;const flags=automationData(activity);if(flags.chimeraResolved||flags.auraPulse||flags.leaderResolved||automationAction(activity)!=="chimera-control")return;
    if(!chimeraAvailable(activity.actor,activity.item)){notify("Химера: ступень не открыта, особенность подавлена или срок передачи истёк.","warn");return false;}report(controlChimera(activity.actor,activity));return false;};
  Hooks.on("dnd5e.preUseActivity",intercept);Hooks.on("midi-qol.preTargetingV2",({workflow})=>intercept(workflow?.activity));
  Hooks.on("midi-qol.prePreambleComplete",prepareChimeraSpellTargets);Hooks.on("midi-qol.prePreambleComplete",filterChimeraHearingTargets);
  Hooks.on("midi-qol.preAttackRollConfig",prepareChimeraBronzeAttack);Hooks.on("midi-qol.postCheckSaves",finishChimeraMagicalSaves);
  Hooks.on("dnd5e.preRollSkill",prepareChimeraPerception);Hooks.on("dnd5e.preRollHitDie",prepareChimeraHitDie);
  Hooks.on("updateCombat",(combat,changes)=>report(handleChimeraTurn(combat,changes)));
  Hooks.on("preUpdateActor",captureChimeraHp);Hooks.on("updateActor",(actor,changes,options)=>{report(observeChimeraHp(actor,changes,options));if(Object.hasOwn(changes,"system.attributes.hp.value")||changes.system?.attributes?.hp)report(cleanupChimeraInstincts());});
  for(const hook of ["ready","updateWorldTime"])Hooks.on(hook,()=>{if(enabled()&&isGmAuthority())for(const actor of automationActors())report(expireChimeraShares(actor));});
  Hooks.on("dnd5e.restCompleted",(actor,result,config)=>{if(!enabled()||![...(actor.items??[])].some(i=>automationData(i).transformation==="chimera"))return;
    const long=Boolean(result.longRest||result.type==="long"||config?.type==="long"),id=result.chimeraRestId??=result.message?.uuid??foundry.utils.randomID();if(long)report(requestGm("chimera-rest",actor,{long},{requestId:`chimera-rest:${id}`}));
  });
}
