// Transformation_Chimera.pdf, printed pp.83–86. Browser-safe metadata.
export const CHIMERA_ICON = "icons/creatures/reptiles/dragon-horned-blue.webp";
const dragon = "icons/creatures/abilities/dragon-fire-breath-orange.webp",
  claw = "icons/creatures/claws/claw-bear-paw-swipe-brown.webp",
  shell = "icons/creatures/reptiles/turtle-shell-glowing-green.webp",
  venom = "icons/creatures/abilities/stinger-poison-scorpion-brown.webp";
export const CHIMERA_FEATURES = [
  ["menagerie", "Менажери", 1, 83, CHIMERA_ICON, ["menagerie", "limbs", "contact", "end-contact", "goose"]],
  ["form", "Гибридная форма", 1, 83, CHIMERA_ICON],
  ["aberration", "Химерическая аберрация", 1, 84, CHIMERA_ICON, ["mutation"], true],
  ["knowledge", "Сложное знание", 2, 84, claw, ["knowledge"]],
  ["sting", "Жало виверны", 2, 84, venom, ["sting"]],
  ["medusa", "Волосы Медузы", 2, 84, venom, ["medusa"]],
  ["mimic", "Формы мимика", 2, 84, CHIMERA_ICON, ["mimic", "object-form"]],
  ["bronze", "Аллергия на бронзу", 2, 84, shell, ["bronze"], true],
  ["resistance", "Сопротивление гибрида", 3, 84, shell, ["resistance"]],
  ["breath", "Дыхание дракона", 3, 85, dragon, ["breath-type", "breath"]],
  ["siren", "Голос сирены", 3, 85, CHIMERA_ICON, ["siren"]],
  ["wings", "Крылья грифона", 3, 85, CHIMERA_ICON],
  ["personality", "Нестабильная личность", 3, 85, CHIMERA_ICON, ["personality"], true],
  ["share", "Поделиться амальгамой", 4, 85, CHIMERA_ICON, ["share"]],
  ["hydra", "Регенерация гидры", 4, 85, CHIMERA_ICON],
  ["kraken", "Молнии кракена", 4, 85, dragon, ["kraken"]],
  ["carapace", "Панцирь Тараска", 4, 85, shell],
  ["blood", "Раздражённая кровь", 4, 86, venom, [], true]
].map(([id, name, level, page, img, operations = [], flaw = false]) => ({
  id,
  key: `chimera-${id}`,
  name,
  level,
  page,
  img,
  operations,
  flaw
}));
export const CHIMERA_MENAGERIE = [
  ["limbs", "Конечности хищников", claw],
  ["toad", "Яд лягушкоплава", venom],
  ["goose", "Гогот гуся", CHIMERA_ICON],
  ["turtle", "Панцирь черепахи", shell],
  ["bear", "Выносливость медведя", claw],
  ["wolf", "Чувства волка", claw],
  ["otter", "Мех выдры", claw],
  ["lizard", "Кровь ящерицы", venom],
  ["ram", "Скорость барана", claw],
  ["hare", "Прыжок зайца", claw],
  ["fly", "Реакция мухи", CHIMERA_ICON]
].map(([id, name, img]) => ({ id, key: `chimera-adaptation-${id}`, name, img, level: 1, parent: "menagerie" }));
export const CHIMERA_KNOWLEDGE = [
  ["hawk", "Глаза ястреба", CHIMERA_ICON],
  ["spider", "Ноги паука", claw],
  ["fish", "Жабры рыбы", CHIMERA_ICON]
].map(([id, name, img]) => ({ id, key: `chimera-knowledge-${id}`, name, img, level: 2, parent: "knowledge" }));
export const CHIMERA_ELEMENTS = {
  fire: "Огонь",
  cold: "Холод",
  lightning: "Электричество",
  acid: "Кислота",
  poison: "Яд"
};
export const CHIMERA_MUTATIONS = [
  [
    "fire",
    [
      [1, 5],
      [1, 8],
      [1, 9],
      [1, 11]
    ],
    "Врождённый страх перед огнём, оставшийся от звериных инстинктов: уязвимость к огню."
  ],
  [
    "wisdom",
    [
      [6, 10],
      [9, 16],
      [10, 18],
      [12, 22]
    ],
    "Инстинкты существ разрывают разум: спасброски Мудрости с помехой."
  ],
  [
    "hitdice",
    [
      [11, 15],
      [17, 24],
      [19, 27],
      [23, 33]
    ],
    "Нестабильное тело: при трате костей хитов не добавляйте модификатор Телосложения."
  ],
  [
    "beast",
    [
      [16, 24],
      [25, 32],
      [28, 36],
      [34, 43]
    ],
    "Вы становитесь зверем среди чудовищ и гуманоидов."
  ],
  [
    "speech",
    [
      [25, 32],
      [33, 40],
      [37, 45],
      [44, 52]
    ],
    "Вы составляете только однословные предложения рваным незнакомым голосом. Заклинания с вербальными компонентами всё ещё доступны."
  ],
  [
    "perception",
    [
      [33, 40],
      [41, 48],
      [46, 54],
      [53, 61]
    ],
    "Чувства и разум затуманены: проверки Мудрости (Восприятие) с помехой."
  ],
  [
    "reactions",
    [
      [41, 48],
      [49, 56],
      [55, 63],
      [62, 70]
    ],
    "Невозможно подавить инстинкты: вы не можете совершать реакции."
  ],
  [
    "initiative",
    [
      [49, 56],
      [57, 64],
      [64, 72],
      [71, 77]
    ],
    "Руки обретают собственную волю: проверки Ловкости для инициативы с помехой."
  ],
  [
    "appearance",
    [
      [57, 64],
      [65, 72],
      [73, 80],
      [78, 84]
    ],
    "Кожа дрожит, внешность меняется. Каждые 30 секунд меняется определяющая черта: волосы, лицо или пропорции тела."
  ],
  [
    "none",
    [
      [65, 81],
      [73, 83],
      [81, 89],
      [85, 91]
    ],
    "Ничего не происходит."
  ],
  [
    "poison",
    [
      [82, 91],
      [84, 92],
      [90, 95],
      [92, 96]
    ],
    "Невосприимчивость к состоянию «отравлен» и сопротивление урону ядом."
  ],
  [
    "healing",
    [
      [92, 100],
      [93, 100],
      [96, 100],
      [97, 100]
    ],
    "Получая хиты от не принадлежащего вам заклинания или способности, получаете дополнительно модификатор Телосложения хитов."
  ]
].map(([id, ranges, text], index) => ({ id, ranges, text, index }));
export { unlockedTier as chimeraUnlockedTier } from "./transformation-core.mjs";
export function chimeraMutationFor(roll, tier) {
  return (
    CHIMERA_MUTATIONS.find(
      row =>
        Number(roll) >= row.ranges[Math.max(1, Math.min(4, tier)) - 1][0] &&
        Number(roll) <= row.ranges[Math.max(1, Math.min(4, tier)) - 1][1]
    ) ?? null
  );
}
