import { FLAGS, MODULE_ID } from "./constants.mjs";
import { temporaryEffectTiming } from "../effects/temporary-effects.mjs";
import { notify } from "./helpers.mjs";

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
        [FLAGS.TARGET_KEY]: `${key}:${sourceActor?.uuid ?? "unknown"}`
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

  const applied = [];
  const failed = [];
  for (const token of usableTargets) {
    const actor = token.actor;
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
        ? `${note ? `${note} ` : ""}Часть целей не обновилась: проверьте права на актёров.`
        : note
    });
  }
  if (failed.length && !applied.length) notify("Не удалось наложить состояние: проверьте права на актёров цели.", "warn");
  return applied.length > 0;
}
