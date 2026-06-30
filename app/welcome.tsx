import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useStoryStore } from '../store/storyStore';

const slides = [
  {
    emoji: '🌲🌲🌲',
    title: 'Welcome to your forest',
    text: 'Your forest is where all your stories will live.',
  },
  {
    emoji: '🌳',
    title: 'Grow a tree',
    text: 'Each tree is one interactive story you create.',
  },
  {
    emoji: '🌿',
    title: 'Build with branches',
    text: 'Branches are scenes in your story. Each scene can include text, media, and choices that lead to other scenes.',
  },
  {
    emoji: '➡️',
    title: 'Create choices',
    text: 'Choices are paths the beetle can follow.',
  },
  {
    emoji: '✨',
    title: 'Leave a story trace',
    text: 'A trace is somethig the beetle picked up or noticed along the way, like a golden key.',
  },
  {
    emoji: '🫐',
    title: 'Use story values',
    text: 'Story values are things the beetle can collect, like berries or coins. Stort values can go up or down.',
  },
  {
    emoji: '🌱',
    title: 'Start with one tree',
    text: 'As you grow your stories, your forest grows too. Start with one tree and see where it leads!',
  },
];

export default function WelcomeScreen() {
  const [index, setIndex] = useState(0);
  const createStory = useStoryStore((state) => state.createStory);

  const currentSlide = slides[index];
  const isLastSlide = index === slides.length - 1;

  const goNext = () => {
    if (!isLastSlide) {
      setIndex(index + 1);
    }
  };

  const goBack = () => {
    if (index === 0) {
      router.back();
      return;
    }

    setIndex(index - 1);
  };

  const createBlankStory = () => {
    createStory('Blank story', 'fictional');
    router.push('/story');
  };

  return (
    <View style={styles.container}>
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
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push('/templates')}
          >
            <Text style={styles.primaryButtonText}>Choose a Template 🌱</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={createBlankStory}>
            <Text style={styles.secondaryButtonText}>Start Blank</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.primaryButton} onPress={goNext}>
          <Text style={styles.primaryButtonText}>Next</Text>
        </Pressable>
      )}

      <Pressable style={styles.backButton} onPress={goBack}>
        <Text style={styles.backButtonText}>
          {index === 0 ? 'Back' : 'Previous'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#F8FBF4',
    justifyContent: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 28,
  },
  progressDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: '#D8E4D2',
  },
  progressDotActive: {
    width: 24,
    backgroundColor: '#4F6F52',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E1E8DD',
    marginBottom: 28,
  },
  emoji: {
    fontSize: 72,
    marginBottom: 18,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
    color: '#243B28',
  },
  text: {
    fontSize: 17,
    lineHeight: 25,
    textAlign: 'center',
    color: '#4D5B4F',
  },
  buttonGroup: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#4F6F52',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C9D8C1',
  },
  secondaryButtonText: {
    color: '#243B28',
    fontSize: 17,
    fontWeight: '700',
  },
  backButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 15,
    color: '#6A756C',
    fontWeight: '600',
  },
});