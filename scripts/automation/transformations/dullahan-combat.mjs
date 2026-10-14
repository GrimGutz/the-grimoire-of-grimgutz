import {MODULE_ID} from "../shared/constants.mjs";
import {enabled,findFeature} from "../shared/helpers.mjs";
import {dullahanHas,dullahanLevel,dullahanState,patchDullahan,dullahanPassiveActive} from "./dullahan.mjs";
import {dullahanGm,dullahanTargets,dullahanPulse} from "./dullahan-use.mjs";
import {askOwner,confirmOwner} from "../shared/owner-prompts.mjs";
import {registerGmRequest,requestGm,isGmAuthority} from "../shared/gm-requests.mjs";
import {serialMutation} from "../shared/transactions.mjs";
import {applyNativeOnce} from "../shared/native-applications.mjs";
import {appendCalculatedBonus} from "../shared/combat-benefits.mjs";
import {calculatedDamage,commitCalculatedDamage} from "../midi/damage-packet.mjs";
import {onPrepareDamage,onConfirmedDamage} from "../shared/damage-events.mjs";
import {isEffectActive} from "../effects/temporary-effects.mjs";
const attackKey=(workflowId,target)=>`${workflowId}:${target.uuid}`;
export function dullahanWeaponDie(activity){const base=activity?.damage?.includeBase?activity.item?.system?.damage?.base:activity?.damage?.parts?.[0];return !base?.custom?.enabled&&Number(base?.denomination)>0?Number(base.denomination):0;}
registerGmRequest("dullahan-bonuses",(actor,data)=>serialMutation(`dullahan-bonuses:${actor.uuid}`,async()=>{
  if(!enabled()||!isGmAuthority()||!data.workflowId)return false;const activity=await fromUuid(data.activityUuid),target=await fromUuid(data.targetUuid),source=await fromUuid(data.sourceUuid);
  if(activity?.actor?.uuid!==actor.uuid||activity.type!=="attack"||!target?.actor||source?.actor?.uuid!==actor.uuid||source.parent.id!==target.parent.id)return false;
  const key=attackKey(data.workflowId,target),claims=dullahanState(actor).damageClaims??{},previous=claims[key];if(previous)return previous;
  const hp=target.actor.system.attributes.hp,wasWounded=Number(hp.value)<Number(hp.effectiveMax??hp.max),oath=dullahanState(actor).oath,
    weapon=dullahanHas(actor,"oath")&&activity.item.type==="weapon"&&!oath?.deathConfirmed&&oath?.targetActorUuid===target.actor.uuid&&[...(target.actor.effects??[])].some(e=>{const mark=e.getFlag?.(MODULE_ID,"dullahanOath");return mark?.sourceActorUuid===actor.uuid&&mark.oathId===oath.id&&isEffectActive(e);})?dullahanWeaponDie(activity):0,
    fire=dullahanHas(actor,"unnerving")&&activity.attack?.type?.value==="melee"&&wasWounded;
  if(!weapon&&!fire)return {status:"success",bonuses:[]};
  await patchDullahan(actor,{damageClaims:{...claims,[key]:{status:"needs-review"}}});const bonuses=[],count=data.critical?2:1;
  for(const [kind,die,type] of [["oath",weapon,data.damageType],["unnerving",fire?6:0,"fire"]])if(die&&type){const roll=await new Roll(`${count}d${die}`,actor.getRollData()).evaluate();await roll.toMessage({speaker:ChatMessage.getSpeaker({actor}),flavor:kind==="oath"?"Клятва охотника: дополнительная кость оружия":"Нервирующее пламя: дополнительный урон"});bonuses.push({kind,value:Number(roll.total),type});}
  const reply={status:"success",bonuses},all={...(dullahanState(actor).damageClaims??{}),[key]:reply},entries=Object.entries(all),kept=[...entries.filter(([,v])=>v.status!=="success"),...entries.filter(([,v])=>v.status==="success").slice(-100)];await patchDullahan(actor,{damageClaims:Object.fromEntries(kept)});return reply;
}));
export async function applyDullahanPacket(token,{workflow,damageItem}){if(!enabled()||workflow?.aborted||!token?.actor)return;
  applyDullahanHealing(token,{workflow,damageItem});if((damageItem.damageSelector??"combinedDamage")!=="combinedDamage"||workflow.activity?.type!=="attack"||!["oath","unnerving"].some(id=>dullahanHas(workflow.actor,id)))return;
  const target=token.document??token,source=workflow.token?.document??workflow.token;if(!source?.uuid||![...(workflow.hitTargets??[])].some(t=>(t.document?.uuid??t.uuid)===target.uuid))return;
  const key=attackKey(workflow.id,target);if(damageItem.grimgutzDullahanBonus===key)return;
  const baseTypes=[...(workflow.activity.damage?.includeBase?workflow.item.system.damage?.base?.types??[]:workflow.activity.damage?.parts?.[0]?.types??[])];
  const type=calculatedDamage(damageItem).find(p=>baseTypes.includes(p.type))?.type??(baseTypes.length===1?baseTypes[0]:null);
  const result=await requestGm("dullahan-bonuses",workflow.actor,{activityUuid:workflow.activity.uuid,targetUuid:target.uuid,sourceUuid:source.uuid,workflowId:workflow.id,critical:Boolean(workflow.isCritical&&workflow.attackRoll),damageType:type},{requestId:`dullahan-bonus:${key}`});
  if(result.status!=="success")return;for(const bonus of result.bonuses??[])await appendCalculatedBonus(token,damageItem,bonus.value,bonus.type);damageItem.grimgutzDullahanBonus=key;
}
onPrepareDamage(({actor,target,data})=>{const claim=dullahanState(actor).damageClaims?.[attackKey(data.workflowId,target)],fire=claim?.bonuses?.find(b=>b.kind==="unnerving");return fire?{context:{dullahanFireRoll:fire.value}}:null;});
export function applyDullahanHealing(token,{workflow,damageItem}){if(!dullahanHas(token.actor,"form")||!dullahanPassiveActive(token.actor,"form")||(damageItem.damageSelector??"combinedDamage")!=="combinedDamage"||damageItem.grimgutzDullahanHealing===JSON.stringify(calculatedDamage(damageItem)))return;
  const actor=token.actor,parts=calculatedDamage(damageItem),healing=parts.filter(p=>p.type==="healing"&&Number(p.value)<0);if(!healing.length)return;
  const zero=Number(actor.system.attributes.hp.value)===0,foreign=workflow.actor?.uuid!==actor.uuid&&["spell","feat"].includes(workflow.item?.type);if(!zero&&!foreign)return;
  const amount=-healing.reduce((n,p)=>n+Number(p.value),0);for(const p of healing)p.value=0;if(zero)healing[0].value=-1;else parts.push({type:"temphp",value:amount,active:{}});commitCalculatedDamage(token,damageItem,parts);damageItem.grimgutzDullahanHealing=JSON.stringify(parts);
  if(zero){const selector=damageItem.damageSelector??"combinedDamage",options=damageItem.damageDetails?.calcDamageOptions?.[selector]??damageItem.calcDamageOptions??{};options[MODULE_ID]={...options[MODULE_ID],dullahanZeroHealing:true};damageItem.calcDamageOptions=options;damageItem.damageDetails.calcDamageOptions??={};damageItem.damageDetails.calcDamageOptions[selector]=options;}
}
export async function runDullahanFortitude(actor,{amount,radiant=false,requestId}){if(!enabled()||!isGmAuthority()||!dullahanHas(actor,"fortitude")||Number(actor.system.attributes.hp.value)!==0||!(amount>0))return false;
  return applyNativeOnce(actor,{requestId,action:"dullahan-fortitude",activityUuid:findFeature(actor,"dullahan-fortitude")?.uuid},async()=>{
    if(!await confirmOwner(actor,"Стойкость нежити",`Получено ${amount} урона, CON Сл ${5+amount}${radiant?", без бонуса ступени (излучение)":`, +${dullahanLevel(actor)} ступени`}. Совершить спасбросок?`))return false;
    const rolls=await actor.rollSavingThrow({ability:"con",target:5+amount,...(!radiant?{rolls:[{parts:[String(dullahanLevel(actor))]}]}:{})},{configure:false});if(!rolls?.length)return false;return {success:Number(rolls[0].total)>=5+amount};
  },async result=>{if(result.success&&Number(actor.system.attributes.hp.value)===0)await actor.update({"system.attributes.hp.value":1});return true;});
}
export async function dullahanScar(source,target,item,amount){const hp=target.actor.system.attributes.hp,max=Number(hp.effectiveMax??hp.max),reduction=Math.max(0,Math.min(Number(amount),max));if(!reduction)return false;
  await target.actor.createEmbeddedDocuments("ActiveEffect",[{name:`Нервирующее пламя: максимум −${reduction}`,img:item.img,type:"base",disabled:false,transfer:false,origin:item.uuid,statuses:[],start:null,duration:{value:null,units:"seconds",expiry:null,expired:false},flags:{[MODULE_ID]:{dullahanScar:{sourceActorUuid:source.actor.uuid,amount:reduction}}},system:{changes:[{key:"system.attributes.hp.tempmax",type:"add",value:String(-reduction),phase:"initial",priority:20}]}}]);
  if(Number(hp.value)>max-reduction)await target.actor.update({"system.attributes.hp.value":Math.max(0,max-reduction)});return true;
}
onConfirmedDamage(async({actor,amount,event})=>{
  if(!enabled()||!isGmAuthority())return;
  if(amount>0&&Number(event.beforeHp)>0&&Number(actor.system.attributes.hp.value)===0&&dullahanHas(actor,"fortitude"))await runDullahanFortitude(actor,{amount,radiant:(event.damageTypes??[event.damageType]).includes("radiant"),requestId:`dullahan-fortitude:${event.workflowId??event.key}:${actor.uuid}`});
  const source=await fromUuid(event.sourceTokenUuid),target=await fromUuid(event.targetTokenUuid),activity=await fromUuid(event.activityUuid);
  if(!source?.actor||!target?.actor||!activity||!dullahanHas(source.actor,"unnerving")||activity.type!=="attack"||activity.attack?.type?.value!=="melee"||!(event.dullahanFireRoll>0))return;
  await applyNativeOnce(source.actor,{requestId:`dullahan-scar:${event.workflowId??event.key}:${target.uuid}`,action:"dullahan-scar",activityUuid:activity.uuid},async()=>true,async()=>{
    const item=findFeature(source.actor,"dullahan-unnerving"),result=await dullahanPulse(source,item,[target],{save:"con",requestId:`dullahan-scar:${event.key}`});if(result.status!=="success")return {status:"needs-review"};if(result.failedSaves.includes(target.uuid))await dullahanScar(source,target,item,event.dullahanFireRoll);return true;
  });
});
export async function useDullahanHeadHunter(actor,activity,source,requestId){const selected=await dullahanTargets(dullahanGm(actor),source,1000000,"GM: цель натуральной 20"),target=selected?.[0];if(!target)return false;
  const mode=await askOwner(dullahanGm(actor),{title:"Охотник за головами: подтверждение GM",label:"Действительно выпала натуральная 20 и это подходящее оружие? Крит 18/19 не подходит. Иммунитет/легендарные действия/анатомию/размер проверяет GM.",choices:[["save","Подходит: CON, при провале одна голова"],["damage","Исключение: вместо отсечения 6к8 рубящего"]]});if(!["save","damage"].includes(mode))return false;
  return applyNativeOnce(actor,{requestId,action:"dullahan-headhunter",activityUuid:activity.uuid},async()=>true,async()=>{
    const result=await dullahanPulse(source,activity.item,[target],{...(mode==="save"?{save:"con"}:{damage:[{formula:"6d8",type:"slashing"}]}),requestId});if(result.status==="needs-review")return result;
    if(mode==="save"&&result.failedSaves?.includes(target.uuid)){
      const outcome=await askOwner(dullahanGm(actor),{title:"GM: после отсечения одной головы",choices:[["survives","Может выжить без этой головы"],["dies","Смерть подтверждена GM"]]});if(!["survives","dies"].includes(outcome))return {status:"needs-review"};
      await target.actor.setFlag(MODULE_ID,"dullahanDecapitation",{sourceActorUuid:actor.uuid,requestId,outcome});if(outcome==="dies")await target.actor.update({"system.attributes.hp.value":0});
    }return true;
  });
}
