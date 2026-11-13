import { MODULE_ID } from "../shared/constants.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import { createSummonedGroup } from "../shared/summons.mjs";
import { dismissSummonActor } from "../shared/summon-lifecycle.mjs";
import { applyNativeOnce } from "../shared/native-applications.mjs";
import { canReact, recordModuleReaction } from "../shared/combat-benefits.mjs";
import { encounterForScene } from "../shared/combat-flow.mjs";
import { areaActivityData } from "../shared/area-definitions.mjs";
import { areaPlacementAllowed } from "../shared/area-activities.mjs";
import { ilLevel, ilCharLevel, ilState, ilPatch } from "./illithid.mjs";
import { ilGm, useIlCost } from "./illithid-use.mjs";
import { placeActivityArea } from "../shared/template-placement.mjs";
export function illithidMoment(source) {
  const c = encounterForScene(source.parent, source);
  return c?.started ? `${c.id}:${c.round}:${c.turn}` : `time:${Number(game.time.worldTime)}`;
}
export function illithidDevourerRecipe(actor, base, placement) {
  const raw = base.toObject(),
    system = structuredClone(raw.system),
    hp = Number(system.attributes.hp.max ?? base.system.attributes.hp.max) + 2 * ilCharLevel(actor);
  system.attributes.hp = {
    ...system.attributes.hp,
    max: hp,
    value: Number(base.system.attributes.hp.effectiveMax ?? base.system.attributes.hp.max) + 2 * ilCharLevel(actor),
    temp: 0,
    tempmax: 0,
    formula: String(hp)
  };
  return {
    kind: "illithid-devourer",
    source: "illithid-matter",
    unique: false,
    name: `${actor.name}: ${base.name}`,
    img: base.img,
    size: system.traits?.size ?? "tiny",
    type: system.details?.type?.value ?? "aberration",
    hp,
    hpFormula: String(hp),
    ac: Number(base.system.attributes.ac.value ?? base.system.attributes.ac.flat ?? 10),
    abilities: Object.fromEntries(Object.entries(system.abilities).map(([k, v]) => [k, Number(v.value)])),
    placement,
    nativeSystem: system,
    preserveEmbedded: true,
    extraItems: [...(base.items ?? [])].map(i => i.toObject()),
    effects: structuredClone(raw.effects ?? []),
    lifecycle: { seconds: 0 },
    snapshot: {
      ownerUuid: actor.uuid,
      baseActorUuid: base.uuid,
      characterLevel: ilCharLevel(actor),
      tier: ilLevel(actor)
    }
  };
}
export async function dismissIllithidDevourer(actor, state = ilState(actor).devourer) {
  if (!state) return true;
  for (const uuid of state.actorUuids ?? []) {
    const pet = await fromUuid(uuid);
    if (
      pet?.getFlag?.(MODULE_ID, "summonedBy") === actor.uuid &&
      pet.getFlag(MODULE_ID, "summonTemplate")?.kind === "illithid-devourer"
    )
      await dismissSummonActor(pet);
  }
  if (ilState(actor).devourer?.requestId === state.requestId) await ilPatch(actor, { devourer: null });
  return true;
}
export async function chooseIllithidDevourer(actor) {
  const rows = [...(game.actors ?? [])].filter(a => a.type === "npc" && !a.getFlag?.(MODULE_ID, "summoned"));
  for (const pack of game.packs?.values?.() ?? []) {
    if (pack.metadata?.type !== "Actor") continue;
    for (const r of await pack.getIndex())
      if (/intellect.?devourer|пожиратель.*интеллект/iu.test(r.name))
        rows.push({ uuid: r.uuid ?? `Compendium.${pack.collection}.Actor.${r._id}`, name: r.name });
  }
  const uuid = await askOwner(ilGm(actor), {
      title: "GM: настоящий статблок Пожирателя Интеллекта",
      choices: [...new Map(rows.map(r => [r.uuid, r])).values()].map(r => [r.uuid, r.name])
    }),
    base = uuid && (await fromUuid(uuid));
  if (
    base?.type !== "npc" ||
    !(await confirmOwner(
      ilGm(actor),
      "Подтверждение статблока",
      "Это нужный Пожиратель Интеллекта? Его настоящие нативные особенности, владения, эффекты и ресурсы будут сохранены; статблок PDF не задан."
    ))
  )
    return null;
  return base;
}
export async function chooseIllithidPlacement(actor, activity, source) {
  const data = areaActivityData(activity.toObject(), { shape: "sphere", size: 5, save: "int", damage: [] }),
    a = activity.item
      .clone({ system: { activities: { [activity.id]: data } } }, { keepId: true })
      .system.activities.get(activity.id),
    placed = [];
  try {
    const areas = await placeActivityArea(a);
    if (!areas) return null;
    placed.push(...areas);
    const d = placed[0],
      s = d?.shapes?.[0],
      point = Number.isFinite(d?.x) ? { x: d.x, y: d.y } : s ? { x: s.x, y: s.y } : null;
    if (
      !point ||
      canvas.scene?.id !== source.parent.id ||
      !areaPlacementAllowed(d, source, { maxRange: 5 }, source.parent, point)
    )
      return null;
    if (
      !(await confirmOwner(
        ilGm(actor),
        "Место для Пожирателя",
        "GM подтверждает подходящее место в 5 футах от Иллитидa?"
      ))
    )
      return null;
    const grid = Number(source.parent.grid.size);
    return { sceneId: source.parent.id, x: point.x - grid / 2, y: point.y - grid / 2 };
  } finally {
    for (const d of placed) await d.delete();
  }
}
export async function summonIllithidDevourer(actor, activity, source, requestId) {
  const kill = ilState(actor).brainKill;
  if (
    !kill ||
    !kill.matterAvailable ||
    kill.claimed ||
    kill.sourceTokenUuid !== source.uuid ||
    kill.moment !== illithidMoment(source)
  )
    throw Error("Нет неиспользованного подтверждённого убийства в текущем окне реакции.");
  if (actor.statuses?.has?.("dead") || !canReact(actor)) return false;
  const base = await chooseIllithidDevourer(actor);
  if (!base) return false;
  const placement = await chooseIllithidPlacement(actor, activity, source);
  if (!placement) return false;
  const previous = structuredClone(ilState(actor).devourer ?? null);
  return applyNativeOnce(
    actor,
    { requestId, action: "illithid-devourer", activityUuid: activity.uuid },
    async () => {
      if (
        ilState(actor).brainKill?.id !== kill.id ||
        ilState(actor).brainKill.claimed ||
        kill.moment !== illithidMoment(source) ||
        !canReact(actor)
      )
        return false;
      return useIlCost(activity, { activation: "reaction" });
    },
    async () => {
      await ilPatch(actor, { brainKill: { ...kill, claimed: requestId } });
      await recordModuleReaction(actor, source.parent);
      const r = await createSummonedGroup(actor, [illithidDevourerRecipe(actor, base, placement)], {
        scene: source.parent,
        sourceTokenId: source.id,
        requireScene: true,
        requestId: `${requestId}:group`
      });
      if (r.status !== "success") return { status: "needs-review" };
      await ilPatch(actor, { devourer: { ...r, requestId, sceneId: source.parent.id } });
      if (previous) await dismissIllithidDevourer(actor, previous);
      return true;
    }
  );
}
