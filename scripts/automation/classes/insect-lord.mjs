import { FLAGS, MODULE_ID, SETTINGS } from "../shared/constants.mjs";
import {
  automationData,
  findFeature,
  isAutomationAuthority,
  itemIdentifier,
  notify
} from "../shared/helpers.mjs";
import { abilityMod } from "../shared/dnd5e.mjs";
import { choiceDialog } from "../shared/dialogs.mjs";
import {
  flaggedPassiveEffectData,
  syncFlaggedPassiveEffects
} from "../effects/passive-helpers.mjs";
import { createSummonedCreature, registerSummonRecipe } from "../shared/summons.mjs";

const insectLordSyncs = new Set();
const insectLordPassiveSyncs = new Set();

export function insectLordClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "insect-lord");
}

export function insectLordLevel(actor) {
  return Number(insectLordClass(actor)?.system?.levels ?? 0);
}

function hasSkillProficiency(actor, key) {
  const skill = actor?.system?.skills?.[key];
  const value = Number(skill?.value ?? skill?.proficient ?? 0);
  return value > 0 || skill?.proficient === true;
}

export function insectLordPrerequisiteFailures(actor) {
  const failures = [];
  if (!hasSkillProficiency(actor, "nat")) failures.push("владение навыком Природа");
  if (!hasSkillProficiency(actor, "ste")) failures.push("владение навыком Скрытность");
  if (Number(actor?.system?.details?.level ?? 0) < 5) failures.push("5-й уровень персонажа");
  return failures;
}

export function validateInsectLordPrerequisites(item, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  if (!actor || item.type !== "class" || itemIdentifier(item) !== "insect-lord") return true;
  const failures = insectLordPrerequisiteFailures(actor);
  if (failures.length) {
    notify(`Нельзя добавить класс «Владыка насекомых». Не выполнено: ${failures.join(", ")}. Посвящение разумным насекомоподобным существом подтверждает Мастер.`, "error");
    return false;
  }
  return true;
}

