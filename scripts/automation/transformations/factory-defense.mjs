import {MODULE_ID} from "../shared/constants.mjs";
import {enabled,findFeature,itemUses} from "../shared/helpers.mjs";
import {factoryHas,factoryAugment,factoryInstalledItem,factoryState,patchFactory,factoryAddicted} from "./factory.mjs";
import {factoryExpense} from "./factory-use.mjs";
import {factoryChildSnapshot} from "./factory-homunculi.mjs";
import {confirmOwner} from "../shared/owner-prompts.mjs";
import {registerGmRequest,requestGm,isGmAuthority} from "../shared/gm-requests.mjs";
import {applyNativeOnce,nativeApplicationReply} from "../shared/native-applications.mjs";
import {useNativeUtility} from "../shared/native-actions.mjs";
import {canReact,recordModuleReaction} from "../shared/combat-benefits.mjs";
import {calculatedDamage,commitCalculatedDamage} from "../midi/damage-packet.mjs";
export async function runFactoryFortitude(actor,{amount,radiant=false,critical=false,requestId}){if(!enabled()||!isGmAuthority()||!factoryHas(actor,"fortitude")||Number(actor.system.attributes.hp.value)!==0||!(amount>0)||radiant||critical)return false;
  return applyNativeOnce(actor,{requestId,action:"factory-fortitude",activityUuid:findFeature(actor,"factory-fortitude")?.uuid},async()=>{if(!await confirmOwner(actor,"Адаптированная стойкость",`CON Сл ${5+amount}; урон не критический и не лучистый. Совершить спасбросок?`))return false;const rolls=await actor.rollSavingThrow({ability:"con",target:5+amount},{configure:false});return rolls?.length?{success:Number(rolls[0].total)>=5+amount}:false;},async result=>{if(result.success&&Number(actor.system.attributes.hp.value)===0)await actor.update({"system.attributes.hp.value":1});return true;});
}
registerGmRequest("factory-auto-save",async(caster,data,{requestId})=>{if(!enabled()||!isGmAuthority()||!data.workflowId)return false;const activity=await fromUuid(data.activityUuid),target=await fromUuid(data.targetUuid);if(activity?.actor?.uuid!==caster.uuid||!target?.actor)return false;
  const abilities=[...(activity.save?.ability??[])];if(abilities.length!==1)return false;const ability=abilities[0],id=["str","dex","con"].includes(ability)?"immunizer":["int","wis","cha"].includes(ability)?"firewall":null,record=id&&factoryAugment(target.actor,id),item=record&&factoryInstalledItem(target.actor,record);if(!item)return false;
  const old=nativeApplicationReply(target.actor,requestId);if(old)return old;if(itemUses(item).remaining<1)return false;const use=[...item.system.activities.values()][0];
  return applyNativeOnce(target.actor,{requestId,action:`factory-${id}`,activityUuid:activity.uuid},async()=>{if(!await confirmOwner(target.actor,item.name,"Провалить этот конкретный спасбросок или потратить одно применение до LR и заменить провал успехом?"))return false;return useNativeUtility(use,{dataPatch:factoryExpense(use,{activation:"special",cost:1})});},async()=>true);
});
export async function finishFactorySaves(workflow){if(!enabled()||workflow?.aborted||!workflow.activity||!workflow.actor)return;for(const target of [...(workflow.failedSaves??[])]){if(!factoryAugment(target.actor,"firewall")&&!factoryAugment(target.actor,"immunizer"))continue;const uuid=target.document?.uuid??target.uuid,result=await requestGm("factory-auto-save",workflow.actor,{activityUuid:workflow.activity.uuid,targetUuid:uuid,workflowId:workflow.id},{requestId:`factory-auto-save:${workflow.id}:${uuid}`,timeoutMs:180000});if(result.status==="success"){workflow.failedSaves.delete(target);workflow.saves??=new Set();workflow.saves.add(target);}}}
registerGmRequest("factory-hyper",async(caster,data,{requestId})=>{if(!enabled()||!isGmAuthority()||!data.workflowId)return false;const activity=await fromUuid(data.activityUuid),target=await fromUuid(data.targetUuid),record=target&&factoryAugment(target.actor,"hypermobility");if(activity?.actor?.uuid!==caster.uuid||!record||activity.type!=="save"||![...(activity.save?.ability??[])].includes("dex")||activity.damage?.onSave!=="half")return false;
  const old=nativeApplicationReply(target.actor,requestId);if(old)return old;const item=factoryInstalledItem(target.actor,record),use=[...item.system.activities.values()][0];if(!canReact(target.actor))return false;
  return applyNativeOnce(target.actor,{requestId,action:"factory-hyper",activityUuid:activity.uuid},async()=>{if(!await confirmOwner(target.actor,"Гипер мобильность","До броска DEX потратить реакцию: успех 0 урона, провал половина?"))return false;return useNativeUtility(use,{dataPatch:factoryExpense(use,{activation:"reaction"})});},async()=>{await recordModuleReaction(target.actor,target.parent);await patchFactory(target.actor,{hyperClaims:{...factoryState(target.actor).hyperClaims,[data.workflowId]:true}});return true;});
});
export async function prepareFactorySave(target,workflow,details){if(!enabled()||!target?.actor||!workflow?.activity)return;if(factoryAddicted(target.actor)&&factoryHas(target.actor,"withdrawal"))details.disadvantage=true;
  if(factoryAugment(target.actor,"hypermobility"))await requestGm("factory-hyper",workflow.actor,{activityUuid:workflow.activity.uuid,targetUuid:target.document?.uuid??target.uuid,workflowId:workflow.id},{requestId:`factory-hyper:${workflow.id}:${target.document?.uuid??target.uuid}`,timeoutMs:180000});
  const poison=factoryAugment(target.actor,"blood")&&[...(workflow.activity.effects??[])].some(ref=>[...(workflow.item.effects??[])].find(e=>e.id===ref._id)?.statuses?.has?.("poisoned"));if(poison)details.advantage=true;
}
export function applyFactoryDefense(token,{workflow,damageItem}){if(!enabled()||workflow?.aborted||!token?.actor||(damageItem.damageSelector??"combinedDamage")!=="combinedDamage")return;const actor=token.actor,parts=calculatedDamage(damageItem);
  if(workflow.grimgutzFactoryBlocked?.has(token.document?.uuid??token.uuid)){for(const part of parts)part.value=0;commitCalculatedDamage(token,damageItem,parts);return;}
  const evasion=factoryChildSnapshot(actor)?.material==="mithral"||factoryState(actor).hyperClaims?.[workflow.id],dex=workflow.activity?.type==="save"&&[...(workflow.activity.save?.ability??[])].includes("dex")&&workflow.activity.damage?.onSave==="half";
  if(evasion&&dex&&!damageItem.grimgutzFactoryEvasion){const saved=[...(workflow.saves??[])].some(t=>(t.document?.uuid??t.uuid)===(token.document?.uuid??token.uuid));for(const p of parts)if(Number(p.value)>0&&! ["healing","temphp","maximum","midi-none"].includes(p.type))p.value=saved?0:Number(p.value)/2;commitCalculatedDamage(token,damageItem,parts);damageItem.grimgutzFactoryEvasion=true;}
  if(factoryHas(actor,"perfection")&&workflow.activity?.type==="attack"&&!damageItem.grimgutzFactoryPhysical){const magical=workflow.item?.type==="spell"||workflow.item?.system?.properties?.has?.("mgc")||workflow.item?.system?.properties?.includes?.("mgc")||Number(workflow.item?.system.magicalBonus??0)>0||workflow.activity?.midiProperties?.magicdam===true;
    if(!magical){for(const p of parts)if(["bludgeoning","piercing","slashing"].includes(p.type)&&Number(p.value)>0&&!p.active?.resistance&&!p.active?.immunity&&!p.active?.[MODULE_ID]?.ignoreResistance)p.value=Number(p.value)/2;commitCalculatedDamage(token,damageItem,parts);}damageItem.grimgutzFactoryPhysical=true;
  }
}
