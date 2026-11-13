import { MODULE_ID } from "./constants.mjs";
import { serialMutation } from "./transactions.mjs";
import { isGmAuthority } from "./gm-requests.mjs";

const receiptReply = receipt => ({ status: receipt.state, requestId: receipt.requestId, error: receipt.error });
const receipts = actor =>
  actor.getFlag?.(MODULE_ID, "nativeApplications") ?? actor.flags?.[MODULE_ID]?.nativeApplications ?? {};
export function nativeApplicationReply(actor, requestId) {
  const receipt = receipts(actor)[requestId];
  return receipt ? receiptReply(receipt) : null;
}
async function saveReceipt(actor, receipt) {
  return serialMutation(`native-receipts:${actor.uuid}`, async () => {
    const current = { ...receipts(actor), [receipt.requestId]: receipt };
    // Never prune unknown outcomes that still require a human decision.
    const finished = Object.values(current)
      .filter(row => ["success", "cancelled"].includes(row.state))
      .slice(-100);
    const unresolved = Object.values(current).filter(row => !["success", "cancelled"].includes(row.state));
    await actor.update({
      [`flags.${MODULE_ID}.nativeApplications`]: Object.fromEntries(
        [...unresolved, ...finished].map(row => [row.requestId, row])
      )
    });
  });
}

/** Reserve a specific native application before expense. Replays never reroll,
 * re-prompt or refund an uncertain native outcome, even after a reload. */
export async function applyNativeOnce(actor, { requestId, action, activityUuid }, use, apply) {
  if (!isGmAuthority() || !requestId) throw Error("Нативное действие требует активного GM и идентификатора запроса.");
  const reserved = await serialMutation(`native-receipts:${actor.uuid}`, async () => {
    const previous = receipts(actor)[requestId];
    if (previous) return receiptReply(previous);
    const receipt = {
      requestId,
      action,
      activityUuid,
      state: "needs-review",
      startedAt: Number(game.time?.worldTime ?? 0)
    };
    // Unknown until the native workflow is positively confirmed. A crashed GM
    // must not cause an automatic second expenditure on reconnect.
    await actor.update({ [`flags.${MODULE_ID}.nativeApplications`]: { ...receipts(actor), [requestId]: receipt } });
    return { receipt };
  });
  if (!reserved.receipt) return reserved;
  const receipt = reserved.receipt;
  try {
    const native = await use();
    if (native === false || native?.aborted) receipt.state = "cancelled";
    else if (native == null || ["pending", "needs-review"].includes(native?.status)) receipt.state = "needs-review";
    else {
      receipt.expenseConfirmed = true;
      await saveReceipt(actor, receipt);
      if (!isGmAuthority()) throw Error("Активный GM сменился после расхода; результат требует проверки.");
      const result = await apply(native);
      receipt.state =
        result === false || result == null || result?.status === "needs-review" ? "needs-review" : "success";
    }
  } catch (error) {
    receipt.state = "needs-review";
    receipt.error = String(error.message ?? error);
  }
  await saveReceipt(actor, receipt);
  return receiptReply(receipt);
}
