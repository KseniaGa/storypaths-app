import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useStoryStore } from '../store/storyStore';
import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export default function StoryScreen() {
    const currentStory = useStoryStore((state) => state.getCurrentStory());
    const deleteScene = useStoryStore((state) => state.deleteScene);
    const scenes = currentStory?.scenes || [];
    const title = currentStory?.title || 'Untitled story';
    const exportCurrentStory = useStoryStore((state) => state.exportCurrentStory);

  return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
      <Text style={styles.title}>{title || 'Untitled story'}</Text>

      {scenes.length === 0 && (
        <Text style={styles.subtitle}>Your story has no scenes yet.</Text>
      )}

      {scenes.map((scene) => (
        <Pressable
          key={scene.id}
          style={styles.sceneCard}
          onPress={() =>
            router.push({
              pathname: '/scene-editor',
              params: {
                sceneId: scene.id,
              },
            })
          }
        >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.sceneTitle}>{scene.title}</Text>

            <Pressable
              onPress={() => deleteScene(scene.id)}
              style={{ padding: 6 }}
            >
              <Text style={{ color: '#ff3b30', fontWeight: '600' }}>✕</Text>
            </Pressable>
          </View>

          <Text style={styles.sceneText}>{scene.text}</Text>

            {scene.choices?.map((choice, i) => {
              const targetScene = scenes.find((s) => s.id === choice.targetSceneId);

              return (
                <Text key={i} style={styles.choice}>
                  → {choice.label}
                  {choice.targetSceneId ? ` → ${targetScene?.title || 'Unknown'}` : ''}
                </Text>
              );
            })}
        </Pressable>
      ))}

      <Pressable
        style={styles.button}
        onPress={() =>
          router.push({
            pathname: '/scene-editor',
            params: { storyTitle: title },
          })
        }
      >
        <Text style={styles.buttonText}>+ Add scene</Text>
      </Pressable>

      <Pressable
      style={styles.playButton}
      onPress={() => router.push('/play')}
    >
      <Text style={styles.buttonText}>▶ Play story</Text>
    </Pressable>

    <Pressable
      style={styles.exportButton}

onPress={async () => {
  const json = exportCurrentStory();

  if (!json) {
    Alert.alert('Export failed', 'No current story to export.');
    return;
  }

  try {
    const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'story'}.json`;
    const fileUri = FileSystem.documentDirectory + fileName;

    await FileSystem.writeAsStringAsync(fileUri, json, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const canShare = await Sharing.isAvailableAsync();

    if (!canShare) {
      Alert.alert('Export saved', `JSON saved to: ${fileUri}`);
      return;
    }

    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: 'Export story JSON',
    });
  } catch (error) {
    console.error('Export error:', error);
    Alert.alert('Export failed', 'Could not create or share the JSON file.');
  }
}}

    >
      <Text style={styles.buttonText}>⬇ Export JSON</Text>
    </Pressable>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
container: {
    padding: 24,
    paddingBottom: 80, // Gives your 'Play story' button room to breathe!
  },
  title: {
    fontSize: 24,
    marginBottom: 12,
  },
  subtitle: {
    color: '#666',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#222',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
  sceneCard: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    width: '100%',
  },
  sceneTitle: {
    fontSize: 18,
    marginBottom: 4,
  },
  sceneText: {
    color: '#555',
  },
  choice: {
    color: '#777',
    marginTop: 4,
  },

  playButton: {
    backgroundColor: '#444',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
},

exportButton: {
  backgroundColor: '#666',
  paddingVertical: 14,
  paddingHorizontal: 20,
  borderRadius: 8,
  alignItems: 'center',
  marginTop: 12,
},

});