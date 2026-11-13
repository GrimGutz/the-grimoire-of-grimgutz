import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, automationData, findFeature, notify } from "../shared/helpers.mjs";
import {
  broodmotherHas,
  broodmotherAvailable,
  broodmotherState,
  broodmotherDC,
  broodmotherTransformationLevel,
  broodmotherChange
} from "./broodmother.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { applyNativeOnce, nativeApplicationReply } from "../shared/native-applications.mjs";
import { useNativeUtility } from "../shared/native-actions.mjs";
import {
  broodmotherExpense,
  broodmotherTarget,
  broodmotherGm,
  broodmotherPulse,
  broodmotherCondition,
  broodmotherChooseCondition
} from "./broodmother-use.mjs";
import { summonBroodmother, summonBroodmotherHorror, dismissBroodmotherChild } from "./broodmother-summons.mjs";
import { useBroodmotherAttack } from "./broodmother-combat.mjs";
import { useBroodmotherArea, removeBroodmotherCoating, damageBroodmotherWall } from "./broodmother-zones.mjs";
import { feetToSceneUnits } from "../shared/spatial.mjs";
import { effectKey } from "../shared/system-paths.mjs";

async function spinner(actor, activity, source, operation, requestId) {
  if (operation === "escape-thread") {
    const selected = await broodmotherChooseCondition(actor, source, ["thread"], { range: 100000, self: true });
    if (!selected) return false;
    if (
      !(await confirmOwner(
        broodmotherGm(actor),
        "Освобождение от нити",
        "GM подтвердил успех предусмотренного спорным текстом броска Силы или уничтожение нити?"
      ))
    )
      return false;
    await selected.effect.delete();
    return true;
  }
  if (operation !== "spinner") {
    const link = broodmotherState(actor).thread;
    if (!link || (operation === "pull" && !link.targetUuid) || (operation === "climb-thread" && link.targetUuid))
      throw Error("Нет подходящей активной связи нити.");
    if (link.targetUuid) {
      const target = await fromUuid(link.targetUuid);
      if (
        !target?.actor ||
        ![...(target.actor.effects ?? [])].some(
          e =>
            e.getFlag?.(MODULE_ID, "broodmotherCondition")?.kind === "thread" &&
            e.getFlag(MODULE_ID, "broodmotherCondition").sourceTokenUuid === source.uuid
        )
      )
        throw Error("Цель больше не удерживается этой нитью.");
    }
    if (
      !(await confirmOwner(
        actor,
        activity.name,
        "Потратить бонусное действие? Переместите указанное существо/себя на 15 футов по разрешённой траектории вручную; стены и уступы проверяет GM."
      ))
    )
      return false;
    return applyNativeOnce(
      actor,
      { requestId, action: operation, activityUuid: activity.uuid },
      () => useNativeUtility(activity, { dataPatch: broodmotherExpense(activity, { activation: "bonus" }) }),
      async () => true
    );
  }
  const mode = await askOwner(actor, {
    title: "Прядильщик нитей",
    choices: [
      ["target", "Опутать существо"],
      ["anchor", "Точка для подъёма"]
    ]
  });
  if (!mode) return false;
  let target;
  if (mode === "target") {
    target = await broodmotherTarget(actor, source, 90, activity.item.name);
    if (!target) return false;
  }
  if (
    !(await confirmOwner(
      broodmotherGm(actor),
      "Точка нити",
      mode === "anchor"
        ? "Подтверждена незанятая точка в пределах 90 футов минимум на 10 футов выше источника? Координаты/подъём контролирует GM."
        : "Цель достижима потоком паутины в пределах 90 футов?"
    ))
  )
    return false;
  return applyNativeOnce(
    actor,
    { requestId, action: operation, activityUuid: activity.uuid },
    () => useNativeUtility(activity, { dataPatch: broodmotherExpense(activity, { activation: "bonus" }) }),
    async () => {
      if (target) {
        const result = await broodmotherPulse(source, activity.item, [target], { save: "dex", requestId });
        if (result.status !== "success") return { status: "needs-review" };
        if (!result.failedSaves.includes(target.uuid)) return true;
        await broodmotherCondition(source, target, activity.item, {
          kind: "thread",
          statuses: ["restrained"],
          extra: { ac: 10, hpPer10: 5 }
        });
      }
      await actor.setFlag(MODULE_ID, "broodmotherState", {
        ...structuredClone(broodmotherState(actor)),
        thread: { sourceTokenUuid: source.uuid, targetUuid: target?.uuid ?? null, range: 90, ac: 10, hpPer10: 5 }
      });
      return true;
    }
  );
}
export async function broodmotherContempt(actor, activity, source, requestId, { killerUuid = null } = {}) {
  if (
    !(await confirmOwner(
      broodmotherGm(actor),
      "Материнское презрение",
      "Владелец действительно видел новую смерть своего паука от другого существа? Счётчик увеличится один раз для этого события; PDF не задаёт сброс отдыхом."
    ))
  )
    return false;
  const killer = killerUuid
    ? await fromUuid(killerUuid)
    : await broodmotherTarget(broodmotherGm(actor), source, 100000, "Убийца выводка");
  if (!killer?.actor || killer.actor.uuid === actor.uuid) return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "broodmother-contempt", activityUuid: activity.uuid },
    async () => true,
    async () => {
      const deaths = Number(broodmotherState(actor).witnessedDeaths ?? 0) + 1,
        dc = broodmotherDC(actor) + 2 * deaths;
      await actor.setFlag(MODULE_ID, "broodmotherState", {
        ...structuredClone(broodmotherState(actor)),
        witnessedDeaths: deaths
      });
      const result = await broodmotherPulse(source, activity.item, [source], { save: "wis", dc, requestId });
      if (result.status !== "success") return { status: "needs-review" };
      if (result.failedSaves.includes(source.uuid)) {
        const created = await broodmotherCondition(source, source, activity.item, {
          kind: "rage",
          extra: { killerUuid: killer.uuid, dc }
        });
        for (const e of created ?? [])
          await e.setFlag(MODULE_ID, "repeatSave", {
            ability: "wis",
            dc,
            event: "turnEnd",
            sourceTokenUuid: source.uuid,
            targetTokenUuid: source.uuid,
            sourceItemUuid: activity.item.uuid,
            damage: [],
            metadata: { broodmotherResolved: true }
          });
      }
      return true;
    }
  );
}
async function mimic(actor, activity, source, operation, requestId) {
  if (operation === "mimic-end")
    return applyNativeOnce(
      actor,
      { requestId, action: operation, activityUuid: activity.uuid },
      async () => true,
      async () => {
        await actor.setFlag(MODULE_ID, "broodmotherState", {
          ...structuredClone(broodmotherState(actor)),
          mimicControl: false
        });
        for (const e of [...(actor.effects ?? [])])
          if (e.getFlag?.(MODULE_ID, "broodmotherMimicBody")) await e.delete();
        return true;
      }
    );
  if (operation === "mimic") {
    const hp = 10 * Number(actor.system.abilities.con.mod);
    if (
      !(await confirmOwner(
        broodmotherGm(actor),
        "Мимик: подготовка",
        `Подготовьте отдельного мимика: ${hp} хитов, уязвимость к огню, способности кроме Выводка/Мимикрии. Общие ресурсы, предметы и управление подтверждаются вручную: модуль их не дублирует. Привязать подготовленный токен и потратить действие?`
      ))
    )
      return false;
    const target = await broodmotherTarget(broodmotherGm(actor), source, 100000, "Подготовленный отдельный мимик");
    if (!target || target.actor.uuid === actor.uuid) return false;
    const linked = target.actor.getFlag(MODULE_ID, "broodmotherMimicOwner");
    if (linked && linked !== actor.uuid) throw Error("Этот мимик уже связан с другим владельцем.");
    return applyNativeOnce(
      actor,
      { requestId, action: operation, activityUuid: activity.uuid },
      () => useNativeUtility(activity, { dataPatch: broodmotherExpense(activity) }),
      async () => {
        await target.actor.setFlag(MODULE_ID, "broodmotherMimicOwner", actor.uuid);
        await actor.setFlag(MODULE_ID, "broodmotherState", {
          ...structuredClone(broodmotherState(actor)),
          mimicControl: true,
          mimicTokenUuid: target.uuid,
          mimicActorUuid: target.actor.uuid
        });
        await actor.createEmbeddedDocuments("ActiveEffect", [
          {
            name: "Мимикрия: исходное тело неподвижно",
            img: activity.item.img,
            type: "base",
            transfer: false,
            disabled: false,
            origin: activity.item.uuid,
            start: null,
            duration: { value: null, units: "seconds", expiry: null, expired: false },
            statuses: [],
            flags: { [MODULE_ID]: { broodmotherMimicBody: true } },
            system: {
              changes: ["walk", "fly", "swim", "climb", "burrow"].map(k =>
                broodmotherChange(effectKey(`system.attributes.movement.${k}`), 0, "override", "final", 100)
              )
            }
          }
        ]);
        return true;
      }
    );
  }
  const target = await fromUuid(broodmotherState(actor).mimicTokenUuid);
  if (
    !target?.actor ||
    target.parent.id !== source.parent.id ||
    target.actor.getFlag(MODULE_ID, "broodmotherMimicOwner") !== actor.uuid ||
    Number(target.actor.system.attributes.hp.value) > 0
  )
    throw Error("Нужен связанный погибший мимик на этой сцене.");
  if (broodmotherState(actor).explodedMimicUuid === target.uuid)
    throw Error("Этот мимик уже взрывался или его результат требует проверки.");
  if (
    !(await confirmOwner(
      actor,
      "Взрыв мимика",
      "Использовать реакцию на смерть связанного мимика? Круг 20 футов, Телосложение и 6к10 кислоты, половина при успехе."
    ))
  )
    return false;
  return applyNativeOnce(
    actor,
    { requestId, action: operation, activityUuid: activity.uuid },
    () => useNativeUtility(activity, { dataPatch: broodmotherExpense(activity, { activation: "reaction" }) }),
    async () => {
      await actor.setFlag(MODULE_ID, "broodmotherState", {
        ...structuredClone(broodmotherState(actor)),
        explodedMimicUuid: target.uuid
      });
      const size = Number(source.parent.grid.size),
        radius = (feetToSceneUnits(20, source.parent) / Number(source.parent.grid.distance ?? 5)) * size;
      const [zone] = await source.parent.createEmbeddedDocuments("Region", [
        {
          name: "Взрыв мимика",
          hidden: Boolean(target.hidden),
          shapes: [
            {
              type: "circle",
              x: target.x + (Number(target.width ?? 1) * size) / 2,
              y: target.y + (Number(target.height ?? 1) * size) / 2,
              radius
            }
          ]
        }
      ]);
      if (!zone) return { status: "needs-review" };
      const targets = MidiQOL.computeTargetsFromTemplates([zone.uuid], source.uuid, false, "any", "always").map(
        t => t.document ?? t
      );
      if (!targets.length) {
        await zone.delete();
        return true;
      }
      const result = await broodmotherPulse(source, activity.item, targets, {
        save: "con",
        damage: [{ formula: "6d10", type: "acid" }],
        onSave: "half",
        requestId
      });
      if (result.status === "success") await zone.delete();
      return result;
    }
  );
}
registerGmRequest("broodmother-action", (actor, data, { requestId }) =>
  serialMutation(`broodmother:${actor.uuid}`, async () => {
    if (!enabled() || !isGmAuthority()) return false;
    const old = nativeApplicationReply(actor, requestId);
    if (old) return old;
    const activity = await fromUuid(data.activityUuid);
    if (activity?.actor?.uuid !== actor.uuid || !broodmotherAvailable(actor, activity.item)) return false;
    const op = automationData(activity).broodmotherOperation;
    if (op === "status") {
      notify(
        `Королева Улья ${broodmotherTransformationLevel(actor)}; СЛ ${broodmotherDC(actor)}. Увиденных смертей выводка: ${broodmotherState(actor).witnessedDeaths ?? 0}.`
      );
      return true;
    }
    if (["guise", "reveal"].includes(op))
      return applyNativeOnce(
        actor,
        { requestId, action: op, activityUuid: activity.uuid },
        async () => true,
        async () => {
          if (op === "guise" && (actor.statuses?.has("unconscious") || actor.concentration?.effects?.size))
            throw Error("Концентрация/потеря сознания раскрывает истинную форму.");
          await actor.setFlag(MODULE_ID, "broodmotherState", {
            ...structuredClone(broodmotherState(actor)),
            appearance: op === "guise" ? "humanoid" : "true"
          });
          return true;
        }
      );
    if (op === "arachnomancy") {
      notify(
        "Арахномантия предлагается для конкретного нативного заклинания; исход заклинания через паука проверяет GM."
      );
      return true;
    }
    const source = await fromUuid(data.sourceUuid);
    if (source?.actor?.uuid !== actor.uuid || !canvas.ready || canvas.scene?.id !== source.parent.id)
      throw Error("Выберите токен Королевы Улья; GM должен открыть его сцену до расхода.");
    if (op === "brood") return summonBroodmother(actor, activity, source, requestId);
    if (op === "dismiss") return dismissBroodmotherChild(actor);
    if (op === "horror") return summonBroodmotherHorror(actor, activity, source, requestId);
    if (op === "legs" || op === "quill") return useBroodmotherAttack(actor, activity, source, op, requestId);
    if (op === "web" || op === "bile") return useBroodmotherArea(actor, activity, source, op, requestId);
    if (op === "escape-web" || op === "scrape")
      return removeBroodmotherCoating(actor, activity, source, op === "scrape" ? "acid" : "web", requestId);
    if (op === "damage-web") return damageBroodmotherWall(actor, source);
    if (["spinner", "pull", "climb-thread", "escape-thread"].includes(op))
      return spinner(actor, activity, source, op, requestId);
    if (op.startsWith("mimic")) return mimic(actor, activity, source, op, requestId);
    if (op === "contempt") return broodmotherContempt(actor, activity, source, requestId);
    return false;
  })
);
const pending = new Map();
export function controlBroodmother(actor, activity) {
  const key = `${actor.uuid}:${activity.uuid}`;
  if (pending.has(key)) return pending.get(key);
  const source =
    canvas.tokens?.controlled?.map(t => t.document).find(t => t.actor?.uuid === actor.uuid) ??
    canvas.tokens?.placeables?.map(t => t.document).find(t => t.actor?.uuid === actor.uuid);
  const task = requestGm(
    "broodmother-action",
    actor,
    { activityUuid: activity.uuid, sourceUuid: source?.uuid },
    { timeoutMs: 180000 }
  ).finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}
