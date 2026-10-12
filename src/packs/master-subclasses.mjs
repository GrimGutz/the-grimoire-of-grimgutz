import {MODULE_ID, baseDocument, itemGrant, sourceData, uuidFor} from "../common.mjs";
import {MASTER_PATHS, MASTER_SOURCE, masterSection, masterHtml} from "../master-data.mjs";
export const masterSubclassDocuments = MASTER_PATHS.map(path => baseDocument({key: `master-${path.id}`, name: path.name, type: "subclass", img: path.icon,
  flags: {[MODULE_ID]: {masterSubclass: path.id}}, system: {identifier: `master-${path.id}`, classIdentifier: "master", source: sourceData("Master.md", MASTER_SOURCE),
    description: {chat: "", value: `${masterHtml(masterSection(path.name, 4))}<p>Правила и настройка: @UUID[${uuidFor("features", `master-path-${path.id}`)}]{${path.name}}.</p><p><strong>Автоматизация Foundry:</strong> стандартный подкласс Мастера; выдаёт карточку пути на 1-м уровне. Смена пути после выбора запрещена без решения GM; другие классовые особенности выбранного заклинателя не выдаются.</p>`},
    advancement: [itemGrant({key: `master-${path.id}-features`, level: 1, items: [`master-path-${path.id}`]})], spellcasting: {progression: "none", ability: "", preparation: {}}}}));