export function validateInsectLordFeaturePrerequisites(item, options, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  const data = automationData(item);
  if (!actor || data.insectLordFeature !== true || options?.isAdvancement) return true;
  const level = insectLordLevel(actor);
  if (!level) {
    notify(`Особенность «${item.name}» требует класс «Владыка насекомых».`, "error");
    return false;
  }
  const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
  if (requiredLevel && level < requiredLevel) {
    notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Владыки насекомых.`, "error");
    return false;
  }
  return true;
}

function currentMax(item) {
  return String(item?.system?.uses?.max ?? "");
}

async function syncUses(feature, maximum) {
  if (!feature) return false;
  const max = String(Math.max(0, maximum));
  const spent = Number(feature.system?.uses?.spent ?? 0);
  const update = {};
  if (currentMax(feature) !== max) update["system.uses.max"] = max;
  if (Number.isFinite(spent) && spent > Number(max)) update["system.uses.spent"] = Number(max);
  if (!Object.keys(update).length) return false;
  await feature.update(update);
  return true;
}

export async function syncInsectLordResources(actor, { notifyResult = false } = {}) {
  if (!actor?.isOwner || !isAutomationAuthority(actor) || insectLordSyncs.has(actor.uuid)) return false;
  if (!insectLordClass(actor)) return false;

  insectLordSyncs.add(actor.uuid);
  try {
    const constitutionUses = Math.max(1, abilityMod(actor, "con"));
    const updates = [
      await syncUses(findFeature(actor, "crawling-armor"), 1),
      await syncUses(findFeature(actor, "spew-insects"), constitutionUses)
    ];
    const changed = updates.some(Boolean);
    if (notifyResult && changed) notify(`${actor.name}: ресурсы Владыки насекомых синхронизированы.`);
    return changed;
  } finally {
    insectLordSyncs.delete(actor.uuid);
  }
}

function equippedArmor(actor) {
  return actor?.items?.some(item => {
    if (item.type !== "equipment" || item.system?.equipped !== true) return false;
    const type = String(
      item.system?.type?.value
      ?? item.system?.armor?.type
      ?? item.system?.type
      ?? ""
    ).toLowerCase();
    return ["light", "medium", "heavy", "lgt", "med", "hvy"].includes(type);
  }) ?? false;
}

function insectLordPassiveDefinitions(actor) {
  if (!insectLordClass(actor)) return [];
  const definitions = [];
  const carapace = findFeature(actor, "chitinous-carapace");
  if (carapace && !equippedArmor(actor)) {
    definitions.push(flaggedPassiveEffectData(MODULE_ID, FLAGS.INSECT_LORD_PASSIVE, {
      key: "chitinous-carapace",
      feature: carapace,
      changes: [{
        key: "system.attributes.ac.bonus",
        type: "add",
        value: String(insectLordLevel(actor) >= 5 ? 5 : 3),
        phase: "final",
        priority: 20
      }]
    }));
  }
  return definitions;
}

export async function syncInsectLordPassiveEffects(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  return syncFlaggedPassiveEffects(actor, insectLordPassiveSyncs, MODULE_ID, FLAGS.INSECT_LORD_PASSIVE, insectLordPassiveDefinitions);
}

function bestPhysicalModifier(actor) {
  return Math.max(abilityMod(actor, "str"), abilityMod(actor, "dex"));
}

function signed(number) {
  return number >= 0 ? `+ ${number}` : `- ${Math.abs(number)}`;
}

function insectLordSaveDc(actor) {
  return 8 + Number(actor?.system?.attributes?.prof ?? 0) + abilityMod(actor, "con");
}

async function rollToChat(actor, formula, flavor) {
  const roll = await new Roll(formula, actor.getRollData()).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor
  });
  return roll;
}

export async function rollInsectTailSting(actor) {
  if (!actor || !findFeature(actor, "insect-natural-weapons")) {
    notify("Для броска требуется особенность «Природное оружие» Владыки насекомых.", "warn");
    return false;
  }
  const modifier = bestPhysicalModifier(actor);
  await rollToChat(actor, `1d4 ${signed(modifier)}`, "Хвост с жалом: колющий урон");
  await rollToChat(actor, "2d6", `Хвост с жалом: урон ядом; спасбросок Телосложения Сл ${insectLordSaveDc(actor)}, половина при успехе`);
  return true;
}

export async function rollInsectBoneBlades(actor) {
  if (!actor || !findFeature(actor, "insect-natural-weapons")) {
    notify("Для броска требуется особенность «Природное оружие» Владыки насекомых.", "warn");
    return false;
  }
  const modifier = bestPhysicalModifier(actor);
  await rollToChat(actor, `1d8 ${signed(modifier)}`, "Костяные клинки: режущий урон");
  return true;
}

export async function rollInsectBite(actor) {
  if (!actor || !findFeature(actor, "blood-drain")) {
    notify("Для броска требуется особенность «Высасывание крови».", "warn");
    return false;
  }
  await rollToChat(actor, "1d4", "Жвалы: колющий урон");
  return true;
}

export async function rollInsectBloodDrain(actor) {
  if (!actor || !findFeature(actor, "blood-drain")) {
    notify("Для броска требуется особенность «Высасывание крови».", "warn");
    return false;
  }
  const roll = await rollToChat(actor, "2d6", "Высасывание крови: урон; исцеление равно половине фактически нанесённого урона");
  notify(`${actor.name}: рекомендуемое исцеление до сопротивлений/иммунитетов цели — ${Math.floor(Number(roll.total ?? 0) / 2)} хитов.`);
  return true;
}

export async function useCrawlingArmor(actor) {
  if (!actor || !findFeature(actor, "crawling-armor")) {
    notify("Для реакции требуется особенность «Шевелящаяся броня».", "warn");
    return false;
  }
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p><strong>${actor.name}: Шевелящаяся броня.</strong> Рой перехватывает атаку: выберите +5 КД против одной атаки или преимущество на один спасбросок против разрушительного заклинания. После перехвата рой погибает.</p>`
  });
  return true;
}

export async function rollInsectSpew(actor) {
  if (!actor || !findFeature(actor, "spew-insects")) {
    notify("Для броска требуется особенность «Изрыгание насекомых».", "warn");
    return false;
  }
  await rollToChat(actor, "4d12 + 3d12", `Изрыгание насекомых: 4к12 колющий + 3к12 яд; спасбросок Ловкости Сл ${insectLordSaveDc(actor)}, половина при успехе и без отравления`);
  return true;
}

