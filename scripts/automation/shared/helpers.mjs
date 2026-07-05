import { MODULE_ID, SETTINGS } from "./constants.mjs";

export function enabled() {
  return game.settings.get(MODULE_ID, SETTINGS.AUTOMATION);
}

export function automationData(document) {
  return document?.flags?.[MODULE_ID] ?? {};
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
