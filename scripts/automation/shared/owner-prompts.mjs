import { MODULE_ID } from "./constants.mjs";
import { choiceDialog, multiChoiceDialog, numberDialog } from "./dialogs.mjs";
import { isGmAuthority } from "./gm-requests.mjs";

const waiting = new Map(),
  answered = new Map();
let installed = false;
export function promptOwner(actor) {
  const players = [...(game.users ?? [])].filter(
    user => user.active && !user.isGM && actor.testUserPermission?.(user, "OWNER")
  );
  return (
    players.find(user => user.character?.uuid === actor.uuid) ??
    players.sort((a, b) => a.id.localeCompare(b.id))[0] ??
    game.users?.activeGM ??
    game.user
  );
}
async function show(prompt) {
  if (prompt.kind === "checkbox") return multiChoiceDialog(prompt);
  if (prompt.kind === "number") return numberDialog(prompt);
  return choiceDialog(prompt);
}
function validReply(prompt, value) {
  if (value == null) return true;
  if (prompt.kind === "number")
    return Number.isFinite(Number(value)) && Number(value) >= prompt.min && Number(value) <= prompt.max;
  const allowed = new Set(
    (prompt.choices ?? []).map(choice => String(Array.isArray(choice) ? choice[0] : choice.value))
  );
  if (prompt.kind === "checkbox")
    return (
      Array.isArray(value) &&
      value.length >= (prompt.min ?? 0) &&
      value.length <= (prompt.max ?? Infinity) &&
      new Set(value).size === value.length &&
      value.every(item => allowed.has(String(item)))
    );
  return allowed.has(String(value));
}
export async function receiveOwnerPrompt(payload, sender) {
  if (payload?.automationPromptReply) {
    const pending = waiting.get(payload.id);
    if (!pending || sender !== pending.userId || !validReply(pending.prompt, payload.value)) return;
    clearTimeout(pending.timer);
    waiting.delete(payload.id);
    pending.resolve(payload.value);
    return;
  }
  if (!payload?.automationPrompt || payload.recipient !== game.user.id || sender !== game.users?.activeGM?.id) return;
  const actor = await fromUuid(payload.actorUuid);
  if (!actor?.testUserPermission?.(game.user, "OWNER")) return;
  if (!answered.has(payload.id))
    answered.set(
      payload.id,
      show(payload.prompt).catch(() => null)
    );
  const value = await answered.get(payload.id);
  game.socket.emit(`module.${MODULE_ID}`, { automationPromptReply: true, id: payload.id, value });
  if (answered.size > 200) answered.delete(answered.keys().next().value);
}
export function installOwnerPromptHooks() {
  if (installed || !game.socket) return;
  installed = true;
  game.socket.on(`module.${MODULE_ID}`, (payload, sender) => {
    void receiveOwnerPrompt(payload, sender).catch(error => console.error(`${MODULE_ID} | Owner prompt failed`, error));
  });
}
export async function askOwner(actor, prompt, { id = foundry.utils.randomID(), timeoutMs = 90000 } = {}) {
  const owner = promptOwner(actor);
  if (owner.id === game.user.id) return show(prompt);
  if (!isGmAuthority()) throw Error("Запрос чужому владельцу выполняет активный GM.");
  installOwnerPromptHooks();
  if (waiting.has(id)) return waiting.get(id).promise;
  let resolve;
  const promise = new Promise(done => {
    resolve = done;
  });
  const timer = setTimeout(() => {
    waiting.delete(id);
    resolve(null);
  }, timeoutMs);
  waiting.set(id, { userId: owner.id, prompt, resolve, promise, timer });
  game.socket.emit(`module.${MODULE_ID}`, {
    automationPrompt: true,
    id,
    actorUuid: actor.uuid,
    recipient: owner.id,
    prompt
  });
  return promise;
}
export async function confirmOwner(actor, title, hint = "", options) {
  return (
    (await askOwner(
      actor,
      {
        title,
        label: hint,
        choices: [
          ["yes", "Применить"],
          ["no", "Отказаться"]
        ],
        defaultValue: "no"
      },
      options
    )) === "yes"
  );
}
export async function chooseSceneTokens(actor, scene, { title, min = 1, max = 1, exclude = [], relation = null } = {}) {
  const owner = promptOwner(actor);
  const tokens = [...(scene.tokens ?? [])].filter(
    token =>
      token.actor &&
      !exclude.includes(token.uuid) &&
      (!token.hidden || owner.isGM || token.actor.testUserPermission?.(owner, "OWNER")) &&
      (!relation || relation(token))
  );
  const choices = tokens.map(token => [token.uuid, token.name ?? token.actor.name]);
  const selected = await askOwner(actor, { kind: "checkbox", title, label: "Получатели", choices, min, max });
  return selected == null ? null : selected.map(uuid => tokens.find(token => token.uuid === uuid));
}
