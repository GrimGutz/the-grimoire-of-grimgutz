import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, automationData, notify } from "../shared/helpers.mjs";
import { CHIMERA_ELEMENTS } from "../shared/chimera-definitions.mjs";
import {
  chimeraAvailable,
  chimeraState,
  chimeraDC,
  chimeraLevelFor,
  chimeraAdaptation,
  inspectChimera
} from "./chimera.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { applyNativeOnce, nativeApplicationReply } from "../shared/native-applications.mjs";
import { useNativeUtility } from "../shared/native-actions.mjs";
import { addCombatBenefit } from "../shared/combat-benefits.mjs";
import { encounterForScene } from "../shared/combat-flow.mjs";
import { areaDamagePart, areaActivityData } from "../shared/area-definitions.mjs";
import { useAreaActivity } from "../shared/area-activities.mjs";
import { chooseChimera, rollChimeraMutation, chimeraGm } from "./chimera-choices.mjs";
import { chimeraExpense, chimeraTargets, chimeraPulse, chimeraCondition } from "./chimera-use.mjs";
import { shareChimera } from "./chimera-sharing.mjs";

export function chimeraAttackData(activity, kind, type = "slashing") {
  const actor = activity.actor,
    data = activity.toObject(),
    limbs = kind === "limbs";
  data.type = "attack";
  delete data.roll;
  Object.assign(data, chimeraExpense(activity, { activation: limbs ? "bonus" : "action" }));
  data.attack = {
    flat: true,
    bonus: String(Number(actor.system.attributes.prof) + Number(actor.system.abilities.con.mod)),
    ability: "",
    type: { value: "melee", classification: "unarmed" }
  };
  data.damage = {
    includeBase: false,
    parts: [
      areaDamagePart({
        formula: limbs
          ? `${1 + chimeraLevelFor(actor, "menagerie")}d6 + ${Number(actor.system.abilities.con.mod)}`
          : "1d4",
        type: limbs ? type : "piercing"
      })
    ]
  };
  data.range = { value: "5", units: "ft", override: true };
  data.target = {
    ...data.target,
    override: true,
    prompt: false,
    affects: { type: "creature", count: "1", choice: false },
    template: { type: "" }
  };
  data.flags = { [MODULE_ID]: { action: "", chimeraResolved: true } };
  return data;
}
async function attack(actor, activity, source, kind, requestId) {
  if (kind === "limbs" && !chimeraAdaptation(actor, "limbs")) throw Error("Не выбраны Конечности хищников.");
  const targets = await chimeraTargets(actor, source, 5, activity.item.name),
    target = targets?.[0];
  if (!target) return false;
  const type =
    kind === "limbs"
      ? await askOwner(actor, {
          title: "Урон конечностей",
          choices: [
            ["slashing", "Рубящий"],
            ["piercing", "Колющий"],
            ["bludgeoning", "Дробящий"]
          ]
        })
      : "piercing";
  if (!["slashing", "piercing", "bludgeoning"].includes(type)) return false;
  const data = chimeraAttackData(activity, kind, type),
    clone = activity.item.clone({ system: { activities: { [activity.id]: data } } }, { keepId: true });
  return applyNativeOnce(
    actor,
    { requestId, action: `chimera-${kind}`, activityUuid: activity.uuid },
    () =>
      MidiQOL.completeActivityUse(
        clone.system.activities.get(activity.id),
        {
          midiOptions: {
            targetUuids: [target.uuid],
            workflowOptions: { ignoreUserTargets: true, targetConfirmation: "none" }
          }
        },
        { configure: false }
      ),
    async workflow => {
      if (kind === "limbs") return true;
      if (!(workflow.hitTargets instanceof Set)) return { status: "needs-review" };
      if (![...workflow.hitTargets].some(t => (t.document?.uuid ?? t.uuid) === target.uuid)) return true;
      const result = await chimeraPulse(source, activity.item, [target], {
        save: "con",
        damage: [{ formula: "4d6", type: "poison" }],
        requestId: `${requestId}:poison`
      });
      if (result.status !== "success") return { status: "needs-review" };
      if (result.failedSaves.includes(target.uuid))
        await chimeraCondition(source, target, activity.item, {
          kind: "sting",
          statuses: ["poisoned"],
          seconds: 60,
          repeat: "con"
        });
      return true;
    }
  );
}
async function sourceEndCondition(source, target, item, kind, status) {
  const immune = target.actor.system?.traits?.ci?.value;
  if (immune?.has?.(status) || immune?.includes?.(status)) return false;
  const combat = encounterForScene(source.parent, source),
    effect = await addCombatBenefit(source, target, item, {
      kind: `chimera-${kind}`,
      expiry: combat?.started ? "sourceEnd" : null
    });
  await effect.update({ statuses: [status] });
  return true;
}
async function area(actor, activity, source, operation, requestId) {
  const breath = operation === "breath",
    goose = operation === "goose";
  if (goose && !chimeraAdaptation(actor, "goose")) throw Error("Не выбран Гогот гуся.");
  const element = chimeraState(actor).breath;
  if (breath && !Object.hasOwn(CHIMERA_ELEMENTS, element)) throw Error("Сначала выберите элемент дыхания.");
  if (
    !breath &&
    !(await confirmOwner(
      chimeraGm(actor),
      activity.item.name,
      "GM подтверждает слышимость и исключение глухих целей? Иммунитет к состоянию учитывается отдельно. Передвижение Сирены выполняется вручную."
    ))
  )
    return false;
  const spec = {
    shape: breath ? "cone" : "sphere",
    size: breath ? 30 : goose ? 10 : 20,
    origin: "self",
    excludeSelf: true,
    save: breath ? "dex" : "wis",
    dc: String(chimeraDC(actor)),
    damage: breath ? [{ formula: "10d6", type: element }] : [],
    onSave: breath ? "half" : "none",
    native: true,
    templateSeconds: null
  };
  const data = areaActivityData(activity.toObject(), spec);
  Object.assign(data, chimeraExpense(activity, { cost: operation === "siren" ? 1 : 0 }));
  data.flags = { [MODULE_ID]: { action: "", chimeraResolved: true, chimeraHearing: !breath, area: spec } };
  const clone = activity.item.clone({ system: { activities: { [activity.id]: data } } }, { keepId: true });
  return applyNativeOnce(
    actor,
    { requestId, action: `chimera-${operation}`, activityUuid: activity.uuid },
    () => useAreaActivity(clone.system.activities.get(activity.id), { reportOutcome: true }),
    async workflow => {
      if (!breath) {
        if (!(workflow.failedSaves instanceof Set)) return { status: "needs-review" };
        for (const t of workflow.failedSaves) {
          const target = t.document ?? t;
          if (!target.actor || target.actor.statuses?.has("deafened")) continue;
          if (goose) await sourceEndCondition(source, target, activity.item, "goose", "frightened");
          else
            await chimeraCondition(source, target, activity.item, {
              kind: "siren",
              statuses: ["charmed"],
              repeat: "wis"
            });
        }
      }
      for (const uuid of workflow.grimgutzAreaResult?.templateUuids ?? []) {
        const z = await fromUuid(uuid);
        if (z) await z.delete();
      }
      return true;
    }
  );
}
async function saveAction(actor, activity, source, operation, requestId) {
  const kraken = operation === "kraken",
    medusa = operation === "medusa",
    contact = operation === "contact",
    personality = operation === "personality";
  if (contact && !chimeraAdaptation(actor, "toad")) throw Error("Не выбран Яд лягушкоплава.");
  const selected = await chimeraTargets(
    chimeraGm(actor),
    source,
    kraken ? 20 : medusa ? 30 : personality ? 60 : 5,
    activity.item.name,
    { max: kraken ? 100 : 1 }
  );
  if (!selected?.length) return false;
  if (
    !(await confirmOwner(
      chimeraGm(actor),
      activity.item.name,
      medusa
        ? "Сейчас начало хода цели; она видит глаза, не отвела взгляд, источник видит её и не недееспособен?"
        : contact
          ? "Происходит прямой контакт кожи/захват, а не просто соседство токенов?"
          : personality
            ? "У выбранной цели есть кровь, хиты только что упали ниже половины максимума и ещё больше 0?"
            : "Подтверждены выбранные получатели вспышки?"
    ))
  )
    return false;
  return applyNativeOnce(
    actor,
    { requestId, action: `chimera-${operation}`, activityUuid: activity.uuid },
    () =>
      useNativeUtility(activity, {
        dataPatch: chimeraExpense(activity, {
          activation: contact || personality ? "special" : "action",
          cost: kraken || medusa ? 1 : 0
        })
      }),
    async () => {
      const targets = personality ? [source] : selected,
        result = await chimeraPulse(source, activity.item, targets, {
          save: personality ? "wis" : "con",
          ...(kraken ? { damage: [{ formula: "5d10", type: "lightning" }], onSave: "half" } : {}),
          requestId
        });
      if (result.status !== "success") return { status: "needs-review" };
      for (const target of targets) {
        if (!result.failedSaves.includes(target.uuid)) continue;
        if (kraken) {
          await sourceEndCondition(source, target, activity.item, "kraken", "stunned");
          continue;
        }
        if (medusa) {
          const c = encounterForScene(source.parent, source);
          await chimeraCondition(source, target, activity.item, {
            kind: "medusa",
            statuses: ["grappled"],
            extra: {
              skipEndMoment:
                c?.combatant?.tokenId === target.id ? { combatId: c.id, round: c.round, turn: c.turn } : null
            }
          });
        } else if (contact)
          await chimeraCondition(source, target, activity.item, {
            kind: "contact",
            statuses: ["poisoned"],
            seconds: 60,
            extra: { contactActive: true }
          });
        else
          await chimeraCondition(source, source, activity.item, {
            kind: "personality",
            repeat: "wis",
            extra: { victimUuid: selected[0].uuid }
          });
      }
      return true;
    }
  );
}
async function endContact(actor, source) {
  const selected = await chimeraTargets(chimeraGm(actor), source, 100000, "Прекращённый контакт");
  if (!selected) return false;
  for (const effect of selected[0].actor.effects ?? []) {
    const s = effect.getFlag?.(MODULE_ID, "chimeraCondition");
    if (s?.kind !== "contact" || s.sourceTokenUuid !== source.uuid || !s.contactActive) continue;
    await effect.update({
      [`flags.${MODULE_ID}.chimeraCondition.contactActive`]: false,
      [`flags.${MODULE_ID}.repeatSave`]: {
        ability: "con",
        dc: s.dc,
        event: "turnEnd",
        sourceTokenUuid: source.uuid,
        targetTokenUuid: selected[0].uuid,
        sourceItemUuid: s.sourceItemUuid,
        damage: [],
        metadata: { chimeraResolved: true }
      }
    });
  }
  return true;
}
async function mimic(actor, activity, source, operation, requestId) {
  if (operation === "object-form") {
    if (
      !(await confirmOwner(
        chimeraGm(actor),
        "Форма предмета",
        "GM подготовил характеристики и срок формы неодушевлённого предмета не больше Большого размера? Модуль спишет использование, но не заменит актёра и не восстановит его ресурсы."
      ))
    )
      return false;
    return applyNativeOnce(
      actor,
      { requestId, action: operation, activityUuid: activity.uuid },
      () => useNativeUtility(activity, { dataPatch: chimeraExpense(activity, { cost: 1 }) }),
      async () => true
    );
  }
  const spells = [...(actor.items ?? [])].filter(
    i =>
      i.type === "spell" &&
      ["polymorph", "превращение", "полиморф"].includes(String(i.system?.identifier ?? i.name).toLowerCase())
  );
  const spell = spells[0];
  if (!spell) throw Error("Добавьте на персонажа нативную карточку Полиморфа/Превращения из установленной библиотеки.");
  const cast = [...(spell.system.activities?.values?.() ?? [])][0];
  if (!cast) throw Error("У Полиморфа нет активности.");
  if (
    !(await confirmOwner(
      actor,
      "Полиморф на себя",
      "Использовать запас Форм мимика, без расхода ячейки? Выбор облика и его ограничения ведёт нативный Полиморф."
    ))
  )
    return false;
  const data = cast.toObject();
  data.consumption = { spellSlot: false, targets: [{ type: "itemUses", target: activity.item.id, value: "1" }] };
  data.flags = { [MODULE_ID]: { chimeraResolved: true, action: "" } };
  chimeraExpense(activity, { cost: 1 });
  const clone = spell.clone({ system: { activities: { [cast.id]: data } } }, { keepId: true });
  return applyNativeOnce(
    actor,
    { requestId, action: "chimera-mimic", activityUuid: activity.uuid },
    () =>
      MidiQOL.completeActivityUse(
        clone.system.activities.get(cast.id),
        {
          midiOptions: {
            targetUuids: [source.uuid],
            workflowOptions: { ignoreUserTargets: true, targetConfirmation: "none" }
          }
        },
        { configure: false }
      ),
    async () => true
  );
}
registerGmRequest("chimera-action", (actor, data, { requestId }) =>
  serialMutation(`chimera-action:${actor.uuid}`, async () => {
    if (!enabled() || !isGmAuthority()) return false;
    const old = nativeApplicationReply(actor, requestId);
    if (old) return old;
    const activity = await fromUuid(data.activityUuid);
    if (activity?.actor?.uuid !== actor.uuid || !chimeraAvailable(actor, activity.item)) return false;
    const op = automationData(activity).chimeraOperation;
    if (op === "status") {
      const s = inspectChimera(actor);
      notify(
        `Химера ${s.level}; СЛ ${s.dc}; мутация ${s.state.mutation?.roll ?? "не определена"} (${s.state.mutation?.id ?? "—"}).`
      );
      return true;
    }
    if (["menagerie", "knowledge", "resistance", "breath-type"].includes(op)) return chooseChimera(actor, op);
    if (op === "mutation") {
      if (
        !(await confirmOwner(
          chimeraGm(actor),
          "Переброс мутации",
          "GM подтверждает новый LR или исправление? Это не свободный переброс невыгодного результата."
        ))
      )
        return false;
      return applyNativeOnce(
        actor,
        { requestId, action: op, activityUuid: activity.uuid },
        async () => true,
        () => rollChimeraMutation(actor)
      );
    }
    const source = await fromUuid(data.sourceUuid);
    if (source?.actor?.uuid !== actor.uuid || !canvas.ready || canvas.scene?.id !== source.parent.id)
      throw Error("Выберите токен Химеры; активный GM должен открыть его сцену до расхода.");
    if (["limbs", "sting"].includes(op)) return attack(actor, activity, source, op, requestId);
    if (["breath", "siren", "goose"].includes(op)) return area(actor, activity, source, op, requestId);
    if (["kraken", "medusa", "contact", "personality"].includes(op))
      return saveAction(actor, activity, source, op, requestId);
    if (op === "end-contact") return endContact(actor, source);
    if (op === "share") return shareChimera(actor, activity, source, requestId);
    if (["mimic", "object-form"].includes(op)) return mimic(actor, activity, source, op, requestId);
    if (op === "bronze") {
      const tokens = await chimeraTargets(chimeraGm(actor), source, 100000, "Владелец бронзового оружия", {
          self: true
        }),
        owner = tokens?.[0]?.actor;
      if (!owner) return false;
      const weapons = [...(owner.items ?? [])].filter(i => i.type === "weapon"),
        uuid = await askOwner(chimeraGm(actor), {
          title: "Материал конкретного оружия (GM)",
          choices: weapons.map(i => [i.uuid, i.name])
        }),
        weapon = weapons.find(i => i.uuid === uuid);
      if (!weapon) return false;
      const mode = await askOwner(chimeraGm(actor), {
        title: "Материал оружия",
        choices: [
          ["bronze", "Подтверждённая бронза"],
          ["clear", "Снять отметку модуля"]
        ]
      });
      if (!["bronze", "clear"].includes(mode)) return false;
      await weapon.setFlag(MODULE_ID, "chimeraBronze", mode === "bronze");
      notify(
        "Материал сохранён. Атака выполняется штатно через выбранное оружие; преимущество только по одной цели-Химере."
      );
      return true;
    }
    return false;
  })
);
const pending = new Map();
export function controlChimera(actor, activity) {
  const key = `${actor.uuid}:${activity.uuid}`;
  if (pending.has(key)) return pending.get(key);
  const source =
    canvas.tokens?.controlled?.map(t => t.document).find(t => t.actor?.uuid === actor.uuid) ??
    canvas.tokens?.placeables?.map(t => t.document).find(t => t.actor?.uuid === actor.uuid);
  const task = requestGm(
    "chimera-action",
    actor,
    { activityUuid: activity.uuid, sourceUuid: source?.uuid },
    { timeoutMs: 180000 }
  ).finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}
