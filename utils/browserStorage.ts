import type { StateStorage } from "zustand/middleware";

const DATABASE = "branch-beetle";
const OBJECT_STORE = "story-snapshots";

// Keep the existing Zustand key and serialized format. Only the browser's
// storage backend changes; native storage and portable backups are unaffected.
export function createBrowserStorage(
  getDatabase: () => IDBFactory = () => window.indexedDB,
  getLegacyStorage: () => Storage = () => window.localStorage,
): StateStorage {
  const open = () => new Promise<IDBDatabase>((resolve, reject) => {
    const factory = getDatabase();
    if (!factory) throw new Error("Browser database storage is unavailable.");
    const request = factory.open(DATABASE, 1);
    let finished = false;
    const fail = (error: unknown) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reject(error);
    };
    const timer = setTimeout(() => fail(new Error("Opening browser storage timed out. Close other Branch Beetle tabs and retry.")), 10000);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(OBJECT_STORE)) {
        request.result.createObjectStore(OBJECT_STORE);
      }
    };
    request.onerror = () => fail(request.error);
    request.onblocked = () => fail(new Error("Browser storage is blocked by another tab. Close other Branch Beetle tabs and retry."));
    request.onsuccess = () => {
      if (finished) { request.result.close(); return; }
      finished = true;
      clearTimeout(timer);
      resolve(request.result);
    };
  });

  const transact = async (name: string, write?: { value: string | null }) => {
    const db = await open();
    try {
      return await new Promise<string | null | undefined>((resolve, reject) => {
        const transaction = db.transaction(OBJECT_STORE, write ? "readwrite" : "readonly");
        const objectStore = transaction.objectStore(OBJECT_STORE);
        let value: string | null | undefined;
        const request = write ? objectStore.put(write.value, name) : objectStore.get(name);
        request.onsuccess = () => { if (!write) value = request.result; };
        // Request success alone does not mean the transaction committed.
        transaction.oncomplete = () => resolve(value);
        transaction.onabort = () => reject(transaction.error || new Error("Browser save was cancelled."));
        transaction.onerror = () => reject(transaction.error || new Error("Browser storage operation failed."));
      });
    } finally {
      db.close();
    }
  };

  const removeLegacy = (name: string) => {
    // A committed database snapshot remains authoritative even if cleanup is
    // denied. Never delete the old copy before the new transaction commits.
    try { getLegacyStorage().removeItem(name); } catch { /* Retain the old copy. */ }
  };

  return {
    async getItem(name) {
      const value = await transact(name);
      if (value !== undefined) {
        if (value !== null && typeof value !== "string") throw new Error("Saved story data could not be read.");
        return value;
      }
      // Only an absent record permits legacy fallback, never a database error.
      // Hydration validates this snapshot; the next successful save migrates it.
      return getLegacyStorage().getItem(name);
    },
    async setItem(name, value) {
      await transact(name, { value });
      removeLegacy(name);
    },
    async removeItem(name) {
      // A tombstone prevents a stale legacy copy from reappearing after clear.
      await transact(name, { value: null });
      removeLegacy(name);
    },
  };
}

export const browserStoryStorage = createBrowserStorage();
