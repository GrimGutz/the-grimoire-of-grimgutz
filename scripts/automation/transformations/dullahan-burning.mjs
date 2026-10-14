import {MODULE_ID} from "../shared/constants.mjs";
import {automationActors,isEffectActive,temporaryEffectTiming} from "../effects/temporary-effects.mjs";
import {isGmAuthority} from "../shared/gm-requests.mjs";
import {feetToSceneUnits} from "../shared/spatial.mjs";
import {dullahanDC} from "./dullahan.mjs";
import {dullahanImmune} from "./dullahan-use.mjs";
export async function syncDullahanBurnLight(target){if(!isGmAuthority()||!target?.actor)return;
  const burning=[...(target.actor.effects??[])].some(e=>isEffectActive(e)&&e.getFlag?.(MODULE_ID,"dullahanBurn")?.targetTokenUuid===target.uuid),saved=target.getFlag?.(MODULE_ID,"dullahanBurnLight");
  if(burning&&!saved){const before={bright:Number(target.light?.bright??0),dim:Number(target.light?.dim??0)},applied={bright:Math.max(before.bright,feetToSceneUnits(30,target.parent)),dim:Math.max(before.dim,feetToSceneUnits(60,target.parent))};await target.update({"light.bright":applied.bright,"light.dim":applied.dim,[`flags.${MODULE_ID}.dullahanBurnLight`]:{before,applied}});}
  else if(!burning&&saved){const patch={};for(const key of ["bright","dim"])if(Number(target.light?.[key]??0)===saved.applied[key])patch[`light.${key}`]=saved.before[key];patch[`flags.${MODULE_ID}.-=dullahanBurnLight`]=null;await target.update(patch);}
}
export async function addDullahanBurn(source,target,item,{kind,concentrationUuid=null,seconds=kind==="skulls"?60:null}={}){
  if(kind==="gaze"&&dullahanImmune(target.actor,"frightened"))return false;
  for(const e of target.actor.effects??[])if(e.getFlag?.(MODULE_ID,"dullahanBurn")?.kind===kind&&e.getFlag(MODULE_ID,"dullahanBurn").sourceActorUuid===source.actor.uuid){
    await e.update({disabled:false,...(seconds?temporaryEffectTiming({seconds,actor:target.actor,expiry:"updateWorldTime"}):{}),[`flags.${MODULE_ID}.repeatSave.dc`]:dullahanDC(source.actor),[`flags.${MODULE_ID}.dullahanBurn.concentrationUuid`]:concentrationUuid});await syncDullahanBurnLight(target);return e;
  }
  const [effect]=await target.actor.createEmbeddedDocuments("ActiveEffect",[{name:`${item.name}: горение`,img:item.img,type:"base",transfer:false,disabled:false,origin:item.uuid,statuses:kind==="gaze"?["frightened"]:[],
    ...(seconds?temporaryEffectTiming({seconds,actor:target.actor,expiry:"updateWorldTime"}):{start:null,duration:{value:null,units:"seconds",expiry:null,expired:false}}),
    flags:{[MODULE_ID]:{dullahanBurn:{kind,sourceActorUuid:source.actor.uuid,sourceTokenUuid:source.uuid,targetTokenUuid:target.uuid,concentrationUuid},repeatSave:{ability:kind==="gaze"?"wis":"dex",dc:dullahanDC(source.actor),event:"turnEnd",sourceTokenUuid:source.uuid,targetTokenUuid:target.uuid,sourceItemUuid:item.uuid,damage:[{formula:kind==="gaze"?"1d8":"1d6",type:"fire"}],metadata:{dullahanResolved:true,dullahanBurning:true}}},dae:{expiryMode:"delete"}},system:{changes:[]}}]);
  if(concentrationUuid&&MidiQOL.addDependent)await MidiQOL.addDependent(await fromUuid(concentrationUuid),effect);await syncDullahanBurnLight(target);return effect;
}
export async function cleanupDullahanBurns(){if(!isGmAuthority())return;for(const actor of automationActors())for(const effect of [...(actor.effects??[])]){
  const burn=effect.getFlag?.(MODULE_ID,"dullahanBurn");if(!burn)continue;
  if(burn.concentrationUuid&&!isEffectActive(await fromUuid(burn.concentrationUuid)))await effect.delete();const target=await fromUuid(burn.targetTokenUuid);if(target)await syncDullahanBurnLight(target);
}}
