import { MODULE_ID } from "./constants.mjs";
import { feetToSceneUnits, tokenSceneDistance } from "./spatial.mjs";

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

function tokenCenter(token) {
  return token?.center ?? {
    x: Number(token?.document?.x ?? 0) + Number(token?.w ?? 0) / 2,
    y: Number(token?.document?.y ?? 0) + Number(token?.h ?? 0) / 2
  };
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
  return activeSceneTokens().filter(token =>
    (includeOrigin || !sameToken(originToken, token))
    && tokenDistance(originToken, token) <= feetToSceneUnits(radius ?? 0)
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
  color = "#7f5cff"
}) {
  const scene = canvas?.scene;
  if (!scene || !canvas?.ready || !originToken) return null;

  try {
    const center = tokenCenter(originToken);
    const [template] = await scene.createEmbeddedDocuments("MeasuredTemplate", [{
      t: "circle",
      author: game.user.id,
      x: center.x,
      y: center.y,
      direction: 0,
      distance: feetToSceneUnits(radius ?? 0, scene),
      hidden: Boolean(originToken.document?.hidden),
      borderColor: color,
      fillColor: color,
      flags: {
        [MODULE_ID]: {
          zoneTemplate: true,
          zoneLabel: label,
          sourceActor: actor?.uuid ?? null
        }
      }
    }]);
    return template;
  } catch (error) {
    console.warn(`${MODULE_ID} | Failed to create zone template`, error);
    return null;
  }
}

export async function rollZoneDamage({
  actor,
  sourceToken = null,
  formula,
  damageType = "",
  flavor = "Зона"
}) {
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

export async function applyTemporaryHp(tokens, amount) {
  const applied = [];
  const failed = [];
  const value = Math.max(0, Number(amount ?? 0));

  for (const token of tokens) {
    const actor = token?.actor;
    if (!actor) continue;
    try {
      const current = Number(actor.system?.attributes?.hp?.temp ?? 0);
      if (!Number.isFinite(current) || current < value) {
        await actor.update({ "system.attributes.hp.temp": value });
      }
      applied.push(token);
    } catch (error) {
      console.warn(`${MODULE_ID} | Failed to apply temporary HP to ${actor.name}`, error);
      failed.push(token);
    }
  }

  return { applied, failed };
}

function tokenList(tokens) {
  if (!tokens?.length) return "—";
  return tokens.map(token => escapeHtml(token.name ?? token.actor?.name ?? "Без имени")).join(", ");
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
  const bodyRows = rows.map(row => `
    <tr>
      <th style="text-align:left;">${escapeHtml(row.label)}</th>
      <td>${row.tokens ? tokenList(row.tokens) : escapeHtml(row.value)}</td>
    </tr>
  `).join("");
  const noteHtml = notes.length
    ? `<ul>${notes.map(note => `<li>${escapeHtml(note)}</li>`).join("")}</ul>`
    : "";

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
