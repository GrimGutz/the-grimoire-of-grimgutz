import assert from "node:assert/strict";
import {test,beforeEach} from "node:test";
import {MODULE_ID,SETTINGS} from "../scripts/automation/shared/constants.mjs";
import {CHIMERA_FEATURES,CHIMERA_MENAGERIE,CHIMERA_KNOWLEDGE,CHIMERA_MUTATIONS,chimeraMutationFor} from "../scripts/automation/shared/chimera-definitions.mjs";
import {chimeraDocuments} from "../src/packs/chimera-features.mjs";
import {chimeraTransformationDocuments} from "../src/packs/chimera-transformation.mjs";
import {chimeraState,chimeraHas,chimeraDC,chimeraTransformationLevel,chimeraPassiveDefinitions,syncChimera,chimeraAdaptation,chimeraKnowledge,inspectChimera,chimeraShared} from "../scripts/automation/transformations/chimera.mjs";
import {controlChimera,chimeraAttackData} from "../scripts/automation/transformations/chimera-actions.mjs";
import {chooseChimera,rollChimeraMutation,saveChimeraState} from "../scripts/automation/transformations/chimera-choices.mjs";
import {chimeraCondition} from "../scripts/automation/transformations/chimera-use.mjs";
import {handleChimeraTurn,regenerateChimera,chimeraRegeneration,prepareChimeraHitDie,prepareChimeraPerception,captureChimeraHp,observeChimeraHp,cleanupChimeraInstincts,installChimeraHooks} from "../scripts/automation/transformations/chimera-events.mjs";
import {prepareChimeraSpellTargets,prepareChimeraBronzeAttack,applyChimeraDamagePacket,finishChimeraMagicalSaves,filterChimeraHearingTargets} from "../scripts/automation/transformations/chimera-spells.mjs";
import {chimeraShareFingerprint,expireChimeraShares} from "../scripts/automation/transformations/chimera-sharing.mjs";
import {applySpellSourceResistance} from "../scripts/automation/midi/spell-resistance.mjs";
import {requestGm} from "../scripts/automation/shared/gm-requests.mjs";
import {emitConfirmedDamage} from "../scripts/automation/shared/damage-events.mjs";
import {processRepeatedSaves} from "../scripts/automation/effects/repeated-saves.mjs";
import {linkDocumentDescriptions} from "../tools/link-descriptions.mjs";
let actor,source,target,base,docs,answers,prompts,calls,messages,hooks,seq,nativeMode,saveSuccess,rollTotal,cancelPlacement,createFails;
function merge(raw,updates){const out=structuredClone(raw);for(const [key,value]of Object.entries(updates)){if(key.includes(".")){const parts=key.split("."),last=parts.pop();let obj=out;for(const part of parts)obj=obj[part]??={};if(last.startsWith("-="))delete obj[last.slice(2)];else obj[last]=structuredClone(value);}
  else if(value&&typeof value==="object"&&!Array.isArray(value))out[key]=merge(out[key]??{},value);else out[key]=structuredClone(value);}return out;}
const property=(o,path)=>path.split(".").reduce((v,k)=>v?.[k],o);
function owned(data,owner,register=true){let raw=structuredClone(data);raw._id??=`item${++seq}`;const item={id:raw._id,actor:owner,parent:owner,isEmbedded:true,uuid:`${owner.uuid}.Item.${raw._id}`,toObject:()=>structuredClone(raw),getFlag:(m,k)=>raw.flags?.[m]?.[k],
  clone:(updates,options={})=>owned(merge(raw,updates),options.parent??owner,false),async setFlag(m,k,v){return this.update({[`flags.${m}.${k}`]:v});},async delete(){owner.items.splice(owner.items.indexOf(this),1);docs.delete(this.uuid);},async update(updates){raw=merge(raw,updates);refresh();owner.prepare();return this;}};
  function refresh(){Object.assign(item,raw);const activities=new Map(Object.entries(raw.system.activities??{}).map(([id,row])=>{const create=r=>({...r,id,item,actor:owner,uuid:`${item.uuid}.Activity.${id}`,toObject:()=>structuredClone(r),clone:updates=>create(merge(r,updates))});return [id,create(row)];}));item.system={...raw.system,activities};}
  refresh();if(String(item.system.uses?.max).includes("@abilities.con.mod"))item.system.uses={...item.system.uses,max:Math.max(0,Number(owner.system.abilities.con.mod))};if(register){docs.set(item.uuid,item);for(const a of item.system.activities.values())docs.set(a.uuid,a);}return item;}
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

