import { existsSync } from "node:fs";
import { access, cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ClassicLevel } from "classic-level";
import { getAutomationActionHandlers, getMidiHookHandlers } from "../scripts/automation/runtime.mjs";
import { MIDI_QOL_HOOKS } from "../scripts/automation/midi/hooks.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const foundryPublic = "C:\\Program Files\\Foundry Virtual Tabletop\\resources\\app\\public";
const manifest = JSON.parse(await readFile(path.join(root, "module.json"), "utf8"));
const errors = [];
const AUTOMATION_CONFIG_VERSION = 1;

async function readTextFilesRecursive(directory, extension = ".mjs") {
  const chunks = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      chunks.push(await readTextFilesRecursive(fullPath, extension));
    } else if (entry.isFile() && entry.name.endsWith(extension)) {
      chunks.push(await readFile(fullPath, "utf8"));
    }
  }
  return chunks.join("\n");
}

if (manifest.id !== "the-grimoire-of-grimgutz") {
  errors.push(`Unexpected module ID: ${manifest.id}`);
}

for (const relativePath of [...(manifest.esmodules ?? []), ...(manifest.styles ?? [])]) {
  try {
    await access(path.join(root, relativePath));
  } catch {
    errors.push(`Missing declared asset: ${relativePath}`);
  }
}

const documentCounts = {};
const allDocuments = new Map();
const embeddedIconDocuments = [];
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "grimgutz-validation-"));

try {
  for (const pack of manifest.packs) {
    const sourcePackPath = path.join(root, pack.path);
    const packPath = path.join(temporaryRoot, pack.name);
    await cp(sourcePackPath, packPath, {
      recursive: true
    });

    const db = new ClassicLevel(packPath, {
      valueEncoding: "json"
    });

    try {
      await db.open();
      let count = 0;
      const documentPrefix = pack.type === "Actor" ? "!actors!" : "!items!";
      for await (const [key, value] of db.iterator()) {
        if (key.startsWith("!actors.items!")) {
          embeddedIconDocuments.push({
            pack: pack.name,
            document: value
          });
          continue;
        }
        if (!key.startsWith(documentPrefix)) continue;
        count += 1;
        allDocuments.set(value._id, {
          pack: pack.name,
          document: value
        });
      }
      documentCounts[pack.name] = count;
    } catch (error) {
      errors.push(`Cannot read pack ${pack.name}: ${error.message}`);
    } finally {
      await db.close().catch(() => {});
    }
  }
} finally {
  await rm(temporaryRoot, {
    recursive: true,
    force: true
  });
}

if (documentCounts.classes !== 29) errors.push(`Expected 29 prestige classes, got ${documentCounts.classes ?? 0}`);
if (documentCounts.subclasses !== 14) errors.push(`Expected 14 subclasses, got ${documentCounts.subclasses ?? 0}`);
if (documentCounts.features !== 421) errors.push(`Expected 421 features, got ${documentCounts.features ?? 0}`);
if (documentCounts.transformations !== 2) errors.push(`Expected 2 transformations, got ${documentCounts.transformations ?? 0}`);
if (documentCounts.spells !== 20) errors.push(`Expected 20 spells, got ${documentCounts.spells ?? 0}`);
if (documentCounts.equipment !== 8) errors.push(`Expected 8 weapons, got ${documentCounts.equipment ?? 0}`);
if (documentCounts.bestiary !== 30) errors.push(`Expected 30 bestiary actors, got ${documentCounts.bestiary ?? 0}`);

function decodedIconPath(iconPath) {
  try {
    return decodeURIComponent(iconPath);
  } catch {
    return iconPath;
  }
}

function iconExists(iconPath) {
  if (!iconPath || typeof iconPath !== "string") return true;
  if (iconPath.startsWith("modules/")) {
    const modulePrefix = `modules/${manifest.id}/`;
    if (!iconPath.startsWith(modulePrefix)) return true;
    return existsSync(path.join(root, decodedIconPath(iconPath.slice(modulePrefix.length))));
  }
  if (iconPath.startsWith("assets/")) {
    return existsSync(path.join(root, decodedIconPath(iconPath)));
  }
  if (iconPath.startsWith("icons/")) {
    if (!existsSync(foundryPublic)) return true;
    return existsSync(path.join(foundryPublic, decodedIconPath(iconPath)));
  }
  return true;
}

for (const { pack, document } of allDocuments.values()) {
  if (!iconExists(document.img)) errors.push(`Missing icon for ${pack}/${document.name}: ${document.img}`);
  for (const effect of document.effects ?? []) {
    if (!iconExists(effect.img)) errors.push(`Missing effect icon for ${pack}/${document.name}/${effect.name}: ${effect.img}`);
  }
}
for (const { pack, document } of embeddedIconDocuments) {
  if (!iconExists(document.img)) errors.push(`Missing embedded icon for ${pack}/${document.name}: ${document.img}`);
  for (const effect of document.effects ?? []) {
    if (!iconExists(effect.img)) errors.push(`Missing embedded effect icon for ${pack}/${document.name}/${effect.name}: ${effect.img}`);
  }
}

function validateAutomationSchema(label, flags) {
  const moduleFlags = flags?.[manifest.id];
  if (!moduleFlags) return;
  if (moduleFlags.schemaVersion !== AUTOMATION_CONFIG_VERSION) {
    errors.push(`${label}: automation schemaVersion must be ${AUTOMATION_CONFIG_VERSION}`);
  }
  const config = moduleFlags.automation;
  if (!config || typeof config !== "object") {
    errors.push(`${label}: nested automation config is missing`);
    return;
  }
  if (config.version !== AUTOMATION_CONFIG_VERSION) {
    errors.push(`${label}: automation.version must be ${AUTOMATION_CONFIG_VERSION}`);
  }
  if (!config.kind) errors.push(`${label}: automation.kind is missing`);
  if (!config.id && !config.action?.id) errors.push(`${label}: automation.id or automation.action.id is missing`);
  const legacyAction = moduleFlags.action ?? moduleFlags.moduleAction;
  if (legacyAction && config.action?.id !== legacyAction) {
    errors.push(`${label}: automation.action.id does not match legacy action ${legacyAction}`);
  }
}

for (const { pack, document } of allDocuments.values()) {
  validateAutomationSchema(`${pack}/${document.name}`, document.flags);
  for (const activity of Object.values(document.system?.activities ?? {})) {
    validateAutomationSchema(`${pack}/${document.name}/activity:${activity.name ?? activity._id}`, activity.flags);
  }
  for (const effect of document.effects ?? []) {
    validateAutomationSchema(`${pack}/${document.name}/effect:${effect.name}`, effect.flags);
  }
}

const recommendedModules = new Set(manifest.relationships?.recommends?.map(relationship => relationship.id));
for (const moduleId of ["midi-qol", "dae", "itemacro"]) {
  if (!recommendedModules.has(moduleId)) errors.push(`Missing recommended module relationship: ${moduleId}`);
}

function findPackFolder(folders, names) {
  const [name, ...rest] = names;
  const folder = (folders ?? []).find(candidate => candidate.name === name);
  if (!folder || !rest.length) return folder;
  return findPackFolder(folder.folders, rest);
}

const packFolderExpectations = [
  { path: ["Гримуар Гатца", "Игроку", "Престиж-классы"], packs: ["classes"] },
  { path: ["Гримуар Гатца", "Игроку", "Подклассы"], packs: ["subclasses"] },
  { path: ["Гримуар Гатца", "Игроку", "Трансформации"], packs: ["transformations"] },
  { path: ["Гримуар Гатца", "Игроку", "Оружие"], packs: ["equipment"] },
  { path: ["Гримуар Гатца", "Игроку", "Заклинания"], packs: ["spells"] },
  { path: ["Гримуар Гатца", "Мастеру", "Монстры"], packs: ["bestiary"] },
  { path: ["Гримуар Гатца", "Мастеру", "Способности"], packs: ["features"] }
];

for (const expectation of packFolderExpectations) {
  const folder = findPackFolder(manifest.packFolders, expectation.path);
  if (!folder) {
    errors.push(`Pack folder is missing: ${expectation.path.join(" -> ")}`);
    continue;
  }
  for (const packName of expectation.packs) {
    if (!(folder.packs ?? []).includes(packName)) {
      errors.push(`Pack folder ${expectation.path.join(" -> ")} is missing pack: ${packName}`);
    }
  }
}

const classDocuments = [...allDocuments.values()]
  .filter(entry => entry.document.type === "class")
  .map(entry => entry.document);
const subclassDocuments = [...allDocuments.values()]
  .filter(entry => entry.document.type === "subclass")
  .map(entry => entry.document);
