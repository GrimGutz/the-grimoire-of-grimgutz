import { MODULE_ID } from "../shared/constants.mjs";
import { NIGHTMARE_FEARS, nightmareKnownMaximum } from "../shared/nightmare-definitions.mjs";
import {
  nightmareLevel,
  nightmareState,
  nightmareKnown,
  nightmarePool,
  nightmarePoints,
  nightmareDC,
  nightmareFears,
  nightmareFearData,
  nightmareFrightened,
  nightmareManifested,
  patchNightmare
} from "../shared/nightmare-state.mjs";
import { enabled, automationData, findFeature, itemUses, notify } from "../shared/helpers.mjs";
import { nightmareAvailable, syncNightmare } from "./nightmare.mjs";
import { askOwner, confirmOwner, chooseSceneTokens } from "../shared/owner-prompts.mjs";
import { isGmAuthority, requestGm, registerGmRequest } from "../shared/gm-requests.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { applyNativeOnce, nativeApplicationReply } from "../shared/native-applications.mjs";
import { useNativeUtility } from "../shared/native-actions.mjs";
import { sourceTokenForActor } from "../shared/zones.mjs";
import { inFeet, canReact, recordModuleReaction, addCombatBenefit, turnKey } from "../shared/combat-benefits.mjs";
import { encounterForScene, combatTurnSnapshot } from "../shared/combat-flow.mjs";
import { isEffectActive, temporaryEffectTiming } from "../effects/temporary-effects.mjs";
import { isAuraIncapacitated } from "../shared/aura-conditions.mjs";
import { useAuraPulse } from "../midi/aura-workflow.mjs";
import {
  imposeNightmareFear,
  chooseNightmareReplacement,
  triggerNightmareFear,
  nightmareTargetEpoch,
  applyNightmareFrightened
} from "./nightmare-fears.mjs";
import { nightmareSummons, summonNightmare } from "./nightmare-summons.mjs";
import { dismissSummonActor, summonConcentrationActivity } from "../shared/summon-lifecycle.mjs";

