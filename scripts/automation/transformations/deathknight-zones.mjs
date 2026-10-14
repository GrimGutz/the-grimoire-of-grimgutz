import {MODULE_ID} from "../shared/constants.mjs";
import {dkDC,dkHas,dkState,dkPatch} from "./deathknight.mjs";
import {dkExpense,dkGm} from "./deathknight-use.mjs";
import {confirmOwner} from "../shared/owner-prompts.mjs";
import {applyNativeOnce} from "../shared/native-applications.mjs";
import {useNativeUtility} from "../shared/native-actions.mjs";
import {areaActivityData} from "../shared/area-definitions.mjs";
import {useAreaActivity} from "../shared/area-activities.mjs";
import {temporaryEffectTiming} from "../effects/temporary-effects.mjs";
export async function useDeathknightFireball(actor,activity,source,requestId){if(!await confirmOwner(dkGm(actor),activity.item.name,"Точка видима в 120 футах; радиус 20 футов обходит углы? Погибших/трупы в сфере GM подтверждает отдельно; обычный 0 HP не означает смерть."))return false;
  const spec={shape:"sphere",size:20,origin:"point",maxRange:120,save:"dex",dc:String(dkDC(actor)),damage:[{formula:"10d6",type:"fire"},{formula:"10d6",type:"necrotic"}],onSave:"half",native:true,templateSeconds:null};
  const data=areaActivityData(activity.toObject(),spec);Object.assign(data,dkExpense(activity,{cost:1}));data.flags={[MODULE_ID]:{action:"",deathknightResolved:true,deathknightFireball:true,area:spec}};
  const clone=activity.item.clone({system:{activities:{[activity.id]:data}}},{keepId:true});return applyNativeOnce(actor,{requestId,action:"deathknight-fireball",activityUuid:activity.uuid},()=>useAreaActivity(clone.system.activities.get(activity.id),{reportOutcome:true}),async workflow=>{
    if(!workflow.grimgutzAreaResult)return {status:"needs-review"};await dkPatch(actor,{lastFireball:{requestId,sceneId:source.parent.id,targets:workflow.grimgutzAreaResult.targetTokenUuids??[...(workflow.targets??[])].map(t=>t.document?.uuid??t.uuid)}});
    for(const uuid of workflow.grimgutzAreaResult.templateUuids??[]){const zone=await fromUuid(uuid);if(zone)await zone.delete();}return true;
  });
}
export async function useDeathknightSmog(actor,activity,source,requestId){const data=activity.toObject();data.target={...data.target,override:true,template:{type:"cube",size:"15",units:"ft",count:"1"}};
  const clone=activity.item.clone({system:{activities:{[activity.id]:data}}},{keepId:true}),previews=game.system.canvas.AbilityTemplate.fromActivity(clone.system.activities.get(activity.id));if(!previews?.length)throw Error("Шаблон квадрата недоступен.");let zone,kept=false;
  try{const placed=await previews[0].drawPreview();zone=(Array.isArray(placed)?placed.flat(Infinity):[placed]).find(Boolean);if(!zone)return false;zone=source.parent.regions?.get?.(zone.id)??zone;
    if(!await confirmOwner(dkGm(actor),"Смертельный смог: размещение","Квадрат действительно 15×15 футов и соприкасается с источником? Обход углов и сильное заслонение проверяет GM, без автоматического ослепления."))return false;
    return await applyNativeOnce(actor,{requestId,action:"deathknight-smog",activityUuid:activity.uuid},()=>useNativeUtility(activity,{dataPatch:dkExpense(activity,{cost:1})}),async()=>{
      await zone.update({name:"Смертельный смог",[`flags.${MODULE_ID}.zoneTemplate`]:true,[`flags.${MODULE_ID}.sourceActor`]:actor.uuid,[`flags.${MODULE_ID}.zoneExpiresAt`]:Number(game.time.worldTime)+60,[`flags.${MODULE_ID}.deathknightSmog`]:{sourceActorUuid:actor.uuid,sourceTokenUuid:source.uuid,sourceItemUuid:activity.item.uuid,dc:dkDC(actor),requestId}});kept=true;return true;
    });
  }finally{if(zone&&!kept)await zone.delete();}
}
export async function endDeathknightSmog(actor,source){for(const zone of [...(source.parent.regions??[]),...(source.parent.templates??[])])if(zone.getFlag?.(MODULE_ID,"deathknightSmog")?.sourceActorUuid===actor.uuid)await zone.delete();return true;}
export async function useDeathknightCrucible(actor,activity,source,requestId,operation){if(operation==="end-crucible"){for(const e of [...actor.effects])if(e.getFlag?.(MODULE_ID,"deathknightCrucible"))await e.delete();return true;}
  if(operation==="expand"){
    const effect=[...(actor.effects??[])].find(e=>e.getFlag?.(MODULE_ID,"deathknightCrucible")&&!e.disabled&&!e.duration?.expired);if(!effect||!dkHas(actor,"crucible"))throw Error("Нет действующего Тигля.");const radius=Number(dkState(actor).crucibleRadius??20);if(radius>=100)return false;
    if(!await confirmOwner(dkGm(actor),"Расширить Тигель","Источник внутри цилиндра и погрузил клинок в землю? В PDF нет отдельного расхода действия на расширение."))return false;await dkPatch(actor,{crucibleRadius:radius+10});return true;
  }
  return applyNativeOnce(actor,{requestId,action:"deathknight-crucible",activityUuid:activity.uuid},()=>useNativeUtility(activity,{dataPatch:dkExpense(activity,{cost:1})}),async()=>{
    for(const old of [...(actor.effects??[])])if(old.getFlag?.(MODULE_ID,"deathknightCrucible"))await old.delete();await dkPatch(actor,{crucibleRadius:20});const [effect]=await actor.createEmbeddedDocuments("ActiveEffect",[{name:"Тигель смерти",img:activity.item.img,type:"base",disabled:false,transfer:false,origin:activity.item.uuid,statuses:[],...temporaryEffectTiming({seconds:60,actor}),flags:{[MODULE_ID]:{deathknightCrucible:{sourceTokenUuid:source.uuid,requestId}}},system:{changes:[]}}]);return Boolean(effect);
  });
}