for (const document of classDocuments) {
  const icon = String(document.img ?? "");
  const decoded = decodedIconPath(icon);
  if (decoded.includes("assets/character arts") || decoded.includes("assets/character%20arts")) {
    errors.push(`Class ${document.system?.identifier ?? document.name} must use an icon, not character art: ${icon}`);
  }
}
const classesByIdentifier = new Map(
  classDocuments.map(document => [document.system.identifier, document])
);
const crusherClass = classesByIdentifier.get("crusher");
const leaderClass = classesByIdentifier.get("leader");
const deathKnightClass = classesByIdentifier.get("death-knight");
const hereticClass = classesByIdentifier.get("heretic");
const forestLordClass = classesByIdentifier.get("forest-lord");
const aberrantClass = classesByIdentifier.get("aberrant");
const witchBladeClass = classesByIdentifier.get("witch-blade");
const juggernautClass = classesByIdentifier.get("juggernaut");
const soulEaterClass = classesByIdentifier.get("soul-eater");
const guardianClass = classesByIdentifier.get("guardian");
const crusaderClass = classesByIdentifier.get("crusader");
const feyWarriorClass = classesByIdentifier.get("fey-warrior");
const ghostWalkerClass = classesByIdentifier.get("ghost-walker");
const blinkerClass = classesByIdentifier.get("blinker");
const fallenPriestClass = classesByIdentifier.get("fallen-priest");
const plagueDoctorClass = classesByIdentifier.get("plague-doctor");
const insectLordClass = classesByIdentifier.get("insect-lord");
const gamblerClass = classesByIdentifier.get("gambler");
const keeperClass = classesByIdentifier.get("keeper");
const bloodMageClass = classesByIdentifier.get("blood-mage");
const onmyojiClass = classesByIdentifier.get("onmyoji");
const ritualistClass = classesByIdentifier.get("ritualist");
const darkWarriorClass = classesByIdentifier.get("dark-warrior");
const devilWorshipperClass = classesByIdentifier.get("devil-worshipper");
const nethereseArcanistClass = classesByIdentifier.get("netherese-arcanist");
const spiritVesselClass = classesByIdentifier.get("spirit-vessel");
const oracleClass = classesByIdentifier.get("oracle");
const demonologistClass = classesByIdentifier.get("demonologist");
const sanguinistClass = classesByIdentifier.get("sanguinist");
const subclassesByIdentifier = new Map(
  subclassDocuments.map(document => [document.system.identifier, document])
);
const schoolOfSteelSubclass = subclassDocuments.find(document => document.system.identifier === "school-of-steel");
if (!crusherClass) {
  errors.push("Crusher class document is missing");
} else {
  if (crusherClass.system.hitDice !== "d12") errors.push("Crusher class must use d12 hit dice");
  if (!crusherClass.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push("Crusher class description must document prerequisite automation");
  }
}
if (!leaderClass) {
  errors.push("Leader class document is missing");
} else {
  if (leaderClass.system.hitDice !== "d8") errors.push("Leader class must use d8 hit dice");
  if (!leaderClass.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push("Leader class description must document prerequisite automation");
  }
  if (leaderClass.flags?.[manifest.id]?.prestigeClass !== "leader") {
    errors.push("Leader class automation flag is missing");
  }
}
if (!deathKnightClass) {
  errors.push("Death Knight class document is missing");
} else {
  if (deathKnightClass.system.hitDice !== "d10") errors.push("Death Knight class must use d10 hit dice");
  if (deathKnightClass.system.spellcasting?.progression !== "none") {
    errors.push("Death Knight spellcasting must be merged into Paladin progression by automation");
  }
  if (!deathKnightClass.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push("Death Knight class description must document prerequisite automation");
  }
  if (deathKnightClass.flags?.[manifest.id]?.prestigeClass !== "death-knight") {
    errors.push("Death Knight class automation flag is missing");
  }
}
if (!hereticClass) {
  errors.push("Heretic class document is missing");
} else {
  if (hereticClass.system.hitDice !== "d8") errors.push("Heretic class must use d8 hit dice");
  if (hereticClass.system.spellcasting?.progression !== "none") {
    errors.push("Heretic must not provide normal spell slot progression");
  }
  if (!hereticClass.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push("Heretic class description must document prerequisite automation");
  }
  if (hereticClass.flags?.[manifest.id]?.prestigeClass !== "heretic") {
    errors.push("Heretic class automation flag is missing");
  }
  const occultScale = hereticClass.system.advancement.find(
    advancement => advancement.configuration?.identifier === "occult-points"
  );
  if (!occultScale) errors.push("Heretic occult point scale is missing");
}
if (!forestLordClass) {
  errors.push("Forest Lord class document is missing");
} else {
  if (forestLordClass.system.hitDice !== "d8") errors.push("Forest Lord class must use d8 hit dice");
  if (forestLordClass.system.spellcasting?.progression !== "none") {
    errors.push("Forest Lord progression must be merged into its base class by automation");
  }
  if (!forestLordClass.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push("Forest Lord class description must document prerequisite automation");
  }
  if (forestLordClass.flags?.[manifest.id]?.prestigeClass !== "forest-lord") {
    errors.push("Forest Lord class automation flag is missing");
  }
}
if (!aberrantClass) {
  errors.push("Aberrant class document is missing");
} else {
  if (aberrantClass.system.hitDice !== "d10") errors.push("Aberrant class must use d10 hit dice");
  if (!aberrantClass.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push("Aberrant class description must document prerequisite automation");
  }
  if (aberrantClass.flags?.[manifest.id]?.prestigeClass !== "aberrant") {
    errors.push("Aberrant class automation flag is missing");
  }
}
if (!witchBladeClass) {
  errors.push("Witch Blade class document is missing");
} else {
  if (witchBladeClass.system.hitDice !== "d10") errors.push("Witch Blade class must use d10 hit dice");
  if (witchBladeClass.system.spellcasting?.progression !== "none") {
    errors.push("Witch Blade custom spell slot table must be stored as scale values, not normal dnd5e progression");
  }
  if (!witchBladeClass.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push("Witch Blade class description must document prerequisite automation");
  }
  if (witchBladeClass.flags?.[manifest.id]?.prestigeClass !== "witch-blade") {
    errors.push("Witch Blade class automation flag is missing");
  }
  for (const identifier of ["rage-points", "known-spells", "spell-slots-1", "spell-slots-5"]) {
    if (!witchBladeClass.system.advancement.some(advancement => advancement.configuration?.identifier === identifier)) {
      errors.push(`Witch Blade scale is missing: ${identifier}`);
    }
  }
}
if (!juggernautClass) {
  errors.push("Juggernaut class document is missing");
} else {
  if (juggernautClass.system.hitDice !== "d12") errors.push("Juggernaut class must use d12 hit dice");
  if (juggernautClass.system.spellcasting?.progression !== "none") {
    errors.push("Juggernaut must not provide spell slot progression");
  }
  if (!juggernautClass.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push("Juggernaut class description must document prerequisite automation");
  }
  if (juggernautClass.flags?.[manifest.id]?.prestigeClass !== "juggernaut") {
    errors.push("Juggernaut class automation flag is missing");
  }
  const regenerationScale = juggernautClass.system.advancement.find(
    advancement => advancement.configuration?.identifier === "regeneration-bonus"
  );
  if (!regenerationScale) errors.push("Juggernaut regeneration bonus scale is missing");
}
if (!soulEaterClass) {
  errors.push("Soul Eater class document is missing");
} else {
  if (soulEaterClass.system.hitDice !== "d8") errors.push("Soul Eater class must use d8 hit dice");
  if (soulEaterClass.system.spellcasting?.progression !== "none") {
    errors.push("Soul Eater must not provide spell slot progression");
  }
  if (!soulEaterClass.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push("Soul Eater class description must document prerequisite automation");
  }
  if (soulEaterClass.flags?.[manifest.id]?.prestigeClass !== "soul-eater") {
    errors.push("Soul Eater class automation flag is missing");
  }
  const soulRendScale = soulEaterClass.system.advancement.find(
    advancement => advancement.configuration?.identifier === "soul-rend"
  );
  if (!soulRendScale) errors.push("Soul Eater soul rend scale is missing");
}
if (!guardianClass) {
  errors.push("Guardian class document is missing");
} else {
  if (guardianClass.system.hitDice !== "d10") errors.push("Guardian class must use d10 hit dice");
  if (guardianClass.system.spellcasting?.progression !== "none") {
    errors.push("Guardian must not provide spell slot progression");
  }
  if (!guardianClass.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push("Guardian class description must document prerequisite automation");
  }
  if (guardianClass.flags?.[manifest.id]?.prestigeClass !== "guardian") {
    errors.push("Guardian class automation flag is missing");
  }
  for (const identifier of ["mark-attacks", "marks"]) {
    if (!guardianClass.system.advancement.some(advancement => advancement.configuration?.identifier === identifier)) {
      errors.push(`Guardian scale is missing: ${identifier}`);
    }
  }
}
if (!crusaderClass) {
  errors.push("Crusader class document is missing");
} else {
  if (crusaderClass.system.hitDice !== "d8") errors.push("Crusader class must use d8 hit dice");
  if (crusaderClass.system.spellcasting?.progression !== "none") {
    errors.push("Crusader custom spell slot table must be stored as scale values, not normal dnd5e progression");
  }
  if (crusaderClass.system.spellcasting?.ability !== "cha") {
    errors.push("Crusader spellcasting ability must be Charisma");
  }
  if (!crusaderClass.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push("Crusader class description must document prerequisite automation");
  }
  if (crusaderClass.flags?.[manifest.id]?.prestigeClass !== "crusader") {
    errors.push("Crusader class automation flag is missing");
  }
  for (const identifier of ["rage-reduction", "spell-slots-1", "spell-slots-2", "spell-slots-3"]) {
    if (!crusaderClass.system.advancement.some(advancement => advancement.configuration?.identifier === identifier)) {
      errors.push(`Crusader scale is missing: ${identifier}`);
    }
  }
  const armorTrait = crusaderClass.system.advancement.some(
    advancement => advancement.type === "Trait"
      && advancement.configuration?.grants?.includes("armor:lgt")
      && advancement.configuration?.grants?.includes("armor:med")
      && advancement.configuration?.grants?.includes("armor:shl")
  );
  if (!armorTrait) errors.push("Crusader armor and shield proficiencies are missing");
}
if (!feyWarriorClass) {
  errors.push("Fey Warrior class document is missing");
} else {
  if (feyWarriorClass.system.hitDice !== "d10") errors.push("Fey Warrior class must use d10 hit dice");
  if (feyWarriorClass.system.spellcasting?.progression !== "none") {
    errors.push("Fey Warrior must not provide normal spell slot progression");
  }
  if (feyWarriorClass.system.spellcasting?.ability !== "cha") {
    errors.push("Fey Warrior spellcasting ability must be Charisma");
  }
  if (!feyWarriorClass.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push("Fey Warrior class description must document prerequisite automation");
  }
  if (feyWarriorClass.flags?.[manifest.id]?.prestigeClass !== "fey-warrior") {
    errors.push("Fey Warrior class automation flag is missing");
  }
  const cantripScale = feyWarriorClass.system.advancement.find(
    advancement => advancement.configuration?.identifier === "cantrips"
  );
  if (!cantripScale) errors.push("Fey Warrior cantrip scale is missing");
  const charismaSave = feyWarriorClass.system.advancement.some(
    advancement => advancement.type === "Trait" && advancement.configuration?.grants?.includes("saves:cha")
  );
  if (!charismaSave) errors.push("Fey Warrior Charisma save proficiency is missing");
}
if (!ghostWalkerClass) {
  errors.push("Ghost Walker class document is missing");
} else {
  if (ghostWalkerClass.system.hitDice !== "d8") errors.push("Ghost Walker class must use d8 hit dice");
  if (ghostWalkerClass.system.spellcasting?.progression !== "none") {
    errors.push("Ghost Walker must not provide spell slot progression");
  }
  if (!ghostWalkerClass.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push("Ghost Walker class description must document prerequisite automation");
  }
  if (ghostWalkerClass.flags?.[manifest.id]?.prestigeClass !== "ghost-walker") {
    errors.push("Ghost Walker class automation flag is missing");
  }
  const spiritFormScale = ghostWalkerClass.system.advancement.find(
    advancement => advancement.configuration?.identifier === "spirit-form-uses"
  );
  if (!spiritFormScale) errors.push("Ghost Walker spirit form use scale is missing");
}
if (!blinkerClass) {
  errors.push("Blinker class document is missing");
} else {
  if (blinkerClass.system.hitDice !== "d6") errors.push("Blinker class must use d6 hit dice");
  if (blinkerClass.system.spellcasting?.progression !== "none") {
    errors.push("Blinker must not provide spell slot progression");
  }
  if (!blinkerClass.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push("Blinker class description must document prerequisite automation");
  }
  if (blinkerClass.flags?.[manifest.id]?.prestigeClass !== "blinker") {
    errors.push("Blinker class automation flag is missing");
  }
  const blinkScale = blinkerClass.system.advancement.find(
    advancement => advancement.configuration?.identifier === "blinks"
  );
  if (!blinkScale) errors.push("Blinker blink scale is missing");
  const perceptionTrait = blinkerClass.system.advancement.some(
    advancement => advancement.type === "Trait" && advancement.configuration?.grants?.includes("skills:prc")
  );
  if (!perceptionTrait) errors.push("Blinker Perception proficiency is missing");
}
if (!fallenPriestClass) {
  errors.push("Fallen Priest class document is missing");
} else {
  if (fallenPriestClass.system.hitDice !== "d8") errors.push("Fallen Priest class must use d8 hit dice");
  if (fallenPriestClass.system.spellcasting?.progression !== "none") {
    errors.push("Fallen Priest spellcasting must be merged into Cleric progression by automation");
  }
  if (fallenPriestClass.system.spellcasting?.ability !== "wis") {
    errors.push("Fallen Priest spellcasting ability must be Wisdom");
  }
  if (!fallenPriestClass.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push("Fallen Priest class description must document prerequisite automation");
  }
  if (fallenPriestClass.flags?.[manifest.id]?.prestigeClass !== "fallen-priest") {
    errors.push("Fallen Priest class automation flag is missing");
  }
  const level4Asi = fallenPriestClass.system.advancement.some(
    advancement => advancement.type === "AbilityScoreImprovement" && advancement.level === 4
  );
  if (!level4Asi) errors.push("Fallen Priest level 4 ASI is missing");
}
if (!plagueDoctorClass) {
  errors.push("Plague Doctor class document is missing");
} else {
  if (plagueDoctorClass.system.hitDice !== "d10") errors.push("Plague Doctor class must use d10 hit dice");
  if (plagueDoctorClass.system.spellcasting?.progression !== "none") {
    errors.push("Plague Doctor must not provide spell slot progression");
  }
  if (plagueDoctorClass.system.spellcasting?.ability !== "int") {
    errors.push("Plague Doctor spellcasting ability must be Intelligence");
  }
  if (!plagueDoctorClass.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push("Plague Doctor class description must document prerequisite automation");
  }
  if (plagueDoctorClass.flags?.[manifest.id]?.prestigeClass !== "plague-doctor") {
    errors.push("Plague Doctor class automation flag is missing");
  }
  const sneakScale = plagueDoctorClass.system.advancement.find(
    advancement => advancement.configuration?.identifier === "sneak-attack"
  );
  if (!sneakScale) errors.push("Plague Doctor sneak attack scale is missing");
  const lightArmor = plagueDoctorClass.system.advancement.some(
    advancement => advancement.type === "Trait" && advancement.configuration?.grants?.includes("armor:lgt")
  );
  if (!lightArmor) errors.push("Plague Doctor light armor proficiency is missing");
}
if (!insectLordClass) {
  errors.push("Insect Lord class document is missing");
} else {
  if (insectLordClass.system.hitDice !== "d8") errors.push("Insect Lord class must use d8 hit dice");
  if (insectLordClass.system.spellcasting?.progression !== "none") {
    errors.push("Insect Lord must not provide spell slot progression");
  }
  if (!insectLordClass.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push("Insect Lord class description must document prerequisite automation");
  }
  if (insectLordClass.flags?.[manifest.id]?.prestigeClass !== "insect-lord") {
    errors.push("Insect Lord class automation flag is missing");
  }
  const level4Asi = insectLordClass.system.advancement.some(
    advancement => advancement.type === "AbilityScoreImprovement" && advancement.level === 4
  );
  if (!level4Asi) errors.push("Insect Lord level 4 ASI is missing");
}
if (!gamblerClass) {
  errors.push("Gambler class document is missing");
} else {
  if (gamblerClass.system.hitDice !== "d8") errors.push("Gambler class must use d8 hit dice");
  if (gamblerClass.system.spellcasting?.progression !== "none") {
    errors.push("Gambler must not provide spell slot progression");
  }
  if (gamblerClass.system.spellcasting?.ability !== "int") {
    errors.push("Gambler fallback spellcasting ability must be Intelligence");
  }
  if (!gamblerClass.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push("Gambler class description must document prerequisite automation");
  }
  if (gamblerClass.flags?.[manifest.id]?.prestigeClass !== "gambler") {
    errors.push("Gambler class automation flag is missing");
  }
}
if (!keeperClass) {
  errors.push("Keeper class document is missing");
} else {
  if (keeperClass.system.hitDice !== "d8") errors.push("Keeper class must use d8 hit dice");
  if (keeperClass.system.spellcasting?.progression !== "none") {
    errors.push("Keeper must not provide spell slot progression");
  }
  if (!keeperClass.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push("Keeper class description must document prerequisite automation");
  }
  if (keeperClass.flags?.[manifest.id]?.prestigeClass !== "keeper") {
    errors.push("Keeper class automation flag is missing");
  }
  const allyPointsScale = keeperClass.system.advancement.find(
    advancement => advancement.configuration?.identifier === "ally-points"
  );
  if (!allyPointsScale) errors.push("Keeper ally points scale is missing");
  const specializationAdvancement = keeperClass.system.advancement.find(
    advancement => advancement.type === "Subclass" && advancement.level === 1
  );
  if (!specializationAdvancement) {
    errors.push("Keeper specialization must use standard Subclass advancement at level 1");
  }
  const level4Asi = keeperClass.system.advancement.some(
    advancement => advancement.type === "AbilityScoreImprovement" && advancement.level === 4
  );
  if (!level4Asi) errors.push("Keeper level 4 ASI is missing");
}
if (!bloodMageClass) {
  errors.push("Blood Mage class document is missing");
} else {
  if (bloodMageClass.system.hitDice !== "d8") errors.push("Blood Mage class must use d8 hit dice");
  if (bloodMageClass.system.spellcasting?.progression !== "full") {
    errors.push("Blood Mage must use full caster spell slot progression");
  }
  if (bloodMageClass.system.spellcasting?.ability !== "con") {
    errors.push("Blood Mage spellcasting ability must be Constitution");
  }
  if (!bloodMageClass.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push("Blood Mage class description must document prerequisite automation");
  }
  if (bloodMageClass.flags?.[manifest.id]?.prestigeClass !== "blood-mage") {
    errors.push("Blood Mage class automation flag is missing");
  }
  const knownSpellsScale = bloodMageClass.system.advancement.find(
    advancement => advancement.configuration?.identifier === "known-spells"
  );
  if (!knownSpellsScale) errors.push("Blood Mage known spells scale is missing");
  const constitutionIncrease = bloodMageClass.system.advancement.some(
    advancement => advancement.type === "AbilityScoreImprovement" && advancement.level === 5
  );
  if (!constitutionIncrease) errors.push("Blood Mage Sanguine Strength advancement is missing");
}
if (!onmyojiClass) {
  errors.push("Onmyoji class document is missing");
} else {
  if (onmyojiClass.system.hitDice !== "d8") errors.push("Onmyoji class must use d8 hit dice");
  if (onmyojiClass.system.spellcasting?.progression !== "none") {
    errors.push("Onmyoji must not provide spell slot progression");
  }
  if (onmyojiClass.system.spellcasting?.ability !== "wis") {
    errors.push("Onmyoji feature DC ability must be Wisdom");
  }
  if (!onmyojiClass.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push("Onmyoji class description must document prerequisite automation");
  }
  if (onmyojiClass.flags?.[manifest.id]?.prestigeClass !== "onmyoji") {
    errors.push("Onmyoji class automation flag is missing");
  }
  const kiScale = onmyojiClass.system.advancement.find(
    advancement => advancement.configuration?.identifier === "ki-points"
  );
  if (!kiScale) errors.push("Onmyoji Ki scale is missing");
  const level4Asi = onmyojiClass.system.advancement.some(
    advancement => advancement.type === "AbilityScoreImprovement" && advancement.level === 4
  );
  if (!level4Asi) errors.push("Onmyoji level 4 ASI is missing");
  const spiritChoice = onmyojiClass.system.advancement.find(
    advancement => advancement.type === "ItemChoice" && advancement.configuration?.choices?.[1]
  );
  if (!spiritChoice || spiritChoice.configuration?.choices?.[1]?.count !== 3) {
    errors.push("Onmyoji must choose 3 World Spirits at level 1");
  }
  if (!spiritChoice || spiritChoice.configuration?.pool?.length !== 10) {
    errors.push("Onmyoji World Spirit choice must provide 10 spirits");
  }
}
if (!ritualistClass) {
  errors.push("Ritualist class document is missing");
} else {
  if (ritualistClass.system.hitDice !== "d8") errors.push("Ritualist class must use d8 hit dice");
  if (ritualistClass.system.spellcasting?.progression !== "none") {
    errors.push("Ritualist must not provide spell slot progression");
  }
  if (ritualistClass.system.spellcasting?.ability !== "wis") {
    errors.push("Ritualist spirit DC ability must be Wisdom");
  }
  if (!ritualistClass.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push("Ritualist class description must document prerequisite automation");
  }
  if (ritualistClass.flags?.[manifest.id]?.prestigeClass !== "ritualist") {
    errors.push("Ritualist class automation flag is missing");
  }
  const ritualPointsScale = ritualistClass.system.advancement.find(
    advancement => advancement.configuration?.identifier === "ritual-points"
  );
  if (!ritualPointsScale) errors.push("Ritualist ritual points scale is missing");
  const conSave = ritualistClass.system.advancement.some(
    advancement => advancement.type === "Trait" && advancement.configuration?.grants?.includes("saves:con")
  );
  if (!conSave) errors.push("Ritualist must grant Constitution save proficiency");
  const simpleWeapons = ritualistClass.system.advancement.some(
    advancement => advancement.type === "Trait" && advancement.configuration?.grants?.includes("weapon:sim")
  );
  if (!simpleWeapons) errors.push("Ritualist must grant simple weapon proficiency");
  const level4Asi = ritualistClass.system.advancement.some(
    advancement => advancement.type === "AbilityScoreImprovement" && advancement.level === 4
  );
  if (!level4Asi) errors.push("Ritualist level 4 ASI is missing");
}
if (!darkWarriorClass) {
  errors.push("Dark Warrior class document is missing");
} else {
  if (darkWarriorClass.system.hitDice !== "d10") errors.push("Dark Warrior class must use d10 hit dice");
  if (darkWarriorClass.system.spellcasting?.progression !== "none") {
    errors.push("Dark Warrior must not provide spell slot progression");
  }
  if (darkWarriorClass.system.spellcasting?.ability !== "cha") {
    errors.push("Dark Warrior spell DC fallback ability must be Charisma");
  }
  if (!darkWarriorClass.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push("Dark Warrior class description must document prerequisite automation");
  }
  if (darkWarriorClass.flags?.[manifest.id]?.prestigeClass !== "dark-warrior") {
    errors.push("Dark Warrior class automation flag is missing");
  }
  const charismaSave = darkWarriorClass.system.advancement.some(
    advancement => advancement.type === "Trait" && advancement.configuration?.grants?.includes("saves:cha")
  );
  if (!charismaSave) errors.push("Dark Warrior must grant Charisma save proficiency");
  const martialWeapons = darkWarriorClass.system.advancement.some(
    advancement => advancement.type === "Trait" && advancement.configuration?.grants?.includes("weapon:mar")
  );
  if (!martialWeapons) errors.push("Dark Warrior must grant martial weapon proficiency");
  const shields = darkWarriorClass.system.advancement.some(
    advancement => advancement.type === "Trait" && advancement.configuration?.grants?.includes("armor:shl")
  );
  if (!shields) errors.push("Dark Warrior must grant shield proficiency");
  const skillChoice = darkWarriorClass.system.advancement.find(
    advancement => advancement.type === "Trait" && advancement.configuration?.choices?.[0]?.pool?.includes("skills:ath")
  );
  if (!skillChoice || skillChoice.configuration?.choices?.[0]?.count !== 1) {
    errors.push("Dark Warrior must choose Athletics or Acrobatics");
  }
  const level4Asi = darkWarriorClass.system.advancement.some(
    advancement => advancement.type === "AbilityScoreImprovement" && advancement.level === 4
  );
  if (!level4Asi) errors.push("Dark Warrior level 4 ASI is missing");
}
if (!devilWorshipperClass) {
  errors.push("Devil Worshipper class document is missing");
} else {
  if (devilWorshipperClass.system.hitDice !== "d6") errors.push("Devil Worshipper class must use d6 hit dice");
  if (devilWorshipperClass.system.spellcasting?.progression !== "none") {
    errors.push("Devil Worshipper must not provide spell slot progression");
  }
  if (devilWorshipperClass.system.spellcasting?.ability !== "cha") {
    errors.push("Devil Worshipper fallback spellcasting ability must be Charisma");
  }
  if (!devilWorshipperClass.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push("Devil Worshipper class description must document prerequisite automation");
  }
  if (devilWorshipperClass.flags?.[manifest.id]?.prestigeClass !== "devil-worshipper") {
    errors.push("Devil Worshipper class automation flag is missing");
  }
  const dagger = devilWorshipperClass.system.advancement.some(
    advancement => advancement.type === "Trait" && advancement.configuration?.grants?.includes("weapon:sim:dagger")
  );
  if (!dagger) errors.push("Devil Worshipper must grant dagger proficiency");
  const skillChoice = devilWorshipperClass.system.advancement.find(
    advancement => advancement.type === "Trait" && advancement.configuration?.choices?.[0]?.pool?.includes("skills:per")
  );
  if (!skillChoice || skillChoice.configuration?.choices?.[0]?.count !== 1) {
    errors.push("Devil Worshipper must choose Persuasion or Intimidation");
  }
  const level4Asi = devilWorshipperClass.system.advancement.some(
    advancement => advancement.type === "AbilityScoreImprovement" && advancement.level === 4
  );
  if (!level4Asi) errors.push("Devil Worshipper level 4 ASI is missing");
}
if (!nethereseArcanistClass) {
  errors.push("Netherese Arcanist class document is missing");
} else {
  if (nethereseArcanistClass.system.hitDice !== "d6") errors.push("Netherese Arcanist class must use d6 hit dice");
  if (nethereseArcanistClass.system.spellcasting?.progression !== "none") {
    errors.push("Netherese Arcanist must not provide spell slot progression");
  }
  if (!nethereseArcanistClass.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push("Netherese Arcanist class description must document prerequisite automation");
  }
  if (nethereseArcanistClass.flags?.[manifest.id]?.prestigeClass !== "netherese-arcanist") {
    errors.push("Netherese Arcanist class automation flag is missing");
  }
  const calligrapher = nethereseArcanistClass.system.advancement.some(
    advancement => advancement.type === "Trait" && advancement.configuration?.grants?.includes("tool:calligrapher")
  );
  if (!calligrapher) errors.push("Netherese Arcanist must grant calligrapher tools");
  const saveChoice = nethereseArcanistClass.system.advancement.find(
    advancement => advancement.type === "Trait" && advancement.configuration?.choices?.[0]?.pool?.includes("saves:con")
  );
  if (!saveChoice || saveChoice.configuration?.choices?.[0]?.count !== 1) {
    errors.push("Netherese Arcanist must choose Constitution or Intelligence save");
  }
  const level4Asi = nethereseArcanistClass.system.advancement.some(
    advancement => advancement.type === "AbilityScoreImprovement" && advancement.level === 4
  );
  if (!level4Asi) errors.push("Netherese Arcanist level 4 ASI is missing");
}
if (!spiritVesselClass) {
  errors.push("Spirit Vessel class document is missing");
} else {
  if (spiritVesselClass.system.hitDice !== "d6") errors.push("Spirit Vessel class must use d6 hit dice");
  if (spiritVesselClass.system.spellcasting?.progression !== "none") {
    errors.push("Spirit Vessel pact magic must be stored as scale values, not normal dnd5e progression");
  }
  if (!spiritVesselClass.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push("Spirit Vessel class description must document prerequisite automation");
  }
  if (spiritVesselClass.flags?.[manifest.id]?.prestigeClass !== "spirit-vessel") {
    errors.push("Spirit Vessel class automation flag is missing");
  }
  for (const identifier of ["known-spells", "pact-slots", "pact-slot-level"]) {
    if (!spiritVesselClass.system.advancement.some(advancement => advancement.configuration?.identifier === identifier)) {
      errors.push(`Spirit Vessel scale is missing: ${identifier}`);
    }
  }
  const subclassAdvancement = spiritVesselClass.system.advancement.some(
    advancement => advancement.type === "Subclass" && advancement.level === 1
  );
  if (!subclassAdvancement) errors.push("Spirit Vessel subclass advancement is missing");
  const saveTrait = spiritVesselClass.system.advancement.some(
    advancement => advancement.type === "Trait"
      && advancement.configuration?.grants?.includes("saves:int")
      && advancement.configuration?.grants?.includes("saves:cha")
  );
  if (!saveTrait) errors.push("Spirit Vessel Intelligence and Charisma save proficiencies are missing");
}
if (!oracleClass) {
  errors.push("Oracle class document is missing");
} else {
  if (oracleClass.system.hitDice !== "d8") errors.push("Oracle class must use d8 hit dice");
  if (oracleClass.system.spellcasting?.progression !== "none") {
    errors.push("Oracle spell slots must be stored as scale values, not normal dnd5e progression");
  }
  if (oracleClass.system.spellcasting?.ability !== "wis") {
    errors.push("Oracle spellcasting ability must be Wisdom");
  }
  if (!oracleClass.system.description?.value?.includes("Foundry:")) {
    errors.push("Oracle class description must document prerequisite automation");
  }
  if (oracleClass.flags?.[manifest.id]?.prestigeClass !== "oracle") {
    errors.push("Oracle class automation flag is missing");
  }
  for (const identifier of ["max-dissonance", "fate-balance", "spell-slots-1", "spell-slots-2", "spell-slots-3"]) {
    if (!oracleClass.system.advancement.some(advancement => advancement.configuration?.identifier === identifier)) {
      errors.push(`Oracle scale is missing: ${identifier}`);
    }
  }
  const weaverTools = oracleClass.system.advancement.some(
    advancement => advancement.type === "Trait" && advancement.configuration?.grants?.includes("tool:weaver")
  );
  if (!weaverTools) errors.push("Oracle must grant weaver's tools");
  const perception = oracleClass.system.advancement.some(
    advancement => advancement.type === "Trait" && advancement.level === 4 && advancement.configuration?.grants?.includes("skills:prc")
  );
  if (!perception) errors.push("Oracle must grant Perception at level 4");
  const level4Asi = oracleClass.system.advancement.some(
    advancement => advancement.type === "AbilityScoreImprovement" && advancement.level === 4
  );
  if (!level4Asi) errors.push("Oracle level 4 ASI is missing");
}

