import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, automationData, automationAction, findFeature, itemUses } from "../shared/helpers.mjs";
import { godHas, godState, patchGod, godPool } from "./god.mjs";
import { godGm, godExpense, useGodCost, godTargets } from "./god-use.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import { applyNativeOnce, nativeApplicationReply } from "../shared/native-applications.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { canReact, recordModuleReaction } from "../shared/combat-benefits.mjs";
import { automationActors } from "../effects/temporary-effects.mjs";
export function godPreparedSpell(item) {
  return (
    item.type === "spell" &&
    (Number(item.system.level) === 0 || Number(item.system.prepared) > 0 || item.system.preparation?.prepared === true)
  );
}
export async function castGodSpell(actor, activity, requestId, { wish = false } = {}) {
  const spells = [...(actor.items ?? [])].filter(i =>
    wish ? i.type === "spell" && i.system.identifier === "wish" : godPreparedSpell(i)
  );
  if (!spells.length)
    throw Error(
      wish
        ? "Добавьте собственную нативную карточку Желания."
        : "Нет известных подготовленных заклинаний (поле prepared D&D5e)."
    );
  if (wish && Number(godState(actor).wishReadyAt ?? 0) > Number(game.time.worldTime))
    throw Error("После Желания ещё не прошла неделя.");
  const uuid = wish
      ? spells[0].uuid
      : await askOwner(actor, { title: "Подготовленное заклинание за ОР", choices: spells.map(i => [i.uuid, i.name]) }),
    spell = spells.find(i => i.uuid === uuid);
  if (!spell) return false;
  const activities = [...spell.system.activities.values()],
    id =
      activities.length === 1
        ? activities[0].id
        : await askOwner(actor, { title: "Активность заклинания", choices: activities.map(a => [a.id, a.name]) }),
    cast = activities.find(a => a.id === id);
  if (!cast) return false;
  const base = Number(spell.system.level);
  let level = base;
  if (!wish && base > 0) {
    const max = Math.min(9, Math.floor(itemUses(godPool(actor)).remaining / 20));
    if (max < base) throw Error("Недостаточно ОР.");
    level = await askOwner(actor, {
      kind: "number",
      title: "Уровень сотворения, 20 ОР за уровень",
      min: base,
      max,
      defaultValue: base
    });
    if (!Number.isInteger(level) || level < base || level > max) return false;
  }
  const cost = wish ? 80 : 20 * level,
    expense = godExpense(activity, { points: cost, activation: wish ? "action" : (cast.activation?.type ?? "action") }),
    data = cast.toObject();
  data.consumption = expense.consumption;
  if (wish) data.activation = expense.activation;
  data.flags = { [MODULE_ID]: { godResolved: true, action: "" } };
  const clone = spell.clone({ system: { activities: { [cast.id]: data } } }, { keepId: true });
  return applyNativeOnce(
    actor,
    { requestId, action: wish ? "god-wish" : "god-cast", activityUuid: activity.uuid },
    async () => {
      const result = await MidiQOL.completeActivityUse(
        clone.system.activities.get(cast.id),
        {
          scaling: Math.max(0, level - base),
          spell: { slot: `spell${level}` },
          midiOptions: { workflowOptions: { godResolved: true } }
        },
        { configure: false }
      );
      // Unknown native outcomes are not permission to cast Wish twice.
      if (wish && result !== false && !result?.aborted)
        await patchGod(actor, { wishReadyAt: Number(game.time.worldTime) + 604800, wishRequest: requestId });
      return result;
    },
    async () => true
  );
}
export async function godLimitedUse(actor, activity, requestId) {
  const choices = [...(actor.items ?? [])]
    .filter(i => !automationData(i).godFeature && i.type !== "spell")
    .flatMap(i =>
      [...(i.system.activities?.values?.() ?? [])]
        .filter(a => !automationAction(a))
        .map(a => ({ a, recovery: a.uses?.max ? a.uses.recovery : i.system.uses?.recovery }))
    )
    .filter(r => r.recovery?.length && r.recovery.every(p => ["sr", "lr"].includes(p.period)));
  const uuid = await askOwner(actor, {
      title: "Ограниченная способность вместо SR/LR-заряда",
      choices: choices.map(({ a, recovery }) => [
        a.uuid,
        `${a.item.name}: ${a.name} — ${recovery.some(p => p.period === "sr") ? 30 : 60} ОР`
      ])
    }),
    chosen = choices.find(r => r.a.uuid === uuid);
  if (!chosen) return false;
  if (
    !(await confirmOwner(
      godGm(actor),
      "Демиургия: замена одного применения",
      "Это способность с SR/LR-применениями? Заменяется только её обычный заряд; другие цены, концентрация и условия сохраняются. Чужие/нестандартные расходы GM проверил."
    ))
  )
    return false;
  const { a, recovery } = chosen,
    expense = godExpense(activity, {
      points: recovery.some(p => p.period === "sr") ? 30 : 60,
      activation: a.activation?.type ?? "action"
    }),
    data = a.toObject(),
    other = (data.consumption?.targets ?? []).filter(
      t => !(t.type === "itemUses" && (!t.target || t.target === a.item.id)) && t.type !== "activityUses"
    );
  data.consumption = { ...data.consumption, spellSlot: false, targets: [...other, ...expense.consumption.targets] };
  data.uses = { ...data.uses, max: "", spent: 0, recovery: [] };
  data.flags = {
    ...data.flags,
    [MODULE_ID]: { ...data.flags?.[MODULE_ID], godResolved: true, action: "", moduleAction: "" }
  };
  const clone = a.item.clone(
    { system: { activities: { [a.id]: data }, uses: { max: "", spent: 0, recovery: [] } } },
    { keepId: true }
  );
  return applyNativeOnce(
    actor,
    { requestId, action: "god-limited-use", activityUuid: activity.uuid },
    () =>
      MidiQOL.completeActivityUse(
        clone.system.activities.get(a.id),
        { midiOptions: { workflowOptions: { godResolved: true } } },
        { configure: true }
      ),
    async () => true
  );
}
registerGmRequest("god-mantle", async (actor, data, { requestId }) => {
  if (!enabled() || !isGmAuthority() || !godHas(actor, "mantle") || itemUses(godPool(actor)).remaining < 60)
    return false;
  const old = nativeApplicationReply(actor, requestId);
  if (old) return old;
  const activity = [...findFeature(actor, "god-mantle").system.activities.values()][0];
  return applyNativeOnce(
    actor,
    { requestId, action: "god-mantle", activityUuid: data.activityUuid },
    async () => {
      if (
        !(await confirmOwner(
          actor,
          "Прометеева Мантия",
          "Этот спасбросок провален. Потратить 60 ОР, чтобы заменить провал успехом?"
        ))
      )
        return false;
      return useGodCost(activity, { points: 60, activation: "special" });
    },
    async () => true
  );
});
export async function finishGodSaves(workflow) {
  if (!enabled() || workflow?.aborted || !workflow.actor) return;
  for (const t of [...(workflow.failedSaves ?? [])])
    if (godHas(t.actor, "mantle")) {
      const uuid = t.document?.uuid ?? t.uuid,
        result = await requestGm(
          "god-mantle",
          t.actor,
          { activityUuid: workflow.activity.uuid, workflowId: workflow.id },
          { requestId: `god-mantle:${workflow.id}:${uuid}`, timeoutMs: 180000 }
        );
      if (result.status === "success") {
        workflow.failedSaves.delete(t);
        workflow.saves ??= new Set();
        workflow.saves.add(t);
      }
    }
}
export async function armGodCounter(actor, source) {
  const chosen = await godTargets(godGm(actor), source, 1000000, "GM: наблюдаемый видимый заклинатель", {
      self: false
    }),
    target = chosen?.[0];
  if (!target) return false;
  if (
    !(await confirmOwner(
      godGm(actor),
      "Подготовить предложение Отпора",
      "Божество видит этого заклинателя? При следующем его заклинании будет предложена реакция, без расхода сейчас."
    ))
  )
    return false;
  await patchGod(actor, {
    counterWatch: { targetActorUuid: target.actor.uuid, sourceTokenUuid: source.uuid, targetTokenUuid: target.uuid }
  });
  return true;
}
registerGmRequest("god-counter", async (actor, data, { requestId }) => {
  if (!enabled() || !isGmAuthority() || !godHas(actor, "zeal")) return false;
  const watch = godState(actor).counterWatch,
    cast = await fromUuid(data.activityUuid);
  if (
    !watch ||
    cast?.actor?.uuid !== watch.targetActorUuid ||
    cast.item?.type !== "spell" ||
    !Number.isInteger(data.level) ||
    data.level < 1 ||
    data.level > 9 ||
    data.level < Number(cast.item.system.level) ||
    !canReact(actor)
  )
    return false;
  const old = nativeApplicationReply(actor, requestId);
  if (old) return old;
  if (itemUses(godPool(actor)).remaining < 10 * data.level) return false;
  const source = await fromUuid(watch.sourceTokenUuid),
    target = await fromUuid(watch.targetTokenUuid);
  if (
    source?.actor?.uuid !== actor.uuid ||
    target?.actor?.uuid !== watch.targetActorUuid ||
    source.parent.id !== target.parent.id ||
    canvas.scene?.id !== source.parent.id
  )
    return false;
  const activity = [...godPool(actor).system.activities.values()].find(
    a => automationData(a).godOperation === "counter"
  );
  return applyNativeOnce(
    actor,
    { requestId, action: "god-counter", activityUuid: data.activityUuid },
    async () => {
      await patchGod(actor, { counterWatch: null });
      if (
        !(await confirmOwner(
          actor,
          "Милостивый Отпор",
          `Заклинание уровня ${data.level}; реакция и ${10 * data.level} ОР. Остановить?`
        )) ||
        !(await confirmOwner(
          godGm(actor),
          "Видимость и отмена",
          "Божество сейчас действительно видит заклинателя, и GM подтверждает отмену этого конкретного Midi-потока? Ячейка заклинателя автоматически не возвращается."
        ))
      )
        return false;
      return useGodCost(activity, { points: 10 * data.level, activation: "reaction" });
    },
    async () => {
      await recordModuleReaction(actor, source.parent);
      return true;
    }
  );
});
export async function prepareGodCounter(workflow) {
  if (!enabled() || workflow?.aborted || workflow?.item?.type !== "spell") return;
  for (const actor of automationActors()) {
    if (godState(actor).counterWatch?.targetActorUuid !== workflow.actor.uuid) continue;
    const level = Number(workflow.castData?.castLevel ?? workflow.spellLevel ?? workflow.item.system.level),
      result = await requestGm(
        "god-counter",
        actor,
        { activityUuid: workflow.activity.uuid, level, workflowId: workflow.id },
        { requestId: `god-counter:${workflow.id}:${actor.uuid}`, timeoutMs: 180000 }
      );
    if (result.status === "success") {
      workflow.aborted = true;
      await workflow.performState?.(workflow.WorkflowState_Abort);
      return false;
    }
  }
}
