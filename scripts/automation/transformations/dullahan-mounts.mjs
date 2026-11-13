import { MODULE_ID } from "../shared/constants.mjs";
import { automationActors, isEffectActive } from "../effects/temporary-effects.mjs";
import { dullahanCharacterLevel, dullahanState, patchDullahan, syncDullahan } from "./dullahan.mjs";
import { dullahanGm, dullahanExpense, dullahanTargets, dullahanImmune } from "./dullahan-use.mjs";
import { confirmOwner } from "../shared/owner-prompts.mjs";
import { applyNativeOnce } from "../shared/native-applications.mjs";
import { useNativeUtility } from "../shared/native-actions.mjs";
const marks = (owner, mount) =>
  [...(mount.effects ?? [])].filter(
    e => e.getFlag?.(MODULE_ID, "dullahanMount")?.sourceActorUuid === owner.uuid && isEffectActive(e)
  );
export const dullahanMounts = owner =>
  automationActors().filter(a => marks(owner, a).length && !a.statuses?.has("dead"));
export function dullahanMountFailures(owner, target) {
  const a = target.actor,
    s = a.system,
    failures = [];
  if (!["lg", "huge", "grg"].includes(s.traits?.size)) failures.push("размер не ниже Большого");
  if (Number(s.abilities.int.value) > 5) failures.push("Интеллект не выше 5");
  if (Number(s.details?.cr ?? 0) > dullahanCharacterLevel(owner) / 2)
    failures.push("УС не выше половины уровня персонажа");
  if (
    !["incapacitated", "unconscious", "paralyzed", "petrified", "stunned", "frightened"].some(id => a.statuses?.has(id))
  )
    failures.push("недееспособность или испуг");
  if (dullahanImmune(a, "charmed")) failures.push("нет иммунитета к очарованию");
  if (a.statuses?.has("dead")) failures.push("живое доступное существо");
  const cap = Math.max(1, Number(owner.system.abilities.str.mod), Number(owner.system.abilities.cha.mod));
  if (dullahanMounts(owner).length >= cap && !marks(owner, a).length) failures.push(`не более ${cap} скакунов`);
  if (automationActors().some(other => other.uuid !== owner.uuid && marks(other, a).length))
    failures.push("не под контролем другого Дуллахана");
  return failures;
}
export async function controlDullahanMount(actor, activity, source, operation, requestId) {
  if (operation === "dismount") {
    await patchDullahan(actor, { riding: null });
    await syncDullahan(actor);
    return true;
  }
  const range = operation === "mount" || operation === "ride" ? 5 : 1000000,
    chosen = await dullahanTargets(dullahanGm(actor), source, range, "GM: конкретный скакун"),
    target = chosen?.[0];
  if (!target) return false;
  if (operation === "release-mount") {
    if (
      !(await confirmOwner(
        dullahanGm(actor),
        "Снять контроль",
        "GM подтверждает гибель либо сюжетное снятие подчинения? У самой особенности нет свободного перевыбора формы/характеристик."
      ))
    )
      return false;
    for (const e of marks(actor, target.actor)) await e.delete();
    if (dullahanState(actor).riding?.mountTokenUuid === target.uuid) await patchDullahan(actor, { riding: null });
    await syncDullahan(actor);
    return true;
  }
  if (operation === "ride") {
    if (!marks(actor, target.actor).length || target.actor.statuses?.has("dead"))
      throw Error("Это не действующий собственный скакун.");
    if (
      !(await confirmOwner(
        dullahanGm(actor),
        "Езда верхом",
        "Дуллахан действительно едет верхом на выбранном подконтрольном существе? Простого соседства токенов недостаточно."
      ))
    )
      return false;
    await patchDullahan(actor, { riding: { sourceTokenUuid: source.uuid, mountTokenUuid: target.uuid } });
    await syncDullahan(actor);
    return true;
  }
  const failures = dullahanMountFailures(actor, target);
  if (failures.length) throw Error(`Кошмарный скакун: ${failures.join("; ")}.`);
  if (marks(actor, target.actor).length) return false;
  if (
    !(await confirmOwner(
      dullahanGm(actor),
      "Подчинить существующего скакуна",
      "Касание действительно состоялось; существо подходит по правилам и может исполнять приказы? Модуль сохранит исходный статблок и права владельца."
    ))
  )
    return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "dullahan-mount", activityUuid: activity.uuid },
    () => useNativeUtility(activity, { dataPatch: dullahanExpense(activity) }),
    async () => {
      if (dullahanMountFailures(actor, target).length) return { status: "needs-review" };
      await target.actor.createEmbeddedDocuments("ActiveEffect", [
        {
          name: `Кошмарный скакун: ${actor.name}`,
          img: activity.item.img,
          type: "base",
          disabled: false,
          transfer: false,
          origin: activity.item.uuid,
          statuses: [],
          start: null,
          duration: { value: null, units: "seconds", expiry: null, expired: false },
          flags: {
            [MODULE_ID]: {
              dullahanMount: { sourceActorUuid: actor.uuid, sourceTokenUuid: source.uuid, targetTokenUuid: target.uuid }
            }
          },
          system: { changes: [] }
        }
      ]);
      return true;
    }
  );
}
