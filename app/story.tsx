import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
  BackHandler,
  Alert,
  Platform,
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useStoryStore } from "../store/storyStore";
import { useState, useRef, useEffect } from "react";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { captureRef } from "react-native-view-shot";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { Asset } from "expo-asset";
import {
  clearScrollPosition,
  getScrollPosition,
  rememberScrollPosition,
} from "../utils/scrollMemory";
import {
  PLAY_FONT_OPTIONS,
  PLAY_TEXT_SIZE_OPTIONS,
  PLAY_THEMES,
  getPlayFont,
  getPlayTextSize,
  getPlayTheme,
  getStoryPlayAppearance,
} from "../utils/playAppearance";
import { downloadTextFileOnWeb } from "../utils/platformFiles";

const STORY_ICON_PRESETS = [
  "🪲",
  "🌿",
  "🌙",
  "🏠",
  "🚪",
  "🌊",
  "🔥",
  "⭐",
  "🧭",
  "💌",
  "🌳",
  "🫐",
];



type BackgroundMusic =
  | {
      type: "uploaded";
      uri: string;
      name: string;
    }
  | {
      type: "built-in";
      builtInId: string;
      name: string;
    };

const BUILT_IN_BACKGROUND_MUSIC = [
  {
    id: "soft-hip-hop",
    title: "Soft Branch",
    description: "Calm and gentle",
    asset: require("../assets/audio/soft-hip-hop.mp3"),
  },

  {
    id: "piano-remix",
    title: "Tiny Piano",
    description: "Light and playful",
    asset: require("../assets/audio/piano-remix.mp3"),
  },
  {
    id: "game-music",
    title: "Gentle Game Theme",
    description: "Classic game feeling",
    asset: require("../assets/audio/game-music.mp3"),
  },

  {
    id: "thriller-score",
    title: "Thriller Score",
    description: "Tense / spooky",
    asset: require("../assets/audio/thriller-score.mp3"),
  },
];

const getBuiltInBackgroundMusic = (builtInId?: string) =>
  BUILT_IN_BACKGROUND_MUSIC.find((track) => track.id === builtInId);

const getBackgroundMusicDisplayName = (music: any) => {
  if (!music) return "No music yet";

  if (music.type === "built-in" && music.builtInId) {
    return getBuiltInBackgroundMusic(music.builtInId)?.title || music.name || "Built-in music";
  }

  return music.name || "Music added";
};

const STORY_TREE_LAYOUT_DIRECTION: 'vertical' | 'horizontal' = 'vertical';
const STORY_TREE_NODE_WIDTH = 124;
const STORY_TREE_NODE_HEIGHT = 70;
const STORY_TREE_COLUMN_GAP = 40;
const STORY_TREE_ROW_GAP = 34;
const STORY_TREE_SIBLING_OFFSET = 132;
const STORY_TREE_PADDING = 12;
const STORY_TREE_EXPORT_PADDING = 16;
const STORY_TREE_MIN_ZOOM = 0.15;
const STORY_TREE_MAX_ZOOM = 1.8;
const STORY_TREE_ZOOM_STEP = 0.25;
const STORY_TREE_BRANCH_COLORS = [
  "#527A3A",
  "#2E6F78",
  "#8A5A44",
  "#76558A",
  "#9A6A13",
];

const stableStoryTreeHash = (value: string) =>
  Array.from(value).reduce(
    (hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0,
    0,
  );

type StoryVisibilityToggleProps = {
  visible: boolean;
  onPress: () => void;
  accessibilityLabel: string;
};

function StoryVisibilityToggle({
  visible,
  onPress,
  accessibilityLabel,
}: StoryVisibilityToggleProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.visibilityToggle,
        visible && styles.visibilityToggleVisible,
        pressed && styles.visibilityTogglePressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ expanded: visible }}
    >
      <Text
        style={[
          styles.visibilityToggleText,
          visible && styles.visibilityToggleTextVisible,
        ]}
      >
        {visible ? "Hide" : "Show"}
      </Text>
    </Pressable>
  );
}

