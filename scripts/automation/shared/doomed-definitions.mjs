export const DOOMED_ICON = "icons/svg/skull.svg";
export const DOOMED_FEATURES = [
  ["curses", "Принятые проклятия", 1],
  ["endurance", "Стойкость обречённого", 1],
  ["shared-fate", "Разделённая участь", 2],
  ["sense", "Чутьё порчи", 2],
  ["defiance", "Наперекор судьбе", 3],
  ["empower", "Усиление проклятия", 3],
  ["increase", "Проклятое увеличение", 4],
  ["incarnation", "Воплощение порчи", 5],
  ["delayed-end", "Отсроченный конец", 5]
].map(([id, name, level]) => ({ id, key: `doomed-${id}`, name, level }));
export const DOOMED_CURSES = [
  ["silence", "Безмолвие", 1, "silenced"],
  ["heart", "Выжженное сердце", 1, "terror"],
  ["hunger", "Кровавый голод", 1, "blood"],
  ["wounds", "Незаживающие раны", 1, "regen"],
  ["flame", "Неугасимое пламя", 1, "fire"],
  ["soul", "Обнажённая душа", 1, "angel"],
  ["truth", "Правдивый язык", 1, "book"],
  ["luck", "Проклятая удача", 1, "d20-grey"],
  ["mind", "Расколотый разум", 1, "sound-off"],
  ["grave", "Тяжесть могилы", 1, "anchor"],
  ["flesh", "Истлевшая плоть", 2, "skull"],
  ["outcast", "Клеймо отверженного", 2, "cowled"],
  ["cold", "Мёртвый холод", 2, "ice-aura"],
  ["rage", "Неконтролируемая ярость", 2, "sword"],
  ["relics", "Отторжение реликвий", 2, "lightning"],
  ["disruption", "Срыв чар", 2, "cancel"],
  ["shadow", "Тень за спиной", 2, "invisible"],
  ["moment", "Украденный миг", 2, "clockwork"],
  ["bones", "Хрупкие кости", 2, "wing"],
  ["chains", "Могильные цепи", 3, "net"],
  ["buried", "Погребённая душа", 3, "invisible"],
  ["decay", "Распад", 3, "biohazard"],
  ["revelation", "Слепое откровение", 3, "blind"]
].map(([id, name, cost, icon]) => ({
  id,
  key: `doomed-curse-${id}`,
  name,
  cost,
  level: 1,
  img: `icons/svg/${icon}.svg`
}));
export const doomedSlots = level => 2 * Math.max(0, Math.min(5, Number(level) || 0));
export const doomedEntry = id => DOOMED_CURSES.find(entry => entry.id === id);
export const doomedTotalLevel = actor =>
  Number(actor?.system?.details?.level) ||
  [...(actor?.items ?? [])]
    .filter(item => item.type === "class")
    .reduce((n, item) => n + Number(item.system.levels ?? 0), 0);
export const doomedMaximum = actor =>
  Math.max(
    1,
    Number(
      actor.system.attributes.hp.effectiveMax ??
        Number(actor.system.attributes.hp.max) + Number(actor.system.attributes.hp.tempmax ?? 0)
    )
  );
export const doomedCritical = (current, { hp, maximum, empowered }) =>
  Math.min(Number(current) || 20, empowered ? (hp <= maximum / 2 ? 18 : 19) : hp <= maximum / 2 ? 19 : 20);
export const doomedFeet = (feet, units) => Number(feet) * (units === "m" ? 0.3048 : 1);
