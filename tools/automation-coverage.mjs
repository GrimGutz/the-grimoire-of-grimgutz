import {readdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {getAutomationActionHandlers} from "../scripts/automation/runtime.mjs";
import {automationAction} from "../scripts/automation/shared/helpers.mjs";
import {AURA_DEFINITIONS} from "../scripts/automation/shared/aura-definitions.mjs";
import {STRATAGEM_RULES} from "../scripts/automation/classes/leader-stratagems.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const labels = {automatic: "автоматизировано", partial: "частично", manual: "обоснованно вручную", review: "требует исправления"};
const known = {"regenerating-soul": ["classes/juggernaut-regeneration", "juggernaut-regeneration"], "mind-body-and-soul": ["classes/ritualist", "ritualist-zones"],
  "binding-ritual": ["classes/ritualist-spirits", "ritualist-spirits"], "fortified-soul": ["midi/spell-resistance", "spell-resistance"],
  "master-path-blade": ["classes/master-blade", "master-blade"],
  "hunter-breakdown":["classes/bounty-hunter-combat","bounty-hunter"],"hunter-duel":["classes/bounty-hunter-combat","bounty-hunter"],
  "hunter-rekindle":["classes/bounty-hunter-events","bounty-hunter"],
  "jester-mise":["classes/jester-actions","jester"],"jester-improvisation":["classes/jester-actions","jester"],
  "flagellant-price":["classes/flagellant","flagellant"],"flagellant-frenzy":["classes/flagellant","flagellant"],
  "flagellant-flesh":["classes/flagellant","flagellant"],
  ...Object.fromEntries(["incarnation",... ["silence","heart","wounds","soul","truth","luck","mind","grave","flesh","cold","disruption","moment","bones","buried","revelation"].map(id=>`curse-${id}`)].map(id=>[`doomed-${id}`,["classes/doomed","doomed"]])),
  "doomed-curse-rage":["classes/doomed-events","doomed"],"nightmare-despair":["classes/nightmare-fears","nightmare"],"nightmare-lord":["classes/nightmare-actions","nightmare"]};
export async function buildCoverageInventory() {
const handlers = getAutomationActionHandlers(), tests = await readdir(path.join(root, "tests")), records = [];
for (const pack of ["classes", "subclasses", "transformations", "features", "equipment", "spells", "bestiary"]) {
  const {documents} = await import(`../src/packs/${pack}.mjs`);
  for (const document of documents) for (const item of [document, ...(document._embeddedItems ?? document.items ?? []).filter(item => item && typeof item === "object")]) {
    const key = item.system?.identifier ?? item._id, entries = [], checks = new Set();
    let missing = false;
    for (const activity of Object.values(item.system?.activities ?? {})) {
      const action = automationAction(activity);
      if (action) {
        const handler = handlers.get(action); entries.push(`${typeof handler === "function" ? "module" : "MISSING"}:${action}`);
        checks.add("tests/registrations.test.mjs"); missing ||= typeof handler !== "function";
      } else if (activity.type !== "utility" || activity.roll?.formula) {entries.push(`dnd5e:${activity.type}`); checks.add("tools/validate.mjs");}
    }
    if (item.system?.advancement?.length) {entries.push("dnd5e:Advancement"); checks.add("tests/progression.test.mjs");}
    if (pack === "bestiary" && item === document) {entries.push("dnd5e:Actor-statblock"); checks.add("tools/validate.mjs");}
    if (["weapon", "equipment", "consumable", "spell"].includes(item.type)) {entries.push(`dnd5e:Item-${item.type}`); checks.add("tools/validate.mjs");}
    if ((item.effects ?? []).some(effect => (effect.system?.changes ?? effect.changes ?? []).length || effect.statuses?.length)) {
      entries.push("dnd5e:ActiveEffect"); checks.add("tests/passives.test.mjs");
    }
    for (const aura of AURA_DEFINITIONS) if ((aura.sourceFeatures ?? [aura.sourceFeature ?? aura.activityFeature]).includes(key)) {
      entries.push(`aura:${aura.id}`); checks.add("tests/auras.test.mjs"); checks.add("tests/aura-events.test.mjs");
    }
    if (STRATAGEM_RULES[key]) {entries.push(`leader-stratagem:${STRATAGEM_RULES[key]}`); checks.add("tests/leader-use.test.mjs");}
    if (known[key]) {entries.push(`runtime:${known[key][0]}`); checks.add(`tests/${known[key][1]}.test.mjs`);}
    const text = String(item.system?.description?.value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const footer = text.split(/Автоматизация(?: Foundry)?\s*:/i).at(-1);
    const manual = /вручную|напоминание|маркер|marker|подтвержда|решени[ея] (?:GM|Мастер)|сюжет|повествователь|справк[ау]/iu.test(footer);
    const hasMechanicalData = Object.keys(item.system?.activities ?? {}).length || item.system?.advancement?.length || item.effects?.length;
    const status = missing ? "review" : entries.length ? manual || entries.some(e => e.startsWith("module:")) ? "partial" : "automatic"
      : manual ? "manual" : "review";
    records.push({pack, id: `${document._id}${item !== document ? `.Item.${item._id}` : ""}`, name: item.name, key, status, entries: [...new Set(entries)], checks: [...checks].filter(check => !check.endsWith(".test.mjs") || tests.includes(path.basename(check))),
      note: missing ? "Нет регистрации действия" : !entries.length && !manual ? "Не установлена связь с обработчиком; требуется точечная проверка, не создание эффекта по догадке"
        : manual ? footer.slice(0, 220) : hasMechanicalData ? "Нативные данные/обработчик есть; игровая проверка не заменяется регистрацией" : "Событийный обработчик"});
  }
}
const summary = Object.fromEntries(Object.keys(labels).map(status => [status, records.filter(record => record.status === status).length]));
return {schemaVersion: 1, scope: "static-source-inventory", summary, records};
}
if (import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? "")).href) {
const inventory = await buildCoverageInventory(), {summary, records} = inventory;
await writeFile(path.join(root, "docs/AUTOMATION_COVERAGE.json"), JSON.stringify(inventory, null, 2) + "\n");
const esc = text => String(text).replaceAll("|", "\\|").replaceAll("\n", " ");
const markdown = `# Реестр покрытия автоматизации\n\nСгенерирован \`npm run coverage\`. Включает все карточки семи библиотек и вложенные особенности NPC.\n\nЭто консервативный статический реестр, не сертификат живой проверки: регистрация функции доказывает её наличие, но не полноту правила. «Требует исправления» также означает отсутствие подтверждённой связи с runtime: сначала проверять конкретную способность, не создавать пустой эффект. «Частично» включает намеренно сохраняемые решения игрока/GM. Нативные поля проверены валидатором; ссылки на тесты указывают проверяемый механизм, не обещают отдельный игровой сценарий каждой карточки.\n\n${Object.entries(summary).map(([key, count]) => `- ${labels[key]}: ${count}`).join("\n")}\n\nПолные основания и замечания: [AUTOMATION_COVERAGE.json](AUTOMATION_COVERAGE.json).\n\n| Библиотека / карточка | Статус | Обработчики | Проверки |\n| --- | --- | --- | --- |\n${records.map(record => `| ${esc(record.pack)} / ${esc(record.name)} | ${labels[record.status]} | ${esc(record.entries.join(", ") || "—")} | ${esc(record.checks.join(", ") || "нужна отдельная проверка")} |`).join("\n")}\n`;
await writeFile(path.join(root, "docs/AUTOMATION_COVERAGE.md"), markdown);
console.log("Automation coverage inventory:", summary, "total:", records.length);
}
