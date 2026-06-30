import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect } from 'react';
import { useStoryStore } from '../store/storyStore';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

import Animated, {
  useAnimatedStyle,
  useSharedValue,
  runOnJS,
} from 'react-native-reanimated';

import { Gesture, GestureDetector } from 'react-native-gesture-handler';

function DraggableAsset({
  asset,
  onMoveEnd,
  isSelected,
  onSelect,
}: {
  asset: any;
  onMoveEnd: (id: string, x: number, y: number) => void;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const imageX = useSharedValue(asset.x || 0);
  const imageY = useSharedValue(asset.y || 0);

  const CANVAS_WIDTH = 400;
  const CANVAS_HEIGHT = 260;
  const IMAGE_WIDTH = asset.width || 220;
  const IMAGE_HEIGHT = asset.height || 160;

  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(onSelect)(asset.id);
  });

  const clamp = (value: number, min: number, max: number) => {
    'worklet';
    return Math.min(Math.max(value, min), max);
  };

  const gesture = Gesture.Pan()
    .onChange((event) => {
      imageX.value = clamp(
        imageX.value + event.changeX,
        -20,
        CANVAS_WIDTH - IMAGE_WIDTH - 20
      );

      imageY.value = clamp(
        imageY.value + event.changeY,
        -20,
        CANVAS_HEIGHT - IMAGE_HEIGHT - 20
      );
    })
    .onEnd(() => {
      runOnJS(onMoveEnd)(asset.id, imageX.value, imageY.value);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: imageX.value },
      { translateY: imageY.value },
    ],
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(gesture, tapGesture)}>
<Animated.Image
  source={{ uri: asset.uri }}
  style={[
    {
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
      borderRadius: 8,
      position: 'absolute',
      left: 20,
      top: 20,
      borderWidth: isSelected ? 3 : 0,
      borderColor: '#007AFF',
      backgroundColor: '#fff',
    },
    animatedStyle,
  ]}
  resizeMode={asset.alt === 'Drawing' ? 'contain' : 'cover'}
/>
    </GestureDetector>
  );
}

export default function SceneMediaScreen() {
  const { sceneId } = useLocalSearchParams();

  const currentStory = useStoryStore((state) => state.getCurrentStory());
  const updateScene = useStoryStore((state) => state.updateScene);

  const scenes = currentStory?.scenes || [];
  const scene = scenes.find((s) => s.id === sceneId);
  const sceneIndex = scenes.findIndex((s) => s.id === sceneId);

  const [assets, setAssets] = useState(scene?.assets || []);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const imageAssets = assets.filter((asset) => asset.type === 'image');
  const audioAsset = assets.find((asset) => asset.type === 'audio');

  const drawingAssets = imageAssets.filter((asset) => asset.alt === 'Drawing');
  const firstDrawingAsset = drawingAssets[0];

  useEffect(() => {
    setAssets(scene?.assets || []);
    setSelectedAssetId(null);
  }, [sceneId, scene]);

const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
const recorderState = useAudioRecorderState(audioRecorder);

const previewPlayer = useAudioPlayer(audioAsset?.uri ?? null);
const previewStatus = useAudioPlayerStatus(previewPlayer);

const stopPreviewAudio = () => {
  if (previewStatus.playing) {
    previewPlayer.pause();
  }
};

  if (!scene || sceneIndex === -1) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Scene media 🎨</Text>
        <Text style={styles.empty}>Scene not found.</Text>

        <Pressable style={styles.buttonSecondary} onPress={() => router.replace('/story')}>
          <Text>← Back to story</Text>
        </Pressable>
      </View>
    );
  }



  const moveSelectedAssetLayer = (direction: 'forward' | 'backward') => {
  if (!selectedAssetId) return;

  setAssets((currentAssets) => {
    const index = currentAssets.findIndex(
      (asset) => asset.id === selectedAssetId
    );

    if (index === -1) return currentAssets;

    const newIndex =
      direction === 'forward'
        ? Math.min(index + 1, currentAssets.length - 1)
        : Math.max(index - 1, 0);

    if (newIndex === index) return currentAssets;

    const updatedAssets = [...currentAssets];
    const [selectedAsset] = updatedAssets.splice(index, 1);
    updatedAssets.splice(newIndex, 0, selectedAsset);

    return updatedAssets;
  });
};

  const resizeSelectedAsset = (size: 'small' | 'medium' | 'large') => {
  if (!selectedAssetId) return;

  const sizes = {
    small: { width: 140, height: 100 },
    medium: { width: 220, height: 160 },
    large: { width: 300, height: 220 },
  };

  setAssets((currentAssets) =>
    currentAssets.map((asset) =>
      asset.id === selectedAssetId
        ? {
            ...asset,
            width: sizes[size].width,
            height: sizes[size].height,
          }
        : asset
    )
  );
};

  const updateAssetPosition = (id: string, x: number, y: number) => {
    setAssets((currentAssets) =>
      currentAssets.map((asset) =>
        asset.id === id ? { ...asset, x, y } : asset
      )
    );
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission needed', 'Please allow access to your image library.');
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

    setAssets((currentAssets) => [
      ...currentAssets,
      {
        id: `asset-${Date.now()}`,
        type: 'image',
        uri: selected.uri,
        x: 0,
        y: 0,
        width: 220,
        height: 160,
        alt: '',
      },
    ]);
  };

