import { MODULE_ID, FLAGS } from "../shared/constants.mjs";
import { enabled, automationData, findFeature, itemUses, notify } from "../shared/helpers.mjs";
import { DOOMED_CURSES, doomedTotalLevel, doomedMaximum, doomedFeet } from "../shared/doomed-definitions.mjs";
import {
  doomedLevel,
  doomedState,
  doomedAccepted,
  doomedOccupied,
  doomedCapacity,
  doomedCurseActive,
  doomedGiftActive,
  doomedEmpowered,
  doomedDC
} from "../shared/doomed-state.mjs";
import { doomedAvailable, syncDoomed } from "./doomed.mjs";
import { askOwner, confirmOwner, chooseSceneTokens } from "../shared/owner-prompts.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { applyNativeOnce, nativeApplicationReply } from "../shared/native-applications.mjs";
import { useNativeUtility } from "../shared/native-actions.mjs";
import { sourceTokenForActor } from "../shared/zones.mjs";
import { inFeet, canReact, recordModuleReaction, addCombatBenefit, turnKey } from "../shared/combat-benefits.mjs";
import { encounterForScene, combatTurnSnapshot } from "../shared/combat-flow.mjs";
import { areaDamagePart } from "../shared/area-definitions.mjs";
import { useAuraPulse } from "../midi/aura-workflow.mjs";
import { applyTargetEffect } from "../shared/target-effects.mjs";
import { temporaryEffectTiming, isEffectActive } from "../effects/temporary-effects.mjs";
import { effectKey } from "../shared/system-paths.mjs";

const gm = actor => ({ uuid: actor.uuid, testUserPermission: user => user.isGM });
const object = token => token.object ?? { actor: token.actor, document: token };
const nativeSucceeded = result =>
  result != null && result !== false && !result.aborted && !["pending", "needs-review"].includes(result.status);
