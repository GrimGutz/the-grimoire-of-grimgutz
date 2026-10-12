import {MODULE_ID,SETTINGS} from "../shared/constants.mjs";
import {enabled,findFeature,itemUses,isAutomationAuthority,automationData,notify} from "../shared/helpers.mjs";
import {classLevel} from "../shared/selectors.mjs";
import {FLAGELLANT_ICON,flagellantPain,flagellantEnduranceBonus,flagellantMaximum,flagellantPricePlan} from "../shared/flagellant-definitions.mjs";
import {flaggedPassiveEffectData,syncFlaggedPassiveEffects,guardPassiveChanges,recordPassiveSnapshots} from "../effects/passive-helpers.mjs";
import {isEffectActive} from "../effects/temporary-effects.mjs";
import {activeBenefits,benefitData,addCombatBenefit} from "../shared/combat-benefits.mjs";
import {registerGmRequest,requestGm,isGmAuthority} from "../shared/gm-requests.mjs";
import {serialMutation} from "../shared/transactions.mjs";
import {applyNativeOnce} from "../shared/native-applications.mjs";
import {askOwner,confirmOwner} from "../shared/owner-prompts.mjs";

export const flagellantLevel=actor=>classLevel(actor,"flagellant");
export const flagellantTotalLevel=actor=>Math.max(Number(actor.system?.details?.level)||0,[...(actor.items??[])].filter(i=>i.type==="class").reduce((n,i)=>n+(Number(i.system.levels)||0),0));
export const flagellantDC=actor=>8+Number(actor.system.attributes.prof)+Number(actor.system.abilities.con.mod);
export const flagellantTechniques=actor=>activeBenefits(actor).filter(e=>benefitData(e).flagellantTechnique);
export function flagellantAvailable(actor,item){const flags=automationData(item);if(flags.flagellantBorrowed)return flagellantTechniques(actor).some(e=>e.uuid===flags.flagellantBorrowed&&benefitData(e).flagellantTechnique.kind==="onslaught"&&!benefitData(e).flagellantTechnique.claimedBy);
  return flags.flagellantFeature&&flagellantLevel(actor)>=Number(flags.minimumLevel??1);}
export const flagellantMaxDebts=actor=>actor.getFlag?.(MODULE_ID,"flagellantMaxDebts")??[];
const gm=actor=>({uuid:actor.uuid,testUserPermission:user=>user.isGM});
function maxDefinition(actor,debts=flagellantMaxDebts(actor)){
  const sacrifice=actor.getFlag?.(MODULE_ID,"flagellantSacrifice"),permanent=flagellantLevel(actor)>=4&&sacrifice?.choice==="ability"?flagellantTotalLevel(actor):0;
  const amount=debts.reduce((n,row)=>n+Number(row.amount),0)+permanent;if(!amount)return null;
  const source=permanent?findFeature(actor,"flagellant-sacrifice"):{uuid:debts[0]?.sourceItemUuid,name:"Цена силы",img:FLAGELLANT_ICON};
  const baseMaximum=Number(actor.system.attributes.hp.max),rawTemporary=Number(actor._source?.system?.attributes?.hp?.tempmax??0);
  const reduction=Math.min(amount,Math.max(0,baseMaximum+rawTemporary-1));
  // tempmax is applied BEFORE D&D5e computes effectiveMax/value/damage. A final
  // hp.max edit would leave these derived values stale in the installed system.
  return flaggedPassiveEffectData(MODULE_ID,"flagellantPassive",{key:"max-loss",feature:source,name:"Самобичеватель: снижение максимума хитов",changes:[
    {key:"system.attributes.hp.tempmax",value:String(-reduction),type:"add",phase:"initial",priority:20}]});
}
export function flagellantPassiveDefinitions(actor){if(!actor.system?.attributes?.hp)return [];const desired=[],flesh=findFeature(actor,"flagellant-flesh");
  if(flagellantLevel(actor)>=3&&flesh){const pain=flagellantPain(actor),changes=[{key:"system.abilities.con.save.roll.mode",value:"1",type:"upgrade",phase:"final",priority:20}];
    if(pain.taste)for(const type of ["bludgeoning","piercing","slashing"])changes.push({key:"system.traits.dr.value",value:type,type:"custom",phase:"initial",priority:20});
    desired.push(flaggedPassiveEffectData(MODULE_ID,"flagellantPassive",{key:"flesh",feature:flesh,changes}));}
  const maximum=maxDefinition(actor);if(maximum)desired.push(maximum);return desired;
}
export function flagellantTechniqueChanges(actor,state){const data=state.flagellantTechnique;
  if(data.kind==="endurance")return [{key:"system.attributes.ac.bonus",value:String(flagellantEnduranceBonus(actor,data.values)),type:"add",phase:"final",priority:20}];
  if(data.kind==="surge"){const units=actor.system.attributes.movement.units,feet=data.amount*5,amount=units==="m"?feet*0.3048:units==="yd"?feet/3:feet;
    return [{key:"system.attributes.movement.walk",value:String(amount),type:"add",phase:"final",priority:20}];}return [];
}
const syncing=new Set();
export async function syncFlagellant(actor){if(!enabled()||!isAutomationAuthority(actor)||!actor.system?.attributes?.hp)return;
  await syncFlaggedPassiveEffects(actor,syncing,MODULE_ID,"flagellantPassive",flagellantPassiveDefinitions);
  const orphaned=[...(actor.items??[])].filter(item=>automationData(item).flagellantBorrowed&&!actor.effects.some(effect=>effect.uuid===automationData(item).flagellantBorrowed));
  if(orphaned.length)await actor.deleteEmbeddedDocuments("Item",orphaned.map(item=>item.id));
  for(const effect of flagellantTechniques(actor)){const desired={...effect.toObject(),system:{changes:flagellantTechniqueChanges(actor,benefitData(effect))}},guarded=guardPassiveChanges(effect,desired,MODULE_ID);
    if(guarded&&JSON.stringify(effect.toObject().system?.changes)!==JSON.stringify(guarded.system.changes))await effect.update(guarded);}
  const feature=findFeature(actor,"flagellant-force");if(flagellantLevel(actor)>=5&&feature){const maximum=Number(actor.system.attributes.prof),old=itemUses(feature);
    if(old.maximum!==maximum||old.spent>maximum)await feature.update({"system.uses.max":String(maximum),"system.uses.spent":Math.min(maximum,old.spent)});}
}
export function flagellantPrerequisiteFailures(actor,incomingLevels=1){const failed=[];
  if(flagellantTotalLevel(actor)+Number(incomingLevels)<6)failed.push("общий уровень 6 с учётом получаемого уровня");
  if(Number(actor.system?.abilities?.con?.value??0)<18)failed.push("Телосложение 18");return failed;}
