import { MODULE_ID, SETTINGS } from "../shared/constants.mjs";
import { enabled, findFeature, itemUses, isAutomationAuthority, automationData, notify } from "../shared/helpers.mjs";
import { classLevel } from "../shared/selectors.mjs";
import { JESTER_ABILITIES, jesterMaximum } from "../shared/jester-definitions.mjs";
import {
  flaggedPassiveEffectData,
  syncFlaggedPassiveEffects,
  guardPassiveChanges
} from "../effects/passive-helpers.mjs";
import { askOwner } from "../shared/owner-prompts.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { applyNativeOnce } from "../shared/native-applications.mjs";

export const jesterLevel = actor => classLevel(actor, "jester");
export const jesterPool = actor => findFeature(actor, "jester-chaos");
export const jesterAbility = actor => actor?.getFlag?.(MODULE_ID, "jesterAbility");
export const jesterDC = actor =>
  ["dex", "cha"].includes(jesterAbility(actor))
    ? 8 + Number(actor.system.attributes.prof) + Number(actor.system.abilities[jesterAbility(actor)].mod)
    : null;
export const jesterAvailable = (actor, item) =>
  automationData(item).jesterFeature && jesterLevel(actor) >= Number(automationData(item).minimumLevel ?? 1);
export const jesterPoints = actor => itemUses(jesterPool(actor)).remaining;
export function jesterResourceState(actor) {
  const maximum = jesterMaximum(jesterLevel(actor)),
    remaining = Math.min(maximum, Math.max(0, jesterPoints(actor)));
  return { maximum, remaining, spent: maximum - remaining };
}
export function jesterRoleDefinitions(actor) {
  const role = actor.getFlag?.(MODULE_ID, "jesterRole"),
    feature = findFeature(actor, "jester-role");
  if (
    jesterLevel(actor) < 4 ||
    actor.getFlag(MODULE_ID, "jesterRoleChoice") !== "roll" ||
    !feature ||
    !JESTER_ABILITIES.includes(role?.ability)
  )
    return [];
  const cap = Number(actor._source?.system?.abilities?.[role.ability]?.max ?? CONFIG.DND5E.maxAbilityScore ?? 20);
  return [
    flaggedPassiveEffectData(MODULE_ID, "jesterRoleEffect", {
      key: feature.id,
      feature,
      name: `Жребий роли: ${role.ability.toUpperCase()}`,
      changes: [
        {
          key: `system.abilities.${role.ability}.max`,
          value: String(cap + 4),
          type: "override",
          phase: "initial",
          priority: 20
        },
        { key: `system.abilities.${role.ability}.value`, value: "4", type: "add", phase: "initial", priority: 20 }
      ]
    })
  ];
}
const syncing = new Set();
export async function syncJester(actor) {
  if (!enabled() || !isAutomationAuthority(actor)) return;
  await syncFlaggedPassiveEffects(actor, syncing, MODULE_ID, "jesterRoleEffect", jesterRoleDefinitions);
  const pool = jesterPool(actor);
  if (!pool) return;
  const next = jesterResourceState(actor),
    old = itemUses(pool);
  if (next.maximum !== old.maximum || next.spent !== old.spent)
    await pool.update({ "system.uses.max": String(next.maximum), "system.uses.spent": next.spent });
}
export async function changeJesterChaos(actor, delta) {
  if (!enabled() || !isGmAuthority() || !jesterLevel(actor) || !Number.isInteger(delta)) return false;
  return serialMutation(`jester-points:${actor.uuid}`, async () => {
    const pool = jesterPool(actor);
    if (!pool) return false;
    const current = jesterPoints(actor),
      maximum = jesterMaximum(jesterLevel(actor));
    if (delta < 0 && current < -delta) throw Error("Недостаточно очков хаоса.");
    const next = Math.min(maximum, Math.max(0, current + delta));
    await pool.update({ "system.uses.max": String(maximum), "system.uses.spent": maximum - next });
    return next - current;
  });
}
export function jesterPrerequisiteFailures(actor) {
  const failures = [];
  if (Number(actor.system?.details?.level ?? 0) < 7) failures.push("общий уровень 7");
  if (!["dex", "cha"].some(k => Number(actor.system?.abilities?.[k]?.value) >= 16))
    failures.push("Ловкость 16 или Харизма 16");
  if (!["acr", "prf", "slt", "dec"].some(k => Number(actor.system?.skills?.[k]?.value) >= 1))
    failures.push("Акробатика, Выступление, Ловкость рук или Обман");
  return failures;
}
export function validateJesterItem(item, _data, _options, userId) {
  if (userId !== game.user.id || !enabled() || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return;
  if (item.type === "class" && item.system.identifier === "jester" && item.parent) {
    const failed = jesterPrerequisiteFailures(item.parent);
    if (failed.length) {
      notify(`Арлекин: ${failed.join("; ")}.`, "warn");
      return false;
    }
  }
}
export async function chooseJesterRole(actor) {
  if (jesterLevel(actor) < 4 || !findFeature(actor, "jester-role") || actor.getFlag(MODULE_ID, "jesterRoleChoice"))
    return false;
  const choice = await askOwner(actor, {
    title: "Жребий роли",
    choices: [
      ["roll", "Случайная характеристика после продолжительного отдыха"],
      ["feat", "Выбрать черту штатно"]
    ]
  });
  if (!["roll", "feat"].includes(choice)) return false;
  await actor.setFlag(MODULE_ID, "jesterRoleChoice", choice);
  if (choice === "feat") notify("Добавьте выбранную черту штатно; случайный бонус не выдаётся.");
  return true;
}
registerGmRequest("jester-settings", (actor, data) =>
  serialMutation(`jester-settings:${actor.uuid}`, async () => {
    if (!enabled() || !isGmAuthority()) return false;
    const item = await fromUuid(data.itemUuid);
    if (item?.actor?.uuid !== actor.uuid || !jesterAvailable(actor, item)) return false;
    if (data.operation === "role" && item.system.identifier === "jester-role") return chooseJesterRole(actor);
    if (data.operation !== "ability" || item.system.identifier !== "jester-chaos" || jesterAbility(actor)) return false;
    const choices = ["dex", "cha"].filter(k => Number(actor.system.abilities[k].value) >= 16),
      choice = await askOwner(actor, {
        title: "Неизменяемая Характеристика хаоса",
        choices: choices.map(k => [k, CONFIG.DND5E.abilities?.[k]?.label ?? k])
      });
    if (!choices.includes(choice)) return false;
    await actor.setFlag(MODULE_ID, "jesterAbility", choice);
    return true;
  })
);
export async function applyJesterRoleRest(actor) {
  if (jesterLevel(actor) < 4 || !findFeature(actor, "jester-role")) return true;
  if (!actor.getFlag(MODULE_ID, "jesterRoleChoice")) await chooseJesterRole(actor);
  if (actor.getFlag(MODULE_ID, "jesterRoleChoice") !== "roll") return true;
  const definition = jesterRoleDefinitions(actor)[0],
    current = [...(actor.effects ?? [])].find(e => e.getFlag?.(MODULE_ID, "jesterRoleEffect"));
  if (current && definition && !guardPassiveChanges(current, definition, MODULE_ID)) {
    notify("Жребий роли: эффект изменён вручную. Перед заменой его должен проверить GM.", "warn");
    return { status: "needs-review" };
  }
  // Remove this rest-bound bonus first. A cancelled role choice never grants both alternatives.
  if (current) await current.delete();
  await actor.unsetFlag(MODULE_ID, "jesterRole");
  const roll = await new Roll("1d6").evaluate(),
    face = Number(roll.total);
  if (!Number.isInteger(face) || face < 1 || face > 6) throw Error("Некорректный Жребий роли.");
  await actor.setFlag(MODULE_ID, "jesterRole", { ability: JESTER_ABILITIES[face - 1], face });
  await syncJester(actor);
  await roll.toMessage?.({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: "Жребий роли: +4 к характеристике и максимуму до следующего продолжительного отдыха"
  });
  return true;
}
registerGmRequest("jester-rest", (actor, data, { requestId }) =>
  serialMutation(`jester-rest:${actor.uuid}`, async () => {
    if (!enabled() || !jesterLevel(actor) || !["short", "long"].includes(data.type)) return false;
    return applyNativeOnce(
      actor,
      { requestId, action: "jester-rest", activityUuid: null },
      async () => true,
      async () => {
        const finale = findFeature(actor, "jester-finale");
        if (finale && itemUses(finale).spent) await finale.update({ "system.uses.spent": 0 });
        return data.type === "long" ? applyJesterRoleRest(actor) : true;
      }
    );
  })
);
export function jesterRestCompleted(actor, result) {
  if (!enabled() || !jesterLevel(actor)) return Promise.resolve(false);
  const id = (result.grimgutzJesterRestId ??= result.message?.uuid ?? foundry.utils.randomID());
  return requestGm(
    "jester-rest",
    actor,
    { type: result.longRest ? "long" : result.type },
    { requestId: `jester-rest:${id}`, timeoutMs: 120000 }
  );
}
