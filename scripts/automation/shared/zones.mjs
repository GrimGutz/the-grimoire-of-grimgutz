import { MODULE_ID } from "./constants.mjs";
import { feetToSceneUnits, tokenCenterPoint, tokenSceneDistance } from "./spatial.mjs";
import { boundedNumber, boundedText, requireToken } from "./request-validation.mjs";
import { isGmAuthority, registerGmRequest, requestGm } from "./gm-requests.mjs";
import { isEffectActive } from "../effects/temporary-effects.mjs";
import { summonConcentrationActivity } from "./summon-lifecycle.mjs";
import { itemUses, notify } from "./helpers.mjs";
import { inspiringTemporaryHp } from "./leader-presence-definitions.mjs";
import { sceneZone, sceneZones } from "./scene-zones.mjs";
import { t } from "./i18n.mjs";

const zoneOperations = new Map();
registerGmRequest("create-circle-zone", (owner, data, context) => {
  const previous = zoneOperations.get(owner.uuid) ?? Promise.resolve();
  const operation = previous.catch(() => {}).then(() => createZoneLocally(owner, data, context));
  zoneOperations.set(owner.uuid, operation);
  void operation
    .finally(() => {
      if (zoneOperations.get(owner.uuid) === operation) zoneOperations.delete(owner.uuid);
    })
    .catch(() => {});
  return operation;
});

const ZONE_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * The template a circle-zone request may create, built on the GM: a circle of
 * at most 120 ft centred on the owner's token, labelled and coloured, with no
 * other module flags. Zone automation flags are added only by the GM code that
 * validates the ability using the zone.
 */
function circleZoneDefinition(owner, scene, requested, originToken) {
  if (originToken.actor?.uuid !== owner.uuid) throw Error(t("Requests.ZoneOwnToken"));
  const radius = boundedNumber(requested?.radius, 0, 120, NaN);
  if (!Number.isFinite(radius)) throw Error(t("Requests.ZoneRadius"));
  const color = ZONE_COLOR.test(requested?.color ?? "") ? requested.color : "#7f5cff";
  const center = tokenCenterPoint(originToken.object ?? originToken, scene);
  return {
    t: "circle",
    author: game.user.id,
    x: center.x,
    y: center.y,
    direction: 0,
    distance: feetToSceneUnits(radius, scene),
    hidden: Boolean(originToken.hidden),
    borderColor: color,
    fillColor: color,
    flags: {
      [MODULE_ID]: {
        zoneTemplate: true,
        zoneLabel: boundedText(requested?.label, 100),
        sourceActor: owner.uuid
      }
    }
  };
}

async function createZoneLocally(owner, data, { requestId }) {
  const scene = game.scenes?.get?.(data.sceneId);
  if (!scene) throw Error("Сцена зоны не найдена.");
  const existing = sceneZones(scene).find(zone => zone.getFlag?.(MODULE_ID, "zoneRequestId") === requestId);
  if (existing) return { status: "success", templateUuid: existing.uuid, templateId: existing.id };
  let resource,
    charged = 0,
    effect,
    template;
  try {
    const activity = data.concentration?.activityUuid ? await fromUuid(data.concentration.activityUuid) : null;
    if (data.concentration && (!activity || (activity.actor ?? activity.item?.actor)?.uuid !== owner.uuid))
      throw Error("Не найдена активность концентрации зоны.");
    const current = data.concentration ? [...(owner.concentration?.effects ?? [])] : [];
    const replacing = current.length >= Number(owner.system?.attributes?.concentration?.limit ?? 1);
    if (replacing && current.some(entry => !data.concentration.replaceConcentration?.includes(entry.uuid)))
      throw Error("Завершение текущей концентрации не подтверждено.");
    if (data.resource) {
      resource = await fromUuid(data.resource.itemUuid);
      const cost = Number(data.resource.cost);
      if (
        resource?.parent?.uuid !== owner.uuid ||
        !Number.isInteger(cost) ||
        cost < 1 ||
        itemUses(resource).remaining < cost
      )
        throw Error("Недостаточно ресурса зоны.");
      await resource.update({ "system.uses.spent": itemUses(resource).spent + cost });
      charged = cost;
    }
    const definition = circleZoneDefinition(
      owner,
      scene,
      data.template,
      await requireToken(data.originTokenUuid, { scene })
    );
    definition.flags[MODULE_ID].zoneRequestId = requestId;
    if (Number(data.seconds) > 0)
      definition.flags[MODULE_ID].zoneExpiresAt = Number(game.time?.worldTime ?? 0) + Number(data.seconds);
    [template] = await scene.createEmbeddedDocuments("MeasuredTemplate", [definition]);
    if (!template) throw Error("Шаблон зоны не создан.");
    // v14 stores the template as a Region and ignores updates sent through the wrapper.
    template = sceneZone(scene, template.id) ?? template;
    if (activity) {
      if (replacing)
        for (const entry of current) {
          if (!(await owner.endConcentration(entry))?.length) throw Error("Текущая концентрация не завершена.");
        }
      effect = await owner.beginConcentrating(summonConcentrationActivity(activity, data.seconds), {
        duration: { value: data.seconds, units: "seconds", expiry: "updateWorldTime", expired: false },
        flags: { [MODULE_ID]: { zoneConcentration: requestId }, dae: { expiryMode: "delete" } }
      });
      if (!effect) throw Error("Концентрация зоны не создана.");
      await template.setFlag(MODULE_ID, "zoneConcentrationEffect", effect.uuid);
    }
    return { status: "success", templateUuid: template.uuid, templateId: template.id };
  } catch (error) {
    const rollbackErrors = [];
    if (template)
      try {
        await template.delete();
      } catch (failure) {
        rollbackErrors.push(failure.message);
      }
    if (effect)
      try {
        await effect.delete();
      } catch (failure) {
        rollbackErrors.push(failure.message);
      }
    if (charged && !rollbackErrors.length)
      try {
        await resource.update({ "system.uses.spent": Math.max(0, itemUses(resource).spent - charged) });
      } catch (failure) {
        rollbackErrors.push(failure.message);
      }
    return { status: rollbackErrors.length ? "needs-review" : "failed", error: error.message, rollbackErrors };
  }
}

