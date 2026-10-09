import { abilityMod } from "./dnd5e.mjs";
import { registerSummonRecipe } from "./summons.mjs";

function abilityValues(actor) {
  return Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(ability => [
    ability,
    Number(actor?.system?.abilities?.[ability]?.value ?? 10)
  ]));
}

function actorSize(actor, fallback = "med") {
  return actor?.system?.traits?.size ?? fallback;
}

function actorAc(actor, fallback = 10) {
  return Number(actor?.system?.attributes?.ac?.value ?? actor?.system?.attributes?.ac?.flat ?? fallback);
}

function actorHpMax(actor, fallback = 1) {
  return Math.max(1, Number(actor?.system?.attributes?.hp?.max ?? actor?.system?.attributes?.hp?.value ?? fallback));
}

function onmyojiLevel(actor) {
  return Number(actor?.items?.find(item => item.type === "class" && item.system?.identifier === "onmyoji")?.system?.levels ?? 0);
}

function ownerSpellAttack(actor) {
  const spell = actor?.system?.attributes?.spell;
  return Math.max(
    Number(spell?.attack?.value ?? Number.NEGATIVE_INFINITY),
    Number(actor?.system?.attributes?.prof ?? 0) + abilityMod(actor, "wis")
  );
}

function ownerSpellDamage(actor) {
  const mod = abilityMod(actor, "wis");
  return mod >= 0 ? `+ ${mod}` : `- ${Math.abs(mod)}`;
}

export function quasitFamiliarSummon(actor) {
  return {
    kind: "demonologist-quasit-familiar",
    unique: true,
    name: `${actor.name}: Инфернальный фамильяр`,
    img: "icons/creatures/unholy/demon-horned-winged-laughing.webp",
    source: "infernal-familiar",
    size: "tiny",
    type: "fiend",
    subtype: "demon, shapechanger",
    ac: 13,
    hp: 7,
    hpFormula: "3d4",
    cr: 1,
    abilities: { str: 5, dex: 17, con: 10, int: 7, wis: 10, cha: 10 },
    movement: { walk: 40 },
    senses: { darkvision: 120 },
    dr: { value: ["cold", "fire", "lightning"], custom: "дробящий, колющий и рубящий урон от немагических атак" },
    di: { value: ["poison"] },
    ci: { value: ["poisoned"] },
    languages: { value: ["abyssal", "common"], custom: "" },
    description: `
      <p><strong>Квазит-фамильяр Демонолога.</strong> Если у персонажа уже был фамильяр, по правилу класса квазит занимает его место.</p>
      <p>Статблок создан как рабочий токен для Foundry. При необходимости замените атаки и особенности на точный статблок из бестиария кампании.</p>
    `,
    features: [
      {
        name: "Укус/когти квазита",
        activities: [{ name: "Укус/когти", attackBonus: 4, formula: "1d4 + 3", damageType: "piercing" },
          { name: "Яд квазита", type: "save", formula: "2d4", damageType: "poison", saveAbility: "con", dc: 10 }],
        description: "<p>Рукопашная атака: +4 к попаданию, 1d4 + 3 колющего урона, цель совершает спасбросок Телосложения СЛ 10 или получает 2d4 урона ядом и отравлена на 1 минуту.</p>"
      },
      {
        name: "Пугающий облик",
        activities: [{ name: "Спасбросок от испуга", type: "save", formula: "0", saveAbility: "wis", dc: 10, range: 20 }],
        description: "<p>Одно существо в пределах 20 футов совершает спасбросок Мудрости СЛ 10 или испугано на 1 минуту.</p>"
      },
      {
        name: "Невидимость и смена формы",
        description: "<p>Квазит может становиться невидимым и принимать малые звериные формы по обычным правилам квазита.</p>"
      }
    ],
    note: "Фамильяр создан как уникальный призыв: повторное использование не создаёт второго актёра."
  };
}

export function impFamiliarSummon(actor) {
  return {
    kind: "devil-worshipper-imp-familiar",
    unique: true,
    name: `${actor.name}: Бесовский фамильяр`,
    img: "icons/creatures/unholy/demon-winged-crouched-red.webp",
    source: "imp-familiar",
    size: "tiny",
    type: "fiend",
    subtype: "devil, shapechanger",
    ac: 13,
    hp: 10,
    hpFormula: "3d4 + 3",
    cr: 1,
    abilities: { str: 6, dex: 17, con: 13, int: 11, wis: 12, cha: 14 },
    movement: { walk: 20, fly: 40 },
    senses: { darkvision: 120 },
    dr: { value: ["cold"], custom: "дробящий, колющий и рубящий урон от немагических атак, не посеребрённого оружия" },
    di: { value: ["fire", "poison"] },
    ci: { value: ["poisoned"] },
    languages: { value: ["infernal", "common"], custom: "" },
    description: `
      <p><strong>Бесовский фамильяр Дьяволопоклонника.</strong> Если у персонажа уже был фамильяр, бес занимает его место.</p>
      <p>Статблок создан как рабочий токен для Foundry. При необходимости замените детали на точный статблок беса из бестиария кампании.</p>
    `,
    features: [
      {
        name: "Жало беса",
        activities: [{ name: "Жало", attackBonus: 5, formula: "1d4 + 3", damageType: "piercing" },
          { name: "Яд беса", type: "save", formula: "3d6", damageType: "poison", saveAbility: "con", dc: 11, onSave: "half" }],
        description: "<p>Рукопашная атака: +5 к попаданию, 1d4 + 3 колющего урона, цель совершает спасбросок Телосложения СЛ 11 или получает 3d6 урона ядом, половину при успехе.</p>"
      },
      {
        name: "Невидимость, магическое сопротивление и смена формы",
        description: "<p>Бес может становиться невидимым, имеет преимущество на спасброски против заклинаний и других магических эффектов и может менять форму по обычным правилам беса.</p>"
      }
    ],
    note: "Фамильяр создан как уникальный призыв: повторное использование не создаёт второго актёра."
  };
}

