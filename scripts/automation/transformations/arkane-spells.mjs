import { MODULE_ID } from "../shared/constants.mjs";
import { enabled } from "../shared/helpers.mjs";
import { arkaneIdentity } from "../shared/arkane-definitions.mjs";
import { arkaneHas, arkaneState, arkaneTransformationLevel, arkaneBodyActive, patchArkane } from "./arkane.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import { arkaneGm, arkaneExpense, chooseArkaneSlots } from "./arkane-use.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { nativeApplicationReply, applyNativeOnce } from "../shared/native-applications.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { useNativeUtility } from "../shared/native-actions.mjs";
import { isEffectActive } from "../effects/temporary-effects.mjs";
export function arkaneBarrierActive(actor) {
  const state = actor?.getFlag?.(MODULE_ID, "arkaneBarrier"),
    effect = [...(actor?.effects ?? [])].find(e => e.uuid === state?.effectUuid);
  return Boolean(
    arkaneHas(actor, "barrier") &&
    state &&
    Number(state.remaining) > 0 &&
    Number(actor.system.attributes.hp.temp) === Number(state.remaining) &&
    effect &&
    isEffectActive(effect)
  );
}
export async function chooseArkaneImmunities(actor, activity, requestId) {
  const state = arkaneState(actor),
    epoch = Number(state.restEpoch ?? 0);
  if (state.immunityChoiceEpoch === epoch) return false;
  const cards = [...(actor.items ?? []), ...(game.items ?? [])].filter(item => item.type === "spell");
  for (const pack of game.packs?.values?.() ?? []) {
    if (
      pack.metadata?.type !== "Item" ||
      !/spell|заклин/u.test(String(pack.metadata?.name ?? pack.collection).toLowerCase())
    )
      continue;
    const index = await pack.getIndex({ fields: ["type", "system.identifier", "system.level"] });
    for (const row of index ?? []) if (row.type === "spell" || Number.isFinite(row.system?.level)) cards.push(row);
  }
  const unique = new Map(
    cards.map(item => [
      arkaneIdentity(item),
      { id: arkaneIdentity(item), name: String(item.name), uuid: item.uuid ?? null }
    ])
  );
  unique.delete("");
  const count = Math.floor(arkaneTransformationLevel(actor) / 2),
    selected = await askOwner(actor, {
      kind: "checkbox",
      title: `Иммунитет к ${count} заклинаниям`,
      choices: [...unique].map(([key, row]) => [key, row.name]),
      min: count,
      max: count
    });
  if (!Array.isArray(selected) || new Set(selected).size !== count || selected.some(key => !unique.has(key)))
    return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "arkane-immunities", activityUuid: activity.uuid },
    async () => true,
    async () => {
      await patchArkane(actor, latest => ({
        ...latest,
        immunities: selected.map(key => unique.get(key)),
        immunityChoiceEpoch: epoch
      }));
      return true;
    }
  );
}
export async function activateArkaneBarrier(actor, activity, requestId) {
  const amount = arkaneTransformationLevel(actor) * 10;
  if (
    Number(actor.system.attributes.hp.temp) > 0 &&
    !(await confirmOwner(
      actor,
      "Новые временные хиты",
      `Заменить текущие ${actor.system.attributes.hp.temp} временных хитов на ${amount} от барьера? Они не складываются.`
    ))
  )
    return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "arkane-barrier", activityUuid: activity.uuid },
    () => useNativeUtility(activity, { dataPatch: arkaneExpense(activity, { cost: 1 }) }),
    async () => {
      const previous = [...(actor.effects ?? [])].filter(effect => effect.getFlag?.(MODULE_ID, "arkaneBarrierEffect")),
        [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [
          {
            name: "Аннулирование: барьер",
            img: activity.item.img,
            type: "base",
            disabled: false,
            transfer: false,
            origin: activity.item.uuid,
            statuses: [],
            start: null,
            duration: { value: null, units: "seconds", expiry: null, expired: false },
            flags: { [MODULE_ID]: { arkaneBarrierEffect: requestId } },
            system: { changes: [] }
          }
        ]);
      if (!effect) throw Error("Состояние барьера не создано.");
      await actor.update({
        "system.attributes.hp.temp": amount,
        [`flags.${MODULE_ID}.arkaneBarrier`]: {
          remaining: amount,
          maximum: amount,
          requestId,
          sourceItemUuid: activity.item.uuid,
          effectUuid: effect.uuid
        }
      });
      for (const old of previous) await old.delete();
      return true;
    }
  );
}
export function carryArkaneBarrierDamage(actor, amount, updates) {
  if (!enabled() || amount <= 0) return;
  const state = actor.getFlag?.(MODULE_ID, "arkaneBarrier"),
    next = updates["system.attributes.hp.temp"] ?? updates.system?.attributes?.hp?.temp;
  if (!state || next === undefined) return;
  if (Number(state.remaining) === Number(actor.system.attributes.hp.temp) && Number(next) <= Number(state.remaining))
    updates[`flags.${MODULE_ID}.arkaneBarrier`] = Number(next) > 0 ? { ...state, remaining: Number(next) } : null;
}
export function guardArkaneBarrierUpdate(actor, changes) {
  if (!enabled() || !actor.getFlag?.(MODULE_ID, "arkaneBarrier")) return;
  const next = changes["system.attributes.hp.temp"] ?? changes.system?.attributes?.hp?.temp;
  if (
    next === undefined ||
    Object.hasOwn(changes, `flags.${MODULE_ID}.arkaneBarrier`) ||
    Object.hasOwn(changes.flags?.[MODULE_ID] ?? {}, "arkaneBarrier")
  )
    return;
  changes[`flags.${MODULE_ID}.arkaneBarrier`] = null;
}
export async function cleanupArkaneBarrier(actor) {
  if (!enabled() || !isGmAuthority()) return;
  const state = actor.getFlag?.(MODULE_ID, "arkaneBarrier");
  if (state && (Number(state.remaining) !== Number(actor.system.attributes.hp.temp) || Number(state.remaining) <= 0))
    await actor.unsetFlag(MODULE_ID, "arkaneBarrier");
  if (!actor.getFlag?.(MODULE_ID, "arkaneBarrier"))
    for (const effect of [...(actor.effects ?? [])])
      if (effect.getFlag?.(MODULE_ID, "arkaneBarrierEffect")) await effect.delete();
}
registerGmRequest("arkane-spell-immunity", async (caster, data) => {
  const activity = await fromUuid(data.activityUuid);
  if (
    !enabled() ||
    !isGmAuthority() ||
    activity?.actor?.uuid !== caster.uuid ||
    activity.item?.type !== "spell" ||
    !data.workflowId ||
    !Number.isInteger(data.castLevel) ||
    data.castLevel < 0 ||
    data.castLevel > 9
  )
    return false;
  const protectedTargets = [];
  for (const uuid of [...new Set(data.targets ?? [])]) {
    const token = await fromUuid(uuid),
      actor = token?.actor;
    if (!actor) continue;
    const named =
        arkaneBodyActive(actor) &&
        (arkaneState(actor).immunities ?? []).some(row => row.id === arkaneIdentity(activity.item)),
      barrier = arkaneBarrierActive(actor) && data.castLevel <= 5;
    if (!named && !barrier) continue;
    protectedTargets.push(uuid);
    if (!barrier) continue;
    await serialMutation(`arkane-barrier:${actor.uuid}`, async () => {
      const requestId = `arkane-swallow:${data.workflowId}:${actor.uuid}`;
      if (nativeApplicationReply(actor, requestId)) return;
      await applyNativeOnce(
        actor,
        { requestId, action: "arkane-swallow", activityUuid: activity.uuid },
        async () => true,
        async () => {
          if (!arkaneBarrierActive(actor)) return { status: "needs-review" };
          const state = actor.getFlag(MODULE_ID, "arkaneBarrier"),
            remaining = Math.min(state.maximum, state.remaining + 5);
          await actor.update({
            "system.attributes.hp.temp": remaining,
            [`flags.${MODULE_ID}.arkaneBarrier`]: { ...state, remaining }
          });
          const allocation = await chooseArkaneSlots(actor, {
            spent: true,
            total: Math.max(1, data.castLevel),
            optional: true,
            title: "Пожранное заклинание: необязательное восстановление ячеек"
          });
          if (allocation?.length) {
            const updates = {};
            for (const p of allocation) {
              const live = actor.system.spells[p.key],
                level = p.key === "pact" ? Number(live?.level) : p.level;
              if (!live || level !== p.level || Number(live.max) - Number(live.value) < p.count)
                return { status: "needs-review" };
              updates[`system.spells.${p.key}.value`] = Number(live.value) + p.count;
            }
            await actor.update(updates);
          }
          return true;
        }
      );
    });
  }
  return { status: "success", protectedTargets };
});
export async function prepareArkaneSpellImmunity(workflow) {
  if (
    !enabled() ||
    workflow?.aborted ||
    workflow?.item?.type !== "spell" ||
    !workflow?.actor ||
    !workflow?.activity ||
    workflow.grimgutzArkaneImmunityPrepared
  )
    return;
  if (![...(workflow.targets ?? [])].some(token => arkaneBodyActive(token.actor) || arkaneBarrierActive(token.actor)))
    return;
  const castLevel = Number(workflow.castData?.castLevel ?? workflow.spellLevel ?? workflow.item.system.level),
    targets = [...workflow.targets].map(token => token.document?.uuid ?? token.uuid);
  const result = await requestGm(
    "arkane-spell-immunity",
    workflow.actor,
    { activityUuid: workflow.activity.uuid, workflowId: workflow.id, castLevel, targets },
    { requestId: `arkane-immunity:${workflow.id}`, timeoutMs: 120000 }
  );
  if (result.status !== "success") return;
  workflow.grimgutzArkaneImmunityPrepared = true;
  const protectedTargets = new Set(result.protectedTargets);
  // Midi 14 targets has a persisted setter. Mutating the returned Set alone is
  // not guaranteed to update the workflow's target UUID list.
  workflow.targets = new Set(
    [...workflow.targets].filter(token => !protectedTargets.has(token.document?.uuid ?? token.uuid))
  );
}
export function prepareArkaneSpellSave(target, workflow, details) {
  if (
    !enabled() ||
    workflow?.item?.type !== "spell" ||
    (details.rollType && details.rollType !== "save") ||
    !arkaneBodyActive(target?.actor)
  )
    return;
  details.advantage = true;
  details.modifierTracker?.advantage?.add?.(`${MODULE_ID}.arkane-body`, "Сверхъестественное тело: заклинание");
}
