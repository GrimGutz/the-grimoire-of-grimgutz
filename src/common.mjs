import { createHash } from "node:crypto";

export const MODULE_ID = "the-grimoire-of-grimgutz";
export const CORE_VERSION = "14.364";
export const SYSTEM_VERSION = "5.3.3";
export const AUTOMATION_CONFIG_VERSION = 1;

export function idFor(key) {
  return createHash("sha256").update(`${MODULE_ID}:${key}`).digest("hex").slice(0, 16);
}

export function uuidFor(pack, key) {
  return `Compendium.${MODULE_ID}.${pack}.Item.${idFor(key)}`;
}

export function sourceData(page = "", custom = "Престиж-класс: Сокрушитель; перевод Айвендил, 26.03.2018") {
  return {
    custom,
    book: "TGoGG",
    page,
    license: "",
    revision: 1,
    rules: "2014"
  };
}

function omitAutomationMeta(data = {}) {
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => !["automation", "automationConfig", "schemaVersion"].includes(key))
  );
}

function automationActionId(data = {}) {
  return data.action ?? data.moduleAction ?? "";
}

function inferAutomationKind(data = {}, context = {}) {
  if (automationActionId(data)) return "activity";
  if (data.passiveEffect === true) return "effect";
  if (data.prestigeClass) return "prestige-class";
  if (data.wizardSubclass || data.keeperSubclass || data.spiritVesselSubclass || data.masterSubclass) return "subclass";
  if (data.transformation && data.transformationFeature !== true) return "transformation";
  if (data.transformationFeature === true || data.hollowFeature === true || data.murderspawnFeature === true)
    return "transformation-feature";
  if (data.massiveWeapon === true || data.murderspawnWeapon === true || data.weaponKey) return "equipment";
  if (data.forestLordSpell || data.witchBladeSpell || data.bloodMageSpell || data.nethereseGreatSpell) return "spell";
  if (data.feature) return "feature";
  return context.type ?? "document";
}

function inferAutomationId(data = {}, context = {}) {
  return (
    automationActionId(data) ||
    data.feature ||
    data.prestigeClass ||
    data.wizardSubclass ||
    data.keeperSubclass ||
    data.spiritVesselSubclass ||
    data.masterSubclass ||
    data.transformation ||
    data.weaponKey ||
    context.key ||
    ""
  );
}

function automationTags(data = {}) {
  return Object.entries(data)
    .filter(([_key, value]) => value === true)
    .map(([key]) => key)
    .sort();
}

function automationRequirements(data = {}) {
  const requirements = {};
  if (data.minimumLevel !== undefined && data.minimumLevel !== null)
    requirements.minimumLevel = Number(data.minimumLevel);
  if (data.transformationLevel !== undefined && data.transformationLevel !== null)
    requirements.transformationLevel = Number(data.transformationLevel);
  if (data.prerequisiteLevel !== undefined && data.prerequisiteLevel !== null)
    requirements.prerequisiteLevel = Number(data.prerequisiteLevel);
  return Object.fromEntries(Object.entries(requirements).filter(([_key, value]) => Number.isFinite(value)));
}

export function automationConfig(data = {}, context = {}) {
  const legacy = omitAutomationMeta(data);
  const action = automationActionId(legacy);
  const kind = inferAutomationKind(legacy, context);
  const id = inferAutomationId(legacy, context);
  const actionData = action
    ? Object.fromEntries(Object.entries(legacy).filter(([key]) => !["action", "moduleAction"].includes(key)))
    : {};

  return {
    version: AUTOMATION_CONFIG_VERSION,
    kind,
    id,
    ...(action
      ? {
          action: {
            id: action,
            data: actionData
          }
        }
      : {}),
    document: {
      type: context.type ?? null,
      key: context.key ?? id,
      feature: legacy.feature ?? null,
      prestigeClass: legacy.prestigeClass ?? null,
      subclass:
        legacy.wizardSubclass ?? legacy.keeperSubclass ?? legacy.spiritVesselSubclass ?? legacy.masterSubclass ?? null,
      transformation: legacy.transformation ?? null,
      equipment: legacy.weaponKey ?? null
    },
    requirements: automationRequirements(legacy),
    tags: automationTags(legacy),
    data: legacy
  };
}

