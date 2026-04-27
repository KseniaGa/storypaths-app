import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect, useRef  } from 'react';
import { useStoryStore } from '../store/storyStore';
import * as ImagePicker from 'expo-image-picker';

export default function SceneEditorScreen() {

  const {sceneId, parentSceneId, choiceIndex } = useLocalSearchParams();

  const currentStory = useStoryStore((state) => state.getCurrentStory());
  const scenes = currentStory?.scenes || [];
  const storyTitle = currentStory?.title || 'Untitled story';
  const mode = currentStory?.mode || 'personal';

  const addScene = useStoryStore((state) => state.addScene);
  const updateScene = useStoryStore((state) => state.updateScene);

  const scrollRef = useRef<ScrollView>(null);

  const [expandedChoiceIndex, setExpandedChoiceIndex] = useState<number | null>(null);

  const existingScene =
    sceneId !== undefined && sceneId !== ''
      ? scenes.find((scene) => scene.id === sceneId)
      : undefined;

  const [sceneTitle, setSceneTitle] = useState('');
  const [sceneText, setSceneText] = useState('');

  const [choices, setChoices] = useState(existingScene?.choices || []);

  const [newChoice, setNewChoice] = useState('');

  const [assets, setAssets] = useState(existingScene?.assets || []);

  const promptsByMode = {
    personal: [
      "What happens in this moment?",
      "What did you feel?",
      "What choice did you have?",
    ],
    symbolic: [
      "What does this place feel like?",
      "What might this represent?",
      "What changes here?",
    ],
    fictional: [
      "What kind of world is this?",
      "What does your character want?",
      "What stands in their way?",
    ],
  };

    const prompts = promptsByMode[mode];
// Change this to a state variable that calculates exactly once!
    const [randomPrompt] = useState(() => prompts[Math.floor(Math.random() * prompts.length)]);

  useEffect(() => {
    if (sceneId !== undefined && sceneId !== '') {
      setSceneTitle(existingScene?.title || '');
      setSceneText(existingScene?.text || '');
      setChoices(existingScene?.choices || []);
      setAssets(existingScene?.assets || []);
    } else {
      setSceneTitle('');
      setSceneText('');
      setChoices([]);
      setAssets([]);
    }
    setNewChoice('');
  }, [sceneId, existingScene]);

  const pickImage = async () => {
  const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permissionResult.granted) {
    return;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
  });

  if (result.canceled) return;

  const selected = result.assets[0];

  if (!selected?.uri) return;

  setAssets([
    {
      id: `asset-${Date.now()}`,
      type: 'image',
      uri: selected.uri,
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      alt: '',
    },
  ]);
};
  
  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={[styles.container, { paddingBottom: 200 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.heading}>
        {sceneId !== undefined ? 'Edit scene ✨' : 'New scene ✨'}
      </Text>

      <Text style={styles.storyContext}>Story: {storyTitle}</Text>

      <Text style={styles.label}>Scene title</Text>
      <TextInput
        style={styles.input}
        placeholder="Arrival"
        value={sceneTitle}
        onChangeText={setSceneTitle}
      />

      <Text style={styles.label}>Scene text</Text>



     <Text style={styles.prompt}>
      {randomPrompt}
    </Text>

      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Write what happens..."
        value={sceneText}
        onChangeText={setSceneText}
        multiline
        textAlignVertical="top"
      />

      <Text style={styles.previewLabel}>Preview</Text>
      <Text style={styles.previewTitle}>
        {sceneTitle || 'Untitled scene'}
      </Text>
      <Text style={styles.previewText}>
        {sceneText || 'No scene text yet.'}
      </Text>

      <View style={{ height: 1, backgroundColor: '#eee', marginVertical: 16 }} />

      <Text style={styles.label}>Choices</Text>


{choices.map((choice, index) => {
  const targetScene = scenes.find(
    (s) => s.id === choice.targetSceneId
  );

  return (
    <View key={index} style={{ marginBottom: 20 }}>

      {/* Row: label + delete */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontWeight: '500' }}>
          • {choice.label || '(empty choice)'}
        </Text>

        <Pressable
          style={{ padding: 8 }}
          onPress={() => {
            const updatedChoices = choices.filter((_, i) => i !== index);
            setChoices(updatedChoices);
          }}
        >
          <Text style={{ color: '#ff3b30', fontWeight: '600' }}>✕</Text>
        </Pressable>
      </View>

      {/* Current target */}
      <Text style={{ color: '#666', marginTop: 4 }}>
        {choice.targetSceneId
          ? `Goes to: ${targetScene?.title || 'Unknown'}`
          : 'No target selected'}
      </Text>

      {/* Change target button */}
      <Pressable
        style={{ marginTop: 8 }}
        onPress={() => {
          setExpandedChoiceIndex(
            expandedChoiceIndex === index ? null : index
          );
        }}
      >
        <Text style={{ color: '#007AFF', fontWeight: '600' }}>
          {expandedChoiceIndex === index ? 'Hide targets' : 'Change target'}
        </Text>
      </Pressable>

      {/* Target list (only when expanded) */}
      {expandedChoiceIndex === index && (
        <View style={{ marginTop: 8, paddingLeft: 8 }}>
          <Text style={{ color: '#666', marginBottom: 6 }}>
            Select next scene
          </Text>

          {scenes.map((scene, sceneIdx) => (
            <Pressable
              key={scene.id}
              onPress={() => {
                const updatedChoices = [...choices];
                updatedChoices[index] = {
                  ...choice,
                  targetSceneId: scene.id,
                };
                setChoices(updatedChoices);
                setExpandedChoiceIndex(null);
              }}
              style={{ paddingVertical: 6 }}
            >
              <Text
                style={{
                  color:
                    choice.targetSceneId === scene.id
                      ? '#007AFF'
                      : '#333',
                }}
              >
                → {scene.title || `Scene ${sceneIdx + 1}`}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Create scene button */}
      {choice.targetSceneId === undefined && existingScene && (
        <Pressable
          style={{ marginTop: 8, paddingVertical: 8 }}
          onPress={() => {
            const existingIndex = scenes.findIndex(
              (scene) => scene.id === existingScene.id
            );

            updateScene(existingIndex, {
              id: existingScene.id,
              title: sceneTitle || 'Untitled scene',
              text: sceneText || '',
              choices,
              assets,
            });

            router.push({
              pathname: '/scene-editor',
              params: {
                parentSceneId: existingScene.id,
                choiceIndex: index.toString(),
              },
            });
          }}
        >
          <Text style={{ color: '#007AFF', fontWeight: '600' }}>
            + Create next scene
          </Text>
        </Pressable>
      )}
    </View>
  );
})}
      
<View style={{ height: 1, backgroundColor: '#eee', marginVertical: 16 }} />

      <TextInput
        style={styles.input}
        placeholder="Add a choice..."
        value={newChoice}
        onChangeText={setNewChoice}
        onFocus={() => {
          setTimeout(() => {
            scrollRef.current?.scrollToEnd({ animated: true });
          }, 150);
        }}
      />

      <Pressable
        style={styles.buttonSecondary}
        onPress={() => {
          if (!newChoice.trim()) return;
          setChoices([
                    ...choices,
                    { label: newChoice.trim() },
                  ]);
          setNewChoice('');
        }}
      >
        <Text>Add choice</Text>
      </Pressable>

  <Text style={styles.label}>Scene image</Text>

    <Pressable
      style={styles.buttonSecondary}
      onPress={pickImage}
    >
      <Text>{assets.length > 0 ? 'Replace image' : 'Add image'}</Text>
    </Pressable>

        {assets.length > 0 && (
      <Pressable
        style={styles.buttonSecondary}
        onPress={() => setAssets([])}
      >
        <Text>Remove image</Text>
      </Pressable>
    )}

    {assets.length > 0 && assets[0].uri ? (
      <Image
        source={{ uri: assets[0].uri }}
        style={{
          width: '100%',
          height: 200,
          borderRadius: 8,
          marginBottom: 16,
        }}
        resizeMode="cover"
      />
    ) : null}



<Pressable
  style={styles.button}
  onPress={() => {
    if (sceneId !== undefined && sceneId !== '' && existingScene) {
      const existingIndex = scenes.findIndex((scene) => scene.id === sceneId);

      updateScene(existingIndex, {
        id: existingScene.id,
        title: sceneTitle || 'Untitled scene',
        text: sceneText || '',
        choices,
        assets,
      });

      router.replace('/story');
    } else {
      const newSceneId = addScene({
        id: '',
        title: sceneTitle || 'Untitled scene',
        text: sceneText || '',
        choices,
        assets,
      });

      if (parentSceneId && choiceIndex !== undefined) {
        const parentIndex = scenes.findIndex(
          (scene) => scene.id === parentSceneId
        );

        if (parentIndex !== -1) {
          const parentScene = scenes[parentIndex];

          const updatedChoices = [...parentScene.choices];
          updatedChoices[Number(choiceIndex)] = {
            ...updatedChoices[Number(choiceIndex)],
            targetSceneId: newSceneId,
          };

          updateScene(parentIndex, {
            ...parentScene,
            choices: updatedChoices,
          });
        }

        // 👇 go back to parent editor
        router.replace({
          pathname: '/scene-editor',
          params: {
            sceneId: parentSceneId,
          },
        });
      } else {
        // normal new scene
        router.replace('/story');
      }
    }
  }}
>
  <Text style={styles.buttonText}>Save scene</Text>
</Pressable>


    </ScrollView>
   </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
    container: {
        padding: 24,
        paddingBottom: 80, // Add this extra padding so the button clears the bottom edge!
      },
  heading: {
    fontSize: 24,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  textArea: {
    minHeight: 120,
  },
  previewLabel: {
    marginTop: 16,
    color: '#666',
    marginBottom: 8,
  },
  previewTitle: {
    fontSize: 18,
    marginBottom: 4,
  },
  previewText: {
    color: '#444',
  },
  storyContext: {
    color: '#666',
    marginBottom: 16,
  },
  choiceItem: {
    color: '#555',
    marginBottom: 4,
  },
  buttonSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ccc',
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
  prompt: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    fontStyle: 'italic',
  },

  smallActionButton: {
  marginTop: 8,
  paddingVertical: 8,
},

smallActionText: {
  color: '#007AFF',
  fontWeight: '600',
},

targetList: {
  marginTop: 8,
  paddingLeft: 8,
},

targetLabel: {
  color: '#666',
  marginBottom: 6,
},

targetOption: {
  paddingVertical: 6,
},

});