const FAMILIAR_FORMS = {
  spider: {
    label: "Гигантский паук",
    img: "icons/creatures/invertebrates/spider-green.webp",
    size: "lg",
    ac: 14,
    hp: 26,
    hpFormula: "4d10 + 4",
    abilities: { str: 14, dex: 16, con: 12, int: 2, wis: 11, cha: 4 },
    movement: { walk: 30, climb: 30 },
    senses: { darkvision: 60, blindsight: 10 },
    note: "Используйте статы гигантского паука или настройте лист под бестиарий мира."
  },
  scorpion: {
    label: "Гигантский скорпион",
    img: "icons/creatures/invertebrates/scorpion-hairy-red.webp",
    size: "lg",
    ac: 15,
    hp: 52,
    hpFormula: "7d10 + 14",
    abilities: { str: 15, dex: 13, con: 15, int: 1, wis: 9, cha: 3 },
    movement: { walk: 40 },
    senses: { blindsight: 60 },
    note: "Используйте статы гигантского скорпиона или настройте лист под бестиарий мира."
  },
  wasp: {
    label: "Гигантская оса",
    img: "icons/creatures/invertebrates/wasp-swarm-movement.webp",
    size: "med",
    ac: 12,
    hp: 13,
    hpFormula: "3d8",
    abilities: { str: 10, dex: 14, con: 10, int: 1, wis: 10, cha: 3 },
    movement: { walk: 10, fly: 50 },
    note: "Используйте статы гигантской осы или настройте лист под бестиарий мира."
  }
};

async function chooseInsectFamiliarForm(defaultForm = "spider") {
  return choiceDialog({
    title: "Насекомое-фамильяр",
    label: "Форма фамильяра",
    choices: Object.entries(FAMILIAR_FORMS).map(([value, form]) => ({
      value,
      label: form.label,
      selected: value === defaultForm
    })),
    defaultValue: defaultForm,
    confirmLabel: "Призвать",
    confirmIcon: "fa-solid fa-spider"
  });
}

function insectFamiliarSummon(actor, formKey) {
  const form = FAMILIAR_FORMS[formKey] ?? FAMILIAR_FORMS.spider;
  return {
    kind: `insect-familiar-${formKey}`,
    unique: true,
    name: `${actor.name}: ${form.label}-фамильяр`,
    img: form.img,
    source: "insect-familiar",
    form: formKey,
    size: form.size,
    type: "beast",
    ac: form.ac,
    hp: form.hp,
    hpFormula: form.hpFormula,
    abilities: form.abilities,
    movement: form.movement,
    senses: form.senses,
    description: `
      <p><strong>Насекомое-фамильяр.</strong> Призвано особенностью Владыки насекомых. Оно следует ограничениям «Поиска фамильяра» и выбранной форме: ${form.label}.</p>
      <p>Если в мире есть более точный актёр бестиария, замените созданный шаблон на него.</p>
    `,
    note: form.note
  };
}

export async function summonInsectFamiliar(actor, activity) {
  if (!actor || !findFeature(actor, "insect-familiar")) {
    notify("Для призыва требуется особенность «Насекомое-фамильяр».", "warn");
    return false;
  }
  const configured = automationData(activity).insectFamiliarForm;
  const form = FAMILIAR_FORMS[configured]
    ? configured
    : await chooseInsectFamiliarForm();
  if (!form) return false;
  return createSummonedCreature(actor, insectFamiliarSummon(actor, form));
}

function insectSwarmSummon(actor) {
  return {
    kind: "insect-swarm-mind",
    unique: true,
    name: `${actor.name}: Разумный рой`,
    img: "icons/creatures/invertebrates/beetle-swarm-green.webp",
    source: "swarm-mind",
    size: "lg",
    type: "beast",
    customType: "рой паразитов",
    ac: 13,
    hp: 110,
    abilities: { str: 5, dex: 17, con: 12, int: 2, wis: 7, cha: 1 },
    movement: { walk: 30, climb: 30 },
    senses: { blindsight: 30 },
    dr: { value: ["bludgeoning", "piercing", "slashing"], custom: "магический урон, направленный против одиночных целей" },
    description: `
      <p><strong>Разум роя.</strong> Рой связан с Владыкой насекомых телепатически на расстоянии до 1 мили.</p>
      <ul>
        <li><strong>Хиты:</strong> 110; <strong>размер:</strong> Большой; <strong>слепое зрение:</strong> 30 фт.</li>
        <li><strong>Поглощение:</strong> если в начале своего хода рой занимает пространство другого существа, цель совершает спасбросок Телосложения. При провале получает 4к6 + 3 колющего урона и считается ослеплённой, оглохшей и неспособной говорить; при успехе получает половину урона.</li>
        <li><strong>Призыв к еде:</strong> один раз между короткими отдыхами рой может вызвать 2к4 роя насекомых; поглощение призванных роёв лечит 2к10 хитов за каждый.</li>
      </ul>
    `,
    features: [{
      name: "Поглощение",
      description: `<p>Спасбросок Телосложения против СЛ ${insectLordSaveDc(actor)}. Провал: 4к6 + 3 колющего урона и сенсорные ограничения; успех: половина урона.</p>`
    }],
    note: "Недельную перезарядку после уничтожения роя отметьте вручную."
  };
}