export function withAutomationConfig(flags = {}, context = {}) {
  const moduleFlags = flags?.[MODULE_ID];
  if (!moduleFlags) return flags;
  const legacy = omitAutomationMeta(moduleFlags);
  const existing = moduleFlags.automation && typeof moduleFlags.automation === "object" ? moduleFlags.automation : {};
  return {
    ...flags,
    [MODULE_ID]: {
      schemaVersion: AUTOMATION_CONFIG_VERSION,
      ...moduleFlags,
      automation: {
        ...automationConfig(legacy, context),
        ...existing,
        version: AUTOMATION_CONFIG_VERSION
      }
    }
  };
}

export function stats() {
  return {
    coreVersion: CORE_VERSION,
    systemId: "dnd5e",
    systemVersion: SYSTEM_VERSION,
    createdTime: null,
    modifiedTime: null,
    lastModifiedBy: null,
    compendiumSource: null,
    duplicateSource: null,
    exportSource: null
  };
}

export function baseDocument({ key, name, type, img, system, folder = null, flags = {}, effects = [] }) {
  const normalizedFlags = withAutomationConfig(flags, { key, type });
  return {
    name,
    type,
    img,
    system,
    effects,
    flags: normalizedFlags,
    _id: idFor(key),
    _stats: stats(),
    folder,
    sort: 0,
    ownership: {
      default: 0
    }
  };
}

export function feature({
  key,
  name,
  description,
  img,
  level = null,
  requirements = "",
  uses = null,
  activities = {},
  advancement = [],
  folder = null,
  automation = null,
  effects = [],
  sourcePage = "2–3",
  sourceCustom = "Престиж-класс: Сокрушитель; перевод Айвендил, 26.03.2018"
}) {
  return baseDocument({
    key,
    name,
    type: "feat",
    img,
    folder,
    effects,
    flags: automation
      ? {
          [MODULE_ID]: automation
        }
      : {},
    system: {
      description: {
        value: description,
        chat: ""
      },
      source: sourceData(sourcePage, sourceCustom),
      uses: uses ?? {
        max: "",
        spent: 0,
        recovery: []
      },
      type: {
        value: "class",
        subtype: ""
      },
      prerequisites: {
        level
      },
      properties: [],
      requirements,
      activities,
      advancement,
      identifier: key,
      enchant: {}
    }
  });
}

export function activeEffect({ key, name, img, changes, transfer = false, flags = {} }) {
  const normalizedFlags = withAutomationConfig(
    {
      ...flags,
      [MODULE_ID]: {
        ...(flags[MODULE_ID] ?? {}),
        passiveEffect: true
      }
    },
    { key, type: "effect" }
  );
  const finalPhase = key =>
    key.startsWith("system.attributes.ac.") ||
    key.startsWith("system.attributes.init.") ||
    key.startsWith("system.attributes.movement.") ||
    key.startsWith("system.attributes.senses.") ||
    key.endsWith(".roll.mode");
  return {
    _id: idFor(`effect:${key}`),
    name,
    img,
    type: "base",
    description: "",
    origin: null,
    transfer,
    disabled: false,
    showIcon: 1,
    statuses: [],
    tint: "#ffffff",
    start: null,
    duration: {
      value: null,
      units: "seconds",
      expiry: null,
      expired: false
    },
    sort: 0,
    flags: normalizedFlags,
    system: {
      changes: changes.map(change => ({
        phase: finalPhase(change.key) ? "final" : "initial",
        ...change
      }))
    }
  };
}

