import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, automationData, notify, itemUses } from "../shared/helpers.mjs";
import {
  dkHas,
  dkAvailable,
  dkState,
  dkDC,
  dkTransformationLevel,
  dkPatch,
  dkAnchor,
  dkReaperActive,
  dkChange,
  syncDeathknight
} from "./deathknight.mjs";
import { dkGm, dkTargets, dkExpense } from "./deathknight-use.mjs";
import { dkLevelEffects, dkLevelData, addDeathLevels, setDeathLevels } from "./deathknight-levels.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { applyNativeOnce, nativeApplicationReply } from "../shared/native-applications.mjs";
import { useNativeUtility } from "../shared/native-actions.mjs";
import { temporaryEffectTiming } from "../effects/temporary-effects.mjs";
import { recordModuleReaction, inFeet } from "../shared/combat-benefits.mjs";
import { raiseDeathknightSkeleton, specializeDeathknightSkeleton } from "./deathknight-summons.mjs";
import {
  useDeathknightFireball,
  useDeathknightSmog,
  endDeathknightSmog,
  useDeathknightCrucible
} from "./deathknight-zones.mjs";
import { migrationFingerprint } from "../shared/owned-item-migration.mjs";
import { effectKey, movementSpeed } from "../shared/system-paths.mjs";

