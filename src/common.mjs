import { createHash } from "node:crypto";

export const MODULE_ID = "the-grimoire-of-grimgutz";
export const CORE_VERSION = "14.364";
export const SYSTEM_VERSION = "5.3.3";

export function idFor(key) {
  return createHash("sha256").update(`${MODULE_ID}:${key}`).digest("hex").slice(0, 16);
}

export function uuidFor(pack, key) {
  return `Compendium.${MODULE_ID}.${pack}.Item.${idFor(key)}`;
}

export function sourceData(page = "") {
  return {
    custom: "Престиж-класс: Сокрушитель; перевод Айвендил, 26.03.2018",
    book: "TGoGG",
    page,
    license: "",
    revision: 1,
    rules: "2014"
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

export function baseDocument({ key, name, type, img, system, folder = null }) {
  return {
    name,
    type,
    img,
    system,
    effects: [],
    flags: {},
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
  folder = null
}) {
  return baseDocument({
    key,
    name,
    type: "feat",
    img,
    folder,
    system: {
      description: {
        value: description,
        chat: ""
      },
      source: sourceData("2–3"),
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
      identifier: key,
      enchant: {}
    }
  });
}

export function utilityActivity({
  key,
  activation = "special",
  condition = "",
  consumeItemUse = false
}) {
  const activityId = idFor(`activity:${key}`);
  return {
    [activityId]: {
      _id: activityId,
      type: "utility",
      activation: {
        type: activation,
        value: activation === "action" || activation === "bonus" || activation === "reaction" ? 1 : null,
        condition,
        override: false
      },
      consumption: {
        targets: consumeItemUse
          ? [{
              type: "itemUses",
              target: "",
              value: "1",
              scaling: {
                mode: "",
                formula: ""
              }
            }]
          : [],
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
        formula: "",
        name: "",
        prompt: false,
        visible: false
      },
      sort: 0
    }
  };
}

export function itemGrant({ key, level, items, title = "Особенности" }) {
  return {
    _id: idFor(`advancement:${key}`),
    type: "ItemGrant",
    configuration: {
      items: items.map(item => ({
        uuid: uuidFor("features", item),
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

export function itemChoice({
  key,
  level,
  items,
  count = 1,
  title,
  hint
}) {
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
      allowDrops: true,
      type: null,
      pool: items.map(item => ({
        uuid: uuidFor("features", item)
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

export function hitPointsAdvancement() {
  return {
    _id: idFor("advancement:hit-points"),
    type: "HitPoints",
    configuration: {},
    value: {}
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

export function weapon({
  key,
  name,
  img,
  price,
  weight,
  dice,
  damageTypes,
  properties,
  special = ""
}) {
  const massiveRule = "<p><strong>Массивное.</strong> Для эффективного использования оружия требуется Сила 18. Иначе все атаки этим оружием совершаются с помехой.</p>";
  const specialRule = special ? `<p><strong>Особое.</strong> ${special}</p>` : "";

  return baseDocument({
    key,
    name,
    type: "weapon",
    img,
    system: {
      description: {
        value: `${massiveRule}${specialRule}`,
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

export function folder({ key, name, sort }) {
  return {
    name,
    sorting: "a",
    folder: null,
    type: "Item",
    _id: idFor(`folder:${key}`),
    description: "",
    color: null,
    flags: {},
    sort,
    _stats: stats()
  };
}

