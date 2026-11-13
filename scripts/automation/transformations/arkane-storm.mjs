import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, reportFailure } from "../shared/helpers.mjs";
import { isGmAuthority } from "../shared/gm-requests.mjs";
import { arkaneHas, arkaneSnapshot } from "./arkane.mjs";
import { arkaneExpense, arkaneGm, arkanePlaceable, previewArkaneCircle } from "./arkane-use.mjs";
import { confirmOwner, askOwner } from "../shared/owner-prompts.mjs";
import { useNativeUtility } from "../shared/native-actions.mjs";
import { applyNativeOnce } from "../shared/native-applications.mjs";
import { areaPlacementAllowed } from "../shared/area-activities.mjs";
import { feetToSceneUnits } from "../shared/spatial.mjs";
import { protectiveZoneContains } from "../classes/ritualist-zones.mjs";
import { combatTurnSnapshot, encounterForScene, isForwardTurn } from "../shared/combat-flow.mjs";
import { runAutomationEvent, registerAutomationEvent } from "../shared/event-ledger.mjs";
import { useAuraPulse } from "../midi/aura-workflow.mjs";
export const arkaneStormData = zone => zone.flags?.[MODULE_ID]?.arkaneStorm;
const zones = scene => [...(scene?.regions ?? []), ...(scene?.templates ?? [])].filter(zone => arkaneStormData(zone));
export const arkaneStormCenter = zone =>
  zone.shapes?.[0] ? { x: zone.shapes[0].x, y: zone.shapes[0].y } : { x: zone.x, y: zone.y };
