export const NIGHTMARE_ICON = "icons/svg/terror.svg";
export const NIGHTMARE_FEATURES = [
  ["feeding", "Питание страхом", 1],
  ["fears", "Навязанные страхи", 1],
  ["call", "Зов кошмара", 2],
  ["echo", "Отголосок", 2],
  ["inevitable", "Неотвратимый ужас", 3],
  ["blind-spot", "Слепое пятно", 3],
  ["increase", "Увеличение характеристик", 4],
  ["despair", "Безысходность", 5],
  ["lord", "Владыка кошмаров", 5]
].map(([id, name, level]) => ({ id, key: `nightmare-${id}`, name, level }));
export const NIGHTMARE_FEARS = [
  ["agora", "Агорафобия (Страх открытых пространств)", "start"],
  ["algo", "Алгофобия (Страх боли)", "damage"],
  ["atych", "Атихифобия (Страх неудачи)", "end"],
  ["auto", "Аутофобия (Страх одиночества)", "start"],
  ["hoplo", "Гоплофобия (Страх оружия)", "manual"],
  ["claustro", "Клаустрофобия (Страх замкнутых пространств)", "start"],
  ["nycto", "Никтофобия (Страх темноты)", "damage"],
  ["ochlo", "Охлофобия (Страх толпы)", "start"],
  ["rhabdo", "Рабдофобия (Страх колдовства)", "manual"],
  ["thanato", "Танатофобия (Страх смерти)", "death"]
].map(([id, name, trigger]) => ({ id, key: `nightmare-fear-${id}`, name, trigger, level: 1 }));
export const NIGHTMARE_PROFILES = [
  {
    id: "scout",
    name: "Соглядатай",
    size: "tiny",
    img: "icons/svg/eye.svg",
    movement: { walk: 10, fly: 40, hover: true }
  },
  {
    id: "pursuer",
    name: "Преследователь",
    size: "med",
    img: "icons/svg/cowled.svg",
    movement: { walk: 40, climb: 40 }
  },
  { id: "warden", name: "Надзиратель", size: "med", img: "icons/svg/terror.svg", movement: { walk: 20 } }
].map(entry => ({ ...entry, key: `nightmare-profile-${entry.id}`, level: 2 }));
export const nightmareMaximum = level => (Number(level) > 0 ? Math.min(5, Number(level)) + 2 : 0);
export const nightmareKnownMaximum = level => (Number(level) > 0 ? Math.min(5, Number(level)) + 1 : 0);
export const nightmareFearLimit = level => (Number(level) >= 5 ? 2 : 1);
export const nightmareMaximumHP = actor =>
  Math.max(
    1,
    Number(
      actor.system?.attributes?.hp?.effectiveMax ??
        Number(actor.system?.attributes?.hp?.max ?? 1) + Number(actor.system?.attributes?.hp?.tempmax ?? 0)
    )
  );
export const nightmareTotalLevel = actor =>
  Number(actor?.system?.details?.level) ||
  [...(actor?.items ?? [])]
    .filter(item => item.type === "class")
    .reduce((n, item) => n + Number(item.system.levels ?? 0), 0);
