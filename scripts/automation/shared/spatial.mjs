import { dnd5eAtLeast } from "./system-paths.mjs";
export function feetToSceneUnits(feet, scene = canvas?.scene) {
  const units = String(scene?.grid?.units ?? "ft")
    .trim()
    .toLowerCase();
  const normalized = /^(м|метр)/u.test(units) ? "m" : /^(фт|фут)/u.test(units) ? "ft" : units;
  const convert = globalThis.dnd5e?.utils?.convertLength ?? game?.dnd5e?.utils?.convertLength;
  if (convert && ["ft", "m", "mi", "km", "yd", "in"].includes(normalized))
    return dnd5eAtLeast("6.1")
      ? convert(Number(feet), "ft", { to: normalized, strict: false, legacy: false }).value
      : convert(Number(feet), "ft", normalized, { strict: false });
  const feetPerUnit = { ft: 1, m: 1 / 0.3048, mi: 5280, km: 1000 / 0.3048, yd: 3, in: 1 / 12 };
  return Number(feet) / (feetPerUnit[normalized] ?? 1);
}

function tokenDocument(token) {
  return token?.document ?? token;
}
function sceneGrid(scene) {
  return typeof scene?.grid?.measurePath === "function" ? scene.grid : canvas?.scene === scene ? canvas?.grid : null;
}
function bounds(token, scene) {
  const doc = tokenDocument(token),
    size = Number(scene?.grid?.size ?? canvas?.dimensions?.size ?? 100) || 100;
  const width = Number(token?.w ?? Number(doc?.width ?? 1) * size),
    height = Number(token?.h ?? Number(doc?.height ?? 1) * size);
  const center = token.center ??
    doc.getCenterPoint?.() ?? { x: Number(doc.x ?? 0) + width / 2, y: Number(doc.y ?? 0) + height / 2 };
  return { x: center.x - width / 2, y: center.y - height / 2, width, height, elevation: Number(doc.elevation ?? 0) };
}
/** Centre of a token (placeable or document, on any scene) in scene pixels. */
export function tokenCenterPoint(token, scene) {
  const box = bounds(token, scene);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
export function tokenOccupiedPoints(token, scene) {
  const doc = tokenDocument(token),
    grid = sceneGrid(scene);
  if (doc.getOccupiedGridSpaceOffsets && grid?.getCenterPoint) {
    const offsets = doc.getOccupiedGridSpaceOffsets();
    if (offsets?.length)
      return offsets.map(offset => ({ ...grid.getCenterPoint(offset), elevation: Number(doc.elevation ?? 0) }));
  }
  const rect = bounds(token, scene),
    size = Number(scene?.grid?.size ?? 100) || 100;
  const points = [],
    columns = Math.max(1, Math.ceil(rect.width / size)),
    rows = Math.max(1, Math.ceil(rect.height / size));
  for (let x = 0; x < columns; x++)
    for (let y = 0; y < rows; y++) {
      points.push({
        x: rect.x + ((x + 0.5) * rect.width) / columns,
        y: rect.y + ((y + 0.5) * rect.height) / rows,
        elevation: rect.elevation
      });
    }
  return points;
}

/** Scene units, native diagonal rules and nearest occupied spaces (not token centers). */
export function tokenSceneDistance(left, right, scene = canvas?.scene) {
  if (!left || !right) return Infinity;
  const a = tokenDocument(left),
    b = tokenDocument(right);
  if (left === right || (a.uuid && a.uuid === b.uuid)) return 0;
  const grid = sceneGrid(scene),
    size = Number(scene?.grid?.size ?? 100) || 100,
    distance = Number(scene?.grid?.distance ?? 5) || 5;
  if (grid?.isGridless || scene?.grid?.type === 0) {
    const x = bounds(left, scene),
      y = bounds(right, scene);
    const dx = Math.max(0, x.x - y.x - y.width, y.x - x.x - x.width),
      dy = Math.max(0, x.y - y.y - y.height, y.y - x.y - x.height);
    return Math.hypot((dx / size) * distance, (dy / size) * distance, x.elevation - y.elevation);
  }
  let minimum = Infinity;
  for (const p of tokenOccupiedPoints(left, scene))
    for (const q of tokenOccupiedPoints(right, scene)) {
      const measured = grid?.measurePath?.([p, q])?.distance;
      const fallback = Math.hypot(
        ((p.x - q.x) / size) * distance,
        ((p.y - q.y) / size) * distance,
        p.elevation - q.elevation
      );
      minimum = Math.min(minimum, Number.isFinite(measured) ? measured : fallback);
    }
  return minimum;
}