const gm = actor => ({ uuid: actor.uuid, testUserPermission: user => user.isGM });
const object = token => token.object ?? { actor: token.actor, document: token };
export function nightmareExpense(activity, { cost = 0, activation = "special", featureUse = null } = {}) {
  const actor = activity.actor;
  if (!nightmareAvailable(actor, activity.item)) throw Error("Способность Кошмара недоступна.");
  if (cost && nightmarePoints(actor) < cost) throw Error("Недостаточно очков страха.");
  if (activation === "reaction" && !canReact(actor)) throw Error("Реакция недоступна.");
  if (featureUse && itemUses(featureUse).remaining < 1) throw Error("Нет использований Неотвратимого ужаса.");
  return {
    activation: { type: activation, value: activation === "special" ? 0 : 1, override: true },
    consumption: {
      targets: [
        ...(cost ? [{ type: "itemUses", target: nightmarePool(actor).id, value: String(cost) }] : []),
        ...(featureUse ? [{ type: "itemUses", target: featureUse.id, value: "1" }] : [])
      ],
      spellSlot: false,
      scaling: { allowed: false, max: "" }
    },
    duration: { concentration: false, value: "", units: "inst", override: true }
  };
}
async function chooseTargets(
  actor,
  item,
  source,
  { range = 60, relation = null, min = 1, max = 1, excludeSelf = false } = {}
) {
  if (!source?.parent) throw Error("Выберите токен Кошмара.");
  const targets = await chooseSceneTokens(actor, source.parent, {
    title: item.name,
    min,
    max,
    exclude: excludeSelf ? [source.uuid] : [],
    relation: token => inFeet(source, token, range, source.parent) && (!relation || relation(token))
  });
  if (
    !targets?.length ||
    !(await confirmOwner(
      gm(actor),
      item.name,
      "Источник видит выбранные существа, и они соответствуют условиям этой способности?"
    ))
  )
    return null;
  return targets;
}
async function chooseAbility(actor) {
  if (nightmareState(actor).ability) return false;
  const choices = ["wis", "cha"].filter(key => Number(actor.system.abilities[key].value) >= 16),
    choice = await askOwner(actor, {
      title: "Неизменяемая Характеристика кошмара",
      choices: choices.map(key => [key, CONFIG.DND5E.abilities?.[key]?.label ?? key])
    });
  if (!choices.includes(choice)) return false;
  await patchNightmare(actor, latest => ({ ...latest, ability: choice }));
  return true;
}
async function getFearCard(entry) {
  const pack = game.packs.get(`${MODULE_ID}.features`),
    index = await pack?.getIndex({ fields: ["system.identifier"] }),
    row = [...(index ?? [])].find(row => row.system?.identifier === entry.key),
    card = row && (await pack.getDocument(row._id));
  if (!card) throw Error("Карточка страха отсутствует в библиотеке.");
  const data = card.toObject();
  delete data._id;
  delete data.folder;
  return data;
}
export async function learnNightmareFears(actor) {
  const known = nightmareKnown(actor),
    maximum = nightmareKnownMaximum(nightmareLevel(actor)),
    level = nightmareLevel(actor),
    state = structuredClone(nightmareState(actor));
  const operations = [
    ...(known.length < maximum ? [["add", `Выбрать ещё ${maximum - known.length}`]] : []),
    ...(known.length && !(state.replacementLevels ?? []).includes(level)
      ? [["replace", "Заменить один при получении уровня"]]
      : [])
  ];
  if (!operations.length) return false;
  const operation = await askOwner(actor, { title: "Известные страхи", choices: operations });
  if (!operations.some(([key]) => key === operation)) return false;
  let removed = null,
    selected;
  if (operation === "replace") {
    if (
      !(await confirmOwner(
        gm(actor),
        "Замена страха (GM)",
        "Подтверждён полученный уровень Кошмара и ещё не использованная замена именно на этом уровне?"
      ))
    )
      return false;
    removed = await askOwner(actor, {
      title: "Один забываемый страх",
      choices: known.map(entry => [entry.id, entry.name])
    });
    if (!known.some(entry => entry.id === removed)) return false;
    const choice = await askOwner(actor, {
      title: "Новый известный страх",
      choices: NIGHTMARE_FEARS.filter(entry => !known.includes(entry)).map(entry => [entry.id, entry.name])
    });
    selected = NIGHTMARE_FEARS.filter(entry => entry.id === choice && !known.includes(entry));
    if (selected.length !== 1) return false;
  } else {
    const count = maximum - known.length,
      choices = NIGHTMARE_FEARS.filter(entry => !known.includes(entry));
    const choice = await askOwner(actor, {
      title: `Выберите ${count} новых страхов`,
      kind: "checkbox",
      choices: choices.map(entry => [entry.id, entry.name]),
      min: count,
      max: count
    });
    if (!Array.isArray(choice) || new Set(choice).size !== count) return false;
    selected = choices.filter(entry => choice.includes(entry.id));
    if (selected.length !== count) return false;
  }
  const data = await Promise.all(selected.filter(entry => !findFeature(actor, entry.key)).map(getFearCard));
  if (data.length) {
    const made = await actor.createEmbeddedDocuments("Item", data);
    if (made.length !== data.length) throw Error("Не все карточки страхов созданы; выбор требует проверки GM.");
  }
  await patchNightmare(actor, latest => {
    latest.known = [
      ...known.filter(entry => entry.id !== removed).map(entry => entry.id),
      ...selected.map(entry => entry.id)
    ];
    if (removed) latest.replacementLevels = [...(latest.replacementLevels ?? []), level];
  });
  return true;
}
async function impose(actor, activity, source, operation, requestId) {
  const choices = nightmareKnown(actor),
    fixed = operation.startsWith("impose:") ? operation.slice(7) : null,
    picked =
      fixed ??
      (await askOwner(actor, {
        title: "Известный навязанный страх",
        choices: choices.map(entry => [entry.id, entry.name])
      })),
    entry = choices.find(entry => entry.id === picked);
  if (!entry) return false;
  if (nightmareDC(actor) == null) throw Error("Сначала выберите Характеристику кошмара.");
  const targets = await chooseTargets(actor, activity.item, source, { excludeSelf: true });
  if (
    !targets ||
    !(await confirmOwner(
      gm(actor),
      "Навязанный страх",
      "Выбранная цель враждебна Кошмару? Наложение не вызывает испуг и не требует спасброска."
    ))
  )
    return false;
  const replacement = await chooseNightmareReplacement(actor, targets[0], entry);
  if (!replacement) return false;
  const expense = nightmareExpense(activity, { cost: 1, activation: "bonus" });
  return applyNativeOnce(
    actor,
    { requestId, action: "nightmare-impose", activityUuid: activity.uuid },
    () => useNativeUtility(activity, { dataPatch: expense }),
    () => imposeNightmareFear(actor, activity.item, source, targets[0], entry, { requestId, ...replacement })
  );
}
async function manualTrigger(actor, activity, source, requestId) {
  const targets = await chooseTargets(actor, activity.item, source, {
    range: Infinity,
    relation: token =>
      nightmareFears(token.actor).some(effect => nightmareFearData(effect).sourceActorUuid === actor.uuid)
  });
  if (!targets) return false;
  const target = targets[0],
    effects = nightmareFears(target.actor).filter(
      effect => nightmareFearData(effect).sourceActorUuid === actor.uuid && !nightmareFearData(effect).manifested
    ),
    selected = await askOwner(actor, {
      title: "Какой страх проверять",
      choices: effects.map(effect => [effect.uuid, effect.name])
    }),
    effect = effects.find(effect => effect.uuid === selected);
  if (!effect) return false;
  const data = nightmareFearData(effect),
    timing = await askOwner(gm(actor), {
      title: "Момент условия",
      choices: [
        ["normal", "Не конец хода цели"],
        ["end", "Конец хода цели: после проявления сразу спасбросок снятия"]
      ]
    });
  if (!["normal", "end"].includes(timing)) return false;
  return triggerNightmareFear({
    id: requestId,
    sourceActorUuid: actor.uuid,
    sourceTokenUuid: data.sourceTokenUuid,
    sourceItemUuid: data.sourceItemUuid,
    targetTokenUuid: target.uuid,
    effectUuid: effect.uuid,
    nonce: data.nonce,
    dc: data.dc,
    epoch: nightmareTargetEpoch(target),
    timing
  });
}
async function awaken(actor, activity, source, requestId) {
  const combat = encounterForScene(source.parent, source),
    snapshot = combat && combatTurnSnapshot(combat),
    turn = turnKey(combat);
  if (snapshot?.current.token?.uuid !== source.uuid || !turn)
    throw Error("Пробуждение испуга требует собственного хода в бою.");
  if ((actor.getFlag(MODULE_ID, "nightmareAwakenTurns") ?? []).includes(turn)) return false;
  const rows = (actor.getFlag(MODULE_ID, "nightmareDamageApplications") ?? []).filter(
      row => row.turn === turn && row.own && row.sourceUuid === source.uuid
    ),
    choices = [];
  for (const row of rows)
    for (const target of row.targets ?? [])
      if (!choices.some(entry => entry.uuid === target.uuid)) {
        const doc = await fromUuid(target.uuid);
        if (
          doc?.actor &&
          Number(doc.actor.system.attributes.hp.value) >= 1 &&
          doc.parent.id === source.parent.id &&
          inFeet(source, doc, 60, source.parent)
        )
          choices.push(target);
      }
  const picked = await askOwner(actor, {
      title: "Получившее подтверждённый урон существо",
      choices: choices.map(target => [target.uuid, target.name ?? "Цель полученного урона"])
    }),
    chosen = choices.find(entry => entry.uuid === picked);
  if (!chosen) return false;
  const target = await fromUuid(chosen.uuid);
  if (
    !(await confirmOwner(
      gm(actor),
      "Пробуждение испуга",
      "Кошмар видит выбранную цель в 60 футах, у неё ≥1 хита, и именно его атака/заклинание нанесла ей подтверждённый урон в этот ход?"
    ))
  )
    return false;
  const immunities = target.actor.system.traits?.ci?.value,
    immune = immunities?.has?.("frightened") || immunities?.includes?.("frightened");
  let override = false,
    featureUse = null;
  if (immune) {
    const inevitable = findFeature(actor, "nightmare-inevitable");
    if (nightmareLevel(actor) < 3 || !inevitable || itemUses(inevitable).remaining < 1) {
      notify("У цели иммунитет к испугу; применение отменено до расхода реакции.", "warn");
      return false;
    }
    override = await confirmOwner(
      actor,
      "Неотвратимый ужас",
      "Потратить одно использование, заменив иммунитет этой цели сопротивлением именно для этого применения до спасброска? Она получит преимущество."
    );
    if (!override) return false;
    featureUse = inevitable;
  }
  const expense = nightmareExpense(activity, { activation: "reaction", featureUse }),
    dc = nightmareDC(actor);
  if (dc == null) return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "nightmare-awaken", activityUuid: activity.uuid },
    () => useNativeUtility(activity, { dataPatch: expense }),
    async () => {
      await actor.setFlag(
        MODULE_ID,
        "nightmareAwakenTurns",
        [...(actor.getFlag(MODULE_ID, "nightmareAwakenTurns") ?? []), turn].slice(-40)
      );
      await recordModuleReaction(actor, source.parent);
      const result = await useAuraPulse({
        scene: source.parent,
        sourceToken: object(source),
        sourceItem: activity.item,
        targets: [object(target)],
        eventKey: requestId,
        event: {
          save: "wis",
          dc: String(dc),
          damage: [],
          onSave: "none",
          returnSaveOutcome: true,
          metadata: { nightmareOverrideAdvantage: override }
        }
      });
      if (result?.status !== "success") return { status: "needs-review" };
      if (result.failedSaves.includes(target.uuid))
        return applyNightmareFrightened(actor, activity.item, source, target, { requestId, override });
      return true;
    }
  );
}
async function suppress(actor, activity, source, requestId) {
  const targets = await chooseTargets(actor, activity.item, source, {
    relation: token => Number(token.actor.system.attributes.hp.value) >= 1 && nightmareFrightened(token.actor)
  });
  if (!targets) return false;
  const target = targets[0];
  if (
    !(await confirmOwner(
      gm(actor),
      "Подавление всех источников испуга",
      "Можно снять frightened из этих эффектов, сохранив их прочие изменения/состояния? Навязанные страхи и продолжающиеся проявления НЕ удаляются."
    ))
  )
    return false;
  const effects = [...(target.actor.effects ?? [])].filter(
    effect => isEffectActive(effect) && [...(effect.statuses ?? [])].includes("frightened")
  );
  if (!effects.length) return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "nightmare-suppress", activityUuid: activity.uuid },
    () => useNativeUtility(activity, { dataPatch: nightmareExpense(activity, { cost: 1, activation: "bonus" }) }),
    async () => {
      for (const effect of effects) {
        if (!isEffectActive(effect)) continue;
        const rest = [...(effect.statuses ?? [])].filter(status => status !== "frightened");
        if (!rest.length && !nightmareFearData(effect) && !(effect.system?.changes ?? []).length) await effect.delete();
        else await effect.update({ statuses: rest });
      }
      return nightmareFrightened(target.actor) ? { status: "needs-review" } : true;
    }
  );
}
async function increase(actor, activity, requestId) {
  if (actor.getFlag(MODULE_ID, "nightmareIncrease")) return false;
  const ability = nightmareState(actor).ability;
  if (!["wis", "cha"].includes(ability)) throw Error("Сначала выберите Характеристику кошмара.");
  const mode = await askOwner(actor, {
    title: "Увеличение характеристик Кошмара",
    choices: [
      ["ability", "Характеристика кошмара и максимум +2"],
      ["feat", "Черта штатно, если разрешена кампанией"]
    ]
  });
  if (!["ability", "feat"].includes(mode)) return false;
  if (
    mode === "feat" &&
    !(await confirmOwner(
      gm(actor),
      "Черты в кампании",
      "В этой кампании черты разрешены, и будет выбрана ровно одна черта вместо +2?"
    ))
  )
    return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "nightmare-increase", activityUuid: activity.uuid },
    async () => true,
    async () => {
      await actor.setFlag(MODULE_ID, "nightmareIncrease", { mode, ability });
      await syncNightmare(actor);
      if (mode === "feat") notify("Добавьте одну выбранную черту штатно; характеристика не увеличена.");
      return true;
    }
  );
}
async function blindSpot(actor, activity, source, requestId) {
  const targets = await chooseTargets(actor, activity.item, source, {
    min: 1,
    max: Math.max(1, [...source.parent.tokens].length),
    relation: token => nightmareFrightened(token.actor) || nightmareManifested(token.actor, actor.uuid)
  });
  if (!targets) return false;
  if (
    !(await confirmOwner(
      gm(actor),
      "Слепое пятно: число существ",
      "Включены ВСЕ видимые подходящие существа, испуганные или с проявлением именно ваших страхов в 60 футах? Несколько токенов одной сущности считаются один раз."
    ))
  )
    return false;
  const count = new Set(targets.map(token => token.actor.uuid)).size,
    current = [...(actor.concentration?.effects ?? [])],
    replacing = current.length >= Number(actor.system.attributes.concentration?.limit ?? 1);
  if (
    replacing &&
    !(await confirmOwner(actor, "Слепое пятно: концентрация", "Завершить текущую концентрацию для новой?"))
  )
    return false;
  const expense = nightmareExpense(activity, { cost: 2, activation: "bonus" });
  return applyNativeOnce(
    actor,
    { requestId, action: "nightmare-blind-spot", activityUuid: activity.uuid },
    () => useNativeUtility(activity, { dataPatch: expense }),
    async () => {
      const live = [...(actor.concentration?.effects ?? [])];
      if (
        live.length >= Number(actor.system.attributes.concentration?.limit ?? 1) &&
        live.some(effect => !current.some(old => old.uuid === effect.uuid))
      )
        return { status: "needs-review" };
      if (replacing) for (const effect of current) await actor.endConcentration(effect);
      const combat = encounterForScene(source.parent, source),
        duration = combat
          ? {
              start: CONFIG.ActiveEffect.documentClass.getEffectStart(combat),
              duration: { value: count, units: "rounds", expiry: "turnStart", expired: false }
            }
          : temporaryEffectTiming({ seconds: count * 6, actor });
      const effect = await actor.beginConcentrating(summonConcentrationActivity(activity, count * 6), {
        ...duration,
        statuses: ["concentrating", "invisible"],
        flags: {
          [MODULE_ID]: { nightmareBlindSpot: { count, sourceTokenUuid: source.uuid } },
          dae: { expiryMode: "delete" }
        }
      });
      return effect ? true : { status: "needs-review" };
    }
  );
}
async function echo(actor, activity, requestId) {
  const now = Number(game.time.worldTime),
    rows = (actor.getFlag(MODULE_ID, "nightmareHistory") ?? []).filter(
      row => row.time >= now - 86400 && row.time <= now
    ),
    choice = await askOwner(actor, {
      title: "Цель испуга/страха за последние 24 часа",
      choices: rows.map(row => [row.actorUuid, row.name])
    }),
    target = rows.find(row => row.actorUuid === choice);
  if (!target) return false;
  const expense = nightmareExpense(activity, { cost: 1, activation: "action" });
  return applyNativeOnce(
    actor,
    { requestId, action: "nightmare-echo", activityUuid: activity.uuid },
    () => useNativeUtility(activity, { dataPatch: expense }),
    async () => {
      await actor.createEmbeddedDocuments("ActiveEffect", [
        {
          name: "Отголосок: отслеживание",
          img: activity.item.img,
          type: "base",
          origin: activity.item.uuid,
          transfer: false,
          disabled: false,
          statuses: [],
          ...temporaryEffectTiming({ seconds: 600, actor }),
          flags: {
            [MODULE_ID]: { nightmareEcho: { actorUuid: target.actorUuid, tokenUuid: target.tokenUuid } },
            dae: { expiryMode: "delete" }
          },
          system: { changes: [] }
        }
      ]);
      notify(
        "Отголосок: GM сообщает направление к выбранной цели в пределах 1 мили на том же плане. Скрытые координаты не раскрываются."
      );
      return true;
    }
  );
}
async function command(actor, activity, source, requestId) {
  if (isAuraIncapacitated(actor)) return false;
  const summoned = nightmareSummons(actor);
  if (!summoned.length) return false;
  const high = nightmareLevel(actor) >= 5,
    combat = encounterForScene(source.parent, source);
  if (high && (!combat || combatTurnSnapshot(combat).current.token?.uuid !== source.uuid)) {
    notify("Без действия командуют только в свой ход; вне боя момент подтверждает GM.", "warn");
    if (
      combat ||
      !(await confirmOwner(
        gm(actor),
        "Команда вне боя",
        "Подтверждено собственное действие/ход владельца для команды без действия?"
      ))
    )
      return false;
  }
  if (
    !(await confirmOwner(
      gm(actor),
      "Мысленная команда призыву",
      "Существо в пределах 1 мили и на том же плане; оно выполнит команду в свой следующий ход, иначе только Уклонение?"
    ))
  )
    return false;
  const expense = nightmareExpense(activity, { activation: high ? "special" : "bonus" });
  return applyNativeOnce(
    actor,
    { requestId, action: "nightmare-command", activityUuid: activity.uuid },
    () => useNativeUtility(activity, { dataPatch: expense }),
    async () => {
      for (const creature of summoned)
        await creature.setFlag(MODULE_ID, "nightmareCommand", {
          requestId,
          time: Number(game.time.worldTime),
          sourceTokenUuid: source.uuid
        });
      notify("Команда подтверждена. Определите доступное действие и движение призыва в его следующий ход вручную.");
      return true;
    }
  );
}
async function scoutSenses(actor, activity, source, requestId) {
  const scout = nightmareSummons(actor).find(
    creature => creature.getFlag(MODULE_ID, "summonKind") === "nightmare-scout"
  );
  if (
    !scout ||
    !(await confirmOwner(
      gm(actor),
      "Чужие чувства",
      "Соглядатай находится в 1 миле на том же плане? Вы воспринимаете его чувства, не свои, до начала следующего хода."
    ))
  )
    return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "nightmare-scout-senses", activityUuid: activity.uuid },
    () => useNativeUtility(activity, { dataPatch: nightmareExpense(activity, { activation: "action" }) }),
    async () => {
      const effect = await addCombatBenefit(source, source, activity.item, {
        kind: "nightmare-scout-senses",
        expiry: "sourceStart",
        remaining: null,
        scoutUuid: scout.uuid
      });
      await effect.update({
        [`flags.${MODULE_ID}.nightmareSummonEffect`]: scout.getFlag(MODULE_ID, "summonRequestId")
      });
      if (!encounterForScene(source.parent, source))
        await effect.update({ start: null, duration: { value: null, units: "seconds", expiry: null, expired: false } });
      notify(
        "Чужие чувства: переключите восприятие/управление на Соглядатая с GM. Неверная постоянная слепота владельцу не выдаётся."
      );
      return true;
    }
  );
}
registerGmRequest("nightmare-action", (actor, data, { requestId }) =>
  serialMutation(`nightmare:${actor.uuid}`, async () => {
    if (!enabled() || !isGmAuthority()) return false;
    const previous = nativeApplicationReply(actor, requestId);
    if (previous) return previous;
    const activity = await fromUuid(data.activityUuid),
      source = data.sourceUuid ? await fromUuid(data.sourceUuid) : null;
    if (activity?.actor?.uuid !== actor.uuid || !nightmareAvailable(actor, activity.item)) return false;
    await syncNightmare(actor);
    const operation = automationData(activity).nightmareOperation;
    if (operation === "ability") return chooseAbility(actor);
    if (operation === "learn") return learnNightmareFears(actor);
    if (operation === "increase") return increase(actor, activity, requestId);
    if (operation === "echo") return echo(actor, activity, requestId);
    if (operation === "inevitable") {
      if (
        !(await confirmOwner(
          gm(actor),
          "Неотвратимый ужас во внешнем применении",
          "До спасбросков подтверждено конкретное вызывающее испуг применение/заклинание: иммунитет заменяется сопротивлением только для него, с преимуществом всех спасбросков от этого испуга?"
        ))
      )
        return false;
      return applyNativeOnce(
        actor,
        { requestId, action: "nightmare-inevitable", activityUuid: activity.uuid },
        () => useNativeUtility(activity, { dataPatch: nightmareExpense(activity, { featureUse: activity.item }) }),
        async () => {
          notify(
            "GM применяет согласованную замену иммунитета именно в исходном Midi-потоке. Другие иммунитеты/преимущества не изменены."
          );
          return true;
        }
      );
    }
    if (operation === "dismiss")
      return applyNativeOnce(
        actor,
        { requestId, action: "nightmare-dismiss", activityUuid: activity.uuid },
        async () => true,
        async () => {
          for (const summoned of nightmareSummons(actor)) await dismissSummonActor(summoned);
          return true;
        }
      );
    if (source?.actor?.uuid !== actor.uuid) return false;
    if (operation === "summon") {
      const expense = nightmareExpense(activity, { cost: 2, activation: "action" });
      return summonNightmare(actor, activity, source, {
        requestId,
        use: () => useNativeUtility(activity, { dataPatch: expense })
      });
    }
    if (operation === "command") return command(actor, activity, source, requestId);
    if (operation === "scout-senses") return scoutSenses(actor, activity, source, requestId);
    if (canvas.scene?.id !== source.parent.id || !canvas.ready)
      throw Error("Для спасбросков/выбора целей GM должен открыть сцену источника до расхода.");
    if (operation.startsWith("impose")) return impose(actor, activity, source, operation, requestId);
    if (operation === "trigger") return manualTrigger(actor, activity, source, requestId);
    if (operation === "awaken") return awaken(actor, activity, source, requestId);
    if (operation === "suppress") return suppress(actor, activity, source, requestId);
    if (operation === "external-turn") {
      const targets = await chooseTargets(actor, activity.item, source, {
        range: Infinity,
        relation: token =>
          nightmareFears(token.actor).some(effect => nightmareFearData(effect).sourceActorUuid === actor.uuid)
      });
      if (!targets) return false;
      const target = targets[0];
      if (
        encounterForScene(target.parent, target) ||
        !(await confirmOwner(
          gm(actor),
          "Внешнее начало хода (GM)",
          "Подтверждён НОВЫЙ ход этой цели вне штатного tracker, а не повтор callback? Это только обновляет границу ограничений, без спасброска и ресурса."
        ))
      )
        return false;
      return applyNativeOnce(
        actor,
        { requestId, action: "nightmare-external-turn", activityUuid: activity.uuid },
        async () => true,
        () =>
          serialMutation(`nightmare-external-turn:${target.actor.uuid}`, async () => {
            await target.actor.setFlag(
              MODULE_ID,
              "nightmareExternalTurn",
              Number(target.actor.getFlag(MODULE_ID, "nightmareExternalTurn") ?? 0) + 1
            );
            return true;
          })
      );
    }
    if (operation === "blind-spot") return blindSpot(actor, activity, source, requestId);
    return false;
  })
);
const pending = new Map();
export function controlNightmare(actor, activity) {
  const key = `${actor.uuid}:${activity.id}`;
  if (pending.has(key)) return pending.get(key);
  const task = requestGm(
    "nightmare-action",
    actor,
    { activityUuid: activity.uuid, sourceUuid: sourceTokenForActor(actor)?.document.uuid },
    { timeoutMs: 120000 }
  );
  pending.set(key, task);
  void task.finally(() => pending.delete(key)).catch(() => {});
  return task;
}
