import {readFileSync} from "node:fs";
import {uuidFor} from "./common.mjs";
import {NIGHTMARE_FEATURES,NIGHTMARE_FEARS,NIGHTMARE_PROFILES} from "../scripts/automation/shared/nightmare-definitions.mjs";
export const NIGHTMARE_SOURCE="Престиж-класс Кошмар; предоставленный Nightmare.md";
const source=readFileSync(new URL("./content/nightmare.md",import.meta.url),"utf8").replaceAll("\r","");
const clean=text=>text.replace(/^\\(?:page|column).*$/gm,"").replace(/\{\{[^}]*\}\}/g,"").replace(/^\{\{.*$|^\}\}.*$/gm,"").trim();
export const nightmareIntroduction=clean(source.slice(source.indexOf("\n")+1,source.indexOf("## Требования")));
export function nightmareSection(title,depth=3){const marker=`${"#".repeat(depth)} ${title}\n`,start=source.indexOf(marker);if(start<0)throw Error(`Missing Nightmare rule: ${title}`);
  const rest=source.slice(start+marker.length),end=rest.search(new RegExp(`^#{1,${depth}} `,"m"));return clean(end<0?rest:rest.slice(0,end));}
export function nightmareHtml(text){const inline=value=>value.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\*(.+?)\*/g,"<em>$1</em>");
  return clean(text).split(/\n\s*\n/).filter(Boolean).map(block=>block.startsWith("| ")?`<table>${block.split("\n").filter(row=>!row.includes(":--")).map((row,i)=>`<tr>${row.split("|").slice(1,-1).map(cell=>`<${i?"td":"th"}>${inline(cell.trim())}</${i?"td":"th"}>`).join("")}</tr>`).join("")}</table>`
    :block.startsWith("- ")?`<ul>${block.split("\n").map(row=>`<li>${inline(row.replace(/^- /,""))}</li>`).join("")}</ul>`
    :block.startsWith("#### ")?`<h3>${inline(block.slice(5))}</h3>`:`<p>${inline(block).replaceAll("\n","<br>")}</p>`).join("\n");}
export function nightmareLinks(html,self=null){const entries=[...NIGHTMARE_FEATURES,...NIGHTMARE_FEARS,...NIGHTMARE_PROFILES].filter(entry=>entry.key!==self),map=new Map(entries.map(entry=>[entry.name,entry]));
  const pattern=new RegExp(entries.map(entry=>entry.name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).sort((a,b)=>b.length-a.length).join("|"),"g");return html.split(/(@UUID\[[^\]]+\]\{[^}]*\}|<[^>]*>)/g)
    .map(part=>part.startsWith("<")||part.startsWith("@UUID[")?part:part.replace(pattern,name=>`@UUID[${uuidFor("features",map.get(name).key)}]{${name}}`)).join("");}
