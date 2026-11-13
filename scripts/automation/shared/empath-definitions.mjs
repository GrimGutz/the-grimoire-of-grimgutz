// Source: ManyFaced.md. Shared by pack generation, runtime and tests.
export const EMPATH_ICON = "icons/magic/life/heart-red-blue.webp";
export const EMPATH_MASKS = [
  { id: "anger", name: "Гнев", ability: "str", img: "icons/magic/life/heart-glowing-red.webp" },
  { id: "calm", name: "Спокойствие", ability: "wis", img: "icons/magic/life/heart-cross-blue.webp" },
  { id: "joy", name: "Радость", ability: "dex", img: "icons/magic/life/heart-hand-gold-green.webp" },
  { id: "sorrow", name: "Печаль", ability: "cha", img: "icons/magic/water/heart-ice-freeze.webp" }
];
export const EMPATH_FEATURES = [
  {
    id: "masks",
    name: "Маски чувств",
    level: 1,
    operations: [
      ["outside-mask", "Сменить вне боя"],
      ["combat-mask", "Смена после события"],
      ["reset-mask", "Спокойствие в начале/конце боя"]
    ],
    max: "@prof",
    rest: "lr"
  },
  {
    id: "impulse",
    name: "Импульс",
    level: 1,
    operations: [["impulse", "Применить Импульс"]],
    max: "@prof",
    rest: "lr"
  },
  {
    id: "empathy",
    name: "Сопричастность",
    level: 2,
    operations: [["empathy", "Наделить покровом до броска"]],
    max: "1",
    rest: "sr"
  },
  {
    id: "voice",
    name: "Голос сердца",
    level: 2,
    operations: [["voice", "Применить Голос сердца"]],
    max: "1",
    rest: "sr"
  },
  { id: "response", name: "Отклик", level: 3, operations: [] },
  {
    id: "wave",
    name: "Волна чувств",
    level: 3,
    operations: [["wave-free", "Наложить без ячейки"]],
    max: "1",
    rest: "sr"
  },
  { id: "nature", name: "Изменчивая природа", level: 4, operations: [["nature", "Выбрать: маска или черта"]] },
  { id: "facets", name: "Грани души", level: 5, operations: [] },
  { id: "catharsis", name: "Катарсис", level: 5, operations: [["catharsis", "Вызвать Катарсис"]], max: "1", rest: "lr" }
].map(entry => ({ ...entry, key: `empath-${entry.id}`, img: EMPATH_ICON }));
export const empathDice = level => (level >= 5 ? 4 : level >= 3 ? 3 : 2);
export const empathTemporaryDice = level => (level >= 5 ? 3 : level >= 3 ? 2 : 1);
export const empathTotalLevel = actor =>
  [...(actor?.items ?? [])]
    .filter(item => item.type === "class")
    .reduce((sum, item) => sum + Number(item.system.levels ?? 0), 0);
