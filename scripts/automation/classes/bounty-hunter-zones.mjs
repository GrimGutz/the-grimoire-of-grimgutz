import {MODULE_ID} from "../shared/constants.mjs";
import {enabled,notify,automationData} from "../shared/helpers.mjs";
import {hunterDC,selectedHunterTrophy} from "./bounty-hunter.mjs";
import {trophyDefinition} from "../shared/bounty-hunter-definitions.mjs";
import {hunterNativeActivity,useHunterCost} from "./bounty-hunter-cost.mjs";
import {chooseSceneTokens,confirmOwner} from "../shared/owner-prompts.mjs";
import {requestGm,registerGmRequest,isGmAuthority} from "../shared/gm-requests.mjs";
import {nativeApplicationReply,applyNativeOnce} from "../shared/native-applications.mjs";
import {areaPlacementAllowed,useAreaActivity} from "../shared/area-activities.mjs";
import {sourceTokenForActor} from "../shared/zones.mjs";
import {feetToSceneUnits} from "../shared/spatial.mjs";
import {combatTurnSnapshot,encounterForScene,isForwardTurn} from "../shared/combat-flow.mjs";
import {turnKey} from "../shared/combat-benefits.mjs";
import {protectiveZoneContains} from "./ritualist-zones.mjs";
import {dispatchAutomationPulse,useAuraPulse} from "../midi/aura-workflow.mjs";
import {temporaryEffectTiming} from "../effects/temporary-effects.mjs";

export const hunterZones=scene=>[...(scene?.regions??[]),...(scene?.templates??[])].filter(zone=>zone.flags?.[MODULE_ID]?.hunterZone);
export function hunterZoneInside(zone,token) {return protectiveZoneContains(zone,token,zone.parent);}
export function hunterStormKey(zone,token,turn) {return `hunter-storm:${zone.uuid}:${token.uuid}:${turn}`;}
const object=doc=>doc.object??{actor:doc.actor,document:doc};
const liveZone=zone=>Number(zone.flags?.[MODULE_ID]?.zoneExpiresAt??0)>Number(game.time?.worldTime??0);

