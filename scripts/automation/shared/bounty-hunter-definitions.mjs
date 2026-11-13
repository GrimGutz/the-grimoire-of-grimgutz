// Explicit rules, shared by authored cards and runtime; never infer mechanics from prose.
export const HUNTER_ID = "bounty-hunter";
export const HUNTER_ICON = "icons/commodities/bones/skull-hollow-brown.webp";
export const HUNTER_TIERS = {
  minor: { name: "Малый", cost: 2, level: 1, cr: 10 },
  medium: { name: "Средний", cost: 3, level: 3, cr: 15 },
  major: { name: "Великий", cost: 4, level: 5, cr: 20 }
};
export const HUNTER_TYPES = [
  [
    "aberration",
    "аберрации",
    "icons/commodities/treasure/gem-framed-spiral-purple.webp",
    ["passive", "mental-reroll", "mental-burst"]
  ],
  ["beast", "зверя", "icons/commodities/claws/claws-bear-brown-white.webp", ["move", "passive", "charge-hit"]],
  [
    "celestial",
    "небожителя",
    "icons/commodities/treasure/token-cross-gem-yellow.webp",
    ["heal", "cleanse", "avert-death"]
  ],
  [
    "construct",
    "конструкта",
    "icons/commodities/treasure/token-silver-gem-cut.webp",
    ["passive", "reduce-damage", "miss-retry"]
  ],
  ["dragon", "дракона", "icons/commodities/bones/skull-lizard-brown.webp", ["fear", "breath", "passive"]],
  [
    "elemental",
    "элементаля",
    "icons/commodities/treasure/token-gold-gem-red.webp",
    ["passive", "passive-hit", "storm"]
  ],
  ["fey", "феи", "icons/commodities/treasure/token-gold-gem-purple.webp", ["passive", "teleport", "sleep"]],
  ["fiend", "исчадия", "icons/commodities/bones/skull-hollow-brown-red.webp", ["fire-hit", "kill-temp", "chains"]],
  ["giant", "великана", "icons/commodities/bones/horn-antler-brown.webp", ["prevent-movement", "passive", "giant-hit"]],
  [
    "humanoid",
    "гуманоида",
    "icons/commodities/treasure/cup-trophy-gold.webp",
    ["passive", "modify-roll", "allied-attacks"]
  ],
  [
    "monstrosity",
    "чудовища",
    "icons/commodities/claws/claw-spiked-gold.webp",
    ["passive", "grapple-hit", "passive-hit"]
  ],
  [
    "ooze",
    "слизи",
    "icons/commodities/biological/finger-clawed-green-black.webp",
    ["escape", "acid-reaction", "passive"]
  ],
  [
    "plant",
    "растения",
    "icons/consumables/plants/heart-cordate-leaf-yellow-green.webp",
    ["passive", "roots", "regeneration"]
  ],
  ["undead", "нежити", "icons/commodities/bones/skull-bird-brown.webp", ["passive", "undead-temp", "undead-hit"]]
].map(([type, title, icon, modes]) => ({ type, title, icon, modes }));
export const HUNTER_TROPHIES = HUNTER_TYPES.flatMap(entry =>
  Object.entries(HUNTER_TIERS).map(([tier, spec], i) => ({
    ...spec,
    tier,
    creatureType: entry.type,
    key: `hunter-${entry.type}-${tier}`,
    name: `${spec.name} трофей ${entry.title}`,
    title: `Трофей ${entry.title}`,
    icon: entry.icon,
    mode: entry.modes[i],
    passive: entry.modes[i].startsWith("passive")
  }))
);
export const HUNTER_CORE = [
  ["trophies", "Добыча трофеев", 1],
  ["disposable", "Одноразовые трофеи", 1],
  ["breakdown", "Разбор", 1],
  ["pursuit", "Гон добычи", 2],
  ["duel", "Один на один", 2],
  ["medium", "Средний трофей", 3],
  ["combination", "Комбинация", 3],
  ["ability-improvement", "Увеличение характеристик", 4],
  ["major", "Великий трофей", 5],
  ["rekindle", "Разжигание охоты", 5]
].map(([id, name, level]) => ({ id, name, level, key: `hunter-${id}` }));
export const hunterMaximum = level => (level > 0 ? [4, 7, 10, 13, 16][Math.min(5, Math.floor(level)) - 1] : 0);
export const hunterDie = level => (level >= 5 ? 10 : level >= 3 ? 8 : 6);
export const trophyDefinition = item => HUNTER_TROPHIES.find(entry => entry.key === item?.system?.identifier) ?? null;
export const hunterTierChoices = level =>
  Object.entries(HUNTER_TIERS)
    .filter(([, spec]) => level >= spec.level)
    .map(([tier]) => tier);
