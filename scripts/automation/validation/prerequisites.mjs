import { FEATURE_NAMES, MODULE_ID, SETTINGS } from "../shared/constants.mjs";
import { automationData, itemIdentifier, notify } from "../shared/helpers.mjs";
import { sizeNumber, strengthValue } from "../shared/dnd5e.mjs";
import {
  aberrantLevel,
  deathKnightLevel,
  druidClass,
  forestLordLevel,
  hereticLevel,
  leaderLevel,
  paladinLevel,
  rangerClass,
  schoolOfSteelLevel,
  witchBladeLevel,
  wizardLevel
} from "../shared/selectors.mjs";

export function createPrerequisiteValidators({ canUseStyle, massiveWeapons }) {
  function hasGreatWeaponMaster(actor) {
    return (
      actor?.items?.some(item => {
        const identifier = itemIdentifier(item).replaceAll("_", "-");
        const name = String(item.name ?? "").toLowerCase();
        return (
          identifier === "great-weapon-master" ||
          name.includes("great weapon master") ||
          name.includes("мастер большого оружия") ||
          name.includes("мастер тяжёлого оружия") ||
          name.includes("мастер тяжелого оружия")
        );
      }) ?? false
    );
  }

  function actorSizeAtLeastMedium(actor) {
    return sizeNumber(actor) >= 2;
  }

  function crusherPrerequisiteFailures(actor) {
    const failures = [];
    if (strengthValue(actor) < 18) failures.push("Сила 18");
    if (Number(actor.system.details?.level ?? 0) < 5) failures.push("5-й уровень персонажа");
    if (!actorSizeAtLeastMedium(actor)) failures.push("Средний или больший размер");
    if (!hasGreatWeaponMaster(actor)) failures.push("черта «Мастер большого оружия»");
    if (!massiveWeapons(actor).length) failures.push("массивное оружие");
    return failures;
  }

  const LEADERSHIP_SKILLS = ["ani", "dec", "his", "ins", "itm", "inv", "rel", "prf", "per"];

  function hasLeadershipSkill(actor) {
    return LEADERSHIP_SKILLS.some(skill => {
      const data = actor?.system?.skills?.[skill];
      return Number(data?.value ?? data?.proficient ?? 0) > 0;
    });
  }

  function leaderPrerequisiteFailures(actor) {
    const failures = [];
    const planningAbility = Math.max(
      Number(actor?.system?.abilities?.int?.value ?? 0),
      Number(actor?.system?.abilities?.wis?.value ?? 0),
      Number(actor?.system?.abilities?.cha?.value ?? 0)
    );
    if (planningAbility < 13) failures.push("Интеллект, Мудрость или Харизма 13");
    if (Number(actor?.system?.abilities?.wis?.value ?? 0) < 11) failures.push("Мудрость 11");
    if (Number(actor?.system?.abilities?.cha?.value ?? 0) < 11) failures.push("Харизма 11");
    if (Number(actor?.system?.details?.level ?? 0) < 5) failures.push("5-й уровень персонажа");
    if (!hasLeadershipSkill(actor)) failures.push("владение навыком лидерства");
    return failures;
  }

  function deathKnightPrerequisiteFailures(actor) {
    const failures = [];
    if (paladinLevel(actor) < 5) failures.push("5 уровней Паладина");
    return failures;
  }

  function hereticPrerequisiteFailures(actor) {
    const failures = [];
    const occultAbilityValue = Math.max(
      Number(actor?.system?.abilities?.int?.value ?? 0),
      Number(actor?.system?.abilities?.wis?.value ?? 0),
      Number(actor?.system?.abilities?.cha?.value ?? 0)
    );
    if (occultAbilityValue < 13) failures.push("Интеллект, Мудрость или Харизма 13");
    if (Number(actor?.system?.details?.level ?? 0) < 4) failures.push("4-й уровень персонажа");

    const alignmentData = actor?.system?.details?.alignment;
    const alignment = String(
      typeof alignmentData === "object" ? (alignmentData?.value ?? alignmentData?.label ?? "") : (alignmentData ?? "")
    ).toLocaleLowerCase("ru");
    if (
      alignment.includes("lawful good") ||
      alignment.includes("законно-добр") ||
      alignment.includes("законный добр")
    ) {
      failures.push("мировоззрение не законно-доброе");
    }
    return failures;
  }

  function hasNaturePath(actor) {
    if (druidClass(actor) || rangerClass(actor)) return true;
    return (
      actor?.items?.some(item => {
        if (!["class", "subclass"].includes(item.type)) return false;
        const text = `${itemIdentifier(item)} ${item.name ?? ""}`.toLocaleLowerCase("ru");
        return ["green-heart", "green heart", "зелёного сердца", "зеленого сердца", "nature", "природ"].some(fragment =>
          text.includes(fragment)
        );
      }) ?? false
    );
  }

  function forestLordPrerequisiteFailures(actor) {
    const failures = [];
    if (Number(actor?.system?.details?.level ?? 0) < 5) failures.push("5-й уровень персонажа");
    if (Number(actor?.system?.abilities?.wis?.value ?? 0) < 13) failures.push("Мудрость 13");
    if (!hasNaturePath(actor)) failures.push("класс Друид, Следопыт или природный архетип");
    return failures;
  }

  function aberrantPrerequisiteFailures(actor) {
    const failures = [];
    if (Number(actor?.system?.abilities?.con?.value ?? 0) < 17) failures.push("Телосложение 17");
    const physical = Math.max(
      Number(actor?.system?.abilities?.str?.value ?? 0),
      Number(actor?.system?.abilities?.dex?.value ?? 0)
    );
    if (physical < 15) failures.push("Сила или Ловкость 15");
    if (Number(actor?.system?.details?.level ?? 0) < 5) failures.push("5-й уровень персонажа");
    return failures;
  }

  function witchBladePrerequisiteFailures(actor) {
    const failures = [];
    const weaponAbility = Math.max(
      Number(actor?.system?.abilities?.str?.value ?? 0),
      Number(actor?.system?.abilities?.dex?.value ?? 0)
    );
    if (weaponAbility < 15) failures.push("Сила или Ловкость 15");
    if (Number(actor?.system?.abilities?.con?.value ?? 0) < 15) failures.push("Телосложение 15");
    if (Number(actor?.system?.abilities?.int?.value ?? 0) < 15) failures.push("Интеллект 15");
    return failures;
  }

  function validateCrusherPrerequisites(item, userId) {
    if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
    const actor = item.parent;
    if (!actor || item.type !== "class" || itemIdentifier(item) !== "crusher") return true;

    const failures = crusherPrerequisiteFailures(actor);
    if (failures.length) {
      notify(`Нельзя добавить класс «Сокрушитель». Не выполнено: ${failures.join(", ")}.`, "error");
      return false;
    }
    return true;
  }

  function validateLeaderPrerequisites(item, userId) {
    if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
    const actor = item.parent;
    if (!actor || item.type !== "class" || itemIdentifier(item) !== "leader") return true;

    const failures = leaderPrerequisiteFailures(actor);
    if (failures.length) {
      notify(
        `Нельзя добавить класс «Лидер». Не выполнено: ${failures.join(", ")}. Сюжетное требование командования проверяет Мастер.`,
        "error"
      );
      return false;
    }
    return true;
  }

  function validateDeathKnightPrerequisites(item, userId) {
    if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
    const actor = item.parent;
    if (!actor || item.type !== "class" || itemIdentifier(item) !== "death-knight") return true;

    const failures = deathKnightPrerequisiteFailures(actor);
    if (failures.length) {
      notify(
        `Нельзя добавить класс «Рыцарь смерти». Не выполнено: ${failures.join(", ")}. Нарушение клятвы и смерть подтверждает Мастер.`,
        "error"
      );
      return false;
    }
    return true;
  }

  function validateHereticPrerequisites(item, userId) {
    if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
    const actor = item.parent;
    if (!actor || item.type !== "class" || itemIdentifier(item) !== "heretic") return true;

    const failures = hereticPrerequisiteFailures(actor);
    if (failures.length) {
      notify(
        `Нельзя добавить класс «Еретик». Не выполнено: ${failures.join(", ")}. Наличие магической порчи подтверждает Мастер.`,
        "error"
      );
      return false;
    }
    return true;
  }

  function validateForestLordPrerequisites(item, userId) {
    if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
    const actor = item.parent;
    if (!actor || item.type !== "class" || itemIdentifier(item) !== "forest-lord") return true;

    const failures = forestLordPrerequisiteFailures(actor);
    if (failures.length) {
      notify(
        `Нельзя добавить класс «Лесной владыка». Не выполнено: ${failures.join(", ")}. Благословение трента или дриады подтверждает Мастер.`,
        "error"
      );
      return false;
    }
    return true;
  }

  function validateAberrantPrerequisites(item, userId) {
    if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
    const actor = item.parent;
    if (!actor || item.type !== "class" || itemIdentifier(item) !== "aberrant") return true;
    const failures = aberrantPrerequisiteFailures(actor);
    if (failures.length) {
      notify(
        `Нельзя добавить класс «Абберант». Не выполнено: ${failures.join(", ")}. Компоненты и завершение ритуала подтверждает Мастер.`,
        "error"
      );
      return false;
    }
    return true;
  }

  function validateWitchBladePrerequisites(item, userId) {
    if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
    const actor = item.parent;
    if (!actor || item.type !== "class" || itemIdentifier(item) !== "witch-blade") return true;
    const failures = witchBladePrerequisiteFailures(actor);
    if (failures.length) {
      notify(`Нельзя добавить класс «Ведьмин клинок». Не выполнено: ${failures.join(", ")}.`, "error");
      return false;
    }
    return true;
  }

  function validateSchoolOfSteelPrerequisites(item, userId) {
    if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
    const actor = item.parent;
    if (!actor || item.type !== "subclass" || itemIdentifier(item) !== "school-of-steel") return true;
    if (wizardLevel(actor) >= 2) return true;
    notify("Нельзя добавить подкласс «Школа стали»: требуется Волшебник 2.", "error");
    return false;
  }

  function validateLeaderFeaturePrerequisites(item, options, userId) {
    if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
    const actor = item.parent;
    const data = automationData(item);
    if (!actor || data.leaderFeature !== true || options?.isAdvancement) return true;

    const level = leaderLevel(actor);
    if (!level) {
      notify(`Особенность «${item.name}» требует класс «Лидер».`, "error");
      return false;
    }
    const requiredLevel = Number(item.system?.prerequisites?.level ?? 0);
    if (requiredLevel && level < requiredLevel) {
      notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Лидера.`, "error");
      return false;
    }
    return true;
  }

  function validateDeathKnightFeaturePrerequisites(item, options, userId) {
    if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
    const actor = item.parent;
    const data = automationData(item);
    if (!actor || data.deathKnightFeature !== true || options?.isAdvancement) return true;

    const level = deathKnightLevel(actor);
    if (!level) {
      notify(`Особенность «${item.name}» требует класс «Рыцарь смерти».`, "error");
      return false;
    }
    const requiredLevel = Number(item.system?.prerequisites?.level ?? 0);
    if (requiredLevel && level < requiredLevel) {
      notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Рыцаря смерти.`, "error");
      return false;
    }
    return true;
  }

  function validateHereticFeaturePrerequisites(item, options, userId) {
    if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
    const actor = item.parent;
    const data = automationData(item);
    if (!actor || data.hereticFeature !== true || options?.isAdvancement) return true;

    const level = hereticLevel(actor);
    if (!level) {
      notify(`Особенность «${item.name}» требует класс «Еретик».`, "error");
      return false;
    }
    const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
    if (requiredLevel && level < requiredLevel) {
      notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Еретика.`, "error");
      return false;
    }
    return true;
  }

  function validateForestLordFeaturePrerequisites(item, options, userId) {
    if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
    const actor = item.parent;
    const data = automationData(item);
    if (!actor || data.forestLordFeature !== true || options?.isAdvancement) return true;

    const level = forestLordLevel(actor);
    if (!level) {
      notify(`Особенность «${item.name}» требует класс «Лесной владыка».`, "error");
      return false;
    }
    const requiredLevel = Number(item.system?.prerequisites?.level ?? 0);
    if (requiredLevel && level < requiredLevel) {
      notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Лесного владыки.`, "error");
      return false;
    }
    return true;
  }

  function validateAberrantFeaturePrerequisites(item, options, userId) {
    if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
    const actor = item.parent;
    const data = automationData(item);
    if (!actor || data.aberrantFeature !== true || data.unnaturalTrait === true || options?.isAdvancement) return true;
    const level = aberrantLevel(actor);
    if (!level) {
      notify(`Особенность «${item.name}» требует класс «Абберант».`, "error");
      return false;
    }
    const requiredLevel = Number(item.system?.prerequisites?.level ?? 0);
    if (requiredLevel && level < requiredLevel) {
      notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Абберанта.`, "error");
      return false;
    }
    return true;
  }

  function validateWitchBladeFeaturePrerequisites(item, options, userId) {
    if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
    const actor = item.parent;
    const data = automationData(item);
    if (!actor || data.witchBladeFeature !== true || options?.isAdvancement) return true;
    const level = witchBladeLevel(actor);
    if (!level) {
      notify(`Особенность «${item.name}» требует класс «Ведьмин клинок».`, "error");
      return false;
    }
    const requiredLevel = Number(item.system?.prerequisites?.level ?? (data.greatDesign ? 4 : 0));
    if (requiredLevel && level < requiredLevel) {
      notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Ведьминого клинка.`, "error");
      return false;
    }
    return true;
  }

  function validateSchoolOfSteelFeaturePrerequisites(item, options, userId) {
    if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
    const actor = item.parent;
    const data = automationData(item);
    if (!actor || data.schoolOfSteelFeature !== true || options?.isAdvancement) return true;
    const level = schoolOfSteelLevel(actor);
    if (!level) {
      notify(`Особенность «${item.name}» требует подкласс волшебника «Школа стали».`, "error");
      return false;
    }
    const requiredLevel = Number(item.system?.prerequisites?.level ?? (data.schoolOfSteelSignature ? 14 : 0));
    if (requiredLevel && level < requiredLevel) {
      notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Волшебника со Школой стали.`, "error");
      return false;
    }
    return true;
  }

  function validateTechniquePrerequisites(item, options, userId) {
    if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
    const actor = item.parent;
    const data = automationData(item);
    if (!actor || data.technique !== true) return true;
    if (options?.isAdvancement) return true;

    const level = Number(
      actor?.items?.find(entry => entry.type === "class" && itemIdentifier(entry) === "crusher")?.system?.levels ?? 0
    );
    if (!level) {
      notify(`Техника «${item.name}» требует класс «Сокрушитель».`, "error");
      return false;
    }
    if (data.minimumLevel && level < Number(data.minimumLevel)) {
      notify(`Техника «${item.name}» требует ${data.minimumLevel}-й уровень Сокрушителя.`, "error");
      return false;
    }
    if (data.requiredStyle && !canUseStyle(actor, data.requiredStyle)) {
      notify(`Техника «${item.name}» требует стиль «${FEATURE_NAMES[data.requiredStyle]}».`, "error");
      return false;
    }
    return true;
  }

  return {
    aberrantPrerequisiteFailures,
    crusherPrerequisiteFailures,
    deathKnightPrerequisiteFailures,
    forestLordPrerequisiteFailures,
    hereticPrerequisiteFailures,
    leaderPrerequisiteFailures,
    validateAberrantFeaturePrerequisites,
    validateAberrantPrerequisites,
    validateCrusherPrerequisites,
    validateDeathKnightFeaturePrerequisites,
    validateDeathKnightPrerequisites,
    validateForestLordFeaturePrerequisites,
    validateForestLordPrerequisites,
    validateHereticFeaturePrerequisites,
    validateHereticPrerequisites,
    validateLeaderFeaturePrerequisites,
    validateLeaderPrerequisites,
    validateSchoolOfSteelFeaturePrerequisites,
    validateSchoolOfSteelPrerequisites,
    validateTechniquePrerequisites,
    validateWitchBladeFeaturePrerequisites,
    validateWitchBladePrerequisites,
    witchBladePrerequisiteFailures
  };
}
