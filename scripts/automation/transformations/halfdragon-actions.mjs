import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, automationData, notify } from "../shared/helpers.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { applyNativeOnce, nativeApplicationReply } from "../shared/native-applications.mjs";
import { areaDamagePart } from "../shared/area-definitions.mjs";
import { hdAvailable, hdAncestry, hdState, hdPatch, hdHas, hdDC, hdLevel, syncHalfdragon } from "./halfdragon.mjs";
import { hdGm, hdTargets, hdExpense, useHdCost, hdCondition } from "./halfdragon-use.mjs";
import { chooseHalfdragonAncestry, configureHalfdragon, adaptHalfdragonGear } from "./halfdragon-choices.mjs";
import { halfdragonBreath, halfdragonFundamentum, halfdragonRoar } from "./halfdragon-areas.mjs";
import { halfdragonAttack } from "./halfdragon-combat.mjs";
import { summonHalfdragonLiving, dismissHalfdragonLiving } from "./halfdragon-summons.mjs";
import { syncHalfdragonLight } from "./halfdragon-events.mjs";

export async function recoverHalfdragon(actor, activity, source, requestId) {
  if (!hdHas(actor, "descendant") || Number(actor.system.attributes.hp.value) !== 0) return false;
  hdExpense(activity, { cost: 1 });
  return applyNativeOnce(
    actor,
    { requestId, action: "halfdragon-recover", activityUuid: activity.uuid },
    async () => {
      if (
        !(await confirmOwner(
          actor,
          "Потомки Богов",
          "Потратить единственное применение до LR и восстановить половину максимума HP? Мгновенную смерть/ручные состояния проверяет GM."
        ))
      )
        return false;
      const data = {
        ...activity.toObject(),
        ...hdExpense(activity, { cost: 1, activation: "special" }),
        type: "heal",
        healing: areaDamagePart({
          formula: String(
            Math.floor(Number(actor.system.attributes.hp.effectiveMax ?? actor.system.attributes.hp.max) / 2)
          ),
          type: "healing"
        }),
        target: { template: { type: "" }, affects: { type: "self" }, prompt: false, override: true },
        range: { units: "self", override: true },
        flags: { [MODULE_ID]: { halfdragonResolved: true, action: "" } }
      };
      const a = activity.item
        .clone({ system: { activities: { [activity.id]: data } } }, { keepId: true })
        .system.activities.get(activity.id);
      return MidiQOL.completeActivityUse(
        a,
        {
          midiOptions: {
            targetUuids: [source.uuid],
            workflowOptions: { allowIncapacitated: true, ignoreUserTargets: true, targetConfirmation: "none" }
          }
        },
        { configure: false }
      );
    },
    async () => true
  );
}
export async function castHalfdragonShape(actor, activity, requestId) {
  const spells = [...(actor.items ?? [])].filter(i => i.type === "spell" && i.system.identifier === "shapechange");
  if (!spells.length)
    throw Error("Добавьте настоящую карточку «Изменение формы / Shapechange» из установленного источника.");
  const spell = spells[0],
    choices = [...spell.system.activities.values()],
    id =
      choices.length === 1
        ? choices[0].id
        : await askOwner(actor, { title: "Активность Shapechange", choices: choices.map(a => [a.id, a.name]) }),
    cast = choices.find(a => a.id === id);
  if (
    !cast ||
    !(await confirmOwner(
      hdGm(actor),
      "Shapechange: только драконы",
      "Выбрана допустимая форма дракона? Сохраняются ограничения УС, концентрация и прочие правила настоящего заклинания."
    ))
  )
    return false;
  const data = cast.toObject();
  data.consumption = hdExpense(activity, { cost: 1 }).consumption;
  data.flags = { [MODULE_ID]: { halfdragonResolved: true, action: "" } };
  const a = spell
    .clone({ system: { activities: { [cast.id]: data } } }, { keepId: true })
    .system.activities.get(cast.id);
  return applyNativeOnce(
    actor,
    { requestId, action: "halfdragon-shape", activityUuid: activity.uuid },
    () =>
      MidiQOL.completeActivityUse(
        a,
        { consume: { spellSlot: false }, midiOptions: { workflowOptions: { halfdragonResolved: true } } },
        { configure: false }
      ),
    async () => true
  );
}
registerGmRequest("halfdragon-action", (actor, data, { requestId }) =>
  serialMutation(`halfdragon-action:${actor.uuid}`, async () => {
    if (!enabled() || !isGmAuthority()) return false;
    const old = nativeApplicationReply(actor, requestId);
    if (old) return old;
    const activity = await fromUuid(data.activityUuid);
    if (activity?.actor?.uuid !== actor.uuid || !hdAvailable(actor, activity.item)) return false;
    const op = automationData(activity).halfdragonOperation;
    if (op === "status") {
      notify(`Дракон ${hdLevel(actor)}; Сл ${hdDC(actor)}; происхождение: ${hdState(actor).ancestry ?? "не выбрано"}.`);
      return true;
    }
    if (op === "ancestry") return chooseHalfdragonAncestry(actor);
    if (op === "rules") return configureHalfdragon(actor);
    if (op === "wing-gear") return adaptHalfdragonGear(actor);
    if (op === "scales") {
      const choice = await askOwner(actor, {
        title: "Использовать драконью базовую формулу КД?",
        choices: [
          ["yes", "13 + ЛОВ + ХАР"],
          ["no", "Другая формула листа"]
        ]
      });
      if (!["yes", "no"].includes(choice)) return false;
      await hdPatch(actor, { scalesEnabled: choice === "yes" });
      await syncHalfdragon(actor);
      return true;
    }
    if (op === "guise" || op === "reveal") {
      if (op === "guise" && (actor.statuses?.has?.("unconscious") || actor.concentration?.effects?.size))
        throw Error("Сейчас скрыть истинную форму нельзя.");
      await hdPatch(actor, { appearance: op === "guise" ? "humanoid" : "true" });
      return true;
    }
    if (op === "restore-breath") {
      if (
        !(await confirmOwner(
          hdGm(actor),
          "Восстановление пула Дыхания",
          "GM подтверждает завершённый короткий/продолжительный отдых либо служебное исправление? Это не свободная перезарядка."
        ))
      )
        return false;
      await activity.item.update({ "system.uses.spent": 0 });
      return true;
    }
    if (op === "greed") {
      if (hdHas(actor, "insatiable")) {
        notify("Ненасытная Жадность запрещает расстаться с ценностью; успешный WIS не обходит её.", "warn");
        return false;
      }
      if (
        !(await confirmOwner(
          hdGm(actor),
          "Проверка Жадности",
          "Это конкретная передача ценности без выгодного обмена?"
        ))
      )
        return false;
      return actor.rollSavingThrow({ ability: "wis", target: 16 }, { configure: false });
    }
    if (op === "sangromancy") {
      notify("Сангромантия предлагается при размещении Дыхания; отдельное повторное списание пяти HD не выполняется.");
      return true;
    }
    const source = await fromUuid(data.sourceUuid);
    if (source?.actor?.uuid !== actor.uuid || !canvas.ready || canvas.scene?.id !== source.parent.id)
      throw Error("Выберите токен Дракона; активный GM должен открыть его сцену до расхода.");
    if (op === "breath") return halfdragonBreath(actor, activity, source, requestId);
    if (op === "fundamentum") return halfdragonFundamentum(actor, activity, source, requestId);
    if (op === "roar") return halfdragonRoar(actor, activity, source, requestId);
    if (op === "claws" || op === "bite") return halfdragonAttack(actor, activity, source, op, requestId);
    if (op === "living") return summonHalfdragonLiving(actor, activity, source, requestId);
    if (op === "dismiss-living") return dismissHalfdragonLiving(actor);
    if (op === "polymorph") return castHalfdragonShape(actor, activity, requestId);
    if (op === "recover") return recoverHalfdragon(actor, activity, source, requestId);
    if (op === "end-fundamentum")
      return applyNativeOnce(
        actor,
        { requestId, action: "halfdragon-end-fundamentum", activityUuid: activity.uuid },
        () => useHdCost(activity, { activation: hdAncestry(actor)?.family === "chromatic" ? "bonus" : "special" }),
        async () => {
          for (const a of [actor, ...new Set([...source.parent.tokens].map(t => t.actor))])
            for (const e of [...(a.effects ?? [])]) {
              const c = e.getFlag?.(MODULE_ID, "halfdragonCondition");
              if (c?.sourceActorUuid === actor.uuid && ["grasp", "element-armor"].includes(c.kind)) await e.delete();
            }
          return true;
        }
      );
    if (op === "wake") {
      const selected = await hdTargets(actor, source, 5, "Разбудить цель действием"),
        t = selected?.[0],
        e = t?.actor.effects.find(e => e.getFlag?.(MODULE_ID, "halfdragonCondition")?.kind === "sleep");
      if (!e) return false;
      return applyNativeOnce(
        actor,
        { requestId, action: "halfdragon-wake", activityUuid: activity.uuid },
        () => useHdCost(activity),
        async () => {
          await e.delete();
          return true;
        }
      );
    }
    if (op === "guard")
      return applyNativeOnce(
        actor,
        { requestId, action: "halfdragon-guard", activityUuid: activity.uuid },
        () => useHdCost(activity, { cost: 1 }),
        async () => {
          for (const e of [...actor.effects]) if (e.getFlag?.(MODULE_ID, "halfdragonGuard")) await e.delete();
          const e = await hdCondition(source, source, activity.item, { kind: "guard", seconds: 60 });
          await e.setFlag(MODULE_ID, "halfdragonGuard", true);
          await syncHalfdragonLight(source);
          return true;
        }
      );
    return false;
  })
);
const pending = new Map();
export function controlHalfdragon(actor, activity) {
  const key = `${actor.uuid}:${activity.uuid}`;
  if (pending.has(key)) return pending.get(key);
  const source =
    canvas.tokens?.controlled?.map(t => t.document).find(t => t.actor?.uuid === actor.uuid) ??
    canvas.tokens?.placeables?.map(t => t.document).find(t => t.actor?.uuid === actor.uuid);
  const task = requestGm(
    "halfdragon-action",
    actor,
    { activityUuid: activity.uuid, sourceUuid: source?.uuid },
    { timeoutMs: 180000 }
  ).finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}
