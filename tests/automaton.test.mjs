import assert from "node:assert/strict";
import {test,beforeEach} from "node:test";
import {MODULE_ID,SETTINGS} from "../scripts/automation/shared/constants.mjs";
import {AUTOMATON_FEATURES,AUTOMATON_MODELS,automatonUnlockedTier} from "../scripts/automation/shared/automaton-definitions.mjs";
import {automatonDocuments} from "../src/packs/automaton-features.mjs";
import {automatonTransformationDocuments} from "../src/packs/automaton-transformation.mjs";
import {automatonText} from "../src/automaton-data.mjs";
import {automatonState,automatonHas,automatonDC,automatonTransformationLevel,automatonPassiveDefinitions,syncAutomaton,automatonRegeneration,validateAutomatonAdvancement,validateAutomatonItem,inspectAutomaton} from "../scripts/automation/transformations/automaton.mjs";
import {controlAutomaton} from "../scripts/automation/transformations/automaton-actions.mjs";
import {reduceAutomatonPacket,prepareAutomatonDamage,prepareAutomatonDamageRoll,prepareAutomatonSave,prepareAutomatonImmunity,prepareAutomatonRange,finishAutomatonCoils} from "../scripts/automation/transformations/automaton-combat.mjs";
import {regenerateAutomaton,handleAutomatonTurn,installAutomatonHooks} from "../scripts/automation/transformations/automaton-events.mjs";
import {applySpellSourceResistance} from "../scripts/automation/midi/spell-resistance.mjs";
import {requestGm} from "../scripts/automation/shared/gm-requests.mjs";
import {linkDocumentDescriptions} from "../tools/link-descriptions.mjs";
import {emitConfirmedDamage} from "../scripts/automation/shared/damage-events.mjs";
import {freezeAutomatonCasterFormulas} from "../scripts/automation/transformations/automaton-battery.mjs";
let actor,source,target,docs,answers,prompts,calls,messages,hooks,seq,nativeMode;
function merge(raw,updates){const out=structuredClone(raw);for(const [key,value]of Object.entries(updates)){if(key.includes(".")){const parts=key.split("."),last=parts.pop();let obj=out;for(const part of parts)obj=obj[part]??={};if(last.startsWith("-="))delete obj[last.slice(2)];else obj[last]=structuredClone(value);}
  else if(value&&typeof value==="object"&&!Array.isArray(value))out[key]=merge(out[key]??{},value);else out[key]=structuredClone(value);}return out;}
const property=(o,path)=>path.split(".").reduce((v,k)=>v?.[k],o);
function owned(data,owner,register=true){let raw=structuredClone(data);raw._id??=`item${++seq}`;const item={id:raw._id,actor:owner,parent:owner,isEmbedded:true,uuid:`${owner.uuid}.Item.${raw._id}`,toObject:()=>structuredClone(raw),getFlag:(m,k)=>raw.flags?.[m]?.[k],
  clone:updates=>owned(merge(raw,updates),owner,false),async update(updates){raw=merge(raw,updates);refresh();owner.prepare();return this;}};
  function refresh(){Object.assign(item,raw);const activities=new Map(Object.entries(raw.system.activities??{}).map(([id,row])=>{const create=r=>({...r,id,item,actor:owner,uuid:`${item.uuid}.Activity.${id}`,toObject:()=>structuredClone(r),clone:updates=>create(merge(r,updates))});return [id,create(row)];}));item.system={...raw.system,activities};}
  refresh();if(register){docs.set(item.uuid,item);for(const a of item.system.activities.values())docs.set(a.uuid,a);}return item;}
function effect(data,owner){let raw=structuredClone(data);const e={id:`e${++seq}`,parent:owner,uuid:`${owner.uuid}.ActiveEffect.e${seq}`,toObject:()=>structuredClone(raw),getFlag:(m,k)=>raw.flags?.[m]?.[k],clone:updates=>({toObject:()=>merge(raw,updates),...merge(raw,updates)}),
  async setFlag(m,k,v){return this.update({[`flags.${m}.${k}`]:v});},async update(updates){raw=merge(raw,updates);refresh();owner.prepare();return this;},async delete(){owner.effects=owner.effects.filter(row=>row!==this);docs.delete(this.uuid);owner.prepare();}};
  function refresh(){Object.assign(e,raw);e.statuses=new Set(raw.statuses??[]);}refresh();docs.set(e.uuid,e);return e;}
