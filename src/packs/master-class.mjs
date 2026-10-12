import {MODULE_ID, baseDocument, hitPointsAdvancement, itemGrant, itemChoice, scaleValueAdvancement, subclassAdvancement, sourceData, uuidFor} from "../common.mjs";
import {MASTER_CORE, MASTER_TECHNIQUES, MASTER_PATHS, MASTER_SOURCE, masterSection, masterHtml} from "../master-data.mjs";
const link = (pack, key, label) => `@UUID[${uuidFor(pack, key)}]{${label}}`;
const choices = [2, 1, 1, 2, 1].map((count, i) => {
  const advancement = itemChoice({key: `master-techniques-${i + 1}`, level: i + 1, count, allowDrops: false, title: "Техники Мастера",
    hint: "Выберите техники доступного уровня и своего пути. При получении уровня можно заменить одну известную технику (через её отдельный выбор замены).",
    items: MASTER_TECHNIQUES.filter(t => t.level <= i + 1).map(t => t.key)});
  return advancement;
});
// Replacement is a separate optional choice, not another mandatory known technique.
const replacements = [2, 3, 4, 5].map(level => {
  const result = itemChoice({key: `master-technique-replacement-${level}`, level, count: 1, allowDrops: false,
    title: "Заменить одну технику (необязательно)", hint: "Можно оставить текущие техники; новая заменяет одну старую, не увеличивая число известных.",
    items: MASTER_TECHNIQUES.filter(t => t.level <= level).map(t => t.key)});
  result.configuration.choices[level].replacement = true; return result;
});
export const masterClassDocuments = [baseDocument({key: "master-class", name: "Мастер / Master", type: "class", img: "icons/skills/melee/sword-twirl-orange.webp",
  flags: {[MODULE_ID]: {prestigeClass: "master"}}, system: {identifier: "master", levels: 1, hitDice: "d8", hitDiceUsed: 0,
    source: sourceData("Master.md", MASTER_SOURCE), description: {chat: "", value: `<h1>Престиж-класс: Мастер</h1><p>Совершенство владения оружием, ремеслом или магией.</p>
      <h2>Требования</h2><ul><li>Общий уровень 10 или выше.</li><li>Сила, Ловкость, Интеллект, Мудрость или Харизма 20.</li><li>Владение хотя бы одним навыком, инструментом или оружием.</li></ul>
      <p>Строгая проверка требований выключена по умолчанию и включается настройкой мира. Кость хитов: к8; хиты за уровень: 1к8 (или 5) + модификатор Телосложения. Новых владений, спасбросков и стартового снаряжения нет.</p>
      <table><thead><tr><th>Уровень</th><th>Техник известно</th><th>Особенности</th></tr></thead><tbody>${[1,2,3,4,5].map(level => `<tr><td>${level}</td><td>${[2,3,4,6,7][level-1]}</td><td>${MASTER_CORE.filter(f => f.level === level).map(f => link("features", f.key, f.name)).join(", ")}</td></tr>`).join("")}</tbody></table>
      <h2>Пути</h2><p>${MASTER_PATHS.map(path => link("subclasses", `master-${path.id}`, path.name)).join(" / ")}</p>
      <h2>Термины</h2>${masterHtml(masterSection("Термины класса"))}
      <h2>Техники</h2><p>${MASTER_TECHNIQUES.map(t => link("features", t.key, t.name)).join(", ")}</p>
      <p><strong>Автоматизация Foundry:</strong> Advancement выдаёт особенности и выбор 2/3/4/6/7 известных техник, плюс один необязательный обмен при повышении уровня. Путь — стандартный подкласс. Настройте его через карточку Пути совершенства. Полное описание каждой механики и границы автоматизации находятся в её карточке; произвольные серии и спорные условия подтверждает Мастер.</p>`},
    advancement: [hitPointsAdvancement("master-hit-points"), subclassAdvancement({key: "master-perfection-path", level: 1, title: "Путь совершенства"}),
      scaleValueAdvancement({key: "master-known-techniques", identifier: "known-techniques", title: "Техник известно", scale: Object.fromEntries([2,3,4,6,7].map((value,i) => [i+1,{value}]))}),
      ...[1,2,3,4,5].map(level => itemGrant({key: `master-features-${level}`, level, items: MASTER_CORE.filter(f => f.level === level).map(f => f.key)})), ...choices, ...replacements],
    spellcasting: {progression: "none", ability: "", preparation: {}}, wealth: ""}})];
