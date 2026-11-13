import { MODULE_ID } from "../shared/constants.mjs";
import { findFeature, itemUses, enabled } from "../shared/helpers.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import { applyNativeOnce } from "../shared/native-applications.mjs";
import { areaActivityData } from "../shared/area-definitions.mjs";
import { useAreaActivity, areaPlacementAllowed } from "../shared/area-activities.mjs";
import { addCombatBenefit } from "../shared/combat-benefits.mjs";
import { applyTemporaryHp } from "../shared/zones.mjs";
import { isGmAuthority } from "../shared/gm-requests.mjs";
import { encounterForScene } from "../shared/combat-flow.mjs";
import {
  hdAncestry,
  hdDC,
  hdPool,
  hdHas,
  hdBreathSpec,
  hdPatch,
  hdState,
  hdRules,
  hdCharLevel,
  hdChange
} from "./halfdragon.mjs";
import {
  hdGm,
  hdExpense,
  useHdCost,
  hdPulse,
  hdCondition,
  hdTargets,
  hdTurnBenefit,
  hdAvailableHitDice
} from "./halfdragon-use.mjs";
import { placeActivityArea } from "../shared/template-placement.mjs";

export async function hdDiceChoice(actor) {
  const max = itemUses(hdPool(actor)).remaining;
  if (max < 1) throw Error("Нет доступных костей Дыхания.");
  const n = await askOwner(actor, {
    kind: "number",
    title: `Потратить костей Дыхания (1–${max})`,
    min: 1,
    max,
    defaultValue: 1
  });
  return Number.isInteger(n) && n >= 1 && n <= max ? n : null;
}
export async function hdArea(
  actor,
  activity,
  source,
  requestId,
  { spec, cost = 0, resource = activity.item, beforeUse = null, after = async () => true } = {}
) {
  const data = areaActivityData(activity.toObject(), {
    ...spec,
    dc: String(hdDC(actor)),
    native: true,
    templateSeconds: 6
  });
  Object.assign(data, hdExpense(activity, { cost, resource }));
  data.flags = {
    [MODULE_ID]: {
      halfdragonResolved: true,
      halfdragonBreathCast: spec.breath ? requestId : null,
      action: "",
      area: { ...spec, dc: String(hdDC(actor)), native: true, templateSeconds: 6 }
    }
  };
  const a = activity.item
    .clone({ system: { activities: { [activity.id]: data } } }, { keepId: true })
    .system.activities.get(activity.id);
  return applyNativeOnce(
    actor,
    { requestId, action: "halfdragon-area", activityUuid: activity.uuid },
    () =>
      useAreaActivity(a, {
        reportOutcome: true,
        beforeUse: async context => {
          if (!isGmAuthority()) throw Error("Активный GM сменился до расхода.");
          const prepared = beforeUse ? await beforeUse(context) : context.activity;
          if (!isGmAuthority()) throw Error("Активный GM сменился во время выбора.");
          return prepared;
        },
        message: source.hidden ? { rollMode: "gmroll" } : {}
      }),
    async w => {
      if (!w.grimgutzAreaResult) return { status: "needs-review" };
      try {
        return await after(w);
      } finally {
        for (const uuid of w.grimgutzAreaResult.templateUuids) await (await fromUuid(uuid))?.delete();
      }
    }
  );
}
export async function halfdragonBreath(actor, activity, source, requestId) {
  const count = await hdDiceChoice(actor);
  if (!count) return false;
  return hdArea(actor, activity, source, requestId, {
    spec: { ...hdBreathSpec(actor, count), breath: true },
    cost: count,
    resource: hdPool(actor),
    beforeUse: async ({ activity: a, targets }) => {
      if (!hdHas(actor, "sangromancy") || hdAvailableHitDice(actor) < 5 || !targets.length) return a;
      const decision = await askOwner(actor, {
        title: "Сангромантия: потратить 5 HD до урона этого Дыхания?",
        choices: [
          ["yes", "Да: дополнительный CON и уязвимость"],
          ["no", "Нет: обычное Дыхание"]
        ]
      });
      if (decision == null) return false;
      if (decision !== "yes") return a;
      const selected = await askOwner(actor, {
        kind: "checkbox",
        title: "Сангромантия: реальные цели размещённого Дыхания",
        choices: targets.map(t => [t.document.uuid, t.name ?? t.actor.name]),
        min: 1,
        max: targets.length
      });
      if (!selected?.length) return false;
      const legal = new Set(targets.map(t => t.document.uuid));
      if (selected.some(u => !legal.has(u))) return false;
      await hdPatch(actor, {
        breathCasts: Object.fromEntries(
          [
            ...Object.entries(hdState(actor).breathCasts ?? {}),
            [
              requestId,
              {
                sourceUuid: source.uuid,
                itemUuid: activity.item.uuid,
                targetUuids: selected,
                dc: hdDC(actor),
                damageType: hdAncestry(actor).damageType
              }
            ]
          ].slice(-32)
        )
      });
      return a.item
        .clone(
          { system: { activities: { [a.id]: hdExpense(a, { resource: hdPool(actor), cost: count, hitDice: 5 }) } } },
          { keepId: true }
        )
        .system.activities.get(a.id);
    }
  });
}
// The area workflow waits for this hook, and aborts damage on an unknown result.
export async function resolveHalfdragonSangromancy(workflow) {
  const id = workflow?.activity?.flags?.[MODULE_ID]?.halfdragonBreathCast;
  if (!enabled() || !isGmAuthority() || !id || workflow.aborted) return;
  const actor = workflow.actor,
    plan = hdState(actor).breathCasts?.[id];
  if (!plan) return;
  const result = await applyNativeOnce(
    actor,
    { requestId: `${id}:sangromancy`, action: "halfdragon-sangromancy", activityUuid: workflow.activity.uuid },
    async () => true,
    async () => {
      const source = await fromUuid(plan.sourceUuid),
        item = await fromUuid(plan.itemUuid),
        allowed = new Set([...(workflow.targets ?? [])].map(t => t.document?.uuid ?? t.uuid));
      const targets = (await Promise.all(plan.targetUuids.map(fromUuid))).filter(t => t?.actor && allowed.has(t.uuid));
      if (!source?.actor || !item || targets.length !== plan.targetUuids.length) return { status: "needs-review" };
      const r = await hdPulse(source, item, targets, { save: "con", dc: plan.dc, requestId: `${id}:sang-save` });
      if (r.status !== "success") return { status: "needs-review" };
      for (const t of targets)
        if (r.failedSaves.includes(t.uuid))
          await hdTurnBenefit(source, t, findFeature(actor, "halfdragon-sangromancy"), "halfdragon-vulnerability", [
            hdChange("system.traits.dv.value", plan.damageType)
          ]);
      return true;
    }
  );
  if (result.status !== "success") {
    workflow.grimgutzNeedsReview = true;
    workflow.aborted = true;
  }
}
export async function halfdragonFundamentum(actor, activity, source, requestId) {
  const ancestry = hdAncestry(actor);
  if (!ancestry) throw Error("Выберите происхождение.");
  if (ancestry.family === "metallic")
    return hdArea(actor, activity, source, requestId, {
      cost: 1,
      spec: { shape: "cone", size: 15, origin: "self", excludeSelf: true, save: "con", damage: [], onSave: "none" },
      after: async w => {
        if (!(w.failedSaves instanceof Set)) return { status: "needs-review" };
        for (const t of w.failedSaves)
          await hdCondition(source, t.document ?? t, activity.item, {
            kind: "sleep",
            statuses: ["unconscious"],
            seconds: 60
          });
        return true;
      }
    });
  if (ancestry.family === "gem") {
    const targets = await hdTargets(hdGm(actor), source, 30, "GM: видимые существа для телекинеза", {
      max: 100,
      self: true
    });
    if (
      !targets?.length ||
      !(await confirmOwner(
        hdGm(actor),
        "Телекинетическая хватка",
        "Все цели видимы и весят не больше 1000 фунтов? Предметы и разрешённое перемещение в конце хода проводит GM; хватка длится минуту без концентрации."
      ))
    )
      return false;
    return applyNativeOnce(
      actor,
      { requestId, action: "halfdragon-grasp", activityUuid: activity.uuid },
      () => useHdCost(activity, { cost: 1 }),
      async () => {
        const r = await hdPulse(source, activity.item, targets, { save: "str", requestId });
        if (r.status !== "success") return { status: "needs-review" };
        for (const t of targets)
          if (r.failedSaves.includes(t.uuid))
            await hdCondition(source, t, activity.item, {
              kind: "grasp",
              statuses: ["grappled"],
              seconds: hdRules(actor).graspSeconds || null,
              repeat: "str"
            });
        return true;
      }
    );
  }
  return applyNativeOnce(
    actor,
    { requestId, action: "halfdragon-element-armor", activityUuid: activity.uuid },
    () => useHdCost(activity, { cost: 1, activation: "bonus" }),
    async () => {
      for (const e of [...actor.effects]) if (e.getFlag?.(MODULE_ID, "halfdragonElementArmor")) await e.delete();
      const e = await hdCondition(source, source, activity.item, {
        kind: "element-armor",
        seconds: 60,
        extra: { damageType: ancestry.damageType }
      });
      await e.setFlag(MODULE_ID, "halfdragonElementArmor", true);
      return true;
    }
  );
}
export async function hdCircleTargets(activity, source) {
  const data = areaActivityData(activity.toObject(), {
      shape: "sphere",
      size: 20,
      origin: "self",
      damage: [],
      save: "wis"
    }),
    a = activity.item
      .clone({ system: { activities: { [activity.id]: data } } }, { keepId: true })
      .system.activities.get(activity.id),
    center = source.object?.center ??
      source.getCenterPoint?.() ?? {
        x: source.x + (source.width * source.parent.grid.size) / 2,
        y: source.y + (source.height * source.parent.grid.size) / 2
      };
  const placed = [];
  try {
    const areas = await placeActivityArea(a, { origin: center });
    if (!areas) return null;
    placed.push(...areas);
    if (
      !placed.length ||
      canvas.scene?.id !== source.parent.id ||
      placed.some(d => !areaPlacementAllowed(d, source, { origin: "self" }, source.parent))
    )
      return null;
    return MidiQOL.computeTargetsFromTemplates(
      placed.map(d => d.uuid),
      source.uuid,
      false,
      "ally",
      "always"
    ).map(t => t.document ?? t);
  } finally {
    for (const d of placed) await d.delete();
  }
}
export async function halfdragonRoar(actor, activity, source, requestId) {
  const ancestry = hdAncestry(actor);
  if (!ancestry) throw Error("Выберите происхождение.");
  hdExpense(activity, { cost: 1 });
  if (ancestry.family === "chromatic")
    return hdArea(actor, activity, source, requestId, {
      cost: 1,
      spec: {
        shape: "sphere",
        size: 20,
        origin: "self",
        targets: "enemy",
        excludeSelf: true,
        save: "wis",
        damage: [],
        onSave: "none"
      },
      after: async w => {
        if (!(w.failedSaves instanceof Set)) return { status: "needs-review" };
        for (const t of w.failedSaves)
          await hdCondition(source, t.document ?? t, activity.item, {
            kind: "fear",
            statuses: ["frightened"],
            seconds: 60,
            repeat: "wis"
          });
        return true;
      }
    });
  const targets = await hdCircleTargets(activity, source);
  if (!targets?.length) return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "halfdragon-roar", activityUuid: activity.uuid },
    () => useHdCost(activity, { cost: 1 }),
    async () => {
      for (const t of targets) {
        if (ancestry.family === "metallic")
          await addCombatBenefit(source, t, activity.item, {
            kind: "attack-advantage",
            remaining: 1,
            expiry: encounterForScene(source.parent, source)?.started ? "sourceStart" : null
          });
        else {
          const before = Number(t.actor.system.attributes.hp.temp ?? 0);
          await applyTemporaryHp([t], hdCharLevel(actor), { sourceActor: actor });
          const after = Number(t.actor.system.attributes.hp.temp ?? 0);
          if (after > before)
            await t.actor.setFlag(MODULE_ID, "halfdragonRoarHp", { sourceActorUuid: actor.uuid, remaining: after });
        }
      }
      return true;
    }
  );
}
