import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, automationData, findFeature, isAutomationAuthority, notify } from "../shared/helpers.mjs";
import { HAG_FEATURES, HAG_TYPES, HAG_RULE_DEFAULTS } from "../shared/hag-definitions.mjs";
import { baseAbilityValue } from "../shared/dnd5e.mjs";
import { flaggedPassiveEffectData, syncFlaggedPassiveEffects } from "../effects/passive-helpers.mjs";
import {
  characterLevel,
  transformationTier,
  transformationState,
  effectChange,
  enforcesTransformationPrerequisites,
  advancementSurvivors,
  isDuplicateGrant,
  rejectDuplicateBoons
} from "../shared/transformation-core.mjs";
import { effectKey, movementSpeed } from "../shared/system-paths.mjs";
const hagStore = transformationState("hagState", "hag-state");
export const hagState = hagStore.read;
export const hagRules = actor =>
  Object.fromEntries(Object.entries(HAG_RULE_DEFAULTS).map(([key, value]) => [key, hagState(actor)[key] ?? value]));
export const hagCharacterLevel = characterLevel;
export const hagLevel = actor => transformationTier(actor, "hag");
export function hagHas(actor, id, visited = new Set()) {
  if (visited.has(id)) return false;
  visited.add(id);
  const r = HAG_FEATURES.find(r => r.id === id),
    i = r && findFeature(actor, r.key);
  return Boolean(
    i &&
    !i.isSuppressed &&
    hagLevel(actor) >= r.level &&
    (!r.requires || r.requires === "spellcasting" || hagHas(actor, r.requires, visited))
  );
}
export const hagType = actor => (HAG_TYPES.some(([id]) => id === hagState(actor).type) ? hagState(actor).type : null);
export const hagDC = actor =>
  8 + Number(actor?.system?.attributes?.prof ?? 0) + Number(actor?.system?.abilities?.cha?.mod ?? 0);
export const hagAvailable = (actor, item) =>
  !item?.isSuppressed &&
  (item?.system?.identifier === "hag-transformation"
    ? hagLevel(actor) > 0
    : HAG_FEATURES.some(r => r.key === item?.system?.identifier && hagHas(actor, r.id)));
