import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, automationData, automationAction, findFeature, notify, reportFailure } from "../shared/helpers.mjs";
import {
  godHas,
  godFunctional,
  godState,
  patchGod,
  godAvailable,
  godDC,
  godDomain,
  godAlignment,
  syncGod
} from "./god.mjs";
import { godGm, godPulse, applyGodHealing } from "./god-use.mjs";
import { godDawn, godRecover } from "./god-choices.mjs";
import { controlGod } from "./god-actions.mjs";
import { endGodDomain } from "./god-areas.mjs";
import { removeGodGiftItem, cleanupGodGifts, syncGodMercies } from "./god-gifts.mjs";
import { finishGodSaves, prepareGodCounter } from "./god-spells.mjs";
import { blockGodResurrection } from "./god-midi.mjs";
import { automationActors, isEffectActive } from "../effects/temporary-effects.mjs";
import { isGmAuthority, requestGm, registerGmRequest } from "../shared/gm-requests.mjs";
import { applyNativeOnce } from "../shared/native-applications.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { registerAutomationEvent, runAutomationEvent } from "../shared/event-ledger.mjs";
import { combatTurnSnapshot, isForwardTurn } from "../shared/combat-flow.mjs";
import { inFeet } from "../shared/combat-benefits.mjs";
import { onConfirmedDamage } from "../shared/damage-events.mjs";