function entity(data,id){let raw=structuredClone(data);const a={id,uuid:`Actor.${id}`,documentName:"Actor",isOwner:true,items:[],effects:[],testUserPermission:()=>true,getFlag:(m,k)=>raw.flags?.[m]?.[k],getRollData:()=>structuredClone(a.system),toObject:()=>structuredClone(raw),
  prepare(){this._source=structuredClone(raw);Object.assign(this,{system:structuredClone(raw.system),flags:raw.flags??{},name:raw.name??id,type:raw.type??"character",ownership:raw.ownership??{default:0},prototypeToken:{toObject:()=>structuredClone(raw.prototypeToken??{})}});
    this.system.attributes.prof??=2;this.system.attributes.hp.effectiveMax=this.system.attributes.hp.max+Number(this.system.attributes.hp.tempmax??0);this.statuses=new Set();
    for(const key of ["str","dex","con","int","wis","cha"]){this.system.abilities[key]??={value:10,max:null};this.system.abilities[key].mod=Math.floor((this.system.abilities[key].value-10)/2);}
    for(const e of this.effects)if(!e.disabled&&!e.isSuppressed&&!e.duration?.expired){for(const status of e.statuses??[])this.statuses.add(status);for(const c of e.system?.changes??[])if(/system\.abilities\.\w+\.(value|max)$/.test(c.key)){const key=c.key.split(".")[2],field=c.key.split(".")[3];this.system.abilities[key][field]=c.type==="add"?Number(this.system.abilities[key][field]??0)+Number(c.value):Number(c.value);}}
    for(const key of Object.keys(this.system.abilities))this.system.abilities[key].mod=Math.floor((this.system.abilities[key].value-10)/2);
    this.concentration={effects:new Set(this.effects.filter(e=>!e.disabled&&e.statuses.has("concentrating")))};},
  async update(updates){raw=merge(raw,updates);this.prepare();return this;},async setFlag(m,k,v){return this.update({[`flags.${m}.${k}`]:v});},async unsetFlag(m,k){return this.update({[`flags.${m}.-=${k}`]:null});},
  async createEmbeddedDocuments(type,rows){const out=rows.map(row=>type==="Item"?owned(row,this):effect(row,this));this[type==="Item"?"items":"effects"].push(...out);this.prepare();return out;},
  async updateEmbeddedDocuments(type,rows){for(const row of rows)await this[type==="Item"?"items":"effects"].find(e=>e.id===row._id)?.update(row);return rows;},
  async deleteEmbeddedDocuments(type,ids){if(type==="ActiveEffect")for(const e of [...this.effects]){if(ids.includes(e.id))await e.delete();}else for(const i of [...this.items])if(ids.includes(i.id))this.items.splice(this.items.indexOf(i),1);},
  async delete(){game.actors.splice(game.actors.indexOf(this),1);docs.delete(this.uuid);},async beginConcentrating(activity,data){this.concentrationActivity=activity;const [e]=await this.createEmbeddedDocuments("ActiveEffect",[{name:"Concentration",type:"base",statuses:["concentrating"],system:{changes:[]},...data}]);return e;},
  async endConcentration(e){if(e)await e.delete();else for(const f of [...this.concentration.effects])await f.delete();return [e];}};
  a.prepare();docs.set(a.uuid,a);a.items.get=id=>a.items.find(i=>i.id===id);a.items.has=id=>Boolean(a.items.get(id));return a;}
function makeActor(level=16,id="automaton"){
 const a=entity({name:id,type:"character",system:{attributes:{prof:5,hp:{value:12,max:60,temp:0,tempmax:0},movement:{walk:30,fly:0,units:"ft"},ac:{flat:12},spellcasting:"int",spelldc:16,exhaustion:0},details:{type:{value:"humanoid"}},abilities:Object.fromEntries(["str","dex","con","int","wis","cha"].map(k=>[k,{value:15,max:null}]))}},id);
 a.items.push({id:"class",type:"class",system:{identifier:"fighter",levels:level}},...automatonTransformationDocuments.map(d=>owned(d,a)),...automatonDocuments.map(d=>owned(d,a)));return a;
}
const item=id=>actor.items.find(i=>i.system.identifier===`automaton-${id}`),act=(id,op)=>[...item(id).system.activities.values()].find(a=>!op||a.flags?.[MODULE_ID]?.automatonOperation===op);
const use=(id,op,requestId=`u${++seq}`)=>requestGm("automaton-action",actor,{activityUuid:act(id,op).uuid,sourceUuid:source.uuid},{requestId});
function token(a,id,x=0,scene=canvas.scene){const t={id,uuid:`${scene.uuid}.Token.${id}`,actor:a,parent:scene,name:id,x,y:0,width:1,height:1,elevation:0,disposition:1};scene.tokens.push(t);docs.set(t.uuid,t);return t;}
async function native(activity,config){calls.push({activity,config});if(nativeMode!=="normal")return nativeMode;
 for(const cost of activity.consumption?.targets??[]){const original=activity.actor.items.find(i=>i.id===(cost.target||activity.item.id));if(cost.type==="itemUses")await original.update({"system.uses.spent":Number(original.system.uses.spent??0)+Number(cost.value)});}
 return {id:`workflow${++seq}`,activity};
}
function attack(owner=actor,{type="melee",weapon=true,level=null}={}){
 const data={name:"Test attack",type:level!=null?"spell":weapon?"weapon":"feat",system:{identifier:"test-attack",...(level!=null?{level}:{}),damage:{base:{number:2,denomination:6,types:["slashing"]}},range:{reach:5},activities:{test:{_id:"test",type:"attack",attack:{type:{value:type,classification:weapon?"weapon":"spell"}},range:{value:"5",units:"ft",long:60},flags:{},consumption:{targets:[]},activation:{type:"action"}}}}};
 const i=owned(data,owner);owner.items.push(i);return [...i.system.activities.values()][0];
}
function encounter(){const entries=[source,target].map((t,i)=>({id:`c${i}`,token:t,tokenId:t.id,actor:t.actor}));const c={id:"c",started:true,round:1,turn:0,combatant:entries[0],combatants:entries,turns:entries,previous:{round:0,turn:0}};
 game.combat=c;game.combats=[c];return c;}
