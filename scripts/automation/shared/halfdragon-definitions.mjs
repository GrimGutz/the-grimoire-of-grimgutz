export const HALFDRAGON_ICON="icons/creatures/reptiles/dragon-winged-blue.webp";
export const HALFDRAGON_ANCESTRIES=[
  ["red","Красный","chromatic","fire"],["blue","Синий","chromatic","lightning"],["green","Зелёный","chromatic","poison"],["white","Белый","chromatic","cold"],["black","Чёрный","chromatic","acid"],
  ["gold","Золотой","metallic","fire"],["silver","Серебряный","metallic","cold"],["bronze","Бронзовый","metallic","lightning"],["brass","Латунный","metallic","fire"],["copper","Медный","metallic","acid"],
  ["amethyst","Аметистовый","gem","force"],["crystal","Кристальный","gem","radiant"],["emerald","Изумрудный","gem","psychic"],["sapphire","Сапфировый","gem","thunder"],["topaz","Топазовый","gem","necrotic"]
].map(([id,name,family,damageType])=>({id,name,family,damageType}));
export const HALFDRAGON_FEATURES=[
  ["breath","Дыхание",1,38,["breath","restore-breath","rules"]],
  ["form","Драконья Форма",1,38,["ancestry"]],
  ["greed","Жадность",1,39,["greed"],true],
  ["scales","Чешуя",2,39,["scales"]],
  ["senses","Острые Чувства",2,39],
  ["fundamentum","Улучшенный Фундаментум",2,39,["fundamentum","end-fundamentum","wake"]],
  ["roar","Драконий Крик",2,39,["roar"]],
  ["appearance","Отвратительная Внешность",2,39,["guise","reveal"],true],
  ["wings","Крылья",3,40,["wing-gear"]],
  ["limbs","Драконьи Конечности",3,40,["claws","bite"]],
  ["sangromancy","Драконья Сангромантия",3,40,["sangromancy"]],
  ["living","Оживлённое Дыхание",3,40,["living","dismiss-living"]],
  ["sloth","Лень Дракона",3,40,[],true],
  ["polymorph","Полиморф",4,41,["polymorph"]],
  ["empowered","Усиленное Дыхание",4,41],
  ["guard","Стража Дракона",4,41,["guard"]],
  ["descendant","Потомки Богов",4,41,["recover"]],
  ["insatiable","Ненасытная Жадность",4,41,[],true]
].map(([id,name,level,page,operations=[],flaw=false])=>({id,key:`halfdragon-${id}`,name,level,page,operations,flaw,img:HALFDRAGON_ICON}));
export const halfdragonUnlockedTier=n=>Math.max(1,Math.min(4,Math.ceil(Number(n)/5)));