const startRecording = async () => {
  const permission = await AudioModule.requestRecordingPermissionsAsync();

  if (!permission.granted) {
    Alert.alert(
      'Microphone permission needed',
      'Please allow microphone access to record a voice note.'
    );
    return;
  }

  await setAudioModeAsync({
    playsInSilentMode: true,
    allowsRecording: true,
  });

  await audioRecorder.prepareToRecordAsync();
  audioRecorder.record();
};

const stopRecording = async () => {
  await audioRecorder.stop();

  const recordedUri = audioRecorder.uri;

  if (!recordedUri) {
    Alert.alert('Recording problem', 'The recording could not be saved.');
    return;
  }

  const extension =
    recordedUri.split('.').pop()?.split('?')[0] || 'm4a';

  const permanentUri =
    `${FileSystem.documentDirectory}voice-note-${Date.now()}.${extension}`;

  await FileSystem.copyAsync({
    from: recordedUri,
    to: permanentUri,
  });

  stopPreviewAudio();

  setAssets((currentAssets) => [
    ...currentAssets.filter((asset) => asset.type !== 'audio'),
    {
      id: `audio-${Date.now()}`,
      type: 'audio',
      uri: permanentUri,
      name: `Voice note ${new Date().toLocaleTimeString()}`,
    },
  ]);
};

