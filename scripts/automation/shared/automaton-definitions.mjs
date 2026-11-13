// Browser-safe source metadata; no Node/build dependencies.
export const AUTOMATON_ICON = "icons/creatures/magical/construct-golem-robot-blue.webp";
const gear = "icons/commodities/tech/cog-gear-steel-glass.webp";
const steel = "icons/commodities/tech/robotics-frame-steel-blue.webp";
const shield = "icons/magic/defensive/shield-barrier-glowing-blue.webp";
const furnace = "icons/tools/smithing/furnace-fire-metal-orange.webp";
export const AUTOMATON_MODELS = {
  agile: "Проворная модель",
  warrior: "Модель воина",
  juggernaut: "Модель джаггернаута"
};
export const AUTOMATON_ELEMENTS = {
  cold: "Холод",
  fire: "Огонь",
  lightning: "Электричество",
  psychic: "Психическая энергия",
  thunder: "Гром"
};
export const AUTOMATON_FEATURES = [
  ["model", "Модель Автоматона", 1, 27, gear, ["model"]],
  ["form", "Форма Конструкта", 1, 27, steel],
  ["antimagic", "Восприимчивость к Анти-Магии", 1, 27, furnace, ["antimagic-enter", "antimagic-exit", "dispel"], true],
  ["steel", "Сила и уверенность стали", 2, 28, shield, ["steel"]],
  ["armor", "Бронебойный", 2, 28, steel],
  ["bastion", "Только плоть терпит неудачу", 2, 28, shield, ["bastion", "bastion-end"]],
  ["overload", "Перегрузка", 2, 28, furnace, ["overload"]],
  ["recharge", "Перезарядка", 2, 28, gear, ["recharge"], true],
  ["flesh", "Плоть слаба!", 3, 28, steel],
  ["living", "Живой материал", 3, 28, gear],
  ["flight", "Механизированный полет", 3, 28, steel],
  [
    "equipment",
    "Потустороннее вооружение",
    3,
    29,
    gear,
    ["equipment", "shield", "shard", "charge", "beam", "equipment-end"]
  ],
  ["drain", "Высасывание силы", 3, 29, furnace, ["recharge"], true],
  ["resistance", "Сопротивление заклинаниям", 4, 29, shield, ["immunities"]],
  ["battery", "Дуговая батарея", 4, 29, gear, ["battery-store", "battery-cast"]],
  ["core", "Нестабильное ядро", 4, 29, furnace, ["core"]],
  ["coils", "Реактивные катушки", 4, 30, gear, ["coils", "coils-release"]],
  ["vulnerability", "Уязвимость к Анти-Магии", 4, 30, furnace, ["antimagic-enter", "antimagic-exit", "dispel"], true]
].map(([id, name, level, page, img, operations = [], flaw = false]) => ({
  id,
  key: `automaton-${id}`,
  name,
  level,
  page,
  img,
  operations,
  flaw
}));
export { unlockedTier as automatonUnlockedTier } from "./transformation-core.mjs";
export const automatonSpellIdentity = item =>
  String(item?.system?.identifier || item?.name || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase();
