// Присутствие (Transformation_Arkane.pdf), pp.72–75.
export const ARKANE_ICON="icons/magic/symbols/runes-star-magenta.webp";
export const ARKANE_RARITY_POINTS={common:50,uncommon:250,rare:500,veryRare:750,legendary:1000,artifact:1500};
const icons={siphon:"icons/magic/lightning/projectile-tendrils-teal.webp",form:"icons/magic/life/heart-red-blue.webp",fusion:"icons/magic/life/heart-glowing-red.webp",storm:"icons/magic/lightning/orb-ball-spiral-blue.webp",senses:"icons/svg/eye.svg",limitless:"icons/magic/lightning/projectiles-tendril-salvo-pink.webp",parasite:"icons/magic/life/heart-red-blue.webp",body:"icons/magic/defensive/barrier-shield-dome-blue-purple.webp",barrier:"icons/magic/defensive/barrier-shield-dome-blue-purple.webp",bestowal:"icons/magic/life/heart-hand-gold-green.webp",distortion:"icons/magic/lightning/orb-ball-purple.webp"};
export const ARKANE_FEATURES=[
  {id:"siphon",name:"Сифон",level:1,page:72,heading:"Бонус Трансформации",operations:[["siphon","Применить Сифон"]],intUses:true},
  {id:"form",name:"Магическая Форма",level:1,page:72,heading:"Бонус Трансформации",operations:[]},
  {id:"fusion",name:"Дуговое Слияние",level:1,page:72,flaw:true,operations:[["fusion-status","Запас ОС и накопленные вехи"],["consume-item","Поглотить магический предмет"],["daily-fusion","Расход ОС за день"],["fusion-adjust","Коррекция ОС (GM)"]]},
  {id:"persistence",name:"Настойчивость",level:2,page:73,heading:"Бонус Трансформации",operations:[["persistence","Оплатить отделение разума"],["possess","Спасбросок вселения"]]},
  {id:"storm",name:"Шторм Сил",level:2,page:73,heading:"Бонус Трансформации",intUses:true,operations:[["storm","Создать Шторм сил"],["move-storm","Переместить Шторм сил"],["end-storm","Завершить Шторм сил"]]},
  {id:"senses",name:"Сверхъестественные Чувства",level:2,page:73,heading:"Бонус Трансформации",operations:[["identify","Определить существо"]]},
  {id:"nullification",name:"Аннулирование: лишение магии",sourceName:"Аннулирование",level:2,page:73,extra:true,operations:[["nullification","Начальный спасбросок Аннулирования"]]},
  {id:"appearance",name:"Отвратительная Внешность",level:2,page:74,flaw:true,operations:[["appearance","Отметить облик"]]},
  {id:"limitless",name:"Безграничная Сила",level:3,page:74,heading:"Бонус Трансформации",intUses:true,operations:[["limitless","Распределить дротики силы"]]},
  {id:"obsession",name:"Одержимость",level:3,page:74,heading:"Бонус Трансформации",requires:"persistence",operations:[]},
  {id:"parasite",name:"Паразит",level:3,page:74,heading:"Бонус Трансформации",operations:[["parasite","Подтвердить успешный Сифон"]]},
  {id:"fractal",name:"Фрактал",level:3,page:74,extra:true,operations:[["fractal","Подтвердить ритуал Симулякра"]]},
  {id:"unstable",name:"Нестабильный",level:3,page:74,flaw:true,operations:[]},
  {id:"devouring",name:"Пожирание",level:4,page:75,heading:"Бонус Трансформации",operations:[]},
  {id:"body",name:"Сверхъестественное Тело",level:4,page:75,heading:"Бонус Трансформации",operations:[["immunities","Выбрать иммунитеты к заклинаниям"]]},
  {id:"barrier",name:"Аннулирование: барьер",sourceName:"Аннулирование",level:4,page:75,heading:"Бонус Трансформации",operations:[["barrier","Создать барьер Аннулирования"]]},
  {id:"bestowal",name:"Наделение",level:4,page:75,extra:true,requires:"nullification",operations:[["bestowal","Подтвердить Наделение"]]},
  {id:"distortion",name:"Сверхъестественное Искажение",level:4,page:75,flaw:true,operations:[["distortion","Применить искажение после броска"]]}
].map(entry=>({...entry,key:`arkane-${entry.id}`,img:icons[entry.id]??ARKANE_ICON}));
export const arkaneUnlockedTier=level=>Math.min(4,Math.max(0,Math.ceil(Number(level)/5)));
export const arkaneDailyCost=tier=>tier>=3?50:20;
export function arkaneIdentity(item){return String(item?.system?.identifier||item?.name||"").normalize("NFKC").trim().toLowerCase();}
export function arkaneSpellPools(actor,{spent=false}={}){return Object.entries(actor?.system?.spells??{}).flatMap(([key,row])=>{
  const level=key==="pact"?Number(row.level):/^spell[1-9]$/.test(key)?Number(key.slice(5)):0,maximum=Number(row.max??0),current=Number(row.value??0),count=spent?Math.max(0,maximum-current):Math.max(0,current);
  return level>0&&maximum>0&&count>0?[{key,level,count,maximum,current}]:[];
});}
export function arkaneExactSlots(pools,total){let reachable=new Set([0]);for(const pool of pools)for(let i=0;i<pool.count;i++)reachable=new Set([...reachable,...[...reachable].map(sum=>sum+pool.level).filter(sum=>sum<=total)]);return reachable.has(total);}
