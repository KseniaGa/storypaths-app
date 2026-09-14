import { View, Text, StyleSheet, Pressable, ScrollView, Alert, Image, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
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
import { getPersistentMediaUri } from '../utils/platformFiles';

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

  useEffect(() => {
    imageX.value = asset.x || 0;
    imageY.value = asset.y || 0;
  }, [asset.x, asset.y, imageX, imageY]);

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
  const requestedSceneId = typeof sceneId === 'string' ? sceneId : undefined;

  const currentStory = useStoryStore((state) => state.getCurrentStory());
  const updateScene = useStoryStore((state) => state.updateScene);
  const toggleAutoplayVoiceNotes = useStoryStore(
    (state) => state.toggleAutoplayVoiceNotes,
  );
  const autoplayVoiceNotes = currentStory?.autoplayVoiceNotes ?? false;

  const scenes = currentStory?.scenes || [];
  const scene = scenes.find((s) => s.id === requestedSceneId);
  const sceneIndex = scenes.findIndex((s) => s.id === requestedSceneId);

  const [assets, setAssets] = useState(scene?.assets || []);
  const assetsRef = useRef(scene?.assets || []);
  const mediaActionInProgress = useRef(false);
  const recordingSaveInProgress = useRef(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [isMediaLibraryExpanded, setIsMediaLibraryExpanded] = useState(false);
  const loadedSceneIdRef = useRef<string | undefined>(undefined);

  const imageAssets = assets.filter((asset) => asset.type === 'image');
  const audioAsset = assets.find((asset) => asset.type === 'audio');

  const drawingAssets = imageAssets.filter((asset) => asset.alt === 'Drawing');
  const firstDrawingAsset = drawingAssets[0];
  const selectedImageAsset = imageAssets.find((asset) => asset.id === selectedAssetId);
  const selectedImageSize = selectedImageAsset
    ? selectedImageAsset.width <= 140
      ? 'small'
      : selectedImageAsset.width >= 300
        ? 'large'
        : 'medium'
    : undefined;

  const getLibraryItemId = (asset: any) =>
    asset.libraryItemId || asset.reusedFromAssetId || asset.id || asset.uri;

  const mediaLibraryAssets: any[] = Array.from(
    scenes
      .flatMap((libraryScene) =>
        (libraryScene.assets || [])
          .filter((asset: any) => asset.uri)
          .map((asset: any) => ({
            ...asset,
            libraryItemId: getLibraryItemId(asset),
            sourceSceneId: libraryScene.id,
            sourceSceneTitle: libraryScene.title || 'Untitled scene',
          })),
      )
      .reduce((uniqueAssets, asset: any) => {
        if (!uniqueAssets.has(asset.libraryItemId)) {
          uniqueAssets.set(asset.libraryItemId, asset);
        }
        return uniqueAssets;
      }, new Map<string, any>())
      .values(),
  );

  const visualLibraryAssets = mediaLibraryAssets.filter(
    (asset: any) => asset.type === 'image',
  );
  const audioLibraryAssets = mediaLibraryAssets.filter(
    (asset: any) => asset.type === 'audio',
  );

  const mediaLibrarySummary =
    visualLibraryAssets.length > 0 || audioLibraryAssets.length > 0
      ? [
          visualLibraryAssets.length > 0
            ? `${visualLibraryAssets.length} image${visualLibraryAssets.length === 1 ? '' : 's'}/drawing${visualLibraryAssets.length === 1 ? '' : 's'}`
            : null,
          audioLibraryAssets.length > 0
            ? `${audioLibraryAssets.length} audio`
            : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : 'No reusable media yet';

  useEffect(() => {
    const nextAssets = scene?.assets || [];
    assetsRef.current = nextAssets;
    setAssets(nextAssets);

    if (loadedSceneIdRef.current !== scene?.id) {
      setSelectedAssetId(null);
      loadedSceneIdRef.current = scene?.id;
    } else {
      setSelectedAssetId((currentId) =>
        currentId && nextAssets.some((asset) => asset.id === currentId)
          ? currentId
          : null,
      );
    }
  }, [scene?.assets, scene?.id]);

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

const dedupeSceneAssets = (nextAssets: any[]) => {
  const seenAttachmentIds = new Set<string>();

  return nextAssets.filter((asset) => {
    const attachmentId = asset.id || `${asset.type}:${asset.uri}`;
    if (seenAttachmentIds.has(attachmentId)) return false;
    seenAttachmentIds.add(attachmentId);
    return true;
  });
};

const persistAssetsToScene = (nextAssets = assetsRef.current) => {
  if (!scene) return;

  const uniqueAssets = dedupeSceneAssets(nextAssets);
  updateScene(scene.id, { assets: uniqueAssets });
};

const updateAssets = (getNextAssets: any[] | ((currentAssets: any[]) => any[])) => {
  const currentAssets = assetsRef.current;
  const nextAssets =
    typeof getNextAssets === 'function'
      ? getNextAssets(currentAssets)
      : getNextAssets;
  const uniqueAssets = dedupeSceneAssets(nextAssets);

  assetsRef.current = uniqueAssets;
  setAssets(uniqueAssets);
  persistAssetsToScene(uniqueAssets);
};

const addAssetFromLibrary = (libraryAsset: any) => {
  const libraryItemId =
    libraryAsset.libraryItemId || libraryAsset.id || libraryAsset.uri;

  updateAssets((currentAssets) => {
    if (currentAssets.some((asset) => getLibraryItemId(asset) === libraryItemId)) {
      return currentAssets;
    }

    return [
    ...currentAssets,
    {
      id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'image',
      uri: libraryAsset.uri,
      ...getNextImagePosition(currentAssets),
      width: libraryAsset.width || 220,
      height: libraryAsset.height || 160,
      alt: libraryAsset.alt || '',
      libraryItemId: libraryAsset.libraryItemId || libraryAsset.id || libraryAsset.uri,
      reusedFromAssetId: libraryAsset.id,
    },
    ];
  });
};

const addAudioFromLibrary = (libraryAsset: any) => {
  stopPreviewAudio();

  updateAssets((currentAssets) => [
    ...currentAssets.filter((asset) => asset.type !== 'audio'),
    {
      id: `audio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'audio',
      uri: libraryAsset.uri,
      name: libraryAsset.name || 'Audio file',
      libraryItemId: libraryAsset.libraryItemId || libraryAsset.id || libraryAsset.uri,
      reusedFromAssetId: libraryAsset.id,
    },
  ]);
};

const returnToSceneEditor = () => {
  if (!scene) return;

  stopPreviewAudio();
  persistAssetsToScene();

  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace({
    pathname: '/scene-editor',
    params: {
      sceneId: scene.id,
      restoreScroll: 'true',
    },
  });
};

const openDrawingPad = (drawingAssetId?: string) => {
  if (!scene || sceneIndex === -1) return;

  persistAssetsToScene();

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

  updateAssets((currentAssets) => {
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
  const assetId = selectedAssetId;
  if (!assetId) return;

  const sizes = {
    small: { width: 140, height: 100 },
    medium: { width: 220, height: 160 },
    large: { width: 300, height: 220 },
  };

  updateAssets((currentAssets) =>
    currentAssets.map((asset) =>
      asset.id === assetId && asset.type === 'image'
        ? {
            ...asset,
            width: sizes[size].width,
            height: sizes[size].height,
          }
        : asset
    )
  );

  setSelectedAssetId(assetId);
};

  const updateAssetPosition = (id: string, x: number, y: number) => {
    updateAssets((currentAssets) =>
      currentAssets.map((asset) =>
        asset.id === id ? { ...asset, x, y } : asset
      )
    );
  };

  const pickImage = async () => {
    if (mediaActionInProgress.current) return;
    mediaActionInProgress.current = true;

    try {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission needed', 'Please allow access to your image library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
      base64: Platform.OS === 'web',
    });

    if (result.canceled) return;

    const selected = result.assets[0];

    if (!selected?.uri) return;

    const persistentUri = await getPersistentMediaUri(
      selected,
      selected.mimeType || 'image/jpeg',
    );
    const attachmentId = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    updateAssets((currentAssets) => [
      ...currentAssets,
      {
        id: attachmentId,
        type: 'image',
        uri: persistentUri,
        ...getNextImagePosition(currentAssets),
        width: 220,
        height: 160,
        alt: '',
        libraryItemId: attachmentId,
      },
    ]);
    } finally {
      mediaActionInProgress.current = false;
    }
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
  if (recordingSaveInProgress.current) return;
  recordingSaveInProgress.current = true;

  try {
  await audioRecorder.stop();

  const recordedUri = audioRecorder.uri;

  if (!recordedUri) {
    Alert.alert('Recording problem', 'The recording could not be saved.');
    return;
  }

  const extension =
    recordedUri.split('.').pop()?.split('?')[0] || 'm4a';

  let permanentUri = recordedUri;
  if (Platform.OS === 'web') {
    permanentUri = await getPersistentMediaUri(
      { uri: recordedUri, mimeType: 'audio/webm' },
      'audio/webm',
    );
  } else {
    permanentUri =
      `${FileSystem.documentDirectory}voice-note-${Date.now()}.${extension}`;
    await FileSystem.copyAsync({
      from: recordedUri,
      to: permanentUri,
    });
  }

  stopPreviewAudio();

  const attachmentId = `audio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  updateAssets((currentAssets) => [
    ...currentAssets.filter((asset) => asset.type !== 'audio'),
    {
      id: attachmentId,
      type: 'audio',
      uri: permanentUri,
      name: `Voice note ${new Date().toLocaleTimeString()}`,
      libraryItemId: attachmentId,
    },
  ]);
  } finally {
    recordingSaveInProgress.current = false;
  }
};

const pickAudio = async () => {
  if (mediaActionInProgress.current) return;
  mediaActionInProgress.current = true;

  try {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'audio/*',
    copyToCacheDirectory: true,
  });

  if (result.canceled) return;

  const file = result.assets[0];

  if (!file?.uri) return;

  stopPreviewAudio();

  const persistentUri = await getPersistentMediaUri(
    file,
    file.mimeType || 'audio/mpeg',
  );

  const attachmentId = `audio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  updateAssets((currentAssets) => [
    ...currentAssets.filter((asset) => asset.type !== 'audio'),
    {
      id: attachmentId,
      type: 'audio',
      uri: persistentUri,
      name: file.name || 'Audio file',
      libraryItemId: attachmentId,
    },
  ]);
  } finally {
    mediaActionInProgress.current = false;
  }
};




  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable
        style={styles.backButton}
        onPress={returnToSceneEditor}

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
        <View style={styles.sectionHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Media library</Text>
            <Text style={styles.librarySummaryText}>{mediaLibrarySummary}</Text>
          </View>

          <InfoButton
            title="Media library"
            message="Reuse drawings, images, voice notes, and audio that already exist in this story. Visual media is copied into this scene. Audio replaces this scene's current audio."
          />

          <Pressable
            style={styles.libraryToggleButton}
            onPress={() => setIsMediaLibraryExpanded((isExpanded) => !isExpanded)}
          >
            <Text style={styles.libraryToggleButtonText}>
              {isMediaLibraryExpanded ? 'Hide' : 'Show'}
            </Text>
          </Pressable>
        </View>

        {isMediaLibraryExpanded && (
          <View>
            {visualLibraryAssets.length > 0 || audioLibraryAssets.length > 0 ? (
              <View>
                {visualLibraryAssets.length > 0 && (
                  <View>
                    <Text style={styles.libraryGroupTitle}>Drawings and images</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator>
                      <View style={styles.libraryRow}>
                        {visualLibraryAssets.map((asset, index) => (
                          <View
                            key={`${asset.sourceSceneId}-${asset.id}-${index}`}
                            style={styles.libraryCard}
                          >
                            <Image
                              source={{ uri: asset.uri }}
                              style={styles.libraryThumbnail}
                              resizeMode={asset.alt === 'Drawing' ? 'contain' : 'cover'}
                            />
                            <Text style={styles.libraryAssetType}>
                              {asset.alt === 'Drawing' ? 'Drawing' : 'Image'}
                            </Text>
                            <Text style={styles.librarySource} numberOfLines={2}>
                              {asset.sourceSceneTitle}
                            </Text>
                            <Pressable
                              style={styles.libraryUseButton}
                              onPress={() => addAssetFromLibrary(asset)}
                            >
                              <Text style={styles.libraryUseButtonText}>Use here</Text>
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                )}

                {audioLibraryAssets.length > 0 && (
                  <View>
                    <Text style={styles.libraryGroupTitle}>Voice notes and audio</Text>
                    <View style={styles.audioLibraryStack}>
                      {audioLibraryAssets.map((asset: any, index) => (
                        <View
                          key={`${asset.sourceSceneId}-${asset.id}-${index}`}
                          style={styles.audioLibraryCard}
                        >
                          <View style={styles.audioLibraryIcon}>
                            <Text style={styles.audioLibraryIconText}>♪</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.audioLibraryName} numberOfLines={1}>
                              {asset.name || 'Audio file'}
                            </Text>
                            <Text style={styles.librarySource} numberOfLines={2}>
                              {asset.sourceSceneTitle}
                            </Text>
                          </View>
                          <Pressable
                            style={styles.libraryUseButton}
                            onPress={() => addAudioFromLibrary(asset)}
                          >
                            <Text style={styles.libraryUseButtonText}>Use here</Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <Text style={styles.empty}>No reusable media in this story yet.</Text>
            )}
          </View>
        )}
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
              updateAssets((currentAssets) =>
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

{selectedImageAsset && (
  <View style={styles.selectedAssetPanel}>
    <Text style={styles.selectedAssetTitle}>Selected image</Text>
    <Text style={styles.selectedAssetMeta}>Use the buttons below, or drag the selected image in the canvas.</Text>

    <View style={styles.sizeButtonRow}>
      <Pressable
        style={[
          styles.sizeButton,
          selectedImageSize === 'small' && styles.sizeButtonSelected,
        ]}
        onPress={() => resizeSelectedAsset('small')}
        accessibilityRole="button"
        accessibilityLabel="Set image size to small"
        accessibilityState={{ selected: selectedImageSize === 'small' }}
      >
        <Text
          style={[
            styles.sizeButtonText,
            selectedImageSize === 'small' && styles.sizeButtonTextSelected,
          ]}
        >
          Small
        </Text>
      </Pressable>

      <Pressable
        style={[
          styles.sizeButton,
          selectedImageSize === 'medium' && styles.sizeButtonSelected,
        ]}
        onPress={() => resizeSelectedAsset('medium')}
        accessibilityRole="button"
        accessibilityLabel="Set image size to medium"
        accessibilityState={{ selected: selectedImageSize === 'medium' }}
      >
        <Text
          style={[
            styles.sizeButtonText,
            selectedImageSize === 'medium' && styles.sizeButtonTextSelected,
          ]}
        >
          Medium
        </Text>
      </Pressable>

      <Pressable
        style={[
          styles.sizeButton,
          selectedImageSize === 'large' && styles.sizeButtonSelected,
        ]}
        onPress={() => resizeSelectedAsset('large')}
        accessibilityRole="button"
        accessibilityLabel="Set image size to large"
        accessibilityState={{ selected: selectedImageSize === 'large' }}
      >
        <Text
          style={[
            styles.sizeButtonText,
            selectedImageSize === 'large' && styles.sizeButtonTextSelected,
          ]}
        >
          Large
        </Text>
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

    {selectedImageAsset?.alt === 'Drawing' && (
      <Pressable
        style={styles.buttonSecondary}
        onPress={() => openDrawingPad(selectedImageAsset.id)}
      >
        <Text style={styles.buttonSecondaryText}>Edit selected drawing</Text>
      </Pressable>
    )}
    

    <Pressable
      style={styles.buttonSecondary}
      onPress={() => {
        updateAssets((currentAssets) =>
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
    <Text style={styles.buttonSecondaryText}>Add a drawing</Text>
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

  <View style={styles.autoplaySettingRow}>
    <View style={styles.autoplaySettingText}>
      <Text style={styles.autoplaySettingTitle}>
        Autoplay voice notes throughout this story
      </Text>
      <Text style={styles.autoplaySettingStatus}>
        {autoplayVoiceNotes ? 'On in Play mode' : 'Off by default'}
      </Text>
    </View>
    <Pressable
      style={[
        styles.autoplaySettingButton,
        autoplayVoiceNotes && styles.autoplaySettingButtonActive,
      ]}
      onPress={toggleAutoplayVoiceNotes}
      accessibilityRole="switch"
      accessibilityState={{ checked: autoplayVoiceNotes }}
      accessibilityLabel="Autoplay voice notes throughout this story"
    >
      <Text style={[
        styles.autoplaySettingButtonText,
        autoplayVoiceNotes && styles.autoplaySettingButtonTextActive,
      ]}>
        {autoplayVoiceNotes ? 'On' : 'Off'}
      </Text>
    </Pressable>
  </View>

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

          updateAssets((currentAssets) =>
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

      <View style={styles.autoSaveStatusBox}>
        <Text style={styles.autoSaveStatusText}>Media saves automatically</Text>
      </View>

      <Pressable style={styles.buttonSecondary} onPress={returnToSceneEditor}>
        <Text style={styles.buttonSecondaryText}>Back to scene</Text>
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
  autoplaySettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#C9D8B8',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#F0F7E8',
  },
  autoplaySettingText: {
    flex: 1,
    minWidth: 0,
  },
  autoplaySettingTitle: {
    color: '#2A251D',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  autoplaySettingStatus: {
    color: '#6F675A',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  autoplaySettingButton: {
    minWidth: 54,
    borderWidth: 1,
    borderColor: '#6E9358',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    backgroundColor: '#FFFDF7',
  },
  autoplaySettingButtonActive: {
    backgroundColor: '#247322',
    borderColor: '#247322',
  },
  autoplaySettingButtonText: {
    color: '#247322',
    fontWeight: '900',
  },
  autoplaySettingButtonTextActive: {
    color: '#FFFFFF',
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
  librarySummaryText: {
    color: '#665D4E',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 3,
  },

  libraryToggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#E9F2DD',
    borderWidth: 1,
    borderColor: '#C9DEBA',
  },

  libraryToggleButtonText: {
    color: '#247322',
    fontSize: 13,
    fontWeight: '900',
  },

  libraryGroupTitle: {
    color: '#2A251D',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 4,
    marginBottom: 8,
  },
  audioLibraryStack: {
    gap: 8,
  },
  audioLibraryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#D8CCAA',
    borderRadius: 18,
    padding: 10,
    backgroundColor: '#FFFDF7',
  },
  audioLibraryIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#E9F2DD',
    borderWidth: 1,
    borderColor: '#6E9358',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioLibraryIconText: {
    color: '#247322',
    fontSize: 20,
    fontWeight: '900',
  },
  audioLibraryName: {
    color: '#2A251D',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 2,
  },
  libraryRow: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 6,
  },
  libraryCard: {
    width: 138,
    borderWidth: 1,
    borderColor: '#D8CCAA',
    borderRadius: 18,
    padding: 10,
    backgroundColor: '#FFFDF7',
  },
  libraryThumbnail: {
    width: '100%',
    height: 84,
    borderRadius: 12,
    backgroundColor: '#F5EFD9',
    marginBottom: 8,
  },
  libraryAssetType: {
    color: '#247322',
    fontWeight: '900',
    fontSize: 12,
    marginBottom: 3,
  },
  librarySource: {
    color: '#665D4E',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    minHeight: 32,
    marginBottom: 8,
  },
  libraryUseButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#E9F2DD',
    borderWidth: 1,
    borderColor: '#6E9358',
    alignItems: 'center',
  },
  libraryUseButtonText: {
    color: '#247322',
    fontWeight: '900',
    fontSize: 12,
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

  autoSaveStatusBox: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D8CCAA',
    backgroundColor: '#E9F2DD',
    marginTop: 8,
    marginBottom: 12,
  },

  autoSaveStatusText: {
    color: '#4F6F52',
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
  sizeButtonSelected: {
    backgroundColor: '#2D6B2F',
    borderColor: '#2D6B2F',
  },

  sizeButtonText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#247322',
  },

  sizeButtonTextSelected: {
    color: '#FFFFFF',
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
