import { MODULE_ID } from "../shared/constants.mjs";
export const halfdragonLivingActive = actor =>
  actor?.getFlag?.(MODULE_ID, "summonTemplate")?.kind === "halfdragon-living" &&
  Number(actor.system?.attributes?.hp?.value) > 0 &&
  Number(actor.getFlag(MODULE_ID, "summonLifecycle")?.expiresAt) > Number(game.time.worldTime);
export const HALFDRAGON_AURAS = [
  {
    id: "halfdragon-living",
    name: "Аура Дыхания",
    sourceFeature: "halfdragon-living-aura",
    radius: 5,
    affects: "nonSelf",
    indicatorColor: "#d8ae5a",
    sourceCondition: t => halfdragonLivingActive(t.actor)
  }
];
