// Runtime for transformations defined as data (Myconid, Psyker, Sphinx, Vendigo,
// Void). A definition lists the requirements, the save DC rule and each boon or
// flaw with its rules text, uses, native dnd5e activities and, where a rule is a
// fixed stat change, a `passive(actor, kit)` returning Active Effect changes.
// The kit derives everything the hand-written transformations repeat:
//
// - tier (transformation-core) and save DC, published as roll-data flags so
//   native activities scale with them (transformation-formulas.mjs);
// - passive effects from `passive` functions, synchronized like the others;
// - the optional strict prerequisites and advancement checks (no duplicate
//   boon, required boon owned);
// - diagnostics and the content descriptor.
//
// Anything a rule leaves to the GM stays in the card text and the
// "Автоматизация Foundry" note; the kit never invents a ruling.
import { MODULE_ID } from "./constants.mjs";
import { automationData, enabled, findFeature, isAutomationAuthority, notify } from "./helpers.mjs";
import { baseAbilityValue } from "./dnd5e.mjs";
import { flaggedPassiveEffectData, syncFlaggedPassiveEffects } from "../effects/passive-helpers.mjs";
import {
  advancementSurvivors,
  characterLevel,
  effectChange,
  enforcesTransformationPrerequisites,
  isDuplicateGrant,
  transformationTier
} from "./transformation-core.mjs";
import { effectKey, movementSpeed } from "./system-paths.mjs";
import { defineContent } from "./content.mjs";
import { featureRows, tfFlag } from "./transformation-formulas.mjs";
import { onAuthority, onGmAuthority } from "./authority.mjs";
import { automationActors } from "./actor-index.mjs";
import { t } from "./i18n.mjs";

/** Change helpers handed to `passive(actor, kit)`. */
function changeHelpers(actor) {
  return {
    change: effectChange,
    /** Current location of a possibly moved dnd5e path. */
    key: effectKey,
    /** Raise abilities by fixed amounts without exceeding `cap` (from the actor's base scores). */
    increase(amounts, cap) {
      return Object.entries(amounts)
        .map(([ability, amount]) => [ability, Math.max(0, Math.min(amount, cap - baseAbilityValue(actor, ability)))])
        .filter(([, amount]) => amount > 0)
        .map(([ability, amount]) => effectChange(`system.abilities.${ability}.value`, amount));
    },
    /** A movement mode equal to the current walking speed (never lowers a better speed). */
    speedAsWalk(mode) {
      return effectChange(
        effectKey(`system.attributes.movement.${mode}`),
        Number(movementSpeed(actor, "walk") ?? 0),
        "upgrade",
        "final"
      );
    },
    /** Extra feet of walking speed. */
    walkBonus(feet) {
      return effectChange(effectKey("system.attributes.movement.walk"), feet, "add", "final");
    },
    sense(sense, feet) {
      return effectChange(effectKey(`system.attributes.senses.${sense}`), feet, "upgrade", "final");
    },
    trait(trait, value) {
      return effectChange(`system.traits.${trait}.value`, value, "add");
    },
    /** Skill proficiency; expertise if already proficient; +2 if already expert. `baseline` = grade before the boon. */
    skill(skill, baseline) {
      const grade = Number(baseline ?? 0);
      if (grade >= 2) return [effectChange(effectKey(`system.skills.${skill}.bonuses.check`), 2)];
      return [effectChange(`system.skills.${skill}.value`, grade >= 1 ? 2 : 1, "upgrade")];
    }
  };
}

/**
 * Runtime of one data-defined transformation. Optional definition parts:
 * - `pool`: a resource shared by several cards. `{ feature, label, storage: "uses" }` keeps it in that card's
 *   uses; `{ label, storage: "flag", max: (actor, kit) => n }` keeps it in an actor flag. `regen: { every, amount }`
 *   restores it over world time. Activities spend it with `cost: n` or `consumeAll: true` and add to it with
 *   `gain: n | "1d4"`.
 * - `markers`: `{ name: actor => boolean }`. Effects applied by activities with `marker: name` are removed as
 *   soon as the condition stops holding (e.g. "while you have these temporary hit points").
 * - `rollValues(actor, kit)`: extra numbers published next to tier and dc for card formulas.
 */
