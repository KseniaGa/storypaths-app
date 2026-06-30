import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { useStoryStore } from '../store/storyStore';

export default function NewStoryScreen() {
  const [title, setTitle] = useState('');
  const createStory = useStoryStore((state) => state.createStory);

  const handleCreateStory = () => {
    createStory(title.trim() || 'Untitled story', 'fictional');
    router.push('/story');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Start a new story 🌱</Text>

      <Text style={styles.intro}>
        Give your story a name. You can start simple and change things later.
      </Text>

      <Text style={styles.label}>Story title</Text>

      <TextInput
        style={styles.input}
        placeholder="My story"
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.preview}>Preview: {title.trim() || 'Untitled story'}</Text>

      <View style={styles.reassuranceBox}>
        <Text style={styles.reassuranceTitle}>You choose how personal it feels</Text>

        <Text style={styles.reassuranceText}>
          Your story can be based on real experience, told through symbols, or completely
          fictional. 
        </Text>
      </View>

      <Pressable style={styles.button} onPress={handleCreateStory}>
        <Text style={styles.buttonText}>Create blank story</Text>
      </Pressable>

      <Pressable
        style={styles.secondaryButton}
        onPress={() => {
          
          router.push('/templates')
        }}
      >
        <Text style={styles.secondaryButtonText}>Choose a template</Text>
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
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 12,
  },
  intro: {
    fontSize: 15,
    color: '#555',
    lineHeight: 21,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  preview: {
    color: '#666',
    marginBottom: 20,
  },
  reassuranceBox: {
    backgroundColor: '#F7F2FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  reassuranceTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  reassuranceText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#222',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#222',
    fontSize: 16,
    fontWeight: '600',
  },
});