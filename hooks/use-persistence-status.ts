import { useSyncExternalStore } from "react";
import { storyPersistence } from "../store/storyStore";

export function usePersistenceStatus() {
  return useSyncExternalStore(
    storyPersistence.subscribe,
    storyPersistence.getStatus,
    () => "idle" as const,
  );
}
