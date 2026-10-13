import {MODULE_ID,baseDocument,sourceData,utilityActivity} from "../common.mjs";
import {EMPATH_ICON} from "../../scripts/automation/shared/empath-definitions.mjs";
import {EMPATH_SOURCE,empathSpellRule,empathHtml} from "../empath-data.mjs";
import {empathNotes} from "./empath-features.mjs";
export const empathSpellDocuments=[baseDocument({key:"empath-wave-spell",name:"Волна чувств (Эмпат)",type:"spell",img:EMPATH_ICON,flags:{[MODULE_ID]:{empathSpell:true,feature:"empath-wave-spell"}},
  system:{identifier:"empath-wave-spell",level:4,school:"enc",ability:"cha",source:sourceData("ManyFaced.md",EMPATH_SOURCE),properties:["vocal","somatic","concentration"],
    preparation:{mode:"always",prepared:true},uses:{max:"",spent:0,recovery:[]},materials:{value:"",consumed:false,cost:0,supply:0},
    activation:{type:"action",value:1,condition:""},range:{units:"self",value:null,special:"Сфера радиусом 30 футов"},duration:{value:"1",units:"minute"},
    target:{affects:{type:"creature",count:"",choice:false,special:"Все остальные существа"},template:{type:"sphere",size:"30",units:"ft",count:"1",contiguous:false,width:"",height:""}},
    activities:utilityActivity({key:"empath-wave-slot",name:"Наложить за ячейку 4+",action:"empath-control",activation:"special",actionData:{empathOperation:"wave-slot"}}),
    description:{chat:"",value:`<h2>Волна чувств</h2>${empathHtml(empathSpellRule)}<hr><p><strong>Автоматизация Foundry:</strong> ${empathNotes.wave} Гнев: сближение/выбор ближайшего и атака или Рывок вручную. Спокойствие снимается при подтверждённом уроне; вредящие активности блокируются. Радость накладывает ничком/недееспособность и повторяет спасбросок с преимуществом при подтверждённом уроне. Печаль: половинная скорость, помеха атакам, запрет реакций. Условия скрытой сцены попадают в очередь GM.</p>`}}})];
