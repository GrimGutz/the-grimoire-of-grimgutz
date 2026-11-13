import { clamp } from "./dnd5e.mjs";
import { notify } from "./helpers.mjs";

function escapeHtml(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

function normalizeChoice(choice) {
  if (Array.isArray(choice)) {
    return {
      value: choice[0],
      label: choice[1] ?? choice[0],
      hint: choice[2] ?? "",
      selected: false,
      disabled: false
    };
  }
  return {
    value: choice?.value,
    label: choice?.label ?? choice?.value,
    hint: choice?.hint ?? choice?.description ?? "",
    selected: choice?.selected === true,
    disabled: choice?.disabled === true
  };
}

function normalizedChoices(choices) {
  return (choices ?? []).map(normalizeChoice).filter(choice => choice.value !== undefined && choice.value !== null);
}

function optionHtml(choice, selectedValue) {
  const value = String(choice.value);
  const selected = selectedValue !== undefined && String(selectedValue) === value ? " selected" : "";
  const disabled = choice.disabled ? " disabled" : "";
  const hint = choice.hint ? ` — ${choice.hint}` : "";
  return `<option value="${escapeHtml(value)}"${selected}${disabled}>${escapeHtml(choice.label)}${escapeHtml(hint)}</option>`;
}

function fallbackDialogError(title) {
  notify(`${title}: DialogV2 недоступен в этой версии Foundry.`, "error");
  return null;
}

export async function choiceDialog({
  title,
  label,
  choices,
  defaultValue,
  hint = "",
  width = 420,
  selectName = "choice",
  confirmLabel = "Выбрать",
  confirmIcon = "fa-solid fa-check",
  cancelLabel = "Отмена",
  cancelIcon = "fa-solid fa-xmark"
} = {}) {
  if (!foundry.applications?.api?.DialogV2) return fallbackDialogError(title ?? "Выбор");
  const list = normalizedChoices(choices);
  if (!list.length) {
    notify(`${title ?? "Выбор"}: нет доступных вариантов.`, "warn");
    return null;
  }
  const selectedValue =
    defaultValue ?? list.find(choice => choice.selected)?.value ?? list.find(choice => !choice.disabled)?.value;
  const options = list.map(choice => optionHtml(choice, selectedValue)).join("");
  return foundry.applications.api.DialogV2.wait({
    window: { title: title ?? "Выбор" },
    position: { width },
    content: `
      ${hint ? `<p class="notes">${escapeHtml(hint)}</p>` : ""}
      <div class="form-group">
        <label>${escapeHtml(label ?? "Вариант")}</label>
        <div class="form-fields">
          <select name="${escapeHtml(selectName)}">${options}</select>
        </div>
      </div>
    `,
    buttons: [
      {
        action: "choose",
        label: confirmLabel,
        icon: confirmIcon,
        default: true,
        callback: (_event, _button, dialog) =>
          dialog.element.querySelector(`select[name="${selectName}"]`)?.value ?? null
      },
      {
        action: "cancel",
        label: cancelLabel,
        icon: cancelIcon,
        callback: () => null
      }
    ]
  });
}

export async function numberDialog({
  title,
  label,
  min = 1,
  max = 1,
  defaultValue = min,
  hint = "",
  width = 420,
  confirmLabel = "Выбрать",
  confirmIcon = "fa-solid fa-check"
} = {}) {
  const safeMin = Math.floor(Number(min) || 0);
  const safeMax = Math.max(safeMin, Math.floor(Number(max) || safeMin));
  const value = clamp(Math.floor(Number(defaultValue) || safeMin), safeMin, safeMax);
  const choices = Array.from({ length: safeMax - safeMin + 1 }, (_entry, index) => {
    const option = safeMin + index;
    return { value: option, label: String(option), selected: option === value };
  });
  const selected = await choiceDialog({
    title,
    label,
    choices,
    defaultValue: value,
    hint,
    width,
    confirmLabel,
    confirmIcon
  });
  if (selected === null || selected === undefined || selected === "") return null;
  const numeric = Number(selected);
  return Number.isFinite(numeric) ? clamp(numeric, safeMin, safeMax) : null;
}

export async function slotLevelDialog({
  title = "Уровень ячейки",
  label = "Уровень ячейки",
  minimum = 1,
  maximum = 9,
  defaultValue = minimum,
  hint = "",
  width = 360,
  confirmLabel = "Выбрать"
} = {}) {
  return numberDialog({
    title,
    label,
    min: minimum,
    max: maximum,
    defaultValue,
    hint,
    width,
    confirmLabel
  });
}

export async function multiChoiceDialog({
  title,
  label,
  choices,
  selected = [],
  min = 0,
  max = null,
  hint = "",
  width = 460,
  inputName = "choice",
  confirmLabel = "Выбрать",
  confirmIcon = "fa-solid fa-check",
  cancelLabel = "Отмена",
  cancelIcon = "fa-solid fa-xmark"
} = {}) {
  if (!foundry.applications?.api?.DialogV2) return fallbackDialogError(title ?? "Выбор");
  const list = normalizedChoices(choices);
  if (!list.length) {
    notify(`${title ?? "Выбор"}: нет доступных вариантов.`, "warn");
    return null;
  }
  const selectedSet = new Set((selected ?? []).map(String));
  const rows = list
    .map(choice => {
      const value = String(choice.value);
      const checked = selectedSet.has(value) || choice.selected ? " checked" : "";
      const disabled = choice.disabled ? " disabled" : "";
      const hintText = choice.hint ? `<span class="notes">${escapeHtml(choice.hint)}</span>` : "";
      return `
      <label class="checkbox">
        <input type="checkbox" name="${escapeHtml(inputName)}" value="${escapeHtml(value)}"${checked}${disabled}>
        ${escapeHtml(choice.label)} ${hintText}
      </label>
    `;
    })
    .join("");
  const limitText = max ? `Выберите от ${min} до ${max}.` : min > 0 ? `Выберите минимум ${min}.` : "";
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: title ?? "Выбор" },
    position: { width },
    content: `
      ${hint || limitText ? `<p class="notes">${escapeHtml([hint, limitText].filter(Boolean).join(" "))}</p>` : ""}
      <div class="form-group stacked">
        ${label ? `<label>${escapeHtml(label)}</label>` : ""}
        ${rows}
      </div>
    `,
    buttons: [
      {
        action: "choose",
        label: confirmLabel,
        icon: confirmIcon,
        default: true,
        callback: (_event, _button, dialog) =>
          [...dialog.element.querySelectorAll(`input[name="${inputName}"]:checked`)].map(input => input.value)
      },
      {
        action: "cancel",
        label: cancelLabel,
        icon: cancelIcon,
        callback: () => null
      }
    ]
  });
  if (!Array.isArray(result)) return null;
  if (max !== null && result.length > max) {
    notify(`${title ?? "Выбор"}: выбрано ${result.length}, максимум ${max}.`, "warn");
    return null;
  }
  if (result.length < min) {
    notify(`${title ?? "Выбор"}: выбрано ${result.length}, минимум ${min}.`, "warn");
    return null;
  }
  return result;
}

