// Transformation_DeathKnight.pdf, printed pages 104–107; not the prestige class.
export const DK_ICON="icons/skills/melee/sword-damaged-broken-glow-red.webp";
export const DK_FEATURES=[
  ["grave","Поражённый могилой",1,104,["levels","ability","raise"]],
  ["form","Форма нежити",1,104], ["anchor","Якорь",1,105,["anchor","away","return","exhaustion"],true],
  ["smog","Смертельный смог",2,105,["smog","end-smog"]], ["strikes","Обречённые удары",2,105],
  ["restless","Нет отдыха для злых",2,105,["restless"]], ["souvenir","Сувенир",2,105,["souvenir","rebirth"]],
  ["appearance","Отвратительная внешность",2,105,["guise","reveal"],true],
  ["souls","Связь душ",3,106,["spell-type"]], ["quick","Быстрое исцеление",3,106],
  ["crucible","Тигель смерти",3,106,["crucible","expand","end-crucible"]], ["specialist","Специалист по нежити",3,106,["specialize"]],
  ["existence","Существование смерти",3,106,["declare"],true],
  ["fireball","Шар адского огня",4,107,["fireball"]], ["general","Аура генерала смерти",4,107],
  ["annihilate","Искореняющий удар",4,107,["annihilate"]], ["reaper","Жнец",4,107,["reaper","end-reaper","consume","hellish-smite"]],
  ["outcast","Отверженный",4,107,["exhaustion","declare"],true]
].map(([id,name,level,page,operations=[],flaw=false])=>({id,key:`deathknight-${id}`,name,level,page,operations,flaw,img:DK_ICON}));
export const DK_SPECIALISTS=[ ["artillery","Артиллерист"], ["sapper","Сапёр"], ["warrior","Воин"], ["defender","Защитник"], ["assassin","Убийца"] ].map(([id,name])=>({id,name,key:`deathknight-skeleton-${id}`}));
export const dkUnlockedTier=n=>Math.max(1,Math.min(4,Math.ceil(Number(n)/5)));
