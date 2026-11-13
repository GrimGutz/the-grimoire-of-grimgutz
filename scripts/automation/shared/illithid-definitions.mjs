export const ILLITHID_ICON = "icons/commodities/biological/organ-brain-pink-purple.webp";
export const ILLITHID_ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
export const ILLITHID_RULE_DEFAULTS = {
  superiorityRecovery: "lr",
  refugeSeconds: 0,
  refugeConcentration: false,
  melodySeconds: 0,
  melodyConcentration: false
};
export const ILLITHID_FEATURES = [
  ["extract", "Извлечение Мозга", 1, 5, ["extract"]],
  ["form", "Аберрантная Форма", 1, 5],
  ["bond", "Психическая Связь", 1, 5, [], true],
  ["horizon", "Горизонт Событий", 2, 6, ["horizon"]],
  ["blast", "Ментальный Взрыв", 2, 6, ["blast"]],
  ["mind", "Иллитидский Разум", 2, 6],
  ["matter", "Разум и Материя", 2, 6, ["summon", "dismiss"]],
  ["appearance", "Отвратительная Внешность", 2, 6, ["guise", "reveal"], true],
  ["superiority", "Псионическое Превосходство", 3, 7, ["counter", "restore-counter", "rules"]],
  ["flight", "Полет", 3, 7],
  ["spellcasting", "Псионическое Колдовство", 3, 7, [], false, "spellcasting"],
  ["refuge", "Ментальное Убежище", 3, 7, ["refuge", "end-refuge", "exchange"]],
  ["hunger", "Голод Интеллекта", 3, 7, ["feed", "hunger-death"], true],
  ["supreme", "Высшая Псионика", 4, 8, ["supreme-watch"], false, "spellcasting"],
  ["fortress", "Ментальная Крепость", 4, 8],
  ["probe", "Зондирование Мыслей", 4, 8, ["detect-thoughts", "dominate"]],
  ["melody", "Телекинетическая Мелодия", 4, 8, ["melody", "release"]],
  ["call", "Зов Старшего", 4, 8, ["call"], true]
].map(([id, name, level, page, operations = [], flaw = false, requires = null]) => ({
  id,
  key: `illithid-${id}`,
  name,
  level,
  page,
  operations,
  flaw,
  requires,
  img: ILLITHID_ICON
}));
export { unlockedTier as illithidUnlockedTier } from "./transformation-core.mjs";
