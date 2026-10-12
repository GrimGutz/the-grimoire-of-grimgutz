import assert from "node:assert/strict";
import {test, beforeEach} from "node:test";
import {MODULE_ID} from "../scripts/automation/shared/constants.mjs";
import {masterDocuments} from "../src/packs/master-features.mjs";
import {requestGm} from "../scripts/automation/shared/gm-requests.mjs";
import {installMasterHooks} from "../scripts/automation/classes/master-combat.mjs";
import {masterBladeBase, masterBladeTerm, replaceMasterBladeDie, offerMasterBlade, completeMasterBlade} from "../scripts/automation/classes/master-blade.mjs";

let actor, answers, docs, seq;
beforeEach(()=>{
  seq=0;answers=[];docs=new Map();
  const flags={masterConfiguration:{path:"blade",weaponType:"greatsword"}};
  actor={uuid:"Actor.master",isOwner:true,items:[],getFlag:(_m,key)=>flags[key],
    async setFlag(_m,key,value){flags[key]=structuredClone(value);}};
  actor.items=[{type:"class",system:{identifier:"master",levels:5}},
    {type:"subclass",system:{classIdentifier:"master"},flags:{[MODULE_ID]:{masterSubclass:"blade"}}},
    structuredClone(masterDocuments.find(i=>i.system.identifier==="master-path-blade"))];
  const gm={id:"gm",isGM:true},users=[];users.activeGM=gm;
  globalThis.game={user:gm,users,combats:[],modules:new Map(),settings:{get:()=>true}};
  globalThis.canvas={scene:{id:"one"}};
  globalThis.foundry={utils:{randomID:()=>`blade-${++seq}`,escapeHTML:String},applications:{api:{DialogV2:{wait:async()=>answers.shift()??null}}}};
  globalThis.CONFIG={};globalThis.ui={notifications:{warn(){},info(){}}};globalThis.fromUuid=async uuid=>docs.get(uuid);
});

function damage(values=[2,5],options={}) {
  return {class:"DamageRoll",formula:`${values.length}d6 + 5`,evaluated:true,total:values.reduce((a,b)=>a+b,5),options:{configured:true,preprocessed:true,type:"slashing",...options},
    terms:[{class:"Die",number:values.length,faces:6,modifiers:[],evaluated:true,options:{baseNumber:2,flavor:"slashing"},results:values.map(result=>({result,active:true}))},
      {class:"OperatorTerm",operator:"+",evaluated:true,options:{}},{class:"NumericTerm",number:5,evaluated:true,options:{}}]};
}
const extraDie=result=>({evaluated:true,terms:[{class:"Die",number:1,faces:6,modifiers:[],results:[{result,active:true}]}]});
function workflow(id="blade-wf") {
  const item={id:"sword",type:"weapon",actor,system:{type:{baseItem:"greatsword"},damage:{base:{number:2,denomination:6}}}};
  const activity={uuid:"Actor.master.Item.sword.Activity.attack",type:"attack",actor,item,damage:{includeBase:true}};
  const source={uuid:"Scene.one.Token.master",actor,parent:canvas.scene},target={uuid:"Scene.one.Token.enemy",actor:{uuid:"Actor.enemy"},parent:canvas.scene};
  docs.set(source.uuid,source);docs.set(target.uuid,target);docs.set(activity.uuid,activity);
  game.combats=[{id:"battle",started:true,round:1,turn:0,combatants:[{token:source},{token:target}]}]; // No combat.scene!
  return {id,actor,item,activity,token:source,attackRoll:{total:20},hitTargets:new Set([target]),damageRolls:[],
    async setDamageRolls(rolls){this.damageRolls=rolls;this.damageTotal=rolls.reduce((sum,r)=>sum+r.total,0);this.updates=(this.updates??0)+1;}};
}
function mockDice(extra=6) {
  let evaluations=0;
  const native=data=>({...structuredClone(data),toJSON(){const clone={...this};delete clone.toJSON;return clone;}});
  CONFIG.Dice={DamageRoll:{fromData:native,fromTerms(terms,options){
    const die=terms[0],value=die.results.filter(r=>r.active).reduce((sum,r)=>sum+r.result,0);
    return native({class:"DamageRoll",evaluated:true,terms,options,formula:`${die.number}d${die.faces}${die.modifiers.join("")} + 5`,total:value+5});
  }}};
  globalThis.Roll=class {constructor(formula){this.formula=formula;}async evaluate(){evaluations++;if(extra instanceof Error)throw extra;return extraDie(extra);}};
  return ()=>evaluations;
}

