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
      borderColor: '#247322',
      backgroundColor: '#fff',
    },
    animatedStyle,
  ]}
  resizeMode={asset.alt === 'Drawing' ? 'contain' : 'cover'}
/>
    </GestureDetector>
  );
}

function InfoButton({ title, message }: { title: string; message: string }) {
  return (
    <Pressable
      accessibilityLabel={`More information about ${title}`}
      style={styles.infoButton}
      onPress={() => Alert.alert(title, message)}
    >
      <Text style={styles.infoButtonText}>i</Text>
    </Pressable>
  );
}

function SectionHeader({ title, info }: { title: string; info: string }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <InfoButton title={title} message={info} />
    </View>
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

const getNextImagePosition = (currentAssets: any[]) => {
  const imageCount = currentAssets.filter((asset) => asset.type === 'image').length;
  const offset = (imageCount % 5) * 24;

  return {
    x: Math.min(offset, 120),
    y: Math.min(offset, 90),
  };
};

const saveAssetsToScene = (nextAssets = assets) => {
  if (!scene || sceneIndex === -1) return;

  updateScene(sceneIndex, {
    ...scene,
    assets: nextAssets,
  });
};

const openDrawingPad = (drawingAssetId?: string) => {
  if (!scene || sceneIndex === -1) return;

  saveAssetsToScene();

  router.push({
    pathname: '/draw',
    params: {
      sceneId: scene.id,
      ...(drawingAssetId ? { drawingAssetId } : {}),
    },
  });
};

  if (!scene || sceneIndex === -1) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Scene media 🎨</Text>
        <Text style={styles.empty}>Scene not found.</Text>

        <Pressable style={styles.buttonSecondary} onPress={() => router.replace('/story')}>
          <Text style={styles.buttonSecondaryText}>← Back to story</Text>
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
        ...getNextImagePosition(currentAssets),
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
    saveAssetsToScene();

    router.replace({
      pathname: '/scene-editor',
      params: {
        sceneId: scene.id,
      },
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable
        style={styles.backButton}
        onPress={() =>
          router.replace({
            pathname: '/scene-editor',
            params: { sceneId: scene.id },
          })
        }
      >
        <Text style={styles.backButtonText}>← Scene</Text>
      </Pressable>

      <View style={styles.heroCard}>
        <View style={styles.heroIconTile}>
          <Text style={styles.heroIcon}>🎨</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.heading}>Scene media</Text>
          <Text style={styles.sceneContext}>{scene.title || 'Untitled scene'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Images"
          info="Add uploaded images to this scene. Tap an image to select it, then drag it around, resize it, move it forward/backward, or remove it."
        />

        <Pressable style={styles.buttonSecondary} onPress={pickImage}>
          <Text style={styles.buttonSecondaryText}>Add image</Text>
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
            <Text style={styles.buttonSecondaryText}>Remove all images</Text>
          </Pressable>
        )}

        {imageAssets.length > 0 ? (
          <>
          <Text style={styles.canvasHint}>Tap an image to select it. Drag it to arrange the scene.</Text>
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
          </>
        ) : (
          <Text style={styles.empty}>No images yet.</Text>
        )}

{selectedAssetId && (
  <View style={styles.selectedAssetPanel}>
    <Text style={styles.selectedAssetTitle}>Selected image</Text>
    <Text style={styles.selectedAssetMeta}>Use the buttons below, or drag the selected image in the canvas.</Text>

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
      <Text style={styles.buttonSecondaryText}>Remove selected image</Text>
    </Pressable>
  </View>
)}
      </View>

<View style={styles.section}>
  <SectionHeader
    title="Drawing"
    info="Create a finger drawing for this scene. You can add more than one drawing. Drawings return to this media screen as movable images."
  />

  <Pressable
    style={styles.buttonSecondary}
    onPress={() => openDrawingPad()}
  >
    <Text style={styles.buttonSecondaryText}>Add another drawing ✏️</Text>
  </Pressable>

  {firstDrawingAsset && (
    <Pressable
      style={styles.buttonSecondary}
      onPress={() => openDrawingPad(firstDrawingAsset.id)}
    >
      <Text style={styles.buttonSecondaryText}>Continue editing first drawing ♻️</Text>
    </Pressable>
  )}
</View>

<View style={styles.section}>
  <SectionHeader
    title="Audio"
    info="Add one audio file or voice note for this scene. Replacing audio keeps the scene simple for play mode and export."
  />

  <Pressable style={styles.buttonSecondary} onPress={pickAudio}>
    <Text style={styles.buttonSecondaryText}>{audioAsset ? 'Replace audio file' : 'Choose audio file'}</Text>
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
        <Text style={styles.buttonSecondaryText}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 52,
    paddingBottom: 80,
    backgroundColor: '#F7F1E1',
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8CCAA',
    backgroundColor: '#FFFCF2',
    marginBottom: 18,
  },
  backButtonText: {
    color: '#3D3528',
    fontSize: 16,
    fontWeight: '800',
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#F5EFD9',
    borderWidth: 2,
    borderColor: '#C9B46F',
    borderRadius: 28,
    padding: 18,
    marginBottom: 18,
  },
  heroIconTile: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: '#E9F2DD',
    borderWidth: 2,
    borderColor: '#6E9358',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIcon: {
    fontSize: 30,
  },
  heading: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    color: '#247322',
  },
  sceneContext: {
    color: '#665D4E',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
    marginTop: 4,
  },
  section: {
    borderWidth: 2,
    borderColor: '#6E9358',
    borderRadius: 24,
    padding: 16,
    marginBottom: 18,
    backgroundColor: '#FFFCF2',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    flex: 1,
    color: '#2A251D',
  },
  infoButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BFD5B1',
    backgroundColor: '#E9F2DD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoButtonText: {
    fontWeight: '900',
    color: '#4F6F52',
  },
  canvasHint: {
    color: '#665D4E',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
    fontWeight: '600',
  },
  canvas: {
    height: 260,
    borderWidth: 1,
    borderColor: '#D8CCAA',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#FFFDF7',
  },
  empty: {
    color: '#8C806F',
    marginBottom: 12,
    fontWeight: '700',
  },
  buttonSecondary: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#D8CCAA',
    backgroundColor: '#FFFDF7',
  },
  buttonSecondaryText: {
    color: '#3D3528',
    fontWeight: '900',
  },
  button: {
    backgroundColor: '#247322',
    paddingVertical: 16,
    borderRadius: 18,
    marginTop: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
  },
  selectedAssetPanel: {
    borderWidth: 1,
    borderColor: '#D8CCAA',
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    backgroundColor: '#FFFDF7',
  },
  selectedAssetTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
    color: '#2A251D',
  },
  selectedAssetMeta: {
    color: '#665D4E',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
    fontWeight: '600',
  },
  sizeButtonRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  sizeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#6E9358',
    backgroundColor: '#FFFCF2',
    alignItems: 'center',
  },
  sizeButtonText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#247322',
  },
  selectedAssetSubtitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#3D3528',
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#6E9358',
    backgroundColor: '#FFFCF2',
    alignItems: 'center',
  },
  layerButtonText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#247322',
  },
  recordButton: {
    backgroundColor: '#247322',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  recordButtonActive: {
    backgroundColor: '#9B3A2F',
  },
  recordButtonText: {
    color: '#fff',
    fontWeight: '900',
  },
  audioInfoBox: {
    borderWidth: 1,
    borderColor: '#D8CCAA',
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#FFFDF7',
  },
  audioInfoTitle: {
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 6,
    color: '#2A251D',
  },
  audioInfoText: {
    color: '#665D4E',
    marginBottom: 12,
    fontWeight: '600',
  },
  audioActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  listenButton: {
    flex: 1,
    backgroundColor: '#247322',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  listenButtonActive: {
    backgroundColor: '#9B3A2F',
  },
  listenButtonText: {
    color: '#fff',
    fontWeight: '900',
  },
  removeAudioButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8CCAA',
    backgroundColor: '#FFFCF2',
    alignItems: 'center',
  },
  removeAudioButtonText: {
    color: '#3D3528',
    fontWeight: '900',
  }

});
