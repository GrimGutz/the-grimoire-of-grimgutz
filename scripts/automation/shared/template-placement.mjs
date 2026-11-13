import { sceneZone } from "./scene-zones.mjs";

// Interactive placement of an activity's area (spell template) on the canvas.
//
// dnd5e 6.0 replaced `AbilityTemplate.fromActivity(...).drawPreview()` (removed
// in dnd5e 6.2) with `TemplatePlacement.fromActivity(activity)`, which places
// and creates Regions in one call. Older systems (the module supports 5.3+) only
// have the AbilityTemplate flow. Every caller goes through here so both work.

const NO_AREA = "Для способности не задан корректный шаблон области.";

function placementApi() {
  return globalThis.game?.system?.canvas ?? globalThis.dnd5e?.canvas ?? {};
}

function definesArea(activity) {
  const type = activity?.target?.template?.type;
  return Boolean(type && globalThis.CONFIG?.DND5E?.areaTargetTypes?.[type]?.template);
}

async function removeAll(documents) {
  for (const document of documents) {
    try {
      await document.delete();
    } catch (error) {
      console.warn("Area placement cleanup failed", error);
    }
  }
}

/** The updatable zone document for a placed template (its Region on Foundry v14). */
const canonical = document => sceneZone(document?.parent ?? globalThis.canvas?.scene, document?.id) ?? document;

/**
 * Let the user place `activity`'s area and return the created zone documents.
 *
 * Resolves to `null` when the user cancels, after removing anything already
 * placed; throws `missing` when the activity defines no placeable area.
 * `origin` ({x, y}) is where the older AbilityTemplate preview starts.
 */
export async function placeActivityArea(activity, { origin = null, missing = NO_AREA } = {}) {
  const api = placementApi();
  if (api.TemplatePlacement?.fromActivity) {
    if (!definesArea(activity)) throw new Error(missing);
    const created = await api.TemplatePlacement.fromActivity(activity);
    return created?.length ? [...created].map(canonical) : null;
  }
  const previews = api.AbilityTemplate?.fromActivity?.(activity, origin ?? undefined);
  if (!previews?.length) throw new Error(missing);
  const placed = [];
  for (const preview of previews) {
    let result;
    try {
      result = await preview.drawPreview();
    } catch (error) {
      // The legacy preview rejects without a reason when the user cancels.
      if (error) {
        await removeAll(placed);
        throw error;
      }
      result = null;
    }
    const documents = (Array.isArray(result) ? result.flat(Infinity) : [result]).filter(Boolean);
    if (!documents.length) {
      await removeAll(placed);
      return null;
    }
    placed.push(...documents);
  }
  return placed.map(canonical);
}
