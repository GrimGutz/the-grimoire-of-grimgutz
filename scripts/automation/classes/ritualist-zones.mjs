import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, itemIdentifier, itemUses, notify, automationAction } from "../shared/helpers.mjs";
import { regainRitualistSpirits } from "./ritualist.mjs";
import { isGmAuthority, registerGmRequest, requestGm } from "../shared/gm-requests.mjs";
import { useNativeUtility } from "../shared/native-actions.mjs";
import { applyNativeOnce, nativeApplicationReply } from "../shared/native-applications.mjs";
import { sourceTokenForActor } from "../shared/zones.mjs";
import { areaPlacementAllowed } from "../shared/area-activities.mjs";
import { tokenOccupiedPoints, feetToSceneUnits } from "../shared/spatial.mjs";
import { effectKey } from "../shared/system-paths.mjs";
import { automationActors } from "../shared/actor-index.mjs";
import { sceneZones } from "../shared/scene-zones.mjs";
import { placeActivityArea } from "../shared/template-placement.mjs";

const zoneRecipient = (actor, scene) =>
  [...(actor.effects ?? [])].some(
    effect => effect.getFlag?.(MODULE_ID, "protectiveZoneRecipient")?.sceneId === scene.id
  );

export function protectiveZoneContains(zone, token, scene) {
  if (
    Number(token.elevation ?? 0) < (zone.elevation?.bottom ?? -Infinity) ||
    Number(token.elevation ?? 0) > (zone.elevation?.top ?? Infinity)
  )
    return false;
  const points = tokenOccupiedPoints(token.object ?? token, scene),
    shape = zone.shapes?.[0];
  if (zone.polygonTree?.testPoint) return points.some(point => zone.polygonTree.testPoint(point, 1));
  const radius = shape?.radius ?? (Number(zone.distance) / scene.grid.distance) * scene.grid.size;
  const x = shape?.x ?? zone.x,
    y = shape?.y ?? zone.y;
  return points.some(point => Math.hypot(point.x - x, point.y - y) <= radius);
}
export function protectiveZoneChanges(friendly, actor) {
  if (friendly)
    return ["frightened", "charmed"].map(value => ({
      key: "system.traits.ci.value",
      value,
      type: "custom",
      phase: "initial",
      priority: 20
    }));
  return ["walk", "fly", "swim", "burrow", "climb"]
    .filter(mode => Number(actor.system.attributes.movement[mode]) > 0)
    .map(mode => ({
      key: effectKey(`system.attributes.movement.${mode}`),
      value: "0.5",
      type: "multiply",
      phase: "final",
      priority: 30
    }));
}
export async function syncProtectiveZones(scene) {
  if (!scene || !enabled() || !isGmAuthority()) return;
  const zones = sceneZones(scene).filter(
    zone =>
      zone.flags?.[MODULE_ID]?.protectiveZone &&
      Number(zone.flags[MODULE_ID].zoneExpiresAt) > Number(game.time.worldTime)
  );
  // Current recipients carry a module effect, so the actor index finds them
  // without reading every token. Scenes with neither zones nor recipients
  // (almost all of them on any actor update or world-time tick) stop here.
  const actors = new Map(
    automationActors()
      .filter(actor => zoneRecipient(actor, scene))
      .map(actor => [actor.uuid, actor])
  );
  if (!zones.length && !actors.size) return;
  const desired = new Map();
  for (const zone of zones) {
    const source = await fromUuid(zone.flags[MODULE_ID].protectiveZone.sourceTokenUuid);
    if (!source) continue;
    for (const token of scene.tokens ?? [])
      if (token.actor && protectiveZoneContains(zone, token, scene)) {
        const friendly =
          token.actor.uuid === source.actor?.uuid ||
          Boolean(source.disposition && token.disposition === source.disposition);
        // Neutral creatures receive neither allied immunity nor hostile slowing.
        if (!friendly && (!token.disposition || !source.disposition)) continue;
        const key = `${token.actor.uuid}:${zone.uuid}`;
        desired.set(key, { actor: token.actor, zone, friendly });
      }
  }
  // Overlapping protective rituals halve movement once, not once per circle.
  const slowed = new Set();
  for (const [key, entry] of desired)
    if (!entry.friendly) {
      if (slowed.has(entry.actor.uuid)) desired.delete(key);
      else slowed.add(entry.actor.uuid);
    }
  for (const actor of actors.values())
    for (const effect of [...(actor.effects ?? [])]) {
      const state = effect.getFlag?.(MODULE_ID, "protectiveZoneRecipient");
      if (!state || state.sceneId !== scene.id) continue;
      const wanted = desired.get(`${actor.uuid}:${state.zoneUuid}`);
      if (!wanted || state.friendly !== wanted.friendly) await effect.delete();
      else desired.delete(`${actor.uuid}:${state.zoneUuid}`);
    }
  for (const { actor, zone, friendly } of desired.values())
    await actor.createEmbeddedDocuments("ActiveEffect", [
      {
        name: "Ритуал защиты",
        img: "icons/magic/defensive/barrier-shield-dome-blue-purple.webp",
        type: "base",
        transfer: false,
        disabled: false,
        start: null,
        duration: { value: null, units: "seconds", expiry: null, expired: false },
        origin: zone.flags[MODULE_ID].protectiveZone.itemUuid,
        flags: { [MODULE_ID]: { protectiveZoneRecipient: { sceneId: scene.id, zoneUuid: zone.uuid, friendly } } },
        system: { changes: protectiveZoneChanges(friendly, actor) }
      }
    ]);
}
registerGmRequest("ritualist-protective-zone", async (actor, data, { requestId }) => {
  const zone = await fromUuid(data.zoneUuid),
    activity = await fromUuid(data.activityUuid),
    source = await fromUuid(data.sourceUuid);
  if (
    !zone ||
    source?.actor?.uuid !== actor.uuid ||
    activity?.actor?.uuid !== actor.uuid ||
    itemIdentifier(activity.item) !== "protective-ritual" ||
    zone.parent?.id !== source.parent?.id ||
    !areaPlacementAllowed(zone, source.object ?? source, { origin: "point", maxRange: 60 }, zone.parent)
  )
    throw Error("Некорректная зона ритуала.");
  const previous = nativeApplicationReply(actor, requestId);
  if (previous) return previous;
  if (zone.flags?.[MODULE_ID]?.protectiveZone) return true;
  const radius =
    (feetToSceneUnits(30, zone.parent) / Number(zone.parent.grid.distance)) * Number(zone.parent.grid.size);
  if (
    zone.shapes
      ? zone.shapes.length !== 1 || zone.shapes[0].type !== "circle" || Math.abs(zone.shapes[0].radius - radius) > 1
      : zone.t !== "circle" || Math.abs(zone.distance - feetToSceneUnits(30, zone.parent)) > 0.01
  )
    throw Error("Ритуалу требуется круг радиусом 30 футов.");
  if (itemUses(activity.item).remaining < 1) return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "ritualist-protective-zone", activityUuid: activity.uuid },
    () => useNativeUtility(activity),
    async () => {
      await zone.update({
        [`flags.${MODULE_ID}.zoneTemplate`]: true,
        [`flags.${MODULE_ID}.sourceActor`]: actor.uuid,
        hidden: Boolean(source.hidden),
        [`flags.${MODULE_ID}.zoneExpiresAt`]: Number(game.time.worldTime) + 600,
        [`flags.${MODULE_ID}.protectiveZone`]: { sourceTokenUuid: source.uuid, itemUuid: activity.item.uuid }
      });
      // Through the shared scheduler: a direct call raced hook-triggered syncs and both created effects.
      await scheduleProtectiveZones(zone.parent);
      return true;
    }
  );
});
const pending = new Set();
export async function useProtectiveRitual(activity) {
  const actor = activity.actor,
    source = sourceTokenForActor(actor);
  if (!source || pending.has(actor.uuid)) return false;
  pending.add(actor.uuid);
  let placed, result;
  try {
    const data = activity.toObject();
    data.target = {
      ...data.target,
      override: true,
      prompt: true,
      template: { type: "sphere", size: "30", units: "ft", count: "1" }
    };
    const item = activity.item.clone({ system: { activities: { [activity.id]: data } } }, { keepId: true });
    placed = (await placeActivityArea(item.system.activities.get(activity.id)))?.[0];
    if (!placed) return false;
    result = await requestGm(
      "ritualist-protective-zone",
      actor,
      { zoneUuid: placed.uuid, activityUuid: activity.uuid, sourceUuid: source.document.uuid },
      { requestId: `protective:${placed.uuid}`, timeoutMs: 120000 }
    );
    return result;
  } catch (error) {
    if (error) notify(error.message, "warn");
    // A thrown request after placement is not proof that the GM did not spend
    // the resource. Keep that template until the native receipt is reviewed.
    result = placed ? { status: "needs-review", error: error?.message } : false;
    return result;
  } finally {
    pending.delete(actor.uuid);
    if (placed && (result === false || ["failed", "cancelled"].includes(result?.status) || !result))
      await placed.delete();
  }
}
export function protectiveZoneScheduler(synchronize = syncProtectiveZones) {
  const scheduled = new Map();
  return scene => {
    if (!scene) return;
    const existing = scheduled.get(scene.id);
    if (existing) {
      existing.requested = true;
      return existing.promise;
    }
    const state = { requested: true };
    // Token/Actor updates received during document writes must be coalesced,
    // not discarded: the final position still needs a full synchronization.
    state.promise = Promise.resolve()
      .then(async () => {
        do {
          state.requested = false;
          await synchronize(scene);
        } while (state.requested);
      })
      .finally(() => scheduled.delete(scene.id));
    scheduled.set(scene.id, state);
    return state.promise;
  };
}
/** The single per-scene protective-zone synchronization every caller shares, so two syncs never overlap. */
export const scheduleProtectiveZones = protectiveZoneScheduler();
export function installRitualistZoneHooks() {
  const intercept = activity => {
    if (!enabled() || activity?.flags?.[MODULE_ID]?.leaderResolved) return;
    if (automationAction(activity) === "regain-ritualist-spirits") {
      void regainRitualistSpirits(activity.actor).catch(error => notify(error.message, "warn"));
      return false;
    }
    if (itemIdentifier(activity?.item) !== "protective-ritual") return;
    void useProtectiveRitual(activity).catch(error => notify(error.message, "warn"));
    return false;
  };
  Hooks.on("midi-qol.preTargetingV2", ({ workflow }) => intercept(workflow?.activity));
  Hooks.on("dnd5e.preUseActivity", intercept);
  const schedule = scheduleProtectiveZones;
  const sync = scene => {
    void schedule(scene)?.catch(error => console.error(`${MODULE_ID} | Protective zone`, error));
  };
  Hooks.on("updateToken", token => sync(token.parent));
  Hooks.on("deleteToken", token => sync(token.parent));
  Hooks.on("updateActor", () => {
    for (const scene of game.scenes ?? []) sync(scene);
  });
  Hooks.on("updateWorldTime", () => {
    for (const scene of game.scenes ?? []) sync(scene);
  });
  Hooks.on("deleteRegion", zone => sync(zone.parent));
  Hooks.on("deleteMeasuredTemplate", zone => sync(zone.parent));
  Hooks.on("canvasReady", () => sync(canvas.scene));
}
