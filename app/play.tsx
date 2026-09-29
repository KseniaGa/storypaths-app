import { View, Text, StyleSheet, Pressable, Image, ScrollView, BackHandler } from 'react-native';
import { useState, useEffect, useMemo, useRef  } from 'react';
import { useStoryStore } from '../store/storyStore';
import { getChoiceValueChanges } from '../utils/storyValueChanges';
import { parseRichText } from '../utils/richText';
import { useLocalSearchParams, router } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import {
  getPlayFont,
  getPlayTextSize,
  getPlayTheme,
  getSceneBackgroundMusic,
  getScenePlayAppearance,
} from '../utils/playAppearance';

const BUILT_IN_BACKGROUND_MUSIC = [
  {
    id: "soft-hip-hop",
    asset: require("../assets/audio/soft-hip-hop.mp3"),
  },

  {
    id: "piano-remix",
    asset: require("../assets/audio/piano-remix.mp3"),
  },
  {
    id: "game-music",
    asset: require("../assets/audio/game-music.mp3"),
  },
  {
    id: "thriller-score",
    asset: require("../assets/audio/thriller-score.mp3"),
  },
];

const getBackgroundMusicSource = (music: any) => {
  if (!music) return null;

  if (music.type === 'built-in' && music.builtInId) {
    return (
      BUILT_IN_BACKGROUND_MUSIC.find((track) => track.id === music.builtInId)
        ?.asset ?? null
    );
  }

  return music.uri ?? null;
};


const isExpectedAudioReleaseError = (error: unknown) => {
  const message = String((error as any)?.message || error || '');

  return (
    message.includes('already released') ||
    message.includes('cannot be cast to type expo.modules.audio.AudioPlayer')
  );
};

const handleAudioPauseError = (error: unknown) => {
  if (!isExpectedAudioReleaseError(error)) {
    console.warn('Could not pause audio player:', error);
  }
};

const pausePlayerSafely = (audioPlayer: any) => {
  try {
    const pauseResult = audioPlayer?.pause?.();

    if (pauseResult && typeof pauseResult.catch === 'function') {
      pauseResult.catch(handleAudioPauseError);
    }
  } catch (error) {
    handleAudioPauseError(error);
  }
};

const playPlayerSafely = (audioPlayer: any, warningLabel: string) => {
  try {
    const playResult = audioPlayer?.play?.();

    if (playResult && typeof playResult.catch === 'function') {
      playResult.catch((error: unknown) => {
        console.warn(warningLabel, error);
      });
    }
  } catch (error) {
    console.warn(warningLabel, error);
  }
};


export default function PlayScreen() {
  const storyId = useStoryStore((state) => state.currentStoryId);
  const { startSceneId } = useLocalSearchParams();
  return <PlaySession key={JSON.stringify([storyId, startSceneId])} />;
}

