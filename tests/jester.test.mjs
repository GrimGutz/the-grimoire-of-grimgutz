import assert from "node:assert/strict";
import {test,beforeEach} from "node:test";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {MODULE_ID,SETTINGS} from "../scripts/automation/shared/constants.mjs";
import {JESTER_FEATURES,jesterChaosDelta,jesterMaximum,jesterImpromptuDie} from "../scripts/automation/shared/jester-definitions.mjs";
import {jesterDocuments} from "../src/packs/jester-features.mjs";
import {jesterClassDocuments} from "../src/packs/jester-class.mjs";
import {jesterSection} from "../src/jester-data.mjs";
import {jesterPool,jesterPoints,jesterDC,syncJester,changeJesterChaos,jesterRoleDefinitions,jesterPrerequisiteFailures,validateJesterItem,jesterRestCompleted} from "../scripts/automation/classes/jester.mjs";
import {jesterExpense,jesterRelationDelta,offerJesterMovement,jesterSwapUpdates,planJesterSwaps} from "../scripts/automation/classes/jester-actions.mjs";
import {jesterNaturalFaces,jesterRound,grantJesterLaughter,grantJesterInitiative,handleJesterRollMessage,installJesterHooks} from "../scripts/automation/classes/jester-events.mjs";
import {requestGm,receiveGmRequest} from "../scripts/automation/shared/gm-requests.mjs";

