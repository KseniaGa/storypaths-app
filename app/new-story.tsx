import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { useStoryStore } from '../store/storyStore';


export default function NewStoryScreen() {
  const [title, setTitle] = useState('');
  const createStory = useStoryStore((state) => state.createStory);
  const [mode, setMode] = useState<'personal' | 'symbolic' | 'fictional'>('personal');
  
  const modes = [
  {
    key: 'personal',
    title: 'Personal',
    description:
      'Tell something connected to your own experience. You can be as direct or as selective as you want.',
  },
  {
    key: 'symbolic',
    title: 'Symbolic',
    description:
      'Express something through imagery, metaphor, or atmosphere. You do not need to explain everything literally.',
  },
  {
    key: 'fictional',
    title: 'Fictional',
    description:
      'Create a story with distance from real life. You can invent characters, places, and events freely.',
  },
];

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Start a new story 🌱</Text>

      <Text style={styles.label}>Story title</Text>
      <TextInput
        style={styles.input}
        placeholder="Untitled story"
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.preview}>
        Preview: {title || 'Untitled story'}
      </Text>

      <Text style={styles.label}>Story style</Text>

{modes.map((m) => (
  <Pressable
    key={m.key}
    onPress={() => setMode(m.key as any)}
    style={{
      marginBottom: 12,
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: mode === m.key ? '#007AFF' : '#ddd',
    }}
  >
        <Text
      style={{
        fontWeight: '600',
        color: mode === m.key ? '#007AFF' : '#000',
        marginBottom: 4,
      }}
        >
          {m.title}
        </Text>

    <Text style={{ color: '#666', fontSize: 13 }}>
      {m.description}
    </Text>

      </Pressable>
    ))}

      <Pressable
        style={styles.button}
        onPress={() => {
          createStory(title || 'Untitled story', mode);
          router.push('/story');
        }}
      >
        <Text style={styles.buttonText}>Create story</Text>
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
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  preview: {
    color: '#666',
  },
button: {
  backgroundColor: '#222',
  paddingVertical: 14,
  borderRadius: 8,
  marginTop: 24,
  alignItems: 'center',
},
buttonText: {
  color: '#fff',
  fontSize: 16,
},

});