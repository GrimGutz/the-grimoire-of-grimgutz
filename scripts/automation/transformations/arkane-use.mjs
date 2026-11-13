import { itemUses } from "../shared/helpers.mjs";
import { askOwner, confirmOwner, chooseSceneTokens } from "../shared/owner-prompts.mjs";
import { arkaneSpellPools, arkaneExactSlots } from "../shared/arkane-definitions.mjs";
import { inFeet, canReact } from "../shared/combat-benefits.mjs";
import { useAuraPulse } from "../midi/aura-workflow.mjs";
import { placeActivityArea } from "../shared/template-placement.mjs";
export async function previewArkaneCircle(activity, source, radius = 30) {
  const data = activity.toObject();
  data.target = {
    ...data.target,
    override: true,
    template: { type: "sphere", size: String(radius), units: "ft", count: "1" }
  };
  const item = activity.item.clone({ system: { activities: { [activity.id]: data } } }, { keepId: true });
  return (await placeActivityArea(item.system.activities.get(activity.id)))?.[0] ?? null;
}
export const arkaneGm = actor => ({ uuid: actor.uuid, testUserPermission: user => user.isGM });
export const arkanePlaceable = token => token.object ?? { actor: token.actor, document: token };
export function arkaneExpense(
  activity,
  { activation = "action", cost = 0, resource = activity.item, extra = [] } = {}
) {
  if (cost && itemUses(resource).remaining < cost) throw Error("Нет использований способности.");
  if (activation === "reaction" && !canReact(activity.actor)) throw Error("Нет свободной реакции.");
  return {
    activation: { type: activation, value: activation === "special" ? null : 1, override: true },
    consumption: {
      spellSlot: false,
      targets: [...(cost ? [{ type: "itemUses", target: resource.id, value: String(cost) }] : []), ...extra]
    }
  };
}
export async function arkaneTargets(actor, item, source, { range = 120, max = 1, self = false, visible = true } = {}) {
  const selected = await chooseSceneTokens(actor, source.parent, {
    title: item.name,
    min: 1,
    max,
    exclude: self ? [] : [source.uuid],
    relation: t => inFeet(source, t, range, source.parent)
  });
  if (
    !selected?.length ||
    !(await confirmOwner(
      arkaneGm(actor),
      item.name,
      visible
        ? "GM подтверждает видимость и специальные условия выбранных целей?"
        : "GM подтверждает специальные условия выбранных целей? Требование видимости этим текстом не добавляется."
    ))
  )
    return null;
  return selected;
}
export async function arkanePulse(
  source,
  item,
  targets,
  snapshot,
  { save = null, damage = [], onSave = "none", requestId } = {}
) {
  const result = await useAuraPulse({
    scene: source.parent,
    sourceToken: arkanePlaceable(source),
    sourceItem: item,
    targets: targets.map(arkanePlaceable),
    eventKey: requestId,
    event: {
      ...(save ? { save, dc: String(snapshot.dc), returnSaveOutcome: true } : {}),
      damage,
      onSave,
      metadata: { arkaneResolved: true }
    }
  });
  return result == null || result === false || result.aborted || ["pending", "needs-review"].includes(result.status)
    ? { status: "needs-review" }
    : result;
}
export async function chooseArkaneSlots(
  actor,
  { total = null, spent = false, maxLevel = 9, title = "Ячейки заклинаний", optional = false } = {}
) {
  const pools = arkaneSpellPools(actor, { spent })
    .filter(p => p.level <= maxLevel)
    .sort((a, b) => b.level - a.level);
  if (total != null && !optional && !arkaneExactSlots(pools, total)) return null;
  let remaining = total ?? Infinity;
  const allocation = [];
  for (const pool of pools) {
    const max = Math.min(pool.count, Math.floor(remaining / pool.level));
    if (max <= 0) continue;
    const number = await askOwner(actor, {
      kind: "number",
      title: `${title}: ${pool.key === "pact" ? "договорные " : ""}${pool.level}-й уровень`,
      label: `Доступно ${pool.count}; осталось суммы уровней ${Number.isFinite(remaining) ? remaining : "без ограничения"}`,
      min: 0,
      max,
      defaultValue: 0
    });
    if (number == null) return null;
    const count = Number(number);
    if (!Number.isInteger(count) || count < 0 || count > max) return null;
    if (count) {
      allocation.push({ ...pool, count });
      remaining -= count * pool.level;
    }
  }
  if (total != null && !optional && remaining !== 0) return null;
  return allocation;
}
export const arkaneSlotCosts = allocation =>
  allocation.map(row => ({ type: "attribute", target: `spells.${row.key}.value`, value: String(row.count) }));
