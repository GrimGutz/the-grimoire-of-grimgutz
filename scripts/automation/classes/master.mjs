import {MODULE_ID, SETTINGS} from "../shared/constants.mjs";
import {automationData, enabled, findFeature, isAutomationAuthority, itemIdentifier, notify} from "../shared/helpers.mjs";
import {classLevel} from "../shared/selectors.mjs";
import {registerGmRequest, requestGm} from "../shared/gm-requests.mjs";
import {askOwner, confirmOwner} from "../shared/owner-prompts.mjs";
import {serialMutation} from "../shared/transactions.mjs";
import {encounterForActor, combatTurnSnapshot} from "../shared/combat-flow.mjs";
import {flaggedPassiveEffectData, syncFlaggedPassiveEffects} from "../effects/passive-helpers.mjs";

export const masterLevel = actor => classLevel(actor, "master");
export const masterPath = actor => automationData([...(actor?.items ?? [])].find(item => item.type === "subclass" && item.system?.classIdentifier === "master")).masterSubclass ?? null;
export function masterConfiguration(actor) {
  const config = actor?.getFlag?.(MODULE_ID, "masterConfiguration");
  return config?.path === masterPath(actor) ? config : null;
}
export function masterMatchesWeapon(actor, item) {
  const config = masterConfiguration(actor);
  return Boolean(masterLevel(actor) && config && config.path !== "arcana" && item?.type === "weapon"
    && (config.weaponType ? item.system?.type?.baseItem === config.weaponType : item.id === (config.weaponId ?? config.weaponUuid?.split(".Item.").at(-1))));
}
export function masterMatchesSpell(actor, item) {
  const config = masterConfiguration(actor);
  return Boolean(masterLevel(actor) && config?.path === "arcana" && item?.type === "spell" && item.system?.school === config.school);
}
export const masterDC = actor => {
  const ability = masterConfiguration(actor)?.ability;
  return ability && actor.system?.abilities?.[ability] ? 8 + Number(actor.system.attributes.prof) + Number(actor.system.abilities[ability].mod) : null;
};
export function masterFeatureAvailable(actor, item) {
  const data = automationData(item);
  return data.masterFeature && masterLevel(actor) >= Number(data.minimumLevel ?? 1)
    && (!data.masterWeaponRequired || ["blade", "archer"].includes(masterPath(actor)))
    && (!data.masterPath || masterPath(actor) === data.masterPath);
}
export function masterPrerequisiteFailures(actor) {
  const failures = [];
  if (Number(actor.system?.details?.level ?? 0) < 10) failures.push("общий уровень 10");
  if (!["str", "dex", "int", "wis", "cha"].some(a => Number(actor.system?.abilities?.[a]?.value) >= 20)) failures.push("Сила, Ловкость, Интеллект, Мудрость или Харизма 20");
  const known = [...Object.values(actor.system?.skills ?? {}), ...Object.values(actor.system?.tools ?? {})].some(p => Number(p.value) >= 1)
    || Boolean(actor.system?.traits?.weaponProf?.value?.size) || [...(actor.items ?? [])].some(i => i.type === "weapon" && i.system?.proficient === true);
  if (!known) failures.push("хотя бы одно владение навыком, инструментом или оружием");
  return failures;
}
export function validateMasterItem(item, _data, options, userId) {
  if (userId !== game.user.id || !enabled()) return;
  const actor = item.parent; if (!actor) return;
  if (item.type === "class" && itemIdentifier(item) === "master" && game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) {
    const failures = masterPrerequisiteFailures(actor);
    if (failures.length) {notify(`Мастер: не выполнено ${failures.join(", ")}.`, "warn"); return false;}
  }
  if (automationData(item).masterFeature && !options?.isAdvancement && !masterFeatureAvailable(actor, item)) {
    notify("Техника/особенность требует подходящий уровень и путь Мастера.", "warn"); return false;
  }
  if (item.type === "subclass" && item.system?.classIdentifier === "master") {
    const existing = [...actor.items].find(i => i.type === "subclass" && i.system?.classIdentifier === "master" && i.id !== item.id);
    if (existing) {notify("Путь Мастера уже выбран; смену должен отдельно согласовать GM.", "warn"); return false;}
  }
}