let actor,source,target,docs,answers,faces,prompts,nativeCalls,messages,hooks,seq,journal;
function merge(base,patch){const result=structuredClone(base);for(const [key,value]of Object.entries(patch)){
  if(key.includes(".")){const parts=key.split("."),last=parts.pop();let obj=result;for(const part of parts)obj=obj[part]??={};if(last.startsWith("-="))delete obj[last.slice(2)];else obj[last]=structuredClone(value);}
  else if(value&&typeof value==="object"&&!Array.isArray(value))result[key]=merge(result[key]??{},value);else result[key]=structuredClone(value);
}return result;}
function owned(data,owner,register=true){let raw=structuredClone(data);const item={id:raw._id,actor:owner,parent:owner,uuid:`${owner.uuid}.Item.${raw._id}`,toObject:()=>structuredClone(raw),getFlag:(m,k)=>raw.flags?.[m]?.[k],
  clone:patch=>owned(merge(raw,patch),owner,false),async update(patch){raw=merge(raw,patch);refresh();return this;}};
  function refresh(){Object.assign(item,raw);item.system={...raw.system,activities:new Map(Object.entries(raw.system.activities??{}).map(([id,row])=>[id,{...row,id,item,actor:owner,uuid:`${item.uuid}.Activity.${id}`,toObject:()=>structuredClone(row)}]))};}
  refresh();if(register){docs.set(item.uuid,item);for(const a of item.system.activities.values())docs.set(a.uuid,a);}return item;
}
function makeActor(level=5,id="jester"){let raw={system:{details:{level:10},attributes:{prof:4,hp:{value:20,max:40,temp:0}},abilities:Object.fromEntries(["str","dex","con","int","wis","cha"].map(k=>[k,{value:18,mod:4,max:null}])),skills:{acr:{value:1}}},flags:{[MODULE_ID]:{jesterAbility:"cha"}}};
  const a={uuid:`Actor.${id}`,id,name:id,isOwner:true,items:[],effects:[],statuses:new Set(),testUserPermission:()=>true,getFlag:(m,k)=>raw.flags?.[m]?.[k],
    async update(patch){raw=merge(raw,patch);refresh();return this;},async setFlag(m,k,v){await this.update({[`flags.${m}.${k}`]:v});},async unsetFlag(m,k){await this.update({[`flags.${m}.-=${k}`]:null});},
    async createEmbeddedDocuments(_type,rows){const out=rows.map(r=>effect(r,this));this.effects.push(...out);return out;},async updateEmbeddedDocuments(_type,rows){for(const row of rows)await this.effects.find(e=>e.id===row._id)?.update(row);return rows;},
    async deleteEmbeddedDocuments(_type,ids){this.effects=this.effects.filter(e=>!ids.includes(e.id));}};
  function refresh(){a.system=structuredClone(raw.system);a.flags=raw.flags;a._source=structuredClone(raw);}refresh();
  a.items=[{type:"class",system:{identifier:"jester",levels:level}},...jesterDocuments.map(row=>owned(row,a))];a.items.get=id=>a.items.find(i=>i.id===id);docs.set(a.uuid,a);return a;
}
function effect(data,owner){let raw=structuredClone(data);const e={id:`e${++seq}`,parent:owner,toObject:()=>structuredClone(raw),getFlag:(m,k)=>raw.flags?.[m]?.[k],async update(patch){raw=merge(raw,patch);Object.assign(this,raw);return this;},async delete(){owner.effects=owner.effects.filter(x=>x!==this);}};Object.assign(e,raw);return e;}
const item=id=>actor.items.find(i=>i.system.identifier===`jester-${id}`),activity=id=>[...item(id).system.activities.values()][0];
function token(owner,id,x=0,scene=canvas.scene){const t={actor:owner,id,uuid:`Scene.${scene.id}.Token.${id}`,parent:scene,x,y:0,width:1,height:1,elevation:0};scene.tokens.push(t);docs.set(t.uuid,t);return t;}
const setPoints=n=>jesterPool(actor).update({"system.uses.max":String(jesterMaximum(actor.items[0].system.levels)),"system.uses.spent":jesterMaximum(actor.items[0].system.levels)-n});
function combat(round=1){const entries=[source,target].map((t,i)=>({id:`c${i}`,token:t,actor:t.actor,uuid:`Combat.c.Combatant.${i}`})),c={id:"c",started:true,round,turn:0,turns:entries,combatants:entries,combatant:entries[0]};game.combat=c;game.combats=[c];return c;}
async function use(id,requestId=`use-${++seq}`){return requestGm("jester-action",actor,{activityUuid:activity(id).uuid,sourceUuid:source.uuid},{requestId});}
async function native(activity,config){nativeCalls.push({activity,config});for(const cost of activity.consumption?.targets??[]){const original=cost.target?activity.actor.items.get(cost.target):activity.actor.items.get(activity.item.id);await original.update({"system.uses.spent":Number(original.system.uses.spent)+Number(cost.value)});}return {id:`native-${++seq}`};}
beforeEach(()=>{
  docs=new Map();answers=[];faces=[];prompts=[];nativeCalls=[];messages=[];hooks=new Map();seq=0;
  const gm={id:"gm",isGM:true,active:true},users=[gm];users.activeGM=gm;users.get=id=>users.find(u=>u.id===id);
  globalThis.game={user:gm,users,time:{worldTime:0},settings:{get:(_m,k)=>k!==SETTINGS.STRICT_PREREQUISITES},combats:[],modules:new Map([["midi-qol",{active:true}]])};
  globalThis.canvas={ready:true,scene:{id:"one",grid:{size:100,distance:5,units:"ft"},tokens:[],async updateEmbeddedDocuments(_type,rows){for(const row of rows)Object.assign(this.tokens.find(t=>t.id===row._id),row);return rows;}}};
  const tokens=canvas.scene.tokens;tokens.get=id=>tokens.find(t=>t.id===id);game.scenes=[canvas.scene];game.scenes.get=id=>game.scenes.find(s=>s.id===id);
  globalThis.foundry={utils:{randomID:()=>`jester-test-${++seq}`,escapeHTML:String},applications:{api:{DialogV2:{wait:async prompt=>{prompts.push(prompt);return answers.shift()??null;}}}}};
  globalThis.Hooks={on:(name,fn)=>hooks.set(name,[...(hooks.get(name)??[]),fn])};globalThis.CONFIG={DND5E:{maxAbilityScore:20,abilities:{}}};globalThis.ui={notifications:{warn(){},info(){}}};globalThis.fromUuid=async id=>docs.get(id);
  globalThis.Roll=class{constructor(formula){this.formula=formula;}async evaluate(){this.total=faces.shift()??2;return this;}async toMessage(data){messages.push({...data,formula:this.formula,total:this.total});}};
  globalThis.ChatMessage={getSpeaker:()=>({})};class Workflow{constructor(actor,activity,speaker,targets,options){Object.assign(this,{actor,activity,targets,workflowOptions:options.workflowOptions});}}
  globalThis.MidiQOL={Workflow,TrapWorkflow:class extends Workflow{},completeActivityUse:native};
  journal={events:[],getFlag:(_m,k)=>k==="automationLedger"?true:journal[k],async setFlag(_m,k,v){journal[k]=structuredClone(v);}};game.journal=[journal];
  actor=makeActor();game.actors=[actor];source=token(actor,"jester");target=token(makeActor(0,"target"),"target",400);
});

