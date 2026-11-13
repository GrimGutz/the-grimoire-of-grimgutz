import { MODULE_ID } from "../shared/constants.mjs";
import { broodmotherDC, broodmotherTransformationLevel } from "./broodmother.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import { areaActivityData } from "../shared/area-definitions.mjs";
import { useAreaActivity } from "../shared/area-activities.mjs";
import { applyNativeOnce } from "../shared/native-applications.mjs";
import { useNativeUtility } from "../shared/native-actions.mjs";
import { encounterForScene } from "../shared/combat-flow.mjs";
import { feetToSceneUnits } from "../shared/spatial.mjs";
import {
  broodmotherGm,
  broodmotherExpense,
  broodmotherCondition,
  broodmotherChooseCondition
} from "./broodmother-use.mjs";
import { sameZone, sceneZones, zoneOrigin } from "../shared/scene-zones.mjs";

export function broodmotherAreaData(activity, source, kind) {
  const web = kind === "web",
    spec = {
      shape: "line",
      size: web ? 60 : 30,
      width: web ? 4 : 5,
      origin: web ? "point" : "self",
      ...(web ? { maxRange: 5 } : {}),
      excludeSelf: !web,
      save: web ? "str" : "dex",
      dc: String(broodmotherDC(source.actor)),
      damage: [],
      onSave: "none",
      native: true,
      templateSeconds: null
    };
  const data = areaActivityData(activity.toObject(), spec);
  data.flags = { [MODULE_ID]: { action: "", broodmotherResolved: true, area: spec } };
  Object.assign(data, broodmotherExpense(activity, { activation: web ? "action" : "special", cost: web ? 1 : 0 }));
  if (web) data.target.template.height = "20";
  return { data, spec };
}
export function broodmotherPoolCenter(zone, source) {
  const shape = zone.shapes?.[0]?.toObject?.() ?? zone.shapes?.[0],
    size = Number(source.parent.grid.size),
    distance = Number(source.parent.grid.distance ?? 5);
  if (shape?.type === "polygon" && shape.points?.length >= 8) {
    const points = Array.from({ length: shape.points.length / 2 }, (_, i) => ({
        x: shape.points[i * 2],
        y: shape.points[i * 2 + 1]
      })),
      origin = {
        x: source.x + (Number(source.width ?? 1) * size) / 2,
        y: source.y + (Number(source.height ?? 1) * size) / 2
      };
    const far = points
      .sort((a, b) => Math.hypot(b.x - origin.x, b.y - origin.y) - Math.hypot(a.x - origin.x, a.y - origin.y))
      .slice(0, 2);
    return { x: (far[0].x + far[1].x) / 2, y: (far[0].y + far[1].y) / 2 };
  }
  // Cones and lines, as a Region shape (Foundry v14) or template fields: 30 ft along the facing.
  const origin = zoneOrigin(zone);
  if (origin && ["cone", "line"].includes(origin.type) && Number.isFinite(origin.x) && Number.isFinite(origin.y)) {
    const r = (origin.direction * Math.PI) / 180,
      d = (feetToSceneUnits(30, source.parent) / distance) * size;
    return { x: origin.x + Math.cos(r) * d, y: origin.y + Math.sin(r) * d };
  }
  return null;
}
export async function useBroodmotherArea(actor, activity, source, kind, requestId) {
  const combat = encounterForScene(source.parent, source),
    turn = combat?.started ? `${combat.id}:${combat.round}:${combat.turn}` : null;
  if (kind === "bile" && turn && actor.getFlag(MODULE_ID, "broodmotherBileTurn") === turn)
    throw Error("Кислотная желчь уже использована в этот ход.");
  if (
    !(await confirmOwner(
      broodmotherGm(actor),
      kind === "web" ? "Опора стены" : "Замена одной атаки",
      kind === "web"
        ? "Подтверждены твёрдая поверхность и начало стены в пределах досягаемости? Шаблон показывает её горизонтальный след, не полную высоту."
        : "Это замена одной атаки и новое применение в этот ход? Сразу урона нет: сначала покрытие кислотой, затем урон в начале хода цели."
    ))
  )
    return false;
  const { data } = broodmotherAreaData(activity, source, kind),
    clone = activity.item.clone({ system: { activities: { [activity.id]: data } } }, { keepId: true });
  return applyNativeOnce(
    actor,
    { requestId, action: `broodmother-${kind}`, activityUuid: activity.uuid },
    () => useAreaActivity(clone.system.activities.get(activity.id), { reportOutcome: true }),
    async workflow => {
      const result = workflow.grimgutzAreaResult;
      if (!result || !(workflow.failedSaves instanceof Set)) return { status: "needs-review" };
      for (const target of workflow.failedSaves) {
        const token = target.document ?? target;
        if (!token?.actor) continue;
        await broodmotherCondition(source, token, activity.item, {
          kind: webKind(kind),
          statuses: kind === "web" ? ["restrained"] : [],
          extra: { templateUuids: result.templateUuids, damage: `${broodmotherTransformationLevel(actor)}d6` }
        });
      }
      for (const uuid of result.templateUuids) {
        const zone = await fromUuid(uuid);
        if (!zone) continue;
        if (kind === "web")
          await zone.setFlag(MODULE_ID, "broodmotherWall", {
            sourceTokenUuid: source.uuid,
            sourceItemUuid: activity.item.uuid,
            sections: Array(6).fill(15),
            ac: 10,
            height: 20,
            thickness: 4
          });
        else {
          const center = broodmotherPoolCenter(zone, source);
          if (!center) return { status: "needs-review" };
          const radius =
            (feetToSceneUnits(7.5, source.parent) / Number(source.parent.grid.distance ?? 5)) *
            Number(source.parent.grid.size);
          await source.parent.createEmbeddedDocuments("Region", [
            {
              name: "Кислотная лужа: Королева Улья",
              color: "#69a82c",
              hidden: Boolean(source.hidden),
              shapes: [{ type: "circle", ...center, radius }],
              flags: {
                [MODULE_ID]: {
                  broodmotherPool: { sourceTokenUuid: source.uuid, sourceItemUuid: activity.item.uuid, damage: "1d6" }
                }
              }
            }
          ]);
          await zone.delete();
        }
      }
      if (kind === "bile" && turn) await actor.setFlag(MODULE_ID, "broodmotherBileTurn", turn);
      return true;
    }
  );
}
const webKind = kind => (kind === "web" ? "web" : "acid");
export async function removeBroodmotherCoating(actor, activity, source, kind, requestId) {
  const selected = await broodmotherChooseCondition(actor, source, [kind], {
    range: kind === "acid" ? 5 : 100000,
    self: true
  });
  if (!selected) return false;
  // Web escape is the restrained creature's action; acid can be scraped off a
  // neighbour. Do not charge the original Queen for another creature's escape.
  const acting = kind === "web" ? selected.token.actor : actor;
  if (
    !(await confirmOwner(
      acting,
      kind === "web" ? "Освободиться из паутины" : "Удалить кислоту",
      "Использовать действие? Снимается только выбранная связь."
    ))
  )
    return false;
  const item = activity.item.clone({}, { parent: acting, keepId: true }),
    native = item.system.activities.get(activity.id);
  return applyNativeOnce(
    actor,
    { requestId, action: `broodmother-remove-${kind}`, activityUuid: activity.uuid },
    () => useNativeUtility(native, { dataPatch: broodmotherExpense(native) }),
    async () => {
      if (kind === "web") {
        const rolls = await selected.token.actor.rollSavingThrow(
          { ability: "str", target: Number(selected.data.dc) },
          { configure: false }
        );
        if (!rolls?.length) return { status: "needs-review" };
        if (Number(rolls[0].total) < Number(selected.data.dc)) return true;
      }
      await selected.effect.delete();
      return true;
    }
  );
}
export async function damageBroodmotherWall(actor, source) {
  const walls = sceneZones(source.parent).filter(
    z => z.getFlag?.(MODULE_ID, "broodmotherWall")?.sourceTokenUuid === source.uuid
  );
  const uuid = await askOwner(broodmotherGm(actor), {
      title: "Стена паутины",
      choices: walls.map(z => [z.uuid, z.name])
    }),
    zone = walls.find(z => z.uuid === uuid);
  if (!zone) return false;
  const wall = structuredClone(zone.getFlag(MODULE_ID, "broodmotherWall")),
    section = await askOwner(broodmotherGm(actor), {
      title: "Секция 10 футов",
      choices: wall.sections.map((hp, i) => [String(i), `${i + 1}: ${hp}/15`])
    });
  if (section == null || !Number.isInteger(Number(section)) || !Object.hasOwn(wall.sections, Number(section)))
    return false;
  const amount = await askOwner(broodmotherGm(actor), {
    kind: "number",
    title: "Подтверждённый урон секции (уже с уязвимостью к огню)",
    min: 0,
    max: 100000,
    defaultValue: 0
  });
  if (!Number.isFinite(amount) || amount < 0) return false;
  wall.sections[Number(section)] = Math.max(0, wall.sections[Number(section)] - amount);
  await zone.setFlag(MODULE_ID, "broodmotherWall", wall);
  // Do not delete the entire wall or release unrelated captives for one hole.
  if (wall.sections.every(hp => hp === 0)) {
    for (const token of source.parent.tokens ?? [])
      for (const e of [...(token.actor?.effects ?? [])])
        if (e.getFlag?.(MODULE_ID, "broodmotherCondition")?.templateUuids?.some(uuid => sameZone(uuid, zone)))
          await e.delete();
    await zone.delete();
  }
  return true;
}
