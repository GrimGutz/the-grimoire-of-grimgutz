import assert from "node:assert/strict";
import {test,beforeEach} from "node:test";
import {MODULE_ID,SETTINGS} from "../scripts/automation/shared/constants.mjs";
import {BROODMOTHER_FEATURES,broodmotherUnlockedTier} from "../scripts/automation/shared/broodmother-definitions.mjs";
import {broodmotherDocuments} from "../src/packs/broodmother-features.mjs";
import {broodmotherTransformationDocuments} from "../src/packs/broodmother-transformation.mjs";
import {broodmotherText} from "../src/broodmother-data.mjs";
import {broodmotherState,broodmotherHas,broodmotherDC,broodmotherTransformationLevel,broodmotherPassiveDefinitions,syncBroodmother,broodmotherPrerequisiteFailures,validateBroodmotherItem,validateBroodmotherAdvancement,inspectBroodmother} from "../scripts/automation/transformations/broodmother.mjs";
import {controlBroodmother} from "../scripts/automation/transformations/broodmother-actions.mjs";
import {broodmotherRecipe,broodmotherHitDice,broodmotherChildren} from "../scripts/automation/transformations/broodmother-summons.mjs";
import {broodmotherAttackData,prepareBroodmotherSpell,prepareBroodmotherSpellSave,prepareBroodmotherPoisonSave,applyBroodmotherToxicDamage} from "../scripts/automation/transformations/broodmother-combat.mjs";
import {broodmotherAreaData,broodmotherPoolCenter} from "../scripts/automation/transformations/broodmother-zones.mjs";
import {broodmotherCondition} from "../scripts/automation/transformations/broodmother-use.mjs";
import {rechargeBroodmotherWeb,revealBroodmother,enhanceBroodmotherPoison,observeBroodmotherMimic,handleBroodmotherTurn,captureBroodmotherMovement,applyBroodmotherMovement,installBroodmotherHooks} from "../scripts/automation/transformations/broodmother-events.mjs";
import {requestGm} from "../scripts/automation/shared/gm-requests.mjs";
import {emitConfirmedDamage} from "../scripts/automation/shared/damage-events.mjs";
import {processRepeatedSaves} from "../scripts/automation/effects/repeated-saves.mjs";
import {linkDocumentDescriptions} from "../tools/link-descriptions.mjs";
let actor,source,target,base,docs,answers,prompts,calls,messages,hooks,seq,nativeMode,saveSuccess,rollTotal,cancelPlacement,createFails;
function merge(raw,updates){const out=structuredClone(raw);for(const [key,value]of Object.entries(updates)){if(key.includes(".")){const parts=key.split("."),last=parts.pop();let obj=out;for(const part of parts)obj=obj[part]??={};if(last.startsWith("-="))delete obj[last.slice(2)];else obj[last]=structuredClone(value);}
  else if(value&&typeof value==="object"&&!Array.isArray(value))out[key]=merge(out[key]??{},value);else out[key]=structuredClone(value);}return out;}
