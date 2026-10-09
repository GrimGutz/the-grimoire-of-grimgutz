const queues = new Map();
/** Hold short document mutations together; do not nest the same key. */
export function serialMutation(key, operation) {
  const next = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(operation);
  queues.set(key, next);
  void next.finally(() => { if (queues.get(key) === next) queues.delete(key); }).catch(() => {});
  return next;
}
