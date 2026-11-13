import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, itemUses, automationData, notify } from "../shared/helpers.mjs";
import { hunterLevel, hunterPool, hunterFeatureAvailable, trophySnapshot } from "./bounty-hunter.mjs";
import { registerGmRequest, isGmAuthority } from "../shared/gm-requests.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { areaDamagePart } from "../shared/area-definitions.mjs";

export const unusedHunterDisposables = actor =>
  [...(actor?.items ?? [])].filter(
    i => automationData(i).hunterDisposable && itemUses(i).remaining > 0 && !trophySnapshot(i)?.destroyed
  );
export function freezeHunterFormula(formula, data) {
  let result = String(formula ?? "0");
  for (let i = 0; i < 8 && result.includes("@"); i++)
    result = result.replace(/@([\w.-]+)/g, (_m, path) => {
      const value = path.split(".").reduce((v, key) => v?.[key], data);
      if (value === undefined || value === null || typeof value === "object")
        throw Error(`Не удалось сохранить параметр ${path}.`);
      return `(${String(value)})`;
    });
  if (result.includes("@")) throw Error("Неразрешённая ссылка в одноразовом трофее.");
  return result;
}
/** Freeze public native action data; the new owner never supplies its ability modifier or save DC. */
export function capturedHunterAction(source, owner, { itemId, activityId, poolId } = {}) {
  if (!poolId) throw Error("Нет общего запаса Охотника.");
  if (!["attack", "save", "damage", "heal", "utility"].includes(source?.type))
    throw Error("Связанное/нестандартное действие требует ручной карточки GM.");
  const data = source.toObject(),
    rollData = source.getRollData?.() ?? source.item.getRollData?.() ?? {},
    sourceItem = source.item.toObject();
  if (data.consumption?.spellSlot || data.consumption?.targets?.some(t => !["itemUses"].includes(t.type))) {
    // Original ammunition, other items and cast/enchant chains cannot be copied silently.
    throw Error("Действие использует связанные ресурсы; GM должен подготовить независимую карточку.");
  }
  data._id = activityId;
  data.activation = { type: "action", value: 1, override: true, condition: "Одноразовый трофей" };
  data.consumption = {
    targets: [
      { type: "itemUses", target: "", value: "1" },
      { type: "itemUses", target: poolId, value: "1" }
    ],
    spellSlot: false,
    scaling: { allowed: false, max: "" }
  };
  data.uses = { max: "", spent: 0, recovery: [] };
  data.flags = { [MODULE_ID]: { hunterCaptured: true } };
  if (data.attack) {
    const native = source.getAttackData?.();
    if (!native) throw Error("Нет исходного бонуса атаки.");
    data.attack = {
      ...data.attack,
      ability: "none",
      flat: true,
      bonus: freezeHunterFormula(native.parts.join(" + ") || "0", native.data)
    };
  }
  if (data.save) {
    const dc = Number(source.save?.dc?.value);
    if (!Number.isFinite(dc) || dc < 1) throw Error("Нет исходной СЛ спасброска.");
    data.save.dc = { calculation: "", formula: String(dc) };
  }
  if (source.damage?.parts) {
    const native = source.getDamageConfig?.();
    if (!native) throw Error("Не найдены исходные параметры урона.");
    data.damage = {
      ...data.damage,
      includeBase: false,
      parts: (native.rolls ?? []).map(roll => {
        const formula = freezeHunterFormula(roll.parts.join(" + "), roll.data);
        const types = [...(roll.options?.types ?? [])];
        if (!types.length && roll.options?.type) types.push(roll.options.type);
        if (!types.length) throw Error("Нет исходного типа урона.");
        return { ...areaDamagePart({ formula, type: types[0] }), types };
      })
    };
  }
  if (data.healing) {
    data.healing = {
      ...data.healing,
      number: 0,
      denomination: 0,
      bonus: "",
      custom: { enabled: true, formula: freezeHunterFormula(source.healing.formula, rollData) }
    };
  }
  if (data.roll?.formula) data.roll.formula = freezeHunterFormula(data.roll.formula, rollData);
  if (data.damage?.critical?.bonus)
    data.damage.critical.bonus = freezeHunterFormula(data.damage.critical.bonus, rollData);
  // A feat has no weapon/spell parent range to inherit.
  const range = source.range ?? {},
    weaponRange = source.item.system.range ?? {};
  data.range = {
    ...data.range,
    override: true,
    value: range.value ?? (source.attack?.type?.value === "melee" ? (weaponRange.reach ?? 5) : weaponRange.value),
    units: range.units || weaponRange.units || "ft"
  };
  data.target = { ...data.target, override: true };
  data.duration = { ...data.duration, override: true };
  const ids = new Set((data.effects ?? []).map(e => e._id));
  const effects = (sourceItem.effects ?? [])
    .filter(e => ids.has(e._id))
    .map(effect => ({
      ...effect,
      origin: null,
      transfer: false,
      disabled: false,
      flags: { dae: { expiryMode: "delete" } },
      system: {
        ...effect.system,
        changes: (effect.system?.changes ?? []).map(change => ({
          ...change,
          value: String(change.value ?? "").includes("@") ? freezeHunterFormula(change.value, rollData) : change.value
        }))
      }
    }));
  if (ids.size !== effects.length) throw Error("Действие содержит внешний эффект; GM должен подготовить его отдельно.");
  return {
    _id: itemId,
    name: `Одноразовый трофей: ${source.name ?? source.item.name}`,
    type: "feat",
    img: source.item.img,
    effects,
    flags: {
      [MODULE_ID]: {
        schemaVersion: 1,
        automation: {
          version: 1,
          kind: "item",
          id: `hunter-disposable-${itemId}`,
          data: { hunterFeature: true, hunterDisposable: true },
          requirements: { minimumLevel: 1 }
        },
        hunterFeature: true,
        minimumLevel: 1,
        hunterDisposable: true,
        hunterTrophyState: {
          confirmed: true,
          carried: true,
          destroyed: false,
          cr: Number(source.actor.system.details.cr),
          creatureType: source.actor.system.details.type?.value,
          sourceActorUuid: source.actor.uuid,
          sourceActivityUuid: source.uuid
        }
      }
    },
    system: {
      identifier: `hunter-disposable-${itemId}`,
      type: { value: "class", subtype: "" },
      description: { value: sourceItem.system.description?.value ?? "", chat: "" },
      source: { custom: `Одноразовый трофей из ${source.actor.name}`, revision: 1 },
      uses: { max: "1", spent: 0, recovery: [] },
      activities: { [activityId]: data }
    }
  };
}
registerGmRequest("hunter-disposable", (actor, data) =>
  serialMutation(`hunter-capture:${actor.uuid}`, async () => {
    const feature = await fromUuid(data.itemUuid);
    if (
      !enabled() ||
      feature?.actor?.uuid !== actor.uuid ||
      feature.system.identifier !== "hunter-disposable" ||
      !hunterFeatureAvailable(actor, feature)
    )
      return false;
    if (unusedHunterDisposables(actor).length >= hunterLevel(actor)) {
      notify("Достигнут предел неиспользованных одноразовых трофеев.", "warn");
      return false;
    }
    const gm = { uuid: actor.uuid, testUserPermission: user => user.isGM };
    const sources = [...(game.actors ?? [])].filter(
      a => a.type === "npc" && Number.isFinite(Number(a.system?.details?.cr)) && Number(a.system.details.cr) <= 10
    );
    const uuid = await askOwner(gm, {
      title: "Источник одноразового трофея (GM)",
      choices: sources.map(a => [a.uuid, a.name])
    });
    const creature = sources.find(a => a.uuid === uuid);
    if (!creature) return false;
    if (
      !(await confirmOwner(
        gm,
        "Изготовление (GM)",
        "Источник повержен, физический след и час изготовления подтверждены? Временные/призванные источники требуют отдельного разрешения GM."
      ))
    )
      return false;
    const actions = [...(creature.items ?? [])].flatMap(item =>
      [...(item.system.activities?.values?.() ?? [])].filter(a =>
        ["attack", "save", "damage", "heal", "utility"].includes(a.type)
      )
    );
    const chosen = await askOwner(gm, {
      title: "Одно действие источника",
      choices: actions.map(a => [a.uuid, `${a.item.name}: ${a.name ?? a.type}`])
    });
    const activity = actions.find(a => a.uuid === chosen);
    if (!activity) return false;
    if (!isGmAuthority() || unusedHunterDisposables(actor).length >= hunterLevel(actor)) return false;
    const item = capturedHunterAction(activity, actor, {
      itemId: foundry.utils.randomID(),
      activityId: foundry.utils.randomID(),
      poolId: hunterPool(actor)?.id
    });
    await actor.createEmbeddedDocuments("Item", [item]);
    return true;
  })
);
export function validateHunterDisposable(activity) {
  if (!enabled() || !automationData(activity?.item).hunterDisposable) return;
  const item = activity.item,
    state = trophySnapshot(item),
    actor = activity.actor;
  if (
    !hunterFeatureAvailable(actor, item) ||
    !state?.confirmed ||
    !state.carried ||
    state.destroyed ||
    Number(state.cr) > 10 ||
    itemUses(item).remaining < 1 ||
    itemUses(hunterPool(actor)).remaining < 1
  ) {
    notify("Одноразовый трофей недоступен, утрачен или нет общего ресурса.", "warn");
    return false;
  }
}
