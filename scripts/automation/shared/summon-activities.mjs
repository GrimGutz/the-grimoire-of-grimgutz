import { MODULE_ID } from "./constants.mjs";

export function summonActivities(specifications = []) {
  return Object.fromEntries(specifications.map(spec => {
    const id = foundry.utils.randomID();
    const type = spec.type ?? "attack";
    const part = { number: 0, denomination: 0, bonus: "", types: [spec.damageType ?? "force"],
      custom: { enabled: true, formula: spec.formula ?? "0" }, scaling: { mode: "", number: 1, formula: "" } };
    const activity = { _id: id, name: spec.name, type,
      activation: { type: spec.activation ?? "action", value: 1, condition: spec.condition ?? "", override: true },
      consumption: { targets: [], spellSlot: false },
      range: { value: spec.range ?? 5, units: "ft", override: true },
      target: { affects: { type: "creature", count: "1", choice: true }, prompt: true, override: true },
      ...(spec.action ? { flags: { [MODULE_ID]: { action: spec.action, schemaVersion: 1,
        automation: { version: 1, kind: "activity", id: spec.action, action: { id: spec.action, data: {} } } } } } : {}) };
    if (type === "attack") activity.attack = { flat: true, bonus: String(spec.attackBonus ?? 0), ability: "", type: { value: spec.attackType ?? "melee", classification: "weapon" } };
    if (["attack", "damage", "save"].includes(type)) activity.damage = { includeBase: false, parts: spec.formula != null ? [part] : [], ...(type === "save" ? { onSave: spec.onSave ?? "none" } : {}) };
    if (type === "save") activity.save = { ability: [spec.saveAbility ?? "wis"], dc: { calculation: "", formula: String(spec.dc ?? 10) } };
    if (type === "heal") activity.healing = { ...part, types: ["healing"] };
    if (spec.selfCost) {
      activity.flags ??= {}; activity.flags[MODULE_ID] ??= {};
      activity.flags[MODULE_ID].summonSelfCost = spec.selfCost;
      activity.flags[MODULE_ID].schemaVersion = 1;
      activity.flags[MODULE_ID].automation ??= { version: 1, kind: "activity", id: "summon-self-cost", data: {} };
      activity.flags[MODULE_ID].automation.data ??= {};
      activity.flags[MODULE_ID].automation.data.summonSelfCost = spec.selfCost;
    }
    return [id, activity];
  }));
}

export function summonActivitySignature(activities) {
  return JSON.stringify(Object.values(activities ?? {}).map(activity => ({
    name: activity.name, type: activity.type,
    activation: activity.activation?.type, range: activity.range?.value ?? null,
    attack: activity.attack ? { bonus: activity.attack.bonus, flat: activity.attack.flat, type: activity.attack.type?.value,
      critical: activity.attack.critical?.threshold ?? null, ability: activity.attack.ability ?? "" } : null,
    damage: activity.damage?.parts?.map(part => ({ formula: part.custom?.formula, types: [...(part.types ?? [])].sort() })) ?? [],
    healing: activity.healing?.custom?.formula ?? null,
    save: activity.save ? { ability: [...(activity.save.ability ?? [])].sort(), dc: activity.save.dc?.formula } : null,
    action: activity.flags?.[MODULE_ID]?.action ?? null
    , effects: activity.effects ?? [], spent: activity.uses?.spent ?? 0,
    extraFlags: Object.fromEntries(Object.entries(activity.flags ?? {}).filter(([key]) => key !== MODULE_ID))
  })).sort((a, b) => a.name.localeCompare(b.name)));
}
