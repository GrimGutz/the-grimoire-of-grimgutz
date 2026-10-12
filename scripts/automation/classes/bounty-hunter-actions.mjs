import {MODULE_ID} from "../shared/constants.mjs";
import {enabled,automationData,automationAction,notify,itemUses,findFeature} from "../shared/helpers.mjs";
import {HUNTER_TROPHIES,trophyDefinition} from "../shared/bounty-hunter-definitions.mjs";
import {hunterLevel,hunterDC,hunterConfig,hunterPool,hunterFeatureAvailable,selectedHunterTrophy,selectedHunterTrophies,hunterRestCompleted} from "./bounty-hunter.mjs";
import {askOwner,confirmOwner,chooseSceneTokens} from "../shared/owner-prompts.mjs";
import {registerGmRequest,requestGm,isGmAuthority} from "../shared/gm-requests.mjs";
import {nativeApplicationReply,applyNativeOnce} from "../shared/native-applications.mjs";
import {useHunterCost,useHunterNative} from "./bounty-hunter-cost.mjs";
import {sourceTokenForActor} from "../shared/zones.mjs";
import {areaDamagePart} from "../shared/area-definitions.mjs";
import {useAuraPulse} from "../midi/aura-workflow.mjs";
import {temporaryEffectTiming,isEffectActive} from "../effects/temporary-effects.mjs";
import {addCombatBenefit,canReact,inFeet,recordModuleReaction} from "../shared/combat-benefits.mjs";
import {prepareReactionAttack,reactionAttack as nativeReactionAttack} from "../shared/native-actions.mjs";
import {combatTurnSnapshot,encounterForScene} from "../shared/combat-flow.mjs";
import {useHunterZone} from "./bounty-hunter-zones.mjs";

// Ability/action costs are native; choices and special prerequisites happen before expense.
const SAFE_CONDITIONS=["frightened","deafened","blinded","poisoned","charmed","paralyzed"];
export const activationFor=mode=>["heal","cleanse","miss-retry","fear","teleport","undead-temp","regeneration","allied-attacks","move","escape"].includes(mode)?"bonus"
  : ["mental-burst","sleep","chains","roots","storm"].includes(mode)?"action"
  : ["avert-death","reduce-damage","prevent-movement","modify-roll","acid-reaction"].includes(mode)?"reaction":"special";