test("Blade path replaces the worst native weapon die: 2d6 becomes 3d6kh2 without changing the owned roll",()=>{
  const input=damage(),snapshot=structuredClone(input),base={number:2,faces:6};
  const changed=replaceMasterBladeDie(input,base,extraDie(6));
  assert.equal(changed.total,16);assert.equal(changed.terms[0].number,3);assert.deepEqual(changed.terms[0].modifiers,["kh2"]);
  assert.deepEqual(changed.terms[0].results.filter(r=>r.active).map(r=>r.result),[5,6]);
  assert.equal(changed.terms[2].number,5);assert.deepEqual(input,snapshot);
  assert.equal(replaceMasterBladeDie(input,base,extraDie(1)).total,input.total);
  assert.equal(replaceMasterBladeDie(input,base,extraDie(2)).terms[0].results.at(-1).active,false);
});

test("Blade adds only one die after native critical expansion; custom, foreign and already modified pools are manual",()=>{
  const base={number:2,faces:6},critical=damage([1,2,4,6],{isCritical:true});
  const changed=replaceMasterBladeDie(critical,base,extraDie(5));
  assert.equal(changed.terms[0].number,5);assert.deepEqual(changed.terms[0].modifiers,["kh4"]);assert.equal(changed.total,22);
  for(const patch of [{class:"PoolTerm"},{faces:8},{modifiers:["kh1"]},{options:{baseNumber:4}}]){
    const bad=damage();Object.assign(bad.terms[0],patch);assert.equal(masterBladeTerm(bad,base),null);
  }
  assert.equal(masterBladeTerm(damage([2,5],{type:"healing"}),base),null);
  const item=workflow().item;item.system.damage.base.custom={enabled:true};assert.equal(masterBladeBase(item),null);
  item.system.damage.base.custom.enabled=false;item.system.isVersatile=true;item.system.damage.versatile={number:1,denomination:10};
  assert.deepEqual(masterBladeBase(item,"twoHanded"),{number:1,faces:10});
});

test("Blade asks once, and cancelling native damage does not spend this turn's benefit",async()=>{
  const wf=workflow();answers.push("yes","yes");await Promise.all([offerMasterBlade(wf),offerMasterBlade(wf)]);
  assert.equal(answers.length,1);assert.deepEqual(actor.getFlag(MODULE_ID,"masterBladeUses").turns,[]);
  await completeMasterBlade(wf);assert.deepEqual(actor.getFlag(MODULE_ID,"masterBladeUses").turns,[]);
  const other={...wf,id:"second",grimgutzMasterBlade:null};await offerMasterBlade(other);
  assert.equal(other.grimgutzMasterBlade.approved,true);assert.equal(answers.length,0);
});

test("Blade damage applies once per turn, preserves other parts, and does not spend techniques or series",async()=>{
  const wf=workflow(),count=mockDice();answers.push("yes");await offerMasterBlade(wf);
  wf.damageRolls=[damage(),{...damage(),options:{type:"fire"}}];
  await Promise.all([completeMasterBlade(wf),completeMasterBlade(wf)]);await completeMasterBlade(wf);
  assert.equal(count(),1);assert.equal(wf.updates,1);assert.equal(wf.damageRolls[0].formula,"3d6kh2 + 5");assert.equal(wf.damageTotal,28);
  assert.deepEqual(wf.damageRolls[1].terms[0].results.map(r=>r.result),[2,5]);
  assert.deepEqual(actor.getFlag(MODULE_ID,"masterBladeUses").turns,["battle:1:0"]);
  assert.equal(actor.getFlag(MODULE_ID,"masterTechniqueUsage"),undefined);assert.equal(actor.getFlag(MODULE_ID,"masterSeries"),undefined);
  const next={...wf,id:"other",grimgutzMasterBlade:null};answers.push("yes");await offerMasterBlade(next);
  assert.equal(next.grimgutzMasterBlade.approved,false);assert.equal(answers.length,1);
  game.combats[0].turn=1;await offerMasterBlade({...next,id:"new-turn",grimgutzMasterBlade:null});assert.equal(answers.length,0);
});

test("Blade ignores misses, other weapons/paths, disabled automation and combat-free damage",async()=>{
  const wf=workflow(),hit=[...wf.hitTargets][0];answers.push("yes");wf.hitTargets.clear();await offerMasterBlade(wf);
  assert.equal(wf.grimgutzMasterBlade,undefined);wf.hitTargets.add(hit);
  wf.item.system.type.baseItem="longbow";await offerMasterBlade(wf);assert.equal(wf.grimgutzMasterBlade,undefined);
  wf.item.system.type.baseItem="greatsword";actor.items[1].flags[MODULE_ID].masterSubclass="archer";
  await offerMasterBlade(wf);assert.equal(wf.grimgutzMasterBlade,undefined);
  actor.items[1].flags[MODULE_ID].masterSubclass="blade";game.settings.get=()=>false;
  await offerMasterBlade(wf);assert.equal(wf.grimgutzMasterBlade,undefined);
  game.settings.get=()=>true;game.combats=[];await offerMasterBlade(wf);
  assert.equal(wf.grimgutzMasterBlade.approved,false);assert.equal(answers.length,1);assert.equal(actor.getFlag(MODULE_ID,"masterBladeUses"),undefined);
});

