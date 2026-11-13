import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, automationData, notify, findFeature } from "../shared/helpers.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { applyNativeOnce, nativeApplicationReply } from "../shared/native-applications.mjs";
import { automationActors, isEffectActive } from "../effects/temporary-effects.mjs";
import { hagAvailable, hagHas, hagState, hagDC, hagLevel, hagCharacterLevel, patchHag, syncHag } from "./hag.mjs";
import { hagGm, hagTargets, useHagCost } from "./hag-use.mjs";
import { chooseHagType, chooseHagCurses, configureHagRules, rollHagFortunes, useHagFortune } from "./hag-choices.mjs";
import { castHagCurse, removeHagCurses, repeatHagJinx } from "./hag-curses.mjs";
import { summonHagReflection, summonHagBroom, dismissHagGroup } from "./hag-summons.mjs";
import { runHagCall } from "./hag-events.mjs";
export async function linkHagVoodoo(actor, activity, source, requestId) {
  const selected = await hagTargets(hagGm(actor), source, "Цель изготовленной куклы"),
    target = selected?.[0];
  if (!target) return false;
  const records = automationActors()
    .flatMap(a => [...(a.effects ?? [])])
    .filter(e => e.getFlag?.(MODULE_ID, "hagVoodoo") && isEffectActive(e));
  if (records.some(e => e.parent.uuid === target.actor.uuid)) throw Error("У этой цели уже есть действующая кукла.");
  if (
    records.filter(e => e.getFlag(MODULE_ID, "hagVoodoo").sourceActorUuid === actor.uuid).length >=
    Math.max(0, Number(actor.system.abilities.cha.mod))
  )
    throw Error("Достигнут предел кукол по Харизме.");
  if (
    !(await confirmOwner(
      hagGm(actor),
      "Изготовление куклы завершено",
      "Неделя работы и 500 зм материалов уже подтверждены и учтены? Сама кукла и передача её урона/заклинаний ведутся GM, а не дублированием произвольного Midi-потока."
    ))
  )
    return false;
  const penalty = await askOwner(hagGm(actor), {
    kind: "number",
    title: "Штраф CHA за части тела (0 без части, −5 за одну)",
    min: 0,
    max: 100,
    defaultValue: 0
  });
  if (!Number.isInteger(penalty)) return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "hag-voodoo", activityUuid: activity.uuid },
    async () => {
      const rolls = await target.actor.rollSavingThrow(
        { ability: "cha", target: hagDC(actor), rolls: [{ parts: penalty ? [String(-penalty)] : [] }] },
        { configure: false }
      );
      return rolls?.length ? { saved: Number(rolls[0].total) >= hagDC(actor) } : false;
    },
    async r => {
      if (r.saved) return true;
      await target.actor.createEmbeddedDocuments("ActiveEffect", [
        {
          name: `Кукла Вуду: ${actor.name}`,
          img: activity.item.img,
          type: "base",
          transfer: false,
          disabled: false,
          statuses: [],
          origin: activity.item.uuid,
          start: null,
          duration: { value: null, units: "seconds", expiry: null, expired: false },
          flags: {
            [MODULE_ID]: {
              hagVoodoo: {
                sourceActorUuid: actor.uuid,
                targetActorUuid: target.actor.uuid,
                hp: 50,
                createdAt: Number(game.time.worldTime)
              }
            }
          },
          system: { changes: [] }
        }
      ]);
      return true;
    }
  );
}
registerGmRequest("hag-action", (actor, data, { requestId }) =>
  serialMutation(`hag-action:${actor.uuid}`, async () => {
    if (!enabled() || !isGmAuthority()) return false;
    const old = nativeApplicationReply(actor, requestId);
    if (old) return old;
    const activity = await fromUuid(data.activityUuid);
    if (activity?.actor?.uuid !== actor.uuid || !hagAvailable(actor, activity.item)) return false;
    const op = automationData(activity).hagOperation;
    if (op === "status") {
      notify(`Ведьма ${hagLevel(actor)}, Сл ${hagDC(actor)}, тип ${hagState(actor).type ?? "не выбран"}.`);
      return true;
    }
    if (op === "type") return chooseHagType(actor);
    if (op === "curses") return chooseHagCurses(actor);
    if (op === "fortune") return rollHagFortunes(actor, { requestId });
    if (op === "rules") return configureHagRules(actor);
    if (["home", "hunger", "cauldron"].includes(op)) {
      const field = { home: "home", hunger: "hungry", cauldron: "cauldron" }[op],
        value = await askOwner(hagGm(actor), {
          title: {
            home: "Ведьма находится в родном царстве?",
            hunger: "Не выполнено условие Бабы-Яги?",
            cauldron: "Котёл изготовлен за четыре недели и 500 зм?"
          }[op],
          choices: [
            ["yes", "Да"],
            ["no", "Нет"]
          ]
        });
      if (!["yes", "no"].includes(value)) return false;
      await patchHag(actor, { [field]: value === "yes" });
      await syncHag(actor);
      return true;
    }
    if (op === "reveal" || op === "guise") {
      if (
        op === "guise" &&
        (actor.statuses?.has?.("unconscious") ||
          actor.concentration?.effects?.size ||
          (hagHas(actor, "hunger") && hagState(actor).hungry))
      )
        throw Error("Сейчас скрыть облик нельзя.");
      await patchHag(actor, { appearance: op === "guise" ? "humanoid" : "true" });
      return true;
    }
    if (op === "restore-hex") {
      if (
        !(await confirmOwner(
          hagGm(actor),
          "Восстановить Наговор",
          "GM подтверждает восстановление после LR либо служебное исправление? Это не свободная перезарядка в бою."
        ))
      )
        return false;
      await activity.item.update({ "system.uses.spent": 0 });
      return true;
    }
    const source = await fromUuid(data.sourceUuid);
    if (source?.actor?.uuid !== actor.uuid || !canvas.ready || canvas.scene?.id !== source.parent.id)
      throw Error("Выберите токен Ведьмы; активный GM должен открыть его сцену до расхода.");
    if (op === "curse") return castHagCurse(actor, activity, source, requestId);
    if (op === "remove-curse") {
      const selected = await hagTargets(hagGm(actor), source, "Цель подтверждённого снятия проклятия", { self: true });
      if (
        !selected?.length ||
        !(await confirmOwner(
          hagGm(actor),
          "Снять проклятие",
          "Снятие проклятия или аналогичный эффект действительно применён? Это не бесплатная способность Ведьмы."
        ))
      )
        return false;
      await removeHagCurses(selected[0].actor);
      return true;
    }
    if (op === "repeat-jinx") return repeatHagJinx(actor, source);
    if (op === "use-fortune") return useHagFortune(actor, source, requestId);
    if (op === "hex-save") {
      const selected = await hagTargets(hagGm(actor), source, "Цель конкретного спасброска"),
        target = selected?.[0];
      if (!target) return false;
      return applyNativeOnce(
        actor,
        { requestId, action: "hag-hex-save", activityUuid: activity.uuid },
        async () => {
          if (
            !(await confirmOwner(
              hagGm(actor),
              "Наговор: один спасбросок",
              "Этот источник заставляет выбранную цель совершить конкретный спасбросок? GM применит −к6 именно к нему, не постоянный штраф ко всем спасам."
            ))
          )
            return false;
          return useHagCost(activity, { cost: 1, activation: "special" });
        },
        async () => {
          const roll = await new Roll("1d6").evaluate();
          await roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor }),
            flavor: `Наговор: GM вычитает результат из одного спасброска выбранной цели`
          });
          return true;
        }
      );
    }
    if (op === "reflection") return summonHagReflection(actor, activity, source, requestId);
    if (op === "broom") return summonHagBroom(actor, activity, source, requestId);
    if (op === "end-reflection") return dismissHagGroup(actor, "reflection");
    if (op === "dismiss-broom") {
      if (
        !(await confirmOwner(
          hagGm(actor),
          "Удалить собственную метлу",
          "GM разрешает убрать метлу без взрыва; это служебная очистка, не новое право по PDF?"
        ))
      )
        return false;
      return dismissHagGroup(actor, "broom");
    }
    if (op === "voodoo") return linkHagVoodoo(actor, activity, source, requestId);
    if (op === "end-voodoo") {
      const selected = await hagTargets(hagGm(actor), source, "Цель собственной разрушенной куклы", { self: true });
      if (
        !selected?.length ||
        !(await confirmOwner(
          hagGm(actor),
          "Кукла разрушена",
          "Физическая кукла действительно разрушена или связь снята GM?"
        ))
      )
        return false;
      for (const e of [...(selected[0].actor.effects ?? [])])
        if (e.getFlag?.(MODULE_ID, "hagVoodoo")?.sourceActorUuid === actor.uuid) await e.delete();
      return true;
    }
    if (op === "call") {
      if (
        !(await confirmOwner(
          hagGm(actor),
          "Зов Ковена",
          "Подтверждена естественная 1 против магии вне поддерживаемого Midi-потока? Если урон уже разыгран автоматически, НЕ запускайте повторно."
        ))
      )
        return false;
      return applyNativeOnce(
        actor,
        { requestId, action: "hag-call-manual", activityUuid: activity.uuid },
        async () => true,
        () =>
          runHagCall({
            id: requestId,
            sourceTokenUuid: source.uuid,
            sourceItemUuid: activity.item.uuid,
            dice: Math.floor(hagCharacterLevel(actor) / 2)
          })
      );
    }
    return false;
  })
);
const pending = new Map();
export function controlHag(actor, activity) {
  const key = `${actor.uuid}:${activity.uuid}`;
  if (pending.has(key)) return pending.get(key);
  const source =
    canvas.tokens?.controlled?.map(t => t.document).find(t => t.actor?.uuid === actor.uuid) ??
    canvas.tokens?.placeables?.map(t => t.document).find(t => t.actor?.uuid === actor.uuid);
  const task = requestGm(
    "hag-action",
    actor,
    { activityUuid: activity.uuid, sourceUuid: source?.uuid },
    { timeoutMs: 180000 }
  ).finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}
