import {MODULE_ID} from "../shared/constants.mjs";
import {enabled,findFeature,automationData} from "../shared/helpers.mjs";
import {applyNativeOnce} from "../shared/native-applications.mjs";
import {requestGm,registerGmRequest,isGmAuthority} from "../shared/gm-requests.mjs";
import {inFeet} from "../shared/combat-benefits.mjs";
import {isEffectActive} from "../effects/temporary-effects.mjs";
import {areaDamagePart} from "../shared/area-definitions.mjs";
import {calculatedDamage,commitCalculatedDamage} from "../midi/damage-packet.mjs";
import {hdHas,hdAncestry,hdElementArmor} from "./halfdragon.mjs";
import {hdTargets,hdExpense,hdPulse,hdTurnBenefit} from "./halfdragon-use.mjs";

export function halfdragonAttackData(activity,operation){const bite=operation==="bite";return {...activity.toObject(),type:"attack",...hdExpense(activity),attack:{ability:"str",flat:false,bonus:"",type:{value:"melee",classification:"unarmed"}},damage:{includeBase:false,parts:[areaDamagePart({formula:`${bite?"1d8":"2d6"} + @abilities.str.mod`,type:bite?"piercing":"slashing"})]},range:{value:5,units:"ft",override:true},target:{template:{type:""},affects:{type:"creature",count:"1",choice:false},override:true,prompt:false},flags:{[MODULE_ID]:{halfdragonResolved:true,halfdragonNatural:operation,action:""}}};}
export async function halfdragonAttack(actor,activity,source,operation,requestId){const selected=await hdTargets(actor,source,5,"Цель природной безоружной атаки"),target=selected?.[0];if(!target)return false;const data=halfdragonAttackData(activity,operation),a=activity.item.clone({system:{activities:{[activity.id]:data}}},{keepId:true}).system.activities.get(activity.id);
  return applyNativeOnce(actor,{requestId,action:`halfdragon-${operation}`,activityUuid:activity.uuid},()=>MidiQOL.completeActivityUse(a,{midiOptions:{targetUuids:[target.uuid],workflowOptions:{ignoreUserTargets:true,targetConfirmation:"none"}}},{configure:false}),async()=>true);
}
registerGmRequest("halfdragon-hit",async(actor,data,{requestId})=>{const activity=await fromUuid(data.activityUuid),source=await fromUuid(data.sourceUuid),target=await fromUuid(data.targetUuid);if(!enabled()||!isGmAuthority()||activity?.actor?.uuid!==actor.uuid||source?.actor?.uuid!==actor.uuid||target?.parent?.id!==source.parent.id||!inFeet(source,target,5,source.parent))return false;
  return applyNativeOnce(actor,{requestId,action:"halfdragon-hit",activityUuid:activity.uuid},async()=>true,async()=>{
    if(data.bite&&hdHas(actor,"limbs")&&activity.item.system.identifier==="halfdragon-limbs"&&automationData(activity).halfdragonOperation==="bite"&&hdAncestry(actor)){const e=await hdTurnBenefit(source,target,findFeature(actor,"halfdragon-limbs"),"halfdragon-bite");await e.setFlag(MODULE_ID,"halfdragonBiteType",hdAncestry(actor).damageType);}
    const armor=hdElementArmor(target.actor);if(armor&&data.melee){const type=armor.getFlag(MODULE_ID,"halfdragonCondition")?.damageType;if(type)return hdPulse(target,findFeature(target.actor,"halfdragon-fundamentum"),[source],{damage:[{formula:String(Math.max(0,Number(target.actor.system.abilities.con.mod))),type}],requestId:`${requestId}:retaliate`});}return true;
  });
});
export async function finishHalfdragonAttack(workflow){if(!enabled()||workflow?.aborted||workflow.activity?.type!=="attack"||!workflow.actor)return;const sourceUuid=workflow.tokenUuid??workflow.token?.document?.uuid??workflow.token?.uuid,melee=workflow.activity.attack?.type?.value==="melee",bite=workflow.activity.flags?.[MODULE_ID]?.halfdragonNatural==="bite";if(!melee&&!bite)return;
  for(const t of workflow.hitTargets??[]){const target=t.document??t;if(!hdElementArmor(target.actor)&&!bite)continue;await requestGm("halfdragon-hit",workflow.actor,{activityUuid:workflow.activity.uuid,sourceUuid,targetUuid:target.uuid,melee,bite},{requestId:`halfdragon-hit:${workflow.id}:${target.uuid}`,timeoutMs:180000});}
}
export function applyHalfdragonBite(token,{workflow,damageItem}){if(!enabled()||workflow?.aborted||!token?.actor||(damageItem.damageSelector??"combinedDamage")!=="combinedDamage")return;
  const types=new Set([...(token.actor.effects??[])].filter(e=>isEffectActive(e)&&e.getFlag?.(MODULE_ID,"combatBenefit")?.kind==="halfdragon-bite").map(e=>e.getFlag(MODULE_ID,"halfdragonBiteType")).filter(Boolean));if(!types.size)return;
  const selector=damageItem.damageSelector??"combinedDamage",raw=damageItem.damageDetails?.[`raw${selector}`]??damageItem.rawDamageDetail;if(!raw||!token.actor.calculateDamage)return;
  const fingerprint=()=>JSON.stringify([raw,calculatedDamage(damageItem)]);if(damageItem.grimgutzHalfdragonBite===fingerprint())return;
  const options=structuredClone(damageItem.damageDetails?.calcDamageOptions?.[selector]??damageItem.calcDamageOptions??{invertHealing:true});if(options.ignore===true)return;options.ignore??={};if(options.ignore.resistance!==true)options.ignore.resistance=new Set([...(options.ignore.resistance??[]),...types]);
  const fresh=token.actor.calculateDamage(structuredClone(raw.filter(p=>types.has(p.type))),options);for(const p of fresh){p.active??={};p.active[MODULE_ID]={...p.active[MODULE_ID],ignoreResistance:true};}
  damageItem.calcDamageOptions=options;damageItem.damageDetails??={};damageItem.damageDetails.calcDamageOptions??={};damageItem.damageDetails.calcDamageOptions[selector]=options;commitCalculatedDamage(token,damageItem,[...calculatedDamage(damageItem).filter(p=>!types.has(p.type)),...fresh]);damageItem.grimgutzHalfdragonBite=fingerprint();
}
