import {MODULE_ID} from "../shared/constants.mjs";
import {enabled,automationData,notify,findFeature} from "../shared/helpers.mjs";
import {registerGmRequest,requestGm,isGmAuthority} from "../shared/gm-requests.mjs";
import {serialMutation} from "../shared/transactions.mjs";
import {nativeApplicationReply,applyNativeOnce} from "../shared/native-applications.mjs";
import {askOwner,confirmOwner} from "../shared/owner-prompts.mjs";
import {canReact,recordModuleReaction} from "../shared/combat-benefits.mjs";
import {ilAvailable,ilState,ilPatch,ilLevel,ilDC,ilCharLevel} from "./illithid.mjs";
import {ilGm,useIlCost} from "./illithid-use.mjs";
import {extractIllithidBrain,illithidHorizon,illithidBlast,illithidMelody,releaseIllithidMelody} from "./illithid-areas.mjs";
import {configureIllithid,feedIllithid,illithidHungerDeath,watchIllithidSupreme} from "./illithid-choices.mjs";
import {summonIllithidDevourer,dismissIllithidDevourer} from "./illithid-summons.mjs";
import {activateIllithidRefuge,endIllithidRefuge,useIllithidRefuge} from "./illithid-refuge.mjs";
import {castIllithidProbe} from "./illithid-spells.mjs";
import {runIllithidEvent} from "./illithid-events.mjs";
registerGmRequest("illithid-action",(actor,data,{requestId})=>serialMutation(`illithid-action:${actor.uuid}`,async()=>{if(!enabled()||!isGmAuthority())return false;const old=nativeApplicationReply(actor,requestId);if(old)return old;const activity=await fromUuid(data.activityUuid);if(activity?.actor?.uuid!==actor.uuid||!ilAvailable(actor,activity.item))return false;const op=automationData(activity).illithidOperation;
  if(op==="status"){notify(`Иллитид ${ilLevel(actor)}, Сл ${ilDC(actor)}. Дополнительный тип: Аберрация; исходный тип сохраняется.`);return true;}
  if(op==="rules")return configureIllithid(actor);if(op==="feed")return feedIllithid(actor);if(op==="hunger-death")return illithidHungerDeath(actor);if(op==="supreme-watch")return watchIllithidSupreme(actor);
  if(op==="guise"||op==="reveal"){if(op==="guise"&&(actor.statuses?.has?.("unconscious")||actor.concentration?.effects?.size))throw Error("Нельзя скрыть истинный облик сейчас.");await ilPatch(actor,{appearance:op==="guise"?"humanoid":"true"});return true;}
  if(op==="restore-counter"){if(!await confirmOwner(ilGm(actor),"Восстановить Превосходство","GM подтверждает восстановление по выбранному правилу стола либо служебное исправление? PDF не задаёт отдых."))return false;await activity.item.update({"system.uses.spent":0});return true;}
  const source=await fromUuid(data.sourceUuid);if(source?.actor?.uuid!==actor.uuid||!canvas.ready||canvas.scene?.id!==source.parent.id)throw Error("Выберите токен Иллитидa; активный GM должен открыть его сцену до расхода.");
  if(op==="extract")return extractIllithidBrain(actor,activity,source,requestId);if(op==="horizon")return illithidHorizon(actor,activity,source,requestId);if(op==="blast")return illithidBlast(actor,activity,source,requestId);
  if(op==="melody")return illithidMelody(actor,activity,source,requestId);if(op==="release")return releaseIllithidMelody(actor,activity,source,requestId);if(op==="summon")return summonIllithidDevourer(actor,activity,source,requestId);if(op==="dismiss")return dismissIllithidDevourer(actor);
  if(op==="refuge")return activateIllithidRefuge(actor,activity,source,requestId);if(op==="end-refuge")return endIllithidRefuge(actor);if(op==="exchange")return useIllithidRefuge(actor);
  if(op==="detect-thoughts"||op==="dominate")return castIllithidProbe(actor,activity,requestId,{dominate:op==="dominate"});
  if(op==="counter"){if(!canReact(actor)||!await confirmOwner(ilGm(actor),"Ручное аннулирование вне Midi","GM подтверждает конкретное вражеское заклинание в 30 футах, нацеленное на Иллитидa, с уровнем не выше БМ? Вне поддерживаемого потока отмену проводит GM; этот расход не запускайте после уже сработавшей реакции."))return false;return applyNativeOnce(actor,{requestId,action:"illithid-manual-counter",activityUuid:activity.uuid},()=>useIlCost(activity,{cost:1,activation:"reaction"}),async()=>{await recordModuleReaction(actor,source.parent);return true;});}
  if(op==="call"){if(!await confirmOwner(ilGm(actor),"Зов Старшего вне Midi","Подтверждена естественная 1 против магии вне поддерживаемого потока? Если урон уже прошёл автоматически, НЕ повторяйте его этой кнопкой."))return false;return applyNativeOnce(actor,{requestId,action:"illithid-manual-call",activityUuid:activity.uuid},async()=>true,()=>runIllithidEvent({id:requestId,operation:"call",sceneId:source.parent.id,sourceTokenUuid:source.uuid,sourceItemUuid:activity.item.uuid,dice:Math.floor(ilCharLevel(actor)/2)}));}
  return false;
}));
const pending=new Map();
export function controlIllithid(actor,activity){const key=`${actor.uuid}:${activity.uuid}`;if(pending.has(key))return pending.get(key);const source=canvas.tokens?.controlled?.map(t=>t.document).find(t=>t.actor?.uuid===actor.uuid)??canvas.tokens?.placeables?.map(t=>t.document).find(t=>t.actor?.uuid===actor.uuid);const task=requestGm("illithid-action",actor,{activityUuid:activity.uuid,sourceUuid:source?.uuid},{timeoutMs:180000}).finally(()=>pending.delete(key));pending.set(key,task);return task;}
