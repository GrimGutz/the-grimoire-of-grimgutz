import { access, cp, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ClassicLevel } from "classic-level";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(root, "module.json"), "utf8"));
const errors = [];

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
      for await (const [key, value] of db.iterator()) {
        if (!key.startsWith("!items!")) continue;
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

if (documentCounts.classes !== 6) errors.push(`Expected 6 classes, got ${documentCounts.classes ?? 0}`);
if (documentCounts.features !== 151) errors.push(`Expected 151 features, got ${documentCounts.features ?? 0}`);
if (documentCounts.spells !== 1) errors.push(`Expected 1 spell, got ${documentCounts.spells ?? 0}`);
if (documentCounts.equipment !== 5) errors.push(`Expected 5 weapons, got ${documentCounts.equipment ?? 0}`);

const recommendedModules = new Set(manifest.relationships?.recommends?.map(relationship => relationship.id));
for (const moduleId of ["midi-qol", "dae", "itemacro"]) {
  if (!recommendedModules.has(moduleId)) errors.push(`Missing recommended module relationship: ${moduleId}`);
}

const classDocuments = [...allDocuments.values()]
  .filter(entry => entry.document.type === "class")
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
  if (!["class", "feat"].includes(document.type)) continue;
  const description = document.system.description?.value ?? "";
  for (const match of description.matchAll(/@UUID\[([^\]]+)\]/g)) {
    const uuid = match[1];
    if (uuid.startsWith(`Compendium.${manifest.id}.`) && !itemUuids.has(uuid)) {
      errors.push(`Broken description UUID on ${document.name}: ${uuid}`);
    }
  }
}

for (const classDocument of classDocuments) {
  for (const advancement of classDocument.system.advancement) {
    const uuids = [
      ...(advancement.configuration?.items ?? []).map(item => item.uuid),
      ...(advancement.configuration?.pool ?? []).map(item => item.uuid)
    ];
    for (const uuid of uuids) {
      if (!itemUuids.has(uuid) && !uuid.startsWith("Compendium.dnd5e.")) {
        errors.push(`Broken advancement UUID: ${uuid}`);
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

for (const entry of [...allDocuments.values()].filter(entry => entry.pack === "equipment")) {
  const document = entry.document;
  if (document.flags?.[manifest.id]?.massiveWeapon !== true) {
    errors.push(`Massive weapon flag is missing: ${document.name}`);
  }
  if (!document.flags?.[manifest.id]?.weaponKey) {
    errors.push(`Weapon automation key is missing: ${document.name}`);
  }
  if (!document.system.description?.value?.includes("Автоматизация Foundry:")) {
    errors.push(`Weapon automation description is missing: ${document.name}`);
  }
}

if (errors.length) {
  console.error("Validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Validation passed", documentCounts);
}