export function masterProficiencies(actor, {expertiseOnly = false, exclude = null} = {}) {
  return ["skills", "tools"].flatMap(kind => Object.entries(actor.system?.[kind] ?? {}).filter(([key, data]) =>
    Number(data.value) >= 1 && (!expertiseOnly || Number(data.value) < 2) && `${kind}.${key}` !== exclude)
    .map(([key, data]) => ({id: `${kind}.${key}`, label: data.label ?? data.name ?? CONFIG.DND5E[kind]?.[key]?.label ?? key})));
}
const syncs = new Set();
export function masterPassiveDefinitions(actor) {
  if (!masterLevel(actor)) return [];
  const config = masterConfiguration(actor), definitions = [];
  const add = (key, changes) => {const feature = findFeature(actor, key); if (feature && masterFeatureAvailable(actor, feature) && changes.length)
    definitions.push(flaggedPassiveEffectData(MODULE_ID, "masterPassive", {key, feature, changes}));};
  const change = (key, value, type = "upgrade", phase = "final") => ({key, value: String(value), type, phase, priority: 20});
  for (const [key, selected] of [["master-chosen-proficiency", config?.proficiency], ["master-perfect-hand", config?.secondProficiency]]) {
    if (!selected || !masterProficiencies(actor).some(p => p.id === selected)) continue;
    if (key === "master-perfect-hand" && selected === config.proficiency) continue;
    add(key, [change(`system.${selected}.value`, 2, "upgrade", "initial")]);
  }
  if (config?.proficiency && masterProficiencies(actor).some(p => p.id === config.proficiency))
    add("master-perfect-craft", [change(`system.${config.proficiency}.roll.min`, 10)]);
  add("master-unwavering-concentration", [change("system.attributes.concentration.roll.mode", 1)]);
  if (config?.held && [...(actor.items ?? [])].some(item => masterMatchesWeapon(actor, item) && item.system.equipped === true))
    add("master-defensive-stance", [change("system.attributes.ac.bonus", 1, "add")]);
  return definitions;
}
export async function syncMaster(actor) {
  if (!actor?.isOwner || !enabled() || !isAutomationAuthority(actor)) return;
  await syncFlaggedPassiveEffects(actor, syncs, MODULE_ID, "masterPassive", masterPassiveDefinitions);
  if (!masterLevel(actor)) return;
  for (const key of ["master-will-perfection", "master-undeniable-magic"]) {
    const item = findFeature(actor, key); if (!item) continue;
    const max = String(actor.system.attributes.prof);
    if (String(item.system.uses.max) !== max) await item.update({"system.uses.max": max});
  }
}