export async function cleanupZoneTemplates() {
  if (!isGmAuthority()) return;
  for (const scene of game.scenes ?? [])
    for (const template of sceneZones(scene)) {
      const flags = template.flags?.[MODULE_ID];
      if (!flags?.zoneTemplate) continue;
      try {
        const expired = flags.zoneExpiresAt != null && Number(flags.zoneExpiresAt) <= Number(game.time?.worldTime ?? 0);
        const concentrationLost =
          flags.zoneConcentrationEffect && !isEffectActive(await fromUuid(flags.zoneConcentrationEffect));
        const sourceToken =
          flags.periodicZone?.sourceTokenUuid ??
          flags.protectiveZone?.sourceTokenUuid ??
          flags.hunterZone?.sourceTokenUuid;
        const sourceLost =
          (flags.sourceActor && !(await fromUuid(flags.sourceActor))) ||
          (sourceToken && !(await fromUuid(sourceToken)));
        if (expired || concentrationLost || sourceLost) await template.delete();
      } catch (error) {
        console.error(`${MODULE_ID} | Zone cleanup failed for ${template.uuid}`, error);
      }
    }
}

export function installZoneHooks() {
  let running = null,
    requested = false;
  const schedule = () => {
    if (!isGmAuthority()) return;
    requested = true;
    if (running) return;
    running = (async () => {
      do {
        requested = false;
        await cleanupZoneTemplates();
      } while (requested);
    })().finally(() => {
      running = null;
      if (requested) schedule();
    });
  };
  Hooks.once("ready", schedule);
  Hooks.on("updateWorldTime", schedule);
  Hooks.on("updateCombat", schedule);
  Hooks.on("deleteActiveEffect", schedule);
  Hooks.on("updateActiveEffect", schedule);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function activeSceneTokens() {
  return canvas?.tokens?.placeables?.filter(token => token?.actor) ?? [];
}

function tokenUuid(token) {
  return token?.document?.uuid ?? token?.document?.id ?? token?.id ?? "";
}

function sameToken(left, right) {
  return tokenUuid(left) === tokenUuid(right);
}

export function sourceTokenForActor(actor) {
  if (!actor || !canvas?.ready) return null;
  const controlled = canvas.tokens?.controlled?.find(token => token.actor?.uuid === actor.uuid);
  if (controlled) return controlled;
  const activeTokens = actor.getActiveTokens?.() ?? [];
  if (activeTokens.length) return activeTokens[0];
  return activeSceneTokens().find(token => token.actor?.uuid === actor.uuid) ?? null;
}

export function firstTargetToken() {
  return [...(game.user?.targets ?? [])].find(token => token?.actor) ?? null;
}

export function tokenDistance(sourceToken, targetToken) {
  return tokenSceneDistance(sourceToken, targetToken);
}

export function tokensWithinRadius(originToken, radius, { includeOrigin = true } = {}) {
  if (!originToken || !canvas?.ready) return [];
  return activeSceneTokens().filter(
    token =>
      (includeOrigin || !sameToken(originToken, token)) &&
      tokenDistance(originToken, token) <= feetToSceneUnits(radius ?? 0)
  );
}

function disposition(token) {
  return Number(token?.document?.disposition ?? 0);
}

function isAlly(sourceToken, targetToken) {
  const sourceDisposition = disposition(sourceToken);
  const targetDisposition = disposition(targetToken);
  return sourceDisposition !== 0 && sourceDisposition === targetDisposition;
}

function isEnemy(sourceToken, targetToken) {
  const sourceDisposition = disposition(sourceToken);
  const targetDisposition = disposition(targetToken);
  return sourceDisposition !== 0 && targetDisposition !== 0 && sourceDisposition !== targetDisposition;
}

export function groupTokensByDisposition(sourceToken, tokens, { includeSelfAsAlly = false } = {}) {
  const groups = {
    self: [],
    allies: [],
    enemies: [],
    neutral: []
  };

  for (const token of tokens) {
    if (sameToken(sourceToken, token)) {
      groups.self.push(token);
      if (includeSelfAsAlly) groups.allies.push(token);
    } else if (isAlly(sourceToken, token)) {
      groups.allies.push(token);
    } else if (isEnemy(sourceToken, token)) {
      groups.enemies.push(token);
    } else {
      groups.neutral.push(token);
    }
  }
  return groups;
}

export async function createCircleTemplate({
  actor,
  originToken = null,
  radius,
  label,
  seconds = 6,
  concentration = null,
  resource = null,
  color = "#7f5cff"
}) {
  const scene = canvas?.scene;
  if (!scene || !canvas?.ready || !originToken) return null;

  try {
    const result = await requestGm("create-circle-zone", actor, {
      sceneId: scene.id,
      originTokenUuid: originToken.document?.uuid ?? originToken.uuid,
      template: { radius: Number(radius ?? 0), label, color },
      seconds,
      concentration,
      resource
    });
    if (result.status !== "success") {
      if (result.status !== "pending") notify(result.error ?? "Зону создать не удалось.", "warn");
      return null;
    }
    return (
      (await fromUuid(result.templateUuid)) ?? sceneZone(scene, result.templateId) ?? { uuid: result.templateUuid }
    );
  } catch (error) {
    console.warn(`${MODULE_ID} | Failed to create zone template`, error);
    return null;
  }
}

export async function rollZoneDamage({ actor, sourceToken = null, formula, damageType = "", flavor = "Зона" }) {
  const RollClass = CONFIG.Dice?.DamageRoll ?? Roll;
  const roll = await new RollClass(formula, actor?.getRollData?.() ?? {}, {
    type: damageType,
    flavor
  }).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor, token: sourceToken }),
    flavor: damageType ? `${flavor} (${damageType})` : flavor
  });
  return roll;
}

