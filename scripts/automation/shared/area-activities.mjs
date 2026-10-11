import { MODULE_ID } from "./constants.mjs";
import { activityActor, automationAction, automationData, enabled, findFeature, itemIdentifier, notify } from "./helpers.mjs";
import { AREA_DEFINITIONS, areaActivityData } from "./area-definitions.mjs";
import { choiceDialog, numberDialog } from "./dialogs.mjs";
import { sourceTokenForActor, applyTemporaryHp } from "./zones.mjs";
import { feetToSceneUnits } from "./spatial.mjs";
import { getAreaWorkflowClass } from "../midi/area-workflow.mjs";

let activeUse = null;
const clone = value => foundry.utils.deepClone(value);

export function ownedAreaActivity(actor, feature, action = "") {
  const item = findFeature(actor, feature), collection = item?.system?.activities;
  const activities = collection?.values ? [...collection.values()] : Object.values(collection ?? {});
  return activities.find(activity => (!action || automationAction(activity) === action) && areaDefinitionFor(activity));
}

export function areaDefinitionFor(activity) {
  const data = automationData(activity);
  if (data.areaResolved) return null;
  if (data.area && typeof data.area === "object") return clone(data.area);
  const key = itemIdentifier(activity.item), action = automationAction(activity);
  const definition = AREA_DEFINITIONS.find(entry => entry.feature === key
    && (entry.action ? entry.action === action : entry.activityName === activity.name));
  if (definition) return clone(definition);
  const template = activity.target?.template;
  const isModule = Boolean(activity.item?.flags?.[MODULE_ID])
    || String(activity.item?._stats?.compendiumSource ?? "").startsWith(`Compendium.${MODULE_ID}.`);
  if (isModule && ["save", "damage"].includes(activity.type) && template?.type && Number(template.size) > 0) {
    const duration = activity.duration ?? {};
    const unitSeconds = { second: 1, minute: 60, hour: 3600, day: 86400, round: 6, turn: 6 }[duration.units];
    const seconds = unitSeconds && Number(duration.value) > 0 ? Number(duration.value) * unitSeconds : null;
    return { id: activity.id, native: true, shape: template.type, size: Number(template.size), width: template.width,
      concentration: Boolean(duration.concentration), templateSeconds: seconds ?? (duration.concentration || duration.units === "perm" ? null : 6),
      origin: activity.range?.units === "self" ? "self" : "point", maxRange: activity.range?.units === "ft" ? Number(activity.range.value) : null };
  }
  return null;
}

function sourceActivities(item) {
  return item.toObject().system.activities;
}

function cloneAreaActivity(activity, spec, { resolved = false, castId = "" } = {}) {
  const original = activity.toObject(), id = activity.id ?? original._id;
  const data = spec.native ? clone(original) : areaActivityData(original, spec);
  data.midiProperties = { ...data.midiProperties, forceDamageDialog: "always" };
  data.flags ??= {}; data.flags[MODULE_ID] ??= {};
  Object.assign(data.flags[MODULE_ID], { areaResolved: resolved, areaCastId: castId });
  if (resolved) {
    // Placement has already completed. Explicit targets and templateUuid retain
    // geometry/cover without asking Midi to place a second template.
    data.target.template = { ...data.target.template, type: "", count: "" };
    data.target.prompt = false; data.target.override = true;
    data.target.affects = { ...data.target.affects, type: "creature", count: "", choice: false };
    data.range = { value: null, units: "any", special: "Область размещённого шаблона", override: true };
  }
  if (spec.rage) {
    const resource = findFeature(activityActor(activity), "witch-hunter");
    if (!resource) throw Error("Не найдены Очки Гнева Ведьминого клинка.");
    data.consumption = { ...data.consumption, spellSlot: false,
      targets: [{ type: "itemUses", target: resource.id, value: String(spec.rage), scaling: { mode: "", formula: "" } }] };
  }
  if (spec.statuses?.length) data.effects = [{ _id: `area${id}`.slice(0, 16), onSave: false }];
  const effects = clone(activity.item.toObject().effects ?? []);
  const effectDuration = spec.duration ? { ...spec.duration, expired: false } : { value: null, units: "seconds", expiry: null, expired: false };
  if (effectDuration.expiry === "sourceEnd" && !globalThis.CONFIG?.ActiveEffect?.expiryEvents?.sourceEnd)
    throw Error("Для окончания состояния в конце следующего хода источника включите DAE.");
  if (effectDuration.expiry === "updateWorldTime" && globalThis.CONFIG?.ActiveEffect?.expiryEvents
    && !CONFIG.ActiveEffect.expiryEvents.updateWorldTime) effectDuration.expiry = "turnStart";
  if (spec.statuses?.length) effects.push({ _id: data.effects[0]._id, name: activity.item.name, img: activity.item.img,
    type: "base", origin: activity.item.uuid, transfer: false, disabled: false, statuses: spec.statuses,
    duration: effectDuration, start: null, system: { changes: [] },
    flags: { [MODULE_ID]: { areaCondition: spec.id, areaCastId: castId }, dae: { expiryMode: "delete", specialDuration: [] } } });
  const item = activity.item.clone({ system: { activities: { ...sourceActivities(activity.item), [id]: data } }, effects,
    "flags.midi-qol.syntheticItem": true }, { keepId: true });
  return item.system.activities.get(id);
}

