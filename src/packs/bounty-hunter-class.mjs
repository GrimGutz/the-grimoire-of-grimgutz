import {MODULE_ID, baseDocument, hitPointsAdvancement, itemGrant, scaleValueAdvancement, sourceData, uuidFor} from "../common.mjs";
import {HUNTER_ID, HUNTER_ICON, HUNTER_CORE, HUNTER_TROPHIES, hunterDie, hunterMaximum} from "../../scripts/automation/shared/bounty-hunter-definitions.mjs";
import {HUNTER_SOURCE, hunterSection, hunterHtml} from "../bounty-hunter-data.mjs";
const link = entry => `@UUID[${uuidFor("features",entry.key)}]{${entry.name}}`;
export const bountyHunterClassDocuments = [baseDocument({key:"bounty-hunter-class",name:"Охотник за головами / Bounty Hunter",type:"class",img:HUNTER_ICON,
  flags:{[MODULE_ID]:{prestigeClass:HUNTER_ID}},system:{identifier:HUNTER_ID,levels:1,hitDice:"d10",hitDiceUsed:0,
    source:sourceData("BountyHunter.md",HUNTER_SOURCE),description:{chat:"",value:`<h1>Престиж-класс: Охотник за головами</h1>
      <p>Изучайте добычу и используйте силу трофеев поверженных существ.</p><h2>Требования</h2>${hunterHtml(hunterSection("Требования",2).split("<div")[0])}
      <p>Кость хитов: к10; хиты за уровень: 1к10 (или 6) + модификатор Телосложения. Новых владений и стартового снаряжения нет. Строгая проверка требований выключена по умолчанию и включается настройкой мира.</p>
      <table><thead><tr><th>Уровень</th><th>Кость разбора</th><th>Запас трофеев</th><th>Особенности</th></tr></thead><tbody>${[1,2,3,4,5].map(level=>`<tr><td>${level}</td><td>к${hunterDie(level)}</td><td>${hunterMaximum(level)}</td><td>${HUNTER_CORE.filter(e=>e.level===level).map(link).join(", ")}</td></tr>`).join("")}</tbody></table>
      <h2>Термины</h2>${hunterHtml(hunterSection("Термины класса"))}
      <h2>Трофеи</h2><p>${HUNTER_TROPHIES.map(link).join(", ")}</p>
      <p>В исходной таблице «Разбор добычи», «Условные удары» и «Конец охоты» соответствуют подробным разделам «Разбор», «Комбинация» и «Разжигание охоты». В карточках использованы названия подробных правил; механики не заменены догадками.</p>
      <p><strong>Автоматизация Foundry:</strong> Advancement выдаёт особенности на уровнях 1–5. Настройте неизменяемую Характеристику охоты на карточке Добычи трофеев. Перетащите добытые трофеи из библиотеки, подтвердите их источник и наличие, затем выберите по одному доступному трофею каждой категории. Трофеи не выдаются бесплатно при повышении уровня. Пассивные уменьшают общий максимум, увеличение максимума не восстанавливает ресурс. Смена выбранных трофеев доступна после отдыха. Физический след, изготовление, сюжетные условия и неоднозначные действия подтверждает GM.</p>`},
    advancement:[hitPointsAdvancement("hunter-hit-points"),
      scaleValueAdvancement({key:"hunter-breakdown-die",identifier:"breakdown-die",title:"Кость разбора",type:"dice",scale:{1:{number:1,faces:6},3:{number:1,faces:8},5:{number:1,faces:10}}}),
      scaleValueAdvancement({key:"hunter-trophy-uses",identifier:"trophy-uses",title:"Базовый запас трофеев",scale:Object.fromEntries([1,2,3,4,5].map(level=>[level,{value:hunterMaximum(level)}]))}),
      ...[1,2,3,4,5].map(level=>itemGrant({key:`hunter-features-${level}`,level,items:HUNTER_CORE.filter(e=>e.level===level).map(e=>e.key)}))],
    spellcasting:{progression:"none",ability:"",preparation:{}},wealth:""}})];
