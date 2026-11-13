import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, automationData, notify } from "../shared/helpers.mjs";
import { FACTORY_AUGMENTS } from "../shared/factory-augments.mjs";
import {
  factoryAvailable,
  factoryState,
  factoryLevel,
  factoryDC,
  factoryRecords,
  factoryAugment,
  patchFactory,
  factoryAscended
} from "./factory.mjs";
import { syncFactory, factoryChange } from "./factory-passives.mjs";
import { factoryGm, factoryExpense } from "./factory-use.mjs";
import { chooseFactoryForm, ascendFactory, endFactoryAscension, factoryTransfer } from "./factory-forms.mjs";
import { installFactoryUpgrade, removeFactoryUpgrade } from "./factory-installation.mjs";
import { createFactoryHomunculus, dismissFactoryHomunculus } from "./factory-homunculi.mjs";
import { factoryArc, factoryStomp, factoryThreatReport } from "./factory-areas.mjs";
import { castFactorySpell } from "./factory-spells.mjs";
import { runFactoryFortitude } from "./factory-defense.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import { useNativeUtility } from "../shared/native-actions.mjs";
import { applyNativeOnce, nativeApplicationReply } from "../shared/native-applications.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { temporaryEffectTiming } from "../effects/temporary-effects.mjs";
import { combatForScene } from "../shared/combat-benefits.mjs";

export async function rechargeFactoryArc(actor) {
  if (factoryState(actor).arcReady !== false) return false;
  const roll = await new Roll("1d6").evaluate();
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: "Электрическая дуга: перезарядка на 6" });
  if (Number(roll.total) === 6) await patchFactory(actor, { arcReady: true });
  return true;
}
export async function healFactoryHeart(actor, activity, requestId) {
  return applyNativeOnce(
    actor,
    { requestId, action: "factory-heart", activityUuid: activity.uuid },
    () => useNativeUtility(activity, { dataPatch: factoryExpense(activity, { cost: 1 }) }),
    async () => {
      const hp = actor.system.attributes.hp,
        max = Number(hp.effectiveMax ?? hp.max);
      await actor.update({ "system.attributes.hp.value": Math.min(max, Number(hp.value) + Math.floor(max / 2)) });
      return true;
    }
  );
}

