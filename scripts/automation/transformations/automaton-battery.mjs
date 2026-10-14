import {MODULE_ID} from "../shared/constants.mjs";
import {automatonState,automatonTransformationLevel} from "./automaton.mjs";
import {askOwner} from "../shared/owner-prompts.mjs";
import {automatonGm,confirmAutomatonGm} from "./automaton-use.mjs";
import {applyNativeOnce} from "../shared/native-applications.mjs";

export const automatonBatteryUsed=actor=>(automatonState(actor).battery??[]).reduce((n,row)=>n+Number(row.level),0);
export function freezeAutomatonCasterFormulas(value,rollData){
  if(Array.isArray(value))return value.map(row=>freezeAutomatonCasterFormulas(row,rollData));
  if(!value||typeof value!=="object")return value;
  return Object.fromEntries(Object.entries(value).map(([key,row])=>[key,typeof row==="string"&&["formula","bonus"].includes(key)?row.replace(/@([\w.]+)/g,(whole,path)=>{
    if(/^(?:scaling|item|spellLevel)(?:\.|$)/.test(path))return whole;
    const n=path.split(".").reduce((o,k)=>o?.[k],rollData);return typeof n==="number"&&Number.isFinite(n)?String(n):whole;
  }):freezeAutomatonCasterFormulas(row,rollData)]));
}
export async function storeAutomatonSpell(actor,activity,requestId){
  const capacity=automatonTransformationLevel(actor)-automatonBatteryUsed(actor);if(capacity<=0)throw Error("Дуговая батарея заполнена.");
  const spells=[...(game.actors??[]),actor].flatMap(a=>[...(a.items??[])].filter(i=>i.type==="spell"&&Number(i.system.level)>0&&Number(i.system.level)<=capacity));
  const unique=[...new Map(spells.map(i=>[i.uuid,i])).values()];
  const uuid=await askOwner(automatonGm(actor),{title:"GM: исходное заклинание для батареи",choices:unique.map(i=>[i.uuid,`${i.actor?.name}: ${i.name}`])}),spell=unique.find(i=>i.uuid===uuid);if(!spell)return false;
  const level=await askOwner(automatonGm(actor),{kind:"number",title:"Уровень вложенной ячейки",min:Number(spell.system.level),max:capacity,defaultValue:Number(spell.system.level)});
  if(!Number.isInteger(level)||level<Number(spell.system.level)||level>capacity)return false;
  if(!await confirmAutomatonGm(actor,"Загрузка батареи","Подтверждены исходное применение, расход ячейки и допустимость загрузки? Способ загрузки PDF не задаёт. Чужие ресурсы модуль не меняет."))return false;
  const original=spell.toObject(),caster=spell.actor,ability=spell.system.ability||caster.system.attributes.spellcasting;
  const dc=Number(spell.system.save?.dc??caster.system.attributes.spelldc),attackBonus=Number(caster.system.attributes.prof)+Number(caster.system.abilities[ability]?.mod??0);
  if(!Number.isFinite(dc)||!Number.isFinite(attackBonus))throw Error("Не удалось определить исходные СЛ/бонус: задайте их на исходном заклинателе.");
  const native=freezeAutomatonCasterFormulas(structuredClone(original),spell.getRollData?.()??caster.getRollData());delete native._id;delete native._stats;delete native.folder;
  // D&D5e uses spellLevel for fixed-level scroll-like casts, including on actors
  // without spell slots. A numeric spell.slot is not a valid slot pool key.
  native.name=`Дуговая батарея: ${spell.name}`;native.flags={dnd5e:{spellLevel:{base:Number(spell.system.level),value:level}},[MODULE_ID]:{automatonBatterySpell:true}};
  native.system.uses={max:"1",spent:0,recovery:[]};
  for(const row of Object.values(native.system.activities??{})){
    row.activation={...row.activation,type:"action",value:1,override:true};row.consumption={spellSlot:false,targets:[{type:"itemUses",target:"",value:"1"}]};
    row.flags={[MODULE_ID]:{automatonResolved:true}};
    if(row.save)row.save.dc={calculation:"",formula:String(dc)};
    if(row.attack)Object.assign(row.attack,{flat:true,bonus:String(attackBonus),ability:""});
  }
  return applyNativeOnce(actor,{requestId,action:"automaton-battery-store",activityUuid:activity.uuid},async()=>true,async()=>{
    const [item]=await actor.createEmbeddedDocuments("Item",[native]);if(!item)throw Error("Копия заклинания не создана.");
    await actor.setFlag(MODULE_ID,"automatonState",{...structuredClone(automatonState(actor)),battery:[...(automatonState(actor).battery??[]),{id:item.id,uuid:item.uuid,sourceUuid:spell.uuid,casterUuid:caster.uuid,name:spell.name,level,ability,dc,attackBonus,locked:false}]});return true;
  });
}
export async function castAutomatonSpell(actor,activity,requestId){
  const rows=automatonState(actor).battery??[],id=await askOwner(actor,{title:"Выпустить заклинание батареи",choices:rows.filter(r=>!r.locked).map(r=>[r.id,`${r.name} (${r.level})`])}),row=rows.find(r=>r.id===id);
  if(!row||row.locked)return false;const item=[...(actor.items??[])].find(i=>i.id===id&&i.getFlag?.(MODULE_ID,"automatonBatterySpell"));if(!item)throw Error("Связанная карточка удалена; проверьте хранилище вручную.");
  const candidates=[...item.system.activities.values()];const selected=candidates.length===1?candidates[0].id:await askOwner(actor,{title:item.name,choices:candidates.map(a=>[a.id,a.name])});
  const chosen=candidates.find(a=>a.id===selected);if(!chosen)return false;
  // The card is locked before any native dialog. Unknown/partial results must
  // not produce a second cast; a GM can review the receipt rather than retry.
  return applyNativeOnce(actor,{requestId,action:"automaton-battery-cast",activityUuid:activity.uuid},async()=>{
    await actor.setFlag(MODULE_ID,"automatonState",{...structuredClone(automatonState(actor)),battery:rows.map(r=>r.id===id?{...r,locked:true}:r)});
    const original=chosen.toObject();original.flags={[MODULE_ID]:{automatonResolved:true,automatonBatteryRelease:true,action:""}};
    original.consumption={spellSlot:false,targets:[{type:"itemUses",target:item.id,value:"1"}]};
    const clone=item.clone({system:{activities:{[chosen.id]:original}}},{keepId:true});
    const result=await MidiQOL.completeActivityUse(clone.system.activities.get(chosen.id),{scaling:false,consume:{spellSlot:false},midiOptions:{workflowOptions:{targetConfirmation:"default"}}},{configure:true});
    if(result===false||result?.aborted)await actor.setFlag(MODULE_ID,"automatonState",{...structuredClone(automatonState(actor)),battery:(automatonState(actor).battery??[]).map(r=>r.id===id?{...r,locked:false}:r)});
    return result;
  },async()=>{await actor.setFlag(MODULE_ID,"automatonState",{...structuredClone(automatonState(actor)),battery:(automatonState(actor).battery??[]).filter(r=>r.id!==id)});return true;});
}
