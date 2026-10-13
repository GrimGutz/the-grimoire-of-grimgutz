import {readFileSync} from "node:fs";
import {ARKANE_FEATURES} from "../scripts/automation/shared/arkane-definitions.mjs";
import {uuidFor} from "./common.mjs";
export const ARKANE_SOURCE="Трансформация Присутствие; предоставленный Transformation_Arkane.pdf, с.72–75";
const text=readFileSync(new URL("./content/arkane.md",import.meta.url),"utf8").replaceAll("\r","");
const pages=new Map([...text.matchAll(/## Страница (\d+)\n([\s\S]*?)(?=\n## Страница|$)/g)].map(match=>[Number(match[1]),match[2].replace(/\s+\d+\s+ГЛАВА: 8 ГУМАНОИД\s*$/u,"").replace(/\s+/g," ").trim()]));
const boundary=/(?= (?:Бонус Трансформации|Недостаток Трансформации|Дополнительный Бонус Трансформации|Уровень трансформации))/;
export function arkaneDescription(entry){const heading=entry.flaw?"Недостаток Трансформации":entry.extra?"Дополнительный Бонус Трансформации":"Бонус Трансформации",title=entry.sourceName??entry.name,
  marker=`${heading} ${title} `,page=pages.get(entry.page),start=page.indexOf(marker);if(start<0)throw Error(`Missing Presence rule: ${entry.id}`);
  let body=page.slice(start+marker.length).split(boundary)[0];
  if(entry.id==="nullification")body+=" "+pages.get(74).split("Недостаток Трансформации")[0];
  return body.trim();}
export const arkaneIntroduction=pages.get(72).split("Становление Присутствием")[0].replace(/^Трансформация Присутствие Присутствие /u,"");
export const arkaneRequirements=pages.get(72).split("Становление Присутствием")[1].split("Уровень трансформации 1")[0];
export const arkaneHtml=text=>`<p>${String(text).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")}</p>`;
export function arkaneLinks(html,self=null){const entries=ARKANE_FEATURES.filter(entry=>entry.key!==self&&!entry.sourceName),map=new Map(entries.map(entry=>[entry.name,entry.key]));if(self==="arkane-bestowal")map.set("Аннулирование","arkane-nullification");
  const pattern=new RegExp([...map.keys()].sort((a,b)=>b.length-a.length).join("|"),"g");
  return html.split(/(@UUID\[[^\]]+\]\{[^}]*\}|<[^>]*>)/g).map(part=>part.startsWith("<")||part.startsWith("@UUID[")?part:part.replace(pattern,name=>`@UUID[${uuidFor("features",map.get(name))}]{${name}}`)).join("");}
