import {MODULE_ID} from "../shared/constants.mjs";
import {factoryState,patchFactory,factoryLevel,factoryDC,factoryContext,factoryInstalledItem} from "./factory.mjs";
import {factoryGm,factoryExpense,factoryTargets,factoryPulse} from "./factory-use.mjs";
import {askOwner,confirmOwner} from "../shared/owner-prompts.mjs";
import {applyNativeOnce} from "../shared/native-applications.mjs";
import {useNativeUtility} from "../shared/native-actions.mjs";
import {areaActivityData} from "../shared/area-definitions.mjs";
import {useAreaActivity} from "../shared/area-activities.mjs";
import {inFeet} from "../shared/combat-benefits.mjs";
export async function factoryArc(actor,activity,source,requestId){if(factoryState(actor).arcReady===false)throw Error("Электрическая дуга ещё не перезарядилась.");const initial=await factoryTargets(actor,source,1000000,"Цель подтверждённого рукопашного попадания"),first=initial?.[0];if(!first)return false;
  if(!await confirmOwner(factoryGm(actor),"Электрическая дуга: попадание","Именно по первой цели подтверждено рукопашное попадание? Объекты без Actor обрабатываются GM отдельно. Разряд не создаёт новой бесплатной атаки."))return false;
  const tier=factoryLevel(actor),targets=[first];for(let i=0;i<tier;i++){const previous=targets.at(-1),candidates=[...(source.parent.tokens??[])].filter(t=>t.actor&&!targets.some(x=>x.uuid===t.uuid)&&inFeet(previous,t,10,source.parent));
    const uuid=await askOwner(actor,{title:`Дуга: следующая цель ${i+1}/${tier} (10 футов от предыдущей)`,choices:[["finish","Завершить цепочку"],...candidates.filter(t=>!t.hidden||t.actor.testUserPermission?.(game.user,"OWNER")||game.user.isGM).map(t=>[t.uuid,t.name??t.actor.name])]});if(uuid==null)return false;if(uuid==="finish")break;const next=candidates.find(t=>t.uuid===uuid);if(!next)return false;targets.push(next);
  }
  if(!await confirmOwner(actor,"Выпустить Электрическую дугу",`Дополнительный урон ${tier}к8 первой цели и DEX для ${targets.length-1} последующих целей; затем нужна перезарядка к6. Применить?`))return false;
  return applyNativeOnce(actor,{requestId,action:"factory-arc",activityUuid:activity.uuid},async()=>{await patchFactory(actor,{arcReady:false,arcRequest:requestId});return true;},async()=>{
    const hit=await factoryPulse(source,activity.item,[first],{damage:[{formula:`${tier}d8`,type:"lightning"}],requestId:`${requestId}:first`,metadata:{factoryArc:true}});if(hit.status==="needs-review")return hit;
    if(targets.length>1){const result=await factoryPulse(source,activity.item,targets.slice(1),{save:"dex",damage:[{formula:`${tier}d8`,type:"lightning"}],onSave:"none",requestId:`${requestId}:chain`,metadata:{factoryArc:true}});if(result.status!=="success")return {status:"needs-review"};}return true;
  });
}
export async function factoryStomp(actor,activity,source,record,requestId){if(!await confirmOwner(factoryGm(actor),"Силовые топтуны","Удар происходит по земле. GM ведёт отбрасывание на 10 футов и срок труднопроходимой местности: в PDF он не задан. Область не наносит повторный урон за перемещение."))return false;
  const ctx=factoryContext(actor,record),spec={shape:"sphere",size:20,origin:"self",excludeSelf:true,save:"str",dc:String(ctx.dc),damage:[{formula:"4d6",type:"bludgeoning"}],onSave:"none",native:true,templateSeconds:null};
  const data=areaActivityData(activity.toObject(),spec);data.flags={[MODULE_ID]:{factoryResolved:true,action:"",area:spec}};const clone=activity.item.clone({system:{activities:{[activity.id]:data}}},{keepId:true});return applyNativeOnce(actor,{requestId,action:"factory-stomp",activityUuid:activity.uuid},()=>useAreaActivity(clone.system.activities.get(activity.id),{reportOutcome:true}),async workflow=>{
    if(!workflow.grimgutzAreaResult)return {status:"needs-review"};for(const uuid of workflow.grimgutzAreaResult.templateUuids??[]){const zone=await fromUuid(uuid);if(zone)await zone.update({name:"Силовые топтуны: местность (срок GM)",[`flags.${MODULE_ID}.factoryTerrain`]:{sourceActorUuid:actor.uuid,requestId},[`flags.${MODULE_ID}.zoneExpiresAt`]:null});}return true;
  });
}
export async function factoryThreatReport(actor,source,record){const range=60+(record.senses?20:0);if(!await confirmOwner(factoryGm(actor),"Обнаружение угроз: сведения GM","Использовано действие; показать GM местоположение существ текущей сцены, кроме конструктов/нежити, до конца следующего хода? Скрытые токены не становятся видимыми игрокам автоматически."))return false;
  const rows=[...(source.parent.tokens??[])].filter(t=>t.actor&&! ["construct","undead"].includes(t.actor.system.details?.type?.value)&&inFeet(source,t,range,source.parent));await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor}),whisper:[...game.users].filter(u=>u.isGM).map(u=>u.id),content:`<p>Обнаружение угроз: ${range} футов, до конца следующего хода.</p><ul>${rows.map(t=>`<li>${foundry.utils.escapeHTML(t.name??t.actor.name)}: ${Number(t.x)}, ${Number(t.y)}</li>`).join("")}</ul>`});return true;
}