export default function StoryScreen() {
  const { restoreScroll, openTree, returnSceneId } = useLocalSearchParams();
  const currentStory = useStoryStore((state) => state.getCurrentStory());
  const setStoryIcon = useStoryStore((state: any) => state.setStoryIcon);
  const deleteScene = useStoryStore((state) => state.deleteScene);
  const duplicateScene = useStoryStore((state) => state.duplicateScene);
  const setStartScene = useStoryStore((state) => state.setStartScene);
  const toggleSceneDone = useStoryStore((state) => state.toggleSceneDone);
  const scenes = currentStory?.scenes || [];
  const title = currentStory?.title || "Untitled story";
  const exportCurrentStory = useStoryStore((state) => state.exportCurrentStory);
  const exportCurrentStoryAsHtml = useStoryStore(
    (state) => state.exportCurrentStoryAsHtml,
  );
  const addStoryValue = useStoryStore((state) => state.addStoryValue);
  const renameStoryValue = useStoryStore((state) => state.renameStoryValue);
  const deleteStoryValue = useStoryStore((state) => state.deleteStoryValue);
  const storyValues = currentStory?.storyValues || [];
  const setBackgroundMusic = useStoryStore((state) => state.setBackgroundMusic);
  const removeBackgroundMusic = useStoryStore(
    (state) => state.removeBackgroundMusic,
  );
  const backgroundMusic = currentStory?.backgroundMusic as BackgroundMusic | undefined;
  const renameStory = useStoryStore((state) => state.renameStory);
  const [sceneMenuTarget, setSceneMenuTarget] = useState<{
    scene: any;
    index: number;
  } | null>(null);
  const [isChoosingStoryIcon, setIsChoosingStoryIcon] = useState(false);
  const [isExportPickerOpen, setIsExportPickerOpen] = useState(false);
  const [isMusicPickerOpen, setIsMusicPickerOpen] = useState(false);
  const portableExportWarnings = useRef<string[]>([]);
  const [previewTrackName, setPreviewTrackName] = useState<string | null>(null);
  const musicPreviewPlayer = useAudioPlayer(null);
  const musicPreviewStatus = useAudioPlayerStatus(musicPreviewPlayer);

  const toggleShowSceneTitlesInPlay = useStoryStore(
    (state) => state.toggleShowSceneTitlesInPlay,
  );
  const toggleAutoplayBackgroundMusic = useStoryStore(
    (state) => state.toggleAutoplayBackgroundMusic,
  );
  const autoplayBackgroundMusic = currentStory?.autoplayBackgroundMusic ?? false;
  const setPlayAppearance = useStoryStore((state) => state.setPlayAppearance);
  const playAppearance = getStoryPlayAppearance(currentStory);
  const previewFont = getPlayFont(playAppearance.font);
  const previewTextSize = getPlayTextSize(playAppearance.textSize);
  const previewTheme = getPlayTheme(playAppearance.theme);
  const previewFontStyle = previewFont.nativeFamily
    ? { fontFamily: previewFont.nativeFamily }
    : undefined;

  const saveOrShareExport = async (
    content: string,
    fileName: string,
    mimeType: string,
    dialogTitle: string,
  ) => {
    if (downloadTextFileOnWeb(content, fileName, mimeType)) {
      return;
    }

    const exportDirectory =
      FileSystem.cacheDirectory || FileSystem.documentDirectory;
    if (!exportDirectory) {
      throw new Error("No writable export folder is available on this device.");
    }

    const fileUri = exportDirectory + fileName;
    await FileSystem.writeAsStringAsync(fileUri, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert("Export saved", `File saved to: ${fileUri}`);
      return;
    }

    await Sharing.shareAsync(fileUri, { mimeType, dialogTitle });
  };

  const shareJson = async () => {
    try {
      const json = exportCurrentStory();
      if (!json) throw new Error("No current story is open.");

      const parsed = JSON.parse(json);
      if (!parsed || !Array.isArray(parsed.scenes)) {
        throw new Error("The story backup is incomplete.");
      }

      const fileName = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "story"}.json`;
      await saveOrShareExport(
        json,
        fileName,
        "application/json",
        "Share story backup",
      );
    } catch (error) {
      console.error("JSON share error:", error);
      Alert.alert(
        "JSON export failed",
        error instanceof Error
          ? error.message
          : "Could not create or share the JSON file.",
      );
    }
  };

  const shareHtml = async () => {
    try {
      const html = await buildPortableHtml();
      if (!html) throw new Error("No current story is open.");
      if (!html.includes("<!DOCTYPE html>") || !html.includes("renderScene()")) {
        throw new Error("The playable HTML could not be completed.");
      }

      const fileName = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "story"}.html`;
      await saveOrShareExport(
        html,
        fileName,
        "text/html",
        "Share playable story",
      );

      if (portableExportWarnings.current.length > 0) {
        const skippedCount = portableExportWarnings.current.length;
        Alert.alert(
          "Story exported",
          `The playable story was exported, but ${skippedCount} unavailable media ${skippedCount === 1 ? "item was" : "items were"} left out. The scenes, text, and choices are still included.`,
        );
      }
    } catch (error) {
      console.error("HTML share error:", error);
      Alert.alert(
        "HTML export failed",
        error instanceof Error
          ? error.message
          : "Could not create or share the HTML file.",
      );
    }
  };

  const openShareOptions = () => {
    if (Platform.OS === "web") {
      setIsExportPickerOpen(true);
      return;
    }

    Alert.alert("Share story", "Choose how you want to share this story.", [
      {
        text: "Playable HTML",
        onPress: shareHtml,
      },
      {
        text: "Backup JSON",
        onPress: shareJson,
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  };

  const showSceneTitlesInPlay = currentStory?.showSceneTitlesInPlay ?? true;

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftStoryTitle, setDraftStoryTitle] = useState(title);

  useEffect(() => {
    setDraftStoryTitle(title);
  }, [title]);

  const saveStoryTitle = () => {
    if (!currentStory) return;

    const trimmedTitle = draftStoryTitle.trim();

    if (!trimmedTitle) {
      Alert.alert(
        "Story needs a name",
        "Please add a story name before saving.",
      );
      return;
    }

    renameStory(currentStory.id, trimmedTitle);
    setIsEditingTitle(false);
  };

  const [expandedSceneId, setExpandedSceneId] = useState<string | null>(null);
  const [expandedDetailsSceneId, setExpandedDetailsSceneId] = useState<
    string | null
  >(null);
  const [isStatusExpanded, setIsStatusExpanded] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const currentScrollY = useRef(0);
  const pendingRestoreY = useRef<number | null>(null);
  const navigationPending = useRef(false);
  const storyTreeHorizontalRef = useRef<ScrollView | null>(null);
  const storyTreeVerticalRef = useRef<ScrollView | null>(null);
  const fullScreenTreeHorizontalRef = useRef<ScrollView | null>(null);
  const fullScreenTreeVerticalRef = useRef<ScrollView | null>(null);
  const storyTreeImageRef = useRef<View | null>(null);
  const [inlineTreeViewport, setInlineTreeViewport] = useState({
    width: 0,
    height: 0,
  });
  const [fullScreenTreeViewport, setFullScreenTreeViewport] = useState({
    width: 0,
    height: 0,
  });
  const [storyTreeCardY, setStoryTreeCardY] = useState(0);
  const [disconnectedSectionY, setDisconnectedSectionY] = useState(0);
  const storyTreeScale = useSharedValue(1);
  const [storyTreeZoomPercent, setStoryTreeZoomPercent] = useState(100);

  const [newValueName, setNewValueName] = useState("");
  const [newValueInitial, setNewValueInitial] = useState("0");

  const [isValuesExpanded, setIsValuesExpanded] = useState(false);
  const [isTracesExpanded, setIsTracesExpanded] = useState(false);
  const [isStoryTreeExpanded, setIsStoryTreeExpanded] = useState(false);
  const [isPlaySettingsExpanded, setIsPlaySettingsExpanded] = useState(false);
  const [isStoryTreeFullScreenOpen, setIsStoryTreeFullScreenOpen] = useState(false);
  const [playSettingsCardY, setPlaySettingsCardY] = useState(0);

  const storyScrollKey = currentStory?.id
    ? `story:${currentStory.id}`
    : undefined;

  useEffect(() => {
    if (!storyScrollKey) return;

    if (restoreScroll === "true") {
      pendingRestoreY.current = getScrollPosition(storyScrollKey);
    } else if (openTree !== "true") {
      clearScrollPosition(storyScrollKey);
      pendingRestoreY.current = 0;
    }
  }, [openTree, restoreScroll, storyScrollKey]);

  useEffect(() => {
    if (openTree === "true") setIsStoryTreeFullScreenOpen(true);
  }, [openTree]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        router.dismissTo("/");
        return true;
      },
    );
    return () => backHandler.remove();
  }, []);

  const restorePendingScroll = () => {
    if (pendingRestoreY.current === null) return;
    const y = pendingRestoreY.current;
    pendingRestoreY.current = null;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y, animated: false });
    });
  };

  const navigateOnce = (navigate: () => void) => {
    if (navigationPending.current) return;
    navigationPending.current = true;
    navigate();
    setTimeout(() => {
      navigationPending.current = false;
    }, 500);
  };

  const closeFullScreenStoryTree = () => {
    setIsStoryTreeFullScreenOpen(false);
    if (typeof returnSceneId === "string") {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace({
          pathname: "/scene-editor",
          params: { sceneId: returnSceneId, restoreScroll: "true" },
        });
      }
    }
  };

  const showBackgroundMusicInfo = () => {
    Alert.alert(
      "Background music",
      "Background music is one audio file that can play during the whole story in play mode. You can use it for music, atmosphere, or ambience.",
    );
  };

  const showStoryValueInfo = () => {
    Alert.alert(
      "Story value 🫐",
      "A story value keeps track of something that can increase or decrease, like coins, berries, trust, energy, hope, or suspicion.",
    );
  };



  const missingTargetCount = scenes.reduce((total, scene) => {
    return (
      total + scene.choices.filter((choice) => !choice.targetSceneId).length
    );
  }, 0);




  const getSceneMissingTargetCount = (scene: any) =>
    scene.choices.filter((choice: any) => !choice.targetSceneId).length;

  const getSceneImageCount = (scene: any) =>
    scene.assets?.filter(
      (asset: any) => asset.type === "image" && asset.alt !== "Drawing",
    ).length || 0;

  const getSceneDrawingCount = (scene: any) =>
    scene.assets?.filter(
      (asset: any) => asset.type === "image" && asset.alt === "Drawing",
    ).length || 0;


  const sceneHasAudio = (scene: any) =>
    scene.assets?.some((asset: any) => asset.type === "audio") || false;

  const getMimeTypeFromUri = (uri: string, type: "image" | "audio") => {
    const lower = uri.toLowerCase();

    if (type === "image") {
      if (lower.endsWith(".png")) return "image/png";
      if (lower.endsWith(".gif")) return "image/gif";
      if (lower.endsWith(".webp")) return "image/webp";
      return "image/jpeg";
    }

    if (lower.endsWith(".mp3")) return "audio/mpeg";
    if (lower.endsWith(".wav")) return "audio/wav";
    if (lower.endsWith(".aac")) return "audio/aac";
    if (lower.endsWith(".m4a")) return "audio/mp4";

    return "audio/mp4";
  };


  const embedBackgroundMusic = async (music: any) => {
    if (!music) return music;

    if (music.uri?.startsWith("data:")) return music;

    try {
      if (music.type === "built-in" && music.builtInId) {
        const builtInTrack = getBuiltInBackgroundMusic(music.builtInId);

        if (!builtInTrack) {
          portableExportWarnings.current.push("Background music");
          return undefined;
        }

        const asset = Asset.fromModule(builtInTrack.asset);
        await asset.downloadAsync();

        const localUri = asset.localUri || asset.uri;
        const base64 = await FileSystem.readAsStringAsync(localUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        return {
          ...music,
          name: builtInTrack.title,
          uri: `data:audio/mpeg;base64,${base64}`,
        };
      }

      if (music.uri) {
        const base64 = await FileSystem.readAsStringAsync(music.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        return {
          ...music,
          uri: `data:${getMimeTypeFromUri(music.uri, "audio")};base64,${base64}`,
        };
      }
    } catch (error) {
      console.error("Could not embed background music:", error);
      portableExportWarnings.current.push("Background music");
      return undefined;
    }

    return music;
  };

  const buildPortableHtml = async () => {
    if (!currentStory) return null;

    portableExportWarnings.current = [];

    const scenesWithEmbeddedAssets = await Promise.all(
      currentStory.scenes.map(async (scene) => {
        const embeddedAssets = await Promise.all(
          (scene.assets || []).map(async (asset) => {
            if (!asset.uri) return asset;

            if (asset.uri.startsWith("data:")) return asset;

            if (asset.type !== "image" && asset.type !== "audio") return asset;

            try {
              const base64 = await FileSystem.readAsStringAsync(asset.uri, {
                encoding: FileSystem.EncodingType.Base64,
              });

              const mimeType = getMimeTypeFromUri(asset.uri, asset.type);

              return {
                ...asset,
                uri: `data:${mimeType};base64,${base64}`,
              };
            } catch (error) {
              console.error("Could not embed asset:", asset.uri, error);
              portableExportWarnings.current.push(
                `Media in ${scene.title || "Untitled scene"}`,
              );
              return null;
            }
          }),
        );

        const availableAssets = embeddedAssets.filter(
          (asset): asset is NonNullable<typeof asset> => asset !== null,
        );
        const embeddedSceneBackgroundMusic = scene.playSettingsOverride
          ? await embedBackgroundMusic(
              scene.playSettingsOverride.backgroundMusic,
            )
          : undefined;

        return {
          ...scene,
          assets: availableAssets,
          playSettingsOverride: scene.playSettingsOverride
            ? {
                ...scene.playSettingsOverride,
                backgroundMusic: embeddedSceneBackgroundMusic ?? null,
              }
            : undefined,
        };
      }),
    );

    const embeddedBackgroundMusic = await embedBackgroundMusic(
      currentStory.backgroundMusic,
    );

    const portableStory = {
      ...currentStory,
      editorHints: undefined,
      scenes: scenesWithEmbeddedAssets,
      backgroundMusic: embeddedBackgroundMusic,
    };

    const storyJson = JSON.stringify(portableStory).replace(/</g, "\\u003c");

    const appearance = getStoryPlayAppearance(portableStory);
    const appearanceFont = getPlayFont(appearance.font);
    const appearanceSize = getPlayTextSize(appearance.textSize);
    const appearanceTheme = getPlayTheme(appearance.theme);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${portableStory.title}</title>
  <style>
    body {
      font-family: ${appearanceFont.cssFamily};
      background: ${appearanceTheme.sceneBackground};
      color: ${appearanceTheme.primaryText};
      margin: 0;
      padding: 0;
    }

    .container {
      max-width: 720px;
      margin: 40px auto;
      padding: 0 20px;
    }

    .card {
      background: ${appearanceTheme.surface};
      border: 1px solid ${appearanceTheme.border};
      border-radius: 16px;
      padding: 28px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    }

    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      gap: 12px;
    }

    .topbar-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .story-title {
      font-size: 0.9rem;
      color: ${appearanceTheme.secondaryText};
    }

    h1 {
      color: ${appearanceTheme.primaryText};
      font-size: 1.8rem;
      margin-bottom: 16px;
      margin-top: 0;
    }

    .scene-heading-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.scene-heading-row h1 {
  flex: 1;
  margin-bottom: 0;
}

.audio-button {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  padding: 0;
  text-align: center;
  background: ${appearanceTheme.softSurface};
  color: ${appearanceTheme.accent};
  border: 1px solid ${appearanceTheme.border};
}

.audio-button:hover {
  filter: brightness(0.92);
  transform: none;
}

.audio-button.playing {
  background: ${appearanceTheme.choiceBackground};
  color: ${appearanceTheme.choiceText};
}

    .scene-images {
      position: relative;
      width: 100%;
      aspect-ratio: 400 / 260;
      overflow: hidden;
      border-radius: 10px;
      margin-bottom: 20px;
      background: ${appearanceTheme.softSurface};
    }

    .scene-image {
      display: block;
      position: absolute;
      border-radius: 8px;
    }

    .scene-text {
      color: ${appearanceTheme.primaryText};
      font-size: ${appearanceSize.cssRem}rem;
      line-height: 1.7;
      margin-bottom: 24px;
      white-space: pre-wrap;
    }

    .dialogue {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 24px;
    }

    .dialogue-bubble {
      border: 1px solid ${appearanceTheme.border};
      border-radius: 14px;
      padding: 12px 14px;
      background: ${appearanceTheme.softSurface};
    }

    .dialogue-speaker {
      color: ${appearanceTheme.accent};
      font-weight: 800;
      margin-bottom: 4px;
    }

    .dialogue-line {
      color: ${appearanceTheme.primaryText};
      font-size: ${appearanceSize.cssRem}rem;
      line-height: 1.6;
      white-space: pre-wrap;
    }

    .choices {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    button {
      border: none;
      border-radius: 10px;
      padding: 14px 16px;
      font-family: ${appearanceFont.cssFamily};
      font-size: ${appearanceSize.cssRem}rem;
      background: ${appearanceTheme.choiceBackground};
      color: ${appearanceTheme.choiceText};
      cursor: pointer;
      transition: all 0.15s ease;
      text-align: left;
    }

    button:hover {
      filter: brightness(0.92);
      transform: translateY(-1px);
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.58;
      transform: none;
    }

    .restart {
      background: ${appearanceTheme.softSurface};
      color: ${appearanceTheme.primaryText};
      border: 1px solid ${appearanceTheme.border};
    }

    .restart:hover {
      filter: brightness(0.92);
    }

    .empty {
      color: ${appearanceTheme.secondaryText};
      margin-top: 16px;
      font-style: italic;
    }
            .choice-feedback {
            display: none;
            margin: 0 0 14px;
            padding: 11px 14px;
            border: 1px solid ${appearanceTheme.border};
            border-radius: 14px;
            background: ${appearanceTheme.softSurface};
            color: ${appearanceTheme.primaryText};
            font-size: ${appearanceSize.cssRem}rem;
            font-weight: 700;
            line-height: 1.45;
            white-space: pre-line;
          }

</style>
<style id="scene-appearance-style"></style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="topbar">
        <div class="story-title">${portableStory.title} · ${portableStory.mode}</div>
        <div class="topbar-actions">
          <button id="background-button" class="restart" onclick="toggleBackgroundMusic()" style="display:none;">🎵 Music</button>
          <button class="restart" onclick="restartStory()">Restart</button>
        </div>
      </div>

<div class="scene-heading-row">
  <h1 id="scene-title"></h1>
  <button id="audio-button" class="audio-button" onclick="toggleAudio()" style="display:none;">🎧</button>
</div>

<div id="scene-images" class="scene-images" style="display:none;"></div>
<audio id="scene-audio"></audio>
<audio id="background-audio" loop></audio>
<div id="scene-text" class="scene-text"></div>
<div id="scene-dialogue" class="dialogue"></div>
<div id="choices" class="choices"></div>
<div id="choice-feedback" class="choice-feedback" role="status" aria-live="polite" aria-atomic="true"></div>
    <div id="empty" class="empty" style="display:none;"></div>
    </div>
  </div>

  <script>
    const story = ${storyJson};
const playFonts = ${JSON.stringify(
      Object.fromEntries(
        PLAY_FONT_OPTIONS.map((option) => [
          option.id,
          { cssFamily: option.cssFamily },
        ]),
      ),
    )};
const playTextSizes = ${JSON.stringify(
      Object.fromEntries(
        PLAY_TEXT_SIZE_OPTIONS.map((option) => [
          option.id,
          { cssRem: option.cssRem },
        ]),
      ),
    )};
const playThemes = ${JSON.stringify(
      Object.fromEntries(PLAY_THEMES.map((theme) => [theme.id, theme])),
    )};
const backgroundAudioEl = document.getElementById('background-audio');
const backgroundButtonEl = document.getElementById('background-button');
let backgroundMusicEnabled = Boolean(story.autoplayBackgroundMusic);

if (story.backgroundMusic?.uri) {
  backgroundAudioEl.src = story.backgroundMusic.uri;
  backgroundButtonEl.style.display = 'inline-block';
}

function updateBackgroundMusicButton() {
  backgroundButtonEl.textContent = backgroundAudioEl.paused
    ? (backgroundMusicEnabled ? '▶ Start music' : '🎵 Music')
    : '⏸ Music';
}

function tryStartBackgroundMusic() {
  if (!backgroundMusicEnabled || !backgroundAudioEl.getAttribute('src')) return;

  const playPromise = backgroundAudioEl.play();
  if (playPromise?.then) {
    playPromise
      .then(updateBackgroundMusicButton)
      .catch(updateBackgroundMusicButton);
  }
}

function toggleBackgroundMusic() {
  if (!backgroundAudioEl.getAttribute('src')) return;

  if (backgroundAudioEl.paused) {
    backgroundMusicEnabled = true;
    tryStartBackgroundMusic();
  } else {
    backgroundMusicEnabled = false;
    backgroundAudioEl.pause();
    updateBackgroundMusicButton();
  }
}

function applyScenePlaySettings(scene) {
  const override = scene?.playSettingsOverride;
  const appearance = override?.playAppearance || story.playAppearance || {};
  const font = playFonts[appearance.font] || playFonts.branchBeetle;
  const size = playTextSizes[appearance.textSize] || playTextSizes.standard;
  const theme = playThemes[appearance.theme] || playThemes.branchBeetle;
  const styleEl = document.getElementById('scene-appearance-style');

  styleEl.textContent =
    'body{font-family:' + font.cssFamily + ';background:' + theme.sceneBackground + ';color:' + theme.primaryText + ';}' +
    '.card{background:' + theme.surface + ';border-color:' + theme.border + ';}' +
    '.story-title,.empty{color:' + theme.secondaryText + ';}' +
    'h1,.scene-text,.dialogue-line{color:' + theme.primaryText + ';}' +
    '.scene-text,.dialogue-line{font-size:' + size.cssRem + 'rem;}' +
    '.dialogue-bubble,.choice-feedback,.scene-images,.scene-image{background:' + theme.softSurface + ';border-color:' + theme.border + ';}' +
    '.dialogue-speaker{color:' + theme.accent + ';}' +
    '.choices button{font-family:' + font.cssFamily + ';font-size:' + size.cssRem + 'rem;background:' + theme.choiceBackground + ';color:' + theme.choiceText + ';}' +
    '.restart,.audio-button{background:' + theme.softSurface + ';color:' + theme.primaryText + ';border-color:' + theme.border + ';}';

  const music = override ? override.backgroundMusic : story.backgroundMusic;
  const nextSource = music?.uri || '';
  const currentSource = backgroundAudioEl.getAttribute('src') || '';
  const wasPlaying = !backgroundAudioEl.paused;

  if (currentSource !== nextSource) {
    backgroundAudioEl.pause();
    if (nextSource) {
      backgroundAudioEl.src = nextSource;
      backgroundButtonEl.style.display = 'inline-block';
      if (wasPlaying || backgroundMusicEnabled) tryStartBackgroundMusic();
    } else {
      backgroundAudioEl.removeAttribute('src');
      backgroundButtonEl.style.display = 'none';
      backgroundButtonEl.textContent = 'ðŸŽµ Music';
    }
  }
}

function startMusicAfterFirstInteraction(event) {
  if (event.target === backgroundButtonEl) return;
  tryStartBackgroundMusic();
}

document.addEventListener('pointerdown', startMusicAfterFirstInteraction, { once: true });
document.addEventListener('keydown', startMusicAfterFirstInteraction, { once: true });

let currentSceneId = story.scenes[0]?.id;
let chosenChoiceIds = [];
let activeTraces = [];
let storyValues = createInitialStoryValues();
let choiceFeedbackTimer = null;

function findFeedbackStoryValueDefinition(value) {
  return (story.storyValues || []).find((storyValue) =>
    storyValue.id === value?.valueId || storyValue.name === value?.name
  );
}

function getChoiceValueChanges(choice) {
  const changes = Array.isArray(choice.valueChanges)
    ? choice.valueChanges
    : choice.valueChange
      ? [choice.valueChange]
      : [];

  const usedValueIds = new Set();
  return changes.filter((change) => {
    const valueKey = change?.valueId || change?.name;
    if (
      !valueKey ||
      !Number.isFinite(Number(change.amount)) ||
      usedValueIds.has(valueKey)
    ) {
      return false;
    }

    usedValueIds.add(valueKey);
    return true;
  });
}

function getValueFeedbackMessage(choice) {
  const customMessage = choice.valueFeedbackMessage?.trim();
  if (customMessage) return customMessage;

  return getChoiceValueChanges(choice).map((change) => {
    const definition = findFeedbackStoryValueDefinition(change);
    const name = definition?.name || change.name || 'A story value';
    const amount = Number(change.amount ?? definition?.step ?? 0);
    const signedAmount = amount > 0
      ? '+' + amount
      : amount < 0
        ? String.fromCharCode(8722) + Math.abs(amount)
        : '0';

    return name + ' ' + signedAmount;
  }).join(' ' + String.fromCharCode(183) + ' ');
}

function showChoiceFeedback(messages) {
  const feedbackEl = document.getElementById('choice-feedback');
  if (!feedbackEl) return;
  if (choiceFeedbackTimer) clearTimeout(choiceFeedbackTimer);

  const message = messages.filter(Boolean).join('\\n');
  feedbackEl.textContent = message;
  feedbackEl.style.display = message ? 'block' : 'none';

  if (message) {
    choiceFeedbackTimer = setTimeout(() => {
      feedbackEl.style.display = 'none';
      feedbackEl.textContent = '';
      choiceFeedbackTimer = null;
    }, 5500);
  }
}


function createInitialStoryValues() {
  const values = {};
  (story.storyValues || []).forEach((storyValue) => {
    values[storyValue.id] = storyValue.initialValue ?? 0;
  });
  return values;
}

function normalizeTrace(trace) {
  return String(trace || '').trim().toLowerCase().replace(/\\s+/g, '_');
}

function normalizeStoryValueName(name) {
  return String(name || '').trim().toLowerCase().replace(/\\s+/g, '_');
}

function findStoryValueDefinition(value) {
  return (story.storyValues || []).find(
    (storyValue) =>
      storyValue.id === value?.valueId || storyValue.name === value?.name
  );
}

function getStoryValueKey(value) {
  if (value?.valueId) {
    return value.valueId;
  }

  if (value?.name) {
    const matchingDefinition = findStoryValueDefinition(value);
    return matchingDefinition?.id || normalizeStoryValueName(value.name);
  }

  return undefined;
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function doesStoryValuePass(requiredValue) {
  const valueKey = getStoryValueKey(requiredValue);

  if (!valueKey) {
    return true;
  }

  const storyValueDefinition = findStoryValueDefinition(requiredValue);

  const currentValue =
    storyValues[valueKey] ?? storyValueDefinition?.initialValue ?? 0;

  const requiredAmount = Number(
    requiredValue.amount ?? storyValueDefinition?.initialValue ?? 0
  );

  if (requiredValue.operator === 'atMost') {
    return currentValue <= requiredAmount;
  }

  if (requiredValue.operator === 'equals') {
    return currentValue === requiredAmount;
  }

  return currentValue >= requiredAmount;
}

function getChoiceId(sceneId, choice, index) {
  return choice.id || sceneId + '-choice-' + index;
}

    function getSceneById(id) {
      return story.scenes.find(scene => scene.id === id);
    }

    function renderRichText(element, value, formatting) {
      element.textContent = '';
      const active = { bold: 0, italic: 0, underline: 0 };
      const tagPattern = /<\\/?(?:strong|b|em|i|u)>/gi;
      let cursor = 0;

      function appendText(text, forcedStyle) {
        if (!text) return;
        const style = forcedStyle || active;
        if (!style.bold && !style.italic && !style.underline) {
          element.appendChild(document.createTextNode(text));
          return;
        }

        const span = document.createElement('span');
        span.textContent = text;
        if (style.bold) span.style.fontWeight = '800';
        if (style.italic) span.style.fontStyle = 'italic';
        if (style.underline) span.style.textDecoration = 'underline';
        element.appendChild(span);
      }

      if (Array.isArray(formatting)) {
        const text = String(value || '');
        const valid = formatting.filter((format) =>
          Number.isFinite(format?.start) &&
          Number.isFinite(format?.end) &&
          format.start < format.end
        );
        const boundaries = Array.from(new Set([
          0,
          text.length,
          ...valid.flatMap((format) => [format.start, format.end]),
        ])).sort((left, right) => left - right);

        for (let index = 0; index < boundaries.length - 1; index += 1) {
          const start = boundaries[index];
          const end = boundaries[index + 1];
          const covering = valid.filter(
            (format) => format.start <= start && format.end >= end
          );
          appendText(text.slice(start, end), {
            bold: covering.some((format) => format.bold),
            italic: covering.some((format) => format.italic),
            underline: covering.some((format) => format.underline),
          });
        }
        return;
      }

      for (const match of String(value || '').matchAll(tagPattern)) {
        appendText(String(value || '').slice(cursor, match.index));
        const tag = match[0].toLowerCase();
        const closing = tag.startsWith('</');
        const name = tag.replace(/[<\\/>]/g, '');
        const key =
          name === 'strong' || name === 'b'
            ? 'bold'
            : name === 'em' || name === 'i'
              ? 'italic'
              : 'underline';
        active[key] = closing
          ? Math.max(0, active[key] - 1)
          : active[key] + 1;
        cursor = match.index + match[0].length;
      }

      appendText(String(value || '').slice(cursor));
    }

    function renderScene() {
      const scene = getSceneById(currentSceneId);
      const titleEl = document.getElementById('scene-title');
      const textEl = document.getElementById('scene-text');
      const dialogueEl = document.getElementById('scene-dialogue');
      const choicesEl = document.getElementById('choices');
      const emptyEl = document.getElementById('empty');
      const imagesEl = document.getElementById('scene-images');
      const audioEl = document.getElementById('scene-audio');
      const audioButtonEl = document.getElementById('audio-button');

      if (!scene) {
        titleEl.textContent = 'Missing scene';
        textEl.textContent = '';
        dialogueEl.innerHTML = '';
        choicesEl.innerHTML = '';
        emptyEl.style.display = 'block';
        emptyEl.textContent = 'This scene could not be found.';
        imagesEl.replaceChildren();
        imagesEl.style.display = 'none';

        audioEl.pause();
        audioEl.removeAttribute('src');
        audioButtonEl.style.display = 'none';
        audioButtonEl.classList.remove('playing');
        audioButtonEl.textContent = '🎧';

        return;
      }

      applyScenePlaySettings(scene);
      titleEl.textContent = scene.title || 'Untitled scene';
      renderRichText(textEl, scene.text, scene.textFormatting);
      dialogueEl.innerHTML = '';

      if (scene.sceneType === 'dialogue' && scene.dialogueTurns?.length) {
        scene.dialogueTurns.forEach((turn) => {
          const bubble = document.createElement('div');
          bubble.className = 'dialogue-bubble';

          if (turn.speaker?.trim()) {
            const speaker = document.createElement('div');
            speaker.className = 'dialogue-speaker';
            speaker.textContent = turn.speaker.trim();
            bubble.appendChild(speaker);
          }

          const line = document.createElement('div');
          line.className = 'dialogue-line';
          line.textContent = turn.text || '...';
          bubble.appendChild(line);
          dialogueEl.appendChild(bubble);
        });
      }

const imageAssets = (scene.assets || []).filter(
  (asset) => asset.type === 'image' && asset.uri
);
imagesEl.replaceChildren();
imageAssets.forEach((asset, index) => {
  const image = document.createElement('img');
  image.className = 'scene-image';
  image.src = asset.uri;
  image.alt = asset.alt || 'Scene image ' + (index + 1);
  image.loading = 'eager';
  image.style.left = (((Number(asset.x) || 0) + 20) / 400 * 100) + '%';
  image.style.top = (((Number(asset.y) || 0) + 20) / 260 * 100) + '%';
  image.style.width = ((Number(asset.width) || 220) / 400 * 100) + '%';
  image.style.height = ((Number(asset.height) || 160) / 260 * 100) + '%';
  image.style.objectFit = asset.alt === 'Drawing' ? 'contain' : 'cover';
  imagesEl.appendChild(image);
});
imagesEl.style.display = imageAssets.length > 0 ? 'block' : 'none';

const audioAsset = scene.assets
  ? scene.assets.find(asset => asset.type === 'audio')
  : null;

audioEl.pause();
audioButtonEl.classList.remove('playing');
audioButtonEl.textContent = '🎧';

if (audioAsset && audioAsset.uri) {
  audioEl.src = audioAsset.uri;
  audioButtonEl.style.display = 'block';
  if (story.autoplayVoiceNotes) {
    audioEl.play()
      .then(() => {
        audioButtonEl.classList.add('playing');
        audioButtonEl.textContent = '⏸';
      })
      .catch(() => {});
  }
} else {
  audioEl.removeAttribute('src');
  audioButtonEl.style.display = 'none';
}

      choicesEl.innerHTML = '';
      emptyEl.style.display = 'none';

const visibleChoices = (scene.choices || []).filter((choice) => {
  if (choice.requiredChoiceId) {
    const hasRememberedChoice = chosenChoiceIds.includes(choice.requiredChoiceId);
    const requiredChoiceState =
      choice.requiredChoiceState === 'notRemembered' ? 'notRemembered' : 'remembered';

    if (requiredChoiceState === 'notRemembered' ? hasRememberedChoice : !hasRememberedChoice) {
      return false;
    }
  }

  if (choice.requiredValue && !doesStoryValuePass(choice.requiredValue)) {
    return false;
  }

  const requiredTrace = choice.requiredTraceLabel?.trim();

  if (
    requiredTrace &&
    !activeTraces.includes(normalizeTrace(requiredTrace))
  ) {
    return false;
  }

  return true;
});

if (visibleChoices.length > 0) {
  visibleChoices.forEach((choice, index) => {
    const btn = document.createElement('button');
    const targetScene = choice.targetSceneId
      ? getSceneById(choice.targetSceneId)
      : undefined;
    const destinationStatus = !choice.targetSceneId
      ? ' (not connected)'
      : !targetScene
        ? ' (destination missing)'
        : '';
    btn.textContent = choice.label + destinationStatus;
    btn.disabled = !targetScene;

    btn.onclick = () => {
      const choiceId = getChoiceId(scene.id, choice, index);
      const feedbackMessages = [];

      if (choice.rememberChoice && choice.rememberFeedbackEnabled) {
        feedbackMessages.push(
          choice.rememberFeedbackMessage?.trim() || 'This choice will be remembered.'
        );
      }

      if (getChoiceValueChanges(choice).length > 0 && choice.valueFeedbackEnabled) {
        feedbackMessages.push(getValueFeedbackMessage(choice));
      }

      showChoiceFeedback(feedbackMessages);

      if (!chosenChoiceIds.includes(choiceId)) {
        chosenChoiceIds.push(choiceId);
      }

      if (choice.traceLabel?.trim()) {
        const trace = normalizeTrace(choice.traceLabel);
        if (!activeTraces.includes(trace)) {
          activeTraces.push(trace);
        }
      }

      getChoiceValueChanges(choice).forEach((change) => {
        const valueKey = getStoryValueKey(change);
        const storyValueDefinition = findStoryValueDefinition(change);
        const amount = Number(change.amount ?? storyValueDefinition?.step ?? 0);

        if (!valueKey || Number.isNaN(amount)) return;

        const currentValue =
          storyValues[valueKey] ?? storyValueDefinition?.initialValue ?? 0;
        const nextValue = currentValue + amount;

        storyValues[valueKey] = storyValueDefinition
          ? clampNumber(
              nextValue,
              storyValueDefinition.minValue,
              storyValueDefinition.maxValue
            )
          : nextValue;
      });

      if (targetScene) {
        const audioEl = document.getElementById('scene-audio');
        audioEl.pause();

        currentSceneId = targetScene.id;
        renderScene();
      }
    };

    choicesEl.appendChild(btn);
  });
} else {
  emptyEl.style.display = 'block';
  emptyEl.textContent = 'The story ends here.';
}
}

function toggleAudio() {
  const audioEl = document.getElementById('scene-audio');
  const audioButtonEl = document.getElementById('audio-button');

  if (!audioEl.src) return;

  if (audioEl.paused) {
    audioEl.play();
    audioButtonEl.classList.add('playing');
    audioButtonEl.textContent = '⏸';
  } else {
    audioEl.pause();
    audioButtonEl.classList.remove('playing');
    audioButtonEl.textContent = '🎧';
  }
}


    function restartStory() {
  currentSceneId = story.scenes[0]?.id;
  chosenChoiceIds = [];
  activeTraces = [];
  storyValues = createInitialStoryValues();
  showChoiceFeedback([]);
  renderScene();
}

    renderScene();
    tryStartBackgroundMusic();
  </script>
</body>
</html>`;
  };

  const parseNumberOrDefault = (value: string, fallback: number) => {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? fallback : parsed;
  };

  const handleAddStoryValue = () => {
    const name = newValueName.trim();

    if (!name) {
      Alert.alert(
        "Name needed",
        "Please name what can change, for example Curiosity.",
      );
      return;
    }

    const initialValue = parseNumberOrDefault(newValueInitial, 0);

    addStoryValue({
      name,
      initialValue,
      minValue: -999999,
      maxValue: 999999,
      step: 1,
    });

    setNewValueName("");
    setNewValueInitial("0");
  };

  const chooseBackgroundMusic = () => {
    setIsMusicPickerOpen(true);
  };

  const stopBackgroundMusicPreview = () => {
    try {
      musicPreviewPlayer.pause();
      (musicPreviewPlayer as any).seekTo?.(0);
    } catch (error) {
      console.warn("Could not stop music preview:", error);
    }
    setPreviewTrackName(null);
  };

  const previewBackgroundMusic = (source: any, name: string) => {
    try {
      musicPreviewPlayer.pause();
      musicPreviewPlayer.replace(source);
      musicPreviewPlayer.play();
      setPreviewTrackName(name);
    } catch (error) {
      console.warn("Could not preview background music:", error);
      Alert.alert(
        "Preview unavailable",
        "The track was selected, but this device could not start its preview.",
      );
    }
  };

  const closeMusicPicker = () => {
    stopBackgroundMusicPreview();
    setIsMusicPickerOpen(false);
  };

  const selectBuiltInBackgroundMusic = (track: (typeof BUILT_IN_BACKGROUND_MUSIC)[number]) => {
    setBackgroundMusic({
      type: "built-in",
      builtInId: track.id,
      name: track.title,
    } as any);
    previewBackgroundMusic(track.asset, track.title);
  };

  const uploadCustomBackgroundMusic = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const pickedFile = result.assets[0];

      const safeName =
        pickedFile.name?.replace(/[^a-z0-9._-]/gi, "_") ||
        `background-music-${Date.now()}.mp3`;

      const destinationUri =
        FileSystem.documentDirectory +
        `background-music-${Date.now()}-${safeName}`;

      await FileSystem.copyAsync({
        from: pickedFile.uri,
        to: destinationUri,
      });

      setBackgroundMusic({
        type: "uploaded",
        uri: destinationUri,
        name: pickedFile.name || "Background music",
      } as any);

      previewBackgroundMusic(destinationUri, pickedFile.name || "Background music");
    } catch (error) {
      console.error("Background music picker error:", error);
      Alert.alert(
        "Could not add music",
        "Please try choosing another audio file.",
      );
    }
  };

  const storyIcon = (currentStory as any)?.icon || "🪲";

  const chooseStoryIcon = (icon: string) => {
    if (!currentStory?.id || typeof setStoryIcon !== "function") {
      Alert.alert(
        "Could not change icon",
        "The story icon feature is not connected in the story store yet.",
      );
      setIsChoosingStoryIcon(false);
      return;
    }

    setStoryIcon(currentStory.id, icon);
    setIsChoosingStoryIcon(false);
  };

  const addScene = () => {
    navigateOnce(() => router.push({
      pathname: "/scene-editor",
      params: { storyTitle: title },
    }));
  };

  const openSceneEditor = (sceneId: string) => {
    navigateOnce(() => router.push({
      pathname: "/scene-editor",
      params: { sceneId },
    }));
  };

  const previewScene = (sceneId: string) => {
    navigateOnce(() => router.push({
      pathname: "/play",
      params: {
        startSceneId: sceneId,
        preview: "true",
      },
    }));
  };

  const playStory = () => {
    navigateOnce(() => router.push("/play"));
  };

  const openPlaySettings = () => {
    setIsPlaySettingsExpanded(true);
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, playSettingsCardY - 12),
        animated: true,
      });
    }, 80);
  };

  const setSceneAsStart = (sceneId: string) => {
    const sceneIndex = scenes.findIndex((scene) => scene.id === sceneId);

    if (sceneIndex <= 0) {
      Alert.alert(
        "Already the start scene",
        "This scene is already the first scene players will see.",
      );
      return;
    }

    setStartScene(sceneId);

    Alert.alert(
      "Start scene updated",
      `"${scenes[sceneIndex].title || "Untitled scene"}" is now the first scene players will see.`,
    );
  };

  const confirmDeleteScene = (scene: any) => {
    Alert.alert(
      "Delete scene?",
      `This will delete "${scene.title || "Untitled scene"}" and remove paths pointing to it.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteScene(scene.id),
        },
      ],
    );
  };

  const openSceneMenu = (scene: any, index: number) => {
    setSceneMenuTarget({ scene, index });
  };

  const closeSceneMenu = () => {
    setSceneMenuTarget(null);
  };

  const handleSetSceneAsStart = () => {
    if (!sceneMenuTarget) return;
    if (sceneMenuTarget.index !== 0) {
      setSceneAsStart(sceneMenuTarget.scene.id);
    }
    closeSceneMenu();
  };

  const handleToggleSceneDone = () => {
    if (!sceneMenuTarget) return;
    toggleSceneDone(sceneMenuTarget.scene.id);
    closeSceneMenu();
  };

  const handleDuplicateScene = () => {
    if (!sceneMenuTarget) return;
    const duplicatedSceneId = duplicateScene(sceneMenuTarget.scene.id);
    closeSceneMenu();

    if (!duplicatedSceneId) {
      Alert.alert("Could not duplicate scene", "Please try again.");
      return;
    }

    Alert.alert(
      "Scene duplicated",
      "Existing links and media were copied. Incoming links still point to the original scene.",
      [
        { text: "Later", style: "cancel" },
        {
          text: "Edit copy",
          onPress: () => openSceneEditor(duplicatedSceneId),
        },
      ],
    );
  };

  const handleDeleteSceneFromMenu = () => {
    if (!sceneMenuTarget) return;
    const sceneToDelete = sceneMenuTarget.scene;
    closeSceneMenu();
    confirmDeleteScene(sceneToDelete);
  };

  const getSceneStatus = (scene: any, index: number) => {
    if (index === 0) {
      return { icon: "", label: "Start" };
    }

    if (scene.choices.length === 0) {
      return { icon: "", label: "Ending" };
    }

    return { icon: "", label: "Branch" };
  };

  const getSceneMeta = (scene: any) => {
    const parts: string[] = [];

    if (scene.choices.length > 0) {
      parts.push(
        `${scene.choices.length} ${scene.choices.length === 1 ? "choice" : "choices"}`,
      );
    }

    const imageCount = getSceneImageCount(scene);
    const drawingCount = getSceneDrawingCount(scene);

    if (imageCount > 0) {
      parts.push(`🖼️ ${imageCount}`);
    }

    if (drawingCount > 0) {
      parts.push(`✏️ ${drawingCount}`);
    }

    if (sceneHasAudio(scene)) {
      parts.push("🎧 audio");
    }

    return parts.join(" · ");
  };

  const storyTreeSceneById = new Map(
    scenes.map((scene) => [scene.id, scene]),
  );

  const storyTreeIncomingCounts = scenes.reduce<Record<string, number>>(
    (counts, scene) => {
      scene.choices.forEach((choice) => {
        if (choice.targetSceneId && storyTreeSceneById.has(choice.targetSceneId)) {
          counts[choice.targetSceneId] = (counts[choice.targetSceneId] || 0) + 1;
        }
      });

      return counts;
    },
    {},
  );

  const storyTreeLevels: Record<string, number> = {};
  const storyTreeReachableIds = new Set<string>();
  const storyTreeQueue: any[] = [];

  if (scenes[0]) {
    storyTreeLevels[scenes[0].id] = 0;
    storyTreeReachableIds.add(scenes[0].id);
    storyTreeQueue.push(scenes[0]);
  }

  while (storyTreeQueue.length > 0) {
    const scene = storyTreeQueue.shift();
    const sourceLevel = storyTreeLevels[scene.id] || 0;

    scene.choices.forEach((choice: any) => {
      const targetScene = choice.targetSceneId
        ? storyTreeSceneById.get(choice.targetSceneId)
        : undefined;

      if (!targetScene) return;

      const nextLevel = sourceLevel + 1;
      const previousLevel = storyTreeLevels[targetScene.id];

      if (previousLevel === undefined || nextLevel < previousLevel) {
        storyTreeLevels[targetScene.id] = nextLevel;
      }

      if (!storyTreeReachableIds.has(targetScene.id)) {
        storyTreeReachableIds.add(targetScene.id);
        storyTreeQueue.push(targetScene);
      }
    });
  }

  const reachableMaxLevel = Math.max(
    0,
    ...Object.values(storyTreeLevels),
  );

  const disconnectedScenes = scenes.filter(
    (scene, index) => index > 0 && !storyTreeReachableIds.has(scene.id),
  );

  const disconnectedSceneCount = disconnectedScenes.length;
  const reachableScenes = scenes.filter(
    (scene, index) => index === 0 || storyTreeReachableIds.has(scene.id),
  );
  const reachableSceneIndexById = new Map(
    reachableScenes.map((scene, index) => [scene.id, index]),
  );
  const scenesByLevel = reachableScenes.reduce<Record<number, any[]>>(
    (groups, scene) => {
      const level = storyTreeLevels[scene.id] || 0;
      groups[level] = [...(groups[level] || []), scene];
      return groups;
    },
    {},
  );
  const widestLevelCount = Math.max(
    1,
    ...Object.values(scenesByLevel).map((levelScenes) => levelScenes.length),
  );
  const verticalCenterX =
    STORY_TREE_PADDING +
    Math.floor(widestLevelCount / 2) * STORY_TREE_SIBLING_OFFSET;

  const getVerticalPosition = (scene: any) => {
    const level = storyTreeLevels[scene.id] || 0;
    const levelScenes = scenesByLevel[level] || [];
    const siblingIndex = Math.max(
      0,
      levelScenes.findIndex((levelScene) => levelScene.id === scene.id),
    );
    const centerOffset = (siblingIndex - (levelScenes.length - 1) / 2) * STORY_TREE_SIBLING_OFFSET;

    return {
      x: Math.max(STORY_TREE_PADDING, verticalCenterX + centerOffset),
      y: STORY_TREE_PADDING + level * (STORY_TREE_NODE_HEIGHT + STORY_TREE_ROW_GAP),
    };
  };

  const getHorizontalPosition = (scene: any) => {
    const level = storyTreeLevels[scene.id] || 0;
    const index = reachableSceneIndexById.get(scene.id) || 0;

    return {
      x: STORY_TREE_PADDING + level * (STORY_TREE_NODE_WIDTH + STORY_TREE_COLUMN_GAP),
      y: STORY_TREE_PADDING + index * (STORY_TREE_NODE_HEIGHT + STORY_TREE_ROW_GAP),
    };
  };

  const storyTreeNodes = reachableScenes.map((scene) => {
    const originalIndex = scenes.findIndex((storyScene) => storyScene.id === scene.id);
    const level = storyTreeLevels[scene.id] || 0;
    const position =
      STORY_TREE_LAYOUT_DIRECTION === 'vertical'
        ? getVerticalPosition(scene)
        : getHorizontalPosition(scene);
    const missingTargetChoices = scene.choices.filter(
      (choice: any) => !choice.targetSceneId || !storyTreeSceneById.has(choice.targetSceneId),
    );

    return {
      scene,
      index: originalIndex,
      ...position,
      level,
      isStart: originalIndex === 0,
      isReachable: true,
      incomingCount: storyTreeIncomingCounts[scene.id] || 0,
      missingTargetCount: missingTargetChoices.length,
      isEnding: scene.choices.length === 0,
    };
  });

  const disconnectedStoryTreeNodes = disconnectedScenes.map((scene, index) => {
    const originalIndex = scenes.findIndex((storyScene) => storyScene.id === scene.id);
    const missingTargetChoices = scene.choices.filter(
      (choice: any) => !choice.targetSceneId || !storyTreeSceneById.has(choice.targetSceneId),
    );

    return {
      scene,
      index: originalIndex,
      x: STORY_TREE_PADDING + (index % 2) * (STORY_TREE_NODE_WIDTH + 12),
      y: STORY_TREE_PADDING + Math.floor(index / 2) * (STORY_TREE_NODE_HEIGHT + 12),
      level: reachableMaxLevel + 1,
      isStart: false,
      isReachable: false,
      incomingCount: storyTreeIncomingCounts[scene.id] || 0,
      missingTargetCount: missingTargetChoices.length,
      isEnding: scene.choices.length === 0,
    };
  });

  const storyTreeNodeById = new Map(
    storyTreeNodes.map((node) => [node.scene.id, node]),
  );

  const storyTreeConnections = reachableScenes.flatMap((scene) => {
    const sourceNode = storyTreeNodeById.get(scene.id);
    if (!sourceNode) return [];

    return scene.choices
      .map((choice: any, choiceIndex: number) => {
        const targetNode = choice.targetSceneId
          ? storyTreeNodeById.get(choice.targetSceneId)
          : undefined;

        if (!targetNode) return null;

        const connectionKey = `${scene.id}-${choice.id || choiceIndex}-${choice.targetSceneId}`;
        const colorIndex =
          (stableStoryTreeHash(scene.id) + choiceIndex) %
          STORY_TREE_BRANCH_COLORS.length;

        return {
          key: connectionKey,
          label: choice.label || "Choice",
          choiceIndex,
          color: STORY_TREE_BRANCH_COLORS[colorIndex],
          routeOffset: ((stableStoryTreeHash(connectionKey) % 5) - 2) * 3,
          sourceNode,
          targetNode,
          isConverging: (storyTreeIncomingCounts[choice.targetSceneId] || 0) > 1,
          isBackLink: targetNode.level <= sourceNode.level,
        };
      })
      .filter(Boolean);
  });

  const maxMainTreeX = Math.max(
    STORY_TREE_PADDING,
    ...storyTreeNodes.map((node) => node.x),
  );
  const maxMainTreeY = Math.max(
    STORY_TREE_PADDING,
    ...storyTreeNodes.map((node) => node.y),
  );
  const storyTreeWidth = Math.max(
    320,
    maxMainTreeX + STORY_TREE_NODE_WIDTH + STORY_TREE_PADDING,
  );
  const storyTreeHeight = Math.max(
    220,
    maxMainTreeY + STORY_TREE_NODE_HEIGHT + STORY_TREE_PADDING,
  );
  const storyTreeEndingCount = storyTreeNodes.filter((node) => node.isEnding).length;


  const storyTreeZoomWrapperStyle = useAnimatedStyle(() => ({
    width: storyTreeWidth * storyTreeScale.value,
    height: storyTreeHeight * storyTreeScale.value,
  }));

  const storyTreeZoomedCanvasStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: (storyTreeWidth * (storyTreeScale.value - 1)) / 2 },
      { translateY: (storyTreeHeight * (storyTreeScale.value - 1)) / 2 },
      { scale: storyTreeScale.value },
    ],
  }));

  const setStoryTreeZoom = (nextScale: number) => {
    const clampedScale = Math.min(
      STORY_TREE_MAX_ZOOM,
      Math.max(STORY_TREE_MIN_ZOOM, nextScale),
    );

    storyTreeScale.value = clampedScale;
    setStoryTreeZoomPercent(Math.round(clampedScale * 100));
  };

  const zoomStoryTreeOut = () => {
    setStoryTreeZoom(storyTreeZoomPercent / 100 - STORY_TREE_ZOOM_STEP);
  };

  const zoomStoryTreeIn = () => {
    setStoryTreeZoom(storyTreeZoomPercent / 100 + STORY_TREE_ZOOM_STEP);
  };

  const disconnectedTreeWidth = Math.max(
    320,
    STORY_TREE_PADDING * 2 + STORY_TREE_NODE_WIDTH * 2 + 12,
  );
  const disconnectedTreeHeight = Math.max(
    STORY_TREE_NODE_HEIGHT + STORY_TREE_PADDING * 2,
    STORY_TREE_PADDING * 2 +
      Math.ceil(disconnectedStoryTreeNodes.length / 2) * STORY_TREE_NODE_HEIGHT +
      Math.max(0, Math.ceil(disconnectedStoryTreeNodes.length / 2) - 1) * 12,
  );
  const fullScreenDisconnectedTop = storyTreeHeight + 52;
  const fullScreenDisconnectedNodes = disconnectedStoryTreeNodes.map((node) => ({
    ...node,
    y: node.y + fullScreenDisconnectedTop,
  }));
  const fullScreenStoryTreeNodes = [
    ...storyTreeNodes,
    ...fullScreenDisconnectedNodes,
  ];
  const fullScreenStoryTreeWidth = Math.max(
    storyTreeWidth,
    disconnectedStoryTreeNodes.length > 0 ? disconnectedTreeWidth : 0,
  );
  const fullScreenLegendHeight = 54;
  const fullScreenStoryTreeHeight =
    (disconnectedStoryTreeNodes.length > 0
      ? fullScreenDisconnectedTop + disconnectedTreeHeight
      : storyTreeHeight) + fullScreenLegendHeight;

  const fullScreenTreeZoomWrapperStyle = useAnimatedStyle(() => ({
    width: fullScreenStoryTreeWidth * storyTreeScale.value,
    height: fullScreenStoryTreeHeight * storyTreeScale.value,
  }));

  const fullScreenTreeZoomedCanvasStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          (fullScreenStoryTreeWidth * (storyTreeScale.value - 1)) / 2,
      },
      {
        translateY:
          (fullScreenStoryTreeHeight * (storyTreeScale.value - 1)) / 2,
      },
      { scale: storyTreeScale.value },
    ],
  }));

  const scrollStoryTreeToNode = (node: any) => {
    const isFullScreen = isStoryTreeFullScreenOpen;
    if (!isFullScreen && !isStoryTreeExpanded) {
      setIsStoryTreeExpanded(true);
    }

    const fullScreenNode = isFullScreen
      ? fullScreenStoryTreeNodes.find(
          (candidate) => candidate.scene.id === node.scene.id,
        ) || node
      : node;
    const scale = storyTreeScale.value;

    requestAnimationFrame(() => {
      const horizontalRef = isFullScreen
        ? fullScreenTreeHorizontalRef
        : storyTreeHorizontalRef;
      const verticalRef = isFullScreen
        ? fullScreenTreeVerticalRef
        : storyTreeVerticalRef;

      horizontalRef.current?.scrollTo({
        x: Math.max(0, fullScreenNode.x * scale - STORY_TREE_PADDING),
        animated: true,
      });
      verticalRef.current?.scrollTo({
        y: Math.max(0, fullScreenNode.y * scale - STORY_TREE_PADDING),
        animated: true,
      });
    });
  };

  const scrollStoryTreeToStart = () => {
    const startNode = storyTreeNodes.find((node) => node.isStart);
    if (startNode) scrollStoryTreeToNode(startNode);
  };

  const scrollStoryTreeToEnding = () => {
    const endingNode = storyTreeNodes.find((node) => node.isEnding);
    if (endingNode) scrollStoryTreeToNode(endingNode);
  };

  const fitStoryTreeToScreen = () => {
    const isFullScreen = isStoryTreeFullScreenOpen;
    if (!isFullScreen && !isStoryTreeExpanded) {
      setIsStoryTreeExpanded(true);
    }

    const viewport = isFullScreen
      ? fullScreenTreeViewport
      : inlineTreeViewport;
    const contentWidth = isFullScreen
      ? fullScreenStoryTreeWidth + STORY_TREE_EXPORT_PADDING * 2
      : storyTreeWidth;
    const contentHeight = isFullScreen
      ? fullScreenStoryTreeHeight + STORY_TREE_EXPORT_PADDING * 2
      : storyTreeHeight;
    const availableWidth = Math.max(1, viewport.width - 16);
    const availableHeight = Math.max(1, viewport.height - 16);
    const fittedScale =
      viewport.width > 0 && viewport.height > 0
        ? Math.min(1, availableWidth / contentWidth, availableHeight / contentHeight)
        : 1;
    const clampedScale = Math.max(STORY_TREE_MIN_ZOOM, fittedScale);

    setStoryTreeZoom(clampedScale);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const horizontalRef = isFullScreen
          ? fullScreenTreeHorizontalRef
          : storyTreeHorizontalRef;
        const verticalRef = isFullScreen
          ? fullScreenTreeVerticalRef
          : storyTreeVerticalRef;
        const scaledWidth = contentWidth * clampedScale;
        const scaledHeight = contentHeight * clampedScale;

        horizontalRef.current?.scrollTo({
          x: Math.max(0, (scaledWidth - viewport.width) / 2),
          animated: true,
        });
        verticalRef.current?.scrollTo({
          y: Math.max(0, (scaledHeight - viewport.height) / 2),
          animated: true,
        });
      });
    });
  };
  const shareStoryTreeAsPng = async () => {
    if (!storyTreeImageRef.current) {
      Alert.alert("Story Tree", "Open the full-screen tree before sharing it.");
      return;
    }

    const previousScale = storyTreeScale.value;

    try {
      setStoryTreeZoom(1);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      const uri = await captureRef(storyTreeImageRef.current, {
        format: "png",
        quality: 1,
        result: "tmpfile",
        width: Math.ceil(
          fullScreenStoryTreeWidth + STORY_TREE_EXPORT_PADDING * 2,
        ),
        height: Math.ceil(
          fullScreenStoryTreeHeight + STORY_TREE_EXPORT_PADDING * 2,
        ),
      });

      setStoryTreeZoom(previousScale);

      const canShare = await Sharing.isAvailableAsync();

      if (!canShare) {
        Alert.alert("Story Tree saved", `PNG created at: ${uri}`);
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: "Share Story Tree",
      });
    } catch (error) {
      setStoryTreeZoom(previousScale);
      console.error("Story Tree PNG export error:", error);
      Alert.alert(
        "Could not share tree",
        "Please try again from the full-screen tree view.",
      );
    }
  };

  const scrollStoryTreeToMissingLink = () => {
    const missingNode = storyTreeNodes.find((node) => node.missingTargetCount > 0);
    if (missingNode) scrollStoryTreeToNode(missingNode);
  };

  const scrollStoryTreeToDisconnected = () => {
    if (isStoryTreeFullScreenOpen) {
      const firstDisconnectedNode = fullScreenDisconnectedNodes[0];
      if (firstDisconnectedNode) scrollStoryTreeToNode(firstDisconnectedNode);
      return;
    }

    if (!isStoryTreeExpanded) {
      setIsStoryTreeExpanded(true);
    }

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, storyTreeCardY + disconnectedSectionY - 12),
        animated: true,
      });
    });
  };

  const storyTraceSummaries = scenes.flatMap((scene) =>
    scene.choices
      .filter((choice: any) => choice.rememberChoice || choice.traceLabel?.trim())
      .map((choice: any) => {
        const requirementCount = scenes.reduce((total, requirementScene) => {
          return (
            total +
            requirementScene.choices.filter((requirementChoice: any) => {
              if (choice.id && requirementChoice.requiredChoiceId === choice.id) {
                return true;
              }

              const traceLabel = choice.traceLabel?.trim().toLowerCase();
              const requiredTraceLabel = requirementChoice.requiredTraceLabel
                ?.trim()
                .toLowerCase();

              return !!traceLabel && traceLabel === requiredTraceLabel;
            }).length
          );
        }, 0);

        return {
          id: choice.id || `${scene.id}-${choice.label}`,
          sceneTitle: scene.title || "Untitled scene",
          choiceLabel: choice.label || "Untitled choice",
          requirementCount,
        };
      }),
  );

  const storyTraceStatus =
    storyTraceSummaries.length > 0
      ? `${storyTraceSummaries.length} remembered ${
          storyTraceSummaries.length === 1 ? "choice" : "choices"
        }`
      : "Optional";

  const storyValuesStatus =
    storyValues.length > 0
      ? `${storyValues.length} ${storyValues.length === 1 ? "value" : "values"}`
      : "Optional";

  const musicStatus = getBackgroundMusicDisplayName(backgroundMusic);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        scrollEventThrottle={50}
        onScroll={(event) => {
          const y = event.nativeEvent.contentOffset.y;
          currentScrollY.current = y;
          if (storyScrollKey) rememberScrollPosition(storyScrollKey, y);
        }}
        onContentSizeChange={restorePendingScroll}
      >
        <Pressable style={styles.homePill} onPress={() => router.dismissTo("/")}>
          <Text style={styles.homePillText}>← Home</Text>
        </Pressable>

        {isEditingTitle ? (
          <View style={styles.storyTitleEditCard}>
            <TextInput
              style={styles.storyTitleInput}
              value={draftStoryTitle}
              onChangeText={setDraftStoryTitle}
              placeholder="Story title"
              autoCapitalize="sentences"
              returnKeyType="done"
              onSubmitEditing={saveStoryTitle}
            />

            <View style={styles.storyTitleEditRow}>
              <Pressable
                style={styles.storyTitleSaveButton}
                onPress={saveStoryTitle}
              >
                <Text style={styles.storyTitleSaveText}>Save name</Text>
              </Pressable>

              <Pressable
                style={styles.storyTitleCancelButton}
                onPress={() => {
                  setDraftStoryTitle(title);
                  setIsEditingTitle(false);
                }}
              >
                <Text style={styles.storyTitleCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.storyHeroCard}>
            <View style={styles.storyHeroTopRow}>
              <Pressable
                style={styles.storyIconTile}
                onLongPress={() => setIsChoosingStoryIcon(true)}
                delayLongPress={350}
                accessibilityLabel="Hold to change story icon"
              >
                <Text style={styles.storyIconText}>{storyIcon}</Text>
              </Pressable>

              <View style={styles.storyHeroTextArea}>
                <View style={styles.storyTitleRow}>
                  <Text style={styles.heroTitle} numberOfLines={2}>
                    {title || "Untitled story"}
                  </Text>
                  <Pressable
                    style={styles.renameStoryIconButton}
                    onPress={() => setIsEditingTitle(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Rename story"
                  >
                    <Text style={styles.renameStoryIconText}>✎</Text>
                  </Pressable>
                </View>
                <Text style={styles.heroSubtitle}>
                  Build and edit your branching story.
                </Text>
              </View>
            </View>

            <View style={styles.heroPrimaryRow}>
              <Pressable
                style={styles.heroPlayButton}
                onPress={playStory}
              >
                <Text style={styles.heroPlayButtonText}>▶ Play</Text>
              </Pressable>

              <Pressable style={styles.heroAddButton} onPress={addScene}>
                <Text style={styles.heroAddButtonText}>+ Add scene</Text>
              </Pressable>
            </View>

            <View style={styles.heroSecondaryRow}>
              <Pressable
                style={styles.heroSecondaryButton}
                onPress={openPlaySettings}
              >
                <Text style={styles.heroSecondaryButtonText}>Play Settings</Text>
              </Pressable>

              <Pressable
                style={styles.heroSecondaryButton}
                onPress={openShareOptions}
              >
                <Text style={styles.heroSecondaryButtonText}>⇧ Export</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View
          style={styles.storyTreeCard}
          onLayout={(event) => setStoryTreeCardY(event.nativeEvent.layout.y)}
        >
          <View style={styles.storyTreeHeaderRow}>
            <View style={styles.storyTreeHeaderText}>
              <Text style={styles.sectionTitle}>Story Tree 🌳</Text>
              <Text style={styles.sectionHelperText}>
                {isStoryTreeExpanded
                  ? "Tap a node to edit its scene."
                  : "Show the branch map for this story."}
              </Text>
            </View>
            <StoryVisibilityToggle
              visible={isStoryTreeExpanded}
              onPress={() => setIsStoryTreeExpanded(!isStoryTreeExpanded)}
              accessibilityLabel={isStoryTreeExpanded ? "Hide Story Tree" : "Show Story Tree"}
            />
          </View>

          {isStoryTreeExpanded && (
            <>
              <View style={styles.storyTreeSummaryRow}>
                <Pressable
                  style={styles.storyTreeSummaryButton}
                  onPress={() => setIsStoryTreeFullScreenOpen(true)}
                >
                  <Text style={styles.storyTreeSummaryButtonText}>Full screen</Text>
                </Pressable>
                <Pressable
                  style={styles.storyTreeSummaryButton}
                  onPress={fitStoryTreeToScreen}
                  accessibilityRole="button"
                  accessibilityLabel="Fit whole tree"
                  accessibilityHint="Zoom out so all scenes are visible."
                >
                  <Text style={styles.storyTreeSummaryButtonText}>Fit whole tree</Text>
                </Pressable>
                {missingTargetCount > 0 && (
                  <Pressable
                    style={[styles.storyTreeSummaryButton, styles.storyTreeWarningButton]}
                    onPress={scrollStoryTreeToMissingLink}
                  >
                    <Text style={styles.storyTreeSummaryButtonText}>Missing links: {missingTargetCount}</Text>
                  </Pressable>
                )}
                {disconnectedSceneCount > 0 && (
                  <Pressable
                    style={[styles.storyTreeSummaryButton, styles.storyTreeWarningButton]}
                    onPress={scrollStoryTreeToDisconnected}
                  >
                    <Text style={styles.storyTreeSummaryButtonText}>Disconnected: {disconnectedSceneCount}</Text>
                  </Pressable>
                )}
              </View>
              {scenes.length === 0 ? (
                <View style={styles.storyTreeEmptyBox}>
                  <Text style={styles.emptyStateTitle}>No tree yet</Text>
                  <Text style={styles.emptyStateText}>
                    Add a scene and the map will grow from your story.
                  </Text>
                </View>
              ) : (
                <ScrollView
                  ref={storyTreeHorizontalRef}
                  horizontal
                  showsHorizontalScrollIndicator
                  onLayout={(event) =>
                    setInlineTreeViewport({
                      width: event.nativeEvent.layout.width,
                      height: event.nativeEvent.layout.height,
                    })
                  }
                >
                  <ScrollView
                    ref={storyTreeVerticalRef}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                    style={styles.storyTreeScrollWindow}
                  >
                    <Animated.View style={storyTreeZoomWrapperStyle}>
                        <Animated.View
                          style={[
                            styles.storyTreeCanvas,
                            {
                              width: storyTreeWidth,
                              height: storyTreeHeight,
                            },
                            storyTreeZoomedCanvasStyle,
                          ]}
                        >
                      {storyTreeConnections.map((connection: any) => {
                        const color = connection.isBackLink ? "#9A6A13" : connection.color;

                        if (STORY_TREE_LAYOUT_DIRECTION === 'vertical') {
                          const sourceX = connection.sourceNode.x + STORY_TREE_NODE_WIDTH / 2 + connection.routeOffset;
                          const targetX = connection.targetNode.x + STORY_TREE_NODE_WIDTH / 2 + connection.routeOffset;
                          const sourceY = connection.sourceNode.y + STORY_TREE_NODE_HEIGHT;
                          const targetY = connection.targetNode.y;
                          const midY = Math.max(
                            sourceY + 10,
                            Math.min(sourceY + 18 + (connection.choiceIndex % 4) * 5, targetY - 10),
                          );

                          return (
                            <View key={connection.key} pointerEvents="none">
                              <View
                                style={[
                                  styles.storyTreeVerticalLine,
                                  {
                                    left: sourceX,
                                    top: Math.min(sourceY, midY),
                                    height: Math.max(2, Math.abs(midY - sourceY)),
                                    borderColor: color,
                                  },
                                ]}
                              />
                              <View
                                style={[
                                  styles.storyTreeLine,
                                  {
                                    left: Math.min(sourceX, targetX),
                                    top: midY,
                                    width: Math.max(2, Math.abs(targetX - sourceX)),
                                    borderColor: color,
                                  },
                                ]}
                              />
                              <View
                                style={[
                                  styles.storyTreeVerticalLine,
                                  {
                                    left: targetX,
                                    top: Math.min(midY, targetY),
                                    height: Math.max(2, Math.abs(targetY - midY)),
                                    borderColor: color,
                                  },
                                ]}
                              />
                              <View
                                style={[
                                  styles.storyTreeDownArrow,
                                  {
                                    left: targetX - 4,
                                    top: targetY - 6,
                                    borderTopColor: color,
                                  },
                                ]}
                              />
                            </View>
                          );
                        }

                        const sourceX = connection.sourceNode.x + STORY_TREE_NODE_WIDTH;
                        const targetX = connection.targetNode.x;
                        const sourceY = connection.sourceNode.y + STORY_TREE_NODE_HEIGHT / 2;
                        const targetY = connection.targetNode.y + STORY_TREE_NODE_HEIGHT / 2;
                        const midX = Math.max(sourceX + 14, Math.min(sourceX + 34, targetX - 14));
                        const minY = Math.min(sourceY, targetY);

                        return (
                          <View key={connection.key} pointerEvents="none">
                            <View
                              style={[
                                styles.storyTreeLine,
                                {
                                  left: Math.min(sourceX, midX),
                                  top: sourceY,
                                  width: Math.max(2, Math.abs(midX - sourceX)),
                                  borderColor: color,
                                },
                              ]}
                            />
                            <View
                              style={[
                                styles.storyTreeVerticalLine,
                                {
                                  left: midX,
                                  top: minY,
                                  height: Math.max(2, Math.abs(targetY - sourceY)),
                                  borderColor: color,
                                },
                              ]}
                            />
                            <View
                              style={[
                                styles.storyTreeLine,
                                {
                                  left: Math.min(midX, targetX),
                                  top: targetY,
                                  width: Math.max(2, Math.abs(targetX - midX)),
                                  borderColor: color,
                                },
                              ]}
                            />
                          </View>
                        );
                      })}

                      {storyTreeNodes.map((node) => (
                        <Pressable
                          key={node.scene.id}
                          style={[
                            styles.storyTreeNode,
                            {
                              left: node.x,
                              top: node.y,
                              width: STORY_TREE_NODE_WIDTH,
                              height: STORY_TREE_NODE_HEIGHT,
                            },
                            node.isStart && styles.storyTreeStartNode,
                            !node.isReachable && styles.storyTreeDisconnectedNode,
                            node.missingTargetCount > 0 && styles.storyTreeMissingNode,
                          ]}
                          onPress={() => openSceneEditor(node.scene.id)}
                        >
                          <View style={styles.storyTreeNodeTopRow}>
                            <Text style={styles.storyTreeNodeIcon}>{"\uD83C\uDF3F"}</Text>
                            <Text
                              style={styles.storyTreeNodeTitle}
                              numberOfLines={2}
                              ellipsizeMode="tail"
                            >
                              {node.scene.title || "Untitled scene"}
                            </Text>
                          </View>

                          <View style={styles.storyTreeBadgeRow}>
                            {node.isStart && <Text style={styles.storyTreeBadge}>Start</Text>}
                            {node.isEnding && <Text style={styles.storyTreeBadge}>End</Text>}
                            {node.incomingCount > 1 && <Text style={styles.storyTreeBadge}>Merge</Text>}
                            {!node.isReachable && (
                              <Text style={styles.storyTreeWarningBadge}>Disconnected</Text>
                            )}
                            {node.missingTargetCount > 0 && (
                              <Text style={styles.storyTreeWarningBadge}>Missing</Text>
                            )}
                          </View>
                        </Pressable>
                      ))}
                        </Animated.View>
                    </Animated.View>
                  </ScrollView>
                </ScrollView>
              )}

              {disconnectedStoryTreeNodes.length > 0 && (
                <View
                  style={styles.storyTreeDisconnectedSection}
                  onLayout={(event) => setDisconnectedSectionY(event.nativeEvent.layout.y)}
                >
                  <Text style={styles.storyTreeDisconnectedTitle}>
                    🍃 Disconnected scenes
                  </Text>
                  <Text style={styles.storyTreeDisconnectedText}>
                    These scenes are not reached from the opening scene yet.
                  </Text>

                  <ScrollView horizontal showsHorizontalScrollIndicator>
                    <View
                      style={[
                        styles.storyTreeCanvas,
                        {
                          width: disconnectedTreeWidth,
                          height: disconnectedTreeHeight,
                        },
                      ]}
                    >
                      {disconnectedStoryTreeNodes.map((node) => (
                        <Pressable
                          key={node.scene.id}
                          style={[
                            styles.storyTreeNode,
                            styles.storyTreeDisconnectedNode,
                            {
                              left: node.x,
                              top: node.y,
                              width: STORY_TREE_NODE_WIDTH,
                              height: STORY_TREE_NODE_HEIGHT,
                            },
                            node.missingTargetCount > 0 && styles.storyTreeMissingNode,
                          ]}
                          onPress={() => openSceneEditor(node.scene.id)}
                        >
                          <View style={styles.storyTreeNodeTopRow}>
                            <Text style={styles.storyTreeNodeIcon}>{"\uD83C\uDF3F"}</Text>
                            <Text
                              style={styles.storyTreeNodeTitle}
                              numberOfLines={2}
                              ellipsizeMode="tail"
                            >
                              {node.scene.title || "Untitled scene"}
                            </Text>
                          </View>

                          <View style={styles.storyTreeBadgeRow}>
                            <Text style={styles.storyTreeWarningBadge}>Disconnected</Text>
                            {node.isEnding && <Text style={styles.storyTreeBadge}>End</Text>}
                            {node.missingTargetCount > 0 && (
                              <Text style={styles.storyTreeWarningBadge}>Missing</Text>
                            )}
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}
            </>
          )}
        </View>
        <View style={styles.storyToolsCard}>
          <View style={styles.sectionHeaderRowCompact}>
            <View>
              <Text style={styles.sectionTitle}>Story Memory</Text>
              <Text style={styles.sectionHelperText}>
                See what the story remembers and which values can change.
              </Text>
            </View>
          </View>

          <View style={styles.toolGrid}>
            <View style={styles.memoryToolTile}>
              <View style={styles.memoryToolHeaderRow}>
                <View style={styles.toolIconCircle}>
                  <Text style={styles.toolIconText}>📌</Text>
                </View>

                <View style={styles.flexTextArea}>
                  <View style={styles.toolTitleRow}>
                    <Text style={styles.toolTitle}>Remembered Choices</Text>
                    <Pressable
                      style={styles.infoButton}
                      accessibilityRole="button"
                      accessibilityLabel="About Remembered Choices"
                      onPress={() =>
                        Alert.alert(
                          "Remembered choices",
                          "They let later choices appear only after the player has done something earlier.",
                        )
                      }
                    >
                      <Text style={styles.infoButtonText}>i</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.toolStatus}>{storyTraceStatus}</Text>
                </View>
              </View>

              <View style={styles.memoryToolActionRow}>
                <StoryVisibilityToggle
                  visible={isTracesExpanded}
                  onPress={() => setIsTracesExpanded(!isTracesExpanded)}
                  accessibilityLabel={isTracesExpanded ? "Hide Remembered Choices" : "Show Remembered Choices"}
                />
              </View>
            </View>

            {isTracesExpanded && (
              <View style={styles.traceOverviewBox}>
              {storyTraceSummaries.length > 0 ? (
                storyTraceSummaries.map((trace) => (
                  <View key={trace.id} style={styles.traceSummaryRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.traceSummaryTitle} numberOfLines={1}>
                        {trace.choiceLabel}
                      </Text>
                      <Text style={styles.traceSummaryMeta} numberOfLines={1}>
                        From {trace.sceneTitle}{" - "}Used by {trace.requirementCount}{" "}
                        {trace.requirementCount === 1 ? "choice" : "choices"}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.traceEmptyText}>
                  No remembered choices yet.
                </Text>
              )}
              </View>
            )}

            <View style={styles.memoryToolTile}>
              <View style={styles.memoryToolHeaderRow}>
                <View style={styles.toolIconCircle}>
                  <Text style={styles.toolIconText}>{"\uD83E\uDED0"}</Text>
                </View>

                <View style={styles.flexTextArea}>
                  <View style={styles.toolTitleRow}>
                    <Text style={styles.toolTitle}>Story Values</Text>
                    <Pressable
                      style={styles.infoButton}
                      accessibilityRole="button"
                      accessibilityLabel="About Story Values"
                      onPress={showStoryValueInfo}
                    >
                      <Text style={styles.infoButtonText}>i</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.toolStatus}>{storyValuesStatus}</Text>
                </View>
              </View>

              <View style={styles.memoryToolActionRow}>
                <StoryVisibilityToggle
                  visible={isValuesExpanded}
                  onPress={() => setIsValuesExpanded(!isValuesExpanded)}
                  accessibilityLabel={isValuesExpanded ? "Hide Story Values" : "Show Story Values"}
                />
              </View>
            </View>
          </View>

          {isValuesExpanded && (
            <View style={styles.valuesExpandedCard}>
              <Text style={styles.valuesDescription}>
                Story values are berries or other things the player can
                collect more or less of.
              </Text>

              {storyValues.length > 0 ? (
                storyValues.map((value) => (
                  <View key={value.id} style={styles.valueDefinitionCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.valueSmallLabel}>Value name</Text>
                      <TextInput
                        style={styles.valueDefinitionNameInput}
                        value={value.name}
                        onChangeText={(nextName) => {
                          if (nextName.trim()) renameStoryValue(value.id, nextName);
                        }}
                        accessibilityLabel={`Rename ${value.name}`}
                      />
                      <Text style={styles.valueDefinitionMeta}>
                        Starting value: {value.initialValue}
                      </Text>
                    </View>

                    <Pressable
                      style={styles.valueDeleteButton}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${value.name}`}
                      onPress={() => {
                        Alert.alert(
                          "Delete this?",
                          `Delete ${value.name}? This will also remove choice rules that use it.`,
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Delete",
                              style: "destructive",
                              onPress: () => deleteStoryValue(value.id),
                            },
                          ],
                        );
                      }}
                    >
                      <Text style={styles.valueDeleteText}>x</Text>
                    </Pressable>
                  </View>
                ))
              ) : (
                <Text style={styles.valuesEmptyText}>
                  No story values yet. You can skip this for simple stories.
                </Text>
              )}

              <View style={styles.addValueBox}>
                <Text style={styles.addValueTitle}>Add story value {"\uD83E\uDED0"}</Text>

                <TextInput
                  style={styles.valueTextInput}
                  value={newValueName}
                  onChangeText={setNewValueName}
                  placeholder="Berries"
                  autoCapitalize="words"
                />

                <View style={styles.valueNumberGrid}>
                  <View style={styles.valueNumberField}>
                    <Text style={styles.valueSmallLabel}>Starting value</Text>
                    <TextInput
                      style={styles.valueNumberInput}
                      value={newValueInitial}
                      onChangeText={setNewValueInitial}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                </View>

                <Pressable
                  style={[
                    styles.addValueButton,
                    !newValueName.trim() && styles.addValueButtonDisabled,
                  ]}
                  onPress={handleAddStoryValue}
                >
                  <Text style={styles.addValueButtonText}>Add story value</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
        <View
          style={styles.storyToolsCard}
          onLayout={(event) => setPlaySettingsCardY(event.nativeEvent.layout.y)}
        >
          <View style={styles.sectionHeaderRowCompact}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Play Settings</Text>
              <Text style={styles.sectionHelperText}>
                Adjust how the story looks and feels while playing.
              </Text>
            </View>
            <StoryVisibilityToggle
              visible={isPlaySettingsExpanded}
              onPress={() => setIsPlaySettingsExpanded(!isPlaySettingsExpanded)}
              accessibilityLabel={isPlaySettingsExpanded ? "Hide Play Settings" : "Show Play Settings"}
            />
          </View>

          {isPlaySettingsExpanded && (
          <View style={styles.toolGrid}>
            <View style={styles.toolTile}>
              <View style={styles.toolIconCircle}>
                <Text style={styles.toolIconText}>{"\uD83C\uDFB5"}</Text>
              </View>

              <View style={styles.flexTextArea}>
                <View style={styles.toolTitleRow}>
                  <Text style={styles.toolTitle}>Music</Text>
                  <Pressable
                    style={styles.infoButton}
                    onPress={showBackgroundMusicInfo}
                  >
                    <Text style={styles.infoButtonText}>i</Text>
                  </Pressable>
                </View>
                <Text style={styles.toolStatus} numberOfLines={1}>
                  {musicStatus}
                </Text>
              </View>

              <View style={styles.toolButtonRow}>
                <Pressable
                  style={styles.toolButton}
                  onPress={chooseBackgroundMusic}
                >
                  <Text style={styles.toolButtonText}>
                    {backgroundMusic ? "Change" : "Add"}
                  </Text>
                </Pressable>

                {backgroundMusic && (
                  <Pressable
                    style={styles.toolGhostButton}
                    onPress={removeBackgroundMusic}
                  >
                    <Text style={styles.toolGhostButtonText}>Remove</Text>
                  </Pressable>
                )}
              </View>
            </View>

            <View style={styles.toolTile}>
              <View style={styles.toolIconCircle}>
                <Text style={styles.toolIconText}>{"\uD83C\uDFB6"}</Text>
              </View>

              <View style={styles.flexTextArea}>
                <Text style={styles.toolTitle}>Autoplay music</Text>
                <Text style={styles.toolStatus}>
                  {autoplayBackgroundMusic ? "Starts in play" : "Off by default"}
                </Text>
              </View>

              <Pressable
                style={styles.toolButton}
                onPress={toggleAutoplayBackgroundMusic}
              >
                <Text style={styles.toolButtonText}>
                  {autoplayBackgroundMusic ? "On" : "Off"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.toolTile}>
              <View style={styles.toolIconCircle}>
                <Text style={styles.toolIconText}>{"\uD83D\uDC41"}</Text>
              </View>

              <View style={styles.flexTextArea}>
                <Text style={styles.toolTitle}>Scene titles</Text>
                <Text style={styles.toolStatus}>
                  {showSceneTitlesInPlay ? "Visible in play" : "Hidden in play"}
                </Text>
              </View>

              <StoryVisibilityToggle
                visible={showSceneTitlesInPlay}
                onPress={toggleShowSceneTitlesInPlay}
                accessibilityLabel={showSceneTitlesInPlay ? "Hide scene titles in Play" : "Show scene titles in Play"}
              />
            </View>

            <View style={styles.playAppearanceCard}>
              <Text style={styles.playAppearanceTitle}>Play Appearance</Text>
              <Text style={styles.playAppearanceHelper}>
                Choose how this story looks while someone is playing it.
              </Text>

              <Text style={styles.appearanceOptionLabel}>Play font</Text>
              <View style={styles.appearanceOptionRow}>
                {PLAY_FONT_OPTIONS.map((option) => {
                  const selected = playAppearance.font === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      style={[
                        styles.appearanceOptionButton,
                        selected && styles.appearanceOptionButtonSelected,
                      ]}
                      onPress={() => setPlayAppearance({ font: option.id })}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text
                        style={[
                          styles.appearanceOptionText,
                          option.nativeFamily ? { fontFamily: option.nativeFamily } : undefined,
                          selected && styles.appearanceOptionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.appearanceOptionLabel}>Text size</Text>
              <View style={styles.appearanceSegmentRow}>
                {PLAY_TEXT_SIZE_OPTIONS.map((option) => {
                  const selected = playAppearance.textSize === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      style={[
                        styles.appearanceSegmentButton,
                        selected && styles.appearanceOptionButtonSelected,
                      ]}
                      onPress={() => setPlayAppearance({ textSize: option.id })}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text
                        style={[
                          styles.appearanceOptionText,
                          selected && styles.appearanceOptionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.appearanceOptionLabel}>Colour theme</Text>
              <View style={styles.themeOptionRow}>
                {PLAY_THEMES.map((theme) => {
                  const selected = playAppearance.theme === theme.id;
                  return (
                    <Pressable
                      key={theme.id}
                      style={[
                        styles.themeOptionButton,
                        selected && styles.appearanceOptionButtonSelected,
                      ]}
                      onPress={() => setPlayAppearance({ theme: theme.id })}
                      accessibilityRole="button"
                      accessibilityLabel={theme.label + " colour theme"}
                      accessibilityState={{ selected }}
                    >
                      <View
                        style={[
                          styles.themeSwatch,
                          {
                            backgroundColor: theme.sceneBackground,
                            borderColor: theme.border,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.themeSwatchAccent,
                            { backgroundColor: theme.choiceBackground },
                          ]}
                        />
                      </View>
                      <Text
                        style={[
                          styles.themeOptionText,
                          selected && styles.appearanceOptionTextSelected,
                        ]}
                      >
                        {theme.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View
                style={[
                  styles.appearancePreview,
                  {
                    backgroundColor: previewTheme.sceneBackground,
                    borderColor: previewTheme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.appearancePreviewLabel,
                    previewFontStyle,
                    { color: previewTheme.secondaryText },
                  ]}
                >
                  Preview
                </Text>
                <Text
                  style={[
                    styles.appearancePreviewText,
                    previewFontStyle,
                    {
                      color: previewTheme.primaryText,
                      fontSize: previewTextSize.body,
                      lineHeight: previewTextSize.bodyLineHeight,
                    },
                  ]}
                >
                  A small path curls beneath the leaves.
                </Text>
                <View
                  style={[
                    styles.appearancePreviewChoice,
                    { backgroundColor: previewTheme.choiceBackground },
                  ]}
                >
                  <Text
                    style={[
                      styles.appearancePreviewChoiceText,
                      previewFontStyle,
                      {
                        color: previewTheme.choiceText,
                        fontSize: previewTextSize.choice,
                      },
                    ]}
                  >
                    Follow the path
                  </Text>
                </View>
              </View>
            </View>
          </View>
          )}
        </View>

        <View style={styles.sectionHeaderRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.storyScenesTitleRow}>
              <Text style={styles.bigSectionTitle}>Story scenes</Text>
              <Pressable
                style={styles.storyScenesAddButton}
                onPress={addScene}
                accessibilityLabel="Add scene"
              >
                <Text style={styles.storyScenesAddButtonText}>+</Text>
              </Pressable>
            </View>
            <Text style={styles.sectionHelperText}>Tap a scene to edit it.</Text>
          </View>

          <Text style={styles.sectionCount}>{scenes.length} total</Text>
        </View>

        <View style={styles.scenesFrame}>
          {scenes.length === 0 && (
            <View style={styles.emptyStateCard}>
              <Text style={styles.emptyStateTitle}>No scenes yet</Text>
              <Text style={styles.emptyStateText}>
                Add your first scene to begin shaping this story.
              </Text>

              <Pressable style={styles.emptyStateButton} onPress={addScene}>
                <Text style={styles.emptyStateButtonText}>
                  + Add first scene
                </Text>
              </Pressable>
            </View>
          )}

          {scenes.map((scene, index) => {
            const missingCount = getSceneMissingTargetCount(scene);
            const sceneStatus = getSceneStatus(scene, index);
            const sceneMeta = getSceneMeta(scene);
            const isDisconnectedScene =
              index > 0 && !storyTreeReachableIds.has(scene.id);

            return (
              <View
                key={scene.id}
                style={[styles.sceneCard, scene.isDone && styles.sceneCardDone]}
              >
                <Pressable
                  style={styles.scenePressArea}
                  onPress={() => openSceneEditor(scene.id)}
                >
                  <View style={styles.sceneTopRow}>
                    <View style={styles.sceneTitleAndMeta}>
                      <Text style={styles.sceneTitle} numberOfLines={1}>
                        {scene.title || "Untitled scene"}
                      </Text>

                      <View style={styles.sceneMetaRow}>
                        <Text
                          style={[
                            styles.sceneStatusBadge,
                            sceneStatus.label === "Ending" &&
                              styles.sceneEndingBadge,
                          ]}
                        >
                          {sceneStatus.label}
                        </Text>

                        {scene.isDone && (
                          <Text style={styles.sceneDoneBadge}>✓ Done</Text>
                        )}

                        {isDisconnectedScene && (
                          <Text style={styles.sceneDisconnectedBadge}>
                            Disconnected
                          </Text>
                        )}

                        {!!sceneMeta && (
                          <Text style={styles.sceneMetaText} numberOfLines={1}>
                            {sceneMeta}
                          </Text>
                        )}
                      </View>

                      {missingCount > 0 && (
                        <Text style={styles.warningChipText}>
                          ⚠️ {missingCount}{" "}
                          {missingCount === 1 ? "path needs" : "paths need"} a
                          scene
                        </Text>
                      )}
                    </View>

                    <Pressable
                      style={styles.sceneMoreButton}
                      onPress={(event: any) => {
                        event?.stopPropagation?.();
                        openSceneMenu(scene, index);
                      }}
                    >
                      <Text style={styles.sceneMoreButtonText}>⋯</Text>
                    </Pressable>
                  </View>
                </Pressable>

                <View style={styles.sceneActionRowClean}>
                  {scene.choices.length > 0 && (
                    <Pressable
                      style={styles.sceneSoftButton}
                      onPress={() => {
                        setExpandedSceneId(
                          expandedSceneId === scene.id ? null : scene.id,
                        );
                      }}
                    >
                      <Text style={styles.sceneSoftButtonText}>
                        {index === 0
                          ? expandedSceneId === scene.id
                            ? "Hide paths"
                            : "🧭 Paths"
                          : expandedSceneId === scene.id
                            ? "✕"
                            : "🧭"}
                      </Text>
                    </Pressable>
                  )}

                  <Pressable
                    style={styles.previewSceneButton}
                    onPress={() => previewScene(scene.id)}
                  >
                    <Text style={styles.previewSceneButtonText}>
                      {index === 0 ? "▶ Preview" : "▶"}
                    </Text>
                  </Pressable>
                </View>

                {scene.choices.length > 0 && expandedSceneId === scene.id && (
                  <View style={styles.choiceOverviewBox}>
                    <Text style={styles.choiceOverviewTitle}>
                      Choice → Scene
                    </Text>

                    {scene.choices.map((choice, choiceIndex) => {
                      const targetScene = choice.targetSceneId
                        ? scenes.find(
                            (target) => target.id === choice.targetSceneId,
                          )
                        : undefined;

                      return (
                        <Text
                          key={choice.id || choiceIndex}
                          style={styles.choiceOverviewText}
                        >
                          {choice.label || "(empty choice)"} →{" "}
                          {targetScene?.title || "No scene selected"}
                        </Text>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <Pressable
          style={styles.backToTopButton}
          onPress={() => {
            scrollRef.current?.scrollTo({ y: 0, animated: true });
          }}
        >
          <Text style={styles.backToTopButtonText}>↑ Back to top</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={isStoryTreeFullScreenOpen}
        animationType="slide"
        onRequestClose={closeFullScreenStoryTree}
      >
        <View style={styles.storyTreeFullScreenContainer}>
          <View style={styles.storyTreeFullScreenHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.storyTreeFullScreenTitle}>Story Tree 🌳</Text>
              <Text style={styles.storyTreeFullScreenSubtitle}>
                Pan and zoom to inspect the branch map.
              </Text>
            </View>
            <Pressable
              style={styles.storyTreeFullScreenCloseButton}
              onPress={closeFullScreenStoryTree}
            >
              <Text style={styles.storyTreeFullScreenCloseText}>Close</Text>
            </Pressable>
          </View>

          <View style={styles.storyTreeFullScreenControls}>
            <Pressable
              style={styles.storyTreeSummaryButton}
              onPress={fitStoryTreeToScreen}
              accessibilityRole="button"
              accessibilityLabel="Fit whole tree"
              accessibilityHint="Zoom out so all scenes are visible."
            >
              <Text style={styles.storyTreeSummaryButtonText}>Fit whole tree</Text>
            </Pressable>
            <View style={styles.storyTreeZoomControl}>
              <Pressable
                style={styles.storyTreeZoomButton}
                onPress={zoomStoryTreeOut}
                accessibilityLabel="Zoom story tree out"
              >
                <Text style={styles.storyTreeZoomButtonText}>-</Text>
              </Pressable>
              <Text style={styles.storyTreeZoomText}>{storyTreeZoomPercent}%</Text>
              <Pressable
                style={styles.storyTreeZoomButton}
                onPress={zoomStoryTreeIn}
                accessibilityLabel="Zoom story tree in"
              >
                <Text style={styles.storyTreeZoomButtonText}>+</Text>
              </Pressable>
            </View>
            <Pressable
              style={styles.storyTreeSummaryButton}
              onPress={shareStoryTreeAsPng}
            >
              <Text style={styles.storyTreeSummaryButtonText}>Share PNG</Text>
            </Pressable>
            <Pressable
              style={styles.storyTreeSummaryButton}
              onPress={scrollStoryTreeToStart}
            >
              <Text style={styles.storyTreeSummaryButtonText}>Start: {scenes.length > 0 ? 1 : 0}</Text>
            </Pressable>
            <Pressable
              style={styles.storyTreeSummaryButton}
              onPress={scrollStoryTreeToEnding}
            >
              <Text style={styles.storyTreeSummaryButtonText}>Endings: {storyTreeEndingCount}</Text>
            </Pressable>
            {missingTargetCount > 0 && (
              <Pressable
                style={[styles.storyTreeSummaryButton, styles.storyTreeWarningButton]}
                onPress={scrollStoryTreeToMissingLink}
              >
                <Text style={styles.storyTreeSummaryButtonText}>Missing links: {missingTargetCount}</Text>
              </Pressable>
            )}
            {disconnectedSceneCount > 0 && (
              <Pressable
                style={[styles.storyTreeSummaryButton, styles.storyTreeWarningButton]}
                onPress={scrollStoryTreeToDisconnected}
              >
                <Text style={styles.storyTreeSummaryButtonText}>Disconnected: {disconnectedSceneCount}</Text>
              </Pressable>
            )}
          </View>

          {scenes.length === 0 ? (
            <View style={styles.storyTreeEmptyBox}>
              <Text style={styles.emptyStateTitle}>No tree yet</Text>
              <Text style={styles.emptyStateText}>
                Add a scene and the map will grow from your story.
              </Text>
            </View>
          ) : (
            <ScrollView
              ref={fullScreenTreeHorizontalRef}
              horizontal
              showsHorizontalScrollIndicator
              style={styles.storyTreeFullScreenViewport}
              contentContainerStyle={styles.storyTreeCenteredScrollContent}
              onLayout={(event) =>
                setFullScreenTreeViewport({
                  width: event.nativeEvent.layout.width,
                  height: event.nativeEvent.layout.height,
                })
              }
            >
              <ScrollView
                ref={fullScreenTreeVerticalRef}
                showsVerticalScrollIndicator
                contentContainerStyle={styles.storyTreeCenteredScrollContent}
              >
                <View
                  ref={storyTreeImageRef}
                  collapsable={false}
                  style={styles.storyTreeCaptureSurface}
                >
                  <Animated.View style={fullScreenTreeZoomWrapperStyle}>
                  <Animated.View
                    style={[
                      styles.storyTreeCanvas,
                      {
                        width: fullScreenStoryTreeWidth,
                        height: fullScreenStoryTreeHeight,
                      },
                      fullScreenTreeZoomedCanvasStyle,
                    ]}
                  >
                    {storyTreeConnections.map((connection: any) => {
                      const color = connection.isBackLink ? "#9A6A13" : connection.color;

                      if (STORY_TREE_LAYOUT_DIRECTION === 'vertical') {
                        const sourceX = connection.sourceNode.x + STORY_TREE_NODE_WIDTH / 2;
                        const targetX = connection.targetNode.x + STORY_TREE_NODE_WIDTH / 2;
                        const sourceY = connection.sourceNode.y + STORY_TREE_NODE_HEIGHT;
                        const targetY = connection.targetNode.y;
                        const midY = Math.max(
                            sourceY + 10,
                            Math.min(sourceY + 18 + (connection.choiceIndex % 4) * 5, targetY - 10),
                          );

                        return (
                          <View key={`fullscreen-${connection.key}`} pointerEvents="none">
                            <View
                              style={[
                                styles.storyTreeVerticalLine,
                                {
                                  left: sourceX,
                                  top: Math.min(sourceY, midY),
                                  height: Math.max(2, Math.abs(midY - sourceY)),
                                  borderColor: color,
                                },
                              ]}
                            />
                            <View
                              style={[
                                styles.storyTreeLine,
                                {
                                  left: Math.min(sourceX, targetX),
                                  top: midY,
                                  width: Math.max(2, Math.abs(targetX - sourceX)),
                                  borderColor: color,
                                },
                              ]}
                            />
                            <View
                              style={[
                                styles.storyTreeVerticalLine,
                                {
                                  left: targetX,
                                  top: Math.min(midY, targetY),
                                  height: Math.max(2, Math.abs(targetY - midY)),
                                  borderColor: color,
                                },
                              ]}
                            />
                            <View
                              style={[
                                styles.storyTreeDownArrow,
                                {
                                  left: targetX - 4,
                                  top: targetY - 6,
                                  borderTopColor: color,
                                },
                              ]}
                            />
                          </View>
                        );
                      }

                      const sourceX = connection.sourceNode.x + STORY_TREE_NODE_WIDTH;
                      const targetX = connection.targetNode.x;
                      const sourceY = connection.sourceNode.y + STORY_TREE_NODE_HEIGHT / 2;
                      const targetY = connection.targetNode.y + STORY_TREE_NODE_HEIGHT / 2;
                      const midX = Math.max(sourceX + 14, Math.min(sourceX + 34, targetX - 14));
                      const minY = Math.min(sourceY, targetY);

                      return (
                        <View key={`fullscreen-${connection.key}`} pointerEvents="none">
                          <View
                            style={[
                              styles.storyTreeLine,
                              {
                                left: Math.min(sourceX, midX),
                                top: sourceY,
                                width: Math.max(2, Math.abs(midX - sourceX)),
                                borderColor: color,
                              },
                            ]}
                          />
                          <View
                            style={[
                              styles.storyTreeVerticalLine,
                              {
                                left: midX,
                                top: minY,
                                height: Math.max(2, Math.abs(targetY - sourceY)),
                                borderColor: color,
                              },
                            ]}
                          />
                          <View
                            style={[
                              styles.storyTreeLine,
                              {
                                left: Math.min(midX, targetX),
                                top: targetY,
                                width: Math.max(2, Math.abs(targetX - midX)),
                                borderColor: color,
                              },
                            ]}
                          />
                        </View>
                      );
                    })}

                    {fullScreenStoryTreeNodes.map((node) => (
                      <Pressable
                        key={`fullscreen-${node.scene.id}`}
                        style={[
                          styles.storyTreeNode,
                          {
                            left: node.x,
                            top: node.y,
                            width: STORY_TREE_NODE_WIDTH,
                            height: STORY_TREE_NODE_HEIGHT,
                          },
                          node.isStart && styles.storyTreeStartNode,
                          !node.isReachable && styles.storyTreeDisconnectedNode,
                          node.missingTargetCount > 0 && styles.storyTreeMissingNode,
                        ]}
                        onPress={() => {
                          setIsStoryTreeFullScreenOpen(false);
                          openSceneEditor(node.scene.id);
                        }}
                      >
                        <View style={styles.storyTreeNodeTopRow}>
                          <Text style={styles.storyTreeNodeIcon}>{"\uD83C\uDF3F"}</Text>
                          <Text
                            style={styles.storyTreeNodeTitle}
                            numberOfLines={2}
                            ellipsizeMode="tail"
                          >
                            {node.scene.title || "Untitled scene"}
                          </Text>
                        </View>

                        <View style={styles.storyTreeBadgeRow}>
                          {node.isStart && <Text style={styles.storyTreeBadge}>Start</Text>}
                          {node.isEnding && <Text style={styles.storyTreeBadge}>End</Text>}
                          {node.incomingCount > 1 && <Text style={styles.storyTreeBadge}>Merge</Text>}
                          {!node.isReachable && (
                            <Text style={styles.storyTreeWarningBadge}>Disconnected</Text>
                          )}
                          {node.missingTargetCount > 0 && (
                            <Text style={styles.storyTreeWarningBadge}>Missing</Text>
                          )}
                        </View>
                      </Pressable>
                    ))}

                    {disconnectedStoryTreeNodes.length > 0 && (
                      <Text
                        style={[
                          styles.storyTreeExportSectionLabel,
                          { top: storyTreeHeight + 16 },
                        ]}
                      >
                        Disconnected scenes
                      </Text>
                    )}

                    <View
                      style={[
                        styles.storyTreeExportLegend,
                        { top: fullScreenStoryTreeHeight - fullScreenLegendHeight + 8 },
                      ]}
                    >
                      <Text style={styles.storyTreeExportLegendText}>
                        Start: {scenes.length > 0 ? 1 : 0}  |  Endings: {storyTreeEndingCount}  |  Missing: {missingTargetCount}  |  Disconnected: {disconnectedSceneCount}
                      </Text>
                    </View>
                  </Animated.View>
                  </Animated.View>
                </View>
              </ScrollView>
            </ScrollView>
          )}
        </View>
      </Modal>
      <Modal
        visible={isExportPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsExportPickerOpen(false)}
      >
        <Pressable
          style={styles.sceneMenuOverlay}
          onPress={() => setIsExportPickerOpen(false)}
        >
          <Pressable
            style={styles.sceneMenuCard}
            onPress={(event: any) => event?.stopPropagation?.()}
          >
            <Text style={styles.sceneMenuTitle}>Export story</Text>
            <Text style={styles.sceneMenuMeta}>
              Choose a file format to download.
            </Text>

            <Pressable
              style={styles.sceneMenuItem}
              accessibilityRole="button"
              onPress={() => {
                setIsExportPickerOpen(false);
                void shareHtml();
              }}
            >
              <Text style={styles.sceneMenuItemText}>Playable HTML</Text>
            </Pressable>

            <Pressable
              style={styles.sceneMenuItem}
              accessibilityRole="button"
              onPress={() => {
                setIsExportPickerOpen(false);
                void shareJson();
              }}
            >
              <Text style={styles.sceneMenuItemText}>Backup JSON</Text>
            </Pressable>

            <Pressable
              style={styles.sceneMenuCancelButton}
              onPress={() => setIsExportPickerOpen(false)}
            >
              <Text style={styles.sceneMenuCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        visible={isChoosingStoryIcon}
        transparent
        animationType="fade"
        onRequestClose={() => setIsChoosingStoryIcon(false)}
      >
        <Pressable
          style={styles.sceneMenuOverlay}
          onPress={() => setIsChoosingStoryIcon(false)}
        >
          <Pressable
            style={styles.iconPickerCard}
            onPress={(event: any) => event?.stopPropagation?.()}
          >
            <Text style={styles.sceneMenuTitle}>Choose story icon</Text>
            <Text style={styles.sceneMenuMeta}>
              {title || "Untitled story"}
            </Text>

            <View style={styles.iconPickerGrid}>
              {STORY_ICON_PRESETS.map((icon) => (
                <Pressable
                  key={icon}
                  style={[
                    styles.iconPickerButton,
                    storyIcon === icon && styles.iconPickerButtonSelected,
                  ]}
                  onPress={() => chooseStoryIcon(icon)}
                >
                  <Text style={styles.iconPickerText}>{icon}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={styles.sceneMenuCancelButton}
              onPress={() => setIsChoosingStoryIcon(false)}
            >
              <Text style={styles.sceneMenuCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>


      <Modal
        visible={isMusicPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={closeMusicPicker}
      >
        <Pressable
          style={styles.sceneMenuOverlay}
          onPress={closeMusicPicker}
        >
          <Pressable
            style={styles.musicPickerCard}
            onPress={(event: any) => event?.stopPropagation?.()}
          >
            <ScrollView
              style={styles.musicPickerScroll}
              contentContainerStyle={styles.musicPickerScrollContent}
              showsVerticalScrollIndicator
            >
            <Text style={styles.sceneMenuTitle}>Choose background music</Text>
            <Text style={styles.sceneMenuMeta}>
              Pick a built-in track or upload your own audio file.
            </Text>

            <Text style={styles.musicPickerSectionTitle}>Built-in music</Text>

            <View style={styles.musicPresetList}>
              {BUILT_IN_BACKGROUND_MUSIC.map((track) => {
                const isSelected =
                  backgroundMusic?.type === "built-in" &&
                  backgroundMusic?.builtInId === track.id;

                return (
                  <Pressable
                    key={track.id}
                    style={[
                      styles.musicPresetRow,
                      isSelected && styles.musicPresetRowSelected,
                    ]}
                    onPress={() => selectBuiltInBackgroundMusic(track)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.musicPresetTitle}>
                        {isSelected ? "✓ " : ""}
                        {track.title}
                      </Text>
                      <Text style={styles.musicPresetDescription}>
                        {track.description}
                      </Text>
                    </View>

                    <Text style={styles.musicUseText}>Use</Text>
                  </Pressable>
                );
              })}
            </View>

            {previewTrackName && (
              <View style={styles.musicPreviewRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.musicPresetTitle} numberOfLines={1}>
                    Previewing: {previewTrackName}
                  </Text>
                  <Text style={styles.musicPresetDescription}>
                    {musicPreviewStatus.playing ? "Playing now" : "Preview paused"}
                  </Text>
                </View>
                <Pressable
                  style={styles.musicPreviewStopButton}
                  onPress={stopBackgroundMusicPreview}
                  accessibilityRole="button"
                  accessibilityLabel="Stop music preview"
                >
                  <Text style={styles.musicPreviewStopText}>Stop</Text>
                </Pressable>
              </View>
            )}

            <Text style={styles.musicPickerSectionTitle}>Your own music</Text>

            <Pressable
              style={styles.musicUploadButton}
              onPress={uploadCustomBackgroundMusic}
            >
              <Text style={styles.musicUploadButtonText}>
                Upload audio file
              </Text>
            </Pressable>

            {backgroundMusic && (
              <Pressable
                style={styles.musicRemoveButton}
                onPress={() => {
                  stopBackgroundMusicPreview();
                  removeBackgroundMusic();
                  setIsMusicPickerOpen(false);
                }}
              >
                <Text style={styles.musicRemoveButtonText}>Remove music</Text>
              </Pressable>
            )}
            </ScrollView>

            <Pressable
              style={[styles.sceneMenuCancelButton, styles.musicPickerDoneButton]}
              onPress={closeMusicPicker}
            >
              <Text style={styles.sceneMenuCancelText}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!sceneMenuTarget}
        transparent
        animationType="fade"
        onRequestClose={closeSceneMenu}
      >
        <Pressable style={styles.sceneMenuOverlay} onPress={closeSceneMenu}>
          <Pressable
            style={styles.sceneMenuCard}
            onPress={(event: any) => event?.stopPropagation?.()}
          >
            <Text style={styles.sceneMenuTitle} numberOfLines={2}>
              {sceneMenuTarget?.scene?.title || "Untitled scene"}
            </Text>

            <Pressable
              style={[
                styles.sceneMenuItem,
                sceneMenuTarget?.index === 0 && styles.sceneMenuItemDisabled,
              ]}
              onPress={handleSetSceneAsStart}
              disabled={sceneMenuTarget?.index === 0}
            >
              <Text
                style={[
                  styles.sceneMenuItemText,
                  sceneMenuTarget?.index === 0 &&
                    styles.sceneMenuItemTextDisabled,
                ]}
              >
                {sceneMenuTarget?.index === 0
                  ? "Start scene ✓"
                  : "Set as start scene"}
              </Text>
            </Pressable>

            <Pressable
              style={styles.sceneMenuItem}
              onPress={handleDuplicateScene}
              accessibilityRole="button"
              accessibilityLabel="Duplicate scene"
            >
              <Text style={styles.sceneMenuItemText}>Duplicate scene</Text>
            </Pressable>

            <Pressable
              style={styles.sceneMenuItem}
              onPress={handleToggleSceneDone}
            >
              <Text style={styles.sceneMenuItemText}>
                {sceneMenuTarget?.scene?.isDone
                  ? "Mark unfinished"
                  : "Mark done"}
              </Text>
            </Pressable>

            <Pressable
              style={styles.sceneMenuItem}
              onPress={handleDeleteSceneFromMenu}
            >
              <Text style={styles.sceneMenuDeleteText}>Delete</Text>
            </Pressable>

            <Pressable
              style={styles.sceneMenuCancelButton}
              onPress={closeSceneMenu}
            >
              <Text style={styles.sceneMenuCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 46,
    paddingHorizontal: 16,
    paddingBottom: 100,
    backgroundColor: "#F6F0DF",
  },

  homePill: {
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D9CBA5",
    marginBottom: 22,
    backgroundColor: "#FFFDF7",
  },

  homePillText: {
    color: "#343026",
    fontSize: 16,
    fontWeight: "800",
  },

  storyHeroCard: {
    backgroundColor: "#F9F3E4",
    borderRadius: 30,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "#C6B36F",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  storyHeroTopRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 18,
  },

  storyIconTile: {
    flexShrink: 0,
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E7F0D6",
    borderWidth: 2,
    borderColor: "#6B8C51",
  },

  storyIconText: {
    fontSize: 34,
  },

  storyHeroTextArea: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 200,
  },

  storyTitleRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  renameStoryIconButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#9BB67D",
    backgroundColor: "#F1F7E9",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  renameStoryIconText: {
    color: "#247322",
    fontSize: 18,
    fontWeight: "900",
  },
  heroTitle: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    fontSize: 31,
    lineHeight: 35,
    color: "#287824",
    fontWeight: "900",
  },

  heroSubtitle: {
    color: "#6D6250",
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "700",
    marginTop: 6,
  },

  heroPrimaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 10,
  },

  heroPlayButton: {
    flex: 1,
    minWidth: 108,
    minHeight: 58,
    justifyContent: "center",
    backgroundColor: "#287824",
    paddingVertical: 15,
    borderRadius: 18,
    alignItems: "center",
  },

  heroPlayButtonText: {
    color: "#fff",
    fontSize: 19,
    fontWeight: "900",
  },

  heroAddButton: {
    flex: 1,
    minWidth: 108,
    minHeight: 58,
    justifyContent: "center",
    backgroundColor: "#E7F0D6",
    paddingVertical: 15,
    borderRadius: 18,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#287824",
  },

  heroAddButtonText: {
    color: "#287824",
    fontSize: 17,
    fontWeight: "900",
  },

  heroSecondaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  heroSecondaryButton: {
    flex: 1,
    minWidth: 108,
    minHeight: 54,
    justifyContent: "center",
    backgroundColor: "#FFFDF7",
    paddingVertical: 13,
    borderRadius: 17,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D9CBA5",
  },

  heroSecondaryButtonText: {
    textAlign: "center",
    color: "#463D2F",
    fontSize: 16,
    fontWeight: "900",
  },

  storyTitleEditCard: {
    backgroundColor: "#FFFDF7",
    borderWidth: 1,
    borderColor: "#D9CBA5",
    borderRadius: 22,
    padding: 16,
    marginBottom: 20,
  },

  storyTitleInput: {
    borderWidth: 1,
    borderColor: "#D9CBA5",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 22,
    fontWeight: "900",
    backgroundColor: "#fff",
  },

  storyTitleEditRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },

  storyTitleSaveButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#287824",
  },

  storyTitleSaveText: {
    color: "#fff",
    fontWeight: "900",
  },

  storyTitleCancelButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D9CBA5",
    backgroundColor: "#FFFDF7",
  },

  storyTitleCancelText: {
    color: "#333",
    fontWeight: "900",
  },

  storyToolsCard: {
    backgroundColor: "#FFFDF7",
    borderRadius: 26,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#E1D5B8",
  },

  sectionHeaderRowCompact: {
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#2A2720",
  },

  sectionHelperText: {
    color: "#6D6250",
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "700",
    marginTop: 4,
  },

  flexTextArea: {
    flex: 1,
    minWidth: 0,
  },

  toolGrid: {
    gap: 10,
  },

  memoryToolTile: {
    padding: 13,
    borderRadius: 20,
    backgroundColor: "#F8F4E8",
    borderWidth: 1,
    borderColor: "#DCE9D1",
    gap: 10,
  },

  memoryToolHeaderRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },

  memoryToolActionRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-end",
  },

  toolTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 13,
    borderRadius: 20,
    backgroundColor: "#F8F4E8",
    borderWidth: 1,
    borderColor: "#DCE9D1",
  },

  toolIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E7F0D6",
    borderWidth: 1,
    borderColor: "#C9DCB7",
  },

  toolIconText: {
    fontSize: 24,
  },

  toolTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },

  toolTitle: {
    color: "#2A2720",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900",
    flexShrink: 1,
  },

  toolStatus: {
    color: "#6D6250",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },

  toolButtonRow: {
    gap: 6,
    alignItems: "flex-end",
  },

  visibilityToggle: {
    minWidth: 72,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#A9C393",
    backgroundColor: "#EAF2DC",
    flexShrink: 0,
  },
  visibilityToggleVisible: {
    borderColor: "#287824",
    backgroundColor: "#287824",
  },
  visibilityTogglePressed: {
    opacity: 0.76,
  },
  visibilityToggleText: {
    color: "#287824",
    fontSize: 15,
    fontWeight: "900",
  },
  visibilityToggleTextVisible: {
    color: "#FFFFFF",
  },

  toolButton: {
    flexShrink: 0,
    backgroundColor: "#287824",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },

  toolButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
  },

  toolGhostButton: {
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#D9CBA5",
    backgroundColor: "#FFFDF7",
  },

  toolGhostButtonText: {
    color: "#6D6250",
    fontSize: 12,
    fontWeight: "800",
  },


  playAppearanceCard: {
    marginTop: 4,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D9CBA5",
    backgroundColor: "#FFFDF7",
  },
  playAppearanceTitle: {
    color: "#2A2720",
    fontSize: 18,
    fontWeight: "900",
  },
  playAppearanceHelper: {
    color: "#6D6250",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    marginTop: 3,
    marginBottom: 12,
  },
  appearanceOptionLabel: {
    color: "#463D2F",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 8,
    marginBottom: 6,
  },
  appearanceOptionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  appearanceOptionButton: {
    flexGrow: 1,
    flexBasis: "46%",
    minHeight: 44,
    paddingVertical: 9,
    paddingHorizontal: 9,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D9CBA5",
    backgroundColor: "#FFFFFF",
  },
  appearanceOptionButtonSelected: {
    borderColor: "#287824",
    borderWidth: 2,
    backgroundColor: "#E7F0D6",
  },
  appearanceOptionText: {
    color: "#463D2F",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  appearanceOptionTextSelected: {
    color: "#247322",
  },
  appearanceSegmentRow: {
    flexDirection: "row",
    gap: 7,
  },
  appearanceSegmentButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingVertical: 9,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D9CBA5",
    backgroundColor: "#FFFFFF",
  },
  themeOptionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  themeOptionButton: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 76,
    minHeight: 68,
    padding: 7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D9CBA5",
    backgroundColor: "#FFFFFF",
  },
  themeSwatch: {
    width: 36,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "flex-end",
    padding: 3,
    marginBottom: 4,
  },
  themeSwatchAccent: {
    width: "65%",
    height: 6,
    borderRadius: 3,
  },
  themeOptionText: {
    color: "#463D2F",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  appearancePreview: {
    marginTop: 14,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  appearancePreviewLabel: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  appearancePreviewText: {
    fontWeight: "500",
    marginBottom: 10,
  },
  appearancePreviewChoice: {
    minHeight: 42,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  appearancePreviewChoiceText: {
    fontWeight: "900",
  },

  musicPickerCard: {
    width: "90%",
    maxHeight: "86%",
    backgroundColor: "#FFFDF7",
    borderRadius: 28,
    padding: 20,
    borderWidth: 2,
    borderColor: "#6B8C51",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  musicPickerScroll: {
    flexShrink: 1,
  },
  musicPickerScrollContent: {
    paddingBottom: 12,
  },
  musicPickerDoneButton: {
    flexShrink: 0,
    marginTop: 4,
  },

  musicPickerSectionTitle: {
    marginTop: 14,
    marginBottom: 8,
    color: "#287824",
    fontSize: 15,
    fontWeight: "900",
  },

  musicPresetList: {
    gap: 8,
  },

  musicPresetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#D9CBA5",
    backgroundColor: "#F9F3E4",
  },

  musicPresetRowSelected: {
    borderColor: "#287824",
    backgroundColor: "#E7F0D6",
  },

  musicPresetTitle: {
    color: "#2A2720",
    fontSize: 15,
    fontWeight: "900",
  },

  musicPresetDescription: {
    color: "#6D6250",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },

  musicUseText: {
    color: "#287824",
    fontSize: 13,
    fontWeight: "900",
  },
  musicPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#A9C393",
    backgroundColor: "#F3F8E9",
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  musicPreviewStopButton: {
    minHeight: 44,
    minWidth: 70,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2F7D32",
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
  },
  musicPreviewStopText: {
    color: "#2F7D32",
    fontSize: 15,
    fontWeight: "800",
  },

  musicUploadButton: {
    backgroundColor: "#287824",
    borderRadius: 18,
    paddingVertical: 13,
    alignItems: "center",
  },

  musicUploadButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
  },

  musicRemoveButton: {
    marginTop: 10,
    borderRadius: 18,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D9CBA5",
    backgroundColor: "#FFFDF7",
  },

  musicRemoveButtonText: {
    color: "#9A3A2F",
    fontSize: 14,
    fontWeight: "900",
  },

  infoButton: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E7F0D6",
    borderWidth: 1,
    borderColor: "#C9DCB7",
    flexShrink: 0,
  },

  infoButtonText: {
    color: "#4F6F52",
    fontSize: 15,
    fontWeight: "900",
  },


  traceOverviewBox: {
    borderRadius: 18,
    padding: 12,
    backgroundColor: "#FFFDF7",
    borderWidth: 1,
    borderColor: "#E1D5B8",
  },

  traceSummaryRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F0E7D2",
  },

  traceSummaryTitle: {
    color: "#2A2720",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 3,
  },

  traceSummaryMeta: {
    color: "#6D6250",
    fontSize: 12,
    fontWeight: "700",
  },

  traceEmptyText: {
    color: "#6D6250",
    lineHeight: 20,
    fontWeight: "700",
  },
  valuesExpandedCard: {
    backgroundColor: "#FFFDF7",
    borderRadius: 24,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E1D5B8",
  },

  valuesDescription: {
    color: "#6D6250",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
    marginBottom: 14,
  },

  valuesEmptyText: {
    color: "#6D6250",
    lineHeight: 20,
    marginBottom: 14,
    fontWeight: "700",
  },

  valueDefinitionCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DCE9D1",
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    backgroundColor: "#F8F4E8",
  },

  valueDefinitionName: {
    fontSize: 16,
    fontWeight: "900",
    color: "#2A2720",
    marginBottom: 4,
  },

  valueDefinitionNameInput: {
    borderWidth: 1,
    borderColor: "#D9CBA5",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#FFFDF7",
    color: "#2A2720",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 6,
  },

  valueDefinitionMeta: {
    color: "#6D6250",
    lineHeight: 20,
    fontWeight: "700",
  },

  valueDeleteButton: {
    padding: 8,
    marginLeft: 8,
  },

  valueDeleteText: {
    color: "#ff3b30",
    fontSize: 18,
    fontWeight: "900",
  },

  addValueBox: {
    borderWidth: 1,
    borderColor: "#D9CBA5",
    borderStyle: "dashed",
    borderRadius: 18,
    padding: 14,
    marginTop: 6,
  },

  addValueTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#2A2720",
    marginBottom: 10,
  },

  valueTextInput: {
    borderWidth: 1,
    borderColor: "#D9CBA5",
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#fff",
    marginBottom: 10,
    fontWeight: "700",
  },

  valueNumberGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },

  valueNumberField: {
    flexGrow: 1,
    minWidth: "22%",
  },

  valueSmallLabel: {
    color: "#6D6250",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 4,
  },

  valueNumberInput: {
    borderWidth: 1,
    borderColor: "#D9CBA5",
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#fff",
    fontWeight: "700",
  },

  addValueButton: {
    backgroundColor: "#287824",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },

  addValueButtonDisabled: {
    opacity: 0.5,
  },

  addValueButtonText: {
    color: "#fff",
    fontWeight: "900",
  },

  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
    marginTop: 6,
    marginBottom: 12,
  },

  bigSectionTitle: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
    color: "#2A2720",
  },


  storyScenesTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  storyScenesAddButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#287824",
    borderWidth: 1,
    borderColor: "#287824",
  },

  storyScenesAddButtonText: {
    color: "#fff",
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "900",
  },
  sectionCount: {
    color: "#287824",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 5,
  },


  storyTreeCaptureSurface: {
    padding: STORY_TREE_EXPORT_PADDING,
    backgroundColor: "#FBF7EA",
  },

  storyTreeExportSectionLabel: {
    position: "absolute",
    left: STORY_TREE_PADDING,
    color: "#4F6F52",
    fontSize: 14,
    fontWeight: "900",
  },

  storyTreeExportLegend: {
    position: "absolute",
    left: STORY_TREE_PADDING,
    right: STORY_TREE_PADDING,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: "#D8CCAA",
  },

  storyTreeExportLegendText: {
    color: "#5D5548",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
  },

  storyTreeCenteredScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  storyTreeFullScreenViewport: {
    flex: 1,
  },

  storyTreeFullScreenContainer: {
    flex: 1,
    backgroundColor: "#F7F1E1",
    paddingTop: 46,
    paddingHorizontal: 14,
    paddingBottom: 18,
  },

  storyTreeFullScreenHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },

  storyTreeFullScreenTitle: {
    color: "#2A2720",
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
  },

  storyTreeFullScreenSubtitle: {
    color: "#6D6250",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    marginTop: 2,
  },

  storyTreeFullScreenCloseButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D9CBA5",
    backgroundColor: "#FFFDF7",
  },

  storyTreeFullScreenCloseText: {
    color: "#2A2720",
    fontSize: 13,
    fontWeight: "900",
  },

  storyTreeFullScreenControls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  storyTreeCard: {
    backgroundColor: "#FFFDF7",
    borderRadius: 20,
    padding: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#9BB67D",
  },

  storyTreeHeaderRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },

  storyTreeHeaderText: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 170,
  },

  storyTreeToggleText: {
    color: "#287824",
    fontSize: 13,
    fontWeight: "900",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#E7F0D6",
    overflow: "hidden",
  },

  storyTreeSummaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
    marginBottom: 8,
  },

  storyTreeSummaryButton: {
    overflow: "hidden",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "#E7F0D6",
    borderWidth: 1,
    borderColor: "#CFE2BE",
  },

  storyTreeWarningButton: {
    backgroundColor: "#FFF0B8",
    borderColor: "#E2B84C",
  },

  storyTreeSummaryButtonText: {
    color: "#287824",
    fontSize: 11,
    fontWeight: "900",
  },


  storyTreeZoomControl: {
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#FFFDF7",
    borderWidth: 1,
    borderColor: "#CFE2BE",
  },

  storyTreeZoomButton: {
    width: 32,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E7F0D6",
  },

  storyTreeZoomButtonText: {
    color: "#287824",
    fontSize: 18,
    lineHeight: 20,
    fontWeight: "900",
  },

  storyTreeZoomText: {
    minWidth: 42,
    textAlign: "center",
    color: "#287824",
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 6,
  },
  storyTreeEmptyBox: {
    backgroundColor: "#F8F4E8",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#D9CBA5",
  },

  storyTreeScrollWindow: {
    maxHeight: 360,
    borderRadius: 14,
    backgroundColor: "#FBF8EE",
    borderWidth: 1,
    borderColor: "#D9CBA5",
  },

  storyTreeCanvas: {
    position: "relative",
    backgroundColor: "#FBF8EE",
  },

  storyTreeLine: {
    position: "absolute",
    height: 1,
    borderTopWidth: 1,
  },

  storyTreeVerticalLine: {
    position: "absolute",
    width: 1,
    borderLeftWidth: 1,
  },

  storyTreeDownArrow: {
    position: "absolute",
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },

  storyTreeNode: {
    position: "absolute",
    borderRadius: 14,
    paddingVertical: 7,
    paddingHorizontal: 8,
    overflow: "hidden",
    backgroundColor: "#FFFDF7",
    borderWidth: 1,
    borderColor: "#9BB67D",
  },

  storyTreeStartNode: {
    borderColor: "#287824",
    backgroundColor: "#E7F0D6",
  },

  storyTreeDisconnectedNode: {
    borderColor: "#C9B46F",
    backgroundColor: "#F8F4E8",
  },

  storyTreeMissingNode: {
    borderColor: "#D49A32",
  },

  storyTreeNodeTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
  },

  storyTreeNodeIcon: {
    fontSize: 15,
    lineHeight: 17,
    marginTop: 1,
  },

  storyTreeNodeTitle: {
    flex: 1,
    minWidth: 0,
    color: "#2A2720",
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "900",
  },

  storyTreeBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
    marginTop: 3,
  },

  storyTreeBadge: {
    overflow: "hidden",
    borderRadius: 999,
    paddingVertical: 1,
    paddingHorizontal: 4,
    color: "#287824",
    backgroundColor: "#E7F0D6",
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "900",
  },

  storyTreeWarningBadge: {
    overflow: "hidden",
    borderRadius: 999,
    paddingVertical: 1,
    paddingHorizontal: 4,
    color: "#8A5B00",
    backgroundColor: "#FFF0B8",
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "900",
  },

  storyTreeDisconnectedSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#D9CBA5",
  },

  storyTreeDisconnectedTitle: {
    color: "#2A2720",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 3,
  },

  storyTreeDisconnectedText: {
    color: "#6D6250",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    marginBottom: 8,
  },
  scenesFrame: {
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#6B8C51",
    backgroundColor: "#FBF8EE",
    padding: 14,
    marginBottom: 28,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  emptyStateCard: {
    backgroundColor: "#FFFDF7",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#DCE9D1",
  },

  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#2A2720",
    marginBottom: 4,
  },

  emptyStateText: {
    color: "#6D6250",
    lineHeight: 22,
    fontWeight: "700",
  },

  emptyStateButton: {
    marginTop: 14,
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "#287824",
  },

  emptyStateButtonText: {
    color: "#fff",
    fontWeight: "900",
  },

  sceneCard: {
    borderWidth: 1,
    borderColor: "#9BB67D",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 9,
    width: "100%",
    backgroundColor: "#FFFDF7",
  },

  sceneCardDone: {
    borderWidth: 2,
    borderColor: "#B48A00",
    backgroundColor: "#FFF8D6",
  },

  scenePressArea: {
    width: "100%",
  },

  sceneIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#287824",
    backgroundColor: "#E7F0D6",
    alignItems: "center",
    justifyContent: "center",
  },

  sceneIconText: {
    fontSize: 28,
  },

  sceneContentArea: {
    flex: 1,
    minWidth: 0,
  },

  sceneTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },

  sceneTitleAndMeta: {
    flex: 1,
    minWidth: 0,
  },

  sceneTitleRowClean: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },

  sceneTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 23,
    color: "#2A2720",
  },

  sceneMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
  },

  sceneBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 7,
  },

  sceneStatusBadge: {
    alignSelf: "flex-start",
    color: "#287824",
    backgroundColor: "#E7F0D6",
    borderColor: "#CFE2BE",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "900",
  },

  sceneEndingBadge: {
    color: "#7A5600",
    backgroundColor: "#FFF0B8",
    borderColor: "#E2B84C",
  },

  sceneMetaText: {
    flexShrink: 1,
    color: "#6D6250",
    fontSize: 13,
    fontWeight: "800",
  },

  sceneStartBadge: {
    alignSelf: "flex-start",
    color: "#287824",
    backgroundColor: "#E7F0D6",
    borderColor: "#CFE2BE",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "900",
  },

  sceneDoneBadge: {
    alignSelf: "flex-start",
    color: "#7A5600",
    backgroundColor: "#FFF0B8",
    borderColor: "#E2B84C",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "900",
  },

  sceneDisconnectedBadge: {
    alignSelf: "flex-start",
    color: "#7A5600",
    backgroundColor: "#FFF8D6",
    borderColor: "#C9B46F",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "900",
  },

  sceneMoreButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E7F0D6",
  },

  sceneMoreButtonText: {
    color: "#287824",
    fontSize: 20,
    fontWeight: "900",
    marginTop: -4,
  },

  statusBadge: {
    color: "#287824",
    backgroundColor: "#E7F0D6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 13,
    fontWeight: "900",
  },

  scenePreview: {
    color: "#6D6250",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
    marginTop: 2,
  },

  warningChipText: {
    alignSelf: "flex-start",
    color: "#9a5a00",
    backgroundColor: "#FFF3D6",
    borderColor: "#FFE0A3",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 6,
  },

  endingHint: {
    color: "#287824",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 8,
  },

  sceneActionRowClean: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 8,
    justifyContent: "flex-end",
    alignItems: "center",
  },

  sceneSoftButton: {
    backgroundColor: "#E7F0D6",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    minWidth: 40,
    alignItems: "center",
  },

  sceneSoftButtonText: {
    color: "#287824",
    fontSize: 13,
    fontWeight: "900",
  },

  previewSceneButton: {
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#6B8C51",
    backgroundColor: "#FFFDF7",
    minWidth: 42,
    alignItems: "center",
  },

  previewSceneButtonText: {
    color: "#287824",
    fontSize: 13,
    fontWeight: "900",
  },

  sceneDetailsBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#F8F4E8",
    borderWidth: 1,
    borderColor: "#D9CBA5",
  },

  sceneDetailsTitle: {
    fontSize: 12,
    color: "#6D6250",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },

  sceneDetailsText: {
    color: "#6D6250",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },

  sceneWarningText: {
    color: "#9a5a00",
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 20,
    marginTop: 6,
  },

  sceneDetailsActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
    alignItems: "center",
  },

  doneButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D9CBA5",
    alignSelf: "flex-start",
    backgroundColor: "#FFFDF7",
  },

  doneButtonActive: {
    borderColor: "#287824",
    backgroundColor: "#E7F0D6",
  },

  doneButtonText: {
    color: "#463D2F",
    fontSize: 13,
    fontWeight: "900",
  },

  doneButtonTextActive: {
    color: "#287824",
  },

  deleteSceneTextButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },

  deleteSceneText: {
    color: "#9C4B3C",
    fontSize: 13,
    fontWeight: "900",
  },

  choiceOverviewBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#F8F4E8",
    borderWidth: 1,
    borderColor: "#D9CBA5",
  },

  choiceOverviewTitle: {
    fontSize: 12,
    color: "#6D6250",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },

  choiceOverviewText: {
    color: "#3E6D28",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "800",
  },

  sceneMenuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.28)",
    justifyContent: "flex-end",
    padding: 22,
  },

  sceneMenuCard: {
    backgroundColor: "#FFFDF7",
    borderRadius: 26,
    padding: 18,
    borderWidth: 2,
    borderColor: "#6B8C51",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },

  sceneMenuTitle: {
    color: "#2E2A22",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 10,
  },

  sceneMenuMeta: {
    color: "#6D6250",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 12,
  },

  sceneMenuItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E7DDC5",
  },

  sceneMenuItemDisabled: {
    opacity: 0.6,
  },

  sceneMenuItemText: {
    color: "#287824",
    fontSize: 17,
    fontWeight: "900",
  },

  sceneMenuItemTextDisabled: {
    color: "#6D6250",
  },

  sceneMenuDeleteText: {
    color: "#9C4B3C",
    fontSize: 17,
    fontWeight: "900",
  },

  sceneMenuCancelButton: {
    marginTop: 14,
    paddingVertical: 13,
    borderRadius: 999,
    alignItems: "center",
    backgroundColor: "#E7F0D6",
  },

  sceneMenuCancelText: {
    color: "#287824",
    fontSize: 17,
    fontWeight: "900",
  },

  backToTopButton: {
    alignSelf: "center",
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D9CBA5",
    backgroundColor: "#FFFDF7",
    marginBottom: 24,
  },

  backToTopButtonText: {
    color: "#463D2F",
    fontSize: 15,
    fontWeight: "900",
  },

  iconPickerCard: {
    backgroundColor: "#FFFDF7",
    borderRadius: 26,
    padding: 18,
    borderWidth: 2,
    borderColor: "#6B8C51",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },

  iconPickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
    marginBottom: 14,
  },

  iconPickerButton: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF5EA",
    borderWidth: 2,
    borderColor: "#D6E5D0",
  },

  iconPickerButtonSelected: {
    borderColor: "#247322",
    backgroundColor: "#E2F0D6",
  },

  iconPickerText: {
    fontSize: 28,
  },
});
