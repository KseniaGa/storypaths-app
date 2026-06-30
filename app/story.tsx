import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import { router, Stack } from 'expo-router';
import { useStoryStore } from '../store/storyStore';
import { Alert } from 'react-native';
import { useState, useRef } from 'react';

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

export default function StoryScreen() {
    const currentStory = useStoryStore((state) => state.getCurrentStory());
    const deleteScene = useStoryStore((state) => state.deleteScene);
    const toggleSceneDone = useStoryStore((state) => state.toggleSceneDone);
    const scenes = currentStory?.scenes || [];
    const title = currentStory?.title || 'Untitled story';
    const exportCurrentStory = useStoryStore((state) => state.exportCurrentStory);
    const exportCurrentStoryAsHtml = useStoryStore((state) => state.exportCurrentStoryAsHtml);
    const addStoryValue = useStoryStore((state) => state.addStoryValue);
    const deleteStoryValue = useStoryStore((state) => state.deleteStoryValue);
    const storyValues = currentStory?.storyValues || [];
    const setBackgroundMusic = useStoryStore((state) => state.setBackgroundMusic);
    const removeBackgroundMusic = useStoryStore((state) => state.removeBackgroundMusic);
    const backgroundMusic = currentStory?.backgroundMusic;
    

    const toggleShowSceneTitlesInPlay = useStoryStore(
  (state) => state.toggleShowSceneTitlesInPlay
);

const shareJson = async () => {
  const json = exportCurrentStory();

  if (!json) {
    Alert.alert('Share failed', 'No current story to share.');
    return;
  }

  try {
    const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'story'}.json`;
    const fileUri = FileSystem.documentDirectory + fileName;

    await FileSystem.writeAsStringAsync(fileUri, json, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const canShare = await Sharing.isAvailableAsync();

    if (!canShare) {
      Alert.alert('Export saved', `JSON saved to: ${fileUri}`);
      return;
    }

    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: 'Share story backup',
    });
  } catch (error) {
    console.error('JSON share error:', error);
    Alert.alert('Share failed', 'Could not create or share the JSON file.');
  }
};

const shareHtml = async () => {
  const html = await buildPortableHtml();

  if (!html) {
    Alert.alert('Share failed', 'No current story to share.');
    return;
  }

  try {
    const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'story'}.html`;
    const fileUri = FileSystem.documentDirectory + fileName;

    await FileSystem.writeAsStringAsync(fileUri, html, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const canShare = await Sharing.isAvailableAsync();

    if (!canShare) {
      Alert.alert('Export saved', `HTML saved to: ${fileUri}`);
      return;
    }

    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/html',
      dialogTitle: 'Share playable story',
    });
  } catch (error) {
    console.error('HTML share error:', error);
    Alert.alert('Share failed', 'Could not create or share the HTML file.');
  }
};