function makeActor(level=16,id="chimera",features=true){
 const a=entity({name:id,type:features?"character":"npc",system:{skills:{prc:{value:0},ath:{value:1}},attributes:{prof:5,hp:{value:20,max:60,temp:0,tempmax:0},movement:{walk:30,climb:0,units:"ft"},senses:{darkvision:60},ac:{flat:14,value:14,shield:0,bonus:0},concentration:{limit:1},exhaustion:0},details:{type:{value:features?"humanoid":"beast"},cr:1},traits:{size:"lg",ci:{value:[]},di:{value:[]},dr:{value:[]}},abilities:Object.fromEntries(["str","dex","con","int","wis","cha"].map(k=>[k,{value:18,max:null}]))}},id);
 if(features)a.items.push(owned({name:"Fighter",type:"class",system:{identifier:"fighter",levels:level,hd:{denomination:"d10",max:level,value:level,spent:0}}},a),...chimeraTransformationDocuments.map(d=>owned(d,a)),...chimeraDocuments.map(d=>owned(d,a)));
 return a;
}
const item=id=>actor.items.find(i=>i.system.identifier===`chimera-${id}`),act=(id,op)=>[...item(id).system.activities.values()].find(a=>!op||a.flags?.[MODULE_ID]?.chimeraOperation===op);
const use=(id,op,requestId=`u${++seq}`)=>requestGm("chimera-action",actor,{activityUuid:act(id,op).uuid,sourceUuid:source.uuid},{requestId});
function token(a,id,x=0,scene=canvas.scene,data={}){
 const t={id,uuid:`${scene.uuid}.Token.${id}`,actor:a,actorId:a.id,parent:scene,name:id,documentName:"Token",x,y:0,width:1,height:1,elevation:0,disposition:1,hidden:false,...data,
 async update(changes){Object.assign(this,changes);return this;}};scene.tokens.push(t);docs.set(t.uuid,t);return t;
}
function region(row={},scene=canvas.scene){let raw={name:"region",documentName:"Region",hidden:false,shapes:[{type:"polygon",points:[50,0,650,0,650,80,50,80]}],flags:{},...row};
 const z={id:`z${++seq}`,uuid:`${scene.uuid}.Region.z${seq}`,parent:scene,getFlag:(m,k)=>raw.flags?.[m]?.[k],toObject:()=>structuredClone(raw),async update(changes){raw=merge(raw,changes);Object.assign(this,raw);return this;},async setFlag(m,k,v){return this.update({[`flags.${m}.${k}`]:v});},async delete(){this.deleted=true;scene.regions.splice(scene.regions.indexOf(this),1);docs.delete(this.uuid);}};
 Object.assign(z,raw);scene.regions.push(z);docs.set(z.uuid,z);return z;
}
function attack(owner=actor,{type="melee",spell=false}={}){
 const i=owned({name:"Attack",type:spell?"spell":"weapon",system:{identifier:"sample-attack",level:1,damage:{base:{number:1,denomination:8,bonus:"",types:["piercing"]}},activities:{test:{_id:"test",type:"attack",attack:{flat:true,bonus:"5",type:{value:type,classification:"weapon"}},damage:{includeBase:true,parts:[]},range:{value:"5",units:"ft"},flags:{},consumption:{targets:[]},activation:{type:"action"}}}}},owner);owner.items.push(i);return [...i.system.activities.values()][0];
}
function encounter(turn=0){const entries=[source,target].map((t,i)=>({id:`c${i}`,token:t,tokenId:t.id,actor:t.actor})),c={id:"c",started:true,round:1,turn,combatant:entries[turn],combatants:entries,turns:entries,previous:{round:0,turn:0}};game.combat=c;game.combats=[c];return c;}
async function native(activity,config){calls.push({activity,config});if(nativeMode!=="normal")return nativeMode;
 for(const cost of activity.consumption?.targets??[]){
  if(cost.type==="hitDice"){let n=Number(cost.value);for(const row of chimeraHitDice(activity.actor)){const spent=Math.min(n,row.remaining);if(spent)await row.item.update({"system.hd.spent":row.spent+spent,"system.hd.value":row.remaining-spent});n-=spent;if(!n)break;}if(n)return false;}
  else if(cost.type==="itemUses"){const original=activity.actor.items.find(i=>i.id===(cost.target||activity.item.id));await original.update({"system.uses.spent":Number(original.system.uses.spent??0)+Number(cost.value)});}
 }
 const targets=(config.midiOptions?.targetUuids??[]).map(uuid=>({actor:docs.get(uuid)?.actor,document:docs.get(uuid)}));
 return {id:`wf${++seq}`,activity,hitTargets:new Set(targets),failedSaves:new Set(saveSuccess?[]:targets),saves:new Set(saveSuccess?targets:[])};
}
beforeEach(()=>{
 docs=new Map();answers=[];prompts=[];calls=[];messages=[];hooks=new Map();seq=0;nativeMode="normal";saveSuccess=false;rollTotal=7;cancelPlacement=false;createFails=false;
 const gm={id:"gm",isGM:true,active:true},users=[gm];users.activeGM=gm;users.get=id=>users.find(u=>u.id===id);
 globalThis.game={user:gm,users,actors:[],items:[],packs:new Map(),combats:[],journal:[],scenes:[],time:{worldTime:0},settings:{get:(_m,k)=>k!==SETTINGS.STRICT_PREREQUISITES},modules:new Map([["midi-qol",{active:true}]])};
 globalThis.foundry={utils:{randomID:()=>`brood${++seq}`,deepClone:structuredClone,mergeObject:merge,getProperty:property,escapeHTML:String},applications:{api:{DialogV2:{wait:async p=>{prompts.push(p);return answers.shift()??null;}}}}};
 globalThis.Hooks={on:(key,fn)=>hooks.set(key,[...(hooks.get(key)??[]),fn])};
 globalThis.CONFIG={DND5E:{maxAbilityScore:20,skills:{prc:{label:"Perception"},ath:{label:"Athletics"}},damageTypes:{fire:{label:"Fire"},cold:{label:"Cold"}}},ActiveEffect:{documentClass:{getEffectStart:()=>({time:game.time.worldTime})}}};globalThis.ui={notifications:{warn(){},info(){}}};globalThis.fromUuid=async uuid=>docs.get(uuid);
 globalThis.ChatMessage={getSpeaker:({actor})=>({actor:actor.id}),create:async d=>{messages.push(d);return d;}};
 globalThis.Roll=class{constructor(formula){this.formula=formula;this.total=rollTotal;}async evaluate(){return this;}async toMessage(data){messages.push({formula:this.formula,...data});}};
 class Workflow{constructor(actor,activity,speaker,targets,options){Object.assign(this,{actor,activity,targets,workflowOptions:options.workflowOptions});}}
 globalThis.MidiQOL={Workflow,TrapWorkflow:class extends Workflow{},completeActivityUse:native,computeTargetsFromTemplates:()=>[{actor:target.actor,document:target}]};
 globalThis.canvas={ready:true,scene:{id:"one",uuid:"Scene.one",grid:{size:100,distance:5,units:"ft"},tokens:[],regions:[],templates:[]},tokens:{controlled:[],placeables:[]}};
 canvas.scene.tokens.get=id=>canvas.scene.tokens.find(t=>t.id===id);canvas.scene.regions.get=id=>canvas.scene.regions.find(z=>z.id===id);
 canvas.scene.createEmbeddedDocuments=async(type,rows)=>rows.map(row=>type==="Region"?region(row):token(game.actors.find(a=>a.id===row.actorId),`spawn${++seq}`,row.x,canvas.scene,row));
 canvas.scene.deleteEmbeddedDocuments=async(type,ids)=>{if(type==="Token")canvas.scene.tokens=canvas.scene.tokens.filter(t=>!ids.includes(t.id));};
 game.scenes.push(canvas.scene);game.scenes.get=id=>game.scenes.find(s=>s.id===id);game.actors.get=id=>game.actors.find(a=>a.id===id);game.user.targets=new Set();game.user.updateTokenTargets=()=>{};
 globalThis.JournalEntry={create:async data=>{let raw=structuredClone(data);const j={uuid:"Journal.test",getFlag:(m,k)=>raw.flags?.[m]?.[k],setFlag:async(m,k,v)=>{raw.flags[m]??={};raw.flags[m][k]=structuredClone(v);}};game.journal.push(j);return j;}};
 globalThis.Actor={create:async data=>{if(createFails)throw Error("test creation failure");const a=entity(data,`child${++seq}`);a.items.push(...(data.items??[]).map(d=>owned(d,a)));game.actors.push(a);return a;}};
 actor=makeActor();game.actors.push(actor);source=token(actor,"source");target=token(makeActor(1,"target",false),"target",200);game.actors.push(target.actor);base=makeActor(0,"Giant Spider",false);attack(base);game.actors.push(base);
 const controlled={document:source,actor,center:{x:50,y:50}};canvas.tokens.controlled=[controlled];canvas.tokens.placeables=[controlled,{document:target,actor:target.actor,center:{x:250,y:50}}];
 game.system={canvas:{AbilityTemplate:{fromActivity:()=>[{drawPreview:async()=>cancelPlacement?false:[region()]}]}}};
 actor.rollSavingThrow=async()=>[{total:rollTotal}];target.actor.rollSavingThrow=async()=>[{total:rollTotal}];
});

