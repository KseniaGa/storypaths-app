import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type ImportDecision = "copy" | "replace" | "cancel";

/** Shared by both import screens on native and web. Dismissal always cancels. */
export function useStoryImportConflict() {
  const [storyTitle, setStoryTitle] = useState<string | null>(null);
  const pending = useRef<((decision: ImportDecision) => void) | null>(null);

  useEffect(() => () => {
    pending.current?.("cancel");
    pending.current = null;
  }, []);

  const chooseImportConflict = useCallback((title: string) => {
    pending.current?.("cancel");
    return new Promise<ImportDecision>((resolve) => {
      pending.current = resolve;
      setStoryTitle(title);
    });
  }, []);

  const finish = (decision: ImportDecision) => {
    const resolve = pending.current;
    pending.current = null;
    setStoryTitle(null);
    resolve?.(decision);
  };

  const importConflictDialog = (
    <Modal visible={storyTitle !== null} transparent animationType="fade" onRequestClose={() => finish("cancel")}>
      <View style={styles.overlay}>
        <View style={styles.card} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.heading} accessibilityRole="header">This story already exists</Text>
            <Text style={styles.description}>
              This backup belongs to “{storyTitle}” on this device. What would you like to do?
            </Text>
            <Pressable accessibilityRole="button" style={styles.copyButton} onPress={() => finish("copy")}>
              <Text style={styles.copyLabel}>Import as a separate copy</Text>
              <Text style={styles.copyHint}>Keep both versions. Add “(copy)” to the imported story’s title.</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.replaceButton} onPress={() => finish("replace")}>
              <Text style={styles.replaceLabel}>Replace existing story</Text>
              <Text style={styles.hint}>Overwrite this device’s version with the backup. Local edits will be lost.</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.cancelButton} onPress={() => finish("cancel")}>
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
  return { chooseImportConflict, importConflictDialog };
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", padding: 24 },
  card: { backgroundColor: "#FFFCF2", borderRadius: 22, width: "100%", maxWidth: 480, maxHeight: "90%" },
  content: { padding: 24, gap: 16 },
  heading: { color: "#2A251D", fontSize: 23, fontWeight: "800" },
  description: { color: "#514638", fontSize: 16, lineHeight: 23 },
  copyButton: { backgroundColor: "#247322", padding: 16, borderRadius: 14, gap: 6 },
  copyLabel: { color: "white", fontSize: 17, fontWeight: "800" },
  copyHint: { color: "white", fontSize: 14, lineHeight: 20 },
  replaceButton: { borderColor: "#C98675", borderWidth: 1, padding: 16, borderRadius: 14, gap: 6 },
  replaceLabel: { color: "#922E22", fontSize: 17, fontWeight: "800" },
  hint: { color: "#514638", fontSize: 14, lineHeight: 20 },
  cancelButton: { padding: 14, alignItems: "center" },
  cancelLabel: { color: "#514638", fontSize: 17, fontWeight: "700" },
});
