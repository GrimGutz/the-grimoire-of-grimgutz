import { MODULE_ID } from "../shared/constants.mjs";
import { enabled } from "../shared/helpers.mjs";
import { factoryAugment, factoryContext, factoryState, patchFactory } from "./factory.mjs";
import { factoryGm, factoryExpense } from "./factory-use.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import { applyNativeOnce, nativeApplicationReply } from "../shared/native-applications.mjs";
import { useNativeUtility } from "../shared/native-actions.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { flagKey } from "../shared/flag-write.mjs";
export async function castFactorySpell(actor, activity, source, record, requestId, operation) {
  const id =
    operation === "lightning-bolt"
      ? "lightning-bolt"
      : operation === "dominate-construct"
        ? "dominate-monster"
        : { catapult: "catapult", mindlord: "dominate-person", chameleon: "invisibility", sandevistan: "haste" }[
            record?.augmentId
          ];
  const spells = [...(actor.items ?? [])].filter(i => i.type === "spell" && i.system.identifier === id);
  if (!spells.length)
    throw Error(
      `Добавьте собственную нативную карточку заклинания ${id}; эффекты и текст чужого заклинания модуль не придумывает.`
    );
  const spell = spells[0],
    cast = [...(spell.system.activities?.values?.() ?? [])][0];
  if (!cast) throw Error("У заклинания нет активности.");
  if (
    record?.augmentId === "catapult" &&
    !(await confirmOwner(
      factoryGm(actor),
      "Катапульта: объект из руки",
      "Предмет выходит из руки и не больше руки? Модуль не перемещает предмет без контроля владельца."
    ))
  )
    return false;
  if (
    id === "haste" &&
    !(await confirmOwner(
      factoryGm(actor),
      "Сандевестан: особое Ускорение",
      "GM подтверждает отсутствие концентрации и вялости после окончания; полное дополнительное действие контролирует владелец. Нативная карточка не должна добавлять отдельную вялость через посторонний макрос."
    ))
  )
    return false;
  const ctx = record
      ? factoryContext(actor, record)
      : {
          dc:
            8 +
            Number(actor.system.attributes.prof) +
            Number(actor.system.abilities.int.mod) +
            (factoryState(actor).ascensionTier ?? 4)
        },
    data = cast.toObject(),
    cost = ["mindlord", "sandevistan"].includes(record?.augmentId) ? 1 : 0;
  factoryExpense(activity, { cost });
  data.activation = { type: record?.augmentId === "catapult" ? "bonus" : "action", value: 1, override: true };
  data.consumption = {
    spellSlot: false,
    targets: cost ? [{ type: "itemUses", target: activity.item.id, value: "1" }] : []
  };
  if (data.save) data.save.dc = { calculation: "", formula: String(ctx.dc) };
  if (id === "haste") data.duration = { ...data.duration, concentration: false };
  data.flags = {
    [MODULE_ID]: {
      factoryResolved: true,
      action: "",
      factoryDominateConstruct: operation === "dominate-construct",
      factoryMindlordInitial: record?.augmentId === "mindlord" && Boolean(factoryAugment(actor, "focus"))
    }
  };
  const clone = spell.clone({ system: { activities: { [cast.id]: data } } }, { keepId: true });
  return applyNativeOnce(
    actor,
    { requestId, action: `factory-spell:${id}`, activityUuid: activity.uuid },
    () =>
      MidiQOL.completeActivityUse(
        clone.system.activities.get(cast.id),
        { midiOptions: { workflowOptions: { factoryResolved: true } } },
        { configure: true }
      ),
    async () => true
  );
}
registerGmRequest("factory-drive", async (actor, data, { requestId }) => {
  if (!enabled() || !isGmAuthority() || !factoryAugment(actor, "drive")) return false;
  const activity = await fromUuid(data.activityUuid);
  if (activity?.actor?.uuid !== actor.uuid || activity.item?.type !== "spell" || !data.workflowId) return false;
  const old = nativeApplicationReply(actor, requestId);
  if (old) return { ...old, drive: factoryState(actor).driveClaims?.[flagKey(data.workflowId)] };
  const slots = Object.entries(actor.system.spells ?? {})
    .map(([key, s]) => ({
      key,
      level: key === "pact" ? Number(s.level) : Number(key.replace("spell", "")),
      value: Number(s.value ?? 0)
    }))
    .filter(s => s.level > 0 && s.value > 0);
  return applyNativeOnce(
    actor,
    { requestId, action: "factory-drive", activityUuid: activity.uuid },
    async () => {
      const chosen = await askOwner(actor, {
          title: "Интеллект-привод: дополнительная ячейка только этому заклинанию",
          choices: [
            ["no", "Без усиления"],
            ...slots.map(s => [s.key, `${s.key}: уровень ${s.level}, осталось ${s.value}`])
          ]
        }),
        slot = slots.find(s => s.key === chosen);
      if (!slot) return false;
      if (Number(actor.system.spells[slot.key]?.value) < 1) return false;
      const record = factoryAugment(actor, "drive"),
        item = [...(actor.items ?? [])].find(i => i.getFlag?.(MODULE_ID, "factoryInstalled")?.recordId === record.id),
        use = [...item.system.activities.values()][0];
      const native = await useNativeUtility(use, {
        dataPatch: {
          ...factoryExpense(use, { activation: "special" }),
          consumption: {
            spellSlot: false,
            targets: [{ type: "attribute", target: `spells.${slot.key}.value`, value: "1" }]
          }
        }
      });
      if (native === false || native?.aborted) return false;
      if (!native) return { status: "needs-review" };
      const claim = {
        slot: slot.key,
        level: slot.level,
        before: slot.value,
        after: Number(actor.system.spells[slot.key].value)
      };
      if (claim.after !== claim.before - 1) return { status: "needs-review" };
      await patchFactory(actor, {
        driveClaims: { ...factoryState(actor).driveClaims, [flagKey(data.workflowId)]: claim }
      });
      return true;
    },
    async () => true
  ).then(reply => ({ ...reply, drive: factoryState(actor).driveClaims?.[flagKey(data.workflowId)] }));
});
export async function prepareFactoryDrive(workflow) {
  if (
    !enabled() ||
    workflow?.aborted ||
    workflow.item?.type !== "spell" ||
    !factoryAugment(workflow.actor, "drive") ||
    workflow.grimgutzFactoryDrivePrepared
  )
    return;
  const parts = workflow.activity?.damage?.parts ?? [];
  if (!parts.length && !workflow.activity?.damage?.includeBase) return;
  workflow.grimgutzFactoryDrivePrepared = true;
  await requestGm(
    "factory-drive",
    workflow.actor,
    { activityUuid: workflow.activity.uuid, workflowId: workflow.id },
    { requestId: `factory-drive:${workflow.id}`, timeoutMs: 180000 }
  );
}
registerGmRequest("factory-drive-cancel", async (actor, data) => {
  if (!enabled() || !isGmAuthority()) return false;
  const c = factoryState(actor).driveClaims?.[flagKey(data.workflowId)];
  if (!c || c.refunded || c.value != null) return false;
  // A changed slot or a damage roll already prepared is an ambiguous outcome,
  // not permission to refund somebody else's later expenditure.
  if (c.after !== c.before - 1 || Number(actor.system.spells?.[c.slot]?.value) !== c.after)
    return { status: "needs-review" };
  await actor.update({ [`system.spells.${c.slot}.value`]: c.before });
  await patchFactory(actor, {
    driveClaims: { ...factoryState(actor).driveClaims, [flagKey(data.workflowId)]: { ...c, refunded: true } }
  });
  return true;
});
export function finishFactoryDrive(workflow) {
  if (!enabled() || !workflow?.aborted || !workflow.actor) return;
  return requestGm(
    "factory-drive-cancel",
    workflow.actor,
    { workflowId: workflow.id },
    { requestId: `factory-drive-cancel:${workflow.id}` }
  );
}
export function filterFactorySpellTargets(workflow) {
  if (!enabled() || !workflow?.activity) return;
  const flags = workflow.activity.flags?.[MODULE_ID];
  if (flags?.factoryDominateConstruct) {
    for (const t of [...(workflow.targets ?? [])])
      if (t.actor?.system.details?.type?.value !== "construct") workflow.targets.delete(t);
  }
}
export function prepareFactorySpellSave(target, workflow, details) {
  if (enabled() && workflow?.activity?.flags?.[MODULE_ID]?.factoryMindlordInitial) {
    details.disadvantage = true;
    details.modifierTracker?.disadvantage?.add?.(
      `${MODULE_ID}.factory-mindlord`,
      "Повелитель разума: первоначальный спасбросок"
    );
  }
}
