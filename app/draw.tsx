import {
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  Platform,
} from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import DrawingCanvas, {
  type DrawingCanvasRef,
} from "../components/drawing-canvas";
import * as FileSystem from "expo-file-system/legacy";
import { useStoryStore } from "../store/storyStore";
import { confirmAction } from "../utils/platformDialogs";

const CANVAS_BACKGROUND = "#FBF8EE";
const ERASER_MIN_WIDTH = 16;
const ERASER_MAX_WIDTH = 24;

const DRAWING_COLORS = [
  { name: "Black", value: "#111111", dark: true },
  { name: "Dark grey", value: "#4B5563", dark: true },
  { name: "White", value: "#FFFFFF", dark: false },
  { name: "Red", value: "#DC3F45", dark: true },
  { name: "Orange", value: "#F47B35", dark: false },
  { name: "Yellow", value: "#F2C94C", dark: false },
  { name: "Green", value: "#3C8D4E", dark: true },
  { name: "Light blue", value: "#62A9E8", dark: false },
  { name: "Dark blue", value: "#2456A6", dark: true },
  { name: "Purple", value: "#7652A8", dark: true },
  { name: "Pink", value: "#E978A8", dark: false },
  { name: "Brown", value: "#8B5A3C", dark: true },
] as const;

const BRUSH_SIZES = [
  { name: "Small", minWidth: 1, maxWidth: 2, previewWidth: 2 },
  { name: "Medium", minWidth: 3, maxWidth: 5, previewWidth: 5 },
  { name: "Large", minWidth: 7, maxWidth: 10, previewWidth: 9 },
] as const;

type BrushSizeName = (typeof BRUSH_SIZES)[number]["name"];
type CapturePurpose = "history" | "clear" | "save";

