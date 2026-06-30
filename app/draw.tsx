import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import SignatureScreen from 'react-native-signature-canvas';
import * as FileSystem from 'expo-file-system/legacy';
import { useStoryStore } from '../store/storyStore';

export default function DrawScreen() {
  const signatureRef = useRef<any>(null);
  const { sceneId, drawingAssetId } = useLocalSearchParams();

  const [selectedColor, setSelectedColor] = useState('#111111');
const [isEraser, setIsEraser] = useState(false);

const drawingColors = [
  '#111111',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
];

const [initialDrawingDataUrl, setInitialDrawingDataUrl] = useState<string | null>(null);
const [isLoadingDrawing, setIsLoadingDrawing] = useState(false);

  const currentStory = useStoryStore((state) => state.getCurrentStory());
  const updateScene = useStoryStore((state) => state.updateScene);

  const scenes = currentStory?.scenes || [];
  const scene = scenes.find((s) => s.id === sceneId);
  const sceneIndex = scenes.findIndex((s) => s.id === sceneId);

  const drawingAsset =
  typeof drawingAssetId === 'string'
    ? scene?.assets?.find((asset) => asset.id === drawingAssetId)
    : undefined;

  if (!scene || sceneIndex === -1) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Drawing pad ✏️</Text>
        <Text style={styles.empty}>Scene not found.</Text>

        <Pressable style={styles.secondaryButton} onPress={() => router.replace('/story')}>
          <Text>← Back to story</Text>
        </Pressable>
      </View>
    );
  }

  useEffect(() => {
  const loadExistingDrawing = async () => {
    if (!drawingAsset?.uri) {
      setInitialDrawingDataUrl(null);
      return;
    }

    try {
      setIsLoadingDrawing(true);

      const base64 = await FileSystem.readAsStringAsync(drawingAsset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      setInitialDrawingDataUrl(`data:image/png;base64,${base64}`);
    } catch (error) {
      console.error(error);
      Alert.alert(
        'Drawing problem',
        'The existing drawing could not be loaded. You can still create a new one.'
      );
    } finally {
      setIsLoadingDrawing(false);
    }
  };

  loadExistingDrawing();
}, [drawingAsset?.uri]);

const saveDrawing = async (signature: string) => {
  try {
    const base64 = signature.replace('data:image/png;base64,', '');
    const drawingUri = `${FileSystem.documentDirectory}drawing-${Date.now()}.png`;

    await FileSystem.writeAsStringAsync(drawingUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const isEditingExistingDrawing = typeof drawingAssetId === 'string';

    const updatedAssets = isEditingExistingDrawing
  ? (scene.assets || []).map((asset) =>
      asset.id === drawingAssetId
        ? {
            ...asset,
            uri: drawingUri,
            alt: 'Drawing',
          }
        : asset
    )
  : [
      ...(scene.assets || []),
      {
        id: `drawing-${Date.now()}`,
        type: 'image' as const,
        uri: drawingUri,
        x: 0,
        y: 0,
        width: 260,
        height: 220,
        alt: 'Drawing',
      },
    ];

    updateScene(sceneIndex, {
      ...scene,
      assets: updatedAssets,
    });

    router.replace({
      pathname: '/scene-media',
      params: { sceneId: scene.id },
    });
  } catch (error) {
    console.error(error);
    Alert.alert('Drawing problem', 'The drawing could not be saved.');
  }
};

  const handleEmpty = () => {
    Alert.alert('Empty drawing', 'Draw something first, then save it.');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Drawing pad ✏️</Text>
      <Text style={styles.sceneContext}>{scene.title || 'Untitled scene'}</Text>

      <View style={styles.toolCard}>
  <Text style={styles.toolLabel}>Drawing tools</Text>

  <View style={styles.colorRow}>
    {drawingColors.map((color) => (
      <Pressable
        key={color}
        accessibilityLabel={`Use color ${color}`}
        style={[
          styles.colorSwatch,
          { backgroundColor: color },
          selectedColor === color && !isEraser && styles.colorSwatchSelected,
        ]}
        onPress={() => {
          setSelectedColor(color);
          setIsEraser(false);
          signatureRef.current?.changePenColor(color);
          signatureRef.current?.changePenSize(2, 4);
        }}
      />
    ))}
  </View>

  <View style={styles.toolButtonRow}>
    <Pressable
      style={[
        styles.toolButton,
        isEraser && styles.toolButtonActive,
      ]}
      onPress={() => {
        setIsEraser(true);
        signatureRef.current?.changePenColor('#ffffff');
        signatureRef.current?.changePenSize(12, 18);
      }}
    >
      <Text
        style={[
          styles.toolButtonText,
          isEraser && styles.toolButtonTextActive,
        ]}
      >
        Eraser
      </Text>
    </Pressable>

    <Pressable
      style={styles.toolButton}
      onPress={() => {
        setIsEraser(false);
        signatureRef.current?.changePenColor(selectedColor);
        signatureRef.current?.changePenSize(2, 4);
      }}
    >
      <Text style={styles.toolButtonText}>Pen</Text>
    </Pressable>

    <Pressable
      style={styles.toolButton}
      onPress={() => signatureRef.current?.undo()}
    >
      <Text style={styles.toolButtonText}>Undo</Text>
    </Pressable>
  </View>
</View>

{isLoadingDrawing && (
  <Text style={styles.loadingText}>Loading existing drawing...</Text>
)}

      <View style={styles.canvasWrapper}>
        <SignatureScreen
          ref={signatureRef}
          dataURL={initialDrawingDataUrl || undefined}
          penColor={isEraser ? '#ffffff' : selectedColor}
          minWidth={isEraser ? 12 : 2}
          maxWidth={isEraser ? 18 : 4}
          onOK={saveDrawing}
          onEmpty={handleEmpty}
          descriptionText="Draw a symbol, memory, map, or feeling"
          clearText="Clear"
          confirmText="Save drawing"
          webStyle={`
            .m-signature-pad {
              box-shadow: none;
              border: none;
            }
            .m-signature-pad--body {
              border: none;
            }
            .m-signature-pad--footer {
              display: none;
            }
            body,html {
              background-color: #ffffff;
            }
          `}
        />
      </View>

      <View style={styles.buttonRow}>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => signatureRef.current?.clearSignature()}
        >
          <Text>Clear</Text>
        </Pressable>

        <Pressable
          style={styles.primaryButton}
          onPress={() => signatureRef.current?.readSignature()}
        >
          <Text style={styles.primaryButtonText}>Save drawing</Text>
        </Pressable>
      </View>

      <Pressable
        style={styles.secondaryButton}
        onPress={() =>
          router.replace({
            pathname: '/scene-media',
            params: { sceneId: scene.id },
          })
        }
      >
        <Text>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingBottom: 60,
    backgroundColor: '#fff',
  },

  loadingText: {
  color: '#666',
  marginBottom: 10,
  fontWeight: '600',
},

  toolCard: {
  borderWidth: 1,
  borderColor: '#eee',
  backgroundColor: '#fafafa',
  borderRadius: 14,
  padding: 12,
  marginBottom: 14,
},

toolLabel: {
  fontSize: 13,
  fontWeight: '700',
  color: '#666',
  marginBottom: 10,
},

colorRow: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 10,
  marginBottom: 12,
},

colorSwatch: {
  width: 34,
  height: 34,
  borderRadius: 999,
  borderWidth: 2,
  borderColor: '#fff',
},

colorSwatchSelected: {
  borderColor: '#222',
  transform: [{ scale: 1.08 }],
},

toolButtonRow: {
  flexDirection: 'row',
  gap: 8,
  flexWrap: 'wrap',
},

toolButton: {
  paddingVertical: 9,
  paddingHorizontal: 12,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: '#ddd',
  backgroundColor: '#fff',
},

toolButtonActive: {
  backgroundColor: '#222',
  borderColor: '#222',
},

toolButtonText: {
  color: '#333',
  fontWeight: '700',
  fontSize: 13,
},

toolButtonTextActive: {
  color: '#fff',
},

  heading: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },

  sceneContext: {
    color: '#666',
    marginBottom: 16,
  },

  empty: {
    color: '#888',
    marginBottom: 12,
  },

  canvasWrapper: {
    flex: 1,
    minHeight: 360,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    marginBottom: 16,
  },

  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },

  primaryButton: {
    flex: 1,
    backgroundColor: '#222',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },

  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },

  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
});