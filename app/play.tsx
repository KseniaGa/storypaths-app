import { View, Text, StyleSheet, Pressable, Image, ScrollView } from 'react-native';
import { useState, useEffect  } from 'react';
import { useStoryStore } from '../store/storyStore';
import { useLocalSearchParams, router } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

export default function PlayScreen() {
  const currentStory = useStoryStore((state) => state.getCurrentStory());
  const title = currentStory?.title || 'Untitled story';
  const scenes = currentStory?.scenes || [];

  const { startSceneId, preview } = useLocalSearchParams();

const startingSceneId =
  typeof startSceneId === 'string' ? startSceneId : undefined;

const isPreviewMode = preview === 'true';

  const showSceneTitlesInPlay = currentStory?.showSceneTitlesInPlay ?? true;
  const storyValueDefinitions = currentStory?.storyValues || [];
  const backgroundMusic = currentStory?.backgroundMusic;

  const [currentSceneId, setCurrentSceneId] = useState<string | undefined>(undefined);

  const [visitedSceneIds, setVisitedSceneIds] = useState<string[]>([]);
const [chosenChoiceIds, setChosenChoiceIds] = useState<string[]>([]);

const [activeTraces, setActiveTraces] = useState<string[]>([]);
const [storyValues, setStoryValues] = useState<Record<string, number>>({});

useEffect(() => {
  setChosenChoiceIds([]);
  setActiveTraces([]);
  setVisitedSceneIds([]);
  setStoryValues(createInitialStoryValues());

  if (
    startingSceneId &&
    scenes.some((scene) => scene.id === startingSceneId)
  ) {
    setCurrentSceneId(startingSceneId);
    return;
  }

  setCurrentSceneId(scenes[0]?.id);
}, [currentStory?.id, startingSceneId]);


useEffect(() => {
  if (!currentSceneId) return;

  setVisitedSceneIds((previousIds) =>
    previousIds.includes(currentSceneId)
      ? previousIds
      : [...previousIds, currentSceneId]
  );
}, [currentSceneId]);

const normalizeTrace = (trace: string) =>
  trace.trim().toLowerCase().replace(/\s+/g, '_');

const normalizeStoryValueName = (name: string) =>
  name.trim().toLowerCase().replace(/\s+/g, '_');

const createInitialStoryValues = () =>
  Object.fromEntries(
    storyValueDefinitions.map((storyValue) => [
      storyValue.id,
      storyValue.initialValue ?? 0,
    ])
  );

const findStoryValueDefinition = (
  value?: { valueId?: string; name?: string }
) =>
  storyValueDefinitions.find(
    (storyValue) =>
      storyValue.id === value?.valueId || storyValue.name === value?.name
  );

const getStoryValueKey = (value?: { valueId?: string; name?: string }) => {
  if (value?.valueId) {
    return value.valueId;
  }

  if (value?.name?.trim()) {
    const matchingDefinition = findStoryValueDefinition(value);

    return matchingDefinition?.id || normalizeStoryValueName(value.name);
  }

  return undefined;
};

const clampNumber = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const doesStoryValuePass = (requiredValue: any) => {
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
};

const formatStoryValuesForDebug = () => {
  const entries = Object.entries(storyValues);

  if (entries.length === 0) {
    return 'none';
  }

  return entries
    .map(([key, value]) => {
      const storyValueDefinition = storyValueDefinitions.find(
        (storyValue) => storyValue.id === key
      );

      return `${storyValueDefinition?.name || key}: ${value}`;
    })
    .join(', ');
};

  const currentScene = scenes.find((scene) => scene.id === currentSceneId);

  const audioAsset = currentScene?.assets?.find(
  (asset) => asset.type === 'audio'
);

const player = useAudioPlayer(audioAsset?.uri ?? null);
const audioStatus = useAudioPlayerStatus(player);

const backgroundPlayer = useAudioPlayer(backgroundMusic?.uri ?? null);
const backgroundStatus = useAudioPlayerStatus(backgroundPlayer);

useEffect(() => {
  return () => {
    if (backgroundStatus.playing) {
      backgroundPlayer.pause();
    }
  };
}, [backgroundPlayer, backgroundStatus.playing]);

const stopSceneAudio = () => {
  if (audioStatus.playing) {
    player.pause();
  }
};

const stopAllAudio = () => {
  if (audioStatus.playing) {
    player.pause();
  }

  if (backgroundStatus.playing) {
    backgroundPlayer.pause();
  }
};

const restartSceneId =
  isPreviewMode && startingSceneId ? startingSceneId : scenes[0]?.id;

  if (!currentScene) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Play story 🎮</Text>
        <Text style={styles.empty}>No scenes to play yet.</Text>
      </View>
    );
  }

  const imageAssets = currentScene.assets?.filter(
  (asset) => asset.type === 'image'
) || [];

