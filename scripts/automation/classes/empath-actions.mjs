import {MODULE_ID} from "../shared/constants.mjs";
import {enabled,findFeature,itemUses,automationData,notify} from "../shared/helpers.mjs";
import {EMPATH_MASKS,empathDice,empathTemporaryDice} from "../shared/empath-definitions.mjs";
import {empathLevel,empathMask,empathState,empathSnapshot,empathAvailable} from "../shared/empath-state.mjs";
import {syncEmpath} from "./empath.mjs";
import {createEmpathEffect,empathPulse,empathPlaceable} from "./empath-effects.mjs";
import {serialMutation} from "../shared/transactions.mjs";
import {registerGmRequest,requestGm,isGmAuthority} from "../shared/gm-requests.mjs";
import {nativeApplicationReply,applyNativeOnce} from "../shared/native-applications.mjs";
import {askOwner,confirmOwner,chooseSceneTokens} from "../shared/owner-prompts.mjs";
import {inFeet,canReact,recordModuleReaction} from "../shared/combat-benefits.mjs";
import {encounterForScene} from "../shared/combat-flow.mjs";
import {useNativeUtility} from "../shared/native-actions.mjs";
import {sourceTokenForActor,applyTemporaryHp} from "../shared/zones.mjs";
import {areaActivityData} from "../shared/area-definitions.mjs";
import {useAreaActivity} from "../shared/area-activities.mjs";
export const empathGm=actor=>({uuid:actor.uuid,testUserPermission:user=>user.isGM});
export function empathExpense(activity,{activation="action",resource=activity.item,cost=1}={}){if(cost&&itemUses(resource).remaining<cost)throw Error("Нет использований этой способности.");
  if(activation==="reaction"&&!canReact(activity.actor))throw Error("Нет свободной реакции.");
  return {activation:{type:activation,value:["special",""].includes(activation)?null:1,override:true},consumption:{spellSlot:false,targets:cost?[{type:"itemUses",target:resource.id,value:String(cost),scaling:{mode:"",formula:""}}]:[]}};}
async function targets(actor,item,source,{range=60,max=1,self=false,friendly=false}={}){
  const selected=await chooseSceneTokens(actor,source.parent,{title:item.name,min:1,max,exclude:self?[]:[source.uuid],relation:t=>inFeet(source,t,range,source.parent)});
  if(!selected?.length||!await confirmOwner(empathGm(actor),item.name,`Подтверждены видимость выбранных существ${friendly?", союз и согласие":""}? Проверьте специальные условия текущего варианта до расхода.`))return null;return selected;}
async function tempHp(source,selected,formula){const roll=await new Roll(formula,source.actor.getRollData()).evaluate();await roll.toMessage?.({speaker:ChatMessage.getSpeaker({actor:source.actor})});
  const result=await applyTemporaryHp(selected.map(empathPlaceable),Math.max(0,Number(roll.total)),{sourceActor:source.actor});return result.failed.length?{status:"needs-review"}:true;}
export async function setEmpathMask(actor,mask){if(!EMPATH_MASKS.some(entry=>entry.id===mask))return false;await actor.setFlag(MODULE_ID,"empathState",{...structuredClone(empathState(actor)),mask});await syncEmpath(actor);return true;}
async function response(actor,activity,source,mask,voluntary,requestId){if(empathLevel(actor)<3||!findFeature(actor,"empath-response")||!await confirmOwner(actor,"Отклик",`Вызвать Отклик новой маски${voluntary?" частью той же реакции":" отдельной реакцией"}?`))return true;
  if(!voluntary&&!canReact(actor))return true;const snapshot=empathSnapshot(actor),selected=["anger","sorrow"].includes(mask)?await targets(actor,activity.item,source,{range:30}):[source];if(!selected)return true;
  const apply=async()=>{if(mask==="calm")return tempHp(source,[source],String(snapshot.prof+snapshot.cha));if(mask==="joy"){notify("Отклик: переместите токен до 10 футов вручную.");return true;}
    if(mask==="sorrow"){await createEmpathEffect(source,selected[0],activity.item,"response",snapshot,{requestId,expiry:"sourceStart"});return true;}
    return empathPulse(source,activity.item,selected,snapshot,{damage:[{formula:String(snapshot.prof),type:"force"}],eventKey:`${requestId}:response`});};
  if(voluntary)return apply();return applyNativeOnce(actor,{requestId:`${requestId}:response`,action:"empath-response",activityUuid:activity.uuid},()=>useNativeUtility(activity,{dataPatch:empathExpense(activity,{activation:"reaction",cost:0})}),async()=>{await recordModuleReaction(actor,source.parent);return apply();});}
