export const JESTER_ID="jester";
export const JESTER_ICON="icons/svg/card-joker.svg";
export const JESTER_FEATURES=[
  ["chaos","Очки хаоса",1], ["impromptu","Экспромт",1], ["scenery","Смена декораций",1],
  ["retort","Острая реплика",2], ["laughter","Смех зала",2], ["mise","Мизансцена",3],
  ["correction","Правка суфлера",3], ["role","Жребий роли",4], ["finale","Финальный номер",5], ["improvisation","Импровизация",5]
].map(([id,name,level])=>({id,key:`jester-${id}`,name,level}));
export const JESTER_ABILITIES=["str","dex","con","int","wis","cha"];
export const jesterMaximum=level=>level>0?Math.min(5,Number(level))+2:0;
export const jesterImpromptuDie=level=>level>=5?6:4;
// The relationship is a deliberate scene decision, not an inference from token colors.
export function jesterChaosDelta(relation,beneficial,amount=1) {
  if(!["ally","enemy","neutral"].includes(relation)||typeof beneficial!=="boolean"||!Number.isInteger(amount)||amount<1)throw Error("Некорректное отношение/эффект хаоса.");
  return relation==="neutral"?0:(relation==="ally")===beneficial?-amount:amount;
}
