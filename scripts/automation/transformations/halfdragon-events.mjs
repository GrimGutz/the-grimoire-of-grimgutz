import {MODULE_ID} from "../shared/constants.mjs";
import {enabled,automationData,automationAction,findFeature,notify} from "../shared/helpers.mjs";
import {automationActors,isEffectActive} from "../effects/temporary-effects.mjs";
import {isGmAuthority} from "../shared/gm-requests.mjs";
import {onConfirmedDamage} from "../shared/damage-events.mjs";
import {registerAutomationEvent,runAutomationEvent} from "../shared/event-ledger.mjs";
import {combatTurnSnapshot,isForwardTurn} from "../shared/combat-flow.mjs";
import {inFeet} from "../shared/combat-benefits.mjs";
import {feetToSceneUnits} from "../shared/spatial.mjs";
import {serialMutation} from "../shared/transactions.mjs";
import {hdHas,hdAvailable,hdGuardActive,syncHalfdragon} from "./halfdragon.mjs";
import {hdPulse} from "./halfdragon-use.mjs";
import {controlHalfdragon,recoverHalfdragon} from "./halfdragon-actions.mjs";
import {halfdragonLivingActive} from "./halfdragon-auras.mjs";
import {resolveHalfdragonSangromancy} from "./halfdragon-areas.mjs";
import {finishHalfdragonAttack} from "./halfdragon-combat.mjs";

