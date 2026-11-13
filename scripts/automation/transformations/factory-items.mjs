import { MODULE_ID } from "../shared/constants.mjs";
import { FACTORY_ICON } from "../shared/factory-definitions.mjs";
import { FACTORY_AUGMENTS, factoryUpgradeNote } from "../shared/factory-augments.mjs";
import { areaDamagePart } from "../shared/area-definitions.mjs";
import { migrationFingerprint } from "../shared/owned-item-migration.mjs";
import { factoryContext, factoryAugment, factoryRecords, factoryInstalledItem } from "./factory.mjs";
export function factoryActivity(
  name,
  operation,
  { recordId = null, type = "utility", activation = "action", id = foundry.utils.randomID() } = {}
) {
  return {
    _id: id,
    name,
    type,
    activation: { type: activation, value: activation === "special" ? null : 1, override: true },
    consumption: { spellSlot: false, targets: [] },
    uses: { max: "", spent: 0, recovery: [] },
    range: { units: "self", value: null, override: true },
    target: {
      override: true,
      prompt: false,
      affects: { type: "self", count: "", choice: false },
      template: { type: "" }
    },
    duration: { value: "", units: "inst", concentration: false, override: true },
    effects: [],
    ...(type === "utility" ? { roll: { formula: "", prompt: false, visible: false } } : {}),
    flags: {
      [MODULE_ID]: {
        schemaVersion: 1,
        action: operation ? "factory-control" : "",
        factoryOperation: operation,
        factoryRecordId: recordId
      }
    }
  };
}
const opLabels = {
  heart: "Второе Сердце",
  spell: "Нативное заклинание",
  threats: "Обнаружение угроз",
  agility: "Удвоить скорость",
  "agility-reset": "Подтвердить ход без движения (GM)",
  stomp: "Силовые топтуны: круг",
  "air-strike": "Воздушная атака",
  drive: "Интеллект-привод: инструкция",
  inertia: "Инерция: подтверждённый бонус (GM)",
  "auto-save": "Автоуспех: инструкция",
  defense: "Защита реакцией: инструкция",
  attenuation: "Ослабление магии: инструкция",
  bleed: "Кровотечение: правила (GM)",
  push: "Подтвердить отбрасывание (GM)",
  keys: "Проверка воровских инструментов"
};
export function factoryUpgradeItem(actor, record) {
  const def = FACTORY_AUGMENTS.find(a => a.id === record.augmentId),
    ctx = factoryContext(actor, record),
    weapon = ["fangs", "mantis"].includes(def.id),
    modifier = record.ability === "str" ? Number(actor.system.abilities.str.mod) : Number(ctx.int),
    activities = {};
  if (weapon) {
    const attack = factoryActivity(def.name, "", { recordId: record.id, type: "attack" });
    attack.range = { units: "ft", value: "5", override: true };
    attack.target.affects = { type: "creature", count: "1", choice: false };
    attack.attack = {
      flat: true,
      ability: "",
      bonus: String(Number(actor.system.attributes.prof) + modifier),
      type: { value: "melee", classification: "weapon" }
    };
    attack.damage = {
      includeBase: false,
      parts: [
        areaDamagePart({
          formula: `2d${def.id === "fangs" ? 4 : 6} + ${modifier}`,
          type: def.id === "fangs" ? "piercing" : "slashing"
        })
      ]
    };
    attack.flags[MODULE_ID].factoryWeapon = true;
    activities[attack._id] = attack;
    if (def.id === "mantis") {
      const bonus = factoryActivity("Бонусная атака после действия Атака", "mantis-bonus", {
        recordId: record.id,
        activation: "bonus"
      });
      activities[bonus._id] = bonus;
    }
  }
  for (const op of def.operations) {
    const a = factoryActivity(opLabels[op], op, { recordId: record.id });
    activities[a._id] = a;
  }
  const max =
    def.id === "firewall"
      ? factoryAugment(actor, "neural")
        ? 2
        : 1
      : ["heart", "immunizer", "mindlord", "sandevistan"].includes(def.id)
        ? 1
        : null;
  return {
    name: `Фабрика: ${def.name}`,
    type: weapon ? "weapon" : "feat",
    img: FACTORY_ICON,
    effects: [],
    flags: {
      [MODULE_ID]: {
        schemaVersion: 1,
        factoryInstalled: { recordId: record.id, ownerUuid: record.ownerUuid, augmentId: def.id }
      }
    },
    system: {
      identifier: `factory-installed-${def.id}`,
      description: {
        value: `<p>${def.text}</p><p>Установлено Фабрикой. ${def.cost} зм; ${def.area}. ${factoryUpgradeNote(def.id)} Условия вне данных броска подтверждает GM. Правила не заданного срока/восстановления не выдумываются.</p>`
      },
      ...(weapon
        ? {
            quantity: 1,
            equipped: true,
            identified: true,
            proficient: 1,
            type: { value: "simpleM", baseItem: "" },
            damage: {
              base: {
                number: 2,
                denomination: def.id === "fangs" ? 4 : 6,
                bonus: "",
                types: [def.id === "fangs" ? "piercing" : "slashing"]
              }
            },
            properties: []
          }
        : { type: { value: "class", subtype: "" } }),
      uses: {
        max: max == null ? "" : String(max),
        spent: 0,
        recovery:
          max == null
            ? []
            : [{ period: ["mindlord", "sandevistan"].includes(def.id) ? "sr" : "lr", type: "recoverAll" }]
      },
      activities
    }
  };
}
export function factoryItemFingerprint(item) {
  const data = item.toObject?.() ?? structuredClone(item);
  delete data._id;
  delete data._stats;
  delete data.folder;
  delete data.sort;
  delete data.ownership;
  if (data.system?.uses) delete data.system.uses.spent;
  if (data.flags?.[MODULE_ID]) delete data.flags[MODULE_ID].factoryManagedFingerprint;
  return migrationFingerprint(data);
}
export async function syncFactoryItems(actor) {
  for (const record of factoryRecords(actor)) {
    const item = factoryInstalledItem(actor, record);
    if (!item) continue;
    const before = item.getFlag?.(MODULE_ID, "factoryManagedFingerprint");
    if (before && factoryItemFingerprint(item) !== before) continue;
    const desired = factoryUpgradeItem(actor, record),
      old = item.toObject();
    const oldActivities = Object.values(old.system.activities ?? {}),
      newActivities = Object.values(desired.system.activities);
    for (const [i, a] of newActivities.entries()) a._id = oldActivities[i]?._id ?? a._id;
    desired.system.activities = Object.fromEntries(newActivities.map(a => [a._id, a]));
    desired.system.uses.spent = Number(old.system.uses?.spent ?? 0);
    // Native schemas fill defaults. Compare the merged system, not a sparse
    // generated item against a fully initialized Document (which always differs).
    const system = foundry.utils.mergeObject(old.system, desired.system, { inplace: false });
    if (JSON.stringify(system) !== JSON.stringify(old.system)) await item.update({ system });
    const hash = factoryItemFingerprint(item);
    if (item.getFlag(MODULE_ID, "factoryManagedFingerprint") !== hash)
      await item.setFlag(MODULE_ID, "factoryManagedFingerprint", hash);
  }
}
