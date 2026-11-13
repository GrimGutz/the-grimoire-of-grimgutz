import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, automationData } from "../shared/helpers.mjs";
import { FACTORY_MATERIALS, FACTORY_ICON } from "../shared/factory-definitions.mjs";
import { FACTORY_MATERIAL_RULES } from "../shared/factory-materials.mjs";
import { factoryHas, factoryLevel, factoryDC, factoryState, patchFactory } from "./factory.mjs";
import { factoryGm, factoryExpense, factoryTargets, factoryPulse } from "./factory-use.mjs";
import { factoryRestTicket } from "./factory-installation.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import { createSummonedGroup, updateManagedSummon } from "../shared/summons.mjs";
import { applyNativeOnce, nativeApplicationReply } from "../shared/native-applications.mjs";
import { useNativeUtility } from "../shared/native-actions.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { areaActivityData } from "../shared/area-definitions.mjs";
import { useAreaActivity } from "../shared/area-activities.mjs";
import { temporaryEffectTiming } from "../effects/temporary-effects.mjs";
export const factoryChildren = owner =>
  [...(game.actors ?? [])].filter(
    a =>
      a.getFlag?.(MODULE_ID, "summonedBy") === owner.uuid &&
      a.getFlag(MODULE_ID, "summonSource") === "factory-homunculus"
  );
export const factoryChildSnapshot = actor =>
  actor?.getFlag?.(MODULE_ID, "summonSource") === "factory-homunculus"
    ? actor.getFlag(MODULE_ID, "summonTemplate")?.snapshot
    : null;
