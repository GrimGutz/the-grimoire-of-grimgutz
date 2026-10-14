import {godHas,godFunctional,godDomain,godChange} from "./god.mjs";
import {GOD_ABILITIES} from "../shared/god-definitions.mjs";
const doc=t=>t.document??t;
export const GOD_AURAS=[{
  id:"god-strain",name:"Божественное напряжение: 0 HP",radius:20,indicatorColor:"#e7c161",sourceFeature:"god-strain",affects:"nonSelf",
  sourceCondition:t=>godFunctional(t.actor)&&godHas(t.actor,"strain")&&Number(t.actor.system.attributes.hp.value)===0
},{
  id:"god-domain",name:"Домен Божества",radius:100,indicatorColor:"#ffd36d",sourceFeature:"god-domain",affects:"all",stacking:"highest",
  sourceCondition:t=>godDomain(t.actor)?.sourceTokenUuid===doc(t).uuid,
  targetCondition:(s,t)=>Boolean(godDomain(s.actor)?.targetUuids.includes(doc(t).uuid)),
  effect:()=>({name:"Домен: выбранный получатель",changes:[godChange("flags.midi-qol.advantage.attack.all","true","override"),...GOD_ABILITIES.flatMap(a=>[godChange(`system.abilities.${a}.check.roll.mode`,1,"upgrade"),godChange(`system.abilities.${a}.save.roll.mode`,1,"upgrade")])]})
}];
