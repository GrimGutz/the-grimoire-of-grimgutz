import { FLAGS, MODULE_ID } from "../shared/constants.mjs";
import { automationData, findFeature, isAutomationAuthority } from "../shared/helpers.mjs";
import { syncFlaggedPassiveEffects } from "../effects/passive-helpers.mjs";

const murderspawnPassiveSyncs = new Set();

export function murderspawnFeatureLevel(item) {
  const data = automationData(item);
  if (data.transformation !== "murderspawn" && data.murderspawnFeature !== true) return 0;
  const flagged = Number(data.transformationLevel ?? 0);
  if (Number.isFinite(flagged) && flagged > 0) return flagged;
  const match = String(item?.system?.requirements ?? "").match(/Порождение убийств\s+([1-4])/iu);
  return match ? Number(match[1]) : 0;
}

export function murderspawnTransformationLevel(actor) {
  return Math.max(0, ...[...(actor?.items ?? [])].map(murderspawnFeatureLevel));
}

export async function syncMurderspawnTransformation(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;

  const level = murderspawnTransformationLevel(actor);
  const storedLevel = Number(actor.getFlag(MODULE_ID, FLAGS.MURDERSPAWN_LEVEL) ?? 0);
  if (storedLevel !== level) {
    if (level > 0) await actor.setFlag(MODULE_ID, FLAGS.MURDERSPAWN_LEVEL, level);
    else await actor.unsetFlag(MODULE_ID, FLAGS.MURDERSPAWN_LEVEL);
  }

  const unstoppable = findFeature(actor, "unstoppable");
  if (!unstoppable || level < 3) return;

  const maximum = String(level);
  const current = String(unstoppable.system?.uses?.max ?? "");
  if (current !== maximum) {
    await unstoppable.update({ "system.uses.max": maximum });
  }
}

function murderspawnPassiveEffectData({ key, feature, name, img, changes }) {
  return {
    name,
    img,
    type: "base",
    description: "",
    origin: feature?.uuid ?? null,
    transfer: false,
    disabled: false,
    showIcon: 1,
    statuses: [],
    tint: "#ffffff",
    start: null,
    duration: {
      value: null,
      units: "seconds",
      expiry: null,
      expired: false
    },
    flags: {
      [MODULE_ID]: {
        [FLAGS.MURDERSPAWN_PASSIVE]: key
      }
    },
    system: { changes }
  };
}

function murderspawnPassiveDefinitions(actor) {
  const definitions = [];

  const deathRun = findFeature(actor, "death-run");
  if (deathRun) {
    definitions.push(
      murderspawnPassiveEffectData({
        key: "death-run",
        feature: deathRun,
        name: "Смертельный бег",
        img: deathRun.img,
        changes: [
          {
            key: "system.attributes.movement.walk",
            type: "add",
            value: "10",
            phase: "final",
            priority: 20
          }
        ]
      })
    );
  }

  const primalReflexes = findFeature(actor, "primal-reflexes");
  if (primalReflexes) {
    definitions.push(
      murderspawnPassiveEffectData({
        key: "primal-reflexes",
        feature: primalReflexes,
        name: "Первобытные рефлексы",
        img: primalReflexes.img,
        changes: [
          {
            key: "system.attributes.init.bonus",
            type: "add",
            value: "10",
            phase: "final",
            priority: 20
          }
        ]
      })
    );
  }

  return definitions;
}

export async function syncMurderspawnPassiveEffects(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  return syncFlaggedPassiveEffects(
    actor,
    murderspawnPassiveSyncs,
    MODULE_ID,
    FLAGS.MURDERSPAWN_PASSIVE,
    murderspawnPassiveDefinitions
  );
}
