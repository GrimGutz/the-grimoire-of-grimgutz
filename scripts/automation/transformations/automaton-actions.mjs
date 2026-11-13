import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, automationData, notify, findFeature } from "../shared/helpers.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { applyNativeOnce, nativeApplicationReply } from "../shared/native-applications.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { useNativeUtility } from "../shared/native-actions.mjs";
import { addCombatBenefit } from "../shared/combat-benefits.mjs";
import { encounterForScene } from "../shared/combat-flow.mjs";
import { AUTOMATON_MODELS, AUTOMATON_ELEMENTS, automatonSpellIdentity } from "../shared/automaton-definitions.mjs";
import {
  automatonState,
  automatonAvailable,
  automatonHas,
  automatonTransformationLevel,
  automatonDC,
  automatonChange,
  syncAutomaton
} from "./automaton.mjs";
import {
  automatonGm,
  automatonExpense,
  automatonStateEffect,
  removeAutomatonStateEffect,
  automatonRoll,
  confirmAutomatonGm
} from "./automaton-use.mjs";
import { chooseAutomatonEquipment, useAutomatonEquipment } from "./automaton-equipment.mjs";
import { storeAutomatonSpell, castAutomatonSpell } from "./automaton-battery.mjs";
import { useAreaActivity } from "../shared/area-activities.mjs";
import { areaActivityData } from "../shared/area-definitions.mjs";
import { effectKey } from "../shared/system-paths.mjs";