async function bindAnchor(actor) {
  const weapons = [...(actor.items ?? [])].filter(i => i.type === "weapon"),
    uuid = await askOwner(dkGm(actor), {
      title: "Оружие, в котором заключена душа",
      choices: weapons.map(i => [i.uuid, i.name])
    }),
    weapon = weapons.find(i => i.uuid === uuid);
  if (!weapon) return false;
  if (
    !(await confirmOwner(
      dkGm(actor),
      "Якорь: подтверждение",
      "Это настоящее оружие-якорь из истории трансформации, не бесплатная смена на любое оружие? Бонус становится не ниже +3, сохраняя более сильный/нестандартный бонус."
    ))
  )
    return false;
  const raw = weapon.toObject().system.magicalBonus ?? "0",
    bonus = Number(raw);
  if (Number.isFinite(bonus) && bonus < 3) await weapon.update({ "system.magicalBonus": "3" });
  else if (!Number.isFinite(bonus))
    notify("Нестандартный бонус Якоря сохранён; GM должен проверить значение +3.", "warn");
  await weapon.setFlag(MODULE_ID, "deathknightAnchorOwner", actor.uuid);
  await dkPatch(actor, {
    anchorItemId: weapon.id,
    anchorAway: false,
    missingSince: null,
    outcastSince: null,
    outcastBaseClaim: 0,
    lockedExhaustion: 0,
    exhaustionClaim: 0
  });
  await syncDeathknight(actor);
  return true;
}
export async function deathknightSeparation(actor, operation) {
  const state = dkState(actor);
  if (operation === "return") {
    if (!dkAnchor(actor))
      throw Error(
        "Оружие-якорь должно снова находиться в инвентаре; переданную/пересозданную карточку перепривязывает GM."
      );
    if (
      !(await confirmOwner(
        dkGm(actor),
        "Возвращение Якоря",
        "Якорь при персонаже (на IV ступени — не далее 5 футов)? Истощение не снимается бесплатно; только разблокируется обычное восстановление."
      ))
    )
      return false;
    await dkPatch(actor, {
      anchorAway: false,
      missingSince: null,
      outcastSince: null,
      outcastBaseClaim: 0,
      lockedExhaustion: 0,
      exhaustionClaim: 0
    });
    await syncDeathknight(actor);
    return true;
  }
  if (operation === "away") {
    if (
      !(await confirmOwner(
        dkGm(actor),
        "Разлука с Якорем",
        "Подтверждена разлука, отключающая бонусы? На IV ступени часы считаются при расстоянии более 5 футов. Оружие не удаляется."
      ))
    )
      return false;
    await dkPatch(actor, {
      anchorAway: true,
      missingSince: state.missingSince ?? Number(game.time.worldTime),
      ...(dkHas(actor, "outcast")
        ? {
            outcastSince: state.outcastSince ?? Number(game.time.worldTime),
            outcastBaseClaim: state.outcastBaseClaim ?? Number(state.exhaustionClaim ?? 0)
          }
        : {}),
      exhaustionClaim: state.exhaustionClaim ?? 0
    });
    await syncDeathknight(actor);
    return true;
  }
  if (!state.anchorAway || state.missingSince == null) throw Error("Сначала подтвердите разлуку и её начало.");
  const elapsed = Math.max(0, Number(game.time.worldTime) - Number(state.missingSince)),
    outcast = dkHas(actor, "outcast"),
    hours = Math.floor(elapsed / 3600),
    days = Math.floor(elapsed / 86400),
    outcastSince = Number(state.outcastSince ?? game.time.worldTime),
    outcastElapsed = Math.max(0, Number(game.time.worldTime) - outcastSince),
    outcastBase = Number(state.outcastBaseClaim ?? state.exhaustionClaim ?? 0),
    owed = outcast ? outcastBase + Math.floor(outcastElapsed / 3600) + 1 + Math.floor(outcastElapsed / 86400) : days,
    delta = Math.max(0, owed - Number(state.exhaustionClaim ?? 0));
  if (!delta) return true;
  if (
    !(await confirmOwner(
      dkGm(actor),
      "Истощение разлуки (GM)",
      `Прошло ${hours} ч.; новых уровней: ${delta}. На IV учитываются почасовая разлука и отсутствие оружия немедленно/ежедневно. Подтверждаете применимость обоих условий? Значение не поднимается выше 6; смерть решает GM.`
    ))
  )
    return false;
  const current = Number(actor.system.attributes.exhaustion ?? 0),
    actual = Math.min(delta, Math.max(0, 6 - current));
  await dkPatch(actor, {
    lockedExhaustion: Number(state.lockedExhaustion ?? 0) + actual,
    exhaustionClaim: owed,
    ...(outcast ? { outcastSince, outcastBaseClaim: outcastBase } : {})
  });
  await actor.update({ "system.attributes.exhaustion": current + actual });
  return true;
}
async function levels(actor, activity, source, operation) {
  const selected = await dkTargets(dkGm(actor), source, 100000, "Цель Уровней Смерти", { self: true }),
    target = selected?.[0];
  if (!target) return false;
  const effect = dkLevelEffects(target.actor).find(e => dkLevelData(e).sourceActorUuid === actor.uuid);
  if (operation === "ability") {
    if (!effect || dkLevelData(effect).levels < 4) return false;
    const key = await askOwner(actor, {
      title: "Ослабляемая характеристика",
      choices: ["str", "dex", "con", "int", "wis", "cha"].map(k => [k, k])
    });
    if (!["str", "dex", "con", "int", "wis", "cha"].includes(key)) return false;
    const state = structuredClone(dkLevelData(effect));
    state.ability = key;
    state.abilityBase = Number(
      target.actor._source?.system?.abilities[key]?.value ?? target.actor.system.abilities[key].value
    );
    return setDeathLevels(target, state, effect);
  }
  if (
    !(await confirmOwner(
      dkGm(actor),
      "Учёт УС вручную",
      "Это подтверждённое попадание/смог вне поддерживаемого потока либо исправление GM? Одно и то же автоматическое попадание не учитывайте второй раз."
    ))
  )
    return false;
  const delta = await askOwner(dkGm(actor), {
    title: "Изменение УС",
    kind: "number",
    min: -6,
    max: 6,
    defaultValue: 1
  });
  if (!Number.isInteger(delta)) return false;
  return addDeathLevels(source, target, activity.item, delta);
}
export async function activateDeathknightReaper(actor, activity, source, requestId) {
  const seen = new Set(),
    entries = [];
  for (const token of source.parent.tokens ?? []) {
    if (!token.actor || !inFeet(source, token, 40, source.parent)) continue;
    for (const effect of dkLevelEffects(token.actor)) {
      if (seen.has(effect.uuid)) continue;
      seen.add(effect.uuid);
      const state = dkLevelData(effect);
      if (state.managed !== migrationFingerprint(effect.system.changes))
        throw Error("Есть ручные правки УС: GM должен проверить их перед высасыванием.");
      entries.push({ effect, state: structuredClone(state) });
    }
  }
  if (!entries.length) return false;
  const total = entries.reduce((n, e) => n + e.state.levels, 0);
  if (
    !(await confirmOwner(
      actor,
      "Жнец",
      `Высосать все ${total} учитываемых УС у существ в 40 футах? Это действие, не бесплатный постоянный эффект.`
    ))
  )
    return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "deathknight-reaper", activityUuid: activity.uuid },
    () => useNativeUtility(activity, { dataPatch: dkExpense(activity) }),
    async () => {
      for (const e of entries)
        if (
          !e.effect.parent?.effects?.some(x => x.uuid === e.effect.uuid) ||
          JSON.stringify(dkLevelData(e.effect)) !== JSON.stringify(e.state)
        )
          return { status: "needs-review" };
      for (const e of entries) await e.effect.delete();
      const roll = await new Roll(`${total}d8`).evaluate();
      await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: "Жнец: высосанные УС" });
      const hp = actor.system.attributes.hp;
      await actor.update({
        "system.attributes.hp.value": Math.min(Number(hp.effectiveMax ?? hp.max), Number(hp.value) + Number(roll.total))
      });
      if (total >= 6) {
        const sizes = ["tiny", "sm", "med", "lg", "huge", "grg"],
          size = sizes[Math.min(5, Math.max(0, sizes.indexOf(actor.system.traits.size)) + 1)];
        for (const old of [...(actor.effects ?? [])])
          if (old.getFlag?.(MODULE_ID, "deathknightReaper")) await old.delete();
        await actor.createEmbeddedDocuments("ActiveEffect", [
          {
            name: "Жнец: воплощение Смерти",
            img: activity.item.img,
            type: "base",
            transfer: false,
            disabled: false,
            origin: activity.item.uuid,
            statuses: [],
            ...temporaryEffectTiming({ seconds: 60, actor }),
            flags: { [MODULE_ID]: { deathknightReaper: requestId } },
            system: {
              changes: [
                dkChange("system.traits.size", size, "override"),
                dkChange(
                  effectKey("system.attributes.movement.fly"),
                  Number(movementSpeed(actor, "walk") ?? 0),
                  "upgrade",
                  "final",
                  40
                ),
                dkChange("system.traits.dr.value", "all")
              ]
            }
          }
        ]);
      }
      return true;
    }
  );
}
async function consumeSoul(actor, activity, source, requestId) {
  if (!dkReaperActive(actor)) throw Error("Пожирание Проклятых доступно в воплощении Смерти.");
  const last = actor.getFlag(MODULE_ID, "lastConfirmedDamage"),
    attack = last?.activityUuid && (await fromUuid(last.activityUuid));
  if (!last?.key || attack?.item?.id !== dkAnchor(actor)?.id)
    throw Error("Нужно подтверждённое последнее попадание Якорем.");
  if ((dkState(actor).consumedKills ?? []).includes(last.key)) return false;
  if (
    !(await confirmOwner(
      dkGm(actor),
      "Пожирание Проклятых",
      "Это попадание действительно убило живое существо (не просто 0 HP)? Потратить реакцию и поглотить его душу?"
    ))
  )
    return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "deathknight-consume", activityUuid: activity.uuid },
    () => useNativeUtility(activity, { dataPatch: dkExpense(activity, { activation: "reaction" }) }),
    async () => {
      await recordModuleReaction(actor, source.parent);
      await dkPatch(actor, { consumedKills: [...(dkState(actor).consumedKills ?? []), last.key].slice(-100) });
      await activity.item.update({ "system.uses.max": String(itemUses(activity.item).maximum + 1) });
      return true;
    }
  );
}
async function hellishSmite(actor, activity, source, requestId) {
  if (itemUses(activity.item).remaining < 1) throw Error("Нет поглощённой души для Адской кары.");
  const cards = [...(actor.items ?? [])].filter(i => i.type === "spell" || i.system.identifier === "divine-smite"),
    uuid = await askOwner(dkGm(actor), {
      title: "Точная нативная карточка Адской кары",
      choices: cards.map(i => [i.uuid, i.name])
    }),
    spell = cards.find(i => i.uuid === uuid);
  if (
    !spell ||
    !(await confirmOwner(
      dkGm(actor),
      "Адская кара",
      "Выбрана именно предусмотренная PDF Адская кара? Используется бонусным действием, без ячейки, с расходом одного права от души."
    ))
  )
    return false;
  const cast = [...(spell.system.activities?.values?.() ?? [])][0];
  if (!cast) return false;
  const data = cast.toObject();
  Object.assign(data, dkExpense(activity, { activation: "bonus", cost: 1 }));
  data.flags = { [MODULE_ID]: { action: "", deathknightResolved: true } };
  const clone = spell.clone({ system: { activities: { [cast.id]: data } } }, { keepId: true });
  return applyNativeOnce(
    actor,
    { requestId, action: "deathknight-hellish-smite", activityUuid: activity.uuid },
    () =>
      MidiQOL.completeActivityUse(
        clone.system.activities.get(cast.id),
        { midiOptions: { workflowOptions: { targetConfirmation: "default" } } },
        { configure: true }
      ),
    async () => true
  );
}
async function souvenir(actor, operation) {
  const state = dkState(actor);
  if (operation === "souvenir") {
    const rows = [...(actor.items ?? []), ...(game.items ?? [])],
      uuid = await askOwner(dkGm(actor), {
        title: "Сувенир: отдельная карточка предмета",
        choices: rows.map(i => [i.uuid, i.name])
      });
    if (
      !rows.some(i => i.uuid === uuid) ||
      !(await confirmOwner(
        dkGm(actor),
        "Сувенир",
        "Это созданный предмет: КД 14, HP 40, иммунитет к яду/психической энергии? Его целостность и плоскость контролирует GM."
      ))
    )
      return false;
    await dkPatch(actor, { souvenirUuid: uuid });
    return true;
  }
  if (!state.souvenirUuid || !(await fromUuid(state.souvenirUuid))) throw Error("Нет доступного связанного сувенира.");
  if (state.rebirthReadyAt == null) {
    if (
      !(await confirmOwner(
        dkGm(actor),
        "Сувенир: смерть",
        "Персонаж действительно убит, а сувенир нетронут на той же плоскости? Начать срок 2к4 дня, не считать 0 HP смертью автоматически?"
      ))
    )
      return false;
    const roll = await new Roll("2d4").evaluate();
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: "Сувенир: дни до возрождения" });
    await dkPatch(actor, { rebirthReadyAt: Number(game.time.worldTime) + Number(roll.total) * 86400 });
    return true;
  }
  if (Number(game.time.worldTime) < state.rebirthReadyAt) throw Error("Срок 2к4 игровых дня ещё не прошёл.");
  if (
    !(await confirmOwner(
      dkGm(actor),
      "Сувенир: возрождение",
      "Сувенир цел, плоскость совпадает и GM разместил тело в 5 футах? Восстановятся HP, но не ячейки/прочие ресурсы."
    ))
  )
    return false;
  await actor.update(
    { "system.attributes.hp.value": Number(actor.system.attributes.hp.effectiveMax ?? actor.system.attributes.hp.max) },
    { [MODULE_ID]: { skipDeathknightHealing: true } }
  );
  for (const e of [...(actor.effects ?? [])])
    if ([...(e.statuses ?? [])].some(s => ["dead", "unconscious"].includes(s)))
      await e.update({ statuses: [...e.statuses].filter(s => !["dead", "unconscious"].includes(s)) });
  await dkPatch(actor, { rebirthReadyAt: null });
  return true;
}
registerGmRequest("deathknight-action", (actor, data, { requestId }) =>
  serialMutation(`deathknight-action:${actor.uuid}`, async () => {
    if (!enabled() || !isGmAuthority()) return false;
    const old = nativeApplicationReply(actor, requestId);
    if (old) return old;
    const activity = await fromUuid(data.activityUuid);
    if (activity?.actor?.uuid !== actor.uuid || !dkAvailable(actor, activity.item)) return false;
    const op = automationData(activity).deathknightOperation;
    if (op === "status") {
      notify(
        `Рыцарь Смерти (трансформация): ${dkTransformationLevel(actor)}; Сл ${dkDC(actor)}; Якорь ${dkAnchor(actor)?.name ?? "не связан"}.`
      );
      return true;
    }
    if (op === "anchor") return bindAnchor(actor);
    if (["away", "return", "exhaustion"].includes(op)) return deathknightSeparation(actor, op);
    if (["guise", "reveal"].includes(op)) {
      if (op === "guise" && (actor.statuses?.has("unconscious") || actor.concentration?.effects?.size))
        throw Error("Концентрация/потеря сознания раскрывает истинную форму.");
      await dkPatch(actor, { appearance: op === "guise" ? "humanoid" : "true" });
      return true;
    }
    if (op === "souvenir" || op === "rebirth") return souvenir(actor, op);
    if (op === "annihilate" || op === "spell-type") {
      notify(
        op === "annihilate"
          ? "Искореняющий удар предлагается после попадания Якорем перед нативным броском урона; эта кнопка не тратит ресурс."
          : "При применении наносящего урон заклинания владелец может заменить его урон некротическим. Выбор действует только на это применение; исходная карточка не меняется."
      );
      return true;
    }
    const source = await fromUuid(data.sourceUuid);
    if (source?.actor?.uuid !== actor.uuid || !canvas.ready || canvas.scene?.id !== source.parent.id)
      throw Error("Выберите токен Рыцаря; GM должен открыть его сцену до расхода.");
    if (op === "declare") {
      const chosen = await dkTargets(dkGm(actor), source, 100000, "Носитель благословения/оружия", { self: true }),
        subject = chosen?.[0]?.actor;
      if (!subject) return false;
      const mode = await askOwner(dkGm(actor), {
        title: "GM: явно известный признак",
        choices: [
          ["controlled", "Подконтрольная нежить"],
          ["blessed", "Божественно благословлённый гуманоид"],
          ["holy", "Святой агент"],
          ["weapon", "Благословлённое оружие"],
          ["silver", "Посеребрённое оружие"],
          ["clear", "Снять флаги модуля с существа"]
        ]
      });
      if (mode === "controlled") {
        if (subject.system.details?.type?.value !== "undead") throw Error("Требуется нежить.");
        await subject.setFlag(MODULE_ID, "deathknightControlledBy", actor.uuid);
        return true;
      }
      if (mode === "clear") {
        await subject.setFlag(MODULE_ID, "deathknightBlessed", false);
        await subject.setFlag(MODULE_ID, "deathknightHolyAgent", false);
        return true;
      }
      if (mode === "blessed" || mode === "holy") {
        await subject.setFlag(MODULE_ID, mode === "blessed" ? "deathknightBlessed" : "deathknightHolyAgent", true);
        return true;
      }
      if (mode !== "weapon" && mode !== "silver") return false;
      const weapons = [...(subject.items ?? [])].filter(i => i.type === "weapon"),
        uuid = await askOwner(dkGm(actor), { title: "Конкретное оружие", choices: weapons.map(i => [i.uuid, i.name]) }),
        weapon = weapons.find(i => i.uuid === uuid);
      if (!weapon) return false;
      const value = await askOwner(dkGm(actor), {
        title: "Установить или снять признак",
        choices: [
          ["yes", "Подтверждён"],
          ["no", "Снять флаг модуля"]
        ]
      });
      if (!["yes", "no"].includes(value)) return false;
      await weapon.setFlag(MODULE_ID, mode === "weapon" ? "deathknightBlessed" : "deathknightSilver", value === "yes");
      return true;
    }
    if (op === "levels" || op === "ability") return levels(actor, activity, source, op);
    if (op === "raise" || op === "restless") return raiseDeathknightSkeleton(actor, activity, source, op, requestId);
    if (op === "specialize") return specializeDeathknightSkeleton(actor, source);
    if (op === "fireball") return useDeathknightFireball(actor, activity, source, requestId);
    if (op === "smog") return useDeathknightSmog(actor, activity, source, requestId);
    if (op === "end-smog") return endDeathknightSmog(actor, source);
    if (["crucible", "expand", "end-crucible"].includes(op))
      return useDeathknightCrucible(actor, activity, source, requestId, op);
    if (op === "reaper") return activateDeathknightReaper(actor, activity, source, requestId);
    if (op === "consume") return consumeSoul(actor, activity, source, requestId);
    if (op === "hellish-smite") return hellishSmite(actor, activity, source, requestId);
    if (op === "end-reaper") {
      for (const e of [...actor.effects]) if (e.getFlag?.(MODULE_ID, "deathknightReaper")) await e.delete();
      return true;
    }
    return false;
  })
);
const pending = new Map();
export function controlDeathknight(actor, activity) {
  const key = `${actor.uuid}:${activity.uuid}`;
  if (pending.has(key)) return pending.get(key);
  const source =
    canvas.tokens?.controlled?.map(t => t.document).find(t => t.actor?.uuid === actor.uuid) ??
    canvas.tokens?.placeables?.map(t => t.document).find(t => t.actor?.uuid === actor.uuid);
  const task = requestGm(
    "deathknight-action",
    actor,
    { activityUuid: activity.uuid, sourceUuid: source?.uuid },
    { timeoutMs: 180000 }
  ).finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}
