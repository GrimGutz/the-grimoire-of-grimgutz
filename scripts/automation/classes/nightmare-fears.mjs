import { MODULE_ID } from "../shared/constants.mjs";
import { NIGHTMARE_FEARS, NIGHTMARE_ICON, nightmareFearLimit } from "../shared/nightmare-definitions.mjs";
import {
  nightmareFears,
  nightmareFearData,
  nightmareLevel,
  nightmareDC,
  nightmareFrightened
} from "../shared/nightmare-state.mjs";
import { enabled, findFeature } from "../shared/helpers.mjs";
import { isEffectActive, temporaryEffectTiming } from "../effects/temporary-effects.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { isGmAuthority } from "../shared/gm-requests.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import { encounterForScene, combatTurnSnapshot } from "../shared/combat-flow.mjs";
import { useAuraPulse } from "../midi/aura-workflow.mjs";
import { processRepeatedSaves } from "../effects/repeated-saves.mjs";
import { applyNativeOnce, nativeApplicationReply } from "../shared/native-applications.mjs";
import { rememberNightmareTarget } from "./nightmare.mjs";
import { canReact, recordModuleReaction } from "../shared/combat-benefits.mjs";

const object = token => token.object ?? { actor: token.actor, document: token };
const gm = actor => ({ uuid: actor.uuid, testUserPermission: user => user.isGM });
export function nightmareTargetEpoch(token) {
  const combat = encounterForScene(token.parent, token);
  if (!combat) return `${token.parent?.id}:outside:${token.actor.getFlag?.(MODULE_ID, "nightmareExternalTurn") ?? 0}`;
  const snapshot = combatTurnSnapshot(combat),
    index = (combat.turns ?? []).findIndex(
      entry =>
        (entry.token?.uuid ?? entry.token?.document?.uuid) === token.uuid ||
        (entry.tokenId === token.id && (!entry.sceneId || entry.sceneId === token.parent.id))
    );
  return `${combat.id}:${Number(snapshot.current.round) - (Number(snapshot.current.turn) < index ? 1 : 0)}:${index}`;
}
export function nightmareManifestation(id, { blockedStatus = false } = {}) {
  const changes = [],
    statuses = [],
    change = (key, value, type = "add", phase = "initial", priority = 20) =>
      changes.push({ key, value: String(value), type, phase, priority });
  if (id === "agora") {
    change("system.attributes.ac.bonus", -2);
    change("system.abilities.dex.bonuses.save", -2);
  }
  if (id === "algo") change("flags.midi-qol.disadvantage.attack.all", "true", "override");
  if (id === "atych")
    for (const path of [
      ...["str", "dex", "con", "int", "wis", "cha"].map(key => `system.abilities.${key}.save.roll.mode`),
      "system.attributes.concentration.roll.mode",
      "system.attributes.death.roll.mode"
    ])
      change(path, -1, "downgrade", "final");
  if (id === "claustro")
    for (const mode of ["walk", "burrow", "climb", "fly", "swim"])
      change(`system.attributes.movement.${mode}`, 0, "override", "final", 100);
  if (id === "nycto" && !blockedStatus) statuses.push("blinded");
  if (id === "thanato") statuses.push("frightened");
  return { changes, statuses };
}
export async function imposeNightmareFear(actor, item, source, target, entry, { requestId, replaced = null } = {}) {
  if (!isGmAuthority()) throw Error("Страх накладывает активный GM.");
  return serialMutation(`nightmare-fears:${target.actor.uuid}`, async () => {
    const own = nightmareFears(target.actor).filter(effect => nightmareFearData(effect).sourceActorUuid === actor.uuid),
      same = own.find(effect => nightmareFearData(effect).fear === entry.id);
    if (
      !same &&
      own.length >= nightmareFearLimit(nightmareLevel(actor)) &&
      !own.some(effect => effect.uuid === replaced)
    )
      throw Error("Требуется выбрать заменяемый страх.");
    const state = {
      fear: entry.id,
      sourceActorUuid: actor.uuid,
      sourceTokenUuid: source.uuid,
      sourceItemUuid: item.uuid,
      targetTokenUuid: target.uuid,
      dc: nightmareDC(actor),
      nonce: requestId,
      appliedAt: Number(game.time.worldTime),
      manifested: false
    };
    if (state.dc == null) throw Error("Не выбрана Характеристика кошмара.");
    const data = {
      name: `Навязанный страх: ${entry.name}`,
      img: NIGHTMARE_ICON,
      type: "base",
      origin: item.uuid,
      transfer: false,
      disabled: false,
      showIcon: 1,
      statuses: [],
      ...temporaryEffectTiming({ seconds: 60, actor: target.actor }),
      flags: { [MODULE_ID]: { nightmareFear: state }, dae: { expiryMode: "delete" } },
      system: { changes: [] }
    };
    if (same)
      await same.update(
        { ...data, [`flags.${MODULE_ID}.-=repeatSave`]: null, [`flags.${MODULE_ID}.-=repeatSaveReview`]: null },
        { [MODULE_ID]: { reactivate: true } }
      );
    else {
      const made = await target.actor.createEmbeddedDocuments("ActiveEffect", [data]);
      if (!made?.length) throw Error("Страх не создан.");
      if (replaced) await own.find(effect => effect.uuid === replaced)?.delete();
    }
    await rememberNightmareTarget(actor, target, "imposed");
    return true;
  });
}
export async function triggerNightmareFear(record) {
  if (!enabled() || !isGmAuthority()) return false;
  const target = await fromUuid(record.targetTokenUuid),
    source = await fromUuid(record.sourceTokenUuid),
    item = await fromUuid(record.sourceItemUuid),
    effect = await fromUuid(record.effectUuid);
  if (!target?.actor || !source?.actor || !item || source.parent.id !== target.parent.id) return false;
  return serialMutation(`nightmare-trigger:${target.actor.uuid}`, async () => {
    const data = nightmareFearData(effect);
    if (
      !isEffectActive(effect) ||
      data?.nonce !== record.nonce ||
      data.manifested ||
      data.targetTokenUuid !== target.uuid
    )
      return false;
    const previous = nativeApplicationReply(target.actor, record.id);
    if (previous) return previous;
    const epoch = record.epoch ?? nightmareTargetEpoch(target),
      claims = target.actor.getFlag(MODULE_ID, "nightmareFearCooldowns") ?? {};
    if (claims[data.fear]?.epoch === epoch) return false;
    const entry = NIGHTMARE_FEARS.find(entry => entry.id === data.fear);
    if (
      !entry ||
      !(await confirmOwner(
        gm(source.actor),
        `Условие страха: ${entry.name}`,
        `Подтверждён ПОЛНЫЙ текст условия именно в момент события? ${record.hint ?? "Если контекст неизвестен, пропустите."}`
      ))
    )
      return false;
    if (!isEffectActive(effect) || nightmareFearData(effect)?.nonce !== record.nonce) return false;
    await target.actor.setFlag(MODULE_ID, "nightmareFearCooldowns", {
      ...claims,
      [data.fear]: { epoch, requestId: record.id }
    });
    const result = await applyNativeOnce(
      target.actor,
      { requestId: record.id, action: "nightmare-trigger", activityUuid: item.uuid },
      () =>
        useAuraPulse({
          scene: source.parent,
          sourceToken: object(source),
          sourceItem: item,
          targets: [object(target)],
          eventKey: `${record.id}:trigger`,
          event: { save: "wis", dc: String(record.dc ?? data.dc), damage: [], onSave: "none", returnSaveOutcome: true }
        }),
      async outcome => {
        if (outcome?.status !== "success") return { status: "needs-review" };
        if (!outcome.failedSaves.includes(target.uuid)) return true;
        if (!isEffectActive(effect) || nightmareFearData(effect)?.nonce !== record.nonce)
          return { status: "needs-review" };
        const immunities = target.actor.system?.traits?.ci?.value;
        if (data.fear === "nycto" && (immunities?.has?.("blinded") || immunities?.includes?.("blinded"))) return true;
        const manifestation = nightmareManifestation(data.fear),
          repeatSave = {
            ability: "wis",
            dc: record.dc ?? data.dc,
            event: "turnEnd",
            damage: [],
            sourceTokenUuid: source.uuid,
            sourceItemUuid: item.uuid,
            targetTokenUuid: target.uuid,
            ...(data.fear === "thanato" ? { metadata: { nightmareRepeatDisadvantage: true } } : {})
          };
        await effect.update({
          name: `Проявление: ${entry.name}`,
          statuses: manifestation.statuses,
          "system.changes": manifestation.changes,
          [`flags.${MODULE_ID}.nightmareFear`]: { ...data, manifested: true },
          [`flags.${MODULE_ID}.repeatSave`]: repeatSave
        });
        if (data.fear === "thanato" && canReact(target.actor)) {
          if (
            await confirmOwner(
              target.actor,
              "Танатофобия: немедленное перемещение",
              "Используйте доступную реакцию и переместитесь вручную как можно дальше от источника, избегая явно опасных участков. Подтвердить выполнение?"
            )
          )
            await recordModuleReaction(target.actor, target.parent);
        }
        if (record.timing === "end")
          await processRepeatedSaves(target.actor, "turnEnd", {
            eventKey: `immediate:${record.id}`,
            effectUuid: effect.uuid
          });
        return true;
      }
    );
    if (result.status === "cancelled") {
      const latest = target.actor.getFlag(MODULE_ID, "nightmareFearCooldowns") ?? {};
      if (latest[data.fear]?.requestId === record.id) {
        if (claims[data.fear]) latest[data.fear] = claims[data.fear];
        else delete latest[data.fear];
        await target.actor.setFlag(MODULE_ID, "nightmareFearCooldowns", latest);
      }
    }
    return result;
  });
}
export async function chooseNightmareReplacement(actor, target, entry) {
  const own = nightmareFears(target.actor).filter(effect => nightmareFearData(effect).sourceActorUuid === actor.uuid);
  if (
    own.some(effect => nightmareFearData(effect).fear === entry.id) ||
    own.length < nightmareFearLimit(nightmareLevel(actor))
  )
    return { replaced: null };
  const chosen = await askOwner(actor, {
    title: "Выберите свой заменяемый страх",
    choices: own.map(effect => [effect.uuid, effect.name])
  });
  return own.some(effect => effect.uuid === chosen) ? { replaced: chosen } : null;
}
export async function applyNightmareFrightened(actor, item, source, target, { requestId, override = false } = {}) {
  const immunity = target.actor.system?.traits?.ci?.value;
  if (!override && (immunity?.has?.("frightened") || immunity?.includes?.("frightened"))) return true;
  const { addCombatBenefit } = await import("../shared/combat-benefits.mjs"),
    effect = await addCombatBenefit(source, target, item, {
      kind: "nightmare-awakened",
      expiry: "sourceStart",
      remaining: null
    });
  await effect.update({
    statuses: ["frightened"],
    [`flags.${MODULE_ID}.nightmareAwakened`]: { requestId, override, sourceActorUuid: actor.uuid }
  });
  if (!encounterForScene(source.parent, source))
    await effect.update({ start: null, duration: { value: null, units: "seconds", expiry: null, expired: false } });
  await rememberNightmareTarget(actor, target, "frightened");
  return true;
}
