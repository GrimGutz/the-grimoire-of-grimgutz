import { FLAGS, MODULE_ID } from "./constants.mjs";
import { temporaryEffectTiming } from "../effects/temporary-effects.mjs";
import { notify } from "./helpers.mjs";
import { registerGmRequest, requestGm } from "./gm-requests.mjs";

function escapeHtml(value) {
  const text = String(value ?? "");
  const escape = globalThis.foundry?.utils?.escapeHTML;
  if (typeof escape === "function") return escape(text);
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function selectedTargets() {
  return [...(game.user?.targets ?? [])].filter(token => token?.actor);
}

function statusIcon(status) {
  if (!status) return null;
  const statuses = CONFIG.statusEffects ?? [];
  return statuses.find(effect => effect.id === status)?.img ?? null;
}

function targetEffectFlag(effect, key) {
  return effect?.getFlag?.(MODULE_ID, key) ?? effect?.flags?.[MODULE_ID]?.[key];
}

function targetEffectData({
  sourceActor,
  sourceItem,
  key,
  name,
  img,
  status = null,
  description = "",
  changes = [],
  duration = {},
  repeatSave = null,
  flags = {}
}) {
  const statuses = Array.isArray(status) ? status.filter(Boolean) : status ? [status] : [];
  return {
    name,
    img: img ?? sourceItem?.img ?? statusIcon(statuses[0]) ?? "icons/svg/aura.svg",
    type: "base",
    description,
    origin: sourceItem?.uuid ?? sourceActor?.uuid ?? null,
    transfer: false,
    disabled: false,
    showIcon: 1,
    statuses,
    flags: {
      ...flags,
      [MODULE_ID]: {
        ...(flags[MODULE_ID] ?? {}),
        [FLAGS.TARGET_EFFECT]: key,
        [FLAGS.TARGET_SOURCE]: sourceActor?.uuid ?? null,
        [FLAGS.TARGET_KEY]: `${key}:${sourceActor?.uuid ?? "unknown"}`,
        ...(repeatSave ? { repeatSave } : {})
      }
    },
    ...temporaryEffectTiming(duration),
    system: { changes }
  };
}

async function postTargetEffectSummary({
  sourceActor,
  sourceItem,
  title,
  targets,
  statusLabel,
  saveText,
  note
}) {
  const targetNames = targets.map(token => escapeHtml(token.name ?? token.actor?.name ?? "Без имени")).join(", ");
  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor: sourceActor }),
    content: `
      <div class="${MODULE_ID}-target-effect-summary">
        <h3>${escapeHtml(title)}</h3>
        <p><strong>Цели:</strong> ${targetNames || "—"}</p>
        ${statusLabel ? `<p><strong>Состояние:</strong> ${escapeHtml(statusLabel)}</p>` : ""}
        ${saveText ? `<p><strong>Сейв:</strong> ${escapeHtml(saveText)}</p>` : ""}
        ${note ? `<p>${escapeHtml(note)}</p>` : ""}
        ${sourceItem ? `<p><em>Источник: ${escapeHtml(sourceItem.name)}</em></p>` : ""}
      </div>
    `
  });
}

export async function applyTargetEffect({
  sourceActor,
  sourceItem = null,
  targets = selectedTargets(),
  key,
  name,
  img = null,
  status = null,
  statusLabel = "",
  description = "",
  changes = [],
  duration = {},
  repeatSave = null,
  ignoreImmunity = false,
  flags = {},
  replace = true,
  title = name,
  saveText = "",
  note = ""
}) {
  const usableTargets = targets.filter(token => token?.actor);
  if (!usableTargets.length) {
    notify("Выберите одну или несколько целей токенами перед применением состояния.", "warn");
    return false;
  }
  if (!game.user?.isGM && usableTargets.some(token => !token.actor.isOwner)) {
    const result = await requestGm("target-effects", sourceActor, {
      sourceItemUuid: sourceItem?.uuid, targetUuids: usableTargets.map(token => token.actor.uuid),
      key, name, img, status, statusLabel, description, changes, duration, repeatSave, ignoreImmunity, flags, replace, title, saveText, note
    });
    return result.status === "success";
  }

  const applied = [];
  const failed = [];
  for (const token of usableTargets) {
    const actor = token.actor;
    const statuses = Array.isArray(status) ? status : status ? [status] : [];
    const immunities = actor.system?.traits?.ci?.value;
    if (!ignoreImmunity && statuses.some(condition => immunities?.has?.(condition) || immunities?.includes?.(condition))) {
      failed.push(token); continue;
    }
    try {
      const data = targetEffectData({
        sourceActor,
        sourceItem,
        key,
        name,
        img,
        status,
        description,
        changes,
        duration,
        repeatSave,
        flags
      });
      const existing = replace
        ? actor.effects?.find(effect =>
            targetEffectFlag(effect, FLAGS.TARGET_EFFECT) === key
            && targetEffectFlag(effect, FLAGS.TARGET_SOURCE) === sourceActor?.uuid
          )
        : null;
      if (existing) await existing.update(data);
      else await actor.createEmbeddedDocuments("ActiveEffect", [data]);
      applied.push(token);
    } catch (error) {
      console.warn(`${MODULE_ID} | Failed to apply target effect ${key} to ${actor.name}`, error);
      failed.push(token);
    }
  }

  if (applied.length) {
    await postTargetEffectSummary({
      sourceActor,
      sourceItem,
      title,
      targets: applied,
      statusLabel,
      saveText,
      note: failed.length
        ? `${note ? `${note} ` : ""}Часть целей не обновилась: проверьте иммунитеты, права и сообщения консоли.`
        : note
    });
  }
  if (failed.length && !applied.length) notify("Состояние не наложено: проверьте иммунитеты и права на актёров цели.", "warn");
  return applied.length > 0;
}

registerGmRequest("target-effects", async (sourceActor, data, { requesterId }) => {
  if (data.ignoreImmunity && !game.users.get(requesterId)?.isGM) throw Error("Игнорирование иммунитета требует подтверждения GM.");
  const targets = [];
  for (const uuid of data.targetUuids) {
    const actor = await fromUuid(uuid);
    if (actor) targets.push({ actor, name: actor.name });
  }
  const sourceItem = data.sourceItemUuid ? await fromUuid(data.sourceItemUuid) : null;
  const success = await applyTargetEffect({ ...data, sourceActor, sourceItem, targets });
  return { status: success ? "success" : "failed" };
});
