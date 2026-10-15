export const HAG_ICON = "icons/magic/unholy/hand-claw-fog-green.webp";
export const HAG_TYPES = [["scarlet", "Алая"], ["night", "Ночная"], ["green", "Зелёная"], ["sea", "Морская"]];
export const HAG_FEATURES = [
  ["curse", "Проклятие", 1, 43, ["curse", "remove-curse", "rules"]],
  ["form", "Форма Ведьмы", 1, 43, ["type"]],
  ["bond", "Межплановая Связь", 1, 44, ["home"] , true],
  ["double", "Двойное Проклятие", 2, 44, ["curses"]],
  ["body", "Зачарованное Тело", 2, 44],
  ["alchemy", "Алхимическое Колдовство", 2, 44, [], false, "spellcasting"],
  ["fortune", "Гадалка", 2, 44, ["fortune", "use-fortune"]],
  ["appearance", "Отвратительная Внешность", 2, 44, ["guise", "reveal"], true],
  ["coven", "Ковен Проклятий", 3, 44, ["curses"], false, "double"],
  ["cauldron", "Колдовство", 3, 45, ["cauldron"], false, "alchemy"],
  ["hex", "Наговор", 3, 45, ["hex-save", "restore-hex"]],
  ["reflection", "Гротескное Отражение", 3, 45, ["reflection", "end-reflection"]],
  ["hunger", "Баба-Яга", 3, 45, ["hunger"], true],
  ["jinx", "Сглаженные Заклинания", 4, 45, ["repeat-jinx"], false, "hex"],
  ["voodoo", "Кукла Вуду", 4, 46, ["voodoo", "end-voodoo"]],
  ["broom", "Оживлённая Метла", 4, 46, ["broom", "dismiss-broom"]],
  ["grandmother", "Проклятие Бабушки", 4, 46],
  ["call", "Зов Ковена", 4, 46, ["call"], true]
].map(([id, name, level, page, operations = [], flaw = false, requires = null]) => ({id, key: `hag-${id}`, name, level, page, operations, flaw, requires, img: HAG_ICON}));
export const hagUnlockedTier = level => Math.max(1, Math.min(4, Math.ceil(Number(level) / 5)));
// Explicit user rulings for omissions/ambiguities in the PDF.
export const HAG_RULE_DEFAULTS = Object.freeze({curseMode:"all",scarletDamageType:"source",hexRecovery:"lr"});
export const HAG_HEX_RECOVERY = [{period:"lr",type:"recoverAll"}];
