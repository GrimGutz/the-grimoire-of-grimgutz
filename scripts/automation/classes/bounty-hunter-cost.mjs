import {MODULE_ID} from "../shared/constants.mjs";
import {itemUses,automationData} from "../shared/helpers.mjs";
import {hunterPool,hunterFeatureAvailable,selectedHunterTrophy} from "./bounty-hunter.mjs";
import {trophyDefinition} from "../shared/bounty-hunter-definitions.mjs";
import {useNativeUtility} from "../shared/native-actions.mjs";

export function hunterExpenseData(activity,{cost=null,activation="special"}={}) {
  const actor=activity?.actor,item=activity?.item,definition=trophyDefinition(item),pool=hunterPool(actor);
  if(!actor||!pool||!hunterFeatureAvailable(actor,item))throw Error("Нет способности/общего запаса Охотника.");
  if(definition && (definition.passive||!selectedHunterTrophy(actor,definition.key)?.item||selectedHunterTrophy(actor,definition.key).item.id!==item.id))throw Error("Активный трофей не выбран, утрачен или недоступен.");
  const amount=cost??definition?.cost??0;
  if(!Number.isInteger(amount)||amount<0||itemUses(pool).remaining<amount)throw Error("Недостаточно использований общего запаса.");
  return {activation:{type:activation,value:activation==="special"?0:1,override:true},
    consumption:{targets:amount?[{type:"itemUses",target:pool.id,value:String(amount),scaling:{mode:"",formula:""}}]:[],spellSlot:false,scaling:{allowed:false,max:""}}};
}
export function useHunterCost(activity,options={}) {return useNativeUtility(activity,{dataPatch:hunterExpenseData(activity,options)});}
export function hunterNativeActivity(activity,patch,options={}) {
  const data=activity.toObject(),expense=hunterExpenseData(activity,options);
  Object.assign(data,expense,patch);delete data.roll;
  data.flags={...data.flags,[MODULE_ID]:{...automationData(activity),action:"",moduleAction:"",leaderResolved:true,hunterResolved:true}};
  const item=activity.item.clone({system:{activities:{[activity.id]:data}},"flags.midi-qol.syntheticItem":true},{keepId:true});
  return item.system.activities.get(activity.id);
}
export async function useHunterNative(activity,patch,targets,options={}) {
  const resolved=hunterNativeActivity(activity,patch,options);
  if(!globalThis.MidiQOL?.completeActivityUse)throw Error("Для применения нужен Midi-QOL.");
  return MidiQOL.completeActivityUse(resolved,{create:{measuredTemplate:false},midiOptions:{targetUuids:targets.map(t=>t.document?.uuid??t.uuid),
    workflowOptions:{ignoreUserTargets:true,targetConfirmation:"none",noOnUseMacro:true}}},{configure:false});
}
