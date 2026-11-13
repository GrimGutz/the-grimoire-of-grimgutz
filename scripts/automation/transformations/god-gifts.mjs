import { MODULE_ID } from "../shared/constants.mjs";
import { GOD_ICON, GOD_ABILITIES } from "../shared/god-definitions.mjs";
import { godHas, godState, patchGod, godAlignment, godLevel, godChange } from "./god.mjs";
import { godGm, godTargets, useGodCost } from "./god-use.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import { temporaryEffectTiming, isEffectActive, automationActors } from "../effects/temporary-effects.mjs";
import { applyNativeOnce } from "../shared/native-applications.mjs";
import { migrationFingerprint } from "../shared/owned-item-migration.mjs";
export function godGiftFingerprint(item) {
  const d = item.toObject();
  delete d._id;
  delete d._stats;
  delete d.sort;
  delete d.folder;
  if (d.system?.uses) delete d.system.uses.spent;
  for (const a of Object.values(d.system?.activities ?? {})) if (a.uses) delete a.uses.spent;
  if (d.flags?.[MODULE_ID]) delete d.flags[MODULE_ID].godGiftHash;
  return migrationFingerprint(d);
}
export async function grantGodGift(actor, activity, source, requestId) {
  const targets = await godTargets(actor, source, 1000000, "Союзник/себя для дара", { self: true }),
    target = targets?.[0];
  if (!target) return false;
  const kind = await askOwner(actor, {
    title: "Божественный дар на 4 часа",
    choices: [
      ["ability", "+2 к одной характеристике"],
      ["feat", "Настоящая карточка черты/благословения (GM)"]
    ]
  });
  if (!["ability", "feat"].includes(kind)) return false;
  let ability, document;
  if (kind === "ability") {
    ability = await askOwner(actor, {
      title: "Характеристика +2",
      choices: GOD_ABILITIES.map(a => [a, a.toUpperCase()])
    });
    if (!GOD_ABILITIES.includes(ability)) return false;
  } else {
    const cards = [...(game.items ?? []), ...(actor.items ?? [])].filter(
        i => i.type === "feat" && i.system.type?.value !== "class" && !i.getFlag?.(MODULE_ID, "godGift")
      ),
      uuid = await askOwner(godGm(actor), {
        title: "GM: явная карточка настоящей черты/легендарного благословения",
        choices: cards.map(i => [i.uuid, i.name])
      });
    document = cards.find(i => i.uuid === uuid);
    if (!document) return false;
    if (document.system.identifier && target.actor.items.some(i => i.system.identifier === document.system.identifier))
      throw Error("У получателя уже есть такая карточка. Повторяемость требует ручного решения GM.");
  }
  if (
    !(await confirmOwner(
      godGm(actor),
      "Дар: союзник и допустимость",
      "Получатель согласен и является союзником либо вами; карточка действительно черта/легендарное благословение либо выбран допустимый +2? Не создаются дополнительные владения или постоянные копии."
    ))
  )
    return false;
  let removeEffect;
  if (godAlignment(actor) === "good") {
    const options = [...(target.actor.effects ?? [])].filter(isEffectActive),
      uuid = await askOwner(godGm(actor), {
        title: "Благожеланность: необязательное снятие одного эффекта",
        choices: [["none", "Не снимать"], ...options.map(e => [e.uuid, e.name])]
      });
    if (uuid == null) return false;
    removeEffect = options.find(e => e.uuid === uuid);
  }
  return applyNativeOnce(
    actor,
    { requestId, action: "god-gift", activityUuid: activity.uuid },
    () => useGodCost(activity, { points: 40 }),
    async () => {
      let made;
      if (document) {
        const d = document.toObject();
        for (const k of ["_id", "_stats", "folder", "sort", "ownership"]) delete d[k];
        d.flags ??= {};
        d.flags[MODULE_ID] = {
          ...d.flags[MODULE_ID],
          godGift: { sourceActorUuid: actor.uuid, requestId, expiresAt: Number(game.time.worldTime) + 14400 }
        };
        [made] = await target.actor.createEmbeddedDocuments("Item", [d]);
        if (!made) throw Error("Карточка дара не создана.");
        await made.setFlag(MODULE_ID, "godGiftHash", godGiftFingerprint(made));
      }
      await target.actor.createEmbeddedDocuments("ActiveEffect", [
        {
          name: document ? `Дар: ${document.name}` : `Божественный дар: +2 ${ability.toUpperCase()}`,
          img: GOD_ICON,
          type: "base",
          transfer: false,
          disabled: false,
          statuses: [],
          ...temporaryEffectTiming({ seconds: 14400, actor: target.actor, expiry: "updateWorldTime" }),
          flags: {
            [MODULE_ID]: { godGift: { sourceActorUuid: actor.uuid, requestId, itemUuid: made?.uuid ?? null } },
            dae: { expiryMode: "delete" }
          },
          system: { changes: ability ? [godChange(`system.abilities.${ability}.value`, 2)] : [] }
        }
      ]);
      if (removeEffect && target.actor.effects.some(e => e.uuid === removeEffect.uuid)) await removeEffect.delete();
      if (godAlignment(actor) === "evil" && target.actor.uuid !== actor.uuid)
        await target.actor.update({
          "system.attributes.exhaustion": Number(target.actor.system.attributes.exhaustion ?? 0) + 1
        });
      return true;
    }
  );
}
export async function removeGodGiftItem(effect) {
  const info = effect.getFlag?.(MODULE_ID, "godGift");
  if (!info?.itemUuid) return;
  const item = await fromUuid(info.itemUuid);
  if (item?.getFlag?.(MODULE_ID, "godGift")?.requestId !== info.requestId) return;
  if (item.getFlag(MODULE_ID, "godGiftHash") === godGiftFingerprint(item)) await item.delete();
  else await item.setFlag(MODULE_ID, "godGiftNeedsReview", true);
}
export async function cleanupGodGifts() {
  for (const a of automationActors())
    for (const i of [...(a.items ?? [])]) {
      const info = i.getFlag?.(MODULE_ID, "godGift");
      if (!info || Number(info.expiresAt) > Number(game.time.worldTime) || i.getFlag(MODULE_ID, "godGiftNeedsReview"))
        continue;
      if (i.getFlag(MODULE_ID, "godGiftHash") === godGiftFingerprint(i)) await i.delete();
      else await i.setFlag(MODULE_ID, "godGiftNeedsReview", true);
    }
}
export async function activeGodMercies(actor) {
  const result = [];
  for (const r of godState(actor).mercies ?? []) {
    const e = await fromUuid(r.effectUuid);
    if (e && isEffectActive(e)) result.push({ ...r, effect: e });
  }
  return result;
}
export function godMercyChanges(target, kind) {
  if (kind === "speed") return [godChange("system.attributes.movement.walk", 2, "multiply", "final")];
  if (kind !== "endurance") return [];
  const prof = Number(target.system.attributes.prof),
    own = [...(target.effects ?? [])]
      .filter(e => e.getFlag?.(MODULE_ID, "godMercy")?.kind === "endurance")
      .flatMap(e => e.system?.changes ?? []);
  return GOD_ABILITIES.flatMap(a => {
    const base = Number(target._source?.system?.abilities?.[a]?.proficient ?? 0);
    return [
      godChange(`system.abilities.${a}.proficient`, 1, "upgrade"),
      ...(base < 2 ? [godChange(`system.abilities.${a}.bonuses.save`, prof)] : [])
    ];
  });
}
export async function grantGodMercy(actor, activity, source, requestId) {
  const targets = await godTargets(actor, source, 1000000, "Получатель одной Милости", { self: true }),
    target = targets?.[0];
  if (!target) return false;
  const existing = [...(target.actor.effects ?? [])].filter(
    e => e.getFlag?.(MODULE_ID, "godMercy") && isEffectActive(e)
  );
  if (existing.some(e => e.getFlag(MODULE_ID, "godMercy").sourceActorUuid !== actor.uuid))
    throw Error("У существа уже есть Милость другого Божества.");
  const active = await activeGodMercies(actor);
  if (!existing.length && active.length >= godLevel(actor)) throw Error("Достигнут предел активных Милостей.");
  const kind = await askOwner(actor, {
    title: "Одна Милость",
    choices: [
      ["speed", "Скорость"],
      ["magic", "Колдовство"],
      ["endurance", "Выносливость"]
    ]
  });
  if (!["speed", "magic", "endurance"].includes(kind)) return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "god-mercy", activityUuid: activity.uuid },
    () => useGodCost(activity, { points: 0 }),
    async () => {
      for (const e of existing) await e.delete();
      const changes = godMercyChanges(target.actor, kind),
        [effect] = await target.actor.createEmbeddedDocuments("ActiveEffect", [
          {
            name: `Милость: ${kind === "speed" ? "Скорость" : kind === "magic" ? "Колдовство" : "Выносливость"}`,
            img: GOD_ICON,
            type: "base",
            transfer: false,
            disabled: false,
            statuses: [],
            start: null,
            duration: { value: null, units: "seconds", expiry: null, expired: false },
            flags: {
              [MODULE_ID]: {
                godMercy: { sourceActorUuid: actor.uuid, kind, requestId },
                godMercyHash: migrationFingerprint(changes)
              }
            },
            system: { changes }
          }
        ]);
      await patchGod(actor, {
        mercies: [
          ...active.filter(r => !existing.some(e => e.uuid === r.effectUuid)).map(({ effect, ...r }) => r),
          { actorUuid: target.actor.uuid, effectUuid: effect.uuid, kind }
        ]
      });
      return true;
    }
  );
}
export async function revokeGodMercy(actor) {
  const active = await activeGodMercies(actor),
    uuid = await askOwner(actor, {
      title: "Отозвать свою Милость",
      choices: active.map(r => [r.effectUuid, `${r.effect.parent.name}: ${r.kind}`])
    }),
    r = active.find(r => r.effectUuid === uuid);
  if (!r) return false;
  await r.effect.delete();
  await patchGod(actor, { mercies: active.filter(a => a !== r).map(({ effect, ...r }) => r) });
  return true;
}
export async function syncGodMercies(source) {
  for (const r of godState(source).mercies ?? []) {
    const e = await fromUuid(r.effectUuid);
    if (!e) continue;
    const info = e.getFlag(MODULE_ID, "godMercy");
    if (info?.sourceActorUuid !== source.uuid) continue;
    const available = godHas(source, "mercy"),
      managed = e.getFlag(MODULE_ID, "godMercySuppressed");
    if (!available && !e.disabled) await e.update({ disabled: true, [`flags.${MODULE_ID}.godMercySuppressed`]: true });
    else if (available && managed)
      await e.update({ disabled: false, [`flags.${MODULE_ID}.godMercySuppressed`]: false });
    const changes = godMercyChanges(e.parent, info.kind);
    if (
      e.getFlag(MODULE_ID, "godMercyHash") === migrationFingerprint(e.system.changes) &&
      migrationFingerprint(changes) !== migrationFingerprint(e.system.changes)
    )
      await e.update({ "system.changes": changes, [`flags.${MODULE_ID}.godMercyHash`]: migrationFingerprint(changes) });
  }
}
