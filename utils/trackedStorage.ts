import type { StateStorage } from "zustand/middleware";

export type PersistenceStatus = "idle" | "saving" | "saved" | "error";

// Keep persistence status outside the persisted store: updating the indicator
// must never trigger another disk write.
export function createTrackedStorage(storage: StateStorage, synchronous = false) {
  let status: PersistenceStatus = "idle";
  let latest: { name: string; value: string } | undefined;
  let pending: typeof latest;
  let running: Promise<void> | undefined;
  const listeners = new Set<() => void>();
  const publish = (next: PersistenceStatus) => {
    status = next;
    listeners.forEach((listener) => listener());
  };

  const drain = async () => {
    while (pending) {
      const snapshot = pending;
      pending = undefined;
      try {
        await storage.setItem(snapshot.name, snapshot.value);
        if (!pending) publish("saved");
      } catch {
        // Zustand actions usually discard the persistence promise. Handle the
        // rejection here, retain the newest snapshot, and expose a retry.
        if (!pending) publish("error");
      }
    }
  };

  const enqueue = () => {
    // localStorage must finish inside the page lifecycle event; a deferred
    // promise is not a reliable place to save while a page is closing.
    if (synchronous && latest) {
      publish("saving");
      try {
        storage.setItem(latest.name, latest.value);
        publish("saved");
      } catch {
        publish("error");
      }
      return Promise.resolve();
    }
    pending = latest;
    publish("saving");
    if (!running) {
      running = Promise.resolve().then(drain).finally(() => {
        running = undefined;
        if (pending) void enqueue();
      });
    }
    return running;
  };

  return {
    storage: {
      getItem: (name) => storage.getItem(name),
      removeItem: (name) => storage.removeItem(name),
      setItem: (name, value) => {
        latest = { name, value };
        return enqueue();
      },
    } satisfies StateStorage,
    getStatus: () => status,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    retry: () => latest ? enqueue() : Promise.resolve(),
  };
}
