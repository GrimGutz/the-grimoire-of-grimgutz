import { MODULE_ID } from "../shared/constants.mjs";
import { HAG_ICON } from "../shared/hag-definitions.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import { createSummonedGroup } from "../shared/summons.mjs";
import { applyNativeOnce } from "../shared/native-applications.mjs";
import { inFeet } from "../shared/combat-benefits.mjs";
import { isEffectActive } from "../effects/temporary-effects.mjs";
import { hagState, patchHag, hagLevel, hagDC } from "./hag.mjs";
import { hagGm, useHagCost } from "./hag-use.mjs";
export function hagSummonRecipe(actor, base, kind) {
  const reflection = kind === "reflection",
    hp = reflection ? 1 : Number(base.system.attributes.hp.max);
  return {
    kind: `hag-${kind}`,
    source: `hag-${kind}`,
    unique: !reflection,
    name: `${actor.name}: ${reflection ? "отражение" : "Оживлённая Метла"}`,
    img: base.img ?? HAG_ICON,
    type: reflection ? (base.system.details?.type?.value ?? "fey") : (base.system.details?.type?.value ?? "construct"),
    size: base.system.traits?.size ?? "med",
    cr: reflection ? 0 : Number(base.system.details?.cr ?? 0),
    hp,
    hpFormula: String(hp),
    ac: Number(base.system.attributes.ac.value ?? base.system.attributes.ac.flat ?? 10),
    abilities: Object.fromEntries(
      ["str", "dex", "con", "int", "wis", "cha"].map(a => [a, Number(base.system.abilities[a]?.value ?? 10)])
    ),
    movement: structuredClone(base.system.attributes.movement ?? {}),
    senses: structuredClone(base.system.attributes.senses ?? {}),
    extraItems: reflection
      ? []
      : [...(base.items ?? [])].filter(i => !["class", "subclass"].includes(i.type)).map(i => i.toObject()),
    snapshot: { ownerUuid: actor.uuid, baseActorUuid: base.uuid, kind, dc: hagDC(actor), tier: hagLevel(actor) },
    note: reflection
      ? "Иллюзия 1 HP: без собственных действий/ресурсов. Используйте исходные карточки Ведьмы с её общим запасом действий."
      : "Инициатива сразу после Ведьмы и приказы ведутся владельцем. Статблок взят из выбранного установленного источника."
  };
}
export async function dismissHagGroup(actor, kind) {
  const state = hagState(actor)[kind];
  if (!state) return true;
  await patchHag(actor, { [kind]: { ...state, ending: true } });
  for (const uuid of state.tokenUuids ?? []) {
    const t = await fromUuid(uuid);
    if (
      t?.actor?.getFlag?.(MODULE_ID, "summonedBy") === actor.uuid &&
      t.actor.getFlag(MODULE_ID, "summonTemplate")?.kind === `hag-${kind}`
    )
      await t.parent.deleteEmbeddedDocuments("Token", [t.id]);
  }
  for (const uuid of state.actorUuids ?? []) {
    const a = await fromUuid(uuid);
    if (
      a?.getFlag?.(MODULE_ID, "summonedBy") === actor.uuid &&
      a.getFlag(MODULE_ID, "summonTemplate")?.kind === `hag-${kind}`
    )
      await a.delete();
  }
  if (kind === "reflection") {
    const e = state.concentrationUuid && (await fromUuid(state.concentrationUuid));
    if (e?.getFlag?.(MODULE_ID, "hagReflection")) await e.delete();
  }
  await patchHag(actor, { [kind]: null });
  return true;
}
export async function summonHagReflection(actor, activity, source, requestId) {
  if (hagState(actor).reflection)
    throw Error("Сначала завершите прежнее отражение; свободный второй запас действий не создаётся.");
  if (
    !(await confirmOwner(
      actor,
      "Гротескное Отражение",
      "Создать иллюзии 1 HP на минуту с концентрацией? Все действия и ресурсы общие. Разместите клонов внутри неподвижного круга 40 футов; необязательную телепортацию в этой области выполните вручную."
    ))
  )
    return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "hag-reflection", activityUuid: activity.uuid },
    () => useHagCost(activity),
    async () => {
      const recipe = hagSummonRecipe(actor, actor, "reflection");
      recipe.snapshot.origin = {
        x: source.x,
        y: source.y,
        width: source.width,
        height: source.height,
        elevation: source.elevation
      };
      recipe.snapshot.sceneId = source.parent.id;
      const result = await createSummonedGroup(
        actor,
        Array.from({ length: hagLevel(actor) }, () => structuredClone(recipe)),
        { scene: source.parent, sourceTokenId: source.id, requireScene: true, requestId: `${requestId}:group` }
      );
      if (result.status !== "success") return { status: "needs-review" };
      await patchHag(actor, {
        reflection: {
          ...result,
          initializing: true,
          sceneId: source.parent.id,
          sourceTokenUuid: source.uuid,
          origin: { x: source.x, y: source.y, width: source.width, height: source.height, elevation: source.elevation },
          expiresAt: Number(game.time.worldTime) + 60
        },
        appearance: "true"
      });
      const e = await actor.beginConcentrating(activity, { flags: { [MODULE_ID]: { hagReflection: true } } });
      await patchHag(actor, {
        reflection: { ...hagState(actor).reflection, initializing: false, concentrationUuid: e.uuid }
      });
      // No guessed placement outside the legal circle survives creation.
      for (const uuid of result.tokenUuids ?? []) {
        const t = await fromUuid(uuid);
        if (t && !inFeet(source, t, 40, source.parent)) await t.update({ x: source.x, y: source.y });
      }
      return true;
    }
  );
}
export async function summonHagBroom(actor, activity, source, requestId) {
  const current = hagState(actor).broom;
  if (current) {
    const living = (await Promise.all((current.actorUuids ?? []).map(fromUuid))).some(
      a => a && Number(a.system.attributes.hp.value) > 0
    );
    if (living) throw Error("Живая метла уже существует; новое применение не восстанавливает её хиты.");
    throw Error("Сначала завершите прежнюю метлу после проверки её взрыва.");
  }
  const rows = [...(game.actors ?? [])].filter(a => a.type === "npc" && !a.getFlag?.(MODULE_ID, "summoned"));
  for (const pack of game.packs?.values?.() ?? []) {
    if (pack.metadata?.type !== "Actor") continue;
    for (const r of await pack.getIndex())
      if (/broom|метл/iu.test(r.name))
        rows.push({ uuid: r.uuid ?? `Compendium.${pack.collection}.Actor.${r._id}`, name: r.name });
  }
  const uuid = await askOwner(hagGm(actor), {
      title: "GM: настоящий статблок Оживлённой Метлы",
      choices: [...new Map(rows.map(r => [r.uuid, r])).values()].map(r => [r.uuid, r.name])
    }),
    base = uuid && (await fromUuid(uuid));
  if (base?.type !== "npc") return false;
  if (
    !(await confirmOwner(
      hagGm(actor),
      "Оживлённая Метла",
      "Это подходящий статблок метлы из установленного источника? Статблок PDF не задан. Приказы/полёт/инициативу ведёт владелец."
    ))
  )
    return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "hag-broom", activityUuid: activity.uuid },
    () => useHagCost(activity),
    async () => {
      const result = await createSummonedGroup(actor, [hagSummonRecipe(actor, base, "broom")], {
        scene: source.parent,
        sourceTokenId: source.id,
        requireScene: true,
        requestId: `${requestId}:group`
      });
      if (result.status !== "success") return { status: "needs-review" };
      await patchHag(actor, {
        broom: {
          ...result,
          sceneId: source.parent.id,
          sourceTokenUuid: source.uuid,
          sourceItemUuid: activity.item.uuid,
          dc: hagDC(actor)
        }
      });
      return true;
    }
  );
}
export async function cleanupHagReflection(actor) {
  const r = hagState(actor).reflection;
  if (!r || r.initializing || r.ending) return;
  const e = r.concentrationUuid && (await fromUuid(r.concentrationUuid));
  if (Number(r.expiresAt) <= Number(game.time.worldTime) || !e || !isEffectActive(e))
    await dismissHagGroup(actor, "reflection");
}
export function guardHagReflection(token, changes) {
  const recipe = token.actor?.getFlag?.(MODULE_ID, "summonTemplate");
  if (recipe?.kind !== "hag-reflection" || !Object.keys(changes).some(k => ["x", "y", "elevation"].includes(k))) return;
  const r = recipe.snapshot,
    origin = { ...r.origin, parent: token.parent },
    next = {
      x: changes.x ?? token.x,
      y: changes.y ?? token.y,
      elevation: changes.elevation ?? token.elevation,
      width: token.width,
      height: token.height,
      parent: token.parent
    };
  if (token.parent.id !== r.sceneId || !inFeet(origin, next, 40, token.parent)) return false;
}
