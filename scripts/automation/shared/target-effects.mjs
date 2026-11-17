import { FLAGS, MODULE_ID } from "./constants.mjs";
import { temporaryEffectTiming } from "../effects/temporary-effects.mjs";
import { notify } from "./helpers.mjs";
import { registerGmRequest, requestGm } from "./gm-requests.mjs";
import { actorOnScene, requireOwned, requireTokens } from "./request-validation.mjs";
import { t } from "./i18n.mjs";

// Effects a player may ask the GM to put on creatures they do not own. The GM
// rebuilds every effect from its recipe; the request carries only the key, the
// source item and the target tokens.
const recipes = new Map();

/**
 * Allow `key` to be applied through the GM. `build(sourceActor, sourceItem)`
 * returns the applyTargetEffect parameters (without targets), or null when the
 * item cannot produce this effect.
 */
export function registerTargetEffect(key, build) {
  recipes.set(key, build);
}

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

async function postTargetEffectSummary({ sourceActor, sourceItem, title, targets, statusLabel, saveText, note }) {
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
    if (!recipes.has(key) || ignoreImmunity) {
      notify(t("TargetEffects.GmOnly"), "warn");
      return false;
    }
    const result = await requestGm("target-effects", sourceActor, {
      key,
      sourceItemUuid: sourceItem?.uuid,
      targetUuids: usableTargets.map(token => token.document?.uuid ?? token.uuid)
    });
    if (result.status === "failed") notify(result.error ?? t("TargetEffects.NotApplied"), "warn");
    return result.status === "success";
  }

  const applied = [];
  const failed = [];
  for (const token of usableTargets) {
    const actor = token.actor;
    const statuses = Array.isArray(status) ? status : status ? [status] : [];
    const immunities = actor.system?.traits?.ci?.value;
    if (
      !ignoreImmunity &&
      statuses.some(condition => immunities?.has?.(condition) || immunities?.includes?.(condition))
    ) {
      failed.push(token);
      continue;
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
        ? actor.effects?.find(
            effect =>
              targetEffectFlag(effect, FLAGS.TARGET_EFFECT) === key &&
              targetEffectFlag(effect, FLAGS.TARGET_SOURCE) === sourceActor?.uuid
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
  if (failed.length && !applied.length)
    notify("Состояние не наложено: проверьте иммунитеты и права на актёров цели.", "warn");
  return applied.length > 0;
}

registerGmRequest("target-effects", async (sourceActor, data) => {
  const recipe = recipes.get(data.key);
  if (!recipe) throw Error(t("TargetEffects.NotAllowed"));
  const sourceItem = await requireOwned(data.sourceItemUuid, sourceActor, t("TargetEffects.SourceNotOwned"));
  const parameters = recipe(sourceActor, sourceItem);
  if (!parameters) throw Error(t("TargetEffects.SourceCannot"));
  const targets = await requireTokens(data.targetUuids, { max: 20 });
  const scene = targets[0].parent;
  if (targets.some(token => token.parent?.id !== scene?.id) || !actorOnScene(sourceActor, scene))
    throw Error(t("TargetEffects.OtherScene"));
  const success = await applyTargetEffect({
    ...parameters,
    key: data.key,
    ignoreImmunity: false,
    sourceActor,
    sourceItem,
    targets
  });
  return { status: success ? "success" : "failed" };
});
