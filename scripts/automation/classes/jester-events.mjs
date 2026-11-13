import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, findFeature, automationData, automationAction, reportFailure } from "../shared/helpers.mjs";
import { jesterLevel, jesterAvailable, jesterPoints, changeJesterChaos, jesterRestCompleted } from "./jester.mjs";
import { jesterMaximum } from "../shared/jester-definitions.mjs";
import { controlJester, offerJesterMovement, jesterGm } from "./jester-actions.mjs";
import { isGmAuthority, registerGmRequest, requestGm } from "../shared/gm-requests.mjs";
import { applyNativeOnce } from "../shared/native-applications.mjs";
import { askOwner, confirmOwner, chooseSceneTokens, promptOwner } from "../shared/owner-prompts.mjs";
import { encounterForScene, combatTurnSnapshot } from "../shared/combat-flow.mjs";
import { inFeet } from "../shared/combat-benefits.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { runAutomationEvent, registerAutomationEvent } from "../shared/event-ledger.mjs";

export function jesterNaturalFaces(message) {
  return (message.rolls ?? []).flatMap(roll =>
    (roll.dice ?? roll.terms ?? [])
      .filter(die => die.faces === 20)
      .flatMap(die =>
        (die.results ?? [])
          .filter(row => row.active !== false && row.discarded !== true && [1, 20].includes(row.result))
          .map(row => row.result)
      )
  );
}
export function jesterRound(source) {
  const combat = encounterForScene(source.parent, source);
  if (!combat) return null;
  const snapshot = combatTurnSnapshot(combat);
  return `${snapshot.id}:${snapshot.current.round}`;
}
export async function grantJesterLaughter(actor, source, target, { key, round }) {
  if (
    !enabled() ||
    !isGmAuthority() ||
    jesterLevel(actor) < 2 ||
    !findFeature(actor, "jester-laughter") ||
    !round ||
    !key ||
    !target?.actor ||
    target.parent?.id !== source.parent?.id ||
    !inFeet(source, target, 60, source.parent)
  )
    return false;
  if (canvas.scene?.id !== source.parent.id) return false;
  return serialMutation(`jester-laugh:${actor.uuid}`, async () => {
    const claims = actor.getFlag(MODULE_ID, "jesterLaughterClaims") ?? [];
    if (
      claims.some(row => row.round === round || row.key === key) ||
      jesterPoints(actor) >= jesterMaximum(jesterLevel(actor))
    )
      return false;
    if (
      !(await confirmOwner(
        actor,
        "Смех зала",
        "Вы видите это существо в 60 футах; оно только что получило действующий результат к20=1/20? Получить 1 очко хаоса раз за этот раунд?"
      ))
    )
      return false;
    await actor.setFlag(MODULE_ID, "jesterLaughterClaims", [...claims, { key, round }].slice(-100));
    const actual = await changeJesterChaos(actor, 1);
    await offerJesterMovement(actor, source, target, actual);
    return true;
  });
}
registerAutomationEvent("jester-laugh", async record => {
  const source = await fromUuid(record.sourceTokenUuid),
    target = await fromUuid(record.targetTokenUuid),
    actor = source?.actor;
  return actor ? grantJesterLaughter(actor, source, target, { key: record.id, round: record.input.round }) : false;
});
export async function handleJesterRollMessage(message) {
  if (!enabled() || !isGmAuthority()) return;
  const speaker = message.speaker ?? {},
    scene = game.scenes?.get?.(speaker.scene) ?? [...(game.scenes ?? [])].find(s => s.id === speaker.scene),
    target = scene?.tokens?.get?.(speaker.token) ?? [...(scene?.tokens ?? [])].find(t => t.id === speaker.token);
  if (!target?.actor) return;
  const seen = new Set(),
    candidates = [];
  for (const source of scene.tokens ?? []) {
    const actor = source.actor;
    if (
      !actor ||
      seen.has(actor.uuid) ||
      jesterLevel(actor) < 2 ||
      !findFeature(actor, "jester-laughter") ||
      !inFeet(source, target, 60, scene)
    )
      continue;
    const owner = promptOwner(actor);
    if (
      !owner.isGM &&
      (message.blind ||
        (message.whisper?.length && !message.whisper.some(user => (user.id ?? user) === owner.id)) ||
        (target.hidden && !target.actor.testUserPermission?.(owner, "OWNER")))
    )
      continue;
    seen.add(actor.uuid);
    const round = jesterRound(source);
    if (round) candidates.push({ actor, source, round });
  }
  if (message.flags?.core?.initiativeRoll && jesterLevel(target.actor))
    await requestGm(
      "jester-initiative",
      target.actor,
      { sourceUuid: target.uuid, messageUuid: message.uuid },
      { requestId: `jester-initiative:${message.uuid}` }
    );
  if (!jesterNaturalFaces(message).length) return;
  for (const { actor, source, round } of candidates) {
    const id = `jester-laugh:${actor.uuid}:${message.uuid}`;
    await runAutomationEvent(
      {
        id,
        kind: "jester-laugh",
        sceneId: scene.id,
        sourceActorUuid: actor.uuid,
        sourceTokenUuid: source.uuid,
        targetTokenUuid: target.uuid,
        input: { round },
        name: "Смех зала"
      },
      () => grantJesterLaughter(actor, source, target, { key: id, round }),
      { queued: canvas.scene?.id !== scene.id }
    );
  }
}
registerGmRequest("jester-laughter-manual", async (actor, data, { requestId }) => {
  const item = await fromUuid(data.itemUuid),
    source = await fromUuid(data.sourceUuid);
  if (
    !enabled() ||
    item?.actor?.uuid !== actor.uuid ||
    item.system.identifier !== "jester-laughter" ||
    !jesterAvailable(actor, item) ||
    source?.actor?.uuid !== actor.uuid ||
    canvas.scene?.id !== source.parent.id
  )
    return false;
  const selected = await chooseSceneTokens(actor, source.parent, {
    title: "Существо с к20=1/20",
    min: 1,
    max: 1,
    relation: t => inFeet(source, t, 60, source.parent)
  });
  if (!selected?.length) return false;
  if (
    !(await confirmOwner(
      jesterGm(actor),
      "Внешний бросок (GM)",
      "Подтверждён новый бросок к20=1/20 до/при текущем раунде? Повтор старого броска не подходит."
    ))
  )
    return false;
  let round = jesterRound(source);
  if (!round) {
    const number = await askOwner(jesterGm(actor), {
      kind: "number",
      title: "Номер внешнего раунда сцены (GM)",
      min: 1,
      max: 1000000,
      defaultValue: 1
    });
    if (!Number.isInteger(number)) return false;
    round = `${source.parent.id}:external:${number}`;
  }
  return grantJesterLaughter(actor, source, selected[0], { key: requestId, round });
});
export async function grantJesterInitiative(actor, source) {
  if (
    !enabled() ||
    !isGmAuthority() ||
    source?.actor?.uuid !== actor.uuid ||
    !jesterLevel(actor) ||
    !findFeature(actor, "jester-chaos")
  )
    return false;
  const delta = await serialMutation(`jester-initiative:${actor.uuid}`, async () =>
    jesterPoints(actor) === 0 ? changeJesterChaos(actor, 1) : 0
  );
  if (delta && canvas.scene?.id === source.parent.id) await offerJesterMovement(actor, source, source, delta);
  return Boolean(delta);
}
registerGmRequest("jester-initiative", async (actor, data, { requestId }) => {
  const source = await fromUuid(data.sourceUuid),
    message = await fromUuid(data.messageUuid);
  if (
    !source ||
    source.actor?.uuid !== actor.uuid ||
    !message?.flags?.core?.initiativeRoll ||
    message.speaker?.scene !== source.parent.id ||
    message.speaker?.token !== source.id
  )
    return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "jester-initiative", activityUuid: null },
    async () => true,
    async () => {
      await grantJesterInitiative(actor, source);
      return true;
    }
  );
});
registerGmRequest("jester-initiative-manual", async (actor, data, { requestId }) => {
  const item = await fromUuid(data.itemUuid),
    source = await fromUuid(data.sourceUuid);
  if (
    !enabled() ||
    item?.actor?.uuid !== actor.uuid ||
    item.system.identifier !== "jester-chaos" ||
    !jesterAvailable(actor, item) ||
    source?.actor?.uuid !== actor.uuid ||
    jesterPoints(actor) !== 0
  )
    return false;
  if (
    !(await confirmOwner(
      jesterGm(actor),
      "Инициатива без сообщения (GM)",
      "Подтверждён новый фактический бросок инициативы при пустом запасе, а не редактирование числа или повтор прошлого события?"
    ))
  )
    return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "jester-initiative", activityUuid: null },
    async () => true,
    async () => {
      await grantJesterInitiative(actor, source);
      return true;
    }
  );
});
export function installJesterHooks() {
  const report = reportFailure("Jester automation");
  const intercept = activity => {
    if (
      !enabled() ||
      automationData(activity).leaderResolved ||
      automationData(activity).auraPulse ||
      automationData(activity).jesterResolved ||
      automationAction(activity) !== "jester-control"
    )
      return;
    if (!jesterAvailable(activity.actor, activity.item)) return false;
    report(controlJester(activity.actor, activity));
    return false;
  };
  Hooks.on("midi-qol.preTargetingV2", ({ workflow }) => intercept(workflow?.activity));
  Hooks.on("dnd5e.preUseActivity", intercept);
  Hooks.on("dnd5e.restCompleted", (actor, result) => report(jesterRestCompleted(actor, result)));
  // Core initiative messages cover both Actor-sheet and combat-tracker rolls.
  // Numeric edits do not prove a roll; chat-disabled rolls use the explicit button.
  Hooks.on("createChatMessage", message => report(handleJesterRollMessage(message)));
}