if (!demonologistClass) {
  errors.push("Demonologist class document is missing");
} else {
  if (demonologistClass.system.hitDice !== "d6") errors.push("Demonologist class must use d6 hit dice");
  if (demonologistClass.system.spellcasting?.progression !== "none") {
    errors.push("Demonologist must not use normal dnd5e spellcasting progression");
  }
  if (demonologistClass.system.spellcasting?.ability !== "cha") {
    errors.push("Demonologist spellcasting ability marker must be Charisma");
  }
  if (!demonologistClass.system.description?.value?.includes("Foundry:")) {
    errors.push("Demonologist class description must document prerequisite automation");
  }
  if (demonologistClass.flags?.[manifest.id]?.prestigeClass !== "demonologist") {
    errors.push("Demonologist class automation flag is missing");
  }
  const charismaSave = demonologistClass.system.advancement.some(
    advancement => advancement.type === "Trait" && advancement.configuration?.grants?.includes("saves:cha")
  );
  if (!charismaSave) errors.push("Demonologist must grant Charisma saving throw proficiency");
  const skillChoice = demonologistClass.system.advancement.some(
    advancement => advancement.type === "Trait"
      && advancement.configuration?.choices?.some(choice =>
        choice.count === 1
        && choice.pool?.includes("skills:dec")
        && choice.pool?.includes("skills:itm")
      )
  );
  if (!skillChoice) errors.push("Demonologist must choose Deception or Intimidation");
  const abyssal = demonologistClass.system.advancement.some(
    advancement => advancement.type === "Trait" && advancement.level === 2 && advancement.configuration?.grants?.includes("languages:abyssal")
  );
  if (!abyssal) errors.push("Demonologist must grant Abyssal at level 2");
  const level4Asi = demonologistClass.system.advancement.some(
    advancement => advancement.type === "AbilityScoreImprovement" && advancement.level === 4
  );
  if (!level4Asi) errors.push("Demonologist level 4 ASI is missing");
}

if (!sanguinistClass) {
  errors.push("Sanguinist class document is missing");
} else {
  if (sanguinistClass.system.hitDice !== "d8") errors.push("Sanguinist class must use d8 hit dice");
  if (sanguinistClass.system.spellcasting?.progression !== "none") {
    errors.push("Sanguinist custom spell slots must be stored as scale values");
  }
  if (!sanguinistClass.system.description?.value?.includes("Foundry:")) {
    errors.push("Sanguinist class description must document prerequisite automation");
  }
  if (sanguinistClass.flags?.[manifest.id]?.prestigeClass !== "sanguinist") {
    errors.push("Sanguinist class automation flag is missing");
  }
  const skillChoice = sanguinistClass.system.advancement.some(
    advancement => advancement.type === "Trait"
      && advancement.configuration?.choices?.some(choice =>
        choice.count === 1
        && choice.pool?.includes("skills:arc")
        && choice.pool?.includes("skills:itm")
        && choice.pool?.includes("skills:med")
        && choice.pool?.includes("skills:nat")
        && choice.pool?.includes("skills:rel")
      )
  );
  if (!skillChoice) errors.push("Sanguinist must choose one listed skill");
  for (const identifier of ["blood-magic-uses", "known-blood-spells", "spell-slots-1", "spell-slots-2", "spell-slots-3"]) {
    if (!sanguinistClass.system.advancement.some(advancement => advancement.configuration?.identifier === identifier)) {
      errors.push(`Sanguinist scale is missing: ${identifier}`);
    }
  }
  const compatibilityChoice = sanguinistClass.system.advancement.some(
    advancement => advancement.type === "ItemChoice"
      && advancement.configuration?.choices?.[3]?.count === 1
      && advancement.configuration?.pool?.length === 2
  );
  if (!compatibilityChoice) errors.push("Sanguinist level 3 blood compatibility choice is missing");
  const masteryChoice = sanguinistClass.system.advancement.some(
    advancement => advancement.type === "ItemChoice"
      && advancement.configuration?.choices?.[5]?.count === 2
      && advancement.configuration?.pool?.length === 8
  );
  if (!masteryChoice) errors.push("Sanguinist level 5 crimson mastery choice is missing");
  const level4Asi = sanguinistClass.system.advancement.some(
    advancement => advancement.type === "AbilityScoreImprovement" && advancement.level === 4
  );
  if (!level4Asi) errors.push("Sanguinist level 4 ASI is missing");
}

if (!schoolOfSteelSubclass) {
  errors.push("School of Steel subclass document is missing");
} else {
  if (schoolOfSteelSubclass.system.classIdentifier !== "wizard") {
    errors.push("School of Steel subclass must be attached to Wizard");
  }
  if (schoolOfSteelSubclass.flags?.[manifest.id]?.wizardSubclass !== "school-of-steel") {
    errors.push("School of Steel subclass automation flag is missing");
  }
  const advancementLevels = new Set((schoolOfSteelSubclass.system.advancement ?? []).map(advancement => advancement.level));
  for (const level of [2, 6, 10, 14]) {
    if (!advancementLevels.has(level)) errors.push(`School of Steel advancement level is missing: ${level}`);
  }
  const martialTrait = schoolOfSteelSubclass.system.advancement.some(
    advancement => advancement.type === "Trait" && advancement.configuration?.grants?.includes("weapon:mar")
  );
  if (!martialTrait) errors.push("School of Steel must grant martial weapon proficiency");
  const signatureChoice = schoolOfSteelSubclass.system.advancement.find(
    advancement => advancement.type === "ItemChoice" && advancement.configuration?.choices?.[14]
  );
  if (!signatureChoice || signatureChoice.configuration?.pool?.length !== 3) {
    errors.push("School of Steel must provide 3 signature technique choices at level 14");
  }
  const grantsAnimateObjects = JSON.stringify(schoolOfSteelSubclass.system.advancement ?? [])
    .includes("Compendium.dnd5e.spells.Item.ATo0Eb63TDtnu6iA");
  if (!grantsAnimateObjects) errors.push("School of Steel must grant Animate Objects at level 10");
}

const featureIds = new Set(
  [...allDocuments.values()]
    .filter(entry => entry.pack === "features")
    .map(entry => entry.document._id)
);
const itemUuids = new Set(
  [...allDocuments.values()].map(
    entry => `Compendium.${manifest.id}.${entry.pack}.Item.${entry.document._id}`
  )
);

for (const { document } of allDocuments.values()) {
  if (!["class", "subclass", "feat"].includes(document.type)) continue;
  const description = document.system.description?.value ?? "";
  for (const match of description.matchAll(/@UUID\[([^\]]+)\]/g)) {
    const uuid = match[1];
    if (uuid.startsWith(`Compendium.${manifest.id}.`) && !itemUuids.has(uuid)) {
      errors.push(`Broken description UUID on ${document.name}: ${uuid}`);
    }
  }
}

for (const { document } of allDocuments.values()) {
  for (const advancement of document.system?.advancement ?? []) {
    const uuids = [
      ...(advancement.configuration?.items ?? []).map(item => item.uuid),
      ...(advancement.configuration?.pool ?? []).map(item => item.uuid)
    ];
    for (const uuid of uuids) {
      if (!itemUuids.has(uuid) && !uuid.startsWith("Compendium.dnd5e.")) {
        errors.push(`Broken advancement UUID on ${document.name}: ${uuid}`);
      }
    }
  }
}

const featureDocuments = [...allDocuments.values()]
  .filter(entry => entry.pack === "features")
  .map(entry => entry.document);
const featuresByIdentifier = new Map(
  featureDocuments.map(document => [document.system.identifier, document])
);
const transformationDocuments = [...allDocuments.values()]
  .filter(entry => entry.pack === "transformations")
  .map(entry => entry.document);
const transformationsByIdentifier = new Map(
  transformationDocuments.map(document => [document.system.identifier, document])
);
const allItemDocuments = [...allDocuments.values()].map(entry => entry.document);
const allItemsByIdentifier = new Map(
  allItemDocuments.map(document => [document.system.identifier, document])
);
const transformationIdentifiers = new Set(transformationDocuments.map(document => document.system.identifier));
for (const identifier of ["murderspawn-transformation", "hollow-transformation"]) {
  if (!transformationIdentifiers.has(identifier)) errors.push(`Main transformation card is missing from transformations pack: ${identifier}`);
}
for (const document of transformationDocuments) {
  if (!["murderspawn-transformation", "hollow-transformation"].includes(document.system.identifier)) {
    errors.push(`Transformations pack must contain only main transformation cards, got: ${document.system.identifier}`);
  }
}

for (const identifier of [
  "great-weapon-style",
  "cleaving",
  "crushing",
  "giant-killer",
  "momentum",
  "steel-will",
  "steel-giant",
  "adaptability",
  "superior-control",
  "powerful-crushing",
  "powerful-cleaving",
  "indestructibility",
  "smithing",
  "giant-crushing"
]) {
  const document = featuresByIdentifier.get(identifier);
  if (!document) {
    errors.push(`Missing automated feature: ${identifier}`);
    continue;
  }
  if (document.flags?.[manifest.id]?.feature !== identifier) {
    errors.push(`Feature automation flag is missing: ${identifier}`);
  }
  if (!document.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push(`Feature automation description is missing: ${identifier}`);
  }
}

const juggernautFeatureDocuments = featureDocuments.filter(
  document => document.flags?.[manifest.id]?.juggernautFeature === true
);
if (juggernautFeatureDocuments.length !== 14) {
  errors.push(`Expected 14 Juggernaut features, got ${juggernautFeatureDocuments.length}`);
}
for (const identifier of [
  "glorious-survival",
  "regenerating-soul",
  "regeneration-flaw",
  "denial-of-death",
  "unyielding",
  "what-wound",
  "embrace-life",
  "immovable-object",
  "minor-regeneration",
  "refusal-of-death",
  "what-wounds",
  "embrace-life-improved",
  "greater-regeneration",
  "unstoppable-force"
]) {
  const document = featuresByIdentifier.get(identifier);
  if (!document) {
    errors.push(`Missing Juggernaut feature: ${identifier}`);
    continue;
  }
  if (document.flags?.[manifest.id]?.feature !== identifier) {
    errors.push(`Juggernaut feature automation flag is missing: ${identifier}`);
  }
}
const refusalOfDeath = featuresByIdentifier.get("refusal-of-death");
if (!refusalOfDeath?.effects?.some(effect => effect.flags?.[manifest.id]?.passiveEffect === true)) {
  errors.push("Juggernaut Refusal of Death passive effect is missing");
}

const soulEaterFeatureDocuments = featureDocuments.filter(
  document => document.flags?.[manifest.id]?.soulEaterFeature === true
);
if (soulEaterFeatureDocuments.length !== 5) {
  errors.push(`Expected 5 Soul Eater features, got ${soulEaterFeatureDocuments.length}`);
}
for (const identifier of [
  "soul-rend",
  "soul-absorption",
  "soul-exchange",
  "soul-shard",
  "soul-power"
]) {
  const document = featuresByIdentifier.get(identifier);
  if (!document) {
    errors.push(`Missing Soul Eater feature: ${identifier}`);
    continue;
  }
  if (document.flags?.[manifest.id]?.feature !== identifier) {
    errors.push(`Soul Eater feature automation flag is missing: ${identifier}`);
  }
}

const guardianFeatureDocuments = featureDocuments.filter(
  document => document.flags?.[manifest.id]?.guardianFeature === true
);
if (guardianFeatureDocuments.length !== 17) {
  errors.push(`Expected 17 Guardian features, got ${guardianFeatureDocuments.length}`);
}
for (const identifier of [
  "guardian-calling",
  "guardian-mark",
  "protection-specialization",
  "sacrificial-throw",
  "protective-magic",
  "endure-pain",
  "powerful-retribution",
  "divine-retribution",
  "furious-retribution",
  "leaping-retribution",
  "martial-retribution",
  "planar-retribution",
  "spellcasting-retribution",
  "threatening-retribution",
  "steadfastness",
  "powerful-retribution-improved",
  "guardian-unyielding"
]) {
  const document = featuresByIdentifier.get(identifier);
  if (!document) {
    errors.push(`Missing Guardian feature: ${identifier}`);
    continue;
  }
  if (document.flags?.[manifest.id]?.feature !== identifier) {
    errors.push(`Guardian feature automation flag is missing: ${identifier}`);
  }
  if (!document.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push(`Guardian automation description is missing: ${identifier}`);
  }
}
if (guardianFeatureDocuments.filter(document => document.flags?.[manifest.id]?.guardianSpecialization).length !== 2) {
  errors.push("Guardian must provide 2 protection specializations");
}
if (guardianFeatureDocuments.filter(document => document.flags?.[manifest.id]?.guardianRetribution).length !== 7) {
  errors.push("Guardian must provide 7 powerful retributions");
}