export async function applyTemporaryHp(tokens, amount, { sourceActor = null } = {}) {
  if (sourceActor && !game.user?.isGM && tokens.some(token => !token.actor?.isOwner)) {
    const result = await requestGm("zone-temp-hp", sourceActor, {
      targetUuids: tokens.map(token => token.actor.uuid),
      amount
    });
    return {
      applied: tokens.filter(token => result.applied?.includes(token.actor.uuid)),
      failed: tokens.filter(token => result.failed?.includes(token.actor.uuid)),
      pending: result.status === "pending"
    };
  }
  const applied = [];
  const failed = [];
  const value = Math.max(0, Number(amount ?? 0));

  for (const token of tokens) {
    const actor = token?.actor;
    if (!actor) continue;
    try {
      const current = Number(actor.system?.attributes?.hp?.temp ?? 0);
      const boosted = inspiringTemporaryHp(actor, value);
      if (!Number.isFinite(current) || current < boosted) {
        await actor.update({ "system.attributes.hp.temp": boosted });
      }
      applied.push(token);
    } catch (error) {
      console.warn(`${MODULE_ID} | Failed to apply temporary HP to ${actor.name}`, error);
      failed.push(token);
    }
  }

  return { applied, failed };
}

registerGmRequest("zone-temp-hp", async (_sourceActor, data) => {
  const tokens = [];
  for (const uuid of new Set(data.targetUuids ?? [])) {
    const actor = await fromUuid(uuid);
    if (actor) tokens.push({ actor });
  }
  const result = await applyTemporaryHp(tokens, data.amount);
  return {
    status: "success",
    applied: result.applied.map(token => token.actor.uuid),
    failed: result.failed.map(token => token.actor.uuid)
  };
});

function tokenList(tokens) {
  if (!tokens?.length) return "—";
  return (
    tokens
      .filter(token => !token.document?.hidden)
      .map(token => escapeHtml(token.name ?? token.actor?.name ?? "Без имени"))
      .join(", ") || "—"
  );
}

export async function postZoneSummary({
  actor,
  sourceToken = null,
  title,
  radius,
  originToken = null,
  rows = [],
  notes = []
}) {
  const originName = originToken ? escapeHtml(originToken.name ?? originToken.actor?.name ?? "точка") : "—";
  const bodyRows = rows
    .map(
      row => `
    <tr>
      <th style="text-align:left;">${escapeHtml(row.label)}</th>
      <td>${row.tokens ? tokenList(row.tokens) : escapeHtml(row.value)}</td>
    </tr>
  `
    )
    .join("");
  const noteHtml = notes.length ? `<ul>${notes.map(note => `<li>${escapeHtml(note)}</li>`).join("")}</ul>` : "";

  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor, token: sourceToken }),
    content: `
      <div class="${MODULE_ID}-zone-summary">
        <h3>${escapeHtml(title)}</h3>
        <p><strong>Центр:</strong> ${originName}; <strong>радиус:</strong> ${escapeHtml(radius)} футов.</p>
        <table>${bodyRows}</table>
        ${noteHtml}
      </div>
    `
  });
}