const ONCE_PER_TURN = new Set(["long-lunge", "blade-onslaught", "retreating-shot", "disarming-strike", "risky-maneuver", "steel-barrier", "disrupting-shot", "suppressing-shot", "pinning-maneuver", "piercing-shot", "cleave", "ricochet", "deadly-range"].map(id => `master-${id}`));
export function masterTechniqueUsage(actor, workflowId, key, turn) {
  const state = actor.getFlag(MODULE_ID, "masterTechniqueUsage") ?? {events: {}, turns: {}};
  if (state.events?.[workflowId]?.includes(key)) return false;
  if (turn && ONCE_PER_TURN.has(key) && state.turns?.[turn]?.includes(key)) return false;
  const count = state.events?.[workflowId]?.length ?? 0;
  if (count >= (masterLevel(actor) >= 5 ? 3 : masterLevel(actor) >= 3 ? 2 : 1)) return false;
  if (count > 0) {
    const round = turn?.split(":").slice(0, -1).join(":"), series = actor.getFlag(MODULE_ID, "masterSeries");
    if (!round) return false;
    if (count === 1 && !masterSeriesAllowed(masterLevel(actor), series, round, 2)) return false;
    if (count > 1 && (!series || series.round !== round || series.effects >= masterSeriesLimits(masterLevel(actor)).effects)) return false;
  }
  return true;
}
export async function recordMasterTechnique(actor, workflowId, key, turn = null) {
  return serialMutation(`master-series:${actor.uuid}`, async () => {
    if (!masterTechniqueUsage(actor, workflowId, key, turn)) return false;
    const state = structuredClone(actor.getFlag(MODULE_ID, "masterTechniqueUsage") ?? {events: {}, turns: {}});
    state.events ??= {}; state.turns ??= {};
    const previousCount = state.events[workflowId]?.length ?? 0;
    state.events[workflowId] = [...(state.events[workflowId] ?? []), key];
    if (turn && ONCE_PER_TURN.has(key)) state.turns[turn] = [...(state.turns[turn] ?? []), key];
    state.events = Object.fromEntries(Object.entries(state.events).slice(-100)); state.turns = Object.fromEntries(Object.entries(state.turns).slice(-30));
    const update = {[`flags.${MODULE_ID}.masterTechniqueUsage`]: state};
    if (previousCount > 0) {
      const round = turn.split(":").slice(0, -1).join(":"), previous = actor.getFlag(MODULE_ID, "masterSeries");
      const series = previous?.round === round ? previous : {round, series: 0, effects: 0};
      update[`flags.${MODULE_ID}.masterSeries`] = {...series, series: series.series + (previousCount === 1 ? 1 : 0), effects: series.effects + (previousCount === 1 ? 2 : 1)};
    }
    await actor.update(update); return true;
  });
}
export async function releaseMasterTechnique(actor, workflowId, key, turn = null) {
  return serialMutation(`master-series:${actor.uuid}`, async () => {
    const state = structuredClone(actor.getFlag(MODULE_ID, "masterTechniqueUsage") ?? {events: {}, turns: {}}), list = state.events?.[workflowId] ?? [];
    if (!list.includes(key)) return;
    state.events[workflowId] = list.filter(value => value !== key);
    if (turn && state.turns?.[turn]) state.turns[turn] = state.turns[turn].filter(value => value !== key);
    const update = {[`flags.${MODULE_ID}.masterTechniqueUsage`]: state}, round = turn?.split(":").slice(0,-1).join(":"), series = actor.getFlag(MODULE_ID, "masterSeries");
    if (list.length >= 2 && series?.round === round) update[`flags.${MODULE_ID}.masterSeries`] = {...series,
      series: Math.max(0, series.series - (list.length === 2 ? 1 : 0)), effects: Math.max(0, series.effects - (list.length === 2 ? 2 : 1))};
    await actor.update(update);
  });
}
export function masterSeriesLimits(level) {return level >= 5 ? {perSeries: 3, series: 3, effects: 6} : {perSeries: 2, series: 2, effects: 4};}
export function masterSeriesAllowed(level, state, round, effects) {
  if (level < 3 || !Number.isInteger(effects) || effects < 2 || effects > masterSeriesLimits(level).perSeries) return false;
  const previous = state?.round === round ? state : {series: 0, effects: 0}, limits = masterSeriesLimits(level);
  return previous.series < limits.series && previous.effects + effects <= limits.effects;
}

