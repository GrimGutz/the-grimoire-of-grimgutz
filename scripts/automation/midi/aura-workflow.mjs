import { MODULE_ID } from "../shared/constants.mjs";
import { areaDamagePart } from "../shared/area-definitions.mjs";
import { notify } from "../shared/helpers.mjs";
import { getAreaWorkflowClass } from "./area-workflow.mjs";

/** Resolve a timed aura pulse through Midi, using its already attached Region.
 * No placement, concentration replacement, action cost, slot or item-use cost. */
export async function useAuraPulse({ sourceToken, sourceItem, template, targets, event, eventKey, scene }) {
  const api = globalThis.MidiQOL, actor = sourceToken?.actor;
  if (!actor || !sourceItem || !targets.length) return false;
  if (canvas?.scene?.id !== scene.id || !canvas.ready) {
    notify("Для бросков ауры активный GM должен открыть её сцену. Баффы и привязка продолжают работать; пропущенный урон проверьте вручную.", "warn");
    return false;
  }
  if (!game.modules?.get("midi-qol")?.active || !api?.completeActivityUse) {
    notify("Автоматический урон/спасброски аур требуют Midi-QOL.", "warn"); return false;
  }
  const original = sourceItem.toObject(), activities = original.system.activities ?? {};
  const id = Object.keys(activities)[0] ?? "grimgutzaurapuls";
  const activity = { ...(activities[id] ?? {}), _id: id, name: sourceItem.name, type: event.save ? "save" : "damage",
    activation: { type: "special", value: 0, override: true, condition: "Автоматическое срабатывание ауры" },
    consumption: { targets: [], spellSlot: false, scaling: { allowed: false, max: "" } },
    uses: { max: "", spent: 0, recovery: [] },
    range: { units: "any", value: null, override: true },
    target: { template: { type: "", count: "" }, affects: { type: "creature", count: "", choice: false }, prompt: false, override: true },
    duration: { value: "", units: "inst", concentration: false, override: true },
    damage: { onSave: event.onSave ?? "none", parts: (event.damage ?? []).map(areaDamagePart) }, effects: [],
    midiProperties: { autoTargetAction: "always", confirmTargets: "never", forceDamageDialog: "never", autoCEEffects: "itempri" },
    // Item.clone merges nested flags. Explicitly blank the activation action so
    // its "no uses remaining" validator cannot reject later aura pulses.
    flags: { [MODULE_ID]: { action: "", moduleAction: "", areaResolved: true, auraPulse: true, auraEventKey: eventKey } } };
  delete activity.roll; delete activity.attack; delete activity.healing; delete activity.save;
  if (event.save) activity.save = { ability: [event.save], dc: { calculation: "", formula: event.dc } };
  const effects = [];
  if (event.condition) {
    const condition = event.condition, effectId = `aura${id}`.slice(0, 16);
    activity.effects = [{ _id: effectId, onSave: false }];
    effects.push({ _id: effectId, type: "base", name: condition.name, img: sourceItem.img, origin: sourceItem.uuid,
      transfer: false, disabled: false, showIcon: condition.persistent ? 0 : 1, statuses: condition.statuses ?? [], start: null,
      duration: condition.duration ?? { value: null, units: "seconds", expiry: null, expired: false },
      flags: { [MODULE_ID]: { auraPersistentCondition: condition.key, auraConditionSource: actor.uuid, auraEventKey: eventKey }, dae: { expiryMode: "delete" } },
      system: { changes: condition.changes ?? [] } });
  }
  const item = sourceItem.clone({ system: { activities: { [id]: activity } }, effects, "flags.midi-qol.syntheticItem": true }, { keepId: true });
  const resolved = item.system.activities.get(id), oldTargets = [...(game.user.targets ?? [])].map(token => token.id);
  const workflowOptions = { ignoreUserTargets: true, targetConfirmation: "none", checkTargets: false, autoRollDamage: "always",
    fastForwardDamage: true, forceCompletion: true, noOnUseMacro: true, grimgutzAuraPulse: true,
    ...(template?.uuid ? { templateUuid: template.uuid } : {}) };
  const Workflow = getAreaWorkflowClass();
  const workflow = new Workflow(actor, resolved, ChatMessage.getSpeaker({ actor, token: sourceToken.document }), new Set(targets), { workflowOptions });
  try {
    const result = await api.completeActivityUse(resolved,
      { workflow, create: { measuredTemplate: false }, consume: { resources: false, spellSlot: false, action: false },
        midiOptions: { asUser: game.user.id, ignoreUserTargets: true, targetUuids: targets.map(token => token.document.uuid), workflowOptions } },
      { configure: false }, { create: true, ...(sourceToken.document.hidden ? { rollMode: "gmroll" } : {}) });
    if (result === undefined) notify("Результат срабатывания ауры ещё не подтверждён Midi-QOL. Проверьте карточку; повторный бросок автоматически не делается.", "warn");
    return result;
  } finally {
    if (canvas?.scene?.id === scene.id) await game.user.updateTokenTargets?.(oldTargets);
  }
}
