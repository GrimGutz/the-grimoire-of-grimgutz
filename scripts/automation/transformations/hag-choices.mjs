import { findFeature } from "../shared/helpers.mjs";
import { HAG_TYPES } from "../shared/hag-definitions.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import { applyNativeOnce } from "../shared/native-applications.mjs";
import { encounterForActor, combatTurnSnapshot } from "../shared/combat-flow.mjs";
import { hagState, patchHag, hagHas, hagLevel, hagType, hagRules, syncHag } from "./hag.mjs";
import { hagGm, hagTargets } from "./hag-use.mjs";
export async function chooseHagType(actor) {
  if (
    hagType(actor) &&
    !(await confirmOwner(
      hagGm(actor),
      "Смена типа Ведьмы",
      "PDF не даёт свободной смены. GM разрешает исправление типа и связанных пассивов?"
    ))
  )
    return false;
  const type = await askOwner(actor, { title: "Тип Ведьмы", choices: HAG_TYPES });
  if (!HAG_TYPES.some(([id]) => id === type)) return false;
  await patchHag(actor, { type, curses: [] });
  await syncHag(actor);
  return true;
}
export async function chooseHagCurses(actor) {
  const primary = hagType(actor);
  if (!primary) throw Error("Сначала выберите основной тип.");
  const count = hagHas(actor, "coven") ? 2 : hagHas(actor, "double") ? 1 : 0;
  if (!count) throw Error("Нет Двойного Проклятия.");
  if (
    hagState(actor).curses?.length &&
    !(await confirmOwner(
      hagGm(actor),
      "Изменить дополнительные виды",
      "GM подтверждает новый выбор при получении бонуса либо исправление, не свободное переобучение?"
    ))
  )
    return false;
  const ids = await askOwner(actor, {
    kind: "checkbox",
    title: "Дополнительные проклятия (без смены типа Ведьмы)",
    min: count,
    max: count,
    choices: HAG_TYPES.filter(([id]) => id !== primary)
  });
  if (!ids || ids.length !== count) return false;
  await patchHag(actor, { curses: ids });
  return true;
}
export async function configureHagRules(actor) {
  const gm = hagGm(actor),
    current = hagRules(actor),
    mode = await askOwner(gm, {
      title: "GM: дополнительные проклятия (согласовано: все вместе)",
      defaultValue: current.curseMode,
      choices: [
        ["all", "Все выбранные виды вместе"],
        ["one", "Один вид на применение"]
      ]
    });
  if (!["all", "one"].includes(mode)) return false;
  const type = await askOwner(gm, {
    title: "GM: Алый урон (согласовано: тип исходного урона)",
    defaultValue: current.scarletDamageType,
    choices: [["source", "Тип исходного урона"], ...Object.keys(CONFIG.DND5E.damageTypes ?? {}).map(k => [k, k])]
  });
  if (type !== "source" && !Object.hasOwn(CONFIG.DND5E.damageTypes ?? {}, type)) return false;
  const recovery = await askOwner(gm, {
    title: "GM: Наговор (согласовано: продолжительный отдых)",
    defaultValue: current.hexRecovery,
    choices: [
      ["lr", "Продолжительный отдых"],
      ["sr", "Короткий отдых"],
      ["manual", "Вручную"]
    ]
  });
  if (!["manual", "lr", "sr"].includes(recovery)) return false;
  await patchHag(actor, { curseMode: mode, scarletDamageType: type, hexRecovery: recovery });
  const pool = findFeature(actor, "hag-hex");
  if (pool)
    await pool.update({
      "system.uses.recovery": recovery === "manual" ? [] : [{ period: recovery, type: "recoverAll" }]
    });
  return true;
}
export async function rollHagFortunes(actor, { requestId, confirmed = false } = {}) {
  return applyNativeOnce(
    actor,
    { requestId, action: "hag-fortune-rest", activityUuid: null },
    () =>
      confirmed
        ? true
        : confirmOwner(
            hagGm(actor),
            "Гадалка: новый LR",
            "Завершён новый продолжительный отдых? Старые предсказания заменятся; это не свободный переброс."
          ),
    async () => {
      const results = [];
      for (let i = 0; i < (hagLevel(actor) >= 4 ? 2 : 1); i++) {
        const roll = await new Roll("1d20").evaluate();
        await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: "Гадалка: предсказание" });
        results.push({ id: foundry.utils.randomID(), value: Number(roll.total) });
      }
      await patchHag(actor, { fortunes: results });
      return true;
    }
  );
}
export function hagFortuneTurn(actor) {
  const c = encounterForActor(actor);
  if (!c) return null;
  const s = combatTurnSnapshot(c);
  return `${s.id}:${s.current.round}:${s.current.turn}`;
}
export async function useHagFortune(actor, source, requestId) {
  const state = hagState(actor),
    turn = hagFortuneTurn(actor);
  if (turn && state.fortuneTurn === turn) throw Error("Уже использовано предсказание в этот ход.");
  const rows = state.fortunes ?? [];
  if (!rows.length) throw Error("Нет сохранённых предсказаний; восстановление только после LR.");
  const id = await askOwner(actor, {
      title: "Какое предсказание потратить?",
      choices: rows.map(r => [r.id, String(r.value)])
    }),
    chosen = rows.find(r => r.id === id);
  if (!chosen) return false;
  const selected = await hagTargets(actor, source, "Видимое существо: бросок ещё не сделан", { self: true });
  if (!selected?.length) return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "hag-use-fortune", activityUuid: null },
    () =>
      confirmOwner(
        hagGm(actor),
        "Замена исходного d20",
        "Это проверка, атака или спасбросок видимого существа ДО броска, и в этот ход замены ещё не было? GM установит исходный d20 вручную; это не бонус к итогу."
      ),
    async () => {
      const fresh = hagState(actor);
      if (!fresh.fortunes?.some(r => r.id === id) || (turn && fresh.fortuneTurn === turn)) return false;
      await patchHag(actor, { fortunes: fresh.fortunes.filter(r => r.id !== id), fortuneTurn: turn });
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `Гадалка: GM заменяет исходный d20 на ${chosen.value}; цель ${selected[0].name}. Модификаторы броска сохраняются.`,
        whisper: [game.users.activeGM.id]
      });
      return true;
    }
  );
}