const openShareOptions = () => {
  Alert.alert(
    'Share story',
    'Choose how you want to share this story.',
    [
      {
        text: 'Playable HTML',
        onPress: shareHtml,
      },
      {
        text: 'Backup JSON',
        onPress: shareJson,
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]
  );
};

const showSceneTitlesInPlay = currentStory?.showSceneTitlesInPlay ?? true;

const [expandedSceneId, setExpandedSceneId] = useState<string | null>(null);
const [expandedDetailsSceneId, setExpandedDetailsSceneId] = useState<string | null>(null);
const [isStatusExpanded, setIsStatusExpanded] = useState(false);
const scrollRef = useRef<ScrollView | null>(null);

const [newValueName, setNewValueName] = useState('');
const [newValueInitial, setNewValueInitial] = useState('0');
const [newValueMin, setNewValueMin] = useState('0');
const [newValueMax, setNewValueMax] = useState('5');
const [newValueStep, setNewValueStep] = useState('1');

const [isValuesExpanded, setIsValuesExpanded] = useState(false);

const showBackgroundMusicInfo = () => {
  Alert.alert(
    'Background music',
    'Background music is one audio file that can play during the whole story in play mode. You can use it for music, atmosphere, or ambience.'
  );
};

const showStoryValueInfo = () => {
  Alert.alert(
    'Story value 🫐',
    'A story value keeps track of something that can increase or decrease, like coins, berries, trust, energy, hope, or suspicion.'
  );
};

const doneSceneCount = scenes.filter((scene) => scene.isDone).length;

const endingSceneCount = scenes.filter(
  (scene) => scene.choices.length === 0
).length;

const missingTargetCount = scenes.reduce((total, scene) => {
  return (
    total +
    scene.choices.filter((choice) => !choice.targetSceneId).length
  );
}, 0);

const mediaSceneCount = scenes.filter(
  (scene) => (scene.assets?.length || 0) > 0
).length;

const imageSceneCount = scenes.filter((scene) =>
  scene.assets?.some(
    (asset: any) => asset.type === 'image' && asset.alt !== 'Drawing'
  )
).length;

const audioSceneCount = scenes.filter((scene) =>
  scene.assets?.some((asset: any) => asset.type === 'audio')
).length;

const getSceneMissingTargetCount = (scene: any) =>
  scene.choices.filter((choice: any) => !choice.targetSceneId).length;

const getSceneImageCount = (scene: any) =>
  scene.assets?.filter(
    (asset: any) => asset.type === 'image' && asset.alt !== 'Drawing'
  ).length || 0;

const getSceneDrawingCount = (scene: any) =>
  scene.assets?.filter(
    (asset: any) => asset.type === 'image' && asset.alt === 'Drawing'
  ).length || 0;


  const drawingSceneCount = scenes.filter((scene) =>
  scene.assets?.some(
    (asset: any) => asset.type === 'image' && asset.alt === 'Drawing'
  )
).length;

const sceneHasAudio = (scene: any) =>
  scene.assets?.some((asset: any) => asset.type === 'audio') || false;

const getSceneInfoText = (scene: any, index: number) => {
  const parts: string[] = [];

  if (scene.isDone) {
    parts.push('Done');
  }

  if (index === 0) {
    parts.push('Start scene');
  }

  if (scene.choices.length === 0) {
    parts.push('Ending');
  }

  parts.push(
    `${scene.choices.length} ${scene.choices.length === 1 ? 'choice' : 'choices'}`
  );

  const imageCount = getSceneImageCount(scene);
  const drawingCount = getSceneDrawingCount(scene);

  if (imageCount > 0) {
    parts.push(`${imageCount} ${imageCount === 1 ? 'image' : 'images'}`);
  }

  if (drawingCount > 0) {
    parts.push(`${drawingCount} ${drawingCount === 1 ? 'drawing' : 'drawings'}`);
  }

  if (sceneHasAudio(scene)) {
    parts.push('audio');
  }

  return parts.join(' · ');
};

const getMimeTypeFromUri = (uri: string, type: 'image' | 'audio') => {
  const lower = uri.toLowerCase();

  if (type === 'image') {
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  }

  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.aac')) return 'audio/aac';
  if (lower.endsWith('.m4a')) return 'audio/mp4';

  return 'audio/mp4';
};


  const buildPortableHtml = async () => {
  if (!currentStory) return null;

  const scenesWithEmbeddedAssets = await Promise.all(
    currentStory.scenes.map(async (scene) => {
const embeddedAssets = await Promise.all(
  (scene.assets || []).map(async (asset) => {
    if (!asset.uri) return asset;

    if (asset.uri.startsWith('data:')) return asset;

    if (asset.type !== 'image' && asset.type !== 'audio') return asset;

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
      console.error('Could not embed asset:', asset.uri, error);
      return asset;
    }
  })
);

      return {
        ...scene,
        assets: embeddedAssets,
      };
    })
  );

  const portableStory = {
    ...currentStory,
    scenes: scenesWithEmbeddedAssets,
  };

  const storyJson = JSON.stringify(portableStory);

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
        <button class="restart" onclick="restartStory()">Restart</button>
      </div>

<div class="scene-heading-row">
  <h1 id="scene-title"></h1>
  <button id="audio-button" class="audio-button" onclick="toggleAudio()" style="display:none;">🎧</button>
</div>

<img id="scene-image" class="scene-image" style="display:none;" />
<audio id="scene-audio"></audio>
<div id="scene-text" class="scene-text"></div>
<div id="choices" class="choices"></div>
<div id="empty" class="empty" style="display:none;"></div>
    </div>
  </div>

  <script>
    const story = ${storyJson};
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
    Alert.alert('Name needed', 'Please name what can change, for example Curiosity.');
    return;
  }

  const initialValue = parseNumberOrDefault(newValueInitial, 0);
  const minValue = parseNumberOrDefault(newValueMin, 0);
  const maxValue = parseNumberOrDefault(newValueMax, 5);
  const step = Math.abs(parseNumberOrDefault(newValueStep, 1)) || 1;

  if (minValue > maxValue) {
    Alert.alert('Check range', 'Minimum should be smaller than maximum.');
    return;
  }

  if (initialValue < minValue || initialValue > maxValue) {
    Alert.alert('Check start value', 'The start value should be inside the minimum and maximum range.');
    return;
  }

  addStoryValue({
    name,
    initialValue,
    minValue,
    maxValue,
    step,
  });

  setNewValueName('');
  setNewValueInitial('0');
  setNewValueMin('0');
  setNewValueMax('5');
  setNewValueStep('1');
};

const chooseBackgroundMusic = async () => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const pickedFile = result.assets[0];

    const safeName =
      pickedFile.name?.replace(/[^a-z0-9._-]/gi, '_') ||
      `background-music-${Date.now()}.mp3`;

    const destinationUri =
      FileSystem.documentDirectory + `background-music-${Date.now()}-${safeName}`;

    await FileSystem.copyAsync({
      from: pickedFile.uri,
      to: destinationUri,
    });

    setBackgroundMusic({
      uri: destinationUri,
      name: pickedFile.name || 'Background music',
    });
  } catch (error) {
    console.error('Background music picker error:', error);
    Alert.alert('Could not add music', 'Please try choosing another audio file.');
  }
};


