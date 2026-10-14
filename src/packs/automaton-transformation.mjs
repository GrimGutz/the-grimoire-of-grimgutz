import {feature,itemGrant,itemChoice,utilityActivity,uuidFor} from "../common.mjs";
import {AUTOMATON_FEATURES,AUTOMATON_ICON} from "../../scripts/automation/shared/automaton-definitions.mjs";
import {AUTOMATON_SOURCE,automatonText,automatonHtml} from "../automaton-data.mjs";
export const automatonTransformationDocuments = [feature({
  key:"automaton-transformation", name:"Трансформация: Автоматон", img:AUTOMATON_ICON,
  requirements:"Сила 13", sourcePage:"27–30", sourceCustom:AUTOMATON_SOURCE,
  automation:{feature:"automaton-transformation",transformation:"automaton"},
  activities:utilityActivity({key:"automaton-status",name:"Модель, уровень и состояние",action:"automaton-control",actionData:{automatonOperation:"status"},spellSlot:false}),
  advancement:[...[1,2,3,4].map(tier=>itemGrant({key:`automaton-grant-${tier}`,level:[1,6,11,16][tier-1],title:`Автоматон ${tier}: ${tier===1?"все базовые бонусы и недостаток":"обязательный недостаток"}`,items:AUTOMATON_FEATURES.filter(e=>e.level===tier&&(tier===1||e.flaw)).map(e=>e.key)})),
    ...[2,3,4].map(tier=>itemChoice({key:`automaton-choice-${tier}`,level:[0,0,6,11,16][tier],allowDrops:false,count:1,title:`Автоматон ${tier}: один бонус`,hint:"Один ещё не полученный бонус текущего или предыдущих уровней. Дополнительные бонусы PDF включены в этот же выбор.",items:AUTOMATON_FEATURES.filter(e=>!e.flaw&&e.level>=2&&e.level<=tier).map(e=>e.key)}))],
  description:`<h1>Автоматон</h1>${automatonHtml(automatonText.introduction)}<h2>Становление, требования и вехи</h2>${automatonHtml(automatonText.requirements)}
    <table><tr><th>Уровень персонажа</th><th>Ступень</th><th>Выдача</th></tr>${[1,2,3,4].map(t=>`<tr><td>${["1–5","6–10","11–15","16–20"][t-1]}</td><td>${t}</td><td>${t===1?"Модель, форма конструкта и недостаток":"Обязательный недостаток и один бонус текущей/предыдущих ступеней"}</td></tr>`).join("")}</table>
    <ul>${AUTOMATON_FEATURES.map(e=>`<li>@UUID[${uuidFor("features",e.key)}]{${e.name}} — ${e.level}${e.flaw?", недостаток":""}</li>`).join("")}</ul>
    <p><strong>Автоматизация Foundry:</strong> перетащите основную карточку на персонажа, затем выберите модель в выданной особенности. Прокачка открывается штатным Advancement на уровнях 1/6/11/16. Пассивы, подтверждённые реакции и Midi-урон автоматизированы; антимагия и необратимые последствия подтверждаются GM. Правило восстановления Силы и уверенности стали: продолжительный отдых.</p>`
})];