async function configure(actor) {
  const path = masterPath(actor); if (!path) {notify("Сначала выберите подкласс-путь Мастера.", "warn"); return false;}
  const previous = masterConfiguration(actor) ?? {}, config = {...previous, path};
  if (path === "arcana") {
    const candidates = [...actor.items].filter(i => i.type === "class" && i.system.identifier !== "master" && i.system.spellcasting?.progression && i.system.spellcasting.progression !== "none");
    const uuid = await askOwner(actor, {title: "Путь Арканы", label: "Класс с Использованием заклинаний", choices: candidates.map(i => [i.uuid, i.name])});
    const cls = candidates.find(i => i.uuid === uuid); if (!cls) return false;
    config.casterUuid = cls.uuid; config.casterId = cls.id; config.ability = cls.system.spellcasting.ability;
    if (!config.ability) config.ability = await askOwner(actor, {title: "Характеристика заклинателя", choices: ["int", "wis", "cha"].map(k => [k, k])});
    if (!config.ability) return false;
    config.school = await askOwner(actor, {title: "Избранная школа", choices: Object.entries(CONFIG.DND5E.spellSchools).map(([k,v]) => [k, v.label ?? v])});
    if (!config.school) return false;
  } else {
    const candidates = [...actor.items].filter(i => i.type === "weapon" && [...(i.system.activities?.values?.() ?? [])]
      .some(a => a.type === "attack" && a.attack?.type?.value === (path === "blade" ? "melee" : "ranged")));
    const uuid = await askOwner(actor, {title: "Избранное оружие", choices: candidates.map(i => [i.uuid, i.name])});
    const weapon = candidates.find(i => i.uuid === uuid); if (!weapon) return false;
    if (!await confirmOwner(actor, "Путь Мастера", "Подтверждаете владение этим типом оружия и характеристику, которую используете для атаки и урона?")) return false;
    config.weaponType = weapon.system.type?.baseItem || null; config.weaponUuid = weapon.uuid; config.weaponId = weapon.id;
    config.ability = await askOwner(actor, {title: "Характеристика пути", choices: ["str", "dex", "int", "wis", "cha"].map(k => [k, `${k}: ${actor.system.abilities[k].value}`])});
    if (!config.ability) return false;
    config.held = await confirmOwner(actor, "Держите избранное оружие?", "Для условной Оборонительной стойки; обновите настройку при смене оружия.");
  }
  if (game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES) && Number(actor.system.abilities[config.ability]?.value) < 20) {
    notify("Характеристика пути должна быть не ниже 20.", "warn"); return false;
  }
  await actor.setFlag(MODULE_ID, "masterConfiguration", config); await syncMaster(actor); return true;
}
async function chooseProficiency(actor, second = false, foresight = false) {
  const config = masterConfiguration(actor); if (!config) return false;
  const choices = masterProficiencies(actor, {expertiseOnly: !foresight, exclude: second ? config.proficiency : null});
  const selected = await askOwner(actor, {title: "Владение Мастера", choices: choices.map(p => [p.id, p.label])});
  if (!choices.some(p => p.id === selected)) return false;
  await actor.setFlag(MODULE_ID, foresight ? "masterForesight" : "masterConfiguration", foresight ? selected : {...config, [second ? "secondProficiency" : "proficiency"]: selected});
  await syncMaster(actor); return true;
}
registerGmRequest("master-settings", async (actor, data) => {
  const item = await fromUuid(data.itemUuid);
  if (item?.actor?.uuid !== actor.uuid || !masterFeatureAvailable(actor, item)) return false;
  const id = automationData(item).masterControl;
  if (id === "perfection-path" || id.startsWith("path-")) return configure(actor);
  if (["chosen-proficiency", "perfect-hand", "foresight"].includes(id)) return chooseProficiency(actor, id === "perfect-hand", id === "foresight");
  if (id === "rapid-reload") {
    const config = masterConfiguration(actor); if (!config) return false;
    const value = await askOwner(actor, {title: "Свойство перезарядки", choices: [["lod", "Loading"], ["rel", "Reload"]]});
    if (!value) return false; await actor.setFlag(MODULE_ID, "masterConfiguration", {...config, reloadProperty: value}); return true;
  }
  if (id === "ability-improvement") return serialMutation(`master-asi:${actor.uuid}`, async () => {
    if (actor.getFlag(MODULE_ID, "masterASI")) {notify("Выбор Увеличения характеристик уже сделан.", "warn"); return false;}
    const config = masterConfiguration(actor); if (!config) return false;
    const choice = await askOwner(actor, {title: "Увеличение характеристик", choices: [["ability", "+2 к характеристике пути и её максимуму"], ["feat", "Выбрать черту через стандартный интерфейс"]]});
    if (!choice) return false;
    const update = {[`flags.${MODULE_ID}.masterASI`]: {choice, ability: config.ability}};
    if (choice === "ability") {
      const raw = actor._source.system.abilities[config.ability];
      update[`system.abilities.${config.ability}.value`] = Number(raw.value) + 2;
      update[`system.abilities.${config.ability}.max`] = Number(raw.max ?? CONFIG.DND5E.maxAbilityScore ?? 20) + 2;
    }
    await actor.update(update); if (choice === "feat") notify("Добавьте выбранную черту через стандартный интерфейс Foundry."); return true;
  });
  if (id === "combination") return serialMutation(`master-series:${actor.uuid}`, async () => {
    const combat = encounterForActor(actor), snapshot = combat && combatTurnSnapshot(combat);
    if (!snapshot) {notify("Без боя учёт произвольной серии подтверждает Мастер.", "warn"); return false;}
    const amount = await askOwner(actor, {title: "Записать подтверждённую серию", choices: Array.from({length: masterLevel(actor) >= 5 ? 2 : 1}, (_,i) => [String(i+2), `${i+2} разных эффекта`])});
    if (!amount) return false;
    const round = `${snapshot.id}:${snapshot.current.round}`, previous = actor.getFlag(MODULE_ID, "masterSeries");
    if (!masterSeriesAllowed(masterLevel(actor), previous, round, Number(amount))) {notify("Лимит серий/эффектов этого раунда исчерпан.", "warn"); return false;}
    const state = previous?.round === round ? previous : {round, series: 0, effects: 0};
    await actor.setFlag(MODULE_ID, "masterSeries", {...state, series: state.series + 1, effects: state.effects + Number(amount)}); return true;
  });
  return false;
});
export function masterSettings(actor, item) {return requestGm("master-settings", actor, {itemUuid: item.uuid}, {timeoutMs: 120000});}