test("Jester preserves all ten source sections, requirements, level grants and d8 HP without empty passives",async()=>{
  const text=await readFile(new URL("../src/content/jester.md",import.meta.url),"utf8");assert.equal(createHash("sha256").update(text.replaceAll("\r\n","\n")).digest("hex"),"55cbd719b2601cf78045644c2b138c614fa4bc2b96265282e6bf556d66a4074a");
  assert.equal(jesterDocuments.length,10);for(const e of JESTER_FEATURES){assert.ok(jesterSection(e.name).length>60);assert.ok(jesterDocuments.find(i=>i.system.identifier===e.key).system.description.value.includes("Автоматизация Foundry:"));}
  assert.ok(jesterDocuments.every(i=>i.effects.length===0));const cls=jesterClassDocuments[0];assert.equal(cls.system.hitDice,"d8");assert.deepEqual(cls.system.advancement.filter(a=>a.type==="ItemGrant").map(a=>a.level),[1,2,3,4,5]);assert.ok(cls.system.description.value.includes("@UUID["));assert.ok(!cls.system.advancement.some(a=>["Trait","ItemChoice"].includes(a.type)));
});
test("initial chaos is zero, level-up preserves current points, and clamping never makes points negative",async()=>{
  assert.equal(jesterPoints(actor),0);assert.deepEqual([1,2,3,4,5].map(jesterMaximum),[3,4,5,6,7]);await syncJester(actor);assert.equal(jesterPoints(actor),0);await changeJesterChaos(actor,20);assert.equal(jesterPoints(actor),7);
  actor.items[0].system.levels=1;await syncJester(actor);assert.equal(jesterPoints(actor),3);await assert.rejects(changeJesterChaos(actor,-4),/Недостаточно/);assert.equal(jesterPoints(actor),3);
});
test("chaos matrix handles ally/enemy and beneficial/harmful, with explicit amounts and neutral zero",()=>{
  assert.deepEqual([jesterChaosDelta("ally",true),jesterChaosDelta("enemy",false),jesterChaosDelta("ally",false),jesterChaosDelta("enemy",true),jesterChaosDelta("neutral",true,3)],[-1,-1,1,1,0]);assert.equal(jesterChaosDelta("enemy",false,3),-3);assert.throws(()=>jesterChaosDelta("friend",true));
});
test("requirements remain optional and demand actual skill proficiency, not a half bonus",()=>{
  actor.system.details.level=6;actor.system.abilities.dex.value=15;actor.system.abilities.cha.value=15;actor.system.skills.acr.value=0.5;assert.equal(jesterPrerequisiteFailures(actor).length,3);
  const cls={type:"class",system:{identifier:"jester"},parent:actor};assert.equal(validateJesterItem(cls,{}, {},"gm"),undefined);game.settings.get=()=>true;assert.equal(validateJesterItem(cls,{}, {},"gm"),false);
});
test("chaos ability can be chosen once from eligible Dexterity/Charisma, never Wisdom",async()=>{
  await actor.unsetFlag(MODULE_ID,"jesterAbility");answers.push("dex");assert.equal((await requestGm("jester-settings",actor,{itemUuid:item("chaos").uuid,operation:"ability"})).status,"success");
  assert.equal(jesterDC(actor),16);answers.push("cha");assert.equal((await requestGm("jester-settings",actor,{itemUuid:item("chaos").uuid,operation:"ability"})).status,"cancelled");assert.equal(actor.getFlag(MODULE_ID,"jesterAbility"),"dex");
});
test("self always counts as ally, token color does not classify others, and GM neutral overrides are explicit",async()=>{
  assert.equal(await jesterRelationDelta(actor,source,source,true),-1);assert.equal(prompts.length,0);answers.push("enemy");assert.equal(await jesterRelationDelta(actor,source,target,true,3),3);
  answers.push("neutral","none");assert.equal(await jesterRelationDelta(actor,source,target,false),0);answers.push("neutral","cost");assert.equal(await jesterRelationDelta(actor,source,target,true,2),-2);
});
test("native expense preserves special/no-reaction rules and costs Finale own use plus three chaos",async()=>{
  assert.throws(()=>jesterExpense(activity("impromptu"),{delta:-1}),/Недостаточно/);await setPoints(5);
  const data=jesterExpense(activity("finale"),{delta:-3,finale:true});assert.equal(data.activation.type,"special");assert.deepEqual(data.consumption.targets.map(t=>t.value),["3","1"]);
  assert.equal(jesterExpense(activity("impromptu"),{delta:1}).consumption.targets.length,0);assert.equal(jesterExpense(activity("correction"),{delta:-1,activation:"reaction"}).activation.type,"reaction");
});
test("native initiative grants one only from zero; numeric edits have no handler; repeated receipt cannot refill again",async()=>{
  actor.items[0].system.levels=1;await syncJester(actor);await grantJesterInitiative(actor,source);assert.equal(jesterPoints(actor),1);await grantJesterInitiative(actor,source);assert.equal(jesterPoints(actor),1);
  const message={uuid:"ChatMessage.init",flags:{core:{initiativeRoll:true}},speaker:{scene:"one",token:source.id},rolls:[{dice:[{faces:20,results:[{result:12}]}]}]};docs.set(message.uuid,message);
  await setPoints(0);await handleJesterRollMessage(message);assert.equal(jesterPoints(actor),1);await setPoints(0);await handleJesterRollMessage(message);assert.equal(jesterPoints(actor),0);
  installJesterHooks();assert.equal(hooks.has("updateCombatant"),false);assert.ok(hooks.has("createChatMessage"));
});
test("native d20 detection excludes other dice and discarded or inactive results",()=>{
  assert.deepEqual(jesterNaturalFaces({rolls:[{dice:[{faces:6,results:[{result:1}]},{faces:20,results:[{result:20,active:false},{result:1,discarded:true},{result:20,active:true}]}]}]}),[20]);
});
test("Laughter is optional, shared once per round, not once per target; combat.scene is unnecessary",async()=>{
  actor.items[0].system.levels=2;await syncJester(actor);combat();assert.equal(jesterRound(source),"c:1");answers.push("no");assert.equal(await grantJesterLaughter(actor,source,target,{key:"a",round:"c:1"}),false);assert.equal(jesterPoints(actor),0);
  answers.push("yes");await grantJesterLaughter(actor,source,target,{key:"b",round:"c:1"});assert.equal(jesterPoints(actor),1);await grantJesterLaughter(actor,source,source,{key:"c",round:"c:1"});assert.equal(jesterPoints(actor),1);assert.equal(prompts.length,2);
  answers.push("yes");await grantJesterLaughter(actor,source,target,{key:"d",round:"c:2"});assert.equal(jesterPoints(actor),2);
});
test("Laughter message replays and another GM cannot grant twice; hidden targets are not leaked to a player",async()=>{
  actor.items[0].system.levels=2;await syncJester(actor);combat();const msg={uuid:"ChatMessage.natural",speaker:{scene:"one",token:target.id},rolls:[{dice:[{faces:20,results:[{result:1}]}]}]};answers.push("yes");
  await handleJesterRollMessage(msg);await handleJesterRollMessage(msg);assert.equal(jesterPoints(actor),1);assert.equal(prompts.length,1);
  game.user={id:"gm2",isGM:true};await handleJesterRollMessage({...msg,uuid:"ChatMessage.other"});assert.equal(jesterPoints(actor),1);
  game.user=game.users.activeGM;const player={id:"player",active:true,isGM:false};game.users.push(player);target.hidden=true;target.actor.testUserPermission=()=>false;
  const records=journal.events.length;await handleJesterRollMessage({...msg,uuid:"ChatMessage.hidden"});assert.equal(journal.events.length,records);assert.equal(prompts.length,1);
});
test("message on another scene is queued for GM instead of granting retroactive points",async()=>{
  actor.items[0].system.levels=2;await syncJester(actor);combat();canvas.scene={id:"elsewhere"};
  await handleJesterRollMessage({uuid:"ChatMessage.offscene",speaker:{scene:"one",token:target.id},rolls:[{dice:[{faces:20,results:[{result:20}]}]}]});assert.equal(jesterPoints(actor),0);assert.equal(prompts.length,0);assert.equal(journal.events.at(-1).state,"queued");
});
test("private/blind natural rolls cannot reveal their result through the owner's Laughter prompt",async()=>{
  actor.items[0].system.levels=2;await syncJester(actor);combat();game.users.push({id:"reader",active:true,isGM:false});
  const base={uuid:"ChatMessage.private",speaker:{scene:"one",token:target.id},rolls:[{dice:[{faces:20,results:[{result:20}]}]}]};
  await handleJesterRollMessage({...base,whisper:["gm"]});await handleJesterRollMessage({...base,uuid:"ChatMessage.blind",blind:true});assert.equal(prompts.length,0);assert.equal(jesterPoints(actor),0);
});
test("concurrent Laughter callbacks with different targets share one round reservation",async()=>{
  actor.items[0].system.levels=2;await syncJester(actor);answers.push("yes","yes");
  await Promise.all(["a","b"].map(key=>grantJesterLaughter(actor,source,target,{key,round:"c:3"})));assert.equal(jesterPoints(actor),1);assert.equal(prompts.length,1);
});
test("native cancellation stops retort before its save/HP effect or chaos gain",async()=>{
  actor.items[0].system.levels=2;await syncJester(actor);answers.push([target.uuid],"yes","sting",3,"ally");MidiQOL.completeActivityUse=async()=>false;
  assert.equal((await use("retort")).status,"cancelled");assert.equal(jesterPoints(actor),0);assert.equal(actor.effects.length,0);
});
test("short and long rests do not refill chaos; only Finale recovers its own use",async()=>{
  actor.items[0].system.levels=3;await syncJester(actor);await setPoints(2);await item("finale").update({"system.uses.spent":1});await jesterRestCompleted(actor,{type:"short",grimgutzJesterRestId:"short"});assert.equal(jesterPoints(actor),2);assert.equal(item("finale").system.uses.spent,0);
  await jesterRestCompleted(actor,{type:"long",grimgutzJesterRestId:"long"});assert.equal(jesterPoints(actor),2);assert.equal(actor.effects.length,0);
});
test("role is a real +4 ability and cap effect until next long rest, replacing instead of stacking; replay never rerolls",async()=>{
  await syncJester(actor);await setPoints(2);answers.push("roll");faces.push(2);await jesterRestCompleted(actor,{type:"long",grimgutzJesterRestId:"rest-a"});
  assert.equal(actor.effects.length,1);const changes=actor.effects[0].system.changes;assert.ok(changes.some(c=>c.key==="system.abilities.dex.value"&&c.value==="4"));assert.ok(changes.some(c=>c.key==="system.abilities.dex.max"&&c.value==="24"));assert.equal(actor._source.system.abilities.dex.value,18);
  await jesterRestCompleted(actor,{type:"short",grimgutzJesterRestId:"short-role"});assert.equal(actor.effects.length,1);assert.equal(messages.length,1);
  faces.push(6);await jesterRestCompleted(actor,{type:"long",grimgutzJesterRestId:"rest-b"});assert.equal(actor.effects.length,1);assert.equal(actor.getFlag(MODULE_ID,"jesterRole").ability,"cha");assert.equal(jesterPoints(actor),2);
  await jesterRestCompleted(actor,{type:"long",grimgutzJesterRestId:"rest-b"});assert.equal(messages.length,2);
});
test("feat and role choices are exclusive and immutable; feat creates no fake passive",async()=>{
  answers.push("feat");await requestGm("jester-settings",actor,{itemUuid:item("role").uuid,operation:"role"});assert.equal(actor.getFlag(MODULE_ID,"jesterRoleChoice"),"feat");
  answers.push("roll");await requestGm("jester-settings",actor,{itemUuid:item("role").uuid,operation:"role"});await jesterRestCompleted(actor,{type:"long",grimgutzJesterRestId:"feat-rest"});assert.equal(messages.length,0);assert.equal(actor.effects.length,0);
});
test("role respects a raw custom cap and never overwrites hand-edited mechanical effects",async()=>{
  await actor.update({"system.abilities.dex.max":22});await actor.setFlag(MODULE_ID,"jesterRoleChoice","roll");await actor.setFlag(MODULE_ID,"jesterRole",{ability:"dex"});await syncJester(actor);assert.equal(jesterRoleDefinitions(actor)[0].system.changes[0].value,"26");
  const e=actor.effects[0];await e.update({"system.changes":[{key:"manual",value:"9"}]});await syncJester(actor);const result=await jesterRestCompleted(actor,{type:"long",grimgutzJesterRestId:"manual-rest"});assert.equal(result.status,"needs-review");assert.equal(actor.effects[0],e);assert.equal(messages.length,0);
});
test("retort ally temporary HP costs chosen amount natively and cannot consume twice",async()=>{
  actor.items[0].system.levels=2;await syncJester(actor);await setPoints(4);answers.push([target.uuid],"yes","encourage",2,"ally");
  MidiQOL.completeActivityUse=async(a,config)=>{if(a.type==="utility")return native(a,config);nativeCalls.push({activity:a,config});const oldTemp=target.actor.system.attributes.hp.temp;await target.actor.update({"system.attributes.hp.temp":7});return {damageList:[{tokenUuid:target.uuid,oldTempHP:oldTemp,newTempHP:7}]};};
  await use("retort","retort-a");assert.equal(jesterPoints(actor),2);assert.equal(nativeCalls[1].activity.healing.number,2);assert.equal(nativeCalls[1].activity.activation.type,"special");assert.equal(nativeCalls[1].config.consume.resources,false);
  const count=prompts.length;await use("retort","retort-a");assert.equal(jesterPoints(actor),2);assert.equal(prompts.length,count);assert.equal(nativeCalls.length,2);
});
test("retort against ally gains chosen amount only after failed save, never on a success with half damage",async()=>{
  actor.items[0].system.levels=2;await syncJester(actor);let fail=false;
  MidiQOL.completeActivityUse=async(a,config)=>{if(a.type==="utility")return native(a,config);nativeCalls.push({activity:a,config});return {saves:new Set(fail?[]:[target]),failedSaves:new Set(fail?[target]:[])};};
  answers.push([target.uuid],"yes","sting",3,"ally");await use("retort");assert.equal(jesterPoints(actor),0);assert.equal(nativeCalls[1].activity.damage.onSave,"half");
  fail=true;answers.push([target.uuid],"yes","sting",3,"ally","yes");await use("retort");assert.equal(jesterPoints(actor),3);
});
test("retort against enemy pays at declaration even on successful save, but unknown outcomes do not grant guessed points",async()=>{
  actor.items[0].system.levels=2;await syncJester(actor);await setPoints(3);
  MidiQOL.completeActivityUse=async(a,config)=>a.type==="utility"?native(a,config):{saves:new Set([target]),failedSaves:new Set()};answers.push([target.uuid],"yes","sting",2,"enemy");await use("retort");assert.equal(jesterPoints(actor),1);
  MidiQOL.completeActivityUse=async(a,config)=>a.type==="utility"?native(a,config):undefined;answers.push([target.uuid],"yes","sting",3,"ally");assert.equal((await use("retort")).status,"needs-review");assert.equal(jesterPoints(actor),1);
});
test("retort cancellations and empty cost fail before native use; unchanged foe temp HP does not farm chaos",async()=>{
  actor.items[0].system.levels=2;await syncJester(actor);answers.push(null);assert.equal((await use("retort")).status,"cancelled");assert.equal(nativeCalls.length,0);
  answers.push([target.uuid],"yes","sting",2,"enemy");await assert.rejects(use("retort"),/Недостаточно/);assert.equal(nativeCalls.length,0);
  MidiQOL.completeActivityUse=async(a,config)=>a.type==="utility"?native(a,config):{id:"no-new-temp"};answers.push([target.uuid],"yes","encourage",2,"enemy");await use("retort");assert.equal(jesterPoints(actor),0);
});
test("Impromptu offers only a die for this roll and no reaction; declining result confirmation cannot grant chaos",async()=>{
  actor.items[0].system.levels=1;await syncJester(actor);answers.push([target.uuid],"yes","minus","yes","ally","yes");faces.push(4);await use("impromptu");assert.equal(jesterPoints(actor),1);assert.equal(messages[0].formula,"1d4");assert.equal(nativeCalls[0].activity.activation.type,"special");assert.equal(actor.effects.length,0);
  answers.push([target.uuid],"yes","minus","yes","ally","no");assert.equal((await use("impromptu")).status,"needs-review");assert.equal(jesterPoints(actor),1);
});
test("Improvisation uses the SAME d6 for sign and bonus without chaos or Mise, not a second random die",async()=>{
  await syncJester(actor);await setPoints(2);faces.push(5);answers.push([target.uuid],"yes","improv","yes","yes");await use("impromptu");assert.equal(jesterPoints(actor),2);assert.equal(messages.length,1);assert.ok(messages[0].flavor.includes("−5"));assert.equal(messages[0].formula,"1d6");assert.equal(prompts.length,5);assert.equal(jesterImpromptuDie(5),6);
});
test("Finale charges three chaos and one rest use, never sets a broad future-roll effect",async()=>{
  await syncJester(actor);await setPoints(5);answers.push([target.uuid],"yes","twenty","yes","ally","yes","none");await use("finale","finale-a");assert.equal(jesterPoints(actor),2);assert.equal(item("finale").system.uses.spent,1);assert.equal(actor.effects.length,0);
  await use("finale","finale-a");assert.equal(nativeCalls.length,1);
});
test("Mise only proposes source/current target; no point change does not grant movement or speed",async()=>{
  assert.equal(await offerJesterMovement(actor,source,target,0),false);assert.equal(prompts.length,0);answers.push("none");await offerJesterMovement(actor,source,target,1);assert.ok(prompts[0].window.title.includes("15"));assert.equal(source.x,0);assert.equal(target.x,400);assert.equal(actor.effects.length,0);
});
test("scenery alternates GM/player pairs, never reuses normal choices, then GM picks the odd leftover",async()=>{
  const third=token(makeActor(0,"third"),"third",800),fourth=token(makeActor(0,"fourth"),"fourth",1200),fifth=token(makeActor(0,"fifth"),"fifth",1600);
  answers.push([source.uuid,target.uuid],[third.uuid,fourth.uuid],source.uuid);assert.deepEqual(await planJesterSwaps(actor,[source,target,third,fourth,fifth]),[[source.uuid,target.uuid],[third.uuid,fourth.uuid],[fifth.uuid,source.uuid]]);
  assert.ok(prompts[0].window.title.includes("GM"));assert.ok(prompts[1].window.title.includes("Арлекина"));
});
test("scenery swaps centers and elevation at different sizes; cancelling a pair never consumes chaos",async()=>{
  source.width=2;source.height=2;source.elevation=10;target.elevation=30;assert.deepEqual(jesterSwapUpdates(source,target),[{_id:source.id,x:350,y:-50,elevation:30},{_id:target.id,x:50,y:50,elevation:10}]);
  await syncJester(actor);await setPoints(2);target.x=100;answers.push([source.uuid,target.uuid],"yes",null);assert.equal((await use("scenery")).status,"cancelled");assert.equal(jesterPoints(actor),2);assert.equal(nativeCalls.length,0);
});
test("completed scenery performs native Token updates once and pays only its declared action/point",async()=>{
  actor.items[0].system.levels=1;await syncJester(actor);await setPoints(2);target.x=100;
  answers.push([source.uuid,target.uuid],"yes",[source.uuid,target.uuid],"yes","none");assert.equal((await use("scenery","swap-a")).status,"success");
  assert.equal(source.x,100);assert.equal(target.x,0);assert.equal(jesterPoints(actor),1);assert.equal(nativeCalls[0].activity.activation.type,"action");
  const count=prompts.length;await use("scenery","swap-a");assert.equal(prompts.length,count);assert.equal(nativeCalls.length,1);assert.equal(source.x,100);
});
test("all Jester hooks are actual registrations; disabled automation and another GM cannot alter the resource",async()=>{
  installJesterHooks();for(const key of ["midi-qol.preTargetingV2","dnd5e.preUseActivity","dnd5e.restCompleted","createChatMessage"])assert.ok(hooks.get(key)?.every(fn=>typeof fn==="function"),key);
  game.user={id:"other",isGM:true};assert.equal(await changeJesterChaos(actor,1),false);game.user=game.users.activeGM;game.settings.get=()=>false;assert.equal(await changeJesterChaos(actor,1),false);
});
test("player rest routes through GM with no chaos refill, and receipt replay cannot clear spent Finale again",async()=>{
  actor.items[0].system.levels=3;await syncJester(actor);await setPoints(2);const gm=game.user,player={id:"rest-player",isGM:false,active:false};game.users.push(player);
  const socket=[];game.socket={on(){},emit:(_name,data)=>socket.push(data)};await item("finale").update({"system.uses.spent":1});game.user=player;
  const waiting=jesterRestCompleted(actor,{type:"short",grimgutzJesterRestId:"player-rest"});assert.equal(socket[0].type,"jester-rest");game.user=gm;await receiveGmRequest(socket[0],player.id);
  assert.equal(jesterPoints(actor),2);assert.equal(item("finale").system.uses.spent,0);game.user=player;await receiveGmRequest(socket[1],gm.id);assert.equal((await waiting).status,"success");
  game.user=gm;await item("finale").update({"system.uses.spent":1});await receiveGmRequest(socket[0],player.id);assert.equal(item("finale").system.uses.spent,1);
});
