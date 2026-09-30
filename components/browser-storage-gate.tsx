import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { storyPersistence, useStoryStore } from "../store/storyStore";

export function BrowserStorageGate({ children }: { children: ReactNode }) {
  const ready = useStoryStore((state) => state._hasHydrated);
  const error = useSyncExternalStore(storyPersistence.subscribe, storyPersistence.getReadError, () => null);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const protectPendingSave = (event: BeforeUnloadEvent) => {
      const status = storyPersistence.getStatus();
      if (status === "saving" || status === "error") {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", protectPendingSave);
    return () => window.removeEventListener("beforeunload", protectPendingSave);
  }, []);

  if (Platform.OS !== "web" || ready) return children;
  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#FBF8EE" }}>
      <Text accessibilityRole="alert" style={{ fontSize: 18, marginBottom: 16 }}>
        {error ? "Your saved stories could not be opened. They have not been replaced. Close other Branch Beetle tabs and retry." : "Opening your saved stories…"}
      </Text>
      {error && <Pressable accessibilityRole="button" onPress={() => { void useStoryStore.persist.rehydrate(); }}>
        <Text style={{ fontWeight: "bold", paddingVertical: 12 }}>Try opening again</Text>
      </Pressable>}
    </View>
  );
}