test("Blade refusal persists for the use; aborted and unsupported damage never consumes the benefit",async()=>{
  const wf=workflow();answers.push("no","yes");await offerMasterBlade(wf);
  await offerMasterBlade({...wf,grimgutzMasterBlade:null});assert.equal(answers.length,1);
  const accepted={...wf,id:"accepted",grimgutzMasterBlade:null};await offerMasterBlade(accepted);
  accepted.damageRolls=[damage()];accepted.aborted=true;await completeMasterBlade(accepted);
  assert.deepEqual(actor.getFlag(MODULE_ID,"masterBladeUses").turns,[]);
  accepted.aborted=false;accepted.damageRolls[0].terms[0].modifiers=["kh1"];await completeMasterBlade(accepted);
  assert.deepEqual(actor.getFlag(MODULE_ID,"masterBladeUses").turns,[]);
});

test("Blade serializes competing workflows, replays receipts without reroll and preserves the turn snapshot",async()=>{
  const wf=workflow(),count=mockDice();answers.push("yes","yes");await offerMasterBlade(wf);
  const other={...wf,id:"competing",grimgutzMasterBlade:null};await offerMasterBlade(other);
  wf.damageRolls=[damage()];other.damageRolls=[damage()];game.combats[0].turn=1;
  await Promise.all([completeMasterBlade(wf),completeMasterBlade(other)]);
  assert.equal(count(),1);assert.deepEqual(actor.getFlag(MODULE_ID,"masterBladeUses").turns,["battle:1:0"]);
  assert.equal((await requestGm("master-blade-complete",actor,{workflowId:wf.id,rolls:[damage()]})).status,"success");assert.equal(count(),1);
  assert.equal((await requestGm("master-blade-complete",actor,{workflowId:wf.id,rolls:[damage([6,6])]})).status,"needs-review");assert.equal(count(),1);
});

test("Blade die failures retain a review receipt and cannot silently apply unmodified damage",async()=>{
  const wf=workflow();mockDice(new Error("dice unavailable"));answers.push("yes");await offerMasterBlade(wf);wf.damageRolls=[damage()];
  await completeMasterBlade(wf);assert.equal(wf.aborted,true);
  assert.equal(actor.getFlag(MODULE_ID,"masterBladeUses").offers[0].status,"needs-review");
  wf.aborted=false;await completeMasterBlade(wf);assert.equal(wf.aborted,true);assert.equal(wf.updates,undefined);
});

test("installed Master hooks await the Blade decision and completion instead of synchronous native hooks",async()=>{
  const handlers=new Map();globalThis.Hooks={on:(name,callback)=>handlers.set(name,callback)};installMasterHooks();
  assert.equal(typeof handlers.get("midi-qol.preDamageRoll"),"function");assert.equal(typeof handlers.get("midi-qol.DamageRollComplete"),"function");
  const wf=workflow();mockDice();answers.push("yes");await handlers.get("midi-qol.preDamageRoll")(wf);
  wf.damageRolls=[damage()];await handlers.get("midi-qol.DamageRollComplete")(wf);assert.equal(wf.damageRolls[0].total,16);
});

test("card-free Midi workflows do not reuse an activity UUID receipt on the next turn or GM's viewed scene",async()=>{
  const wf=workflow(),count=mockDice();wf.id=wf.activity.uuid;answers.push("yes","yes");
  canvas.scene={id:"different-gm-scene"};await offerMasterBlade(wf);wf.damageRolls=[damage()];await completeMasterBlade(wf);
  const next={...wf,grimgutzMasterBlade:null,damageRolls:[damage()],updates:0};game.combats[0].turn=1;
  await offerMasterBlade(next);await completeMasterBlade(next);
  assert.notEqual(wf.grimgutzMasterBlade.workflowId,next.grimgutzMasterBlade.workflowId);assert.equal(count(),2);
  assert.equal(next.damageRolls[0].total,16);assert.equal(next.updates,1);
});

test("Blade compares clamped die values without removing their modifiers or rerolled inactive results",()=>{
  const original=damage([1,5]);original.total=13;original.terms[0].modifiers=["min3"];
  original.terms[0].results[0].count=3;original.terms[0].results.unshift({result:1,active:false,rerolled:true});
  const bonus=extraDie(2);bonus.terms[0].results[0].count=3;
  const changed=replaceMasterBladeDie(original,{number:2,faces:6},bonus);
  assert.equal(changed.total,13);assert.deepEqual(changed.terms[0].modifiers,["min3","kh2"]);
  assert.equal(changed.terms[0].results[0].rerolled,true);assert.equal(changed.terms[0].results.at(-1).discarded,true);
});
