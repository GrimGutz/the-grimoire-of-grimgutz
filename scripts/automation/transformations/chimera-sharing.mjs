import {MODULE_ID} from "../shared/constants.mjs";
import {CHIMERA_FEATURES} from "../shared/chimera-definitions.mjs";
import {askOwner,confirmOwner} from "../shared/owner-prompts.mjs";
import {chimeraGm} from "./chimera-choices.mjs";
import {chimeraHas,chimeraItem,chimeraLevelFor,chimeraShared,syncChimera} from "./chimera.mjs";
import {chimeraTargets,chimeraExpense} from "./chimera-use.mjs";
import {applyNativeOnce} from "../shared/native-applications.mjs";
import {useNativeUtility} from "../shared/native-actions.mjs";
import {isGmAuthority} from "../shared/gm-requests.mjs";
export function chimeraShareFingerprint(item){const d=item.toObject();delete d._id;delete d.folder;delete d.sort;delete d.ownership;delete d._stats;if(d.system?.uses)delete d.system.uses.spent;if(d.flags?.[MODULE_ID])delete d.flags[MODULE_ID].chimeraShared;return JSON.stringify(d);}
export async function shareChimera(actor,activity,source,requestId){const targets=await chimeraTargets(actor,source,30,"Согласный получатель бонуса Химеры");const target=targets?.[0];if(!target)return false;
  const boons=CHIMERA_FEATURES.filter(e=>!e.flaw&&chimeraHas(actor,e.id)&&!chimeraHas(target.actor,e.id));
  const id=await askOwner(actor,{title:"Передать один собственный бонус",choices:boons.map(e=>[e.id,e.name])}),boon=boons.find(e=>e.id===id);if(!boon)return false;
  if(!await confirmOwner(chimeraGm(actor),"Поделиться амальгамой","Цель добровольно согласилась? Получит только этот бонус на 8 часов со своими CON и ресурсами, не всю трансформацию."))return false;
  return applyNativeOnce(actor,{requestId,action:"chimera-share",activityUuid:activity.uuid},()=>useNativeUtility(activity,{dataPatch:chimeraExpense(activity,{cost:1})}),async()=>{
    if(chimeraHas(target.actor,id))return {status:"needs-review"};const data=chimeraItem(actor,id).toObject();delete data._id;data.folder=null;data.effects=[];
    if(data.system.uses)data.system.uses.spent=0;data.flags??={};data.flags[MODULE_ID]??={};
    data.flags[MODULE_ID].chimeraShared={ownerUuid:actor.uuid,expiresAt:Number(game.time.worldTime)+28800,tier:chimeraLevelFor(actor,id),requestId};
    const [made]=await target.actor.createEmbeddedDocuments("Item",[data]);if(!made)return {status:"needs-review"};
    await made.setFlag(MODULE_ID,"chimeraShared",{...chimeraShared(made),fingerprint:chimeraShareFingerprint(made)});await syncChimera(target.actor);return true;
  });
}
export async function expireChimeraShares(actor){if(!isGmAuthority())return;
  for(const item of [...(actor.items??[])]){const state=chimeraShared(item);if(!state||state.disabled||Number(state.expiresAt)>Number(game.time.worldTime))continue;
    if(state.fingerprint===chimeraShareFingerprint(item))await item.delete();
    else await item.setFlag(MODULE_ID,"chimeraShared",{...state,disabled:true,needsReview:"Срок истёк; ручные правки сохранены"});
  }await syncChimera(actor);
}
