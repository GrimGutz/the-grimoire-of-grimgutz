import { MODULE_ID, SETTINGS } from "../shared/constants.mjs";
import { enabled, findFeature, itemUses, isAutomationAuthority, notify, automationData } from "../shared/helpers.mjs";
import { doomedTotalLevel, doomedMaximum, doomedFeet } from "../shared/doomed-definitions.mjs";
import {
  doomedLevel,
  doomedState,
  doomedAccepted,
  doomedOccupied,
  doomedCurseActive,
  doomedGiftActive,
  doomedEmpowered
} from "../shared/doomed-state.mjs";
import { flaggedPassiveEffectData, syncFlaggedPassiveEffects } from "../effects/passive-helpers.mjs";
import { requestGm, registerGmRequest, isGmAuthority } from "../shared/gm-requests.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { applyNativeOnce } from "../shared/native-applications.mjs";
import { effectKey } from "../shared/system-paths.mjs";
const change = (key, value, type = "add", phase = "initial", priority = 20) => ({
  key,
  value: String(value),
  type,
  phase,
  priority
});
export function doomedAvailable(actor, item) {
  const data = automationData(item);
  const key = item?.system?.identifier;
  return (
    key?.startsWith("doomed-") &&
    doomedLevel(actor) >= Number(data.minimumLevel ?? item.system.prerequisites?.level ?? 1) &&
    (!key.startsWith("doomed-curse-") || doomedGiftActive(actor, key.slice(13)))
  );
}
export function doomedPrerequisiteFailures(actor, incoming = 1) {
  const failed = [];
  if (doomedTotalLevel(actor) + Number(incoming) < 5) failed.push("общий уровень 5 с учётом получаемого уровня");
  if (Number(actor.system?.abilities?.con?.value ?? 0) < 16) failed.push("Телосложение 16");
  if (!["wis", "cha"].some(k => Number(actor.system?.abilities?.[k]?.value ?? 0) >= 16))
    failed.push("Мудрость 16 или Харизма 16");
  return failed;
}
export function validateDoomedItem(item, _data, _options, userId) {
  if (userId !== game.user.id || !enabled() || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return;
  if (item.type === "class" && item.system.identifier === "doomed" && item.parent) {
    const failed = doomedPrerequisiteFailures(item.parent, Number(item.system.levels ?? 1));
    if (failed.length) {
      notify(`Обречённый: ${failed.join("; ")}.`, "warn");
      return false;
    }
  }
}
export function doomedPassiveDefinitions(actor) {
  if (!actor.system?.attributes?.hp) return [];
  const result = [],
    make = (entry, kind, changes, statuses = []) => {
      if (!changes.length && !statuses.length) return;
      const data = flaggedPassiveEffectData(MODULE_ID, "doomedPassive", {
        key: `${entry.id}:${kind}`,
        feature: findFeature(actor, entry.key),
        name: `${entry.name}: ${kind === "gift" ? "дар" : "проклятие"}`,
        img: entry.img,
        changes
      });
      data.statuses = statuses;
      result.push(data);
    };
  const level = doomedTotalLevel(actor);
  let hpBonus = 0;
  for (const entry of doomedAccepted(actor)) {
    if (!doomedCurseActive(actor, entry.id)) continue;
    const id = entry.id,
      amp = doomedEmpowered(actor, id),
      gift = !(doomedState(actor).suppressed ?? []).includes(id),
      drawback = [],
      boon = [],
      statuses = [];
    const resistance = (type, immune = false) => boon.push(change(`system.traits.${immune ? "di" : "dr"}.value`, type));
    if (id === "silence") {
      boon.push(change("system.skills.ste.roll.mode", 1, "upgrade", "final"));
      if (amp) boon.push(change("system.skills.ste.roll.min", 10, "upgrade", "final"));
    }
    if (id === "heart") {
      resistance("psychic", amp);
      if (amp) for (const status of ["charmed", "frightened"]) boon.push(change("system.traits.ci.value", status));
    }
    if (id === "wounds") {
      drawback.push(change("system.attributes.death.roll.mode", -1, "downgrade", "final"));
      if (gift) hpBonus += level * (amp ? 2 : 1);
    }
    if (id === "soul")
      for (const ability of ["wis", "cha"])
        drawback.push(change(effectKey(`system.abilities.${ability}.bonuses.save`), amp ? -4 : -2));
    if (id === "truth") boon.push(change("system.skills.ins.roll.mode", 1, "upgrade", "final"));
    if (id === "luck") drawback.push(change("system.attributes.init.roll.mode", -1, "downgrade", "final"));
    if (id === "mind") drawback.push(change("system.abilities.int.save.roll.mode", -1, "downgrade", "final"));
    if (id === "grave") {
      const units = actor.system.attributes.movement?.units,
        step = doomedFeet(amp ? 10 : 5, units),
        minimum = doomedFeet(5, units);
      drawback.push(
        change(effectKey("system.attributes.movement.walk"), -step, "add", "final"),
        change(effectKey("system.attributes.movement.walk"), minimum, "upgrade", "final", 21)
      );
    }
    if (id === "flesh") {
      hpBonus -= level * (amp ? 3 : 2);
      for (const type of ["bludgeoning", "piercing", "slashing", "necrotic"]) resistance(type);
    }
    if (id === "cold") drawback.push(change("system.traits.dv.value", "fire"));
    if (id === "shadow" && amp) drawback.push(change("system.attributes.ac.bonus", -3));
    if (id === "moment") {
      for (const kind of ["mwak", "rwak", "msak", "rsak"])
        boon.push(change(`system.bonuses.${kind}.attack`, amp ? 2 : 1));
      boon.push(change("system.bonuses.spell.dc", amp ? 2 : 1));
    }
    if (id === "bones") {
      for (const type of amp ? ["bludgeoning", "piercing", "slashing"] : ["bludgeoning"])
        drawback.push(change("system.traits.dv.value", type));
      boon.push(
        change(
          effectKey("system.attributes.movement.fly"),
          doomedFeet(amp ? 60 : 30, actor.system.attributes.movement?.units),
          "upgrade",
          "final"
        ),
        change("system.attributes.movement.hover", "true", "override")
      );
    }
    if (id === "chains" && amp)
      for (const mode of ["walk", "burrow", "climb", "fly", "swim"])
        drawback.push(change(effectKey(`system.attributes.movement.${mode}`), 0, "override", "final", 100));
    if (id === "buried" && amp)
      for (const status of ["grappled", "restrained"]) boon.push(change("system.traits.ci.value", status));
    if (id === "revelation") {
      boon.push(
        change(
          effectKey("system.attributes.senses.truesight"),
          doomedFeet(60, actor.system.attributes.senses?.units),
          "upgrade",
          "final"
        )
      );
      if (amp) statuses.push("deafened");
    }
    make(entry, "curse", drawback, statuses);
    const before = result.length;
    make(entry, "gift", boon);
    if (!gift && result.length > before) {
      const data = result.at(-1);
      data.disabled = true;
      Object.assign(data.flags[MODULE_ID], { doomedSuppressed: true, doomedOriginalDisabled: false });
    }
  }
  const current = [...(actor.effects ?? [])].find(e => e.getFlag?.(MODULE_ID, "doomedPassive") === "hp"),
    active = current && !current.disabled && !current.isSuppressed && !current.duration?.expired,
    old = active ? Number(current.system?.changes?.[0]?.value ?? 0) : 0,
    baseline = doomedMaximum(actor) - old,
    offset = Math.max(1 - baseline, hpBonus);
  if (offset)
    result.push(
      flaggedPassiveEffectData(MODULE_ID, "doomedPassive", {
        key: "hp",
        feature: findFeature(actor, "doomed-curses"),
        name: "Обречённый: итог максимума хитов",
        changes: [change("system.attributes.hp.tempmax", offset)]
      })
    );
  const increase = actor.getFlag?.(MODULE_ID, "doomedIncrease");
  if (
    increase?.mode === "abilities" &&
    ["str", "dex", "con", "int", "wis", "cha"].includes(increase.raise) &&
    ["str", "dex", "con", "int", "wis", "cha"].includes(increase.lower) &&
    increase.raise !== increase.lower
  ) {
    const cap = Number(actor._source?.system?.abilities?.[increase.raise]?.max ?? CONFIG.DND5E.maxAbilityScore ?? 20);
    result.push(
      flaggedPassiveEffectData(MODULE_ID, "doomedPassive", {
        key: "increase",
        feature: findFeature(actor, "doomed-increase"),
        name: "Проклятое увеличение",
        changes: [
          change(`system.abilities.${increase.raise}.max`, cap + 3, "override"),
          change(`system.abilities.${increase.raise}.value`, 3),
          change(`system.abilities.${increase.lower}.value`, -2)
        ]
      })
    );
  }
  return result;
}
const syncing = new Set();
export async function syncDoomed(actor) {
  if (!enabled() || !isAutomationAuthority(actor) || !actor.system?.attributes?.hp) return;
  const ownEffects = [...(actor.effects ?? [])].filter(effect => effect.getFlag?.(MODULE_ID, "doomedPassive"));
  if (!doomedLevel(actor) && !actor.getFlag?.(MODULE_ID, "doomedIncrease") && !ownEffects.length) return;
  const changedMaximum = ownEffects.some(effect =>
    ["hp", "increase"].includes(effect.getFlag(MODULE_ID, "doomedPassive"))
  );
  // Suppression is reversible state, not deletion of a possibly user-edited gift.
  for (const effect of actor.effects ?? []) {
    const key = effect.getFlag?.(MODULE_ID, "doomedPassive");
    if (!key?.endsWith(":gift")) continue;
    const id = key.slice(0, -5),
      suppressed = (doomedState(actor).suppressed ?? []).includes(id),
      wasSuppressed = effect.getFlag(MODULE_ID, "doomedSuppressed");
    if (suppressed && !wasSuppressed)
      await effect.update({
        disabled: true,
        [`flags.${MODULE_ID}.doomedSuppressed`]: true,
        [`flags.${MODULE_ID}.doomedOriginalDisabled`]: Boolean(effect.disabled)
      });
    else if (suppressed && !effect.disabled) await effect.update({ disabled: true });
    else if (!suppressed && wasSuppressed)
      await effect.update({
        disabled: Boolean(effect.getFlag(MODULE_ID, "doomedOriginalDisabled")),
        [`flags.${MODULE_ID}.-=doomedSuppressed`]: null,
        [`flags.${MODULE_ID}.-=doomedOriginalDisabled`]: null
      });
  }
  await syncFlaggedPassiveEffects(actor, syncing, MODULE_ID, "doomedPassive", doomedPassiveDefinitions);
  // Persist a real clamp. Leaving a larger raw HP value would silently heal when the maximum rises later.
  const raw = Number(actor._source?.system?.attributes?.hp?.value),
    prepared = Number(actor.system.attributes.hp.value);
  if (
    (changedMaximum ||
      [...(actor.effects ?? [])].some(effect =>
        ["hp", "increase"].includes(effect.getFlag?.(MODULE_ID, "doomedPassive"))
      )) &&
    Number.isFinite(raw) &&
    Number.isFinite(prepared) &&
    prepared < raw
  )
    await actor.update({ "system.attributes.hp.value": prepared });
  for (const id of ["endurance", "shared-fate", "defiance", "empower"]) {
    const item = findFeature(actor, `doomed-${id}`);
    if (!item) continue;
    const period = doomedLevel(actor) >= 5 ? "sr" : "lr",
      recovery = [{ period, type: "recoverAll" }];
    if (JSON.stringify(item.system.uses.recovery) !== JSON.stringify(recovery))
      await item.update({ "system.uses.recovery": recovery });
  }
  for (const entry of doomedAccepted(actor)) {
    const item = findFeature(actor, entry.key);
    if (!item) continue;
    const maximum = ["soul", "shadow"].includes(entry.id)
      ? Number(actor.system.attributes.prof)
      : entry.id === "luck"
        ? doomedEmpowered(actor, "luck") && doomedGiftActive(actor, "luck")
          ? 2
          : 1
        : null;
    if (maximum != null && itemUses(item).maximum !== maximum)
      await item.update({ "system.uses.max": String(maximum) }); // Never erase spent uses when empowerment ends.
  }
}
export function prepareDoomedRest(actor, result, config) {
  if (!enabled() || !doomedLevel(actor)) return;
  const long = (config?.type ?? result.type) === "long" || result.longRest;
  const amplification = doomedState(actor).amplification,
    elapsed = Math.max(0, Number(config?.duration) || 0) * 60;
  // Native duration is minutes. A completed rest really took that time even
  // when its initiator is a player or advanceTime is disabled.
  const endAmplification =
    amplification && Number(amplification.until) <= Number(game.time.worldTime) + elapsed ? amplification.id : null;
  result.doomedRest = {
    long,
    endAmplification,
    full: Number(result.updateData?.["system.attributes.hp.value"]) === doomedMaximum(actor)
  };
  if (
    !endAmplification &&
    doomedCurseActive(actor, "hunger") &&
    doomedEmpowered(actor, "hunger") &&
    Object.hasOwn(result.updateData ?? {}, "system.attributes.hp.value")
  ) {
    result.updateData["system.attributes.hp.value"] = Number(actor.system.attributes.hp.value);
    result.doomedRest.full = false;
  }
}
registerGmRequest("doomed-rest", (actor, data, { requestId }) =>
  serialMutation(`doomed:${actor.uuid}`, async () => {
    if (!enabled() || !isGmAuthority() || !doomedLevel(actor)) return false;
    return applyNativeOnce(
      actor,
      { requestId, action: "doomed-rest", activityUuid: null },
      async () => true,
      async () => {
        const long = data.long === true,
          state = structuredClone(doomedState(actor)),
          ending = Boolean(data.endAmplification && data.endAmplification === state.amplification?.id);
        if (long) state.suppressed = [];
        if (ending) delete state.amplification;
        if (long || ending) await actor.setFlag(MODULE_ID, "doomedState", state);
        if (ending)
          for (const effect of [...actor.effects])
            if (effect.getFlag?.(MODULE_ID, "doomedAmplification") === data.endAmplification) await effect.delete();
        await syncDoomed(actor);
        if (long && data.full && !doomedEmpowered(actor, "hunger"))
          await actor.update({ "system.attributes.hp.value": doomedMaximum(actor) });
        for (const id of [
          ...(long ? ["delayed-end"] : []),
          ...(long || doomedLevel(actor) >= 5 ? ["endurance", "shared-fate", "defiance", "empower"] : [])
        ]) {
          const item = findFeature(actor, `doomed-${id}`);
          if (item && itemUses(item).spent) await item.update({ "system.uses.spent": 0 });
        }
        return true;
      }
    );
  })
);
export function doomedRestCompleted(actor, result) {
  if (!enabled() || !doomedLevel(actor)) return Promise.resolve(false);
  const id = (result.grimgutzDoomedRestId ??= result.message?.uuid ?? foundry.utils.randomID());
  return requestGm(
    "doomed-rest",
    actor,
    {
      long: result.doomedRest?.long ?? result.longRest ?? result.type === "long",
      full: result.doomedRest?.full === true,
      endAmplification: result.doomedRest?.endAmplification ?? null
    },
    { requestId: `doomed-rest:${id}` }
  );
}
export {
  doomedLevel,
  doomedState,
  doomedAccepted,
  doomedOccupied,
  doomedCurseActive,
  doomedGiftActive,
  doomedEmpowered
};