/** The native descriptor is ephemeral. Extend only the chosen caster; its model
 * handles leveled/pact rounding. Never add another class or character level. */
export function extendMasterCasting(actor, cls, spellcasting) {
  const config = masterConfiguration(actor);
  if (!enabled() || config?.path !== "arcana" || (cls.uuid !== config.casterUuid && cls.id !== (config.casterId ?? config.casterUuid?.split(".Item.").at(-1))) || !masterLevel(actor) || !spellcasting || spellcasting.masterExtended) return 0;
  const bonus = masterLevel(actor); spellcasting.levels = Number(spellcasting.levels ?? cls.system.levels) + bonus; spellcasting.masterExtended = true;
  return bonus;
}

export function validateMasterAdvancement(manager, _updates, toCreate, toUpdate, toDelete) {
  if (!enabled()) return;
  const actor = manager.actor, deleted = new Set(toDelete), rows = new Map([...actor.items].filter(i => !deleted.has(i.id)).map(i => [i.id, i.toObject()]));
  const mergeDraft = (base, patch) => {
    const result = structuredClone(base ?? {});
    for (const [key,value] of Object.entries(patch)) {
      if (key.includes(".")) {const parts=key.split("."),last=parts.pop();let node=result;for(const part of parts)node=node[part]??={};node[last]=structuredClone(value);}
      else result[key]=value&&typeof value==="object"&&!Array.isArray(value)?mergeDraft(result[key],value):structuredClone(value);
    } return result;
  };
  for (const row of toUpdate) rows.set(row._id, mergeDraft(rows.get(row._id), row)); for (const row of toCreate) rows.set(row._id, row);
  const items = [...rows.values()], cls = items.find(i => i.type === "class" && itemIdentifier(i) === "master"); if (!cls) return;
  if (game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES) && toCreate.some(i => i === cls) && masterPrerequisiteFailures(actor).length) {notify("Не выполнены требования Мастера.", "warn"); return false;}
  const paths = items.filter(i => i.type === "subclass" && i.system?.classIdentifier === "master");
  if (paths.length > 1) {notify("Мастер может иметь только один путь.", "warn"); return false;}
  const path = automationData(paths[0]).masterSubclass, level = Number(cls.system.levels), techniques = items.filter(i => automationData(i).masterTechnique);
  const ids = techniques.map(itemIdentifier), limit = [0,2,3,4,6,7][Math.min(5, level)];
  if (ids.length !== new Set(ids).size || techniques.length > limit || techniques.some(i => automationData(i).minimumLevel > level || (automationData(i).masterPath && automationData(i).masterPath !== path)
    || (automationData(i).masterWeaponRequired && !["blade", "archer"].includes(path)))) {
    notify("Выберите разные техники доступного уровня и своего пути; замена не увеличивает число известных.", "warn"); return false;
  }
}