const getChoiceId = (sceneId: string, choice: any, index: number) =>
  choice.id || `${sceneId}-choice-${index}`;


const visibleChoices = currentScene.choices.filter((choice) => {
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

return (
  <ScrollView contentContainerStyle={styles.container}>
    <Pressable
      style={styles.backButton}
      onPress={() => {
        stopAllAudio();
        router.replace('/story');
      }}
    >
      <Text style={styles.backButtonText}>
        {isPreviewMode ? '← Back to story' : '🏠 Story home'}
      </Text>
    </Pressable>

    <View style={styles.playHeroCard}>
      <Text style={styles.storyTitle}>Playing</Text>
      <Text style={styles.playHeroTitle}>{title || 'Untitled story'}</Text>
      {isPreviewMode && <Text style={styles.previewBadge}>Preview mode</Text>}
    </View>

    {backgroundMusic && (
  <Pressable
    style={[
      styles.backgroundMusicPlayButton,
      backgroundStatus.playing && styles.backgroundMusicPlayButtonActive,
    ]}
    onPress={() => {
      if (backgroundStatus.playing) {
        backgroundPlayer.pause();
      } else {
        backgroundPlayer.play();
      }
    }}
  >
    <Text
      style={[
        styles.backgroundMusicPlayText,
        backgroundStatus.playing && styles.backgroundMusicPlayTextActive,
      ]}
    >
      {backgroundStatus.playing ? '⏸ Pause background music' : '🎵 Play background music'}
    </Text>
  </Pressable>
)}

{(showSceneTitlesInPlay || audioAsset) && (
  <View style={styles.sceneHeaderRow}>
    {showSceneTitlesInPlay ? (
      <Text style={styles.heading}>{currentScene.title}</Text>
    ) : (
      <View style={{ flex: 1 }} />
    )}

    {audioAsset && (
      <Pressable
        style={[
          styles.audioIconButton,
          audioStatus.playing && styles.audioIconButtonActive,
        ]}
        accessibilityLabel={
          audioStatus.playing ? 'Pause scene audio' : 'Listen to scene audio'
        }
        onPress={() => {
          if (audioStatus.playing) {
            player.pause();
          } else {
            player.play();
          }
        }}
      >
        <Text style={styles.audioIconText}>
          {audioStatus.playing ? '⏸️' : '🎧'}
        </Text>
      </Pressable>
    )}
  </View>
)}

{imageAssets.length > 0 ? (
  <View
    style={{
      height: 260,
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 16,
      backgroundColor: '#FFFCF2',
    }}
  >
    {imageAssets.map((asset) => (
      <Image
        key={asset.id}
        source={{ uri: asset.uri }}
        style={{
          width: asset.width || 220,
          height: asset.height || 160,
          borderRadius: 8,
          position: 'absolute',
          left: 20 + (asset.x || 0),
          top: 20 + (asset.y || 0),
        }}
        resizeMode={asset.alt === 'Drawing' ? 'contain' : 'cover'}
      />
    ))}
  </View>
) : null}



      <Text style={styles.body}>{currentScene.text}</Text>



      <Text style={styles.label}>Choices</Text>



      {visibleChoices.length > 0 ? (
  visibleChoices.map((choice, index) => (
          <Pressable
            key={index}
            style={styles.choiceButton}
            onPress={() => {
  const choiceId = choice.id || getChoiceId(currentScene.id, choice, index);

  setChosenChoiceIds((previousIds) =>
    previousIds.includes(choiceId)
      ? previousIds
      : [...previousIds, choiceId]
  );

  if (choice.traceLabel?.trim()) {
  const trace = normalizeTrace(choice.traceLabel);

  setActiveTraces((previousTraces) =>
    previousTraces.includes(trace)
      ? previousTraces
      : [...previousTraces, trace]
  );
}

if (choice.valueChange) {
  const valueKey = getStoryValueKey(choice.valueChange);
  const storyValueDefinition = findStoryValueDefinition(choice.valueChange);

  const amount = Number(
    choice.valueChange.amount ?? storyValueDefinition?.step ?? 0
  );

  if (valueKey && !Number.isNaN(amount)) {
    setStoryValues((previousValues) => {
      const currentValue =
        previousValues[valueKey] ?? storyValueDefinition?.initialValue ?? 0;

      const nextValue = currentValue + amount;

      const clampedValue = storyValueDefinition
        ? clampNumber(
            nextValue,
            storyValueDefinition.minValue,
            storyValueDefinition.maxValue
          )
        : nextValue;

      return {
        ...previousValues,
        [valueKey]: clampedValue,
      };
    });
  }
}

  if (choice.targetSceneId) {
    stopSceneAudio();
    setCurrentSceneId(choice.targetSceneId);
  }
}}
          >
            <Text style={styles.choiceText}>
              {choice.label}
              {choice.targetSceneId=== undefined ? ' (no target yet)' : ''}
            </Text>
          </Pressable>
        ))
      ) : (
        <View style={styles.endingBox}>
          <Text style={styles.endingTitle}>The story ends here. </Text>
          <Text style={styles.endingText}>You can restart or return to editing.</Text>
        </View> 
      )}


<Text style={styles.traceDebug}>
  Visited scenes: {visitedSceneIds.length} · Choices made: {chosenChoiceIds.length} · Values:{' '}
  {formatStoryValuesForDebug()}
</Text>

<Pressable
  style={styles.restartButton}
  onPress={() => {
  stopSceneAudio();
  setChosenChoiceIds([]);
  setActiveTraces([]);
  setStoryValues(createInitialStoryValues());
  setVisitedSceneIds(restartSceneId ? [restartSceneId] : []);
  setCurrentSceneId(restartSceneId);
  
}}
>
  <Text style={styles.restartText}>
    {isPreviewMode ? 'Restart preview' : 'Restart story'}
  </Text>
</Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 52,
    paddingBottom: 72,
    backgroundColor: '#F7F1E1',
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8CCAA',
    marginBottom: 18,
    backgroundColor: '#FFFCF2',
  },
  backButtonText: {
    color: '#3D3528',
    fontSize: 16,
    fontWeight: '800',
  },
  playHeroCard: {
    backgroundColor: '#F5EFD9',
    borderWidth: 2,
    borderColor: '#C9B46F',
    borderRadius: 28,
    padding: 18,
    marginBottom: 20,
  },
  storyTitle: {
    fontSize: 13,
    color: '#6F675A',
    marginBottom: 4,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  playHeroTitle: {
    fontSize: 30,
    lineHeight: 36,
    color: '#247322',
    fontWeight: '900',
  },
  previewBadge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#E9F2DD',
    color: '#247322',
    fontWeight: '900',
  },
  backgroundMusicPlayButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#6E9358',
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
    backgroundColor: '#FFFCF2',
    marginBottom: 16,
  },
  backgroundMusicPlayButtonActive: {
    backgroundColor: '#247322',
    borderColor: '#247322',
  },
  backgroundMusicPlayText: {
    color: '#247322',
    fontSize: 14,
    fontWeight: '900',
  },
  backgroundMusicPlayTextActive: {
    color: '#fff',
  },
  sceneHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  heading: {
    flex: 1,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
    color: '#2A251D',
  },
  audioIconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#6E9358',
    backgroundColor: '#FFFCF2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioIconButtonActive: {
    backgroundColor: '#247322',
    borderColor: '#247322',
  },
  audioIconText: {
    fontSize: 20,
  },
  body: {
    fontSize: 19,
    lineHeight: 30,
    marginBottom: 28,
    color: '#3D3528',
    fontWeight: '500',
  },
  label: {
    fontSize: 14,
    color: '#6F675A',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '900',
  },
  choiceButton: {
    backgroundColor: '#247322',
    paddingVertical: 17,
    paddingHorizontal: 18,
    borderRadius: 18,
    marginBottom: 12,
  },
  choiceText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
  },
  endingBox: {
    borderWidth: 1,
    borderColor: '#D8CCAA',
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#FFFCF2',
  },
  endingTitle: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 6,
    color: '#2A251D',
  },
  endingText: {
    color: '#665D4E',
    lineHeight: 22,
    fontWeight: '600',
  },
  restartButton: {
    marginTop: 28,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignSelf: 'center',
    backgroundColor: '#FFFCF2',
    borderWidth: 1,
    borderColor: '#D8CCAA',
  },
  restartText: {
    color: '#3D3528',
    fontSize: 16,
    fontWeight: '900',
  },
  empty: {
    color: '#665D4E',
    fontSize: 16,
  },
  traceDebug: {
    color: '#8C806F',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 18,
  },
});
