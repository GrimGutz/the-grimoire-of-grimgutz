import { MODULE_ID } from "../shared/constants.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import {
  CHIMERA_MENAGERIE,
  CHIMERA_KNOWLEDGE,
  CHIMERA_ELEMENTS,
  chimeraMutationFor
} from "../shared/chimera-definitions.mjs";
import { chimeraState, chimeraHas, chimeraTransformationLevel, syncChimera } from "./chimera.mjs";
import { serialMutation } from "../shared/transactions.mjs";
export const chimeraGm = actor => ({ uuid: actor.uuid, testUserPermission: user => user.isGM });
export async function saveChimeraState(actor, patch) {
  await serialMutation(`chimera-state:${actor.uuid}`, () =>
    actor.setFlag(MODULE_ID, "chimeraState", { ...structuredClone(chimeraState(actor)), ...patch })
  );
  await syncChimera(actor);
  return true;
}
export async function chooseChimera(actor, operation) {
  const state = chimeraState(actor);
  if (operation === "menagerie") {
    const count = Math.min(CHIMERA_MENAGERIE.length, Math.max(0, Number(actor.system.attributes.prof))),
      previous = state.menagerie ?? [],
      locked = previous.length > 0 && Number(state.menagerieEpoch ?? 0) === Number(state.restEpoch ?? 0);
    if (locked && previous.length >= count)
      throw Error("Адаптации уже выбраны. Менять можно после продолжительного отдыха.");
    const keep = locked ? previous : [],
      needed = count - keep.length,
      choices = CHIMERA_MENAGERIE.filter(e => !keep.includes(e.id));
    const selected = needed
      ? await askOwner(actor, {
          title: "Менажери",
          kind: "checkbox",
          label: locked ? "Добавьте новые адаптации; прежние сохраняются" : "Выберите адаптации до следующего LR",
          choices: choices.map(e => [e.id, e.name]),
          min: needed,
          max: needed
        })
      : [];
    if (
      !selected ||
      selected.length !== needed ||
      new Set(selected).size !== needed ||
      selected.some(id => !choices.some(e => e.id === id))
    )
      return false;
    return saveChimeraState(actor, { menagerie: [...keep, ...selected], menagerieEpoch: Number(state.restEpoch ?? 0) });
  }
  if (operation === "knowledge") {
    if (
      state.knowledge &&
      !(await confirmOwner(
        chimeraGm(actor),
        "Сложное знание",
        "Это исправление ранее выбранного навыка/адаптации, разрешённое GM, а не свободная смена?"
      ))
    )
      return false;
    const skill = await askOwner(actor, {
      title: "Сложное знание: навык",
      choices: Object.entries(actor.system.skills ?? {}).map(([key]) => [
        key,
        game.i18n?.localize(CONFIG.DND5E.skills[key]?.label ?? key) ?? key
      ])
    });
    if (!skill || !actor.system.skills[skill]) return false;
    const adaptation = await askOwner(actor, {
      title: "Сложное знание: адаптация",
      choices: CHIMERA_KNOWLEDGE.map(e => [e.id, e.name])
    });
    if (!CHIMERA_KNOWLEDGE.some(e => e.id === adaptation)) return false;
    const own = state.knowledge?.skill === skill ? state.knowledge : null,
      base = Number(actor.system.skills[skill].value ?? 0),
      grade = own?.grade ?? (base >= 2 ? 3 : base >= 1 ? 2 : 1);
    return saveChimeraState(actor, { knowledge: { skill, grade, adaptation } });
  }
  if (operation === "resistance") {
    if (state.resistance && Number(state.resistanceEpoch ?? 0) === Number(state.restEpoch ?? 0))
      throw Error("Сопротивление меняется после продолжительного отдыха.");
    const choices = Object.entries(CONFIG.DND5E.damageTypes ?? {}).map(([id, d]) => [
      id,
      game.i18n?.localize(d.label ?? id) ?? id
    ]);
    const selected = await askOwner(actor, { title: "Сопротивление гибрида", choices });
    if (!choices.some(([id]) => id === selected)) return false;
    return saveChimeraState(actor, { resistance: selected, resistanceEpoch: Number(state.restEpoch ?? 0) });
  }
  if (operation === "breath-type") {
    if (
      state.breath &&
      !(await confirmOwner(chimeraGm(actor), "Элемент дыхания", "Изменить постоянный выбор элемента с разрешения GM?"))
    )
      return false;
    const selected = await askOwner(actor, { title: "Дыхание дракона", choices: Object.entries(CHIMERA_ELEMENTS) });
    if (!Object.hasOwn(CHIMERA_ELEMENTS, selected)) return false;
    return saveChimeraState(actor, { breath: selected });
  }
  return false;
}
export async function rollChimeraMutation(actor, { onlyLower = false } = {}) {
  if (!chimeraHas(actor, "aberration")) return false;
  const old = chimeraState(actor).mutation,
    tier = chimeraTransformationLevel(actor);
  for (let i = 0; i < 40; i++) {
    const roll = await new Roll("1d100").evaluate(),
      value = Number(roll.total),
      row = chimeraMutationFor(value, tier);
    if (!row) throw Error("Некорректный к100 мутации.");
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `Химера: ${onlyLower ? "Раздражённая кровь" : "Химерическая аберрация"}`
    });
    if (onlyLower && old && value >= old.roll) return true;
    if (!onlyLower && old?.id === row.id) continue;
    await saveChimeraState(actor, { mutation: { id: row.id, roll: value, tier } });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p>Химера: ${value} — ${row.text}</p>`
    });
    return true;
  }
  throw Error("40 повторов одной строки: требуется проверка мутации GM.");
}
