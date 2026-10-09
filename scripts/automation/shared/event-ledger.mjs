import { MODULE_ID } from "./constants.mjs";
import { enabled, notify } from "./helpers.mjs";
import { isGmAuthority } from "./gm-requests.mjs";

const resolvers = new Map();
let journalPromise;
const flag = document => document?.getFlag?.(MODULE_ID, "automationLedger");

// Queue payloads may contain hidden NPCs and cast snapshots. Scene flags and
// world settings are readable by players; a GM-only Journal is not.
async function journal() {
  const existing = [...(game.journal ?? [])].find(flag);
  if (existing) return existing;
  if (!journalPromise) journalPromise = JournalEntry.create({ name: "Гримуар: журнал автоматизации (GM)",
    ownership: { default: 0 }, flags: { [MODULE_ID]: { automationLedger: true, events: [] } } })
    .finally(() => { journalPromise = null; });
  return journalPromise;
}

export function createEventLedger({ read, write, authority = isGmAuthority }) {
  let chain = Promise.resolve();
  const serial = operation => {
    const next = chain.catch(() => {}).then(() => authority() ? operation() : { status: "forbidden" });
    chain = next; return next;
  };
  const save = async records => {
    const completed = records.filter(event => ["completed", "skipped", "cancelled"].includes(event.state)).slice(-500);
    await write([...records.filter(event => !["completed", "skipped", "cancelled"].includes(event.state)), ...completed]);
  };
  async function execute(record, operation) {
    // Native Midi can invoke another automation event while resolving this one.
    // Serialize reservations/writes, never hold the ledger lock across a roll.
    try {
      const result = await operation(record);
      record.state = result === undefined || result?.status === "pending" || result?.status === "needs-review"
        ? "needs-review" : result === false || result?.aborted ? "cancelled" : "completed";
      record.result = { status: record.state };
    } catch (error) { record.state = "needs-review"; record.error = error.message; }
    await serial(async () => {
      const records = await read(), current = records.find(event => event.id === record.id);
      if (current) Object.assign(current, record);
      await save(records);
    });
    return { status: record.state, eventId: record.id };
  }
  return {
    run(record, operation, { queued = false } = {}) {
      return serial(async () => {
        const records = await read(), previous = records.find(event => event.id === record.id);
        if (previous) return { status: previous.state, eventId: previous.id };
        const entry = { ...structuredClone(record), state: queued ? "queued" : "running" };
        records.push(entry);
        if (queued) { await save(records); return { status: "queued", eventId: entry.id }; }
        await save(records);
        return { execute: entry };
      }).then(result => result.execute ? execute(result.execute, operation) : result);
    },
    resolve(id, decision, operation) {
      return serial(async () => {
        if (!["apply", "skip"].includes(decision)) throw Error("Неверное решение очереди.");
        const records = await read(), record = records.find(event => event.id === id);
        if (!record) throw Error("Событие не найдено.");
        if (record.state !== "queued") return { status: record.state, eventId: id };
        if (decision === "skip") { record.state = "skipped"; await save(records); return { status: "skipped", eventId: id }; }
        record.state = "running"; await save(records);
        return { execute: record };
      }).then(result => result.execute ? execute(result.execute, operation) : result);
    },
    async list() { return structuredClone(await read()); }
  };
}

const ledger = createEventLedger({
  read: async () => structuredClone((await journal()).getFlag(MODULE_ID, "events") ?? []),
  write: async records => { await (await journal()).setFlag(MODULE_ID, "events", records); }
});

export function registerAutomationEvent(kind, resolver) { resolvers.set(kind, resolver); }
export async function listAutomationEvents() {
  if (!game.user?.isGM) return [];
  const existing = [...(game.journal ?? [])].find(flag);
  // Diagnostics must not create the journal.
  return structuredClone(existing?.getFlag(MODULE_ID, "events") ?? []);
}
export async function runAutomationEvent(record, operation, options) {
  if (!enabled() || !isGmAuthority()) return { status: "forbidden" };
  if (!record.id || !record.kind || !record.sceneId) throw Error("Неполное событие автоматизации.");
  const result = await ledger.run({ createdAt: Number(game.time?.worldTime ?? 0), ...record }, operation, options);
  if (result.status === "queued") notify("Срабатывание сохранено в панели Гримуара. GM должен открыть его сцену и подтвердить результат.", "warn");
  return result;
}
export async function resolvePendingAutomation(id, decision) {
  if (!isGmAuthority() || !game.user?.isGM || !enabled()) throw Error("Очередью управляет только активный GM при включённой автоматизации.");
  const record = (await listAutomationEvents()).find(event => event.id === id);
  if (!record) throw Error("Событие не найдено.");
  if (decision === "apply" && (!canvas?.ready || canvas.scene?.id !== record.sceneId)) throw Error("Сначала откройте сцену события.");
  return ledger.resolve(id, decision, entry => {
    const resolve = resolvers.get(entry.kind);
    if (!resolve) throw Error("Нет обработчика события; требуется ручная проверка.");
    return resolve(entry);
  });
}
