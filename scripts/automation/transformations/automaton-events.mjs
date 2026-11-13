import {MODULE_ID} from "../shared/constants.mjs";
import {enabled,automationData,automationAction,notify,reportFailure} from "../shared/helpers.mjs";
import {registerGmRequest,requestGm,isGmAuthority} from "../shared/gm-requests.mjs";
import {applyNativeOnce} from "../shared/native-applications.mjs";
import {serialMutation} from "../shared/transactions.mjs";
import {combatTurnSnapshot,isForwardTurn} from "../shared/combat-flow.mjs";
import {runAutomationEvent,registerAutomationEvent} from "../shared/event-ledger.mjs";
import {automatonAvailable,automatonHas,automatonState,automatonRegeneration} from "./automaton.mjs";
import {controlAutomaton} from "./automaton-actions.mjs";
import {prepareAutomatonRange,prepareAutomatonDamageRoll,prepareAutomatonImmunity,prepareAutomatonSave} from "./automaton-combat.mjs";

export async function regenerateAutomaton(actor,amount=automatonRegeneration(actor)){
  if(!enabled()||!isGmAuthority())return false;const actual=Math.min(amount,automatonRegeneration(actor));
  if(actual>0)await actor.update({"system.attributes.hp.value":Number(actor.system.attributes.hp.value)+actual});return true;
}
registerAutomationEvent("automaton-regeneration",async record=>{
  const token=await fromUuid(record.sourceTokenUuid);if(!token?.actor||token.parent?.id!==record.sceneId)throw Error("Токен Автоматона недоступен: проверьте событие вручную.");
  return regenerateAutomaton(token.actor,record.amount);
});
export async function handleAutomatonTurn(combat,changes){
  if(!enabled()||!isGmAuthority()||!isForwardTurn(combat,changes))return;
  const snapshot=combatTurnSnapshot(combat),token=snapshot.current.token,actor=token?.actor;if(!actor)return;
  const amount=automatonRegeneration(actor);if(!amount)return;
  const record={id:`automaton-regen:${snapshot.id}:${snapshot.current.round}:${snapshot.current.turn}:${token.uuid}`,kind:"automaton-regeneration",sceneId:token.parent.id,sourceActorUuid:actor.uuid,sourceTokenUuid:token.uuid,name:"Автоматон: Живой материал",amount};
  return runAutomationEvent(record,()=>regenerateAutomaton(actor,amount),{queued:!canvas.ready||canvas.scene?.id!==record.sceneId});
}
registerGmRequest("automaton-rest",(actor,data,{requestId})=>serialMutation(`automaton-rest:${actor.uuid}`,async()=>{
  if(!enabled()||!isGmAuthority()||!automatonHas(actor,"model"))return false;
  return applyNativeOnce(actor,{requestId,action:"automaton-rest",activityUuid:null},async()=>true,async()=>{
    if(data.long)await actor.setFlag(MODULE_ID,"automatonState",{...structuredClone(automatonState(actor)),restEpoch:Number(automatonState(actor).restEpoch??0)+1,lastRecharge:Number(game.time.worldTime)});
    return true;
  });
}));
export function installAutomatonHooks(){
  const report = reportFailure("Automaton automation");
  const intercept=activity=>{
    if(!enabled()||!activity)return;const flags=automationData(activity);
    if(activity.item?.getFlag?.(MODULE_ID,"automatonBatterySpell")&&!flags.automatonBatteryRelease){notify("Выпускайте это заклинание через карточку Дуговой батареи.","warn");return false;}
    if(flags.leaderResolved||flags.automatonResolved||flags.auraPulse)return;
    if(automationAction(activity)!=="automaton-control")return;
    if(!automatonAvailable(activity.actor,activity.item)){notify("Этот уровень Автоматона ещё не открыт или особенность подавлена.","warn");return false;}
    report(controlAutomaton(activity.actor,activity));return false;
  };
  Hooks.on("dnd5e.preUseActivity",activity=>{const result=intercept(activity);if(result===false)return false;prepareAutomatonRange(activity);});
  Hooks.on("midi-qol.preTargetingV2",({workflow})=>intercept(workflow?.activity));
  Hooks.on("dnd5e.preRollDamage",prepareAutomatonDamageRoll);
  Hooks.on("midi-qol.prePreambleComplete",prepareAutomatonImmunity);
  Hooks.on("midi-qol.preTargetSave",prepareAutomatonSave);
  Hooks.on("updateCombat",(combat,changes)=>report(handleAutomatonTurn(combat,changes)));
  Hooks.on("dnd5e.restCompleted",(actor,result,config)=>{
    if(!enabled()||!automatonHas(actor,"model"))return;
    const long=Boolean(result.longRest||result.type==="long"||config?.type==="long"),id=result.automatonRestId??=result.message?.uuid??foundry.utils.randomID();
    report(requestGm("automaton-rest",actor,{long},{requestId:`automaton-rest:${id}`}));
  });
}
