import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, automationData, notify } from "../shared/helpers.mjs";
import { godAvailable, patchGod, godLevel, godDC, godAlignment, godFunctional, syncGod } from "./god.mjs";
import { godGm, godTargets, useGodCost } from "./god-use.mjs";
import {
  chooseGodForm,
  chooseGodAlignment,
  chooseGodElement,
  godDawn,
  scheduleGodDawn,
  godRecover,
  godRollIntervention
} from "./god-choices.mjs";
import { castGodSpell, godLimitedUse, armGodCounter } from "./god-spells.mjs";
import {
  godWrath,
  godRestoration,
  godDevourHealing,
  godJudgment,
  activateGodDomain,
  endGodDomain,
  godDomainRecipients
} from "./god-areas.mjs";
import { grantGodGift, grantGodMercy, revokeGodMercy, syncGodMercies } from "./god-gifts.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import { applyNativeOnce, nativeApplicationReply } from "../shared/native-applications.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { isEffectActive } from "../effects/temporary-effects.mjs";
async function godTranslocation(actor, activity, source, requestId) {
  const party = await godTargets(actor, source, 20, "Спутники Транслокации: +5 ОР за каждого", { max: 100, min: 0 });
  if (!party) return false;
  const mode = await askOwner(godGm(actor), {
    title: "Назначение на той же плоскости",
    choices: [
      ["scene", "Выбрать точку текущей сцены"],
      ["manual", "Другое место этой плоскости — переносит GM"]
    ]
  });
  if (!["scene", "manual"].includes(mode)) return false;
  if (
    !(await confirmOwner(
      godGm(actor),
      "Транслокация: место и спутники",
      "Назначение на текущей плоскости, спутники допустимы и свободные места подтверждены GM? Не создаются дубликаты токенов или актёров."
    ))
  )
    return false;
  let destination,
    previews = [];
  if (mode === "scene") {
    const data = activity.toObject();
    data.target = { ...data.target, template: { type: "sphere", size: "5", units: "ft", count: "1" } };
    const clone = activity.item.clone({ system: { activities: { [activity.id]: data } } }, { keepId: true }),
      templates = game.system?.canvas?.AbilityTemplate?.fromActivity(clone.system.activities.get(activity.id));
    if (!templates?.length) throw Error("Нативный выбор точки недоступен.");
    for (const p of templates) {
      const placed = await p.drawPreview();
      if (placed === false || placed == null) {
        for (const d of previews) await d.delete();
        return false;
      }
      previews.push(...(Array.isArray(placed) ? placed : [placed]));
    }
    const region = previews[0]?.document ?? previews[0],
      shape = region?.shapes?.[0];
    destination = { x: Number(shape?.x ?? region?.x), y: Number(shape?.y ?? region?.y) };
    if (!Number.isFinite(destination.x) || !Number.isFinite(destination.y)) {
      for (const d of previews) await (d.document ?? d).delete();
      throw Error("Не удалось прочитать выбранную точку.");
    }
  }
  try {
    return await applyNativeOnce(
      actor,
      { requestId, action: "god-translocation", activityUuid: activity.uuid },
      () => useGodCost(activity, { points: 35 + 5 * party.length }),
      async () => {
        if (mode === "manual") {
          await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<p>Транслокация: оплачено ${35 + 5 * party.length} ОР. GM переносит источник и ${party.length} подтверждённых спутников в объявленное место той же плоскости. Документы не дублировались.</p>`
          });
          return true;
        }
        const size = Number(source.parent.grid.size),
          x = destination.x - (Number(source.width) * size) / 2,
          y = destination.y - (Number(source.height) * size) / 2,
          dx = x - Number(source.x),
          dy = y - Number(source.y),
          updates = [source, ...party].map(t => ({ t, x: Number(t.x) + dx, y: Number(t.y) + dy }));
        for (const p of updates) await p.t.update({ x: p.x, y: p.y });
        return true;
      }
    );
  } finally {
    for (const p of previews) await (p.document ?? p).delete();
  }
}
registerGmRequest("god-action", (actor, data, { requestId }) =>
  serialMutation(`god-action:${actor.uuid}`, async () => {
    if (!enabled() || !isGmAuthority()) return false;
    const old = nativeApplicationReply(actor, requestId);
    if (old) return old;
    const activity = await fromUuid(data.activityUuid);
    if (activity?.actor?.uuid !== actor.uuid || !godAvailable(actor, activity.item)) return false;
    const op = automationData(activity).godOperation;
    if (op === "status") {
      notify(
        `Божество ${godLevel(actor)}; Сл ${godDC(actor)}; ${godAlignment(actor) ?? "мировоззрение не выбрано"}; ${godFunctional(actor) ? "действует" : "апатия"}.`
      );
      return true;
    }
    if (op === "form") return chooseGodForm(actor);
    if (op === "alignment") return chooseGodAlignment(actor);
    if (op === "apathy" || op === "awaken") {
      if (
        !(await confirmOwner(
          godGm(actor),
          op === "apathy" ? "Потеря всех последователей" : "Ритуал возвращения",
          op === "apathy"
            ? "Действительно потеряны все последователи? Божественные бонусы отключатся, инвентарь останется; перемещение в астрал ведёт GM."
            : "GM подтверждает завершённый ритуал возвращения?"
        ))
      )
        return false;
      await patchGod(actor, { apathy: op === "apathy" });
      if (op === "apathy") await endGodDomain(actor);
      await syncGod(actor);
      await syncGodMercies(actor);
      return true;
    }
    if (op === "dawn") return godDawn(actor);
    if (!godFunctional(actor)) throw Error("В апатии божественные способности недоступны.");
    if (op === "schedule-dawn") return scheduleGodDawn(actor);
    if (op === "element") return chooseGodElement(actor);
    if (op === "end-domain") return endGodDomain(actor);
    if (op === "cast") return castGodSpell(actor, activity, requestId);
    if (op === "wish") return castGodSpell(actor, activity, requestId, { wish: true });
    if (op === "recharge-use") return godLimitedUse(actor, activity, requestId);
    if (op === "recover") return godRecover(actor, activity, requestId);
    if (op === "revoke-mercy") return revokeGodMercy(actor);
    if (op === "mantle") {
      if (
        !(await confirmOwner(
          godGm(actor),
          "Прометеева Мантия вне Midi",
          "Подтверждён именно текущий проваленный спасбросок? Потратить 60 ОР; GM вручную заменит его успехом, не выдавая постоянного автоуспеха."
        ))
      )
        return false;
      return applyNativeOnce(
        actor,
        { requestId, action: "god-mantle-manual", activityUuid: activity.uuid },
        () => useGodCost(activity, { points: 60, activation: "special" }),
        async () => true
      );
    }
    if (op === "foresight") {
      if (
        !(await confirmOwner(
          godGm(actor),
          "Демисциенция: предсказание",
          "Задуманное действие объявлено GM. Потратить 50 ОР и действие; GM сообщит наиболее вероятный результат в ближайший час либо отсутствие простого ответа?"
        ))
      )
        return false;
      return applyNativeOnce(
        actor,
        { requestId, action: "god-foresight", activityUuid: activity.uuid },
        () => useGodCost(activity, { points: 50 }),
        async () => true
      );
    }
    const source = await fromUuid(data.sourceUuid);
    if (source?.actor?.uuid !== actor.uuid || !canvas.ready || canvas.scene?.id !== source.parent.id)
      throw Error("Выберите токен Божества; активный GM должен открыть его сцену до расхода.");
    if (op === "counter") return armGodCounter(actor, source);
    if (["guide", "ruin"].includes(op)) return godRollIntervention(actor, activity, source, op, requestId);
    if (op === "wrath") return godWrath(actor, activity, source, requestId);
    if (op === "translocation") return godTranslocation(actor, activity, source, requestId);
    if (op === "gift") return grantGodGift(actor, activity, source, requestId);
    if (op === "mercy") return grantGodMercy(actor, activity, source, requestId);
    if (op === "restoration") return godRestoration(actor, activity, source, requestId);
    if (op === "devour-healing") return godDevourHealing(actor, activity, source, requestId);
    if (op === "domain") return activateGodDomain(actor, activity, source, requestId);
    if (op === "domain-recipients") return godDomainRecipients(actor, source);
    if (op === "judgment") return godJudgment(actor, activity, source, requestId);
    if (op === "end-gift") {
      const targets = await godTargets(godGm(actor), source, 1000000, "GM: получатель снимаемого дара", { self: true }),
        target = targets?.[0];
      if (!target) return false;
      const gifts = [...(target.actor.effects ?? [])].filter(
          e => e.getFlag?.(MODULE_ID, "godGift")?.sourceActorUuid === actor.uuid && isEffectActive(e)
        ),
        uuid = await askOwner(godGm(actor), {
          title: "Снять только свой дар",
          choices: gifts.map(e => [e.uuid, e.name])
        }),
        e = gifts.find(e => e.uuid === uuid);
      if (!e) return false;
      await e.delete();
      return true;
    }
    throw Error(`Неизвестная операция Божества: ${op}`);
  })
);
const pending = new Map();
export function controlGod(actor, activity) {
  const key = `${actor.uuid}:${activity.uuid}`;
  if (pending.has(key)) return pending.get(key);
  const source =
    canvas.tokens?.controlled?.map(t => t.document).find(t => t.actor?.uuid === actor.uuid) ??
    canvas.tokens?.placeables?.map(t => t.document).find(t => t.actor?.uuid === actor.uuid);
  const task = requestGm(
    "god-action",
    actor,
    { activityUuid: activity.uuid, sourceUuid: source?.uuid },
    { timeoutMs: 180000 }
  ).finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}