const crusaderFeatureDocuments = featureDocuments.filter(
  document => document.flags?.[manifest.id]?.crusaderFeature === true
);
if (crusaderFeatureDocuments.length !== 6) {
  errors.push(`Expected 6 Crusader features, got ${crusaderFeatureDocuments.length}`);
}
for (const identifier of [
  "crusader-miracles",
  "crusader-rage",
  "crusader-aegis",
  "divine-devotion",
  "consecration",
  "condemnation"
]) {
  const document = featuresByIdentifier.get(identifier);
  if (!document) {
    errors.push(`Missing Crusader feature: ${identifier}`);
    continue;
  }
  if (document.flags?.[manifest.id]?.feature !== identifier) {
    errors.push(`Crusader feature automation flag is missing: ${identifier}`);
  }
  if (!document.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push(`Crusader automation description is missing: ${identifier}`);
  }
}
const divineDevotion = featuresByIdentifier.get("divine-devotion");
if (!divineDevotion?.effects?.some(effect => effect.flags?.[manifest.id]?.passiveEffect === true)) {
  errors.push("Crusader Divine Devotion passive effect is missing");
}

const feyWarriorFeatureDocuments = featureDocuments.filter(
  document => document.flags?.[manifest.id]?.feyWarriorFeature === true
);
if (feyWarriorFeatureDocuments.length !== 17) {
  errors.push(`Expected 17 Fey Warrior features, got ${feyWarriorFeatureDocuments.length}`);
}
for (const identifier of [
  "fey-transformation",
  "fey-warrior-cantrips",
  "call-of-feywild",
  "charming-defense",
  "chimeric-weapon",
  "permanent-manifestation",
  "fey-magic",
  "fey-skin",
  "fey-mask",
  "fey-blood",
  "fey-eyes",
  "fey-appearance",
  "fey-speed",
  "irresistible-charms",
  "fey-indomitable-life",
  "healing-adept",
  "graceful-fighter"
]) {
  const document = featuresByIdentifier.get(identifier);
  if (!document) {
    errors.push(`Missing Fey Warrior feature: ${identifier}`);
    continue;
  }
  if (document.flags?.[manifest.id]?.feature !== identifier) {
    errors.push(`Fey Warrior feature automation flag is missing: ${identifier}`);
  }
  if (!document.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push(`Fey Warrior automation description is missing: ${identifier}`);
  }
}
if (feyWarriorFeatureDocuments.filter(document => document.flags?.[manifest.id]?.feyTrait).length !== 9) {
  errors.push("Fey Warrior must provide 9 fey traits including Mask");
}
for (const identifier of ["fey-eyes", "fey-speed", "irresistible-charms"]) {
  const document = featuresByIdentifier.get(identifier);
  if (!document?.effects?.some(effect => effect.flags?.[manifest.id]?.passiveEffect === true)) {
    errors.push(`Fey Warrior passive effect is missing: ${identifier}`);
  }
}

const ghostWalkerFeatureDocuments = featureDocuments.filter(
  document => document.flags?.[manifest.id]?.ghostWalkerFeature === true
);
if (ghostWalkerFeatureDocuments.length !== 8) {
  errors.push(`Expected 8 Ghost Walker features, got ${ghostWalkerFeatureDocuments.length}`);
}
for (const identifier of [
  "touched-by-death",
  "spirit-form",
  "possession",
  "ghost-step",
  "otherworldly-presence",
  "drain-soul",
  "kindred-spirit",
  "unfinished-business"
]) {
  const document = featuresByIdentifier.get(identifier);
  if (!document) {
    errors.push(`Missing Ghost Walker feature: ${identifier}`);
    continue;
  }
  if (document.flags?.[manifest.id]?.feature !== identifier) {
    errors.push(`Ghost Walker feature automation flag is missing: ${identifier}`);
  }
  if (!document.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push(`Ghost Walker automation description is missing: ${identifier}`);
  }
}
const touchedByDeath = featuresByIdentifier.get("touched-by-death");
if (!touchedByDeath?.effects?.some(effect => effect.flags?.[manifest.id]?.passiveEffect === true)) {
  errors.push("Ghost Walker Touched by Death passive effect is missing");
}

const blinkerFeatureDocuments = featureDocuments.filter(
  document => document.flags?.[manifest.id]?.blinkerFeature === true
);
if (blinkerFeatureDocuments.length !== 10) {
  errors.push(`Expected 10 Blinker features, got ${blinkerFeatureDocuments.length}`);
}
for (const identifier of [
  "inner-blink",
  "turnaround-blink",
  "sideways-shift",
  "blinking-step",
  "improved-technique",
  "blinking-wrist",
  "outer-blink",
  "shift-sense",
  "disappearance",
  "miraculous-homecoming"
]) {
  const document = featuresByIdentifier.get(identifier);
  if (!document) {
    errors.push(`Missing Blinker feature: ${identifier}`);
    continue;
  }
  if (document.flags?.[manifest.id]?.feature !== identifier) {
    errors.push(`Blinker feature automation flag is missing: ${identifier}`);
  }
  if (!document.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push(`Blinker automation description is missing: ${identifier}`);
  }
}

const fallenPriestFeatureDocuments = featureDocuments.filter(
  document => document.flags?.[manifest.id]?.fallenPriestFeature === true
);
if (fallenPriestFeatureDocuments.length !== 7) {
  errors.push(`Expected 7 Fallen Priest features, got ${fallenPriestFeatureDocuments.length}`);
}
for (const identifier of [
  "fallen-priest-heretic",
  "fallen-priest-spellcasting",
  "fallen-priest-turn-undead",
  "divine-resistance",
  "absorb-power",
  "divine-copying",
  "arcane-copying"
]) {
  const document = featuresByIdentifier.get(identifier);
  if (!document) {
    errors.push(`Missing Fallen Priest feature: ${identifier}`);
    continue;
  }
  if (document.flags?.[manifest.id]?.feature !== identifier) {
    errors.push(`Fallen Priest feature automation flag is missing: ${identifier}`);
  }
  if (!document.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push(`Fallen Priest automation description is missing: ${identifier}`);
  }
}

const plagueDoctorFeatureDocuments = featureDocuments.filter(
  document => document.flags?.[manifest.id]?.plagueDoctorFeature === true
);
if (plagueDoctorFeatureDocuments.length !== 7) {
  errors.push(`Expected 7 Plague Doctor features, got ${plagueDoctorFeatureDocuments.length}`);
}
for (const identifier of [
  "plague-sneak-attack",
  "disease-carrier",
  "ragged-armor",
  "touch-of-disease",
  "smart-infection",
  "infect-wounds",
  "disease-form"
]) {
  const document = featuresByIdentifier.get(identifier);
  if (!document) {
    errors.push(`Missing Plague Doctor feature: ${identifier}`);
    continue;
  }
  if (document.flags?.[manifest.id]?.feature !== identifier) {
    errors.push(`Plague Doctor feature automation flag is missing: ${identifier}`);
  }
  if (!document.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push(`Plague Doctor automation description is missing: ${identifier}`);
  }
}
const diseaseCarrier = featuresByIdentifier.get("disease-carrier");
if (!diseaseCarrier?.effects?.some(effect => effect.flags?.[manifest.id]?.passiveEffect === true)) {
  errors.push("Plague Doctor Disease Carrier passive effect is missing");
}

const insectLordFeatureDocuments = featureDocuments.filter(
  document => document.flags?.[manifest.id]?.insectLordFeature === true
);
if (insectLordFeatureDocuments.length !== 8) {
  errors.push(`Expected 8 Insect Lord features, got ${insectLordFeatureDocuments.length}`);
}
for (const identifier of [
  "chitinous-carapace",
  "insect-familiar",
  "insect-natural-weapons",
  "blood-drain",
  "crawling-armor",
  "spew-insects",
  "swarm-mind",
  "crawling-eye"
]) {
  const document = featuresByIdentifier.get(identifier);
  if (!document) {
    errors.push(`Missing Insect Lord feature: ${identifier}`);
    continue;
  }
  if (document.flags?.[manifest.id]?.feature !== identifier) {
    errors.push(`Insect Lord feature automation flag is missing: ${identifier}`);
  }
  if (!document.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push(`Insect Lord automation description is missing: ${identifier}`);
  }
}

const gamblerFeatureDocuments = featureDocuments.filter(
  document => document.flags?.[manifest.id]?.gamblerFeature === true
);
if (gamblerFeatureDocuments.length !== 5) {
  errors.push(`Expected 5 Gambler features, got ${gamblerFeatureDocuments.length}`);
}
for (const identifier of [
  "astral-deck",
  "deal-them",
  "rogues-are-lucky",
  "up-the-sleeve",
  "aces-beat"
]) {
  const document = featuresByIdentifier.get(identifier);
  if (!document) {
    errors.push(`Missing Gambler feature: ${identifier}`);
    continue;
  }
  if (document.flags?.[manifest.id]?.feature !== identifier) {
    errors.push(`Gambler feature automation flag is missing: ${identifier}`);
  }
  if (!document.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push(`Gambler automation description is missing: ${identifier}`);
  }
}

const keeperFeatureDocuments = featureDocuments.filter(
  document => document.flags?.[manifest.id]?.keeperFeature === true
);
if (keeperFeatureDocuments.length !== 10) {
  errors.push(`Expected 10 Keeper features, got ${keeperFeatureDocuments.length}`);
}
for (const identifier of [
  "keeper-ward-and-warded",
  "keeper-ally-talents",
  "golem-maker",
  "myth-seeker-keeper",
  "spirit-medium-keeper",
  "wild-tamer-keeper",
  "strategy-and-synergy",
  "united-and-protected",
  "rest-and-recovery",
  "might-and-magic"
]) {
  const document = featuresByIdentifier.get(identifier);
  if (!document) {
    errors.push(`Missing Keeper feature: ${identifier}`);
    continue;
  }
  if (document.flags?.[manifest.id]?.feature !== identifier) {
    errors.push(`Keeper feature automation flag is missing: ${identifier}`);
  }
  if (!document.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push(`Keeper automation description is missing: ${identifier}`);
  }
}
if (keeperFeatureDocuments.filter(document => document.flags?.[manifest.id]?.keeperSpecialization).length !== 4) {
  errors.push("Keeper must provide 4 specialization features");
}
const bloodMageFeatureDocuments = featureDocuments.filter(
  document => document.flags?.[manifest.id]?.bloodMageFeature === true
);
if (bloodMageFeatureDocuments.length !== 10) {
  errors.push(`Expected 10 Blood Mage features, got ${bloodMageFeatureDocuments.length}`);
}
for (const identifier of [
  "blood-mage-spellcasting",
  "blood-magic",
  "flesh-canvas",
  "feast-of-the-fallen",
  "blood-transfer",
  "sanguine-fortitude",
  "blood-mage-sacrifice",
  "blood-thrall",
  "maleficar",
  "sanguine-strength"
]) {
  const document = featuresByIdentifier.get(identifier);
  if (!document) {
    errors.push(`Missing Blood Mage feature: ${identifier}`);
    continue;
  }
  if (document.flags?.[manifest.id]?.feature !== identifier) {
    errors.push(`Blood Mage feature automation flag is missing: ${identifier}`);
  }
}
const bloodMagic = featuresByIdentifier.get("blood-magic");
const bloodMagicActions = Object.values(bloodMagic?.system?.activities ?? {})
  .filter(activity => activity.flags?.[manifest.id]?.action === "apply-blood-magic-cost");
if (bloodMagicActions.length !== 5) {
  errors.push(`Blood Magic must provide 5 blood cost activities, got ${bloodMagicActions.length}`);
}
const sanguineFortitude = featuresByIdentifier.get("sanguine-fortitude");
if (!sanguineFortitude?.effects?.some(effect => effect.flags?.[manifest.id]?.passiveEffect === true)) {
  errors.push("Blood Mage Sanguine Fortitude passive effect is missing");
}
const sacrifice = featuresByIdentifier.get("blood-mage-sacrifice");
if (!Object.values(sacrifice?.system?.activities ?? {}).some(
  activity => activity.flags?.[manifest.id]?.action === "roll-blood-mage-sacrifice"
)) {
  errors.push("Blood Mage Sacrifice action is missing");
}
const onmyojiFeatureDocuments = featureDocuments.filter(
  document => document.flags?.[manifest.id]?.onmyojiFeature === true
);
if (onmyojiFeatureDocuments.length !== 15) {
  errors.push(`Expected 15 Onmyoji features, got ${onmyojiFeatureDocuments.length}`);
}
const onmyojiSpiritIdentifiers = [
  "spirit-alcohol",
  "spirit-book",
  "spirit-fire",
  "spirit-food",
  "spirit-mountain",
  "spirit-steel",
  "spirit-water",
  "spirit-wood",
  "spirit-wealth",
  "spirit-wind"
];
for (const identifier of [
  "onmyoji-ki",
  "shikigami-talisman",
  "purification-rite",
  "shikigami-ghost-hunter",
  "spirit-place",
  ...onmyojiSpiritIdentifiers
]) {
  const document = featuresByIdentifier.get(identifier);
  if (!document) {
    errors.push(`Missing Onmyoji feature: ${identifier}`);
    continue;
  }
  if (document.flags?.[manifest.id]?.feature !== identifier) {
    errors.push(`Onmyoji feature automation flag is missing: ${identifier}`);
  }
  if (!document.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push(`Onmyoji automation description is missing: ${identifier}`);
  }
}
const onmyojiSpiritFeatureDocuments = onmyojiFeatureDocuments.filter(
  document => document.flags?.[manifest.id]?.onmyojiSpiritFeature === true
);
if (onmyojiSpiritFeatureDocuments.length !== 10) {
  errors.push(`Expected 10 Onmyoji World Spirit features, got ${onmyojiSpiritFeatureDocuments.length}`);
}
const onmyojiKi = featuresByIdentifier.get("onmyoji-ki");
if (!Object.values(onmyojiKi?.system?.activities ?? {}).some(
  activity => activity.flags?.[manifest.id]?.action === "sync-onmyoji-resources"
)) {
  errors.push("Onmyoji Ki sync action is missing");
}
for (const document of onmyojiSpiritFeatureDocuments) {
  const actions = Object.values(document.system?.activities ?? {})
    .map(activity => activity.flags?.[manifest.id]?.action);
  const kiActions = actions.filter(action => action === "use-onmyoji-ki");
  if (kiActions.length !== 2) {
    errors.push(`Onmyoji spirit ${document.system.identifier} must provide minor and great Ki activities`);
  }
}
const ritualistFeatureDocuments = featureDocuments.filter(
  document => document.flags?.[manifest.id]?.ritualistFeature === true
);
if (ritualistFeatureDocuments.length !== 6) {
  errors.push(`Expected 6 Ritualist features, got ${ritualistFeatureDocuments.length}`);
}
for (const identifier of [
  "binding-ritual",
  "spirit-sight",
  "mind-body-and-soul",
  "protective-ritual",
  "spirit-channel",
  "ethereal-wanderer"
]) {
  const document = featuresByIdentifier.get(identifier);
  if (!document) {
    errors.push(`Missing Ritualist feature: ${identifier}`);
    continue;
  }
  if (document.flags?.[manifest.id]?.feature !== identifier) {
    errors.push(`Ritualist feature automation flag is missing: ${identifier}`);
  }
  if (!document.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push(`Ritualist automation description is missing: ${identifier}`);
  }
}
const bindingRitual = featuresByIdentifier.get("binding-ritual");
const bindingRitualActions = Object.values(bindingRitual?.system?.activities ?? {})
  .map(activity => activity.flags?.[manifest.id]?.action)
  .filter(Boolean);
for (const action of [
  "sync-ritualist-resources",
  "show-ritualist-spirit-dc",
  "roll-ritualist-spirit-agony",
  "roll-ritualist-spirit-life",
  "roll-ritualist-spirit-protection",
  "roll-ritualist-spirit-sorrow",
  "roll-ritualist-spirit-destruction-die"
]) {
  if (!bindingRitualActions.includes(action)) {
    errors.push(`Missing Ritualist Binding Ritual action: ${action}`);
  }
}
const ritualPointActions = bindingRitualActions.filter(action => action === "summon-ritualist-spirits");
if (ritualPointActions.length !== 1) {
  errors.push(`Binding Ritual must provide 1 dialog-based ritual spirit summon activity, got ${ritualPointActions.length}`);
}
const spiritChannel = featuresByIdentifier.get("spirit-channel");
if (!Object.values(spiritChannel?.system?.activities ?? {}).some(
  activity => activity.flags?.[manifest.id]?.action === "show-ritualist-spirit-channel"
)) {
  errors.push("Ritualist Spirit Channel summary action is missing");
}
const darkWarriorFeatureDocuments = featureDocuments.filter(
  document => document.flags?.[manifest.id]?.darkWarriorFeature === true
);
if (darkWarriorFeatureDocuments.length !== 6) {
  errors.push(`Expected 6 Dark Warrior features, got ${darkWarriorFeatureDocuments.length}`);
}
for (const identifier of [
  "black-magic-oil",
  "black-magic-elixir",
  "improved-black-oil",
  "improved-black-elixir",
  "dark-resistance",
  "blackening-weapon"
]) {
  const document = featuresByIdentifier.get(identifier);
  if (!document) {
    errors.push(`Missing Dark Warrior feature: ${identifier}`);
    continue;
  }
  if (document.flags?.[manifest.id]?.feature !== identifier) {
    errors.push(`Dark Warrior feature automation flag is missing: ${identifier}`);
  }
  if (!document.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push(`Dark Warrior automation description is missing: ${identifier}`);
  }
}
const blackMagicOil = featuresByIdentifier.get("black-magic-oil");
const blackMagicOilActions = Object.values(blackMagicOil?.system?.activities ?? {})
  .map(activity => activity.flags?.[manifest.id]?.action)
  .filter(Boolean);
