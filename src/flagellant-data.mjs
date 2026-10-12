import {readFileSync} from "node:fs";
import {uuidFor} from "./common.mjs";
import {FLAGELLANT_FEATURES} from "../scripts/automation/shared/flagellant-definitions.mjs";
export const FLAGELLANT_SOURCE="Престиж-класс Самобичеватель; предоставленный Flagellant.md";
const source=readFileSync(new URL("./content/flagellant.md",import.meta.url),"utf8").replaceAll("\r","");
const clean=value=>value.replace(/^\\(?:page|column).*$/gm,"").replace(/\{\{[^}]*\}\}/g,"").trim();
export const flagellantIntroduction=clean(source.slice(source.indexOf("\n")+1,source.indexOf("## Требования")));
export function flagellantSection(title,depth=3){const marker=`${"#".repeat(depth)} ${title}\n`,start=source.indexOf(marker);if(start<0)throw Error(`Missing Flagellant rule: ${title}`);
  const rest=source.slice(start+marker.length),end=rest.search(new RegExp(`^#{1,${depth}} `,"m"));return clean(end<0?rest:rest.slice(0,end));}
export function flagellantHtml(text){const inline=value=>value.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>");
  return clean(text).split(/\n\s*\n/).filter(Boolean).map(block=>block.startsWith("- ")?`<ul>${block.split("\n").map(row=>`<li>${inline(row.replace(/^- /,""))}</li>`).join("")}</ul>`
    :block.startsWith("#### ")?`<h3>${inline(block.slice(5))}</h3>`:`<p>${inline(block).replaceAll("\n","<br>")}</p>`).join("\n");}
export function flagellantLinks(html,self=null){const entries=[...FLAGELLANT_FEATURES,...["Вкус боли","Жажда боли","Упоение болью"].map(name=>({name,key:"flagellant-frenzy"}))].filter(e=>e.key!==self),names=new Map(entries.map(e=>[e.name,e]));
  const pattern=new RegExp(entries.map(e=>e.name).sort((a,b)=>b.length-a.length).join("|"),"g");return html.split(/(@UUID\[[^\]]+\]\{[^}]*\}|<[^>]*>)/g)
    .map(part=>part.startsWith("<")||part.startsWith("@UUID[")?part:part.replace(pattern,name=>`@UUID[${uuidFor("features",names.get(name).key)}]{${name}}`)).join("");}
