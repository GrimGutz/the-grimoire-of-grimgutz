import { MODULE_ID, SETTINGS } from "../shared/constants.mjs";
import {
  HUNTER_ID,
  HUNTER_TIERS,
  HUNTER_TROPHIES,
  hunterMaximum,
  hunterTierChoices,
  trophyDefinition
} from "../shared/bounty-hunter-definitions.mjs";
import { enabled, automationData, findFeature, itemUses, notify, isAutomationAuthority } from "../shared/helpers.mjs";
import { classLevel } from "../shared/selectors.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { applyNativeOnce } from "../shared/native-applications.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { flaggedPassiveEffectData, syncFlaggedPassiveEffects } from "../effects/passive-helpers.mjs";
import { isEffectActive } from "../effects/temporary-effects.mjs";
import { effectKey } from "../shared/system-paths.mjs";

export const hunterLevel = actor => classLevel(actor, HUNTER_ID);
export const hunterConfig = actor => actor?.getFlag?.(MODULE_ID, "hunterConfiguration") ?? {};
export const hunterPool = actor => findFeature(actor, "hunter-trophies");
export const HUNTER_DAMAGE_TYPES = [
  "acid",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "poison",
  "psychic",
  "radiant",
  "thunder",
  "bludgeoning",
  "piercing",
  "slashing"
];
const MARTIAL_WEAPONS = new Set([
  "battleaxe",
  "blowgun",
  "flail",
  "glaive",
  "greataxe",
  "greatsword",
  "halberd",
  "handcrossbow",
  "heavycrossbow",
  "lance",
  "longbow",
  "longsword",
  "maul",
  "morningstar",
  "net",
  "pike",
  "rapier",
  "scimitar",
  "shortsword",
  "trident",
  "warpick",
  "warhammer",
  "whip"
]);
export const hunterFeet = (feet, units = "ft") => Number(feet) * (units === "m" ? 0.3048 : units === "yd" ? 1 / 3 : 1);
export function hunterDC(actor) {
  const ability = hunterConfig(actor).ability,
    mod = actor?.system?.abilities?.[ability]?.mod;
  return ["str", "dex", "wis"].includes(ability) && Number.isFinite(Number(mod))
    ? 8 + Number(actor.system.attributes.prof) + Number(mod)
    : null;
}
export function hunterFeatureAvailable(actor, item) {
  return automationData(item).hunterFeature && hunterLevel(actor) >= Number(automationData(item).minimumLevel ?? 1);
}
export function trophySnapshot(item) {
  return item?.getFlag?.(MODULE_ID, "hunterTrophyState") ?? item?.flags?.[MODULE_ID]?.hunterTrophyState ?? null;
}
export function trophyPossessed(actor, item) {
  const definition = trophyDefinition(item),
    state = trophySnapshot(item);
  return Boolean(
    definition &&
    item?.actor?.uuid === actor?.uuid &&
    hunterFeatureAvailable(actor, item) &&
    state?.confirmed &&
    state.carried &&
    !state.destroyed &&
    Number(state.cr) >= definition.cr &&
    state.creatureType === definition.creatureType
  );
}
export function selectedHunterTrophies(actor) {
  return Object.entries(hunterConfig(actor).selected ?? {}).flatMap(([tier, id]) => {
    const item = [...(actor?.items ?? [])].find(i => i.id === id),
      definition = trophyDefinition(item);
    return definition?.tier === tier && trophyPossessed(actor, item)
      ? [{ ...definition, item, snapshot: trophySnapshot(item) }]
      : [];
  });
}
export const selectedHunterTrophy = (actor, key) => selectedHunterTrophies(actor).find(e => e.key === key) ?? null;
export function hunterResourceState(actor, previous = itemUses(hunterPool(actor))) {
  const maximum = Math.max(
    0,
    hunterMaximum(hunterLevel(actor)) -
      selectedHunterTrophies(actor)
        .filter(e => e.passive)
        .reduce((sum, e) => sum + e.cost, 0)
  );
  const remaining = Math.min(maximum, Math.max(0, previous.remaining));
  return { maximum, remaining, spent: maximum - remaining };
}
const change = (key, value, type = "custom", phase = "initial") => ({
  key,
  value: String(value),
  type,
  phase,
  priority: 20
});
export function hunterPassiveDefinitions(actor) {
  return selectedHunterTrophies(actor)
    .filter(e => e.passive)
    .flatMap(entry => {
      const changes = [],
        resist = type => changes.push(change("system.traits.dr.value", type)),
        key = entry.key,
        state = entry.snapshot;
      if (key === "hunter-aberration-minor") resist("psychic");
      if (key === "hunter-construct-minor") resist("poison");
      if (key === "hunter-beast-medium")
        changes.push(
          change(
            effectKey("system.attributes.senses.blindsight"),
            hunterFeet(20, actor.system.attributes.senses?.units),
            "upgrade",
            "final"
          )
        );
      if (
        ["hunter-dragon-major", "hunter-elemental-minor"].includes(key) &&
        HUNTER_DAMAGE_TYPES.includes(state.damageType)
      )
        resist(state.damageType);
      if (key === "hunter-dragon-major")
        changes.push(
          change(effectKey("system.attributes.movement.fly"), "@attributes.movement.walk", "upgrade", "final")
        );
      if (key === "hunter-giant-medium")
        changes.push(change("system.abilities.str.check.roll.mode", 1, "upgrade", "final"));
      if (key === "hunter-humanoid-minor") {
        if (state.language) changes.push(change("system.traits.languages.value", state.language));
        if (state.tool && Object.hasOwn(CONFIG.DND5E.tools ?? {}, state.tool))
          changes.push(change(`system.tools.${state.tool}.value`, 1, "upgrade"));
      }
      if (key === "hunter-monstrosity-major")
        changes.push(
          change(
            effectKey("system.attributes.movement.walk"),
            hunterFeet(10, actor.system.attributes.movement.units),
            "add",
            "final"
          )
        );
      if (key === "hunter-ooze-major") {
        resist("acid");
        resist("bludgeoning");
      }
      if (key === "hunter-undead-minor") {
        resist("necrotic");
        changes.push(change("system.attributes.death.roll.mode", 1, "upgrade", "final"));
      }
      // Conditional advantages, breathing, jumps, size for grappling and squeezing
      // are not permanent advantage/immunity/size changes.
      return changes.length
        ? [flaggedPassiveEffectData(MODULE_ID, "hunterPassive", { key: entry.item.id, feature: entry.item, changes })]
        : [];
    });
}
const syncing = new Set();
export async function syncHunter(actor) {
  if (!enabled() || !isAutomationAuthority(actor)) return;
  // Native D&D5e tools are a MappingField, not the fixed skill schema. Supply
  // its typed, non-proficient baseline before a temporary proficiency effect.
  // Never replace an existing raw tool or grant permanent proficiency.
  for (const entry of selectedHunterTrophies(actor))
    if (
      entry.key === "hunter-humanoid-minor" &&
      CONFIG.DND5E.tools?.[entry.snapshot.tool] &&
      !actor._source?.system?.tools?.[entry.snapshot.tool]
    )
      await actor.update({
        [`system.tools.${entry.snapshot.tool}`]: {
          value: 0,
          ability: CONFIG.DND5E.tools[entry.snapshot.tool].ability ?? "int"
        }
      });
  await syncFlaggedPassiveEffects(actor, syncing, MODULE_ID, "hunterPassive", hunterPassiveDefinitions);
  const pool = hunterPool(actor);
  if (!pool) return;
  const next = hunterResourceState(actor),
    old = itemUses(pool);
  if (old.maximum !== next.maximum || old.spent !== next.spent)
    await pool.update({ "system.uses.max": String(next.maximum), "system.uses.spent": next.spent });
}
export function hunterPrerequisiteFailures(actor) {
  const failures = [];
  if (Number(actor.system?.details?.level ?? 0) < 7) failures.push("общий уровень 7");
  if (["str", "dex", "wis"].filter(key => Number(actor.system?.abilities?.[key]?.value ?? 0) >= 16).length < 2)
    failures.push("две из Силы/Ловкости/Мудрости не ниже 16");
  const prof = actor.system?.traits?.weaponProf?.value;
  const martial =
    prof?.has?.("mar") ||
    prof?.includes?.("mar") ||
    [...(prof ?? [])].some(key => MARTIAL_WEAPONS.has(key)) ||
    [...(actor.items ?? [])].some(
      i =>
        i.type === "weapon" &&
        (i.system?.proficient === true || i.system?.prof?.hasProficiency === true) &&
        String(i.system?.type?.value).startsWith("martial")
    );
  if (!martial) failures.push("владение воинским оружием");
  if (!["prc", "sur", "inv", "ste"].some(key => Number(actor.system?.skills?.[key]?.value ?? 0) >= 1))
    failures.push("Восприятие, Выживание, Расследование или Скрытность");
  return failures;
}
export function validateHunterItem(item, _data, _options, userId) {
  if (userId !== game.user.id || !enabled()) return;
  const actor = item.parent;
  if (!actor) return;
  if (
    item.type === "class" &&
    item.system?.identifier === HUNTER_ID &&
    game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)
  ) {
    const failed = hunterPrerequisiteFailures(actor);
    if (failed.length) {
      notify(`Охотник за головами: ${failed.join("; ")}.`, "warn");
      return false;
    }
  }
}
const gmActor = actor => ({ uuid: actor.uuid, testUserPermission: user => user.isGM });
export const hunterTraitChoices = entries =>
  Object.entries(entries ?? {}).flatMap(([key, value]) => {
    const label =
      game.i18n?.localize?.(typeof value === "string" ? value : (value.label ?? key)) ??
      (typeof value === "string" ? value : (value.label ?? key));
    return value.children
      ? [...(value.selectable === false ? [] : [[key, label]]), ...hunterTraitChoices(value.children)]
      : [[key, label]];
  });
