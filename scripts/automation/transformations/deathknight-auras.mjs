import {MODULE_ID} from "../shared/constants.mjs";
import {dkHas,dkState,dkChange} from "./deathknight.mjs";
import {isEffectActive} from "../effects/temporary-effects.mjs";
import {tokenSceneDistance,feetToSceneUnits} from "../shared/spatial.mjs";
const doc=t=>t.document??t;
export const dkCrucibleActive=actor=>dkHas(actor,"crucible")&&[...(actor.effects??[])].some(e=>e.getFlag?.(MODULE_ID,"deathknightCrucible")&&isEffectActive(e));
export function dkCylinderContains(source,target,radius){const a=doc(source),b=doc(target),scene=a.parent;const dz=Number(b.elevation??0)-Number(a.elevation??0);if(dz<0||dz>feetToSceneUnits(100,scene))return false;
  // Cylinders use horizontal range, not a sphere's three-dimensional radius.
  const flat=t=>({...doc(t),elevation:0,object:null});return tokenSceneDistance(flat(source),flat(target),scene)<=feetToSceneUnits(radius,scene);
}
export const DEATHKNIGHT_AURAS=[...Array.from({length:9},(_,i)=>20+i*10).map(radius=>({
  id:`deathknight-crucible-${radius}`,name:"Тигель смерти",radius,height:100,indicatorColor:"#45532a",unlimitedRange:true,sourceFeature:"deathknight-crucible",affects:"nonSelf",
  sourceCondition:t=>dkCrucibleActive(t.actor)&&Number(dkState(t.actor).crucibleRadius??20)===radius,
  targetCondition:(s,t)=>dkCylinderContains(s,t,radius)&&!(t.actor.system.details?.type?.value==="undead"&&(t.actor.getFlag?.(MODULE_ID,"summonedBy")===s.actor.uuid||t.actor.getFlag?.(MODULE_ID,"deathknightControlledBy")===s.actor.uuid)),
  events:[{trigger:"targetStart",save:"con",dc:"8 + @prof + @abilities.cha.mod",damage:[{formula:"3d8",type:"fire"},{formula:"3d8",type:"necrotic"}],onSave:"half",metadata:{deathknightCrucible:true}}]
})),{
  id:"deathknight-general",name:"Аура генерала смерти",radius:20,indicatorColor:"#4ca881",sourceFeature:"deathknight-general",affects:"allies",targetType:"undead",stacking:"highest",
  sourceCondition:t=>dkHas(t.actor,"general")&&Number(t.actor.system.attributes.hp.value)>0&&!t.actor.statuses?.has?.("unconscious")&&!t.actor.statuses?.has?.("dead"),
  targetCondition:(_s,t)=>!t.actor.statuses?.has?.("dead"),
  effect:()=>({name:"Генерал смерти: спасброски союзной нежити",changes:["str","dex","con","int","wis","cha"].map(k=>dkChange(`system.abilities.${k}.save.roll.mode`,1,"upgrade"))}),
  events:[{trigger:"targetStart",damage:[{formula:"1d6",type:"healing"}]}]
}];