registerGmRequest("factory-action", (actor, data, { requestId }) =>
  serialMutation(`factory-action:${actor.uuid}`, async () => {
    if (!enabled() || !isGmAuthority()) return false;
    const old = nativeApplicationReply(actor, requestId);
    if (old) return old;
    const activity = await fromUuid(data.activityUuid);
    if (activity?.actor?.uuid !== actor.uuid || !factoryAvailable(actor, activity.item)) return false;
    const op = automationData(activity).factoryOperation,
      record = factoryRecords(actor).find(r => r.id === automationData(activity).factoryRecordId);
    if (op === "form") {
      const result = await chooseFactoryForm(actor);
      if (result) await syncFactory(actor);
      return result;
    }
    if (op === "status" || op === "installed") {
      notify(
        `Фабрика ${factoryLevel(actor)}, Сл ${factoryDC(actor)}. Установлено: ${
          factoryRecords(actor)
            .map(r => FACTORY_AUGMENTS.find(a => a.id === r.augmentId)?.name)
            .join(", ") || "нет"
        }.`
      );
      return true;
    }
    if (op === "end-ascension") return endFactoryAscension(actor);
    if (op === "dismiss") return dismissFactoryHomunculus(actor);
    if (op === "fortitude") {
      const amount = await askOwner(factoryGm(actor), {
        kind: "number",
        title: "GM: подтверждённый некритический, не лучистый урон до 0 HP",
        min: 1,
        max: 100000,
        defaultValue: 1
      });
      return Number.isFinite(amount) && amount > 0 ? runFactoryFortitude(actor, { amount, requestId }) : false;
    }
    if (op === "recharge-arc") {
      if (
        !(await confirmOwner(
          factoryGm(actor),
          "Перезарядка вне поддержанного боя",
          "Сейчас начало нового собственного хода и в этом ходу ещё не было броска перезарядки?"
        ))
      )
        return false;
      return rechargeFactoryArc(actor);
    }
    if (op === "repair-start") {
      if (
        !(await confirmOwner(
          actor,
          "Начать ремонт",
          "Потратить непрерывную игровую минуту на ремонт? Кости хитов и другие ресурсы сейчас не расходуются."
        ))
      )
        return false;
      await patchFactory(actor, { repairReadyAt: Number(game.time.worldTime) + 60 });
      return true;
    }
    if (op === "repair") {
      if (factoryState(actor).repairReadyAt == null || Number(game.time.worldTime) < factoryState(actor).repairReadyAt)
        throw Error("Сначала завершите игровую минуту ремонта.");
      if (
        !(await confirmOwner(
          factoryGm(actor),
          "Минута ремонта",
          "Ремонт действительно завершён без прерывания? Будет потрачена одна кость хитов, не полный короткий отдых."
        ))
      )
        return false;
      const choices = [...(actor.items ?? [])]
          .filter(i => i.type === "class" && Number(i.system.levels) > Number(i.system.hitDiceUsed ?? 0))
          .map(i => i.system.hd?.denomination ?? i.system.hitDice)
          .filter(Boolean),
        denomination = await askOwner(actor, {
          title: "Кость хитов для ремонта",
          choices: [...new Set(choices)].map(d => [d, String(d)])
        });
      if (!choices.includes(denomination)) return false;
      return applyNativeOnce(
        actor,
        { requestId, action: "factory-repair", activityUuid: activity.uuid },
        () => actor.rollHitDie({ denomination }, { configure: true }),
        async () => true
      );
    }
    if (op === "heart") return healFactoryHeart(actor, activity, requestId);
    if (["auto-save", "defense", "attenuation", "bleed", "push", "inertia", "drive", "grounding"].includes(op)) {
      const text = record
        ? FACTORY_AUGMENTS.find(a => a.id === record.augmentId)?.text
        : "Ответный разряд предлагается после подтверждённого электрического урона Midi.";
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        whisper: [...game.users].filter(u => u.isGM || actor.testUserPermission(u, "OWNER")).map(u => u.id),
        content: `<p>${foundry.utils.escapeHTML(text ?? "")}</p><p>Спорный контекст и не заданные источником сроки — решение GM. Инструкция сама не тратит ресурс и не создаёт общий бонус.</p>`
      });
      return true;
    }
    if (op === "keys") {
      if (
        !(await confirmOwner(
          factoryGm(actor),
          "Скелет-ключи",
          "Бросьте нативную проверку воровских инструментов, добавив показанный модификатор создателя; не добавляйте его второй раз, если уже включён."
        ))
      )
        return false;
      const { factoryContext } = await import("./factory.mjs");
      notify(`Скелет-ключи: дополнительный модификатор ${factoryContext(actor, record).int}.`);
      return true;
    }
    if (op === "agility-reset") {
      if (
        !(await confirmOwner(
          factoryGm(actor),
          "Улучшенная ловкость",
          "Завершён целый собственный ход с перемещением ровно 0 футов?"
        ))
      )
        return false;
      await patchFactory(actor, { agilitySpent: false });
      return true;
    }
    const source = await fromUuid(data.sourceUuid);
    if (source?.actor?.uuid !== actor.uuid || !canvas.ready || canvas.scene?.id !== source.parent.id)
      throw Error("Выберите свой токен; активный GM должен открыть его сцену до расхода.");
    if (op === "install") return installFactoryUpgrade(actor, activity, source, requestId);
    if (op === "remove") return removeFactoryUpgrade(actor, source);
    if (op === "arc") return factoryArc(actor, activity, source, requestId);
    if (op === "create") return createFactoryHomunculus(actor, activity, source, requestId);
    if (["transfer", "restore-body"].includes(op)) return factoryTransfer(actor, source, op);
    if (op === "ascend") return ascendFactory(actor, activity, source, requestId);
    if (["lightning-bolt", "dominate-construct"].includes(op) && !factoryAscended(actor))
      throw Error("Нужна действующая форма энергии.");
    if (op === "spell" || ["lightning-bolt", "dominate-construct"].includes(op))
      return castFactorySpell(actor, activity, source, record, requestId, op);
    if (op === "stomp") return factoryStomp(actor, activity, source, record, requestId);
    if (op === "threats")
      return applyNativeOnce(
        actor,
        { requestId, action: "factory-threats", activityUuid: activity.uuid },
        () => useNativeUtility(activity, { dataPatch: factoryExpense(activity) }),
        () => factoryThreatReport(actor, source, { ...record, senses: Boolean(factoryAugment(actor, "senses")) })
      );
    if (op === "agility") {
      const combat = combatForScene(source.parent);
      if (combat?.combatant?.token?.uuid !== source.uuid || factoryState(actor).agilitySpent)
        throw Error("Нужен свой ход и восстановление после хода без движения.");
      return applyNativeOnce(
        actor,
        { requestId, action: "factory-agility", activityUuid: activity.uuid },
        async () => {
          if (
            !(await confirmOwner(
              actor,
              "Улучшенная ловкость",
              "Вы двигаетесь в свой ход; удвоить скорость до его окончания?"
            ))
          )
            return false;
          await patchFactory(actor, { agilitySpent: true });
          return true;
        },
        async () => {
          await actor.createEmbeddedDocuments("ActiveEffect", [
            {
              name: "Улучшенная ловкость: удвоенная скорость",
              type: "base",
              transfer: false,
              disabled: false,
              statuses: [],
              ...temporaryEffectTiming({ turns: 1, actor, expiry: "turnEnd" }),
              flags: { [MODULE_ID]: { factoryAgility: true } },
              system: {
                changes: ["walk", "fly", "swim", "climb", "burrow"].map(k =>
                  factoryChange(`system.attributes.movement.${k}`, 2, "multiply", "final", 50)
                )
              }
            }
          ]);
          return true;
        }
      );
    }
    if (op === "mantis-bonus" || op === "air-strike") {
      if (
        !(await confirmOwner(
          factoryGm(actor),
          activity.name,
          op === "mantis-bonus"
            ? "В свой ход выполнено действие Атака? Следующая атака богомолом будет бонусным действием."
            : "Преобразовать выбранную рукопашную атаку в дальнобойную, 30 футов?"
        ))
      )
        return false;
      const choices = [...(actor.items ?? [])].flatMap(i =>
          [...(i.system.activities?.values?.() ?? [])].filter(
            a =>
              a.type === "attack" &&
              a.attack.type.value === "melee" &&
              (op !== "mantis-bonus" || i.id === activity.item.id)
          )
        ),
        uuid = await askOwner(actor, { title: "Атака", choices: choices.map(a => [a.uuid, a.name]) }),
        attack = choices.find(a => a.uuid === uuid);
      if (!attack) return false;
      const d = attack.toObject();
      d.flags = { [MODULE_ID]: { factoryResolved: true, action: "" } };
      if (op === "air-strike") {
        d.attack.type.value = "ranged";
        d.range = { ...d.range, units: "ft", value: "30", override: true };
      } else d.activation = { type: "bonus", value: 1, override: true };
      const clone = attack.item.clone({ system: { activities: { [attack.id]: d } } }, { keepId: true });
      return applyNativeOnce(
        actor,
        { requestId, action: `factory-${op}`, activityUuid: activity.uuid },
        () =>
          MidiQOL.completeActivityUse(clone.system.activities.get(attack.id), { midiOptions: {} }, { configure: true }),
        async () => true
      );
    }
    throw Error(`Неизвестная операция Фабрики: ${op}`);
  })
);
const pending = new Map();
export function controlFactory(actor, activity) {
  const key = `${actor.uuid}:${activity.uuid}`;
  if (pending.has(key)) return pending.get(key);
  const source =
    canvas.tokens?.controlled?.map(t => t.document).find(t => t.actor?.uuid === actor.uuid) ??
    canvas.tokens?.placeables?.map(t => t.document).find(t => t.actor?.uuid === actor.uuid);
  const task = requestGm(
    "factory-action",
    actor,
    { activityUuid: activity.uuid, sourceUuid: source?.uuid },
    { timeoutMs: 180000 }
  ).finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}