export default function DrawScreen() {
  const signatureRef = useRef<DrawingCanvasRef | null>(null);
  const isSavingDrawing = useRef(false);
  const saveReturnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureQueue = useRef<CapturePurpose[]>([]);
  const historyRef = useRef<string[]>([""]);
  const historyIndexRef = useRef(0);
  const savedSnapshotRef = useRef("");

  const { height: windowHeight } = useWindowDimensions();
  const isCompactPhone = windowHeight < 700;
  const { sceneId, drawingAssetId } = useLocalSearchParams();
  const requestedSceneId = typeof sceneId === "string" ? sceneId : undefined;
  const requestedDrawingAssetId =
    typeof drawingAssetId === "string" ? drawingAssetId : undefined;

  const currentStory = useStoryStore((state) => state.getCurrentStory());
  const updateScene = useStoryStore((state) => state.updateScene);
  const scenes = currentStory?.scenes || [];
  const scene = scenes.find((item) => item.id === requestedSceneId);
  const drawingAsset = requestedDrawingAssetId
    ? scene?.assets?.find((asset) => asset.id === requestedDrawingAssetId)
    : undefined;

  const [selectedColor, setSelectedColor] = useState("#111111");
  const [selectedBrushSize, setSelectedBrushSize] =
    useState<BrushSizeName>("Medium");
  const [isEraser, setIsEraser] = useState(false);
  const [initialDrawingDataUrl, setInitialDrawingDataUrl] = useState<
    string | null
  >(null);
  const [isLoadingDrawing, setIsLoadingDrawing] = useState(
    !!requestedDrawingAssetId,
  );
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [historyLength, setHistoryLength] = useState(1);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  const selectedSize =
    BRUSH_SIZES.find((size) => size.name === selectedBrushSize) ||
    BRUSH_SIZES[1];

  const setHistory = useCallback((nextHistory: string[], nextIndex: number) => {
    historyRef.current = nextHistory;
    historyIndexRef.current = nextIndex;
    setHistoryLength(nextHistory.length);
    setHistoryIndex(nextIndex);
    setIsDirty(nextHistory[nextIndex] !== savedSnapshotRef.current);
  }, []);

  const initialiseHistory = useCallback(
    (snapshot: string) => {
      historyRef.current = [snapshot];
      historyIndexRef.current = 0;
      savedSnapshotRef.current = snapshot;
      setHistoryLength(1);
      setHistoryIndex(0);
      setIsDirty(false);
    },
    [],
  );

  useEffect(() => {
    const loadExistingDrawing = async () => {
      if (!drawingAsset?.uri) {
        setInitialDrawingDataUrl(null);
        setIsLoadingDrawing(false);
        initialiseHistory("");
        return;
      }

      try {
        setIsLoadingDrawing(true);
        if (drawingAsset.uri.startsWith("data:")) {
          setInitialDrawingDataUrl(drawingAsset.uri);
          initialiseHistory(drawingAsset.uri);
          return;
        }
        const base64 = await FileSystem.readAsStringAsync(drawingAsset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const dataUrl = `data:image/png;base64,${base64}`;
        setInitialDrawingDataUrl(dataUrl);
        initialiseHistory(dataUrl);
      } catch (error) {
        console.error(error);
        setInitialDrawingDataUrl(null);
        initialiseHistory("");
        Alert.alert(
          "Drawing problem",
          "The existing drawing could not be loaded. You can still create a new one.",
        );
      } finally {
        setIsLoadingDrawing(false);
      }
    };

    loadExistingDrawing();
  }, [drawingAsset?.uri, initialiseHistory, requestedDrawingAssetId]);

  useEffect(
    () => () => {
      if (saveReturnTimer.current) clearTimeout(saveReturnTimer.current);
    },
    [],
  );

  const returnToMedia = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    if (scene?.id) {
      router.replace({
        pathname: "/scene-media",
        params: { sceneId: scene.id },
      });
      return;
    }

    router.dismissTo("/story");
  }, [scene?.id]);

  const attemptToLeave = useCallback(() => {
    if (isSavingDrawing.current) {
      setFeedback("Saving drawing...");
      return;
    }

    if (!isDirty) {
      returnToMedia();
      return;
    }

    confirmAction(
      "Discard unsaved drawing?",
      "Your latest drawing changes have not been saved.",
      "Discard",
      returnToMedia,
      true,
    );
  }, [isDirty, returnToMedia]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        attemptToLeave();
        return true;
      },
    );
    return () => backHandler.remove();
  }, [attemptToLeave]);

  const appendHistorySnapshot = (snapshot: string) => {
    const validHistory = historyRef.current.slice(
      0,
      historyIndexRef.current + 1,
    );
    if (validHistory[validHistory.length - 1] === snapshot) return;
    validHistory.push(snapshot);
    setHistory(validHistory, validHistory.length - 1);
  };

  const finishClear = (snapshotBeforeClear: string) => {
    const validHistory = historyRef.current.slice(
      0,
      historyIndexRef.current + 1,
    );
    if (validHistory[validHistory.length - 1] !== snapshotBeforeClear) {
      validHistory.push(snapshotBeforeClear);
    }
    if (validHistory[validHistory.length - 1] !== "") validHistory.push("");

    signatureRef.current?.clearSignature();
    signatureRef.current?.draw();
    signatureRef.current?.changePenColor(selectedColor);
    signatureRef.current?.changePenSize(
      selectedSize.minWidth,
      selectedSize.maxWidth,
    );
    setIsEraser(false);
    setHistory(validHistory, validHistory.length - 1);
    setFeedback("Drawing cleared. Undo is available.");
  };

  const saveDrawing = async (signature: string) => {
    if (!scene || !isSavingDrawing.current) return;

    try {
      const timestamp = Date.now();
      let drawingUri = signature;
      if (Platform.OS !== "web") {
        const base64 = signature.replace("data:image/png;base64,", "");
        drawingUri = `${FileSystem.documentDirectory}drawing-${timestamp}.png`;
        await FileSystem.writeAsStringAsync(drawingUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      const isEditingExistingDrawing = !!drawingAsset;
      const attachmentId = isEditingExistingDrawing
        ? drawingAsset.id
        : `drawing-${timestamp}-${Math.random().toString(36).slice(2, 7)}`;

      updateScene(scene.id, (latestScene) => {
        const currentAssets = latestScene.assets || [];
        if (isEditingExistingDrawing) {
          return {
            ...latestScene,
            assets: currentAssets.map((asset) =>
              asset.id === drawingAsset.id
                ? { ...asset, uri: drawingUri, alt: "Drawing" }
                : asset,
            ),
          };
        }

        if (currentAssets.some((asset) => asset.id === attachmentId)) {
          return latestScene;
        }

        return {
          ...latestScene,
          assets: [
            ...currentAssets,
            {
              id: attachmentId,
              type: "image" as const,
              uri: drawingUri,
              x: 0,
              y: 0,
              width: 260,
              height: 220,
              alt: "Drawing",
              libraryItemId: attachmentId,
            },
          ],
        };
      });

      savedSnapshotRef.current = signature;
      setIsDirty(false);
      setFeedback("Drawing saved.");
      saveReturnTimer.current = setTimeout(returnToMedia, 700);
    } catch (error) {
      isSavingDrawing.current = false;
      setIsSaving(false);
      console.error(error);
      Alert.alert("Drawing problem", "The drawing could not be saved.");
    }
  };

  const handleSignatureResult = (signature: string) => {
    const purpose = captureQueue.current.shift();
    if (purpose === "history") {
      appendHistorySnapshot(signature);
      return;
    }
    if (purpose === "clear") {
      finishClear(signature);
      return;
    }
    if (purpose === "save") saveDrawing(signature);
  };

  const handleEmptyResult = () => {
    const purpose = captureQueue.current.shift();
    if (purpose === "history") {
      appendHistorySnapshot("");
      return;
    }
    if (purpose === "clear") {
      finishClear("");
      return;
    }
    if (purpose === "save") {
      isSavingDrawing.current = false;
      setIsSaving(false);
      Alert.alert("Empty drawing", "Draw something first, then save it.");
    }
  };

  const captureHistoryAfterStroke = () => {
    captureQueue.current.push("history");
    signatureRef.current?.readSignature();
  };

  const beginStroke = () => {
    setFeedback("");
    setIsDirty(true);
    if (historyIndexRef.current < historyRef.current.length - 1) {
      const validHistory = historyRef.current.slice(
        0,
        historyIndexRef.current + 1,
      );
      historyRef.current = validHistory;
      setHistoryLength(validHistory.length);
    }
  };

  const selectColor = (color: string) => {
    setSelectedColor(color);
    setIsEraser(false);
    signatureRef.current?.draw();
    signatureRef.current?.changePenColor(color);
    signatureRef.current?.changePenSize(
      selectedSize.minWidth,
      selectedSize.maxWidth,
    );
  };

  const selectBrushSize = (name: BrushSizeName) => {
    const size = BRUSH_SIZES.find((option) => option.name === name);
    if (!size) return;
    setSelectedBrushSize(name);
    if (!isEraser) {
      signatureRef.current?.changePenSize(size.minWidth, size.maxWidth);
    }
  };

  const activateBrush = () => {
    setIsEraser(false);
    signatureRef.current?.draw();
    signatureRef.current?.changePenColor(selectedColor);
    signatureRef.current?.changePenSize(
      selectedSize.minWidth,
      selectedSize.maxWidth,
    );
  };

  const activateEraser = () => {
    setIsEraser(true);
    signatureRef.current?.erase();
    signatureRef.current?.changePenSize(
      ERASER_MIN_WIDTH,
      ERASER_MAX_WIDTH,
    );
  };

  const restoreHistory = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= historyRef.current.length) return;
    signatureRef.current?.setDataURL(historyRef.current[nextIndex]);
    setHistory(historyRef.current, nextIndex);
    setFeedback("");
  };

  const requestClear = () => {
    confirmAction(
      "Clear the whole drawing?",
      "You can undo this during this session.",
      "Clear",
      () => {
        captureQueue.current.push("clear");
        signatureRef.current?.readSignature();
      },
      true,
    );
  };

  const requestSave = () => {
    if (isSavingDrawing.current || !isCanvasReady || isLoadingDrawing) return;
    isSavingDrawing.current = true;
    setIsSaving(true);
    setFeedback("Saving drawing...");
    captureQueue.current.push("save");
    signatureRef.current?.readSignature();
  };

  if (!scene) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <Stack.Screen options={{ title: "Drawing Pad" }} />
        <Text style={styles.heading}>Drawing Pad</Text>
        <Text style={styles.empty}>Scene not found.</Text>
        <Pressable style={styles.secondaryButton} onPress={() => router.dismissTo("/story")}>
          <Text style={styles.secondaryButtonText}>Back to story</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < historyLength - 1;
  const canClear = historyRef.current[historyIndex] !== "" || isDirty;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, isCompactPhone && styles.headerCompact]}>
        <Pressable
          style={styles.backButton}
          onPress={attemptToLeave}
          accessibilityRole="button"
          accessibilityLabel="Back to Scene Media"
        >
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.heading}>Drawing Pad</Text>
          <Text style={styles.sceneContext} numberOfLines={1}>
            {scene.title || "Untitled scene"}
          </Text>
        </View>
      </View>

      <View style={[styles.toolCard, isCompactPhone && styles.toolCardCompact]}>
        <Text style={styles.toolLabel}>Colour</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.colorRow}
        >
          {DRAWING_COLORS.map((color) => {
            const isSelected = selectedColor === color.value && !isEraser;
            return (
              <Pressable
                key={color.value}
                accessibilityRole="button"
                accessibilityLabel={`Use ${color.name}`}
                accessibilityState={{ selected: isSelected }}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: color.value },
                  color.name === "White" && styles.whiteSwatch,
                  isSelected && styles.colorSwatchSelected,
                ]}
                onPress={() => selectColor(color.value)}
              >
                {isSelected && (
                  <Text
                    style={[
                      styles.swatchCheck,
                      { color: color.dark ? "#FFFFFF" : "#222222" },
                    ]}
                  >
                    ✓
                  </Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.toolLabel}>Brush size</Text>
        <View style={styles.brushSizeRow}>
          {BRUSH_SIZES.map((size) => {
            const isSelected = selectedBrushSize === size.name;
            return (
              <Pressable
                key={size.name}
                style={[
                  styles.brushSizeButton,
                  isSelected && styles.controlButtonSelected,
                ]}
                onPress={() => selectBrushSize(size.name)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${size.name} brush`}
              >
                <View
                  style={[
                    styles.brushPreview,
                    {
                      height: size.previewWidth,
                      backgroundColor: selectedColor,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.controlButtonText,
                    isSelected && styles.controlButtonTextSelected,
                  ]}
                >
                  {size.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.editActionRow}>
          <Pressable
            style={[styles.modeButton, !isEraser && styles.controlButtonSelected]}
            onPress={activateBrush}
            accessibilityRole="button"
            accessibilityState={{ selected: !isEraser }}
          >
            <Text
              style={[
                styles.controlButtonText,
                !isEraser && styles.controlButtonTextSelected,
              ]}
            >
              Brush
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeButton, isEraser && styles.eraserButtonActive]}
            onPress={activateEraser}
            accessibilityRole="button"
            accessibilityState={{ selected: isEraser }}
          >
            <Text
              style={[
                styles.controlButtonText,
                isEraser && styles.eraserButtonTextActive,
              ]}
            >
              Eraser
            </Text>
          </Pressable>
          <Pressable
            style={[styles.historyButton, !canUndo && styles.buttonDisabled]}
            disabled={!canUndo}
            onPress={() => restoreHistory(historyIndex - 1)}
            accessibilityRole="button"
            accessibilityLabel="Undo last drawing action"
            accessibilityState={{ disabled: !canUndo }}
          >
            <Text style={[styles.controlButtonText, !canUndo && styles.textDisabled]}>
              Undo
            </Text>
          </Pressable>
          <Pressable
            style={[styles.historyButton, !canRedo && styles.buttonDisabled]}
            disabled={!canRedo}
            onPress={() => restoreHistory(historyIndex + 1)}
            accessibilityRole="button"
            accessibilityLabel="Redo drawing action"
            accessibilityState={{ disabled: !canRedo }}
          >
            <Text style={[styles.controlButtonText, !canRedo && styles.textDisabled]}>
              Redo
            </Text>
          </Pressable>
          <Pressable
            style={[styles.clearButton, !canClear && styles.buttonDisabled]}
            disabled={!canClear}
            onPress={requestClear}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canClear }}
          >
            <Text style={[styles.clearButtonText, !canClear && styles.textDisabled]}>
              Clear
            </Text>
          </Pressable>
        </View>
      </View>

      {isLoadingDrawing && (
        <Text style={styles.loadingText}>Loading existing drawing...</Text>
      )}

      <View
        style={[
          styles.canvasWrapper,
          isCompactPhone && styles.canvasWrapperCompact,
        ]}
      >
        <DrawingCanvas
          ref={signatureRef}
          dataURL={initialDrawingDataUrl || undefined}
          penColor="#111111"
          backgroundColor={CANVAS_BACKGROUND}
          minWidth={3}
          maxWidth={5}
          onOK={handleSignatureResult}
          onEmpty={handleEmptyResult}
          onBegin={beginStroke}
          onEnd={captureHistoryAfterStroke}
          onLoadEnd={() => {
            setIsCanvasReady(true);
            activateBrush();
          }}
          onError={(error) => {
            console.error(error);
            Alert.alert("Drawing problem", "The drawing canvas could not be loaded.");
          }}
        />
      </View>

      <View style={styles.saveArea}>
        {!!feedback && (
          <Text
            style={styles.feedbackText}
            accessibilityLiveRegion="polite"
          >
            {feedback}
          </Text>
        )}
        <Pressable
          style={[
            styles.primaryButton,
            (isSaving || !isCanvasReady || isLoadingDrawing) &&
              styles.primaryButtonDisabled,
          ]}
          disabled={isSaving || !isCanvasReady || isLoadingDrawing}
          onPress={requestSave}
          accessibilityRole="button"
          accessibilityState={{
            disabled: isSaving || !isCanvasReady || isLoadingDrawing,
          }}
        >
          <Text style={styles.primaryButtonText}>
            {isSaving ? "Saving..." : "Save drawing"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: CANVAS_BACKGROUND,
  },
  header: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  headerCompact: {
    minHeight: 46,
    marginBottom: 5,
  },
  headerText: {
    flex: 1,
  },
  backButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#B9C9A8",
    borderRadius: 20,
    backgroundColor: "#FFFDF7",
  },
  backButtonText: {
    color: "#2F6F2B",
    fontWeight: "800",
  },
  heading: {
    color: "#28231C",
    fontSize: 22,
    fontWeight: "900",
  },
  sceneContext: {
    color: "#665D4E",
    fontSize: 13,
    fontWeight: "700",
  },
  empty: {
    color: "#665D4E",
    marginBottom: 12,
  },
  toolCard: {
    borderWidth: 1,
    borderColor: "#D8CCAA",
    backgroundColor: "#FFFDF7",
    borderRadius: 12,
    padding: 9,
    marginBottom: 8,
  },
  toolCardCompact: {
    paddingVertical: 6,
    marginBottom: 5,
  },
  toolLabel: {
    color: "#665D4E",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 5,
  },
  colorRow: {
    gap: 8,
    paddingHorizontal: 2,
    paddingBottom: 8,
  },
  colorSwatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: "#D4C8A8",
    alignItems: "center",
    justifyContent: "center",
  },
  whiteSwatch: {
    borderColor: "#8C8475",
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: "#247322",
  },
  swatchCheck: {
    fontSize: 17,
    fontWeight: "900",
  },
  brushSizeRow: {
    flexDirection: "row",
    gap: 7,
    marginBottom: 7,
  },
  brushSizeButton: {
    flex: 1,
    minHeight: 42,
    paddingHorizontal: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D8CCAA",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  brushPreview: {
    width: 34,
    minHeight: 2,
    borderRadius: 5,
  },
  editActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  modeButton: {
    minHeight: 38,
    minWidth: 70,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#B9C9A8",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  historyButton: {
    minHeight: 38,
    minWidth: 64,
    paddingHorizontal: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D8CCAA",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  clearButton: {
    minHeight: 38,
    paddingHorizontal: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C98B83",
    backgroundColor: "#FFF8F6",
    alignItems: "center",
    justifyContent: "center",
  },
  clearButtonText: {
    color: "#9B3A2F",
    fontSize: 13,
    fontWeight: "800",
  },
  controlButtonSelected: {
    borderColor: "#247322",
    backgroundColor: "#E7F0DA",
  },
  eraserButtonActive: {
    borderColor: "#247322",
    backgroundColor: "#247322",
  },
  eraserButtonTextActive: {
    color: "#FFFFFF",
  },
  controlButtonText: {
    color: "#3D3528",
    fontSize: 12,
    fontWeight: "800",
  },
  controlButtonTextSelected: {
    color: "#175A22",
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  textDisabled: {
    color: "#8C8475",
  },
  loadingText: {
    color: "#665D4E",
    marginBottom: 5,
    fontSize: 12,
    fontWeight: "700",
  },
  canvasWrapper: {
    flex: 1,
    minHeight: 180,
    borderWidth: 1,
    borderColor: "#AEBF9C",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: CANVAS_BACKGROUND,
    marginBottom: 8,
  },
  canvasWrapperCompact: {
    minHeight: 135,
    marginBottom: 5,
  },
  saveArea: {
    paddingTop: 2,
  },
  feedbackText: {
    minHeight: 18,
    color: "#247322",
    textAlign: "center",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 4,
  },
  primaryButton: {
    minHeight: 48,
    backgroundColor: "#247322",
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonDisabled: {
    backgroundColor: "#8BA682",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  secondaryButton: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#B9C9A8",
    backgroundColor: "#FFFDF7",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#247322",
    fontWeight: "800",
  },
});