export async function runGodTurn(record) {
  const source = await fromUuid(record.sourceTokenUuid),
    target = await fromUuid(record.targetTokenUuid);
  if (!source?.actor || !target?.actor || source.parent.id !== record.sceneId || target.parent.id !== record.sceneId)
    return false;
  const actor = source.actor;
  if (record.operation === "strain") {
    if (!godHas(actor, "strain") || !godFunctional(actor)) return false;
    const item = findFeature(actor, "god-strain"),
      save = await godPulse(source, item, [target], { save: "con", dc: record.dc, requestId: `${record.id}:save` });
    if (save.status !== "success") return { status: "needs-review" };
    const dice = save.failedSaves.includes(target.uuid) ? 4 : 2;
    return godPulse(source, item, [target], {
      damage: [{ formula: `${dice}d8`, type: "force" }],
      requestId: `${record.id}:damage`
    });
  }
  if (record.operation === "domain") {
    if (godDomain(actor)?.requestId !== record.domainId) return false;
    if (record.alignment === "good") await applyGodHealing(actor, target.actor, 20);
    else {
      const old = Number(target.actor.system.attributes.hp.value);
      await target.actor.update({ "system.attributes.hp.value": Math.max(0, old - 20) });
    }
    return true;
  }
  const e = await fromUuid(record.effectUuid),
    state = e?.getFlag?.(MODULE_ID, "godJudgment");
  if (!state || !isEffectActive(e)) return false;
  const item = await fromUuid(state.itemUuid);
  if (!item) return { status: "needs-review" };
  if (record.operation === "judgment-start")
    return godPulse(source, item, [target], {
      damage: [{ formula: "2d10", type: "force" }],
      requestId: record.id,
      metadata: { godJudgmentOwn: true }
    });
  const result = await godPulse(source, item, [target], { save: "wis", dc: state.dc, requestId: record.id });
  if (result.status !== "success") return { status: "needs-review" };
  if (result.saves.includes(target.uuid)) await e.delete();
  return true;
}
registerAutomationEvent("god-turn", runGodTurn);
export async function handleGodTurn(combat, changes) {
  if (!enabled() || !isGmAuthority() || !isForwardTurn(combat, changes)) return;
  const s = combatTurnSnapshot(combat),
    moment = `${s.id}:${s.current.round}:${s.current.turn}`,
    records = [];
  const current = s.current.token,
    previous = s.previous.token;
  if (current?.actor) {
    for (const source of current.parent.tokens ?? []) {
      if (!source.actor) continue;
      if (
        source.uuid !== current.uuid &&
        godFunctional(source.actor) &&
        godHas(source.actor, "strain") &&
        Number(source.actor.system.attributes.hp.value) === 0 &&
        inFeet(source, current, 20, current.parent)
      )
        records.push({
          operation: "strain",
          sceneId: current.parent.id,
          sourceTokenUuid: source.uuid,
          targetTokenUuid: current.uuid,
          dc: godDC(source.actor)
        });
      const d = godDomain(source.actor);
      if (
        d?.sourceTokenUuid === source.uuid &&
        d.targetUuids.includes(current.uuid) &&
        inFeet(source, current, 100, current.parent)
      )
        records.push({
          operation: "domain",
          sceneId: current.parent.id,
          sourceTokenUuid: source.uuid,
          targetTokenUuid: current.uuid,
          domainId: d.requestId,
          alignment: godAlignment(source.actor)
        });
    }
  }
  for (const [token, operation] of [
    [current, "judgment-start"],
    [previous, "judgment-end"]
  ])
    if (token?.actor)
      for (const e of token.actor.effects ?? []) {
        const j = e.getFlag?.(MODULE_ID, "godJudgment");
        if (j && isEffectActive(e))
          records.push({
            operation,
            sceneId: token.parent.id,
            sourceTokenUuid: j.sourceTokenUuid,
            targetTokenUuid: token.uuid,
            effectUuid: e.uuid
          });
      }
  for (const r of records) {
    const record = {
      ...r,
      id: `god:${r.operation}:${moment}:${r.sourceTokenUuid}:${r.targetTokenUuid}:${r.effectUuid ?? ""}`,
      kind: "god-turn",
      name: "Божество: событие хода"
    };
    await runAutomationEvent(record, () => runGodTurn(record), {
      queued: !canvas.ready || canvas.scene?.id !== record.sceneId
    });
  }
}
export async function recordGodDamage({ actor, amount, event }) {
  if (!enabled() || !isGmAuthority()) return;
  if (amount > 0)
    for (const e of [...(actor.effects ?? [])]) {
      const j = e.getFlag?.(MODULE_ID, "godJudgment");
      if (j && !(event.godJudgmentOwn && j.sourceActorUuid === event.sourceActorUuid)) await e.delete();
    }
  if (event.godDevourCastId) {
    const owner = await fromUuid(event.sourceActorUuid);
    if (owner)
      await serialMutation(`god-devour:${owner.uuid}`, async () => {
        const d = godState(owner).devour;
        if (!d || d.requestId !== event.godDevourCastId || d.closed || d.confirmed?.[event.targetTokenUuid]) return;
        await patchGod(owner, {
          devour: {
            ...d,
            confirmed: {
              ...d.confirmed,
              [event.targetTokenUuid]: { amount: Math.max(0, Number(amount)), eventKey: event.key }
            }
          }
        });
      });
  }
}
onConfirmedDamage(recordGodDamage);
export function captureGodHp(actor, changes, options = {}) {
  if (!enabled() || !godHas(actor, "united")) return;
  const value = changes["system.attributes.hp.value"] ?? changes.system?.attributes?.hp?.value;
  if (value !== undefined && Number(value) === 0 && Number(actor.system.attributes.hp.value) > 0) {
    options[MODULE_ID] ??= {};
    options[MODULE_ID].godDropId ??= foundry.utils.randomID();
  }
}
registerGmRequest("god-recover", async (actor, _data, { requestId }) => {
  if (!enabled() || !isGmAuthority() || !godHas(actor, "united")) return false;
  const use = [...findFeature(actor, "god-united").system.activities.values()][0];
  return applyNativeOnce(
    actor,
    { requestId: `${requestId}:offer`, action: "god-drop-offer", activityUuid: use.uuid },
    async () => {
      const result = await godRecover(actor, use, requestId, { automatic: true });
      return result?.status === "cancelled" ? false : result;
    },
    async () => true
  );
});
export function observeGodHp(actor, _changes, options) {
  if (enabled() && isGmAuthority() && options?.[MODULE_ID]?.godDropId && Number(actor.system.attributes.hp.value) === 0)
    return requestGm(
      "god-recover",
      actor,
      {},
      { requestId: `god-drop:${actor.uuid}:${options[MODULE_ID].godDropId}`, timeoutMs: 180000 }
    );
}
export async function refreshGodMercyRecipient(actor) {
  if (!enabled() || !isGmAuthority()) return;
  const sources = new Set(
    [...(actor?.effects ?? [])].map(e => e.getFlag?.(MODULE_ID, "godMercy")?.sourceActorUuid).filter(Boolean)
  );
  if (godState(actor).mercies) sources.add(actor.uuid);
  for (const uuid of sources) {
    const source = await fromUuid(uuid);
    if (source) await syncGodMercies(source);
  }
}
export function installGodHooks() {
  const report = reportFailure("God automation");
  const intercept = activity => {
    if (!enabled() || !activity) return;
    const f = automationData(activity);
    if (f.godResolved || f.leaderResolved || f.auraPulse || automationAction(activity) !== "god-control") return;
    if (!godAvailable(activity.actor, activity.item)) {
      notify("Божество: недоступная ступень, подавление либо апатия.", "warn");
      return false;
    }
    report(controlGod(activity.actor, activity));
    return false;
  };
  Hooks.on("dnd5e.preUseActivity", intercept);
  Hooks.on("midi-qol.preTargetingV2", ({ workflow }) => intercept(workflow?.activity));
  Hooks.on("midi-qol.postCheckSaves", finishGodSaves);
  Hooks.on("midi-qol.prePreambleComplete", prepareGodCounter);
  Hooks.on("midi-qol.prePreambleComplete", blockGodResurrection);
  Hooks.on("updateCombat", (c, changes) => report(handleGodTurn(c, changes)));
  Hooks.on("preUpdateActor", captureGodHp);
  Hooks.on("updateActor", (a, c, o) => {
    report(observeGodHp(a, c, o));
    if (enabled() && isGmAuthority() && godState(a).mercies) report(syncGodMercies(a));
  });
  Hooks.on("updateActor", (a, c) => {
    if (Object.hasOwn(c, "system.attributes.prof") || c.system?.attributes?.prof !== undefined)
      report(refreshGodMercyRecipient(a));
  });
  for (const h of ["updateItem", "createItem", "deleteItem"])
    Hooks.on(h, i => {
      if (i.type === "class" && i.parent) report(refreshGodMercyRecipient(i.parent));
    });
  for (const name of ["ready", "updateWorldTime"])
    Hooks.on(name, () => {
      if (!enabled() || !isGmAuthority()) return;
      report(cleanupGodGifts());
      for (const a of automationActors())
        if (godState(a).dawnAt != null && Number(game.time.worldTime) >= Number(godState(a).dawnAt))
          report(godDawn(a, { scheduled: true }));
    });
  Hooks.on("deleteActiveEffect", e => {
    if (!enabled() || !isGmAuthority()) return;
    if (e.getFlag?.(MODULE_ID, "godGift")) report(removeGodGiftItem(e));
    if (e.getFlag?.(MODULE_ID, "godDomain") || e.getFlag?.(MODULE_ID, "godDomainConcentration"))
      report(endGodDomain(e.parent));
  });
}
