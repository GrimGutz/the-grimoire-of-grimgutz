// Checks for GM request handlers (registerGmRequest).
//
// The relay only guarantees that the requester owns the request's owner actor.
// Every other uuid in `data` comes from the player's client and can name any
// document in the world. Resolve them through these helpers so a request can
// only make the GM act on documents the rules allow. Never trust effect data,
// change lists, flags or roll results sent in `data`: rebuild them on the GM.
import { t } from "./i18n.mjs";

/** The actor a document belongs to: itself for an actor, the owning actor for items, activities, effects and tokens. */
export function documentActor(document) {
  if (!document) return null;
  if (document.documentName === "Actor") return document;
  if (document.documentName === "Token") return document.actor ?? null;
  const parent = document.parent;
  return (
    document.actor ??
    document.item?.actor ??
    (parent?.documentName === "Actor" ? parent : (parent?.actor ?? parent?.parent?.actor ?? null)) ??
    null
  );
}

async function resolve(uuid) {
  return typeof uuid === "string" && uuid ? await fromUuid(uuid) : null;
}

/** Resolve `uuid` to a document of `actor` (the actor itself, or something it owns); throw `message` otherwise. */
export async function requireOwned(uuid, actor, message = t("Requests.NotOwned")) {
  const document = await resolve(uuid);
  if (!document || !actor?.uuid || documentActor(document)?.uuid !== actor.uuid) throw Error(message);
  return document;
}

/** Whether `actor` has a token on `scene` (its own token for a synthetic actor, a linked token otherwise). */
export function actorOnScene(actor, scene) {
  if (!actor || !scene) return false;
  if (actor.isToken) return actor.token?.parent?.id === scene.id;
  return [...(scene.tokens ?? [])].some(token => token.actorLink && token.actorId === actor.id);
}

/** Resolve `uuid` to a token document, optionally on `scene`; throw `message` otherwise. */
export async function requireToken(uuid, { scene = null, message = t("Requests.TokenMissing") } = {}) {
  const token = await resolve(uuid);
  if (token?.documentName !== "Token" || !token.actor || (scene && token.parent?.id !== scene.id)) throw Error(message);
  return token;
}

/** Resolve up to `max` token uuids on `scene`, rejecting duplicates and anything that is not a token there. */
export async function requireTokens(uuids, { scene, max = 50, message = t("Requests.TargetsMissing") } = {}) {
  if (!Array.isArray(uuids) || !uuids.length || uuids.length > max || new Set(uuids).size !== uuids.length)
    throw Error(message);
  const tokens = [];
  for (const uuid of uuids) tokens.push(await requireToken(uuid, { scene, message }));
  return tokens;
}

/** A plain string of at most `max` characters, or `fallback`. */
export function boundedText(value, max = 200, fallback = "") {
  return typeof value === "string" ? value.slice(0, max) : fallback;
}

/** A finite number clamped to [min, max], or `fallback` when it is not a number. */
export function boundedNumber(value, min, max, fallback = min) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}