const turn = snapshot => (snapshot ? `${snapshot.id}:${snapshot.current.round}:${snapshot.current.turn}` : null);
export function arkaneStormActive(zone) {
  const data = arkaneStormData(zone),
    source = [...(zone.parent?.tokens ?? [])].find(t => t.uuid === data?.sourceTokenUuid);
  return Boolean(
    data &&
    Number(zone.flags[MODULE_ID].zoneExpiresAt) > Number(game.time.worldTime) &&
    source?.actor &&
    arkaneHas(source.actor, "storm") &&
    !source.actor.statuses?.has("unconscious") &&
    !source.actor.statuses?.has("dead")
  );
}
export async function useArkaneStorm(actor, activity, source, requestId) {
  const expense = arkaneExpense(activity, { cost: 1 });
  let zone, reply;
  try {
    zone = await previewArkaneCircle(activity, source);
    if (!zone) return false;
    if (
      zone.parent?.id !== source.parent.id ||
      !areaPlacementAllowed(zone, arkanePlaceable(source), { origin: "point", maxRange: 60 }, source.parent) ||
      !(await confirmOwner(
        arkaneGm(actor),
        "Шторм сил",
        "Вы видите выбранную точку в 60 футах? Создать неподвижный круг 30 футов на минуту, без первоначального урона?"
      ))
    )
      return false;
    const combat = encounterForScene(source.parent, source),
      snapshot = combat && combatTurnSnapshot(combat),
      parameters = arkaneSnapshot(actor);
    reply = await applyNativeOnce(
      actor,
      { requestId, action: "arkane-storm", activityUuid: activity.uuid },
      () => useNativeUtility(activity, { dataPatch: expense }),
      async () => {
        const radius =
            (feetToSceneUnits(30, source.parent) / Number(source.parent.grid.distance)) *
            Number(source.parent.grid.size),
          shape = zone.shapes?.[0];
        if (
          shape
            ? zone.shapes.length !== 1 || shape.type !== "circle" || Math.abs(shape.radius - radius) > 1
            : zone.t !== "circle" || Math.abs(zone.distance - feetToSceneUnits(30, source.parent)) > 0.01
        )
          throw Error("Шторму требуется круг радиусом 30 футов.");
        await zone.update({
          hidden: Boolean(source.hidden),
          [`flags.${MODULE_ID}.zoneTemplate`]: true,
          [`flags.${MODULE_ID}.sourceActor`]: actor.uuid,
          [`flags.${MODULE_ID}.zoneExpiresAt`]: Number(game.time.worldTime) + 60,
          [`flags.${MODULE_ID}.areaCastId`]: requestId,
          [`flags.${MODULE_ID}.arkaneStorm`]: {
            ...parameters,
            sourceTokenUuid: source.uuid,
            sourceItemUuid: activity.item.uuid,
            createdTurn: turn(snapshot),
            requestId,
            itemSnapshot: activity.item.toObject(),
            moveClaims: []
          }
        });
        return true;
      }
    );
    return reply;
  } finally {
    if (zone && (!reply || reply.status === "cancelled")) await zone.delete();
  }
}
export async function endArkaneStorms(actor, scene) {
  if (
    !(await confirmOwner(
      arkaneGm(actor),
      "Очистка Шторма (GM)",
      "Это административное завершение/исправление зоны? По PDF произвольного досрочного выключения способности нет."
    ))
  )
    return false;
  for (const zone of zones(scene)) if (zone.flags[MODULE_ID].sourceActor === actor.uuid) await zone.delete();
  return true;
}
export async function moveArkaneStorm(actor, activity, source, requestId) {
  const choices = zones(source.parent).filter(
      zone => arkaneStormActive(zone) && zone.flags[MODULE_ID].sourceActor === actor.uuid
    ),
    selected = await askOwner(actor, {
      title: "Какой Шторм переместить",
      choices: choices.map(zone => [zone.uuid, "Шторм сил"])
    }),
    zone = choices.find(z => z.uuid === selected);
  if (!zone) return false;
  const combat = encounterForScene(source.parent, source),
    snapshot = combat && combatTurnSnapshot(combat),
    key = turn(snapshot),
    state = arkaneStormData(zone);
  if (!key || snapshot.current.tokenUuid !== source.uuid || state.createdTurn === key || state.moveClaims.includes(key))
    throw Error("Перемещение доступно один раз в собственный последующий ход.");
  const placed = await previewArkaneCircle(activity, source);
  if (!placed) return false;
  try {
    const center = arkaneStormCenter(zone),
      origin = { document: { ...center, width: 0, height: 0 }, center };
    if (!areaPlacementAllowed(placed, origin, { origin: "point", maxRange: 60 }, source.parent)) return false;
    return applyNativeOnce(
      actor,
      { requestId, action: "arkane-move-storm", activityUuid: activity.uuid },
      () => useNativeUtility(activity, { dataPatch: arkaneExpense(activity) }),
      async () => {
        const next = arkaneStormCenter(placed),
          circle = zone.shapes?.[0];
        await zone.update({
          ...(circle ? { shapes: [{ ...(circle.toObject?.() ?? circle), x: next.x, y: next.y }] } : next),
          [`flags.${MODULE_ID}.arkaneStorm`]: { ...state, moveClaims: [...state.moveClaims, key].slice(-50) }
        });
        return true;
      }
    );
  } finally {
    await placed.delete();
  }
}
export function arkaneStormRecord(zone, target, combat) {
  if (
    !enabled() ||
    !isGmAuthority() ||
    !arkaneStormActive(zone) ||
    !combat?.started ||
    !target?.actor ||
    target.uuid === arkaneStormData(zone).sourceTokenUuid
  )
    return null;
  const snapshot = combatTurnSnapshot(combat),
    data = arkaneStormData(zone);
  if (!protectiveZoneContains(zone, target, target.parent)) return null;
  return {
    id: `arkane-storm:${data.requestId}:${target.uuid}:${turn(snapshot)}`,
    kind: "arkane-storm",
    name: "Шторм сил: спасбросок",
    sceneId: target.parent.id,
    sourceActorUuid: zone.flags[MODULE_ID].sourceActor,
    sourceTokenUuid: data.sourceTokenUuid,
    sourceItemUuid: data.sourceItemUuid,
    targetTokenUuid: target.uuid,
    templateUuid: zone.uuid,
    input: { dc: data.dc, level: data.level, itemSnapshot: data.itemSnapshot, turn: turn(snapshot) }
  };
}
export async function resolveArkaneStorm(record) {
  if (!enabled() || !isGmAuthority()) return false;
  const source = await fromUuid(record.sourceTokenUuid),
    item = await fromUuid(record.sourceItemUuid),
    target = await fromUuid(record.targetTokenUuid),
    zone = await fromUuid(record.templateUuid);
  if (
    !source?.actor ||
    !item ||
    !target?.actor ||
    source.actor.uuid !== record.sourceActorUuid ||
    target.parent.id !== record.sceneId
  )
    return { status: "needs-review" };
  return useAuraPulse({
    scene: target.parent,
    sourceToken: arkanePlaceable(source),
    sourceItem: item,
    snapshot: record.input.itemSnapshot,
    targets: [arkanePlaceable(target)],
    template: zone,
    event: {
      save: "con",
      dc: String(record.input.dc),
      damage: [{ formula: "6d12", type: "force" }],
      onSave: "half",
      metadata: { arkaneResolved: true }
    },
    eventKey: record.id
  });
}
registerAutomationEvent("arkane-storm", resolveArkaneStorm);
export async function runArkaneStormRecord(record) {
  if (!record) return false;
  return runAutomationEvent(record, () => resolveArkaneStorm(record), {
    queued: record.input.needsTurnReview === true || canvas.scene?.id !== record.sceneId
  });
}
export function captureArkaneStormEntry(token, changes) {
  if (!enabled() || !isGmAuthority() || !["x", "y", "elevation"].some(key => Object.hasOwn(changes, key))) return [];
  const combat = encounterForScene(token.parent),
    next = {
      x: token.x,
      y: token.y,
      width: token.width,
      height: token.height,
      elevation: token.elevation,
      actor: token.actor,
      uuid: token.uuid,
      parent: token.parent,
      ...changes
    };
  return zones(token.parent)
    .filter(
      zone => !protectiveZoneContains(zone, token, token.parent) && protectiveZoneContains(zone, next, token.parent)
    )
    .map(zone => arkaneStormRecord(zone, next, combat))
    .filter(Boolean);
}
export async function cleanArkaneStorms(scene) {
  if (!enabled() || !isGmAuthority()) return;
  for (const zone of zones(scene)) if (!arkaneStormActive(zone)) await zone.delete();
}
export function captureArkaneMovement(token, changes, options) {
  if (!enabled() || !["x", "y", "elevation"].some(key => Object.hasOwn(changes, key)) || !zones(token.parent).length)
    return;
  // preUpdate runs only on the initiating client. Transport plain coordinates,
  // then let the active GM re-evaluate the actual committed destination/zone.
  const combat = encounterForScene(token.parent),
    snapshot = combat && combatTurnSnapshot(combat);
  options[MODULE_ID] ??= {};
  options[MODULE_ID].arkaneStormFrom = {
    targetUuid: token.uuid,
    x: token.x,
    y: token.y,
    elevation: token.elevation,
    turn: turn(snapshot)
  };
}
export async function applyArkaneMovement(token, changes, options) {
  if (!enabled() || !isGmAuthority()) return;
  const before = options?.[MODULE_ID]?.arkaneStormFrom;
  if (
    !before ||
    before.targetUuid !== token.uuid ||
    ![before.x, before.y, before.elevation ?? 0].every(Number.isFinite)
  )
    return;
  const prior = {
      uuid: token.uuid,
      parent: token.parent,
      actor: token.actor,
      width: token.width,
      height: token.height,
      x: before.x,
      y: before.y,
      elevation: before.elevation ?? 0
    },
    committed = Object.fromEntries(
      ["x", "y", "elevation"].filter(key => Object.hasOwn(changes, key)).map(key => [key, token[key]])
    );
  for (const record of captureArkaneStormEntry(prior, committed)) {
    if (before.turn && record.input.turn !== before.turn) {
      record.id = record.id.slice(0, -record.input.turn.length) + before.turn;
      record.input.turn = before.turn;
      record.input.needsTurnReview = true;
    }
    await runArkaneStormRecord(record);
  }
}
export function installArkaneStormHooks() {
  const report = reportFailure("Arkane storm");
  Hooks.on("preUpdateToken", captureArkaneMovement);
  Hooks.on("updateToken", (token, changes, options) => report(applyArkaneMovement(token, changes, options)));
  Hooks.on("updateCombat", (combat, changes) => {
    if (!enabled() || !isGmAuthority() || !isForwardTurn(combat, changes)) return;
    const snapshot = combatTurnSnapshot(combat),
      target = snapshot.current.token;
    if (target?.parent)
      for (const zone of zones(target.parent)) {
        const record = arkaneStormRecord(zone, target, combat);
        if (record) report(runArkaneStormRecord(record));
      }
  });
  Hooks.on("updateWorldTime", () => {
    for (const scene of game.scenes ?? []) report(cleanArkaneStorms(scene));
  });
  const cleanSource = actor => {
    for (const scene of game.scenes ?? [])
      if (zones(scene).some(zone => zone.flags[MODULE_ID].sourceActor === actor.uuid)) report(cleanArkaneStorms(scene));
  };
  Hooks.on("updateActor", actor => cleanSource(actor));
  for (const hook of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect"])
    Hooks.on(hook, effect => {
      if (effect.parent?.documentName === "Actor") cleanSource(effect.parent);
    });
  Hooks.on("deleteItem", item => {
    if (item.actor) cleanSource(item.actor);
  });
  Hooks.on("updateItem", item => {
    if (item.actor) cleanSource(item.actor);
  });
  Hooks.on("deleteToken", token => report(cleanArkaneStorms(token.parent)));
  Hooks.on("canvasReady", () => report(cleanArkaneStorms(canvas.scene)));
  Hooks.on("deleteActor", actor => {
    for (const scene of game.scenes ?? [])
      for (const zone of zones(scene)) if (zone.flags[MODULE_ID].sourceActor === actor.uuid) report(zone.delete());
  });
}
