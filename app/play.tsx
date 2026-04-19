import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { useState, useEffect  } from 'react';
import { useStoryStore } from '../store/storyStore';

export default function PlayScreen() {
  const currentStory = useStoryStore((state) => state.getCurrentStory());
  const title = currentStory?.title || 'Untitled story';
  const scenes = currentStory?.scenes || [];

  const [currentSceneId, setCurrentSceneId] = useState<string | undefined>(undefined);

    useEffect(() => {
    setCurrentSceneId(scenes[0]?.id);
  }, [currentStory?.id, scenes]);

  const currentScene = scenes.find((scene) => scene.id === currentSceneId);

  if (!currentScene) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Play story 🎮</Text>
        <Text style={styles.empty}>No scenes to play yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.storyTitle}>{title || 'Untitled story'}</Text>
      <Text style={styles.heading}>{currentScene.title}</Text>

      {currentScene.assets?.length > 0 && currentScene.assets[0].uri ? (
      <Image
        source={{ uri: currentScene.assets[0].uri }}
        style={{
          width: '100%',
          height: 220,
          borderRadius: 8,
          marginBottom: 16,
        }}
        resizeMode="cover"
      />
    ) : null}

      <Text style={styles.body}>{currentScene.text}</Text>

      <Text style={styles.label}>Choices</Text>

      {currentScene.choices.length > 0 ? (
        currentScene.choices.map((choice, index) => (
          <Pressable
            key={index}
            style={styles.choiceButton}
            onPress={() => {
                if (choice.targetSceneId) {
                  setCurrentSceneId(choice.targetSceneId);
                }
            }}
          >
            <Text style={styles.choiceText}>
              {choice.label}
              {choice.targetSceneId=== undefined ? ' (no target yet)' : ''}
            </Text>
          </Pressable>
        ))
      ) : (
        <Text style={styles.empty}>This scene has no choices.</Text>
      )}

      <Pressable
        style={styles.restartButton}
        onPress={() => setCurrentSceneId(scenes[0]?.id)}
      >
        <Text style={styles.restartText}>Restart story</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  storyTitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  heading: {
    fontSize: 28,
    marginBottom: 16,
  },
  body: {
    fontSize: 18,
    lineHeight: 26,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  choiceButton: {
    backgroundColor: '#222',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  choiceText: {
    color: '#fff',
    fontSize: 16,
  },
  restartButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  restartText: {
    color: '#555',
    fontSize: 16,
  },
  empty: {
    color: '#666',
    fontSize: 16,
  },
});