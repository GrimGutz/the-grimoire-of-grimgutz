// Transformation_Dullahan.pdf, printed pages 111–114.
export const DULLAHAN_ICON="icons/magic/death/projectile-skull-fire-orange.webp";
export const DULLAHAN_FEATURES=[
  ["oath","Клятва охотника",1,111,["oath","oath-death"]],
  ["form","Форма нежити",1,111],
  ["broken","Нарушенная клятва",1,111,["broken"],true],
  ["mount","Кошмарный скакун",2,112,["mount","ride","dismount","release-mount"]],
  ["sight","Великое зрение",2,112],
  ["skulls","Пылающие черепа",2,112,["skulls"]],
  ["fortitude","Стойкость нежити",2,112,["fortitude"]],
  ["appearance","Отвратительная внешность",2,112,["guise","reveal"],true],
  ["heads","Голова Смерти",3,113,["heads","dismiss-heads"]],
  ["howl","Вой Безголосого",3,113,["howl"]],
  ["gaze","Испепеляющий взгляд",3,113,["gaze"],false,"skulls"],
  ["prophecy","Смертельное прорицание",3,113,["prophecy","sending"]],
  ["fading","Увядающая клятва",3,113,[],true],
  ["headhunter","Охотник за головами",4,114,["headhunter"]],
  ["defiant","Непреклонный",4,114,["rebirth-start","rebirth"]],
  ["unnerving","Нервирующее пламя",4,114,["clear-scar"],false,"gaze"],
  ["mists","Туманы Отчуждения",4,114,["mists","mist-report","end-mists"]],
  ["pawn","Безголовый Пешка",4,114,["pawn","end-pawn"],true]
].map(([id,name,level,page,operations=[],flaw=false,requires=null])=>({id,key:`dullahan-${id}`,name,level,page,operations,flaw,requires,img:DULLAHAN_ICON}));
export const dullahanUnlockedTier=level=>Math.max(1,Math.min(4,Math.ceil(Number(level)/5)));
