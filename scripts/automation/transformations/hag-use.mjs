import {MODULE_ID} from "../shared/constants.mjs";
import {itemUses} from "../shared/helpers.mjs";
import {chooseSceneTokens} from "../shared/owner-prompts.mjs";
import {useNativeUtility} from "../shared/native-actions.mjs";
import {useAuraPulse} from "../midi/aura-workflow.mjs";
import {hagDC,hagState,patchHag} from "./hag.mjs";
export const hagGm=actor=>({uuid:actor.uuid,testUserPermission:user=>user.isGM});
export const hagTargets=(actor,source,title,{max=1,self=false}={})=>chooseSceneTokens(actor,source.parent,{title,min:1,max,exclude:self?[]:[source.uuid]});
export function hagExpense(activity,{resource=activity.item,cost=0,activation="action"}={}){if(cost&&(!resource||resource.isSuppressed||itemUses(resource).remaining<cost))throw Error("Недостаточно применений Ведьмы.");return {activation:{type:activation,value:activation==="special"?null:1,override:true},consumption:{spellSlot:false,targets:cost?[{type:"itemUses",target:resource.id,value:String(cost)}]:[]}};}
export const useHagCost=(activity,options={})=>useNativeUtility(activity,{dataPatch:hagExpense(activity,options)});
export async function hagPulse(source,item,targets,{save=null,dc=hagDC(source.actor),damage=[],onSave="none",requestId,metadata={}}={}){
  if(!targets.length)return true;
  await patchHag(source.actor,{pulseOrigins:Object.fromEntries([...Object.entries(hagState(source.actor).pulseOrigins??{}),[requestId,{...metadata}]].slice(-128))});
  const place=t=>t.object??{document:t,actor:t.actor};
  const result=await useAuraPulse({scene:source.parent,sourceToken:place(source),sourceItem:item,targets:targets.map(place),eventKey:requestId,event:{allowIncapacitated:true,...(save?{save,dc:String(dc),returnSaveOutcome:true}:{}),damage,onSave,metadata:{hagResolved:true,...metadata}}});
  return result==null||result===false||result.aborted||["pending","needs-review"].includes(result.status)?{status:"needs-review"}:result;
}
