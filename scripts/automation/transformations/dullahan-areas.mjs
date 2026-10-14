import {MODULE_ID} from "../shared/constants.mjs";
import {dullahanState,patchDullahan,dullahanDC,dullahanLevel} from "./dullahan.mjs";
import {dullahanGm,dullahanExpense,dullahanTargets,dullahanPulse} from "./dullahan-use.mjs";
import {askOwner,confirmOwner} from "../shared/owner-prompts.mjs";
import {applyNativeOnce} from "../shared/native-applications.mjs";
import {useNativeUtility} from "../shared/native-actions.mjs";
import {encounterForScene,combatTurnSnapshot} from "../shared/combat-flow.mjs";
import {areaActivityData} from "../shared/area-definitions.mjs";
import {useAreaActivity} from "../shared/area-activities.mjs";
import {addDullahanBurn,cleanupDullahanBurns} from "./dullahan-burning.mjs";
export function dullahanSkullMoment(source){const combat=encounterForScene(source.parent,source);if(!combat)return null;const s=combatTurnSnapshot(combat);return `${s.id}:${s.current.round}:${s.current.turn}`;}
export async function useDullahanSkulls(actor,activity,source,requestId){const moment=dullahanSkullMoment(source);
  if(moment&&dullahanState(actor).skullMoment===moment)throw Error("Пылающие черепа уже заменили одну атаку в этом ходу.");
  if(!await confirmOwner(dullahanGm(actor),"Пылающие черепа: одна атака","Это замена одной атаки действием Атака, не дополнительное бесплатное действие? GM подтверждает обход углов; вне боя — допустимость применения."))return false;
  const spec={shape:"sphere",size:20,origin:"point",maxRange:90,save:"dex",dc:String(dullahanDC(actor)),damage:[{formula:"8d6",type:"fire"}],onSave:"half",native:true,templateSeconds:null};
  const data=areaActivityData(activity.toObject(),spec);Object.assign(data,dullahanExpense(activity,{activation:"special"}));data.flags={[MODULE_ID]:{action:"",dullahanResolved:true,area:spec}};
  const clone=activity.item.clone({system:{activities:{[activity.id]:data}}},{keepId:true});
  return applyNativeOnce(actor,{requestId,action:"dullahan-skulls",activityUuid:activity.uuid},async()=>{
    if(moment)await patchDullahan(actor,{skullMoment:moment,skullRequestId:requestId});
    const result=await useAreaActivity(clone.system.activities.get(activity.id),{reportOutcome:true,usage:{midiOptions:{workflowOptions:{grimgutzDullahan:true}}}});
    if(moment&&(result===false||result?.aborted)&&dullahanState(actor).skullRequestId===requestId)await patchDullahan(actor,{skullMoment:null,skullRequestId:null});return result;
  },async workflow=>{
    if(!workflow.grimgutzAreaResult||!(workflow.failedSaves instanceof Set))return {status:"needs-review"};if(moment)await patchDullahan(actor,{skullMoment:moment});
    for(const t of workflow.failedSaves){const target=t.document??t;if(target.actor)await addDullahanBurn(source,target,activity.item,{kind:"skulls"});}
    for(const uuid of workflow.grimgutzAreaResult.templateUuids??[])await (await fromUuid(uuid))?.delete();return true;
  });
}
export async function useDullahanHowl(actor,activity,source,requestId){const targets=await dullahanTargets(actor,source,10,"Получатели Воя Безголосого",{max:100});if(!targets?.length)return false;
  return applyNativeOnce(actor,{requestId,action:"dullahan-howl",activityUuid:activity.uuid},()=>useNativeUtility(activity,{dataPatch:dullahanExpense(activity,{cost:1})}),async()=>{
    const result=await dullahanPulse(source,activity.item,targets,{save:"wis",damage:[{formula:"3d10",type:"psychic"}],onSave:"half",requestId});if(result.status!=="success")return {status:"needs-review"};
    const amount=result.failedSaves.length*dullahanLevel(actor),current=Number(actor.system.attributes.hp.temp??0);if(amount>current)await actor.update({"system.attributes.hp.temp":amount});return true;
  });
}
export async function useDullahanGaze(actor,activity,source,requestId){const targets=await dullahanTargets(dullahanGm(actor),source,1000000,"GM: видимая цель Испепеляющего взгляда"),target=targets?.[0];if(!target)return false;
  const activation=await askOwner(dullahanGm(actor),{title:"Испепеляющий взгляд: стоимость в PDF не задана",label:"Видимость и допустимую дистанцию подтверждает GM",choices:[["action","По решению GM — действие"],["special","Действие учтено вручную GM"]]});if(!["action","special"].includes(activation))return false;
  const previous=[...(actor.concentration?.effects??[])];if(previous.length&&!await confirmOwner(actor,"Концентрация взгляда","При подтверждённом применении завершить предыдущую концентрацию? Отмена сейчас её сохранит."))return false;
  return applyNativeOnce(actor,{requestId,action:"dullahan-gaze",activityUuid:activity.uuid},()=>useNativeUtility(activity,{dataPatch:dullahanExpense(activity,{activation,cost:1})}),async()=>{
    if([...(actor.concentration?.effects??[])].some(e=>!previous.some(p=>p.uuid===e.uuid)))return {status:"needs-review"};
    for(const e of previous)await actor.endConcentration(e);await cleanupDullahanBurns();
    const concentration=await actor.beginConcentrating(activity.clone({duration:{concentration:true,value:"",units:"spec",override:true}}),{duration:{value:null,units:"seconds",expiry:null,expired:false},flags:{[MODULE_ID]:{dullahanGaze:requestId},dae:{expiryMode:"delete"}}});if(!concentration)return {status:"needs-review"};
    const result=await dullahanPulse(source,activity.item,[target],{save:"wis",requestId});if(result.status!=="success")return {status:"needs-review"};const burn=result.failedSaves.includes(target.uuid)&&await addDullahanBurn(source,target,activity.item,{kind:"gaze",concentrationUuid:concentration.uuid});if(!burn)await actor.endConcentration(concentration);return true;
  });
}
