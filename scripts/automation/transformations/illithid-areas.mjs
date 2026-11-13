import { MODULE_ID } from "../shared/constants.mjs";
import { enabled } from "../shared/helpers.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import { isGmAuthority } from "../shared/gm-requests.mjs";
import { applyNativeOnce } from "../shared/native-applications.mjs";
import { areaActivityData } from "../shared/area-definitions.mjs";
import { useAreaActivity } from "../shared/area-activities.mjs";
import { addCombatBenefit } from "../shared/combat-benefits.mjs";
import { encounterForScene } from "../shared/combat-flow.mjs";
import { isEffectActive } from "../effects/temporary-effects.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { ilLevel, ilDC, ilChange, ilRules, ilState, ilPatch } from "./illithid.mjs";
import {
  ilGm,
  ilExpense,
  useIlCost,
  ilTargets,
  ilPulse,
  ilCondition,
  planIllithidConcentration,
  beginIllithidConcentration
} from "./illithid-use.mjs";
export const ilExtractEligible = t =>
  ["charmed", "incapacitated", "grappled", "unconscious", "paralyzed", "petrified", "stunned"].some(s =>
    t.actor.statuses?.has?.(s)
  );
export async function extractIllithidBrain(actor, activity, source, requestId) {
  const targets = await ilTargets(actor, source, 5, "Очарованная, недееспособная или схваченная цель"),
    t = targets?.[0];
  if (!t) return false;
  if (
    !ilExtractEligible(t) &&
    !(await confirmOwner(
      ilGm(actor),
      "Условие Извлечения Мозга",
      "GM подтверждает очарование, недееспособность или схваченность, которые не представлены стандартным состоянием?"
    ))
  )
    return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "illithid-extract", activityUuid: activity.uuid },
    () => useIlCost(activity, { cost: 1 }),
    () =>
      ilPulse(source, activity.item, [t], {
        save: "int",
        damage: [{ formula: "6d10", type: "psychic" }],
        requestId: `${requestId}:extract`,
        metadata: { illithidExtract: true }
      })
  );
}
export async function useIllithidArea(
  actor,
  activity,
  source,
  requestId,
  { spec, cost = 0, beforeUse = null, after = async () => true }
) {
  const data = areaActivityData(activity.toObject(), {
    ...spec,
    dc: String(ilDC(actor)),
    native: true,
    templateSeconds: 6
  });
  Object.assign(data, ilExpense(activity, { cost }));
  data.flags = {
    [MODULE_ID]: {
      illithidResolved: true,
      action: "",
      area: { ...spec, dc: String(ilDC(actor)), native: true, templateSeconds: 6 }
    }
  };
  const a = activity.item
    .clone({ system: { activities: { [activity.id]: data } } }, { keepId: true })
    .system.activities.get(activity.id);
  return applyNativeOnce(
    actor,
    { requestId, action: `illithid-area:${activity.id}`, activityUuid: activity.uuid },
    () =>
      useAreaActivity(a, {
        reportOutcome: true,
        message: source.hidden ? { rollMode: "gmroll" } : {},
        beforeUse: async c => {
          if (!isGmAuthority()) return false;
          const prepared = beforeUse ? await beforeUse(c) : c.activity;
          return isGmAuthority() ? prepared : false;
        }
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
export const ilSlowRecords = actor =>
  [...(actor.effects ?? [])].filter(
    e => e.getFlag?.(MODULE_ID, "combatBenefit")?.kind === "illithid-slow" && isEffectActive(e)
  );
const slowSignature = changes =>
  JSON.stringify(
    changes.map(c => ({
      key: c.key,
      value: String(c.value),
      type: c.type,
      phase: c.phase ?? "initial",
      priority: Number(c.priority ?? 20)
    }))
  );
export async function syncIllithidSlow(actor) {
  if (!enabled() || !isGmAuthority()) return;
  return serialMutation(`illithid-slow:${actor.uuid}`, async () => {
    const records = ilSlowRecords(actor),
      e = [...(actor.effects ?? [])].find(e => e.getFlag?.(MODULE_ID, "illithidSlowModifiers"));
    if (!records.length) {
      if (e && slowSignature(e.system.changes) === e.getFlag(MODULE_ID, "illithidManagedSlow")) await e.delete();
      return;
    }
    const changes = [
      ...["walk", "fly", "swim", "climb", "burrow"].map(k =>
        ilChange(`system.attributes.movement.${k}`, 0.5, "multiply", "final")
      ),
      ilChange("system.attributes.ac.bonus", -2),
      ilChange("system.abilities.dex.bonuses.save", -2),
      ilChange("flags.midi-qol.actions.reactionsMax", 0, "override")
    ];
    if (!e)
      await actor.createEmbeddedDocuments("ActiveEffect", [
        {
          name: "Горизонт Событий: Замедление",
          img: records[0].img,
          type: "base",
          transfer: false,
          disabled: false,
          statuses: [],
          origin: records[0].origin,
          start: null,
          duration: { value: null, units: "seconds", expiry: null, expired: false },
          flags: { [MODULE_ID]: { illithidSlowModifiers: true, illithidManagedSlow: slowSignature(changes) } },
          system: { changes }
        }
      ]);
  });
}
export async function illithidHorizon(actor, activity, source, requestId) {
  return useIllithidArea(actor, activity, source, requestId, {
    cost: 1,
    spec: {
      shape: "sphere",
      size: 40,
      origin: "point",
      maxRange: 60,
      save: "str",
      damage: [{ formula: "3d10", type: "force" }],
      onSave: "none"
    },
    beforeUse: async ({ activity: a, targets }) => {
      if (
        !(await confirmOwner(
          ilGm(actor),
          "Горизонт Событий: видимая точка",
          "GM видит размещённую точку и подтверждает её видимость в 60 футах? Притягивание и специальные ограничения Замедления проводятся вручную."
        ))
      )
        return false;
      const uuids = await askOwner(ilGm(actor), {
        kind: "checkbox",
        title: "Выбранные существа внутри Горизонта Событий",
        choices: targets.map(t => [t.document.uuid, t.name ?? t.actor.name]),
        min: 1,
        max: targets.length
      });
      if (!uuids?.length || uuids.some(u => !targets.some(t => t.document.uuid === u))) return false;
      targets.splice(0, targets.length, ...targets.filter(t => uuids.includes(t.document.uuid)));
      return a;
    },
    after: async w => {
      if (!(w.failedSaves instanceof Set)) return { status: "needs-review" };
      for (const t of w.failedSaves) {
        const target = t.document ?? t;
        await addCombatBenefit(source, target, activity.item, {
          kind: "illithid-slow",
          expiry: encounterForScene(source.parent, source)?.started ? "sourceEnd" : null
        });
        await syncIllithidSlow(target.actor);
      }
      return true;
    }
  });
}
export const illithidBlast = (actor, activity, source, requestId) =>
  useIllithidArea(actor, activity, source, requestId, {
    spec: {
      shape: "cone",
      size: 30,
      origin: "self",
      excludeSelf: true,
      save: "int",
      damage: [{ formula: `${2 + Math.max(0, ilLevel(actor) - 2)}d8`, type: "psychic" }],
      onSave: "none"
    },
    after: async w => {
      if (!(w.failedSaves instanceof Set)) return { status: "needs-review" };
      for (const t of w.failedSaves)
        await ilCondition(source, t.document ?? t, activity.item, {
          kind: "stun",
          statuses: ["stunned"],
          seconds: 60,
          repeat: "int"
        });
      return true;
    }
  });
export async function illithidMelody(actor, activity, source, requestId) {
  const targets = await ilTargets(ilGm(actor), source, 40, "GM: видимые существа для Мелодии", {
    max: 100,
    self: true
  });
  if (
    !targets?.length ||
    !(await confirmOwner(
      ilGm(actor),
      "Телекинетическая Мелодия",
      "Все выбранные существа видимы и не тяжелее 2000 фунтов? Предметы и допустимое перемещение 20 футов в конце хода проводит GM."
    ))
  )
    return false;
  const rules = ilRules(actor),
    plan = await planIllithidConcentration(actor, rules.melodyConcentration);
  if (!plan) return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "illithid-melody", activityUuid: activity.uuid },
    () => useIlCost(activity, { cost: 1 }),
    async () => {
      const rules = ilRules(actor),
        r = await ilPulse(source, activity.item, targets, { save: "str", requestId });
      if (r.status !== "success") return { status: "needs-review" };
      const concentration = await beginIllithidConcentration(actor, activity, plan, rules.melodySeconds);
      for (const t of targets)
        if (r.failedSaves.includes(t.uuid))
          await ilCondition(source, t, activity.item, {
            kind: "melody",
            statuses: ["grappled"],
            seconds: rules.melodySeconds || null,
            repeat: "str",
            extra: { concentrationUuid: concentration?.uuid ?? null }
          });
      return true;
    }
  );
}
export async function releaseIllithidMelody(actor, activity, source, requestId) {
  const legal = [...source.parent.tokens].filter(t =>
    [...(t.actor?.effects ?? [])].some(
      e =>
        e.getFlag?.(MODULE_ID, "illithidCondition")?.kind === "melody" &&
        e.getFlag(MODULE_ID, "illithidCondition").sourceActorUuid === actor.uuid &&
        isEffectActive(e) &&
        !e.getFlag(MODULE_ID, "illithidReleasePending")
    )
  );
  const ids = await askOwner(ilGm(actor), {
    kind: "checkbox",
    title: "Отпустить собственные удерживаемые цели",
    choices: legal.map(t => [t.uuid, t.name ?? t.actor.name]),
    min: 1,
    max: legal.length
  });
  if (!ids?.length) return false;
  const targets = legal.filter(t => ids.includes(t.uuid));
  if (targets.length !== ids.length) return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "illithid-release", activityUuid: activity.uuid },
    () => useIlCost(activity, { activation: "bonus" }),
    async () => {
      const effects = targets
        .flatMap(t => [...t.actor.effects])
        .filter(
          e =>
            e.getFlag?.(MODULE_ID, "illithidCondition")?.kind === "melody" &&
            e.getFlag(MODULE_ID, "illithidCondition").sourceActorUuid === actor.uuid &&
            isEffectActive(e)
        );
      for (const e of effects) await e.setFlag(MODULE_ID, "illithidReleasePending", requestId);
      const r = await ilPulse(source, activity.item, targets, {
        save: "str",
        damage: [{ formula: "6d10", type: "bludgeoning" }],
        requestId
      });
      if (r.status !== "success") return { status: "needs-review" };
      for (const e of effects) await e.delete();
      return true;
    }
  );
}