export async function selectFormDialog({
  title,
  fields,
  hint = "",
  width = 480,
  confirmLabel = "Применить",
  confirmIcon = "fa-solid fa-check",
  cancelLabel = "Отмена",
  cancelIcon = "fa-solid fa-xmark"
} = {}) {
  if (!foundry.applications?.api?.DialogV2) return fallbackDialogError(title ?? "Выбор");
  const safeFields = (fields ?? []).filter(field => field?.name && normalizedChoices(field.choices).length);
  if (!safeFields.length) {
    notify(`${title ?? "Выбор"}: нет доступных полей.`, "warn");
    return null;
  }
  const content = safeFields
    .map(field => {
      const choices = normalizedChoices(field.choices);
      const selected =
        field.defaultValue ??
        choices.find(choice => choice.selected)?.value ??
        choices.find(choice => !choice.disabled)?.value;
      return `
      <div class="form-group">
        <label>${escapeHtml(field.label ?? field.name)}</label>
        <div class="form-fields">
          <select name="${escapeHtml(field.name)}">
            ${choices.map(choice => optionHtml(choice, selected)).join("")}
          </select>
        </div>
      </div>
    `;
    })
    .join("");
  return foundry.applications.api.DialogV2.wait({
    window: { title: title ?? "Выбор" },
    position: { width },
    content: `
      ${hint ? `<p class="notes">${escapeHtml(hint)}</p>` : ""}
      ${content}
    `,
    buttons: [
      {
        action: "choose",
        label: confirmLabel,
        icon: confirmIcon,
        default: true,
        callback: (_event, _button, dialog) =>
          Object.fromEntries(
            safeFields.map(field => [
              field.name,
              dialog.element.querySelector(`select[name="${field.name}"]`)?.value ?? null
            ])
          )
      },
      {
        action: "cancel",
        label: cancelLabel,
        icon: cancelIcon,
        callback: () => null
      }
    ]
  });
}
