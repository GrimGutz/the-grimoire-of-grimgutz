import {MODULE_ID,baseDocument,hitPointsAdvancement,itemGrant,sourceData,uuidFor} from "../common.mjs";
import {EMPATH_FEATURES,EMPATH_ICON} from "../../scripts/automation/shared/empath-definitions.mjs";
import {EMPATH_SOURCE,empathIntroduction,empathSection,empathHtml,empathLinks} from "../empath-data.mjs";
export const empathClassDocuments=[baseDocument({key:"empath-class",name:"Эмпат / Empath",type:"class",img:EMPATH_ICON,flags:{[MODULE_ID]:{prestigeClass:"empath"}},
  system:{identifier:"empath",levels:1,hitDice:"d8",hitDiceUsed:0,wealth:"",spellcasting:{progression:"none",ability:"",preparation:{}},source:sourceData("ManyFaced.md",EMPATH_SOURCE),
    description:{chat:"",value:empathLinks(`<h1>Престиж-класс: Эмпат</h1>${empathHtml(empathIntroduction)}<h2>Требования</h2>${empathHtml(empathSection("Требования",2).split("<div")[0])}
      <p>Кость хитов к8; хиты за уровень: 1к8 (или 5) + модификатор Телосложения. Новых владений и развития ячеек нет.</p>
      <table><tr><th>Уровень</th><th>Особенности</th></tr>${[1,2,3,4,5].map(level=>`<tr><td>${level}</td><td>${EMPATH_FEATURES.filter(entry=>entry.level===level).map(entry=>`@UUID[${uuidFor("features",entry.key)}]{${entry.name}}`).join(", ")}</td></tr>`).join("")}</table>
      <h2>Термины</h2>${empathHtml(empathSection("Термины класса"))}<p>Заклинание: @UUID[${uuidFor("spells","empath-wave-spell")}]{Волна чувств}.</p>
      <p><strong>Автоматизация Foundry:</strong> девять особенностей и заклинание выдаются по уровням. Маски используют общий запас смен вне боя; каждая другая способность имеет свой запас. Вариант, СЛ и бонусы фиксируются при применении. Начальная маска — Спокойствие. Видимость, слышимость, события смены и ручное перемещение подтверждаются GM. Строгие требования по умолчанию выключены; подробности в карточках.</p>`)},
    advancement:[hitPointsAdvancement("empath-hp"),...[1,2,3,4,5].map(level=>itemGrant({key:`empath-features-${level}`,level,items:EMPATH_FEATURES.filter(entry=>entry.level===level).map(entry=>entry.key)})),
      itemGrant({key:"empath-wave-spell",level:3,pack:"spells",items:["empath-wave-spell"],title:"Всегда подготовленное заклинание"})]}})];
