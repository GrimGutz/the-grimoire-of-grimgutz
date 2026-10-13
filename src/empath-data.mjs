import {readFileSync} from "node:fs";
import {uuidFor} from "./common.mjs";
import {EMPATH_FEATURES} from "../scripts/automation/shared/empath-definitions.mjs";
export const EMPATH_SOURCE="Престиж-класс Эмпат; предоставленный ManyFaced.md";
const source=readFileSync(new URL("./content/empath.md",import.meta.url),"utf8").replaceAll("\r","");
const clean=text=>text.replace(/^\\(?:page|column).*$/gm,"").replace(/\{\{[^}]*\}\}/g,"").trim();
export const empathIntroduction=clean(source.slice(source.indexOf("\n")+1,source.indexOf("## Требования")));
export const empathSpellRule=clean(source.split("## Заклинания")[1].split("### Волна чувств")[1]);
export function empathSection(title,depth=3){const marker=`${"#".repeat(depth)} ${title}\n`,start=source.indexOf(marker);if(start<0)throw Error(`Missing Empath rule: ${title}`);
  const rest=source.slice(start+marker.length),end=rest.search(new RegExp(`^#{1,${depth}} `,"m"));return clean(end<0?rest:rest.slice(0,end));}
export function empathHtml(text){const inline=text=>text.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\*(.+?)\*/g,"<em>$1</em>");
  return clean(text).split(/\n\s*\n/).filter(Boolean).map(block=>block.startsWith("| ")?`<table>${block.split("\n").filter(row=>!row.includes(":--")).map((row,i)=>`<tr>${row.split("|").slice(1,-1).map(cell=>`<${i?"td":"th"}>${inline(cell.trim())}</${i?"td":"th"}>`).join("")}</tr>`).join("")}</table>`
    :block.startsWith("- ")?`<ul>${block.split("\n").map(row=>`<li>${inline(row.replace(/^- /,""))}</li>`).join("")}</ul>`
    :/^#### /.test(block)?block.split(/\n/).map((line,i)=>i?`<p>${inline(line)}</p>`:`<h3>${inline(line.slice(5))}</h3>`).join(""):`<p>${inline(block).replaceAll("\n","<br>")}</p>`).join("\n");}
export function empathLinks(html,self=null){const entries=EMPATH_FEATURES.filter(entry=>entry.key!==self),map=new Map(entries.map(entry=>[entry.name,entry]));
  const pattern=new RegExp(entries.map(entry=>entry.name).sort((a,b)=>b.length-a.length).join("|"),"g");return html.split(/(@UUID\[[^\]]+\]\{[^}]*\}|<[^>]*>)/g).map(part=>part.startsWith("<")||part.startsWith("@UUID[")?part:part.replace(pattern,name=>`@UUID[${uuidFor("features",map.get(name).key)}]{${name}}`)).join("");}