for (const action of ["apply-black-magic-oil", "sync-dark-warrior-resources"]) {
  if (!blackMagicOilActions.includes(action)) errors.push(`Missing Dark Warrior Black Magic Oil action: ${action}`);
}
const blackMagicElixir = featuresByIdentifier.get("black-magic-elixir");
const blackMagicElixirActions = Object.values(blackMagicElixir?.system?.activities ?? {})
  .map(activity => activity.flags?.[manifest.id]?.action)
  .filter(Boolean);
const elixirActions = blackMagicElixirActions.filter(action => action === "drink-dark-warrior-elixir");
if (elixirActions.length !== 4) {
  errors.push(`Black Magic Elixir must provide 4 elixir activities, got ${elixirActions.length}`);
}
const darkResistance = featuresByIdentifier.get("dark-resistance");
if (!darkResistance?.effects?.some(effect => effect.flags?.[manifest.id]?.passiveEffect === true)) {
  errors.push("Dark Warrior Dark Resistance passive effect is missing");
}
const devilWorshipperFeatureDocuments = featureDocuments.filter(
  document => document.flags?.[manifest.id]?.devilWorshipperFeature === true
);
if (devilWorshipperFeatureDocuments.length !== 10) {
  errors.push(`Expected 10 Devil Worshipper features, got ${devilWorshipperFeatureDocuments.length}`);
}
for (const identifier of [
  "devil-spellcasting-ability",
  "hellfire",
  "imp-familiar",
  "devil-sight",
  "dark-luck",
  "quiet-whisper",
  "empowered-charms",
  "hellfire-fury",
  "devilish-glaive",
  "aura-of-devastated-souls"
]) {
  const document = featuresByIdentifier.get(identifier);
  if (!document) {
    errors.push(`Missing Devil Worshipper feature: ${identifier}`);
    continue;
  }
  if (document.flags?.[manifest.id]?.feature !== identifier) {
    errors.push(`Devil Worshipper feature automation flag is missing: ${identifier}`);
  }
  if (!document.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push(`Devil Worshipper automation description is missing: ${identifier}`);
  }
}
const devilSight = featuresByIdentifier.get("devil-sight");
if (!devilSight?.effects?.some(effect => effect.flags?.[manifest.id]?.passiveEffect === true)) {
  errors.push("Devil Worshipper Devil Sight passive effect is missing");
}
const devilAbility = featuresByIdentifier.get("devil-spellcasting-ability");
if (!Object.values(devilAbility?.system?.activities ?? {}).some(
  activity => activity.flags?.[manifest.id]?.action === "choose-devil-worshipper-ability"
)) {
  errors.push("Devil Worshipper ability choice action is missing");
}
const devilGlaive = featuresByIdentifier.get("devilish-glaive");
const devilGlaiveActions = Object.values(devilGlaive?.system?.activities ?? {})
  .map(activity => activity.flags?.[manifest.id]?.action)
  .filter(Boolean);
for (const action of ["summon-devil-glaive", "roll-devil-glaive-damage", "roll-devil-glaive-grapple-damage"]) {
  if (!devilGlaiveActions.includes(action)) errors.push(`Missing Devil Worshipper glaive action: ${action}`);
}
const devilAura = featuresByIdentifier.get("aura-of-devastated-souls");
const devilAuraActions = Object.values(devilAura?.system?.activities ?? {})
  .map(activity => activity.flags?.[manifest.id]?.action)
  .filter(action => action === "gain-devil-soul-aura-temp-hp");
if (devilAuraActions.length !== 5) {
  errors.push(`Devil Worshipper aura must provide 5 temp HP activities, got ${devilAuraActions.length}`);
}
const nethereseArcanistFeatureDocuments = featureDocuments.filter(
  document => document.flags?.[manifest.id]?.nethereseArcanistFeature === true
);
if (nethereseArcanistFeatureDocuments.length !== 5) {
  errors.push(`Expected 5 Netherese Arcanist features, got ${nethereseArcanistFeatureDocuments.length}`);
}
for (const identifier of [
  "scholar-arcanist",
  "netherese-grimoire",
  "mini-mythal",
  "ancient-knowledge",
  "great-spells"
]) {
  const document = featuresByIdentifier.get(identifier);
  if (!document) {
    errors.push(`Missing Netherese Arcanist feature: ${identifier}`);
    continue;
  }
  if (document.flags?.[manifest.id]?.feature !== identifier) {
    errors.push(`Netherese Arcanist feature automation flag is missing: ${identifier}`);
  }
  if (!document.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push(`Netherese Arcanist automation description is missing: ${identifier}`);
  }
}
const miniMythal = featuresByIdentifier.get("mini-mythal");
const miniMythalActions = Object.values(miniMythal?.system?.activities ?? {})
  .map(activity => activity.flags?.[manifest.id]?.action)
  .filter(Boolean);
for (const action of ["activate-mini-mythal", "teleport-in-mini-mythal", "overload-mini-mythal"]) {
  if (!miniMythalActions.includes(action)) errors.push(`Missing Netherese Arcanist Mini-Mythal action: ${action}`);
}
const greatSpells = featuresByIdentifier.get("great-spells");
const greatSpellActions = Object.values(greatSpells?.system?.activities ?? {})
  .map(activity => activity.flags?.[manifest.id]?.action)
  .filter(action => action === "cast-netherese-great-spell");
if (greatSpellActions.length !== 7) {
  errors.push(`Netherese Arcanist Great Spells must provide 7 cast activities, got ${greatSpellActions.length}`);
}
for (const identifier of [
  "halved-ego",
  "pact-magic-spirit-vessel",
  "spirit-type",
  "concentrated-strike",
  "spirit-ability-improvement",
  "flow-state",
  "metaphysical-incarnation",
  "spirit-aberration",
  "spirit-celestial",
  "spirit-elemental-earth",
  "spirit-elemental-air",
  "spirit-elemental-fire",
  "spirit-elemental-water",
  "spirit-fey",
  "spirit-fiend",
  "spirit-undead"
]) {
  const document = featuresByIdentifier.get(identifier);
  if (!document) {
    errors.push(`Missing Spirit Vessel feature: ${identifier}`);
    continue;
  }
  if (document.flags?.[manifest.id]?.feature !== identifier) {
    errors.push(`Spirit Vessel feature automation flag is missing: ${identifier}`);
  }
  if (document.flags?.[manifest.id]?.spiritVesselFeature !== true) {
    errors.push(`Spirit Vessel feature marker is missing: ${identifier}`);
  }
  if (!document.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push(`Spirit Vessel automation description is missing: ${identifier}`);
  }
}
const oracleFeatureDocuments = featureDocuments.filter(
  document => document.flags?.[manifest.id]?.oracleFeature === true
);
if (oracleFeatureDocuments.length !== 5) {
  errors.push(`Expected 5 Oracle features, got ${oracleFeatureDocuments.length}`);
}
for (const identifier of [
  "influence-fates",
  "oracle-first-secret",
  "weaving-connections",
  "sense-fate",
  "oracle-great-secret"
]) {
  const document = featuresByIdentifier.get(identifier);
  if (!document) {
    errors.push(`Missing Oracle feature: ${identifier}`);
    continue;
  }
  if (document.flags?.[manifest.id]?.feature !== identifier) {
    errors.push(`Oracle feature automation flag is missing: ${identifier}`);
  }
  if (document.flags?.[manifest.id]?.oracleFeature !== true) {
    errors.push(`Oracle feature marker is missing: ${identifier}`);
  }
  if (!document.system.description?.value?.includes("Foundry:")) {
    errors.push(`Oracle automation description is missing: ${identifier}`);
  }
}
const demonologistFeatureDocuments = featureDocuments.filter(
  document => document.flags?.[manifest.id]?.demonologistFeature === true
);
if (demonologistFeatureDocuments.length !== 9) {
  errors.push(`Expected 9 Demonologist features, got ${demonologistFeatureDocuments.length}`);
}
for (const identifier of [
  "demon-charm",
  "infernal-familiar",
  "master-summoner",
  "dark-knowledge",
  "demonic-resistance",
  "demonic-vitality",
  "demonic-mind",
  "double-summon",
  "domination"
]) {
  const document = featuresByIdentifier.get(identifier);
  if (!document) {
    errors.push(`Missing Demonologist feature: ${identifier}`);
    continue;
  }
  if (document.flags?.[manifest.id]?.feature !== identifier) {
    errors.push(`Demonologist feature automation flag is missing: ${identifier}`);
  }
  if (document.flags?.[manifest.id]?.demonologistFeature !== true) {
    errors.push(`Demonologist feature marker is missing: ${identifier}`);
  }
  if (!document.system.description?.value?.includes("Foundry:")) {
    errors.push(`Demonologist automation description is missing: ${identifier}`);
  }
}
const demonicResistanceChanges = featuresByIdentifier.get("demonic-resistance")
  ?.effects?.flatMap(effect => effect.system?.changes ?? []) ?? [];
for (const [path, value] of [
  ["system.traits.dr.value", "fire"],
  ["system.traits.dr.value", "acid"],
  ["system.traits.di.value", "poison"],
  ["system.traits.ci.value", "poisoned"]
]) {
  if (!demonicResistanceChanges.some(change => change.key === path && change.value === value)) {
    errors.push(`Demonic Resistance passive change is missing: ${path} ${value}`);
  }
}
const demonicMindChanges = featuresByIdentifier.get("demonic-mind")
  ?.effects?.flatMap(effect => effect.system?.changes ?? []) ?? [];
if (!demonicMindChanges.some(change => change.key === "system.traits.dr.value" && change.value === "psychic")) {
  errors.push("Demonic Mind must add psychic resistance");
}
if (!demonicMindChanges.some(change => change.key === "system.attributes.senses.ranges.telepathy" && change.value === "60")) {
  errors.push("Demonic Mind must add 60 ft telepathy");
}
const sanguinistFeatureDocuments = featureDocuments.filter(
  document => document.flags?.[manifest.id]?.sanguinistFeature === true
);
if (sanguinistFeatureDocuments.length !== 19) {
  errors.push(`Expected 19 Sanguinist features, got ${sanguinistFeatureDocuments.length}`);
}
for (const identifier of [
  "sanguinist-blood-magic",
  "hematurgy",
  "sanguinist-spellcasting",
  "student-of-blood",
  "sanguine-power",
  "vital-restoration",
  "blood-compatibility",
  "my-own-blood",
  "blood-of-others",
  "ritual-sacrifice",
  "crimson-mastery",
  "arterial-puppetry",
  "blood-backlash",
  "bloodletting",
  "contusion",
  "crimson-fury",
  "sanguine-storm",
  "transfusion",
  "vampirism"
]) {
  const document = featuresByIdentifier.get(identifier);
  if (!document) {
    errors.push(`Missing Sanguinist feature: ${identifier}`);
    continue;
  }
  if (document.flags?.[manifest.id]?.feature !== identifier) {
    errors.push(`Sanguinist feature automation flag is missing: ${identifier}`);
  }
  if (document.flags?.[manifest.id]?.sanguinistFeature !== true) {
    errors.push(`Sanguinist feature marker is missing: ${identifier}`);
  }
  if (!document.system.description?.value?.includes("Foundry:")) {
    errors.push(`Sanguinist automation description is missing: ${identifier}`);
  }
}
const expectedKeeperSubclasses = new Map([
  ["keeper-golem-maker", ["golem", "golem-maker"]],
  ["keeper-myth-seeker", ["myth", "myth-seeker-keeper"]],
  ["keeper-spirit-medium", ["spirit", "spirit-medium-keeper"]],
  ["keeper-wild-tamer", ["wild", "wild-tamer-keeper"]]
]);
const keeperSubclassDocuments = subclassDocuments.filter(document => document.system.classIdentifier === "keeper");
if (keeperSubclassDocuments.length !== 4) {
  errors.push(`Expected 4 Keeper subclasses, got ${keeperSubclassDocuments.length}`);
}
for (const [identifier, [specialization, featureIdentifier]] of expectedKeeperSubclasses) {
  const document = subclassesByIdentifier.get(identifier);
  const featureDocument = featuresByIdentifier.get(featureIdentifier);
  if (!document) {
    errors.push(`Missing Keeper subclass: ${identifier}`);
    continue;
  }
  if (document.system.classIdentifier !== "keeper") {
    errors.push(`Keeper subclass ${identifier} must be attached to Keeper`);
  }
  if (document.flags?.[manifest.id]?.keeperSubclass !== specialization) {
    errors.push(`Keeper subclass automation flag is missing: ${identifier}`);
  }
  if (!document.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push(`Keeper subclass automation description is missing: ${identifier}`);
  }
  const expectedUuid = featureDocument
    ? `Compendium.${manifest.id}.features.Item.${featureDocument._id}`
    : "";
  const grantsFeature = (document.system.advancement ?? []).some(advancement =>
    advancement.type === "ItemGrant"
      && advancement.level === 1
      && advancement.configuration?.items?.some(item => item.uuid === expectedUuid)
  );
  if (!expectedUuid || !grantsFeature) {
    errors.push(`Keeper subclass ${identifier} must grant feature ${featureIdentifier} at level 1`);
  }
}
const expectedSpiritVesselSubclasses = new Map([
  ["spirit-vessel-aberration", ["aberration", "spirit-aberration"]],
  ["spirit-vessel-celestial", ["celestial", "spirit-celestial"]],
  ["spirit-vessel-elemental-earth", ["elemental-earth", "spirit-elemental-earth"]],
  ["spirit-vessel-elemental-air", ["elemental-air", "spirit-elemental-air"]],
  ["spirit-vessel-elemental-fire", ["elemental-fire", "spirit-elemental-fire"]],
  ["spirit-vessel-elemental-water", ["elemental-water", "spirit-elemental-water"]],
  ["spirit-vessel-fey", ["fey", "spirit-fey"]],
  ["spirit-vessel-fiend", ["fiend", "spirit-fiend"]],
  ["spirit-vessel-undead", ["undead", "spirit-undead"]]
]);
const spiritVesselSubclassDocuments = subclassDocuments.filter(document => document.system.classIdentifier === "spirit-vessel");
if (spiritVesselSubclassDocuments.length !== 9) {
  errors.push(`Expected 9 Spirit Vessel subclasses, got ${spiritVesselSubclassDocuments.length}`);
}
for (const [identifier, [spirit, featureIdentifier]] of expectedSpiritVesselSubclasses) {
  const document = subclassesByIdentifier.get(identifier);
  const featureDocument = featuresByIdentifier.get(featureIdentifier);
  if (!document) {
    errors.push(`Missing Spirit Vessel subclass: ${identifier}`);
    continue;
  }
  if (document.system.classIdentifier !== "spirit-vessel") {
    errors.push(`Spirit Vessel subclass ${identifier} must be attached to Spirit Vessel`);
  }
  if (document.flags?.[manifest.id]?.spiritVesselSubclass !== spirit) {
    errors.push(`Spirit Vessel subclass automation flag is missing: ${identifier}`);
  }
  if (!document.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push(`Spirit Vessel subclass automation description is missing: ${identifier}`);
  }
  const expectedUuid = featureDocument
    ? `Compendium.${manifest.id}.features.Item.${featureDocument._id}`
    : "";
  const grantsFeature = (document.system.advancement ?? []).some(advancement =>
    advancement.type === "ItemGrant"
      && advancement.level === 1
      && advancement.configuration?.items?.some(item => item.uuid === expectedUuid)
  );
  if (!expectedUuid || !grantsFeature) {
    errors.push(`Spirit Vessel subclass ${identifier} must grant feature ${featureIdentifier} at level 1`);
  }
}

const leaderFeatureDocuments = featureDocuments.filter(
  document => document.flags?.[manifest.id]?.leaderFeature === true
);
if (leaderFeatureDocuments.length !== 33) {
  errors.push(`Expected 33 Leader features, got ${leaderFeatureDocuments.length}`);
}
for (const document of leaderFeatureDocuments) {
  const identifier = document.system.identifier;
  if (document.flags?.[manifest.id]?.feature !== identifier) {
    errors.push(`Leader feature automation flag is missing: ${identifier}`);
  }
  if (!document.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push(`Leader automation description is missing: ${identifier}`);
  }
}
if (leaderFeatureDocuments.filter(document => document.flags?.[manifest.id]?.stratagem).length !== 17) {
  errors.push("Leader must provide 17 stratagems");
}
if (leaderFeatureDocuments.filter(document => document.flags?.[manifest.id]?.presence).length !== 6) {
  errors.push("Leader must provide 6 presences");
}
if (leaderFeatureDocuments.filter(document => document.flags?.[manifest.id]?.leadershipBenefit).length !== 4) {
  errors.push("Leader must provide 4 leadership expertise benefits");
}
if (!featuresByIdentifier.has("leader-presence")) {
  errors.push("Leader Presence summary feature is missing");
}