function PlaySession() {
  const currentStory = useStoryStore((state) => state.getCurrentStory());
  const title = currentStory?.title || 'Untitled story';
  const scenes = currentStory?.scenes || [];

  const { startSceneId, preview, returnSceneId } = useLocalSearchParams();

const startingSceneId =
  typeof startSceneId === 'string' ? startSceneId : undefined;

const isPreviewMode = preview === 'true';

  const showSceneTitlesInPlay = currentStory?.showSceneTitlesInPlay ?? true;
  const storyValueDefinitions = currentStory?.storyValues || [];
  const autoplayBackgroundMusic = currentStory?.autoplayBackgroundMusic ?? false;
  const autoplayVoiceNotes = currentStory?.autoplayVoiceNotes ?? false;

  const initialSceneId = startingSceneId && scenes.some((scene) => scene.id === startingSceneId)
    ? startingSceneId : scenes[0]?.id;
  const [currentSceneId, setCurrentSceneId] = useState<string | undefined>(initialSceneId);

  const [visitedSceneIds, setVisitedSceneIds] = useState<string[]>(initialSceneId ? [initialSceneId] : []);
const [chosenChoiceIds, setChosenChoiceIds] = useState<string[]>([]);

const [activeTraces, setActiveTraces] = useState<string[]>([]);
const [storyValues, setStoryValues] = useState<Record<string, number>>(() => Object.fromEntries(storyValueDefinitions.map((value) => [value.id, value.initialValue ?? 0])));
const [choiceFeedback, setChoiceFeedback] = useState<string | null>(null);
const choiceFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
const autoplayedBackgroundMusicKey = useRef<string | null>(null);

const normalizeTrace = (trace: string) =>
  trace.trim().toLowerCase().replace(/\s+/g, '_');

const normalizeStoryValueName = (name: string) =>
  name.trim().toLowerCase().replace(/\s+/g, '_');

const showChoiceFeedback = (messages: string[]) => {
  if (choiceFeedbackTimer.current) clearTimeout(choiceFeedbackTimer.current);

  const message = messages.filter(Boolean).join("\n");
  setChoiceFeedback(message || null);

  if (message) {
    choiceFeedbackTimer.current = setTimeout(() => {
      setChoiceFeedback(null);
      choiceFeedbackTimer.current = null;
    }, 5500);
  }
};

const getValueFeedbackMessage = (choice: any) => {
  const customMessage = choice.valueFeedbackMessage?.trim();
  if (customMessage) return customMessage;

  return getChoiceValueChanges(choice)
    .map((change) => {
      const definition = findStoryValueDefinition(change);
      const name = definition?.name || "A story value";
      const amount = Number(change.amount);
      const signedAmount = amount > 0
        ? `+${amount}`
        : amount < 0
          ? `\u2212${Math.abs(amount)}`
          : "0";

      return `${name} ${signedAmount}`;
    })
    .join(" \u00B7 ");
};

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
  const settingsScene =
    currentScene ||
    (startingSceneId
      ? scenes.find((scene) => scene.id === startingSceneId)
      : undefined) ||
    scenes[0];
  const playAppearance = getScenePlayAppearance(currentStory, settingsScene);
  const playFont = getPlayFont(playAppearance.font);
  const playTextSize = getPlayTextSize(playAppearance.textSize);
  const playTheme = getPlayTheme(playAppearance.theme);
  const playFontStyle = playFont.nativeFamily
    ? { fontFamily: playFont.nativeFamily }
    : undefined;
  const backgroundMusic = getSceneBackgroundMusic(currentStory, settingsScene);
  const backgroundMusicAutoplayKey = backgroundMusic
    ? [
        currentStory?.id || 'story',
        settingsScene?.playSettingsOverride ? settingsScene.id : 'global',
        (backgroundMusic as any).type || 'music',
        (backgroundMusic as any).builtInId ||
          (backgroundMusic as any).uri ||
          (backgroundMusic as any).name ||
          'selected',
      ].join('-')
    : '';

  const audioAsset = currentScene?.assets?.find(
  (asset) => asset.type === 'audio'
);

const player = useAudioPlayer(audioAsset?.uri ?? null);
const audioStatus = useAudioPlayerStatus(player);

const backgroundMusicSource = useMemo(
  () => getBackgroundMusicSource(backgroundMusic),
  [backgroundMusic],
);
const backgroundPlayer = useAudioPlayer(backgroundMusicSource);
const backgroundStatus = useAudioPlayerStatus(backgroundPlayer);

const stopSceneAudio = () => {
  pausePlayerSafely(player);
};

const stopAllAudio = () => {
  pausePlayerSafely(player);
  pausePlayerSafely(backgroundPlayer);
};

useEffect(() => {
  return () => pausePlayerSafely(player);
}, [player]);

useEffect(() => {
  return () => pausePlayerSafely(backgroundPlayer);
}, [backgroundPlayer]);

useEffect(() => () => {
  if (choiceFeedbackTimer.current) {
    clearTimeout(choiceFeedbackTimer.current);
    choiceFeedbackTimer.current = null;
  }
}, []);

useEffect(() => {
  if (!autoplayBackgroundMusic || !backgroundMusic || !backgroundMusicAutoplayKey) return;
  if (!backgroundStatus.isLoaded || backgroundStatus.playing) return;
  if (autoplayedBackgroundMusicKey.current === backgroundMusicAutoplayKey) return;

  autoplayedBackgroundMusicKey.current = backgroundMusicAutoplayKey;

  let isCancelled = false;
  const retryDelays = [0, 250, 750];
  const retryTimers = retryDelays.map((delay) =>
    setTimeout(() => {
      if (isCancelled) return;
      if ((backgroundPlayer as any).currentStatus?.playing) return;

      playPlayerSafely(backgroundPlayer, 'Could not autoplay background music:');
    }, delay),
  );

  return () => {
    isCancelled = true;
    retryTimers.forEach(clearTimeout);
  };
}, [
  autoplayBackgroundMusic,
  backgroundMusic,
  backgroundMusicAutoplayKey,
  backgroundPlayer,
  backgroundStatus.isLoaded,
  backgroundStatus.playing,
]);

useEffect(() => {
  if (!autoplayVoiceNotes || !audioAsset) return;

  (player as any).seekTo?.(0);
  playPlayerSafely(player, 'Could not autoplay scene audio:');
}, [autoplayVoiceNotes, audioAsset, audioAsset?.id, currentSceneId, player]);

const returnFromPlay = () => {
  stopAllAudio();

  if (router.canGoBack()) {
    router.back();
    return;
  }

  if (isPreviewMode && typeof returnSceneId === 'string') {
    router.replace({
      pathname: '/scene-editor',
      params: { sceneId: returnSceneId, restoreScroll: 'true' },
    });
    return;
  }

  router.replace({
    pathname: '/story',
    params: { restoreScroll: 'true' },
  });
};

useEffect(() => {
  const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
    returnFromPlay();
    return true;
  });

  return () => backHandler.remove();
});

