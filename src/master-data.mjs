import {readFileSync} from "node:fs";
import {uuidFor} from "./common.mjs";

export const MASTER_SOURCE = "Престиж-класс Мастер; предоставленный Master.md";
const source = readFileSync(new URL("./content/master.md", import.meta.url), "utf8").replace(/\r/g, "");
const clean = text => text.replace(/^\\(?:page|column).*$/gm, "").replaceAll("{{}}", "").trim();
export function masterSection(title, depth = 3) {
  const marker = `${"#".repeat(depth)} ${title}\n`, start = source.indexOf(marker);
  if (start < 0) throw Error(`Missing Master rule: ${title}`);
  const rest = source.slice(start + marker.length);
  const end = rest.search(new RegExp(`^#{1,${depth}} `, "m"));
  return clean(end < 0 ? rest : rest.slice(0, end));
}
export function masterHtml(text) {
  const escape = value => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return clean(text).split(/\n\s*\n/).filter(Boolean).map(block => {
    let value = escape(block).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
    if (/^#{1,6} /.test(block)) return `<h3>${value.replace(/^#{1,6} /, "")}</h3>`;
    if (/^- /.test(block)) return `<ul>${value.split("\n").map(line => `<li>${line.replace(/^- /, "")}</li>`).join("")}</ul>`;
    return `<p>${value.replaceAll("\n", "<br>")}</p>`;
  }).join("\n");
}

// Explicit configuration, not runtime inference from narrative text.
// key, title, path, minimum level, implementation category.
export const MASTER_TECHNIQUES = [
  ["point-blank", "Бой в упор", null, 1, "passive"],
  ["rapid-reload", "Быстрая перезарядка", "archer", 1, "reload"],
  ["appraisal", "Опытный взгляд", null, 1, "manual"],
  ["long-shot", "Дальний выстрел", "archer", 1, "passive"],
  ["distant-formula", "Дальняя формула", "arcana", 1, "arm"],
  ["protective-formula", "Защитная формула", "arcana", 1, "spell-temp"],
  ["through-cover", "Сквозь укрытие", null, 1, "manual"],
  ["long-lunge", "Длинный выпад", "blade", 1, "arm"],
  ["reliable-formula", "Надежная формула", "arcana", 1, "arm"],
  ["blade-onslaught", "Натиск клинка", "blade", 1, "hit-save"],
  ["retreating-shot", "Отступающий выстрел", "archer", 1, "manual"],
  ["foresight", "Предусмотрительность", null, 1, "foresight"],
  ["disarming-strike", "Разоружающий удар", "blade", 1, "hit-save"],
  ["risky-maneuver", "Рискованный прием", null, 1, "arm"],
  ["perfect-hand", "Совершенная рука", null, 1, "expertise"],
  ["steel-barrier", "Стальной заслон", "blade", 1, "hit-effect"],
  ["disrupting-shot", "Срывающий выстрел", "archer", 1, "hit-effect"],
  ["learned-formula", "Учёная формула", "arcana", 1, "manual"],
  ["perfect-riposte", "Безупречная контратака", "blade", 3, "reaction"],
  ["elemental-mastery", "Власть над стихией", "arcana", 3, "arm"],
  ["snap-shot", "Выстрел навскидку", "archer", 3, "reaction"],
  ["selective-formula", "Избирательная формула", "arcana", 3, "manual"],
  ["school-specialist", "Специалист школы", "arcana", 3, "passive"],
  ["unwavering-concentration", "Непоколебимая концентрация", null, 3, "passive"],
  ["defensive-stance", "Оборонительная стойка", "blade", 3, "passive"],
  ["suppressing-shot", "Подавляющий выстрел", "archer", 3, "hit-save"],
  ["pinning-maneuver", "Пригвождающий прием", null, 3, "hit-effect"],
  ["piercing-shot", "Пробивающий выстрел", "archer", 3, "extra-attack"],
  ["expanded-formula", "Расширенная формула", "arcana", 3, "arm"],
  ["cleave", "Рассечение", "blade", 3, "extra-attack"],
  ["ricochet", "Рикошет", "archer", 3, "extra-attack"],
  ["blade-warden", "Страж клинка", "blade", 3, "reaction"],
  ["great-spell", "Великое заклинание", "arcana", 5, "great-spell"],
  ["blade-whirlwind", "Вихрь клинка", "blade", 5, "whirlwind"],
  ["measured-position", "Выверенная позиция", null, 5, "manual"],
  ["aimed-volley", "Прицельный залп", "archer", 5, "extra-attack"],
  ["inevitable-hit", "Неотвратимое попадание", null, 5, "manual-resource"],
  ["undeniable-magic", "Непререкаемая магия", "arcana", 5, "manual-resource"],
  ["answer-magic", "Ответ на магию", null, 5, "reaction"],
  ["deadly-range", "Смертельная дистанция", "archer", 5, "arm"],
  ["swift-series", "Стремительная серия", "blade", 5, "extra-attack"]
].map(([id, name, path, level, mode]) => ({id, key: `master-${id}`, name, path, level, mode}));

export const MASTER_CORE = [
  ["perfection-path", "Путь совершенства", 1, "configure"],
  ["chosen-proficiency", "Избранное владение", 1, "expertise"],
  ["techniques", "Техники", 1, "manual"],
  ["will-perfection", "Воля к совершенству", 2, "manual-resource"],
  ["perfect-craft", "Совершенное ремесло", 3, "passive"],
  ["combination", "Серия приемов", 3, "series"],
  ["ability-improvement", "Увеличение характеристик", 4, "asi"],
  ["path-apex", "Вершина пути", 5, "passive"],
  ["improved-combination", "Улучшенная серия приемов", 5, "manual"]
].map(([id, name, level, mode]) => ({id, key: `master-${id}`, name, level, mode}));

export const MASTER_PATHS = [
  {id: "blade", name: "Путь Клинка", icon: "icons/skills/melee/sword-twirl-orange.webp"},
  {id: "archer", name: "Путь Стрелка", icon: "icons/skills/ranged/arrow-flying-white-blue.webp"},
  {id: "arcana", name: "Путь Арканы", icon: "icons/skills/trades/academics-book-study-runes.webp"}
];

export function masterLinks(html, self = "") {
  const labels = [...MASTER_CORE, ...MASTER_TECHNIQUES, ...MASTER_PATHS.map(p => ({key: `master-path-${p.id}`, name: p.name}))]
    .filter(entry => entry.key !== self).sort((a,b) => b.name.length - a.name.length);
  const byName = new Map(labels.map(entry => [entry.name.toLowerCase(), entry]));
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(?<![\\p{L}\\p{N}])(${labels.map(e => escape(e.name)).join("|")})(?![\\p{L}\\p{N}])`, "giu");
  return html.split(/(@UUID\[[^\]]+\]\{[^}]+\}|<[^>]+>)/g).map(chunk => chunk.startsWith("<") || chunk.startsWith("@UUID[") ? chunk
    : chunk.replace(regex, label => `@UUID[${uuidFor("features", byName.get(label.toLowerCase()).key)}]{${label}}`)).join("");
}
