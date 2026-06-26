import { existsSync } from "node:fs";
import { access, cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ClassicLevel } from "classic-level";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const foundryPublic = "C:\\Program Files\\Foundry Virtual Tabletop\\resources\\app\\public";
const manifest = JSON.parse(await readFile(path.join(root, "module.json"), "utf8"));
const errors = [];

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

if (documentCounts.classes !== 9) errors.push(`Expected 9 prestige classes, got ${documentCounts.classes ?? 0}`);
if (documentCounts.subclasses !== 1) errors.push(`Expected 1 subclass, got ${documentCounts.subclasses ?? 0}`);
if (documentCounts.features !== 225) errors.push(`Expected 225 features, got ${documentCounts.features ?? 0}`);
if (documentCounts.transformations !== 2) errors.push(`Expected 2 transformations, got ${documentCounts.transformations ?? 0}`);
if (documentCounts.spells !== 11) errors.push(`Expected 11 spells, got ${documentCounts.spells ?? 0}`);
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

const recommendedModules = new Set(manifest.relationships?.recommends?.map(relationship => relationship.id));
for (const moduleId of ["midi-qol", "dae", "itemacro"]) {
  if (!recommendedModules.has(moduleId)) errors.push(`Missing recommended module relationship: ${moduleId}`);
}

const packFolders = new Map((manifest.packFolders ?? []).map(folder => [folder.name, folder]));
const playerFolderPacks = packFolders.get("Игроку")?.packs ?? [];
const gmFolderPacks = packFolders.get("Мастеру")?.packs ?? [];
for (const packName of ["classes", "subclasses", "transformations", "equipment", "spells"]) {
  if (!playerFolderPacks.includes(packName)) errors.push(`Player pack folder is missing pack: ${packName}`);
}
for (const packName of ["features", "bestiary"]) {
  if (!gmFolderPacks.includes(packName)) errors.push(`GM pack folder is missing pack: ${packName}`);
}

const classDocuments = [...allDocuments.values()]
  .filter(entry => entry.document.type === "class")
  .map(entry => entry.document);
const subclassDocuments = [...allDocuments.values()]
  .filter(entry => entry.document.type === "subclass")
  .map(entry => entry.document);
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
if (!fortifiedSoul?.effects?.some(effect => effect.system?.changes?.some(change =>
  change.key === "system.traits.dr.value" && change.value === "spell"
))) {
  errors.push("Fortified Soul must include custom spell damage resistance marker");
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
  "use-witch-blade-rage",
  "witchBladePrerequisiteFailures"
]) {
  if (!automationSource.includes(token)) errors.push(`Witch Blade runtime automation is missing token: ${token}`);
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

const requiredActions = new Map([
  ["great-weapon-style", "toggle-gwm"],
  ["cleaving", "set-style-cleaving"],
  ["crushing", "set-style-crushing"],
  ["steel-will", "arm-steel-will"],
  ["steel-giant", "sync-steel-giant"],
  ["adaptability", "toggle-style"],
  ["smithing", "smithing"],
  ["glimpse-of-genius", "arm-glimpse-of-genius"]
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
  ["witch-hunter", "use-witch-blade-rage"],
  ["dead-zone", "use-witch-blade-rage"],
  ["witch-blade-seal", "use-witch-blade-rage"],
  ["ethereal-push", "use-witch-blade-rage"],
  ["ethereal-storm", "use-witch-blade-rage"],
  ["immaterial-whirlwind", "use-witch-blade-rage"]
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
