import { MODULE_ID } from "./constants.mjs";
import { activityActor, automationData, enabled, notify } from "./helpers.mjs";
import { registerGmRequest, requestGm } from "./gm-requests.mjs";
import { isEffectActive, temporaryEffectTiming } from "../effects/temporary-effects.mjs";
import { calculatedDamage, commitCalculatedDamage } from "../midi/damage-packet.mjs";
import { sourceTokenForActor, tokenDistance } from "./zones.mjs";
import { feetToSceneUnits } from "./spatial.mjs";

export function validateSummonActivityUse(activity) {
  if (!enabled()) return true;
  const cost = automationData(activity).summonSelfCost;
  if (!cost?.excludeTypes?.length) return true;
  const targets = [...(game.user?.targets ?? [])].filter(token => token.actor);
  if (!targets.length) {
    notify("Выберите живую цель лечения до применения способности духа.", "warn");
    return false;
  }
  const source = sourceTokenForActor(activityActor(activity));
  for (const target of targets) {
    if (cost.excludeTypes.includes(target.actor.system?.details?.type?.value)) {
      notify("Дух жизни не может лечить нежить и конструктов.", "warn");
      return false;
    }
    if (source && tokenDistance(source, target) > feetToSceneUnits(Number(activity.range?.value ?? 30))) {
      notify("Цель находится вне дальности лечения духа.", "warn");
      return false;
    }
  }
  return true;
}

registerGmRequest("spirit-protection", async (spirit, data) => {
  if (!spirit.getFlag(MODULE_ID, "summoned") || spirit.getFlag(MODULE_ID, "summonLifecycle")?.controlled === false)
    throw Error("Дух недоступен для защиты.");
  const target = await fromUuid(data.targetUuid);
  if (!target) throw Error("Цель защиты не найдена.");
  const amount = Math.max(1, Math.min(10, Number(data.amount)));
  await target.createEmbeddedDocuments("ActiveEffect", [
    {
      name: "Дух защиты",
      img: spirit.img,
      type: "base",
      transfer: false,
      origin: target.uuid,
      ...temporaryEffectTiming({ seconds: 6 }),
      flags: { [MODULE_ID]: { summonProtection: { amount, spiritUuid: spirit.uuid } } },
      system: { changes: [] }
    }
  ]);
  return { status: "success" };
});

export async function useSummonProtection(spirit) {
  const target = [...(game.user?.targets ?? [])][0]?.actor;
  if (!target) {
    notify("Выберите союзника, которому предстоит получить урон.", "warn");
    return false;
  }
  const roll = await new Roll("1d10").evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: spirit }),
    flavor: "Дух защиты: снижение следующего урона"
  });
  return requestGm("spirit-protection", spirit, { targetUuid: target.uuid, amount: roll.total });
}

export async function applySummonProtection(token, { workflow, damageItem }) {
  if (!enabled() || !token?.actor) return;
  const effect = [...(token.actor.effects ?? [])].find(
    effect => isEffectActive(effect) && effect.getFlag?.(MODULE_ID, "summonProtection")
  );
  if (!effect) return;
  const key = `${workflow?.id ?? workflow?.uuid ?? "damage"}:${token.document?.uuid ?? token.id}:${damageItem.damageSelector ?? "combinedDamage"}`;
  const reserved = effect.getFlag(MODULE_ID, "summonProtectionReserved");
  if (reserved && reserved !== key) return;
  const parts = calculatedDamage(damageItem);
  if (parts.some(part => part.active?.[MODULE_ID]?.protection)) return;
  const reservation = await requestGm("reserve-spirit-protection", workflow?.actor ?? token.actor, {
    effectUuid: effect.uuid,
    key
  });
  if (reservation.status !== "success") return;
  const protection = effect.getFlag(MODULE_ID, "summonProtection");
  let remaining = Number(protection.amount),
    reduction = 0;
  for (const part of parts) {
    if (Number(part.value) <= 0 || ["healing", "temphp", "maximum", "midi-none"].includes(part.type)) continue;
    const reduced = Math.min(Number(part.value), remaining);
    part.value -= reduced;
    remaining -= reduced;
    reduction += reduced;
    part.active ??= {};
    part.active[MODULE_ID] = { ...(part.active[MODULE_ID] ?? {}), protection: true };
  }
  if (!reduction) return;
  commitCalculatedDamage(token, damageItem, parts);
  const selector = damageItem.damageSelector ?? "combinedDamage";
  damageItem.damageDetails.calcDamageOptions ??= {};
  const options = (damageItem.damageDetails.calcDamageOptions[selector] ??= damageItem.calcDamageOptions ?? {});
  options[MODULE_ID] = { ...(options[MODULE_ID] ?? {}), protection: { effectUuid: effect.uuid, reduction, key } };
  damageItem.calcDamageOptions = options;
}

