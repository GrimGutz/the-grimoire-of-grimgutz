import {MODULE_ID} from "../shared/constants.mjs";
import {enabled,automationData} from "../shared/helpers.mjs";
import {registerGmRequest,requestGm,isGmAuthority} from "../shared/gm-requests.mjs";
import {applyNativeOnce,nativeApplicationReply} from "../shared/native-applications.mjs";
import {serialMutation} from "../shared/transactions.mjs";
import {areaActivityData} from "../shared/area-definitions.mjs";
import {useAreaActivity} from "../shared/area-activities.mjs";
registerGmRequest("deathknight-minion",(actor,data,{requestId})=>serialMutation(`deathknight-minion:${actor.uuid}`,async()=>{
  const activity=await fromUuid(data.activityUuid);if(!enabled()||!isGmAuthority()||activity?.actor?.uuid!==actor.uuid||actor.getFlag(MODULE_ID,"summonSource")!=="deathknight-skeleton"||automationData(activity).deathknightMinionOperation!=="explode")return false;const old=nativeApplicationReply(actor,requestId);if(old)return old;
  if(Number(actor.system.attributes.hp.value)<=0||actor.getFlag(MODULE_ID,"deathknightExploded"))return false;const dc=Number(automationData(activity).deathknightSapperDC);if(!Number.isInteger(dc)||dc<1||dc>40)throw Error("Сл взрыва должен подтвердить GM при назначении специализации.");
  const spec={shape:"sphere",size:15,origin:"self",save:"dex",dc:String(dc),damage:[{formula:"4d8",type:"fire"}],onSave:"half",native:true,templateSeconds:null};const patched=areaActivityData(activity.toObject(),spec);patched.flags={[MODULE_ID]:{action:"",deathknightResolved:true,area:spec}};
  const clone=activity.item.clone({system:{activities:{[activity.id]:patched}}},{keepId:true});return applyNativeOnce(actor,{requestId,action:"deathknight-minion",activityUuid:activity.uuid},async()=>{
    await actor.setFlag(MODULE_ID,"deathknightExploded",{requestId,state:"pending"});const result=await useAreaActivity(clone.system.activities.get(activity.id),{reportOutcome:true});if(result===false)await actor.unsetFlag(MODULE_ID,"deathknightExploded");return result;
  },async workflow=>{await actor.update({"system.attributes.hp.value":0});await actor.setFlag(MODULE_ID,"deathknightExploded",{requestId,state:"complete"});for(const uuid of workflow.grimgutzAreaResult?.templateUuids??[]){const z=await fromUuid(uuid);if(z)await z.delete();}return true;});
}));
export function controlDeathknightMinion(actor,activity){return requestGm("deathknight-minion",actor,{activityUuid:activity.uuid},{timeoutMs:180000});}