export function validateFlagellantItem(item,_data,_options,userId){if(userId!==game.user.id||!enabled()||!game.settings.get(MODULE_ID,SETTINGS.STRICT_PREREQUISITES))return;
  if(item.type==="class"&&item.system.identifier==="flagellant"&&item.parent){const failed=flagellantPrerequisiteFailures(item.parent,Number(item.system.levels??1));if(failed.length){notify(`Самобичеватель: ${failed.join("; ")}.`,"warn");return false;}}}
export async function payFlagellantPrice(actor,amount,{id,sourceItem}={}){
  if(!enabled()||!isGmAuthority()||!id||!sourceItem)throw Error("Цена силы требует активного GM и идентификатора применения.");
  return serialMutation(`flagellant-price:${actor.uuid}`,async()=>{
    const claims=actor.getFlag(MODULE_ID,"flagellantPriceClaims")??{},previous=claims[id];if(previous)return previous;
    const plan=flagellantPricePlan(actor,amount);await actor.setFlag(MODULE_ID,"flagellantPriceClaims",{...claims,[id]:{status:"needs-review",amount}});
    if(plan.mode==="maximum"&&plan.ok){
      const debts=[...flagellantMaxDebts(actor),{id,amount,sourceItemUuid:sourceItem.uuid,sourceActorUuid:sourceItem.actor?.uuid}],existing=[...(actor.effects??[])].find(e=>e.getFlag?.(MODULE_ID,"flagellantPassive")==="max-loss");
      if(existing&&(!isEffectActive(existing)||!guardPassiveChanges(existing,maxDefinition(actor,debts),MODULE_ID)))throw Error("Снижение максимума отключено/изменено вручную: цену должен разрешить GM.");
      await actor.setFlag(MODULE_ID,"flagellantMaxDebts",debts);await syncFlagellant(actor);
    }else if(plan.mode==="hp"&&plan.after!==undefined)await actor.update({"system.attributes.hp.value":plan.after},{[MODULE_ID]:{flagellantPrice:id}});
    const result={status:"success",...plan};await actor.setFlag(MODULE_ID,"flagellantPriceClaims",Object.fromEntries(Object.entries({...actor.getFlag(MODULE_ID,"flagellantPriceClaims"),[id]:result}).slice(-150)));
    return result;
  });
}
export async function createFlagellantState(source,target,item,kind,{technique=null,expiry="sourceStart",...extra}={}){
  const effect=await addCombatBenefit(source,target,item,{kind:`flagellant-${kind}`,expiry,...extra,...(technique?{flagellantTechnique:technique}:{}),changes:technique?flagellantTechniqueChanges(target.actor,{flagellantTechnique:technique}):[]});
  // Outside initiative a "next turn" has no timestamp; do not invent a minute or six seconds.
  if(!benefitData(effect).combatId)await effect.update({start:null,duration:{value:null,units:"seconds",expiry:null,expired:false}});
  await recordPassiveSnapshots(target.actor,[effect],MODULE_ID);return effect;
}
export async function endFlagellantTechnique(actor){for(const effect of [...(actor.effects??[])])if(benefitData(effect)?.flagellantTechnique){
  const desired={...effect.toObject(),system:{changes:flagellantTechniqueChanges(actor,benefitData(effect))}};
  if(!guardPassiveChanges(effect,desired,MODULE_ID))throw Error("Приём изменён вручную. Его замену должен проверить GM.");
  await effect.delete();}}
