import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useStoryStore } from "../store/storyStore";

const slides = [
  {
    emoji: "\uD83C\uDF32\uD83C\uDF32\uD83C\uDF32",
    title: "Welcome to your forest",
    text: "Your forest is where all your stories will live.",
  },
  {
    emoji: "\uD83C\uDF33",
    title: "Grow a tree",
    text: "Each tree is one interactive story you create.",
  },
  {
    emoji: "\uD83C\uDF3F",
    title: "Build with branches",
    text: "Scenes can include text, media, and choices that lead somewhere new.",
  },
  {
    emoji: "\uD83D\uDC41\uFE0F + \uD83E\uDD8B",
    title: "Choice logic",
    text: "Choice visibility decides when a choice appears. Choice consequence decides what happens after choosing it.",
  },
  {
    emoji: "\uD83D\uDCCC",
    title: "Remember choices",
    text: "The story can remember what happened, then use it later to unlock a path.",
  },
  {
    emoji: "\uD83E\uDED0",
    title: "Use story values",
    text: "Story values are things that can change, like berries, trust, or energy.",
  },
  {
    emoji: "\uD83C\uDF31",
    title: "Begin gently",
    text: "Try a tutorial, choose a story template, or start with one blank scene.",
  },
];

export default function WelcomeScreen() {
  const [index, setIndex] = useState(0);
  const { firstLaunch } = useLocalSearchParams();
  const createStory = useStoryStore((state) => state.createStory);
  const completeWelcome = useStoryStore((state) => state.completeWelcome);

  const currentSlide = slides[index];
  const isLastSlide = index === slides.length - 1;
  const isFirstLaunch = firstLaunch === "true";

  const skipWelcome = () => {
    completeWelcome();
    router.replace("/");
  };

  const openStoryLibrary = () => {
    completeWelcome();
    router.replace("/templates");
  };

  const createBlankStory = () => {
    completeWelcome();
    createStory("Blank story", "fictional");
    router.replace("/story");
  };

  const goBack = () => {
    if (index > 0) {
      setIndex(index - 1);
      return;
    }

    if (isFirstLaunch) {
      skipWelcome();
      return;
    }

    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.stepText}>
          {index + 1} of {slides.length}
        </Text>
        <Pressable
          style={styles.skipButton}
          onPress={skipWelcome}
          accessibilityRole="button"
          accessibilityLabel="Skip welcome introduction"
        >
          <Text style={styles.skipButtonText}>Skip</Text>
        </Pressable>
      </View>

      <View style={styles.progressRow}>
        {slides.map((slide, slideIndex) => (
          <View
            key={slide.title}
            style={[
              styles.progressDot,
              slideIndex === index && styles.progressDotActive,
            ]}
          />
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.emoji}>{currentSlide.emoji}</Text>
        <Text style={styles.title}>{currentSlide.title}</Text>
        <Text style={styles.text}>{currentSlide.text}</Text>
      </View>

      {isLastSlide ? (
        <View style={styles.buttonGroup}>
          <Pressable style={styles.primaryButton} onPress={openStoryLibrary}>
            <Text style={styles.primaryButtonText}>
              Explore tutorials and templates
            </Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={createBlankStory}>
            <Text style={styles.secondaryButtonText}>Start blank</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={styles.primaryButton}
          onPress={() => setIndex(index + 1)}
        >
          <Text style={styles.primaryButtonText}>Next</Text>
        </Pressable>
      )}

      <Pressable style={styles.backButton} onPress={goBack}>
        <Text style={styles.backButtonText}>
          {index === 0 ? "Back" : "Previous"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 48,
    paddingBottom: 28,
    backgroundColor: "#F8FBF4",
    justifyContent: "center",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  stepText: {
    color: "#6A756C",
    fontSize: 13,
    fontWeight: "800",
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#C9D8C1",
    backgroundColor: "#FFFFFF",
  },
  skipButtonText: {
    color: "#3D5F42",
    fontSize: 14,
    fontWeight: "800",
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
    marginBottom: 22,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#D8E4D2",
  },
  progressDotActive: {
    width: 22,
    backgroundColor: "#4F6F52",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E1E8DD",
    marginBottom: 22,
  },
  emoji: {
    fontSize: 58,
    marginBottom: 16,
  },
  title: {
    fontSize: 25,
    lineHeight: 30,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
    color: "#243B28",
  },
  text: {
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
    color: "#4D5B4F",
  },
  buttonGroup: {
    gap: 10,
  },
  primaryButton: {
    backgroundColor: "#4F6F52",
    paddingVertical: 15,
    paddingHorizontal: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  secondaryButton: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#C9D8C1",
  },
  secondaryButtonText: {
    color: "#243B28",
    fontSize: 16,
    fontWeight: "700",
  },
  backButton: {
    marginTop: 14,
    alignItems: "center",
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 15,
    color: "#6A756C",
    fontWeight: "600",
  },
});
