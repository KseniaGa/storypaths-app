import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useStoryStore } from '../store/storyStore';

export default function RenameStoryScreen() {
  const { storyId } = useLocalSearchParams();

  const renameStory = useStoryStore((state) => state.renameStory);
  const stories = useStoryStore((state) => state.stories);

  const story = stories.find((s) => s.id === storyId);

  const [title, setTitle] = useState(story?.title || '');

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Rename story ✏️</Text>

      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Story title"
      />

      <Pressable
        style={styles.button}
        onPress={() => {
          if (!title.trim()) return;

          renameStory(storyId as string, title.trim());
          router.back();
        }}
      >
        <Text style={styles.buttonText}>Save</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  heading: {
    fontSize: 24,
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#222',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
});