registerGmRequest("reserve-spirit-protection", async (_attacker, data) => {
  const effect = await fromUuid(data.effectUuid);
  if (!effect?.getFlag(MODULE_ID, "summonProtection")) return { status: "failed" };
  const reserved = effect.getFlag(MODULE_ID, "summonProtectionReserved");
  if (reserved && reserved !== data.key) return { status: "failed" };
  await effect.setFlag(MODULE_ID, "summonProtectionReserved", data.key);
  return { status: "success" };
});

registerGmRequest("commit-spirit-protection", async (target, data) => {
  const effect = await fromUuid(data.effectUuid);
  if (
    !effect ||
    effect.parent?.uuid !== target.uuid ||
    effect.getFlag(MODULE_ID, "summonProtectionReserved") !== data.key
  )
    return { status: "success" };
  const protection = effect.getFlag(MODULE_ID, "summonProtection");
  const spirit = await fromUuid(protection.spiritUuid);
  const reduction = Math.max(0, Math.min(Number(protection.amount), Number(data.reduction)));
  await effect.delete();
  if (spirit && reduction) await spirit.applyDamage([{ value: reduction, type: "force" }], { invertHealing: false });
  return { status: "success" };
});

registerGmRequest("summon-self-cost", async (spirit, data) => {
  const activity = await fromUuid(data.activityUuid);
  const cost = automationData(activity).summonSelfCost;
  if (!activity || activityActor(activity)?.uuid !== spirit.uuid || !cost || !spirit.getFlag(MODULE_ID, "summoned"))
    throw Error("Не найдена способность духа.");
  await spirit.applyDamage([{ value: Number(cost.value), type: cost.type }], { invertHealing: false });
  return { status: "success" };
});

export async function handleSummonSelfCost(workflow) {
  if (!enabled() || workflow?.aborted || !workflow?.activity) return;
  const activity = workflow.activity;
  if (workflow.grimgutzSelfCostApplied) return;
  if (automationData(activity).summonSelfCost) {
    workflow.grimgutzSelfCostApplied = true;
    await requestGm(
      "summon-self-cost",
      activityActor(activity),
      { activityUuid: activity.uuid },
      workflow.id ? { requestId: `self-cost:${workflow.id}:${activity.uuid}` } : {}
    );
  }
}

export function installSummonCombatHooks() {
  Hooks.on("dnd5e.preUseActivity", validateSummonActivityUse);
  Hooks.on("dnd5e.applyDamage", (actor, _amount, options) => {
    const data = options?.[MODULE_ID]?.protection;
    if (data)
      void requestGm("commit-spirit-protection", actor, data).catch(error =>
        console.error(`${MODULE_ID} | Protection confirmation failed`, error)
      );
  });
  Hooks.on("dnd5e.rollHealing", (rolls, { subject }) => {
    if (rolls?.length && !game.modules.get("midi-qol")?.active) void handleSummonSelfCost({ activity: subject });
  });
}
