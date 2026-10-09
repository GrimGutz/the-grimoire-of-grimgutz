import { FLAGS, MODULE_ID } from "./constants.mjs";
import { feetToSceneUnits, tokenOccupiedPoints } from "./spatial.mjs";

export const AURA_INDICATOR_FLAG = "auraIndicator";
const flag = (doc, key) => doc?.getFlag?.(MODULE_ID, key) ?? doc?.flags?.[MODULE_ID]?.[key];
const documents = collection => collection?.contents ?? (collection?.values ? [...collection.values()] : [...(collection ?? [])]);
export const auraKey = (definition, token) => `${definition.id}:${token.document?.uuid ?? token.id}`;

export function auraIndicatorData(definition, token, scene) {
  const radius = feetToSceneUnits(definition.radius, scene), size = Number(scene.grid.size ?? 100);
  const center = token.center ?? token.document.getCenterPoint();
  const color = definition.indicatorColor ?? "#7f5cff";
  const flags = { [MODULE_ID]: { [AURA_INDICATOR_FLAG]: true, [FLAGS.AURA_EFFECT]: definition.id,
    [FLAGS.AURA_SOURCE]: token.document?.uuid ?? token.id, [FLAGS.AURA_KEY]: auraKey(definition, token),
    auraName: definition.name, sourceActor: token.actor.uuid, auraRadius: definition.radius } };
  if (!scene.regions) return { t: "circle", author: game.user.id, x: center.x, y: center.y, direction: 0,
    distance: radius, hidden: Boolean(token.document.hidden), borderColor: color, fillColor: color, flags };
  const radiusPixels = radius / Number(scene.grid.distance ?? 5) * size;
  let shapes;
  if (scene.grid.type !== 0) {
    // A union over occupied spaces is a true emanation from a large token;
    // gridBased circles use Foundry's own grid/diagonal rules.
    shapes = tokenOccupiedPoints(token, scene).map(point => ({ type: "circle", x: point.x, y: point.y, radius: radiusPixels, gridBased: true }));
  } else {
    const doc = token.document, width = Number(token.w ?? (doc.width ?? 1) * size), height = Number(token.h ?? (doc.height ?? 1) * size);
    const x = center.x - width / 2, y = center.y - height / 2;
    shapes = [{ type: "rectangle", x: x - radiusPixels, y, width: width + 2 * radiusPixels, height, rotation: 0, anchorX: 0, anchorY: 0 },
      { type: "rectangle", x, y: y - radiusPixels, width, height: height + 2 * radiusPixels, rotation: 0, anchorX: 0, anchorY: 0 },
      ...[[x, y], [x + width, y], [x, y + height], [x + width, y + height]]
        .map(([x, y]) => ({ type: "circle", x, y, radius: radiusPixels, gridBased: false }))];
  }
  const elevation = Number(token.document.elevation ?? 0);
  return { name: definition.name, color, shapes, elevation: { bottom: elevation - radius, top: elevation + radius, topInclusive: true },
    attachment: { token: token.document.id }, hidden: Boolean(token.document.hidden), locked: true,
    visibility: globalThis.CONST?.REGION_VISIBILITY?.ALWAYS ?? 2, highlightMode: "coverage", displayMeasurements: false,
    restriction: { enabled: false }, behaviors: [], ownership: { [game.user.id]: 3 }, flags };
}

function signature(document) {
  const data = document?.toObject?.() ?? document;
  const shapes = data.shapes?.map(shape => ({ type: shape.type, x: shape.x, y: shape.y,
    ...(shape.type === "circle" ? { radius: shape.radius, gridBased: Boolean(shape.gridBased) }
      : { width: shape.width, height: shape.height, rotation: Number(shape.rotation ?? 0), anchorX: Number(shape.anchorX ?? 0), anchorY: Number(shape.anchorY ?? 0) }),
    hole: Boolean(shape.hole) }));
  return JSON.stringify({ ...Object.fromEntries(["name", "t", "x", "y", "distance", "color", "borderColor", "fillColor",
    "elevation", "attachment", "hidden", "locked", "visibility", "highlightMode", "displayMeasurements"].map(key => [key, data[key]])),
    shapes, flags: data.flags?.[MODULE_ID] ?? {} });
}

export async function reconcileAuraIndicators(desired, scene) {
  if (!scene || !game.user?.isGM) return new Map();
  const type = scene.regions ? "Region" : "MeasuredTemplate", existing = new Map(), deletes = [];
  const candidates = documents(scene.regions ?? scene.templates).filter(doc => flag(doc, AURA_INDICATOR_FLAG));
  for (const doc of candidates) {
    const key = flag(doc, FLAGS.AURA_KEY);
    if (!key || existing.has(key)) deletes.push(doc.id); else existing.set(key, doc);
  }
  const creates = [], updates = [];
  for (const [key, data] of desired) {
    const current = existing.get(key);
    if (!current) creates.push(data);
    else if (signature(current) !== signature(data)) updates.push({ _id: current.id, ...data });
    existing.delete(key);
  }
  deletes.push(...[...existing.values()].map(doc => doc.id));
  if (deletes.length) await scene.deleteEmbeddedDocuments(type, deletes);
  if (updates.length) await scene.updateEmbeddedDocuments(type, updates);
  if (creates.length) await scene.createEmbeddedDocuments(type, creates);
  return new Map(documents(scene.regions ?? scene.templates).filter(doc => flag(doc, AURA_INDICATOR_FLAG))
    .map(doc => [flag(doc, FLAGS.AURA_KEY), doc]));
}

export function tokensInAuraTemplate(template, source, tokens, scene, { native = true } = {}) {
  if (!template) return null;
  const midi = globalThis.MidiQOL;
  if (native && scene === canvas?.scene && canvas?.ready && game.modules?.get("midi-qol")?.active && midi?.computeTargetsFromTemplates) {
    const selected = new Set(midi.computeTargetsFromTemplates([template.uuid], source.document.uuid, false, "any", "always")
      .map(token => token.document.uuid));
    return new Set(tokens.filter(token => selected.has(token.document.uuid)));
  }
  if (!template.polygonTree?.testPoint) return null; // Legacy/offline fallback retains native distance checks.
  return new Set(tokens.filter(token => {
    const elevation = Number(token.document.elevation ?? 0);
    if (elevation < (template.elevation?.bottom ?? -Infinity) || elevation > (template.elevation?.top ?? Infinity)) return false;
    return tokenOccupiedPoints(token, scene).some(point => template.polygonTree.testPoint(point, 1));
  }));
}
