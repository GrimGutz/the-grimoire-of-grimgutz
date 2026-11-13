import { MODULE_ID } from "../shared/constants.mjs";
import { DK_SPECIALISTS } from "../shared/deathknight-definitions.mjs";
import { dkHas, dkState, dkDC, dkTransformationLevel, dkPatch } from "./deathknight.mjs";
import { dkGm, dkTargets, dkExpense } from "./deathknight-use.mjs";
import { dkLevelEffects, dkLevelData } from "./deathknight-levels.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import { createSummonedGroup } from "../shared/summons.mjs";
import { summonActivities } from "../shared/summon-activities.mjs";
import { applyNativeOnce } from "../shared/native-applications.mjs";
import { useNativeUtility } from "../shared/native-actions.mjs";
import { itemUses } from "../shared/helpers.mjs";
import { dkCylinderContains, dkCrucibleActive } from "./deathknight-auras.mjs";
export async function chooseDeathknightSkeleton(actor) {
  const old = dkState(actor).skeletonBaseUuid,
    existing = old && (await fromUuid(old));
  if (existing?.type === "npc") return existing;
  const rows = [...(game.actors ?? [])].filter(a => a.type === "npc" && !a.getFlag?.(MODULE_ID, "summoned"));
  for (const pack of game.packs?.values?.() ?? []) {
    if (pack.metadata?.type !== "Actor") continue;
    for (const r of await pack.getIndex())
      if (/skeleton|скелет/iu.test(r.name))
        rows.push({ uuid: r.uuid ?? `Compendium.${pack.collection}.Actor.${r._id}`, name: r.name });
  }
  const uuid = await askOwner(dkGm(actor), {
      title: "GM: установленный статблок скелета",
      choices: [...new Map(rows.map(r => [r.uuid, r])).values()].map(r => [r.uuid, r.name])
    }),
    base = uuid && (await fromUuid(uuid));
  if (base?.type !== "npc") return null;
  await dkPatch(actor, { skeletonBaseUuid: uuid });
  return base;
}
export async function chooseDeathknightSpecialist(actor) {
  if (!dkHas(actor, "specialist")) return { id: null };
  const id = await askOwner(actor, {
    title: "Специализация нового скелета",
    choices: [["none", "Без специализации"], ...DK_SPECIALISTS.map(s => [s.id, s.name])]
  });
  if (id == null) return null;
  if (id === "none") return { id: null };
  if (!DK_SPECIALISTS.some(s => s.id === id)) return null;
  if (id === "sapper") {
    const dc = await askOwner(dkGm(actor), {
      title: "GM: Сл взрыва Сапёра (PDF её не задаёт)",
      kind: "number",
      min: 1,
      max: 40,
      defaultValue: dkDC(actor)
    });
    if (!Number.isInteger(dc)) return null;
    return { id, dc };
  }
  return { id };
}
export function deathknightSpecialistItems(actor, spec) {
  if (!spec?.id) return [];
  const skeleton = actor,
    prof = Number(skeleton.system.attributes.prof ?? 2),
    ability = k => Math.floor((Number(skeleton.system.abilities[k]?.value ?? 10) - 10) / 2),
    mk = (name, identifier, activities, description) => ({
      name,
      type: "feat",
      img: "icons/skills/melee/sword-damaged-broken-glow-red.webp",
      system: { identifier, description: { value: description }, activities: summonActivities(activities) }
    });
  if (spec.id === "artillery") {
    const data = mk(
      "Артиллерист: длинный лук",
      "deathknight-artillery",
      [
        {
          name: "Длинный лук",
          formula: `1d8 + ${ability("dex")}`,
          damageType: "piercing",
          attackType: "ranged",
          attackBonus: prof + ability("dex"),
          range: 150,
          longRange: 160
        }
      ],
      "Дистанция 150/160 футов буквально по PDF. Критическое попадание при 18+."
    );
    for (const a of Object.values(data.system.activities)) {
      a.attack.critical = { threshold: 18 };
      a.target.prompt = true;
    }
    return [data];
  }
  if (spec.id === "warrior")
    return [
      mk(
        "Воин: большой меч",
        "deathknight-warrior",
        [
          {
            name: "Большой меч",
            formula: `2d6 + ${ability("str")}`,
            damageType: "slashing",
            attackBonus: prof + ability("str")
          }
        ],
        "При действии Атака выполните две атаки, не два отдельных бесплатных действия."
      )
    ];
  if (spec.id === "sapper")
    return [
      mk(
        "Сапёр: взрыв",
        "deathknight-sapper",
        [
          {
            name: "Взорваться",
            type: "utility",
            action: "deathknight-minion",
            metadata: { deathknightMinionOperation: "explode", deathknightSapperDC: spec.dc }
          }
        ],
        "Действие, радиус 15 футов, DEX, 4к8 огня/половина; после подтверждённого применения скелет уничтожается."
      )
    ];
  return [
    mk(
      spec.id === "defender" ? "Защитник: защита щитом" : "Убийца: Засада",
      "deathknight-minion-trait",
      [],
      spec.id === "defender"
        ? "Реакция после согласия: переместите скелета к союзнику в 10 футах и дайте помеху одной атаке. Не расходуйте реакцию, если защита/перемещение невозможны."
        : "Засада бонусным действием; +2к6 урона при преимуществе либо союзнике в 5 футах от цели. Владение Скрытностью даёт отдельный эффект."
    )
  ];
}
export function deathknightSkeletonRecipe(owner, base, spec = { id: null }) {
  const hp = Number(base.system.attributes.hp.max),
    extraItems = [...(base.items ?? [])].filter(i => !["class", "subclass"].includes(i.type)).map(i => i.toObject()),
    specialItems = deathknightSpecialistItems(base, spec);
  if (spec.id === "warrior" || spec.id === "artillery")
    for (let i = extraItems.length - 1; i >= 0; i--) if (extraItems[i].type === "weapon") extraItems.splice(i, 1);
  return {
    kind: "deathknight-skeleton",
    source: "deathknight-skeleton",
    unique: false,
    name: `${owner.name}: скелет${spec.id ? ` (${DK_SPECIALISTS.find(s => s.id === spec.id).name})` : ""}`,
    img: base.img,
    size: base.system.traits?.size ?? "med",
    type: "undead",
    cr: Number(base.system.details?.cr ?? 0),
    ac: Number(base.system.attributes.ac.value ?? base.system.attributes.ac.flat ?? 10),
    hp,
    hpFormula: String(hp),
    abilities: Object.fromEntries(
      ["str", "dex", "con", "int", "wis", "cha"].map(k => [k, Number(base.system.abilities[k]?.value ?? 10)])
    ),
    movement: structuredClone(base.system.attributes.movement ?? {}),
    senses: structuredClone(base.system.attributes.senses ?? {}),
    skills: structuredClone(base._source?.system?.skills ?? {}),
    ...Object.fromEntries(
      ["di", "dr", "dv", "ci"].map(k => [
        k,
        {
          value: [...(base.system.traits?.[k]?.value ?? [])],
          bypasses: [...(base.system.traits?.[k]?.bypasses ?? [])],
          custom: base.system.traits?.[k]?.custom ?? ""
        }
      ])
    ),
    languages: {
      value: [...(base.system.traits?.languages?.value ?? [])],
      custom: base.system.traits?.languages?.custom ?? ""
    },
    extraItems: [...extraItems, ...specialItems],
    effects:
      spec.id === "assassin"
        ? [
            {
              name: "Убийца: владение Скрытностью",
              type: "base",
              disabled: false,
              transfer: false,
              statuses: [],
              system: {
                changes: [
                  { key: "system.skills.ste.value", value: "1", type: "upgrade", phase: "initial", priority: 20 }
                ]
              }
            }
          ]
        : [],
    snapshot: {
      ownerUuid: owner.uuid,
      baseActorUuid: base.uuid,
      level: dkTransformationLevel(owner),
      specialization: spec.id,
      sapperDC: spec.dc ?? null
    },
    note: "Скелет до своей гибели, без выдуманной длительности/концентрации. Инициативу, приказы, вторую атаку и перемещение ведёт владелец. Исходный труп не удалён."
  };
}
export async function raiseDeathknightSkeleton(actor, activity, source, operation, requestId) {
  const selected = await dkTargets(
      dkGm(actor),
      source,
      operation === "restless" ? 5 : 100000,
      "Подтверждённый труп для подъёма"
    ),
    corpse = selected?.[0];
  if (!corpse) return false;
  if (operation === "restless" && corpse.actor.system.details?.type?.value !== "humanoid")
    throw Error("Нет отдыха для злых требует труп гуманоида.");
  if (Number(corpse.actor.system.attributes.hp.value) > 0 && !corpse.actor.statuses?.has?.("dead"))
    throw Error("Сначала подтвердите смерть выбранного тела; живая цель не является трупом.");
  if (corpse.actor.getFlag?.(MODULE_ID, "deathknightRaised"))
    throw Error("Этот труп уже использован; исправление подтверждается GM, а не повторным бесплатным призывом.");
  const own = dkLevelEffects(corpse.actor).find(e => dkLevelData(e).sourceActorUuid === actor.uuid),
    mark = dkLevelData(own);
  const small = ["tiny", "sm", "med"].includes(corpse.actor.system.traits?.size),
    inFireball = small && dkState(actor).lastFireball?.targets?.includes(corpse.uuid),
    inCrucible =
      small &&
      dkCrucibleActive(actor) &&
      dkCylinderContains(source, corpse, Number(dkState(actor).crucibleRadius ?? 20)),
    annihilated =
      dkState(actor).annihilatedTarget === corpse.uuid && corpse.actor.system.details?.type?.value === "humanoid";
  if (operation === "raise" && !(mark?.levels >= 3) && !inFireball && !inCrucible && !annihilated)
    throw Error("Нет УС 3 или подходящего подтверждённого источника подъёма для этой цели.");
  if (
    !(await confirmOwner(
      dkGm(actor),
      "Поднять скелета (GM)",
      operation === "restless"
        ? "Гуманоид действительно погиб не более часа назад; источник коснулся тела, место свободно?"
        : "GM подтверждает смерть, подходящий размер/тип и время подъёма (при 3 УС — начало следующего хода Рыцаря) либо труп в области Тигля/Шара? Не достаточно одного лишь 0 HP."
    ))
  )
    return false;
  const base = await chooseDeathknightSkeleton(actor);
  if (!base) return false;
  const spec = await chooseDeathknightSpecialist(actor);
  if (!spec) return false;
  let resource;
  if (operation === "restless") {
    const pools = [...(actor.items ?? [])].filter(
      i => i.system?.identifier === "lay-on-hands" && itemUses(i).remaining >= 10
    );
    const uuid = await askOwner(actor, {
      title: "Расход 10 настоящих Наложения рук",
      choices: pools.map(i => [i.uuid, i.name])
    });
    resource = pools.find(i => i.uuid === uuid);
    if (!resource) return false;
  }
  const beforeSpent = resource ? itemUses(resource).spent : null;
  return applyNativeOnce(
    actor,
    { requestId, action: `deathknight-${operation}`, activityUuid: activity.uuid },
    () =>
      useNativeUtility(activity, {
        dataPatch: dkExpense(activity, {
          activation: operation === "restless" ? "action" : "special",
          cost: operation === "restless" ? 10 : 0,
          resource
        })
      }),
    async () => {
      const result = await createSummonedGroup(actor, [deathknightSkeletonRecipe(actor, base, spec)], {
        scene: source.parent,
        sourceTokenId: corpse.id,
        requireScene: true,
        requestId: `${requestId}:skeleton`
      });
      if (result.status !== "success") {
        if (result.status === "failed" && resource && itemUses(resource).spent === beforeSpent + 10)
          await resource.update({ "system.uses.spent": beforeSpent });
        return { status: "needs-review" };
      }
      await corpse.actor.setFlag(MODULE_ID, "deathknightRaised", { requestId, ownerUuid: actor.uuid });
      return true;
    }
  );
}
export async function specializeDeathknightSkeleton(actor, source) {
  const selected = await dkTargets(actor, source, 100000, "Собственный скелет для специализации"),
    target = selected?.[0]?.actor;
  if (
    !target ||
    target.system.details?.type?.value !== "undead" ||
    (target.getFlag?.(MODULE_ID, "summonedBy") !== actor.uuid &&
      target.getFlag?.(MODULE_ID, "deathknightControlledBy") !== actor.uuid)
  )
    return false;
  if (
    !(await confirmOwner(
      dkGm(actor),
      "Специализация скелета",
      "Это именно скелет под вашим контролем, назначение при подъёме или исправление GM? Свободной смены специализации PDF не даёт."
    ))
  )
    return false;
  const spec = await chooseDeathknightSpecialist(actor);
  if (!spec?.id) return false;
  if (
    target.getFlag(MODULE_ID, "deathknightSpecialization") ||
    target.getFlag(MODULE_ID, "summonTemplate")?.snapshot?.specialization
  )
    throw Error("Специализация уже есть; ручные исправления существующего статблока сохраняются.");
  await target.createEmbeddedDocuments("Item", deathknightSpecialistItems(target, spec));
  await target.setFlag(MODULE_ID, "deathknightSpecialization", spec.id);
  if (spec.id === "assassin")
    await target.createEmbeddedDocuments("ActiveEffect", [
      {
        name: "Убийца: Скрытность",
        type: "base",
        transfer: false,
        disabled: false,
        statuses: [],
        system: {
          changes: [{ key: "system.skills.ste.value", value: "1", type: "upgrade", phase: "initial", priority: 20 }]
        }
      }
    ]);
  return true;
}
