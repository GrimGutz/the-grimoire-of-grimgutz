import { MODULE_ID } from "../shared/constants.mjs";
import { dullahanState, patchDullahan } from "./dullahan.mjs";
import { dullahanGm, dullahanExpense } from "./dullahan-use.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import { applyNativeOnce } from "../shared/native-applications.mjs";
import { useNativeUtility } from "../shared/native-actions.mjs";
import { temporaryEffectTiming, isEffectActive } from "../effects/temporary-effects.mjs";
import { inFeet } from "../shared/combat-benefits.mjs";
export async function dullahanRebirth(actor, operation) {
  const hp = actor.system.attributes.hp,
    state = dullahanState(actor);
  if (operation === "rebirth-start") {
    if (Number(hp.value) > 0) throw Error("Тело ещё не находится при 0 HP.");
    if (state.rebirth) throw Error("Срок уже записан: новое нажатие не перезапускает 48 часов.");
    if (
      !(await confirmOwner(
        dullahanGm(actor),
        "Непреклонный: целая голова",
        "Голова действительно цела, и подтверждён новый переход тела к 0 HP? Записать 48 игровых часов, без автоматического снятия ресурсов/воскрешения?"
      ))
    )
      return false;
    await patchDullahan(actor, {
      rebirth: { startedAt: Number(game.time.worldTime), readyAt: Number(game.time.worldTime) + 172800 }
    });
    return true;
  }
  if (!state.rebirth || Number(game.time.worldTime) < state.rebirth.readyAt)
    throw Error("48 игровых часов ещё не прошли либо срок не записан.");
  if (
    !(await confirmOwner(
      dullahanGm(actor),
      "Непреклонный: восстановление тела",
      "Голова всё ещё цела, в пределах 5 футов есть свободное место и GM разместит там тело? Восстановить только хиты, не ячейки, ресурсы или положение головы."
    ))
  )
    return false;
  await actor.update({ "system.attributes.hp.value": Number(hp.effectiveMax ?? hp.max) });
  await patchDullahan(actor, { rebirth: null });
  return true;
}
export async function dullahanMists(actor, activity, source, operation, requestId) {
  const effects = [...(actor.effects ?? [])].filter(e => e.getFlag?.(MODULE_ID, "dullahanMists"));
  if (operation === "end-mists") {
    if (!(await confirmOwner(dullahanGm(actor), "GM: завершить Туманы", "Рассвело либо GM завершает эффект?")))
      return false;
    for (const e of effects) await e.delete();
    return true;
  }
  if (operation === "mist-report") {
    if (!effects.some(isEffectActive)) throw Error("Нет действующих Туманов Отчуждения.");
    if (
      !(await confirmOwner(
        dullahanGm(actor),
        "GM: сведения тумана",
        "Показать только GM местоположение, максимум HP и размер существ текущей сцены в двух милях от источника? Существ вне сцены добавляет GM; игрокам скрытые данные не раскрываются."
      ))
    )
      return false;
    const escape = v => foundry.utils.escapeHTML(String(v)),
      rows = [...(source.parent.tokens ?? [])]
        .filter(t => t.actor && inFeet(source, t, 10560, source.parent))
        .map(
          t =>
            `<li>${escape(t.name ?? t.actor.name)}: (${Number(t.x)}, ${Number(t.y)}), максимум HP ${Number(t.actor.system.attributes.hp.effectiveMax ?? t.actor.system.attributes.hp.max)}, размер ${escape(t.actor.system.traits?.size ?? "?")}</li>`
        );
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      whisper: [...game.users].filter(u => u.isGM).map(u => u.id),
      content: `<p>Туманы Отчуждения — сведения для GM, только текущая сцена.</p><ul>${rows.join("")}</ul>`
    });
    return true;
  }
  if (effects.some(isEffectActive)) throw Error("Туман уже действует.");
  const minutes = await askOwner(dullahanGm(actor), {
    kind: "number",
    title: "Туманы: подтверждённая ночь",
    label: "Сколько игровых минут до следующего рассвета? Отмена не тратит ресурс.",
    min: 1,
    max: 10080,
    defaultValue: 480
  });
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 10080) return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "dullahan-mists", activityUuid: activity.uuid },
    () => useNativeUtility(activity, { dataPatch: dullahanExpense(activity, { cost: 1 }) }),
    async () => {
      await actor.createEmbeddedDocuments("ActiveEffect", [
        {
          name: activity.item.name,
          img: activity.item.img,
          type: "base",
          disabled: false,
          transfer: false,
          origin: activity.item.uuid,
          statuses: [],
          ...temporaryEffectTiming({ seconds: minutes * 60, actor }),
          flags: {
            [MODULE_ID]: { dullahanMists: { sourceTokenUuid: source.uuid, sceneId: source.parent.id } },
            dae: { expiryMode: "delete" }
          },
          system: { changes: [] }
        }
      ]);
      return true;
    }
  );
}
export async function dullahanProphecy(actor, activity, operation, requestId) {
  if (operation === "prophecy")
    return applyNativeOnce(
      actor,
      { requestId, action: "dullahan-prophecy", activityUuid: activity.uuid },
      () => useNativeUtility(activity, { dataPatch: dullahanExpense(activity, { cost: 1 }) }),
      async () => true
    );
  const spells = [...(actor.items ?? [])].filter(i => i.type === "spell" && i.system.identifier === "sending"),
    spell = spells[0],
    cast = [...(spell?.system.activities?.values?.() ?? [])][0];
  if (!cast) throw Error("Добавьте собственную нативную карточку Отправки (sending) из установленной библиотеки.");
  if (
    !(await confirmOwner(
      dullahanGm(actor),
      "Смертельное прорицание: Отправка",
      "Получатель на той же плоскости? Дух передаёт обычное сообщение, без расхода ячейки и применения Прорицания."
    ))
  )
    return false;
  const data = cast.toObject();
  data.activation = { type: "action", value: 1, override: true };
  data.consumption = { spellSlot: false, targets: [] };
  data.flags = { [MODULE_ID]: { dullahanResolved: true, action: "" } };
  const clone = spell.clone({ system: { activities: { [cast.id]: data } } }, { keepId: true });
  return applyNativeOnce(
    actor,
    { requestId, action: "dullahan-sending", activityUuid: activity.uuid },
    () => MidiQOL.completeActivityUse(clone.system.activities.get(cast.id), {}, { configure: true }),
    async () => true
  );
}
