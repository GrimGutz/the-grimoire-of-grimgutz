import { readFileSync } from "node:fs";
import { uuidFor } from "./common.mjs";
import { JESTER_FEATURES } from "../scripts/automation/shared/jester-definitions.mjs";
export const JESTER_SOURCE = "Престиж-класс Арлекин; предоставленный Jester.md";
const source = readFileSync(new URL("./content/jester.md", import.meta.url), "utf8").replaceAll("\r", "");
const clean = value =>
  value
    .replace(/^\\(?:page|column).*$/gm, "")
    .replace(/\{\{[^}]*\}\}/g, "")
    .trim();
export const jesterIntroduction = clean(source.slice(source.indexOf("\n") + 1, source.indexOf("## Требования")));
export function jesterSection(title, depth = 3) {
  const marker = `${"#".repeat(depth)} ${title}\n`,
    start = source.indexOf(marker);
  if (start < 0) throw Error(`Missing Jester rule: ${title}`);
  const rest = source.slice(start + marker.length),
    end = rest.search(new RegExp(`^#{1,${depth}} `, "m"));
  return clean(end < 0 ? rest : rest.slice(0, end));
}
export function jesterHtml(text) {
  const escape = value => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
    inline = value => escape(value).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  return clean(text)
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map(block => {
      if (block.startsWith("|")) {
        const rows = block.split("\n").filter(row => !/^\|[\s:|-]+\|$/.test(row));
        return `<table>${rows
          .map(
            (row, i) =>
              `<tr>${row
                .split("|")
                .slice(1, -1)
                .map(cell => `<${i ? "td" : "th"}>${inline(cell.trim())}</${i ? "td" : "th"}>`)
                .join("")}</tr>`
          )
          .join("")}</table>`;
      }
      if (block.startsWith("- "))
        return `<ul>${block
          .split("\n")
          .map(row => `<li>${inline(row.replace(/^- /, ""))}</li>`)
          .join("")}</ul>`;
      return `<p>${inline(block).replaceAll("\n", "<br>")}</p>`;
    })
    .join("\n");
}
export function jesterLinks(html, self = null) {
  const entries = JESTER_FEATURES.filter(e => e.key !== self),
    names = new Map(entries.map(e => [e.name, e]));
  const pattern = new RegExp(
    entries
      .map(e => e.name)
      .sort((a, b) => b.length - a.length)
      .join("|"),
    "g"
  );
  return html
    .split(/(@UUID\[[^\]]+\]\{[^}]*\}|<[^>]*>)/g)
    .map(part =>
      part.startsWith("<") || part.startsWith("@UUID[")
        ? part
        : part.replace(pattern, name => `@UUID[${uuidFor("features", names.get(name).key)}]{${name}}`)
    )
    .join("");
}