async function configureTrophy(actor, item) {
  const definition = trophyDefinition(item);
  if (!definition) return false;
  const previous = trophySnapshot(item);
  if (previous?.confirmed) {
    const operation = await askOwner(actor, {
      title: item.name,
      choices: [
        ["carried", "Трофей при мне"],
        ["absent", "Трофей не при мне"],
        ["destroyed", "Трофей уничтожен"]
      ]
    });
    if (!operation) return false;
    if (previous.destroyed && operation !== "destroyed") {
      notify("Восстановление уничтоженного трофея подтверждает GM.", "warn");
      return false;
    }
    await item.setFlag(MODULE_ID, "hunterTrophyState", {
      ...previous,
      carried: operation === "carried",
      destroyed: previous.destroyed || operation === "destroyed"
    });
    await syncHunter(actor);
    return true;
  }
  const physical = await confirmOwner(
    gmActor(actor),
    "Изготовление трофея (GM)",
    `${item.name}: подтверждены поверженный источник типа ${definition.creatureType}, физический след, час изготовления и наличие трофея?`
  );
  if (!physical) return false;
  const cr = await askOwner(gmActor(actor), {
    kind: "number",
    title: item.name,
    label: `ПО источника (минимум ${definition.cr})`,
    min: definition.cr,
    max: 100,
    defaultValue: definition.cr
  });
  if (cr == null || Number(cr) < definition.cr) return false;
  const state = {
    confirmed: true,
    carried: true,
    destroyed: false,
    creatureType: definition.creatureType,
    cr: Number(cr)
  };
  if (["dragon", "elemental"].includes(definition.creatureType)) {
    const types =
      definition.creatureType === "elemental" ? ["acid", "cold", "fire", "lightning", "thunder"] : HUNTER_DAMAGE_TYPES;
    state.damageType = await askOwner(gmActor(actor), {
      title: "Стихия физического источника",
      choices: types.map(key => [key, CONFIG.DND5E.damageTypes?.[key]?.label ?? key])
    });
    if (!types.includes(state.damageType)) return false;
  }
  if (definition.key === "hunter-humanoid-minor") {
    // Pick only legal native trait/tool IDs, explicitly related to this source by GM.
    state.language = await askOwner(gmActor(actor), {
      title: "Язык источника",
      choices: hunterTraitChoices(CONFIG.DND5E.languages)
    });
    state.tool = await askOwner(gmActor(actor), {
      title: "Инструмент источника",
      choices: hunterTraitChoices(CONFIG.DND5E.tools)
    });
    if (!state.language || !Object.hasOwn(CONFIG.DND5E.tools ?? {}, state.tool)) return false;
  }
  if (!isGmAuthority()) return { status: "needs-review" };
  await item.setFlag(MODULE_ID, "hunterTrophyState", state);
  await syncHunter(actor);
  return true;
}
async function chooseTrophies(actor) {
  const before = hunterConfig(actor),
    selected = { ...(before.selected ?? {}) },
    allowed = actor.getFlag(MODULE_ID, "hunterRestSelection");
  let prompted = false;
  for (const tier of hunterTierChoices(hunterLevel(actor))) {
    const available = [...(actor.items ?? [])].filter(
      item => trophyDefinition(item)?.tier === tier && trophyPossessed(actor, item)
    );
    if (!available.length) continue;
    if (selected[tier] && !allowed) continue;
    prompted = true;
    const chosen = await askOwner(actor, {
      title: `${HUNTER_TIERS[tier].name} трофей`,
      choices: [["none", "Не выбирать"], ...available.map(item => [item.id, item.name])],
      defaultValue: available.some(item => item.id === selected[tier]) ? selected[tier] : "none"
    });
    if (chosen == null) return false;
    selected[tier] = chosen === "none" ? null : chosen;
  }
  if (
    Object.entries(selected).some(
      ([tier, id]) =>
        id &&
        (!trophyPossessed(
          actor,
          [...(actor.items ?? [])].find(i => i.id === id)
        ) ||
          trophyDefinition([...(actor.items ?? [])].find(i => i.id === id))?.tier !== tier)
    )
  ) {
    // A lost/destroyed previously selected trophy may stay in the record, but
    // cannot become a replacement outside the rest window.
    for (const [tier, id] of Object.entries(selected))
      if (
        id !== before.selected?.[tier] &&
        !trophyPossessed(
          actor,
          [...(actor.items ?? [])].find(i => i.id === id)
        )
      )
        return false;
  }
  if (!prompted) {
    if (!allowed)
      notify("Трофеи уже выбраны либо нет подтверждённых доступных. Заменить выбранные можно в конце отдыха.", "info");
    return false;
  }
  await actor.setFlag(MODULE_ID, "hunterConfiguration", { ...before, selected });
  if (allowed) await actor.unsetFlag(MODULE_ID, "hunterRestSelection");
  await syncHunter(actor);
  return true;
}
registerGmRequest("hunter-settings", (actor, data) =>
  serialMutation(`hunter-settings:${actor.uuid}`, async () => {
    const item = await fromUuid(data.itemUuid);
    if (item?.actor?.uuid !== actor.uuid) return false;
    if (data.operation === "source" && trophyDefinition(item) && hunterLevel(actor) >= 1)
      return configureTrophy(actor, item);
    if (!hunterFeatureAvailable(actor, item)) return false;
    const key = item.system.identifier;
    if (key !== "hunter-trophies" && !(key === "hunter-ability-improvement" && data.operation === "asi")) return false;
    if (data.operation === "ability") {
      const current = hunterConfig(actor);
      if (current.ability) {
        notify("Характеристика охоты уже выбрана; изменить её нельзя.", "warn");
        return false;
      }
      const choices = ["str", "dex", "wis"].filter(k => Number(actor.system.abilities[k]?.value) >= 16);
      const ability = await askOwner(actor, {
        title: "Характеристика охоты",
        choices: choices.map(k => [k, CONFIG.DND5E.abilities?.[k]?.label ?? k])
      });
      if (!choices.includes(ability)) return false;
      await actor.setFlag(MODULE_ID, "hunterConfiguration", { ...current, ability });
      return true;
    }
    if (data.operation === "select") return chooseTrophies(actor);
    if (data.operation === "asi") {
      const ability = hunterConfig(actor).ability;
      if (!ability || actor.getFlag(MODULE_ID, "hunterASI")) return false;
      const choice = await askOwner(actor, {
        title: "Увеличение Характеристики охоты",
        choices: [
          ["ability", "+2 к характеристике и максимуму"],
          ["feat", "Выбрать черту штатно"]
        ]
      });
      if (!choice) return false;
      const patch = { [`flags.${MODULE_ID}.hunterASI`]: { choice, ability } };
      if (choice === "ability") {
        const raw = actor._source.system.abilities[ability];
        patch[`system.abilities.${ability}.value`] = Number(raw.value) + 2;
        patch[`system.abilities.${ability}.max`] = Number(raw.max ?? CONFIG.DND5E.maxAbilityScore ?? 20) + 2;
      }
      await actor.update(patch);
      if (choice === "feat") notify("Добавьте выбранную черту через стандартный интерфейс.");
      return true;
    }
    return false;
  })
);
const resting = new Map();
export function hunterRestCompleted(actor, result) {
  if (!enabled() || !hunterLevel(actor)) return Promise.resolve(false);
  if (!isGmAuthority()) {
    // D&D5e emits restCompleted on the initiating client, not on all clients.
    const requestId = (result.grimgutzHunterRestId ??= result.message?.uuid ?? foundry.utils.randomID());
    return requestGm(
      "hunter-rest",
      actor,
      { type: result.longRest ? "long" : result.type },
      { requestId: `hunter-rest:${requestId}`, timeoutMs: 120000 }
    );
  }
  if (resting.has(actor.uuid)) return resting.get(actor.uuid);
  const task = (async () => {
    await actor.setFlag(MODULE_ID, "hunterRestSelection", true);
    try {
      await chooseTrophies(actor); // Cancellation keeps the previous selection.
      await syncHunter(actor);
      if (result?.longRest || result?.type === "long") await hunterPool(actor)?.update({ "system.uses.spent": 0 });
      return true;
    } finally {
      await actor.unsetFlag(MODULE_ID, "hunterRestSelection");
    }
  })();
  resting.set(actor.uuid, task);
  void task.finally(() => resting.delete(actor.uuid)).catch(() => {});
  return task;
}
registerGmRequest("hunter-rest", async (actor, data, { requestId }) => {
  if (!enabled() || !hunterLevel(actor) || !["short", "long"].includes(data.type)) return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "hunter-rest", activityUuid: null },
    async () => true,
    () => hunterRestCompleted(actor, { type: data.type })
  );
});
export function hunterPassiveActive(actor, key) {
  const entry = selectedHunterTrophy(actor, key);
  if (!entry) return null;
  const effect = [...(actor.effects ?? [])].find(e => e.getFlag?.(MODULE_ID, "hunterPassive") === entry.item.id);
  // A manually disabled/suppressed real passive must not power a related hook.
  return effect && !isEffectActive(effect) ? null : entry;
}