test("source: eighteen main cards, fourteen reference options and approved recovery",()=>{
 assert.equal(CHIMERA_FEATURES.length,18);assert.equal(CHIMERA_FEATURES.filter(e=>e.flaw).length,4);assert.equal(chimeraDocuments.length,32);
 assert.equal(CHIMERA_MENAGERIE.length,11);assert.equal(CHIMERA_KNOWLEDGE.length,3);
 assert.equal(item("medusa").system.uses.recovery[0].period,"sr");assert.equal(item("mimic").system.uses.recovery[0].period,"lr");assert.equal(chimeraDocuments.find(d=>d.system.identifier==="chimera-kraken").system.uses.max,"max(0, @abilities.con.mod)");
 assert.equal(CHIMERA_FEATURES.find(e=>e.id==="carapace").flaw,false);assert.ok(chimeraDocuments.every(d=>!d.effects.length&&d.system.description.value.includes("Автоматизация Foundry:")));
 const root=chimeraTransformationDocuments[0];assert.equal(root.folder,null);assert.deepEqual(root.system.advancement.filter(a=>a.type==="ItemChoice").map(a=>a.configuration.pool.length),[4,8,12]);
});
test("all four d100 columns cover 1–100 exactly once",()=>{
 for(let tier=1;tier<=4;tier++)for(let n=1;n<=100;n++){assert.ok(chimeraMutationFor(n,tier));assert.equal(CHIMERA_MUTATIONS.filter(r=>n>=r.ranges[tier-1][0]&&n<=r.ranges[tier-1][1]).length,1);}assert.equal(chimeraMutationFor(0,1),null);assert.equal(chimeraMutationFor(101,1),null);
});
test("native ability caps preserve higher scores and converge on repeated sync",async()=>{
 await actor.update({"system.abilities.str.value":15,"system.abilities.con.value":15});await syncChimera(actor);assert.equal(actor.system.abilities.con.value,16);assert.equal(actor.system.abilities.str.value,16);
 await syncChimera(actor);assert.equal(actor.system.abilities.con.value,16);assert.equal(actor.effects.filter(e=>e.getFlag(MODULE_ID,"chimeraPassive")==="form").length,1);
 await actor.update({"system.abilities.con.value":22});await syncChimera(actor);assert.equal(actor.system.abilities.con.value,22);assert.equal(chimeraDC(actor),19);
});
test("menagerie: exact PB choices, no free respec, new PB slot keeps old choices",async()=>{
 answers.push(["turtle","bear","ram","fly","wolf"]);assert.equal(await chooseChimera(actor,"menagerie"),true);assert.ok(chimeraAdaptation(actor,"wolf"));
 const definitions=chimeraPassiveDefinitions(actor);assert.equal(definitions.filter(e=>e.flags[MODULE_ID].chimeraPassive.startsWith("adaptation-")).length,4);
 assert.ok(definitions.some(e=>e.system.changes.some(c=>c.key==="flags.midi-qol.actions.reactionsMax"&&c.type==="upgrade"&&c.value==="2")));
 await assert.rejects(chooseChimera(actor,"menagerie"),/отдыха/);await actor.update({"system.attributes.prof":6});answers.push(["otter"]);await chooseChimera(actor,"menagerie");assert.deepEqual(chimeraState(actor).menagerie,["turtle","bear","ram","fly","wolf","otter"]);
 assert.ok(!chimeraPassiveDefinitions(actor).some(e=>e.system.changes.some(c=>c.key==="system.traits.di.value")));
});
test("cancelled choices change neither state nor resources",async()=>{answers.push(null);assert.equal((await use("menagerie","menagerie")).status,"cancelled");assert.deepEqual(chimeraState(actor),{});assert.equal(calls.length,0);});
test("knowledge grants only chosen skill grade and one movement adaptation",async()=>{
 answers.push("ath","spider");await chooseChimera(actor,"knowledge");assert.deepEqual(chimeraState(actor).knowledge,{skill:"ath",grade:2,adaptation:"spider"});assert.ok(chimeraKnowledge(actor,"spider"));
 const changes=chimeraPassiveDefinitions(actor).find(e=>e.flags[MODULE_ID].chimeraPassive==="knowledge").system.changes;assert.ok(changes.some(c=>c.key==="system.skills.ath.value"&&c.value==="2"));assert.ok(changes.some(c=>c.key==="system.attributes.movement.climb"&&c.type==="upgrade"));assert.ok(!changes.some(c=>c.key.includes("darkvision")));
});
test("resistance adds 2 HP per character level, does not heal",async()=>{
 answers.push("fire");await chooseChimera(actor,"resistance");const changes=chimeraPassiveDefinitions(actor).find(e=>e.flags[MODULE_ID].chimeraPassive==="resistance").system.changes;assert.equal(changes.find(c=>c.key.includes("hp.bonuses")).value,"32");assert.equal(changes.find(c=>c.key.includes("traits.dr")).value,"fire");assert.equal(actor.system.attributes.hp.value,20);await assert.rejects(chooseChimera(actor,"resistance"),/отдыха/);
});
test("mutations replace rather than accumulate; same-row LR rerolls",async()=>{
 const values=[4,8,15];globalThis.Roll=class{constructor(){this.total=values.shift();}async evaluate(){return this;}async toMessage(){}};
 await rollChimeraMutation(actor);assert.equal(chimeraState(actor).mutation.id,"fire");await rollChimeraMutation(actor);assert.equal(chimeraState(actor).mutation.id,"wisdom");assert.equal(actor.effects.filter(e=>e.getFlag(MODULE_ID,"chimeraPassive")==="mutation").length,1);
 assert.ok(!chimeraPassiveDefinitions(actor).some(e=>e.system.changes.some(c=>c.key.includes("traits.dv"))));
});
test("blood mutation only accepts a lower raw d100 result",async()=>{
 await saveChimeraState(actor,{mutation:{id:"poison",roll:95,tier:4}});rollTotal=97;await rollChimeraMutation(actor,{onlyLower:true});assert.equal(chimeraState(actor).mutation.roll,95);rollTotal=1;await rollChimeraMutation(actor,{onlyLower:true});assert.equal(chimeraState(actor).mutation.id,"fire");
});
test("hit die mutation removes CON only from the native hit die formula",async()=>{
 await saveChimeraState(actor,{mutation:{id:"hitdice",roll:25,tier:4}});const config={subject:actor,rolls:[{parts:["max(0, 1d10 + @abilities.con.mod)","2"]}]};prepareChimeraHitDie(config);assert.deepEqual(config.rolls[0].parts,["max(0, 1d10 + 0)","2"]);assert.equal(actor.system.abilities.con.mod,4);
});
test("conditional perception asks once and preserves the other roll context",async()=>{
 await saveChimeraState(actor,{menagerie:["wolf"],mutation:{id:"perception",roll:55,tier:4}});let resumed;actor.rollSkill=async c=>{resumed=c;assert.equal(prepareChimeraPerception(c),undefined);};answers.push("yes");assert.equal(prepareChimeraPerception({subject:actor,skill:"prc",ability:"wis",rolls:[{parts:["1d20"]}]}),false);await new Promise(r=>setTimeout(r,0));assert.ok(resumed.advantage&&resumed.disadvantage);assert.equal(prompts.length,1);
});
test("limbs use CON, bonus action and literal (1+tier)d6",async()=>{
 await saveChimeraState(actor,{menagerie:["limbs"]});target.x=100;answers.push([target.uuid],"slashing");assert.equal((await use("menagerie","limbs")).status,"success");const data=calls[0].activity;assert.equal(data.activation.type,"bonus");assert.equal(data.attack.bonus,"9");assert.equal(data.damage.parts[0].number,5);assert.equal(data.damage.parts[0].denomination,6);
});
test("sting follows only a confirmed hit; poison repeats without extra damage",async()=>{
 target.x=100;answers.push([target.uuid]);await use("sting","sting");assert.equal(calls.length,2);const e=target.actor.effects.find(e=>e.getFlag(MODULE_ID,"chimeraCondition")?.kind==="sting");assert.ok(e.statuses.has("poisoned"));assert.deepEqual(e.getFlag(MODULE_ID,"repeatSave").damage,[]);assert.equal(calls[1].activity.damage.parts[0].number,4);
});
test("contact needs explicit skin contact; repeat save starts only after separation",async()=>{
 await saveChimeraState(actor,{menagerie:["toad"]});target.x=100;answers.push([target.uuid],"yes");await use("menagerie","contact");const e=target.actor.effects.find(e=>e.getFlag(MODULE_ID,"chimeraCondition")?.kind==="contact");assert.ok(e);assert.equal(e.getFlag(MODULE_ID,"repeatSave"),undefined);answers.push([target.uuid]);await use("menagerie","end-contact");assert.equal(e.getFlag(MODULE_ID,"repeatSave").event,"turnEnd");
});
test("Medusa resource is paid once, then one follow-up save petrifies",async()=>{
 const c=encounter(1);answers.push([target.uuid],"yes");assert.equal((await use("medusa","medusa")).status,"success");assert.equal(item("medusa").system.uses.spent,1);const e=target.actor.effects.find(e=>e.getFlag(MODULE_ID,"chimeraCondition")?.kind==="medusa");assert.ok(e.statuses.has("grappled"));assert.equal(e.getFlag(MODULE_ID,"repeatSave"),undefined);
 c.previous={round:1,turn:1};c.round=2;c.turn=0;c.combatant=c.turns[0];await handleChimeraTurn(c,{round:2,turn:0});assert.ok(target.actor.effects.includes(e));
 c.previous={round:2,turn:1};c.round=3;await handleChimeraTurn(c,{round:3,turn:0});assert.ok(!target.actor.effects.includes(e));assert.ok(target.actor.effects.some(e=>e.statuses.has("petrified")));assert.equal(item("medusa").system.uses.spent,1);
});
test("Kraken selects recipients before cost, saves half and source-next-end stun",async()=>{
 encounter();answers.push([target.uuid],"yes");const result=await use("kraken","kraken");assert.equal(result.status,"success");assert.equal(item("kraken").system.uses.spent,1);assert.equal(calls[1].activity.damage.onSave,"half");assert.ok(target.actor.effects.some(e=>e.statuses.has("stunned")&&e.getFlag(MODULE_ID,"combatBenefit")?.expiry==="sourceEnd"));
});
test("cancelled or unknown native use never applies a second result",async()=>{
 answers.push([target.uuid],"yes");nativeMode=false;assert.equal((await use("kraken","kraken","cancel-native")).status,"cancelled");assert.equal(target.actor.effects.length,0);
 answers.push([target.uuid],"yes");nativeMode=undefined;assert.equal((await use("kraken","kraken","unknown-native")).status,"needs-review");const before=prompts.length;await use("kraken","kraken","unknown-native");assert.equal(prompts.length,before);assert.equal(calls.length,2);
});
test("Hydra skips nearest start-turn healing once after fire; zero HP never heals",async()=>{
 await saveChimeraState(actor,{fireEpoch:1});await regenerateChimera(actor);assert.equal(actor.system.attributes.hp.value,20);assert.equal(chimeraState(actor).hydraConsumedFire,1);await regenerateChimera(actor);assert.equal(actor.system.attributes.hp.value,30);await actor.update({"system.attributes.hp.value":0});assert.equal(chimeraRegeneration(actor),0);assert.equal(await regenerateChimera(actor),false);assert.equal(actor.system.attributes.hp.value,0);
});
test("Hydra turn deduplicates and supports combat without combat.scene",async()=>{
 const c=encounter();c.previous={round:0,turn:1};await handleChimeraTurn(c,{round:1,turn:0});await handleChimeraTurn(c,{round:1,turn:0});assert.equal(actor.system.attributes.hp.value,30);
});
test("other-scene Hydra event queues rather than healing in the GM scene",async()=>{
 const c=encounter();c.previous={round:0,turn:1};canvas.ready=false;await handleChimeraTurn(c,{round:1,turn:0});assert.equal(actor.system.attributes.hp.value,20);assert.ok(game.journal.some(j=>j.getFlag(MODULE_ID,"events").some(e=>e.kind==="chimera-periodic"&&e.state==="queued")));
});
test("suppression removes only managed passives and disables Hydra",async()=>{
 await syncChimera(actor);const n=actor.effects.length;item("hydra").isSuppressed=true;assert.equal(chimeraRegeneration(actor),0);item("form").isSuppressed=true;await syncChimera(actor);assert.equal(actor.effects.length,n-1);assert.ok(!actor.effects.some(e=>e.getFlag(MODULE_ID,"chimeraPassive")==="form"));
});
test("carapace resistance applies only to spell packets and never twice",async()=>{
 await syncChimera(actor);const cast=attack(target.actor,{spell:true,type:"ranged"}),packet={damageDetail:[{type:"fire",value:11,active:{}}]};applySpellSourceResistance({actor},{workflow:{item:cast.item},damageItem:packet});assert.equal(packet.damageDetail[0].value,5);applySpellSourceResistance({actor},{workflow:{item:cast.item},damageItem:packet});assert.equal(packet.damageDetail[0].value,5);
 const mundane={damageDetail:[{type:"fire",value:11,active:{}}]};applySpellSourceResistance({actor},{workflow:{item:{type:"weapon"}},damageItem:mundane});assert.equal(mundane.damageDetail[0].value,11);
});
test("ranged spell reflection uses workflow target setter once, not melee spells",async()=>{
 await syncChimera(actor);rollTotal=6;const cast=attack(target.actor,{spell:true,type:"ranged"}),w={id:"reflection",actor:target.actor,item:cast.item,activity:cast,targets:new Set([{actor,document:source}])};await prepareChimeraSpellTargets(w);assert.equal(w.targets.size,0);const count=messages.length;await prepareChimeraSpellTargets(w);assert.equal(messages.length,count);assert.ok(messages.some(m=>m.content?.includes("отражение")));
});
test("bronze damage doubles raw dice before resistance, only bronze weapons",async()=>{
 const cast=attack(target.actor),p={damageDetail:[{type:"piercing",value:4,active:{resistance:true}}],rawDamageDetail:[{type:"piercing",value:9}],calcDamageOptions:{}};actor.calculateDamage=raw=>raw.map(r=>({...r,value:Math.floor(r.value/2),active:{resistance:true}}));
 applyChimeraDamagePacket({actor},{workflow:{item:cast.item,actor:target.actor,activity:cast},damageItem:p});assert.equal(p.damageDetail[0].value,4);await cast.item.setFlag(MODULE_ID,"chimeraBronze",true);applyChimeraDamagePacket({actor},{workflow:{item:cast.item,actor:target.actor,activity:cast},damageItem:p});assert.equal(p.damageDetail[0].value,9);applyChimeraDamagePacket({actor},{workflow:{item:cast.item,actor:target.actor,activity:cast},damageItem:p});assert.equal(p.damageDetail[0].value,9);
});
test("external-healing mutation is source-specific, once, not own healing",async()=>{
 await saveChimeraState(actor,{mutation:{id:"healing",roll:100,tier:4}});const cast=attack(target.actor,{spell:true}),p={damageDetail:[{type:"healing",value:-5,active:{}}]},w={actor:target.actor,item:cast.item,activity:cast};applyChimeraDamagePacket({actor},{workflow:w,damageItem:p});assert.equal(p.damageDetail[0].value,-9);applyChimeraDamagePacket({actor},{workflow:w,damageItem:p});assert.equal(p.damageDetail[0].value,-9);
 const own={damageDetail:[{type:"healing",value:-5}]};applyChimeraDamagePacket({actor},{workflow:{...w,actor},damageItem:own});assert.equal(own.damageDetail[0].value,-5);
});
test("long rest rolls exactly one new mutation and unlocks adaptation changes",async()=>{
 await saveChimeraState(actor,{menagerie:["wolf"]});const r=await requestGm("chimera-rest",actor,{long:true},{requestId:"LR"});assert.equal(r.status,"success");assert.equal(chimeraState(actor).restEpoch,1);const count=messages.length;await requestGm("chimera-rest",actor,{long:true},{requestId:"LR"});assert.equal(messages.length,count);
});
test("spell failed-save mutation is scoped to that workflow and target",async()=>{
 const cast=attack(target.actor,{spell:true}),w={id:"magic-fail",actor:target.actor,item:cast.item,activity:cast,failedSaves:new Set([{actor,document:source}])};await saveChimeraState(actor,{mutation:{id:"healing",roll:100,tier:4}});rollTotal=10;await finishChimeraMagicalSaves(w);assert.equal(chimeraState(actor).mutation.roll,10);const count=messages.length;await finishChimeraMagicalSaves(w);assert.equal(messages.length,count);
});
test("share gives exactly one boon, not transformation levels; preserves CON and own uses",async()=>{
 answers.push([target.uuid],"kraken","yes");const result=await use("share","share");assert.equal(result.status,"success");assert.equal(item("share").system.uses.spent,1);assert.equal(target.actor.items.length,1);assert.ok(chimeraHas(target.actor,"kraken"));assert.equal(chimeraTransformationLevel(target.actor),0);assert.equal(chimeraDC(target.actor),17);assert.equal(target.actor.items[0].system.uses.spent,0);assert.ok(chimeraShared(target.actor.items[0]).fingerprint);
 game.time.worldTime=28801;await expireChimeraShares(target.actor);assert.equal(target.actor.items.length,0);assert.ok(!chimeraHas(target.actor,"kraken"));
});
test("expired shared boon with manual edits is blocked, not silently deleted",async()=>{
 answers.push([target.uuid],"wings","yes");await use("share","share");const copied=target.actor.items[0];await copied.update({name:"My changed wings"});game.time.worldTime=28801;await expireChimeraShares(target.actor);assert.ok(target.actor.items.includes(copied));assert.ok(chimeraShared(copied).disabled);assert.ok(!chimeraHas(target.actor,"wings"));
});
test("blood instinct is triggered only on crossing half HP; cleanup respects exactly half",async()=>{
 await target.actor.update({"system.attributes.hp.value":40});const changes={"system.attributes.hp.value":29},options={};captureChimeraHp(target.actor,changes,options);assert.ok(options[MODULE_ID]?.chimeraHp);await target.actor.update(changes);answers.push("yes");await observeChimeraHp(target.actor,changes,options);assert.ok(actor.effects.some(e=>e.getFlag(MODULE_ID,"chimeraCondition")?.kind==="personality"));
 await target.actor.update({"system.attributes.hp.value":30});await cleanupChimeraInstincts();assert.ok(actor.effects.some(e=>e.getFlag(MODULE_ID,"chimeraCondition")?.kind==="personality"));await target.actor.update({"system.attributes.hp.value":31});await cleanupChimeraInstincts();assert.ok(!actor.effects.some(e=>e.getFlag(MODULE_ID,"chimeraCondition")?.kind==="personality"));
});
test("registered native and Midi hooks are functions; second GM cannot heal",async()=>{
 installChimeraHooks();for(const hook of ["dnd5e.preUseActivity","midi-qol.preTargetingV2","midi-qol.postCheckSaves","dnd5e.preRollHitDie","updateCombat","preUpdateActor","dnd5e.restCompleted"]){assert.ok(hooks.get(hook)?.some(fn=>typeof fn==="function"),hook);}
 game.user={id:"second",isGM:true};assert.equal(await regenerateChimera(actor),false);assert.equal(actor.system.attributes.hp.value,20);
});

