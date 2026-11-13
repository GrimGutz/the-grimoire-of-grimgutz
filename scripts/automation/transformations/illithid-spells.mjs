import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, findFeature, itemUses } from "../shared/helpers.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { applyNativeOnce, nativeApplicationReply } from "../shared/native-applications.mjs";
import { canReact, recordModuleReaction, inFeet } from "../shared/combat-benefits.mjs";
import { ilHas, ilState, ilPatch, ilDC } from "./illithid.mjs";
import { ilGm, ilExpense, useIlCost } from "./illithid-use.mjs";
const nonDamage = new Set(["healing", "temphp", "maximum", "midi-none"]);
export const ilSpellParts = activity => [
  ...(activity?.damage?.parts ?? []),
  ...(activity?.damage?.includeBase && activity.item.system.damage?.base ? [activity.item.system.damage.base] : [])
];
registerGmRequest("illithid-spell-choice", async (actor, data, { requestId }) => {
  const a = await fromUuid(data.activityUuid);
  if (
    !enabled() ||
    !isGmAuthority() ||
    a?.actor?.uuid !== actor.uuid ||
    a.item.type !== "spell" ||
    !ilHas(actor, "spellcasting") ||
    !data.workflowId
  )
    return false;
  const old = nativeApplicationReply(actor, requestId);
  if (!old)
    await applyNativeOnce(
      actor,
      { requestId, action: "illithid-spell-choice", activityUuid: a.uuid },
      async () => {
        const psychic = ilSpellParts(a).some(p => p.types?.has?.("psychic") || p.types?.includes?.("psychic")),
          choice = await askOwner(actor, {
            title: "Псионическое Колдовство: только это применение",
            choices: [
              ["none", "Обычный урон"],
              ["convert", "Заменить урон психическим"],
              ["both", "Психический урон и модификатор INT"],
              ...(psychic ? [["bonus", "Сохранить типы, добавить INT психическому урону"]] : [])
            ]
          });
        if (!["none", "convert", "both", ...(psychic ? ["bonus"] : [])].includes(choice)) return false;
        await ilPatch(actor, {
          spellChoices: Object.fromEntries(
            [
              ...Object.entries(ilState(actor).spellChoices ?? {}),
              [
                data.workflowId,
                { convert: ["convert", "both"].includes(choice), bonus: ["both", "bonus"].includes(choice) }
              ]
            ].slice(-64)
          )
        });
        return true;
      },
      async () => true
    );
  return { ...nativeApplicationReply(actor, requestId), choice: ilState(actor).spellChoices?.[data.workflowId] };
});
export function illithidSpellConditions(activity) {
  const refs = new Set([...(activity?.effects ?? [])].map(e => e._id ?? e.id)),
    states = [...(activity?.item?.effects ?? [])]
      .filter(e => refs.has(e.id ?? e._id))
      .flatMap(e => [...(e.statuses ?? [])]);
  if (activity?.item?.system?.identifier === "dominate-monster") states.push("charmed");
  return [...new Set(states.filter(s => ["charmed", "frightened"].includes(s)))];
}
export async function prepareIllithidSpell(workflow) {
  if (!enabled() || workflow?.aborted || workflow.item?.type !== "spell" || !workflow.actor || !workflow.activity)
    return;
  if (ilHas(workflow.actor, "supreme")) {
    const watch = ilState(workflow.actor).supremeWatch;
    workflow.grimgutzIllithidSupreme =
      watch?.activityUuid === workflow.activity.uuid ? watch.conditions : illithidSpellConditions(workflow.activity);
  }
  if (
    workflow.grimgutzIllithidSpellPrepared ||
    !ilHas(workflow.actor, "spellcasting") ||
    !ilSpellParts(workflow.activity).some(p => [...(p.types ?? [])].some(t => !nonDamage.has(t)))
  )
    return;
  workflow.grimgutzIllithidSpellPrepared = true;
  const r = await requestGm(
    "illithid-spell-choice",
    workflow.actor,
    { activityUuid: workflow.activity.uuid, workflowId: workflow.id },
    { requestId: `illithid-spell:${workflow.id}`, timeoutMs: 180000 }
  );
  workflow.grimgutzIllithidSpell = r.status === "success" ? r.choice : null;
}
export function prepareIllithidSave(target, workflow, details) {
  if (
    !enabled() ||
    workflow?.aborted ||
    workflow.item?.type !== "spell" ||
    !ilHas(workflow.actor, "supreme") ||
    (details.rollType && details.rollType !== "save")
  )
    return;
  const conditions = workflow.grimgutzIllithidSupreme ?? [],
    immune = target?.actor?.system?.traits?.ci?.value;
  if (!conditions.length || conditions.some(s => immune?.has?.(s) || immune?.includes?.(s))) return;
  details.disadvantage = true;
  details.modifierTracker?.disadvantage?.add?.(`${MODULE_ID}.illithid-supreme`, "Высшая Псионика: конкретный эффект");
}
registerGmRequest("illithid-counter", async (caster, data, { requestId }) => {
  const activity = await fromUuid(data.activityUuid),
    source = await fromUuid(data.sourceUuid),
    defender = await fromUuid(data.defenderUuid),
    actor = defender?.actor;
  if (
    !enabled() ||
    !isGmAuthority() ||
    activity?.actor?.uuid !== caster.uuid ||
    activity.item.type !== "spell" ||
    source?.actor?.uuid !== caster.uuid ||
    !actor ||
    source.parent?.id !== defender.parent?.id ||
    !data.targets?.includes(defender.uuid) ||
    !Number.isInteger(data.level) ||
    !ilHas(actor, "superiority") ||
    !inFeet(source, defender, 30, source.parent) ||
    data.level < 0 ||
    data.level > Number(actor.system.attributes.prof)
  )
    return false;
  const old = nativeApplicationReply(actor, requestId);
  if (old) return old;
  if (
    actor.statuses?.has?.("dead") ||
    !canReact(actor) ||
    itemUses(findFeature(actor, "illithid-superiority")).remaining < 1
  )
    return false;
  const a = [...findFeature(actor, "illithid-superiority").system.activities.values()][0];
  return applyNativeOnce(
    actor,
    { requestId, action: "illithid-counter", activityUuid: activity.uuid },
    async () => {
      if (
        !(await confirmOwner(
          actor,
          "Псионическое Превосходство",
          `Использовать реакцию и одно применение, чтобы аннулировать нацеленное на вас заклинание уровня ${data.level}?`
        )) ||
        !(await confirmOwner(
          ilGm(actor),
          "GM: аннулирование заклинания",
          "Заклинатель действительно враг, и это подходящее применение? Подтвердить отмену конкретного Midi-потока; ячейка заклинателя не возвращается автоматически."
        ))
      )
        return false;
      return useIlCost(a, { cost: 1, activation: "reaction" });
    },
    async () => {
      await recordModuleReaction(actor, source.parent);
      return true;
    }
  );
});
export async function prepareIllithidCounter(workflow) {
  if (!enabled() || workflow?.aborted || workflow.item?.type !== "spell" || !workflow.actor) return;
  const targets = [...(workflow.targets ?? [])].map(t => t.document ?? t);
  for (const t of targets) {
    if (!ilHas(t.actor, "superiority") || t.actor.uuid === workflow.actor.uuid) continue;
    const sourceUuid = workflow.tokenUuid ?? workflow.token?.document?.uuid ?? workflow.token?.uuid,
      source = sourceUuid && (await fromUuid(sourceUuid));
    if (
      !source ||
      source.parent?.id !== t.parent?.id ||
      !inFeet(source, t, 30, source.parent) ||
      (source.disposition === t.disposition && source.disposition !== 0)
    )
      continue;
    const r = await requestGm(
      "illithid-counter",
      workflow.actor,
      {
        activityUuid: workflow.activity.uuid,
        workflowId: workflow.id,
        sourceUuid,
        defenderUuid: t.uuid,
        targets: targets.map(d => d.uuid),
        level: Number(workflow.castData?.castLevel ?? workflow.spellLevel ?? workflow.item.system.level)
      },
      { requestId: `illithid-counter:${workflow.id}:${t.actor.uuid}`, timeoutMs: 180000 }
    );
    if (r.status === "success") {
      workflow.aborted = true;
      await workflow.performState?.(workflow.WorkflowState_Abort);
      return false;
    }
  }
}
export async function castIllithidProbe(actor, activity, requestId, { dominate = false } = {}) {
  const id = dominate ? "dominate-monster" : "detect-thoughts",
    spell = [...(actor.items ?? [])].find(i => i.type === "spell" && i.system.identifier === id);
  if (!spell) throw Error(`Добавьте настоящую установленную карточку ${id}.`);
  const acts = [...spell.system.activities.values()],
    selected =
      acts.length === 1
        ? acts[0].id
        : await askOwner(actor, { title: "Нативная активность заклинания", choices: acts.map(a => [a.id, a.name]) }),
    cast = acts.find(a => a.id === selected);
  if (!cast) return false;
  if (
    dominate &&
    (ilState(actor).probePending || Number(ilState(actor).probeReadyAt ?? 0) > Number(game.time.worldTime))
  )
    throw Error("Дневное Доминирование уже использовано или требует проверки предыдущего применения.");
  if (
    !(await confirmOwner(
      ilGm(actor),
      dominate ? "Зондирование: Доминирование" : "Постоянное Обнаружение мыслей",
      dominate
        ? "Использовать настоящую карточку без концентрации и ячейки, со Сл трансформации? Вне боя/нестандартные эффекты контролирует GM."
        : "Постоянное право читать мысли уже действует. Эта карточка используется для конкретного углубления/спасброска; поверхностные мысли не требуют нового сотворения. GM проверил видимость и ограничения заклинания?"
    ))
  )
    return false;
  const data = cast.toObject();
  data.consumption = ilExpense(activity).consumption;
  data.duration = { ...data.duration, concentration: false };
  if (data.save) data.save.dc = { calculation: "", formula: String(ilDC(actor)) };
  data.flags = { [MODULE_ID]: { illithidResolved: true, action: "", illithidProbe: true } };
  const a = spell
    .clone({ system: { activities: { [cast.id]: data } } }, { keepId: true })
    .system.activities.get(cast.id);
  return applyNativeOnce(
    actor,
    { requestId, action: `illithid-probe:${id}`, activityUuid: activity.uuid },
    async () => {
      if (dominate) await ilPatch(actor, { probePending: requestId });
      const r = await MidiQOL.completeActivityUse(
        a,
        { consume: { spellSlot: false }, midiOptions: { workflowOptions: { illithidResolved: true } } },
        { configure: false }
      );
      if (dominate && (r === false || r?.aborted)) await ilPatch(actor, { probePending: null });
      return r;
    },
    async () => {
      if (dominate) await ilPatch(actor, { probePending: null, probeReadyAt: Number(game.time.worldTime) + 86400 });
      return true;
    }
  );
}
