import {MODULE_ID} from "../shared/constants.mjs";
import {FACTORY_ICON} from "../shared/factory-definitions.mjs";
import {factoryState,patchFactory,factoryLevel} from "./factory.mjs";
import {factoryChildren} from "./factory-homunculi.mjs";
import {factoryGm,factoryExpense} from "./factory-use.mjs";
import {askOwner,confirmOwner} from "../shared/owner-prompts.mjs";
import {applyNativeOnce} from "../shared/native-applications.mjs";
import {useNativeUtility} from "../shared/native-actions.mjs";
import {temporaryEffectTiming} from "../effects/temporary-effects.mjs";
import {serialMutation} from "../shared/transactions.mjs";
import {recordModuleReaction} from "../shared/combat-benefits.mjs";
export async function chooseFactoryForm(actor){const physical=await askOwner(actor,{title:"Изготовленная форма: +1, предел 16",choices:[["str","Сила"],["dex","Ловкость"]]});if(!["str","dex"].includes(physical))return false;
  const bodyType=await askOwner(actor,{title:"Тип изготовленного тела",choices:[["construct","Конструкт"],["undead","Нежить"]]});if(!["construct","undead"].includes(bodyType))return false;await patchFactory(actor,{physical,bodyType});return true;
}
export async function ascendFactory(actor,activity,source,requestId){if(Number(factoryState(actor).ascensionRests??0)>0)throw Error("Вознесение восстанавливается после записанного числа LR, не по времени суток.");if([...(actor.effects??[])].some(e=>e.getFlag?.(MODULE_ID,"factoryAscension")))throw Error("Форма энергии уже действует.");
  if(!await confirmOwner(factoryGm(actor),"Вознесение: оставленное тело","GM отмечает оставленное тело без сознания в анабиозе; не создаётся второй актёр с бесплатным инвентарём. Вред телу и смену плоскости решает GM. После активации повтор недоступен 1к6 LR."))return false;
  return applyNativeOnce(actor,{requestId,action:"factory-ascension",activityUuid:activity.uuid},()=>useNativeUtility(activity,{dataPatch:factoryExpense(activity)}),async()=>{
    const roll=await new Roll("1d6").evaluate(),rests=Number(roll.total);if(!Number.isInteger(rests)||rests<1||rests>6)throw Error("Некорректный срок 1к6 отдыхов.");await roll.toMessage({speaker:ChatMessage.getSpeaker({actor}),flavor:"Вознесение: LR до следующего применения"});
    await patchFactory(actor,{ascensionRests:rests,ascensionTier:factoryLevel(actor),ascensionBody:{sourceTokenUuid:source.uuid,sceneId:source.parent.id,x:source.x,y:source.y,elevation:source.elevation,requestId}});
    await actor.createEmbeddedDocuments("ActiveEffect",[{name:"Вознесение Омниссии: живая энергия",img:FACTORY_ICON,type:"base",disabled:false,transfer:false,origin:activity.item.uuid,statuses:[],...temporaryEffectTiming({seconds:3600,actor,expiry:"updateWorldTime"}),flags:{[MODULE_ID]:{factoryAscension:true},dae:{expiryMode:"delete"}},system:{changes:[{key:"system.traits.dr.value",type:"add",value:"all",phase:"initial",priority:20},{key:"system.traits.di.value",type:"add",value:"lightning",phase:"initial",priority:20},...["poisoned","grappled"].map(s=>({key:"system.traits.ci.value",type:"add",value:s,phase:"initial",priority:20})),{key:"system.attributes.movement.fly",type:"upgrade",value:String(Number(actor.system.attributes.movement.walk)),phase:"final",priority:40},{key:"system.attributes.movement.hover",type:"override",value:"true",phase:"initial",priority:20}]}}]);return true;
  });
}
export async function endFactoryAscension(actor){return serialMutation(`factory-end-ascension:${actor.uuid}`,async()=>{const body=factoryState(actor).ascensionBody;for(const e of [...(actor.effects??[])])if(e.getFlag?.(MODULE_ID,"factoryAscension"))await e.delete();if(!body)return true;
  const token=await fromUuid(body.sourceTokenUuid);if(token?.parent?.id===body.sceneId)await token.update({x:body.x,y:body.y,elevation:body.elevation});await patchFactory(actor,{ascensionBody:null});return true;
});}
export async function factoryTransfer(actor,source,operation){const state=factoryState(actor);if(operation==="restore-body"){
    if(!state.transferred)return false;if(!await confirmOwner(factoryGm(actor),"Восстановление тела после LR","GM подтвердил полный LR и восстановление исходного тела? Только снять сюжетную отметку переноса; исходные характеристики/инвентарь не будут перезаписаны."))return false;await patchFactory(actor,{transferred:null});return true;
  }
  if(Number(state.transferReadyAt??0)>Number(game.time.worldTime))throw Error("После последнего переноса ещё не прошло 7 игровых дней.");const children=factoryChildren(actor).filter(a=>Number(a.system.attributes.hp.value)>0),uuid=await askOwner(factoryGm(actor),{title:"Живой собственный гомункул для сознания",choices:children.map(a=>[a.uuid,a.name])}),child=children.find(a=>a.uuid===uuid);if(!child)return false;
  if(!await confirmOwner(factoryGm(actor),"Машина бессмертна: настоящая смерть","Подтверждена настоящая смерть, а не просто 0 HP, и разрешена реакция на эту смерть? GM ведёт сознание с характеристиками гомункула до LR; модуль не копирует инвентарь и не перезаписывает актёров."))return false;
  if(MidiQOL.hasUsedReaction?.(actor))throw Error("Реакция уже потрачена.");await recordModuleReaction(actor,source.parent);await patchFactory(actor,{transferReadyAt:Number(game.time.worldTime)+604800,transferred:{homunculusActorUuid:child.uuid,at:Number(game.time.worldTime)}});return true;
}
