import {MODULE_ID} from "../shared/constants.mjs";
import {enabled} from "../shared/helpers.mjs";
import {dullahanHas,dullahanState,patchDullahan,syncDullahan} from "./dullahan.mjs";
import {dullahanGm,dullahanExpense,dullahanTargets} from "./dullahan-use.mjs";
import {askOwner,confirmOwner} from "../shared/owner-prompts.mjs";
import {applyNativeOnce} from "../shared/native-applications.mjs";
import {useNativeUtility} from "../shared/native-actions.mjs";
import {registerGmRequest,isGmAuthority} from "../shared/gm-requests.mjs";
import {serialMutation} from "../shared/transactions.mjs";
async function removeOathMark(actor,oath){const target=await fromUuid(oath?.targetActorUuid);for(const e of [...(target?.effects??[])])if(e.getFlag?.(MODULE_ID,"dullahanOath")?.sourceActorUuid===actor.uuid)await e.delete();}
export async function useDullahanOath(actor,activity,source,requestId){if(dullahanState(actor).oath)throw Error("Текущая клятва ещё не завершена. Нужны подтверждённая смерть цели и последующий продолжительный отдых.");
  const targets=await dullahanTargets(actor,source,60,"Имя и цель Клятвы охотника"),target=targets?.[0];if(!target)return false;
  if(!await confirmOwner(actor,"Клятва охотника",`Вы знаете имя выбранной цели ${target.name}? До её смерти и следующего LR новая клятва будет недоступна.`))return false;
  return applyNativeOnce(actor,{requestId,action:"dullahan-oath",activityUuid:activity.uuid},()=>useNativeUtility(activity,{dataPatch:dullahanExpense(activity,{activation:"bonus"})}),async()=>{
    // The owner's actor is readable by the player: do not snapshot hidden NPC
    // statistics there before they are needed for the confirmed curse.
    const oath={id:requestId,targetActorUuid:target.actor.uuid,targetTokenUuid:target.uuid,sourceTokenUuid:source.uuid,sceneId:source.parent.id,startedAt:Number(game.time.worldTime),cr:null,deathConfirmed:false,withered:false};
    await patchDullahan(actor,{oath});await target.actor.createEmbeddedDocuments("ActiveEffect",[{name:`Клятва охотника: ${actor.name}`,img:activity.item.img,type:"base",disabled:false,transfer:false,origin:activity.item.uuid,statuses:[],start:null,duration:{value:null,units:"seconds",expiry:null,expired:false},flags:{[MODULE_ID]:{dullahanOath:{sourceActorUuid:actor.uuid,oathId:requestId}}},system:{changes:[]}}]);return true;
  });
}
export async function confirmDullahanOathDeath(actor){const oath=dullahanState(actor).oath;if(!oath||oath.deathConfirmed)return false;
  if(!await confirmOwner(dullahanGm(actor),"GM: заклятая цель погибла","Подтверждена настоящая смерть именно этой цели клятвы, не бессознательность/0 HP/падение временных хитов? Увядание снимется, но новая клятва потребует последующего LR."))return false;
  await patchDullahan(actor,{oath:{...oath,deathConfirmed:true,deathAt:Number(game.time.worldTime)}});await removeOathMark(actor,oath);await syncDullahan(actor);return true;
}
export async function witherDullahanOath(actor){const oath=dullahanState(actor).oath;if(!oath||oath.deathConfirmed||!dullahanHas(actor,"broken"))return false;
  if(Number(game.time.worldTime)<=Number(oath.startedAt)+86400)throw Error("После клятвы ещё не прошло более 24 игровых часов.");
  if(!await confirmOwner(dullahanGm(actor),"GM: Нарушенная клятва","Заклятая цель действительно жива более 24 часов? Это не подтверждение по одному значению HP; погибшая цель отмечается отдельной кнопкой."))return false;
  const target=await fromUuid(oath.targetActorUuid),known=oath.cr??target?.system.details?.cr,cr=known==null?await askOwner(dullahanGm(actor),{kind:"number",title:"GM: УС заклятой цели неизвестен",label:"У персонажей нет автоматического УС. Укажите согласованное значение, не подмену нулём.",min:0,max:100,defaultValue:0}):Number(known);if(!Number.isFinite(cr)||cr<0)return false;
  await patchDullahan(actor,{oath:{...oath,cr,withered:true,penaltyMode:"sum"}});await syncDullahan(actor);return true;
}
registerGmRequest("dullahan-rest",(actor,data,{requestId})=>serialMutation(`dullahan-rest:${actor.uuid}`,async()=>{
  if(!enabled()||!isGmAuthority()||!data.long)return false;
  return applyNativeOnce(actor,{requestId,action:"dullahan-rest",activityUuid:null},async()=>true,async()=>{const oath=dullahanState(actor).oath;
    if(oath?.deathConfirmed){await removeOathMark(actor,oath);await patchDullahan(actor,{oath:null});await syncDullahan(actor);}return true;});
}));
export async function commandDullahanPawn(actor,source,operation){if(operation==="end-pawn"){
    if(!await confirmOwner(dullahanGm(actor),"GM: завершить приказ","Приказ исполнен, владелец головы погиб либо погиб Дуллахан? Предыдущие недостатки снова действуют, если их условия сохраняются."))return false;await patchDullahan(actor,{pawn:null});await syncDullahan(actor);return true;
  }
  const targets=await dullahanTargets(dullahanGm(actor),source,1000000,"GM: владелец головы Дуллахана"),holder=targets?.[0];if(!holder)return false;
  if(!await confirmOwner(dullahanGm(actor),"GM: Безголовый Пешка","Существо действительно держит голову, отдало один действующий приказ, и Дуллахан ещё его выполняет? Права игроков и автоматическое подчинение токена не меняются."))return false;
  await patchDullahan(actor,{pawn:{active:true,holderActorUuid:holder.actor.uuid,holderTokenUuid:holder.uuid}});await syncDullahan(actor);return true;
}
