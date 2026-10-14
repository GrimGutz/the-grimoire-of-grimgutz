import {MODULE_ID} from "../shared/constants.mjs";
import {automatonState,automatonHas,automatonTransformationLevel,automatonChange,automatonDC} from "./automaton.mjs";
import {askOwner,confirmOwner} from "../shared/owner-prompts.mjs";
import {useNativeUtility} from "../shared/native-actions.mjs";
import {applyNativeOnce} from "../shared/native-applications.mjs";
import {areaActivityData,areaDamagePart} from "../shared/area-definitions.mjs";
import {useAreaActivity} from "../shared/area-activities.mjs";
import {automatonTarget,automatonExpense,automatonPulse,automatonGm,confirmAutomatonGm,automatonDamageType,automatonStateEffect,removeAutomatonStateEffect} from "./automaton-use.mjs";

export function integratedItem(actor){const state=automatonState(actor);if(!state.equipment?.uuid)return null;const item=[...(actor.items??[])].find(i=>i.uuid===state.equipment.uuid);return automatonHas(actor,"equipment")&&item?{item,kind:state.equipment.kind}:null;}
export async function chooseAutomatonEquipment(actor,activity,requestId){
  const candidates=[...(actor.items??[])].filter(i=>i.type==="weapon"||i.type==="equipment"||i.type==="consumable");
  const uuid=await askOwner(actor,{title:"Один встроенный предмет",choices:candidates.map(i=>[i.uuid,i.name])}),item=candidates.find(i=>i.uuid===uuid);if(!item)return false;
  const kind=await askOwner(actor,{title:"Тип вооружения",choices:[["weapon","Оружие"],["shield","Щит"],["staff","Магический посох / палочка"]]});if(!kind)return false;
  if(!await confirmAutomatonGm(actor,"Встроенное вооружение","Предмет соответствует выбранному типу, и только что завершён продолжительный отдых? Предыдущее вооружение будет заменено."))return false;
  return applyNativeOnce(actor,{requestId,action:"automaton-equipment",activityUuid:activity.uuid},async()=>true,async()=>{
    await actor.setFlag(MODULE_ID,"automatonState",{...structuredClone(automatonState(actor)),equipment:{uuid:item.uuid,kind},charges:0,chargeTurn:null});
    await automatonStateEffect(actor,activity.item,"equipment",{description:`Встроен ${item.name}; усиливается только этот предмет.`});return true;
  });
}
export function integratedActive(actor){return Boolean(integratedItem(actor)&&[...(actor.effects??[])].some(e=>e.getFlag?.(MODULE_ID,"automatonStateEffect")==="equipment"&&!e.disabled&&!e.isSuppressed&&!e.duration?.expired));}
export async function useAutomatonEquipment(actor,activity,source,operation,requestId){
  const integrated=integratedItem(actor);if(!integrated||!integratedActive(actor))throw Error("Сначала встроьте подходящий предмет; связанный эффект должен быть активен.");
  const state=automatonState(actor),tier=automatonTransformationLevel(actor);
  if(operation==="equipment-end")return applyNativeOnce(actor,{requestId,action:operation,activityUuid:activity.uuid},async()=>confirmOwner(actor,"Отсоединить предмет","Завершить усиление выбранного предмета?"),async()=>{
    await actor.setFlag(MODULE_ID,"automatonState",{...structuredClone(automatonState(actor)),equipment:null,charges:0});await removeAutomatonStateEffect(actor,"equipment");return true;});
  if(operation==="shield"){
    if(integrated.kind!=="shield")return false;const target=await automatonTarget(actor,source,100000,"Ответ щита: атакующий");if(!target)return false;
    if(!await confirmAutomatonGm(actor,"Ответ щита","Подтверждено, что выбранное существо только что нанесло этому Автоматону урон атакой?"))return false;
    const amount=await askOwner(automatonGm(actor),{kind:"number",title:"Окончательный полученный урон атаки",min:1,max:100000,defaultValue:1});if(!Number.isFinite(amount)||amount<=0)return false;
    const type=await automatonDamageType(actor,"GM: тип ответного урона щита");if(!type)return false;
    return applyNativeOnce(actor,{requestId,action:operation,activityUuid:activity.uuid},()=>useNativeUtility(activity,{dataPatch:automatonExpense(activity,{activation:"reaction"})}),()=>automatonPulse(source,activity.item,[target],{save:"dex",damage:[{formula:String(Math.floor(amount/2)),type}],requestId}));
  }
  if(integrated.kind!=="staff")throw Error("Нужен встроенный магический посох или палочка.");
  if(operation==="charge"){
    if(Number(state.charges??0)>=5)throw Error("Уже накоплено пять зарядов.");
    return applyNativeOnce(actor,{requestId,action:operation,activityUuid:activity.uuid},()=>useNativeUtility(activity,{dataPatch:automatonExpense(activity)}),async()=>{
      const c=game.combat,turn=c?.started?`${c.id}:${c.round}:${c.turn}`:null;
      await actor.setFlag(MODULE_ID,"automatonState",{...structuredClone(automatonState(actor)),charges:Number(state.charges??0)+1,chargeTurn:turn});return true;
    });
  }
  if(operation==="shard"){
    const targets=[];for(let i=0;i<tier-2;i++){
      const target=await automatonTarget(actor,source,120,`Осколок дуговой энергии ${i+1}/${tier-2}`);if(!target)return false;targets.push(target);
    }
    // Every projectile has an independent native attack, but the whole volley
    // uses one action. All target choices happen before the first expense.
    const data=activity.toObject();data.type="attack";delete data.roll;data.activation={type:"action",value:1,override:true};data.consumption={spellSlot:false,targets:[]};
    data.attack={flat:true,bonus:String(Number(actor.system.attributes.prof)+Number(actor.system.abilities.str.mod)),ability:"",type:{value:"ranged",classification:"weapon"}};
    data.damage={includeBase:false,parts:[areaDamagePart({formula:"1d12",type:"force"})]};data.range={value:"120",units:"ft",override:true};
    data.target={...data.target,prompt:false,override:true,affects:{type:"creature",count:"1",choice:false},template:{type:""}};data.flags={[MODULE_ID]:{automatonResolved:true,leaderResolved:true,action:""}};
    return applyNativeOnce(actor,{requestId,action:operation,activityUuid:activity.uuid},async()=>{
      for(const [index,target] of targets.entries()){
        const row=structuredClone(data);if(index)row.activation={type:"special",value:null,override:true};
        const item=activity.item.clone({system:{activities:{[activity.id]:row}}},{keepId:true});
        const result=await MidiQOL.completeActivityUse(item.system.activities.get(activity.id),{midiOptions:{targetUuids:[target.uuid],workflowOptions:{ignoreUserTargets:true,targetConfirmation:"none"}}},{configure:false});
        if(result==null||["pending","needs-review"].includes(result?.status))return {status:"needs-review"};
        if(result===false||result.aborted)return index?{status:"needs-review"}:false;
      }return true;
    },async()=>true);
  }
  if(operation==="beam"){
    if(!Number(state.charges))throw Error("Сначала зарядите снаряд действием.");
    const c=game.combat,turn=c?.started?`${c.id}:${c.round}:${c.turn}`:null;
    if(turn&&turn===state.chargeTurn)throw Error("Разрядка — в один из последующих ходов.");
    if(!await confirmAutomatonGm(actor,"Разрядка","Линия 60 × 5 футов. PDF не задаёт урон при успехе: по умолчанию он отсутствует. Конус с шириной 15 футов на конце проводится GM отдельно. Продолжить линией?"))return false;
    const spec={shape:"line",size:60,width:5,origin:"self",excludeSelf:true,save:"dex",dc:String(automatonDC(actor)),damage:[{formula:`${tier+Math.max(0,Number(state.charges)-1)}d12`,type:"force"}],onSave:"none"};
    const data=areaActivityData(activity.toObject(),spec);data.flags={[MODULE_ID]:{action:"",automatonResolved:true,area:spec}};data.activation={type:"action",value:1,override:true};data.consumption={spellSlot:false,targets:[]};
    const item=activity.item.clone({system:{activities:{[activity.id]:data}}},{keepId:true});
    return applyNativeOnce(actor,{requestId,action:operation,activityUuid:activity.uuid},()=>useAreaActivity(item.system.activities.get(activity.id),{reportOutcome:true}),async()=>{await actor.setFlag(MODULE_ID,"automatonState",{...structuredClone(automatonState(actor)),charges:0,chargeTurn:null});return true;});
  }return false;
}
