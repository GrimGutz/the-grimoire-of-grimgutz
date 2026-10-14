import {MODULE_ID} from "../shared/constants.mjs";
import {enabled,automationData,notify} from "../shared/helpers.mjs";
import {dullahanAvailable,dullahanState,patchDullahan,dullahanLevel,dullahanDC,dullahanPactWaives} from "./dullahan.mjs";
import {dullahanGm,dullahanTargets} from "./dullahan-use.mjs";
import {askOwner,confirmOwner} from "../shared/owner-prompts.mjs";
import {registerGmRequest,requestGm,isGmAuthority} from "../shared/gm-requests.mjs";
import {serialMutation} from "../shared/transactions.mjs";
import {nativeApplicationReply} from "../shared/native-applications.mjs";
import {useDullahanOath,confirmDullahanOathDeath,witherDullahanOath,commandDullahanPawn} from "./dullahan-oath.mjs";
import {controlDullahanMount} from "./dullahan-mounts.mjs";
import {useDullahanSkulls,useDullahanHowl,useDullahanGaze} from "./dullahan-areas.mjs";
import {summonDullahanHeads,dismissDullahanHeads} from "./dullahan-summons.mjs";
import {runDullahanFortitude,useDullahanHeadHunter} from "./dullahan-combat.mjs";
import {dullahanRebirth,dullahanMists,dullahanProphecy} from "./dullahan-rituals.mjs";
registerGmRequest("dullahan-action",(actor,data,{requestId})=>serialMutation(`dullahan-action:${actor.uuid}`,async()=>{
  if(!enabled()||!isGmAuthority())return false;const old=nativeApplicationReply(actor,requestId);if(old)return old;const activity=await fromUuid(data.activityUuid);if(activity?.actor?.uuid!==actor.uuid||!dullahanAvailable(actor,activity.item))return false;
  const op=automationData(activity).dullahanOperation;
  if(op==="status"){const s=dullahanState(actor);notify(`Дуллахан ${dullahanLevel(actor)}; Сл ${dullahanDC(actor)}; клятва ${s.oath?(s.oath.deathConfirmed?"цель погибла, нужен LR":s.oath.withered?"увядает":"действует"):"готова"}.`);return true;}
  if(op==="oath-death")return confirmDullahanOathDeath(actor);if(op==="broken")return witherDullahanOath(actor);
  if(["guise","reveal"].includes(op)){
    if(op==="guise"&&!dullahanPactWaives(actor)&&(actor.statuses?.has("unconscious")||actor.concentration?.effects?.size))throw Error("Концентрация/бессознательность раскрывают истинную форму.");await patchDullahan(actor,{appearance:op==="guise"?"humanoid":"true"});return true;
  }
  if(["rebirth-start","rebirth"].includes(op))return dullahanRebirth(actor,op);
  if(op==="fortitude"){
    const amount=await askOwner(dullahanGm(actor),{kind:"number",title:"Стойкость: подтверждённый полученный урон",min:1,max:100000,defaultValue:1});if(!Number.isFinite(amount)||amount<1)return false;
    const type=await askOwner(dullahanGm(actor),{title:"Тип полученного урона",choices:[["normal","Без излучения"],["radiant","Содержал излучение"]]});if(!["normal","radiant"].includes(type))return false;return runDullahanFortitude(actor,{amount,radiant:type==="radiant",requestId});
  }
  if(op==="prophecy"||op==="sending")return dullahanProphecy(actor,activity,op,requestId);
  if(op==="dismiss-heads")return dismissDullahanHeads(actor);
  const source=await fromUuid(data.sourceUuid);if(source?.actor?.uuid!==actor.uuid||!canvas.ready||canvas.scene?.id!==source.parent.id)throw Error("Выберите токен Дуллахана; активный GM должен открыть его сцену до расхода.");
  if(op==="oath")return useDullahanOath(actor,activity,source,requestId);
  if(["mount","ride","dismount","release-mount"].includes(op))return controlDullahanMount(actor,activity,source,op,requestId);
  if(op==="skulls")return useDullahanSkulls(actor,activity,source,requestId);if(op==="howl")return useDullahanHowl(actor,activity,source,requestId);if(op==="gaze")return useDullahanGaze(actor,activity,source,requestId);
  if(op==="heads")return summonDullahanHeads(actor,activity,source,requestId);if(op==="headhunter")return useDullahanHeadHunter(actor,activity,source,requestId);
  if(["mists","mist-report","end-mists"].includes(op))return dullahanMists(actor,activity,source,op,requestId);
  if(op==="pawn"||op==="end-pawn")return commandDullahanPawn(actor,source,op);
  if(op==="clear-scar"){
    const targets=await dullahanTargets(dullahanGm(actor),source,1000000,"GM: снять уменьшение максимума"),target=targets?.[0];if(!target)return false;
    if(!await confirmOwner(dullahanGm(actor),"Снять следы Нервирующего пламени","Подтверждено снятие уменьшения максимума? В PDF нет автоматического отдыха восстановления. Чужие уменьшения и текущие HP не меняются."))return false;
    for(const e of [...target.actor.effects])if(e.getFlag?.(MODULE_ID,"dullahanScar")?.sourceActorUuid===actor.uuid)await e.delete();return true;
  }return false;
}));
const pending=new Map();
export function controlDullahan(actor,activity){const key=`${actor.uuid}:${activity.uuid}`;if(pending.has(key))return pending.get(key);const source=canvas.tokens?.controlled?.map(t=>t.document).find(t=>t.actor?.uuid===actor.uuid)??canvas.tokens?.placeables?.map(t=>t.document).find(t=>t.actor?.uuid===actor.uuid);
  const task=requestGm("dullahan-action",actor,{activityUuid:activity.uuid,sourceUuid:source?.uuid},{timeoutMs:180000}).finally(()=>pending.delete(key));pending.set(key,task);return task;
}
