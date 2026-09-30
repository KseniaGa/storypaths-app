import { Platform, Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePersistenceStatus } from "../hooks/use-persistence-status";
import { storyPersistence } from "../store/storyStore";

export function PersistenceNotice() {
  const status = usePersistenceStatus();
  if (Platform.OS === "web" && status === "saving") return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ backgroundColor: "#fff8db", padding: 12 }}>
      <Text accessibilityLiveRegion="polite">Saving changes… Please keep this page open until saving finishes.</Text>
    </SafeAreaView>
  );
  if (status !== "error") return null;
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ backgroundColor: "#fff0e8", padding: 12 }}>
      <Text accessibilityRole="alert" style={{ color: "#7c2518" }}>
        Changes could not be saved to this device. Keep the app open and try again, or export a backup.
      </Text>
      <Pressable accessibilityRole="button" onPress={() => { void storyPersistence.retry(); }} style={{ paddingVertical: 12 }}>
        <Text style={{ color: "#7c2518", fontWeight: "bold" }}>Try saving again</Text>
      </Pressable>
    </SafeAreaView>
  );
}