export function utilityActivity({
  key,
  name = "",
  action = "",
  actionData = {},
  activation = "special",
  condition = "",
  consumeItemUse = false,
  spellSlot = true,
  rangeValue = null,
  rangeUnits = "ft",
  targetType = "",
  targetCount = "",
  targetChoice = false,
  prompt = true,
  rollFormula = "",
  rollName = "",
  rollVisible = false
}) {
  const activityId = idFor(`activity:${key}`);
  const flags = action
    ? withAutomationConfig(
        {
          [MODULE_ID]: {
            action,
            ...actionData
          }
        },
        { key, type: "activity" }
      )
    : {};
  return {
    [activityId]: {
      _id: activityId,
      type: "utility",
      name,
      img: "",
      flags,
      activation: {
        type: activation,
        value: activation === "special" || !activation ? null : 1,
        condition,
        override: false
      },
      consumption: {
        targets: consumeItemUse
          ? [
              {
                type: "itemUses",
                target: "",
                value: "1",
                scaling: {
                  mode: "",
                  formula: ""
                }
              }
            ]
          : [],
        scaling: {
          allowed: false,
          max: ""
        },
        spellSlot
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
        value: rangeValue,
        units: rangeValue == null ? "" : rangeUnits,
        special: "",
        override: rangeValue != null
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
          count: targetCount,
          type: targetType,
          choice: targetChoice,
          special: ""
        },
        prompt,
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
        visible: rollVisible
      },
      sort: 0
    }
  };
}

export function itemGrant({ key, level, items, title = "Особенности", pack = "features" }) {
  return {
    _id: idFor(`advancement:${key}`),
    type: "ItemGrant",
    configuration: {
      items: items.map(item => ({
        uuid: uuidFor(pack, item),
        optional: false
      })),
      optional: false,
      spell: {
        ability: [""],
        preparation: "",
        uses: {
          max: "",
          per: "",
          requireSlot: false
        }
      }
    },
    value: {},
    level,
    title
  };
}

export function itemGrantUuids({ key, level, uuids, title = "Особенности" }) {
  return {
    _id: idFor(`advancement:${key}`),
    type: "ItemGrant",
    configuration: {
      items: uuids.map(uuid => ({
        uuid,
        optional: false
      })),
      optional: false,
      spell: {
        ability: [""],
        preparation: "",
        uses: {
          max: "",
          per: "",
          requireSlot: false
        }
      }
    },
    value: {},
    level,
    title
  };
}

export function itemChoice({ key, level, items, count = 1, allowDrops = true, title, hint, pack = "features" }) {
  return {
    _id: idFor(`advancement:${key}`),
    type: "ItemChoice",
    configuration: {
      choices: {
        [level]: {
          count,
          replacement: false
        }
      },
      allowDrops,
      type: null,
      pool: items.map(item => ({
        uuid: uuidFor(pack, item)
      })),
      spell: null,
      restriction: {
        list: []
      }
    },
    value: {
      added: {},
      replaced: {}
    },
    title,
    hint,
    icon: null
  };
}

export function traitAdvancement({ key, level, grants, title }) {
  return {
    _id: idFor(`advancement:${key}`),
    type: "Trait",
    configuration: {
      mode: "default",
      allowReplacements: false,
      grants,
      choices: []
    },
    level,
    title,
    classRestriction: "secondary",
    value: {
      chosen: []
    }
  };
}

export function traitChoiceAdvancement({ key, level, pool, count = 1, mode = "default", title, hint = "" }) {
  return {
    _id: idFor(`advancement:${key}`),
    type: "Trait",
    configuration: {
      mode,
      allowReplacements: false,
      grants: [],
      choices: [
        {
          count,
          pool
        }
      ]
    },
    level,
    title,
    hint,
    value: {
      chosen: []
    }
  };
}

export function abilityScoreImprovementAdvancement({ key, level, title = "Улучшение характеристик" }) {
  return {
    _id: idFor(`advancement:${key}`),
    type: "AbilityScoreImprovement",
    configuration: {
      points: 2,
      fixed: {
        str: 0,
        dex: 0,
        con: 0,
        int: 0,
        wis: 0,
        cha: 0
      },
      cap: 2,
      locked: []
    },
    value: {},
    level,
    title
  };
}

export function fixedAbilityScoreAdvancement({ key, level, fixed, max, title }) {
  return {
    _id: idFor(`advancement:${key}`),
    type: "AbilityScoreImprovement",
    configuration: {
      points: 0,
      fixed: {
        str: 0,
        dex: 0,
        con: 0,
        int: 0,
        wis: 0,
        cha: 0,
        ...fixed
      },
      cap: Math.max(1, ...Object.values(fixed).map(value => Math.abs(Number(value) || 0))),
      max,
      locked: Object.keys(fixed)
    },
    value: {
      type: "asi"
    },
    level,
    title,
    icon: null
  };
}

