// Transformation_Factory.pdf, printed pages 32–37 and the unnumbered continuation.
export const FACTORY_ICON="icons/commodities/tech/robotics-frame-steel-blue.webp";
export const FACTORY_AREAS={head:"Голова",body:"Тело",arms:"Руки",legs:"Ноги"};
export const FACTORY_CAPACITY={head:1,body:3,arms:2,legs:2};
export const FACTORY_FEATURES=[
  ["form","Изготовленная форма",1,32,["form"]],["innovation","Фабрика инноваций",1,32,["install","remove","installed"]],["addiction","Зависимость",1,32,[],true],
  ["fortitude","Адаптированная стойкость",2,33,["fortitude"]],["homunculus","Оно живое",2,33,["create","dismiss"]],["armor","Бронебойный",2,34,["repair-start","repair"]],["arc","Электрическая дуга",2,34,["arc","recharge-arc"]],["appearance","Отвратительная внешность",2,35,[],true],
  ["sculptor","Скульптор плоти",3,35],["modified","Изменение с модификацией",3,36,[],false,"homunculus"],["living","Живой материал",3,36],["grounding","Заземление",3,36,["grounding"]],["imperfections","Несовершенства",3,36,[],true],
  ["deus","Deus Ex Machanicus",4,36],["immortal","Машина бессмертна!",4,37,["transfer","restore-body"],false,"modified"],["perfection","Воплощение совершенства",4,37],["ascension","Вознесение Омниссии",4,37,["ascend","end-ascension","lightning-bolt","dominate-construct"]],["withdrawal","Абстиненция",4,38,[],true]
].map(([id,name,level,page,operations=[],flaw=false,requires=null])=>({id,key:`factory-${id}`,name,level,page,operations,flaw,requires,img:FACTORY_ICON}));
export const FACTORY_MATERIALS={clay:"Глина",wood:"Дерево",flesh:"Плоть",stone:"Камень",iron:"Железо",crystal:"Кристалл",adamantine:"Адамантин",mithral:"Мифрил"};
export const factoryUnlockedTier=n=>Math.max(1,Math.min(4,Math.ceil(Number(n)/5)));