export const hagChange = effectChange;
export const patchHag = hagStore.patch;
export function hagCurses(actor) {
  const primary = hagType(actor);
  if (!primary) return [];
  const max = hagHas(actor, "coven") ? 3 : hagHas(actor, "double") ? 2 : 1;
  return [...new Set([primary, ...(hagState(actor).curses ?? [])])]
    .filter(id => HAG_TYPES.some(([t]) => t === id))
    .slice(0, max);
}
export function hagPassiveDefinitions(actor) {
  const rows = [],
    state = hagState(actor),
    type = hagType(actor),
    add = (id, changes) => {
      if (changes.length)
        rows.push(
          flaggedPassiveEffectData(MODULE_ID, "hagPassive", {
            key: id,
            feature: findFeature(actor, `hag-${id}`),
            changes
          })
        );
    };
  if (hagHas(actor, "form"))
    add(
      "form",
      [
        ["cha", 2],
        ["int", 1]
      ]
        .map(([a, n]) => [a, Math.max(0, Math.min(n, 16 - baseAbilityValue(actor, a)))])
        .filter(([, n]) => n)
        .map(([a, n]) => hagChange(`system.abilities.${a}.value`, n))
    );
  if (hagHas(actor, "bond") && !state.home)
    add("bond", [hagChange("system.attributes.death.roll.mode", -1, "downgrade")]);
  if (hagHas(actor, "body")) {
    const changes = [];
    for (const t of type === "scarlet" ? ["necrotic", "radiant"] : type === "night" ? ["cold", "fire"] : [])
      changes.push(hagChange("system.traits.dr.value", t));
    if (type === "sea")
      changes.push(
        hagChange(
          effectKey("system.attributes.movement.swim"),
          Number(movementSpeed(actor, "walk") ?? 0),
          "upgrade",
          "final"
        )
      );
    add("body", changes);
  }
  if (hagHas(actor, "alchemy")) add("alchemy", [hagChange("system.tools.alchemist.value", 1, "upgrade")]);
  if (hagHas(actor, "hunger") && state.hungry)
    add("hunger", [
      ...["str", "dex", "con", "int", "wis", "cha"].flatMap(a => [
        hagChange(`system.abilities.${a}.check.roll.mode`, -1, "downgrade"),
        hagChange(`system.abilities.${a}.save.roll.mode`, -1, "downgrade")
      ]),
      ...[
        "acr",
        "ani",
        "arc",
        "ath",
        "dec",
        "his",
        "ins",
        "itm",
        "inv",
        "med",
        "nat",
        "prc",
        "prf",
        "per",
        "rel",
        "slt",
        "ste",
        "sur"
      ].map(s => hagChange(`system.skills.${s}.roll.mode`, -1, "downgrade")),
      hagChange("flags.midi-qol.disadvantage.attack.all", "true", "override")
    ]);
  return rows;
}
const syncing = new Set();
export async function syncHag(actor) {
  if (!enabled() || !isAutomationAuthority(actor) || !actor.system?.attributes) return;
  if (!hagLevel(actor) && ![...(actor.effects ?? [])].some(e => e.getFlag?.(MODULE_ID, "hagPassive"))) return;
  if (hagHas(actor, "alchemy") && !actor._source?.system?.tools?.alchemist)
    await actor.update({ "system.tools.alchemist": { value: 0, ability: "int" } });
  await syncFlaggedPassiveEffects(actor, syncing, MODULE_ID, "hagPassive", hagPassiveDefinitions);
  if (
    hagHas(actor, "appearance") &&
    (actor.statuses?.has?.("unconscious") ||
      actor.concentration?.effects?.size ||
      (hagHas(actor, "hunger") && hagState(actor).hungry)) &&
    hagState(actor).appearance !== "true"
  )
    await patchHag(actor, { appearance: "true" });
}
export function validateHagItem(item, _data, _options, userId) {
  if (!enforcesTransformationPrerequisites(item, userId, "hag-transformation")) return;
  if (baseAbilityValue(item.parent, "cha") < 13) {
    notify("Ведьма: требуется Харизма 13.", "warn");
    return false;
  }
}
export function validateHagAdvancement(manager, _updates, toCreate, _toUpdate, toDelete) {
  if (!enabled()) return;
  const owned = advancementSurvivors(manager, toDelete),
    keys = new Set([...owned, ...toCreate].map(i => i.system?.identifier));
  for (const d of toCreate) {
    const f = automationData(d);
    if (!f.hagBoon) continue;
    if (isDuplicateGrant(d, owned, toCreate)) {
      notify(`«${d.name}» уже получено.`, "warn");
      return false;
    }
    if (f.hagRequires && f.hagRequires !== "spellcasting" && !keys.has(`hag-${f.hagRequires}`)) {
      notify(`Не выполнено требование «${d.name}».`, "warn");
      return false;
    }
    if (
      f.hagRequires === "spellcasting" &&
      !owned.some(
        i =>
          i.type === "spell" ||
          (i.type === "class" && i.system?.spellcasting?.progression && i.system.spellcasting.progression !== "none")
      )
    ) {
      notify(
        "Алхимическое Колдовство требует способности накладывать заклинания; нестандартный источник подтверждает GM вручную.",
        "warn"
      );
      return false;
    }
  }
}
export const inspectHag = actor => ({
  level: hagLevel(actor),
  dc: hagLevel(actor) ? hagDC(actor) : null,
  type: hagType(actor),
  additionalType: hagHas(actor, "form") && hagType(actor) ? (hagType(actor) === "night" ? "fiend" : "fey") : null,
  curses: hagCurses(actor),
  rules: hagRules(actor),
  state: structuredClone(hagState(actor)),
  unavailable: HAG_FEATURES.filter(r => findFeature(actor, r.key) && !hagHas(actor, r.id)).map(r => r.id)
});
