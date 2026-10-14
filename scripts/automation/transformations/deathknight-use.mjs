import {MODULE_ID} from "../shared/constants.mjs";
import {itemUses} from "../shared/helpers.mjs";
import {chooseSceneTokens} from "../shared/owner-prompts.mjs";
import {inFeet,canReact} from "../shared/combat-benefits.mjs";
import {useAuraPulse} from "../midi/aura-workflow.mjs";
import {dkDC} from "./deathknight.mjs";
export const dkGm=actor=>({uuid:actor.uuid,testUserPermission:user=>user.isGM});
export function dkExpense(activity,{activation="action",cost=0,resource=activity.item}={}){if(cost&&itemUses(resource).remaining<cost)throw Error("Недостаточно ресурса способности.");if(activation==="reaction"&&!canReact(activity.actor))throw Error("Нет свободной реакции.");return {activation:{type:activation,value:activation==="special"?null:1,override:true},consumption:{spellSlot:false,targets:cost?[{type:"itemUses",target:resource.id,value:String(cost)}]:[]}};}
export async function dkTargets(actor,source,range,title,{max=1,self=false}={}){return chooseSceneTokens(actor,source.parent,{title,min:1,max,exclude:self?[]:[source.uuid],relation:t=>inFeet(source,t,range,source.parent)});}
export async function dkPulse(source,item,targets,{save=null,dc=dkDC(source.actor),damage=[],onSave="none",requestId,metadata={}}={}){const place=t=>t.object??{actor:t.actor,document:t};const result=await useAuraPulse({scene:source.parent,sourceToken:place(source),sourceItem:item,targets:targets.map(place),eventKey:requestId,event:{...(save?{save,dc:String(dc),returnSaveOutcome:true}:{}),damage,onSave,metadata:{deathknightResolved:true,...metadata}}});return result==null||result===false||result.aborted||["pending","needs-review"].includes(result.status)?{status:"needs-review"}:result;}