export function createTransformationKit(definition, { actions = {}, install, api = {}, inspect: extraInspect } = {}) {
  const { id } = definition;
  const rows = featureRows(definition);
  const root = `${id}-transformation`;
  const passiveFlag = `${id}Passive`;
  const baselineFlag = `${id}Baseline`;

  const level = actor => transformationTier(actor, id);
  const row = featureId => rows.find(entry => entry.id === featureId);
  function has(actor, featureId) {
    const entry = row(featureId);
    const item = entry && findFeature(actor, entry.key);
    return Boolean(
      item && !item.isSuppressed && level(actor) >= entry.level && (!entry.requires || has(actor, entry.requires))
    );
  }
  const abilityMod = (actor, ability) => Number(actor?.system?.abilities?.[ability]?.mod ?? 0);
  function dc(actor) {
    const rule = definition.dc;
    return (
      8 +
      Number(actor?.system?.attributes?.prof ?? 0) +
      (rule.tier ? level(actor) : 0) +
      Math.max(...rule.abilities.map(ability => abilityMod(actor, ability)))
    );
  }
  /** Skill grades recorded when a skill boon first applied, so the boon does not count itself. */
  const baseline = actor => actor.getFlag?.(MODULE_ID, baselineFlag) ?? {};

  function passiveDefinitions(actor) {
    const helpers = { ...changeHelpers(actor), level: level(actor), dc: dc(actor), has: f => has(actor, f) };
    const effects = [];
    for (const entry of rows) {
      if (!entry.spec.passive || !has(actor, entry.id)) continue;
      const changes = entry.spec.passive(actor, { ...helpers, baseline: baseline(actor)[entry.id] ?? {} }) ?? [];
      if (changes.length)
        effects.push(
          flaggedPassiveEffectData(MODULE_ID, passiveFlag, {
            key: entry.id,
            feature: findFeature(actor, entry.key),
            changes
          })
        );
    }
    return effects;
  }

  // Resource pool ------------------------------------------------------------
  const pool = definition.pool ?? null;
  const poolFlag = `${id}Pool`;
  const poolItem = actor => (pool?.feature ? findFeature(actor, row(pool.feature)?.key) : null);
  function kitView(actor) {
    return { level: level(actor), dc: dc(actor), has: featureId => has(actor, featureId) };
  }
  function poolMax(actor) {
    if (!pool) return 0;
    if (pool.storage === "uses") return Number(poolItem(actor)?.system?.uses?.max ?? 0);
    return Number(pool.max?.(actor, kitView(actor)) ?? 0);
  }
  function poolValue(actor) {
    if (!pool) return 0;
    if (pool.storage === "uses") {
      const uses = poolItem(actor)?.system?.uses;
      return Math.max(0, Number(uses?.max ?? 0) - Number(uses?.spent ?? 0));
    }
    return Math.min(poolMax(actor), Number(actor.getFlag?.(MODULE_ID, poolFlag)?.value ?? 0));
  }
  async function setPool(actor, value) {
    const next = Math.max(0, Math.min(poolMax(actor), Math.floor(Number(value))));
    if (pool.storage === "uses") {
      const item = poolItem(actor);
      if (item) await item.update({ "system.uses.spent": poolMax(actor) - next });
    } else await actor.setFlag(MODULE_ID, poolFlag, { ...actor.getFlag(MODULE_ID, poolFlag), value: next });
    return next;
  }
  const hasPool = actor =>
    Boolean(pool && (pool.storage === "uses" ? poolItem(actor) && has(actor, pool.feature) : level(actor)));
  async function announce(actor, text) {
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p>${text}</p>` });
  }

  /** Before a card activity: pay its pool cost, or empty the pool for "consume all" abilities. */
  function payPool(activity) {
    const spec = automationData(activity).transformationPool;
    if (!enabled() || spec?.transformation !== id || (!spec.cost && !spec.consumeAll)) return;
    const actor = activity.actor;
    if (!actor || !hasPool(actor)) return;
    const value = poolValue(actor);
    if (spec.cost && value < spec.cost) {
      notify(t("Transformations.PoolShort", { pool: pool.label, cost: spec.cost, value }), "warn");
      return false;
    }
    const spent = spec.consumeAll ? value : spec.cost;
    if (!spent) return;
    void setPool(actor, value - spent)
      .then(left =>
        spec.consumeAll
          ? announce(
              actor,
              t("Transformations.PoolConsumed", { item: activity.item?.name, spent, pool: pool.label, left })
            )
          : null
      )
      .catch(error => console.error(`${MODULE_ID} | ${pool.label} payment failed`, error));
  }

  /** Card action "<id>-pool": add points (fixed or rolled) to the pool. */
  async function poolAction(actor, activity) {
    const spec = automationData(activity).transformationPool;
    if (!hasPool(actor) || spec?.gain == null) return false;
    const amount = Number.isFinite(Number(spec.gain))
      ? Number(spec.gain)
      : Number((await new Roll(String(spec.gain)).evaluate()).total);
    const left = await setPool(actor, poolValue(actor) + amount);
    await announce(actor, t("Transformations.PoolGained", { pool: pool.label, amount, left, max: poolMax(actor) }));
    return true;
  }

  /** World time: restore `regen.amount` per `regen.every` seconds since the last tick. */
  async function regenerate() {
    if (!pool?.regen) return;
    const now = Number(game.time?.worldTime ?? 0);
    for (const actor of automationActors()) {
      if (!hasPool(actor)) continue;
      const state = actor.getFlag(MODULE_ID, poolFlag) ?? {};
      const last = Number(state.tick);
      if (!Number.isFinite(last) || last > now) {
        await actor.setFlag(MODULE_ID, poolFlag, { ...state, tick: now });
        continue;
      }
      const ticks = Math.floor((now - last) / pool.regen.every);
      if (ticks < 1) continue;
      const value = poolValue(actor);
      if (value < poolMax(actor)) await setPool(actor, value + ticks * pool.regen.amount);
      await actor.setFlag(MODULE_ID, poolFlag, {
        ...actor.getFlag(MODULE_ID, poolFlag),
        tick: last + ticks * pool.regen.every
      });
    }
  }

  // Markers ------------------------------------------------------------------
  const markers = definition.markers ?? {};
  async function clearMarkers(actor) {
    for (const effect of [...(actor.effects ?? [])]) {
      const marker = effect.getFlag?.(MODULE_ID, "transformationMarker");
      if (marker && markers[marker] && effect.getFlag(MODULE_ID, "transformation") === id && !markers[marker](actor))
        await effect.delete();
    }
  }

  const syncing = new Set();
  async function sync(actor) {
    if (!enabled() || !isAutomationAuthority(actor) || !actor?.system?.attributes) return;
    const tier = level(actor);
    const stored = actor.getFlag(MODULE_ID, tfFlag(id));
    if (tier) {
      const values = { tier, dc: dc(actor), ...(definition.rollValues?.(actor, kitView(actor)) ?? {}) };
      if (Object.entries(values).some(([name, value]) => stored?.[name] !== value))
        await actor.setFlag(MODULE_ID, tfFlag(id), values);
      // Record skill grades before a skill boon applies (expertise rules depend on them).
      const missing = rows.filter(entry => entry.spec.skills && has(actor, entry.id) && !baseline(actor)[entry.id]);
      if (missing.length)
        await actor.setFlag(MODULE_ID, baselineFlag, {
          ...baseline(actor),
          ...Object.fromEntries(
            missing.map(entry => [
              entry.id,
              Object.fromEntries(
                entry.spec.skills.map(skill => [skill, Number(actor._source?.system?.skills?.[skill]?.value ?? 0)])
              )
            ])
          )
        });
    } else if (stored) await actor.unsetFlag(MODULE_ID, tfFlag(id));
    if (!tier && ![...(actor.effects ?? [])].some(effect => effect.getFlag?.(MODULE_ID, passiveFlag))) return;
    await syncFlaggedPassiveEffects(actor, syncing, MODULE_ID, passiveFlag, passiveDefinitions);
  }

  function requirementsMet(actor) {
    const { level: minimum = 0, abilities = [] } = definition.requirements;
    return (
      characterLevel(actor) >= minimum &&
      abilities.every(([keys, score]) => keys.some(ability => baseAbilityValue(actor, ability) >= score))
    );
  }

  function validateItem(item, _data, _options, userId) {
    if (!enforcesTransformationPrerequisites(item, userId, root)) return;
    if (requirementsMet(item.parent)) return;
    notify(
      t("Transformations.Requirements", { name: definition.name, requirements: definition.requirements.text }),
      "warn"
    );
    return false;
  }

  function validateAdvancement(manager, _level, toCreate, _toUpdate, toDelete) {
    if (!enabled()) return;
    const owned = advancementSurvivors(manager, toDelete);
    const all = [...owned, ...toCreate];
    for (const document of toCreate) {
      const data = automationData(document);
      if (data.transformation !== id || !data.transformationBoon) continue;
      if (isDuplicateGrant(document, owned, toCreate)) {
        notify(t("Transformations.Duplicate", { name: document.name }), "warn");
        return false;
      }
      const entry = rows.find(candidate => candidate.key === document.system?.identifier);
      const required = entry?.requires && row(entry.requires);
      if (required && !all.some(item => item.system?.identifier === required.key)) {
        notify(t("Transformations.Requires", { name: document.name, required: required.name }), "warn");
        return false;
      }
    }
  }

  function inspect(actor) {
    const tier = level(actor);
    return {
      level: tier,
      dc: tier ? dc(actor) : null,
      ...(pool && hasPool(actor) ? { pool: { label: pool.label, value: poolValue(actor), max: poolMax(actor) } } : {}),
      dcAbilities: [...definition.dc.abilities],
      requirementsMet: requirementsMet(actor),
      features: rows.filter(entry => findFeature(actor, entry.key)).map(entry => entry.id),
      unavailable: rows.filter(entry => findFeature(actor, entry.key) && !has(actor, entry.id)).map(entry => entry.id),
      ...(extraInspect?.(actor) ?? {})
    };
  }

  function installKit() {
    if (pool) {
      Hooks.on("dnd5e.preUseActivity", payPool);
      if (pool.regen) onGmAuthority("updateWorldTime", regenerate, `${definition.name}: ${pool.label}`);
    }
    if (Object.keys(markers).length)
      onAuthority("updateActor", actor => actor, clearMarkers, `${definition.name}: markers`);
    install?.();
  }

  const content = defineContent({
    id,
    kind: "transformation",
    actions: { ...(pool ? { [`${id}-pool`]: poolAction } : {}), ...actions },
    itemValidators: [validateItem],
    advancementValidators: [validateAdvancement],
    install: installKit,
    sync,
    inspect,
    api
  });

  return {
    definition,
    rows,
    level,
    has,
    dc,
    passiveDefinitions,
    sync,
    validateItem,
    validateAdvancement,
    inspect,
    poolValue,
    setPool,
    payPool,
    poolAction,
    regenerate,
    clearMarkers,
    content
  };
}
