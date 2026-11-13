import {MODULE_ID} from "../shared/constants.mjs";
import {enabled,automationData,automationAction,findFeature,notify,reportFailure} from "../shared/helpers.mjs";
import {isGmAuthority,requestGm,registerGmRequest} from "../shared/gm-requests.mjs";
import {automationActors} from "../effects/temporary-effects.mjs";
import {registerAutomationEvent,runAutomationEvent} from "../shared/event-ledger.mjs";
import {onConfirmedDamage} from "../shared/damage-events.mjs";
import {inFeet} from "../shared/combat-benefits.mjs";
import {applyNativeOnce} from "../shared/native-applications.mjs";
import {askOwner} from "../shared/owner-prompts.mjs";
import {hagHas,hagState,hagCharacterLevel,hagAvailable,syncHag,hagRules} from "./hag.mjs";
import {hagPulse,hagGm} from "./hag-use.mjs";
import {activeHagCurses,hagCurseData,syncHagCurseModifiers,removeHagCurses} from "./hag-curses.mjs";
import {cleanupHagReflection,guardHagReflection} from "./hag-summons.mjs";
import {controlHag} from "./hag-actions.mjs";
import {rollHagFortunes} from "./hag-choices.mjs";
import {hagMagical,offerHagJinx} from "./hag-combat.mjs";
export function hagNaturalOne(roll){const die=roll?.dice?.find(d=>d.faces===20),active=die?.results?.filter(r=>r.active!==false&&!r.discarded);return active?.length===1&&Number(active[0].result)===1;}
export async function runHagCall(record){const source=await fromUuid(record.sourceTokenUuid),item=await fromUuid(record.sourceItemUuid);if(!source?.actor||!item||!hagHas(source.actor,"call"))return false;if(record.dice<1)return true;return hagPulse(source,item,[source],{damage:[{formula:`${record.dice}d6`,type:"force"}],requestId:record.id,metadata:{hagCall:true}});}
export async function runHagRecord(record){if(record.operation==="call")return runHagCall(record);
  const source=await fromUuid(record.sourceTokenUuid),item=await fromUuid(record.sourceItemUuid);if(!source?.actor||!item)return {status:"needs-review"};
  if(record.operation==="scarlet"){const target=await fromUuid(record.targetTokenUuid),effect=await fromUuid(record.effectUuid);if(!target?.actor||!effect||!activeHagCurses(target.actor).includes(effect))return false;const mode=hagRules(source.actor).scarletDamageType;
    let type=mode;if(mode==="source"){const types=[...new Set(record.damageTypes)].filter(t=>Object.hasOwn(CONFIG.DND5E.damageTypes??{},t));type=types.length===1?types[0]:await askOwner(hagGm(source.actor),{title:"Смешанный исходный урон: один тип Алого урона",choices:types.map(t=>[t,t])});if(!types.includes(type))return false;}
    return hagPulse(source,item,[target],{damage:[{formula:`1d4 + ${record.tier}`,type}],requestId:record.id,metadata:{hagCurseDamage:true}});
  }
  if(record.operation==="broom-explosion"){const broom=await fromUuid(record.broomTokenUuid);if(!broom?.actor||Number(broom.actor.system.attributes.hp.value)>0)return false;const targets=[...(broom.parent.tokens??[])].filter(t=>t.actor&&inFeet(broom,t,10,broom.parent));return hagPulse(source,item,targets,{save:"dex",dc:record.dc,damage:[{formula:"5d6",type:"piercing"}],onSave:"half",requestId:record.id,metadata:{hagBroomExplosion:true}});}
  return false;
}
registerAutomationEvent("hag-event",runHagRecord);
registerGmRequest("hag-save-call",async(caster,data)=>{const activity=await fromUuid(data.activityUuid),token=await fromUuid(data.targetUuid);if(!enabled()||!isGmAuthority()||activity?.actor?.uuid!==caster.uuid||!hagMagical({item:activity.item,activity})||!token?.actor||!hagHas(token.actor,"call")||!data.workflowId||!hagNaturalOne(data.roll))return false;
  const record={id:`hag-call:${data.workflowId}:${token.uuid}`,kind:"hag-event",operation:"call",name:"Зов Ковена",sceneId:token.parent.id,sourceActorUuid:token.actor.uuid,sourceTokenUuid:token.uuid,sourceItemUuid:findFeature(token.actor,"hag-call").uuid,dice:Math.floor(hagCharacterLevel(token.actor)/2)};
  return runAutomationEvent(record,()=>runHagCall(record),{queued:!canvas.ready||canvas.scene?.id!==record.sceneId});
});
export async function finishHagSaves(workflow){if(!enabled()||workflow?.aborted||!hagMagical(workflow)||!workflow.actor)return;
  const targets=new Set([...(workflow.targets??[]),...(workflow.saves??[]),...(workflow.failedSaves??[])]);
  for(const target of targets){const token=target.document??target;if(!hagHas(token.actor,"call"))continue;const roll=workflow.tokenSaves?.[token.uuid]??workflow.targetSaveDetails?.[token.uuid]?.saveRoll;if(!hagNaturalOne(roll))continue;
    await requestGm("hag-save-call",workflow.actor,{activityUuid:workflow.activity.uuid,workflowId:workflow.id,targetUuid:token.uuid,roll:{dice:roll.dice.map(d=>({faces:d.faces,results:d.results.map(r=>({result:r.result,active:r.active,discarded:r.discarded}))}))}},{requestId:`hag-call-request:${workflow.id}:${token.uuid}`,timeoutMs:180000});
  }
}
export async function recordHagDamage({actor,amount,event}){if(!enabled()||!isGmAuthority()||amount<=0||event.hagCurseDamage)return;
  const effect=activeHagCurses(actor).filter(e=>hagCurseData(e).types.includes("scarlet")).sort((a,b)=>hagCurseData(b).tier-hagCurseData(a).tier)[0],c=effect&&hagCurseData(effect);if(!c)return;
  const target=await fromUuid(event.targetTokenUuid??c.targetTokenUuid);if(!target?.actor||target.actor.uuid!==actor.uuid)return;
  const record={id:`hag-scarlet:${event.key}:${effect.uuid}`,kind:"hag-event",operation:"scarlet",name:"Алое Проклятие",sceneId:target.parent.id,sourceActorUuid:c.sourceActorUuid,sourceTokenUuid:c.sourceTokenUuid,sourceItemUuid:c.sourceItemUuid,targetTokenUuid:target.uuid,effectUuid:effect.uuid,tier:c.tier,damageTypes:event.damageTypes??[event.damageType]};return runAutomationEvent(record,()=>runHagRecord(record),{queued:!canvas.ready||canvas.scene?.id!==record.sceneId});
}
onConfirmedDamage(recordHagDamage);
registerGmRequest("hag-fortune-rest",async(actor,_data,{requestId})=>{if(!enabled()||!isGmAuthority()||!hagHas(actor,"fortune"))return false;return rollHagFortunes(actor,{requestId,confirmed:true});});
export function captureHagBroomDrop(actor,changes,options={}){if(!enabled()||actor.getFlag?.(MODULE_ID,"summonTemplate")?.kind!=="hag-broom")return;const next=changes["system.attributes.hp.value"]??changes.system?.attributes?.hp?.value;if(Number(next)===0&&Number(actor.system.attributes.hp.value)>0){options[MODULE_ID]??={};options[MODULE_ID].hagBroomDrop??=foundry.utils.randomID();}}
export async function observeHagBroomDrop(actor,_changes,options){if(!enabled()||!isGmAuthority()||!options?.[MODULE_ID]?.hagBroomDrop||Number(actor.system.attributes.hp.value)!==0)return;const recipe=actor.getFlag(MODULE_ID,"summonTemplate"),owner=await fromUuid(recipe.snapshot.ownerUuid),state=hagState(owner).broom;if(!state||!state.actorUuids.includes(actor.uuid))return;const broomTokenUuid=state.tokenUuids.find(uuid=>game.scenes?.get?.(state.sceneId)?.tokens?.find(t=>t.uuid===uuid&&t.actor?.uuid===actor.uuid));if(!broomTokenUuid)return;
  const record={id:`hag-broom-explosion:${actor.uuid}`,kind:"hag-event",operation:"broom-explosion",name:"Оживлённая Метла: взрыв",sceneId:state.sceneId,sourceActorUuid:owner.uuid,sourceTokenUuid:state.sourceTokenUuid,sourceItemUuid:state.sourceItemUuid,broomTokenUuid,dc:state.dc};return runAutomationEvent(record,()=>runHagRecord(record),{queued:!canvas.ready||canvas.scene?.id!==record.sceneId});
}
export async function finishHagRemoveCurse(workflow){if(!enabled()||!isGmAuthority()||workflow?.aborted||workflow.item?.type!=="spell"||workflow.item.system.identifier!=="remove-curse")return;for(const t of workflow.targets??[])await applyNativeOnce(t.actor,{requestId:`hag-remove:${workflow.id}:${t.document?.uuid??t.uuid}`,action:"hag-remove-curse",activityUuid:workflow.activity.uuid},async()=>true,async()=>{await removeHagCurses(t.actor);return true;});}
export function installHagHooks(){const report = reportFailure("Hag automation");
  const intercept=activity=>{if(!enabled()||!activity)return;const f=automationData(activity);if(f.hagResolved||f.leaderResolved||f.auraPulse||automationAction(activity)!=="hag-control")return;if(!hagAvailable(activity.actor,activity.item)){notify("Ведьма: не открыта ступень, отсутствует предварительный бонус либо особенность подавлена.","warn");return false;}report(controlHag(activity.actor,activity));return false;};
  Hooks.on("dnd5e.preUseActivity",intercept);Hooks.on("midi-qol.preTargetingV2",({workflow})=>intercept(workflow?.activity));
  Hooks.on("midi-qol.postCheckSaves",async w=>{await finishHagSaves(w);await offerHagJinx(w);});Hooks.on("midi-qol.RollComplete",finishHagRemoveCurse);
  Hooks.on("preUpdateActor",captureHagBroomDrop);Hooks.on("updateActor",(a,c,o)=>report(observeHagBroomDrop(a,c,o)));
  Hooks.on("preUpdateToken",(t,c)=>{if(enabled())return guardHagReflection(t,c);});
  for(const name of ["ready","updateWorldTime"])Hooks.on(name,()=>{if(!enabled()||!isGmAuthority())return;for(const a of automationActors()){if(hagState(a).reflection)report(cleanupHagReflection(a));if(activeHagCurses(a).length||[...(a.effects??[])].some(e=>e.getFlag?.(MODULE_ID,"hagCurseModifiers")))report(syncHagCurseModifiers(a));}});
  for(const name of ["createActiveEffect","updateActiveEffect","deleteActiveEffect"])Hooks.on(name,e=>{if(!enabled()||!isGmAuthority()||!e.parent?.system?.attributes)return;if(e.getFlag?.(MODULE_ID,"hagCurse"))report(syncHagCurseModifiers(e.parent));if(hagHas(e.parent,"appearance"))report(syncHag(e.parent));if(e.getFlag?.(MODULE_ID,"hagReflection"))report(cleanupHagReflection(e.parent));});
  Hooks.on("dnd5e.restCompleted",(a,result,config)=>{if(!enabled()||!hagHas(a,"fortune")||!(result?.longRest||result?.type==="long"||config?.type==="long"))return;const id=result.hagRestId??=result.message?.uuid??foundry.utils.randomID();report(requestGm("hag-fortune-rest",a,{}, {requestId:`hag-fortune:${id}`,timeoutMs:180000}));});
}
