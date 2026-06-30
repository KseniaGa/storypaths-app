import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
  Modal,
} from "react-native";
import { router } from "expo-router";
import { useStoryStore } from "../../store/storyStore";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";

const STORY_ICON_PRESETS = [
  "🪲",
  "🌿",
  "🌙",
  "🏠",
  "🚪",
  "🌊",
  "🔥",
  "⭐",
  "🧭",
  "💌",
  "🌳",
  "🪐",
];

export default function HomeScreen() {
  const stories = useStoryStore((state) => state.stories);
  const openStory = useStoryStore((state) => state.openStory);
  const hasHydrated = useStoryStore((state) => state._hasHydrated);
  const deleteStory = useStoryStore((state) => state.deleteStory);
  const importStory = useStoryStore((state) => state.importStory);
  const loadDemoStory = useStoryStore((state) => state.loadDemoStory);
  const setStoryIcon = useStoryStore((state) => state.setStoryIcon);

  const [selectedStory, setSelectedStory] = useState<any | null>(null);
  const [iconPickerStory, setIconPickerStory] = useState<any | null>(null);

  const totalScenes = stories.reduce(
    (sum, story: any) => sum + (story.scenes?.length || 0),
    0,
  );
  const emptySlots = Math.max(0, Math.min(4, 6 - (stories.length + 1)));

  if (!hasHydrated) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading story...</Text>
      </View>
    );
  }

  const handleImportJson = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      if (!file?.uri) return;

      const jsonString = await FileSystem.readAsStringAsync(file.uri);
      const parsed = JSON.parse(jsonString);

      // very basic validation
      if (!parsed.id || !parsed.title || !Array.isArray(parsed.scenes)) {
        Alert.alert(
          "Import failed",
          "This file does not look like a valid story JSON.",
        );
        return;
      }

      importStory(parsed);
      Alert.alert("Import successful", `"${parsed.title}" was imported.`);
      router.push("/story");
    } catch (error) {
      console.error("Import error:", error);
      Alert.alert("Import failed", "Could not read or import the JSON file.");
    }
  };

  const handleLoadDemoStory = () => {
    Alert.alert(
      "Load demo story?",
      "This will add or replace the Goose Story demo.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Load demo",
          onPress: () => {
            loadDemoStory();
            router.push("/story");
          },
        },
      ],
    );
  };

  const handleOpenStory = (storyId: string) => {
    openStory(storyId);
    router.push("/story");
  };

  const handlePlayStory = (storyId: string) => {
    openStory(storyId);
    router.push("/play");
  };

  const handleRenameStory = (storyId: string) => {
    setSelectedStory(null);
    router.push({
      pathname: "/rename-story",
      params: { storyId },
    });
  };

  const handleDeleteStory = (story: any) => {
    setSelectedStory(null);
    Alert.alert(
      "Delete story?",
      `Delete "${story.title}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteStory(story.id),
        },
      ],
    );
  };

  const handleChooseIcon = (icon: string) => {
    if (!iconPickerStory) return;
    setStoryIcon(iconPickerStory.id, icon);
    setIconPickerStory(null);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#FBF8EE" }}
      contentContainerStyle={styles.container}
    >
      <View style={styles.heroCard}>
        <Text style={styles.heroBeetle}>🪲</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Branch Beetle</Text>
          <Text style={styles.subtitle}>
            Create tiny branching story games on your phone.
          </Text>
        </View>
      </View>

      <View style={styles.topActionRow}>
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push("/new-story")}
        >
          <Text style={styles.primaryButtonText}>+ New story</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButtonCompact}
          onPress={() => router.push("/welcome")}
        >
          <Text style={styles.secondaryButtonText}>Welcome</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Your Story Forest</Text>
          <Text style={styles.sectionSubtitle}>
            Tap a story to edit it. Hold a story for play, rename, icon, or
            delete.
          </Text>
        </View>
        <View style={styles.forestStatsPill}>
          <Text style={styles.forestStatsNumber}>{stories.length}</Text>
          <Text style={styles.forestStatsLabel}>
            {stories.length === 1 ? "story" : "stories"}
          </Text>
        </View>
      </View>

      <View style={styles.storyLibraryFrame}>
        <View style={styles.storyGrid}>
          <Pressable
            style={styles.storyTile}
            onPress={() => router.push("/new-story")}
          >
            <View style={[styles.storyIconTile, styles.newStoryIconTile]}>
              <Text style={styles.newStoryPlus}>+</Text>
            </View>
            <Text style={styles.storyIconTitle} numberOfLines={1}>
              New
            </Text>
          </Pressable>

          {stories.map((story, index) => {
            const storyIcon = (story as any).icon || "🪲";

            return (
              <Pressable
                key={story.id || `${story.title}-${index}`}
                style={styles.storyTile}
                onPress={() => handleOpenStory(story.id)}
                onLongPress={() => setSelectedStory(story)}
                delayLongPress={350}
              >
                <View style={styles.storyIconTile}>
                  <Text style={styles.storyEmoji}>{storyIcon}</Text>
                </View>
                <Text style={styles.storyIconTitle} numberOfLines={1}>
                  {story.title || "Untitled"}
                </Text>
              </Pressable>
            );
          })}

          {Array.from({ length: emptySlots }).map((_, index) => (
            <View
              key={`empty-slot-${index}`}
              style={[styles.storyTile, styles.emptyStoryTile]}
            >
              <View style={styles.emptyIconTile}>
                <Text style={styles.emptyIconText}>·</Text>
              </View>
              <Text style={styles.emptyIconLabel}> </Text>
            </View>
          ))}
        </View>



        {stories.length === 0 && (
          <View style={styles.emptyStateInline}>
            <Text style={styles.emptyStateTitle}>No stories yet</Text>
            <Text style={styles.emptyStateText}>
              Start with New, import a story, or load the demo.
            </Text>
          </View>
        )}
      </View>

      <Modal
        transparent
        animationType="fade"
        visible={!!selectedStory}
        onRequestClose={() => setSelectedStory(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSelectedStory(null)}
        >
          <Pressable
            style={styles.actionSheet}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={styles.actionSheetTitle}>{selectedStory?.title}</Text>
            <Text style={styles.actionSheetMeta}>
              {selectedStory?.scenes?.length || 0}{" "}
              {(selectedStory?.scenes?.length || 0) === 1 ? "scene" : "scenes"}
            </Text>

            <Pressable
              style={styles.sheetAction}
              onPress={() => {
                if (!selectedStory) return;
                const storyId = selectedStory.id;
                setSelectedStory(null);
                handlePlayStory(storyId);
              }}
            >
              <Text style={styles.sheetActionText}>▶ Play story</Text>
            </Pressable>

            <Pressable
              style={styles.sheetAction}
              onPress={() =>
                selectedStory && handleRenameStory(selectedStory.id)
              }
            >
              <Text style={styles.sheetActionText}>Rename</Text>
            </Pressable>

            <Pressable
              style={styles.sheetAction}
              onPress={() => {
                setIconPickerStory(selectedStory);
                setSelectedStory(null);
              }}
            >
              <Text style={styles.sheetActionText}>Choose icon</Text>
            </Pressable>

            <Pressable
              style={styles.sheetActionDanger}
              onPress={() => selectedStory && handleDeleteStory(selectedStory)}
            >
              <Text style={styles.sheetActionDangerText}>Delete story</Text>
            </Pressable>

            <Pressable
              style={styles.sheetCancel}
              onPress={() => setSelectedStory(null)}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        animationType="fade"
        visible={!!iconPickerStory}
        onRequestClose={() => setIconPickerStory(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIconPickerStory(null)}
        >
          <Pressable
            style={styles.iconPickerSheet}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={styles.actionSheetTitle}>Choose story icon</Text>
            <Text style={styles.actionSheetMeta}>{iconPickerStory?.title}</Text>

            <View style={styles.iconPickerGrid}>
              {STORY_ICON_PRESETS.map((icon) => (
                <Pressable
                  key={icon}
                  style={styles.iconChoice}
                  onPress={() => handleChooseIcon(icon)}
                >
                  <Text style={styles.iconChoiceText}>{icon}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={styles.sheetCancel}
              onPress={() => setIconPickerStory(null)}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#FBF8EE",
    padding: 22,
    paddingTop: 42,
    paddingBottom: 80,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 26,
    padding: 18,
    backgroundColor: "#F3EFD9",
    borderWidth: 2,
    borderColor: "#D2B66B",
    marginBottom: 18,
  },

  heroBeetle: {
    fontSize: 42,
  },

  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#2F6F1F",
  },

  subtitle: {
    marginTop: 4,
    color: "#5E543F",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },

  topActionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 22,
  },

  primaryButton: {
    flex: 1,
    backgroundColor: "#2F6F1F",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    alignItems: "center",
  },

  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },

  secondaryButtonCompact: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D9D1B8",
  },

  secondaryButtonText: {
    color: "#4A3D24",
    fontSize: 15,
    fontWeight: "800",
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },

  forestStatsPill: {
    minWidth: 70,
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#E7F0D6",
    borderWidth: 1,
    borderColor: "#8BAA63",
    alignItems: "center",
    marginBottom: 12,
  },

  forestStatsNumber: {
    color: "#2F6F1F",
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 22,
  },

  forestStatsLabel: {
    color: "#4D6B35",
    fontSize: 11,
    fontWeight: "800",
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#2E2A22",
  },

  sectionSubtitle: {
    color: "#6B6250",
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 20,
    fontWeight: "600",
  },

  storyLibraryFrame: {
    minHeight: 220,
    padding: 16,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: "#6F8F4E",
    backgroundColor: "#FFFDF4",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  storyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },

  storyTile: {
    width: 76,
    alignItems: "center",
    marginBottom: 12,
  },

  storyIconTile: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "#E7F0D6",
    borderWidth: 2,
    borderColor: "#2F6F1F",
    alignItems: "center",
    justifyContent: "center",
  },

  newStoryIconTile: {
    backgroundColor: "#FFF6C9",
    borderColor: "#B28700",
  },

  newStoryPlus: {
    fontSize: 36,
    fontWeight: "900",
    color: "#8A6400",
    lineHeight: 40,
  },

  storyEmoji: {
    fontSize: 32,
  },

  storyIconTitle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "800",
    color: "#2E2A22",
    textAlign: "center",
    width: "100%",
  },

  emptyStoryTile: {
    opacity: 0.45,
  },

  emptyIconTile: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "#F3EFD9",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#D6CDAF",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyIconText: {
    fontSize: 32,
    color: "#B8AA83",
    lineHeight: 34,
    fontWeight: "900",
  },

  emptyIconLabel: {
    marginTop: 6,
    fontSize: 13,
  },

  forestFooter: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E5DDC3",
    alignItems: "flex-end",
  },

  forestFooterText: {
    color: "#6F8F4E",
    fontSize: 12,
    fontWeight: "900",
  },

  emptyStateInline: {
    marginTop: 6,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#F7F2DF",
    alignItems: "center",
  },

  emptyStateTitle: {
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 4,
    color: "#2E2A22",
  },

  emptyStateText: {
    color: "#665D49",
    textAlign: "center",
    lineHeight: 20,
    fontWeight: "600",
  },

  importRow: {
    marginTop: 18,
    gap: 10,
  },

  buttonSecondary: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D9D1B8",
    backgroundColor: "#FFFFFF",
  },

  buttonTextSecondary: {
    fontSize: 15,
    color: "#4A3D24",
    fontWeight: "800",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    justifyContent: "flex-end",
    padding: 18,
  },

  actionSheet: {
    backgroundColor: "#FFFDF4",
    borderRadius: 24,
    padding: 16,
    borderWidth: 2,
    borderColor: "#D9D1B8",
  },

  iconPickerSheet: {
    backgroundColor: "#FFFDF4",
    borderRadius: 24,
    padding: 16,
    borderWidth: 2,
    borderColor: "#D9D1B8",
  },

  actionSheetTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#2E2A22",
    marginBottom: 3,
  },

  actionSheetMeta: {
    color: "#6B6250",
    fontWeight: "700",
    marginBottom: 12,
  },

  sheetAction: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#F3EFD9",
    marginBottom: 8,
  },

  sheetActionText: {
    color: "#2E2A22",
    fontSize: 16,
    fontWeight: "800",
  },

  sheetActionDanger: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#FFE8E0",
    marginBottom: 8,
  },

  sheetActionDangerText: {
    color: "#A33A1F",
    fontSize: 16,
    fontWeight: "900",
  },

  sheetCancel: {
    paddingVertical: 14,
    alignItems: "center",
  },

  sheetCancelText: {
    color: "#6B6250",
    fontWeight: "900",
    fontSize: 15,
  },

  iconPickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 10,
  },

  iconChoice: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: "#E7F0D6",
    borderWidth: 2,
    borderColor: "#8BAA63",
    alignItems: "center",
    justifyContent: "center",
  },

  iconChoiceText: {
    fontSize: 28,
  },
});
