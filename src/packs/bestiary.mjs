import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { idFor, MODULE_ID, stats, withAutomationConfig } from "../common.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const statblocksPath = path.join(root, "Statblocks.md");
const gutzPath = path.join(root, "Gutz.md");
const gutzPhaseTwoPath = path.join(root, "Gutz copy.md");
const divineBattleSpellsPath = path.join(root, "Божественные боевые заклинания 1-6 уровней.md");
const statblocksText = readFileSync(statblocksPath, "utf8");
const gutzText = readFileSync(gutzPath, "utf8");
const gutzPhaseTwoText = readFileSync(gutzPhaseTwoPath, "utf8");
const divineBattleSpellsText = readFileSync(divineBattleSpellsPath, "utf8");

const SOURCE = {
  custom: "Statblocks.md: фантомы и сконструированный голем",
  book: "TGoGG",
  page: "Statblocks.md",
  license: "",
  revision: 1,
  rules: "2014"
};

const ICONS = {
  aura: "icons/magic/holy/prayer-hands-glowing-yellow-white.webp",
  book: "icons/skills/trades/academics-book-study-runes.webp",
  bookPurple: "icons/skills/trades/academics-book-study-purple.webp",
  transformation: "icons/magic/symbols/rune-sigil-horned-blue.webp",
  legendaryResistance: "icons/magic/defensive/shield-barrier-flaming-diamond-blue-yellow.webp",
  time: "icons/magic/time/hourglass-tilted-glowing-gold.webp",
  clock: "icons/magic/time/clock-spinning-gold-pink.webp",
  stopwatch: "icons/magic/time/clock-stopwatch-white-blue.webp",
  analysis: "icons/skills/wounds/anatomy-organ-brain-pink-red.webp",
  flow: "icons/magic/control/silhouette-aura-energy.webp",
  summon: "icons/magic/holy/angel-winged-humanoid-blue.webp",
  constructor: "icons/magic/symbols/runes-etched-steel-blade.webp",
  lair: "icons/magic/symbols/runes-carved-stone-purple.webp",
  holyBlade: "icons/magic/light/swords-light-glowing-white.webp",
  greatsword: "icons/skills/melee/maneuver-greatsword-yellow.webp",
  slash: "icons/skills/melee/strike-slashes-red.webp",
  bladeStorm: "icons/skills/melee/sword-twirl-orange.webp",
  worldCut: "icons/skills/melee/strike-sword-slashing-red.webp",
  dash: "icons/creatures/magical/humanoid-silhouette-dashing-blue.webp",
  bloodRage: "icons/magic/unholy/projectiles-blood-salvo-red.webp",
  death: "icons/magic/death/skull-energy-light-purple.webp",
  anatomy: "icons/skills/wounds/anatomy-organ-brain-pink-red.webp",
  parry: "icons/skills/melee/swords-parry-block-blue.webp",
  silence: "icons/magic/sonic/scream-wail-shout-teal.webp",
  step: "icons/skills/movement/figure-running-gray.webp",
  chains: "icons/magic/control/debuff-chains-shackles-movement-blue.webp",
  shield: "icons/magic/defensive/shield-barrier-blades-teal.webp",
  defaultSpell: "icons/magic/holy/prayer-hands-glowing-yellow.webp",
  defaultFeature: "icons/magic/symbols/rune-sigil-white-pink.webp"
};

const SPELL_SCHOOL_ICONS = {
  abj: "icons/magic/defensive/shield-barrier-glowing-triangle-blue.webp",
  con: "icons/magic/symbols/runes-star-pentagon-blue.webp",
  div: "icons/magic/perception/eye-ringed-glow-angry-teal.webp",
  enc: "icons/magic/control/hypnosis-mesmerism-eye.webp",
  evo: "icons/magic/holy/projectiles-blades-salvo-yellow.webp",
  ill: "icons/magic/control/silhouette-aura-energy.webp",
  nec: "icons/magic/death/skull-energy-light-purple.webp",
  trs: "icons/magic/symbols/runes-triangle-orange.webp"
};

const BOSS_ITEM_ICONS = new Map([
  ["Аура Просвещения", ICONS.aura],
  ["Легендарное сопротивление", ICONS.legendaryResistance],
  ["Архивариус Трансформаций", ICONS.transformation],
  ["Живая Библиотека", ICONS.book],
  ["Живая Библиотека: все заклинания жреца и паладина", ICONS.book],
  ["Мультиатака — Аналитическое воздействие", ICONS.analysis],
  ["Клинок Истины", ICONS.holyBlade],
  ["Таймкод Изменений", ICONS.time],
  ["Откат уязвимости", ICONS.clock],
  ["Коррекция ошибок", ICONS.stopwatch],
  ["Эффект обучения", ICONS.aura],
  ["Саркастический анализ", ICONS.analysis],
  ["Редактирование Потока", ICONS.flow],
  ["Это уже было в истории", ICONS.bookPurple],
  ["Лень разбираться", ICONS.analysis],
  ["Призыв Хроник Мастерства", ICONS.summon],
  ["Правило боя", ICONS.summon],
  ["Вариант 1 — Ослабленные", ICONS.summon],
  ["Вариант 2 — Усиленные", ICONS.summon],
  ["Конструктор Заклинаний Гатца", ICONS.constructor],
  ["Действия логова", ICONS.lair],
  ["Диктующие условия", ICONS.lair],
  ["Двойное Возвышение Престижа", ICONS.transformation],
  ["Парадокс Кровавой Ярости", ICONS.bloodRage],
  ["Удар возвращает жизнь", ICONS.bloodRage],
  ["Одиночество и увядание", ICONS.death],
  ["Сверхъестественная анатомия", ICONS.anatomy],
  ["Мультиатака — Стальное сечение", ICONS.greatsword],
  ["Клинок Силы", ICONS.greatsword],
  ["Разрушение доспехов", ICONS.slash],
  ["Мёртвая зона", ICONS.slash],
  ["Заготовленный приём", ICONS.bladeStorm],
  ["Прицельные рывки", ICONS.dash],
  ["Шторм клинков", ICONS.bladeStorm],
  ["Разрубание мира", ICONS.worldCut],
  ["Упреждающий выпад", ICONS.silence],
  ["Скользящий шаг", ICONS.step],
  ["Перенятый опыт", ICONS.transformation],
  ["Наказание за промах", ICONS.chains],
  ["Встречное парирование", ICONS.parry],
  ["Перенаправление силы", ICONS.parry],
  ["Анатомический укол", ICONS.anatomy],
  ["Анатомическое фехтование", ICONS.greatsword],
  ["Разрушение стойки", ICONS.slash],
  ["Разрыв сухожилий", ICONS.anatomy],
  ["Глухая пешая защита", ICONS.shield]
]);

const BESTIARY_FOLDER = idFor("folder:bestiary-phantoms");

