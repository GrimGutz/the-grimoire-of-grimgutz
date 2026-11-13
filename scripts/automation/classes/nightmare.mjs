import { MODULE_ID, SETTINGS } from "../shared/constants.mjs";
import { enabled, isAutomationAuthority, findFeature, itemUses, automationData, notify } from "../shared/helpers.mjs";
import { nightmareTotalLevel } from "../shared/nightmare-definitions.mjs";
import {
  nightmareLevel,
  nightmarePool,
  nightmareState,
  nightmarePoints,
  nightmareResourceState,
  nightmareKnown
} from "../shared/nightmare-state.mjs";
import { flaggedPassiveEffectData, syncFlaggedPassiveEffects } from "../effects/passive-helpers.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { applyNativeOnce } from "../shared/native-applications.mjs";
export function nightmareAvailable(actor, item) {
  const data = automationData(item);
  return (
    data.nightmareFeature &&
    nightmareLevel(actor) >= Number(data.minimumLevel ?? 1) &&
    (!data.nightmareFear || nightmareKnown(actor).some(entry => entry.id === data.nightmareFear))
  );
}
export function nightmarePrerequisiteFailures(actor, incoming = 1) {
  const failed = [];
  if (nightmareTotalLevel(actor) + Number(incoming) < 7) failed.push("общий уровень 7 с учётом получаемого уровня");
  if (!["wis", "cha"].some(key => Number(actor.system?.abilities?.[key]?.value ?? 0) >= 16))
    failed.push("Мудрость 16 или Харизма 16");
  if (!["itm", "ins"].some(key => Number(actor.system?.skills?.[key]?.value ?? 0) >= 1))
    failed.push("владение Запугиванием или Проницательностью");
  return failed;
}
export function validateNightmareItem(item, _data, _options, userId) {
  if (userId !== game.user.id || !enabled() || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return;
  if (item.type === "class" && item.system.identifier === "nightmare" && item.parent) {
    const failed = nightmarePrerequisiteFailures(item.parent, Number(item.system.levels ?? 1));
    if (failed.length) {
      notify(`Кошмар: ${failed.join("; ")}.`, "warn");
      return false;
    }
  }
}
export function nightmarePassiveDefinitions(actor) {
  const chosen = actor.getFlag?.(MODULE_ID, "nightmareIncrease"),
    ability = chosen?.ability;
  if (chosen?.mode !== "ability" || !["wis", "cha"].includes(ability)) return [];
  const cap = Number(actor._source?.system?.abilities?.[ability]?.max ?? CONFIG.DND5E.maxAbilityScore ?? 20);
  return [
    flaggedPassiveEffectData(MODULE_ID, "nightmarePassive", {
      key: "increase",
      feature: findFeature(actor, "nightmare-increase"),
      name: "Кошмар: характеристика и максимум +2",
      changes: [
        {
          key: `system.abilities.${ability}.max`,
          value: String(cap + 2),
          type: "override",
          phase: "initial",
          priority: 20
        },
        { key: `system.abilities.${ability}.value`, value: "2", type: "add", phase: "initial", priority: 20 }
      ]
    })
  ];
}
const syncing = new Set();
export async function syncNightmare(actor) {
  if (!enabled() || !isAutomationAuthority(actor)) return;
  if (
    !nightmareLevel(actor) &&
    !actor.getFlag?.(MODULE_ID, "nightmareIncrease") &&
    ![...(actor.effects ?? [])].some(e => e.getFlag?.(MODULE_ID, "nightmarePassive"))
  )
    return;
  await syncFlaggedPassiveEffects(actor, syncing, MODULE_ID, "nightmarePassive", nightmarePassiveDefinitions);
  const pool = nightmarePool(actor);
  if (pool) {
    const old = itemUses(pool),
      next = nightmareResourceState(actor);
    if (old.maximum !== next.maximum || old.spent !== next.spent)
      await pool.update({ "system.uses.max": String(next.maximum), "system.uses.spent": next.spent });
  }
  const inevitable = findFeature(actor, "nightmare-inevitable");
  if (inevitable && nightmareLevel(actor) >= 3) {
    const maximum = Number(actor.system.attributes.prof);
    if (itemUses(inevitable).maximum !== maximum) await inevitable.update({ "system.uses.max": String(maximum) });
  }
}
export async function changeNightmarePoints(actor, delta) {
  if (!enabled() || !isGmAuthority() || !nightmareLevel(actor) || !Number.isInteger(delta)) return false;
  return serialMutation(`nightmare-points:${actor.uuid}`, async () => {
    const pool = nightmarePool(actor);
    if (!pool) return false;
    const current = nightmarePoints(actor),
      maximum = nightmareResourceState(actor).maximum;
    if (delta < 0 && current < -delta) throw Error("Недостаточно очков страха.");
    const next = Math.min(maximum, Math.max(0, current + delta));
    await pool.update({ "system.uses.max": String(maximum), "system.uses.spent": maximum - next });
    return next - current;
  });
}
registerGmRequest("nightmare-rest", (actor, data, { requestId }) =>
  serialMutation(`nightmare:${actor.uuid}`, async () => {
    if (!enabled() || !isGmAuthority() || !nightmareLevel(actor) || !data.long) return false;
    return applyNativeOnce(
      actor,
      { requestId, action: "nightmare-rest", activityUuid: null },
      async () => true,
      async () => {
        await syncNightmare(actor);
        await changeNightmarePoints(actor, 2);
        const item = findFeature(actor, "nightmare-inevitable");
        if (item && itemUses(item).spent) await item.update({ "system.uses.spent": 0 });
        return true;
      }
    );
  })
);
export function nightmareRestCompleted(actor, result) {
  if (!enabled() || !nightmareLevel(actor) || !(result.longRest || result.type === "long"))
    return Promise.resolve(false);
  const id = (result.grimgutzNightmareRestId ??= result.message?.uuid ?? foundry.utils.randomID());
  return requestGm("nightmare-rest", actor, { long: true }, { requestId: `nightmare-rest:${id}` });
}
export async function rememberNightmareTarget(actor, target, kind) {
  const rows = actor.getFlag(MODULE_ID, "nightmareHistory") ?? [],
    now = Number(game.time.worldTime),
    entry = {
      actorUuid: target.actor.uuid,
      tokenUuid: target.uuid,
      name: target.hidden ? "Ранее отмеченная цель" : (target.name ?? target.actor.name),
      kind,
      time: now
    };
  await actor.setFlag(
    MODULE_ID,
    "nightmareHistory",
    [...rows.filter(row => row.time > now - 86400 && row.actorUuid !== entry.actorUuid), entry].slice(-100)
  );
}
