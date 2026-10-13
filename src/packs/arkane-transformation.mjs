import {feature,itemGrant,itemChoice,utilityActivity,uuidFor} from "../common.mjs";
import {ARKANE_FEATURES,ARKANE_ICON} from "../../scripts/automation/shared/arkane-definitions.mjs";
import {ARKANE_SOURCE,arkaneIntroduction,arkaneRequirements,arkaneHtml} from "../arkane-data.mjs";
export const arkaneTransformationDocuments=[feature({key:"arkane-transformation",name:"Трансформация: Присутствие / Arkane",img:ARKANE_ICON,requirements:"Интеллект 16; уровень персонажа 13; уничтожение собственной души",
  sourcePage:"72–75",sourceCustom:ARKANE_SOURCE,automation:{feature:"arkane-transformation",transformation:"arkane"},
  activities:utilityActivity({key:"arkane-dc",name:"Уровень, СЛ и состояние Присутствия",action:"arkane-control",actionData:{arkaneOperation:"status"},spellSlot:false}),
  advancement:[...[1,2,3,4].map(tier=>itemGrant({key:`arkane-grant-${tier}`,level:[1,6,11,16][tier-1],title:`Присутствие ${tier}: ${tier===1?"все базовые бонусы и недостаток":"обязательный недостаток"}`,
    items:ARKANE_FEATURES.filter(entry=>entry.level===tier&&(tier===1||entry.flaw)).map(entry=>entry.key)})),
    ...[2,3,4].map(tier=>itemChoice({key:`arkane-choice-${tier}`,level:[0,0,6,11,16][tier],allowDrops:false,count:1,title:`Присутствие ${tier}: один доступный бонус`,hint:"Выберите один ещё не полученный бонус текущего или предыдущих уровней. Требования «Настойчивость»/«Аннулирование» проверяются отдельно.",items:ARKANE_FEATURES.filter(entry=>!entry.flaw&&entry.level>=2&&entry.level<=tier).map(entry=>entry.key)}))],
  description:`<h1>Присутствие</h1>${arkaneHtml(arkaneIntroduction)}<h2>Становление и требования</h2>${arkaneHtml(arkaneRequirements)}
    <p><strong>Сл трансформации:</strong> 8 + БМ + уровень трансформации + модификатор Интеллекта.</p>
    <table><tr><th>Уровень персонажа</th><th>Трансформация</th><th>Выдача</th></tr>${[1,2,3,4].map(tier=>`<tr><td>${["1–5","6–10","11–15","16–20"][tier-1]}</td><td>${tier}</td><td>${tier===1?"Все базовые бонусы и недостаток":"Новый недостаток и один бонус текущего/предыдущих уровней"}</td></tr>`).join("")}</table>
    <p>По принятой схеме модуля ОС 1500/3000/6000 остаются сюжетными вехами, не заменяют уровни персонажа. При добавлении на 13-м уровне открываются I–III ступени с отдельными выборами.</p>
    <ul>${ARKANE_FEATURES.map(entry=>`<li>@UUID[${uuidFor("features",entry.key)}]{${entry.name}} (${entry.level})</li>`).join("")}</ul>
    <p><strong>Автоматизация Foundry:</strong> перетащите только основную карточку; остальные находятся в особенностях. Advancement выдаёт бонусы/недостатки и открывает выбор на уровнях 1/6/11/16. Числовые пассивы, отдельные ресурсы, круг Шторма и нативные броски реализуются обработчиками; необратимые и неоднозначные последствия подтверждает GM. Согласованное домашнее правило: Сифон, Шторм сил и Безграничная сила восстанавливаются после продолжительного отдыха. Сверхъестественное тело даёт и преимущество против заклинаний, и сопротивление их урону по решению владельца модуля.</p>`})];