const ART_BY_TITLE = new Map([
  ["Фантом: Воин Тьмы", "Dark_warrior.png"],
  ["Фантом: Абберант", "Abberant.png"],
  ["Фантом: Ведьмин Клинок", "Witch_blade.png"],
  ["Фантом: Владыка Насекомых", "Insect_lord.png"],
  ["Фантом: Воитель Фей", "Fej_warrior.png"],
  ["Фантом: Демонолог", "Demonolog.png"],
  ["Фантом: Джаггернаут", "Juggernaut.png"],
  ["Фантом: Дьяволопоклонник", "Devil_contracter.png"],
  ["Фантом: Еретик", "Heretic (2).png"],
  ["Фантом: Харроуер (Картёжник)", "Gambler.png"],
  ["Фантом: Крестоносец", "Crusader.png"],
  ["Фантом: Лесной Владыка", "Forest_lord.png"],
  ["Фантом: Лидер", "Leader.png"],
  ["Фантом: Маг Крови", "Blood_mage.png"],
  ["Фантом: Мерцающий", "Blinker.png"],
  ["Фантом: Нетерийский Арканист", "Netheril_arcanist.png"],
  ["Фантом: Онмёдзи", "Onmiedzi.png"],
  ["Фантом: Оракул", "Oracle.png"],
  ["Фантом: Падший Жрец", "Fallen_priest.png"],
  ["Фантом: Пожиратель Душ", "Soul_eater.png"],
  ["Фантом: Призрачный Странник", "Soul_traveler.png"],
  ["Фантом: Ритуалист", "Ritualist.png"],
  ["Фантом: Сокрушитель", "Crusher.png"],
  ["Фантом: Сосуд Духа", "Sosud_ducha.png"],
  ["Фантом: Страж", "Guardian.png"],
  ["Фантом: Хранитель", "Hranitel.png"],
  ["Сконструированный голем", "Marionetka.png"],
  ["Фантом: Чумной Доктор", "Plague_doctor.png"],
  ["Гатц, Хранитель Вечного Гримуара(фаза 1)", "Boss_art/phase1.png"],
  ["Гатц, Хранитель Вечного Гримуара(фаза 2)", "Boss_art/phase2.png"]
]);

const SIZE_MAP = new Map([
  ["крошечный", "tiny"],
  ["маленький", "sm"],
  ["маленькая", "sm"],
  ["средний", "med"],
  ["средняя", "med"],
  ["большой", "lg"],
  ["большая", "lg"],
  ["огромный", "huge"],
  ["огромная", "huge"],
  ["гигантский", "grg"]
]);

const TYPE_PATTERNS = [
  [/гуманоид/i, "humanoid"],
  [/конструкт/i, "construct"],
  [/нежить/i, "undead"],
  [/исчад/i, "fiend"],
  [/аберрац/i, "aberration"],
  [/фе[ея]/i, "fey"],
  [/звер/i, "beast"],
  [/растен/i, "plant"],
  [/дракон/i, "dragon"],
  [/великан/i, "giant"],
  [/элементал/i, "elemental"],
  [/монстр/i, "monstrosity"],
  [/слиз/i, "ooze"]
];

const ABILITY_LABELS = new Map([
  ["Сил", "str"],
  ["Лов", "dex"],
  ["Тел", "con"],
  ["Инт", "int"],
  ["Мдр", "wis"],
  ["Хар", "cha"]
]);

const SKILL_DATA = {
  acr: { ability: "dex", aliases: ["Акробатика"] },
  ani: { ability: "wis", aliases: ["Уход за животными"] },
  arc: { ability: "int", aliases: ["Аркана", "Магия"] },
  ath: { ability: "str", aliases: ["Атлетика"] },
  dec: { ability: "cha", aliases: ["Обман"] },
  his: { ability: "int", aliases: ["История"] },
  ins: { ability: "wis", aliases: ["Проницательность"] },
  itm: { ability: "cha", aliases: ["Запугивание"] },
  inv: { ability: "int", aliases: ["Расследование"] },
  med: { ability: "wis", aliases: ["Медицина"] },
  nat: { ability: "int", aliases: ["Природа"] },
  prc: { ability: "wis", aliases: ["Восприятие"] },
  prf: { ability: "cha", aliases: ["Выступление"] },
  per: { ability: "cha", aliases: ["Убеждение"] },
  rel: { ability: "int", aliases: ["Религия"] },
  slt: { ability: "dex", aliases: ["Ловкость рук"] },
  ste: { ability: "dex", aliases: ["Скрытность"] },
  sur: { ability: "wis", aliases: ["Выживание"] }
};

const DAMAGE_PATTERNS = [
  [/дробящ/i, "bludgeoning"],
  [/колющ/i, "piercing"],
  [/рубящ/i, "slashing"],
  [/кислот/i, "acid"],
  [/холод/i, "cold"],
  [/огн|огонь|огня/i, "fire"],
  [/силов/i, "force"],
  [/молн/i, "lightning"],
  [/некрот/i, "necrotic"],
  [/яд|яда|отрав/i, "poison"],
  [/псих/i, "psychic"],
  [/излуч|сияющ|лучист/i, "radiant"],
  [/гром/i, "thunder"]
];

const CONDITION_PATTERNS = [
  [/ослеп/i, "blinded"],
  [/очарован/i, "charmed"],
  [/оглох/i, "deafened"],
  [/испуг/i, "frightened"],
  [/схвачен/i, "grappled"],
  [/недееспособ/i, "incapacitated"],
  [/невидим/i, "invisible"],
  [/парализ/i, "paralyzed"],
  [/окамен/i, "petrified"],
  [/отрав/i, "poisoned"],
  [/сбит/i, "prone"],
  [/опутан|обездвиж/i, "restrained"],
  [/ошелом|оглуш/i, "stunned"],
  [/без созн/i, "unconscious"],
  [/истощ/i, "exhaustion"]
];

const LANGUAGE_PATTERNS = [
  [/общ/i, "common"],
  [/бездн/i, "abyssal"],
  [/адск/i, "infernal"],
  [/небес/i, "celestial"],
  [/дракон/i, "draconic"],
  [/эльф/i, "elvish"],
  [/дварф|дворф/i, "dwarvish"],
  [/велик/i, "giant"],
  [/глубин/i, "deep"],
  [/подзем/i, "undercommon"],
  [/сильван/i, "sylvan"],
  [/первич/i, "primordial"],
  [/друид/i, "druidic"]
];

export const folders = [{
  name: "Фантомы и монстры",
  sorting: "a",
  folder: null,
  type: "Actor",
  _id: BESTIARY_FOLDER,
  description: "",
  color: "#5b1717",
  flags: {},
  sort: 0,
  _stats: stats()
}];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
}