const subject=actor=>({uuid:actor.uuid,testUserPermission:user=>user.isGM});
const tokenObject=doc=>doc.object??{actor:doc.actor,document:doc};
export async function hunterCondition(actor,item,source,target,{name=item.name,statuses=[],flags={},changes=[],seconds=60}={}) {
  const immunities=target.actor.system?.traits?.ci?.value;
  if(statuses.some(key=>immunities?.has?.(key)||immunities?.includes?.(key)))return false;
  const timer=temporaryEffectTiming({seconds,actor:target.actor});
  const renewal=[...(target.actor.effects??[])].find(effect=>effect.origin===item.uuid&&["hunterRegeneration","hunterMissRetry"].some(key=>flags[key]&&effect.getFlag?.(MODULE_ID,key)));
  if(renewal){await renewal.update({...timer,disabled:false});return renewal;}
  const [effect]=await target.actor.createEmbeddedDocuments("ActiveEffect",[{name,img:item.img,type:"base",origin:item.uuid,transfer:false,disabled:false,showIcon:1,
    statuses,...timer,flags:{[MODULE_ID]:{schemaVersion:1,hunterEffect:true,sourceTokenUuid:source.uuid,...flags},dae:{expiryMode:"delete"}},system:{changes}}]);
  return effect;
}
export async function hunterSave(actor,item,source,target,ability,eventKey,{damage=[],onSave="none",condition=null}={}) {
  return useAuraPulse({scene:source.parent,sourceToken:tokenObject(source),sourceItem:item,targets:[tokenObject(target)],eventKey,
    event:{save:ability,dc:String(hunterDC(actor)),damage,onSave,returnSaveOutcome:true,...(condition?{condition}:{})}});
}
async function saveWithCondition(actor,item,source,target,ability,eventKey,{statuses,flags={},immune=[],damage=[],onSave="none"}) {
  const result=await hunterSave(actor,item,source,target,ability,eventKey,{damage,onSave});
  if(result?.status!=="success")return {status:"needs-review"};
  if(result.failedSaves.includes(target.uuid)){
    if(immune.some(k=>target.actor.system.traits?.ci?.value?.has?.(k)))return true;
    await hunterCondition(actor,item,source,target,{statuses,flags:{...flags,repeatSave:{ability,dc:hunterDC(actor),damage:[],event:"turnEnd",sourceTokenUuid:source.uuid,sourceItemUuid:item.uuid,targetTokenUuid:target.uuid}}});
  }
  return true;
}
async function chooseTargets(actor,item,source,range,max=1,{self=false,enemies=false}={}) {
  const targets=await chooseSceneTokens(actor,source.parent,{title:item.name,min:1,max,
    relation:t=>(self||t.uuid!==source.uuid)&&inFeet(source,t,range,source.parent)&&(!enemies||!source.disposition||!t.disposition||source.disposition!==t.disposition)});
  if(!targets?.length)return null;
  if(!await confirmOwner(actor,item.name,"Указанные цели видимы и соответствуют условиям способности?"))return null;
  return targets;
}
async function nativeHeal(actor,item,activity,source,{formula,type="healing",range=5,selfOnly=false,requestId}) {
  const targets=selfOnly?[source]:await chooseTargets(actor,item,source,range,1,{self:true});if(!targets)return false;
  const before=Number(actor.system.attributes.hp.temp??0);
  return applyNativeOnce(actor,{requestId,action:"hunter-heal",activityUuid:activity.uuid},
    ()=>useHunterNative(activity,{type:"heal",healing:areaDamagePart({formula,type}),range:{value:range,units:"ft",override:true},
      target:{template:{type:""},affects:{type:"creature",count:"1",choice:false},override:true,prompt:false}},targets,{activation:"bonus"}),
    async native=>{
      const temp=Number(actor.system.attributes.hp.temp??0);
      const packet=native?.damageList?.find(row=>(row.actorUuid===actor.uuid||row.tokenUuid===source.uuid)&&Number(row.oldTempHP)===before&&Number(row.newTempHP)===temp);
      if(item.system.identifier==="hunter-undead-medium"&&temp>before&&packet){
        await actor.setFlag(MODULE_ID,"hunterUndeadTemp",{remaining:temp});
      }
      return true;
    });
}
async function cleanse(actor,item,activity,source,requestId) {
  const targets=await chooseTargets(actor,item,source,30);if(!targets)return false;const target=targets[0],mixed=new Set();
  for(const effect of target.actor.effects??[]){const statuses=[...(effect.statuses??[])];
    if(statuses.some(s=>!SAFE_CONDITIONS.includes(s))||(effect.system?.changes??effect.changes??[]).length)for(const s of statuses)mixed.add(s);}
  const choices=SAFE_CONDITIONS.filter(key=>target.actor.statuses?.has?.(key)&&!mixed.has(key));
  if(!choices.length){notify("Нет отдельно снимаемых состояний. Составные эффекты проверьте с GM до расхода.","warn");return false;}
  const picked=await askOwner(actor,{kind:"checkbox",title:item.name,choices:choices.map(key=>[key,key]),min:1,max:Math.min(2,choices.length)});
  if(!picked)return false;
  return applyNativeOnce(actor,{requestId,action:"hunter-cleanse",activityUuid:activity.uuid},()=>useHunterCost(activity,{activation:"bonus"}),async()=>{
    for(const effect of [...(target.actor.effects??[])])if([...(effect.statuses??[])].some(key=>picked.includes(key))){
      const remaining=[...(effect.statuses??[])].filter(key=>!picked.includes(key));
      if(remaining.length)await effect.update({statuses:remaining});else await effect.delete();
    }return true;
  });
}
async function pulseAction(actor,item,activity,source,entry,requestId) {
  const mode=entry.mode,range=mode==="mental-burst"||mode==="fear"?30:60,max=["mental-burst","sleep"].includes(mode)?Number(actor.system.attributes.prof):mode==="fear"?100:1;
  const targets=await chooseTargets(actor,item,source,range,max,{enemies:mode==="fear"});if(!targets)return false;
  if(mode==="fear"&&!await confirmOwner(actor,item.name,"Каждый выбранный враг видит ИЛИ слышит ваш рев?"))return false;
  let filtered=targets;
  if(mode==="sleep"){
    filtered=[];
    for(const target of targets){
      if(target.actor.system.traits?.ci?.value?.has?.("charmed")||selectedHunterTrophy(target.actor,"hunter-fey-minor"))continue;
      if(await confirmOwner(subject(actor),"Магический сон (GM)",`Цель ${target.name??target.actor.name} не имеет иммунитета к магическому сну?`))filtered.push(target);
    }
    if(!filtered.length)return false;
  }
  return applyNativeOnce(actor,{requestId,action:`hunter-${mode}`,activityUuid:activity.uuid},()=>useHunterCost(activity,{activation:activationFor(mode)}),async()=>{
    for(const target of filtered){
      if(mode==="mental-burst"){
        const result=await hunterSave(actor,item,source,target,"wis",`${requestId}:${target.uuid}`,{damage:[{formula:"8d8",type:"psychic"}],onSave:"half"});
        if(result?.status!=="success")return {status:"needs-review"};
        if(result.failedSaves.includes(target.uuid))await addCombatBenefit(source,target,item,{kind:"hunter-no-reaction",expiry:"sourceEnd",
          changes:[{key:"flags.midi-qol.actions.reactionsUsed",value:String(target.actor.getFlag?.("midi-qol","actions")?.reactionsMax??1),type:"upgrade",phase:"initial",priority:20}]});
      }else{
        const params=mode==="fear"?{statuses:["frightened"]}:mode==="sleep"?{statuses:["unconscious"],immune:["charmed"],flags:{hunterSleep:true}}:{statuses:["restrained"],flags:{hunterChains:true}};
        const result=await saveWithCondition(actor,item,source,target,mode==="chains"?"cha":"wis",`${requestId}:${target.uuid}`,params);
        if(result?.status==="needs-review")return result;
      }
    }return true;
  });
}
async function manualAction(actor,item,activity,source,entry,requestId) {
  const labels={
    "mental-reroll":"Вы провалили спасбросок Интеллекта, Мудрости или Харизмы; перебросите его с +1к4 в исходных условиях, новый результат обязателен?",
    "avert-death":"Видимой допустимой цели в 30 футах угрожает 0 хитов, но НЕ мгновенная смерть; GM применит 1 хит вместо 0 и затем 3к8+БМ временных хитов?",
    "reduce-damage":"Это ещё не применённый урон от атаки; GM уменьшит конкретный пакет на 3к10+БМ?",
    "prevent-movement":"Это конкретный эффект толчка, притягивания или падения ничком; GM отменит именно эти последствия?",
    "modify-roll":"Видимая цель в 30 футах уже бросила к20, но результат не объявлен; GM применит выбранные ±1к8 к этому броску?",
    move:"Переместитесь вручную до своей скорости без атак возможности только во время этого перемещения?",
    teleport:"Перенесите токен вручную в видимое свободное место не дальше 120 футов; спутник согласен, подходит по размеру и находится в 5 футах?"
  };
  if(!labels[entry.mode]||!await confirmOwner(actor,item.name,labels[entry.mode]))return false;
  const activation=activationFor(entry.mode);if(activation==="reaction"&&!canReact(actor))return false;
  return applyNativeOnce(actor,{requestId,action:`hunter-${entry.mode}`,activityUuid:activity.uuid},()=>useHunterCost(activity,{activation}),async()=>{
    if(activation==="reaction")await recordModuleReaction(actor,source.parent);
    notify(`${item.name}: ресурс подтверждён; выполните указанное в карточке движение/изменение броска вручную.`);return true;
  });
}
registerGmRequest("hunter-action",async(actor,data,{requestId})=>{
  const activity=await fromUuid(data.activityUuid),item=activity?.item,source=await fromUuid(data.sourceUuid);
  if(!enabled()||source?.actor?.uuid!==actor.uuid||activity?.actor?.uuid!==actor.uuid||!hunterFeatureAvailable(actor,item))return false;
  const previous=nativeApplicationReply(actor,requestId);if(previous)return previous;
  const entry=trophyDefinition(item);
  if(!entry||entry.passive||selectedHunterTrophy(actor,entry.key)?.item.id!==item.id||itemUses(hunterPool(actor)).remaining<entry.cost)return false;
  if(!hunterDC(actor)){notify("Сначала выберите Характеристику охоты.","warn");return false;}
  if(canvas?.scene?.id!==source.parent.id||!canvas.ready){notify("GM должен открыть сцену источника до расхода ресурса.","warn");return false;}
  if(entry.mode==="heal")return nativeHeal(actor,item,activity,source,{formula:`2d8 + ${Number(actor.system.abilities[hunterConfig(actor).ability].mod)}`,requestId});
  if(entry.mode==="undead-temp")return nativeHeal(actor,item,activity,source,{formula:`4d8 + ${Number(actor.system.abilities[hunterConfig(actor).ability].mod)}`,type:"temphp",selfOnly:true,requestId});
  if(entry.mode==="cleanse")return cleanse(actor,item,activity,source,requestId);
  if(["mental-burst","fear","sleep","chains"].includes(entry.mode))return pulseAction(actor,item,activity,source,entry,requestId);
  if(["regeneration","miss-retry"].includes(entry.mode))return applyNativeOnce(actor,{requestId,action:`hunter-${entry.mode}`,activityUuid:activity.uuid},()=>useHunterCost(activity,{activation:"bonus"}),
    async()=>Boolean(await hunterCondition(actor,item,source,source,{flags:{[entry.mode==="regeneration"?"hunterRegeneration":"hunterMissRetry"]:{sourceTokenUuid:source.uuid,itemUuid:item.uuid}}})));
  if(entry.mode==="escape"){
    if(!actor.statuses?.has?.("grappled")||!await confirmOwner(actor,item.name,"Захват прекратится; переместитесь до 15 футов вручную без атак возможности только этого движения?"))return false;
    return applyNativeOnce(actor,{requestId,action:"hunter-escape",activityUuid:activity.uuid},()=>useHunterCost(activity,{activation:"bonus"}),async()=>{await actor.toggleStatusEffect("grappled",{active:false});return true;});
  }
  if(entry.mode==="acid-reaction"){
    if(!canReact(actor)||!await confirmOwner(actor,item.name,"По вам попала именно атака ближнего боя?"))return false;
    const targets=await chooseTargets(actor,item,source,Infinity);if(!targets)return false;
    return applyNativeOnce(actor,{requestId,action:"hunter-acid-reaction",activityUuid:activity.uuid},
      ()=>useHunterNative(activity,{type:"damage",damage:{parts:[areaDamagePart({formula:"4d10",type:"acid"})]},range:{units:"any",override:true},target:{template:{type:""},affects:{type:"creature",count:"1"},override:true,prompt:false}},targets,{activation:"reaction"}),
      async()=>{await recordModuleReaction(actor,source.parent);return true;});
  }
  if(entry.mode==="allied-attacks"){
    const foes=await chooseTargets(actor,item,source,60,1,{enemies:true});if(!foes)return false;
    const allies=await chooseTargets(actor,item,source,30,2);if(!allies||!await confirmOwner(actor,item.name,"Оба выбранных получателя — союзники, видящие или слышащие вас?"))return false;
    const prepared=[];for(const ally of allies){const attack=await prepareReactionAttack(ally,foes[0],{name:item.name});if(attack)prepared.push({ally,attack});}
    if(!prepared.length)return false;
    return applyNativeOnce(actor,{requestId,action:"hunter-allied-attacks",activityUuid:activity.uuid},()=>useHunterCost(activity,{activation:"bonus"}),async()=>{
      for(const {ally,attack}of prepared){const result=await nativeReactionAttack(ally,foes[0],{name:item.name,prepared:attack});if(result?.status==="needs-review"||result==null)return {status:"needs-review"};}return true;
    });
  }
  if(["charge-hit","fire-hit","giant-hit","undead-hit","grapple-hit"].includes(entry.mode)){notify("Применяется в подходящем попадании: включите обычный бросок урона оружия через Midi-QOL; произвольная кнопка не наносит урон вторично.");return false;}
  if(entry.mode==="kill-temp")return requestGm("hunter-kill-temp",actor,data,{requestId});
  return manualAction(actor,item,activity,source,entry,requestId);
});

