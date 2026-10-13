import {MODULE_ID} from "../shared/constants.mjs";
import {empathEffects,empathEffectData} from "../shared/empath-state.mjs";
import {empathChange,empathFeet} from "./empath.mjs";
import {addCombatBenefit} from "../shared/combat-benefits.mjs";
import {encounterForScene} from "../shared/combat-flow.mjs";
import {temporaryEffectTiming} from "../effects/temporary-effects.mjs";
import {useAuraPulse} from "../midi/aura-workflow.mjs";
export const empathPlaceable=token=>token.object??{actor:token.actor,document:token};
export function empathMovement(actor,{half=false,subtract=0}={}){return ["walk","burrow","climb","fly","swim"].flatMap(mode=>half?[empathChange(`system.attributes.movement.${mode}`,0.5,"multiply","final",40)]:[
  empathChange(`system.attributes.movement.${mode}`,-empathFeet(subtract,actor.system.attributes.movement.units),"add","final",40),empathChange(`system.attributes.movement.${mode}`,0,"upgrade","final",41)]);}
export function empathEffectDefinition(feature,snapshot,actor){const {mask}=snapshot,c=empathChange,changes=[],statuses=[];
  if(feature==="impulse"&&mask==="sorrow"||feature==="wave"&&mask==="sorrow")changes.push(...empathMovement(actor,{half:true}));
  if(feature==="response"&&mask==="sorrow")changes.push(...empathMovement(actor,{subtract:10}));
  if(feature==="empathy"){
    if(mask==="calm")changes.push(c("system.attributes.ac.bonus",3,"add","final"),c("system.attributes.concentration.roll.mode",1,"upgrade","final"));
    if(mask==="joy")changes.push(c("system.abilities.dex.save.roll.mode",1,"upgrade","final"));
    if(mask==="sorrow")for(const type of ["psychic","necrotic"])changes.push(c("system.traits.dr.value",type,"custom"));
  }
  if(feature==="voice"){
    if(mask==="anger")for(const skill of ["per","ins"])changes.push(c(`system.skills.${skill}.roll.mode`,-1,"downgrade","final"));
    if(mask==="calm")for(const skill of ["inv","ins"])changes.push(c(`system.skills.${skill}.bonuses.check`,"1d6"));
    if(mask==="joy")changes.push(c("system.abilities.cha.bonuses.check","1d6"));
  }
  if(feature==="catharsis"&&mask==="calm"){changes.length=0;for(const ability of ["str","dex","con","int","wis","cha"])changes.push(c(`system.abilities.${ability}.save.roll.mode`,1,"upgrade","final"));}
  if(feature==="wave"&&mask==="joy")statuses.push("prone","incapacitated");
  return {changes,statuses};}
export async function createEmpathEffect(source,target,item,feature,snapshot,{requestId,seconds=null,expiry="sourceEnd",concentrationUuid=null,repeat=false}={}){
  for(const effect of empathEffects(target.actor))if(empathEffectData(effect).feature===feature&&empathEffectData(effect).sourceActorUuid===source.actor.uuid)await effect.delete();
  const {changes,statuses}=empathEffectDefinition(feature,snapshot,target.actor),data={...snapshot,feature,sourceActorUuid:source.actor.uuid,sourceTokenUuid:source.uuid,sourceItemUuid:item.uuid,targetTokenUuid:target.uuid,nonce:requestId,concentrationUuid};
  const effect=await addCombatBenefit(source,target,item,{kind:`empath-${feature}`,expiry:seconds?null:expiry,changes});
  await effect.update({statuses,[`flags.${MODULE_ID}.empathEffect`]:data,...(seconds?temporaryEffectTiming({seconds,actor:target.actor}):
    !encounterForScene(source.parent,source)?{start:null,duration:{value:null,units:"seconds",expiry:null,expired:false}}:{}),
    ...(repeat?{[`flags.${MODULE_ID}.repeatSave`]:{ability:"wis",dc:snapshot.dc,event:"turnEnd",damage:[],sourceTokenUuid:source.uuid,sourceItemUuid:item.uuid,targetTokenUuid:target.uuid,metadata:{empathResolved:true}}}:{})});
  if(concentrationUuid&&globalThis.MidiQOL?.addDependent){const conc=await fromUuid(concentrationUuid);if(conc)await MidiQOL.addDependent(conc,effect);}
  return effect;}
export async function empathPulse(source,item,targets,snapshot,{save=null,damage=[],onSave="none",eventKey,advantage=false,removeEffectOnSaveUuid=null}={}){
  const result=await useAuraPulse({scene:source.parent,sourceToken:empathPlaceable(source),sourceItem:item,targets:targets.map(empathPlaceable),eventKey,
    event:{...(save?{save,dc:String(snapshot.dc),returnSaveOutcome:true}:{}),damage,onSave,metadata:{empathResolved:true,empathSaveAdvantage:advantage},...(removeEffectOnSaveUuid?{removeEffectOnSaveUuid}:{})}});
  return result==null||result===false||result.aborted||["pending","needs-review"].includes(result.status)?{status:"needs-review"}:result;}