export async function summonInsectSwarm(actor) {
  if (!actor || !findFeature(actor, "swarm-mind")) {
    notify("Для призыва требуется особенность «Разум роя».", "warn");
    return false;
  }
  return createSummonedCreature(actor, insectSwarmSummon(actor));
}

function crawlingEyeSummon(actor) {
  return {
    kind: "crawling-eye",
    unique: true,
    name: `${actor.name}: Ползучий глаз`,
    img: "icons/creatures/eyes/humanoid-single-blue.webp",
    source: "crawling-eye",
    size: "tiny",
    type: "monstrosity",
    customType: "отделённый глаз",
    ac: 16,
    hp: 1,
    abilities: { str: 1, dex: 14, con: 10, int: 1, wis: 10, cha: 1 },
    movement: { walk: 20, climb: 20 },
    senses: { darkvision: 60 },
    description: `
      <p><strong>Ползучий глаз.</strong> Не атакует. Может использовать Рывок, Уклонение, Выход из боя и Спрятаться. Владыка насекомых видит всё, что видит глаз.</p>
      <p>Если глаз уничтожен, владелец частично теряет зрение на неделю, пока глаз не вырастет заново.</p>
    `,
    note: "Эффект −2 к максимуму хитов накладывается на владельца отдельно этой же активностью."
  };
}

export async function summonCrawlingEye(actor) {
  return createSummonedCreature(actor, crawlingEyeSummon(actor));
}

registerSummonRecipe("insect-familiar", (owner, template) => insectFamiliarSummon(owner, template.form ?? "spider"));
registerSummonRecipe("swarm-mind", owner => insectSwarmSummon(owner));
registerSummonRecipe("crawling-eye", owner => crawlingEyeSummon(owner));

function crawlingEyeEffect(actor) {
  return actor?.effects?.find(effect => effect.getFlag(MODULE_ID, FLAGS.CREEPING_EYE_EFFECT));
}

export async function detachCrawlingEye(actor) {
  if (!actor || !findFeature(actor, "crawling-eye")) {
    notify("Для отделения глаза требуется особенность «Ползучий глаз».", "warn");
    return false;
  }
  const feature = findFeature(actor, "crawling-eye");
  const data = {
    name: "Ползучий глаз отделён",
    img: feature.img,
    origin: feature.uuid,
    transfer: false,
    disabled: false,
    showIcon: 1,
    statuses: [],
    flags: {
      [MODULE_ID]: {
        [FLAGS.CREEPING_EYE_EFFECT]: true
      }
    },
    system: {
      changes: [{
        key: "system.attributes.hp.max",
        type: "add",
        value: "-2",
        phase: "final",
        priority: 20
      }]
    }
  };
  const current = crawlingEyeEffect(actor);
  if (current) await current.update(data);
  else await actor.createEmbeddedDocuments("ActiveEffect", [data]);
  await summonCrawlingEye(actor);
  notify(`${actor.name}: Ползучий глаз отделён, максимум хитов снижен на 2.`);
  return true;
}

export async function returnCrawlingEye(actor) {
  const effect = crawlingEyeEffect(actor);
  if (!effect || !actor?.isOwner) {
    notify(`${actor?.name ?? "Персонаж"}: активного эффекта «Ползучий глаз» нет.`, "info");
    return false;
  }
  await effect.delete();
  notify(`${actor.name}: Ползучий глаз возвращён.`);
  return true;
}
