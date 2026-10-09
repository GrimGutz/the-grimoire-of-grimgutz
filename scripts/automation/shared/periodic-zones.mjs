import { MODULE_ID } from "./constants.mjs";
import { enabled } from "./helpers.mjs";
import { isForwardTurn } from "./combat-flow.mjs";
import { isGmAuthority } from "./gm-requests.mjs";
import { isEffectActive } from "../effects/temporary-effects.mjs";
import { dispatchAutomationPulse } from "../midi/aura-workflow.mjs";

export async function processPeriodicZones(combat, changes, { pulse = dispatchAutomationPulse } = {}) {
  if (!enabled() || !isGmAuthority() || !isForwardTurn(combat, changes) || !combat.scene) return;
  const scene = combat.scene, previous = combat.combatants?.get?.(combat.previous?.combatantId)
    ?? combat.turns?.[combat.previous?.turn];
  const targetDocument = scene.tokens?.get?.(previous?.tokenId) ?? [...(scene.tokens ?? [])].find(doc => doc.id === previous?.tokenId);
  if (!targetDocument?.actor) return;
  for (const template of [...(scene.regions ?? []), ...(scene.templates ?? [])]) {
    const flags = template.flags?.[MODULE_ID], spec = flags?.periodicZone;
    if (!spec || (flags.zoneExpiresAt != null && Number(flags.zoneExpiresAt) <= Number(game.time?.worldTime ?? 0))) continue;
    if (flags.zoneConcentrationEffect && !isEffectActive(await fromUuid(flags.zoneConcentrationEffect))) continue;
    const source = await fromUuid(spec.sourceTokenUuid), item = await fromUuid(spec.sourceItemUuid);
    if (!source?.actor || !item) continue;
    let inside;
    if (canvas?.ready && canvas.scene?.id === scene.id && MidiQOL?.computeTargetsFromTemplates)
      inside = MidiQOL.computeTargetsFromTemplates([template.uuid], source.uuid, false, "any", "always").some(token => token.document.uuid === targetDocument.uuid);
    else if (template.polygonTree?.testPoint) inside = template.polygonTree.testPoint(targetDocument.getCenterPoint(), 1);
    else {
      // Legacy circle targeting off-canvas uses the saved center, never GM's other scene.
      const center = targetDocument.getCenterPoint?.() ?? { x: targetDocument.x + targetDocument.width * scene.grid.size / 2, y: targetDocument.y + targetDocument.height * scene.grid.size / 2 };
      const radius = Number(template.distance) / Number(scene.grid.distance) * Number(scene.grid.size);
      inside = template.t === "circle" && Math.hypot(center.x - template.x, center.y - template.y) <= radius;
    }
    if (!inside) continue;
    await pulse({ scene, sourceToken: source.object ?? { actor: source.actor, document: source }, sourceItem: item, template,
      targets: [targetDocument.object ?? { actor: targetDocument.actor, document: targetDocument }], event: spec.event,
      eventKey: `zone:${flags.areaCastId}:${targetDocument.uuid}:${combat.id}:${combat.previous.round}:${combat.previous.turn}` });
  }
}
export function installPeriodicZoneHooks() {
  Hooks.on("updateCombat", (combat, changes) => { void processPeriodicZones(combat, changes).catch(error => console.error(`${MODULE_ID} | Periodic zone failed`, error)); });
}
