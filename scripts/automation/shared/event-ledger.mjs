import { MODULE_ID } from "./constants.mjs";
import { enabled, notify } from "./helpers.mjs";
import { isGmAuthority } from "./gm-requests.mjs";
import { t } from "./i18n.mjs";

const resolvers = new Map();
let journalPromise;
const sessionId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}:${Math.random()}`;
const flag = document => document?.getFlag?.(MODULE_ID, "automationLedger");

// Queue payloads may contain hidden NPCs and cast snapshots. Scene flags and
// world settings are readable by players; a GM-only Journal is not.
async function journal() {
  const existing = [...(game.journal ?? [])].find(flag);
  if (existing) return existing;
  if (!journalPromise)
    journalPromise = JournalEntry.create({
      name: "Гримуар: журнал автоматизации (GM)",
      ownership: { default: 0 },
      flags: { [MODULE_ID]: { schemaVersion: 1, automationLedger: true, events: [] } }
    }).finally(() => {
      journalPromise = null;
    });
  return journalPromise;
}

const FINISHED = ["completed", "skipped", "cancelled", "reviewed"];
/**
 * Records kept per state. The whole list is one journal flag rewritten on every
 * event, so it must stay small: the newest finished, unresolved and queued
 * events are kept; older ones are dropped (queued and unresolved ones with a
 * console warning, since they were never confirmed).
 */
export const LEDGER_LIMITS = Object.freeze({ finished: 200, review: 200, queued: 200 });

export function createEventLedger({ read, write, authority = isGmAuthority, isStale = () => false }) {
  let chain = Promise.resolve();
  const serial = operation => {
    const next = chain.catch(() => {}).then(() => (authority() ? operation() : { status: "forbidden" }));
    chain = next;
    return next;
  };
  const save = async records => {
    for (const event of records)
      if (event.state === "running" && isStale(event)) {
        // Started by a GM session that ended: the outcome is unknown, never replayed.
        event.state = "needs-review";
        event.error ??= t("Ledger.Interrupted");
      }
    const newest = (states, limit) => records.filter(event => states.includes(event.state)).slice(-limit);
    const kept = new Set([
      ...records.filter(event => event.state === "running"),
      ...newest(["queued"], LEDGER_LIMITS.queued),
      ...newest(["needs-review"], LEDGER_LIMITS.review),
      ...newest(FINISHED, LEDGER_LIMITS.finished)
    ]);
    const dropped = records.filter(event => !kept.has(event) && !FINISHED.includes(event.state));
    if (dropped.length)
      console.warn(
        `${MODULE_ID} | Automation log is full; dropped ${dropped.length} unresolved event(s):`,
        dropped.map(event => `${event.kind}:${event.id}`)
      );
    await write(records.filter(event => kept.has(event)));
  };
  async function execute(record, operation) {
    // Native Midi can invoke another automation event while resolving this one.
    // Serialize reservations/writes, never hold the ledger lock across a roll.
    try {
      const result = await operation(record);
      record.state =
        result === undefined || result?.status === "pending" || result?.status === "needs-review"
          ? "needs-review"
          : result === false || result?.aborted
            ? "cancelled"
            : "completed";
      record.result = { status: record.state };
    } catch (error) {
      record.state = "needs-review";
      record.error = error.message;
    }
    await serial(async () => {
      const records = await read(),
        current = records.find(event => event.id === record.id);
      if (current) Object.assign(current, record);
      await save(records);
    });
    return { status: record.state, eventId: record.id };
  }
  return {
    run(record, operation, { queued = false } = {}) {
      return serial(async () => {
        const records = await read(),
          previous = records.find(event => event.id === record.id);
        if (previous) return { status: previous.state, eventId: previous.id };
        const entry = { ...structuredClone(record), state: queued ? "queued" : "running" };
        records.push(entry);
        if (queued) {
          await save(records);
          return { status: "queued", eventId: entry.id };
        }
        await save(records);
        return { execute: entry };
      }).then(result => (result.execute ? execute(result.execute, operation) : result));
    },
    resolve(id, decision, operation) {
      return serial(async () => {
        if (!["apply", "skip", "dismiss"].includes(decision)) throw Error("Неверное решение очереди.");
        const records = await read(),
          record = records.find(event => event.id === id);
        if (!record) throw Error("Событие не найдено.");
        if (decision === "dismiss") {
          // The GM checked an unresolved event by hand; it leaves the review list.
          if (record.state !== "needs-review" && !(record.state === "running" && isStale(record)))
            return { status: record.state, eventId: id };
          record.state = "reviewed";
          await save(records);
          return { status: "reviewed", eventId: id };
        }
        if (record.state !== "queued") return { status: record.state, eventId: id };
        if (decision === "skip") {
          record.state = "skipped";
          await save(records);
          return { status: "skipped", eventId: id };
        }
        record.state = "running";
        await save(records);
        return { execute: record };
      }).then(result => (result.execute ? execute(result.execute, operation) : result));
    },
    async list() {
      return structuredClone(await read());
    }
  };
}

const ledger = createEventLedger({
  read: async () => structuredClone((await journal()).getFlag(MODULE_ID, "events") ?? []),
  write: async records => {
    await (await journal()).setFlag(MODULE_ID, "events", records);
  },
  isStale: event => event.sessionId !== sessionId
});

export function registerAutomationEvent(kind, resolver) {
  resolvers.set(kind, resolver);
}
export async function listAutomationEvents() {
  if (!game.user?.isGM) return [];
  const existing = [...(game.journal ?? [])].find(flag);
  // Diagnostics must not create the journal.
  return structuredClone(existing?.getFlag(MODULE_ID, "events") ?? []).map(event =>
    event.state === "running" && event.sessionId !== sessionId
      ? {
          ...event,
          state: "needs-review",
          error: event.error ?? t("Ledger.Interrupted")
        }
      : event
  );
}
export async function runAutomationEvent(record, operation, options) {
  if (!enabled() || !isGmAuthority()) return { status: "forbidden" };
  if (!record.id || !record.kind || !record.sceneId) throw Error("Неполное событие автоматизации.");
  const result = await ledger.run(
    { version: 1, createdAt: Number(game.time?.worldTime ?? 0), sessionId, ...record },
    operation,
    options
  );
  if (result.status === "queued") notify(t("Ledger.Queued"), "warn");
  return result;
}
export async function resolvePendingAutomation(id, decision) {
  if (!isGmAuthority() || !game.user?.isGM || !enabled()) throw Error(t("Ledger.GmOnly"));
  const record = (await listAutomationEvents()).find(event => event.id === id);
  if (!record) throw Error("Событие не найдено.");
  if (decision === "dismiss") return ledger.resolve(id, decision);
  if (record.version != null && record.version !== 1)
    throw Error("Версия события не поддерживается; требуется ручная проверка.");
  if (decision === "apply" && (!canvas?.ready || canvas.scene?.id !== record.sceneId))
    throw Error(t("Ledger.OpenScene"));
  return ledger.resolve(id, decision, entry => {
    const resolve = resolvers.get(entry.kind);
    if (!resolve) throw Error("Нет обработчика события; требуется ручная проверка.");
    return resolve(entry);
  });
}