async function changeMask(actor,activity,source,operation,requestId){const combat=encounterForScene(source.parent,source),previous=empathMask(actor).id;
  if(operation==="outside-mask"&&combat)throw Error("В бою смена доступна только после события.");if(operation==="combat-mask"&&!combat)throw Error("События смены маски действуют только в бою.");
  const selected=operation==="reset-mask"?"calm":await askOwner(actor,{title:"Новая маска",choices:EMPATH_MASKS.map(mask=>[mask.id,mask.name])});if(!selected||selected===previous)return false;
  let kind="outside",refuse=false;
  if(operation==="reset-mask"){if(!await confirmOwner(empathGm(actor),"Граница боя", "Подтверждён именно новый старт или конец боя? Это не бесплатная смена в середине боя."))return false;kind="boundary";}
  if(operation==="combat-mask"){
    kind=await askOwner(actor,{title:"Вид смены после события",choices:[["voluntary","Добровольно: реакция"],["involuntary","Непроизвольно: спасбросок Мудрости"]]});if(!["voluntary","involuntary"].includes(kind))return false;
    if(!await confirmOwner(empathGm(actor),"Событие смены",`Подтверждено событие таблицы для маски «${EMPATH_MASKS.find(m=>m.id===selected).name}», ${kind==="voluntary"?"добровольная":"непроизвольная"} смена? При одновременных событиях сначала разрешается одна непроизвольная.`))return false;
    if(kind==="involuntary")refuse=await askOwner(actor,{title:"Сохранение маски",choices:[["save","Совершить спасбросок"],["accept","Отказаться: принять новую маску"]]});if(kind==="involuntary"&&!["save","accept"].includes(refuse))return false;
  }
  const snapshot=empathSnapshot(actor),expense=empathExpense(activity,{activation:kind==="outside"?"action":kind==="voluntary"?"reaction":"special",cost:kind==="outside"?1:0});
  return applyNativeOnce(actor,{requestId,action:"empath-mask",activityUuid:activity.uuid},()=>useNativeUtility(activity,{dataPatch:expense}),async()=>{
    if(kind==="involuntary"&&refuse==="save"){const result=await empathPulse(source,activity.item,[source],snapshot,{save:"wis",eventKey:`${requestId}:mask-save`});if(result.status!=="success")return {status:"needs-review"};if(result.saves.includes(source.uuid))return true;}
    await setEmpathMask(actor,selected);if(kind==="voluntary")await recordModuleReaction(actor,source.parent);
    // Outside-combat action and boundary reset never grant a free reaction effect.
    return ["voluntary","involuntary"].includes(kind)?response(actor,activity,source,selected,kind==="voluntary",requestId):true;
  });}
async function nature(actor,activity,requestId){const choice=await askOwner(actor,{title:"Изменчивая природа",choices:[["mask","Характеристика и максимум текущей маски +2"],["feat","Черта вместо повышения"]]});if(!["mask","feat"].includes(choice))return false;
  if(empathState(actor).nature&&empathState(actor).nature!==choice&&!await confirmOwner(empathGm(actor),"Изменение выбора", "GM разрешает заменить прежний выбор? Черта автоматически не удаляется и не добавляется."))return false;
  return applyNativeOnce(actor,{requestId,action:"empath-nature",activityUuid:activity.uuid},async()=>true,async()=>{await actor.setFlag(MODULE_ID,"empathState",{...structuredClone(empathState(actor)),nature:choice});await syncEmpath(actor);return true;});}
