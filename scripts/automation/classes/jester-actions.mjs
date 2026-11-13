import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, automationData, automationAction, findFeature, itemUses, notify } from "../shared/helpers.mjs";
import { jesterMaximum, jesterChaosDelta, jesterImpromptuDie } from "../shared/jester-definitions.mjs";
import { jesterLevel, jesterAvailable, jesterPool, jesterPoints, jesterDC, changeJesterChaos } from "./jester.mjs";
import { askOwner, confirmOwner, chooseSceneTokens } from "../shared/owner-prompts.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { applyNativeOnce, nativeApplicationReply } from "../shared/native-applications.mjs";
import { useNativeUtility } from "../shared/native-actions.mjs";
import { sourceTokenForActor } from "../shared/zones.mjs";
import { inFeet, canReact, recordModuleReaction } from "../shared/combat-benefits.mjs";
import { useAuraPulse } from "../midi/aura-workflow.mjs";
import { areaDamagePart } from "../shared/area-definitions.mjs";

export const jesterGm = actor => ({ uuid: actor.uuid, testUserPermission: user => user.isGM });
const object = doc => doc.object ?? { actor: doc.actor, document: doc };
export function jesterExpense(activity, { delta = 0, activation = "special", finale = false } = {}) {
  if (!jesterAvailable(activity.actor, activity.item) || !jesterPool(activity.actor) || !Number.isInteger(delta))
    throw Error("Нет способности/запаса Арлекина.");
  if (delta < 0 && jesterPoints(activity.actor) < -delta) throw Error("Недостаточно очков хаоса.");
  if (finale && itemUses(activity.item).remaining < 1) throw Error("Финальный номер недоступен до отдыха.");
  const targets = [];
  if (delta < 0) targets.push({ type: "itemUses", target: jesterPool(activity.actor).id, value: String(-delta) });
  if (finale) targets.push({ type: "itemUses", target: "", value: "1" });
  return {
    activation: { type: activation, value: activation === "special" ? 0 : 1, override: true },
    consumption: { targets, spellSlot: false, scaling: { allowed: false, max: "" } }
  };
}
export async function jesterRelationDelta(actor, source, target, beneficial, amount = 1) {
  let relation =
    target.uuid === source.uuid
      ? "ally"
      : await askOwner(jesterGm(actor), {
          title: "Сторона цели в текущей сцене (GM)",
          choices: [
            ["ally", "Союзник"],
            ["enemy", "Враг"],
            ["neutral", "Нейтральное существо"]
          ]
        });
  if (!relation) return null;
  if (relation === "neutral") {
    const override = await askOwner(jesterGm(actor), {
      title: "Нейтральная цель: решение GM",
      choices: [
        ["none", "Не менять запас"],
        ["cost", "Эффект явно помогает своей стороне: расход"],
        ["gain", "Эффект явно вредит своей стороне: получение"]
      ]
    });
    return override === "none" ? 0 : override === "cost" ? -amount : override === "gain" ? amount : null;
  }
  return jesterChaosDelta(relation, beneficial, amount);
}
export async function offerJesterMovement(actor, source, target, delta) {
  if (!delta || jesterLevel(actor) < 3 || !findFeature(actor, "jester-mise")) return false;
  const choices = [
    ...new Map(
      [source, ...[target].flat()].filter(t => t?.actor && t.parent?.id === source.parent.id).map(t => [t.uuid, t])
    ).values()
  ];
  const picked = await askOwner(actor, {
    title: `Мизансцена: ${delta > 0 ? 15 : 10} футов`,
    choices: [
      ["none", "Не перемещаться"],
      ...choices.map(t => [t.uuid, t.uuid === source.uuid ? "Сам Арлекин" : (t.name ?? t.actor.name)])
    ]
  });
  if (!picked || picked === "none") return false;
  notify(
    `Мизансцена: переместите выбранное существо до ${delta > 0 ? 15 : 10} футов в свободное видимое место, без атак возможности этого перемещения. Другие перемещения не изменены.`
  );
  return true;
}
async function chooseTarget(actor, item, source, { hearing = false } = {}) {
  const selected = await chooseSceneTokens(actor, source.parent, {
    title: item.name,
    min: 1,
    max: 1,
    relation: t => inFeet(source, t, 60, source.parent)
  });
  if (
    !selected?.length ||
    !(await confirmOwner(
      actor,
      item.name,
      hearing ? "Выбранная цель слышит вас и находится в 60 футах?" : "Вы видите эту цель в 60 футах?"
    ))
  )
    return null;
  return selected[0];
}
const validTarget = (source, target, feet = 60) =>
  Boolean(target?.actor && source.parent.id === target.parent?.id && inFeet(source, target, feet, source.parent));