export async function syncHalfdragonLight(token){if(!enabled()||!isGmAuthority()||!token?.actor)return;return serialMutation(`halfdragon-light:${token.uuid}`,async()=>{const active=hdGuardActive(token.actor)&&[...token.actor.effects].some(e=>isEffectActive(e)&&e.getFlag?.(MODULE_ID,"halfdragonGuard")&&e.getFlag(MODULE_ID,"halfdragonCondition")?.sourceTokenUuid===token.uuid),saved=token.getFlag?.(MODULE_ID,"halfdragonGuardLight");
  if(active&&!saved){const before={bright:Number(token.light?.bright??0),dim:Number(token.light?.dim??0)},applied={bright:Math.max(before.bright,feetToSceneUnits(10,token.parent)),dim:Math.max(before.dim,feetToSceneUnits(20,token.parent))};await token.update({"light.bright":applied.bright,"light.dim":applied.dim,[`flags.${MODULE_ID}.halfdragonGuardLight`]:{before,applied}});}
  else if(!active&&saved){const patch={[`flags.${MODULE_ID}.-=halfdragonGuardLight`]:null};for(const k of ["bright","dim"])if(Number(token.light?.[k]??0)===saved.applied[k])patch[`light.${k}`]=saved.before[k];await token.update(patch);}
});}
export async function wakeHalfdragonGas({actor,amount}){if(!enabled()||!isGmAuthority()||amount<=0)return;for(const e of [...actor.effects??[]])if(e.getFlag?.(MODULE_ID,"halfdragonCondition")?.kind==="sleep"&&isEffectActive(e))await e.delete();}
onConfirmedDamage(wakeHalfdragonGas);
export async function runHalfdragonTurn(record){const source=await fromUuid(record.sourceTokenUuid),target=await fromUuid(record.targetTokenUuid);if(!source?.actor||!target?.actor)return false;
  if(record.operation==="recover"){if(Number(source.actor.system.attributes.hp.value)!==0||!hdHas(source.actor,"descendant"))return false;const item=findFeature(source.actor,"halfdragon-descendant"),a=[...item.system.activities.values()][0];return recoverHalfdragon(source.actor,a,source,record.id);}
  if(!halfdragonLivingActive(source.actor))return false;const item=findFeature(source.actor,"halfdragon-living-aura");if(!item)return false;return hdPulse(source,item,[target],{save:"con",dc:record.dc,damage:[{formula:"1d6",type:record.damageType}],requestId:record.id});
}
registerAutomationEvent("halfdragon-turn",runHalfdragonTurn);
export async function handleHalfdragonTurn(combat,changes){if(!enabled()||!isGmAuthority()||!isForwardTurn(combat,changes))return;const snapshot=combatTurnSnapshot(combat),current=snapshot.current,target=current.token,scene=current.scene;if(!target?.actor||!scene)return;
  // Freeze recipients and parameters now; an off-scene event awaits GM review.
  const records=[...scene.tokens].filter(t=>t.uuid!==target.uuid&&halfdragonLivingActive(t.actor)&&inFeet(t,target,5,scene)).map(t=>{const r=t.actor.getFlag(MODULE_ID,"summonTemplate").snapshot;return {id:`halfdragon-aura:${snapshot.id}:${current.round}:${current.turn}:${t.uuid}:${target.uuid}`,kind:"halfdragon-turn",operation:"living",name:"Аура Дыхания",sceneId:scene.id,sourceActorUuid:t.actor.uuid,sourceTokenUuid:t.uuid,targetTokenUuid:target.uuid,dc:r.dc,damageType:r.damageType};});
  for(const r of records)await runAutomationEvent(r,()=>runHalfdragonTurn(r),{queued:!canvas.ready||canvas.scene?.id!==scene.id});
}
export function captureHalfdragonHp(actor,changes,options={}){if(!enabled())return;const hp=actor.system?.attributes?.hp;if(!hp)return;const value=changes["system.attributes.hp.value"]??changes.system?.attributes?.hp?.value;if(hdHas(actor,"descendant")&&value!==undefined&&Number(value)===0&&Number(hp.value)>0){options[MODULE_ID]??={};options[MODULE_ID].halfdragonDropId??=foundry.utils.randomID();}
  const temp=changes["system.attributes.hp.temp"]??changes.system?.attributes?.hp?.temp,own=actor.getFlag?.(MODULE_ID,"halfdragonRoarHp");if(temp!==undefined&&own&&!options.halfdragonExpireHp)changes[`flags.${MODULE_ID}.halfdragonRoarHp`]=Number(temp)<Number(hp.temp)?{...own,remaining:Math.max(0,Math.min(Number(own.remaining),Number(temp)))}:null;
}
export async function observeHalfdragonHp(actor,_changes,options={}){if(!enabled()||!isGmAuthority())return;
  if(options[MODULE_ID]?.halfdragonDropId&&Number(actor.system.attributes.hp.value)===0){const tokens=[...(game.scenes??[])].flatMap(s=>[...s.tokens]).filter(t=>t.actor?.uuid===actor.uuid),source=tokens.length===1?tokens[0]:null;if(!source){notify("Потомки Богов: выберите токен и подтвердите восстановление кнопкой.","warn");return;}const r={id:`halfdragon-drop:${actor.uuid}:${options[MODULE_ID].halfdragonDropId}`,kind:"halfdragon-turn",operation:"recover",name:"Потомки Богов",sceneId:source.parent.id,sourceActorUuid:actor.uuid,sourceTokenUuid:source.uuid,targetTokenUuid:source.uuid};await runAutomationEvent(r,()=>runHalfdragonTurn(r),{queued:!canvas.ready||canvas.scene?.id!==r.sceneId});}
}
export async function clearHalfdragonRoarHp(source){if(!enabled()||!isGmAuthority())return;for(const actor of automationActors()){const own=actor.getFlag?.(MODULE_ID,"halfdragonRoarHp");if(own?.sourceActorUuid!==source.uuid)continue;if(Number(actor.system.attributes.hp.temp)===Number(own.remaining))await actor.update({"system.attributes.hp.temp":0},{halfdragonExpireHp:true});await actor.unsetFlag(MODULE_ID,"halfdragonRoarHp");}}
export function installHalfdragonHooks(){const report=p=>{if(p?.catch)void p.catch(e=>console.error(`${MODULE_ID} | Dragon automation`,e));};const intercept=a=>{if(!enabled()||!a)return;const f=automationData(a);if(f.halfdragonResolved||f.leaderResolved||f.auraPulse||automationAction(a)!=="halfdragon-control")return;if(!hdAvailable(a.actor,a.item)){notify("Дракон: особенность недоступна либо подавлена.","warn");return false;}report(controlHalfdragon(a.actor,a));return false;};
  Hooks.on("dnd5e.preUseActivity",intercept);Hooks.on("midi-qol.preTargetingV2",({workflow})=>intercept(workflow?.activity));Hooks.on("midi-qol.postCheckSaves",resolveHalfdragonSangromancy);Hooks.on("midi-qol.AttackRollComplete",finishHalfdragonAttack);
  Hooks.on("updateCombat",(c,ch)=>report(handleHalfdragonTurn(c,ch)));Hooks.on("preUpdateActor",captureHalfdragonHp);Hooks.on("updateActor",(a,c,o)=>report(observeHalfdragonHp(a,c,o)));
  Hooks.on("dnd5e.restCompleted",(a,r,c)=>{if(r?.longRest||r?.type==="long"||c?.type==="long")report(clearHalfdragonRoarHp(a));});
  for(const name of ["createActiveEffect","updateActiveEffect","deleteActiveEffect"])Hooks.on(name,e=>{if(!enabled()||!isGmAuthority())return;if(hdHas(e.parent,"appearance"))report(syncHalfdragon(e.parent));const state=e.getFlag?.(MODULE_ID,"halfdragonCondition");if(state?.kind==="guard")report(fromUuid(state.sourceTokenUuid).then(syncHalfdragonLight));});
  for(const name of ["ready","updateWorldTime"])Hooks.on(name,()=>{if(!enabled()||!isGmAuthority())return;for(const s of game.scenes??[])for(const t of s.tokens??[])if(t.getFlag?.(MODULE_ID,"halfdragonGuardLight"))report(syncHalfdragonLight(t));});
}