async function applySingle(actor,activity,source,operation,requestId){const snapshot=empathSnapshot(actor),mask=snapshot.mask,friendly=(operation==="empathy")||operation==="voice"&&["calm","joy"].includes(mask)||operation==="impulse"&&mask==="joy";
  const selected=await targets(actor,activity.item,source,{range:operation==="impulse"?60:30,self:friendly,friendly});if(!selected)return false;
  if(operation==="voice"&&!await confirmOwner(empathGm(actor),"Голос сердца", "Цель слышит Эмпата?"))return false;
  if(operation==="empathy"&&!await confirmOwner(actor,"Сопричастность", "Получатель только становится целью атаки/спасброска, исходный бросок ещё не сделан?"))return false;
  const expense=empathExpense(activity,{activation:operation==="impulse"?"bonus":operation==="empathy"?"reaction":"action"});
  return applyNativeOnce(actor,{requestId,action:`empath-${operation}`,activityUuid:activity.uuid},()=>useNativeUtility(activity,{dataPatch:expense}),async()=>{
    if(operation==="empathy")await recordModuleReaction(actor,source.parent);
    if(operation==="impulse"&&mask==="joy"){const result=await tempHp(source,selected,`${empathTemporaryDice(snapshot.level)}d8 + ${snapshot.cha}`);notify("Получатель может добровольно потратить реакцию для ручного движения до половины скорости.");return result;}
    let failed=true;
    if(operation==="impulse"||operation==="voice"&&["anger","sorrow"].includes(mask)){
      const damage=operation==="impulse"&&mask==="anger"?[{formula:`${empathDice(snapshot.level)}d8`,type:"force"}]:[],result=await empathPulse(source,activity.item,selected,snapshot,{save:mask==="anger"&&operation==="impulse"?"dex":"wis",damage,onSave:damage.length?"half":"none",eventKey:requestId});
      if(result.status!=="success")return {status:"needs-review"};failed=result.failedSaves.includes(selected[0].uuid);if(!failed||damage.length)return true;
    }
    if(failed)await createEmpathEffect(source,selected[0],activity.item,operation,snapshot,{requestId,seconds:operation==="voice"?600:null});return true;
  });}
export function empathWaveActivity(activity,snapshot,{slot=null}={}){const spec={id:"empath-wave",shape:"sphere",size:30,origin:"self",excludeSelf:true,targets:"any",save:"wis",dc:String(snapshot.dc),damage:[],onSave:"none",concentration:60,immuneCondition:"charmed"};
  // D&D5e's spellSlots consumption interprets target as a level formula and
  // always debits spellN, never pact. A native attribute cost selects precisely
  // the chosen pool, with the system's own validation/transaction/cancellation.
  const data=areaActivityData(activity.toObject(),spec);data.activation={type:"action",value:1,override:true};data.consumption={spellSlot:false,targets:slot?[{type:"attribute",target:`spells.${slot}.value`,value:"1",scaling:{mode:"",formula:""}}]:[{type:"itemUses",target:activity.item.id,value:"1",scaling:{mode:"",formula:""}}]};
  data.flags[MODULE_ID]={...data.flags[MODULE_ID],empathResolved:true,area:spec,empathSnapshot:snapshot};const castLevel=slot==="pact"?Number(activity.actor.system.spells.pact.level):Number(slot?.slice(5));
  return activity.item.clone({system:{activities:{[activity.id]:data},...(slot&&activity.item.type==="spell"?{level:castLevel}:{})}},{keepId:true}).system.activities.get(activity.id);}
async function wave(actor,activity,source,operation,requestId){let slot=null;if(operation==="wave-free")empathExpense(activity);else{
    const choices=Object.entries(actor.system.spells??{}).filter(([key,value])=>(/^spell[4-9]$/.test(key)||key==="pact"&&Number(value.level)>=4)&&Number(value.value)>0).map(([key,value])=>[key,`Ячейка ${value.level??key.slice(5)}: ${value.value}`]);
    slot=await askOwner(actor,{title:"Ячейка Волны чувств (4+)",choices});if(!choices.some(([key])=>key===slot))return false;
  }
  const snapshot=empathSnapshot(actor),resolved=empathWaveActivity(activity,snapshot,{slot});
  return applyNativeOnce(actor,{requestId,action:"empath-wave",activityUuid:activity.uuid},()=>useAreaActivity(resolved,{dialog:{configure:false},reportOutcome:true}),async workflow=>{
    if(!workflow.failedSaves)return {status:"needs-review"};const concentration=[...(actor.concentration?.effects??[])].find(effect=>effect.uuid===workflow.grimgutzAreaResult?.concentrationUuid);
    if(!concentration)return {status:"needs-review"};
    for(const token of workflow.failedSaves){const target=token.document??token;if(target.uuid!==source.uuid&&!target.actor.system.traits?.ci?.value?.has?.("charmed")&&!target.actor.system.traits?.ci?.value?.includes?.("charmed"))await createEmpathEffect(source,target,activity.item,"wave",snapshot,{requestId,seconds:60,concentrationUuid:concentration.uuid,repeat:true});}return true;
  });}