async function chooseModel(actor, activity, requestId) {
  const model = await askOwner(actor, {
    title: "Модель Автоматона",
    choices: Object.entries(AUTOMATON_MODELS),
    defaultValue: automatonState(actor).model
  });
  if (!AUTOMATON_MODELS[model]) return false;
  if (
    automatonState(actor).model &&
    model !== automatonState(actor).model &&
    !(await confirmAutomatonGm(
      actor,
      "Смена модели",
      "Разрешена смена ранее выбранной модели? PDF не задаёт свободную смену."
    ))
  )
    return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "automaton-model", activityUuid: activity.uuid },
    async () => true,
    async () => {
      await actor.setFlag(MODULE_ID, "automatonState", { ...structuredClone(automatonState(actor)), model });
      await syncAutomaton(actor);
      return true;
    }
  );
}
async function immunities(actor, activity, requestId) {
  const state = automatonState(actor),
    epoch = Number(state.restEpoch ?? 0);
  if (state.model !== "warrior") throw Error("Три иммунитета получает только модель воина.");
  if (state.immunityEpoch === epoch) throw Error("Следующий выбор иммунитетов — после продолжительного отдыха.");
  const cards = [...(actor.items ?? []), ...(game.items ?? [])].filter(i => i.type === "spell");
  for (const pack of game.packs?.values?.() ?? []) {
    if (
      pack.metadata?.type !== "Item" ||
      !/spell|заклин/u.test(String(pack.metadata?.name ?? pack.collection).toLowerCase())
    )
      continue;
    const index = await pack.getIndex({ fields: ["type", "system.identifier", "system.level"] });
    cards.push(...[...index].filter(i => i.type === "spell" || Number.isFinite(i.system?.level)));
  }
  const unique = new Map(cards.map(i => [automatonSpellIdentity(i), { id: automatonSpellIdentity(i), name: i.name }]));
  unique.delete("");
  const selected = await askOwner(actor, {
    kind: "checkbox",
    title: "Иммунитет к трём заклинаниям",
    choices: [...unique].map(([key, row]) => [key, row.name]),
    min: 3,
    max: 3
  });
  if (!Array.isArray(selected) || new Set(selected).size !== 3 || selected.some(id => !unique.has(id))) return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "automaton-immunities", activityUuid: activity.uuid },
    async () => true,
    async () => {
      await actor.setFlag(MODULE_ID, "automatonState", {
        ...structuredClone(automatonState(actor)),
        immunities: selected.map(id => unique.get(id)),
        immunityEpoch: epoch
      });
      return true;
    }
  );
}
async function antimagic(actor, activity, operation, requestId) {
  if (
    !(await confirmAutomatonGm(
      actor,
      "Антимагическое поле",
      operation === "antimagic-exit"
        ? "Подтверждён выход из поля? Снимается только состояние этого источника."
        : "Подтверждён вход в антимагическое поле?"
    ))
  )
    return false;
  return applyNativeOnce(
    actor,
    { requestId, action: operation, activityUuid: activity.uuid },
    async () => true,
    async () => {
      if (operation === "antimagic-exit") {
        await removeAutomatonStateEffect(actor, "antimagic");
        return true;
      }
      const upgraded = automatonHas(actor, "vulnerability"),
        changes = [];
      if (!upgraded) {
        for (const key of ["walk", "fly", "swim", "climb", "burrow"])
          changes.push(automatonChange(effectKey(`system.attributes.movement.${key}`), 0.5, "multiply", "final", 50));
        changes.push(
          automatonChange("system.attributes.ac.bonus", -2),
          automatonChange(effectKey("system.abilities.dex.bonuses.save"), -2)
        );
      }
      await automatonStateEffect(actor, activity.item, "antimagic", {
        changes,
        statuses: upgraded ? ["unconscious"] : [],
        description: upgraded
          ? "Без сознания только пока в антимагии."
          : "Замедление в антимагии; ограничения действия/атак и задержку заклинаний проводит GM."
      });
      return true;
    }
  );
}
async function checkRecharge(actor, activity, requestId) {
  const state = automatonState(actor),
    interval = automatonHas(actor, "drain") ? 8 : 10,
    now = Number(game.time.worldTime),
    base = Number(state.lastRecharge ?? now),
    elapsed = Math.floor((now - base) / (interval * 3600));
  const choice = await askOwner(automatonGm(actor), {
    title: `Перезарядка: интервал ${interval} ч`,
    label: `С последней отметки: ${Math.max(0, elapsed)} интервалов. Пропущенные события не применяются без проверки GM.`,
    choices: [
      ["reset", "Начать отсчёт / подтверждён LR"],
      ["exhaust", "Подтверждено: +1 истощение"]
    ]
  });
  if (!choice) return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "automaton-recharge", activityUuid: activity.uuid },
    async () => true,
    async () => {
      const update = {
        [`flags.${MODULE_ID}.automatonState`]: { ...structuredClone(automatonState(actor)), lastRecharge: now }
      };
      if (choice === "exhaust")
        update["system.attributes.exhaustion"] = Number(actor.system.attributes.exhaustion ?? 0) + 1;
      await actor.update(update);
      return true;
    }
  );
}
async function core(actor, activity, requestId) {
  if (
    !(await confirmOwner(
      actor,
      "Нестабильное ядро",
      "Взорвать ядро? Это приводит к смерти персонажа и уничтожению предметов в области."
    )) ||
    !(await confirmAutomatonGm(
      actor,
      "Взрыв ядра",
      "Подтверждены смерть, последствия взрыва и последующее восстановление тела? Их GM проводит отдельно. Выполнить спасброски/урон кругом 200 футов?"
    ))
  )
    return false;
  const spec = {
      shape: "sphere",
      size: 200,
      origin: "self",
      excludeSelf: false,
      save: "dex",
      dc: String(automatonDC(actor)),
      damage: [{ formula: "20d8", type: "force" }],
      onSave: "half"
    },
    data = areaActivityData(activity.toObject(), spec);
  // The source does not give an action type for core release. Do not invent one.
  data.flags = { [MODULE_ID]: { automatonResolved: true, area: spec, action: "" } };
  data.activation = { type: "special", value: null, override: true };
  data.consumption = { spellSlot: false, targets: [] };
  const item = activity.item.clone({ system: { activities: { [activity.id]: data } } }, { keepId: true });
  return applyNativeOnce(
    actor,
    { requestId, action: "automaton-core", activityUuid: activity.uuid },
    () => useAreaActivity(item.system.activities.get(activity.id), { reportOutcome: true }),
    async () => {
      await actor.setFlag(MODULE_ID, "automatonState", {
        ...structuredClone(automatonState(actor)),
        coreAt: Number(game.time.worldTime),
        coreRebuildAt: Number(game.time.worldTime) + 8 * 3600
      });
      return true;
    }
  );
}
registerGmRequest("automaton-action", (actor, data, { requestId }) =>
  serialMutation(`automaton:${actor.uuid}`, async () => {
    if (!enabled() || !isGmAuthority()) return false;
    const previous = nativeApplicationReply(actor, requestId);
    if (previous) return previous;
    const activity = await fromUuid(data.activityUuid);
    if (activity?.actor?.uuid !== actor.uuid || !automatonAvailable(actor, activity.item)) return false;
    const operation = automationData(activity).automatonOperation;
    if (operation === "status") {
      notify(
        `Автоматон ${automatonTransformationLevel(actor)}; СЛ ${automatonDC(actor)}; ${AUTOMATON_MODELS[automatonState(actor).model] ?? "выберите модель"}.`
      );
      return true;
    }
    if (operation === "model") return chooseModel(actor, activity, requestId);
    if (operation === "immunities") return immunities(actor, activity, requestId);
    if (operation.startsWith("antimagic-")) return antimagic(actor, activity, operation, requestId);
    if (operation === "dispel")
      return applyNativeOnce(
        actor,
        { requestId, action: operation, activityUuid: activity.uuid },
        () =>
          confirmAutomatonGm(
            actor,
            "Рассеивание магии",
            "Подтверждено применение Рассеивания? Тип урона и уменьшения в PDF не заданы: GM применит результат броска."
          ),
        async () => {
          await automatonRoll(
            actor,
            `${automatonTransformationLevel(actor)}d${automatonHas(actor, "vulnerability") ? 12 : 8}`,
            "Вред от Рассеивания магии — применяет GM"
          );
          return true;
        }
      );
    if (operation === "recharge") return checkRecharge(actor, activity, requestId);
    if (operation === "steel") {
      notify(
        "Сила и уверенность стали предлагается перед входящим уроном в Midi; реакция и использование расходуются только после согласия."
      );
      return true;
    }
    if (operation === "coils-release") {
      notify(
        "Катушки: дополнительный урон предлагается после рукопашного попадания, до броска урона. Кнопка не тратит временные хиты заранее."
      );
      return true;
    }
    if (operation === "coils") {
      const element = await askOwner(actor, {
        title: "Элемент катушек",
        choices: Object.entries(AUTOMATON_ELEMENTS),
        defaultValue: automatonState(actor).element
      });
      if (!AUTOMATON_ELEMENTS[element]) return false;
      if (
        automatonState(actor).element &&
        element !== automatonState(actor).element &&
        !(await confirmAutomatonGm(actor, "Смена катушек", "Подтверждены неделя работы и трата 1000 зм?"))
      )
        return false;
      return applyNativeOnce(
        actor,
        { requestId, action: operation, activityUuid: activity.uuid },
        async () => true,
        async () => {
          await actor.setFlag(MODULE_ID, "automatonState", { ...structuredClone(automatonState(actor)), element });
          return true;
        }
      );
    }
    if (operation === "battery-store") return storeAutomatonSpell(actor, activity, requestId);
    if (operation === "battery-cast") return castAutomatonSpell(actor, activity, requestId);
    if (operation === "equipment") return chooseAutomatonEquipment(actor, activity, requestId);
    const source = await fromUuid(data.sourceUuid);
    if (source?.actor?.uuid !== actor.uuid || !canvas.ready || canvas.scene?.id !== source.parent.id)
      throw Error("Выберите токен Автоматона; GM должен открыть его сцену до расхода.");
    if (["equipment-end", "shield", "shard", "charge", "beam"].includes(operation))
      return useAutomatonEquipment(actor, activity, source, operation, requestId);
    if (operation === "core") return core(actor, activity, requestId);
    if (operation === "overload") {
      const combat = encounterForScene(source.parent, source);
      if (combat?.started && combat.combatant?.tokenId !== source.id) throw Error("Перегрузка применяется в свой ход.");
      return applyNativeOnce(
        actor,
        { requestId, action: operation, activityUuid: activity.uuid },
        () => useNativeUtility(activity, { dataPatch: automatonExpense(activity, { activation: "special", cost: 1 }) }),
        async () => {
          await addCombatBenefit(source, source, activity.item, {
            kind: "automaton-overload",
            expiry: combat?.started ? "sourceStart" : null,
            remaining: null,
            dice: Math.floor(automatonTransformationLevel(actor) / 2)
          });
          return true;
        }
      );
    }
    if (["bastion", "bastion-end"].includes(operation))
      return applyNativeOnce(
        actor,
        { requestId, action: operation, activityUuid: activity.uuid },
        () =>
          useNativeUtility(activity, {
            dataPatch: automatonExpense(activity, { activation: operation === "bastion" ? "action" : "bonus" })
          }),
        async () => {
          if (operation === "bastion-end") await removeAutomatonStateEffect(actor, "bastion");
          else
            await automatonStateEffect(actor, activity.item, "bastion", {
              changes: ["walk", "fly", "swim", "climb", "burrow"].map(k =>
                automatonChange(effectKey(`system.attributes.movement.${k}`), 0, "override", "final", 100)
              )
            });
          return true;
        }
      );
    return false;
  })
);
const controls = new Map();
export function controlAutomaton(actor, activity) {
  const key = `${actor.uuid}:${activity.uuid}`;
  if (controls.has(key)) return controls.get(key);
  const source =
    canvas.tokens?.controlled?.map(t => t.document).find(t => t.actor?.uuid === actor.uuid) ??
    canvas.tokens?.placeables?.map(t => t.document).find(t => t.actor?.uuid === actor.uuid);
  const task = requestGm(
    "automaton-action",
    actor,
    { activityUuid: activity.uuid, sourceUuid: source?.uuid },
    { timeoutMs: 180000 }
  ).finally(() => controls.delete(key));
  controls.set(key, task);
  return task;
}
