import {MODULE_ID,baseDocument,hitPointsAdvancement,itemGrant,scaleValueAdvancement,sourceData,uuidFor} from "../common.mjs";
import {JESTER_FEATURES,JESTER_ICON,jesterMaximum} from "../../scripts/automation/shared/jester-definitions.mjs";
import {JESTER_SOURCE,jesterIntroduction,jesterSection,jesterHtml,jesterLinks} from "../jester-data.mjs";
export const jesterClassDocuments=[baseDocument({key:"jester-class",name:"Арлекин / Jester",type:"class",img:JESTER_ICON,flags:{[MODULE_ID]:{prestigeClass:"jester"}},
  system:{identifier:"jester",levels:1,hitDice:"d8",hitDiceUsed:0,wealth:"",spellcasting:{progression:"none",ability:"",preparation:{}},source:sourceData("Jester.md",JESTER_SOURCE),
    description:{chat:"",value:jesterLinks(`<h1>Престиж-класс: Арлекин</h1>${jesterHtml(jesterIntroduction)}<h2>Требования</h2>${jesterHtml(jesterSection("Требования",2).split("<div")[0])}
      <p>Кость хитов: к8; хиты за уровень: 1к8 (или 5) + модификатор Телосложения. Новых владений и стартового снаряжения нет.</p>
      <table><tr><th>Уровень</th><th>Предел хаоса</th><th>Особенности</th></tr>${[1,2,3,4,5].map(level=>`<tr><td>${level}</td><td>${jesterMaximum(level)}</td><td>${JESTER_FEATURES.filter(e=>e.level===level).map(e=>`@UUID[${uuidFor("features",e.key)}]{${e.name}}`).join(", ")}</td></tr>`).join("")}</table>
      <h2>Термины</h2>${jesterHtml(jesterSection("Термины класса"))}<p><strong>Автоматизация Foundry:</strong> Advancement выдаёт все десять особенностей. На Очках хаоса выберите неизменяемую Ловкость или Харизму ≥16. Начальный запас — 0, предел 3/4/5/6/7; отдых не восполняет хаос. Отношения и полезность конкретного эффекта подтверждаются, а не выводятся из цвета токена. Правки к20 не создают постоянных бонусов. Строгая проверка требований выключена по умолчанию.</p>`)},
    advancement:[hitPointsAdvancement("jester-hp"),scaleValueAdvancement({key:"jester-chaos-limit",identifier:"chaos-limit",title:"Предел хаоса",scale:Object.fromEntries([1,2,3,4,5].map(level=>[level,{value:jesterMaximum(level)}]))}),
      ...[1,2,3,4,5].map(level=>itemGrant({key:`jester-features-${level}`,level,items:JESTER_FEATURES.filter(e=>e.level===level).map(e=>e.key)}))]}})];