export function shikigamiSummon(actor) {
  const empowered = onmyojiLevel(actor) >= 5;
  const attackBonus = ownerSpellAttack(actor);
  const damageBonus = ownerSpellDamage(actor);
  return {
    kind: "onmyoji-shikigami",
    unique: true,
    name: `${actor.name}: Шикигами`,
    img: "icons/commodities/materials/parchment-secrets.webp",
    source: "shikigami-talisman",
    size: "tiny",
    type: "celestial",
    customType: "дух-фамильяр",
    ac: empowered ? 15 : 13,
    hp: empowered ? 2 : 1,
    hpFormula: "",
    abilities: { str: 3, dex: 13, con: 8, int: 8, wis: 12, cha: 7 },
    movement: { walk: 5, fly: 60 },
    senses: { darkvision: 60 },
    languages: { value: [], custom: "понимает языки Онмёджи" },
    description: `
      <p><strong>Шикигами Онмёджи.</strong> Считается фамильяром-совой, но имеет КД ${empowered ? 15 : 13} и может проходить через немагические двери и окна.</p>
      <p>${empowered ? "На 5-м уровне хиты Шикигами удвоены, а атаки используют модификатор атаки владельца." : "На 3-м уровне может принимать форму среднего зверя ПО не выше 1/4; форму выберите вручную."}</p>
    `,
    features: [
      {
        name: "Атака Шикигами",
        activities: empowered ? [{ name: "Атака Шикигами выбранной формы", attackBonus,
          condition: "Владелец потратил бонусное действие; урон задаёт выбранная форма" }] : [],
        description: `<p>Если Онмёджи тратит бонусное действие, Шикигами может атаковать. На 5-м уровне используйте бонус атаки владельца: <strong>+${attackBonus}</strong>; урон выбранной формы может добавлять модификатор Мудрости владельца (${damageBonus}).</p>`
      },
      {
        name: "Духовная форма",
        description: "<p>Шикигами может проходить через немагические двери и окна. Если бумажное тело уничтожено, создайте новое за 2 зм и 10 минут.</p>"
      }
    ],
    note: "Если Шикигами отпущен как фамильяр, вручную примените соответствующий бонус КД/виспов владельцу."
  };
}

export function ghostWalkerSpiritSummon(actor, targetActor = null) {
  const targetHp = targetActor ? actorHpMax(targetActor, 20) : 20;
  const hp = Math.max(1, Math.floor(targetHp / 2));
  const targetName = targetActor?.name ?? "умершего существа";
  return {
    kind: "ghost-walker-unfinished-business",
    unique: false,
    name: `${actor.name}: дух ${targetName}`,
    img: targetActor?.img ?? "icons/magic/death/undead-ghost-scream-teal.webp",
    source: "unfinished-business",
    lifecycle: { seconds: 60 },
    extraItems: [...(targetActor?.items ?? [])].filter(item => ["weapon", "feat"].includes(item.type)
      && [...(item.system?.activities?.values?.() ?? [])].some(activity => activity.type === "attack"))
      .map(item => item.toObject()),
    size: actorSize(targetActor, "med"),
    type: "undead",
    ac: actorAc(targetActor, 12),
    hp,
    hpFormula: "",
    abilities: targetActor ? abilityValues(targetActor) : { str: 10, dex: 12, con: 10, int: 10, wis: 10, cha: 10 },
    movement: { walk: Number(targetActor?.system?.attributes?.movement?.walk ?? 30) || 30, fly: 30, hover: true },
    senses: { darkvision: 60 },
    dr: { value: ["necrotic"], custom: "дробящий, колющий и рубящий урон от немагического не посеребрённого оружия" },
    dv: { value: ["radiant"], custom: "серебряное или посеребрённое оружие" },
    ci: { value: ["poisoned", "exhaustion"] },
    languages: { value: [], custom: "понимает словесные команды призвавшего" },
    description: `
      <p><strong>Незавершённое дело.</strong> Дух создан из выбранного токена или как универсальный дух, если цель не была выбрана.</p>
      <p>Проверьте вручную, что тело умерло за последнюю минуту и ПО существа не выше 5.</p>
      <p>Хиты духа равны половине максимума исходного существа: <strong>${hp}</strong>.</p>
    `,
    features: [
      {
        name: "Приказ",
        description: "<p>Призрачный странник отдаёт духу приказ как при заклинании Внушение. Дух исчезает, когда задача выполнена, его хиты падают до 0, он изгнан/рассеян или проходит 1 минута.</p>"
      }
    ],
    note: "Если нужен точный статблок умершего существа, используйте созданного актёра как заготовку и скорректируйте атаки/особенности вручную."
  };
}

registerSummonRecipe("shikigami-talisman", owner => shikigamiSummon(owner));
registerSummonRecipe("infernal-familiar", owner => quasitFamiliarSummon(owner));
registerSummonRecipe("imp-familiar", owner => impFamiliarSummon(owner));