const restartSceneId =
  isPreviewMode && startingSceneId ? startingSceneId : scenes[0]?.id;

const formatAudioTime = (seconds?: number) => {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds || 0)) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

const audioCurrentTime = Number((audioStatus as any)?.currentTime || 0);
const audioDuration = Number((audioStatus as any)?.duration || 0);
const audioProgress =
  audioDuration > 0
    ? Math.min(100, Math.max(0, (audioCurrentTime / audioDuration) * 100))
    : audioStatus.playing
      ? 18
      : 0;
const audioTimeLabel =
  audioDuration > 0
    ? `${formatAudioTime(audioCurrentTime)} / ${formatAudioTime(audioDuration)}`
    : audioStatus.playing
      ? formatAudioTime(audioCurrentTime)
      : 'Voice note';

const toggleSceneAudio = () => {
  if (audioStatus.playing) {
    pausePlayerSafely(player);
    return;
  }

  (player as any).seekTo?.(0);
  playPlayerSafely(player, 'Could not play scene audio:');
};

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

const dialogueTurns =
  currentScene.sceneType === 'dialogue' ? currentScene.dialogueTurns || [] : [];

const getChoiceId = (sceneId: string, choice: any, index: number) =>
  choice.id || `${sceneId}-choice-${index}`;


const visibleChoices = currentScene.choices.filter((choice) => {
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

return (
  <ScrollView
    style={{ backgroundColor: playTheme.sceneBackground }}
    contentContainerStyle={[
      styles.container,
      { backgroundColor: playTheme.sceneBackground },
    ]}
  >
    <Pressable
      style={[
        styles.backButton,
        { backgroundColor: playTheme.surface, borderColor: playTheme.border },
      ]}
      onPress={returnFromPlay}
    >
      <Text
        style={[
          styles.backButtonText,
          playFontStyle,
          { color: playTheme.primaryText },
        ]}
      >
        {isPreviewMode && typeof returnSceneId === 'string'
          ? '← Back to scene'
          : isPreviewMode
            ? '← Back to story'
            : '🏠 Story home'}
      </Text>
    </Pressable>

    <View
      style={[
        styles.playHeroCard,
        { backgroundColor: playTheme.softSurface, borderColor: playTheme.border },
      ]}
    >
      <Text style={[styles.storyTitle, playFontStyle, { color: playTheme.secondaryText }]}>Playing</Text>
      <Text style={[styles.playHeroTitle, playFontStyle, { color: playTheme.accent }]}>
        {title || 'Untitled story'}
      </Text>
      {isPreviewMode && (
        <Text
          style={[
            styles.previewBadge,
            playFontStyle,
            { backgroundColor: playTheme.surface, color: playTheme.accent },
          ]}
        >
          Preview mode
        </Text>
      )}
    </View>

    {backgroundMusic && (
  <Pressable
    style={[
      styles.backgroundMusicPlayButton,
      { backgroundColor: playTheme.surface, borderColor: playTheme.border },
      backgroundStatus.playing && styles.backgroundMusicPlayButtonActive,
      backgroundStatus.playing && {
        backgroundColor: playTheme.choiceBackground,
        borderColor: playTheme.choiceBackground,
      },
    ]}
    onPress={() => {
      if (backgroundStatus.playing) {
        pausePlayerSafely(backgroundPlayer);
      } else {
        try {
          playPlayerSafely(backgroundPlayer, 'Could not play background music:');
        } catch (error) {
          console.warn('Could not play background music:', error);
        }
      }
    }}
  >
    <Text
      style={[
        styles.backgroundMusicPlayText,
      playFontStyle,
      { color: playTheme.accent },
        backgroundStatus.playing && styles.backgroundMusicPlayTextActive,
        backgroundStatus.playing && { color: playTheme.choiceText },
      ]}
    >
      {backgroundStatus.playing ? '⏸ Background music' : '🎵 Background music'}
    </Text>
  </Pressable>
)}

{showSceneTitlesInPlay && (
  <View style={styles.sceneHeaderRow}>
    <Text
      style={[
        styles.heading,
        playFontStyle,
        { color: playTheme.primaryText },
      ]}
    >
      {currentScene.title}
    </Text>
  </View>
)}

{imageAssets.length > 0 ? (
  <View
    style={{
      height: 260,
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 16,
      backgroundColor: playTheme.surface,
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



      {currentScene.text.trim().length > 0 && (
        <Text
          style={[
            styles.body,
            playFontStyle,
            {
              color: playTheme.primaryText,
              fontSize: playTextSize.body,
              lineHeight: playTextSize.bodyLineHeight,
            },
          ]}
        >
          {parseRichText(
            currentScene.text,
            currentScene.textFormatting,
          ).map((span, index) => (
            <Text
              key={`${index}-${span.text.length}`}
              style={{
                fontWeight: span.bold ? "900" : undefined,
                fontStyle: span.italic ? "italic" : undefined,
                textDecorationLine: span.underline
                  ? "underline"
                  : undefined,
              }}
            >
              {span.text}
            </Text>
          ))}
        </Text>
      )}

      {dialogueTurns.length > 0 && (
        <View style={styles.dialogueBox}>
          {dialogueTurns.map((turn: any, index: number) => (
            <View
              key={turn.id || index}
              style={[
                styles.dialogueBubble,
                { backgroundColor: playTheme.surface, borderColor: playTheme.border },
              ]}
            >
              {turn.speaker?.trim().length > 0 && (
                <Text
                  style={[
                    styles.dialogueSpeaker,
                    playFontStyle,
                    { color: playTheme.accent },
                  ]}
                >
                  {turn.speaker.trim()}
                </Text>
              )}
              <Text
                style={[
                  styles.dialogueText,
                  playFontStyle,
                  {
                    color: playTheme.primaryText,
                    fontSize: playTextSize.dialogue,
                    lineHeight: playTextSize.dialogue + 8,
                  },
                ]}
              >
                {turn.text || '...'}
              </Text>
            </View>
          ))}
        </View>
      )}

      {audioAsset && (
        <View
          style={[
            styles.voiceMessageBubble,
            { backgroundColor: playTheme.softSurface, borderColor: playTheme.border },
          ]}
        >
          <Pressable
            style={[
              styles.voicePlayButton,
              { backgroundColor: playTheme.surface, borderColor: playTheme.border },
              audioStatus.playing && styles.voicePlayButtonActive,
              audioStatus.playing && {
                backgroundColor: playTheme.choiceBackground,
                borderColor: playTheme.choiceBackground,
              },
            ]}
            accessibilityLabel={
              audioStatus.playing ? 'Pause voice note' : 'Play voice note'
            }
            onPress={toggleSceneAudio}
          >
            <Text
              style={[
                styles.voicePlayButtonText,
                playFontStyle,
                { color: playTheme.accent },
                audioStatus.playing && styles.voicePlayButtonTextActive,
                audioStatus.playing && { color: playTheme.choiceText },
              ]}
            >
              {audioStatus.playing ? '\u23F8' : '\u25B6'}
            </Text>
          </Pressable>

          <View style={styles.voiceMessageContent}>
            <View style={styles.voiceMessageTopRow}>
              <Text style={[styles.voiceMessageTitle, playFontStyle, { color: playTheme.primaryText }]}>Voice note</Text>
              <Text style={[styles.voiceMessageTime, playFontStyle, { color: playTheme.secondaryText }]}>{audioTimeLabel}</Text>
            </View>
            <View style={[styles.voiceProgressTrack, { backgroundColor: playTheme.border }]}>
              <View
                style={[
                  styles.voiceProgressFill,
                  { backgroundColor: playTheme.accent },
                  { width: `${audioProgress}%` },
                ]}
              />
            </View>
          </View>
        </View>
      )}



      {choiceFeedback && (
        <View
          style={[
            styles.choiceFeedback,
            { backgroundColor: playTheme.softSurface, borderColor: playTheme.border },
          ]}
          accessible
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <Text
            style={[
              styles.choiceFeedbackText,
              playFontStyle,
              { color: playTheme.primaryText, fontSize: playTextSize.feedback },
            ]}
          >
            {choiceFeedback}
          </Text>
        </View>
      )}

      <Text style={[styles.label, playFontStyle, { color: playTheme.secondaryText }]}>Choices</Text>



      {visibleChoices.length > 0 ? (
  visibleChoices.map((choice, index) => {
    const targetScene = choice.targetSceneId
      ? scenes.find((scene) => scene.id === choice.targetSceneId)
      : undefined;
    const hasMissingDestination = Boolean(choice.targetSceneId) && !targetScene;

    return (
          <Pressable
            key={index}
            style={[
              styles.choiceButton,
              { backgroundColor: playTheme.choiceBackground },
              !targetScene && styles.choiceButtonDisconnected,
            ]}
            disabled={!targetScene}
            onPress={() => {
  const choiceId = choice.id || getChoiceId(currentScene.id, choice, index);
  const feedbackMessages: string[] = [];

  if (choice.rememberChoice && choice.rememberFeedbackEnabled) {
    feedbackMessages.push(
      choice.rememberFeedbackMessage?.trim() || "This choice will be remembered.",
    );
  }

  if (getChoiceValueChanges(choice).length > 0 && choice.valueFeedbackEnabled) {
    feedbackMessages.push(getValueFeedbackMessage(choice));
  }

  showChoiceFeedback(feedbackMessages);

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

const valueChanges = getChoiceValueChanges(choice);
if (valueChanges.length > 0) {
  setStoryValues((previousValues) => {
    const nextValues = { ...previousValues };

    valueChanges.forEach((change) => {
      const valueKey = getStoryValueKey(change);
      const storyValueDefinition = findStoryValueDefinition(change);
      const amount = Number(change.amount);

      if (!valueKey || Number.isNaN(amount)) return;

      const currentValue =
        nextValues[valueKey] ?? storyValueDefinition?.initialValue ?? 0;
      const nextValue = currentValue + amount;

      nextValues[valueKey] = storyValueDefinition
        ? clampNumber(
            nextValue,
            storyValueDefinition.minValue,
            storyValueDefinition.maxValue,
          )
        : nextValue;
    });

    return nextValues;
  });
}

  if (targetScene) {
    stopSceneAudio();
    setVisitedSceneIds((previous) => previous.includes(targetScene.id) ? previous : [...previous, targetScene.id]);
    setCurrentSceneId(targetScene.id);
  }
}}
          >
            <Text
              style={[
                styles.choiceText,
                playFontStyle,
                { color: playTheme.choiceText, fontSize: playTextSize.choice },
              ]}
            >
              {choice.label}
              {!choice.targetSceneId
                ? " (not connected)"
                : hasMissingDestination
                  ? " (destination missing)"
                  : ""}
            </Text>
          </Pressable>
        );
  })
      ) : (
        <View
          style={[
            styles.endingBox,
            { backgroundColor: playTheme.surface, borderColor: playTheme.border },
          ]}
        >
          <Text style={[styles.endingTitle, playFontStyle, { color: playTheme.primaryText }]}>The story ends here. </Text>
          <Text style={[styles.endingText, playFontStyle, { color: playTheme.secondaryText }]}>You can restart or return to editing.</Text>
        </View> 
      )}


<Text style={[styles.traceDebug, playFontStyle, { color: playTheme.secondaryText }]}>
  Visited scenes: {visitedSceneIds.length} · Choices made: {chosenChoiceIds.length} · Values:{' '}
  {formatStoryValuesForDebug()}
</Text>

<Pressable
  style={[
    styles.restartButton,
    { backgroundColor: playTheme.surface, borderColor: playTheme.border },
  ]}
  onPress={() => {
  stopSceneAudio();
  setChosenChoiceIds([]);
  setActiveTraces([]);
  setStoryValues(createInitialStoryValues());
  setVisitedSceneIds(restartSceneId ? [restartSceneId] : []);
  setCurrentSceneId(restartSceneId);
  
}}
>
  <Text style={[styles.restartText, playFontStyle, { color: playTheme.primaryText }]}>
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
    marginBottom: 16,
  },
  heading: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
    color: '#2A251D',
  },
  voiceMessageBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#C9D8B8',
    backgroundColor: '#F0F7E8',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: -8,
    marginBottom: 22,
  },
  voicePlayButton: {
    width: 46,
    height: 46,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#6E9358',
    backgroundColor: '#FFFCF2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voicePlayButtonActive: {
    backgroundColor: '#247322',
    borderColor: '#247322',
  },
  voicePlayButtonText: {
    color: '#247322',
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '900',
  },
  voicePlayButtonTextActive: {
    color: '#fff',
  },
  voiceMessageContent: {
    flex: 1,
    minWidth: 0,
  },
  voiceMessageTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  voiceMessageTitle: {
    flexShrink: 1,
    color: '#2A251D',
    fontSize: 15,
    fontWeight: '900',
  },
  voiceMessageTime: {
    color: '#6F675A',
    fontSize: 12,
    fontWeight: '800',
  },
  voiceProgressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#D9E7CC',
  },
  voiceProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#6E9358',
  },
  body: {
    fontSize: 19,
    lineHeight: 30,
    marginBottom: 28,
    color: '#3D3528',
    fontWeight: '500',
  },
  dialogueBox: {
    gap: 10,
    marginBottom: 18,
  },
  dialogueBubble: {
    borderWidth: 1,
    borderColor: '#D8CCAA',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FFFCF2',
  },
  dialogueSpeaker: {
    color: '#247322',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 5,
  },
  dialogueText: {
    color: '#2A251D',
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '700',
  },
  label: {
    fontSize: 14,
    color: '#6F675A',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '900',
  },
  choiceFeedback: {
    backgroundColor: '#E9F2DD',
    borderWidth: 1,
    borderColor: '#BFD5A9',
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  choiceFeedbackText: {
    color: '#315C2B',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
  },
  choiceButton: {
    backgroundColor: '#247322',
    paddingVertical: 17,
    paddingHorizontal: 18,
    borderRadius: 18,
    marginBottom: 12,
  },
  choiceButtonDisconnected: {
    opacity: 0.58,
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