export async function pulseHunterStorm(zone,token,turn,{pulse=dispatchAutomationPulse}={}) {
  const state=zone.flags?.[MODULE_ID]?.hunterZone;
  if(!turn||!liveZone(zone)||state?.mode!=="storm"||!hunterZoneInside(zone,token))return false;
  const source=await fromUuid(state.sourceTokenUuid),item=await fromUuid(state.itemUuid);
  if(!source?.actor||!item||selectedHunterTrophy(source.actor,item.system.identifier)?.item.uuid!==item.uuid)return false;
  // Entry and turn-start share the SAME persistent ledger key. Re-entry cannot deal damage again.
  return pulse({scene:zone.parent,sourceToken:object(source),sourceItem:item,template:zone,targets:[object(token)],
    event:{save:"dex",dc:String(state.dc),damage:[{formula:"4d8",type:state.damageType}],onSave:"half"},eventKey:hunterStormKey(zone,token,turn)});
}
export async function cleanupHunterRoots(scene) {
  if(!enabled()||!isGmAuthority()||!scene)return;
  const zones=new Map(hunterZones(scene).filter(liveZone).map(zone=>[zone.uuid,zone]));
  for(const token of scene.tokens??[])for(const effect of [...(token.actor?.effects??[])]){
    const state=effect.getFlag?.(MODULE_ID,"hunterRootZone");
    if(!state||state.sceneId!==scene.id||state.targetUuid!==token.uuid)continue;
    const zone=zones.get(state.zoneUuid);
    if(!zone||!hunterZoneInside(zone,token))await effect.delete();
  }
}
export async function cleanupHunterZoneSources(scene) {
  if(!enabled()||!isGmAuthority()||!scene)return;
  for(const zone of hunterZones(scene)) {
    const state=zone.flags[MODULE_ID].hunterZone,source=await fromUuid(state.sourceTokenUuid),item=await fromUuid(state.itemUuid);
    const selected=source?.actor&&selectedHunterTrophy(source.actor,item?.system.identifier);
    if(!liveZone(zone)||!source?.actor||source.parent?.id!==scene.id||selected?.item.uuid!==state.itemUuid)await zone.delete();
  }
  await cleanupHunterRoots(scene);
}
async function terrain(zone,mode) {
  if(!zone.shapes||!CONFIG.RegionBehavior?.dataModels?.modifyMovementCost)return;
  const difficulties=Object.fromEntries(Object.entries(CONFIG.Token.movement.actions).filter(([key,value])=>value.terrainAction===undefined&&!value.deriveTerrainDifficulty
    &&(mode==="storm"||["walk","crawl","climb"].includes(key))).map(([key])=>[key,2]));
  await zone.createEmbeddedDocuments("RegionBehavior",[{name:"Труднопроходимая местность",type:"modifyMovementCost",system:{difficulties}}]);
}
registerGmRequest("hunter-zone",async(actor,data,{requestId})=>{
  const activity=await fromUuid(data.activityUuid),source=await fromUuid(data.sourceUuid),zone=await fromUuid(data.zoneUuid),entry=trophyDefinition(activity?.item);
  if(!enabled()||source?.actor?.uuid!==actor.uuid||activity?.actor?.uuid!==actor.uuid||!zone||zone.parent?.id!==source.parent.id
    ||!["roots","storm"].includes(entry?.mode)||selectedHunterTrophy(actor,entry.key)?.item.id!==activity.item.id||hunterDC(actor)==null)return false;
  const previous=nativeApplicationReply(actor,requestId);if(previous)return previous;
  if(canvas.scene?.id!==source.parent.id||!canvas.ready)return false;
  const radius=feetToSceneUnits(20,zone.parent)/zone.parent.grid.distance*zone.parent.grid.size;
  if(!areaPlacementAllowed(zone,object(source),{origin:"point",maxRange:60},zone.parent)||
    (zone.shapes?zone.shapes.length!==1||zone.shapes[0].type!=="circle"||Math.abs(zone.shapes[0].radius-radius)>1:zone.t!=="circle"||Math.abs(zone.distance-feetToSceneUnits(20,zone.parent))>.01))return false;
  const targets=entry.mode==="roots"?await chooseSceneTokens(actor,zone.parent,{title:"Опутать внутри растительной области",min:0,max:Math.max(1,zone.parent.tokens.size??[...zone.parent.tokens].length),relation:t=>hunterZoneInside(zone,t)}):[];
  if(targets==null)return false;
  return applyNativeOnce(actor,{requestId,action:`hunter-${entry.mode}`,activityUuid:activity.uuid},()=>useHunterCost(activity,{activation:"action"}),async()=>{
    const snapshot={mode:entry.mode,sourceTokenUuid:source.uuid,itemUuid:activity.item.uuid,dc:hunterDC(actor),damageType:selectedHunterTrophy(actor,entry.key).snapshot.damageType};
    await zone.update({hidden:Boolean(source.hidden),[`flags.${MODULE_ID}.zoneTemplate`]:true,[`flags.${MODULE_ID}.zoneExpiresAt`]:Number(game.time.worldTime)+60,
      [`flags.${MODULE_ID}.sourceActor`]:actor.uuid,[`flags.${MODULE_ID}.hunterZone`]:snapshot});
    await terrain(zone,entry.mode);
    for(const target of targets){
      const result=await useAuraPulse({scene:source.parent,sourceToken:object(source),sourceItem:activity.item,template:zone,targets:[object(target)],eventKey:`${requestId}:${target.uuid}`,
        event:{save:"str",dc:String(snapshot.dc),damage:[],onSave:"none",condition:{key:`hunter-roots:${zone.uuid}`,name:activity.item.name,statuses:["restrained"],
          duration:temporaryEffectTiming({seconds:60,actor:target.actor}).duration,
          flags:{hunterRootZone:{zoneUuid:zone.uuid,sceneId:zone.parent.id,targetUuid:target.uuid},
            repeatSave:{ability:"str",dc:snapshot.dc,damage:[],sourceTokenUuid:source.uuid,sourceItemUuid:activity.item.uuid,targetTokenUuid:target.uuid,event:"turnEnd"}}}}});
      if(result==null||result?.status==="needs-review")return {status:"needs-review"};
    }return true;
  });
});
const pending=new Set();
export async function useHunterZone(activity) {
  const actor=activity.actor,entry=trophyDefinition(activity.item),source=sourceTokenForActor(actor),owned=selectedHunterTrophy(actor,entry?.key);
  if(!enabled()||!owned||owned.item.id!==activity.item.id||!source||pending.has(actor.uuid)||!hunterDC(actor))return false;
  pending.add(actor.uuid);let placed,result;
  try{
    if(entry.mode==="breath"){
      const {choiceDialog}=await import("../shared/dialogs.mjs");
      const shape=await choiceDialog({title:activity.item.name,choices:[["cone","Конус 30 футов"],["line","Линия 60×5 футов"]]});
      if(!shape||!await confirmOwner(actor,activity.item.name,"Сейчас ваше действие Атака; этот выдох заменяет одну его атаку?"))return false;
      const resolved=hunterNativeActivity(activity,{}, {activation:"special"});
      const spec={id:"hunter-dragon-breath",shape,size:shape==="cone"?30:60,...(shape==="line"?{width:5}:{}),origin:"self",excludeSelf:true,
        save:"dex",dc:String(hunterDC(actor)),damage:[{formula:"6d6",type:owned.snapshot.damageType}],onSave:"half"};
      const data=resolved.toObject();data.flags[MODULE_ID].area=spec;data.flags[MODULE_ID].automation??={version:1,kind:"activity",id:spec.id,data:{}};
      data.flags[MODULE_ID].automation.data={...data.flags[MODULE_ID].automation.data,area:spec};
      const item=resolved.item.clone({system:{activities:{[resolved.id]:data}}},{keepId:true});
      return useAreaActivity(item.system.activities.get(resolved.id));
    }
    if(entry.mode==="roots"&&!await confirmOwner(actor,activity.item.name,"Указанная точка находится на земле?"))return false;
    const data=activity.toObject();data.target={...data.target,override:true,prompt:true,template:{type:"sphere",size:"20",units:"ft",count:"1"}};
    const previewItem=activity.item.clone({system:{activities:{[activity.id]:data}}},{keepId:true});
    const previews=game.system.canvas.AbilityTemplate.fromActivity(previewItem.system.activities.get(activity.id));
    const docs=await previews[0].drawPreview();placed=(Array.isArray(docs)?docs.flat(Infinity):[docs]).filter(Boolean)[0];
    if(!placed)return false;placed=canvas.scene.regions?.get?.(placed.id)??placed;
    result=await requestGm("hunter-zone",actor,{activityUuid:activity.uuid,sourceUuid:source.document.uuid,zoneUuid:placed.uuid},{requestId:`hunter-zone:${placed.uuid}`,timeoutMs:120000});
    return result;
  }catch(error){notify(error.message,"warn");result=placed?{status:"needs-review"}:false;return result;}
  finally{pending.delete(actor.uuid);if(placed&&(result===false||["failed","cancelled"].includes(result?.status)))await placed.delete();}
}
const previousPositions=new Map();
const rememberPosition=token=>previousPositions.set(token.uuid,{uuid:token.uuid,x:token.x,y:token.y,width:token.width,height:token.height,elevation:token.elevation});
export function installHunterZoneHooks({pulse=pulseHunterStorm}={}) {
  const report=promise=>void promise.catch(error=>console.error(`${MODULE_ID} | Hunter zone`,error));
  const prime=()=>{if(isGmAuthority())for(const scene of game.scenes??[])for(const token of scene.tokens??[])rememberPosition(token);};
  // preUpdate is local to the initiating client. Keep a GM-side baseline so
  // remote player movement is also detected by the broadcast update hook.
  prime();
  Hooks.on("preUpdateToken",(token,changes)=>{
    if(!isGmAuthority()||!hunterZones(token.parent).length||!["x","y","elevation"].some(k=>Object.hasOwn(changes,k)))return;
    rememberPosition(token);
  });
  Hooks.on("updateToken",(token,changes)=>{
    if(!enabled()||!isGmAuthority())return;const before=previousPositions.get(token.uuid);rememberPosition(token);
    if(changes&&!["x","y","elevation"].some(k=>Object.hasOwn(changes,k)))return;
    const turn=turnKey(encounterForScene(token.parent,token));
    const zones=hunterZones(token.parent).filter(zone=>zone.flags[MODULE_ID].hunterZone.mode==="storm");
    report((async()=>{
      for(const zone of zones)if(before&&!hunterZoneInside(zone,before)&&hunterZoneInside(zone,token))await pulse(zone,token,turn);
      await cleanupHunterRoots(token.parent);
    })());
  });
  Hooks.on("updateCombat",(combat,changes)=>{
    if(!enabled()||!isGmAuthority()||!isForwardTurn(combat,changes))return;const snapshot=combatTurnSnapshot(combat),target=snapshot.current.token;
    if(!target)return;const turn=`${snapshot.id}:${snapshot.current.round}:${snapshot.current.turn}`;
    report((async()=>{for(const zone of hunterZones(target.parent))await pulse(zone,target,turn);await cleanupHunterRoots(target.parent);})());
  });
  Hooks.on("deleteRegion",zone=>{if(isGmAuthority())report(cleanupHunterRoots(zone.parent));});
  Hooks.on("deleteMeasuredTemplate",zone=>{if(isGmAuthority())report(cleanupHunterRoots(zone.parent));});
  const cleanup=()=>{if(isGmAuthority())for(const scene of game.scenes??[])if(hunterZones(scene).length)report(cleanupHunterZoneSources(scene));};
  Hooks.on("updateWorldTime",cleanup);Hooks.on("canvasReady",()=>{prime();cleanup();});
  Hooks.on("createToken",token=>{if(isGmAuthority())rememberPosition(token);});
  Hooks.on("deleteToken",token=>{previousPositions.delete(token.uuid);if(isGmAuthority())report(cleanupHunterZoneSources(token.parent));});
  Hooks.on("deleteItem",cleanup);Hooks.on("updateItem",(item)=>{if(automationData(item).hunterFeature)cleanup();});
  Hooks.on("updateActor",(actor,changes)=>{if(changes.flags?.[MODULE_ID]?.hunterConfiguration||Object.hasOwn(changes,`flags.${MODULE_ID}.hunterConfiguration`))cleanup();});
}
