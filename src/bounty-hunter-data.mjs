import { readFileSync } from "node:fs";
import { uuidFor } from "./common.mjs";
import { HUNTER_CORE, HUNTER_TROPHIES } from "../scripts/automation/shared/bounty-hunter-definitions.mjs";
export const HUNTER_SOURCE = "Престиж-класс Охотник за головами; предоставленный BountyHunter.md";
const source = readFileSync(new URL("./content/bounty-hunter.md", import.meta.url), "utf8").replace(/\r/g, "");
const clean = text =>
  text
    .replace(/^\\(?:page|column).*$/gm, "")
    .replace(/\{\{[^}]*\}\}/g, "")
    .trim();
export function hunterSection(title, depth = 3) {
  const marker = `${"#".repeat(depth)} ${title}\n`,
    start = source.indexOf(marker);
  if (start < 0) throw Error(`Missing Bounty Hunter rule: ${title}`);
  const rest = source.slice(start + marker.length),
    end = rest.search(new RegExp(`^#{1,${depth}} `, "m"));
  return clean(end < 0 ? rest : rest.slice(0, end));
}
export function hunterTrophyRule(entry) {
  const text = hunterSection(entry.title),
    marker = `**${entry.name.split(" трофей")[0]} трофей (`;
  const start = text.indexOf(marker);
  if (start < 0) throw Error(`Missing trophy tier: ${entry.key}`);
  const rest = text.slice(start),
    end = rest.indexOf("\n\n**", 2);
  const preface = text.slice(0, text.indexOf("**Малый трофей"));
  return clean(`${preface}\n${end < 0 ? rest : rest.slice(0, end)}`);
}
export function hunterHtml(text) {
  const escape = value => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return clean(text)
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map(block => {
      let value = escape(block).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      if (/^#{1,6} /.test(block)) return `<h3>${value.replace(/^#{1,6} /, "")}</h3>`;
      if (/^- /.test(block))
        return `<ul>${value
          .split("\n")
          .map(line => `<li>${line.replace(/^- /, "")}</li>`)
          .join("")}</ul>`;
      return `<p>${value.replaceAll("\n", "<br>")}</p>`;
    })
    .join("\n");
}
export function hunterLinks(html, self = null) {
  const entries = [...HUNTER_TROPHIES, ...HUNTER_CORE]
    .filter(e => e.key !== self)
    .sort((a, b) => b.name.length - a.name.length);
  const names = new Map(entries.map(entry => [entry.name, entry]));
  const pattern = new RegExp(entries.map(e => e.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
  return html
    .split(/(@UUID\[[^\]]+\]\{[^}]*\}|<[^>]*>)/g)
    .map(part =>
      part.startsWith("<") || part.startsWith("@UUID[")
        ? part
        : part.replace(pattern, name => `@UUID[${uuidFor("features", names.get(name).key)}]{${name}}`)
    )
    .join("");
}
