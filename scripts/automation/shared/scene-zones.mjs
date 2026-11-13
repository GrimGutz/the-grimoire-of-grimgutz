// Zones (areas the module tracks on a scene) as one document each.
//
// Foundry v14 merged MeasuredTemplate into Region: a template is stored as a
// Region flagged `core.MeasuredTemplate`, and the deprecated Scene#templates
// (removed in v16) rebuilds a wrapper for each of them on every read. Listing
// `[...scene.regions, ...scene.templates]` therefore returned every template
// zone twice under two uuids (per-zone events and effects ran twice), and core
// drops updates made through a wrapper. On v14+ the Region is the only real
// document, so it is the one returned here.

const templatesAreRegions = () => Number(globalThis.game?.release?.generation ?? 0) >= 14;

/** Every zone document of a scene once: Regions on Foundry v14+, Regions and templates (deduplicated) before. */
export function sceneZones(scene) {
  if (!scene) return [];
  const regions = [...(scene.regions ?? [])];
  if (templatesAreRegions()) return regions;
  const ids = new Set(regions.map(zone => zone.id).filter(id => id != null));
  return [...regions, ...[...(scene.templates ?? [])].filter(zone => zone.id == null || !ids.has(zone.id))];
}

/** The updatable zone document for an id (Region on v14+, falling back to a template before). */
export function sceneZone(scene, id) {
  if (!scene || !id) return null;
  return (
    scene.regions?.get?.(id) ??
    (templatesAreRegions() ? null : scene.templates?.get?.(id)) ??
    sceneZones(scene).find(zone => zone.id === id) ??
    null
  );
}

/** Scene id and document id of a zone uuid or document, so template and Region uuids of one zone compare equal. */
export function zoneKey(zoneOrUuid) {
  const uuid = typeof zoneOrUuid === "string" ? zoneOrUuid : zoneOrUuid?.uuid;
  const parts = String(uuid ?? "").split(".");
  return parts.length >= 4 && parts[0] === "Scene" ? `${parts[1]}:${parts.at(-1)}` : String(uuid ?? "");
}

/** Whether two zone uuids or documents denote the same zone, whichever representation each uses. */
export const sameZone = (left, right) => Boolean(zoneKey(left)) && zoneKey(left) === zoneKey(right);

/**
 * Origin and facing of a zone in canvas pixels: a Region's first shape or a
 * template's own fields. `direction` is in degrees; null when the zone has no
 * single origin (polygons).
 */
export function zoneOrigin(zone) {
  const shape = zone?.shapes?.[0]?.toObject?.() ?? zone?.shapes?.[0];
  if (shape) {
    if (!["circle", "cone", "line", "rectangle", "ellipse"].includes(shape.type)) return null;
    return { type: shape.type, x: Number(shape.x), y: Number(shape.y), direction: Number(shape.rotation ?? 0) };
  }
  if (!Number.isFinite(Number(zone?.x)) || !Number.isFinite(Number(zone?.y))) return null;
  const type = { ray: "line", rect: "rectangle" }[zone.t] ?? zone.t ?? "circle";
  return { type, x: Number(zone.x), y: Number(zone.y), direction: Number(zone.direction ?? 0) };
}