const pickAudio = async () => {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'audio/*',
    copyToCacheDirectory: true,
  });

  if (result.canceled) return;

  const file = result.assets[0];

  if (!file?.uri) return;

  stopPreviewAudio();

  setAssets((currentAssets) => [
    ...currentAssets.filter((asset) => asset.type !== 'audio'),
    {
      id: `audio-${Date.now()}`,
      type: 'audio',
      uri: file.uri,
      name: file.name || 'Audio file',
    },
  ]);
};


  const saveMedia = () => {
    stopPreviewAudio();

    updateScene(sceneIndex, {
      ...scene,
      assets,
    });

    router.replace({
      pathname: '/scene-editor',
      params: {
        sceneId: scene.id,
      },
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Scene media 🎨</Text>
      <Text style={styles.sceneContext}>{scene.title || 'Untitled scene'}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Images</Text>
        <Text style={styles.sectionText}>
          Add images and arrange them in the scene.
        </Text>

        <Pressable style={styles.buttonSecondary} onPress={pickImage}>
          <Text>Add image</Text>
        </Pressable>

        {imageAssets.length > 0 && (
          <Pressable
            style={styles.buttonSecondary}
            onPress={() => {
              setAssets((currentAssets) =>
                  currentAssets.filter((asset) => asset.type !== 'image')
                );
              setSelectedAssetId(null);
            }}
          >
            <Text>Remove all images</Text>
          </Pressable>
        )}

        {imageAssets.length > 0 ? (
          <View style={styles.canvas}>
            {imageAssets.map((asset) => (
              <DraggableAsset
                key={asset.id}
                asset={asset}
                onMoveEnd={updateAssetPosition}
                isSelected={selectedAssetId === asset.id}
                onSelect={setSelectedAssetId}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.empty}>No images yet.</Text>
        )}

{selectedAssetId && (
  <View style={styles.selectedAssetPanel}>
    <Text style={styles.selectedAssetTitle}>Selected image</Text>

    <View style={styles.sizeButtonRow}>
      <Pressable
        style={styles.sizeButton}
        onPress={() => resizeSelectedAsset('small')}
      >
        <Text style={styles.sizeButtonText}>Small</Text>
      </Pressable>

      <Pressable
        style={styles.sizeButton}
        onPress={() => resizeSelectedAsset('medium')}
      >
        <Text style={styles.sizeButtonText}>Medium</Text>
      </Pressable>

      <Pressable
        style={styles.sizeButton}
        onPress={() => resizeSelectedAsset('large')}
      >
        <Text style={styles.sizeButtonText}>Large</Text>
      </Pressable>

    </View>

<Text style={styles.selectedAssetSubtitle}>Layer</Text>

<View style={styles.layerButtonRow}>
  <Pressable
    style={styles.layerButton}
    onPress={() => moveSelectedAssetLayer('backward')}
  >
    <Text style={styles.layerButtonText}>Send backward</Text>
  </Pressable>

  <Pressable
    style={styles.layerButton}
    onPress={() => moveSelectedAssetLayer('forward')}
  >
    <Text style={styles.layerButtonText}>Bring forward</Text>
  </Pressable>
</View>
    

    <Pressable
      style={styles.buttonSecondary}
      onPress={() => {
        setAssets((currentAssets) =>
          currentAssets.filter((asset) => asset.id !== selectedAssetId)
        );
        setSelectedAssetId(null);
      }}
    >
      <Text>Remove selected image</Text>
    </Pressable>
  </View>
)}
      </View>

<View style={styles.section}>
  <Text style={styles.sectionTitle}>Drawing</Text>
  <Text style={styles.sectionText}>
    Draw a quick symbol, memory, map, or feeling for this scene.
  </Text>

  <Pressable
    style={styles.buttonSecondary}
    onPress={() =>
      router.push({
        pathname: '/draw',
        params: { sceneId: scene.id },
      })
    }
  >
    <Text>Add new drawing ✏️</Text>
  </Pressable>

  {firstDrawingAsset && (
    <Pressable
      style={styles.buttonSecondary}
      onPress={() =>
        router.push({
          pathname: '/draw',
          params: {
            sceneId: scene.id,
            drawingAssetId: firstDrawingAsset.id,
          },
        })
      }
    >
      <Text>Continue editing drawing ♻️</Text>
    </Pressable>
  )}
</View>

<View style={styles.section}>
  <Text style={styles.sectionTitle}>Audio</Text>
  <Text style={styles.sectionText}>
    Add one audio fragment or record a voice note for this scene.
  </Text>

  <Pressable style={styles.buttonSecondary} onPress={pickAudio}>
    <Text>{audioAsset ? 'Replace audio file' : 'Choose audio file'}</Text>
  </Pressable>

  <Pressable
    style={[
      styles.recordButton,
      recorderState.isRecording && styles.recordButtonActive,
    ]}
    onPress={recorderState.isRecording ? stopRecording : startRecording}
  >
    <Text style={styles.recordButtonText}>
      {recorderState.isRecording ? 'Stop recording' : 'Record voice note'}
    </Text>
  </Pressable>

{audioAsset ? (
  <View style={styles.audioInfoBox}>
    <Text style={styles.audioInfoTitle}>Selected audio</Text>
    <Text style={styles.audioInfoText}>
      {audioAsset.name || 'Audio file'}
    </Text>

    <View style={styles.audioActionRow}>
      <Pressable
        style={[
          styles.listenButton,
          previewStatus.playing && styles.listenButtonActive,
        ]}
        onPress={() => {
          if (previewStatus.playing) {
            previewPlayer.pause();
          } else {
            previewPlayer.play();
          }
        }}
      >
        <Text style={styles.listenButtonText}>
          {previewStatus.playing ? 'Pause' : '🎧 Listen'}
        </Text>
      </Pressable>

      <Pressable
        style={styles.removeAudioButton}
        onPress={() => {
          stopPreviewAudio();

          setAssets((currentAssets) =>
            currentAssets.filter((asset) => asset.type !== 'audio')
          );
        }}
      >
        <Text style={styles.removeAudioButtonText}>Remove</Text>
      </Pressable>
    </View>
  </View>
) : (
  <Text style={styles.empty}>No audio yet.</Text>
)}
</View>

      <Pressable style={styles.button} onPress={saveMedia}>
        <Text style={styles.buttonText}>Save media</Text>
      </Pressable>

      <Pressable
        style={styles.buttonSecondary}
        onPress={() =>
          router.replace({
            pathname: '/scene-editor',
            params: {
              sceneId: scene.id,
            },
          })
        }
      >
        <Text>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 80,
    backgroundColor: '#fff',
  },
  heading: {
    fontSize: 24,
    marginBottom: 8,
  },
  sceneContext: {
    color: '#666',
    marginBottom: 20,
  },
  section: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    backgroundColor: '#fafafa',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  sectionText: {
    color: '#666',
    marginBottom: 12,
  },
  canvas: {
    height: 260,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  empty: {
    color: '#888',
    marginBottom: 12,
  },
  buttonSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#222',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
  selectedAssetPanel: {
  borderWidth: 1,
  borderColor: '#eee',
  borderRadius: 12,
  padding: 12,
  marginBottom: 16,
  backgroundColor: '#fafafa',
},

selectedAssetTitle: {
  fontSize: 14,
  fontWeight: '700',
  marginBottom: 10,
},

sizeButtonRow: {
  flexDirection: 'row',
  gap: 8,
  marginBottom: 12,
},

sizeButton: {
  flex: 1,
  paddingVertical: 10,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: '#ccc',
  backgroundColor: '#fff',
  alignItems: 'center',
},

sizeButtonText: {
  fontSize: 13,
  fontWeight: '700',
  color: '#333',
},

selectedAssetSubtitle: {
  fontSize: 13,
  fontWeight: '700',
  color: '#555',
  marginBottom: 8,
},

layerButtonRow: {
  flexDirection: 'row',
  gap: 8,
  marginBottom: 12,
},

layerButton: {
  flex: 1,
  paddingVertical: 10,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: '#ccc',
  backgroundColor: '#fff',
  alignItems: 'center',
},

layerButtonText: {
  fontSize: 13,
  fontWeight: '700',
  color: '#333',
},


recordButton: {
  backgroundColor: '#222',
  paddingVertical: 12,
  paddingHorizontal: 12,
  borderRadius: 10,
  alignItems: 'center',
  marginBottom: 12,
},

recordButtonActive: {
  backgroundColor: '#8b1e1e',
},

recordButtonText: {
  color: '#fff',
  fontWeight: '700',
},

audioInfoBox: {
  borderWidth: 1,
  borderColor: '#eee',
  borderRadius: 12,
  padding: 12,
  backgroundColor: '#fff',
},

audioInfoTitle: {
  fontSize: 14,
  fontWeight: '700',
  marginBottom: 6,
},

audioInfoText: {
  color: '#666',
  marginBottom: 12,
},

audioActionRow: {
  flexDirection: 'row',
  gap: 8,
},

listenButton: {
  flex: 1,
  backgroundColor: '#222',
  paddingVertical: 10,
  paddingHorizontal: 12,
  borderRadius: 10,
  alignItems: 'center',
},

listenButtonActive: {
  backgroundColor: '#8b1e1e',
},

listenButtonText: {
  color: '#fff',
  fontWeight: '700',
},

removeAudioButton: {
  flex: 1,
  paddingVertical: 10,
  paddingHorizontal: 12,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: '#ccc',
  backgroundColor: '#fff',
  alignItems: 'center',
},

removeAudioButtonText: {
  color: '#333',
  fontWeight: '700',
}

});