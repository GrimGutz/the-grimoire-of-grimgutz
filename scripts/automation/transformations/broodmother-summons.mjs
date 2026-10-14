import {MODULE_ID} from "../shared/constants.mjs";
import {broodmotherHas,broodmotherDC,broodmotherTransformationLevel,broodmotherState} from "./broodmother.mjs";
import {askOwner,confirmOwner} from "../shared/owner-prompts.mjs";
import {createSummonedGroup} from "../shared/summons.mjs";
import {useNativeUtility} from "../shared/native-actions.mjs";
import {applyNativeOnce} from "../shared/native-applications.mjs";
import {broodmotherGm,broodmotherExpense} from "./broodmother-use.mjs";
import {feetToSceneUnits} from "../shared/spatial.mjs";
import {serialMutation} from "../shared/transactions.mjs";
export const broodmotherChildren=actor=>[...(game.actors??[])].filter(a=>a.getFlag?.(MODULE_ID,"summonedBy")===actor.uuid&&["broodmother-brood","broodmother-horror"].includes(a.getFlag(MODULE_ID,"summonSource")));
export function broodmotherHitDice(actor){return [...(actor.items??[])].filter(i=>i.type==="class"&&i.system?.hd).map(i=>({item:i,spent:Number(i.system.hd.spent??0),remaining:Number(i.system.hd.value??(Number(i.system.hd.max??i.system.levels)-Number(i.system.hd.spent??0)))}));}
export async function selectBroodmotherBase(actor,swarm=false){
  const candidates=[...(game.actors??[])].filter(a=>a.type==="npc"&&!a.getFlag?.(MODULE_ID,"summoned"));
  for(const pack of game.packs?.values?.()??[]){if(pack.metadata?.type!=="Actor")continue;
    const index=await pack.getIndex();for(const row of index??[]){const name=String(row.name).toLowerCase();if(swarm?/swarm.*spider|рой.*пау|пау.*рой/u.test(name):/giant spider|гигантск.*паук/u.test(name))candidates.push({uuid:row.uuid??`Compendium.${pack.collection}.Actor.${row._id}`,name:row.name});}}
  const uuid=await askOwner(broodmotherGm(actor),{title:swarm?"GM: статблок роя пауков":"GM: статблок гигантского паука",label:"Выберите исходный статблок из мира или установленной библиотеки. Неизвестные характеристики модуль не придумывает.",choices:[...new Map(candidates.map(a=>[a.uuid,a])).values()].map(a=>[a.uuid,a.name])});
  const base=uuid&&await fromUuid(uuid);if(!base||base.type!=="npc")return null;return base;
}
export function broodmotherRecipe(owner,base,{upgrades={},swarm=false}={}){
  const tier=broodmotherTransformationLevel(owner),con=Number(owner.system.abilities.con.mod),bonus=broodmotherHas(owner,"greater")?tier:0,dc=broodmotherDC(owner);
  const growth=Number(upgrades.size??0),hp=Number(base.system.attributes.hp.max)+2*con*Number(upgrades.hp??0),units=base.system.attributes.movement?.units??"ft",movement={units,hover:Boolean(base.system.attributes.movement?.hover)};
  const delta=feetToSceneUnits(10,{grid:{units}});
  for(const key of ["walk","climb","swim","fly","burrow"]){const n=Number(base.system.attributes.movement?.[key]??0);if(n>0)movement[key]=n+delta*Number(upgrades.speed??0);}
  const extraItems=[...(base.items??[])].filter(i=>!["class","subclass"].includes(i.type)).map(i=>{
    const data=i.toObject();delete data._id;delete data._stats;
    const add=part=>{if(!part)return;part.bonus=[part.bonus,bonus].filter(v=>v!==undefined&&v!==""&&v!==0).join(" + ");if(Number(part.denomination)>0&&growth)part.number=Number(part.number??1)+growth;};
    const hasBase=data.system?.damage?.base;if(hasBase)add(hasBase);
    for(const a of Object.values(data.system?.activities??{})){
      if(a.save)a.save.dc={calculation:"",formula:String(dc)};
      if(a.attack&&bonus)a.attack.bonus=[a.attack.bonus,bonus].filter(Boolean).join(" + ");
      if(a.damage?.parts?.length&&!a.damage.includeBase)add(a.damage.parts[0]);
    }return data;
  });
  return {kind:swarm?"broodmother-swarm":"broodmother-spider",source:swarm?"broodmother-horror":"broodmother-brood",unique:false,
    name:`${owner.name}: ${swarm?"рой пауков":"паук выводка"}`,img:base.img,size:swarm?(base.system.traits?.size??"med"):["sm","med","lg","huge","grg"][Math.min(4,growth)],
    ac:Number(base.system.attributes.ac.value??base.system.attributes.ac.flat??10),hp:Math.max(1,hp),hpFormula:String(Math.max(1,hp)),type:base.system.details?.type?.value??"beast",cr:Number(base.system.details?.cr??0),
    abilities:Object.fromEntries(["str","dex","con","int","wis","cha"].map(k=>[k,Number(base.system.abilities[k]?.value??10)])),movement,senses:structuredClone(base.system.attributes.senses??{}),
    ...Object.fromEntries(["di","dr","dv","ci"].map(k=>[k,{value:[...(base.system.traits?.[k]?.value??[])],bypasses:[...(base.system.traits?.[k]?.bypasses??[])],custom:base.system.traits?.[k]?.custom??""}])),
    skills:structuredClone(base._source?.system?.skills??{}),swarm:base.system.details?.type?.swarm??"",languages:{value:[...(base.system.traits?.languages?.value??[])],custom:base.system.traits?.languages?.custom??""},
    ...(swarm?{lifecycle:{seconds:3600}}:{}),snapshot:{ownerUuid:owner.uuid,level:tier,dc,con,baseActorUuid:base.uuid,upgrades:structuredClone(upgrades),attacks:1+Number(upgrades.attack??0)},
    effects:growth?[{name:"Укрупнённый выводок: Сила",type:"base",transfer:false,disabled:false,statuses:[],system:{changes:[{key:"system.abilities.str.check.roll.mode",type:"override",value:"1",phase:"initial",priority:20}]}}]:[],
    extraItems,note:"Создан по выбранному GM статблоку со снимком Сл и улучшений. Словесные команды; число атак действием Атака контролирует владелец. Перемещение и открытое место проверяет GM. Старые пауки не обновляются и не лечатся автоматически."};
}
async function upgradesFor(actor){const upgrades={};if(!broodmotherHas(actor,"matriarch"))return upgrades;
  let remaining=broodmotherHitDice(actor).reduce((n,r)=>n+r.remaining,0)-2;
  for(const [key,label] of [["hp","Хиты + удвоенное Телосложение"],["size","Размер + категория, кость урона, преимущество Силы"],["speed","Скорость +10 футов"],["attack","Дополнительная атака"]]){
    const n=await askOwner(actor,{kind:"number",title:`Матриарх: ${label}`,label:"Число повторений, каждая стоит одну дополнительную кость хитов",min:0,max:Math.max(0,remaining),defaultValue:0});
    if(!Number.isInteger(n)||n<0||n>remaining)return null;upgrades[key]=n;remaining-=n;
  }return upgrades;
}
export async function summonBroodmother(actor,activity,source,requestId){
  if(broodmotherHitDice(actor).reduce((n,r)=>n+r.remaining,0)<2)throw Error("Нужны две доступные кости хитов.");
  const upgrades=await upgradesFor(actor);if(!upgrades)return false;
  const base=await selectBroodmotherBase(actor);if(!base)return false;
  if(!await confirmOwner(broodmotherGm(actor),"Выводок: место","Справа рядом с токеном в пределах 5 футов есть открытое свободное место для паука выбранного размера? При укрупнении GM проверяет занятое пространство."))return false;
  const recipe=broodmotherRecipe(actor,base,{upgrades}),cost=2+Object.values(upgrades).reduce((n,v)=>n+v,0),before=broodmotherHitDice(actor).map(r=>({id:r.item.id,spent:r.spent}));
  return applyNativeOnce(actor,{requestId,action:"broodmother-brood",activityUuid:activity.uuid},()=>useNativeUtility(activity,{dataPatch:broodmotherExpense(activity,{hitDice:cost})}),async()=>{
    const after=broodmotherHitDice(actor).map(r=>({id:r.item.id,spent:r.spent}));
    const result=await createSummonedGroup(actor,[recipe],{scene:source.parent,sourceTokenId:source.id,requireScene:true,requestId:`${requestId}:create`});
    if(result.status==="failed"){
      for(const row of before){const item=actor.items.get(row.id),confirmed=after.find(r=>r.id===row.id);if(item&&Number(item.system.hd.spent)===confirmed?.spent&&confirmed.spent>row.spent)await item.update({"system.hd.spent":row.spent});}
      return {status:"needs-review"};
    }return result.status==="success"?true:{status:"needs-review"};
  });
}
export async function summonBroodmotherHorror(actor,activity,source,requestId){
  if(Number(actor.system.attributes.hp.value)>0)throw Error("Потомство ужаса срабатывает только при падении до 0 хитов.");
  if(Number(broodmotherState(actor).horrorReadyAt??0)>Number(game.time.worldTime))throw Error("Потомство ужаса восстанавливается через 1к4 игровых дня после применения, не после отдыха.");
  if(!await confirmOwner(broodmotherGm(actor),"Потомство ужаса","Подтверждён новый переход к 0 хитов, для которого ещё не применяли способность? Следующее восстановление — через 1к4 игровых дня; это не шанс срабатывания."))return false;
  const base=await selectBroodmotherBase(actor,true);if(!base)return false;
  if(!await confirmOwner(broodmotherGm(actor),"Места роёв","Подтверждены открытые места для БМ роёв не ближе 10 футов? Дополнительные платные улучшения без решения GM не добавляются."))return false;
  return applyNativeOnce(actor,{requestId,action:"broodmother-horror",activityUuid:activity.uuid},()=>serialMutation(`broodmother-horror:${actor.uuid}`,async()=>{
    const now=Number(game.time.worldTime);if(Number(actor.system.attributes.hp.value)>0||Number(broodmotherState(actor).horrorReadyAt??0)>now)return false;
    const roll=await new Roll("1d4").evaluate(),days=Number(roll.total);if(!Number.isInteger(days)||days<1||days>4)throw Error("Некорректный срок восстановления Потомства ужаса.");
    await roll.toMessage({speaker:ChatMessage.getSpeaker({actor}),flavor:"Потомство ужаса: дней до восстановления"});
    await actor.setFlag(MODULE_ID,"broodmotherState",{...structuredClone(broodmotherState(actor)),horrorReadyAt:now+days*86400,horrorRequestId:requestId});return true;
  }),async()=>{
    const count=Number(actor.system.attributes.prof),recipes=Array.from({length:count},()=>broodmotherRecipe(actor,base,{swarm:true})),created=[],actors=[];
    for(let i=0;i<count;i+=3){const result=await createSummonedGroup(actor,recipes.slice(i,i+3),{scene:source.parent,sourceTokenId:source.id,requireScene:true,requestId:`${requestId}:swarm:${i}`});
      if(result.status!=="success"){
        if(result.status==="failed")for(const uuid of actors){const child=await fromUuid(uuid);
          if(!child||child.getFlag(MODULE_ID,"summonedBy")!==actor.uuid||!String(child.getFlag(MODULE_ID,"summonRequestId")).startsWith(`${requestId}:swarm:`))continue;
          for(const scene of game.scenes??[])for(const token of [...(scene.tokens??[])])if(token.actorId===child.id)await scene.deleteEmbeddedDocuments("Token",[token.id]);await child.delete();
        }return {status:"needs-review"};
      }created.push(...result.tokenUuids);actors.push(...result.actorUuids);
    }
    const grid=Number(source.parent.grid.size),distance=Number(source.parent.grid.distance??5);
    for(const [i,uuid] of created.entries()){const token=await fromUuid(uuid);if(token)await token.update({x:source.x+Number(source.width??1)*grid+10/distance*grid,y:source.y+i*grid});}return true;
  });
}
export async function dismissBroodmotherChild(actor){
  const children=broodmotherChildren(actor),uuid=await askOwner(actor,{title:"Собственное потомство",choices:children.map(a=>[a.uuid,a.name])}),child=children.find(a=>a.uuid===uuid);if(!child)return false;
  if(!await confirmOwner(broodmotherGm(actor),"Убрать потомство","Удалить только созданное модулем существо и его токены? Не сюжетная смерть выводка."))return false;
  for(const scene of game.scenes??[])for(const token of [...(scene.tokens??[])])if(token.actorId===child.id)await scene.deleteEmbeddedDocuments("Token",[token.id]);
  await child.delete();return true;
}