export function factoryMaterials(owner) {
  return Object.keys(FACTORY_MATERIALS).filter(id =>
    ["iron", "crystal"].includes(id)
      ? factoryHas(owner, "modified")
      : ["adamantine", "mithral"].includes(id)
        ? factoryHas(owner, "immortal")
        : factoryHas(owner, "homunculus")
  );
}
export function factoryHomunculusRecipe(owner, material) {
  const tier = factoryLevel(owner),
    dc = factoryDC(owner),
    prof = Number(owner.system.attributes.prof),
    hp = (material === "adamantine" ? 60 : 20) + 10 * Math.max(0, tier - 2),
    acid = material === "clay",
    attack = {
      name: "Дробление",
      type: "attack",
      attackBonus: prof + tier,
      formula: `1d12 + ${tier}`,
      damageType: "bludgeoning",
      range: 5,
      metadata: { factoryHomunculusSlam: true }
    },
    utilities = [];
  for (const [id, name] of material === "wood"
    ? [["volley", "Залп: сфера 15 футов"]]
    : material === "stone"
      ? [["lethargy", "Каменная летаргия"]]
      : material === "crystal"
        ? [["invisibility", "Невидимость на себя"]]
        : material === "iron"
          ? [["heated", "Нагретое тело: прямое касание (GM)"]]
          : [])
    utilities.push({ name, type: "utility", action: "factory-homunculus", metadata: { factoryChildOperation: id } });
  return {
    kind: `factory-homunculus-${material}`,
    source: "factory-homunculus",
    unique: false,
    name: `${owner.name}: гомункул (${FACTORY_MATERIALS[material]})`,
    img: FACTORY_ICON,
    size: "med",
    type: "construct",
    cr: 0,
    ac: (material === "stone" ? 13 : material === "iron" ? 15 : material === "adamantine" ? 20 : 11) + tier,
    hp,
    hpFormula: String(hp),
    abilities: { str: 18, dex: 10, con: 18, int: 14, wis: 11, cha: 5 },
    movement: { walk: material === "mithral" ? 40 : 30, units: "ft" },
    senses: { darkvision: 60, units: "ft" },
    dr: {
      value: acid
        ? ["acid"]
        : material === "flesh"
          ? ["lightning"]
          : ["wood", "crystal"].includes(material)
            ? ["radiant"]
            : material === "iron"
              ? ["fire"]
              : []
    },
    di: { value: ["poison"] },
    ci: { value: ["charmed", "exhaustion", "frightened", "incapacitated", "paralyzed", "petrified", "poisoned"] },
    languages: { value: [], custom: `Понимает языки ${owner.name}, не говорит.` },
    snapshot: { ownerUuid: owner.uuid, material, tier, dc, prof },
    features: [
      {
        key: "factory-slam",
        name: "Гомункул: Дробление",
        description: `Мультиатака: ${Math.floor(tier / 2)} атак Дроблением действием. Среднее «13» в PDF не совпадает с формулой; используется явная формула 1к12 + ступень. Дополнительные атаки выполняет владелец.`,
        activities: [attack]
      },
      {
        key: "factory-material",
        name: `Материал: ${FACTORY_MATERIALS[material]}`,
        description: FACTORY_MATERIAL_RULES[material],
        activities: utilities
      }
    ],
    effects:
      material === "adamantine"
        ? [
            {
              name: "Адамантин: защита от крита",
              type: "base",
              disabled: false,
              transfer: false,
              statuses: [],
              system: {
                changes: [
                  {
                    key: "flags.midi-qol.grants.noCritical.all",
                    type: "override",
                    value: "true",
                    phase: "initial",
                    priority: 20
                  }
                ]
              }
            }
          ]
        : [],
    note: "Материал, характеристики и активности по PDF. Без придуманного срока/концентрации. Словесные команды, собственная инициатива, перемещение и мультиатака — владелец. УС не приведён в источнике, CR 0 служебный, не игровая оценка сложности."
  };
}
export async function createFactoryHomunculus(owner, activity, source, requestId) {
  const material = await askOwner(owner, {
    title: "Материал нового гомункула",
    choices: factoryMaterials(owner).map(id => [id, FACTORY_MATERIALS[id]])
  });
  if (!factoryMaterials(owner).includes(material)) return false;
  const ticket = await factoryRestTicket(owner, "long");
  if (!ticket) return false;
  if (
    !(await confirmOwner(
      factoryGm(owner),
      "GM: создание после LR",
      "Есть пять кубических футов выбранного материала, завершён новый LR и рядом свободное место? Новый NPC не заменит и не вылечит старого. В PDF нет отдельной денежной цены или лимита один гомункул."
    ))
  )
    return false;
  return applyNativeOnce(
    owner,
    { requestId, action: "factory-create", activityUuid: activity.uuid },
    () => useNativeUtility(activity, { dataPatch: factoryExpense(activity, { activation: "special" }) }),
    async () => {
      if (factoryState(owner).longRest?.id !== ticket.id || factoryState(owner).longRest.used)
        throw Error("Этот LR уже использован для создания.");
      const result = await createSummonedGroup(owner, [factoryHomunculusRecipe(owner, material)], {
        scene: source.parent,
        sourceTokenId: source.id,
        requireScene: true,
        requestId: `${requestId}:create`
      });
      if (result.status !== "success") return { status: "needs-review" };
      if (material === "stone") {
        const child = await fromUuid(result.actorUuids[0]),
          item = child?.items?.find(i => i.getFlag?.(MODULE_ID, "managedSummonFeature") === "factory-material");
        if (item)
          await item.update({
            "system.uses": { max: "1", spent: 0, recovery: [{ period: "sr", type: "recoverAll" }] }
          });
      }
      await patchFactory(owner, { longRest: { ...ticket, used: true, requestId } });
      return true;
    }
  );
}
export async function dismissFactoryHomunculus(owner) {
  const options = factoryChildren(owner),
    uuid = await askOwner(factoryGm(owner), {
      title: "Убрать собственного созданного гомункула",
      choices: options.map(a => [a.uuid, a.name])
    }),
    child = options.find(a => a.uuid === uuid);
  if (!child) return false;
  if (
    !(await confirmOwner(
      factoryGm(owner),
      "GM: убрать гомункула",
      "Удалить только выбранного созданного модулем NPC и его токены? Это не переименование материала или восстановление тела персонажа."
    ))
  )
    return false;
  for (const scene of game.scenes ?? [])
    for (const token of [...(scene.tokens ?? [])])
      if (token.actorId === child.id) await scene.deleteEmbeddedDocuments("Token", [token.id]);
  await child.delete();
  return true;
}
export async function syncFactoryHomunculi(owner) {
  if (!isGmAuthority() || !factoryHas(owner, "homunculus")) return;
  for (const child of factoryChildren(owner)) {
    const material = factoryChildSnapshot(child)?.material;
    if (!Object.hasOwn(FACTORY_MATERIALS, material)) continue;
    const recipe = factoryHomunculusRecipe(owner, material);
    // Update unlinked deltas before their world template, preserving each token's deficit.
    for (const scene of game.scenes ?? [])
      for (const token of scene.tokens ?? [])
        if (token.actorId === child.id && token.actor?.uuid !== child.uuid)
          await updateManagedSummon(token.actor, recipe);
    await updateManagedSummon(child, recipe);
  }
}
registerGmRequest("factory-child", async (actor, data, { requestId }) => {
  if (!enabled() || !isGmAuthority()) return false;
  const old = nativeApplicationReply(actor, requestId);
  if (old) return old;
  const activity = await fromUuid(data.activityUuid),
    source = await fromUuid(data.sourceUuid),
    ctx = factoryChildSnapshot(actor);
  if (
    !ctx ||
    activity?.actor?.uuid !== actor.uuid ||
    source?.actor?.uuid !== actor.uuid ||
    !canvas.ready ||
    canvas.scene.id !== source.parent.id
  )
    return false;
  const op = automationData(activity).factoryChildOperation;
  if (op === "volley" && ctx.material === "wood") {
    if (
      !(await confirmOwner(
        factoryGm(actor),
        "Залп: видимая точка",
        "GM подтверждает видимость выбранной точки в 60 футах?"
      ))
    )
      return false;
    const spec = {
        shape: "sphere",
        size: 15,
        origin: "point",
        maxRange: 60,
        save: "dex",
        dc: String(ctx.dc),
        damage: [{ formula: `${ctx.tier}d6`, type: "piercing" }],
        onSave: "half",
        native: true,
        templateSeconds: null
      },
      a = areaActivityData(activity.toObject(), spec);
    a.flags = { [MODULE_ID]: { factoryResolved: true, action: "", area: spec } };
    const clone = activity.item.clone({ system: { activities: { [activity.id]: a } } }, { keepId: true });
    return applyNativeOnce(
      actor,
      { requestId, action: "factory-volley", activityUuid: activity.uuid },
      () => useAreaActivity(clone.system.activities.get(activity.id), { reportOutcome: true }),
      async workflow => {
        if (!workflow.grimgutzAreaResult) return { status: "needs-review" };
        for (const uuid of workflow.grimgutzAreaResult.templateUuids ?? []) await (await fromUuid(uuid))?.delete();
        return true;
      }
    );
  }
  if (op === "lethargy" && ctx.material === "stone") {
    const selected = await factoryTargets(actor, source, 10, "Видимые цели Каменной летаргии", { max: 100 });
    if (
      !selected?.length ||
      !(await confirmOwner(
        factoryGm(actor),
        "Каменная летаргия",
        "Все выбранные цели видимы? Запрет более одной атаки и выбора действие/бонусное действие контролируют игроки; модуль применит скорость и запрет реакций."
      ))
    )
      return false;
    return applyNativeOnce(
      actor,
      { requestId, action: "factory-lethargy", activityUuid: activity.uuid },
      () => useNativeUtility(activity, { dataPatch: factoryExpense(activity, { cost: 1 }) }),
      async () => {
        const result = await factoryPulse(source, activity.item, selected, { save: "wis", dc: ctx.dc, requestId });
        if (result.status !== "success") return { status: "needs-review" };
        for (const t of selected)
          if (result.failedSaves.includes(t.uuid))
            await t.actor.createEmbeddedDocuments("ActiveEffect", [
              {
                name: "Каменная летаргия",
                img: FACTORY_ICON,
                type: "base",
                transfer: false,
                disabled: false,
                statuses: [],
                ...temporaryEffectTiming({ seconds: 60, actor: t.actor, expiry: "updateWorldTime" }),
                flags: {
                  [MODULE_ID]: {
                    factoryLethargy: true,
                    repeatSave: {
                      ability: "wis",
                      dc: ctx.dc,
                      event: "turnEnd",
                      sourceTokenUuid: source.uuid,
                      targetTokenUuid: t.uuid,
                      sourceItemUuid: activity.item.uuid,
                      damage: [],
                      metadata: { factoryResolved: true }
                    }
                  },
                  dae: { expiryMode: "delete" }
                },
                system: {
                  changes: [
                    ...["walk", "fly", "swim", "climb", "burrow"].map(k => ({
                      key: `system.attributes.movement.${k}`,
                      type: "multiply",
                      value: "0.5",
                      phase: "initial",
                      priority: 30
                    })),
                    {
                      key: "flags.midi-qol.actions.reactionsMax",
                      type: "override",
                      value: "0",
                      phase: "initial",
                      priority: 20
                    }
                  ]
                }
              }
            ]);
        return true;
      }
    );
  }
  if (op === "heated" && ctx.material === "iron") {
    const selected = await factoryTargets(factoryGm(actor), source, 5, "GM: настоящее прямое касание");
    if (
      !selected?.length ||
      !(await confirmOwner(factoryGm(actor), "Нагретое тело", "Подтверждено касание, не просто соседство токенов?"))
    )
      return false;
    return applyNativeOnce(
      actor,
      { requestId, action: "factory-heated", activityUuid: activity.uuid },
      async () => true,
      () => factoryPulse(source, activity.item, selected, { damage: [{ formula: "1d10", type: "fire" }], requestId })
    );
  }
  if (op === "invisibility" && ctx.material === "crystal") {
    const spells = [...(actor.items ?? [])].filter(i => i.type === "spell" && i.system.identifier === "invisibility"),
      spell = spells[0],
      cast = [...(spell?.system.activities?.values?.() ?? [])][0];
    if (!cast) throw Error("Добавьте гомункулу нативную Невидимость для её настоящих эффектов/концентрации.");
    const d = cast.toObject();
    d.consumption = { spellSlot: false, targets: [] };
    d.flags = { [MODULE_ID]: { factoryResolved: true, action: "" } };
    const clone = spell.clone({ system: { activities: { [cast.id]: d } } }, { keepId: true });
    return applyNativeOnce(
      actor,
      { requestId, action: "factory-invisibility", activityUuid: activity.uuid },
      () =>
        MidiQOL.completeActivityUse(
          clone.system.activities.get(cast.id),
          {
            midiOptions: {
              targetUuids: [source.uuid],
              workflowOptions: { ignoreUserTargets: true, targetConfirmation: "none" }
            }
          },
          { configure: false }
        ),
      async () => true
    );
  }
  return false;
});
export function controlFactoryHomunculus(actor, activity) {
  const source =
    canvas.tokens?.controlled?.map(t => t.document).find(t => t.actor?.uuid === actor.uuid) ??
    canvas.tokens?.placeables?.map(t => t.document).find(t => t.actor?.uuid === actor.uuid);
  return requestGm(
    "factory-child",
    actor,
    { activityUuid: activity.uuid, sourceUuid: source?.uuid },
    { timeoutMs: 180000 }
  );
}