for (const identifier of ["death-run", "primal-reflexes"]) {
  const document = featuresByIdentifier.get(identifier);
  if (!document) {
    errors.push(`Missing Murderspawn passive feature: ${identifier}`);
    continue;
  }
  if (!document.effects?.some(effect => effect.flags?.[manifest.id]?.passiveEffect === true)) {
    errors.push(`Murderspawn passive effect is missing: ${identifier}`);
  }
}

const murderspawnFeatureDocuments = allItemDocuments.filter(
  document => document.flags?.[manifest.id]?.murderspawnFeature === true
);
if (murderspawnFeatureDocuments.length !== 19) {
  errors.push(`Expected 19 Murderspawn features, got ${murderspawnFeatureDocuments.length}`);
}
const murderspawnMain = transformationsByIdentifier.get("murderspawn-transformation");
if (!murderspawnMain) {
  errors.push("Murderspawn main transformation is missing");
} else {
  const levels = new Set((murderspawnMain.system.advancement ?? []).map(advancement => advancement.level));
  for (const level of [1, 6, 11, 16]) {
    if (!levels.has(level)) errors.push(`Murderspawn advancement level is missing: character level ${level}`);
  }
  const levelOneGrant = murderspawnMain.system.advancement.find(
    advancement => advancement.type === "ItemGrant" && advancement.level === 1
  );
  const levelOneCount = levelOneGrant?.configuration?.items?.length ?? 0;
  if (levelOneCount !== 3) errors.push(`Murderspawn level 1 must grant 3 starter items, got ${levelOneCount}`);
  for (const level of [6, 11, 16]) {
    const choice = murderspawnMain.system.advancement.find(
      advancement => advancement.type === "ItemChoice" && advancement.configuration?.choices?.[level]
    );
    if (!choice) errors.push(`Murderspawn boon choice is missing at character level ${level}`);
    const flaw = murderspawnMain.system.advancement.find(
      advancement => advancement.type === "ItemGrant" && advancement.level === level
    );
    if (!flaw) errors.push(`Murderspawn flaw grant is missing at character level ${level}`);
  }
  if (murderspawnMain.system.prerequisites?.level !== null) {
    errors.push("Murderspawn main transformation must not use class-level prerequisite");
  }
  const advancementJson = JSON.stringify(murderspawnMain.system.advancement ?? []);
  if (advancementJson.includes(`${manifest.id}.transformations.Item`)) {
    errors.push("Murderspawn main advancement must grant features from the features/equipment packs, not transformations");
  }
}
for (const document of murderspawnFeatureDocuments) {
  const level = document.flags?.[manifest.id]?.transformationLevel;
  if (document.system.identifier === "murderspawn-transformation") {
    if (level !== null) errors.push("Murderspawn overview must not be tied to a character level");
    continue;
  }
  if (![1, 2, 3, 4].includes(level)) {
    errors.push(`Murderspawn transformation level is missing: ${document.name}`);
  }
  if (document.system.prerequisites?.level !== null) {
    errors.push(`Murderspawn feature must not use character-level prerequisite: ${document.name}`);
  }
}
const deathRun = featuresByIdentifier.get("death-run");
const primalReflexes = featuresByIdentifier.get("primal-reflexes");
if (!deathRun?.effects?.some(effect => effect.system?.changes?.some(change =>
  change.key === "system.attributes.movement.walk" && change.phase === "final" && change.value === "10"
))) {
  errors.push("Death Run must add +10 walk speed in final phase");
}
if (!primalReflexes?.effects?.some(effect => effect.system?.changes?.some(change =>
  change.key === "system.attributes.init.bonus" && change.phase === "final" && change.value === "10"
))) {
  errors.push("Primal Reflexes must add +10 initiative in final phase");
}

const automationSource = [
  await readFile(path.join(root, "scripts", "automation.mjs"), "utf8"),
  await readTextFilesRecursive(path.join(root, "scripts", "automation"))
].join("\n");
const registeredActions = getAutomationActionHandlers();
for (const document of featureDocuments) {
  for (const activity of Object.values(document.system?.activities ?? {})) {
    const action = activity.flags?.[manifest.id]?.action;
    if (action && typeof registeredActions.get(action) !== "function") {
      errors.push(`Feature ${document.system?.identifier ?? document.name} has unhandled activity action: ${action}`);
    }
  }
}
for (const [hook, handler] of MIDI_QOL_HOOKS) {
  if (typeof getMidiHookHandlers()[handler] !== "function") errors.push(`Missing registered Midi-QOL handler ${handler} for ${hook}`);
}
for (const token of [
  "syncMurderspawnPassiveEffects",
  "system.attributes.movement.walk",
  "system.attributes.init.bonus",
  "MURDERSPAWN_PASSIVE"
]) {
  if (!automationSource.includes(token)) errors.push(`Murderspawn runtime automation is missing token: ${token}`);
}

for (const identifier of ["negative-body", "fortified-soul"]) {
  const document = featuresByIdentifier.get(identifier);
  if (!document) {
    errors.push(`Missing Hollow passive feature: ${identifier}`);
    continue;
  }
  if (!document.effects?.some(effect => effect.flags?.[manifest.id]?.passiveEffect === true)) {
    errors.push(`Hollow passive effect is missing: ${identifier}`);
  }
}

const hollowFeatureDocuments = allItemDocuments.filter(
  document => document.flags?.[manifest.id]?.hollowFeature === true
);
if (hollowFeatureDocuments.length !== 19) {
  errors.push(`Expected 19 Hollow features, got ${hollowFeatureDocuments.length}`);
}
const hollowMain = transformationsByIdentifier.get("hollow-transformation");
if (!hollowMain) {
  errors.push("Hollow main transformation is missing");
} else {
  const levels = new Set((hollowMain.system.advancement ?? []).map(advancement => advancement.level));
  for (const level of [1, 6, 11, 16]) {
    if (!levels.has(level)) errors.push(`Hollow advancement level is missing: character level ${level}`);
  }
  const levelOneGrant = hollowMain.system.advancement.find(
    advancement => advancement.type === "ItemGrant" && advancement.level === 1
  );
  const levelOneCount = levelOneGrant?.configuration?.items?.length ?? 0;
  if (levelOneCount !== 3) errors.push(`Hollow level 1 must grant 3 starter items, got ${levelOneCount}`);
  for (const level of [6, 11, 16]) {
    const choice = hollowMain.system.advancement.find(
      advancement => advancement.type === "ItemChoice" && advancement.configuration?.choices?.[level]
    );
    if (!choice) errors.push(`Hollow boon choice is missing at character level ${level}`);
    const flaw = hollowMain.system.advancement.find(
      advancement => advancement.type === "ItemGrant" && advancement.level === level
    );
    if (!flaw) errors.push(`Hollow flaw grant is missing at character level ${level}`);
  }
  if (hollowMain.system.prerequisites?.level !== null) {
    errors.push("Hollow main transformation must not use class-level prerequisite");
  }
  const advancementJson = JSON.stringify(hollowMain.system.advancement ?? []);
  if (advancementJson.includes(`${manifest.id}.transformations.Item`)) {
    errors.push("Hollow main advancement must grant features from the features pack, not transformations");
  }
}
for (const document of hollowFeatureDocuments) {
  const level = document.flags?.[manifest.id]?.transformationLevel;
  if (document.system.identifier === "hollow-transformation") {
    if (level !== null) errors.push("Hollow overview must not be tied to a character level");
    continue;
  }
  if (![1, 2, 3, 4].includes(level)) {
    errors.push(`Hollow transformation level is missing: ${document.name}`);
  }
  if (document.system.prerequisites?.level !== null) {
    errors.push(`Hollow feature must not use character-level prerequisite: ${document.name}`);
  }
}

const negativeBody = featuresByIdentifier.get("negative-body");
const fortifiedSoul = featuresByIdentifier.get("fortified-soul");
if (!negativeBody?.effects?.some(effect => {
  const changes = effect.system?.changes ?? [];
  return changes.some(change => change.key === "system.abilities.con.value" && change.value === "2")
    && changes.some(change => change.key === "system.abilities.wis.value" && change.value === "1");
})) {
  errors.push("Negative Body must include CON +2 and WIS +1 passive changes");
}
if (!fortifiedSoul?.effects?.some(effect => effect.flags?.[manifest.id]?.passiveEffect === true)) {
  errors.push("Fortified Soul must include the passive effect enabling its source-based resistance");
}

const magicEradicator = featuresByIdentifier.get("magic-eradicator");
const magicEradicatorActions = Object.values(magicEradicator?.system?.activities ?? {})
  .map(activity => activity.flags?.[manifest.id]?.action)
  .filter(Boolean);
for (const action of ["gain-hollow-charge", "use-hollow-charges"]) {
  if (!magicEradicatorActions.includes(action)) errors.push(`Missing Hollow charge activity action: ${action}`);
}
for (const token of [
  "syncHollowPassiveEffects",
  "useHollowCharges",
  "gainHollowCharge",
  "system.abilities.con.value",
  "HOLLOW_PASSIVE"
]) {
  if (!automationSource.includes(token)) errors.push(`Hollow runtime automation is missing token: ${token}`);
}
for (const token of [
  "witchBladeClass",
  "syncWitchBladeRage",
  "useWitchBladeRage",
  "openImmaterialWhirlwind",
  "use-witch-blade-rage",
  "witchBladePrerequisiteFailures"
]) {
  if (!automationSource.includes(token)) errors.push(`Witch Blade runtime automation is missing token: ${token}`);
}
for (const token of [
  "guardianClass",
  "syncGuardianResources",
  "guardianPrerequisiteFailures",
  "validateGuardianFeaturePrerequisites"
]) {
  if (!automationSource.includes(token)) errors.push(`Guardian runtime automation is missing token: ${token}`);
}
for (const token of [
  "crusaderClass",
  "syncCrusaderResources",
  "activateCrusaderRage",
  "useCrusaderConsecration",
  "crusaderPrerequisiteFailures",
  "validateCrusaderFeaturePrerequisites"
]) {
  if (!automationSource.includes(token)) errors.push(`Crusader runtime automation is missing token: ${token}`);
}
for (const token of [
  "feyWarriorClass",
  "syncFeyWarriorPassiveEffects",
  "syncFeyWarriorResources",
  "applyFeyWarriorDamageAutomation",
  "feyWarriorPrerequisiteFailures",
  "validateFeyWarriorFeaturePrerequisites"
]) {
  if (!automationSource.includes(token)) errors.push(`Fey Warrior runtime automation is missing token: ${token}`);
}
for (const token of [
  "ghostWalkerClass",
  "syncGhostWalkerPassiveEffects",
  "syncGhostWalkerResources",
  "activateSpiritForm",
  "endSpiritForm",
  "ghostWalkerPrerequisiteFailures",
  "validateGhostWalkerFeaturePrerequisites",
  "GHOST_WALKER_PASSIVE",
  "SPIRIT_FORM_EFFECT"
]) {
  if (!automationSource.includes(token)) errors.push(`Ghost Walker runtime automation is missing token: ${token}`);
}
for (const token of [
  "blinkerClass",
  "syncBlinkerResources",
  "useInnerBlink",
  "useOuterBlink",
  "activateSidewaysShift",
  "applyBlinkerDamageAutomation",
  "blinkerPrerequisiteFailures",
  "validateBlinkerFeaturePrerequisites",
  "BLINKER_SIDE_SHIFT_EFFECT"
]) {
  if (!automationSource.includes(token)) errors.push(`Blinker runtime automation is missing token: ${token}`);
}
for (const token of [
  "fallenPriestClass",
  "syncFallenPriestSpellcasting",
  "applyFallenPriestSpellProgression",
  "fallenPriestPrerequisiteFailures",
  "validateFallenPriestFeaturePrerequisites",
  "FALLEN_PRIEST_ORIGINAL_PREPARATION"
]) {
  if (!automationSource.includes(token)) errors.push(`Fallen Priest runtime automation is missing token: ${token}`);
}
for (const token of [
  "plagueDoctorClass",
  "syncPlagueDoctorResources",
  "rollPlagueSneakAttack",
  "createSmartInfection",
  "clearSmartInfections",
  "activateDiseaseForm",
  "plagueDoctorPrerequisiteFailures",
  "validatePlagueDoctorFeaturePrerequisites",
  "SMART_INFECTION_EFFECT",
  "DISEASE_FORM_EFFECT"
]) {
  if (!automationSource.includes(token)) errors.push(`Plague Doctor runtime automation is missing token: ${token}`);
}
for (const token of [
  "insectLordClass",
  "syncInsectLordResources",
  "syncInsectLordPassiveEffects",
  "rollInsectTailSting",
  "rollInsectBoneBlades",
  "rollInsectSpew",
  "detachCrawlingEye",
  "insectLordPrerequisiteFailures",
  "validateInsectLordFeaturePrerequisites",
  "INSECT_LORD_PASSIVE",
  "CREEPING_EYE_EFFECT"
]) {
  if (!automationSource.includes(token)) errors.push(`Insect Lord runtime automation is missing token: ${token}`);
}
for (const token of [
  "gamblerClass",
  "syncGamblerResources",
  "drawAstralCard",
  "useHeldAstralCard",
  "dealThem",
  "storeSleevedCard",
  "acesBeat",
  "gamblerPrerequisiteFailures",
  "validateGamblerFeaturePrerequisites",
  "GAMBLER_HELD_CARD_EFFECT",
  "GAMBLER_SLEEVED_CARD_EFFECT",
  "GAMBLER_ACES_COOLDOWN_EFFECT"
]) {
  if (!automationSource.includes(token)) errors.push(`Gambler runtime automation is missing token: ${token}`);
}
for (const token of [
  "keeperClass",
  "keeperAllyPoints",
  "syncKeeperResources",
  "syncKeeperAllyPoints",
  "rollKeeperAllyStrike",
  "rollKeeperRestRecovery",
  "rollKeeperMightDamage",
  "keeperPrerequisiteFailures",
  "keeperSubclassPrerequisiteFailures",
  "validateKeeperSubclassPrerequisites",
  "validateKeeperFeaturePrerequisites"
]) {
  if (!automationSource.includes(token)) errors.push(`Keeper runtime automation is missing token: ${token}`);
}
for (const token of [
  "bloodMageClass",
  "bloodMagePrerequisiteFailures",
  "validateBloodMageFeaturePrerequisites",
  "applyBloodMagicCost",
  "validateBloodMagicCostUse",
  "clearBloodMagicCosts",
  "rollBloodMageSacrifice",
  "BLOOD_MAGIC_COST_EFFECT"
]) {
  if (!automationSource.includes(token)) errors.push(`Blood Mage runtime automation is missing token: ${token}`);
}
for (const token of [
  "onmyojiClass",
  "onmyojiPrerequisiteFailures",
  "validateOnmyojiFeaturePrerequisites",
  "syncOnmyojiResources",
  "useOnmyojiKi",
  "validateOnmyojiKiUse"
]) {
  if (!automationSource.includes(token)) errors.push(`Onmyoji runtime automation is missing token: ${token}`);
}
for (const token of [
  "ritualistClass",
  "ritualistRitualPoints",
  "syncRitualistResources",
  "useRitualistRitualPoints",
  "validateRitualistRitualPointUse",
  "ritualistPrerequisiteFailures",
  "validateRitualistFeaturePrerequisites",
  "rollRitualistSpiritAgony",
  "showRitualistSpiritChannel"
]) {
  if (!automationSource.includes(token)) errors.push(`Ritualist runtime automation is missing token: ${token}`);
}
for (const token of [
  "darkWarriorClass",
  "darkWarriorPrerequisiteFailures",
  "validateDarkWarriorFeaturePrerequisites",
  "syncDarkWarriorResources",
  "applyBlackMagicOil",
  "drinkDarkWarriorElixir",
  "applyDarkWarriorDamageAutomation",
  "DARK_WARRIOR_OIL_EFFECT",
  "DARK_WARRIOR_ELIXIR_EFFECT"
]) {
  if (!automationSource.includes(token)) errors.push(`Dark Warrior runtime automation is missing token: ${token}`);
}
for (const token of [
  "devilWorshipperClass",
  "devilWorshipperPrerequisiteFailures",
  "validateDevilWorshipperFeaturePrerequisites",
  "chooseDevilWorshipperAbility",
  "applyHellfireDamageAutomation",
  "applyHellfireFury",
  "summonDevilGlaive",
  "rollDevilGlaiveDamage",
  "gainDevilSoulAuraTempHp",
  "DEVIL_WORSHIPPER_ABILITY",
  "DEVIL_GLAIVE_EFFECT"
]) {
  if (!automationSource.includes(token)) errors.push(`Devil Worshipper runtime automation is missing token: ${token}`);
}
for (const token of [
  "nethereseArcanistClass",
  "nethereseArcanistPrerequisiteFailures",
  "validateNethereseArcanistFeaturePrerequisites",
  "activateMiniMythal",
  "overloadMiniMythal",
  "useAncientKnowledge",
  "castNethereseGreatSpell",
  "NETHERIL_MINI_MYTHAL_EFFECT",
  "NETHERIL_WEAVE_SEVERED_EFFECT"
]) {
  if (!automationSource.includes(token)) errors.push(`Netherese Arcanist runtime automation is missing token: ${token}`);
}
for (const token of [
  "oracleClass",
  "syncOracleResources",
  "syncOraclePassiveEffects",
  "oraclePrerequisiteFailures",
  "validateOracleFeaturePrerequisites",
  "ORACLE_DISSONANCE",
  "ORACLE_PASSIVE"
]) {
  if (!automationSource.includes(token)) errors.push(`Oracle runtime automation is missing token: ${token}`);
}
for (const token of [
  "demonologistClass",
  "demonologistPrerequisiteFailures",
  "validateDemonologistFeaturePrerequisites",
  "activateDemonicVitality",
  "beginDemonologistTurn",
  "DEMONOLOGIST_VITALITY_EFFECT"
]) {
  if (!automationSource.includes(token)) errors.push(`Demonologist runtime automation is missing token: ${token}`);
}
for (const token of [
  "sanguinistClass",
  "sanguinistPrerequisiteFailures",
  "validateSanguinistFeaturePrerequisites",
  "syncSanguinistResources",
  "clearSanguinistRestState",
  "SANGUINIST_BLOOD_POINTS",
  "SANGUINIST_CRIMSON_FURY_EFFECT"
]) {
  if (!automationSource.includes(token)) errors.push(`Sanguinist runtime automation is missing token: ${token}`);
}

