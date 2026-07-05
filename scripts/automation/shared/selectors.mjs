import { itemIdentifier } from "./helpers.mjs";

export function classByIdentifier(actor, identifier) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === identifier);
}

export function classLevel(actor, identifier) {
  return Number(classByIdentifier(actor, identifier)?.system?.levels ?? 0);
}

export function crusherClass(actor) {
  return classByIdentifier(actor, "crusher");
}

export function crusherLevel(actor) {
  return classLevel(actor, "crusher");
}

export function leaderClass(actor) {
  return classByIdentifier(actor, "leader");
}

export function leaderLevel(actor) {
  return classLevel(actor, "leader");
}

export function paladinClass(actor) {
  return classByIdentifier(actor, "paladin");
}

export function paladinLevel(actor) {
  return classLevel(actor, "paladin");
}

export function deathKnightClass(actor) {
  return classByIdentifier(actor, "death-knight");
}

export function deathKnightLevel(actor) {
  return classLevel(actor, "death-knight");
}

export function hereticClass(actor) {
  return classByIdentifier(actor, "heretic");
}

export function hereticLevel(actor) {
  return classLevel(actor, "heretic");
}

export function forestLordClass(actor) {
  return classByIdentifier(actor, "forest-lord");
}

export function forestLordLevel(actor) {
  return classLevel(actor, "forest-lord");
}

export function druidClass(actor) {
  return classByIdentifier(actor, "druid");
}

export function rangerClass(actor) {
  return classByIdentifier(actor, "ranger");
}

export function aberrantClass(actor) {
  return classByIdentifier(actor, "aberrant");
}

export function aberrantLevel(actor) {
  return classLevel(actor, "aberrant");
}

export function witchBladeClass(actor) {
  return classByIdentifier(actor, "witch-blade");
}

export function witchBladeLevel(actor) {
  return classLevel(actor, "witch-blade");
}

export function wizardClass(actor) {
  return classByIdentifier(actor, "wizard");
}

export function wizardLevel(actor) {
  return classLevel(actor, "wizard");
}

export function schoolOfSteelSubclass(actor) {
  return actor?.items?.find(item => item.type === "subclass" && itemIdentifier(item) === "school-of-steel");
}

export function schoolOfSteelLevel(actor) {
  return schoolOfSteelSubclass(actor) ? wizardLevel(actor) : 0;
}
