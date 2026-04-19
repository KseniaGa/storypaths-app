import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { useStoryStore } from '../../store/storyStore';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

export default function HomeScreen() {
  const stories = useStoryStore((state) => state.stories);
  const openStory = useStoryStore((state) => state.openStory);
  const loadDemoStory = useStoryStore((state) => state.loadDemoStory);
  const hasHydrated = useStoryStore((state) => state._hasHydrated);
  const currentStoryId = useStoryStore((state) => state.currentStoryId);
  const deleteStory = useStoryStore((state) => state.deleteStory);
  const importStory = useStoryStore((state) => state.importStory);

  const hasDraft = currentStoryId !== null;

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
          type: 'application/json',
          copyToCacheDirectory: true,
        });

        if (result.canceled) return;

        const file = result.assets[0];
        if (!file?.uri) return;

        const jsonString = await FileSystem.readAsStringAsync(file.uri);
        const parsed = JSON.parse(jsonString);

        // very basic validation
        if (!parsed.id || !parsed.title || !Array.isArray(parsed.scenes)) {
          Alert.alert('Import failed', 'This file does not look like a valid story JSON.');
          return;
        }

        importStory(parsed);
        Alert.alert('Import successful', `"${parsed.title}" was imported.`);
        router.push('/story');
      } catch (error) {
        console.error('Import error:', error);
        Alert.alert('Import failed', 'Could not read or import the JSON file.');
      }
    };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>StoryPaths 🌷</Text>

      <Pressable
        style={styles.button}
        onPress={() => router.push('/new-story')}
      >
        <Text style={styles.buttonText}>New story</Text>
      </Pressable>

      {hasDraft && (
        <Pressable
          style={styles.buttonSecondary}
          onPress={() => router.push('/story')}
        >
          <Text style={styles.buttonTextSecondary}>Continue draft</Text>
        </Pressable>
      )}

      <Pressable
        style={styles.buttonSecondary}
        onPress={() => {
          loadDemoStory();
          router.push('/story');
        }}
      >
        <Text style={styles.buttonTextSecondary}>Load demo story</Text>
      </Pressable>

          <Pressable
          style={styles.buttonSecondary}
          onPress={handleImportJson}
        >
          <Text style={styles.buttonTextSecondary}>Import JSON story</Text>
        </Pressable>

      {stories.length > 0 && (
        <View style={styles.storyList}>
          <Text style={styles.storyListTitle}>Your stories</Text>

    {stories.map((story, index) => (
      <View
        key={story.id || `${story.title}-${index}`}
        style={styles.storyCard}
      >
        {/* Story content */}
        <Pressable
          style={{ flex: 1 }}
          onPress={() => {
            openStory(story.id);
            router.push('/story');
          }}
        >
          <Text style={styles.storyCardTitle}>{story.title}</Text>
          <Text style={styles.storyCardMeta}>{story.mode}</Text>
        </Pressable>

        {/* Actions */}
        <View style={{ flexDirection: 'row', marginLeft: 12 }}>
          {/* Rename */}
          <Pressable
            style={{ padding: 6 }}
            onPress={() => {
              router.push({
                pathname: '/rename-story',
                params: { storyId: story.id },
              });
            }}
          >
            <Text style={{ color: '#007AFF', fontWeight: '600' }}>✏️</Text>
          </Pressable>

          {/* Delete */}
          <Pressable
            style={{ padding: 6 }}
            onPress={() => {
              Alert.alert(
                'Delete story',
                `Delete "${story.title}"?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => deleteStory(story.id),
                  },
                ]
              );
            }}
          >
            <Text style={{ color: '#ff3b30', fontWeight: '600' }}>✕</Text>
          </Pressable>
        </View>
      </View>
    ))}

        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    marginBottom: 40,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#222',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
  buttonSecondary: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonTextSecondary: {
    fontSize: 16,
    color: '#555',
  },
  storyList: {
    marginTop: 24,
    width: '100%',
  },
  storyListTitle: {
    fontSize: 18,
    marginBottom: 12,
  },
  storyCard: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  storyCardTitle: {
    fontWeight: '600',
  },
  storyCardMeta: {
    color: '#666',
    marginTop: 4,
  },
});