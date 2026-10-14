import {MODULE_ID} from "../shared/constants.mjs";
import {enabled,findFeature,itemUses} from "../shared/helpers.mjs";
import {askOwner,confirmOwner} from "../shared/owner-prompts.mjs";
import {registerGmRequest,requestGm,isGmAuthority} from "../shared/gm-requests.mjs";
import {applyNativeOnce,nativeApplicationReply} from "../shared/native-applications.mjs";
import {serialMutation} from "../shared/transactions.mjs";
import {useNativeUtility} from "../shared/native-actions.mjs";
import {canReact,recordModuleReaction,onPrepareAttack,inFeet,activeBenefits,benefitData} from "../shared/combat-benefits.mjs";
import {onPrepareDamage,onConfirmedDamage} from "../shared/damage-events.mjs";
import {calculatedDamage,commitCalculatedDamage} from "../midi/damage-packet.mjs";
import {isEffectActive} from "../effects/temporary-effects.mjs";
import {automatonState,automatonHas,automatonTransformationLevel,automatonPassiveActive,automatonResistanceActive} from "./automaton.mjs";
import {automatonExpense,automatonRoll,automatonGm} from "./automaton-use.mjs";
import {integratedItem,integratedActive} from "./automaton-equipment.mjs";
import {automatonSpellIdentity} from "../shared/automaton-definitions.mjs";

const isDamage=part=>Number(part.value)>0&&!["healing","temphp","maximum","midi-none","vitality"].includes(part.type);
export const automatonStateActive=(actor,key)=>[...(actor?.effects??[])].some(e=>e.getFlag?.(MODULE_ID,"automatonStateEffect")===key&&isEffectActive(e));
export function reduceAutomatonPacket(parts,reduction){
  const out=structuredClone(parts);let remaining=Math.max(0,reduction);
  for(const part of out){if(!isDamage(part))continue;const removed=Math.min(Number(part.value),remaining);part.value=Number(part.value)-removed;remaining-=removed;}
  return out;
}
registerGmRequest("automaton-incoming",(caster,data,{requestId})=>serialMutation(`automaton-incoming:${data.targetUuid}`,async()=>{
  if(!enabled()||!isGmAuthority())return false;const target=await fromUuid(data.targetUuid),activity=await fromUuid(data.activityUuid),actor=target?.actor;
  if(!actor||activity?.actor?.uuid!==caster.uuid||!data.workflowId||!Number.isFinite(data.total)||data.total<=0)return false;
  const old=nativeApplicationReply(actor,requestId);if(old)return {status:old.status,reduction:Number(actor.getFlag(MODULE_ID,"automatonReductions")?.[requestId]??0)};
  if(!automatonTransformationLevel(actor))return {status:"success",reduction:0};
  let reduction=0,remaining=data.total;
  const threshold=automatonHas(actor,"bastion")&&automatonStateActive(actor,"bastion")?5*automatonTransformationLevel(actor):0;
  if(threshold&&remaining<=threshold)reduction=remaining;
  else{
    if(automatonHas(actor,"flesh")&&await confirmOwner(actor,"Плоть слаба!","Уменьшить этот общий урон на 4?")){reduction=Math.min(4,remaining);remaining-=reduction;}
    const steel=findFeature(actor,"automaton-steel"),activitySteel=[...(steel?.system.activities?.values?.()??[])][0];
    if(remaining>0&&automatonHas(actor,"steel")&&itemUses(steel).remaining>0&&canReact(actor)&&!automatonStateActive(actor,"antimagic")&&await confirmOwner(actor,"Сила и уверенность стали","Потратить реакцию и одно использование на уменьшение этого урона?")){
      return applyReductionWithSteel();
    }
    if(threshold&&remaining<=threshold)reduction=data.total;
    async function applyReductionWithSteel(){
      const reply=await applyNativeOnce(actor,{requestId,action:"automaton-steel",activityUuid:activitySteel.uuid},()=>useNativeUtility(activitySteel,{dataPatch:automatonExpense(activitySteel,{activation:"reaction",cost:1})}),async()=>{
        const rolled=Math.max(0,await automatonRoll(actor,`${automatonTransformationLevel(actor)-1}d12 + ${Number(actor.system.abilities.str.mod)}`,"Сила и уверенность стали"));
        reduction+=Math.min(remaining,rolled);remaining-=Math.min(remaining,rolled);if(threshold&&remaining<=threshold)reduction=data.total;
        await recordModuleReaction(actor,target.parent);await saveReduction();return true;
      });return {status:reply.status,reduction:reply.status==="success"?reduction:0};
    }
  }
  async function saveReduction(){const records={...(actor.getFlag(MODULE_ID,"automatonReductions")??{}),[requestId]:reduction};await actor.setFlag(MODULE_ID,"automatonReductions",Object.fromEntries(Object.entries(records).slice(-100)));}
  const reply=await applyNativeOnce(actor,{requestId,action:"automaton-reduce",activityUuid:data.activityUuid},async()=>true,async()=>{await saveReduction();return true;});return {status:reply.status,reduction};
}));
export async function prepareAutomatonDamage(token,{workflow,damageItem}){
  if(!enabled()||!token?.actor||!workflow?.actor||!workflow.activity||workflow.aborted||!automatonTransformationLevel(token.actor))return;
  const selector=damageItem.damageSelector??"combinedDamage",key=`automaton-incoming:${workflow.id}:${token.document?.uuid??token.uuid}:${selector}`;
  if(selector!=="combinedDamage")return;
  if(damageItem.grimgutzAutomatonReduction===key)return;
  const parts=calculatedDamage(damageItem),total=parts.filter(isDamage).reduce((n,p)=>n+Number(p.value),0);if(total<=0)return;
  const result=await requestGm("automaton-incoming",workflow.actor,{workflowId:workflow.id,activityUuid:workflow.activity.uuid,targetUuid:token.document?.uuid??token.uuid,total},{requestId:key,timeoutMs:180000});
  if(result.status!=="success")return;damageItem.grimgutzAutomatonReduction=key;
  if(result.reduction>0)commitCalculatedDamage(token,damageItem,reduceAutomatonPacket(parts,result.reduction));
}

