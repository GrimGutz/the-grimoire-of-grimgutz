import { FEATURE_NAMES, MODULE_ID, SETTINGS } from "../shared/constants.mjs";
import { automationData, enabled, itemIdentifier, notify } from "../shared/helpers.mjs";

export function createAdvancementValidator(prerequisites) {
  const {
    aberrantPrerequisiteFailures,
    bloodMagePrerequisiteFailures,
    blinkerPrerequisiteFailures,
    crusherPrerequisiteFailures,
    crusaderPrerequisiteFailures,
    deathKnightPrerequisiteFailures,
    feyWarriorPrerequisiteFailures,
    fallenPriestPrerequisiteFailures,
    forestLordPrerequisiteFailures,
    gamblerPrerequisiteFailures,
    ghostWalkerPrerequisiteFailures,
    hereticPrerequisiteFailures,
    guardianPrerequisiteFailures,
    insectLordPrerequisiteFailures,
    juggernautPrerequisiteFailures,
    keeperPrerequisiteFailures,
    keeperSubclassPrerequisiteFailures,
    leaderPrerequisiteFailures,
    onmyojiPrerequisiteFailures,
    plagueDoctorPrerequisiteFailures,
    ritualistPrerequisiteFailures,
    darkWarriorPrerequisiteFailures,
    devilWorshipperPrerequisiteFailures,
    demonologistPrerequisiteFailures,
    nethereseArcanistPrerequisiteFailures,
    oraclePrerequisiteFailures,
    sanguinistPrerequisiteFailures,
    spiritVesselPrerequisiteFailures,
    soulEaterPrerequisiteFailures,
    witchBladePrerequisiteFailures
  } = prerequisites;

  function finalAdvancementItems(actor, toCreate, toUpdate, toDelete) {
    const deleted = new Set(toDelete);
    const items = new Map(actor.items.filter(item => !deleted.has(item.id)).map(item => [item.id, item.toObject()]));
    for (const update of toUpdate) items.set(update._id, update);
    for (const item of toCreate) items.set(item._id, item);
    return [...items.values()];
  }

  function validateAdvancement(_manager, _actorUpdates, toCreate, toUpdate, toDelete) {
    if (!enabled() || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
    const actor = _manager.actor;
    const createsCrusher = toCreate.some(item => item.type === "class" && itemIdentifier(item) === "crusher");
    if (createsCrusher) {
      const failures = crusherPrerequisiteFailures(actor);
      if (failures.length) {
        notify(`Нельзя добавить класс «Сокрушитель». Не выполнено: ${failures.join(", ")}.`, "error");
        return false;
      }
    }
    const createsLeader = toCreate.some(item => item.type === "class" && itemIdentifier(item) === "leader");
    if (createsLeader) {
      const failures = leaderPrerequisiteFailures(actor);
      if (failures.length) {
        notify(
          `Нельзя добавить класс «Лидер». Не выполнено: ${failures.join(", ")}. Сюжетное требование командования проверяет Мастер.`,
          "error"
        );
        return false;
      }
    }
    const createsDeathKnight = toCreate.some(item => item.type === "class" && itemIdentifier(item) === "death-knight");
    if (createsDeathKnight) {
      const failures = deathKnightPrerequisiteFailures(actor);
      if (failures.length) {
        notify(
          `Нельзя добавить класс «Рыцарь смерти». Не выполнено: ${failures.join(", ")}. Нарушение клятвы и смерть подтверждает Мастер.`,
          "error"
        );
        return false;
      }
    }
    const createsHeretic = toCreate.some(item => item.type === "class" && itemIdentifier(item) === "heretic");
    if (createsHeretic) {
      const failures = hereticPrerequisiteFailures(actor);
      if (failures.length) {
        notify(
          `Нельзя добавить класс «Еретик». Не выполнено: ${failures.join(", ")}. Наличие магической порчи подтверждает Мастер.`,
          "error"
        );
        return false;
      }
    }
    const createsForestLord = toCreate.some(item => item.type === "class" && itemIdentifier(item) === "forest-lord");
    if (createsForestLord) {
      const failures = forestLordPrerequisiteFailures(actor);
      if (failures.length) {
        notify(
          `Нельзя добавить класс «Лесной владыка». Не выполнено: ${failures.join(", ")}. Благословение трента или дриады подтверждает Мастер.`,
          "error"
        );
        return false;
      }
    }
    const createsAberrant = toCreate.some(item => item.type === "class" && itemIdentifier(item) === "aberrant");
    if (createsAberrant) {
      const failures = aberrantPrerequisiteFailures(actor);
      if (failures.length) {
        notify(
          `Нельзя добавить класс «Абберант». Не выполнено: ${failures.join(", ")}. Компоненты и завершение ритуала подтверждает Мастер.`,
          "error"
        );
        return false;
      }
    }
    const createsWitchBlade = toCreate.some(item => item.type === "class" && itemIdentifier(item) === "witch-blade");
    if (createsWitchBlade) {
      const failures = witchBladePrerequisiteFailures(actor);
      if (failures.length) {
        notify(`Нельзя добавить класс «Ведьмин клинок». Не выполнено: ${failures.join(", ")}.`, "error");
        return false;
      }
    }
    const createsJuggernaut = toCreate.some(item => item.type === "class" && itemIdentifier(item) === "juggernaut");
    if (createsJuggernaut) {
      const failures = juggernautPrerequisiteFailures(actor);
      if (failures.length) {
        notify(
          `Нельзя добавить класс «Джаггернаут». Не выполнено: ${failures.join(", ")}. Способность исцелять себя и прошлую натуральную 20 на спасброске от смерти подтверждает Мастер.`,
          "error"
        );
        return false;
      }
    }
    const createsSoulEater = toCreate.some(item => item.type === "class" && itemIdentifier(item) === "soul-eater");
    if (createsSoulEater) {
      const failures = soulEaterPrerequisiteFailures(actor);
      if (failures.length) {
        notify(
          `Нельзя добавить класс «Пожиратель душ». Не выполнено: ${failures.join(", ")}. Событие на грани смерти и особый ритуал подтверждает Мастер.`,
          "error"
        );
        return false;
      }
    }
    const createsGuardian = toCreate.some(item => item.type === "class" && itemIdentifier(item) === "guardian");
    if (createsGuardian) {
      const failures = guardianPrerequisiteFailures(actor);
      if (failures.length) {
        notify(`Нельзя добавить класс «Страж». Не выполнено: ${failures.join(", ")}.`, "error");
        return false;
      }
    }
    const createsCrusader = toCreate.some(item => item.type === "class" && itemIdentifier(item) === "crusader");
    if (createsCrusader) {
      const failures = crusaderPrerequisiteFailures(actor);
      if (failures.length) {
        notify(`Нельзя добавить класс «Крестоносец». Не выполнено: ${failures.join(", ")}.`, "error");
        return false;
      }
    }
    const createsFeyWarrior = toCreate.some(item => item.type === "class" && itemIdentifier(item) === "fey-warrior");
    if (createsFeyWarrior) {
      const failures = feyWarriorPrerequisiteFailures(actor);
      if (failures.length) {
        notify(
          `Нельзя добавить класс «Воитель фей». Не выполнено: ${failures.join(", ")}. Пребывание в Стране Фей подтверждает Мастер.`,
          "error"
        );
        return false;
      }
    }
    const createsGhostWalker = toCreate.some(item => item.type === "class" && itemIdentifier(item) === "ghost-walker");
    if (createsGhostWalker) {
      const failures = ghostWalkerPrerequisiteFailures(actor);
      if (failures.length) {
        notify(
          `Нельзя добавить класс «Призрачный Странник». Не выполнено: ${failures.join(", ")}. Событие встречи со смертью подтверждает Мастер.`,
          "error"
        );
        return false;
      }
    }
    const createsBlinker = toCreate.some(item => item.type === "class" && itemIdentifier(item) === "blinker");
    if (createsBlinker) {
      const failures = blinkerPrerequisiteFailures(actor);
      if (failures.length) {
        notify(
          `Нельзя добавить класс «Мерцающий». Не выполнено: ${failures.join(", ")}. Специальное задание или учителя подтверждает Мастер.`,
          "error"
        );
        return false;
      }
    }
    const createsFallenPriest = toCreate.some(
      item => item.type === "class" && itemIdentifier(item) === "fallen-priest"
    );
    if (createsFallenPriest) {
      const failures = fallenPriestPrerequisiteFailures(actor);
      if (failures.length) {
        notify(
          `Нельзя добавить класс «Падший жрец». Не выполнено: ${failures.join(", ")}. Отступничество и прежний доступ к божественной магии 3-го круга подтверждает Мастер.`,
          "error"
        );
        return false;
      }
    }
    const createsPlagueDoctor = toCreate.some(
      item => item.type === "class" && itemIdentifier(item) === "plague-doctor"
    );
    if (createsPlagueDoctor) {
      const failures = plagueDoctorPrerequisiteFailures(actor);
      if (failures.length) {
        notify(
          `Нельзя добавить класс «Чумной маг». Не выполнено: ${failures.join(", ")}. Выживание после смертельной или магической инфекции подтверждает Мастер.`,
          "error"
        );
        return false;
      }
    }
    const createsInsectLord = toCreate.some(item => item.type === "class" && itemIdentifier(item) === "insect-lord");
    if (createsInsectLord) {
      const failures = insectLordPrerequisiteFailures(actor);
      if (failures.length) {
        notify(
          `Нельзя добавить класс «Владыка насекомых». Не выполнено: ${failures.join(", ")}. Посвящение разумным насекомоподобным существом подтверждает Мастер.`,
          "error"
        );
        return false;
      }
    }
    const createsGambler = toCreate.some(item => item.type === "class" && itemIdentifier(item) === "gambler");
    if (createsGambler) {
      const failures = gamblerPrerequisiteFailures(actor);
      if (failures.length) {
        notify(
          `Нельзя добавить класс «Харроуер». Не выполнено: ${failures.join(", ")}. Сюжетное обучение картам подтверждает Мастер.`,
          "error"
        );
        return false;
      }
    }
    const createsKeeper = toCreate.some(item => item.type === "class" && itemIdentifier(item) === "keeper");
    if (createsKeeper) {
      const failures = keeperPrerequisiteFailures(actor);
      if (failures.length) {
        notify(
          `Нельзя добавить класс «Хранитель». Не выполнено: ${failures.join(", ")}. Требования специализации проверяются при её выборе.`,
          "error"
        );
        return false;
      }
    }
    const createsBloodMage = toCreate.some(item => item.type === "class" && itemIdentifier(item) === "blood-mage");
    if (createsBloodMage) {
      const failures = bloodMagePrerequisiteFailures(actor);
      if (failures.length) {
        notify(
          `Нельзя добавить класс «Маг крови». Не выполнено: ${failures.join(", ")}. Доступ к тайне магии крови подтверждает Мастер.`,
          "error"
        );
        return false;
      }
    }
    const createsOnmyoji = toCreate.some(item => item.type === "class" && itemIdentifier(item) === "onmyoji");
    if (createsOnmyoji) {
      const failures = onmyojiPrerequisiteFailures(actor);
      if (failures.length) {
        notify(
          `Нельзя добавить класс «Онмёджи». Не выполнено: ${failures.join(", ")}. Разговор с Мировым Духом и уничтожение разумной нежити подтверждает Мастер.`,
          "error"
        );
        return false;
      }
    }
    const createsRitualist = toCreate.some(item => item.type === "class" && itemIdentifier(item) === "ritualist");
    if (createsRitualist) {
      const failures = ritualistPrerequisiteFailures(actor);
      if (failures.length) {
        notify(
          `Нельзя добавить класс «Ритуалист». Не выполнено: ${failures.join(", ")}. Сюжетный ритуал контроля духа подтверждает Мастер.`,
          "error"
        );
        return false;
      }
    }
    const createsDarkWarrior = toCreate.some(item => item.type === "class" && itemIdentifier(item) === "dark-warrior");
    if (createsDarkWarrior) {
      const failures = darkWarriorPrerequisiteFailures(actor);
      if (failures.length) {
        notify(
          `Нельзя добавить класс «Воин тьмы». Не выполнено: ${failures.join(", ")}. Недельный ритуал, исследования и ритуальные отметины подтверждает Мастер.`,
          "error"
        );
        return false;
      }
    }
    const createsDevilWorshipper = toCreate.some(
      item => item.type === "class" && itemIdentifier(item) === "devil-worshipper"
    );
    if (createsDevilWorshipper) {
      const failures = devilWorshipperPrerequisiteFailures(actor);
      if (failures.length) {
        notify(
          `Нельзя добавить класс «Дьяволопоклонник». Не выполнено: ${failures.join(", ")}. Контракт с дьяволом подтверждает Мастер.`,
          "error"
        );
        return false;
      }
    }
    const createsNethereseArcanist = toCreate.some(
      item => item.type === "class" && itemIdentifier(item) === "netherese-arcanist"
    );
    if (createsNethereseArcanist) {
      const failures = nethereseArcanistPrerequisiteFailures(actor);
      if (failures.length) {
        notify(
          `Нельзя добавить класс «Нетерильский арканист». Не выполнено: ${failures.join(", ")}. Происхождение гримуара и связь с Нетерилом подтверждает Мастер.`,
          "error"
        );
        return false;
      }
    }
    const createsSpiritVessel = toCreate.some(
      item => item.type === "class" && itemIdentifier(item) === "spirit-vessel"
    );
    if (createsSpiritVessel) {
      const failures = spiritVesselPrerequisiteFailures(actor);
      if (failures.length) {
        notify(
          `Нельзя добавить класс «Сосуд Духа». Не выполнено: ${failures.join(", ")}. Получение духа ПО 2+ подтверждает Мастер.`,
          "error"
        );
        return false;
      }
    }
    const createsOracle = toCreate.some(item => item.type === "class" && itemIdentifier(item) === "oracle");
    if (createsOracle) {
      const failures = oraclePrerequisiteFailures(actor);
      if (failures.length) {
        notify(
          `Нельзя добавить класс «Оракул». Не выполнено: ${failures.join(", ")}. Значимое пророчество подтверждает Мастер.`,
          "error"
        );
        return false;
      }
    }
    const createsDemonologist = toCreate.some(item => item.type === "class" && itemIdentifier(item) === "demonologist");
    if (createsDemonologist) {
      const failures = demonologistPrerequisiteFailures(actor);
      if (failures.length) {
        notify(`Нельзя добавить класс «Демонолог». Не выполнено: ${failures.join(", ")}.`, "error");
        return false;
      }
    }
    const createsSanguinist = toCreate.some(item => item.type === "class" && itemIdentifier(item) === "sanguinist");
    if (createsSanguinist) {
      const failures = sanguinistPrerequisiteFailures(actor);
      if (failures.length) {
        notify(`Нельзя добавить класс «Сангвинист». Не выполнено: ${failures.join(", ")}.`, "error");
        return false;
      }
    }
    const keeperSubclass = toCreate.find(
      item =>
        item.type === "subclass" &&
        (item.system?.classIdentifier === "keeper" || itemIdentifier(item).startsWith("keeper-"))
    );
    if (keeperSubclass) {
      const failures = keeperSubclassPrerequisiteFailures(actor, itemIdentifier(keeperSubclass));
      if (failures.length) {
        notify(
          `Нельзя выбрать специализацию Хранителя «${keeperSubclass.name}». Не выполнено: ${failures.join(", ")}.`,
          "error"
        );
        return false;
      }
    }

    const items = finalAdvancementItems(actor, toCreate, toUpdate, toDelete);
    const wizard = items.find(item => item.type === "class" && itemIdentifier(item) === "wizard");
    const currentWizardLevel = Number(wizard?.system?.levels ?? 0);
    const schoolOfSteel = items.find(item => item.type === "subclass" && itemIdentifier(item) === "school-of-steel");
    if (schoolOfSteel && (!wizard || currentWizardLevel < 2)) {
      notify("Подкласс «Школа стали» требует Волшебника 2.", "error");
      return false;
    }

    const crusher = items.find(item => item.type === "class" && itemIdentifier(item) === "crusher");
    const level = Number(crusher?.system?.levels ?? 0);
    const adaptability = items.some(item => automationData(item).feature === "adaptability");
    const styles = new Set(items.map(item => automationData(item).style).filter(Boolean));

    for (const item of items.filter(item => automationData(item).technique === true)) {
      const data = automationData(item);
      if (!crusher) {
        notify(`Техника «${item.name}» требует класс «Сокрушитель».`, "error");
        return false;
      }
      if (data.minimumLevel && level < Number(data.minimumLevel)) {
        notify(`Техника «${item.name}» требует ${data.minimumLevel}-й уровень Сокрушителя.`, "error");
        return false;
      }
      if (data.requiredStyle && !adaptability && !styles.has(data.requiredStyle)) {
        notify(`Техника «${item.name}» требует стиль «${FEATURE_NAMES[data.requiredStyle]}».`, "error");
        return false;
      }
    }

    const leader = items.find(item => item.type === "class" && itemIdentifier(item) === "leader");
    const currentLeaderLevel = Number(leader?.system?.levels ?? 0);
    for (const item of items.filter(item => automationData(item).leaderFeature === true)) {
      if (!leader) {
        notify(`Особенность «${item.name}» требует класс «Лидер».`, "error");
        return false;
      }
      const requiredLevel = Number(item.system?.prerequisites?.level ?? 0);
      if (requiredLevel && currentLeaderLevel < requiredLevel) {
        notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Лидера.`, "error");
        return false;
      }
    }

    const deathKnight = items.find(item => item.type === "class" && itemIdentifier(item) === "death-knight");
    const currentDeathKnightLevel = Number(deathKnight?.system?.levels ?? 0);
    for (const item of items.filter(item => automationData(item).deathKnightFeature === true)) {
      if (!deathKnight) {
        notify(`Особенность «${item.name}» требует класс «Рыцарь смерти».`, "error");
        return false;
      }
      const requiredLevel = Number(item.system?.prerequisites?.level ?? 0);
      if (requiredLevel && currentDeathKnightLevel < requiredLevel) {
        notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Рыцаря смерти.`, "error");
        return false;
      }
    }

    const heretic = items.find(item => item.type === "class" && itemIdentifier(item) === "heretic");
    const currentHereticLevel = Number(heretic?.system?.levels ?? 0);
    const hereticPowers = items.filter(item => automationData(item).vilePower === true);
    for (const item of items.filter(item => automationData(item).hereticFeature === true)) {
      const data = automationData(item);
      if (!heretic) {
        notify(`Особенность «${item.name}» требует класс «Еретик».`, "error");
        return false;
      }
      const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
      if (requiredLevel && currentHereticLevel < requiredLevel) {
        notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Еретика.`, "error");
        return false;
      }
    }
    if (heretic && hereticPowers.length) {
      const corePowers = new Set(["vile-unholy-power", "vile-unholy-smite", "vile-unholy-vigor"]);
      if (!hereticPowers.some(item => corePowers.has(itemIdentifier(item)))) {
        notify(
          "Еретик должен знать хотя бы одну основную гнусную силу: «Нечестивая сила», «Нечестивая кара» или «Нечестивая мощь».",
          "error"
        );
        return false;
      }
    }

    const forestLord = items.find(item => item.type === "class" && itemIdentifier(item) === "forest-lord");
    const currentForestLordLevel = Number(forestLord?.system?.levels ?? 0);
    for (const item of items.filter(item => automationData(item).forestLordFeature === true)) {
      if (!forestLord) {
        notify(`Особенность «${item.name}» требует класс «Лесной владыка».`, "error");
        return false;
      }
      const requiredLevel = Number(item.system?.prerequisites?.level ?? 0);
      if (requiredLevel && currentForestLordLevel < requiredLevel) {
        notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Лесного владыки.`, "error");
        return false;
      }
    }

    const aberrant = items.find(item => item.type === "class" && itemIdentifier(item) === "aberrant");
    const currentAberrantLevel = Number(aberrant?.system?.levels ?? 0);
    for (const item of items.filter(
      item => automationData(item).aberrantFeature === true && automationData(item).unnaturalTrait !== true
    )) {
      if (!aberrant) {
        notify(`Особенность «${item.name}» требует класс «Абберант».`, "error");
        return false;
      }
      const requiredLevel = Number(item.system?.prerequisites?.level ?? 0);
      if (requiredLevel && currentAberrantLevel < requiredLevel) {
        notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Абберанта.`, "error");
        return false;
      }
    }

    const witchBlade = items.find(item => item.type === "class" && itemIdentifier(item) === "witch-blade");
    const currentWitchBladeLevel = Number(witchBlade?.system?.levels ?? 0);
    for (const item of items.filter(item => automationData(item).witchBladeFeature === true)) {
      if (!witchBlade) {
        notify(`Особенность «${item.name}» требует класс «Ведьмин клинок».`, "error");
        return false;
      }
      const data = automationData(item);
      const requiredLevel = Number(item.system?.prerequisites?.level ?? (data.greatDesign ? 4 : 0));
      if (requiredLevel && currentWitchBladeLevel < requiredLevel) {
        notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Ведьминого клинка.`, "error");
        return false;
      }
    }
    const juggernaut = items.find(item => item.type === "class" && itemIdentifier(item) === "juggernaut");
    const currentJuggernautLevel = Number(juggernaut?.system?.levels ?? 0);
    for (const item of items.filter(item => automationData(item).juggernautFeature === true)) {
      if (!juggernaut) {
        notify(`Особенность «${item.name}» требует класс «Джаггернаут».`, "error");
        return false;
      }
      const data = automationData(item);
      const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
      if (requiredLevel && currentJuggernautLevel < requiredLevel) {
        notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Джаггернаута.`, "error");
        return false;
      }
    }
    const soulEater = items.find(item => item.type === "class" && itemIdentifier(item) === "soul-eater");
    const currentSoulEaterLevel = Number(soulEater?.system?.levels ?? 0);
    for (const item of items.filter(item => automationData(item).soulEaterFeature === true)) {
      if (!soulEater) {
        notify(`Особенность «${item.name}» требует класс «Пожиратель душ».`, "error");
        return false;
      }
      const data = automationData(item);
      const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
      if (requiredLevel && currentSoulEaterLevel < requiredLevel) {
        notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Пожирателя душ.`, "error");
        return false;
      }
    }
    const guardian = items.find(item => item.type === "class" && itemIdentifier(item) === "guardian");
    const currentGuardianLevel = Number(guardian?.system?.levels ?? 0);
    for (const item of items.filter(item => automationData(item).guardianFeature === true)) {
      if (!guardian) {
        notify(`Особенность «${item.name}» требует класс «Страж».`, "error");
        return false;
      }
      const data = automationData(item);
      const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
      if (requiredLevel && currentGuardianLevel < requiredLevel) {
        notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Стража.`, "error");
        return false;
      }
    }
    const crusader = items.find(item => item.type === "class" && itemIdentifier(item) === "crusader");
    const currentCrusaderLevel = Number(crusader?.system?.levels ?? 0);
    for (const item of items.filter(item => automationData(item).crusaderFeature === true)) {
      if (!crusader) {
        notify(`Особенность «${item.name}» требует класс «Крестоносец».`, "error");
        return false;
      }
      const data = automationData(item);
      const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
      if (requiredLevel && currentCrusaderLevel < requiredLevel) {
        notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Крестоносца.`, "error");
        return false;
      }
    }
    const feyWarrior = items.find(item => item.type === "class" && itemIdentifier(item) === "fey-warrior");
    const currentFeyWarriorLevel = Number(feyWarrior?.system?.levels ?? 0);
    for (const item of items.filter(item => automationData(item).feyWarriorFeature === true)) {
      if (!feyWarrior) {
        notify(`Особенность «${item.name}» требует класс «Воитель фей».`, "error");
        return false;
      }
      const data = automationData(item);
      const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
      if (requiredLevel && currentFeyWarriorLevel < requiredLevel) {
        notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Воителя фей.`, "error");
        return false;
      }
    }
    const ghostWalker = items.find(item => item.type === "class" && itemIdentifier(item) === "ghost-walker");
    const currentGhostWalkerLevel = Number(ghostWalker?.system?.levels ?? 0);
    for (const item of items.filter(item => automationData(item).ghostWalkerFeature === true)) {
      if (!ghostWalker) {
        notify(`Особенность «${item.name}» требует класс «Призрачный Странник».`, "error");
        return false;
      }
      const data = automationData(item);
      const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
      if (requiredLevel && currentGhostWalkerLevel < requiredLevel) {
        notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Призрачного Странника.`, "error");
        return false;
      }
    }
    const blinker = items.find(item => item.type === "class" && itemIdentifier(item) === "blinker");
    const currentBlinkerLevel = Number(blinker?.system?.levels ?? 0);
    for (const item of items.filter(item => automationData(item).blinkerFeature === true)) {
      if (!blinker) {
        notify(`Особенность «${item.name}» требует класс «Мерцающий».`, "error");
        return false;
      }
      const data = automationData(item);
      const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
      if (requiredLevel && currentBlinkerLevel < requiredLevel) {
        notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Мерцающего.`, "error");
        return false;
      }
    }
    const fallenPriest = items.find(item => item.type === "class" && itemIdentifier(item) === "fallen-priest");
    const currentFallenPriestLevel = Number(fallenPriest?.system?.levels ?? 0);
    for (const item of items.filter(item => automationData(item).fallenPriestFeature === true)) {
      if (!fallenPriest) {
        notify(`Особенность «${item.name}» требует класс «Падший жрец».`, "error");
        return false;
      }
      const data = automationData(item);
      const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
      if (requiredLevel && currentFallenPriestLevel < requiredLevel) {
        notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Падшего жреца.`, "error");
        return false;
      }
    }
    const plagueDoctor = items.find(item => item.type === "class" && itemIdentifier(item) === "plague-doctor");
    const currentPlagueDoctorLevel = Number(plagueDoctor?.system?.levels ?? 0);
    for (const item of items.filter(item => automationData(item).plagueDoctorFeature === true)) {
      if (!plagueDoctor) {
        notify(`Особенность «${item.name}» требует класс «Чумной маг».`, "error");
        return false;
      }
      const data = automationData(item);
      const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
      if (requiredLevel && currentPlagueDoctorLevel < requiredLevel) {
        notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Чумного мага.`, "error");
        return false;
      }
    }
    const insectLord = items.find(item => item.type === "class" && itemIdentifier(item) === "insect-lord");
    const currentInsectLordLevel = Number(insectLord?.system?.levels ?? 0);
    for (const item of items.filter(item => automationData(item).insectLordFeature === true)) {
      if (!insectLord) {
        notify(`Особенность «${item.name}» требует класс «Владыка насекомых».`, "error");
        return false;
      }
      const data = automationData(item);
      const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
      if (requiredLevel && currentInsectLordLevel < requiredLevel) {
        notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Владыки насекомых.`, "error");
        return false;
      }
    }
    const gambler = items.find(item => item.type === "class" && itemIdentifier(item) === "gambler");
    const currentGamblerLevel = Number(gambler?.system?.levels ?? 0);
    for (const item of items.filter(item => automationData(item).gamblerFeature === true)) {
      if (!gambler) {
        notify(`Особенность «${item.name}» требует класс «Харроуер».`, "error");
        return false;
      }
      const data = automationData(item);
      const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
      if (requiredLevel && currentGamblerLevel < requiredLevel) {
        notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Харроуера.`, "error");
        return false;
      }
    }
    const keeper = items.find(item => item.type === "class" && itemIdentifier(item) === "keeper");
    const currentKeeperLevel = Number(keeper?.system?.levels ?? 0);
    const keeperSubclasses = items.filter(
      item => item.type === "subclass" && item.system?.classIdentifier === "keeper"
    );
    if (keeperSubclasses.length > 1) {
      notify("Хранитель может иметь только одну специализацию-подкласс.", "error");
      return false;
    }
    if (keeperSubclasses.length && (!keeper || currentKeeperLevel < 1)) {
      notify("Специализация Хранителя требует 1-й уровень класса «Хранитель».", "error");
      return false;
    }
    for (const item of items.filter(item => automationData(item).keeperFeature === true)) {
      if (!keeper) {
        notify(`Особенность «${item.name}» требует класс «Хранитель».`, "error");
        return false;
      }
      const data = automationData(item);
      const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
      if (requiredLevel && currentKeeperLevel < requiredLevel) {
        notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Хранителя.`, "error");
        return false;
      }
    }
    const bloodMage = items.find(item => item.type === "class" && itemIdentifier(item) === "blood-mage");
    const currentBloodMageLevel = Number(bloodMage?.system?.levels ?? 0);
    for (const item of items.filter(item => automationData(item).bloodMageFeature === true)) {
      if (!bloodMage) {
        notify(`Особенность «${item.name}» требует класс «Маг крови».`, "error");
        return false;
      }
      const data = automationData(item);
      const requiredLevel = Number(data.minimumLevel ?? data.requiredLevel ?? item.system?.prerequisites?.level ?? 0);
      if (requiredLevel && currentBloodMageLevel < requiredLevel) {
        notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Мага крови.`, "error");
        return false;
      }
    }
    const onmyoji = items.find(item => item.type === "class" && itemIdentifier(item) === "onmyoji");
    const currentOnmyojiLevel = Number(onmyoji?.system?.levels ?? 0);
    for (const item of items.filter(item => automationData(item).onmyojiFeature === true)) {
      if (!onmyoji) {
        notify(`Особенность «${item.name}» требует класс «Онмёджи».`, "error");
        return false;
      }
      const data = automationData(item);
      const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
      if (requiredLevel && currentOnmyojiLevel < requiredLevel) {
        notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Онмёджи.`, "error");
        return false;
      }
    }
    const ritualist = items.find(item => item.type === "class" && itemIdentifier(item) === "ritualist");
    const currentRitualistLevel = Number(ritualist?.system?.levels ?? 0);
    for (const item of items.filter(item => automationData(item).ritualistFeature === true)) {
      if (!ritualist) {
        notify(`Особенность «${item.name}» требует класс «Ритуалист».`, "error");
        return false;
      }
      const data = automationData(item);
      const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
      if (requiredLevel && currentRitualistLevel < requiredLevel) {
        notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Ритуалиста.`, "error");
        return false;
      }
    }
    const darkWarrior = items.find(item => item.type === "class" && itemIdentifier(item) === "dark-warrior");
    const currentDarkWarriorLevel = Number(darkWarrior?.system?.levels ?? 0);
    for (const item of items.filter(item => automationData(item).darkWarriorFeature === true)) {
      if (!darkWarrior) {
        notify(`Особенность «${item.name}» требует класс «Воин тьмы».`, "error");
        return false;
      }
      const data = automationData(item);
      const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
      if (requiredLevel && currentDarkWarriorLevel < requiredLevel) {
        notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Воина тьмы.`, "error");
        return false;
      }
    }
    const devilWorshipper = items.find(item => item.type === "class" && itemIdentifier(item) === "devil-worshipper");
    const currentDevilWorshipperLevel = Number(devilWorshipper?.system?.levels ?? 0);
    for (const item of items.filter(item => automationData(item).devilWorshipperFeature === true)) {
      if (!devilWorshipper) {
        notify(`Особенность «${item.name}» требует класс «Дьяволопоклонник».`, "error");
        return false;
      }
      const data = automationData(item);
      const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
      if (requiredLevel && currentDevilWorshipperLevel < requiredLevel) {
        notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Дьяволопоклонника.`, "error");
        return false;
      }
    }
    const nethereseArcanist = items.find(
      item => item.type === "class" && itemIdentifier(item) === "netherese-arcanist"
    );
    const currentNethereseArcanistLevel = Number(nethereseArcanist?.system?.levels ?? 0);
    for (const item of items.filter(item => automationData(item).nethereseArcanistFeature === true)) {
      if (!nethereseArcanist) {
        notify(`Особенность «${item.name}» требует класс «Нетерильский арканист».`, "error");
        return false;
      }
      const data = automationData(item);
      const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
      if (requiredLevel && currentNethereseArcanistLevel < requiredLevel) {
        notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Нетерильского арканиста.`, "error");
        return false;
      }
    }
    const spiritVessel = items.find(item => item.type === "class" && itemIdentifier(item) === "spirit-vessel");
    const currentSpiritVesselLevel = Number(spiritVessel?.system?.levels ?? 0);
    const spiritVesselSubclasses = items.filter(
      item =>
        item.type === "subclass" &&
        (item.system?.classIdentifier === "spirit-vessel" || automationData(item).spiritVesselSubclass)
    );
    if (spiritVesselSubclasses.length > 1) {
      notify("Сосуд Духа может иметь только один тип духа-подкласс.", "error");
      return false;
    }
    if (spiritVesselSubclasses.length && (!spiritVessel || currentSpiritVesselLevel < 1)) {
      notify("Тип духа требует 1-й уровень класса «Сосуд Духа».", "error");
      return false;
    }
    for (const item of items.filter(item => automationData(item).spiritVesselFeature === true)) {
      if (!spiritVessel) {
        notify(`Особенность «${item.name}» требует класс «Сосуд Духа».`, "error");
        return false;
      }
      const data = automationData(item);
      const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
      if (requiredLevel && currentSpiritVesselLevel < requiredLevel) {
        notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Сосуда Духа.`, "error");
        return false;
      }
    }
    const oracle = items.find(item => item.type === "class" && itemIdentifier(item) === "oracle");
    const currentOracleLevel = Number(oracle?.system?.levels ?? 0);
    for (const item of items.filter(item => automationData(item).oracleFeature === true)) {
      if (!oracle) {
        notify(`Особенность «${item.name}» требует класс «Оракул».`, "error");
        return false;
      }
      const data = automationData(item);
      const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
      if (requiredLevel && currentOracleLevel < requiredLevel) {
        notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Оракула.`, "error");
        return false;
      }
    }
    const demonologist = items.find(item => item.type === "class" && itemIdentifier(item) === "demonologist");
    const currentDemonologistLevel = Number(demonologist?.system?.levels ?? 0);
    for (const item of items.filter(item => automationData(item).demonologistFeature === true)) {
      if (!demonologist) {
        notify(`Особенность «${item.name}» требует класс «Демонолог».`, "error");
        return false;
      }
      const data = automationData(item);
      const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
      if (requiredLevel && currentDemonologistLevel < requiredLevel) {
        notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Демонолога.`, "error");
        return false;
      }
    }
    const sanguinist = items.find(item => item.type === "class" && itemIdentifier(item) === "sanguinist");
    const currentSanguinistLevel = Number(sanguinist?.system?.levels ?? 0);
    for (const item of items.filter(item => automationData(item).sanguinistFeature === true)) {
      if (!sanguinist) {
        notify(`Особенность «${item.name}» требует класс «Сангвинист».`, "error");
        return false;
      }
      const data = automationData(item);
      const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
      if (requiredLevel && currentSanguinistLevel < requiredLevel) {
        notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Сангвиниста.`, "error");
        return false;
      }
    }
    for (const item of items.filter(item => automationData(item).schoolOfSteelFeature === true)) {
      const data = automationData(item);
      if (!schoolOfSteel) {
        notify(`Особенность «${item.name}» требует подкласс волшебника «Школа стали».`, "error");
        return false;
      }
      const requiredLevel = Number(item.system?.prerequisites?.level ?? (data.schoolOfSteelSignature ? 14 : 0));
      if (requiredLevel && currentWizardLevel < requiredLevel) {
        notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Волшебника со Школой стали.`, "error");
        return false;
      }
    }
    const schoolSteelSignatures = items.filter(item => automationData(item).schoolOfSteelSignature === true);
    if (schoolSteelSignatures.length > 1) {
      notify("Школа стали может выбрать только один фирменный приём.", "error");
      return false;
    }
    return true;
  }

  return validateAdvancement;
}