const property=(o,path)=>path.split(".").reduce((v,k)=>v?.[k],o);
function owned(data,owner,register=true){let raw=structuredClone(data);raw._id??=`item${++seq}`;const item={id:raw._id,actor:owner,parent:owner,isEmbedded:true,uuid:`${owner.uuid}.Item.${raw._id}`,toObject:()=>structuredClone(raw),getFlag:(m,k)=>raw.flags?.[m]?.[k],
  clone:(updates,options={})=>owned(merge(raw,updates),options.parent??owner,false),async update(updates){raw=merge(raw,updates);refresh();owner.prepare();return this;}};
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

function makeActor(level=16,id="queen",features=true){
 const a=entity({name:id,type:features?"character":"npc",system:{attributes:{prof:5,hp:{value:20,max:60,temp:0,tempmax:0},movement:{walk:30,climb:0,units:"ft"},senses:{darkvision:60},ac:{flat:14,value:14,shield:0,bonus:0},concentration:{limit:1},exhaustion:0},details:{type:{value:features?"humanoid":"beast"},cr:1},traits:{size:"lg",ci:{value:[]},di:{value:[]},dr:{value:[]}},abilities:Object.fromEntries(["str","dex","con","int","wis","cha"].map(k=>[k,{value:18,max:null}]))}},id);
 if(features)a.items.push(owned({name:"Fighter",type:"class",system:{identifier:"fighter",levels:level,hd:{denomination:"d10",max:level,value:level,spent:0}}},a),...broodmotherTransformationDocuments.map(d=>owned(d,a)),...broodmotherDocuments.map(d=>owned(d,a)));
 return a;
}
const item=id=>actor.items.find(i=>i.system.identifier===`broodmother-${id}`),act=(id,op)=>[...item(id).system.activities.values()].find(a=>!op||a.flags?.[MODULE_ID]?.broodmotherOperation===op);
const use=(id,op,requestId=`u${++seq}`)=>requestGm("broodmother-action",actor,{activityUuid:act(id,op).uuid,sourceUuid:source.uuid},{requestId});
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
  if(cost.type==="hitDice"){let n=Number(cost.value);for(const row of broodmotherHitDice(activity.actor)){const spent=Math.min(n,row.remaining);if(spent)await row.item.update({"system.hd.spent":row.spent+spent,"system.hd.value":row.remaining-spent});n-=spent;if(!n)break;}if(n)return false;}
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
 globalThis.CONFIG={DND5E:{maxAbilityScore:20},ActiveEffect:{documentClass:{getEffectStart:()=>({time:game.time.worldTime})}}};globalThis.ui={notifications:{warn(){},info(){}}};globalThis.fromUuid=async uuid=>docs.get(uuid);
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
test("fourteen boons, four flaws, complete source descriptions, cumulative advancement",()=>{
 assert.equal(broodmotherDocuments.length,18);assert.equal(BROODMOTHER_FEATURES.filter(e=>e.flaw).length,4);
 for(const e of BROODMOTHER_FEATURES){const d=broodmotherDocuments.find(d=>d.system.identifier===e.key);assert.ok(d.system.description.value.includes(broodmotherText[e.id].split("\n")[0]));assert.equal(d.effects.length,0);}
 assert.deepEqual(broodmotherTransformationDocuments[0].system.advancement.filter(a=>a.type==="ItemChoice").map(a=>a.configuration.pool.length),[4,8,12]);
});
test("tier boundaries and DC use total levels but never add tier to CON DC",()=>{
 for(const n of [1,5,6,10,11,15,16,20]){actor.items.find(i=>i.type==="class").system.levels=n;assert.equal(broodmotherTransformationLevel(actor),broodmotherUnlockedTier(n));}
 assert.equal(broodmotherDC(actor),17);actor.items=actor.items.filter(i=>i.type==="class"||i.system.identifier==="broodmother-transformation");assert.equal(broodmotherTransformationLevel(actor),1);
});
test("numeric entry requires ten levels in one class, not a split five plus five",()=>{
 actor.items.find(i=>i.type==="class").system.levels=5;actor.items.push({type:"class",system:{levels:5}});assert.ok(broodmotherPrerequisiteFailures(actor).includes("не менее 10 уровней в одном классе"));
 game.settings.get=()=>true;assert.equal(validateBroodmotherItem({...broodmotherTransformationDocuments[0],parent:actor},null,null,"gm"),false);
});
test("form caps CON and DEX at20, preserves higher natural values and manual disabled passive",async()=>{
 await syncBroodmother(actor);assert.equal(actor.system.abilities.con.value,20);assert.equal(actor.system.abilities.dex.value,20);await syncBroodmother(actor);assert.equal(actor.system.abilities.con.value,20);
 await actor.update({"system.abilities.con.value":24});await syncBroodmother(actor);assert.equal(actor.system.abilities.con.value,24);
 const effect=actor.effects.find(e=>e.getFlag(MODULE_ID,"broodmotherPassive")==="form");await effect.update({disabled:true});await syncBroodmother(actor);assert.equal(effect.disabled,true);
});
test("spider uses native upgrade AC/climb, does not lower better armor or grant constant disadvantage",()=>{
 const defs=broodmotherPassiveDefinitions(actor);assert.equal(defs.length,2);const spider=defs.find(d=>d.flags[MODULE_ID].broodmotherPassive==="spider");assert.ok(spider.system.changes.every(c=>c.type==="upgrade"));assert.equal(defs.some(d=>d.name==="Боязнь огня"),false);
});
test("prerequisites and duplicate boons are checked at advancement",()=>{
 const data=item("spinner").toObject();actor.items=actor.items.filter(i=>i.system.identifier!=="broodmother-web"&&i.system.identifier!=="broodmother-spinner");assert.equal(validateBroodmotherAdvancement({actor},{},[data],[],[]),false);
 const duplicate=item("quill").toObject();assert.equal(validateBroodmotherAdvancement({actor},{},[duplicate],[],[]),false);
});
test("summon snapshot sets small size, DC, greater brood and stacking matriarch upgrades",()=>{
 const recipe=broodmotherRecipe(actor,base,{upgrades:{hp:2,size:1,speed:1,attack:2}});assert.equal(recipe.size,"med");assert.equal(recipe.hp,76);assert.equal(recipe.snapshot.attacks,3);assert.equal(recipe.snapshot.dc,17);assert.equal(recipe.movement.walk,40);
 const attackData=recipe.extraItems[0].system;assert.equal(attackData.damage.base.number,2);assert.equal(attackData.damage.base.bonus,"4");assert.equal(attackData.activities.test.attack.bonus,"5 + 4");assert.equal(base.items[0].system.damage.base.number,1);
});
test("without Greater Brood old-tier recipe has no blanket poison/attack bonus",()=>{
 actor.items.find(i=>i.type==="class").system.levels=6;const recipe=broodmotherRecipe(actor,base);assert.equal(recipe.size,"sm");assert.equal(recipe.extraItems[0].system.activities.test.attack.bonus,"5");assert.equal(recipe.lifecycle,undefined);
});
test("canceling matriarch upgrade selection spends no hit dice and creates no actor",async()=>{
 answers.push(null);assert.equal((await use("brood","brood")).status,"cancelled");assert.equal(broodmotherHitDice(actor)[0].spent,0);assert.equal(broodmotherChildren(actor).length,0);
});
test("brood native hit-dice consumption creates one correctly scoped creature and cannot replay",async()=>{
 answers.push(0,0,0,0,base.uuid,"yes");assert.equal((await use("brood","brood","brood-once")).status,"success");assert.equal(broodmotherHitDice(actor)[0].spent,2);assert.equal(broodmotherChildren(actor).length,1);
 await use("brood","brood","brood-once");assert.equal(broodmotherHitDice(actor)[0].spent,2);assert.equal(broodmotherChildren(actor).length,1);
});
test("confirmed summon creation failure refunds only the confirmed unchanged hit dice",async()=>{
 createFails=true;answers.push(0,0,0,0,base.uuid,"yes");assert.equal((await use("brood","brood")).status,"needs-review");assert.equal(broodmotherHitDice(actor)[0].spent,0);
});
test("native cancel never creates a brood or consumes hit dice",async()=>{
 nativeMode=false;answers.push(0,0,0,0,base.uuid,"yes");assert.equal((await use("brood","brood")).status,"cancelled");assert.equal(broodmotherChildren(actor).length,0);
});
test("quill and legs are native attack substitutions with separate correct damage types",()=>{
 const quill=broodmotherAttackData(act("quill"),"quill");assert.equal(quill.activation.type,"special");assert.equal(quill.attack.bonus,"9");assert.deepEqual(quill.damage.parts.map(p=>p.types),[["piercing"],["poison"]]);assert.equal(quill.damage.parts[0].bonus,"");
 const legs=broodmotherAttackData(act("spider","legs"),"legs");assert.equal(legs.attack.type.classification,"unarmed");assert.equal(legs.damage.parts[0].bonus,"+ 4");
});
test("quill hit creates timed poison+paralysis and exactly one repeat-save handler",async()=>{
 answers.push([target.uuid],"yes");assert.equal((await use("quill")).status,"success");assert.equal(calls.length,2);const effect=target.actor.effects[0];assert.ok(effect.statuses.has("poisoned"));assert.ok(effect.statuses.has("paralyzed"));assert.equal(effect.duration.units,"seconds");assert.equal(effect.duration.value,60);assert.equal(effect.getFlag(MODULE_ID,"repeatSave").event,"turnEnd");
});
test("successful quill save creates no poisoned state",async()=>{
 saveSuccess=true;answers.push([target.uuid],"yes");await use("quill");assert.equal(target.actor.effects.length,0);
});
test("Toxicologist advantage applies only to its poison saves, not all CON saves",()=>{
 target.actor.system.traits.ci.value=new Set(["poisoned"]);const normal={};prepareBroodmotherPoisonSave({actor:target.actor},{actor,activity:{flags:{}}},normal);assert.equal(normal.advantage,undefined);
 const poison={};prepareBroodmotherPoisonSave({actor:target.actor},{actor,activity:{flags:{[MODULE_ID]:{broodmotherPoison:true}}}},poison);assert.equal(poison.advantage,true);
});
test("Toxicologist recalculates raw poison alone, ignores resistance, downgrades immunity, never doubles",()=>{
 target.actor.system.traits.di.value=new Set(["poison"]);target.actor.calculateDamage=(parts,options)=>{assert.ok(options.ignore.immunity.has("poison"));assert.ok(options.ignore.resistance.has("poison"));return parts.map(p=>({...p,active:{}}));};
 const packet={damageDetail:[{type:"poison",value:0,active:{immunity:true}},{type:"fire",value:3}],rawDamageDetail:[{type:"poison",value:9},{type:"fire",value:6}]};
 applyBroodmotherToxicDamage({actor:target.actor},{workflow:{actor},damageItem:packet});assert.deepEqual(packet.damageDetail.map(p=>[p.type,p.value]),[["fire",3],["poison",4]]);applyBroodmotherToxicDamage({actor:target.actor},{workflow:{actor},damageItem:packet});assert.equal(packet.totalDamage,7);
});
test("blood poison has no invented minute or recurring save and gets linked paralysis",async()=>{
 await broodmotherCondition(source,target,item("blood"),{kind:"blood-poison",statuses:["poisoned"]});const e=target.actor.effects[0];assert.equal(e.duration.value,null);assert.equal(e.getFlag(MODULE_ID,"repeatSave"),undefined);assert.ok(e.statuses.has("paralyzed"));
});
test("ordinary immunity blocks poison without Toxicologist, no permanent immunity removal",async()=>{
 actor.items=actor.items.filter(i=>i.system.identifier!=="broodmother-toxicologist");target.actor.system.traits.ci.value=new Set(["poisoned"]);assert.equal(await broodmotherCondition(source,target,item("quill"),{kind:"poison",statuses:["poisoned"]}),false);assert.equal(target.actor.effects.length,0);assert.ok(target.actor.system.traits.ci.value.has("poisoned"));
});
test("web native area uses STR, line60x4, height20 and no invented six-second lifetime",()=>{
 const {data,spec}=broodmotherAreaData(act("web","web"),source,"web");assert.equal(data.save.ability[0],"str");assert.equal(data.target.template.size,"60");assert.equal(data.target.template.width,"4");assert.equal(data.target.template.height,"20");assert.equal(spec.templateSeconds,null);assert.equal(data.consumption.targets[0].value,"1");assert.equal(data.damage.parts.length,0);
});
test("web placement and save create restrained state and one six-section wall",async()=>{
 answers.push("yes");assert.equal((await use("web","web")).status,"success");assert.equal(item("web").system.uses.spent,1);assert.ok(target.actor.effects[0].statuses.has("restrained"));assert.equal(canvas.scene.regions[0].getFlag(MODULE_ID,"broodmotherWall").sections.length,6);assert.equal(canvas.scene.regions[0].getFlag(MODULE_ID,"zoneExpiresAt"),null);
});
test("canceling web placement spends no action/resource and adds no condition",async()=>{
 cancelPlacement=true;answers.push("yes");assert.equal((await use("web","web")).status,"cancelled");assert.equal(item("web").system.uses.spent,0);assert.equal(calls.length,0);assert.equal(target.actor.effects.length,0);
});
test("web recharges only on a six, not automatically each turn/rest",async()=>{
 await item("web").update({"system.uses.spent":1});rollTotal=5;await rechargeBroodmotherWeb(actor);assert.equal(item("web").system.uses.spent,1);rollTotal=6;await rechargeBroodmotherWeb(actor);assert.equal(item("web").system.uses.spent,0);
});
test("same combat update without combat.scene rolls web recharge just once",async()=>{
 await item("web").update({"system.uses.spent":1});const c=encounter();rollTotal=2;await handleBroodmotherTurn(c,{turn:0});await handleBroodmotherTurn(c,{turn:0});assert.equal(messages.filter(m=>m.formula==="1d6").length,1);
});
test("acid line coats but does not damage immediately, creates radius7.5 pool and turn limit",async()=>{
 encounter();answers.push("yes");assert.equal((await use("bile")).status,"success");assert.equal(calls[0].activity.damage.parts.length,0);assert.equal(target.actor.effects[0].getFlag(MODULE_ID,"broodmotherCondition").damage,"4d6");
 const pool=canvas.scene.regions[0];assert.equal(pool.shapes[0].radius,150);await assert.rejects(()=>use("bile"),/уже использована/);
});
test("pool endpoint is the distant edge of the line, not its midpoint",()=>{
 assert.deepEqual(broodmotherPoolCenter(region(),source),{x:650,y:40});
});
test("coating damage starts on the target turn and uses saved transformation tier",async()=>{
 await broodmotherCondition(source,target,item("bile"),{kind:"acid",extra:{damage:"3d6"}});const c=encounter(1);await handleBroodmotherTurn(c,{turn:1});assert.equal(calls.at(-1).activity.damage.parts[0].number,3);assert.equal(calls.at(-1).activity.damage.parts[0].types[0],"acid");
});
test("off-scene acid turn queues event instead of retroactive automatic damage",async()=>{
 await broodmotherCondition(source,target,item("bile"),{kind:"acid",extra:{damage:"3d6"}});const c=encounter(1);canvas.scene={id:"elsewhere"};await handleBroodmotherTurn(c,{turn:1});assert.equal(calls.length,0);assert.equal(game.journal[0].getFlag(MODULE_ID,"events")[0].state,"queued");
});
test("player-side movement snapshot lets active GM apply acid only on entry and deduplicate",async()=>{
 const pool=region({shapes:[{type:"circle",x:450,y:50,radius:100}],flags:{[MODULE_ID]:{broodmotherPool:{sourceTokenUuid:source.uuid,sourceItemUuid:item("bile").uuid}}}}),options={};
 captureBroodmotherMovement(target,{x:400},options);await target.update({x:400});await applyBroodmotherMovement(target,{x:400},options);assert.equal(calls.length,1);await applyBroodmotherMovement(target,{x:400},options);assert.equal(calls.length,1);
});
test("revealing appearance never changes NPC disposition, consciousness and concentration reveal",async()=>{
 await actor.setFlag(MODULE_ID,"broodmotherState",{appearance:"humanoid"});actor.statuses.add("unconscious");await revealBroodmother(actor);assert.equal(broodmotherState(actor).appearance,"true");assert.equal(target.disposition,1);
});
test("existing native poison effect gains paralysis only if source is known Toxicologist",async()=>{
 const [e]=await target.actor.createEmbeddedDocuments("ActiveEffect",[{name:"Poison",origin:item("quill").uuid,statuses:["poisoned"],system:{changes:[]},duration:{value:60,units:"seconds"}}]);await enhanceBroodmotherPoison(e);assert.ok(e.statuses.has("paralyzed"));assert.equal(e.duration.value,60);
});
test("Arachnomancy cancel never kills child, acceptance binds one target for one spell",async()=>{
 const child=makeActor(1,"child",false);game.actors.push(child);await child.update({[`flags.${MODULE_ID}.summonedBy`]:actor.uuid,[`flags.${MODULE_ID}.summonSource`]:"broodmother-brood"});
 const spell=attack(actor,{spell:true}),w={id:"arach",actor,item:spell.item,activity:spell,targets:new Set([{document:target,actor:target.actor}]),attackRollModifierTracker:{advantage:{add:(...v)=>messages.push(v)}}};
 answers.push("no");await prepareBroodmotherSpell({...w,id:"decline"});assert.equal(child.system.attributes.hp.value,20);
 answers.push("yes",child.uuid,target.uuid);await prepareBroodmotherSpell(w);assert.equal(child.system.attributes.hp.value,0);assert.equal(w.grimgutzBroodmotherSpell.targetUuid,target.uuid);const count=prompts.length;await prepareBroodmotherSpell(w);assert.equal(prompts.length,count);
});
test("Arachnomancy saving-throw disadvantage never affects an unchosen target",()=>{
 const workflow={grimgutzBroodmotherSpell:{mode:"save",targetUuid:target.uuid}},yes={},no={};prepareBroodmotherSpellSave({document:target},workflow,yes);prepareBroodmotherSpellSave({document:source},workflow,no);assert.equal(yes.disadvantage,true);assert.equal(no.disadvantage,undefined);
});
test("damage by ranged attack does not trigger venomous blood",async()=>{
 const a=attack(target.actor,{type:"ranged"});await emitConfirmedDamage(actor,5,{[MODULE_ID]:{damageEvent:{key:"ranged-blood",sceneId:canvas.scene.id,sourceActorUuid:target.actor.uuid,sourceTokenUuid:target.uuid,targetTokenUuid:source.uuid,activityUuid:a.uuid,damageTypes:["piercing"]}}});assert.equal(calls.length,0);
});
test("pyrophobia waits for actual fire damage, ends at sourceEnd without invented duration",async()=>{
 encounter();await emitConfirmedDamage(actor,5,{[MODULE_ID]:{damageEvent:{key:"fire-pyro",sceneId:canvas.scene.id,sourceActorUuid:target.actor.uuid,sourceTokenUuid:target.uuid,targetTokenUuid:source.uuid,damageTypes:["fire"]}}});
 assert.equal(broodmotherState(actor).appearance,"true");const e=actor.effects.find(e=>e.getFlag(MODULE_ID,"combatBenefit"));assert.equal(e.getFlag(MODULE_ID,"combatBenefit").expiry,"sourceEnd");assert.equal(e.duration.value,null);
});
test("contempt asks GM about witnessed death and does not reset counter or spend action",async()=>{
 answers.push("yes",[target.uuid]);assert.equal((await use("contempt")).status,"success");assert.equal(broodmotherState(actor).witnessedDeaths,1);const e=actor.effects.find(e=>e.getFlag(MODULE_ID,"broodmotherCondition")?.kind==="rage");assert.equal(e.getFlag(MODULE_ID,"repeatSave").dc,19);assert.equal(e.getFlag(MODULE_ID,"repeatSave").event,"turnEnd");assert.equal(calls[0].activity.activation.type,"special");
});
test("mimic is explicitly linked to a GM prepared body, never silently copies player inventory",async()=>{
 answers.push("yes",[target.uuid]);await use("mimic","mimic");assert.equal(broodmotherState(actor).mimicControl,true);assert.equal(broodmotherState(actor).mimicActorUuid,target.actor.uuid);assert.equal(game.actors.length,3);
 await target.actor.update({"system.attributes.hp.value":0});await observeBroodmotherMimic(target.actor);assert.equal(broodmotherState(actor).mimicControl,false);assert.equal(actor.effects.some(e=>e.getFlag(MODULE_ID,"broodmotherMimicBody")),false);
});
test("horror rolls days of cooldown, never a one-in-four chance, and blocks reuse until elapsed",async()=>{
 await assert.rejects(()=>use("horror"),/0 хитов/);await actor.update({"system.attributes.hp.value":0});answers.push("yes",base.uuid,"yes");rollTotal=2;await use("horror");assert.equal(messages.filter(m=>m.formula==="1d4").length,1);assert.equal(broodmotherChildren(actor).length,5);
 assert.equal(broodmotherState(actor).horrorReadyAt,2*86400);await assert.rejects(()=>use("horror"),/1к4 игровых/);
 game.time.worldTime=2*86400;answers.push("no");assert.equal((await use("horror")).status,"cancelled");
});
test("diagnostics stay read-only and actual hook registrations exist",()=>{
 const before=actor.toObject();assert.equal(inspectBroodmother(actor).level,4);assert.deepEqual(actor.toObject(),before);assert.equal(game.journal.length,0);installBroodmotherHooks();for(const k of ["dnd5e.preUseActivity","midi-qol.prePreambleComplete","midi-qol.preTargetSave","updateCombat","preUpdateToken","updateToken"])assert.ok(hooks.has(k));
});
test("summons preserve native damage/condition immunities, swarm subtype and metric movement",()=>{
 base.system.traits.di.value=new Set(["poison"]);base.system.traits.dr.value=new Set(["slashing"]);base.system.details.type.swarm="tiny";base.system.attributes.movement={walk:9,units:"m"};
 const r=broodmotherRecipe(actor,base,{swarm:true,upgrades:{speed:1}});assert.deepEqual(r.di.value,["poison"]);assert.deepEqual(r.dr.value,["slashing"]);assert.equal(r.swarm,"tiny");assert.equal(r.movement.units,"m");assert.ok(Math.abs(r.movement.walk-12.048)<0.001);
});
test("Toxicologist rechecks a rebuilt raw poison packet without multiplying an old reduction",()=>{
 target.actor.system.traits.di.value=new Set(["poison"]);target.actor.calculateDamage=rows=>rows.map(p=>({...p,active:{}}));
 const packet={damageDetail:[{type:"poison",value:0,active:{immunity:true}}],rawDamageDetail:[{type:"poison",value:9}]};
 applyBroodmotherToxicDamage({actor:target.actor},{workflow:{actor},damageItem:packet});assert.equal(packet.damageDetail[0].value,4);
 packet.rawDamageDetail=[{type:"poison",value:13}];packet.damageDetail=[{type:"poison",value:0,active:{immunity:true}}];
 applyBroodmotherToxicDamage({actor:target.actor},{workflow:{actor},damageItem:packet});assert.equal(packet.damageDetail[0].value,6);
});
test("horror one-day recovery creates exactly PB hour-long swarms beyond ten feet, including multiple batches",async()=>{
 await actor.update({"system.attributes.hp.value":0});answers.push("yes",base.uuid,"yes");rollTotal=1;assert.equal((await use("horror")).status,"success");
 const children=broodmotherChildren(actor);assert.equal(children.length,5);assert.ok(children.every(a=>a.getFlag(MODULE_ID,"summonLifecycle").seconds===3600));
 const tokens=canvas.scene.tokens.filter(t=>children.some(a=>a.id===t.actorId));assert.equal(tokens.length,5);assert.ok(tokens.every(t=>t.x>=300));
});
test("non-authoritative GM cannot repeat web recharge or acid event",async()=>{
 await item("web").update({"system.uses.spent":1});game.user={id:"second-gm",isGM:true,active:true};const c=encounter();await handleBroodmotherTurn(c,{turn:0});assert.equal(messages.length,0);
});
test("confirmed horror group failure rolls back created documents and its unchanged cooldown",async()=>{
 await actor.update({"system.attributes.hp.value":0});answers.push("yes",base.uuid,"yes");rollTotal=2;createFails=true;
 assert.equal((await use("horror")).status,"needs-review");assert.equal(broodmotherChildren(actor).length,0);assert.equal(Number(broodmotherState(actor).horrorReadyAt??0),0);
});