beforeEach(()=>{
 docs=new Map();answers=[];prompts=[];calls=[];messages=[];hooks=new Map();seq=0;nativeMode="normal";
 const gm={id:"gm",isGM:true,active:true},users=[gm];users.activeGM=gm;users.get=id=>users.find(u=>u.id===id);
 globalThis.game={user:gm,users,actors:[],items:[],packs:new Map(),combats:[],journal:[],scenes:[],time:{worldTime:0},settings:{get:(_m,k)=>k!==SETTINGS.STRICT_PREREQUISITES},modules:new Map([["midi-qol",{active:true}]])};
 globalThis.foundry={utils:{randomID:()=>`auto${++seq}`,deepClone:structuredClone,mergeObject:merge,getProperty:property,escapeHTML:String},applications:{api:{DialogV2:{wait:async p=>{prompts.push(p);return answers.shift()??null;}}}}};
 globalThis.Hooks={on:(key,fn)=>hooks.set(key,[...(hooks.get(key)??[]),fn])};
 globalThis.CONFIG={DND5E:{maxAbilityScore:20,damageTypes:{force:"Силовой",slashing:"Рубящий",lightning:"Электричество"}},ActiveEffect:{documentClass:{getEffectStart:()=>({time:game.time.worldTime})}}};
 globalThis.ui={notifications:{warn(){},info(){}}};globalThis.fromUuid=async uuid=>docs.get(uuid);
 globalThis.ChatMessage={getSpeaker:({actor})=>({actor:actor.id}),create:async d=>{messages.push(d);return d;}};
 globalThis.Roll=class{constructor(formula){this.formula=formula;this.total=7;}async evaluate(){return this;}async toMessage(data){messages.push({formula:this.formula,...data});}};
 globalThis.MidiQOL={completeActivityUse:native};
 globalThis.canvas={ready:true,scene:{id:"one",uuid:"Scene.one",grid:{size:100,distance:5,units:"ft"},tokens:[],regions:[],templates:[]},tokens:{controlled:[],placeables:[]}};
 canvas.scene.tokens.get=id=>canvas.scene.tokens.find(t=>t.id===id);game.scenes.push(canvas.scene);game.scenes.get=id=>game.scenes.find(s=>s.id===id);
 globalThis.JournalEntry={create:async data=>{let raw=structuredClone(data);const j={uuid:"Journal.test",getFlag:(m,k)=>raw.flags?.[m]?.[k],setFlag:async(m,k,v)=>{raw.flags[m]??={};raw.flags[m][k]=structuredClone(v);}};game.journal.push(j);return j;}};
 actor=makeActor();game.actors.push(actor);source=token(actor,"source");target=token(makeActor(1,"other"),"target",300);game.actors.push(target.actor);canvas.tokens.controlled=[{document:source,actor}];canvas.tokens.placeables=[{document:source,actor}];
});
test("Automaton includes fourteen boons, four flaws and source text for every card",()=>{
 assert.equal(automatonDocuments.length,18);assert.equal(AUTOMATON_FEATURES.filter(e=>e.flaw).length,4);
 for(const e of AUTOMATON_FEATURES){const d=automatonDocuments.find(d=>d.system.identifier===e.key);assert.ok(d.system.description.value.includes(automatonText[e.id].split("\n")[0]));assert.equal(d.effects.length,0);}
 assert.deepEqual(automatonTransformationDocuments[0].system.advancement.filter(a=>a.type==="ItemChoice").map(a=>a.configuration.pool.length),[4,8,12]);
});
test("tier boundaries clamp high-tier manually added cards to class levels",()=>{
 for(const n of [1,5,6,10,11,15,16,20]){actor.items.find(i=>i.type==="class").system.levels=n;assert.equal(automatonTransformationLevel(actor),automatonUnlockedTier(n));}
 actor.items=actor.items.filter(i=>i.type==="class"||i.system.identifier==="automaton-transformation");assert.equal(automatonTransformationLevel(actor),1);assert.equal(automatonHas(actor,"steel"),false);
});
test("DC uses strength and PB, not transformation level",()=>assert.equal(automatonDC(actor),15));
test("construct form caps bonuses at sixteen, never lowers higher raw abilities",async()=>{
 await syncAutomaton(actor);assert.equal(actor.system.abilities.str.value,16);assert.equal(actor.system.abilities.con.value,16);
 await syncAutomaton(actor);assert.equal(actor.system.abilities.str.value,16);
 await actor.update({"system.abilities.str.value":20});await syncAutomaton(actor);assert.equal(actor.system.abilities.str.value,20);
});
test("passive synchronization preserves disabled effects and avoids duplicates",async()=>{
 await syncAutomaton(actor);const e=actor.effects.find(e=>e.getFlag(MODULE_ID,"automatonPassive")==="form");await e.update({disabled:true});await syncAutomaton(actor);
 assert.equal(e.disabled,true);assert.equal(actor.effects.filter(e=>e.getFlag(MODULE_ID,"automatonPassive")==="form").length,1);
});
test("no model is guessed, canceled choice creates no model passive",async()=>{assert.equal((await use("model")).status,"cancelled");await syncAutomaton(actor);assert.equal(actor.effects.some(e=>e.getFlag(MODULE_ID,"automatonPassive")==="model"),false);});
test("agile model adds native speed and dex save only",async()=>{
 answers.push("agile");assert.equal((await use("model")).status,"success");const c=automatonPassiveDefinitions(actor).find(e=>e.flags[MODULE_ID].automatonPassive==="model").system.changes;
 assert.ok(c.some(v=>v.key==="system.attributes.movement.walk"&&v.value==="10"));assert.ok(c.some(v=>v.key==="system.abilities.dex.bonuses.save"&&v.value==="4"));assert.equal(c.some(v=>v.key.includes("con.")),false);
});
test("model change needs GM agreement and cancel preserves selection",async()=>{answers.push("warrior");await use("model");answers.push("agile","no");assert.equal((await use("model")).status,"cancelled");assert.equal(automatonState(actor).model,"warrior");});
test("juggernaut sets flat19 and CON saves rather than granting spell resistance at tier1",async()=>{
 actor.items.find(i=>i.type==="class").system.levels=1;answers.push("juggernaut");await use("model");assert.equal(actor.effects.some(e=>e.getFlag(MODULE_ID,"automatonPassive")==="resistance"),false);
 const changes=automatonPassiveDefinitions(actor).find(e=>e.flags[MODULE_ID].automatonPassive==="model").system.changes;assert.ok(changes.some(c=>c.key==="system.attributes.ac.flat"&&c.value==="19"));
});
test("HP bonus follows total character level without healing; flight upgrades only",async()=>{
 await syncAutomaton(actor);const c=automatonPassiveDefinitions(actor);assert.ok(c.find(e=>e.flags[MODULE_ID].automatonPassive==="armor").system.changes.some(c=>c.key==="system.attributes.hp.bonuses.overall"&&c.value==="16"));
 assert.equal(c.find(e=>e.flags[MODULE_ID].automatonPassive==="flight").system.changes[0].type,"upgrade");assert.equal(actor.system.attributes.hp.value,12);
});
test("bastion native action and bonus-action end control only own zero speed",async()=>{
 assert.equal((await use("bastion","bastion")).status,"success");assert.equal(calls[0].activity.activation.type,"action");
 assert.ok(actor.effects.some(e=>e.getFlag(MODULE_ID,"automatonStateEffect")==="bastion"));
 await use("bastion","bastion-end");assert.equal(calls.at(-1).activity.activation.type,"bonus");assert.equal(actor.effects.some(e=>e.getFlag(MODULE_ID,"automatonStateEffect")==="bastion"),false);
});
test("canceled native bastion use adds no effect",async()=>{nativeMode=false;assert.equal((await use("bastion","bastion")).status,"cancelled");assert.equal(actor.effects.length,0);});
test("removing bastion feature cleans own speed effect",async()=>{await use("bastion","bastion");actor.items=actor.items.filter(i=>i!==item("bastion"));await syncAutomaton(actor);assert.equal(actor.effects.some(e=>e.getFlag(MODULE_ID,"automatonStateEffect")==="bastion"),false);});
test("damage reducer subtracts once across mixed parts and preserves healing",()=>{
 assert.deepEqual(reduceAutomatonPacket([{type:"fire",value:3},{type:"cold",value:8},{type:"healing",value:-5}],4).map(p=>p.value),[0,7,-5]);
});
test("bastion threshold inclusive reduces whole packet, repeated callback cannot double-reduce",async()=>{
 await use("bastion","bastion");const activity=attack(target.actor),workflow={id:"incoming",actor:target.actor,activity};
 const packet={damageDetail:[{type:"fire",value:10},{type:"cold",value:10}]};
 await prepareAutomatonDamage({actor,document:source},{workflow,damageItem:packet});assert.equal(packet.totalDamage,0);await prepareAutomatonDamage({actor,document:source},{workflow,damageItem:packet});assert.equal(packet.totalDamage,0);
});
test("large hit without consent is not reduced or charged",async()=>{
 await use("bastion","bastion");answers.push("no","no");const activity=attack(target.actor),packet={damageDetail:[{type:"force",value:21}]};
 await prepareAutomatonDamage({actor,document:source},{workflow:{id:"large",actor:target.actor,activity},damageItem:packet});assert.equal(packet.damageDetail[0].value,21);assert.equal(item("steel").system.uses.spent,0);
});
test("flesh optional reduction is four total, no dummy passive",async()=>{
 actor.items=actor.items.filter(i=>i.system.identifier!=="automaton-steel");answers.push("yes");const activity=attack(target.actor),packet={damageDetail:[{type:"fire",value:3},{type:"cold",value:10}]};
 await prepareAutomatonDamage({actor,document:source},{workflow:{id:"flesh",actor:target.actor,activity},damageItem:packet});assert.equal(packet.totalDamage,9);assert.equal(actor.effects.some(e=>e.origin===item("flesh").uuid),false);
});
test("steel consumes exactly one native reaction/use, a replay never asks again",async()=>{
 await syncAutomaton(actor);actor.items=actor.items.filter(i=>i.system.identifier!=="automaton-flesh");answers.push("yes");const activity=attack(target.actor),packet={damageDetail:[{type:"fire",value:25}]},workflow={id:"steel",actor:target.actor,activity};
 await prepareAutomatonDamage({actor,document:source},{workflow,damageItem:packet});assert.equal(packet.totalDamage,18);assert.equal(item("steel").system.uses.spent,1);assert.equal(calls.at(-1).activity.activation.type,"reaction");
 const count=prompts.length;await prepareAutomatonDamage({actor,document:source},{workflow,damageItem:{damageDetail:[{type:"fire",value:25}]}});assert.equal(prompts.length,count);assert.equal(item("steel").system.uses.spent,1);assert.equal(messages[0].formula,"3d12 + 3");
});
test("Living Material does not heal zero or overshoot half",async()=>{
 for(const [hp,expected] of [[0,0],[1,10],[25,5],[30,0],[31,0]]){await actor.update({"system.attributes.hp.value":hp});assert.equal(automatonRegeneration(actor),expected);}
 await actor.update({"system.attributes.hp.value":25});await regenerateAutomaton(actor);assert.equal(actor.system.attributes.hp.value,30);
});
test("scene-unlinked combat triggers one regeneration and deduplicates repeated update",async()=>{
 const c=encounter();await handleAutomatonTurn(c,{turn:0});assert.equal(actor.system.attributes.hp.value,22);await handleAutomatonTurn(c,{turn:0});assert.equal(actor.system.attributes.hp.value,22);
});
test("off-scene regeneration is queued, never applied retroactively",async()=>{
 const c=encounter();canvas.scene={id:"elsewhere"};await handleAutomatonTurn(c,{turn:0});assert.equal(actor.system.attributes.hp.value,12);assert.equal(game.journal[0].getFlag(MODULE_ID,"events")[0].state,"queued");
});
test("warrior damage only on attack; no bonus on save and no repeated modifier",async()=>{
 answers.push("warrior");await use("model");const a=attack(),config={subject:a,rolls:[{parts:["2d6"]}]};prepareAutomatonDamageRoll(config);prepareAutomatonDamageRoll(config);assert.deepEqual(config.rolls[0].parts,["2d6","4"]);
 const save={subject:{actor,type:"save"},rolls:[{parts:["2d6"]}]};prepareAutomatonDamageRoll(save);assert.deepEqual(save.rolls[0].parts,["2d6"]);
});
test("overload consumes once per rest and typed lightning only for melee attacks",async()=>{
 encounter();await use("overload");assert.equal(item("overload").system.uses.spent,1);const config={subject:attack(),rolls:[{parts:["1d6"],options:{type:"slashing"}}]};prepareAutomatonDamageRoll(config);
 assert.equal(config.rolls[1].parts[0],"2d8");assert.deepEqual(config.rolls[1].options.types,["lightning"]);
 const ranged={subject:attack(actor,{type:"ranged"}),rolls:[{parts:["1d6"]}]};prepareAutomatonDamageRoll(ranged);assert.equal(ranged.rolls.length,1);
});
test("agile magic save advantage is source-scoped and suppression disables it",async()=>{
 answers.push("agile");await use("model");const details={};prepareAutomatonSave({actor},{item:{type:"weapon"}},details);assert.equal(details.advantage,undefined);
 prepareAutomatonSave({actor},{item:{type:"spell"}},details);assert.equal(details.advantage,true);
 actor.effects.find(e=>e.getFlag(MODULE_ID,"automatonPassive")==="resistance").isSuppressed=true;const suppressed={};prepareAutomatonSave({actor},{item:{type:"spell"}},suppressed);assert.equal(suppressed.advantage,undefined);
});
test("juggernaut spell resistance skips mundane and already resisted damage",async()=>{
 answers.push("juggernaut");await use("model");
 const p={damageDetail:[{type:"fire",value:9},{type:"cold",value:4,active:{resistance:true}}]};applySpellSourceResistance({actor},{workflow:{item:{type:"weapon"}},damageItem:p});assert.equal(p.damageDetail[0].value,9);
 applySpellSourceResistance({actor},{workflow:{item:{type:"spell"}},damageItem:p});assert.deepEqual(p.damageDetail.map(p=>p.value),[4,4]);applySpellSourceResistance({actor},{workflow:{item:{type:"spell"}},damageItem:p});assert.equal(p.damageDetail[0].value,4);
});
test("three chosen spell immunities remove only matching target via workflow setter",async()=>{
 answers.push("warrior");await use("model");const spell=attack(target.actor,{level:2,weapon:false});await actor.setFlag(MODULE_ID,"automatonState",{...automatonState(actor),immunities:[{id:"test-attack"}]});
 const other={document:target,actor:target.actor},own={document:source,actor};const w={id:"spell",actor:target.actor,item:spell.item,activity:spell,targets:new Set([own,other])};await prepareAutomatonImmunity(w);assert.deepEqual([...w.targets],[other]);
});
test("antimagic upgrade uses own unconscious effect and exit preserves unrelated unconscious",async()=>{
 await actor.createEmbeddedDocuments("ActiveEffect",[{name:"Other",statuses:["unconscious"],system:{changes:[]}}]);answers.push("yes");await use("antimagic","antimagic-enter");const e=actor.effects.find(e=>e.getFlag(MODULE_ID,"automatonStateEffect")==="antimagic");assert.ok(e.statuses.has("unconscious"));
 answers.push("yes");await use("antimagic","antimagic-exit");assert.ok(actor.effects.some(e=>e.name==="Other"));assert.equal(actor.effects.some(e=>e.getFlag(MODULE_ID,"automatonStateEffect")==="antimagic"),false);
});
test("lower-tier antimagic slows only while explicitly entered; Dispel die upgrades",async()=>{
 actor.items.find(i=>i.type==="class").system.levels=6;answers.push("yes");await use("antimagic","antimagic-enter");const e=actor.effects.find(e=>e.getFlag(MODULE_ID,"automatonStateEffect")==="antimagic");assert.equal(e.statuses.size,0);assert.ok(e.system.changes.some(c=>c.type==="multiply"&&c.value==="0.5"));
 answers.push("yes");await use("antimagic","dispel");assert.equal(messages.at(-1).formula,"2d8");actor.items.find(i=>i.type==="class").system.levels=16;answers.push("yes");await use("vulnerability","dispel");assert.equal(messages.at(-1).formula,"4d12");
});
test("coil element cancel or declined paid change retains previous choice",async()=>{
 answers.push("lightning");await use("coils");answers.push("fire","no");assert.equal((await use("coils")).status,"cancelled");assert.equal(automatonState(actor).element,"lightning");
});
test("integrated weapon applies only selected weapon, adds one die not whole base",async()=>{
 const weapon=attack(),other=attack();answers.push(weapon.item.uuid,"weapon","yes");await use("equipment","equipment");
 const c={subject:weapon,rolls:[{parts:["2d6"]}]};prepareAutomatonDamageRoll(c);assert.deepEqual(c.rolls[0].parts,["2d6","1d6"]);
 const second={subject:other,rolls:[{parts:["2d6"]}]};prepareAutomatonDamageRoll(second);assert.deepEqual(second.rolls[0].parts,["2d6"]);
 prepareAutomatonRange(weapon);assert.equal(weapon.range.value,"5");
 const transient=weapon.item.clone({}).system.activities.get(weapon.id);prepareAutomatonRange(transient);assert.equal(transient.range.value,"10");prepareAutomatonRange(transient);assert.equal(transient.range.value,"10");
});
test("staff charges cap at five, spend native actions, no charge on cancel",async()=>{
 const staff=attack();answers.push(staff.item.uuid,"staff","yes");await use("equipment","equipment");nativeMode=false;await use("equipment","charge");assert.equal(automatonState(actor).charges,0);nativeMode="normal";
 for(let i=0;i<5;i++)await use("equipment","charge");assert.equal(automatonState(actor).charges,5);await assert.rejects(()=>use("equipment","charge"),/пять/);
});
test("battery stores fixed original caster/DC/level and cancellation preserves capacity",async()=>{
 const spell=attack(actor,{level:2,weapon:false});spell.item.system.ability="int";answers.push(spell.item.uuid,2,"yes");assert.equal((await use("battery","battery-store")).status,"success");
 const state=automatonState(actor);assert.equal(state.battery.length,1);assert.equal(state.battery[0].level,2);assert.equal(state.battery[0].dc,16);
 const stored=actor.items.find(i=>i.id===state.battery[0].id);answers.push(stored.id);nativeMode=false;assert.equal((await use("battery","battery-cast")).status,"cancelled");assert.equal(automatonState(actor).battery[0].locked,false);
});
test("battery successful cast releases one entry with no new spell-slot expense",async()=>{
 const spell=attack(actor,{level:2,weapon:false});answers.push(spell.item.uuid,2,"yes");await use("battery","battery-store");answers.push(automatonState(actor).battery[0].id);await use("battery","battery-cast");
 assert.equal(automatonState(actor).battery.length,0);assert.equal(calls.at(-1).activity.consumption.spellSlot,false);
});
test("unknown battery cast stays locked instead of being replayed",async()=>{
 const spell=attack(actor,{level:2,weapon:false});answers.push(spell.item.uuid,2,"yes");await use("battery","battery-store");answers.push(automatonState(actor).battery[0].id);nativeMode=undefined;assert.equal((await use("battery","battery-cast")).status,"needs-review");assert.equal(automatonState(actor).battery[0].locked,true);
});
test("core refuses without owner and GM consent, deletes nothing",async()=>{
 answers.push("no");assert.equal((await use("core")).status,"cancelled");assert.equal(calls.length,0);assert.equal(actor.items.length,20);
});
test("duplicate boon rejected by advancement, and entry prerequisite stays opt-in",()=>{
 const card=item("flight").toObject();assert.equal(validateAutomatonAdvancement({actor},{},[card],[],[]),false);
 game.settings.get=()=>true;actor.system.abilities.str.value=12;assert.equal(validateAutomatonItem({...automatonTransformationDocuments[0],parent:actor},null,null,"gm"),false);
});
test("hooks installed for actual native and Midi callbacks, battery card cannot bypass controller",()=>{
 installAutomatonHooks();for(const k of ["dnd5e.preUseActivity","midi-qol.preTargetingV2","midi-qol.prePreambleComplete","midi-qol.preTargetSave","updateCombat","dnd5e.restCompleted"])assert.ok(hooks.has(k));
 const card={item:{getFlag:(_m,k)=>k==="automatonBatterySpell"},flags:{}};assert.equal(hooks.get("dnd5e.preUseActivity")[0](card),false);
});
test("diagnostics do not create documents or change actor state",()=>{
 const before=actor.toObject();const report=inspectAutomaton(actor);assert.equal(report.level,4);assert.deepEqual(actor.toObject(),before);assert.equal(game.journal.length,0);
});
test("warrior advantage requires a distinct living allied token within five feet",async()=>{
 answers.push("warrior");await use("model");const a=attack();
 const query=key=>requestGm("combat-attack-benefits",actor,{activityUuid:a.uuid,attackerUuid:source.uuid,targetUuid:target.uuid,workflowId:key},{requestId:key});
 assert.equal((await query("ally-far")).results.some(r=>r.name.includes("Модель воина")),false);
 target.x=100;assert.equal((await query("ally-near")).results.some(r=>r.name.includes("Модель воина")),true);
 target.disposition=-1;assert.equal((await query("enemy-near")).results.some(r=>r.name.includes("Модель воина")),false);
});
test("coils provide tempHP only after confirmed matching damage and do not stack",async()=>{
 answers.push("lightning");await use("coils");await actor.update({"system.attributes.hp.temp":2});answers.push("yes");
 const event={key:"coil-matching",sceneId:canvas.scene.id,sourceActorUuid:target.actor.uuid,targetTokenUuid:source.uuid,damageType:"lightning",damageTypes:["lightning"]};
 await emitConfirmedDamage(actor,9,{[MODULE_ID]:{damageEvent:event}});assert.equal(actor.system.attributes.hp.temp,4);
 await emitConfirmedDamage(actor,9,{[MODULE_ID]:{damageEvent:event}});assert.equal(actor.system.attributes.hp.temp,4);
 await emitConfirmedDamage(actor,20,{[MODULE_ID]:{damageEvent:{...event,key:"coil-other",damageTypes:["fire"]}}});assert.equal(actor.system.attributes.hp.temp,4);
});
test("mixed incoming damage asks GM for elemental portion, not half of entire packet",async()=>{
 answers.push("fire");await use("coils");answers.push(4,"yes");await emitConfirmedDamage(actor,20,{[MODULE_ID]:{damageEvent:{key:"coil-mixed",sceneId:canvas.scene.id,sourceActorUuid:target.actor.uuid,targetTokenUuid:source.uuid,damageTypes:["fire","cold"]}}});assert.equal(actor.system.attributes.hp.temp,2);
});
test("coils reserve one hit bonus, spend only after confirmed damage and never twice",async()=>{
 await actor.update({"system.attributes.hp.temp":10});const a=attack();answers.push("yes","yes");
 const result=await requestGm("prepare-damage-event",actor,{key:"coil-spend",workflowId:"coil-spend-workflow",activityUuid:a.uuid,attackerUuid:source.uuid,targetUuid:target.uuid,damageType:"slashing",damageTypes:["slashing"]},{requestId:"coil-spend-prepare"});
 assert.equal(result.bonuses.at(-1).value,4);assert.equal(actor.system.attributes.hp.temp,10);
 await emitConfirmedDamage(target.actor,8,{[MODULE_ID]:{damageEvent:result.context}});assert.equal(actor.system.attributes.hp.temp,6);
 await emitConfirmedDamage(target.actor,8,{[MODULE_ID]:{damageEvent:result.context}});assert.equal(actor.system.attributes.hp.temp,6);
});
test("aborted coils hit releases reservation without tempHP expense",async()=>{
 await actor.update({"system.attributes.hp.temp":10});await actor.setFlag(MODULE_ID,"automatonCoilReservation",{workflowId:"abort",key:"abort:key",state:"reserved",cost:4});
 await finishAutomatonCoils({actor,id:"abort",aborted:true});assert.equal(actor.system.attributes.hp.temp,10);assert.equal(actor.getFlag(MODULE_ID,"automatonCoilReservation"),undefined);
});
test("immunity choice requires exactly three and rest gates a second selection",async()=>{
 answers.push("warrior");await use("model");const spells=[1,2,3].map(i=>{const a=attack(actor,{level:i,weapon:false});a.item.system.identifier=`spell-${i}`;return a.item;});
 answers.push(["spell-1","spell-2"]);assert.equal((await use("resistance","immunities")).status,"cancelled");
 answers.push(["spell-1","spell-2","spell-3"]);assert.equal((await use("resistance","immunities")).status,"success");
 await assert.rejects(()=>use("resistance","immunities"),/продолжительного/);
 await requestGm("automaton-rest",actor,{long:true},{requestId:"new-lr"});answers.push(["spell-1","spell-2","spell-3"]);assert.equal((await use("resistance","immunities")).status,"success");
});
test("short rest does not unlock new immunities or pretend to be a long rest",async()=>{
 await actor.setFlag(MODULE_ID,"automatonState",{restEpoch:2,lastRecharge:12});await requestGm("automaton-rest",actor,{long:false},{requestId:"short-rest"});assert.equal(automatonState(actor).restEpoch,2);assert.equal(automatonState(actor).lastRecharge,12);
});
test("recharge never silently applies missed exhaustion, GM applies one confirmed level",async()=>{
 game.time.worldTime=200000;answers.push("reset");await use("recharge");game.time.worldTime+=100000;assert.equal(actor.system.attributes.exhaustion,0);
 answers.push("exhaust");await use("recharge");assert.equal(actor.system.attributes.exhaustion,1);assert.ok(prompts.at(-1).window.title.includes("8 ч"));
});
test("duplicate action request uses one receipt, no second action or effect",async()=>{
 await use("bastion","bastion","same-bastion");await use("bastion","bastion","same-bastion");assert.equal(calls.length,1);assert.equal(actor.effects.length,1);
});
test("reaction cancel and unknown outcome never apply unconfirmed reduction",async()=>{
 await syncAutomaton(actor);actor.items=actor.items.filter(i=>i.system.identifier!=="automaton-flesh");answers.push("yes");nativeMode=undefined;const a=attack(target.actor),packet={damageDetail:[{type:"force",value:25}]};
 await prepareAutomatonDamage({actor,document:source},{workflow:{id:"unknown-steel",actor:target.actor,activity:a},damageItem:packet});assert.equal(packet.damageDetail[0].value,25);assert.equal(item("steel").system.uses.spent,0);
});
test("core second confirmation decline does not open a template",async()=>{
 answers.push("yes","no");assert.equal((await use("core")).status,"cancelled");assert.equal(calls.length,0);assert.equal(automatonState(actor).coreAt,undefined);
});
test("future-level feature and disabled automation do not apply combat changes",()=>{
 actor.items.find(i=>i.type==="class").system.levels=1;assert.equal(automatonHas(actor,"flight"),false);assert.equal(automatonRegeneration(actor),0);
 game.settings.get=()=>false;const config={subject:attack(),rolls:[{parts:["1d6"]}]};prepareAutomatonDamageRoll(config);assert.deepEqual(config.rolls[0].parts,["1d6"]);
});
test("battery freezes original caster formula numbers but preserves native upcast variables",()=>{
 const value=freezeAutomatonCasterFormulas({damage:{parts:[{bonus:"@abilities.int.mod + @prof + @scaling + @item.level + @unknown"}]}},{abilities:{int:{mod:5}},prof:6});
 assert.equal(value.damage.parts[0].bonus,"5 + 6 + @scaling + @item.level + @unknown");
});
test("tier4 staff selects both projectile targets before expense and uses one action",async()=>{
 const staff=attack();answers.push(staff.item.uuid,"staff","yes");await use("equipment","equipment");
 answers.push([target.uuid],[target.uuid]);assert.equal((await use("equipment","shard")).status,"success");
 assert.equal(calls.length,2);assert.equal(calls[0].activity.activation.type,"action");assert.equal(calls[1].activity.activation.type,"special");assert.equal(calls[0].activity.damage.parts[0].denomination,12);
});
test("canceling second staff target before the volley does not use the first action",async()=>{
 const staff=attack();answers.push(staff.item.uuid,"staff","yes");await use("equipment","equipment");answers.push([target.uuid],null);
 assert.equal((await use("equipment","shard")).status,"cancelled");assert.equal(calls.length,0);
});
