import { MODULE_ID } from "../shared/constants.mjs";
import { enabled } from "../shared/helpers.mjs";
import { godHas, godState } from "./god.mjs";
import { calculatedDamage, commitCalculatedDamage } from "../midi/damage-packet.mjs";
import { onPrepareDamage } from "../shared/damage-events.mjs";
export const godElement = actor => (godHas(actor, "demiurgy") ? godState(actor).element : null);
onPrepareDamage(async ({ actor, data }) => {
  if (!enabled()) return null;
  const context = {};
  if (data.auraEventKey && actor.getFlag(MODULE_ID, "godPulseOrigins")?.[data.auraEventKey]?.judgment)
    context.godJudgmentOwn = true;
  const cast = godState(actor).devour;
  if (
    data.godCastId &&
    cast?.requestId === data.godCastId &&
    !cast.closed &&
    data.activityUuid?.startsWith(`${cast.sourceItemUuid}.Activity.`)
  )
    context.godDevourCastId = cast.requestId;
  return Object.keys(context).length ? { context } : null;
});
export function applyGodElement(token, { workflow, damageItem }) {
  if (
    !enabled() ||
    workflow?.aborted ||
    !token?.actor ||
    (damageItem.damageSelector ?? "combinedDamage") !== "combinedDamage"
  )
    return;
  const element = godElement(workflow?.actor);
  if (!element) return;
  const parts = calculatedDamage(damageItem),
    selector = damageItem.damageSelector ?? "combinedDamage",
    raw = damageItem.damageDetails?.[`raw${selector}`] ?? damageItem.rawDamageDetail;
  if (!raw?.some(p => p.type === element) || !token.actor.calculateDamage) return;
  const fingerprint = () =>
    JSON.stringify([raw.filter(p => p.type === element), calculatedDamage(damageItem).filter(p => p.type === element)]);
  if (damageItem.grimgutzGodElement === fingerprint()) return;
  const options = structuredClone(
    damageItem.damageDetails?.calcDamageOptions?.[selector] ?? damageItem.calcDamageOptions ?? { invertHealing: true }
  );
  if (options.ignore === true) return;
  options.ignore ??= {};
  for (const k of ["immunity", "resistance"])
    if (options.ignore[k] !== true) options.ignore[k] = new Set([...(options.ignore[k] ?? []), element]);
  const fresh = token.actor.calculateDamage(structuredClone(raw.filter(p => p.type === element)), options);
  for (const p of fresh) {
    p.active ??= {};
    p.active[MODULE_ID] = { ...p.active[MODULE_ID], ignoreResistance: true };
  }
  damageItem.calcDamageOptions = options;
  damageItem.damageDetails ??= {};
  damageItem.damageDetails.calcDamageOptions ??= {};
  damageItem.damageDetails.calcDamageOptions[selector] = options;
  commitCalculatedDamage(token, damageItem, [...parts.filter(p => p.type !== element), ...fresh]);
  damageItem.grimgutzGodElement = fingerprint();
}
export function applyGodDefenses(token, { workflow, damageItem }) {
  if (
    !enabled() ||
    workflow?.aborted ||
    !token?.actor ||
    (damageItem.damageSelector ?? "combinedDamage") !== "combinedDamage"
  )
    return;
  const actor = token.actor,
    parts = calculatedDamage(damageItem),
    fingerprint = () => JSON.stringify(calculatedDamage(damageItem));
  if (damageItem.grimgutzGodDefense === fingerprint()) return;
  if (godHas(actor, "curse") && workflow.actor?.uuid && workflow.actor.uuid !== actor.uuid) {
    for (const p of parts)
      if (p.type === "healing")
        p.value = Number(p.value) < 0 ? Math.ceil(Number(p.value) / 2) : Math.floor(Number(p.value) / 2);
  }
  const weapon =
    workflow.item?.type === "weapon" ||
    (workflow.item?.type !== "spell" && workflow.activity?.attack?.type?.classification === "weapon");
  if (godHas(actor, "apotheosis") && workflow.activity?.type === "attack" && weapon) {
    const magical =
      workflow.item.system.properties?.has?.("mgc") ||
      workflow.item.system.properties?.includes?.("mgc") ||
      Number(workflow.item.system.magicalBonus ?? 0) > 0 ||
      workflow.activity?.midiProperties?.magicdam === true;
    if (!magical)
      for (const p of parts)
        if (["bludgeoning", "piercing", "slashing"].includes(p.type) && p.type !== godElement(workflow.actor)) {
          p.value = 0;
          p.active = { ...p.active, immunity: true };
        }
  }
  commitCalculatedDamage(token, damageItem, parts);
  damageItem.grimgutzGodDefense = fingerprint();
}
export function blockGodResurrection(workflow) {
  if (!enabled() || workflow?.aborted || workflow?.item?.type !== "spell") return;
  const id = workflow.item.system.identifier;
  if (!["revivify", "raise-dead", "resurrection", "true-resurrection", "reincarnate"].includes(id)) return;
  for (const t of [...(workflow.targets ?? [])]) if (godHas(t.actor, "curse")) workflow.targets.delete(t);
  if (!workflow.targets.size) {
    workflow.aborted = true;
    ui.notifications?.warn?.(
      "Бессмертное Проклятие: воскрешение невозможно. Внешние расходы/каст вне Midi проверяет GM."
    );
    return false;
  }
}