registerGmRequest("hunter-track",async(actor,data)=>{
  const item=await fromUuid(data.itemUuid);if(item?.actor?.uuid!==actor.uuid||!hunterFeatureAvailable(actor,item))return false;
  const types=[...new Set(selectedHunterTrophies(actor).map(e=>e.creatureType))];if(!types.length)return false;
  const skill=await askOwner(actor,{title:"Гон добычи",choices:[["sur","Выживание — выслеживание"],["inv","Расследование — поиск следов"]]});
  if(!skill||!await confirmOwner(actor,"Гон добычи",`Следы относятся к одному из выбранных типов: ${types.join(", ")}?`))return false;
  const rolls=await actor.rollSkill({skill,ability:skill==="sur"?"wis":"int",advantage:true},{configure:true});return Boolean(rolls?.length);
});
const calls=new Map();
export function controlHunter(actor,activity) {
  const key=`${actor.uuid}:${activity.id}`;if(calls.has(key))return calls.get(key);
  const operation=automationData(activity).hunterOperation,source=sourceTokenForActor(actor)?.document;
  const data={itemUuid:activity.item.uuid,activityUuid:activity.uuid,sourceUuid:source?.uuid,operation};
  const entry=trophyDefinition(activity.item);
  const task=operation==="activate"&&["breath","storm","roots"].includes(entry?.mode)?useHunterZone(activity)
    : requestGm(["source","ability","select","asi"].includes(operation)?"hunter-settings":operation==="disposable"?"hunter-disposable":operation==="combination"?"hunter-combination":operation==="track"?"hunter-track":operation==="follow"?"hunter-follow":operation==="retry"?"hunter-retry":"hunter-action",actor,data,{timeoutMs:120000});
  calls.set(key,task);void task.finally(()=>calls.delete(key)).catch(()=>{});return task;
}
export function installHunterActionHooks() {
  const intercept=activity=>{
    if(!enabled()||automationData(activity).leaderResolved||automationData(activity).auraPulse||automationData(activity).hunterResolved)return;
    if(automationAction(activity)!=="bounty-hunter-control")return;
    if(!hunterFeatureAvailable(activity.actor,activity.item)&&!(automationData(activity).hunterOperation==="source"&&trophyDefinition(activity.item)&&hunterLevel(activity.actor)>=1))return false;
    void controlHunter(activity.actor,activity).catch(error=>notify(error.message,"warn"));return false;
  };
  Hooks.on("midi-qol.preTargetingV2",({workflow})=>intercept(workflow?.activity));Hooks.on("dnd5e.preUseActivity",intercept);
  Hooks.on("dnd5e.restCompleted",(actor,result)=>{void hunterRestCompleted(actor,result).catch(error=>notify(error.message,"warn"));});
}
