import { MODULE_ID } from "./constants.mjs";
import { askOwner, confirmOwner } from "./owner-prompts.mjs";
import { canReact, tokenRef, recordModuleReaction, inFeet } from "./combat-benefits.mjs";
import { isGmAuthority } from "./gm-requests.mjs";

export async function useNativeUtility(activity) {
  if (!isGmAuthority()) throw Error("Активный GM сменился; действие требует проверки.");
  if (!globalThis.MidiQOL?.completeActivityUse) throw Error("Действие требует Midi-QOL.");
  const original = activity.toObject(), data = { ...original, flags: { ...original.flags,
    [MODULE_ID]: { ...(original.flags?.[MODULE_ID] ?? {}), leaderResolved: true, action: "", moduleAction: "" } } };
  if (data.type === "utility") data.roll = { formula: "", prompt: false, visible: false };
  const item = activity.item.clone({ system: { activities: { [activity.id]: data } }, "flags.midi-qol.syntheticItem": true }, { keepId: true });
  return MidiQOL.completeActivityUse(item.system.activities.get(activity.id), { create: { measuredTemplate: false },
    midiOptions: { workflowOptions: { noOnUseMacro: true, ignoreUserTargets: true, targetConfirmation: "none" } } }, { configure: false });
}
export async function reactionAttack(token, target, { name = "Атака реакцией", attackBonus = 0, damageBonus = 0, resource = null, opportunity = false, meleeOnly = false } = {}) {
  const doc = tokenRef(token), targetDoc = tokenRef(target), actor = doc.actor;
  if (!canReact(actor) || !await confirmOwner(actor, name, "Использовать реакцию и совершить атаку оружием?")) return false;
  const attacks = [...(actor.items ?? [])].filter(item => item.type === "weapon").flatMap(item => [...(item.system.activities?.values?.() ?? item.system.activities ?? [])]
    .filter(activity => activity.type === "attack" && (!meleeOnly || (activity.attack.type.value === "melee"
      && inFeet(doc, targetDoc, Number(activity.range?.value ?? item.system.range?.reach ?? 5), doc.parent)))).map(activity => ({ item, activity })));
  const selected = await askOwner(actor, { title: name, label: "Оружие", choices: attacks.map(({ item, activity }) => [activity.uuid, `${item.name}: ${activity.name}`]) });
  const chosen = attacks.find(entry => entry.activity.uuid === selected);
  if (!chosen) return false;
  if (!isGmAuthority()) throw Error("Активный GM сменился до реакционной атаки.");
  const data = chosen.activity.toObject();
  data.activation = { type: "reaction", value: 1, override: true };
  data.attack ??= {}; data.attack.bonus = [data.attack.bonus, attackBonus].filter(Boolean).join(" + ");
  if (damageBonus) { data.damage.parts[0].bonus = [data.damage.parts[0].bonus, damageBonus].filter(Boolean).join(" + "); }
  if (resource) data.consumption = { ...data.consumption,
    targets: [...(data.consumption?.targets ?? []), { type: "itemUses", target: resource.id, value: "1" }], spellSlot: false };
  data.flags = { ...data.flags, [MODULE_ID]: { leaderResolved: true, action: "", moduleAction: "" } };
  const item = chosen.item.clone({ system: { activities: { [data._id]: data } }, "flags.midi-qol.syntheticItem": true }, { keepId: true });
  const result = await MidiQOL.completeActivityUse(item.system.activities.get(data._id), { midiOptions: { targetUuids: [targetDoc.uuid],
    workflowOptions: { ignoreUserTargets: true, targetConfirmation: "none", isOpportunityAttack: opportunity } } }, { configure: false });
  if (result !== false && !result?.aborted) await recordModuleReaction(actor, doc.parent);
  return result;
}
