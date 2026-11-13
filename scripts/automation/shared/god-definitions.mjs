export const GOD_ICON = "icons/magic/holy/angel-winged-humanoid-blue.webp";
export const GOD_ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
export const GOD_FEATURES = [
  ["zeal", "Божественное Рвение", 1, 14, ["guide", "ruin", "counter", "wrath", "dawn", "schedule-dawn"]],
  ["form", "Божественная Форма", 1, 14, ["form", "alignment"]],
  ["apathy", "Впадение в Апатию", 1, 15, ["apathy", "awaken"], true],
  ["demiurgy", "Демиургия", 2, 15, ["cast", "recharge-use", "element"]],
  ["mantle", "Прометеева Мантия", 2, 15, ["mantle"]],
  ["translocation", "Транслокация", 2, 15, ["translocation"]],
  ["gift", "Благожеланность/Вредоносность", 2, 15, ["gift", "end-gift"]],
  ["strain", "Божественное Напряжение", 2, 15, ["status"], true],
  ["united", "Один за Всех/Все за Одного", 3, 16, ["recover"]],
  ["restoration", "Выздоровление/Пожирание", 3, 16, ["restoration", "devour-healing"]],
  ["mercy", "Милость", 3, 16, ["mercy", "revoke-mercy"]],
  ["wish", "Всемогущий Исполнитель Желаний", 3, 16, ["wish"]],
  ["curse", "Бессмертное Проклятие", 3, 16, [], true],
  ["domain", "Расширение Домена", 4, 17, ["domain", "domain-recipients", "end-domain"]],
  ["judgment", "Суд/Аннигиляция", 4, 17, ["judgment"]],
  ["apotheosis", "Апофеоз", 4, 17],
  ["demiscience", "Демисциенция", 4, 17, ["foresight"]],
  ["rival", "Небесный Соперник", 4, 17, [], true]
].map(([id, name, level, page, operations = [], flaw = false]) => ({
  id,
  key: `god-${id}`,
  name,
  level,
  page,
  operations,
  flaw,
  img: GOD_ICON
}));
export { unlockedTier as godUnlockedTier } from "./transformation-core.mjs";
export const godWrathDice = tier => 4 * Number(tier);
export function godAnnihilationDamage(feet) {
  if (!Number.isFinite(feet) || feet < 0 || feet > 300) return 0;
  return Math.floor(800 / 2 ** Math.max(0, Math.ceil(feet / 30) - 1));
}
