import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
} from "react-native";
import { router, Stack } from "expo-router";
import { useStoryStore } from "../store/storyStore";
import { Alert } from "react-native";
import { useState, useRef, useEffect } from "react";

import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { Asset } from "expo-asset";

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


export default function StoryScreen() {
  const currentStory = useStoryStore((state) => state.getCurrentStory());
  const setStoryIcon = useStoryStore((state: any) => state.setStoryIcon);
  const deleteScene = useStoryStore((state) => state.deleteScene);
  const updateScene = useStoryStore((state) => state.updateScene);
  const toggleSceneDone = useStoryStore((state) => state.toggleSceneDone);
  const scenes = currentStory?.scenes || [];
  const title = currentStory?.title || "Untitled story";
  const exportCurrentStory = useStoryStore((state) => state.exportCurrentStory);
  const exportCurrentStoryAsHtml = useStoryStore(
    (state) => state.exportCurrentStoryAsHtml,
  );
  const addStoryValue = useStoryStore((state) => state.addStoryValue);
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
  const [isMusicPickerOpen, setIsMusicPickerOpen] = useState(false);

  const toggleShowSceneTitlesInPlay = useStoryStore(
    (state) => state.toggleShowSceneTitlesInPlay,
  );

  const shareJson = async () => {
    const json = exportCurrentStory();

    if (!json) {
      Alert.alert("Share failed", "No current story to share.");
      return;
    }

    try {
      const fileName = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "story"}.json`;
      const fileUri = FileSystem.documentDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();

      if (!canShare) {
        Alert.alert("Export saved", `JSON saved to: ${fileUri}`);
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: "application/json",
        dialogTitle: "Share story backup",
      });
    } catch (error) {
      console.error("JSON share error:", error);
      Alert.alert("Share failed", "Could not create or share the JSON file.");
    }
  };

  const shareHtml = async () => {
    const html = await buildPortableHtml();

    if (!html) {
      Alert.alert("Share failed", "No current story to share.");
      return;
    }

    try {
      const fileName = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "story"}.html`;
      const fileUri = FileSystem.documentDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, html, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();

      if (!canShare) {
        Alert.alert("Export saved", `HTML saved to: ${fileUri}`);
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: "text/html",
        dialogTitle: "Share playable story",
      });
    } catch (error) {
      console.error("HTML share error:", error);
      Alert.alert("Share failed", "Could not create or share the HTML file.");
    }
  };

  const openShareOptions = () => {
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

  const [newValueName, setNewValueName] = useState("");
  const [newValueInitial, setNewValueInitial] = useState("0");
  const [newValueMin, setNewValueMin] = useState("0");
  const [newValueMax, setNewValueMax] = useState("5");
  const [newValueStep, setNewValueStep] = useState("1");

  const [isValuesExpanded, setIsValuesExpanded] = useState(false);

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

  const doneSceneCount = scenes.filter((scene) => scene.isDone).length;

  const endingSceneCount = scenes.filter(
    (scene) => scene.choices.length === 0,
  ).length;

  const missingTargetCount = scenes.reduce((total, scene) => {
    return (
      total + scene.choices.filter((choice) => !choice.targetSceneId).length
    );
  }, 0);

  const mediaSceneCount = scenes.filter(
    (scene) => (scene.assets?.length || 0) > 0,
  ).length;

  const imageSceneCount = scenes.filter((scene) =>
    scene.assets?.some(
      (asset: any) => asset.type === "image" && asset.alt !== "Drawing",
    ),
  ).length;

  const audioSceneCount = scenes.filter((scene) =>
    scene.assets?.some((asset: any) => asset.type === "audio"),
  ).length;

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

  const drawingSceneCount = scenes.filter((scene) =>
    scene.assets?.some(
      (asset: any) => asset.type === "image" && asset.alt === "Drawing",
    ),
  ).length;

  const sceneHasAudio = (scene: any) =>
    scene.assets?.some((asset: any) => asset.type === "audio") || false;

  const getSceneInfoText = (scene: any, index: number) => {
    const parts: string[] = [];

    if (scene.isDone) {
      parts.push("Done");
    }

    if (index === 0) {
      parts.push("Start scene");
    }

    if (scene.choices.length === 0) {
      parts.push("Ending");
    }

    parts.push(
      `${scene.choices.length} ${scene.choices.length === 1 ? "choice" : "choices"}`,
    );

    const imageCount = getSceneImageCount(scene);
    const drawingCount = getSceneDrawingCount(scene);

    if (imageCount > 0) {
      parts.push(`${imageCount} ${imageCount === 1 ? "image" : "images"}`);
    }

    if (drawingCount > 0) {
      parts.push(
        `${drawingCount} ${drawingCount === 1 ? "drawing" : "drawings"}`,
      );
    }

    if (sceneHasAudio(scene)) {
      parts.push("audio");
    }

    return parts.join(" · ");
  };

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

        if (!builtInTrack) return music;

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
    }

    return music;
  };

  const buildPortableHtml = async () => {
    if (!currentStory) return null;

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
              return asset;
            }
          }),
        );

        return {
          ...scene,
          assets: embeddedAssets,
        };
      }),
    );

    const embeddedBackgroundMusic = await embedBackgroundMusic(
      currentStory.backgroundMusic,
    );

    const portableStory = {
      ...currentStory,
      scenes: scenesWithEmbeddedAssets,
      backgroundMusic: embeddedBackgroundMusic,
    };

    const storyJson = JSON.stringify(portableStory).replace(/</g, "\\u003c");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${portableStory.title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(180deg, #fdf6ff 0%, #f5f9ff 100%);
      color: #2a2a2a;
      margin: 0;
      padding: 0;
    }

    .container {
      max-width: 720px;
      margin: 40px auto;
      padding: 0 20px;
    }

    .card {
      background: white;
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
      color: #888;
    }

    h1 {
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
  background: #f5f5f5;
  color: #222;
  border: 1px solid #eee;
}

.audio-button:hover {
  background: #eeeeee;
  transform: none;
}

.audio-button.playing {
  background: #222;
  color: white;
}

    .scene-image {
      width: 100%;
      border-radius: 10px;
      margin-bottom: 20px;
      max-height: 340px;
      object-fit: cover;
    }

    .scene-text {
      font-size: 1.05rem;
      line-height: 1.7;
      margin-bottom: 24px;
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
      font-size: 1rem;
      background: #3a3a3a;
      color: white;
      cursor: pointer;
      transition: all 0.15s ease;
      text-align: left;
    }

    button:hover {
      background: #555;
      transform: translateY(-1px);
    }

    .restart {
      background: #bbb;
      color: #222;
    }

    .restart:hover {
      background: #999;
    }

    .empty {
      color: #999;
      margin-top: 16px;
      font-style: italic;
    }
  </style>
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

<img id="scene-image" class="scene-image" style="display:none;" />
<audio id="scene-audio"></audio>
<audio id="background-audio" loop></audio>
<div id="scene-text" class="scene-text"></div>
<div id="choices" class="choices"></div>
<div id="empty" class="empty" style="display:none;"></div>
    </div>
  </div>

  <script>
    const story = ${storyJson};
const backgroundAudioEl = document.getElementById('background-audio');
const backgroundButtonEl = document.getElementById('background-button');

if (story.backgroundMusic?.uri) {
  backgroundAudioEl.src = story.backgroundMusic.uri;
  backgroundButtonEl.style.display = 'inline-block';
}

function toggleBackgroundMusic() {
  if (!backgroundAudioEl.src) return;

  if (backgroundAudioEl.paused) {
    backgroundAudioEl.play();
    backgroundButtonEl.textContent = '⏸ Music';
  } else {
    backgroundAudioEl.pause();
    backgroundButtonEl.textContent = '🎵 Music';
  }
}

let currentSceneId = story.scenes[0]?.id;
let chosenChoiceIds = [];
let activeTraces = [];
let storyValues = createInitialStoryValues();

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

    function renderScene() {
      const scene = getSceneById(currentSceneId);
      const titleEl = document.getElementById('scene-title');
      const textEl = document.getElementById('scene-text');
      const choicesEl = document.getElementById('choices');
      const emptyEl = document.getElementById('empty');
      const imageEl = document.getElementById('scene-image');
      const audioEl = document.getElementById('scene-audio');
      const audioButtonEl = document.getElementById('audio-button');

      if (!scene) {
        titleEl.textContent = 'Missing scene';
        textEl.textContent = '';
        choicesEl.innerHTML = '';
        emptyEl.style.display = 'block';
        emptyEl.textContent = 'This scene could not be found.';
        imageEl.style.display = 'none';

        audioEl.pause();
        audioEl.removeAttribute('src');
        audioButtonEl.style.display = 'none';
        audioButtonEl.classList.remove('playing');
        audioButtonEl.textContent = '🎧';

        return;
      }

      titleEl.textContent = scene.title || 'Untitled scene';
      textEl.textContent = scene.text || '';

const firstImage = scene.assets
  ? scene.assets.find(asset => asset.type === 'image')
  : null;

if (firstImage && firstImage.uri) {
  imageEl.src = firstImage.uri;
  imageEl.alt = firstImage.alt || '';
  imageEl.style.display = 'block';
} else {
  imageEl.style.display = 'none';
  imageEl.removeAttribute('src');
}

const audioAsset = scene.assets
  ? scene.assets.find(asset => asset.type === 'audio')
  : null;

audioEl.pause();
audioButtonEl.classList.remove('playing');
audioButtonEl.textContent = '🎧';

if (audioAsset && audioAsset.uri) {
  audioEl.src = audioAsset.uri;
  audioButtonEl.style.display = 'block';
} else {
  audioEl.removeAttribute('src');
  audioButtonEl.style.display = 'none';
}

      choicesEl.innerHTML = '';
      emptyEl.style.display = 'none';

const visibleChoices = (scene.choices || []).filter((choice) => {
  if (
    choice.requiredChoiceId &&
    !chosenChoiceIds.includes(choice.requiredChoiceId)
  ) {
    return false;
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
    btn.textContent = choice.label + (choice.targetSceneId ? '' : ' (no target yet)');

    btn.onclick = () => {
      const choiceId = getChoiceId(scene.id, choice, index);

      if (!chosenChoiceIds.includes(choiceId)) {
        chosenChoiceIds.push(choiceId);
      }

      if (choice.traceLabel?.trim()) {
        const trace = normalizeTrace(choice.traceLabel);
        if (!activeTraces.includes(trace)) {
          activeTraces.push(trace);
        }
      }

      if (choice.valueChange) {
        const valueKey = getStoryValueKey(choice.valueChange);
        const storyValueDefinition = findStoryValueDefinition(choice.valueChange);

        const amount = Number(
          choice.valueChange.amount ?? storyValueDefinition?.step ?? 0
        );

        if (valueKey && !Number.isNaN(amount)) {
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
        }
      }

      if (choice.targetSceneId) {
        const audioEl = document.getElementById('scene-audio');
        audioEl.pause();

        currentSceneId = choice.targetSceneId;
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
  renderScene();
}

    renderScene();
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
    const minValue = parseNumberOrDefault(newValueMin, 0);
    const maxValue = parseNumberOrDefault(newValueMax, 5);
    const step = Math.abs(parseNumberOrDefault(newValueStep, 1)) || 1;

    if (minValue > maxValue) {
      Alert.alert("Check range", "Minimum should be smaller than maximum.");
      return;
    }

    if (initialValue < minValue || initialValue > maxValue) {
  Alert.alert(
    "Check start value",
    "The start value should be inside the minimum and maximum range.",
  );
  return;
}

    addStoryValue({
      name,
      initialValue,
      minValue,
      maxValue,
      step,
    });

    setNewValueName("");
    setNewValueInitial("0");
    setNewValueMin("0");
    setNewValueMax("5");
    setNewValueStep("1");
  };

  const chooseBackgroundMusic = () => {
    setIsMusicPickerOpen(true);
  };

  const selectBuiltInBackgroundMusic = (track: (typeof BUILT_IN_BACKGROUND_MUSIC)[number]) => {
    setBackgroundMusic({
      type: "built-in",
      builtInId: track.id,
      name: track.title,
    } as any);

    setIsMusicPickerOpen(false);
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

      setIsMusicPickerOpen(false);
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
    router.push({
      pathname: "/scene-editor",
      params: { storyTitle: title },
    });
  };

  const openSceneEditor = (sceneId: string) => {
    router.push({
      pathname: "/scene-editor",
      params: { sceneId },
    });
  };

  const previewScene = (sceneId: string) => {
    router.push({
      pathname: "/play",
      params: {
        startSceneId: sceneId,
        preview: "true",
      },
    });
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

    const nextScenes = [
      scenes[sceneIndex],
      ...scenes.slice(0, sceneIndex),
      ...scenes.slice(sceneIndex + 1),
    ];

    nextScenes.forEach((scene, index) => {
      updateScene(index, scene);
    });

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
      >
        <Pressable style={styles.homePill} onPress={() => router.replace("/")}>
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

              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle} numberOfLines={2}>
                  {title || "Untitled story"}
                </Text>
                <Text style={styles.heroSubtitle}>
                  Build and edit your branching story.
                </Text>
              </View>
            </View>

            <View style={styles.heroPrimaryRow}>
              <Pressable
                style={styles.heroPlayButton}
                onPress={() => router.push("/play")}
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
                onPress={() => setIsEditingTitle(true)}
              >
                <Text style={styles.heroSecondaryButtonText}>✎ Rename</Text>
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

        <View style={styles.storyToolsCard}>
          <View style={styles.sectionHeaderRowCompact}>
            <View>
              <Text style={styles.sectionTitle}>Story tools</Text>
              <Text style={styles.sectionHelperText}>
                Optional extras for how the story plays.
              </Text>
            </View>
          </View>

          <View style={styles.toolGrid}>
            <View style={styles.toolTile}>
              <View style={styles.toolIconCircle}>
                <Text style={styles.toolIconText}>🎵</Text>
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.toolTitleRow}>
                  <Text style={styles.toolTitle}>Music</Text>
                  <Pressable
                    style={styles.infoButton}
                    onPress={showBackgroundMusicInfo}
                  >
                    <Text style={styles.infoButtonText}>ⓘ</Text>
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
                <Text style={styles.toolIconText}>👁️</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.toolTitle}>Scene titles</Text>
                <Text style={styles.toolStatus}>
                  {showSceneTitlesInPlay ? "Visible in play" : "Hidden in play"}
                </Text>
              </View>

              <Pressable
                style={styles.toolButton}
                onPress={toggleShowSceneTitlesInPlay}
              >
                <Text style={styles.toolButtonText}>
                  {showSceneTitlesInPlay ? "Hide" : "Show"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.toolTile}>
              <View style={styles.toolIconCircle}>
                <Text style={styles.toolIconText}>🫐</Text>
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.toolTitleRow}>
                  <Text style={styles.toolTitle}>Story values</Text>
                  <Pressable
                    style={styles.infoButton}
                    onPress={showStoryValueInfo}
                  >
                    <Text style={styles.infoButtonText}>ⓘ</Text>
                  </Pressable>
                </View>
                <Text style={styles.toolStatus}>{storyValuesStatus}</Text>
              </View>

              <Pressable
                style={styles.toolButton}
                onPress={() => setIsValuesExpanded(!isValuesExpanded)}
              >
                <Text style={styles.toolButtonText}>
                  {isValuesExpanded ? "Hide" : "Show"}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={{ flex: 1 }}>
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
                        <Text style={styles.valueDefinitionName}>
                          🫐 {value.name}
                        </Text>
                        <Text style={styles.valueDefinitionMeta}>
                          Starts at {value.initialValue} · Range{" "}
                          {value.minValue}–{value.maxValue} · Changes by{" "}
                          {value.step}
                        </Text>
                      </View>

                      <Pressable
                        style={styles.valueDeleteButton}
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
                        <Text style={styles.valueDeleteText}>✕</Text>
                      </Pressable>
                    </View>
                  ))
                ) : (
                  <Text style={styles.valuesEmptyText}>
                    No story values yet. You can skip this for simple stories.
                  </Text>
                )}

                <View style={styles.addValueBox}>
                  <Text style={styles.addValueTitle}>Add story values 🫐</Text>

                  <TextInput
                    style={styles.valueTextInput}
                    value={newValueName}
                    onChangeText={setNewValueName}
                    placeholder="Berries"
                    autoCapitalize="words"
                  />

                  <View style={styles.valueNumberGrid}>
                    <View style={styles.valueNumberField}>
                      <Text style={styles.valueSmallLabel}>Starts</Text>
                      <TextInput
                        style={styles.valueNumberInput}
                        value={newValueInitial}
                        onChangeText={setNewValueInitial}
                        keyboardType="numbers-and-punctuation"
                      />
                    </View>

                    <View style={styles.valueNumberField}>
                      <Text style={styles.valueSmallLabel}>Min</Text>
                      <TextInput
                        style={styles.valueNumberInput}
                        value={newValueMin}
                        onChangeText={setNewValueMin}
                        keyboardType="numbers-and-punctuation"
                      />
                    </View>

                    <View style={styles.valueNumberField}>
                      <Text style={styles.valueSmallLabel}>Max</Text>
                      <TextInput
                        style={styles.valueNumberInput}
                        value={newValueMax}
                        onChangeText={setNewValueMax}
                        keyboardType="numbers-and-punctuation"
                      />
                    </View>

                    <View style={styles.valueNumberField}>
                      <Text style={styles.valueSmallLabel}>Change by</Text>
                      <TextInput
                        style={styles.valueNumberInput}
                        value={newValueStep}
                        onChangeText={setNewValueStep}
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
                    <Text style={styles.addValueButtonText}>
                      Add story values
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.sectionHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bigSectionTitle}>Story scenes</Text>
            <Text style={styles.sectionHelperText}>
              Tap a scene to edit it.
            </Text>
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

                        {!!sceneMeta && (
                          <Text style={styles.sceneMetaText} numberOfLines={1}>
                            {sceneMeta}
                          </Text>
                        )}
                      </View>

                      {scene.choices.length === 0 && (
                        <Text style={styles.endingHint}>
                          This branch currently ends here.
                        </Text>
                      )}

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
        onRequestClose={() => setIsMusicPickerOpen(false)}
      >
        <Pressable
          style={styles.sceneMenuOverlay}
          onPress={() => setIsMusicPickerOpen(false)}
        >
          <Pressable
            style={styles.musicPickerCard}
            onPress={(event: any) => event?.stopPropagation?.()}
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
                  removeBackgroundMusic();
                  setIsMusicPickerOpen(false);
                }}
              >
                <Text style={styles.musicRemoveButtonText}>Remove music</Text>
              </Pressable>
            )}

            <Pressable
              style={styles.sceneMenuCancelButton}
              onPress={() => setIsMusicPickerOpen(false)}
            >
              <Text style={styles.sceneMenuCancelText}>Cancel</Text>
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
    paddingHorizontal: 22,
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
    padding: 20,
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
    alignItems: "center",
    gap: 16,
    marginBottom: 18,
  },

  storyIconTile: {
    width: 78,
    height: 78,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E7F0D6",
    borderWidth: 2,
    borderColor: "#6B8C51",
  },

  storyIconText: {
    fontSize: 40,
  },

  heroTitle: {
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
    gap: 12,
    marginBottom: 10,
  },

  heroPlayButton: {
    flex: 1,
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
    gap: 12,
  },

  heroSecondaryButton: {
    flex: 1,
    backgroundColor: "#FFFDF7",
    paddingVertical: 13,
    borderRadius: 17,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D9CBA5",
  },

  heroSecondaryButtonText: {
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

  toolGrid: {
    gap: 10,
  },

  toolTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
    gap: 6,
  },

  toolTitle: {
    color: "#2A2720",
    fontSize: 16,
    fontWeight: "900",
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

  toolButton: {
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
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E7F0D6",
    borderWidth: 1,
    borderColor: "#C9DCB7",
  },

  infoButtonText: {
    color: "#4F6F52",
    fontSize: 15,
    fontWeight: "900",
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

  sectionCount: {
    color: "#287824",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 5,
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
    padding: 12,
    marginBottom: 10,
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
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 25,
    color: "#2A2720",
  },

  sceneMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 8,
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
    gap: 8,
    marginTop: 10,
    justifyContent: "flex-end",
    alignItems: "center",
  },

  sceneSoftButton: {
    backgroundColor: "#E7F0D6",
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 11,
    minWidth: 42,
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
