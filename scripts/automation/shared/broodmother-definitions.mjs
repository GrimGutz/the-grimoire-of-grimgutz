export const BROODMOTHER_ICON="icons/creatures/invertebrates/spider-green.webp";
const web="icons/creatures/webs/web-spider-glowing-purple.webp",acid="icons/magic/acid/projectile-stream-bubbles.webp";
export const BROODMOTHER_FEATURES=[
  ["brood","Выводок потомства",1,80,BROODMOTHER_ICON,["brood","dismiss"]],
  ["form","Форма паука",1,80,BROODMOTHER_ICON],
  ["fear","Боязнь огня",1,80,acid,[],true],
  ["arachnomancy","Арахномантия",2,80,web,["arachnomancy"]],
  ["spider","Паучья мимикрия",2,80,BROODMOTHER_ICON,["legs"]],
  ["web","Выброс паутины",2,81,web,["web","escape-web","damage-web"]],
  ["quill","Ядовитое перо",2,81,BROODMOTHER_ICON,["quill"]],
  ["appearance","Отвратительная внешность",2,81,web,["guise","reveal"],true],
  ["greater","Больший выводок",3,81,BROODMOTHER_ICON],
  ["blood","Ядовитая кровь",3,81,acid],
  ["spinner","Прядильщик нитей",3,81,web,["spinner","pull","climb-thread","escape-thread"],false,"web"],
  ["bile","Кислотная желчь",3,82,acid,["bile","scrape"]],
  ["pyrophobia","Пирофобия",3,82,acid,[],true],
  ["matriarch","Благословение матриарха",4,82,BROODMOTHER_ICON],
  ["horror","Потомство ужаса",4,82,BROODMOTHER_ICON,["horror"]],
  ["mimic","Мимикрия",4,82,web,["mimic","mimic-end","mimic-explode"]],
  ["toxicologist","Токсиколог",4,82,acid,[],false,"quill"],
  ["contempt","Материнское презрение",4,82,BROODMOTHER_ICON,["contempt"],true]
].map(([id,name,level,page,img,operations=[],flaw=false,requires=null])=>({id,key:`broodmother-${id}`,name,level,page,img,operations,flaw,requires}));
export const broodmotherUnlockedTier=level=>Math.max(1,Math.min(4,Math.ceil(Number(level)/5)));