async function completedChange(actor, source, target, delta, { gain = true } = {}) {
  const actual = delta > 0 ? (gain ? await changeJesterChaos(actor, delta) : 0) : delta;
  await offerJesterMovement(actor, source, target, actual);
  return true;
}
async function useRetort(actor, activity, source, requestId) {
  const target = await chooseTarget(actor, activity.item, source, { hearing: true });
  if (!target) return false;
  const mode = await askOwner(actor, {
    title: "Острая реплика",
    choices: [
      ["encourage", "Подбодрить: временные хиты"],
      ["sting", "Уязвить: психический урон"]
    ]
  });
  if (!mode) return false;
  const amount = await askOwner(actor, {
    kind: "number",
    title: "Количество к6/очков хаоса",
    min: 1,
    max: jesterMaximum(jesterLevel(actor)),
    defaultValue: 1
  });
  if (!Number.isInteger(amount) || amount < 1 || amount > jesterMaximum(jesterLevel(actor))) return false;
  const delta = await jesterRelationDelta(actor, source, target, mode === "encourage", amount);
  if (delta == null || !validTarget(source, target)) return false;
  if (mode === "sting" && jesterDC(actor) == null) throw Error("Сначала выберите Характеристику хаоса.");
  const expense = jesterExpense(activity, { delta, activation: "bonus" }),
    oldTemp = Number(target.actor.system.attributes.hp.temp ?? 0);
  return applyNativeOnce(
    actor,
    { requestId, action: "jester-retort", activityUuid: activity.uuid },
    () => useNativeUtility(activity, { dataPatch: expense }),
    async () => {
      let gain = true;
      if (mode === "sting") {
        const result = await useAuraPulse({
          scene: source.parent,
          sourceToken: object(source),
          sourceItem: activity.item,
          targets: [object(target)],
          eventKey: `${requestId}:sting`,
          event: {
            save: "wis",
            dc: String(jesterDC(actor)),
            damage: [{ formula: `${amount}d6`, type: "psychic" }],
            onSave: "half",
            returnSaveOutcome: true
          }
        });
        if (result?.status !== "success") return { status: "needs-review" };
        gain = result.failedSaves.includes(target.uuid);
        if (
          delta > 0 &&
          gain &&
          !(await confirmOwner(
            jesterGm(actor),
            "Получение хаоса после Уязвить (GM)",
            "Цель провалила спасбросок. Подтверждено применение именно этого психического урона через Midi или вручную, с учётом иммунитета? Только теперь получить очки хаоса."
          ))
        )
          return { status: "needs-review" };
      } else {
        const data = activity.toObject();
        Object.assign(data, {
          type: "heal",
          activation: { type: "special", value: 0, override: true },
          consumption: { targets: [], spellSlot: false },
          healing: areaDamagePart({ formula: `${amount}d6`, type: "temphp" }),
          range: { value: 60, units: "ft", override: true },
          target: { template: { type: "" }, affects: { type: "creature", count: "1" }, override: true, prompt: false }
        });
        delete data.roll;
        data.flags = {
          ...data.flags,
          [MODULE_ID]: { action: "", moduleAction: "", leaderResolved: true, jesterResolved: true }
        };
        const clone = activity.item.clone({ system: { activities: { [activity.id]: data } } }, { keepId: true });
        const native = await MidiQOL.completeActivityUse(
          clone.system.activities.get(activity.id),
          {
            consume: { resources: false, spellSlot: false, action: false },
            create: { measuredTemplate: false },
            midiOptions: {
              targetUuids: [target.uuid],
              workflowOptions: { ignoreUserTargets: true, targetConfirmation: "none" }
            }
          },
          { configure: false }
        );
        if (native === false || native?.aborted || native == null) return { status: "needs-review" };
        const newTemp = Number(target.actor.system.attributes.hp.temp ?? 0),
          packet = (native?.workflow ?? native).damageList?.find(
            row =>
              (row.tokenUuid === target.uuid || row.actorUuid === target.actor.uuid) &&
              Number(row.oldTempHP) === oldTemp &&
              Number(row.newTempHP) === newTemp
          );
        gain = newTemp > oldTemp && Boolean(packet);
        if (delta > 0 && !packet) {
          notify(
            "Получение хаоса ожидает подтверждения применения временных хитов; проверьте результат Midi с GM.",
            "warn"
          );
          return { status: "needs-review" };
        }
        if (delta > 0 && !gain && newTemp <= oldTemp)
          notify(
            "Очки хаоса не получены: новый временный запас не подтверждён. Если применение ожидает ручного подтверждения Midi, проверьте итог с GM.",
            "warn"
          );
      }
      return completedChange(actor, source, target, delta, { gain });
    }
  );
}
async function useRollCorrection(actor, activity, source, operation, requestId) {
  const target = await chooseTarget(actor, activity.item, source);
  if (!target) return false;
  const modes =
    operation === "correction"
      ? [
          ["remove-adv", "Отменить преимущество"],
          ["remove-dis", "Отменить помеху"]
        ]
      : operation === "finale"
        ? [
            ["one", "Заменить к20 на 1"],
            ["twenty", "Заменить к20 на 20"]
          ]
        : [
            ["plus", "Добавить кость"],
            ["minus", "Вычесть кость"],
            ...(jesterLevel(actor) >= 5 && findFeature(actor, "jester-improvisation")
              ? [["improv", "Импровизация: знак по чётности к6"]]
              : [])
          ];
  const choice = await askOwner(actor, { title: activity.item.name, choices: modes });
  if (!modes.some(([key]) => key === choice)) return false;
  if (
    !(await confirmOwner(
      jesterGm(actor),
      "Конкретный бросок (GM)",
      operation === "correction"
        ? "Это ещё НЕ сделанный подходящий бросок с указанным преимуществом/помехой; измените только его режим после расхода?"
        : "Это уже сделанный бросок атаки/проверки/спасброска к20, результат ещё НЕ объявлен; изменение относится только к нему?"
    ))
  )
    return false;
  const beneficial = ["plus", "twenty", "remove-dis"].includes(choice),
    delta =
      choice === "improv"
        ? 0
        : await jesterRelationDelta(actor, source, target, beneficial, operation === "finale" ? 3 : 1);
  if (delta == null || !validTarget(source, target)) return false;
  const activation = operation === "correction" ? "reaction" : "special";
  if (activation === "reaction" && !canReact(actor)) return false;
  const expense = jesterExpense(activity, { delta, activation, finale: operation === "finale" });
  return applyNativeOnce(
    actor,
    { requestId, action: `jester-${operation}`, activityUuid: activity.uuid },
    () => useNativeUtility(activity, { dataPatch: expense }),
    async () => {
      if (activation === "reaction") await recordModuleReaction(actor, source.parent);
      let text;
      if (operation === "impromptu") {
        const roll = await new Roll(`1d${choice === "improv" ? 6 : jesterImpromptuDie(jesterLevel(actor))}`).evaluate(),
          sign = choice === "improv" ? (roll.total % 2 === 0 ? 1 : -1) : choice === "plus" ? 1 : -1;
        await roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor }),
          flavor: `${activity.item.name}: ${sign > 0 ? "+" : "−"}${roll.total} к конкретному исходному броску; GM подтверждает его изменение`
        });
        text = `${sign > 0 ? "+" : "−"}${roll.total}`;
      } else
        text =
          operation === "finale"
            ? `к20 → ${choice === "one" ? 1 : 20}`
            : choice === "remove-adv"
              ? "отменить преимущество"
              : "отменить помеху";
      if (
        !(await confirmOwner(
          jesterGm(actor),
          "Применение правки (GM)",
          `Подтвердить изменение именно исходного броска: ${text}? При необходимости обновите попадание/спасбросок/крит в Midi, не только текст в чате.`
        ))
      )
        return { status: "needs-review" };
      return completedChange(actor, source, target, delta);
    }
  );
}
export function jesterSwapUpdates(left, right) {
  const grid = Number(left.parent.grid.size),
    center = t => ({ x: Number(t.x) + (Number(t.width) * grid) / 2, y: Number(t.y) + (Number(t.height) * grid) / 2 }),
    a = center(left),
    b = center(right);
  return [
    {
      _id: left.id,
      x: b.x - (Number(left.width) * grid) / 2,
      y: b.y - (Number(left.height) * grid) / 2,
      elevation: right.elevation ?? 0
    },
    {
      _id: right.id,
      x: a.x - (Number(right.width) * grid) / 2,
      y: a.y - (Number(right.height) * grid) / 2,
      elevation: left.elevation ?? 0
    }
  ];
}
export async function planJesterSwaps(actor, group) {
  const remaining = [...group],
    pairs = [];
  let gmTurn = true;
  while (remaining.length >= 2) {
    const owner = gmTurn ? jesterGm(actor) : actor,
      pair = await askOwner(owner, {
        kind: "checkbox",
        title: gmTurn ? "Смена декораций: пара GM" : "Смена декораций: пара Арлекина",
        choices: remaining.map(t => [t.uuid, t.name ?? t.actor.name]),
        min: 2,
        max: 2
      });
    if (
      !pair ||
      pair.length !== 2 ||
      new Set(pair).size !== 2 ||
      pair.some(uuid => !remaining.some(t => t.uuid === uuid))
    )
      return null;
    pairs.push(pair);
    for (const uuid of pair)
      remaining.splice(
        remaining.findIndex(t => t.uuid === uuid),
        1
      );
    gmTurn = !gmTurn;
  }
  if (remaining.length) {
    const last = remaining[0],
      other = await askOwner(jesterGm(actor), {
        title: "Последнее нечётное существо: партнёр GM",
        choices: group.filter(t => t.uuid !== last.uuid).map(t => [t.uuid, t.name ?? t.actor.name])
      });
    if (!group.some(t => t.uuid === other && t.uuid !== last.uuid)) return null;
    pairs.push([last.uuid, other]);
  }
  return pairs;
}
async function useScenery(actor, activity, source, requestId) {
  const group = await chooseSceneTokens(actor, source.parent, {
    title: "Все видимые существа в 20 футах, включая Арлекина",
    min: 2,
    max: Math.max(2, [...source.parent.tokens].length),
    relation: t => inFeet(source, t, 20, source.parent)
  });
  if (
    !group?.some(t => t.uuid === source.uuid) ||
    group.length < 2 ||
    !(await confirmOwner(
      jesterGm(actor),
      "Смена декораций (GM)",
      "В группу включены ВСЕ видимые Арлекину существа в 20 футах, включая его самого?"
    ))
  )
    return false;
  const pairs = await planJesterSwaps(actor, group);
  if (!pairs || !group.every(t => validTarget(source, t, 20))) return false;
  const placement = () =>
    JSON.stringify(group.map(t => [t.uuid, t.parent.id, t.x, t.y, t.width, t.height, t.elevation]));
  const approved = placement();
  if (
    !(await confirmOwner(
      jesterGm(actor),
      "Размещение (GM)",
      "Разрешены все обмены? Проверьте границы сцены, размеры, занятые клетки и особые запреты телепортации. При разных размерах обмениваются центры токенов."
    ))
  )
    return false;
  if (placement() !== approved) {
    notify("Положения существ изменились во время выбора. Согласуйте обмены заново; ресурс не потрачен.", "warn");
    return false;
  }
  const expense = jesterExpense(activity, { delta: -1, activation: "action" });
  return applyNativeOnce(
    actor,
    { requestId, action: "jester-scenery", activityUuid: activity.uuid },
    () => useNativeUtility(activity, { dataPatch: expense }),
    async () => {
      if (placement() !== approved)
        throw Error(
          "Положения изменились после объявления. Обмены не выполнены; подтверждённый расход проверьте с GM."
        );
      for (const [a, b] of pairs) {
        const left = await fromUuid(a),
          right = await fromUuid(b);
        if (!left || !right || left.parent.id !== source.parent.id || right.parent.id !== source.parent.id)
          throw Error("Часть существ удалена или сменила сцену; проверьте уже выполненные обмены.");
        await source.parent.updateEmbeddedDocuments("Token", jesterSwapUpdates(left, right), {
          animate: false,
          teleport: true
        });
      }
      const adjustment = await askOwner(jesterGm(actor), {
        title: "Итог Смены декораций: однократная поправка",
        choices: [
          ["none", "Без изменения"],
          ["cost", "Выгодный своей стороне: потратить ещё 1"],
          ["gain", "Невыгодный своей стороне: получить 1"]
        ]
      });
      await offerJesterMovement(actor, source, group, -1);
      if (adjustment === "gain") await offerJesterMovement(actor, source, group, await changeJesterChaos(actor, 1));
      if (adjustment === "cost") {
        if (jesterPoints(actor) >= 1)
          await offerJesterMovement(actor, source, group, await changeJesterChaos(actor, -1));
        else
          notify(
            "Дополнительная поправка GM потребовала очко при пустом запасе; разрешите это противоречие вручную. Запас не ушёл ниже 0.",
            "warn"
          );
      }
      return true;
    }
  );
}
registerGmRequest("jester-action", (actor, data, { requestId }) =>
  serialMutation(`jester-action:${actor.uuid}`, async () => {
    if (!enabled() || !isGmAuthority()) return false;
    const previous = nativeApplicationReply(actor, requestId);
    if (previous) return previous;
    const activity = await fromUuid(data.activityUuid),
      source = await fromUuid(data.sourceUuid);
    if (
      activity?.actor?.uuid !== actor.uuid ||
      source?.actor?.uuid !== actor.uuid ||
      !jesterAvailable(actor, activity.item) ||
      canvas.scene?.id !== source.parent.id ||
      !canvas.ready
    )
      return false;
    const operation = automationData(activity).jesterOperation;
    if (operation === "retort") return useRetort(actor, activity, source, requestId);
    if (operation === "scenery") return useScenery(actor, activity, source, requestId);
    if (["impromptu", "correction", "finale"].includes(operation))
      return useRollCorrection(actor, activity, source, operation, requestId);
    return false;
  })
);
const pending = new Map();
export function controlJester(actor, activity) {
  const key = `${actor.uuid}:${activity.id}`;
  if (pending.has(key)) return pending.get(key);
  const operation = automationData(activity).jesterOperation,
    type = ["ability", "role"].includes(operation)
      ? "jester-settings"
      : operation === "laughter"
        ? "jester-laughter-manual"
        : operation === "initiative"
          ? "jester-initiative-manual"
          : "jester-action";
  const task = requestGm(
    type,
    actor,
    {
      itemUuid: activity.item.uuid,
      activityUuid: activity.uuid,
      sourceUuid: sourceTokenForActor(actor)?.document.uuid,
      operation
    },
    { timeoutMs: 120000 }
  );
  pending.set(key, task);
  void task.finally(() => pending.delete(key)).catch(() => {});
  return task;
}