export function scaleValueAdvancement({ key, identifier, scale, title, type = "number" }) {
  return {
    _id: idFor(`advancement:${key}`),
    type: "ScaleValue",
    configuration: {
      identifier,
      type,
      distance: {
        units: ""
      },
      scale
    },
    value: {},
    title,
    hint: ""
  };
}

export function strengthIncreaseAdvancement() {
  return {
    _id: idFor("advancement:steel-giant-strength"),
    type: "AbilityScoreImprovement",
    configuration: {
      points: 0,
      fixed: {
        str: 4,
        dex: 0,
        con: 0,
        int: 0,
        wis: 0,
        cha: 0
      },
      cap: 4,
      max: 24,
      locked: ["str"]
    },
    value: {
      type: "asi"
    },
    level: 5,
    title: "Стальной гигант: Сила +4",
    icon: null
  };
}

export function hitPointsAdvancement(key = "hit-points") {
  return {
    _id: idFor(`advancement:${key}`),
    type: "HitPoints",
    configuration: {},
    value: {}
  };
}

export function subclassAdvancement({ key, level, title = "Подкласс", hint = "" }) {
  return {
    _id: idFor(`advancement:${key}`),
    type: "Subclass",
    configuration: {},
    value: {
      document: null,
      uuid: null
    },
    level,
    title,
    hint,
    icon: null
  };
}

export function attackActivity() {
  const activityId = idFor("activity:weapon-attack");
  return {
    [activityId]: {
      _id: activityId,
      type: "attack",
      activation: {
        type: "action",
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
      attack: {
        ability: "str",
        bonus: "",
        critical: {
          threshold: null
        },
        flat: false,
        type: {
          value: "melee",
          classification: "weapon"
        }
      },
      damage: {
        critical: {
          bonus: ""
        },
        includeBase: true,
        parts: []
      },
      sort: 0
    }
  };
}

export function weapon({ key, name, img, price, weight, dice, damageTypes, properties, special = "" }) {
  const massiveRule =
    "<p><strong>Массивное.</strong> Для эффективного использования оружия требуется Сила 18. Иначе все атаки этим оружием совершаются с помехой.</p>";
  const specialRule = special ? `<p><strong>Особое.</strong> ${special}</p>` : "";
  const automationRule =
    key === "odachi"
      ? "<p><strong>Автоматизация Foundry:</strong> модуль применяет помеху при Силе ниже 18. При использовании Midi-QOL он также применяет помеху, если выбранная цель находится в пределах 5 футов.</p>"
      : "<p><strong>Автоматизация Foundry:</strong> модуль автоматически применяет помеху к броску атаки, если Сила владельца ниже 18.</p>";

  return baseDocument({
    key,
    name,
    type: "weapon",
    img,
    flags: {
      [MODULE_ID]: {
        massiveWeapon: true,
        weaponKey: key,
        closeRangeDisadvantage: key === "odachi"
      }
    },
    system: {
      description: {
        value: `${massiveRule}${specialRule}${automationRule}`,
        chat: ""
      },
      source: sourceData("3"),
      quantity: 1,
      weight: {
        value: weight,
        units: "lb"
      },
      price: {
        value: price,
        denomination: "gp"
      },
      attunement: "",
      equipped: false,
      rarity: "",
      identified: true,
      cover: null,
      range: {
        value: null,
        long: null,
        units: "ft",
        reach: null
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
        base: {
          number: dice.number,
          denomination: dice.denomination,
          bonus: "",
          types: damageTypes,
          custom: {
            enabled: false,
            formula: ""
          },
          scaling: {
            mode: "",
            number: null,
            formula: ""
          }
        }
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
      properties,
      proficient: null,
      crewed: false,
      unidentified: {
        description: ""
      },
      type: {
        value: "martialM",
        baseItem: ""
      },
      activities: attackActivity(),
      identifier: key,
      container: null,
      attuned: false,
      ammunition: {},
      magicalBonus: null,
      mastery: ""
    }
  });
}

export function folder({ key, name, sort, parent = null }) {
  return {
    name,
    sorting: "a",
    folder: parent,
    type: "Item",
    _id: idFor(`folder:${key}`),
    description: "",
    color: null,
    flags: {},
    sort,
    _stats: stats()
  };
}
