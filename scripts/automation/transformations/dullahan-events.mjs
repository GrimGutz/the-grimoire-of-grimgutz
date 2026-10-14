import {MODULE_ID} from "../shared/constants.mjs";
import {enabled,automationData,automationAction,notify} from "../shared/helpers.mjs";
import {automationActors} from "../effects/temporary-effects.mjs";
import {isGmAuthority,requestGm} from "../shared/gm-requests.mjs";
import {dullahanHas,dullahanAvailable,dullahanState,dullahanPactWaives,patchDullahan,syncDullahan} from "./dullahan.mjs";
import {controlDullahan} from "./dullahan-actions.mjs";
import {cleanupDullahanBurns,syncDullahanBurnLight} from "./dullahan-burning.mjs";
export function captureDullahanHealing(actor,changes,options){if(!enabled()||!dullahanHas(actor,"form")||!options?.[MODULE_ID]?.dullahanZeroHealing)return;const value=changes["system.attributes.hp.value"]??changes.system?.attributes?.hp?.value;if(Number(actor.system.attributes.hp.value)===0&&Number(value)>0)options[MODULE_ID].dullahanRecovery=true;}
export async function observeDullahanHealing(actor,_changes,options){if(!enabled()||!isGmAuthority()||!options?.[MODULE_ID]?.dullahanRecovery||!dullahanHas(actor,"form")||Number(actor.system.attributes.hp.value)!==1||actor.statuses?.has("unconscious"))return;
  await actor.createEmbeddedDocuments("ActiveEffect",[{name:"Форма нежити: стабилен, без сознания (GM)",type:"base",transfer:false,disabled:false,statuses:["unconscious"],start:null,duration:{value:null,units:"seconds",expiry:null,expired:false},flags:{[MODULE_ID]:{dullahanRecovery:true}},system:{changes:[]}}]);
}
export async function revealDullahan(actor){if(enabled()&&isGmAuthority()&&dullahanHas(actor,"appearance")&&!dullahanPactWaives(actor)&&dullahanState(actor).appearance!=="true"&&(actor.statuses?.has("unconscious")||actor.concentration?.effects?.size))await patchDullahan(actor,{appearance:"true"});}
export async function noticeDullahanTimers(actor){if(!enabled()||!isGmAuthority())return;const s=dullahanState(actor),oath=s.oath;
  if(oath&&!oath.deathConfirmed&&!oath.withered&&!oath.noticed&&Number(game.time.worldTime)>Number(oath.startedAt)+86400){await patchDullahan(actor,{oath:{...oath,noticed:true}});notify(`${actor.name}: прошло 24 часа Клятвы охотника. GM должен подтвердить живую цель через «Нарушенную клятву».`,"warn");}
  if(s.rebirth&&!s.rebirth.noticed&&Number(game.time.worldTime)>=s.rebirth.readyAt){await patchDullahan(actor,{rebirth:{...s.rebirth,noticed:true}});notify(`${actor.name}: прошло 48 часов. Проверьте целую голову и подтвердите восстановление тела.`,"info");}
}
export async function endDullahanBurn(effect){if(!enabled()||!isGmAuthority())return;const burn=effect.getFlag?.(MODULE_ID,"dullahanBurn");if(!burn)return;const token=await fromUuid(burn.targetTokenUuid);if(token)await syncDullahanBurnLight(token);
  if(burn.concentrationUuid){const concentration=await fromUuid(burn.concentrationUuid);if(concentration&&![...automationActors()].some(a=>[...(a.effects??[])].some(e=>e.getFlag?.(MODULE_ID,"dullahanBurn")?.concentrationUuid===burn.concentrationUuid)))await concentration.parent.endConcentration(concentration);}
}
export function installDullahanHooks(){const report=p=>{if(p?.catch)void p.catch(error=>console.error(`${MODULE_ID} | Dullahan automation`,error));};
  const intercept=activity=>{if(!enabled()||!activity)return;const f=automationData(activity);if(f.dullahanResolved||f.leaderResolved||f.auraPulse||automationAction(activity)!=="dullahan-control")return;
    if(!dullahanAvailable(activity.actor,activity.item)){notify("Дуллахан: ступень, подавление или требуемый бонус не позволяют применить способность.","warn");return false;}report(controlDullahan(activity.actor,activity));return false;};
  Hooks.on("dnd5e.preUseActivity",intercept);Hooks.on("midi-qol.preTargetingV2",({workflow})=>intercept(workflow?.activity));
  Hooks.on("preUpdateActor",captureDullahanHealing);Hooks.on("updateActor",(actor,changes,options)=>{report(observeDullahanHealing(actor,changes,options));report(revealDullahan(actor));});
  for(const h of ["createActiveEffect","updateActiveEffect","deleteActiveEffect"])Hooks.on(h,e=>{if(e.parent?.documentName==="Actor"){report(revealDullahan(e.parent));report(cleanupDullahanBurns());}if(h==="deleteActiveEffect")report(endDullahanBurn(e));});
  for(const h of ["ready","updateWorldTime"])Hooks.on(h,()=>{if(!enabled()||!isGmAuthority())return;report(cleanupDullahanBurns());for(const a of automationActors())if(dullahanState(a).oath||dullahanState(a).rebirth)report(noticeDullahanTimers(a));});
  for(const h of ["updateToken","deleteToken"])Hooks.on(h,t=>{if(!enabled()||!isGmAuthority())return;for(const a of automationActors()){const ride=dullahanState(a).riding;if(ride&&(ride.sourceTokenUuid===t.uuid||ride.mountTokenUuid===t.uuid))report(syncDullahan(a));}});
  Hooks.on("dnd5e.restCompleted",(actor,result,config)=>{if(!enabled()||!dullahanHas(actor,"oath"))return;const long=Boolean(result.longRest||result.type==="long"||config?.type==="long"),id=result.dullahanRestId??=result.message?.uuid??foundry.utils.randomID();if(long)report(requestGm("dullahan-rest",actor,{long},{requestId:`dullahan-rest:${id}`}));});
}