registerGmRequest("flagellant-sacrifice",(actor,data)=>serialMutation(`flagellant-sacrifice:${actor.uuid}`,async()=>{
  const item=await fromUuid(data.itemUuid);if(!enabled()||!isGmAuthority()||item?.actor?.uuid!==actor.uuid||item.system.identifier!=="flagellant-sacrifice"||!flagellantAvailable(actor,item)||actor.getFlag(MODULE_ID,"flagellantSacrifice"))return false;
  const choices=[["feat","Выбрать черту штатно"],...["str","dex","con","int","wis","cha"].map(key=>[key,`${key.toUpperCase()}: +3 и уменьшение максимума HP на общий уровень`])],choice=await askOwner(actor,{title:item.name,choices});
  if(!choices.some(([key])=>key===choice))return false;
  const patch={[`flags.${MODULE_ID}.flagellantSacrifice`]:{choice:choice==="feat"?"feat":"ability",ability:choice==="feat"?null:choice}};
  if(choice!=="feat"){const raw=actor._source.system.abilities[choice];patch[`system.abilities.${choice}.value`]=Number(raw.value)+3;patch[`system.abilities.${choice}.max`]=Number(raw.max??CONFIG.DND5E.maxAbilityScore??20)+3;}
  await actor.update(patch);await syncFlagellant(actor);if(choice==="feat")notify("Добавьте выбранную черту штатно; изменения характеристик и HP не выдаются.");return true;
}));
registerGmRequest("flagellant-rest",(actor,data,{requestId})=>serialMutation(`flagellant-rest:${actor.uuid}`,async()=>{
  if(!enabled()||!["short","long"].includes(data.type))return false;
  return applyNativeOnce(actor,{requestId,action:"flagellant-rest",activityUuid:null},async()=>true,async()=>{
    for(const key of ["retribution",...(data.type==="long"?["feast","force"]:[])]){const item=findFeature(actor,`flagellant-${key}`);if(item&&itemUses(item).spent)await item.update({"system.uses.spent":0});}
    if(data.type!=="long"||!flagellantMaxDebts(actor).length)return true;
    const effect=[...(actor.effects??[])].find(e=>e.getFlag?.(MODULE_ID,"flagellantPassive")==="max-loss"),desired=maxDefinition(actor);
    if(effect&&desired&&!guardPassiveChanges(effect,desired,MODULE_ID)){notify("Цена силы: максимум изменён вручную; восстановление должен проверить GM.","warn");return {status:"needs-review"};}
    await actor.unsetFlag(MODULE_ID,"flagellantMaxDebts");await syncFlagellant(actor);
    if(data.restoreFull&&await confirmOwner(gm(actor),"Продолжительный отдых (GM)","Этот отдых предусматривает полное восстановление текущих HP? Восстановить их до нового максимума после снятия цены силы?"))await actor.update({"system.attributes.hp.value":flagellantMaximum(actor)});
    return true;
  });
}));
export function flagellantRestCompleted(actor,result){if(!enabled()||(!flagellantLevel(actor)&&!flagellantMaxDebts(actor).length))return Promise.resolve(false);
  const id=result.flagellantRestId??=result.message?.uuid??foundry.utils.randomID(),type=result.longRest?"long":result.type;
  return requestGm("flagellant-rest",actor,{type,restoreFull:type==="long"},{requestId:`flagellant-rest:${id}`,timeoutMs:120000});
}