const schoolOfSteelFeatureDocuments = featureDocuments.filter(
  document => document.flags?.[manifest.id]?.schoolOfSteelFeature === true
);
if (schoolOfSteelFeatureDocuments.length !== 7) {
  errors.push(`Expected 7 School of Steel features, got ${schoolOfSteelFeatureDocuments.length}`);
}
for (const document of schoolOfSteelFeatureDocuments) {
  const identifier = document.system.identifier;
  if (document.flags?.[manifest.id]?.feature !== identifier) {
    errors.push(`School of Steel feature automation flag is missing: ${identifier}`);
  }
  if (!document.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push(`School of Steel automation description is missing: ${identifier}`);
  }
}
for (const identifier of [
  "steel-battle-training",
  "steel-crippling-strikes",
  "steel-master-of-metal",
  "steel-signature-technique",
  "steel-storm",
  "steel-imperial-reach",
  "steel-metalist"
]) {
  if (!featuresByIdentifier.has(identifier)) errors.push(`School of Steel feature is missing: ${identifier}`);
}
const steelBattleTraining = featuresByIdentifier.get("steel-battle-training");
const steelBattleActions = Object.values(steelBattleTraining?.system?.activities ?? {})
  .map(activity => activity.flags?.[manifest.id]?.action)
  .filter(Boolean);
for (const action of ["school-steel-choose-weapons", "school-steel-bonus-attack"]) {
  if (!steelBattleActions.includes(action)) errors.push(`Missing School of Steel battle training action: ${action}`);
}
const steelMetalist = featuresByIdentifier.get("steel-metalist");
if (!steelMetalist?.effects?.some(effect => effect.system?.changes?.some(change =>
  change.key === "system.traits.armorProf.value" && change.value === "hvy"
))) {
  errors.push("Metalist must include heavy armor proficiency passive effect");
}
for (const token of [
  "schoolOfSteelSubclass",
  "syncSchoolOfSteel",
  "chooseSchoolSteelWeapons",
  "school-steel-choose-weapons",
  "school-steel-bonus-attack",
  "SCHOOL_STEEL_WEAPONS"
]) {
  if (!automationSource.includes(token)) errors.push(`School of Steel runtime automation is missing token: ${token}`);
}

const deathKnightFeatureDocuments = featureDocuments.filter(
  document => document.flags?.[manifest.id]?.deathKnightFeature === true
);
if (deathKnightFeatureDocuments.length !== 6) {
  errors.push(`Expected 6 Death Knight features, got ${deathKnightFeatureDocuments.length}`);
}
for (const document of deathKnightFeatureDocuments) {
  const identifier = document.system.identifier;
  if (document.flags?.[manifest.id]?.feature !== identifier) {
    errors.push(`Death Knight feature automation flag is missing: ${identifier}`);
  }
  if (!document.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push(`Death Knight automation description is missing: ${identifier}`);
  }
}
for (const identifier of ["undead-nature", "death-knight-magic-resistance", "strong-undead"]) {
  const document = featuresByIdentifier.get(identifier);
  if (!document?.effects?.length) errors.push(`Death Knight transfer effect is missing: ${identifier}`);
}

const hereticFeatureDocuments = featureDocuments.filter(
  document => document.flags?.[manifest.id]?.hereticFeature === true
);
if (hereticFeatureDocuments.length !== 73) {
  errors.push(`Expected 73 Heretic features, got ${hereticFeatureDocuments.length}`);
}

const forestLordFeatureDocuments = featureDocuments.filter(
  document => document.flags?.[manifest.id]?.forestLordFeature === true
);
if (forestLordFeatureDocuments.length !== 9) {
  errors.push(`Expected 9 Forest Lord features, got ${forestLordFeatureDocuments.length}`);
}
for (const document of forestLordFeatureDocuments) {
  const identifier = document.system.identifier;
  if (document.flags?.[manifest.id]?.feature !== identifier) {
    errors.push(`Forest Lord feature automation flag is missing: ${identifier}`);
  }
  if (!document.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push(`Forest Lord automation description is missing: ${identifier}`);
  }
}
for (const identifier of ["forest-barkskin", "oak-heart"]) {
  const document = featuresByIdentifier.get(identifier);
  if (!document?.effects?.length) errors.push(`Forest Lord transfer effect is missing: ${identifier}`);
}
for (const [identifier, key] of [
  ["forest-barkskin", "system.attributes.ac.bonus"],
  ["monster-reflexes", "system.attributes.movement.walk"]
]) {
  const document = featuresByIdentifier.get(identifier);
  const change = document?.effects
    ?.flatMap(effect => effect.system?.changes ?? [])
    .find(candidate => candidate.key === key);
  if (change?.phase !== "final") {
    errors.push(`${identifier} must apply ${key} during the final Active Effect phase`);
  }
}
for (const document of featureDocuments) {
  for (const effect of document.effects ?? []) {
    if (effect.flags?.[manifest.id]?.passiveEffect !== true) {
      errors.push(`Passive effect marker is missing: ${document.system.identifier}/${effect.name}`);
    }
    if (effect.transfer !== false) {
      errors.push(`Module passive effect must be materialized on the actor: ${document.system.identifier}/${effect.name}`);
    }
  }
}

const spellDocuments = [...allDocuments.values()]
  .filter(entry => entry.pack === "spells")
  .map(entry => entry.document);
const treeHealing = spellDocuments.find(document => document.system.identifier === "tree-healing");
if (!treeHealing) {
  errors.push("Tree Healing spell is missing");
} else {
  if (treeHealing.type !== "spell" || treeHealing.system.level !== 2) {
    errors.push("Tree Healing must be a 2nd-level spell");
  }
  if (treeHealing.system.preparation?.mode !== "always") {
    errors.push("Tree Healing must always be prepared");
  }
  if (treeHealing.flags?.[manifest.id]?.forestLordSpell !== true) {
    errors.push("Tree Healing automation flag is missing");
  }
}
const witchBladeSpellDocuments = spellDocuments.filter(document => document.flags?.[manifest.id]?.witchBladeSpell === true);
if (witchBladeSpellDocuments.length !== 10) {
  errors.push(`Expected 10 Witch Blade spells, got ${witchBladeSpellDocuments.length}`);
}
for (const identifier of [
  "deus-ex-ferrum",
  "avenging-flame",
  "gate-of-infinity",
  "feather-of-judgement",
  "jaws-of-the-star-devourer",
  "chaos-bolt-witch",
  "blood-lance",
  "hint",
  "gift-of-chaos",
  "cacophonic-scream"
]) {
  if (!spellDocuments.some(document => document.system.identifier === identifier)) {
    errors.push(`Witch Blade spell is missing: ${identifier}`);
  }
}
const bloodMageSpellDocuments = spellDocuments.filter(document => document.flags?.[manifest.id]?.bloodMageSpell === true);
if (bloodMageSpellDocuments.length !== 2) {
  errors.push(`Expected 2 Blood Mage spells, got ${bloodMageSpellDocuments.length}`);
}
for (const [identifier, level] of [
  ["blood-transfer-spell", 3],
  ["blood-thrall-spell", 5]
]) {
  const document = spellDocuments.find(document => document.system.identifier === identifier);
  if (!document) {
    errors.push(`Blood Mage spell is missing: ${identifier}`);
    continue;
  }
  if (document.system.level !== level) errors.push(`Blood Mage spell ${identifier} must be level ${level}`);
  if (document.flags?.[manifest.id]?.bloodMageSpell !== true) {
    errors.push(`Blood Mage spell automation flag is missing: ${identifier}`);
  }
}
const nethereseGreatSpellDocuments = spellDocuments.filter(document => document.flags?.[manifest.id]?.nethereseGreatSpell === true);
if (nethereseGreatSpellDocuments.length !== 7) {
  errors.push(`Expected 7 Netherese Arcanist great spells, got ${nethereseGreatSpellDocuments.length}`);
}
for (const identifier of [
  "proctivs-floating-island",
  "amaunators-eternal-sun",
  "fiery-cataract",
  "diluvial-torrent",
  "horrible-drought",
  "tolodines-killing-wind",
  "beast-of-a-thousand-legs"
]) {
  const document = spellDocuments.find(document => document.system.identifier === identifier);
  if (!document) {
    errors.push(`Netherese Arcanist great spell is missing: ${identifier}`);
    continue;
  }
  if (document.system.level !== 9) errors.push(`Netherese Arcanist great spell ${identifier} must be stored as level 9 for dnd5e compatibility`);
  if (document.flags?.[manifest.id]?.nethereseGreatSpell !== true) {
    errors.push(`Netherese Arcanist great spell automation flag is missing: ${identifier}`);
  }
}
for (const document of hereticFeatureDocuments) {
  const identifier = document.system.identifier;
  if (document.flags?.[manifest.id]?.feature !== identifier) {
    errors.push(`Heretic feature automation flag is missing: ${identifier}`);
  }
  if (!document.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push(`Heretic automation description is missing: ${identifier}`);
  }
}
if (hereticFeatureDocuments.filter(document => document.flags?.[manifest.id]?.vilePower).length !== 37) {
  errors.push("Heretic must provide 37 vile powers");
}
if (hereticFeatureDocuments.filter(document => document.flags?.[manifest.id]?.corruptionMark).length !== 12) {
  errors.push("Heretic must provide 12 corruption marks");
}
if (hereticFeatureDocuments.filter(document => document.flags?.[manifest.id]?.forbiddenTalent).length !== 9) {
  errors.push("Heretic must provide 9 forbidden talents");
}
if (hereticFeatureDocuments.filter(document => document.flags?.[manifest.id]?.distortion).length !== 10) {
  errors.push("Heretic must provide 10 distorted body choices");
}

const aberrantFeatureDocuments = featureDocuments.filter(
  document => document.flags?.[manifest.id]?.aberrantFeature === true
);
if (aberrantFeatureDocuments.length !== 15) {
  errors.push(`Expected 15 Aberrant features, got ${aberrantFeatureDocuments.length}`);
}
if (aberrantFeatureDocuments.filter(document => document.flags?.[manifest.id]?.unnaturalTrait).length !== 6) {
  errors.push("Aberrant must provide 6 unnatural traits");
}
for (const document of aberrantFeatureDocuments) {
  const identifier = document.system.identifier;
  if (document.flags?.[manifest.id]?.feature !== identifier) {
    errors.push(`Aberrant feature automation flag is missing: ${identifier}`);
  }
  if (!document.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push(`Aberrant automation description is missing: ${identifier}`);
  }
}

const witchBladeFeatureDocuments = featureDocuments.filter(
  document => document.flags?.[manifest.id]?.witchBladeFeature === true
);
if (witchBladeFeatureDocuments.length !== 12) {
  errors.push(`Expected 12 Witch Blade features, got ${witchBladeFeatureDocuments.length}`);
}
for (const document of witchBladeFeatureDocuments) {
  const identifier = document.system.identifier;
  if (document.flags?.[manifest.id]?.feature !== identifier) {
    errors.push(`Witch Blade feature automation flag is missing: ${identifier}`);
  }
  if (!document.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push(`Witch Blade automation description is missing: ${identifier}`);
  }
}
if (witchBladeFeatureDocuments.filter(document => document.flags?.[manifest.id]?.greatDesign).length !== 6) {
  errors.push("Witch Blade must provide 6 Great Design choices");
}

const expectedClassFeatureLinks = new Map([
  ["crusher", [
    "great-weapon-style",
    "giant-killer",
    "crusher-techniques",
    "momentum",
    "steel-will",
    "steel-giant"
  ]],
  ["leader", [
    "leader-command-stratagems",
    "moment-of-glory",
    "glimpse-of-genius",
    "leadership-expertise",
    "perfect-coordination",
    "leader-presence"
  ]],
  ["death-knight", [
    "mystical-power",
    "undead-nature",
    "death-knight-magic-resistance",
    "strong-undead",
    "battle-undead",
    "death-knight-extra-attack"
  ]],
  ["heretic", [
    "occult-gifts",
    "marked-by-corruption",
    "vile-powers",
    "forbidden-talent",
    "distorted-body"
  ]],
  ["forest-lord", [
    "tree-kindred",
    "nature-magic",
    "nature-sense",
    "forest-barkskin",
    "oak-strength",
    "spruce-growth",
    "oak-heart",
    "forest-might",
    "take-root"
  ]],
  ["aberrant", [
    "deadly-precision",
    "monster-reflexes",
    "arcane-sense",
    "toxic-blood",
    "vigorous-nature",
    "final-changes"
  ]],
  ["witch-blade", [
    "witch-blade-spellcasting",
    "witch-hunter",
    "dead-zone",
    "witch-blade-seal",
    "great-design",
    "immaterial-whirlwind"
  ]],
  ["guardian", [
    "guardian-calling",
    "guardian-mark",
    "protection-specialization",
    "endure-pain",
    "powerful-retribution",
    "steadfastness",
    "powerful-retribution-improved",
    "guardian-unyielding"
  ]],
  ["crusader", [
    "crusader-miracles",
    "crusader-rage",
    "crusader-aegis",
    "divine-devotion",
    "consecration",
    "condemnation"
  ]],
  ["fey-warrior", [
    "fey-transformation",
    "fey-warrior-cantrips",
    "call-of-feywild",
    "charming-defense",
    "chimeric-weapon",
    "permanent-manifestation",
    "fey-magic",
    "fey-skin"
  ]],
  ["ghost-walker", [
    "touched-by-death",
    "spirit-form",
    "possession",
    "ghost-step",
    "otherworldly-presence",
    "drain-soul",
    "kindred-spirit",
    "unfinished-business"
  ]],
  ["blinker", [
    "inner-blink",
    "turnaround-blink",
    "sideways-shift",
    "blinking-step",
    "improved-technique",
    "blinking-wrist",
    "outer-blink",
    "shift-sense",
    "disappearance",
    "miraculous-homecoming"
  ]],
  ["fallen-priest", [
    "fallen-priest-heretic",
    "fallen-priest-spellcasting",
    "fallen-priest-turn-undead",
    "divine-resistance",
    "absorb-power",
    "divine-copying",
    "arcane-copying"
  ]],
  ["plague-doctor", [
    "plague-sneak-attack",
    "disease-carrier",
    "ragged-armor",
    "touch-of-disease",
    "smart-infection",
    "infect-wounds",
    "disease-form"
  ]],
  ["insect-lord", [
    "chitinous-carapace",
    "insect-familiar",
    "insect-natural-weapons",
    "blood-drain",
    "crawling-armor",
    "spew-insects",
    "swarm-mind",
    "crawling-eye"
  ]],
  ["gambler", [
    "astral-deck",
    "deal-them",
    "rogues-are-lucky",
    "up-the-sleeve",
    "aces-beat"
  ]],
  ["keeper", [
    "keeper-ward-and-warded",
    "keeper-ally-talents",
    "strategy-and-synergy",
    "united-and-protected",
    "rest-and-recovery",
    "might-and-magic"
  ]],
  ["blood-mage", [
    "blood-mage-spellcasting",
    "blood-magic",
    "flesh-canvas",
    "feast-of-the-fallen",
    "blood-transfer",
    "sanguine-fortitude",
    "blood-mage-sacrifice",
    "blood-thrall",
    "maleficar",
    "sanguine-strength"
  ]],
  ["onmyoji", [
    "onmyoji-ki",
    "shikigami-talisman",
    "purification-rite",
    "shikigami-ghost-hunter",
    "spirit-place",
    "spirit-alcohol",
    "spirit-book",
    "spirit-fire",
    "spirit-food",
    "spirit-mountain",
    "spirit-steel",
    "spirit-water",
    "spirit-wood",
    "spirit-wealth",
    "spirit-wind"
  ]],
  ["ritualist", [
    "binding-ritual",
    "spirit-sight",
    "mind-body-and-soul",
    "protective-ritual",
    "spirit-channel",
    "ethereal-wanderer"
  ]],
  ["dark-warrior", [
    "black-magic-oil",
    "black-magic-elixir",
    "improved-black-oil",
    "improved-black-elixir",
    "dark-resistance",
    "blackening-weapon"
  ]],
  ["devil-worshipper", [
    "devil-spellcasting-ability",
    "hellfire",
    "imp-familiar",
    "devil-sight",
    "dark-luck",
    "quiet-whisper",
    "empowered-charms",
    "hellfire-fury",
    "devilish-glaive",
    "aura-of-devastated-souls"
  ]],
  ["netherese-arcanist", [
    "scholar-arcanist",
    "netherese-grimoire",
    "mini-mythal",
    "ancient-knowledge",
    "great-spells"
  ]],
  ["spirit-vessel", [
    "halved-ego",
    "pact-magic-spirit-vessel",
    "spirit-type",
    "concentrated-strike",
    "spirit-ability-improvement",
    "flow-state",
    "metaphysical-incarnation"
  ]],
  ["oracle", [
    "influence-fates",
    "oracle-first-secret",
    "weaving-connections",
    "sense-fate",
    "oracle-great-secret"
  ]],
  ["demonologist", [
    "demon-charm",
    "infernal-familiar",
    "master-summoner",
    "dark-knowledge",
    "demonic-resistance",
    "demonic-vitality",
    "demonic-mind",
    "double-summon",
    "domination"
  ]],
  ["sanguinist", [
    "sanguinist-blood-magic",
    "hematurgy",
    "sanguinist-spellcasting",
    "student-of-blood",
    "sanguine-power",
    "vital-restoration",
    "blood-compatibility",
    "ritual-sacrifice",
    "crimson-mastery"
  ]]
]);
for (const [classIdentifier, featureIdentifiers] of expectedClassFeatureLinks) {
  const classDocument = classesByIdentifier.get(classIdentifier);
  const description = classDocument?.system.description?.value ?? "";
  for (const featureIdentifier of featureIdentifiers) {
    const featureDocument = featuresByIdentifier.get(featureIdentifier);
    const expectedUuid = featureDocument
      ? `@UUID[Compendium.${manifest.id}.features.Item.${featureDocument._id}]`
      : "";
    if (!expectedUuid || !description.includes(expectedUuid)) {
      errors.push(`Class ${classIdentifier} is missing description link to ${featureIdentifier}`);
    }
  }
}
const keeperClassDescription = keeperClass?.system.description?.value ?? "";
for (const identifier of [
  "keeper-golem-maker",
  "keeper-myth-seeker",
  "keeper-spirit-medium",
  "keeper-wild-tamer"
]) {
  const document = subclassesByIdentifier.get(identifier);
  const expectedUuid = document
    ? `@UUID[Compendium.${manifest.id}.subclasses.Item.${document._id}]`
    : "";
  if (!expectedUuid || !keeperClassDescription.includes(expectedUuid)) {
    errors.push(`Keeper class is missing description link to subclass ${identifier}`);
  }
}
const spiritVesselClassDescription = spiritVesselClass?.system.description?.value ?? "";
for (const identifier of [
  "spirit-vessel-aberration",
  "spirit-vessel-celestial",
  "spirit-vessel-elemental-earth",
  "spirit-vessel-elemental-air",
  "spirit-vessel-elemental-fire",
  "spirit-vessel-elemental-water",
  "spirit-vessel-fey",
  "spirit-vessel-fiend",
  "spirit-vessel-undead"
]) {
  const document = subclassesByIdentifier.get(identifier);
  const expectedUuid = document
    ? `@UUID[Compendium.${manifest.id}.subclasses.Item.${document._id}]`
    : "";
  if (!expectedUuid || !spiritVesselClassDescription.includes(expectedUuid)) {
    errors.push(`Spirit Vessel class is missing description link to subclass ${identifier}`);
  }
}
const bloodMageClassDescription = bloodMageClass?.system.description?.value ?? "";
for (const identifier of ["blood-transfer-spell", "blood-thrall-spell"]) {
  const document = spellDocuments.find(document => document.system.identifier === identifier);
  const expectedUuid = document
    ? `@UUID[Compendium.${manifest.id}.spells.Item.${document._id}]`
    : "";
  if (!expectedUuid || !bloodMageClassDescription.includes(expectedUuid)) {
    errors.push(`Blood Mage class is missing description link to spell ${identifier}`);
  }
}
const nethereseArcanistClassDescription = nethereseArcanistClass?.system.description?.value ?? "";
for (const identifier of [
  "proctivs-floating-island",
  "amaunators-eternal-sun",
  "fiery-cataract",
  "diluvial-torrent",
  "horrible-drought",
  "tolodines-killing-wind",
  "beast-of-a-thousand-legs"
]) {
  const document = spellDocuments.find(document => document.system.identifier === identifier);
  const expectedUuid = document
    ? `@UUID[Compendium.${manifest.id}.spells.Item.${document._id}]`
    : "";
  if (!expectedUuid || !nethereseArcanistClassDescription.includes(expectedUuid)) {
    errors.push(`Netherese Arcanist class is missing description link to spell ${identifier}`);
  }
}

