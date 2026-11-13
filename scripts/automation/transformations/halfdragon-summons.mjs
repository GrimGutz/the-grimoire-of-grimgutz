import { MODULE_ID } from "../shared/constants.mjs";
import { HALFDRAGON_ICON } from "../shared/halfdragon-definitions.mjs";
import { areaActivityData, areaDamagePart } from "../shared/area-definitions.mjs";
import { areaPlacementAllowed } from "../shared/area-activities.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import { createSummonedGroup } from "../shared/summons.mjs";
import { dismissSummonActor } from "../shared/summon-lifecycle.mjs";
import { summonActivities } from "../shared/summon-activities.mjs";
import { applyNativeOnce } from "../shared/native-applications.mjs";
import { hdLevel, hdDC, hdAncestry, hdState, hdPatch, hdPool, hdRules } from "./halfdragon.mjs";
import { hdGm, useHdCost } from "./halfdragon-use.mjs";
import { hdDiceChoice } from "./halfdragon-areas.mjs";

export function halfdragonLivingRecipe(actor, hp, placement) {
  const tier = hdLevel(actor),
    dc = hdDC(actor),
    type = hdAncestry(actor)?.damageType;
  if (!type) throw Error("Выберите происхождение.");
  const activities = summonActivities([
    {
      name: "Дробление",
      formula: `1d12 + ${tier}`,
      damageType: "bludgeoning",
      attackBonus: Number(actor.system.attributes.prof) + tier,
      range: 5
    }
  ]);
  Object.values(activities)[0].damage.parts.push(areaDamagePart({ formula: "2d6", type }));
  const auraActivities = summonActivities([{ type: "utility", name: "Аура Дыхания: служебный источник" }]);
  return {
    kind: "halfdragon-living",
    source: "halfdragon-living",
    unique: false,
    name: `${actor.name}: Оживлённое Дыхание`,
    img: HALFDRAGON_ICON,
    size: "lg",
    type: "elemental",
    cr: 0,
    hp,
    hpFormula: String(hp),
    ac: 11 + tier,
    abilities: { str: 19, dex: 11, con: 18, int: 6, wis: 10, cha: 5 },
    movement: { walk: 30, fly: 30, units: "ft" },
    senses: { darkvision: 60, units: "ft" },
    dr: [type],
    ci: ["exhaustion", "paralyzed", "petrified", "poisoned", "grappled", "unconscious"],
    languages: { value: ["draconic"], custom: "Понимает Драконий, но не говорит." },
    lifecycle: { seconds: 3600 },
    placement,
    snapshot: { ownerUuid: actor.uuid, dc, tier, damageType: type, prof: Number(actor.system.attributes.prof) },
    extraItems: [
      {
        name: "Дробление",
        type: "feat",
        img: HALFDRAGON_ICON,
        system: {
          identifier: "halfdragon-living-crush",
          description: {
            value: `Мультиатака: ${Math.floor(tier / 2)} атак одним действием; владелец ведёт общий запас действий. Понимает Драконий, не говорит.`
          },
          activities
        }
      },
      {
        name: "Аура Дыхания",
        type: "feat",
        img: HALFDRAGON_ICON,
        system: {
          identifier: "halfdragon-living-aura",
          description: {
            value:
              "Другое существо в начале своего хода в пределах 5 футов: CON, провал — 1к6 стихии. Союзники не исключены."
          },
          activities: auraActivities
        }
      }
    ]
  };
}
export async function dismissHalfdragonLiving(actor, state = hdState(actor).living) {
  if (!state) return true;
  for (const uuid of state.actorUuids ?? []) {
    const pet = await fromUuid(uuid);
    if (
      pet?.getFlag?.(MODULE_ID, "summonedBy") === actor.uuid &&
      pet.getFlag(MODULE_ID, "summonTemplate")?.kind === "halfdragon-living"
    )
      await dismissSummonActor(pet);
  }
  if (hdState(actor).living?.requestId === state.requestId) await hdPatch(actor, { living: null });
  return true;
}
export async function chooseLivingPlacement(actor, activity, source) {
  const data = areaActivityData(activity.toObject(), { shape: "sphere", size: 5, damage: [], save: "con" }),
    a = activity.item
      .clone({ system: { activities: { [activity.id]: data } } }, { keepId: true })
      .system.activities.get(activity.id),
    placed = [];
  try {
    for (const p of game.system.canvas.AbilityTemplate.fromActivity(a)) {
      let r;
      try {
        r = await p.drawPreview();
      } catch (e) {
        if (e) throw e;
        return null;
      }
      if (!r) return null;
      placed.push(...(Array.isArray(r) ? r.flat(Infinity) : [r]));
    }
    const d = placed[0],
      s = d?.shapes?.[0],
      point = Number.isFinite(d?.x) ? { x: d.x, y: d.y } : s ? { x: s.x, y: s.y } : null;
    if (
      !point ||
      canvas.scene?.id !== source.parent.id ||
      !areaPlacementAllowed(d, source, { maxRange: 15 }, source.parent, point)
    )
      return null;
    if (
      !(await confirmOwner(
        hdGm(actor),
        "Свободное место для Большого слуги",
        "Указанная точка — центр свободного места для Большого существа в 15 футах? GM подтверждает объём, препятствия и высоту."
      ))
    )
      return null;
    const grid = Number(source.parent.grid.size);
    return { sceneId: source.parent.id, x: point.x - grid, y: point.y - grid };
  } finally {
    for (const d of placed) await d.delete();
  }
}
export async function summonHalfdragonLiving(actor, activity, source, requestId) {
  const count = await hdDiceChoice(actor);
  if (!count) return false;
  const placement = await chooseLivingPlacement(actor, activity, source);
  if (!placement) return false;
  const previous = structuredClone(hdState(actor).living ?? null);
  return applyNativeOnce(
    actor,
    { requestId, action: "halfdragon-living", activityUuid: activity.uuid },
    () => useHdCost(activity, { resource: hdPool(actor), cost: count }),
    async () => {
      const roll = await new Roll(`${count}d6`).evaluate();
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: "Оживлённое Дыхание: сумма костей — хиты слуги"
      });
      const hp = hdRules(actor).livingHpMode === "count" ? count : Number(roll.total);
      const result = await createSummonedGroup(actor, [halfdragonLivingRecipe(actor, hp, placement)], {
        scene: source.parent,
        sourceTokenId: source.id,
        requireScene: true,
        requestId: `${requestId}:group`
      });
      if (result.status !== "success") return { status: "needs-review" };
      await hdPatch(actor, { living: { ...result, requestId, sceneId: source.parent.id } });
      if (previous) await dismissHalfdragonLiving(actor, previous);
      return true;
    }
  );
}