onPrepareAttack(async({actor,attacker,activity})=>{
  if(!enabled()||activity.type!=="attack"||!automatonHas(actor,"model")||automatonState(actor).model!=="warrior"||!automatonPassiveActive(actor,"model"))return [];
  const ally=[...(attacker.parent?.tokens??[])].some(t=>t.actor&&t.actor.uuid!==actor.uuid&&t.disposition!==0&&t.disposition===attacker.disposition&&Number(t.actor.system?.attributes?.hp?.value??1)>0&&inFeet(attacker,t,5,attacker.parent));
  const effect=[...(actor.effects??[])].find(e=>e.getFlag?.(MODULE_ID,"automatonPassive")==="model");
  return ally?[{effectUuid:effect.uuid,kind:"attack-advantage",name:"Модель воина: союзник в 5 футах"}]:[];
});
export function prepareAutomatonDamageRoll(config){
  const activity=config?.subject,actor=activity?.actor??activity?.item?.actor,roll=config?.rolls?.[0];
  if(!enabled()||!actor||activity?.type!=="attack"||!roll||config.grimgutzAutomatonDamage)return;config.grimgutzAutomatonDamage=true;
  roll.parts??=[];
  if(automatonHas(actor,"model")&&automatonState(actor).model==="warrior"&&automatonPassiveActive(actor,"model"))roll.parts.push(String(automatonTransformationLevel(actor)));
  const integrated=integratedItem(actor),base=activity.item?.system?.damage?.base;
  if(integratedActive(actor)&&integrated?.kind==="weapon"&&integrated.item.uuid===activity.item.uuid&&Number(base?.denomination)>0)roll.parts.push(`1d${base.denomination}`);
  if(activity.attack?.type?.value!=="melee")return;
  const effect=activeBenefits(actor).find(e=>benefitData(e).kind==="automaton-overload");
  if(effect&&automatonHas(actor,"overload"))config.rolls.push({parts:[`${Number(benefitData(effect).dice)}d8`],data:roll.data,options:{...roll.options,type:"lightning",types:["lightning"]}});
}
export function prepareAutomatonRange(activity){
  const actor=activity?.actor??activity?.item?.actor,integrated=actor&&integratedItem(actor);
  if(!enabled()||!integratedActive(actor)||integrated?.kind!=="weapon"||integrated.item.uuid!==activity.item?.uuid||activity.type!=="attack"||activity.grimgutzAutomatonRange)return;
  if(activity.item===actor.items?.get?.(activity.item.id))return;
  activity.grimgutzAutomatonRange=true;
  // Activities passed to preUseActivity are transient native copies. Never
  // change the owned weapon or its user's manual range configuration.
  const range=activity.range;if(!range||range.units!=="ft")return;
  const bonus=activity.attack?.type?.value==="melee"?5:0;
  const original=activity.item.system.range??{},base=Number(bonus?(original.reach??range.reach??range.value??5):(original.value??range.value));
  const updates={};if(base>0)updates[bonus?"system.range.reach":"system.range.value"]=bonus?base+bonus:base*2;
  if(!bonus&&Number(original.long)>0)updates["system.range.long"]=Number(original.long)*2;
  activity.item.updateSource?.(updates);
  if(Number.isFinite(Number(range.value))&&Number(range.value)>0)range.value=String(bonus?base+bonus:2*Number(range.value));
  if(!bonus&&Number(range.long)>0)range.long=2*Number(range.long);
  if(bonus){range.reach=base+bonus;activity.updateSource?.({"range.value":String(base+bonus),"range.units":"ft","range.override":true});}
}
export function prepareAutomatonSave(target,workflow,details){
  if(!enabled()||details.rollType&&details.rollType!=="save"||!automatonResistanceActive(target?.actor)||automatonState(target.actor).model!=="agile")return;
  const magical=workflow?.item?.type==="spell"||workflow?.item?.system?.properties?.has?.("mgc")||workflow?.activity?.midiProperties?.magicdam===true;
  if(!magical)return;details.advantage=true;details.modifierTracker?.advantage?.add?.(`${MODULE_ID}.automaton-resistance`,"Проворная модель: магический эффект");
}
registerGmRequest("automaton-spell-immunity",async(caster,data)=>{
  const activity=await fromUuid(data.activityUuid);if(!enabled()||!isGmAuthority()||activity?.actor?.uuid!==caster.uuid||activity.item?.type!=="spell"||!data.workflowId)return false;
  const protectedTargets=[];for(const uuid of [...new Set(data.targets??[])]){const token=await fromUuid(uuid),actor=token?.actor;if(!actor||!automatonResistanceActive(actor)||automatonState(actor).model!=="warrior")continue;
    if((automatonState(actor).immunities??[]).some(row=>row.id===automatonSpellIdentity(activity.item)))protectedTargets.push(uuid);
  }return {status:"success",protectedTargets};
});
export async function prepareAutomatonImmunity(workflow){
  if(!enabled()||workflow?.aborted||workflow?.item?.type!=="spell"||!workflow.actor||!workflow.activity||workflow.grimgutzAutomatonImmunity)return;
  if(![...(workflow.targets??[])].some(t=>automatonResistanceActive(t.actor)&&automatonState(t.actor).model==="warrior"))return;
  const result=await requestGm("automaton-spell-immunity",workflow.actor,{activityUuid:workflow.activity.uuid,workflowId:workflow.id,targets:[...workflow.targets].map(t=>t.document?.uuid??t.uuid)},{requestId:`automaton-immunity:${workflow.id}`});
  if(result.status!=="success")return;workflow.grimgutzAutomatonImmunity=true;const blocked=new Set(result.protectedTargets);workflow.targets=new Set([...workflow.targets].filter(t=>!blocked.has(t.document?.uuid??t.uuid)));
}

