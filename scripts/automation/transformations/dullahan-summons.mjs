import {MODULE_ID} from "../shared/constants.mjs";
import {askOwner,confirmOwner} from "../shared/owner-prompts.mjs";
import {applyNativeOnce} from "../shared/native-applications.mjs";
import {useNativeUtility} from "../shared/native-actions.mjs";
import {createSummonedGroup} from "../shared/summons.mjs";
import {dismissSummonActor} from "../shared/summon-lifecycle.mjs";
import {dullahanGm,dullahanExpense} from "./dullahan-use.mjs";
export function dullahanHeadRecipe(owner,base){const hp=Number(base.system.attributes.hp.max);return {kind:"dullahan-death-head",source:"dullahan-heads",unique:false,name:`${owner.name}: ${base.name}`,img:base.img,size:base.system.traits?.size??"sm",type:base.system.details?.type?.value??"undead",cr:Number(base.system.details?.cr??0),ac:Number(base.system.attributes.ac.value??base.system.attributes.ac.flat??10),hp,hpFormula:String(hp),
  abilities:Object.fromEntries(["str","dex","con","int","wis","cha"].map(k=>[k,Number(base.system.abilities[k]?.value??10)])),movement:structuredClone(base.system.attributes.movement??{}),senses:structuredClone(base.system.attributes.senses??{}),skills:structuredClone(base._source?.system?.skills??{}),
  ...Object.fromEntries(["di","dr","dv","ci"].map(k=>[k,{value:[...(base.system.traits?.[k]?.value??[])],bypasses:[...(base.system.traits?.[k]?.bypasses??[])],custom:base.system.traits?.[k]?.custom??""}])),languages:{value:[...(base.system.traits?.languages?.value??[])],custom:base.system.traits?.languages?.custom??""},
  extraItems:[...(base.items??[])].filter(i=>!["class","subclass"].includes(i.type)).map(i=>i.toObject()),effects:[...(base.effects??[])].map(e=>e.toObject()),lifecycle:{seconds:60},snapshot:{ownerUuid:owner.uuid,baseActorUuid:base.uuid},note:"Три Головы Смерти из выбранного GM настоящего статблока. Существуют минуту. Исходный NPC, его ресурсы и токен не изменяются; действия и атаки берутся из статблока."};}
export const dullahanHeads=owner=>[...(game.actors??[])].filter(a=>a.getFlag?.(MODULE_ID,"summonedBy")===owner.uuid&&a.getFlag?.(MODULE_ID,"summonSource")==="dullahan-heads");
async function chooseBase(actor){const rows=[...(game.actors??[])].filter(a=>a.type==="npc"&&!a.getFlag?.(MODULE_ID,"summoned"));
  for(const pack of game.packs?.values?.()??[]){if(pack.metadata?.type!=="Actor")continue;for(const row of await pack.getIndex()??[])if(/death.?s? head|голов[аы] смерти|мертв.*голов/iu.test(String(row.name)))rows.push({name:row.name,uuid:row.uuid??`Compendium.${pack.collection}.Actor.${row._id}`});}
  const candidates=[...new Map(rows.map(a=>[a.uuid,a])).values()],uuid=await askOwner(dullahanGm(actor),{title:"GM: настоящий статблок Головы Смерти",label:"Глава 5 Руководства Ван Рихтена. Если статблок не установлен, отмените и добавьте его; произвольная голова не создаётся по догадке.",choices:candidates.map(a=>[a.uuid,a.name])}),base=uuid&&await fromUuid(uuid);
  if(!base||base.type!=="npc")return null;return base;
}
export async function summonDullahanHeads(actor,activity,source,requestId){dullahanExpense(activity,{cost:1});const base=await chooseBase(actor);if(!base)return false;
  if(!await confirmOwner(dullahanGm(actor),"Три Головы Смерти","Выбран правильный статблок из Руководства Ван Рихтена и есть три незанятых места в пределах 5 футов: справа, снизу и слева от источника? Модуль сохранит настоящие атаки и особенности, не изобретая статистики."))return false;
  const spent=Number(activity.item.system.uses.spent??0),recipe=dullahanHeadRecipe(actor,base);
  return applyNativeOnce(actor,{requestId,action:"dullahan-heads",activityUuid:activity.uuid},()=>useNativeUtility(activity,{dataPatch:dullahanExpense(activity,{cost:1})}),async()=>{
    const confirmed=Number(activity.item.system.uses.spent??0),result=await createSummonedGroup(actor,[recipe,recipe,recipe],{scene:source.parent,sourceTokenId:source.id,requireScene:true,requestId:`${requestId}:heads`});
    if(result.status==="failed"){if(confirmed===spent+1&&Number(activity.item.system.uses.spent??0)===confirmed)await activity.item.update({"system.uses.spent":spent});return {status:"needs-review"};}
    if(result.status!=="success")return {status:"needs-review"};
    const grid=Number(source.parent.grid.size),positions=[[source.x+Number(source.width??1)*grid,source.y],[source.x,source.y+Number(source.height??1)*grid],[source.x-grid,source.y]];
    for(const [i,uuid] of result.tokenUuids.entries()){const token=await fromUuid(uuid);if(!token)return {status:"needs-review"};await token.update({x:positions[i][0],y:positions[i][1]});}return true;
  });
}
export async function dismissDullahanHeads(actor){const children=dullahanHeads(actor);if(!children.length)return false;if(!await confirmOwner(actor,"Изгнать Головы Смерти","Завершить только собственный призыв, не удаляя исходный статблок или чужих существ?"))return false;for(const child of children)await dismissSummonActor(child);return true;}