test("dragon breath uses a real native cone and restores targets on cancelled placement",async()=>{
 await saveChimeraState(actor,{breath:"fire"});const result=await use("breath","breath");assert.equal(result.status,"success",JSON.stringify(result));assert.equal(calls.length,1);assert.equal(calls[0].activity.damage.parts[0].number,10);assert.equal(calls[0].activity.damage.onSave,"half");assert.equal(calls[0].activity.save.dc.formula,"17");assert.equal(canvas.scene.regions.length,0);
 cancelPlacement=true;const count=calls.length;assert.equal((await use("breath","breath")).status,"cancelled");assert.equal(calls.length,count);
});
test("siren has no invented minute duration, repeats WIS and ignores charm immunity",async()=>{
 answers.push("yes");const result=await use("siren","siren");assert.equal(result.status,"success",JSON.stringify(result));assert.equal(item("siren").system.uses.spent,1);const e=target.actor.effects.find(e=>e.statuses.has("charmed"));assert.ok(e);assert.equal(e.duration.value,null);assert.equal(e.getFlag(MODULE_ID,"repeatSave").ability,"wis");
 const w={activity:{type:"save",flags:{[MODULE_ID]:{chimeraResolved:true,chimeraHearing:true}}},item:{system:{identifier:"chimera-siren"}},targets:new Set([{actor:target.actor,document:target}])};await target.actor.update({"system.traits.ci.value":["charmed"]});filterChimeraHearingTargets(w);assert.equal(w.targets.size,0);
});
test("same skipped Medusa end callback cannot prematurely run the final save",async()=>{
 const c=encounter(1);answers.push([target.uuid],"yes");await use("medusa","medusa");const n=calls.length;c.previous={round:1,turn:1};c.round=2;c.turn=0;c.combatant=c.turns[0];await handleChimeraTurn(c,{round:2,turn:0});await handleChimeraTurn(c,{round:2,turn:0});assert.equal(calls.length,n);assert.ok(target.actor.effects.some(e=>e.statuses.has("grappled")));
});
test("Medusa successful follow-up removes only its own grapple",async()=>{
 const c=encounter(1);answers.push([target.uuid],"yes");await use("medusa","medusa");const [manual]=await target.actor.createEmbeddedDocuments("ActiveEffect",[{name:"Manual grapple",statuses:["grappled"],system:{changes:[]}}]);c.previous={round:2,turn:1};c.round=3;c.turn=0;c.combatant=c.turns[0];saveSuccess=true;await handleChimeraTurn(c,{round:3,turn:0});assert.deepEqual(target.actor.effects,[manual]);
});
test("confirmed fire damage sets Hydra skip once per confirmed event",async()=>{
 const event={key:"chimera-fire",sceneId:canvas.scene.id,sourceActorUuid:target.actor.uuid,sourceTokenUuid:target.uuid,targetTokenUuid:source.uuid,damageTypes:["fire"]};await emitConfirmedDamage(actor,4,{[MODULE_ID]:{damageEvent:event}});await emitConfirmedDamage(actor,4,{[MODULE_ID]:{damageEvent:event}});assert.equal(chimeraState(actor).fireEpoch,1);await regenerateChimera(actor);assert.equal(actor.system.attributes.hp.value,20);await regenerateChimera(actor);assert.equal(actor.system.attributes.hp.value,30);
});
test("manual passive disabling is preserved through sync and blocks source resistance",async()=>{
 await syncChimera(actor);const e=actor.effects.find(e=>e.getFlag(MODULE_ID,"chimeraPassive")==="carapace");await e.update({disabled:true});await syncChimera(actor);const p={damageDetail:[{type:"force",value:12,active:{}}]};applySpellSourceResistance({actor},{workflow:{item:{type:"spell"}},damageItem:p});assert.equal(p.damageDetail[0].value,12);assert.equal(e.disabled,true);
});
test("diagnostics and scoped description linking do not mutate older cards or state",()=>{
 const state=JSON.stringify(actor.getFlag(MODULE_ID,"chimeraState"));const info=inspectChimera(actor);assert.equal(info.level,4);assert.equal(JSON.stringify(actor.getFlag(MODULE_ID,"chimeraState")),state);
 const older={_id:"old",name:"Old",system:{identifier:"old",description:{value:"<p>Гибридная форма и Гогот гуся.</p>"}},flags:{}};const sets=[{name:"features",documents:[...chimeraDocuments,older]},{name:"transformations",documents:chimeraTransformationDocuments}];linkDocumentDescriptions(sets);assert.equal(older.system.description.value,"<p>Гибридная форма и Гогот гуся.</p>");
});