onPrepareDamage(async({actor,activity,data})=>{
  if(!enabled())return;
  const cost=2*Number(actor.system?.abilities?.con?.mod??0);
  if(!automatonHas(actor,"coils")||activity.type!=="attack"||activity.attack?.type?.value!=="melee"||cost<=0||Number(actor.system.attributes.hp.temp)<cost)return;
  // One attack may have several targets/damage packets. Reserve just one by
  // workflow, do not spend before a confirmed Actor damage application.
  const old=actor.getFlag(MODULE_ID,"automatonCoilReservation");if(old?.workflowId===data.workflowId)return;
  if(["reserved","needs-review"].includes(old?.state))return;
  if(!await confirmOwner(actor,"Реактивные катушки",`Добавить ${cost} урона этой рукопашной атаке за ${cost} временных хитов? Расход только после подтверждённого применения.`))return;
  if(!await confirmOwner(automatonGm(actor),"Тип урона катушек","PDF не указывает тип дополнительного урона. Для этого применения согласован тип основного урона атаки? Иначе проведите вручную."))return;
  await actor.setFlag(MODULE_ID,"automatonCoilReservation",{workflowId:data.workflowId,key:data.key,cost,state:"reserved"});
  return {bonuses:[{value:cost,name:"Реактивные катушки"}],context:{automatonCoils:{cost,key:data.key}}};
});
onConfirmedDamage(async({actor,amount,event})=>{
  if(amount<=0)return;
  if(event.automatonCoils){const source=await fromUuid(event.sourceActorUuid);if(source)await serialMutation(`automaton-coils:${source.uuid}`,async()=>{
    const reservation=source.getFlag(MODULE_ID,"automatonCoilReservation");if(reservation?.key!==event.key||reservation.state!=="reserved")return;
    const current=Number(source.system.attributes.hp.temp),cost=Number(reservation.cost),enough=current>=cost;
    await source.update({...(enough?{"system.attributes.hp.temp":current-cost}:{}),[`flags.${MODULE_ID}.automatonCoilReservation`]:{...reservation,state:enough?"spent":"needs-review"}});
  });}
  if(!automatonHas(actor,"coils"))return;const element=automatonState(actor).element,types=event.damageTypes??[event.damageType];if(!element||!types.includes(element))return;
  let elemental=amount;
  if(types.length>1){elemental=await askOwner(automatonGm(actor),{kind:"number",title:"Катушки: окончательный урон выбранного типа",label:"Смешанный пакет: укажите только подтверждённый урон выбранного элемента.",min:0,max:amount,defaultValue:0});if(!Number.isFinite(elemental)||elemental<=0||elemental>amount)return;}
  const temporary=Math.floor(elemental/2);if(!temporary||!await confirmOwner(actor,"Реактивные катушки",`Получить ${temporary} временных хитов? Они заменяют, а не складываются с текущими.`))return;
  if(temporary<Number(actor.system.attributes.hp.temp)&&!await confirmOwner(actor,"Меньше текущих временных хитов","Заменить более высокий текущий запас меньшим?"))return;
  await actor.update({"system.attributes.hp.temp":temporary});
});
export async function finishAutomatonCoils(workflow){
  if(!enabled()||!workflow?.actor||!workflow.aborted)return;
  return requestGm("automaton-release-coils",workflow.actor,{workflowId:workflow.id},{requestId:`automaton-release:${workflow.id}`});
}
registerGmRequest("automaton-release-coils",async(actor,data)=>{
  const reservation=actor.getFlag(MODULE_ID,"automatonCoilReservation");if(reservation?.workflowId===data.workflowId&&reservation.state==="reserved")await actor.unsetFlag(MODULE_ID,"automatonCoilReservation");return true;
});
