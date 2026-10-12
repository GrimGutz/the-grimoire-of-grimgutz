import {readFileSync} from "node:fs";
import {uuidFor} from "./common.mjs";
import {DOOMED_FEATURES,DOOMED_CURSES} from "../scripts/automation/shared/doomed-definitions.mjs";
export const DOOMED_SOURCE="Престиж-класс Обречённый; предоставленный Doomed.md";
const source=readFileSync(new URL("./content/doomed.md",import.meta.url),"utf8").replaceAll("\r","");
const clean=text=>text.replace(/^\\(?:page|column).*$/gm,"").replace(/\{\{[^}]*\}\}/g,"").trim();
export const doomedIntroduction=clean(source.slice(source.indexOf("\n")+1,source.indexOf("## Требования")));
export function doomedSection(title,depth=3){const marker=`${"#".repeat(depth)} ${title}\n`,start=source.indexOf(marker);if(start<0)throw Error(`Missing Doomed rule: ${title}`);
  const rest=source.slice(start+marker.length),end=rest.search(new RegExp(`^#{1,${depth}} `,"m"));return clean(end<0?rest:rest.slice(0,end));}
export function doomedHtml(text){const inline=value=>value.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\*(.+?)\*/g,"<em>$1</em>");
  return clean(text).split(/\n\s*\n/).filter(Boolean).map(block=>block.startsWith("- ")?`<ul>${block.split("\n").map(row=>`<li>${inline(row.replace(/^- /,""))}</li>`).join("")}</ul>`
    :block.startsWith("#### ")?`<h3>${inline(block.slice(5))}</h3>`:`<p>${inline(block).replaceAll("\n","<br>")}</p>`).join("\n");}
export function doomedLinks(html,self=null){const entries=[...DOOMED_FEATURES,...DOOMED_CURSES].filter(entry=>entry.key!==self),byName=new Map(entries.map(entry=>[entry.name,entry]));
  const pattern=new RegExp(entries.map(entry=>entry.name).sort((a,b)=>b.length-a.length).join("|"),"g");return html.split(/(@UUID\[[^\]]+\]\{[^}]*\}|<[^>]*>)/g)
    .map(part=>part.startsWith("<")||part.startsWith("@UUID[")?part:part.replace(pattern,name=>`@UUID[${uuidFor("features",byName.get(name).key)}]{${name}}`)).join("");}