return (
  <>
    <Stack.Screen options={{ headerShown: false }} />

    <ScrollView
  ref={scrollRef}
  style={{ flex: 1 }}
  contentContainerStyle={styles.container}
>


<Pressable
  style={styles.homePill}
  onPress={() => router.replace('/')}
>
  <Text style={styles.homePillText}>← Home</Text>
</Pressable>

<Text style={styles.title}>{title || 'Untitled story'}</Text>

<Pressable
  style={styles.compactStatusButton}
  onPress={() => setIsStatusExpanded(!isStatusExpanded)}
>
  <Text style={styles.compactStatusText}>
    {scenes.length} {scenes.length === 1 ? 'scene' : 'scenes'}{' '}
    {missingTargetCount > 0
      ? ` · ⚠️ ${missingTargetCount} missing ${missingTargetCount === 1 ? 'path' : 'paths'}`
      : ''}
    {' '}
    {isStatusExpanded ? '⌃' : '⌄'}
  </Text>
</Pressable>

{isStatusExpanded && (
  <View style={styles.expandedStatusBox}>
    <Text style={styles.expandedStatusTitle}>Story status</Text>

    <View style={styles.summaryGrid}>
      <Text style={styles.summaryChip}>
        {scenes.length} {scenes.length === 1 ? 'scene' : 'scenes'}
      </Text>

      <Text style={styles.summaryChip}>
        {doneSceneCount} done
      </Text>

      <Text style={styles.summaryChip}>
        {endingSceneCount} {endingSceneCount === 1 ? 'ending' : 'endings'}
      </Text>

      <Text
        style={[
          styles.summaryChip,
          missingTargetCount > 0 && styles.summaryChipWarning,
        ]}
      >
        {missingTargetCount} missing {missingTargetCount === 1 ? 'path' : 'paths'}
      </Text>

      {imageSceneCount > 0 && (
        <Text style={styles.summaryChip}>🖼️ {imageSceneCount}</Text>
      )}

      {audioSceneCount > 0 && (
        <Text style={styles.summaryChip}>🎧 {audioSceneCount}</Text>
      )}

      {drawingSceneCount > 0 && (
        <Text style={styles.summaryChip}>✏️ {drawingSceneCount}</Text>
      )}
    </View>
  </View>
)}

<View style={styles.mainActionStack}>
  <Pressable
    style={styles.fullWidthPrimaryButton}
    onPress={() =>
      router.push({
        pathname: '/scene-editor',
        params: { storyTitle: title },
      })
    }
  >
    <Text style={styles.primaryActionText}>+ Add scene</Text>
  </Pressable>

  <Pressable
    style={styles.fullWidthSecondaryButton}
    onPress={() => router.push('/play')}
  >
    <Text style={styles.secondaryActionText}>▶ Play Story</Text>
  </Pressable>
</View>

<View style={styles.backgroundMusicCard}>
  <View style={styles.titleWithInfo}>
  <Text style={styles.sectionTitle}>Background music 🎵</Text>

  <Pressable style={styles.infoButton} onPress={showBackgroundMusicInfo}>
    <Text style={styles.infoButtonText}>ⓘ</Text>
  </Pressable>
</View>

  {backgroundMusic ? (
    <Text style={styles.backgroundMusicFile} numberOfLines={1}>
      Selected: {backgroundMusic.name || 'Background music'}
    </Text>
  ) : (
    <Text style={styles.backgroundMusicEmpty}>
      No background music added yet.
    </Text>
  )}

  <View style={styles.backgroundMusicButtonRow}>
    <Pressable
      style={styles.backgroundMusicButton}
      onPress={chooseBackgroundMusic}
    >
      <Text style={styles.backgroundMusicButtonText}>
        {backgroundMusic ? 'Change music' : 'Add music'}
      </Text>
    </Pressable>

    {backgroundMusic && (
      <Pressable
        style={styles.backgroundMusicRemoveButton}
        onPress={removeBackgroundMusic}
      >
        <Text style={styles.backgroundMusicRemoveText}>Remove</Text>
      </Pressable>
    )}
  </View>
</View>


<View style={styles.valuesCard}>
  <View style={styles.valuesHeaderRow}>
  <View style={styles.valuesTitleArea}>
    <Text style={styles.sectionTitle}>Optional: story values</Text>

    <Pressable style={styles.infoButton} onPress={showStoryValueInfo}>
      <Text style={styles.infoButtonText}>ⓘ</Text>
    </Pressable>
  </View>

  <Pressable
    style={styles.valuesToggleButton}
    onPress={() => setIsValuesExpanded(!isValuesExpanded)}
  >
    <Text style={styles.valuesToggleText}>
      {isValuesExpanded ? 'Hide' : 'Show'}
    </Text>
  </Pressable>
</View>

  {isValuesExpanded && (
    <>
      <Text style={styles.valuesDescription}>
  Story values are things the player can collect more or less of. Use them for things like berries, coins, trust, energy, hope, or suspicion.
</Text>

  {storyValues.length > 0 ? (
    storyValues.map((value) => (
      <View key={value.id} style={styles.valueDefinitionCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.valueDefinitionName}>{value.name}</Text>
          <Text style={styles.valueDefinitionMeta}>
            Starts at {value.initialValue} · Range {value.minValue}–{value.maxValue} · Changes by {value.step}
          </Text>
        </View>

        <Pressable
          style={styles.valueDeleteButton}
          onPress={() => {
            Alert.alert(
              'Delete this?',
              `Delete ${value.name}? This will also remove choice rules that use it.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => deleteStoryValue(value.id),
                },
              ]
            );
          }}
        >
          <Text style={styles.valueDeleteText}>✕</Text>
        </Pressable>
      </View>
    ))
  ) : (
    <Text style={styles.valuesEmptyText}>
      Nothing added yet. You can skip this for simple stories.
    </Text>
  )}

  <View style={styles.addValueBox}>
    <Text style={styles.addValueTitle}>Add a story value 🫐</Text>

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
      <Text style={styles.addValueButtonText}>Add</Text>
    </Pressable>
  </View>

      </>
  )}
</View>


<View style={styles.sectionHeaderRow}>
  <Text style={styles.sectionTitle}>Scenes 🌿</Text>
  <Text style={styles.sectionCount}>
    {scenes.length} total
  </Text>
</View>

{scenes.length === 0 && (
  <View style={styles.emptyStateCard}>
    <Text style={styles.emptyStateTitle}>No scenes yet</Text>
    <Text style={styles.emptyStateText}>
      Add your first scene to begin shaping this story.
    </Text>
  </View>
)}

{scenes.map((scene, index) => (
  <View
    key={scene.id}
    style={[
      styles.sceneCard,
      scene.isDone && styles.sceneCardDone,
    ]}
  >
<View style={styles.sceneCardHeader}>
  <Text style={styles.sceneTitle} numberOfLines={2}>
    {scene.title || 'Untitled scene'}
  </Text>
</View>

      <Text style={styles.scenePreview} numberOfLines={2}>
        {scene.text || 'No scene text yet.'}
      </Text>


<View style={styles.sceneActionRow}>
  <Pressable
    style={styles.editSceneButton}
    onPress={() =>
      router.push({
        pathname: '/scene-editor',
        params: {
          sceneId: scene.id,
        },
      })
    }
  >
    <Text style={styles.editSceneButtonText}>Edit</Text>
  </Pressable>

  <Pressable
    style={styles.previewSceneButton}
    onPress={() => {
      router.push({
        pathname: '/play',
        params: {
          startSceneId: scene.id,
          preview: 'true',
        },
      });
    }}
  >
    <Text style={styles.previewSceneButtonText}>Play Preview</Text>
  </Pressable>
</View>

<View style={styles.sceneDropdownRow}>
  {scene.choices.length > 0 && (
    <Pressable
      style={styles.linkToggleButton}
      onPress={() => {
        setExpandedSceneId(
          expandedSceneId === scene.id ? null : scene.id
        );
      }}
    >
      <Text style={styles.linkToggleText}>
        {expandedSceneId === scene.id ? 'Hide paths ➡️' : 'Show paths ➡️'}
      </Text>
    </Pressable>
  )}

  <Pressable
    style={styles.linkToggleButton}
    onPress={() => {
      setExpandedDetailsSceneId(
        expandedDetailsSceneId === scene.id ? null : scene.id
      );
    }}
  >
    <Text style={styles.linkToggleText}>
      {expandedDetailsSceneId === scene.id ? 'Hide details' : 'Show details'}
    </Text>
  </Pressable>
</View>

{expandedDetailsSceneId === scene.id && (
  <View style={styles.sceneDetailsBox}>
    <Text style={styles.sceneDetailsTitle}>Details</Text>

    <Text style={styles.sceneDetailsText}>
      {getSceneInfoText(scene, index)}
    </Text>

    {getSceneMissingTargetCount(scene) > 0 && (
      <Text style={styles.sceneWarningText}>
        ⚠️ {getSceneMissingTargetCount(scene)} missing{' '}
        {getSceneMissingTargetCount(scene) === 1 ? 'path' : 'paths'}
      </Text>
    )}

    <View style={styles.sceneDetailsActionRow}>
      <Pressable
        style={[
          styles.doneButton,
          scene.isDone && styles.doneButtonActive,
        ]}
        onPress={() => toggleSceneDone(scene.id)}
      >
        <Text
          style={[
            styles.doneButtonText,
            scene.isDone && styles.doneButtonTextActive,
          ]}
        >
          {scene.isDone ? 'Mark unfinished' : 'Mark done'}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => {
          Alert.alert(
            'Delete scene?',
            `This will delete "${scene.title || 'Untitled scene'}" and remove paths pointing to it.`,
            [
              {
                text: 'Cancel',
                style: 'cancel',
              },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => deleteScene(scene.id),
              },
            ]
          );
        }}
        style={styles.deleteSceneTextButton}
      >
        <Text style={styles.deleteSceneText}>Delete scene</Text>
      </Pressable>
    </View>
  </View>
)}

{scene.choices.length > 0 && expandedSceneId === scene.id && (
  <View style={styles.choiceOverviewBox}>
    <Text style={styles.choiceOverviewTitle}>Choice → Scene </Text>

    {scene.choices.map((choice, choiceIndex) => {
      const targetScene = choice.targetSceneId
        ? scenes.find((target) => target.id === choice.targetSceneId)
        : undefined;

      return (
        <Text
          key={choice.id || choiceIndex}
          style={styles.choiceOverviewText}
        >
          {choice.label || '(empty choice)'} →{' '}
          {targetScene?.title || 'No scene selected'}
        </Text>
      );
    })}
  </View>

)}


    </View>

  
      ))}




<View style={styles.shareSettingsCard}>
  <Text style={styles.sectionTitle}>Share and Settings</Text>

  <View style={styles.shareSettingsRow}>
    <View style={{ flex: 1 }}>
      <Text style={styles.compactSettingTitle}>
        Scene titles in play mode
      </Text>

      <Text style={styles.compactSettingText}>
        {showSceneTitlesInPlay ? 'Visible' : 'Hidden'}
      </Text>
    </View>

    <Pressable
      style={styles.compactSettingButton}
      onPress={toggleShowSceneTitlesInPlay}
    >
      <Text style={styles.compactSettingButtonText}>
        {showSceneTitlesInPlay ? 'Hide' : 'Show'}
      </Text>
    </Pressable>
  </View>

  <Pressable
    style={styles.shareSettingsButton}
    onPress={openShareOptions}
  >
    <Text style={styles.shareSettingsButtonText}>Share / export</Text>
  </Pressable>
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
  </>
);
}


const styles = StyleSheet.create({

  container: {
  padding: 24,
  paddingBottom: 100,
  backgroundColor: '#f6f6f6',
},

valuesHeaderRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
},

valuesTitleArea: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
},

valuesToggleButton: {
  flexShrink: 0,
  paddingVertical: 8,
  paddingHorizontal: 18,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: '#ddd',
  backgroundColor: '#fff',
},


sectionTitleWithInfo: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
},

titleWithInfo: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
  justifyContent: 'space-between',
},

infoButton: {
  width: 28,
  height: 28,
  borderRadius: 999,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#EEF5EA',
  borderWidth: 1,
  borderColor: '#D6E5D0',
},

infoButtonText: {
  color: '#4F6F52',
  fontSize: 16,
  fontWeight: '800',
},

backgroundMusicCard: {
  backgroundColor: '#fff',
  borderRadius: 18,
  padding: 18,
  marginBottom: 26,
  borderWidth: 1,
  borderColor: '#eee',
},

backgroundMusicText: {
  color: '#666',
  lineHeight: 20,
  marginTop: 6,
  marginBottom: 10,
},

backgroundMusicFile: {
  color: '#333',
  fontSize: 14,
  fontWeight: '700',
  marginBottom: 12,
},

backgroundMusicEmpty: {
  color: '#777',
  fontSize: 14,
  marginBottom: 12,
  fontStyle: 'italic',
},

backgroundMusicButtonRow: {
  flexDirection: 'row',
  gap: 10,
  flexWrap: 'wrap',
},

backgroundMusicButton: {
  backgroundColor: '#222',
  paddingVertical: 12,
  paddingHorizontal: 16,
  borderRadius: 12,
},

backgroundMusicButtonText: {
  color: '#fff',
  fontSize: 15,
  fontWeight: '700',
},

backgroundMusicRemoveButton: {
  backgroundColor: '#fff',
  paddingVertical: 12,
  paddingHorizontal: 16,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: '#ddd',
},

backgroundMusicRemoveText: {
  color: '#777',
  fontSize: 15,
  fontWeight: '700',
},

sceneDropdownRow: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 12,
},

sceneDetailsBox: {
  marginTop: 10,
  padding: 12,
  borderRadius: 14,
  backgroundColor: '#fafafa',
  borderWidth: 1,
  borderColor: '#eee',
},

sceneDetailsTitle: {
  fontSize: 12,
  color: '#888',
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  marginBottom: 6,
},

sceneDetailsText: {
  color: '#666',
  fontSize: 14,
  lineHeight: 20,
},

sceneDetailsActionRow: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 10,
  marginTop: 12,
  alignItems: 'center',
},

sceneInfoText: {
  color: '#777',
  fontSize: 14,
  lineHeight: 20,
  marginTop: 4,
  marginBottom: 8,
},

sceneWarningText: {
  color: '#9a5a00',
  fontSize: 14,
  fontWeight: '700',
  lineHeight: 20,
  marginBottom: 8,
},

sceneCardHeader: {
  marginBottom: 8,
},

sceneTitle: {
  fontSize: 21,
  fontWeight: '700',
  lineHeight: 27,
  color: '#111',
},

sceneActionRow: {
  flexDirection: 'row',
  gap: 10,
  marginTop: 14,
  flexWrap: 'wrap',
  alignItems: 'center',
},

editSceneButton: {
  paddingVertical: 11,
  paddingHorizontal: 20,
  borderRadius: 999,
  backgroundColor: '#222',
},

editSceneButtonText: {
  color: '#fff',
  fontSize: 15,
  fontWeight: '700',
},

previewSceneButton: {
  paddingVertical: 11,
  paddingHorizontal: 18,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: '#ccc',
  backgroundColor: '#fff',
},

previewSceneButtonText: {
  color: '#333',
  fontSize: 15,
  fontWeight: '700',
},

sceneSecondaryActionRow: {
  flexDirection: 'row',
  gap: 10,
  marginTop: 10,
  flexWrap: 'wrap',
  alignItems: 'center',
},

doneButton: {
  paddingVertical: 8,
  paddingHorizontal: 12,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: '#ccc',
  alignSelf: 'flex-start',
  backgroundColor: '#fff',
},

deleteSceneTextButton: {
  paddingVertical: 8,
  paddingHorizontal: 4,
},

deleteSceneText: {
  color: '#999',
  fontSize: 13,
  fontWeight: '600',
},

sceneCard: {
  borderWidth: 1,
  borderColor: '#ddd',
  borderRadius: 18,
  padding: 18,
  marginBottom: 14,
  width: '100%',
  backgroundColor: '#fff',
},


sceneHeaderActions: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
  marginLeft: 10,
},

editScenePill: {
  paddingVertical: 8,
  paddingHorizontal: 14,
  borderRadius: 999,
  backgroundColor: '#222',
},

editScenePillText: {
  color: '#fff',
  fontWeight: '700',
  fontSize: 14,
},

doneBadgeInRow: {
  color: '#1f8f3a',
  backgroundColor: '#dcf8e4',
},

valuesCollapsedText: {
  color: '#666',
  lineHeight: 20,
  marginTop: 6,
},

valuesToggleText: {
  color: '#007AFF',
  fontWeight: '700',
  fontSize: 14,
},

valuesCard: {
  backgroundColor: '#fff',
  borderRadius: 18,
  padding: 18,
  marginBottom: 26,
  borderWidth: 1,
  borderColor: '#eee',
},

valuesDescription: {
  color: '#666',
  lineHeight: 20,
  marginTop: 8,
  marginBottom: 14,
},

valuesEmptyText: {
  color: '#777',
  lineHeight: 20,
  marginBottom: 14,
},

valueDefinitionCard: {
  flexDirection: 'row',
  alignItems: 'center',
  borderWidth: 1,
  borderColor: '#eee',
  borderRadius: 14,
  padding: 14,
  marginBottom: 10,
  backgroundColor: '#fafafa',
},

valueDefinitionName: {
  fontSize: 16,
  fontWeight: '700',
  marginBottom: 4,
},

valueDefinitionMeta: {
  color: '#666',
  lineHeight: 20,
},

valueDeleteButton: {
  padding: 8,
  marginLeft: 8,
},

valueDeleteText: {
  color: '#ff3b30',
  fontSize: 18,
  fontWeight: '700',
},

addValueBox: {
  borderWidth: 1,
  borderColor: '#e5e5e5',
  borderStyle: 'dashed',
  borderRadius: 16,
  padding: 14,
  marginTop: 6,
},

addValueTitle: {
  fontSize: 15,
  fontWeight: '700',
  marginBottom: 10,
},

valueTextInput: {
  borderWidth: 1,
  borderColor: '#ddd',
  borderRadius: 12,
  padding: 12,
  backgroundColor: '#fff',
  marginBottom: 10,
},

valueNumberGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 8,
  marginBottom: 12,
},

valueNumberField: {
  flexGrow: 1,
  minWidth: '22%',
},

valueSmallLabel: {
  color: '#666',
  fontSize: 12,
  marginBottom: 4,
},

valueNumberInput: {
  borderWidth: 1,
  borderColor: '#ddd',
  borderRadius: 10,
  padding: 10,
  backgroundColor: '#fff',
},

addValueButton: {
  backgroundColor: '#222',
  borderRadius: 12,
  paddingVertical: 12,
  alignItems: 'center',
},

addValueButtonDisabled: {
  opacity: 0.5,
},

addValueButtonText: {
  color: '#fff',
  fontWeight: '700',
},

compactStatusButton: {
  alignSelf: 'flex-start',
  marginTop: 10,
  marginBottom: 18,
  paddingVertical: 8,
  paddingHorizontal: 12,
  borderRadius: 999,
  backgroundColor: '#fff',
  borderWidth: 1,
  borderColor: '#e5e5e5',
},

compactStatusText: {
  color: '#555',
  fontSize: 14,
  fontWeight: '600',
},

expandedStatusBox: {
  backgroundColor: '#fff',
  borderRadius: 16,
  padding: 14,
  marginBottom: 18,
  borderWidth: 1,
  borderColor: '#eee',
},

expandedStatusTitle: {
  fontSize: 14,
  fontWeight: '700',
  marginBottom: 10,
  color: '#333',
},

mainActionStack: {
  gap: 10,
  marginBottom: 26,
},

fullWidthPrimaryButton: {
  backgroundColor: '#222',
  paddingVertical: 15,
  paddingHorizontal: 16,
  borderRadius: 14,
  alignItems: 'center',
},

fullWidthSecondaryButton: {
  backgroundColor: '#fff',
  paddingVertical: 15,
  paddingHorizontal: 16,
  borderRadius: 14,
  alignItems: 'center',
  borderWidth: 1,
  borderColor: '#ccc',
},

statusGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 18,
  marginBottom: 18,
},

summaryChipGood: {
  color: '#1f7a3a',
  backgroundColor: '#eaf8ee',
  borderColor: '#ccefd5',
},

shareSettingsCard: {
  backgroundColor: '#fff',
  borderRadius: 18,
  padding: 18,
  marginTop: 8,
  marginBottom: 16,
  borderWidth: 1,
  borderColor: '#eee',
},

shareSettingsRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
  paddingVertical: 14,
  borderBottomWidth: 1,
  borderBottomColor: '#eee',
  marginBottom: 14,
},

shareSettingsButton: {
  backgroundColor: '#fafafa',
  paddingVertical: 14,
  paddingHorizontal: 16,
  borderRadius: 12,
  alignItems: 'center',
  borderWidth: 1,
  borderColor: '#ddd',
},

shareSettingsButtonText: {
  color: '#333',
  fontSize: 16,
  fontWeight: '700',
},

backToTopButton: {
  alignSelf: 'center',
  paddingVertical: 10,
  paddingHorizontal: 16,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: '#ddd',
  backgroundColor: '#fff',
  marginBottom: 24,
},

backToTopButtonText: {
  color: '#333',
  fontSize: 14,
  fontWeight: '700',
},

homePill: {
  alignSelf: 'flex-start',
  paddingVertical: 8,
  paddingHorizontal: 14,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: '#ddd',
  marginBottom: 22,
  backgroundColor: '#fff',
},

homePillText: {
  color: '#333',
  fontSize: 14,
  fontWeight: '600',
},

title: {
  fontSize: 38,
  fontWeight: '700',
  lineHeight: 44,
},

storySubtitle: {
  color: '#666',
  fontSize: 16,
  marginTop: 6,
  marginBottom: 18,
},

dashboardCard: {
  backgroundColor: '#fff',
  borderRadius: 18,
  padding: 16,
  marginBottom: 14,
  borderWidth: 1,
  borderColor: '#eee',
},

actionRow: {
  flexDirection: 'row',
  gap: 10,
  marginBottom: 14,
},

summaryGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 8,
},

playSettingCard: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#fff',
  borderRadius: 18,
  padding: 16,
  marginBottom: 26,
  borderWidth: 1,
  borderColor: '#eee',
  gap: 12,
},

  subtitle: {
    color: '#666',
    marginBottom: 24,
  },


scenePreview: {
  color: '#555',
  lineHeight: 20,
  marginBottom: 8,
},

sceneMeta: {
  color: '#888',
  fontSize: 13,
},

deleteButton: {
  paddingVertical: 6,
  paddingHorizontal: 10,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: '#eee',
  backgroundColor: '#fafafa',
},

deleteText: {
  color: '#777',
  fontWeight: '700',
  fontSize: 13,
},



settingText: {
  color: '#666',
  marginBottom: 10,
},

sceneCardDone: {
  borderColor: '#34C759',
  backgroundColor: '#f4fff6',
},

sceneTitleRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  flex: 1,
},

doneBadge: {
  color: '#1f8f3a',
  fontSize: 12,
  fontWeight: '700',
  backgroundColor: '#dcf8e4',
  paddingHorizontal: 8,
  paddingVertical: 3,
  borderRadius: 999,
},


doneButtonActive: {
  borderColor: '#34C759',
  backgroundColor: '#e8f8ed',
},

doneButtonText: {
  color: '#444',
  fontSize: 13,
  fontWeight: '600',
},

doneButtonTextActive: {
  color: '#1f8f3a',
},

choiceOverviewBox: {
  marginTop: 10,
  paddingTop: 10,
  borderTopWidth: 1,
  borderTopColor: '#eee',
},

choiceOverviewTitle: {
  fontSize: 12,
  color: '#888',
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  marginBottom: 6,
},

choiceOverviewText: {
  color: '#555',
  fontSize: 13,
  lineHeight: 20,
},

headerSection: {
  marginTop: 10,
  marginBottom: 18,
},

homeButton: {
  alignSelf: 'flex-start',
  paddingVertical: 8,
  paddingHorizontal: 12,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: '#ddd',
  marginBottom: 10,
  backgroundColor: '#fff',
},

homeButtonText: {
  color: '#333',
  fontSize: 15,
  fontWeight: '600',
},

summaryBox: {
  borderWidth: 1,
  borderColor: '#eee',
  borderRadius: 12,
  padding: 14,
  marginBottom: 18,
  backgroundColor: '#fafafa',
},

summaryChip: {
  fontSize: 13,
  fontWeight: '600',
  color: '#555',
  backgroundColor: '#fff',
  borderWidth: 1,
  borderColor: '#e5e5e5',
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRadius: 999,
},

summaryChipWarning: {
  color: '#9a5a00',
  backgroundColor: '#fff3d6',
  borderColor: '#ffe0a3',
},

badgeRow: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 8,
  marginBottom: 8,
},

badge: {
  fontSize: 12,
  fontWeight: '700',
  color: '#555',
  backgroundColor: '#f1f1f1',
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 999,
},

warningBadge: {
  color: '#9a5a00',
  backgroundColor: '#fff3d6',
},


primaryActionButton: {
  flex: 1,
  backgroundColor: '#222',
  paddingVertical: 14,
  paddingHorizontal: 16,
  borderRadius: 12,
  alignItems: 'center',
},

primaryActionText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '700',
},

secondaryActionButton: {
  flex: 1,
  backgroundColor: '#fff',
  paddingVertical: 14,
  paddingHorizontal: 16,
  borderRadius: 12,
  alignItems: 'center',
  borderWidth: 1,
  borderColor: '#ccc',
},

secondaryActionText: {
  color: '#333',
  fontSize: 16,
  fontWeight: '700',
},

compactSettingRow: {
  flexDirection: 'row',
  alignItems: 'center',
  borderWidth: 1,
  borderColor: '#eee',
  borderRadius: 12,
  padding: 14,
  marginBottom: 18,
  backgroundColor: '#fafafa',
  gap: 12,
},

compactSettingTitle: {
  fontSize: 13,
  fontWeight: '700',
  color: '#444',
  marginBottom: 2,
},

compactSettingText: {
  fontSize: 13,
  color: '#666',
},

compactSettingButton: {
  paddingVertical: 8,
  paddingHorizontal: 14,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: '#ccc',
  backgroundColor: '#fff',
},

compactSettingButtonText: {
  fontSize: 13,
  fontWeight: '700',
  color: '#333',
},

linkToggleButton: {
  alignSelf: 'flex-start',
  marginTop: 8,
  marginBottom: 4,
  paddingVertical: 6,
  paddingHorizontal: 10,
  borderRadius: 999,
  backgroundColor: '#f5f5f5',
},

linkToggleText: {
  fontSize: 13,
  fontWeight: '700',
  color: '#555',
},

shareButton: {
  backgroundColor: '#fff',
  paddingVertical: 14,
  paddingHorizontal: 20,
  borderRadius: 12,
  alignItems: 'center',
  marginTop: 20,
  borderWidth: 1,
  borderColor: '#ccc',
},

shareButtonText: {
  color: '#333',
  fontSize: 16,
  fontWeight: '700',
},


storyHeroCard: {
  backgroundColor: '#fff',
  borderRadius: 18,
  padding: 18,
  marginBottom: 22,
  borderWidth: 1,
  borderColor: '#eee',
},




playSettingTitle: {
  fontSize: 14,
  fontWeight: '700',
  color: '#333',
  marginBottom: 3,
},

sectionHeaderRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 10,
},

sectionTitle: {
  fontSize: 20,
  fontWeight: '700',
},

sectionCount: {
  color: '#777',
  fontSize: 13,
  fontWeight: '600',
},

emptyStateCard: {
  backgroundColor: '#fff',
  borderRadius: 16,
  padding: 16,
  marginBottom: 18,
  borderWidth: 1,
  borderColor: '#eee',
},

emptyStateTitle: {
  fontSize: 16,
  fontWeight: '700',
  marginBottom: 4,
},

emptyStateText: {
  color: '#666',
  lineHeight: 20,
},

exportCard: {
  backgroundColor: '#fff',
  borderRadius: 18,
  padding: 18,
  marginTop: 8,
  marginBottom: 30,
  borderWidth: 1,
  borderColor: '#eee',
},

exportDescription: {
  color: '#666',
  lineHeight: 20,
  marginTop: 8,
  marginBottom: 14,
},

exportButton: {
  backgroundColor: '#fafafa',
  paddingVertical: 14,
  paddingHorizontal: 16,
  borderRadius: 12,
  alignItems: 'center',
  borderWidth: 1,
  borderColor: '#ddd',
},

exportButtonText: {
  color: '#333',
  fontSize: 16,
  fontWeight: '700',
},


});