function canonicalTemplate(document, scene) { return scene.regions?.get?.(document.id) ?? document; }
function templateOrigin(document) {
  if (Number.isFinite(document.x)) return { x: document.x, y: document.y };
  const shape = document.shapes?.[0];
  if (!shape) return null;
  return { x: shape.x + (shape.type === "rectangle" ? shape.width / 2 : 0), y: shape.y + (shape.type === "rectangle" ? shape.height / 2 : 0) };
}

export function areaPlacementAllowed(document, source, spec, scene, originalPoint = null) {
  const point = originalPoint ?? templateOrigin(document);
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return true; // Other native shapes are measured by Midi.
  const doc = source.document ?? source, gridSize = Number(scene.grid?.size ?? 100);
  const center = source.center ?? doc.getCenterPoint?.() ?? {x: Number(doc.x) + Number(doc.width ?? 1) * gridSize / 2, y: Number(doc.y) + Number(doc.height ?? 1) * gridSize / 2};
  if (spec.origin === "self") {
    const x = Number(doc.x ?? source.center.x - gridSize / 2), y = Number(doc.y ?? source.center.y - gridSize / 2);
    return point.x >= x - 1 && point.x <= x + Number(doc.width ?? 1) * gridSize + 1
      && point.y >= y - 1 && point.y <= y + Number(doc.height ?? 1) * gridSize + 1;
  }
  if (Number(spec.maxRange) > 0) {
    const measured = (canvas.scene?.id === scene.id ? canvas.grid?.measurePath?.([center, point])?.distance : null)
      ?? Math.hypot(center.x - point.x, center.y - point.y) / gridSize * scene.grid.distance;
    return measured <= feetToSceneUnits(spec.maxRange, scene);
  }
  return true;
}

async function deletePlaced(documents) {
  for (const document of documents) {
    try { await document.delete(); } catch (error) { console.warn(`${MODULE_ID} | Area preview cleanup failed`, error); }
  }
}

