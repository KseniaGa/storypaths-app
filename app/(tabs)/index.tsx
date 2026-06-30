import { View, Text, Pressable, StyleSheet, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useStoryStore } from '../../store/storyStore';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

export default function HomeScreen() {
  const stories = useStoryStore((state) => state.stories);
  const openStory = useStoryStore((state) => state.openStory);
  const hasHydrated = useStoryStore((state) => state._hasHydrated);
  const deleteStory = useStoryStore((state) => state.deleteStory);
  const importStory = useStoryStore((state) => state.importStory);

  const loadDemoStory = useStoryStore((state) => state.loadDemoStory);

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

    const handleLoadDemoStory = () => {
  Alert.alert(
    'Load demo story?',
    'This will add or replace the Goose Story demo.',
    [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Load demo',
        onPress: () => {
          loadDemoStory();
          router.push('/story');
        },
      },
    ]
  );
};

  return (
    <ScrollView
  style={{ flex: 1, backgroundColor: '#fff' }}
  contentContainerStyle={styles.container}
>
      <Text style={styles.title}>🪲 Branch Beetle 🪲</Text>


      <Pressable style={styles.button} onPress={() => router.push('/welcome')}>
  <Text style={styles.buttonText}> Welcome! </Text>
</Pressable>

      <Pressable
        style={styles.button}
        onPress={() => router.push('/new-story')}
      >
        <Text style={styles.buttonText}>New story</Text>
      </Pressable>





{stories.length === 0 && (
  <View style={styles.emptyState}>
    <Text style={styles.emptyStateTitle}>No stories yet </Text>
    <Text style={styles.emptyStateText}>
      Create your first story or import one to get started.
    </Text>
  </View>
)}

      {stories.length > 0 && (
        <View style={styles.storyList}>
          <Text style={styles.storyListTitle}>Your stories 🌳</Text>

{stories.map((story, index) => {
  const sceneCount = story.scenes?.length || 0;
  const doneCount = story.scenes?.filter((scene) => scene.isDone).length || 0;

  return (
    <View
      key={story.id || `${story.title}-${index}`}
      style={styles.storyCard}
    >
      <View style={styles.storyCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.storyCardTitle}>{story.title}</Text>
          <Text style={styles.storyCardMeta}>
             · {sceneCount} {sceneCount === 1 ? 'scene' : 'scenes'} · 
          </Text>
        </View>

        <Pressable
          style={styles.iconButton}
          onPress={() => {
            router.push({
              pathname: '/rename-story',
              params: { storyId: story.id },
            });
          }}
        >
          <Text style={styles.iconButtonText}>Rename</Text>
        </Pressable>
      </View>

      <View style={styles.storyActionRow}>
        <Pressable
          style={styles.openButton}
          onPress={() => {
            openStory(story.id);
            router.push('/story');
          }}
        >
          <Text style={styles.openButtonText}>Edit</Text>
        </Pressable>

        <Pressable
          style={styles.playButton}
          onPress={() => {
            openStory(story.id);
            router.push('/play');
          }}
        >
          <Text style={styles.playButtonText}>▶ Play</Text>
        </Pressable>
      </View>

      <Pressable
        style={styles.deleteStoryButton}
        onPress={() => {
          Alert.alert(
            'Delete story?',
            `Delete "${story.title}"? This cannot be undone.`,
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
        <Text style={styles.deleteStoryText}>Delete story</Text>
      </Pressable>
    </View>
  );
})}

        </View>

      )}

                <Pressable
          style={styles.buttonSecondary}
          onPress={handleImportJson}
        >
          <Text style={styles.buttonTextSecondary}>Import story</Text>
        </Pressable>

        <Pressable
  style={styles.buttonSecondary}
  onPress={handleLoadDemoStory}
>
  <Text style={styles.buttonTextSecondary}>Load demo story 🪿</Text>
</Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
container: {
  flexGrow: 1,
  backgroundColor: '#fff',
  padding: 24,
  paddingBottom: 80,
},


storyList: {
  marginTop: 28,
  width: '100%',
},

storyListTitle: {
  fontSize: 18,
  fontWeight: '700',
  marginBottom: 12,
},

storyCard: {
  borderWidth: 1,
  borderColor: '#ddd',
  borderRadius: 14,
  padding: 14,
  marginBottom: 14,
  backgroundColor: '#fff',
  width: '100%',
},

storyCardTitle: {
  fontSize: 17,
  fontWeight: '700',
},

storyCardMeta: {
  color: '#666',
  marginTop: 4,
  lineHeight: 20,
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
  borderRadius: 12,
  marginBottom: 16,
  alignItems: 'center',
},
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
buttonSecondary: {
  paddingVertical: 14,
  paddingHorizontal: 24,
  borderRadius: 12,
  alignItems: 'center',
  borderWidth: 1,
  borderColor: '#ccc',
  marginBottom: 16,
},
  buttonTextSecondary: {
    fontSize: 16,
    color: '#555',
  },
storyCardHeader: {
  flexDirection: 'row',
  alignItems: 'flex-start',
  marginBottom: 12,
  gap: 10,
},
storyActionRow: {
  flexDirection: 'row',
  gap: 10,
  marginTop: 4,
},

openButton: {
  flex: 1,
  backgroundColor: '#222',
  paddingVertical: 12,
  borderRadius: 10,
  alignItems: 'center',
},

openButtonText: {
  color: '#fff',
  fontWeight: '700',
},

playButton: {
  flex: 1,
  backgroundColor: '#fff',
  paddingVertical: 12,
  borderRadius: 10,
  alignItems: 'center',
  borderWidth: 1,
  borderColor: '#ccc',
},

playButtonText: {
  color: '#333',
  fontWeight: '700',
},

iconButton: {
  paddingVertical: 6,
  paddingHorizontal: 10,
  borderRadius: 999,
  backgroundColor: '#f5f5f5',
},

iconButtonText: {
  color: '#555',
  fontSize: 13,
  fontWeight: '700',
},

deleteStoryButton: {
  alignSelf: 'flex-start',
  marginTop: 12,
  paddingVertical: 6,
  paddingHorizontal: 10,
},

deleteStoryText: {
  color: '#777',
  fontSize: 13,
  fontWeight: '600',
},

emptyState: {
  marginTop: 40,
  borderWidth: 1,
  borderColor: '#eee',
  borderRadius: 14,
  padding: 18,
  backgroundColor: '#fafafa',
  alignItems: 'center',
},

emptyStateTitle: {
  fontSize: 18,
  fontWeight: '700',
  marginBottom: 6,
},

emptyStateText: {
  color: '#666',
  textAlign: 'center',
  lineHeight: 22,
},


});