function markdownToHtml(value) {
  const trimmed = String(value)
    .replace(/^---$/gm, "")
    .trim();
  if (!trimmed) return "";
  return trimmed
    .split(/\n{2,}/)
    .map(part => `<p>${inlineMarkdown(part.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function artRelativePath(fileName) {
  return fileName.includes("/") || fileName.includes("\\")
    ? fileName
    : `character arts/${fileName}`;
}

function moduleArtPath(fileName) {
  const encoded = artRelativePath(fileName)
    .split(/[\\/]/)
    .map(part => encodeURIComponent(part))
    .join("/");
  return `modules/${MODULE_ID}/assets/${encoded}`;
}

function localArtPath(fileName) {
  return path.join(root, "assets", ...artRelativePath(fileName).split(/[\\/]/));
}

function slug(value) {
  return String(value)
    .normalize("NFKD")
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/giu, "-")
    .replace(/^-|-$/g, "");
}

function iconForBossEntry(name, fallback, { attack = null } = {}) {
  if (BOSS_ITEM_ICONS.has(name)) return BOSS_ITEM_ICONS.get(name);
  if (attack?.classification === "spell") return SPELL_SCHOOL_ICONS.evo;
  if (attack?.attackType === "melee") return ICONS.greatsword;
  if (/клинок|меч|удар|сечение|разруб|клинк/i.test(name)) return ICONS.greatsword;
  if (/время|таймкод|хрон|истори/i.test(name)) return ICONS.time;
  if (/книга|библиотек|гримуар|архив/i.test(name)) return ICONS.book;
  if (/защит|сопротив|щит/i.test(name)) return ICONS.shield;
  return fallback;
}

function iconForSpell(spell) {
  if (/цепи/i.test(spell.title)) return ICONS.chains;
  if (/крыл/i.test(spell.title)) return "icons/magic/holy/angel-wings-gray.webp";
  if (/молитв|литани|отпущ/i.test(spell.title)) return "icons/magic/holy/prayer-hands-glowing-yellow-green.webp";
  if (/колокол|труба/i.test(spell.title)) return "icons/magic/sonic/bell-alarm-red-purple.webp";
  if (/печать|обет|купол/i.test(spell.title)) return SPELL_SCHOOL_ICONS.abj;
  if (/рана|погреб/i.test(spell.title)) return SPELL_SCHOOL_ICONS.nec;
  return SPELL_SCHOOL_ICONS[spell.school] ?? ICONS.defaultSpell;
}

function field(block, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return block.match(new RegExp(`^\\*\\*${escaped}\\*\\*\\s*(.+)$`, "m"))?.[1]?.trim() ?? "";
}

function parseSigned(value) {
  const match = String(value).match(/[+-]\d+/);
  return match ? Number(match[0]) : 0;
}

function parseNumber(value) {
  const normalized = String(value).replace(/\s/g, "");
  if (normalized.includes("/")) {
    const [left, right] = normalized.split("/").map(Number);
    return right ? left / right : 0;
  }
  return Number(normalized.match(/\d+(?:\.\d+)?/)?.[0] ?? 0);
}

function russianDiceToFoundry(formula) {
  return String(formula)
    .replace(/[кК]/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

function abilityModifier(score) {
  return Math.floor((Number(score) - 10) / 2);
}

function defaultAbilities() {
  return Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(ability => [
    ability,
    {
      value: 10,
      proficient: 0,
      bonuses: {
        check: "",
        save: ""
      },
      max: null
    }
  ]));
}

function defaultSkills() {
  return Object.fromEntries(Object.entries(SKILL_DATA).map(([key, data]) => [
    key,
    {
      value: 0,
      ability: data.ability,
      bonuses: {
        check: "",
        passive: ""
      },
      roll: {
        min: null,
        max: null,
        mode: 0
      }
    }
  ]));
}

function parseAbilities(block) {
  const abilities = defaultAbilities();
  for (const match of block.matchAll(/^\|\s*(Сил|Лов|Тел|Инт|Мдр|Хар)\s*\|\s*(\d+)/gm)) {
    const ability = ABILITY_LABELS.get(match[1]);
    abilities[ability].value = Number(match[2]);
  }
  return abilities;
}

function proficiencyBonus(block) {
  return parseSigned(field(block, "ПО").match(/Б[УМ]\s*[+-]\d+/i)?.[0] ?? "");
}

function applySaves(block, abilities, prof) {
  for (const match of field(block, "Спасброски").matchAll(/([А-ЯЁа-яё]+)\s*([+-]\d+)/g)) {
    const ability = ABILITY_LABELS.get(match[1].trim());
    if (!ability) continue;
    const target = Number(match[2]);
    const abilityMod = abilityModifier(abilities[ability].value);
    if (target === abilityMod + prof) abilities[ability].proficient = 1;
    else abilities[ability].bonuses.save = String(target - abilityMod);
  }
}

function skillKeyByName(name) {
  const normalized = name.trim().toLocaleLowerCase("ru");
  for (const [key, data] of Object.entries(SKILL_DATA)) {
    if (data.aliases.some(alias => alias.toLocaleLowerCase("ru") === normalized)) return key;
  }
  return null;
}

function applySkills(block, skills, abilities, prof) {
  for (const match of field(block, "Навыки").matchAll(/([А-ЯЁа-яё ]+?)\s*([+-]\d+)/g)) {
    const key = skillKeyByName(match[1]);
    if (!key) continue;
    const skill = skills[key];
    const target = Number(match[2]);
    const abilityMod = abilityModifier(abilities[skill.ability].value);
    if (target === abilityMod + prof) skill.value = 1;
    else if (target === abilityMod + prof * 2) skill.value = 2;
    else skill.bonuses.check = String(target - abilityMod);
  }
}

function parseCreatureLine(block) {
  const line = block
    .split("\n")
    .map(part => part.trim())
    .find(part => /^\*\*[^*]+\*\*$/.test(part) && !part.startsWith("**КД"));
  const raw = line?.replace(/^\*\*|\*\*$/g, "") ?? "";
  const [typePart = "", alignment = ""] = raw.split(",").map(part => part.trim());
  const lower = typePart.toLocaleLowerCase("ru");
  const size = [...SIZE_MAP.entries()].find(([key]) => lower.includes(key))?.[1] ?? "med";
  const type = TYPE_PATTERNS.find(([pattern]) => pattern.test(typePart))?.[1] ?? "custom";
  return {
    raw,
    size,
    type,
    alignment,
    customType: type === "custom" ? typePart : ""
  };
}

function parseArmorClass(block) {
  return parseNumber(field(block, "КД"));
}

function parseHitPoints(block) {
  const hp = field(block, "Хиты");
  return {
    value: parseNumber(hp),
    formula: russianDiceToFoundry(hp.match(/\(([^)]+)\)/)?.[1] ?? "")
  };
}

function parseMovement(block) {
  const raw = field(block, "Скорость").toLocaleLowerCase("ru");
  const movement = {
    burrow: 0,
    climb: 0,
    fly: 0,
    swim: 0,
    walk: 0,
    units: "ft",
    hover: /парени|зависан/i.test(raw)
  };
  const first = raw.match(/(\d+)\s*фут/);
  if (first) movement.walk = Number(first[1]);
  const checks = [
    ["fly", /пол[её]т\s*(\d+)\s*фут/i],
    ["swim", /плавани[ея]\s*(\d+)\s*фут/i],
    ["climb", /лазани[ея]\s*(\d+)\s*фут/i],
    ["burrow", /копани[ея]\s*(\d+)\s*фут/i]
  ];
  for (const [key, pattern] of checks) {
    const match = raw.match(pattern);
    if (match) movement[key] = Number(match[1]);
  }
  return movement;
}

function valuesFromPatterns(raw, patterns) {
  const values = [];
  for (const [pattern, value] of patterns) {
    if (pattern.test(raw) && !values.includes(value)) values.push(value);
  }
  return values;
}

function parseDamageTrait(raw) {
  if (!raw || /—|-|нет/i.test(raw.trim())) {
    return {
      value: [],
      bypasses: [],
      custom: ""
    };
  }
  const value = valuesFromPatterns(raw, DAMAGE_PATTERNS);
  const bypasses = [];
  if (/немагич/i.test(raw)) bypasses.push("mgc");
  if (/адамант/i.test(raw)) bypasses.push("ada");
  return {
    value,
    bypasses,
    custom: value.length ? "" : raw
  };
}

function parseConditionImmunities(raw) {
  return {
    value: valuesFromPatterns(raw, CONDITION_PATTERNS),
    custom: raw && !valuesFromPatterns(raw, CONDITION_PATTERNS).length ? raw : ""
  };
}

function parseLanguages(raw) {
  return {
    value: valuesFromPatterns(raw, LANGUAGE_PATTERNS),
    custom: raw
  };
}

function parseSenses(raw) {
  const senses = {
    darkvision: 0,
    blindsight: 0,
    tremorsense: 0,
    truesight: 0,
    units: "ft",
    special: ""
  };
  const checks = [
    ["darkvision", /т[её]мное зрение\s*(\d+)/i],
    ["blindsight", /слепое зрение\s*(\d+)/i],
    ["tremorsense", /чувство вибрации\s*(\d+)/i],
    ["truesight", /истинное зрение\s*(\d+)/i]
  ];
  for (const [key, pattern] of checks) {
    const match = raw.match(pattern);
    if (match) senses[key] = Number(match[1]);
  }
  return senses;
}

function parseCr(block) {
  return parseNumber(field(block, "ПО"));
}

function section(block, names) {
  const headings = [...block.matchAll(/^(#{2,3})\s+(.+)$/gm)];
  for (let index = 0; index < headings.length; index += 1) {
    if (!names.includes(headings[index][2].trim())) continue;
    const start = headings[index].index + headings[index][0].length;
    const end = headings[index + 1]?.index ?? block.length;
    return block.slice(start, end).trim();
  }
  return "";
}

function isEntryStart(line) {
  const match = line.match(/^\*\*([^*]+)\*\*(.*)$/);
  if (!match) return false;
  const title = match[1].trim();
  const tail = match[2].trimStart();
  if (title.endsWith(":")) return false;
  return title.endsWith(".") || tail.startsWith(".") || /^\*?\([^)]*\)\*?\./.test(tail);
}

function entryStart(line) {
  const match = line.match(/^\*\*([^*]+)\*\*(.*)$/);
  const rawTitle = match?.[1]?.trim() ?? "";
  const tail = match?.[2] ?? "";
  const title = rawTitle.replace(/\.$/, "").trim();
  const note = tail.match(/^\s*(\*?\([^)]*\)\*?\.?)/)?.[1] ?? "";
  const text = tail
    .replace(/^\s*\*?\([^)]*\)\*?\./, "")
    .replace(/^\s*\./, "")
    .trim();
  return {
    title,
    lines: [note, text].filter(Boolean),
    raw: line
  };
}

function parseEntries(text) {
  const entries = [];
  let current = null;
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line === "---") continue;
    if (/^#{2,3}\s+/.test(line)) continue;
    if (isEntryStart(line)) {
      if (current) entries.push(current);
      current = entryStart(line);
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) entries.push(current);
  return entries.map(entry => ({
    title: entry.title,
    text: entry.lines.join("\n").trim()
  }));
}

function parseDamageType(raw) {
  return valuesFromPatterns(raw, DAMAGE_PATTERNS)[0] ?? "";
}

function damagePart(formula, rawType) {
  const foundryFormula = russianDiceToFoundry(formula);
  const type = parseDamageType(rawType);
  const match = foundryFormula.match(/^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/i);
  if (!match) {
    return {
      number: null,
      denomination: null,
      bonus: "",
      types: type ? [type] : [],
      custom: {
        enabled: true,
        formula: foundryFormula
      },
      scaling: {
        mode: "",
        number: null,
        formula: ""
      }
    };
  }
  return {
    number: Number(match[1]),
    denomination: Number(match[2]),
    bonus: match[3] ? `${match[3] === "-" ? "-" : ""}${match[4]}` : "",
    types: type ? [type] : [],
    custom: {
      enabled: false,
      formula: ""
    },
    scaling: {
      mode: "whole",
      number: null,
      formula: ""
    }
  };
}

function parseAttack(entryText) {
  const text = entryText.replace(/\n/g, " ");
  if (!/(?:Рукопашная|Дальнобойная)\s+атака\s+(?:оружием|заклинанием):\s*[+-]\d+\s+к попаданию/i.test(text)) return null;
  const attackBonus = Number(text.match(/([+-]\d+)\s+к попаданию/i)?.[1] ?? 0);
  const rangeMatch = text.match(/дистанция\s+(\d+)(?:\s*\/\s*(\d+))?/i);
  const reachMatch = text.match(/досягаемость\s+(\d+)/i);
  const damageText = text.match(/\*\*Попадание:\*\*\s*(.+)$/i)?.[1] ?? text;
  const damageMatches = [...damageText.matchAll(/\((\d+\s*[кd]\s*\d+(?:\s*[+-]\s*\d+)?)\)\s*([а-яё -]+?)\s+урон[а-я]*/giu)];
  const directDamageMatches = [...damageText.matchAll(/(\d+\s*[кd]\s*\d+(?:\s*[+-]\s*\d+)?)\s+([а-яё -]+?)\s+урон[а-я]*/giu)];
  const flatDamageMatches = [...damageText.matchAll(/плюс\s+(\d+)\s+([а-яё -]+?)\s+урон[а-я]*/giu)];
  const damageParts = [
    ...damageMatches.map(match => damagePart(match[1], match[2])),
    ...directDamageMatches.map(match => damagePart(match[1], match[2])),
    ...flatDamageMatches.map(match => damagePart(match[1], match[2]))
  ].filter((part, index, parts) => (
    parts.findIndex(candidate => JSON.stringify(candidate) === JSON.stringify(part)) === index
  ));
  return {
    attackBonus,
    range: rangeMatch ? Number(rangeMatch[1]) : Number(reachMatch?.[1] ?? 5),
    longRange: rangeMatch?.[2] ? Number(rangeMatch[2]) : null,
    attackType: /дальнобойная/i.test(text) ? "ranged" : "melee",
    classification: /заклинанием/i.test(text) ? "spell" : "weapon",
    damageParts
  };
}

function saveAbilityFromText(text) {
  const checks = [
    [/сил/i, "str"],
    [/ловк/i, "dex"],
    [/телослож/i, "con"],
    [/интеллект/i, "int"],
    [/мудрост/i, "wis"],
    [/харизм/i, "cha"]
  ];
  return checks.find(([pattern]) => pattern.test(text))?.[1] ?? "wis";
}

function parseSaveEffect(entryText) {
  const text = entryText.replace(/\n/g, " ");
  const dcMatch = text.match(/Сл\s*(\d+)/i);
  if (!dcMatch || !/спасброс/i.test(text)) return null;
  const abilityContext = text.slice(Math.max(0, dcMatch.index - 90), dcMatch.index);
  const damageText = text.split(/До начала следующего хода|Существо, впервые|Объекты и немагические/i)[0];
  return {
    ability: saveAbilityFromText(abilityContext),
    dc: Number(dcMatch[1]),
    damageParts: parseSpellDamageParts(damageText),
    onSave: /половин/i.test(text) ? "half" : "none"
  };
}

function parseUtilityRollFormula(entryText) {
  const text = entryText.replace(/\n/g, " ");
  const match = text.match(/(\d+\s*[кd]\s*\d+(?:\s*[+-]\s*\d+)?)/i);
  return match ? russianDiceToFoundry(match[1]) : "";
}

function parseUses(entryText) {
  const text = entryText.replace(/\n/g, " ");
  const match = text.match(/(\d+)\s*\/\s*день/i);
  if (!match) {
    return {
      max: "",
      spent: 0,
      recovery: []
    };
  }
  return {
    max: match[1],
    spent: 0,
    recovery: [{
      period: "lr",
      type: "recoverAll"
    }]
  };
}

function makeActivity({ key, activation, attack = null, save = null, rollFormula = "", rollName = "" }) {
  const activityId = idFor(`activity:${key}`);
  if (attack) {
    return {
      [activityId]: {
        _id: activityId,
        type: "attack",
        activation: {
          type: activation,
          value: 1,
          condition: "",
          override: false
        },
        consumption: {
          targets: [],
          scaling: {
            allowed: false,
            max: ""
          },
          spellSlot: true
        },
        description: {
          chatFlavor: ""
        },
        duration: {
          concentration: false,
          value: "",
          units: "inst",
          special: "",
          override: false
        },
        effects: [],
        range: {
          value: String(attack.range || 5),
          units: "ft",
          special: "",
          override: false
        },
        target: {
          template: {
            count: "",
            contiguous: false,
            type: "",
            size: "",
            width: "",
            height: "",
            units: ""
          },
          affects: {
            count: "1",
            type: "",
            choice: false,
            special: ""
          },
          prompt: true,
          override: false
        },
        uses: {
          spent: 0,
          max: "",
          recovery: []
        },
        attack: {
          ability: "none",
          bonus: attack.attackBonus ? String(attack.attackBonus) : "",
          critical: {
            threshold: null
          },
          flat: true,
          type: {
            value: attack.attackType,
            classification: attack.classification
          }
        },
        damage: {
          critical: {
            bonus: ""
          },
          includeBase: true,
          parts: attack.damageParts.slice(1)
        },
        sort: 0
      }
    };
  }
  if (save) {
    return {
      [activityId]: {
        _id: activityId,
        type: "save",
        activation: {
          type: activation,
          value: 1,
          condition: "",
          override: false
        },
        consumption: {
          targets: [],
          scaling: {
            allowed: false,
            max: ""
          },
          spellSlot: true
        },
        description: {
          chatFlavor: ""
        },
        duration: {
          concentration: false,
          value: "",
          units: "inst",
          special: "",
          override: false
        },
        effects: [],
        range: {
          units: "ft",
          special: "",
          override: false
        },
        target: {
          template: {
            count: "",
            contiguous: false,
            type: "",
            size: "",
            width: "",
            height: "",
            units: ""
          },
          affects: {
            count: "",
            type: "",
            choice: false,
            special: ""
          },
          prompt: true,
          override: false
        },
        uses: {
          spent: 0,
          max: "",
          recovery: []
        },
        damage: {
          onSave: save.onSave,
          parts: save.damageParts
        },
        save: {
          ability: save.ability,
          dc: {
            calculation: "",
            formula: String(save.dc)
          }
        },
        sort: 0
      }
    };
  }
  return {
    [activityId]: {
      _id: activityId,
      type: "utility",
      activation: {
        type: activation,
        value: 1,
        condition: "",
        override: false
      },
      consumption: {
        targets: [],
        scaling: {
          allowed: false,
          max: ""
        },
        spellSlot: true
      },
      description: {
        chatFlavor: ""
      },
      duration: {
        concentration: false,
        value: "",
        units: "",
        special: "",
        override: false
      },
      effects: [],
      range: {
        units: "",
        special: "",
        override: false
      },
      target: {
        template: {
          count: "",
          contiguous: false,
          type: "",
          size: "",
          width: "",
          height: "",
          units: ""
        },
        affects: {
          count: "",
          type: "",
          choice: false,
          special: ""
        },
        prompt: true,
        override: false
      },
      uses: {
        spent: 0,
        max: "",
        recovery: []
      },
      roll: {
        formula: rollFormula,
        name: rollName,
        prompt: Boolean(rollFormula),
        visible: false
      },
      sort: 0
    }
  };
}

function baseEmbeddedItem({ actorKey, key, name, type, img, system }) {
  return {
    _id: idFor(`actor-item:${actorKey}:${key}`),
    name,
    type,
    img,
    system,
    effects: [],
    folder: null,
    sort: 0,
    ownership: {
      default: 0
    },
    flags: withAutomationConfig({
      [MODULE_ID]: {
        bestiary: true
      }
    }, { key, type: "bestiary-item" }),
    _stats: stats()
  };
}

function featureItem({ actorKey, key, name, img, text, activation }) {
  const save = parseSaveEffect(text);
  const rollFormula = parseUtilityRollFormula(text);
  const activities = activation === "none"
    ? {}
    : {
        ...(save
          ? makeActivity({ key: `${actorKey}:${key}:save`, activation, save })
          : makeActivity({
              key: `${actorKey}:${key}:utility`,
              activation,
              rollFormula,
              rollName: rollFormula ? "Бросок эффекта" : ""
            })),
        ...(save && rollFormula && !save.damageParts.length
          ? makeActivity({
              key: `${actorKey}:${key}:roll`,
              activation,
              rollFormula,
              rollName: "Бросок эффекта"
            })
          : {})
      };
  return baseEmbeddedItem({
    actorKey,
    key,
    name,
    type: "feat",
    img,
    system: {
      description: {
        value: markdownToHtml(text),
        chat: ""
      },
      source: SOURCE,
      uses: parseUses(text),
      type: {
        value: "monster",
        subtype: ""
      },
      requirements: "",
      activities,
      enchant: {},
      prerequisites: {
        level: null
      },
      properties: [],
      identifier: key
    }
  });
}

function weaponItem({ actorKey, key, name, img, text, activation, attack }) {
  const baseDamage = attack.damageParts[0] ?? damagePart("0", "");
  return baseEmbeddedItem({
    actorKey,
    key,
    name,
    type: "weapon",
    img,
    system: {
      description: {
        value: markdownToHtml(`[[/attack extended]]. [[/damage extended]].\n\n${text}`),
        chat: markdownToHtml(text)
      },
      source: SOURCE,
      quantity: 1,
      weight: {
        value: 0,
        units: "lb"
      },
      price: {
        value: 0,
        denomination: "gp"
      },
      attunement: "",
      equipped: true,
      rarity: "",
      identified: true,
      cover: null,
      range: {
        value: attack.attackType === "ranged" ? attack.range : null,
        long: attack.longRange,
        units: "ft",
        reach: attack.attackType === "melee" ? attack.range : null
      },
      uses: {
        max: "",
        spent: 0,
        recovery: []
      },
      damage: {
        versatile: {
          number: null,
          denomination: null,
          bonus: "",
          types: [],
          custom: {
            enabled: false,
            formula: ""
          },
          scaling: {
            mode: "",
            number: null,
            formula: ""
          }
        },
        base: baseDamage
      },
      armor: {
        value: 10
      },
      hp: {
        value: 0,
        max: 0,
        dt: null,
        conditions: ""
      },
      properties: [],
      proficient: 1,
      unidentified: {
        description: ""
      },
      type: {
        value: attack.classification === "spell" ? "natural" : "natural",
        baseItem: ""
      },
      container: null,
      crewed: false,
      activities: makeActivity({ key: `${actorKey}:${key}`, activation, attack }),
      attuned: false,
      ammunition: {},
      magicalBonus: null,
      identifier: key,
      mastery: ""
    }
  });
}

const SCHOOL_MAP = new Map([
  ["ограждение", "abj"],
  ["вызов", "con"],
  ["прорицание", "div"],
  ["очарование", "enc"],
  ["воплощение", "evo"],
  ["иллюзия", "ill"],
  ["некромантия", "nec"],
  ["преобразование", "trs"]
]);

const SAVE_MAP = new Map([
  ["Сила", "str"],
  ["Ловкость", "dex"],
  ["Телосложение", "con"],
  ["Интеллект", "int"],
  ["Мудрость", "wis"],
  ["Харизма", "cha"]
]);

function spellField(block, label) {
  return field(block, `${label}:`).replace(/^\s*/, "");
}

function parseSpellActivation(raw) {
  const lower = raw.toLocaleLowerCase("ru");
  if (lower.includes("реакция")) {
    return {
      type: "reaction",
      value: 1,
      condition: raw.replace(/^1\s+реакция,?\s*/i, "").trim()
    };
  }
  if (lower.includes("бонус")) {
    return {
      type: "bonus",
      value: 1,
      condition: ""
    };
  }
  return {
    type: "action",
    value: 1,
    condition: ""
  };
}

function parseSpellRange(raw) {
  const lower = raw.toLocaleLowerCase("ru");
  if (lower.includes("на себя") || lower.includes("сам")) {
    return {
      value: null,
      units: "self",
      special: ""
    };
  }
  const value = raw.match(/(\d+)/)?.[1] ?? "";
  return {
    value,
    units: value ? "ft" : "",
    special: value ? "" : raw
  };
}

function parseSpellDuration(raw) {
  const lower = raw.toLocaleLowerCase("ru");
  const concentration = lower.includes("концентра");
  if (lower.includes("мгнов")) {
    return {
      concentration,
      value: "",
      units: "inst",
      special: "",
      override: false
    };
  }
  const value = raw.match(/(\d+)/)?.[1] ?? "";
  let units = "";
  if (lower.includes("минут")) units = "minute";
  else if (lower.includes("час")) units = "hour";
  else if (lower.includes("раунд")) units = "round";
  return {
    concentration,
    value,
    units,
    special: value ? "" : raw,
    override: false
  };
}

function parseSpellTarget(block) {
  const area = spellField(block, "Область");
  const target = {
    affects: {
      count: "",
      type: "",
      choice: false,
      special: ""
    },
    template: {
      count: "",
      contiguous: false,
      type: "",
      size: "",
      width: "",
      height: "",
      units: ""
    },
    prompt: true,
    override: false
  };
  if (!area) return target;
  const size = area.match(/(\d+)/)?.[1] ?? "";
  target.template.size = size;
  target.template.units = size ? "ft" : "";
  if (/сфер/i.test(area)) target.template.type = "sphere";
  else if (/конус/i.test(area)) target.template.type = "cone";
  else if (/линия/i.test(area)) target.template.type = "line";
  else if (/куб/i.test(area)) target.template.type = "cube";
  else target.template.type = "";
  return target;
}

function spellComponents(raw) {
  const properties = [];
  if (/(^|[, ])В([, )]|$)/.test(raw)) properties.push("vocal");
  if (/(^|[, ])С([, )]|$)/.test(raw)) properties.push("somatic");
  if (/(^|[, ])М([, (]|$)/.test(raw)) properties.push("material");
  return properties;
}

function parseSpellDamageParts(text) {
  const beforeWord = [...text.matchAll(/(\d+\s*[кd]\s*\d+(?:\s*[+-]\s*\d+)?)\s+([а-яё -]+?)\s+урон[а-я]*/giu)]
    .map(match => damagePart(match[1], match[2]));
  const afterWord = [...text.matchAll(/(\d+\s*[кd]\s*\d+(?:\s*[+-]\s*\d+)?)\s+урон[а-я]*\s+([а-яё -]+)/giu)]
    .map(match => damagePart(match[1], match[2]));
  return [...beforeWord, ...afterWord].filter((part, index, parts) => (
    part.types.length && parts.findIndex(candidate => JSON.stringify(candidate) === JSON.stringify(part)) === index
  ));
}

function parseSpellHealFormula(text) {
  return russianDiceToFoundry(text.match(/(\d+\s*[кd]\s*\d+(?:\s*[+-]\s*\d+)?)\s+хит/iu)?.[1] ?? "");
}

function spellActivity({ key, spell, activation, duration, range, target, saveAbility, damageParts, healFormula, isAttack }) {
  const activityId = idFor(`activity:${key}`);
  const common = {
    _id: activityId,
    activation: {
      ...activation,
      override: false
    },
    consumption: {
      targets: [],
      scaling: {
        allowed: false,
        max: ""
      },
      spellSlot: false
    },
    description: {
      chatFlavor: ""
    },
    duration,
    effects: [],
    range: {
      ...range,
      override: false
    },
    target,
    uses: {
      spent: 0,
      max: "",
      recovery: []
    },
    sort: 0
  };

  if (isAttack) {
    return {
      [activityId]: {
        ...common,
        type: "attack",
        attack: {
          ability: "none",
          bonus: "17",
          critical: {
            threshold: null
          },
          flat: true,
          type: {
            value: "ranged",
            classification: "spell"
          }
        },
        damage: {
          critical: {
            bonus: ""
          },
          includeBase: true,
          parts: damageParts
        }
      }
    };
  }

  if (saveAbility) {
    return {
      [activityId]: {
        ...common,
        type: "save",
        damage: {
          onSave: /половин/i.test(spell.text) ? "half" : "none",
          parts: damageParts
        },
        save: {
          ability: saveAbility,
          dc: {
            calculation: "",
            formula: "25"
          }
        }
      }
    };
  }

  return {
    [activityId]: {
      ...common,
      type: "utility",
      roll: {
        formula: healFormula,
        name: healFormula ? "Лечение" : "",
        prompt: Boolean(healFormula),
        visible: false
      }
    }
  };
}

function splitDivineSpellBlocks(text) {
  const sections = [...text.matchAll(/^# Заклинания (\d+) уровня$/gm)];
  const spells = [];
  for (let index = 0; index < sections.length; index += 1) {
    const level = Number(sections[index][1]);
    const start = sections[index].index + sections[index][0].length;
    const end = sections[index + 1]?.index ?? text.length;
    const sectionText = text.slice(start, end);
    const starts = [...sectionText.matchAll(/^## (.+)$/gm)].filter(match => match[1] !== "Сводная таблица");
    for (let spellIndex = 0; spellIndex < starts.length; spellIndex += 1) {
      const blockStart = starts[spellIndex].index;
      const blockEnd = starts[spellIndex + 1]?.index ?? sectionText.length;
      const block = sectionText.slice(blockStart, blockEnd).trim();
      const title = block.match(/^##\s+(.+)$/m)?.[1]?.trim();
      if (!title) continue;
      spells.push({
        level,
        title,
        block
      });
    }
  }
  return spells;
}

function parseDivineSpell(spellBlock) {
  const { level, title, block } = spellBlock;
  const meta = block.match(/^\*\*(\d+)\s+уровень,\s*([^*]+)\*\*/m);
  const schoolName = meta?.[2]?.trim().toLocaleLowerCase("ru") ?? "";
  const text = block
    .replace(/^##\s+.+$/m, "")
    .trim();
  const activation = parseSpellActivation(spellField(block, "Время накладывания"));
  const range = parseSpellRange(spellField(block, "Дистанция"));
  const duration = parseSpellDuration(spellField(block, "Длительность"));
  const saveName = spellField(block, "Спасбросок");
  const saveAbility = [...SAVE_MAP.entries()].find(([name]) => saveName.includes(name))?.[1] ?? "";
  const damageParts = parseSpellDamageParts(text);
  const healFormula = parseSpellHealFormula(text);
  const isAttack = /атак[ау] заклинанием/i.test(text);
  return {
    level,
    title,
    text,
    school: SCHOOL_MAP.get(schoolName) ?? "evo",
    activation,
    range,
    duration,
    target: parseSpellTarget(block),
    properties: spellComponents(spellField(block, "Компоненты")),
    materials: spellField(block, "Компоненты").match(/М\s*\(([^)]+)\)/)?.[1] ?? "",
    saveAbility,
    damageParts,
    healFormula,
    isAttack
  };
}

function divineSpellItem({ actorKey, spell }) {
  const key = `divine-battle-spell-${slug(spell.title)}`;
  return baseEmbeddedItem({
    actorKey,
    key,
    name: spell.title,
    type: "spell",
    img: iconForSpell(spell),
    system: {
      description: {
        value: `${markdownToHtml(spell.text)}<hr><p><strong>Гатц:</strong> это заклинание добавлено из файла «Божественные боевые заклинания 1-6 уровней.md». Оно накладывается без расхода ячеек. Сл спасброска 25, бонус атаки заклинанием +17.</p>`,
        chat: ""
      },
      source: {
        ...SOURCE,
        custom: "Божественные боевые заклинания 1-6 уровней.md"
      },
      activation: spell.activation,
      duration: spell.duration,
      target: spell.target,
      range: spell.range,
      uses: {
        max: "",
        spent: 0,
        recovery: []
      },
      level: spell.level,
      school: spell.school,
      materials: {
        value: spell.materials,
        consumed: false,
        cost: 0,
        supply: 0
      },
      preparation: {
        mode: "innate",
        prepared: true
      },
      properties: spell.properties,
      activities: spellActivity({
        key: `${actorKey}:${key}`,
        spell,
        activation: spell.activation,
        duration: spell.duration,
        range: spell.range,
        target: spell.target,
        saveAbility: spell.saveAbility,
        damageParts: spell.damageParts,
        healFormula: spell.healFormula,
        isAttack: spell.isAttack
      }),
      identifier: key
    }
  });
}

function embeddedItemsForBlock(actorKey, block, img) {
  const sections = [
    {
      activation: "none",
      text: section(block, ["Особенности"])
    },
    {
      activation: "action",
      text: section(block, ["Действия", "Действия голема"])
    },
    {
      activation: "bonus",
      text: section(block, ["Бонусные действия"])
    },
    {
      activation: "reaction",
      text: section(block, ["Реакции", "Реакция голема"])
    },
    {
      activation: "legendary",
      text: section(block, ["Легендарные действия"])
    },
    {
      activation: "none",
      text: section(block, ["Залы Вечных Сюжетов"])
    }
  ];
  const items = [];
  for (const currentSection of sections) {
    for (const entry of parseEntries(currentSection.text)) {
      const key = `${slug(entry.title)}-${items.length + 1}`;
      const fullText = `**${entry.title}.** ${entry.text}`.trim();
      const attack = parseAttack(fullText);
      const itemImg = iconForBossEntry(entry.title, img, { attack });
      items.push(attack
        ? weaponItem({
            actorKey,
            key,
            name: entry.title,
            img: itemImg,
            text: fullText,
            activation: currentSection.activation === "none" ? "action" : currentSection.activation,
            attack
          })
        : featureItem({
            actorKey,
            key,
            name: entry.title,
            img: itemImg,
            text: fullText,
            activation: currentSection.activation
          }));
    }
  }
  return items;
}

function actorSystem(block) {
  const creature = parseCreatureLine(block);
  const abilities = parseAbilities(block);
  const prof = proficiencyBonus(block);
  applySaves(block, abilities, prof);
  const skills = defaultSkills();
  applySkills(block, skills, abilities, prof);
  const hp = parseHitPoints(block);
  return {
    abilities,
    attributes: {
      ac: {
        flat: parseArmorClass(block),
        calc: "natural",
        formula: ""
      },
      hp: {
        value: hp.value,
        max: hp.value,
        temp: null,
        tempmax: null,
        formula: hp.formula
      },
      init: {
        ability: "",
        bonus: String(parseSigned(field(block, "Инициатива"))),
        roll: {
          min: null,
          max: null,
          mode: 0
        }
      },
      movement: parseMovement(block),
      attunement: {
        max: 3
      },
      senses: parseSenses(field(block, "Чувства")),
      spellcasting: "",
      exhaustion: 0,
      concentration: {
        ability: "",
        roll: {
          min: null,
          max: null,
          mode: 0
        },
        bonuses: {
          save: ""
        },
        limit: 1
      },
      hd: {
        spent: 0
      },
      death: {
        ability: "",
        roll: {
          min: null,
          max: null,
          mode: 0
        },
        success: 0,
        failure: 0
      }
    },
    details: {
      biography: {
        value: markdownToHtml(block),
        public: ""
      },
      alignment: creature.alignment,
      race: null,
      type: {
        value: creature.type,
        subtype: "",
        swarm: "",
        custom: creature.customType
      },
      environment: "",
      cr: parseCr(block),
      spellLevel: 0,
      ideal: "",
      bond: "",
      flaw: ""
    },
    traits: {
      size: creature.size,
      di: parseDamageTrait(field(block, "Иммунитеты к урону")),
      dr: parseDamageTrait(field(block, "Сопротивления урону")),
      dv: parseDamageTrait(field(block, "Уязвимости")),
      ci: parseConditionImmunities(field(block, "Иммунитеты к состояниям")),
      languages: parseLanguages(field(block, "Языки")),
      dm: {
        amount: {},
        bypasses: []
      }
    },
    currency: {
      pp: 0,
      gp: 0,
      ep: 0,
      sp: 0,
      cp: 0
    },
    skills,
    spells: Object.fromEntries(["spell0", "spell1", "spell2", "spell3", "spell4", "spell5", "spell6", "spell7", "spell8", "spell9", "pact"].map(key => [
      key,
      {
        value: 0,
        override: null
      }
    ])),
    bonuses: {
      mwak: {
        attack: "",
        damage: ""
      },
      rwak: {
        attack: "",
        damage: ""
      },
      msak: {
        attack: "",
        damage: ""
      },
      rsak: {
        attack: "",
        damage: ""
      },
      abilities: {
        check: "",
        save: "",
        skill: ""
      },
      spell: {
        dc: ""
      }
    },
    resources: {
      legact: {
        value: 0,
        max: 0
      },
      legres: {
        value: 0,
        max: 0
      },
      lair: {
        value: false,
        initiative: null
      }
    },
    tools: {},
    source: SOURCE
  };
}

function tokenSize(size) {
  if (size === "lg") return 2;
  if (size === "huge") return 3;
  if (size === "grg") return 4;
  return 1;
}

function prototypeToken(name, img, size) {
  const dimension = tokenSize(size);
  return {
    name,
    displayName: 20,
    actorLink: false,
    width: dimension,
    height: dimension,
    lockRotation: false,
    rotation: 0,
    disposition: -1,
    displayBars: 20,
    bar1: {
      attribute: "attributes.hp"
    },
    bar2: {
      attribute: null
    },
    flags: {},
    randomImg: false,
    alpha: 1,
    light: {
      alpha: 1,
      angle: 360,
      bright: 0,
      coloration: 1,
      dim: 0,
      luminosity: 0.5,
      saturation: 0,
      contrast: 0,
      shadows: 0,
      animation: {
        speed: 5,
        intensity: 5,
        type: null,
        reverse: false
      },
      darkness: {
        min: 0,
        max: 1
      },
      color: null,
      attenuation: 0.5,
      negative: false,
      priority: 0
    },
    texture: {
      src: img,
      tint: "#ffffff",
      scaleX: 1,
      scaleY: 1,
      anchorX: 0.5,
      anchorY: 0.5,
      fit: "contain",
      alphaThreshold: 0.75
    },
    sight: {
      angle: 360,
      enabled: false,
      range: 60,
      brightness: 0,
      visionMode: "basic",
      color: null,
      attenuation: 0.1,
      saturation: 0,
      contrast: 0,
      shadows: 0
    },
    detectionModes: {},
    appendNumber: false,
    prependAdjective: false,
    occludable: {
      radius: 0
    },
    ring: {
      enabled: false,
      colors: {
        ring: null,
        background: null
      },
      effects: 1,
      subject: {
        scale: 1,
        texture: null
      }
    },
    turnMarker: {
      mode: 1,
      animation: null,
      src: null,
      disposition: false
    },
    movementAction: null,
    depth: 1
  };
}

function splitCreatureBlocks(text) {
  const starts = [...text.matchAll(/^## (?=(?:Фантом:|Сконструированный голем))/gm)].map(match => match.index);
  return starts.map((start, index) => text.slice(start, starts[index + 1] ?? text.length).trim());
}

function validateArt() {
  for (const [title, file] of ART_BY_TITLE) {
    if (!existsSync(localArtPath(file))) throw new Error(`Missing character art for ${title}: ${file}`);
  }
}

function isGutzPhaseOne(title) {
  return title === "Гатц, Хранитель Вечного Гримуара(фаза 1)";
}

function isGutzPhaseTwo(title) {
  return title === "Гатц, Хранитель Вечного Гримуара(фаза 2)";
}

function isGutzBoss(title) {
  return isGutzPhaseOne(title) || isGutzPhaseTwo(title);
}

function gutzSpellAccessFeature(actorKey, img) {
  return featureItem({
    actorKey,
    key: "gutz-cleric-paladin-spell-access",
    name: "Живая Библиотека: все заклинания жреца и паладина",
    img: BOSS_ITEM_ICONS.get("Живая Библиотека: все заклинания жреца и паладина") ?? img,
    activation: "none",
    text: [
      "**Живая Библиотека: все заклинания жреца и паладина.** Гатц имеет доступ ко всем заклинаниям из списков жреца и паладина, а также к боевым божественным заклинаниям, добавленным на этот лист отдельными карточками.",
      "",
      "Он не тратит ячейки заклинаний. Для заклинаний Гатца используется Сл спасброска 25 и бонус атаки заклинанием +17."
    ].join("\n")
  });
}

function gutzDivineBattleSpellItems(actorKey) {
  const spellBlocks = splitDivineSpellBlocks(divineBattleSpellsText);
  if (spellBlocks.length !== 24) {
    throw new Error(`Expected 24 divine battle spells, got ${spellBlocks.length}`);
  }
  return spellBlocks
    .map(parseDivineSpell)
    .map(spell => divineSpellItem({ actorKey, spell }));
}

function actorFromBlock(block) {
  const title = block.match(/^##\s+(.+)$/m)?.[1]?.trim();
  if (!title) throw new Error("Statblock without title");
  const fileName = ART_BY_TITLE.get(title);
  if (!fileName) throw new Error(`No art mapping for statblock: ${title}`);
  const img = moduleArtPath(fileName);
  const key = `bestiary:${slug(title)}`;
  const system = actorSystem(block);
  if (isGutzBoss(title)) {
    system.attributes.spellcasting = "wis";
    system.resources.legact = {
      value: 3,
      max: 3
    };
    system.resources.lair = {
      value: true,
      initiative: 20
    };
  }
  if (isGutzPhaseTwo(title)) {
    system.attributes.hp.temp = 200;
  }
  const embeddedItems = [
    ...embeddedItemsForBlock(key, block, img),
    ...(isGutzBoss(title)
      ? [
          gutzSpellAccessFeature(key, img),
          ...gutzDivineBattleSpellItems(key)
        ]
      : [])
  ];
  return {
    _id: idFor(key),
    name: title,
    type: "npc",
    img,
    items: embeddedItems.map(item => item._id),
    effects: [],
    folder: BESTIARY_FOLDER,
    sort: 0,
    ownership: {
      default: 0
    },
    flags: withAutomationConfig({
      [MODULE_ID]: {
        bestiaryNpc: true,
        source: "Statblocks.md"
      }
    }, { key, type: "npc" }),
    system,
    prototypeToken: prototypeToken(title, img, system.traits.size),
    _stats: stats(),
    _embeddedItems: embeddedItems
  };
}

validateArt();

const blocks = splitCreatureBlocks(statblocksText);
if (blocks.length !== 28) {
  throw new Error(`Expected 28 statblocks in Statblocks.md, got ${blocks.length}`);
}

export const documents = blocks.map(actorFromBlock);
documents.push(actorFromBlock(gutzText.trim()));
documents.push(actorFromBlock(gutzPhaseTwoText.trim()));
