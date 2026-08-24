import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  cloneStoryBlueprint,
  INSPIRATION_PROMPTS,
  STORY_TEMPLATES,
  TUTORIALS,
} from "../data/storyContent";
import type { StoryBlueprint } from "../data/storyContent";
import { useStoryStore } from "../store/storyStore";

const SHOW_INSPIRATION_PROMPTS = false;

type StoryCardProps = {
  item: StoryBlueprint;
  kind: "Tutorial" | "Template";
  onPress: () => void;
};

function StoryCard({ item, kind, onPress }: StoryCardProps) {
  return (
    <Pressable
      style={styles.storyCard}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${kind}: ${item.title}`}
    >
      <View style={styles.cardHeader}>
        <View style={styles.emojiTile}>
          <Text style={styles.emoji}>{item.icon}</Text>
        </View>
        <View style={styles.titleArea}>
          <Text style={styles.storyTitle}>{item.title}</Text>
          <Text style={styles.kindLabel}>
            {kind === "Tutorial" ? "Completed example" : "Editable structure"}
          </Text>
        </View>
      </View>
      <Text style={styles.description}>{item.description}</Text>
      <View style={styles.featurePill}>
        <Text style={styles.features}>{item.summary}</Text>
      </View>
    </Pressable>
  );
}

export default function TemplatesScreen() {
  const { storyTitle, storyIcon } = useLocalSearchParams();
  const createStory = useStoryStore((state) => state.createStory);
  const importStory = useStoryStore((state) => state.importStory);
  const preservedTitle =
    typeof storyTitle === "string" ? storyTitle : undefined;
  const preservedIcon =
    typeof storyIcon === "string" ? storyIcon : undefined;

  const createBlankStory = () => {
    createStory(
      preservedTitle || "Blank story",
      "fictional",
      preservedIcon,
    );
    router.push("/story");
  };

  const createFromBlueprint = (blueprint: StoryBlueprint) => {
    importStory(
      cloneStoryBlueprint(blueprint, {
        title: preservedTitle,
        icon: preservedIcon,
      }),
    );
    router.push("/story");
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>{"\u2190"} Back</Text>
      </Pressable>

      <View style={styles.heroBand}>
        <Text style={styles.heroEmoji}>{"\uD83E\uDEB2"}</Text>
        <View style={styles.heroTextArea}>
          <Text style={styles.heading}>Story templates</Text>
          <Text style={styles.intro}>
            Learn from a completed example or begin with an editable structure.
          </Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Tutorials</Text>
        <Text style={styles.sectionDescription}>
          Completed stories that teach Branch Beetle features. Your copy is
          yours to explore and edit.
        </Text>
      </View>
      <View style={styles.cardList}>
        {TUTORIALS.map((tutorial) => (
          <StoryCard
            key={tutorial.id}
            item={tutorial}
            kind="Tutorial"
            onPress={() => createFromBlueprint(tutorial)}
          />
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Story Templates</Text>
        <Text style={styles.sectionDescription}>
          Editable story structures. Replace every title, choice, and scene
          with your own material.
        </Text>
      </View>
      <View style={styles.cardList}>
        <Pressable
          style={styles.storyCard}
          onPress={createBlankStory}
          accessibilityRole="button"
          accessibilityLabel="Create a blank story"
        >
          <View style={styles.cardHeader}>
            <View style={styles.emojiTile}>
              <Text style={styles.emoji}>{"\uD83D\uDCDD"}</Text>
            </View>
            <View style={styles.titleArea}>
              <Text style={styles.storyTitle}>Blank Story</Text>
              <Text style={styles.kindLabel}>No structure</Text>
            </View>
          </View>
          <Text style={styles.description}>
            Begin with an empty story and make the first scene yourself.
          </Text>
          <View style={styles.featurePill}>
            <Text style={styles.features}>Blank {"\u2022"} Start anywhere</Text>
          </View>
        </Pressable>

        {STORY_TEMPLATES.map((template) => (
          <StoryCard
            key={template.id}
            item={template}
            kind="Template"
            onPress={() => createFromBlueprint(template)}
          />
        ))}
      </View>

      {SHOW_INSPIRATION_PROMPTS && (
        <>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Inspiration Prompts</Text>
          <Text style={styles.sectionDescription}>
            Small ideas only. They do not create scenes or decide the story
            structure.
          </Text>
        </View>
        <View style={styles.promptList}>
          {INSPIRATION_PROMPTS.map((prompt) => (
            <View key={prompt} style={styles.promptRow}>
              <Text style={styles.promptIcon}>{"\uD83C\uDF31"}</Text>
              <Text style={styles.promptText}>{prompt}</Text>
            </View>
          ))}
        </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 80,
    backgroundColor: "#F7F1DF",
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#D6C895",
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#FFFDF5",
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#3B3428",
  },
  heroBand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 2,
    borderColor: "#C9B66F",
    backgroundColor: "#F8F1D9",
    borderRadius: 24,
    padding: 18,
    marginBottom: 26,
  },
  heroEmoji: {
    fontSize: 42,
  },
  heroTextArea: {
    flex: 1,
    minWidth: 0,
  },
  heading: {
    fontSize: 29,
    lineHeight: 34,
    fontWeight: "900",
    color: "#28751F",
    marginBottom: 5,
  },
  intro: {
    fontSize: 15,
    color: "#635A4C",
    lineHeight: 21,
    fontWeight: "700",
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 25,
    lineHeight: 30,
    fontWeight: "900",
    color: "#2A251D",
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: "#665D4E",
    fontWeight: "700",
  },
  cardList: {
    gap: 12,
    marginBottom: 28,
  },
  storyCard: {
    borderWidth: 1,
    borderColor: "#8AAA72",
    borderRadius: 20,
    padding: 15,
    backgroundColor: "#FFFDF5",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 9,
    gap: 11,
  },
  emojiTile: {
    width: 50,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#6E9358",
    backgroundColor: "#E8F1D8",
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 27,
  },
  titleArea: {
    flex: 1,
    minWidth: 0,
  },
  storyTitle: {
    fontSize: 19,
    lineHeight: 23,
    fontWeight: "900",
    color: "#252018",
    marginBottom: 2,
  },
  kindLabel: {
    fontSize: 12,
    color: "#28751F",
    fontWeight: "900",
  },
  description: {
    fontSize: 14,
    color: "#5F574B",
    lineHeight: 20,
    fontWeight: "600",
  },
  featurePill: {
    alignSelf: "flex-start",
    marginTop: 10,
    borderRadius: 999,
    backgroundColor: "#E8F1D8",
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  features: {
    fontSize: 12,
    color: "#28751F",
    fontWeight: "900",
  },
  promptList: {
    gap: 8,
  },
  promptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#D8CCAA",
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 13,
    backgroundColor: "#FFFDF5",
  },
  promptIcon: {
    fontSize: 18,
  },
  promptText: {
    flex: 1,
    color: "#3D3528",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
});
