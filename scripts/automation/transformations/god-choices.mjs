import { MODULE_ID } from "../shared/constants.mjs";
import { GOD_ABILITIES } from "../shared/god-definitions.mjs";
import { godState, patchGod, godAlignment, godPool, godHas } from "./god.mjs";
import { syncGod } from "./god.mjs";
import { godGm, godTargets, useGodCost, applyGodHealing } from "./god-use.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import { itemUses } from "../shared/helpers.mjs";
import { applyNativeOnce } from "../shared/native-applications.mjs";
import { recordModuleReaction } from "../shared/combat-benefits.mjs";
import { serialMutation } from "../shared/transactions.mjs";
export async function chooseGodForm(actor) {
  const allocation = {};
  let remaining = 10;
  const current = godState(actor).allocation ?? {};
  if (
    Object.keys(current).length &&
    !(await confirmOwner(
      godGm(actor),
      "GM: исправление распределения",
      "PDF не даёт свободного перераспределения в бою. Разрешено исправить прежний выбор, без получения новых очков?"
    ))
  )
    return false;
  for (const a of GOD_ABILITIES) {
    const previous = [...(actor.effects ?? [])]
        .filter(e => e.getFlag?.(MODULE_ID, "godPassive") === "form")
        .flatMap(e => e.system?.changes ?? [])
        .filter(c => c.key === `system.abilities.${a}.value`)
        .reduce((n, c) => n + Number(c.value), 0),
      base = Number(actor.system.abilities[a].value) - previous,
      cap = Math.max(0, Math.min(remaining, 26 - base));
    if (!cap) {
      allocation[a] = 0;
      continue;
    }
    const n = await askOwner(actor, {
      kind: "number",
      title: `Божественная форма: ${a.toUpperCase()}`,
      label: `Осталось ${remaining} из 10; предел характеристики 26.`,
      min: 0,
      max: cap,
      defaultValue: Math.min(cap, Number(current[a] ?? 0))
    });
    if (!Number.isInteger(n) || n < 0 || n > cap) return false;
    allocation[a] = n;
    remaining -= n;
  }
  if (remaining) throw Error(`Не распределено ${remaining} очков. Сохранение отменено.`);
  let alignment = godAlignment(actor);
  if (!alignment) {
    alignment = await askOwner(actor, {
      title: "Начальное проявление Божества",
      choices: [
        ["good", "Добрый"],
        ["evil", "Злой"]
      ]
    });
    if (!["good", "evil"].includes(alignment)) return false;
  }
  await patchGod(actor, { allocation, alignment, additionalType: "celestial" });
  await syncGod(actor);
  return true;
}
export async function chooseGodAlignment(actor) {
  const alignment = await askOwner(godGm(actor), {
    title: "GM: текущее мировоззрение Божества",
    choices: [
      ["good", "Добрый"],
      ["evil", "Злой"]
    ]
  });
  if (!["good", "evil"].includes(alignment)) return false;
  await patchGod(actor, { alignment });
  return true;
}
export async function chooseGodElement(actor) {
  if (
    godState(actor).element &&
    !(await confirmOwner(
      godGm(actor),
      "GM: исправить выбор типа",
      "Источник не даёт смены типа по желанию/после отдыха. Разрешено исправить прежний выбор?"
    ))
  )
    return false;
  const choices = Object.keys(CONFIG.DND5E.damageTypes ?? {}).filter(
      k => !["healing", "temphp", "maximum", "midi-none", "none"].includes(k)
    ),
    element = await askOwner(actor, {
      title: "Демиургия: один тип игнорирования защит",
      choices: choices.map(k => [k, k])
    });
  if (!choices.includes(element)) return false;
  await patchGod(actor, { element });
  return true;
}
export async function godDawn(actor, { scheduled = false } = {}) {
  return serialMutation(`god-dawn:${actor.uuid}`, async () => {
    const now = Number(game.time.worldTime),
      s = godState(actor);
    if (s.lastDawnAt === now) return false;
    if (
      !scheduled &&
      !(await confirmOwner(
        godGm(actor),
        "Новый рассвет",
        "Наступил новый настоящий рассвет, не просто завершился отдых? Полностью восстановить ОР."
      ))
    )
      return false;
    const pool = godPool(actor);
    if (!pool) return false;
    await pool.update({ "system.uses.spent": 0 });
    await patchGod(actor, { lastDawnAt: now, dawnAt: null });
    return true;
  });
}
export async function scheduleGodDawn(actor) {
  const minutes = await askOwner(godGm(actor), {
    kind: "number",
    title: "GM: минут до ближайшего настоящего рассвета",
    min: 1,
    max: 10080,
    defaultValue: 480
  });
  if (!Number.isFinite(minutes) || minutes < 1) return false;
  await patchGod(actor, { dawnAt: Number(game.time.worldTime) + 60 * minutes });
  return true;
}
export async function godRecover(actor, activity, requestId, { automatic = false } = {}) {
  if (Number(actor.system.attributes.hp.value) !== 0 || !godHas(actor, "united")) return false;
  const good = godAlignment(actor) === "good";
  if (!godAlignment(actor)) return false;
  if (
    automatic &&
    !(await confirmOwner(
      actor,
      "Один за Всех/Все за Одного",
      "Хиты упали до 0. Применить восстановление с расходом ОР либо подтверждёнными жертвами?"
    ))
  )
    return false;
  let amount,
    points = 0;
  if (good) {
    const max = Math.floor(itemUses(godPool(actor)).remaining / 20);
    if (!max) return false;
    const units = await askOwner(actor, {
      kind: "number",
      title: "Один за Всех: сколько порций по 20 ОР?",
      min: 1,
      max,
      defaultValue: 1
    });
    if (!Number.isInteger(units) || units < 1 || units > max) return false;
    points = 20 * units;
    amount = 10 * units;
  } else {
    amount = await askOwner(godGm(actor), {
      kind: "number",
      title: "Все за Одного: число действительно жертвуемых последователей",
      min: 1,
      max: 100000,
      defaultValue: 1
    });
    if (
      !Number.isInteger(amount) ||
      amount < 1 ||
      !(await confirmOwner(
        godGm(actor),
        "Подтверждённые смерти последователей",
        "Именно собственные реальные последователи убиты ради этого восстановления? NPC и инвентарь автоматически не удаляются."
      ))
    )
      return false;
  }
  return applyNativeOnce(
    actor,
    { requestId, action: "god-recover", activityUuid: activity.uuid },
    () =>
      Number(actor.system.attributes.hp.value) === 0 ? useGodCost(activity, { points, activation: "special" }) : false,
    async () => {
      if (Number(actor.system.attributes.hp.value) !== 0) return { status: "needs-review" };
      await applyGodHealing(actor, actor, amount);
      return true;
    }
  );
}
export async function godRollIntervention(actor, activity, source, op, requestId) {
  const good = op === "guide";
  if (godAlignment(actor) !== (good ? "good" : "evil")) throw Error("Нужно соответствующее Доброе/Злое мировоззрение.");
  const selected = await godTargets(godGm(actor), source, 1000000, "GM: видимое существо конкретного текущего броска", {
      self: true
    }),
    target = selected?.[0];
  if (!target) return false;
  const kind = await askOwner(godGm(actor), {
    title: "Конкретный бросок, не постоянный бонус",
    choices: [
      ["attack", "Атака"],
      ["save", "Спасбросок"],
      ["check", "Проверка характеристики"]
    ]
  });
  if (!["attack", "save", "check"].includes(kind)) return false;
  const n = await askOwner(actor, {
    kind: "number",
    title: `${good ? "Наставление" : "Разрушение"}: 1–10 ОР`,
    min: 1,
    max: Math.min(10, itemUses(godPool(actor)).remaining),
    defaultValue: 1
  });
  if (!Number.isInteger(n) || n < 1 || n > 10) return false;
  if (
    !(await confirmOwner(
      godGm(actor),
      "Контекст и видимость",
      "Божество сейчас видит существо и указан именно один происходящий бросок? GM применит поправку к этому броску в нативном диалоге/карточке. Общего пассивного бонуса не будет."
    ))
  )
    return false;
  return applyNativeOnce(
    actor,
    { requestId, action: `god-${op}`, activityUuid: activity.uuid },
    () => useGodCost(activity, { points: n, activation: "reaction" }),
    async () => {
      await recordModuleReaction(actor, source.parent);
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<p>${good ? "Небесное Наставление" : "Небесное Разрушение"}: ${good ? "+" : "−"}${n} только к подтверждённому броску (${kind}) ${foundry.utils.escapeHTML(target.name ?? target.actor.name)}. GM применяет эту поправку; реакция и ${n} ОР уже потрачены.</p>`
      });
      return true;
    }
  );
}
