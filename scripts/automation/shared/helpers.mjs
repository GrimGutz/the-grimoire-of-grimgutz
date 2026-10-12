import { MODULE_ID, SETTINGS } from "./constants.mjs";

export const AUTOMATION_CONFIG_VERSION = 1;

export function enabled() {
  return game.settings.get(MODULE_ID, SETTINGS.AUTOMATION);
}

function rawAutomationFlags(documentOrFlags) {
  if (!documentOrFlags) return {};
  if (documentOrFlags[MODULE_ID]) return documentOrFlags[MODULE_ID] ?? {};
  if (
    documentOrFlags.automation
    || documentOrFlags.schemaVersion
    || documentOrFlags.action
    || documentOrFlags.moduleAction
    || documentOrFlags.feature
    || documentOrFlags.prestigeClass
    || documentOrFlags.transformation
  ) return documentOrFlags;
  return documentOrFlags.flags?.[MODULE_ID] ?? {};
}

function automationActionId(flags = {}) {
  return flags.action ?? flags.moduleAction ?? flags.automation?.action?.id ?? "";
}

function inferAutomationKind(flags = {}) {
  if (automationActionId(flags)) return "activity";
  if (flags.passiveEffect === true) return "effect";
  if (flags.prestigeClass) return "prestige-class";
  if (flags.wizardSubclass || flags.keeperSubclass || flags.spiritVesselSubclass || flags.masterSubclass) return "subclass";
  if (flags.transformation && flags.transformationFeature !== true) return "transformation";
  if (flags.transformationFeature === true || flags.hollowFeature === true || flags.murderspawnFeature === true) return "transformation-feature";
  if (flags.massiveWeapon === true || flags.murderspawnWeapon === true || flags.weaponKey) return "equipment";
  if (flags.forestLordSpell || flags.witchBladeSpell || flags.bloodMageSpell || flags.nethereseGreatSpell) return "spell";
  if (flags.feature) return "feature";
  return "document";
}

function inferAutomationId(flags = {}) {
  return automationActionId(flags)
    || flags.feature
    || flags.prestigeClass
    || flags.wizardSubclass
    || flags.keeperSubclass
    || flags.spiritVesselSubclass
    || flags.masterSubclass
    || flags.transformation
    || flags.weaponKey
    || "";
}

function automationTags(flags = {}) {
  return Object.entries(flags)
    .filter(([key, value]) => value === true && key !== "automation")
    .map(([key]) => key)
    .sort();
}

function automationRequirements(flags = {}) {
  const requirements = {};
  if (flags.minimumLevel !== undefined && flags.minimumLevel !== null) requirements.minimumLevel = Number(flags.minimumLevel);
  if (flags.transformationLevel !== undefined && flags.transformationLevel !== null) requirements.transformationLevel = Number(flags.transformationLevel);
  if (flags.prerequisiteLevel !== undefined && flags.prerequisiteLevel !== null) requirements.prerequisiteLevel = Number(flags.prerequisiteLevel);
  return Object.fromEntries(Object.entries(requirements).filter(([_key, value]) => Number.isFinite(value)));
}

function legacyFlags(flags = {}) {
  return Object.fromEntries(Object.entries(flags).filter(([key]) => ![
    "automation",
    "automationConfig",
    "schemaVersion"
  ].includes(key)));
}

export function automationConfig(documentOrFlags) {
  const flags = rawAutomationFlags(documentOrFlags);
  const legacy = legacyFlags(flags);
  const existing = flags.automation && typeof flags.automation === "object" ? flags.automation : {};
  const action = automationActionId({ ...legacy, automation: existing });
  const actionData = action
    ? {
        ...(existing.action?.data ?? {}),
        ...Object.fromEntries(Object.entries(legacy).filter(([key]) => !["action", "moduleAction"].includes(key)))
      }
    : {};

  return {
    version: AUTOMATION_CONFIG_VERSION,
    kind: existing.kind ?? inferAutomationKind({ ...legacy, automation: existing }),
    id: existing.id ?? inferAutomationId({ ...legacy, automation: existing }),
    ...(action ? {
      action: {
        id: action,
        data: actionData
      }
    } : {}),
    document: {
      type: existing.document?.type ?? null,
      key: existing.document?.key ?? existing.id ?? inferAutomationId({ ...legacy, automation: existing }),
      feature: existing.document?.feature ?? legacy.feature ?? null,
      prestigeClass: existing.document?.prestigeClass ?? legacy.prestigeClass ?? null,
      subclass: existing.document?.subclass ?? legacy.wizardSubclass ?? legacy.keeperSubclass ?? legacy.spiritVesselSubclass ?? legacy.masterSubclass ?? null,
      transformation: existing.document?.transformation ?? legacy.transformation ?? null,
      equipment: existing.document?.equipment ?? legacy.weaponKey ?? null
    },
    requirements: {
      ...automationRequirements(legacy),
      ...(existing.requirements ?? {})
    },
    tags: [...new Set([...(existing.tags ?? []), ...automationTags(legacy)])].sort(),
    data: {
      ...(existing.data ?? {}),
      ...legacy
    }
  };
}

export function automationData(document) {
  const flags = rawAutomationFlags(document);
  // Normalize the original input, not its already-unwrapped flags. Transient
  // replay markers may be the only flags on a native activity clone; unwrapping
  // them again mistakes the flag payload for an untagged document and loses it.
  const config = automationConfig(document);
  return {
    ...(config.data ?? {}),
    ...(config.action?.data ?? {}),
    ...(config.action?.id ? {
      action: config.action.id,
      moduleAction: config.action.id
    } : {}),
    ...(config.document?.feature ? { feature: config.document.feature } : {}),
    ...(config.document?.prestigeClass ? { prestigeClass: config.document.prestigeClass } : {}),
    ...(config.document?.transformation ? { transformation: config.document.transformation } : {}),
    ...(config.requirements?.minimumLevel !== undefined ? { minimumLevel: config.requirements.minimumLevel } : {}),
    ...(config.requirements?.transformationLevel !== undefined ? { transformationLevel: config.requirements.transformationLevel } : {}),
    automation: config,
    schemaVersion: flags.schemaVersion ?? config.version
  };
}

export function automationAction(document) {
  return automationConfig(document).action?.id ?? "";
}

export function activityItem(activity) {
  return activity?.item ?? activity?.parent;
}

export function activityActor(activity) {
  return activity?.actor ?? activityItem(activity)?.actor;
}

export function itemIdentifier(item) {
  return String(item?.system?.identifier ?? "").toLowerCase();
}

export function hasFeature(actor, key) {
  return actor?.items?.some(item => {
    const data = automationData(item);
    return data.feature === key || itemIdentifier(item) === key;
  }) ?? false;
}

export function findFeature(actor, key) {
  return actor?.items?.find(item => {
    const data = automationData(item);
    return data.feature === key || itemIdentifier(item) === key;
  });
}

export function notify(message, type = "info") {
  ui.notifications?.[type]?.(message);
}

export function isAutomationAuthority(actor) {
  const activeGM = game.users?.activeGM;
  return activeGM ? activeGM.id === game.user.id : actor?.isOwner;
}

export function itemUses(item) {
  const maximum = Number(item?.system?.uses?.max ?? 0);
  const spent = Number(item?.system?.uses?.spent ?? 0);
  return {
    maximum: Number.isFinite(maximum) ? maximum : 0,
    spent: Number.isFinite(spent) ? spent : 0,
    remaining: Math.max(0, (Number.isFinite(maximum) ? maximum : 0) - (Number.isFinite(spent) ? spent : 0))
  };
}