async function removeEmotions(target){for(const effect of [...(target.actor.effects??[])]){
  const statuses=[...(effect.statuses??[])];if(!statuses.some(s=>["charmed","frightened"].includes(s)))continue;const remaining=statuses.filter(s=>!["charmed","frightened"].includes(s));
  if(remaining.length||(effect.system?.changes??[]).length)await effect.update({statuses:remaining});else await effect.delete();
}}
async function catharsis(actor,activity,source,requestId){const snapshot=empathSnapshot(actor),mask=snapshot.mask;
  if(mask==="anger"&&!await confirmOwner(empathGm(actor),"Неистовство", "При желании переместите токен в видимое свободное место в 30 футах сейчас (это ручная телепортация). Продолжить, проверив дальность и ограничения?"))return false;
  const selected=await targets(actor,activity.item,source,{range:mask==="anger"?15:mask==="sorrow"?60:30,max:["calm","joy"].includes(mask)?snapshot.prof:mask==="anger"?100:1,self:["calm","joy"].includes(mask),friendly:["calm","joy"].includes(mask)});if(!selected)return false;
  const expense=empathExpense(activity);return applyNativeOnce(actor,{requestId,action:"empath-catharsis",activityUuid:activity.uuid},()=>useNativeUtility(activity,{dataPatch:expense}),async()=>{
    if(mask==="joy"){const result=await tempHp(source,selected,`4d8 + ${snapshot.cha}`);notify("Ликование: каждому получателю доступна добровольная реакция, движение и одна атака оружием либо заговор. Проведите через штатную активность с GM.");return result;}
    if(mask==="calm"){for(const target of selected){await removeEmotions(target);await createEmpathEffect(source,target,activity.item,"catharsis",snapshot,{requestId,seconds:60});}return true;}
    const result=await empathPulse(source,activity.item,selected,snapshot,{save:mask==="anger"?"dex":"wis",damage:[{formula:mask==="anger"?"8d8":"6d8",type:mask==="anger"?"force":"necrotic"}],onSave:"half",eventKey:requestId});if(result.status!=="success")return {status:"needs-review"};
    for(const target of selected.filter(t=>result.failedSaves.includes(t.uuid))){if(mask==="anger"){
      if(!target.actor.system.traits?.ci?.value?.has?.("prone")&&!target.actor.system.traits?.ci?.value?.includes?.("prone"))await target.actor.toggleStatusEffect("prone",{active:true});notify("Неистовство: оттолкните провалившие цели на 15 футов вручную.");
    }else await createEmpathEffect(source,target,activity.item,"catharsis",snapshot,{requestId,seconds:60,repeat:true});}return true;
  });}
registerGmRequest("empath-action",(actor,data,{requestId})=>serialMutation(`empath:${actor.uuid}`,async()=>{
  if(!enabled()||!isGmAuthority())return false;const previous=nativeApplicationReply(actor,requestId);if(previous)return previous;
  const activity=await fromUuid(data.activityUuid),source=await fromUuid(data.sourceUuid);if(activity?.actor?.uuid!==actor.uuid||!empathAvailable(actor,activity.item))return false;
  await syncEmpath(actor);const operation=automationData(activity).empathOperation;if(operation==="nature")return nature(actor,activity,requestId);
  if(source?.actor?.uuid!==actor.uuid||canvas.scene?.id!==source.parent.id||!canvas.ready)throw Error("Выберите токен Эмпата; активный GM должен открыть его сцену до расхода.");
  if(["outside-mask","combat-mask","reset-mask"].includes(operation))return changeMask(actor,activity,source,operation,requestId);
  if(["impulse","empathy","voice"].includes(operation))return applySingle(actor,activity,source,operation,requestId);
  if(["wave-free","wave-slot"].includes(operation))return wave(actor,activity,source,operation,requestId);
  if(operation==="catharsis")return catharsis(actor,activity,source,requestId);return false;
}));
const pending=new Map();
export function controlEmpath(actor,activity){const key=`${actor.uuid}:${activity.id}`;if(pending.has(key))return pending.get(key);const task=requestGm("empath-action",actor,{activityUuid:activity.uuid,sourceUuid:sourceTokenForActor(actor)?.document.uuid},{timeoutMs:120000});pending.set(key,task);void task.finally(()=>pending.delete(key)).catch(()=>{});return task;}