export async function useAreaActivity(activity, { validate = () => true, usage = {}, dialog = {}, message = {} } = {}) {
  const spec = areaDefinitionFor(activity), actor = activityActor(activity), scene = canvas?.scene;
  if (!spec || !actor || !scene || !canvas.ready) return false;
  if (activeUse) { notify("Дождитесь завершения предыдущей площадной способности.", "warn"); return false; }
  if (validate(activity) === false) return false;
  const api = globalThis.MidiQOL;
  if (!game.modules?.get("midi-qol")?.active || !api?.completeActivityUse || !api?.computeTargetsFromTemplates) {
    notify("Для площадного применения со спасбросками нужен включённый Midi-QOL.", "warn"); return false;
  }
  const source = sourceTokenForActor(actor);
  if (!source) { notify("Выберите токен персонажа на сцене.", "warn"); return false; }
  const oldTargets = [...(game.user.targets ?? [])].map(token => token.id);
  const castId = foundry.utils.randomID(); activeUse = castId;
  const placed = [], origins = new Map(); let committed = false;
  try {
    if ((spec.damage ?? []).some(part => part.type === "alignment")) {
      const alignment = String(actor.system?.details?.alignment ?? "").toLowerCase();
      const type = /evil|зл/u.test(alignment) ? "necrotic" : /good|добр/u.test(alignment) ? "radiant"
        : await choiceDialog({ title: activity.item.name, label: "Тип урона по мировоззрению", choices: [["radiant", "Излучение"], ["necrotic", "Некротический"]] });
      if (!type) return false;
      spec.damage = spec.damage.map(part => part.type === "alignment" ? { ...part, type } : part);
    }
    if (spec.chooseDice) {
      const count = await numberDialog({ title: activity.item.name, label: "Раунды жизни духа (максимум 8к6)", min: 1, max: 8, defaultValue: 1 });
      if (count == null) return false;
      spec.damage[0].formula = `${count}d6`;
    }
    // Keep previous concentration intact when either dialog/placement is canceled.
    const previousConcentration = [...(actor.concentration?.effects ?? [])];
    if (spec.concentration && !api.configSettings?.().concentrationAutomation
      && previousConcentration.length >= Number(actor.system?.attributes?.concentration?.limit ?? 1)) {
      const choice = await choiceDialog({ title: activity.item.name, label: "При применении завершить текущую концентрацию?",
        choices: [["replace", "Завершить при применении"], ["cancel", "Отмена"]] });
      if (choice !== "replace") return false;
    }
    const previewActivity = cloneAreaActivity(activity, spec, { castId });
    const factory = game.system?.canvas?.AbilityTemplate;
    if (!factory) throw Error("Не найден штатный инструмент шаблонов D&D5e.");
    const previews = factory.fromActivity(previewActivity, { x: source.center.x, y: source.center.y });
    if (!previews?.length) throw Error("Для способности не задан корректный шаблон области.");
    for (const preview of previews) {
      let result;
      try { result = await preview.drawPreview(); } catch (error) { if (error) throw error; return false; }
      if (!result) return false;
      for (const original of Array.isArray(result) ? result.flat(Infinity) : [result]) {
        const doc = canonicalTemplate(original, scene);
        origins.set(doc.uuid, templateOrigin(original)); placed.push(doc);
      }
    }
    if (canvas.scene?.id !== scene.id) throw Error("Сцена изменилась во время размещения; способность отменена без расхода.");
    if (placed.some(doc => !areaPlacementAllowed(doc, source, spec, scene, origins.get(doc.uuid)))) {
      notify(spec.origin === "self" ? "Начало шаблона должно находиться на токене персонажа." : "Область находится вне дальности способности.", "warn"); return false;
    }
    // Midi 14 resolves Region UUIDs, but treats raw Region documents as
    // MeasuredTemplate placeables and tries to read their nonexistent document.t.
    // Keep documents for ownership/cleanup; pass native UUIDs only for targeting.
    const templateUuids = placed.map(document => document.uuid);
    const targets = api.computeTargetsFromTemplates(templateUuids, source.document?.uuid ?? source, spec.excludeSelf ?? false, spec.targets ?? "any", "always");
    const allies = spec.allyTempHp ? api.computeTargetsFromTemplates(templateUuids, source.document?.uuid ?? source, false, "ally", "always") : [];
    const resolved = cloneAreaActivity(activity, spec, { resolved: true, castId });
    for (const doc of placed) await doc.update({ [`flags.${MODULE_ID}.zoneTemplate`]: true,
      [`flags.${MODULE_ID}.sourceActor`]: actor.uuid, [`flags.${MODULE_ID}.areaCastId`]: castId,
      // Do not expire while players are still answering saving-throw requests.
      [`flags.${MODULE_ID}.zoneExpiresAt`]: null });
    // The intercepted configuration belongs to the canceled utility workflow.
    // Do not carry its workflow, message effects or derived hasConsumption flags forward.
    const options = { event: usage.event, scaling: usage.scaling, create: { measuredTemplate: false },
      consume: { resources: true, spellSlot: resolved.item.type === "spell" },
      midiOptions: { ignoreUserTargets: true, asUser: game.user.id, targetUuids: targets.map(token => token.document.uuid),
        workflowOptions: { ...(usage.midiOptions?.workflowOptions ?? {}), ignoreUserTargets: true, targetConfirmation: "none", checkTargets: false,
          autoRollDamage: "always", forceCompletion: true, templateUuid: placed[0].uuid } } };
    const WorkflowClass = getAreaWorkflowClass();
    options.workflow = new WorkflowClass(actor, resolved, ChatMessage.getSpeaker({ actor }), new Set(targets),
      { event: usage.event, workflowOptions: options.midiOptions.workflowOptions });
    const workflow = await api.completeActivityUse(resolved, options, { configure: dialog.configure ?? true }, { create: true, rollMode: message.rollMode });
    if (workflow === false || workflow?.aborted || options.workflow?.aborted) return false;
    // Undefined with a running workflow is an unknown outcome, not a refund signal.
    committed = true;
    if (!workflow) { notify("Midi-QOL ещё завершает применение. Не повторяйте расход; проверьте карточку в чате.", "warn"); return false; }
    if (spec.allyTempHp && allies.length) {
      const roll = await new Roll(spec.allyTempHp, actor.getRollData()).evaluate();
      await applyTemporaryHp(allies, Math.max(0, Number(roll.total)), { sourceActor: actor });
    }
    let concentration = spec.concentration ? [...(actor.concentration?.effects ?? [])].find(effect => !previousConcentration.some(before => before.id === effect.id)) : null;
    if (spec.concentration && !concentration) {
      const current = [...(actor.concentration?.effects ?? [])];
      if (current.some(effect => !previousConcentration.some(before => before.id === effect.id))) throw Error("Текущая концентрация изменилась; нужна проверка GM.");
      for (const effect of current) await actor.endConcentration(effect);
      concentration = await actor.beginConcentrating(previewActivity, { flags: { [MODULE_ID]: { areaConcentration: castId }, dae: { expiryMode: "delete" } } });
      if (!concentration) throw Error("Не удалось создать концентрацию области.");
    }
    if (concentration && api.addDependent) {
      // These templates were placed before Midi started. Explicitly register
      // them and this cast's conditions, including the concentration fallback.
      const conditions = targets.flatMap(token => [...(token.actor?.effects ?? [])])
        .filter(effect => effect.flags?.[MODULE_ID]?.areaCastId === castId);
      for (const dependent of [...placed, ...new Map(conditions.map(effect => [effect.uuid, effect])).values()])
        if (dependent.flags?.dnd5e?.dependentOn !== concentration.uuid) await api.addDependent(concentration, dependent);
    }
    const lifetime = spec.native ? spec.templateSeconds : Number(spec.concentration ?? 6);
    for (const doc of placed) await doc.update({ [`flags.${MODULE_ID}.zoneTemplate`]: true,
      [`flags.${MODULE_ID}.sourceActor`]: actor.uuid, [`flags.${MODULE_ID}.areaCastId`]: castId,
      [`flags.${MODULE_ID}.zoneExpiresAt`]: lifetime > 0 ? Number(game.time?.worldTime ?? 0) + lifetime : null,
      ...(spec.periodic ? { [`flags.${MODULE_ID}.periodicZone`]: { trigger: spec.periodic, sourceTokenUuid: source.document.uuid,
        sourceItemUuid: activity.item.uuid, event: { save: spec.save, dc: spec.dc, damage: spec.damage, onSave: spec.onSave } } } : {}),
      ...(concentration ? { [`flags.${MODULE_ID}.zoneConcentrationEffect`]: concentration.uuid } : {}) });
    return workflow;
  } catch (error) {
    console.error(`${MODULE_ID} | Area activity failed`, error);
    notify(error.message ?? "Не удалось применить площадную способность.", "warn"); return false;
  } finally {
    if (!committed) await deletePlaced(placed);
    activeUse = null;
    if (canvas.scene?.id === scene.id) {
      try { await game.user.updateTokenTargets?.(oldTargets); } catch (error) { console.warn(`${MODULE_ID} | Target restoration failed`, error); }
    }
  }
}

export function installAreaActivityHooks({ validate = () => true } = {}) {
  Hooks.on("dnd5e.preUseActivity", (activity, usage, dialog, message) => {
    if (!enabled() || !areaDefinitionFor(activity)) return;
    // This cancels the original utility flow BEFORE any native resource consumption.
    void useAreaActivity(activity, { validate, usage, dialog, message });
    return false;
  });
}