const requiredActions = new Map([
  ["great-weapon-style", "toggle-gwm"],
  ["cleaving", "set-style-cleaving"],
  ["crushing", "set-style-crushing"],
  ["steel-will", "arm-steel-will"],
  ["steel-giant", "sync-steel-giant"],
  ["adaptability", "toggle-style"],
  ["smithing", "smithing"],
  ["glimpse-of-genius", "arm-glimpse-of-genius"],
  ["crusader-rage", "activate-crusader-rage"],
  ["consecration", "use-crusader-consecration"],
  ["spirit-form", "activate-spirit-form"],
  ["inner-blink", "use-inner-blink"],
  ["sideways-shift", "activate-sideways-shift"],
  ["outer-blink", "use-outer-blink"],
  ["fallen-priest-spellcasting", "sync-fallen-priest-spellcasting"],
  ["plague-sneak-attack", "roll-plague-sneak-attack"],
  ["smart-infection", "create-smart-infection"],
  ["disease-form", "activate-disease-form"],
  ["insect-natural-weapons", "roll-insect-tail-sting"],
  ["blood-drain", "roll-insect-blood-drain"],
  ["crawling-armor", "use-crawling-armor"],
  ["spew-insects", "roll-insect-spew"],
  ["crawling-eye", "detach-crawling-eye"],
  ["astral-deck", "draw-astral-card"],
  ["deal-them", "deal-them"],
  ["rogues-are-lucky", "rogues-are-lucky"],
  ["up-the-sleeve", "store-sleeved-card"],
  ["aces-beat", "aces-beat"],
  ["keeper-ward-and-warded", "sync-keeper-ally-points"],
  ["rest-and-recovery", "roll-keeper-rest-recovery"],
  ["might-and-magic", "roll-keeper-might-damage"],
  ["blood-magic", "apply-blood-magic-cost"],
  ["blood-mage-sacrifice", "roll-blood-mage-sacrifice"],
  ["onmyoji-ki", "sync-onmyoji-resources"],
  ["binding-ritual", "sync-ritualist-resources"],
  ["spirit-channel", "show-ritualist-spirit-channel"],
  ["black-magic-oil", "apply-black-magic-oil"],
  ["black-magic-elixir", "drink-dark-warrior-elixir"],
  ["devil-spellcasting-ability", "choose-devil-worshipper-ability"],
  ["dark-luck", "show-dark-luck"],
  ["empowered-charms", "show-empowered-charms"],
  ["devilish-glaive", "summon-devil-glaive"],
  ["aura-of-devastated-souls", "gain-devil-soul-aura-temp-hp"],
  ["scholar-arcanist", "show-scholar-arcanist"],
  ["mini-mythal", "activate-mini-mythal"],
  ["ancient-knowledge", "use-ancient-knowledge"],
  ["great-spells", "cast-netherese-great-spell"],
  ["pact-magic-spirit-vessel", "choose-spirit-vessel-ability"],
  ["concentrated-strike", "roll-spirit-vessel-concentrated-strike"],
  ["spirit-ability-improvement", "show-spirit-vessel-ability-improvement"],
  ["flow-state", "activate-spirit-flow"],
  ["spirit-aberration", "spirit-vessel-aberration-charm"],
  ["spirit-fey", "spirit-vessel-fey-charm"],
  ["spirit-fiend", "spirit-vessel-fiend-flames"],
  ["spirit-undead", "spirit-vessel-undead-frighten"],
  ["influence-fates", "sync-oracle-resources"],
  ["oracle-first-secret", "oracle-free-scrying"],
  ["weaving-connections", "oracle-remove-dissonance-slot"],
  ["sense-fate", "oracle-danger"],
  ["oracle-great-secret", "oracle-astral-projection"],
  ["demon-charm", "show-demonologist-demon-charm"],
  ["infernal-familiar", "show-demonologist-infernal-familiar"],
  ["master-summoner", "use-demonologist-master-summoner"],
  ["dark-knowledge", "cast-demonologist-protection"],
  ["demonic-vitality", "activate-demonic-vitality"],
  ["demonic-mind", "cast-demonologist-detect-thoughts"],
  ["double-summon", "use-demonologist-double-summon"],
  ["domination", "show-demonologist-domination"],
  ["sanguinist-blood-magic", "sync-sanguinist-resources"],
  ["hematurgy", "use-hematurgy"],
  ["sanguinist-spellcasting", "show-sanguinist-spellcasting"],
  ["student-of-blood", "cast-blood-reading"],
  ["sanguine-power", "sanguine-power-hit-die"],
  ["vital-restoration", "show-vital-restoration"],
  ["blood-compatibility", "show-blood-compatibility"],
  ["my-own-blood", "use-my-own-blood-recovery"],
  ["blood-of-others", "gain-sanguinist-blood-points-others"],
  ["ritual-sacrifice", "show-ritual-sacrifice"],
  ["arterial-puppetry", "use-arterial-puppetry"],
  ["blood-backlash", "use-blood-backlash"],
  ["bloodletting", "use-bloodletting"],
  ["contusion", "use-contusion"],
  ["crimson-fury", "use-crimson-fury"],
  ["sanguine-storm", "use-sanguine-storm"],
  ["transfusion", "use-transfusion"],
  ["vampirism", "use-vampirism"]
]);
for (const [identifier, action] of requiredActions) {
  const document = featuresByIdentifier.get(identifier);
  const actions = Object.values(document?.system?.activities ?? {})
    .map(activity => activity.flags?.[manifest.id]?.action);
  if (!actions.includes(action)) errors.push(`Missing activity action ${action} on ${identifier}`);
}

const occultGift = featuresByIdentifier.get("occult-gifts");
const occultActions = Object.values(occultGift?.system?.activities ?? {})
  .map(activity => activity.flags?.[manifest.id]?.action);
for (const action of ["choose-occult-ability", "use-occult-points"]) {
  if (!occultActions.includes(action)) errors.push(`Missing activity action ${action} on occult-gifts`);
}

const oracleRequiredActions = new Map([
  ["influence-fates", ["sync-oracle-resources", "oracle-fate-miss", "oracle-mysterious-guidance", "oracle-balancing-ritual"]],
  ["oracle-first-secret", ["oracle-free-scrying", "oracle-read-threads"]],
  ["weaving-connections", ["oracle-remove-dissonance-slot", "oracle-restore-slot-dissonance"]],
  ["sense-fate", ["oracle-danger"]],
  ["oracle-great-secret", ["oracle-astral-projection", "oracle-exchange-fates", "oracle-fate-scissors"]]
]);
for (const [identifier, expectedActions] of oracleRequiredActions) {
  const document = featuresByIdentifier.get(identifier);
  const actions = Object.values(document?.system?.activities ?? {})
    .map(activity => activity.flags?.[manifest.id]?.action);
  for (const action of expectedActions) {
    if (!actions.includes(action)) errors.push(`Missing Oracle activity action ${action} on ${identifier}`);
  }
}

const demonologistRequiredActions = new Map([
  ["demon-charm", ["show-demonologist-demon-charm"]],
  ["infernal-familiar", ["show-demonologist-infernal-familiar"]],
  ["master-summoner", ["use-demonologist-master-summoner"]],
  ["dark-knowledge", ["cast-demonologist-protection", "cast-demonologist-spirit-guardians"]],
  ["demonic-vitality", ["activate-demonic-vitality"]],
  ["demonic-mind", ["cast-demonologist-detect-thoughts"]],
  ["double-summon", ["use-demonologist-double-summon"]],
  ["domination", ["show-demonologist-domination"]]
]);
for (const [identifier, expectedActions] of demonologistRequiredActions) {
  const document = featuresByIdentifier.get(identifier);
  const actions = Object.values(document?.system?.activities ?? {})
    .map(activity => activity.flags?.[manifest.id]?.action);
  for (const action of expectedActions) {
    if (!actions.includes(action)) errors.push(`Missing Demonologist activity action ${action} on ${identifier}`);
  }
}

const sanguinistRequiredActions = new Map([
  ["sanguinist-blood-magic", ["sync-sanguinist-resources", "gain-sanguinist-blood-point", "spend-sanguinist-blood-points"]],
  ["hematurgy", ["use-hematurgy"]],
  ["sanguinist-spellcasting", ["show-sanguinist-spellcasting"]],
  ["student-of-blood", ["cast-blood-reading", "mark-sanguinist-blood-spell"]],
  ["sanguine-power", ["sanguine-power-hit-die", "sanguine-power-blood-point"]],
  ["vital-restoration", ["show-vital-restoration"]],
  ["blood-compatibility", ["show-blood-compatibility"]],
  ["my-own-blood", ["use-my-own-blood-recovery"]],
  ["blood-of-others", ["gain-sanguinist-blood-points-others"]],
  ["ritual-sacrifice", ["show-ritual-sacrifice"]],
  ["arterial-puppetry", ["use-arterial-puppetry"]],
  ["blood-backlash", ["use-blood-backlash"]],
  ["bloodletting", ["use-bloodletting"]],
  ["contusion", ["use-contusion"]],
  ["crimson-fury", ["use-crimson-fury"]],
  ["sanguine-storm", ["use-sanguine-storm"]],
  ["transfusion", ["use-transfusion"]],
  ["vampirism", ["use-vampirism"]]
]);
for (const [identifier, expectedActions] of sanguinistRequiredActions) {
  const document = featuresByIdentifier.get(identifier);
  const actions = Object.values(document?.system?.activities ?? {})
    .map(activity => activity.flags?.[manifest.id]?.action);
  for (const action of expectedActions) {
    if (!actions.includes(action)) errors.push(`Missing Sanguinist activity action ${action} on ${identifier}`);
  }
}

const forestRequiredActions = new Map([
  ["nature-magic", ["choose-forest-base-class"]],
  ["oak-strength", ["forest-unarmed-damage"]],
  ["take-root", ["take-root", "withdraw-roots"]]
]);
for (const [identifier, expectedActions] of forestRequiredActions) {
  const document = featuresByIdentifier.get(identifier);
  const actions = Object.values(document?.system?.activities ?? {})
    .map(activity => activity.flags?.[manifest.id]?.action);
  for (const action of expectedActions) {
    if (!actions.includes(action)) errors.push(`Missing activity action ${action} on ${identifier}`);
  }
}

const aberrantRequiredActions = new Map([
  ["deadly-precision", "arm-deadly-precision"],
  ["vigorous-nature", "vigorous-nature"]
]);
for (const [identifier, action] of aberrantRequiredActions) {
  const document = featuresByIdentifier.get(identifier);
  const actions = Object.values(document?.system?.activities ?? {})
    .map(activity => activity.flags?.[manifest.id]?.action);
  if (!actions.includes(action)) errors.push(`Missing activity action ${action} on ${identifier}`);
}

const witchBladeRequiredActions = new Map([
  ["witch-hunter", "activate-witch-hunter-empower"],
  ["dead-zone", "use-witch-blade-rage"],
  ["witch-blade-seal", "use-witch-blade-rage"],
  ["witch-crystallization", "activate-witch-crystallization"],
  ["ethereal-push", "use-witch-blade-rage"],
  ["ethereal-storm", "activate-ethereal-storm"],
  ["immaterial-whirlwind", "open-immaterial-whirlwind"]
]);
for (const [identifier, action] of witchBladeRequiredActions) {
  const document = featuresByIdentifier.get(identifier);
  const actions = Object.values(document?.system?.activities ?? {})
    .map(activity => activity.flags?.[manifest.id]?.action);
  if (!actions.includes(action)) errors.push(`Missing activity action ${action} on ${identifier}`);
}

const equipmentDocuments = [...allDocuments.values()]
  .filter(entry => entry.pack === "equipment")
  .map(entry => entry.document);
const massiveWeapons = equipmentDocuments.filter(document => document.flags?.[manifest.id]?.massiveWeapon === true);
const murderspawnWeapons = equipmentDocuments.filter(document => document.flags?.[manifest.id]?.murderspawnWeapon === true);
if (massiveWeapons.length !== 5) errors.push(`Expected 5 massive weapons, got ${massiveWeapons.length}`);
if (murderspawnWeapons.length !== 3) errors.push(`Expected 3 Murderspawn weapons, got ${murderspawnWeapons.length}`);

for (const document of massiveWeapons) {
  if (!document.flags?.[manifest.id]?.weaponKey) {
    errors.push(`Weapon automation key is missing: ${document.name}`);
  }
  if (!document.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push(`Weapon automation description is missing: ${document.name}`);
  }
}

for (const document of murderspawnWeapons) {
  if (!document.system.identifier?.startsWith("murderspawn-claws-")) {
    errors.push(`Murderspawn weapon identifier is invalid: ${document.name}`);
  }
  if (!document.system.description?.value?.includes("Формы убийцы")) {
    errors.push(`Murderspawn weapon description is missing transformation context: ${document.name}`);
  }
}

if (errors.length) {
  console.error("Validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Validation passed", documentCounts);
}