async function curseCardData(entry) {
  const pack = game.packs.get(`${MODULE_ID}.features`),
    index = await pack?.getIndex({ fields: ["system.identifier"] }),
    row = [...(index ?? [])].find(row => row.system?.identifier === entry.key);
  const card = row && (await pack.getDocument(row._id));
  if (!card) throw Error("Карточка проклятия отсутствует в библиотеке; пересоберите модуль.");
  const data = card.toObject();
  delete data._id;
  delete data.folder;
  return data;
}
export function doomedExpense(activity, { activation = "special", use = false } = {}) {
  if (!doomedAvailable(activity.actor, activity.item)) throw Error("Способность Обречённого недоступна.");
  if (use && itemUses(activity.item).remaining < 1) throw Error("Нет использований до восстановления.");
  if (activation === "reaction" && (!canReact(activity.actor) || doomedCurseActive(activity.actor, "moment")))
    throw Error("Реакция недоступна.");
  if (activation === "bonus" && doomedEmpowered(activity.actor, "moment"))
    throw Error("Украденный миг запрещает бонусные действия.");
  return {
    activation: { type: activation, value: activation === "special" ? 0 : 1, override: true },
    consumption: {
      targets: use ? [{ type: "itemUses", target: "", value: "1" }] : [],
      spellSlot: false,
      scaling: { allowed: false, max: "" }
    }
  };
}
export async function chooseDoomedCurse(actor, { gift = false } = {}) {
  const choices = doomedAccepted(actor).filter(
    entry => doomedCurseActive(actor, entry.id) && (!gift || doomedGiftActive(actor, entry.id))
  );
  const selected = await askOwner(actor, {
    title: gift ? "Выберите неподавленный дар" : "Выберите своё проклятие",
    choices: choices.map(entry => [entry.id, `${entry.name} (${entry.cost} слот(а))`])
  });
  return choices.find(entry => entry.id === selected) ?? null;
}
export async function suppressDoomedGift(actor, id) {
  if (!doomedCurseActive(actor, id)) throw Error("Проклятие больше не принято.");
  const state = structuredClone(doomedState(actor));
  state.suppressed = [...new Set([...(state.suppressed ?? []), id])];
  await actor.setFlag(MODULE_ID, "doomedState", state);
  await syncDoomed(actor);
}
async function chooseAbility(actor) {
  if (doomedState(actor).ability) return false;
  const choices = ["wis", "cha"].filter(key => Number(actor.system.abilities[key].value) >= 16);
  const choice = await askOwner(actor, {
    title: "Неизменяемая Характеристика порчи",
    choices: choices.map(key => [key, CONFIG.DND5E.abilities?.[key]?.label ?? key])
  });
  if (!choices.includes(choice)) return false;
  await actor.setFlag(MODULE_ID, "doomedState", { ...structuredClone(doomedState(actor)), ability: choice });
  return true;
}
export async function acceptDoomedCurse(actor, activity, requestId) {
  if (!doomedState(actor).ability) throw Error("Сначала выберите Характеристику порчи.");
  const capacity = doomedCapacity(actor),
    choices = DOOMED_CURSES.filter(
      entry => !doomedAccepted(actor).includes(entry) && entry.cost <= capacity.maximum - capacity.occupied
    );
  if (!choices.length) {
    notify("Нет подходящих проклятий для свободных слотов.", "warn");
    return false;
  }
  const choice = await askOwner(actor, {
      title: `Принять проклятие: занято ${capacity.occupied}/${capacity.maximum}`,
      choices: choices.map(entry => [entry.id, `${entry.name} (${entry.cost})`])
    }),
    entry = choices.find(entry => entry.id === choice);
  if (!entry) return false;
  let item = findFeature(actor, entry.key),
    data;
  if (!item) data = await curseCardData(entry);
  const expense = doomedExpense(activity, { activation: "action" });
  return applyNativeOnce(
    actor,
    { requestId, action: "doomed-accept", activityUuid: activity.uuid },
    () => useNativeUtility(activity, { dataPatch: expense }),
    async () => {
      if (
        !doomedLevel(actor) ||
        doomedAccepted(actor).some(row => row.id === entry.id) ||
        doomedOccupied(actor) + entry.cost > doomedCapacity(actor).maximum
      )
        throw Error("Слоты изменились после выбора; действие требует проверки GM.");
      if (!item) {
        [item] = await actor.createEmbeddedDocuments("Item", [data]);
        if (!item) throw Error("Не создана карточка проклятия.");
      }
      const state = structuredClone(doomedState(actor));
      state.accepted = [...(state.accepted ?? []), entry.id];
      await actor.setFlag(MODULE_ID, "doomedState", state);
      if (entry.id === "heart" && Number(actor.system.attributes.hp.temp) > 0)
        await actor.update({ "system.attributes.hp.temp": 0 });
      if (entry.id === "disruption") {
        if (typeof actor.endConcentration !== "function") return { status: "needs-review" };
        await actor.endConcentration();
      }
      await syncDoomed(actor);
      return true;
    }
  );
}
export async function removeDoomedCurse(actor, activity, requestId) {
  const entry = await chooseDoomedCurse(actor);
  if (!entry) return false;
  const state = structuredClone(doomedState(actor)),
    level = doomedLevel(actor),
    free = !(state.freeLevels ?? []).includes(level),
    choices = [
      ...(free ? [["level", "Одна бесплатная замена на этом полученном уровне"]] : []),
      ["ritual", `Завершён ритуал 7 дней и оплачено ${entry.cost * 1000} зм`]
    ];
  const mode = await askOwner(gm(actor), { title: "Основание снятия (GM)", choices });
  if (
    !choices.some(([key]) => key === mode) ||
    !(await confirmOwner(
      gm(actor),
      "Снятие проклятия (GM)",
      mode === "level"
        ? "Подтверждён новый полученный уровень Обречённого и ещё не использованная бесплатная замена?"
        : "Подтверждены семь дней ритуала и расход материалов? Обычное снятие проклятия не подходит."
    ))
  )
    return false;
  let replacement = null,
    replacementData = null;
  if (mode === "level") {
    const choices = DOOMED_CURSES.filter(
      row =>
        row.id !== entry.id &&
        !doomedAccepted(actor).includes(row) &&
        row.cost <= doomedCapacity(actor).maximum - doomedOccupied(actor) + entry.cost
    );
    const pick = await askOwner(actor, {
      title: "Бесплатная замена на полученном уровне",
      choices: [["none", "Только снять"], ...choices.map(row => [row.id, `${row.name} (${row.cost})`])]
    });
    if (pick == null) return false;
    replacement = choices.find(row => row.id === pick) ?? null;
    if (pick !== "none" && !replacement) return false;
    if (replacement && !findFeature(actor, replacement.key)) replacementData = await curseCardData(replacement);
  }
  return applyNativeOnce(
    actor,
    { requestId, action: "doomed-remove", activityUuid: activity.uuid },
    async () => true,
    async () => {
      if (mode === "level" && (doomedLevel(actor) !== level || (doomedState(actor).freeLevels ?? []).includes(level)))
        throw Error("Полученный уровень/право замены изменились; проверьте с GM.");
      state.accepted = (state.accepted ?? []).filter(id => id !== entry.id);
      state.suppressed = (state.suppressed ?? []).filter(id => id !== entry.id);
      if (mode === "level") state.freeLevels = [...(state.freeLevels ?? []), level];
      if (replacement) {
        if (replacementData) await actor.createEmbeddedDocuments("Item", [replacementData]);
        state.accepted.push(replacement.id);
      }
      // Do not delete the user's owned card or manual edits. Only module-owned effects cease.
      await actor.setFlag(MODULE_ID, "doomedState", state);
      if (replacement?.id === "heart") await actor.update({ "system.attributes.hp.temp": 0 });
      if (replacement?.id === "disruption") await actor.endConcentration?.();
      await syncDoomed(actor);
      notify(
        "Проклятие снято/заменено; старая карточка сохранена как справка. Свободные слоты можно заполнить обычной кнопкой принятия."
      );
      return true;
    }
  );
}
export async function empowerDoomedCurse(actor, activity, requestId) {
  const state = doomedState(actor);
  if (Number(state.amplification?.until ?? 0) > Number(game.time.worldTime))
    throw Error("Предыдущее усиление ещё не окончилось.");
  const entry = await chooseDoomedCurse(actor, { gift: true });
  if (!entry) return false;
  const oldHp = Number(actor.system.attributes.hp.value),
    amount = doomedTotalLevel(actor),
    expense = doomedExpense(activity, { activation: "bonus", use: true });
  return applyNativeOnce(
    actor,
    { requestId, action: "doomed-empower", activityUuid: activity.uuid },
    () => useNativeUtility(activity, { dataPatch: expense }),
    async () => {
      const amplification = { curse: entry.id, id: requestId, until: Number(game.time.worldTime) + 60 };
      await actor.setFlag(MODULE_ID, "doomedState", { ...structuredClone(doomedState(actor)), amplification });
      await actor.createEmbeddedDocuments("ActiveEffect", [
        {
          name: `Усиление проклятия: ${entry.name}`,
          img: entry.img,
          type: "base",
          origin: activity.item.uuid,
          disabled: false,
          transfer: false,
          statuses: [],
          showIcon: 1,
          ...temporaryEffectTiming({ seconds: 60, actor }),
          flags: { [MODULE_ID]: { doomedAmplification: requestId }, dae: { expiryMode: "delete" } },
          system: { changes: [] }
        }
      ]);
      await syncDoomed(actor);
      if (entry.id === "wounds" && doomedGiftActive(actor, entry.id))
        await actor.update({ "system.attributes.hp.value": Math.min(doomedMaximum(actor), oldHp + amount) });
      return true;
    }
  );
}
async function increaseDoomed(actor, activity, requestId) {
  if (actor.getFlag(MODULE_ID, "doomedIncrease")) return false;
  const mode = await askOwner(actor, {
    title: "Проклятое увеличение",
    choices: [
      ["abilities", "+3 и максимум +3 / другая характеристика −2"],
      ["feat", "Выбрать черту штатно"]
    ]
  });
  if (!["abilities", "feat"].includes(mode)) return false;
  const data = { mode };
  if (mode === "abilities") {
    const keys = ["str", "dex", "con", "int", "wis", "cha"],
      label = key => CONFIG.DND5E.abilities?.[key]?.label ?? key;
    data.raise = await askOwner(actor, {
      title: "Характеристика +3 и максимум +3",
      choices: keys.map(key => [key, label(key)])
    });
    if (!keys.includes(data.raise)) return false;
    const lower = keys.filter(key => key !== data.raise && Number(actor.system.abilities[key].value) >= 3);
    data.lower = await askOwner(actor, {
      title: "Другая характеристика −2 (итог ≥1)",
      choices: lower.map(key => [key, label(key)])
    });
    if (!lower.includes(data.lower)) return false;
  }
  return applyNativeOnce(
    actor,
    { requestId, action: "doomed-increase", activityUuid: activity.uuid },
    async () => true,
    async () => {
      await actor.setFlag(MODULE_ID, "doomedIncrease", data);
      await syncDoomed(actor);
      if (mode === "feat") notify("Добавьте выбранную черту штатно; бонусы характеристик не выдаются.");
      return true;
    }
  );
}
async function useDoomedCore(actor, activity, source, operation, requestId) {
  if (operation === "empower") return empowerDoomedCurse(actor, activity, requestId);
  if (operation === "increase") return increaseDoomed(actor, activity, requestId);
  if (operation === "endurance") {
    if (
      !(await confirmOwner(
        gm(actor),
        "Стойкость обречённого (GM)",
        "Подтверждено получение конкретного урона; уменьшение будет применено до изменения хитов?"
      ))
    )
      return false;
    const amount = 2 * doomedOccupied(actor),
      expense = doomedExpense(activity, { activation: "reaction", use: true });
    return applyNativeOnce(
      actor,
      { requestId, action: "doomed-endurance", activityUuid: activity.uuid },
      () => useNativeUtility(activity, { dataPatch: expense }),
      async () => {
        await recordModuleReaction(actor, source?.parent);
        await new Roll(String(amount)).evaluate().then(roll =>
          roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor }),
            flavor: `Стойкость обречённого: уменьшите исходный урон на ${amount}, минимум до 0 (GM)`
          })
        );
        return true;
      }
    );
  }
  if (["defiance", "delayed-end"].includes(operation)) {
    if (operation === "delayed-end" && !doomedOccupied(actor)) return false;
    if (
      !(await confirmOwner(
        gm(actor),
        activity.item.name,
        operation === "defiance"
          ? "Это конкретный проваленный спасбросок; после расхода GM меняет его результат на успех в исходном потоке?"
          : "Это исходный урон, снижающий до 0, но без мгновенной смерти; не потеря хитов и не более позднее воскрешение?"
      ))
    )
      return false;
    const entry = await chooseDoomedCurse(actor, { gift: operation === "defiance" });
    if (!entry) return false;
    const expense = doomedExpense(activity, { use: true });
    return applyNativeOnce(
      actor,
      { requestId, action: `doomed-${operation}`, activityUuid: activity.uuid },
      () => useNativeUtility(activity, { dataPatch: expense }),
      async () => {
        if (operation === "delayed-end")
          await actor.update({
            "system.attributes.hp.value": 1,
            ...(!doomedCurseActive(actor, "heart")
              ? {
                  "system.attributes.hp.temp": Math.max(
                    Number(actor.system.attributes.hp.temp ?? 0),
                    2 * doomedOccupied(actor)
                  )
                }
              : {})
          });
        await suppressDoomedGift(actor, entry.id);
        if (operation === "defiance")
          notify("Наперекор судьбе: GM должен заменить исходный провал на успех, не только сообщение в чате.");
        return true;
      }
    );
  }
  return false;
}
export function doomedTransferredChanges(actor, id, targetActor = actor) {
  const level = doomedTotalLevel(actor),
    change = (key, value, type = "add", phase = "initial", priority = 20) => ({
      key,
      value: String(value),
      type,
      phase,
      priority
    });
  if (id === "soul") return ["wis", "cha"].map(key => change(effectKey(`system.abilities.${key}.bonuses.save`), -2));
  if (id === "wounds") return [change("system.attributes.death.roll.mode", -1, "downgrade", "final")];
  if (id === "luck") return [change("system.attributes.init.roll.mode", -1, "downgrade", "final")];
  if (id === "mind") return [change("system.abilities.int.save.roll.mode", -1, "downgrade", "final")];
  if (id === "cold") return [change("system.traits.dv.value", "fire")];
  if (id === "bones") return [change("system.traits.dv.value", "bludgeoning")];
  if (id === "flesh") return [change("system.attributes.hp.tempmax", -2 * level)];
  if (id === "grave")
    return [
      change(
        effectKey("system.attributes.movement.walk"),
        -doomedFeet(5, targetActor.system.attributes.movement?.units),
        "add",
        "final"
      ),
      change(
        effectKey("system.attributes.movement.walk"),
        doomedFeet(5, targetActor.system.attributes.movement?.units),
        "upgrade",
        "final",
        21
      )
    ];
  return [];
}
async function chooseTargets(actor, item, source, range, max = 1) {
  if (!source?.parent || canvas.scene?.id !== source.parent.id)
    throw Error("Для целей откройте сцену токена источника.");
  const targets = await chooseSceneTokens(actor, source.parent, {
    title: item.name,
    min: 1,
    max,
    exclude: [source.uuid],
    relation: token => inFeet(source, token, range, source.parent)
  });
  if (
    !targets?.length ||
    !(await confirmOwner(gm(actor), item.name, "Все выбранные цели видимы источнику и разрешены правилом?"))
  )
    return null;
  return targets;
}
async function sharedFate(actor, activity, source, requestId) {
  const entry = await chooseDoomedCurse(actor);
  if (!entry) return false;
  const targets = await chooseTargets(actor, activity.item, source, 60);
  if (!targets) return false;
  if (
    !(await confirmOwner(
      gm(actor),
      "Разделённая участь",
      "Выбранная цель враждебна? Передаётся обычный недостаток без дара; влияние текущего усиления, если спорно, разрешите вручную."
    ))
  )
    return false;
  if (doomedDC(actor) == null) throw Error("Не выбрана Характеристика порчи.");
  const expense = doomedExpense(activity, { activation: "action", use: true }),
    dc = doomedDC(actor);
  return applyNativeOnce(
    actor,
    { requestId, action: "doomed-shared-fate", activityUuid: activity.uuid },
    () => useNativeUtility(activity, { dataPatch: expense }),
    async () => {
      const result = await useAuraPulse({
        scene: source.parent,
        sourceToken: object(source),
        sourceItem: activity.item,
        targets: targets.map(object),
        eventKey: `${requestId}:save`,
        event: { save: "wis", dc: String(dc), damage: [], onSave: "none", returnSaveOutcome: true }
      });
      if (result?.status !== "success") return { status: "needs-review" };
      if (!result.failedSaves.includes(targets[0].uuid)) return true;
      const target = targets[0],
        key = `doomed-shared:${entry.id}`;
      if (
        doomedCurseActive(target.actor, entry.id) ||
        [...(target.actor.effects ?? [])].some(
          e => isEffectActive(e) && e.getFlag?.(MODULE_ID, FLAGS.TARGET_EFFECT) === key
        )
      )
        return true;
      const changes = doomedTransferredChanges(actor, entry.id, target.actor);
      if (entry.id === "flesh")
        changes[0].value = String(-Math.min(2 * doomedTotalLevel(actor), doomedMaximum(target.actor) - 1));
      const applied = await applyTargetEffect({
        sourceActor: actor,
        sourceItem: activity.item,
        targets: [object(target)],
        key,
        name: `Разделённая участь: ${entry.name}`,
        img: entry.img,
        changes,
        duration: { seconds: 60 },
        repeatSave: {
          ability: "wis",
          dc,
          event: "turnEnd",
          damage: [],
          sourceTokenUuid: source.uuid,
          sourceItemUuid: activity.item.uuid,
          targetTokenUuid: target.uuid
        },
        flags: {
          [MODULE_ID]: {
            doomedTransferred: {
              curse: entry.id,
              level: doomedTotalLevel(actor),
              prof: Number(actor.system.attributes.prof),
              dc
            }
          }
        },
        description: `Только недостаток «${entry.name}», без дара. Сюжетные запреты и особые условия проверяет GM.`
      });
      if (applied && entry.id === "heart") await target.actor.update({ "system.attributes.hp.temp": 0 });
      if (applied && entry.id === "disruption") await target.actor.endConcentration?.();
      if (applied && entry.id === "flesh")
        await target.actor.update({ "system.attributes.hp.value": Number(target.actor.system.attributes.hp.value) });
      return applied ? true : { status: "needs-review" };
    }
  );
}
export async function doomedHeal(actor, activity, source, target, formula, requestId) {
  const data = activity.toObject();
  Object.assign(data, {
    type: "heal",
    activation: { type: "special", value: 0, override: true },
    consumption: { targets: [], spellSlot: false },
    healing: areaDamagePart({ formula, type: "healing" }),
    target: { template: { type: "" }, affects: { type: "creature", count: "1" }, override: true, prompt: false },
    range: { value: 0, units: "self", override: true },
    flags: {
      ...data.flags,
      [MODULE_ID]: {
        action: "",
        moduleAction: "",
        leaderResolved: true,
        doomedResolved: true,
        doomedHungerHealing: requestId
      }
    }
  });
  delete data.roll;
  const clone = activity.item.clone({ system: { activities: { [activity.id]: data } } }, { keepId: true });
  const result = await MidiQOL.completeActivityUse(
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
  return result === false || result?.aborted || result == null ? { status: "needs-review" } : true;
}
function ownTurn(source) {
  const combat = encounterForScene(source.parent, source),
    snapshot = combat && combatTurnSnapshot(combat);
  return snapshot?.current.token?.uuid === source.uuid ? turnKey(combat) : null;
}
async function damageGift(actor, activity, source, id, requestId) {
  const amp = doomedEmpowered(actor, id),
    turn = ownTurn(source);
  if (!turn) throw Error("Дар требует подтверждённого собственного хода в бою.");
  const claims = actor.getFlag(MODULE_ID, "doomedGiftTurns") ?? {};
  if (claims[id] === turn) return false;
  const rows = (actor.getFlag(MODULE_ID, "doomedDamageApplications") ?? []).filter(
    row => row.turn === turn && row.sourceUuid === source.uuid && row.amount > 0 && !row.automatic
  );
  const choices = [];
  for (const row of rows)
    for (const target of row.targets ?? []) if (!choices.some(c => c.uuid === target.uuid)) choices.push(target);
  const selected = await askOwner(actor, {
      title: activity.item.name,
      choices: choices.map(t => [t.uuid, t.name ?? "Цель подтверждённого урона"])
    }),
    receiver = choices.find(t => t.uuid === selected);
  if (!receiver) return false;
  const target = await fromUuid(receiver.uuid);
  if (!target?.actor || target.parent.id !== source.parent.id) return false;
  if (
    id === "hunger" &&
    !(await confirmOwner(
      gm(actor),
      "Кровавый голод",
      amp
        ? "Враг получил урон подходящей атакой/заклинанием и имел ≤ половины максимума хитов в начале этого хода?"
        : "Именно ваша атака/заклинание снизила хиты враждебной цели до 0 в этот ход?"
    ))
  )
    return false;
  if (id === "hunger" && !amp && Number(target.actor.system.attributes.hp.value) > 0) return false;
  const types = receiver.types ?? [],
    type =
      id === "decay"
        ? await askOwner(actor, { title: "Один тип исходного урона", choices: types.map(value => [value, value]) })
        : null;
  if (id === "decay" && !types.includes(type)) return false;
  const expense = doomedExpense(activity);
  return applyNativeOnce(
    actor,
    { requestId, action: `doomed-gift:${id}`, activityUuid: activity.uuid },
    () => useNativeUtility(activity, { dataPatch: expense }),
    async () => {
      // Reserve before Midi. An uncertain application is never retried automatically.
      await actor.setFlag(MODULE_ID, "doomedGiftTurns", { ...claims, [id]: turn });
      if (id === "hunger")
        return doomedHeal(
          actor,
          activity,
          source,
          source,
          `2d8 + ${Number(actor.system.abilities[doomedState(actor).ability].mod)}`,
          requestId
        );
      const result = await useAuraPulse({
        scene: source.parent,
        sourceToken: object(source),
        sourceItem: activity.item,
        targets: [object(target)],
        eventKey: requestId,
        event: { damage: [{ formula: amp ? "6d8" : "3d8", type }], onSave: "none" }
      });
      return nativeSucceeded(result) ? true : { status: "needs-review" };
    }
  );
}
async function useGift(actor, activity, source, id, requestId) {
  if (!source?.parent) throw Error("Выберите токен Обречённого на сцене.");
  const amp = doomedEmpowered(actor, id);
  if (["hunger", "decay"].includes(id)) return damageGift(actor, activity, source, id, requestId);
  if (["soul", "disruption"].includes(id)) {
    const targets = await chooseTargets(actor, activity.item, source, id === "disruption" && amp ? 120 : 60);
    if (!targets) return false;
    if (
      !(await confirmOwner(
        gm(actor),
        activity.item.name,
        id === "soul"
          ? "Именно выбранное другое существо получает урон; сопротивления/уязвимости уже учтены, перенос будет выполнен в двух исходных пакетах?"
          : "Именно выбранное видимое существо сейчас накладывает заклинание; его эффект ещё не разрешён, GM сможет прервать исходный поток без возврата ресурсов?"
      ))
    )
      return false;
    const expense = doomedExpense(activity, { activation: "reaction", use: true }),
      dc = doomedDC(actor);
    if (id === "disruption" && !amp && dc == null) return false;
    return applyNativeOnce(
      actor,
      { requestId, action: `doomed-${id}`, activityUuid: activity.uuid },
      () => useNativeUtility(activity, { dataPatch: expense }),
      async () => {
        await recordModuleReaction(actor, source.parent);
        if (id === "disruption" && !amp) {
          const result = await useAuraPulse({
            scene: source.parent,
            sourceToken: object(source),
            sourceItem: activity.item,
            targets: targets.map(object),
            eventKey: requestId,
            event: { save: "cha", dc: String(dc), damage: [], onSave: "none", returnSaveOutcome: true }
          });
          if (result?.status !== "success") return { status: "needs-review" };
          if (!result.failedSaves.includes(targets[0].uuid)) return true;
        }
        const done = await confirmOwner(
          gm(actor),
          "Завершение в исходном потоке (GM)",
          id === "soul"
            ? `Перенесена ${amp ? "вся сумма" : "половина каждого типа с округлением вверх"} уже рассчитанного урона? Урон Обречённому не уменьшен/не предотвращён; уменьшен пакет цели, а не выдано лечение.`
            : "Именно исходное заклинание больше не оказывает эффекта, а его затраченные ресурсы НЕ возвращены?"
        );
        return done ? true : { status: "needs-review" };
      }
    );
  }
  if (id === "flame") {
    const combat = encounterForScene(source.parent, source),
      turn = turnKey(combat);
    if (!turn) throw Error("Первое попадание за ход требует текущего боя.");
    const claims = actor.getFlag(MODULE_ID, "doomedGiftTurns") ?? {};
    if (claims.flame === turn) return false;
    const targets = await chooseTargets(actor, activity.item, source, 5);
    if (
      !targets ||
      !(await confirmOwner(
        gm(actor),
        "Неугасимое пламя",
        "Это первое подходящее попадание по Обречённому за этот ход, ближней атакой из 5 футов?"
      ))
    )
      return false;
    return applyNativeOnce(
      actor,
      { requestId, action: "doomed-flame", activityUuid: activity.uuid },
      () => useNativeUtility(activity, { dataPatch: doomedExpense(activity) }),
      async () => {
        await actor.setFlag(MODULE_ID, "doomedGiftTurns", { ...claims, flame: turn });
        const result = await useAuraPulse({
          scene: source.parent,
          sourceToken: object(source),
          sourceItem: activity.item,
          targets: targets.map(object),
          eventKey: requestId,
          event: { damage: [{ formula: amp ? "3d8" : "2d8", type: "fire" }], onSave: "none" }
        });
        return nativeSucceeded(result) ? true : { status: "needs-review" };
      }
    );
  }
  if (id === "luck") {
    if (
      !(await confirmOwner(
        gm(actor),
        "Проклятая удача",
        "Подтверждён промах атаки или провал проверки/спасброска; новый к20 заменит исходный с его модификаторами?"
      ))
    )
      return false;
    return applyNativeOnce(
      actor,
      { requestId, action: "doomed-luck", activityUuid: activity.uuid },
      () => useNativeUtility(activity, { dataPatch: doomedExpense(activity, { use: true }) }),
      async () => {
        await (
          await new Roll("1d20").evaluate()
        ).toMessage({
          speaker: ChatMessage.getSpeaker({ actor }),
          flavor: "Проклятая удача: замените исходный к20 новым результатом; GM пересчитывает исходный бросок"
        });
        return true;
      }
    );
  }
  if (id === "shadow") {
    if (
      doomedCurseActive(actor, "chains") ||
      !(await confirmOwner(
        gm(actor),
        "Тень за спиной",
        `Подтверждено видимое свободное место в ${amp ? 60 : 30} футах? Переместите токен вручную после применения.`
      ))
    )
      return false;
    return applyNativeOnce(
      actor,
      { requestId, action: "doomed-shadow", activityUuid: activity.uuid },
      () => useNativeUtility(activity, { dataPatch: doomedExpense(activity, { activation: "bonus", use: true }) }),
      async () => {
        const effect = await addCombatBenefit(source, source, activity.item, {
          kind: "doomed-invisibility",
          expiry: "sourceStart",
          remaining: null,
          doomedShadow: { empowered: amp }
        });
        await effect.update({ statuses: ["invisible"] });
        if (!encounterForScene(source.parent, source))
          await effect.update({
            start: null,
            duration: { value: null, units: "seconds", expiry: null, expired: false }
          });
        notify(
          `Тень за спиной: переместите токен вручную до ${amp ? 60 : 30} футов. Вне боя окончание следующего хода подтверждает GM.`
        );
        return true;
      }
    );
  }
  if (id === "truth") {
    if (!amp || doomedCurseActive(actor, "silence")) return false;
    const targets = await chooseTargets(actor, activity.item, source, 60);
    if (
      !targets ||
      !(await confirmOwner(gm(actor), "Правдивый язык", "Вы способны говорить, цель слышит и понимает вас?"))
    )
      return false;
    const until = Number(doomedState(actor).amplification.until),
      expense = doomedExpense(activity, { activation: "bonus" }),
      dc = doomedDC(actor);
    if (dc == null) return false;
    return applyNativeOnce(
      actor,
      { requestId, action: "doomed-truth", activityUuid: activity.uuid },
      () => useNativeUtility(activity, { dataPatch: expense }),
      async () => {
        const result = await useAuraPulse({
          scene: source.parent,
          sourceToken: object(source),
          sourceItem: activity.item,
          targets: targets.map(object),
          eventKey: requestId,
          event: { save: "cha", dc: String(dc), damage: [], onSave: "none", returnSaveOutcome: true }
        });
        if (result?.status !== "success") return { status: "needs-review" };
        if (!result.failedSaves.includes(targets[0].uuid)) return true;
        if (until <= Number(game.time.worldTime)) return true;
        return (await applyTargetEffect({
          sourceActor: actor,
          sourceItem: activity.item,
          targets: targets.map(object),
          key: "doomed-truth",
          name: "Правдивый язык: не может намеренно лгать",
          changes: [],
          duration: { seconds: until - Number(game.time.worldTime) }
        }))
          ? true
          : { status: "needs-review" };
      }
    );
  }
  if (id === "chains") {
    const targets = await chooseTargets(actor, activity.item, source, 60, Number(actor.system.attributes.prof));
    if (!targets || doomedDC(actor) == null) return false;
    const dc = doomedDC(actor),
      expense = doomedExpense(activity, { activation: "action", use: true });
    return applyNativeOnce(
      actor,
      { requestId, action: "doomed-chains", activityUuid: activity.uuid },
      () => useNativeUtility(activity, { dataPatch: expense }),
      async () => {
        const result = await useAuraPulse({
          scene: source.parent,
          sourceToken: object(source),
          sourceItem: activity.item,
          targets: targets.map(object),
          eventKey: requestId,
          event: {
            save: "str",
            dc: String(dc),
            damage: [{ formula: amp ? "8d8" : "4d8", type: "force" }],
            onSave: "none",
            returnSaveOutcome: true,
            metadata: { doomedChainsDisadvantage: amp }
          }
        });
        if (result?.status !== "success") return { status: "needs-review" };
        let complete = true;
        for (const target of targets.filter(t => result.failedSaves.includes(t.uuid))) {
          const immunity = target.actor.system?.traits?.ci?.value;
          if (immunity?.has?.("restrained") || immunity?.includes?.("restrained")) continue;
          complete =
            (await applyTargetEffect({
              sourceActor: actor,
              sourceItem: activity.item,
              targets: [object(target)],
              key: "doomed-chains",
              name: "Могильные цепи",
              status: "restrained",
              changes: [],
              duration: { seconds: 60 },
              repeatSave: {
                ability: "str",
                dc,
                event: "turnEnd",
                damage: [],
                sourceTokenUuid: source.uuid,
                sourceItemUuid: activity.item.uuid,
                targetTokenUuid: target.uuid
              }
            })) && complete;
        }
        return complete ? true : { status: "needs-review" };
      }
    );
  }
  return false;
}
registerGmRequest("doomed-action", (actor, data, { requestId }) =>
  serialMutation(`doomed:${actor.uuid}`, async () => {
    if (!enabled() || !isGmAuthority()) return false;
    const previous = nativeApplicationReply(actor, requestId);
    if (previous) return previous;
    const activity = await fromUuid(data.activityUuid),
      source = data.sourceUuid ? await fromUuid(data.sourceUuid) : null;
    if (activity?.actor?.uuid !== actor.uuid || !doomedAvailable(actor, activity.item)) return false;
    const operation = automationData(activity).doomedOperation;
    if (operation === "ability") return chooseAbility(actor);
    if (operation === "accept") return acceptDoomedCurse(actor, activity, requestId);
    if (operation === "remove") return removeDoomedCurse(actor, activity, requestId);
    if (source && source.actor?.uuid !== actor.uuid) return false;
    if (operation === "shared-fate") return sharedFate(actor, activity, source, requestId);
    if (operation.startsWith("gift:")) return useGift(actor, activity, source, operation.slice(5), requestId);
    if (operation === "hide") {
      if (!doomedEmpowered(actor, "silence") || doomedCurseActive(actor, "flame")) return false;
      return applyNativeOnce(
        actor,
        { requestId, action: "doomed-hide", activityUuid: activity.uuid },
        () => useNativeUtility(activity, { dataPatch: doomedExpense(activity, { activation: "bonus" }) }),
        async () => {
          notify("Выполните штатную Засаду и проверку Скрытности; усиление уже задаёт минимум к20 10.");
          return true;
        }
      );
    }
    return useDoomedCore(actor, activity, source, operation, requestId);
  })
);
const pending = new Map();
export function controlDoomed(actor, activity) {
  const key = `${actor.uuid}:${activity.id}`;
  if (pending.has(key)) return pending.get(key);
  const task = requestGm(
    "doomed-action",
    actor,
    { activityUuid: activity.uuid, sourceUuid: sourceTokenForActor(actor)?.document.uuid },
    { timeoutMs: 120000 }
  );
  pending.set(key, task);
  void task.finally(() => pending.delete(key)).catch(() => {});
  return task;
}
