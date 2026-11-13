import { MODULE_ID } from "./constants.mjs";
import { notify } from "./helpers.mjs";

const handlers = new Map();
const pending = new Map();
const completed = new Map();
const replies = new Map();
const localRequests = new Map();
let localGame;
let installed = false;
const resultReply = (result, requestId) =>
  result === true
    ? { status: "success", value: true, requestId }
    : result === false
      ? { status: "cancelled", value: false, requestId }
      : result === undefined
        ? { status: "needs-review", requestId }
        : { ...result, requestId };

export function registerGmRequest(type, handler) {
  handlers.set(type, handler);
}
export function gmRequestResult(requestId) {
  return replies.get(requestId) ?? { requestId, status: "pending" };
}
export function isGmAuthority() {
  return game.users?.activeGM ? game.users.activeGM.id === game.user?.id : game.user?.isGM === true;
}

export async function receiveGmRequest(payload, senderUserId) {
  if (payload?.recipientUserId) {
    if (payload.recipientUserId !== game.user?.id || !game.users?.get?.(senderUserId)?.isGM) return;
    const waiting = pending.get(payload.requestId);
    if (!waiting || senderUserId !== waiting.gmId) return;
    replies.set(payload.requestId, payload.result);
    clearTimeout(waiting.timer);
    pending.delete(payload.requestId);
    waiting.resolve(payload.result);
    if (waiting.timedOut)
      notify(
        payload.result.status === "success" ? "Отложенный запрос выполнен." : "Отложенный запрос завершился ошибкой.",
        payload.result.status === "success" ? "info" : "warn"
      );
    return;
  }
  const handler = handlers.get(payload?.type);
  if (!handler || !isGmAuthority() || !payload.requestId) return;
  const requester = game.users?.get?.(senderUserId);
  if (!requester || payload.userId !== senderUserId) return;
  const gmId = game.user.id;
  let response = completed.get(payload.requestId);
  if (!response) {
    response = (async () => {
      const owner = await fromUuid(payload.ownerUuid);
      if (!owner || (!requester.isGM && !owner.testUserPermission?.(requester, "OWNER"))) {
        return { status: "failed", error: "Нет прав на владельца запроса.", requestId: payload.requestId };
      }
      try {
        return resultReply(
          await handler(owner, payload.data, { requesterId: requester.id, requestId: payload.requestId }),
          payload.requestId
        );
      } catch (error) {
        console.error(`${MODULE_ID} | GM request ${payload.type} failed`, error);
        return { status: "failed", error: error.message, requestId: payload.requestId };
      }
    })();
    completed.set(payload.requestId, response);
    if (completed.size > 200) completed.delete(completed.keys().next().value);
  }
  const result = await response;
  game.socket.emit(`module.${MODULE_ID}`, {
    recipientUserId: requester.id,
    gmId,
    requestId: payload.requestId,
    result
  });
}

export function installGmRequests() {
  if (installed || !game.socket) return;
  installed = true;
  game.socket.on(`module.${MODULE_ID}`, (payload, senderUserId) => {
    void receiveGmRequest(payload, senderUserId).catch(error =>
      console.error(`${MODULE_ID} | GM socket request failed`, error)
    );
  });
}

/** A timeout is an unknown outcome, never a failure/refund signal. */
export async function requestGm(type, owner, data, { timeoutMs = 15000, requestId = foundry.utils.randomID() } = {}) {
  const handler = handlers.get(type);
  if (!handler) throw new Error(`Unknown GM request: ${type}`);
  if (isGmAuthority()) {
    if (localGame !== game) {
      localRequests.clear();
      localGame = game;
    }
    const key = `${type}:${owner.uuid}:${requestId}`;
    if (!localRequests.has(key)) {
      const operation = Promise.resolve()
        .then(() => handler(owner, data, { requesterId: game.user.id, requestId }))
        .then(result => {
          const reply = resultReply(result, requestId);
          replies.set(requestId, reply);
          return reply;
        });
      localRequests.set(key, operation);
      // Share concurrent callbacks only. Completed requests must still run
      // their document/receipt validation (e.g. a changed damage card).
      void operation.finally(() => localRequests.delete(key)).catch(() => {});
    }
    return localRequests.get(key);
  }
  const gm = game.users?.activeGM;
  if (!gm) return { requestId, status: "failed", error: "Нужен активный GM." };
  installGmRequests();
  return new Promise(resolve => {
    const waiting = { gmId: gm.id, resolve, timedOut: false };
    waiting.timer = setTimeout(() => {
      waiting.timedOut = true;
      const result = { status: "pending", requestId };
      replies.set(requestId, result);
      resolve(result);
      notify(
        `Запрос ${requestId} ещё не подтверждён. Расход не возвращён автоматически; результат можно проверить через диагностику.`,
        "warn"
      );
    }, timeoutMs);
    pending.set(requestId, waiting);
    game.socket.emit(`module.${MODULE_ID}`, { type, requestId, ownerUuid: owner.uuid, userId: game.user.id, data });
  });
}
