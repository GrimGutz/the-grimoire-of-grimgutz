import { MODULE_ID } from "../shared/constants.mjs";
import { HAG_ICON } from "../shared/hag-definitions.mjs";
import { HAG_TYPES } from "../shared/hag-definitions.mjs";
import { enabled } from "../shared/helpers.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import { applyNativeOnce } from "../shared/native-applications.mjs";
import { temporaryEffectTiming, isEffectActive } from "../effects/temporary-effects.mjs";
import { flaggedPassiveEffectData, syncFlaggedPassiveEffects } from "../effects/passive-helpers.mjs";
import { hagHas, hagCurses, hagLevel, hagDC, hagChange, hagRules } from "./hag.mjs";
import { hagGm, hagTargets, hagPulse, useHagCost } from "./hag-use.mjs";
import { effectKey, hasDeathSaveBonus } from "../shared/system-paths.mjs";
export const hagCurseData = e => e.getFlag?.(MODULE_ID, "hagCurse");
export const activeHagCurses = actor => [...(actor?.effects ?? [])].filter(e => hagCurseData(e) && isEffectActive(e));
const hasImmunity = (actor, id) =>
  actor.system?.traits?.ci?.value?.has?.(id) || actor.system?.traits?.ci?.value?.includes?.(id);
export async function applyHagCurse(source, target, item, types) {
  if (hagHas(target.actor, "body") || hasImmunity(target.actor, "cursed")) return false;
  const tier = hagLevel(source.actor),
    sea = types.includes("sea") ? Number((await new Roll(`1d4 + ${tier}`).evaluate()).total) : 0;
  // Reapplication replaces this source's curse only; other curses remain linked to their own source.
  const old = activeHagCurses(target.actor).filter(e => hagCurseData(e).sourceActorUuid === source.actor.uuid);
  const statuses = [
    ...(types.includes("green") && !hasImmunity(target.actor, "charmed") ? ["charmed"] : []),
    ...(types.includes("sea") && !hasImmunity(target.actor, "frightened") ? ["frightened"] : [])
  ];
  const [effect] = await target.actor.createEmbeddedDocuments("ActiveEffect", [
    {
      name: `${item.name}: ${source.actor.name}`,
      img: item.img,
      type: "base",
      transfer: false,
      disabled: false,
      origin: item.uuid,
      statuses,
      ...temporaryEffectTiming({ seconds: 60, actor: target.actor, expiry: "updateWorldTime" }),
      flags: {
        [MODULE_ID]: {
          hagCurse: {
            types,
            tier,
            sea,
            dc: hagDC(source.actor),
            sourceActorUuid: source.actor.uuid,
            sourceTokenUuid: source.uuid,
            sourceItemUuid: item.uuid,
            targetTokenUuid: target.uuid
          }
        },
        dae: { expiryMode: "delete" }
      },
      system: { changes: [] }
    }
  ]);
  for (const e of old) await e.delete();
  await syncHagCurseModifiers(target.actor);
  return effect;
}
const syncing = new Set();
export async function syncHagCurseModifiers(actor) {
  if (!enabled()) return;
  return syncFlaggedPassiveEffects(actor, syncing, MODULE_ID, "hagCurseModifiers", () => {
    const curses = activeHagCurses(actor).map(hagCurseData),
      night = Math.max(0, ...curses.filter(c => c.types.includes("night")).map(c => c.tier)),
      sea = Math.max(0, ...curses.filter(c => c.types.includes("sea")).map(c => c.sea)),
      changes = [];
    if (night)
      changes.push(
        hagChange(effectKey("system.bonuses.abilities.save"), `-(1d4 + ${night})`),
        ...["mwak", "rwak", "msak", "rsak"].map(k =>
          hagChange(effectKey(`system.bonuses.${k}.attack`), `-(1d4 + ${night})`)
        )
      );
    if (night && hasDeathSaveBonus(actor))
      changes.push(hagChange(effectKey("system.attributes.death.bonuses.save"), `-(1d4 + ${night})`));
    if (sea) changes.push(hagChange("system.attributes.ac.bonus", -sea));
    return changes.length
      ? [
          flaggedPassiveEffectData(MODULE_ID, "hagCurseModifiers", {
            key: "curse-modifiers",
            name: "Ведьминские проклятия: модификаторы",
            img: HAG_ICON,
            changes
          })
        ]
      : [];
  });
}
export async function castHagCurse(actor, activity, source, requestId) {
  const types = hagCurses(actor);
  if (!types.length) throw Error("Сначала выберите тип Ведьмы.");
  const targets = await hagTargets(actor, source, "Цель Проклятия: дальность подтверждает GM"),
    target = targets?.[0];
  if (!target) return false;
  if (
    !(await confirmOwner(
      hagGm(actor),
      "Проклятие: допустимость цели",
      "Цель доступна по правилу стола (PDF не задаёт дальность)? Иммунитеты и ограниченное нацеливание проверены?"
    ))
  )
    return false;
  const mode = hagRules(actor).curseMode;
  const type =
    types.length > 1 && mode !== "all"
      ? await askOwner(actor, {
          title: "Вид проклятия этого применения",
          choices: HAG_TYPES.filter(([id]) => types.includes(id))
        })
      : types[0];
  if (!types.includes(type)) return false;
  const applied = mode === "all" ? types : [type];
  return applyNativeOnce(
    actor,
    { requestId, action: "hag-curse", activityUuid: activity.uuid },
    () => useHagCost(activity, { cost: 1 }),
    async () => {
      const result = await hagPulse(source, activity.item, [target], { save: "wis", requestId: `${requestId}:save` });
      if (result.status !== "success") return { status: "needs-review" };
      if (result.failedSaves.includes(target.uuid)) await applyHagCurse(source, target, activity.item, applied);
      return true;
    }
  );
}
export async function removeHagCurses(actor) {
  for (const e of activeHagCurses(actor)) await e.delete();
  await syncHagCurseModifiers(actor);
}
export async function addHagJinx(source, target, item, kind, type = null) {
  if (hagHas(target.actor, "body")) return false;
  const statuses = kind === "paralysis" && !hasImmunity(target.actor, "paralyzed") ? ["paralyzed"] : [];
  if (kind === "paralysis" && !statuses.length) return false;
  const [effect] = await target.actor.createEmbeddedDocuments("ActiveEffect", [
    {
      name: `${item.name}: ${kind}`,
      img: item.img,
      type: "base",
      transfer: false,
      disabled: false,
      origin: item.uuid,
      statuses,
      ...temporaryEffectTiming({ seconds: 60, actor: target.actor, expiry: "updateWorldTime" }),
      flags: {
        [MODULE_ID]: {
          hagJinx: {
            kind,
            type,
            dc: hagDC(source.actor),
            sourceActorUuid: source.actor.uuid,
            sourceTokenUuid: source.uuid,
            targetTokenUuid: target.uuid,
            sourceItemUuid: item.uuid
          },
          ...(kind === "paralysis"
            ? {
                repeatSave: {
                  ability: "cha",
                  dc: hagDC(source.actor),
                  event: "turnEnd",
                  sourceTokenUuid: source.uuid,
                  targetTokenUuid: target.uuid,
                  sourceItemUuid: item.uuid,
                  damage: [],
                  metadata: { hagResolved: true }
                }
              }
            : {})
        },
        dae: { expiryMode: "delete" }
      },
      system: { changes: kind === "vulnerability" ? [hagChange("system.traits.dv.value", type)] : [] }
    }
  ]);
  return effect;
}
export async function repeatHagJinx(actor, source) {
  const targets = await hagTargets(hagGm(actor), source, "Цель собственного Сглаженного Заклинания", { self: true }),
    target = targets?.[0];
  if (!target) return false;
  const effects = [...(target.actor.effects ?? [])].filter(
    e => e.getFlag?.(MODULE_ID, "hagJinx")?.sourceActorUuid === actor.uuid && isEffectActive(e)
  );
  const uuid = await askOwner(hagGm(actor), {
      title: "Какой эффект повторяет спасбросок?",
      choices: effects.map(e => [e.uuid, e.name])
    }),
    e = effects.find(e => e.uuid === uuid);
  if (!e) return false;
  const j = e.getFlag(MODULE_ID, "hagJinx");
  if (j.kind === "paralysis")
    throw Error("Для паралича уже действует единственный автоматический повтор в конце хода.");
  const result = await hagPulse(source, await fromUuid(j.sourceItemUuid), [target], {
    save: "cha",
    dc: j.dc,
    requestId: `hag-jinx-manual:${foundry.utils.randomID()}`
  });
  if (result.status !== "success") return { status: "needs-review" };
  if (result.saves.includes(target.uuid)) await e.delete();
  return true;
}
