import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  BackHandler,
  Modal,
} from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { useState, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef } from "react";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { storyPersistence, useStoryStore } from "../store/storyStore";
import type {
  BackgroundMusic,
  RichTextFormat,
  ScenePlaySettingsOverride,
  SceneAsset,
} from "../types/story";
import {
  clearScrollPosition,
  getScrollPosition,
  rememberScrollPosition,
} from "../utils/scrollMemory";
import { getChoiceValueChanges } from "../utils/storyValueChanges";
import {
  PLAY_FONT_OPTIONS,
  PLAY_TEXT_SIZE_OPTIONS,
  PLAY_THEMES,
  getStoryPlayAppearance,
} from "../utils/playAppearance";
import {
  getRichTextDocument,
  parseRichText,
  toggleRichTextFormatting,
  updateRichTextFormattingForEdit,
} from "../utils/richText";
import { confirmAction } from "../utils/platformDialogs";
import { getPersistentMediaUri } from "../utils/platformFiles";
import { usePersistenceStatus } from "../hooks/use-persistence-status";
import { useInterruptionProtection } from "../hooks/use-interruption-protection";
import { createLocalId } from "../utils/localIds";

const SHOW_WRITING_HINTS = false;
const EMPTY_ASSETS: SceneAsset[] = [];

const SCENE_BACKGROUND_MUSIC = [
  {
    id: "soft-hip-hop",
    title: "Soft Branch",
  },
  {
    id: "piano-remix",
    title: "Tiny Piano",
  },
  {
    id: "game-music",
    title: "Gentle Game Theme",
  },
  {
    id: "thriller-score",
    title: "Thriller Score",
  },
];

function SignedAmountInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (amount: number) => void;
}) {
  const [text, setText] = useState(String(value));

  const [previousValue, setPreviousValue] = useState(value);
  if (value !== previousValue) {
    setPreviousValue(value);
    setText(String(value));
  }

  return (
    <TextInput
      style={styles.valueChangeAmountInput}
      value={text}
      onChangeText={(nextText) => {
        setText(nextText);
        if (/^-?\d+$/.test(nextText)) onChange(Number(nextText));
      }}
      onBlur={() => {
        if (!/^-?\d+$/.test(text)) setText(String(value));
      }}
      keyboardType="numbers-and-punctuation"
      selectTextOnFocus
      accessibilityLabel="Story value change amount"
    />
  );
}

export default function SceneEditorScreen() {
  const { sceneId } = useLocalSearchParams();
  const story = useStoryStore((state) => state.getCurrentStory());
  const availableSceneId = story?.scenes.find((scene) => scene.id === sceneId)?.id;
  // A different scene gets a fresh draft; saving this scene must not reset its inputs.
  return <SceneEditorDraft key={JSON.stringify([story?.id, sceneId, availableSceneId])} />;
}

function SceneEditorDraft() {
  const persistenceStatus = usePersistenceStatus();
  const {
    sceneId,
    parentSceneId,
    choiceIndex,
    choiceId,
    returnSceneId,
    restoreScroll,
    createdFromChoice,
    createdFromScene,
  } = useLocalSearchParams();

  const requestedSceneId = typeof sceneId === "string" ? sceneId : undefined;
  const requestedParentSceneId =
    typeof parentSceneId === "string" ? parentSceneId : undefined;
  const requestedChoiceId = typeof choiceId === "string" ? choiceId : undefined;
  const createdFromChoiceLabel =
    typeof createdFromChoice === "string" && createdFromChoice.trim()
      ? createdFromChoice.trim()
      : undefined;
  const createdFromSceneTitle =
    typeof createdFromScene === "string" && createdFromScene.trim()
      ? createdFromScene.trim()
      : undefined;

  const createChoiceId = () => createLocalId("choice");

  const createDialogueTurnId = () =>
    `dialogue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const showDialogueSceneOption = false;

  const getStoryValueOperatorLabel = (operator?: string) => {
    if (operator === "atMost") return "is at most";
    if (operator === "equals") return "is exactly";
    return "is at least";
  };

  const getNextStoryValueOperator = (operator?: string) => {
    if (operator === "atLeast") return "atMost";
    if (operator === "atMost") return "equals";
    return "atLeast";
  };

  const currentStory = useStoryStore((state) => state.getCurrentStory());
  const scenes = useMemo(() => currentStory?.scenes || [], [currentStory?.scenes]);
  const storyTitle = currentStory?.title || "Untitled story";

  const addScene = useStoryStore((state) => state.addScene);
  const updateScene = useStoryStore((state) => state.updateScene);
  const createSceneFromChoice = useStoryStore(
    (state) => state.createSceneFromChoice,
  );

  const scrollRef = useRef<ScrollView>(null);
  const sceneTextInputRef = useRef<TextInput>(null);
  const currentScrollY = useRef(0);
  const pendingRestoreY = useRef<number | null>(null);
  const navigationPending = useRef(false);
  const autoCreatedChoiceRequest = useRef<string | null>(null);
  const autoSaveGeneration = useRef(0);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safeBackNavigation = useRef<() => void>(() => {});
  const draftIdentity = useRef<{ key: string; id?: string }>({ key: "" });
  const draftKey = JSON.stringify([currentStory?.id, requestedSceneId]);
  const connectionConfirmationTimer =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const [expandedChoiceIndex, setExpandedChoiceIndex] = useState<number | null>(
    null,
  );

  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const [activeChoiceLogicIndex, setActiveChoiceLogicIndex] = useState<number | null>(null);
  const [connectionConfirmation, setConnectionConfirmation] = useState<{
    choiceKey: string;
    destination: string;
  } | null>(null);

  const showChoiceInfo = () => {
    Alert.alert(
      "Choice",
      "A choice is a button the player can press. It usually leads the player to another scene.",
    );
  };

  const showStartSceneInfo = () => {
    Alert.alert(
      "Start scene",
      "This is where the story begins. By default, the first scene you create is the start scene. You can reassign the start scene from the Story screen.",
    );
  };

  const showEndingSceneInfo = () => {
    Alert.alert(
      "Ending scene",
      "Scenes with no choices are endings. Add a choice if the story should continue from this scene.",
    );
  };

  const showChoiceVisibilityInfo = () => {
    Alert.alert(
      "Choice visibility",
      "Choice visibility controls when a player can see this choice. It can always appear, depend on a remembered choice, or depend on a story value.",
    );
  };

  const showChoiceConsequenceInfo = () => {
    Alert.alert(
      "Choice consequence",
      "Choice consequence controls what changes after the player chooses this option, such as remembering the choice or changing a story value.",
    );
  };

  const showSceneMediaInfo = () => {
    Alert.alert(
      "Scene media",
      "Add images, drawings, audio, or voice notes to this scene. The scene saves first so the media has somewhere to live.",
    );
  };


  const existingScene = requestedSceneId
    ? scenes.find((scene) => scene.id === requestedSceneId)
    : undefined;
  const editorHint = existingScene
    ? currentStory?.editorHints?.[existingScene.id]
    : undefined;

  const returnScene =
    typeof returnSceneId === "string"
      ? scenes.find((scene) => scene.id === returnSceneId)
      : undefined;

  const parentScene = requestedParentSceneId
    ? scenes.find((scene) => scene.id === requestedParentSceneId)
    : undefined;

  const parentChoiceNumber =
    typeof choiceIndex === "string" ? Number(choiceIndex) : undefined;

  const parentChoiceIndex = parentScene
    ? requestedChoiceId
      ? parentScene.choices.findIndex((choice) => choice.id === requestedChoiceId)
      : parentChoiceNumber !== undefined && !Number.isNaN(parentChoiceNumber)
        ? parentChoiceNumber
        : -1
    : -1;

  const parentChoice =
    parentScene && parentChoiceIndex >= 0
      ? parentScene.choices[parentChoiceIndex]
      : undefined;

  const getSceneDisplayName = (scene: (typeof scenes)[number]) => {
    const sceneIndex = scenes.findIndex((item) => item.id === scene.id);
    const sceneNumber = sceneIndex >= 0 ? sceneIndex + 1 : "?";
    const cleanTitle = scene.title?.trim();
    return `Scene ${sceneNumber} · ${cleanTitle || "Untitled"}`;
  };

  const initialDocument = getRichTextDocument(existingScene?.text || "", existingScene?.textFormatting);
  const [sceneTitle, setSceneTitle] = useState(existingScene?.title || "");
  const [sceneText, setSceneText] = useState(initialDocument.text);
  const [sceneTextFormatting, setSceneTextFormatting] = useState<
    RichTextFormat[]
  >(initialDocument.formatting);
  const [sceneTextSelection, setSceneTextSelection] = useState({
    start: 0,
    end: 0,
  });
  const [sceneType, setSceneType] = useState<"story" | "dialogue">(existingScene?.sceneType === "dialogue" ? "dialogue" : "story");
  const [dialogueTurns, setDialogueTurns] = useState<any[]>(existingScene?.dialogueTurns || []);

  const [choices, setChoices] = useState(existingScene?.choices || []);
  const choicesRef = useRef(existingScene?.choices || []);

  const [newChoice, setNewChoice] = useState("");
  const [isAddingChoice, setIsAddingChoice] = useState(false);

  const assets = existingScene?.assets || EMPTY_ASSETS;
  const [scenePlaySettingsOverride, setScenePlaySettingsOverride] =
    useState<ScenePlaySettingsOverride | undefined>(
      existingScene?.playSettingsOverride,
    );
  const isOpeningScene = existingScene
    ? scenes[0]?.id === existingScene.id
    : scenes.length === 0;

  const rememberedChoices = scenes.flatMap((scene) =>
    scene.choices
      .filter((choice) => choice.rememberChoice && choice.id)
      .map((choice) => ({
        id: choice.id!,
        sceneTitle: scene.title || "Untitled scene",
        choiceLabel: choice.memoryName || choice.label || "(empty choice)",
      })),
  );

  const currentSceneRememberedChoices = choices
    .filter((choice) => choice.rememberChoice && choice.id)
    .map((choice) => ({
      id: choice.id!,
      sceneTitle: sceneTitle || "This scene",
      choiceLabel: choice.memoryName || choice.label || "(empty choice)",
    }));

  const availableRememberedChoices = Array.from(
    new Map(
      [...rememberedChoices, ...currentSceneRememberedChoices].map((item) => [
        item.id,
        item,
      ]),
    ).values(),
  );

  const storyValueDefinitions = currentStory?.storyValues || [];

  const findStoryValueDefinition = (value?: {
    valueId?: string;
    name?: string;
  }) =>
    storyValueDefinitions.find(
      (storyValue) =>
        storyValue.id === value?.valueId || storyValue.name === value?.name,
    );

  const formatSignedAmount = (amount: number) =>
    `${amount >= 0 ? "+" : ""}${amount}`;

  const createMemoryName = (label: string) => {
    const memoryName = label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    return memoryName || "remembered_choice";
  };

  const getChoiceMemoryName = (choice: any) =>
    choice.memoryName?.trim() || createMemoryName(choice.label || "remembered choice");

  const persistChoices = (
    updater: any[] | ((currentChoices: any[]) => any[]),
  ) => {
    autoSaveGeneration.current += 1;
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }

    const nextChoices =
      typeof updater === "function"
        ? updater(choicesRef.current)
        : updater;

    choicesRef.current = nextChoices;
    setChoices(nextChoices);

    if (existingScene) {
      setSaveStatus("saving");
      try {
        updateScene(existingScene.id, { choices: nextChoices });
        requestAnimationFrame(() => setSaveStatus("saved"));
      } catch (error) {
        console.error("Choice autosave error:", error);
        setSaveStatus("error");
      }
    }
  };

  const updateChoiceAt = (index: number, updater: (choice: any) => any) => {
    persistChoices((currentChoices) =>
      currentChoices.map((currentChoice, choiceIndex) =>
        choiceIndex === index ? updater(currentChoice) : currentChoice,
      ),
    );
  };

  const connectChoiceToScene = (
    choice: any,
    choiceIndex: number,
    destinationScene: (typeof scenes)[number],
  ) => {
    const applyConnection = () => {
      updateChoiceAt(choiceIndex, (currentChoice) => ({
        ...currentChoice,
        targetSceneId: destinationScene.id,
      }));
      setExpandedChoiceIndex(null);

      if (connectionConfirmationTimer.current) {
        clearTimeout(connectionConfirmationTimer.current);
      }
      setConnectionConfirmation({
        choiceKey: choice.id || String(choiceIndex),
        destination: getSceneDisplayName(destinationScene),
      });
      connectionConfirmationTimer.current = setTimeout(() => {
        setConnectionConfirmation(null);
        connectionConfirmationTimer.current = null;
      }, 4000);
    };

    if (destinationScene.id === existingScene?.id) {
      confirmAction(
        "Link back to this scene?",
        "This creates a loop. In Play mode, this choice will return to the same scene.",
        "Create loop",
        applyConnection,
      );
      return;
    }

    applyConnection();
  };

  useEffect(
    () => () => {
      if (connectionConfirmationTimer.current) {
        clearTimeout(connectionConfirmationTimer.current);
      }
    },
    [],
  );

  const moveChoice = (index: number, offset: -1 | 1) => {
    persistChoices((currentChoices) => {
      const destinationIndex = index + offset;
      if (destinationIndex < 0 || destinationIndex >= currentChoices.length) {
        return currentChoices;
      }

      const reorderedChoices = [...currentChoices];
      [reorderedChoices[index], reorderedChoices[destinationIndex]] = [
        reorderedChoices[destinationIndex],
        reorderedChoices[index],
      ];
      return reorderedChoices;
    });
    setExpandedChoiceIndex(null);
    setActiveChoiceLogicIndex(null);
  };

  const formatSelectedSceneText = (
    style: "bold" | "italic" | "underline",
  ) => {
    const { start, end } = sceneTextSelection;
    if (start === end) return;

    setSceneTextFormatting((current) =>
      toggleRichTextFormatting(sceneText, current, start, end, style),
    );
    requestAnimationFrame(() => sceneTextInputRef.current?.focus());
  };

  const updateSceneText = (nextText: string) => {
    setSceneTextFormatting((current) =>
      updateRichTextFormattingForEdit(sceneText, nextText, current),
    );
    setSceneText(nextText);
  };

  const enableSceneAppearanceOverride = () => {
    setScenePlaySettingsOverride({
      playAppearance: getStoryPlayAppearance(currentStory),
      backgroundMusic: currentStory?.backgroundMusic
        ? { ...currentStory.backgroundMusic }
        : null,
    });
  };

  const updateSceneAppearance = (
    update: Partial<ScenePlaySettingsOverride["playAppearance"]>,
  ) => {
    setScenePlaySettingsOverride((current) =>
      current
        ? {
            ...current,
            playAppearance: {
              ...current.playAppearance,
              ...update,
            },
          }
        : current,
    );
  };

  const setSceneBackgroundMusic = (music: BackgroundMusic | null) => {
    setScenePlaySettingsOverride((current) =>
      current ? { ...current, backgroundMusic: music } : current,
    );
  };

  const uploadSceneBackgroundMusic = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const pickedFile = result.assets[0];
      let destinationUri: string;
      if (Platform.OS === "web") {
        destinationUri = await getPersistentMediaUri(
          pickedFile,
          pickedFile.mimeType || "audio/mpeg",
        );
      } else {
        const safeName =
          pickedFile.name?.replace(/[^a-z0-9._-]/gi, "_") ||
          `scene-background-${Date.now()}.mp3`;
        destinationUri =
          FileSystem.documentDirectory +
          `scene-background-${Date.now()}-${safeName}`;
        await FileSystem.copyAsync({
          from: pickedFile.uri,
          to: destinationUri,
        });
      }

      setSceneBackgroundMusic({
        type: "uploaded",
        uri: destinationUri,
        name: pickedFile.name || "Scene background music",
      });
    } catch (error) {
      console.error("Scene background music picker error:", error);
      Alert.alert(
        "Could not add music",
        "Please try choosing another audio file.",
      );
    }
  };

  const sceneBackgroundMusicName = (() => {
    const music = scenePlaySettingsOverride?.backgroundMusic;
    if (!music) return "No music for this scene";
    if (music.type === "built-in") {
      return (
        SCENE_BACKGROUND_MUSIC.find((track) => track.id === music.builtInId)
          ?.title ||
        music.name ||
        "Built-in music"
      );
    }
    return music.name || "Uploaded music";
  })();

  const getRequiredChoiceState = (choice: any) =>
    choice.requiredChoiceState === "notRemembered" ? "notRemembered" : "remembered";

  const getCleanSceneTitle = () => sceneTitle.trim();

  const writeCurrentScene = (
    options: { showAlerts?: boolean } = {},
  ): { sceneId: string; wasNew: boolean } | null => {
    const { showAlerts = true } = options;
    const cleanTitle = getCleanSceneTitle();
    const latestStory = useStoryStore.getState().getCurrentStory();
    if (!latestStory || latestStory.id !== currentStory?.id) return null;
    if (draftIdentity.current.key !== draftKey) draftIdentity.current = { key: draftKey };
    const savedId = requestedSceneId || draftIdentity.current.id;
    const savedScene = latestStory.scenes.find((scene) => scene.id === savedId);
    if (savedId) {
      if (!savedScene) {
        if (showAlerts) {
          Alert.alert("Could not save scene", "This scene could not be found.");
        }
        return null;
      }

      updateScene(savedId, {
        title: cleanTitle,
        text: sceneText || "",
        textFormatting: sceneTextFormatting,
        sceneType,
        dialogueTurns,
        choices: choicesRef.current,
        assets,
        playSettingsOverride: scenePlaySettingsOverride,
        isDone: savedScene.isDone,
      });

      return { sceneId: savedId, wasNew: !requestedSceneId };
    }

    const newSceneId = addScene({
      id: "",
      title: cleanTitle,
      text: sceneText || "",
      textFormatting: sceneTextFormatting,
      sceneType,
      dialogueTurns,
      choices: choicesRef.current,
      assets,
      playSettingsOverride: scenePlaySettingsOverride,
    });
    draftIdentity.current.id = newSceneId;

    if (requestedParentSceneId && parentChoiceIndex >= 0) {
      updateScene(requestedParentSceneId, (latestParentScene) => ({
        ...latestParentScene,
        choices: latestParentScene.choices.map((choice, index) =>
          (requestedChoiceId && choice.id === requestedChoiceId) ||
          (!requestedChoiceId && index === parentChoiceIndex)
            ? { ...choice, targetSceneId: newSceneId }
            : choice,
        ),
      }));
    }

    return { sceneId: newSceneId, wasNew: true };
  };

  const saveCurrentScene = (
    options: { showAlerts?: boolean } = {},
  ): { sceneId: string; wasNew: boolean } | null => {
    try {
      return writeCurrentScene(options);
    } catch (error) {
      console.error("Scene autosave error:", error);
      setSaveStatus("error");
      if (options.showAlerts !== false) {
        Alert.alert(
          "Could not save scene",
          "Your changes are still in the editor. Please try again.",
        );
      }
      return null;
    }
  };

  useEffect(() => {
    if (existingScene) return;
    if (!parentScene || !requestedParentSceneId || parentChoiceIndex < 0) return;

    const requestKey = `${requestedParentSceneId}:${requestedChoiceId || parentChoiceIndex}`;
    if (autoCreatedChoiceRequest.current === requestKey) return;
    autoCreatedChoiceRequest.current = requestKey;

    const validTargetScene = parentChoice?.targetSceneId
      ? scenes.find((scene) => scene.id === parentChoice.targetSceneId)
      : undefined;

    if (validTargetScene) {
      router.replace({
        pathname: "/scene-editor",
        params: {
          sceneId: validTargetScene.id,
          returnSceneId: requestedParentSceneId,
        },
      });
      return;
    }

    const newSceneId = createSceneFromChoice(
      requestedParentSceneId,
      requestedChoiceId,
      parentChoiceIndex,
    );
    if (!newSceneId) {
      autoCreatedChoiceRequest.current = null;
      return;
    }

    router.replace({
      pathname: "/scene-editor",
      params: {
        sceneId: newSceneId,
        returnSceneId: requestedParentSceneId,
        createdFromChoice: parentChoice?.label || "(empty choice)",
        createdFromScene: parentScene.title || "Untitled scene",
      },
    });
  }, [
    addScene,
    createSceneFromChoice,
    existingScene,
    parentChoice?.label,
    parentChoice?.targetSceneId,
    parentChoiceIndex,
    parentScene,
    requestedChoiceId,
    requestedParentSceneId,
    scenes,
    updateScene,
  ]);

  const hasUnsavedChanges =
    sceneTitle !== (existingScene?.title || "") ||
    sceneText !== (existingScene?.text || "") ||
    JSON.stringify(sceneTextFormatting) !==
      JSON.stringify(existingScene?.textFormatting || []) ||
    sceneType !== (existingScene?.sceneType || "story") ||
    JSON.stringify(dialogueTurns) !== JSON.stringify(existingScene?.dialogueTurns || []) ||
    JSON.stringify(choices) !== JSON.stringify(existingScene?.choices || []) ||
    JSON.stringify(assets) !== JSON.stringify(existingScene?.assets || []) ||
    JSON.stringify(scenePlaySettingsOverride) !==
      JSON.stringify(existingScene?.playSettingsOverride);

  const sceneHasContent =
    sceneTitle.trim().length > 0 ||
    sceneText.trim().length > 0 ||
    dialogueTurns.some((turn) => turn.speaker.trim().length > 0 || turn.text.trim().length > 0) ||
    choices.length > 0 ||
    assets.length > 0 ||
    scenePlaySettingsOverride !== undefined;

  useInterruptionProtection(() => {
    if (hasUnsavedChanges && (existingScene || sceneHasContent)) {
      autoSaveGeneration.current += 1;
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      const saved = saveCurrentScene({ showAlerts: false });
      if (!saved) return false;
      if (saved.wasNew) {
        router.replace({
          pathname: "/scene-editor",
          params: {
            sceneId: saved.sceneId,
            returnSceneId: typeof parentSceneId === "string" ? parentSceneId : undefined,
            createdFromChoice: createdFromChoiceLabel,
            createdFromScene: createdFromSceneTitle,
          },
        });
      }
    } else if (storyPersistence.getStatus() === "error") {
      void storyPersistence.retry();
    }
    return storyPersistence.getStatus() !== "error" && storyPersistence.getStatus() !== "saving";
  });

  const saveAutosaveSnapshot = useEffectEvent(() => saveCurrentScene({ showAlerts: false }));

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    if (!existingScene && !sceneHasContent) {
      return;
    }

    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }

    const saveGeneration = ++autoSaveGeneration.current;

    autoSaveTimer.current = setTimeout(() => {
      if (saveGeneration !== autoSaveGeneration.current) return;

      setSaveStatus("saving");
      const saved = saveAutosaveSnapshot();

      if (!saved) {
        setSaveStatus("error");
        return;
      }

      requestAnimationFrame(() => {
        if (saveGeneration === autoSaveGeneration.current) {
          setSaveStatus("saved");
        }
      });

      if (saved.wasNew) {
        rememberScrollPosition(
          `scene-editor:${saved.sceneId}`,
          currentScrollY.current,
        );
        router.replace({
          pathname: "/scene-editor",
          params: {
            sceneId: saved.sceneId,
            returnSceneId:
              typeof parentSceneId === "string" ? parentSceneId : undefined,
            restoreScroll: "true",
            createdFromChoice: createdFromChoiceLabel,
            createdFromScene: createdFromSceneTitle,
          },
        });
      }
    }, 700);

    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [
    existingScene,
    parentSceneId,
    hasUnsavedChanges,
    sceneHasContent,
    sceneTitle,
    sceneText,
    sceneTextFormatting,
    sceneType,
    dialogueTurns,
    choices,
    assets,
    scenePlaySettingsOverride,
    createdFromChoiceLabel,
    createdFromSceneTitle,
  ]);

  const sceneScrollKey = requestedSceneId
    ? `scene-editor:${requestedSceneId}`
    : undefined;

  useEffect(() => {
    if (!sceneScrollKey) return;

    if (restoreScroll === "true") {
      pendingRestoreY.current = getScrollPosition(sceneScrollKey);
    } else {
      clearScrollPosition(sceneScrollKey);
      pendingRestoreY.current = 0;
    }
  }, [restoreScroll, sceneScrollKey]);

  const restorePendingScroll = () => {
    if (pendingRestoreY.current === null) return;
    const y = pendingRestoreY.current;
    pendingRestoreY.current = null;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y, animated: false });
    });
  };

  const flushSceneBeforeNavigation = () => {
    autoSaveGeneration.current += 1;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    const saved = saveCurrentScene({ showAlerts: false });
    if (saved) {
      rememberScrollPosition(
        `scene-editor:${saved.sceneId}`,
        currentScrollY.current,
      );
    }
    return saved;
  };

  const navigateFromSceneOnce = (
    navigate: (savedSceneId: string) => void,
  ) => {
    if (navigationPending.current) return;
    navigationPending.current = true;

    const saved = flushSceneBeforeNavigation();
    if (!saved) {
      navigationPending.current = false;
      return;
    }

    navigate(saved.sceneId);
    setTimeout(() => {
      navigationPending.current = false;
    }, 500);
  };

  const previewCurrentScene = () => {
    navigateFromSceneOnce((savedSceneId) => {
      router.push({
        pathname: "/play",
        params: {
          startSceneId: savedSceneId,
          preview: "true",
          returnSceneId: savedSceneId,
        },
      });
    });
  };

  const openCurrentStoryTree = () => {
    navigateFromSceneOnce((savedSceneId) => {
      router.push({
        pathname: "/story",
        params: {
          openTree: "true",
          returnSceneId: savedSceneId,
        },
      });
    });
  };

  const goBackSafely = () => {
    autoSaveGeneration.current += 1;

    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }

    if (hasUnsavedChanges && (existingScene || sceneHasContent)) {
      const saved = saveCurrentScene({ showAlerts: false });
      if (!saved) return;
    }

    router.dismissTo("/story");
  };

  useLayoutEffect(() => {
    safeBackNavigation.current = goBackSafely;
  });

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        safeBackNavigation.current();
        return true;
      },
    );

    return () => backHandler.remove();
  }, []);

  const displaySaveStatus =
    saveStatus === "error" || persistenceStatus === "error"
      ? "error"
      : hasUnsavedChanges || persistenceStatus === "saving"
        ? "saving"
        : persistenceStatus === "saved"
          ? "saved"
          : "idle";

  const choice = activeChoiceLogicIndex !== null ? choices[activeChoiceLogicIndex] : undefined;
  const modalAvailableConditions = availableRememberedChoices.filter(
    (rememberedChoice) => rememberedChoice.id !== choice?.id,
  );
  const selectedRequiredValue = findStoryValueDefinition(choice?.requiredValue);
  const valueChanges = getChoiceValueChanges(choice);
  const visibilityMode = choice?.requiredValue
    ? "value"
    : choice?.requiredChoiceId || choice?.requiredTraceLabel?.trim()
      ? "remembered"
      : "always";


  return (
    <>
      <Stack.Screen
        options={{
          headerShown: Platform.OS !== "web",
          title:
            sceneId !== undefined && sceneId !== ""
              ? "Edit scene"
              : "New scene",
          headerBackVisible: false,
          gestureEnabled: false,
          headerLeft: () => (
            <Pressable
              onPress={() => safeBackNavigation.current()}
              accessibilityRole="button"
              accessibilityLabel="Back to story and save changes"
              hitSlop={12}
              style={styles.headerBackButton}
            >
              <Text style={styles.headerBackButtonText}>{"\u2190"}</Text>
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={[styles.container, { paddingBottom: 200 }]}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={50}
          onScroll={(event) => {
            const y = event.nativeEvent.contentOffset.y;
            currentScrollY.current = y;
            if (sceneScrollKey) rememberScrollPosition(sceneScrollKey, y);
          }}
          onContentSizeChange={restorePendingScroll}
        >
          <Pressable style={styles.backButton} onPress={goBackSafely}>
            <Text style={styles.backButtonText}>← Back to story</Text>
          </Pressable>

          <View style={styles.quickActionRow}>
            <Pressable
              style={styles.quickActionButton}
              onPress={previewCurrentScene}
              accessibilityRole="button"
              accessibilityLabel="Preview from this scene"
            >
              <Text style={styles.quickActionText}>▶ Preview</Text>
            </Pressable>
            <Pressable
              style={styles.quickActionButton}
              onPress={openCurrentStoryTree}
              accessibilityRole="button"
              accessibilityLabel="Open full-screen Story Tree"
            >
              <Text style={styles.quickActionText}>Story Tree</Text>
            </Pressable>
          </View>

          {returnScene && (
            <Pressable
              style={styles.returnSceneButton}
              onPress={() => {
                navigateFromSceneOnce(() => {
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.replace({
                      pathname: "/scene-editor",
                      params: {
                        sceneId: returnScene.id,
                        restoreScroll: "true",
                      },
                    });
                  }
                });
              }}
            >
              <Text style={styles.returnSceneButtonText}>
                ← Return to {returnScene.title || "previous scene"} scene
              </Text>
            </Pressable>
          )}

          {createdFromChoiceLabel && (
            <View style={styles.originChoiceCard}>
              <Text style={styles.originChoiceLabel}>Created from choice:</Text>
              <Text
                style={styles.originChoiceText}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {createdFromChoiceLabel}
              </Text>
              {createdFromSceneTitle && (
                <Text style={styles.originChoiceSubtext} numberOfLines={1}>
                  From scene: {createdFromSceneTitle}
                </Text>
              )}
            </View>
          )}

          {!createdFromChoiceLabel && !existingScene && parentScene && parentChoice && (
            <View style={styles.originChoiceCard}>
              <Text style={styles.originChoiceLabel}>
                Creating a new scene from
              </Text>

              <Text style={styles.originChoiceText}>
                “{parentChoice.label || "(empty choice)"}”
              </Text>

              <Text style={styles.originChoiceSubtext}>
                From scene: {parentScene.title || "Untitled scene"}
              </Text>
            </View>
          )}

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Scene details</Text>

            <Text style={styles.storyContext}>Story: {storyTitle}</Text>

            <Text style={styles.label}>Scene title</Text>
            <TextInput
              style={styles.input}
              placeholder="Untitled Scene"
              placeholderTextColor="#8C806F"
              value={sceneTitle}
              onChangeText={setSceneTitle}
            />

            {SHOW_WRITING_HINTS && editorHint && (
              <View style={styles.templateHint}>
                <Text style={styles.templateHintLabel}>Writing hint</Text>
                <Text style={styles.templateHintText}>{editorHint}</Text>
              </View>
            )}

            {showDialogueSceneOption && (
              <>
                <Text style={styles.label}>Scene format</Text>
                <View style={styles.sceneTypeRow}>
                  <Pressable
                    style={[
                      styles.sceneTypeButton,
                      sceneType === "story" && styles.sceneTypeButtonSelected,
                    ]}
                    onPress={() => setSceneType("story")}
                  >
                    <Text
                      style={[
                        styles.sceneTypeButtonText,
                        sceneType === "story" && styles.sceneTypeButtonTextSelected,
                      ]}
                    >
                      Story
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.sceneTypeButton,
                      sceneType === "dialogue" && styles.sceneTypeButtonSelected,
                    ]}
                    onPress={() => {
                      setSceneType("dialogue");
                      if (dialogueTurns.length === 0) {
                        setDialogueTurns([
                          { id: createDialogueTurnId(), speaker: "", text: "" },
                        ]);
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.sceneTypeButtonText,
                        sceneType === "dialogue" && styles.sceneTypeButtonTextSelected,
                      ]}
                    >
                      Dialogue
                    </Text>
                  </Pressable>
                </View>
              </>
            )}

            <Text style={styles.label}>
              {sceneType === "dialogue" ? "Scene setup text" : "Scene text"}
            </Text>

            <TextInput
              ref={sceneTextInputRef}
              style={[styles.input, styles.textArea]}
              placeholder={
                sceneType === "dialogue"
                  ? "Set the place, mood, or action before the conversation..."
                  : "Write what happens..."
              }
              placeholderTextColor="#8C806F"
              value={sceneText}
              onChangeText={updateSceneText}
              selection={sceneTextSelection}
              onSelectionChange={(event) =>
                setSceneTextSelection(event.nativeEvent.selection)
              }
              onFocus={() => {
                setTimeout(() => {
                  scrollRef.current?.scrollTo({
                    y: currentScrollY.current + 100,
                    animated: true,
                  });
                }, 250);
              }}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.richTextToolbar}>
              <Text style={styles.richTextToolbarLabel}>
                Select text, then format
              </Text>
              <View style={styles.richTextToolbarButtons}>
                {[
                  {
                    key: "bold" as const,
                    label: "B",
                    accessibilityLabel: "Make selected scene text bold",
                    textStyle: { fontWeight: "900" as const },
                  },
                  {
                    key: "italic" as const,
                    label: "I",
                    accessibilityLabel: "Make selected scene text italic",
                    textStyle: { fontStyle: "italic" as const },
                  },
                  {
                    key: "underline" as const,
                    label: "U",
                    accessibilityLabel: "Underline selected scene text",
                    textStyle: {
                      textDecorationLine: "underline" as const,
                    },
                  },
                ].map((option) => {
                  const disabled =
                    sceneTextSelection.start === sceneTextSelection.end;
                  return (
                    <Pressable
                      key={option.key}
                      style={[
                        styles.richTextButton,
                        disabled && styles.richTextButtonDisabled,
                      ]}
                      disabled={disabled}
                      onPress={() => formatSelectedSceneText(option.key)}
                      accessibilityLabel={option.accessibilityLabel}
                    >
                      <Text
                        style={[
                          styles.richTextButtonText,
                          option.textStyle,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {sceneTextFormatting.length > 0 && sceneText.length > 0 && (
              <View style={styles.richTextPreview}>
                <Text style={styles.richTextPreviewLabel}>
                  Formatting preview
                </Text>
                <Text style={styles.richTextPreviewText}>
                  {parseRichText(sceneText, sceneTextFormatting).map(
                    (span, index) => (
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
                    ),
                  )}
                </Text>
              </View>
            )}

            {sceneType === "dialogue" && (
              <View style={styles.dialogueEditorBox}>
                <Text style={styles.dialogueEditorTitle}>Dialogue lines</Text>
                <Text style={styles.dialogueEditorHint}>
                  Keep a conversation inside one scene, then add choices after it.
                </Text>

                {dialogueTurns.map((turn, index) => (
                  <View key={turn.id || index} style={styles.dialogueTurnCard}>
                    <View style={styles.dialogueTurnHeader}>
                      <Text style={styles.dialogueTurnNumber}>Line {index + 1}</Text>
                      <Pressable
                        style={styles.dialogueRemoveButton}
                        onPress={() => {
                          setDialogueTurns((currentTurns) =>
                            currentTurns.filter((_, turnIndex) => turnIndex !== index),
                          );
                        }}
                      >
                        <Text style={styles.dialogueRemoveButtonText}>Remove</Text>
                      </Pressable>
                    </View>

                    <TextInput
                      style={styles.dialogueSpeakerInput}
                      placeholder="Speaker name"
                      placeholderTextColor="#8C806F"
                      value={turn.speaker}
                      onChangeText={(text) => {
                        setDialogueTurns((currentTurns) =>
                          currentTurns.map((currentTurn, turnIndex) =>
                            turnIndex === index
                              ? { ...currentTurn, speaker: text }
                              : currentTurn,
                          ),
                        );
                      }}
                    />

                    <TextInput
                      style={[styles.dialogueLineInput, styles.textArea]}
                      placeholder="What do they say?"
                      placeholderTextColor="#8C806F"
                      value={turn.text}
                      onChangeText={(text) => {
                        setDialogueTurns((currentTurns) =>
                          currentTurns.map((currentTurn, turnIndex) =>
                            turnIndex === index
                              ? { ...currentTurn, text }
                              : currentTurn,
                          ),
                        );
                      }}
                      multiline
                      textAlignVertical="top"
                    />
                  </View>
                ))}

                <Pressable
                  style={styles.dialogueAddButton}
                  onPress={() => {
                    setDialogueTurns((currentTurns) => [
                      ...currentTurns,
                      { id: createDialogueTurnId(), speaker: "", text: "" },
                    ]);
                  }}
                >
                  <Text style={styles.dialogueAddButtonText}>Add dialogue line</Text>
                </Pressable>
              </View>
            )}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Scene Appearance</Text>
            <Text style={styles.sceneAppearanceHelper}>
              This scene uses Global Play Settings unless you turn on an
              override.
            </Text>

            <Pressable
              style={styles.sceneAppearanceToggle}
              onPress={() => {
                if (scenePlaySettingsOverride) {
                  setScenePlaySettingsOverride(undefined);
                } else {
                  enableSceneAppearanceOverride();
                }
              }}
              accessibilityRole="checkbox"
              accessibilityState={{
                checked: scenePlaySettingsOverride !== undefined,
              }}
            >
              <Text style={styles.checkbox}>
                {scenePlaySettingsOverride ? "\u2611" : "\u2610"}
              </Text>
              <View style={styles.checkboxTextArea}>
                <Text style={styles.checkboxLabel}>
                  Override global settings for this scene
                </Text>
                <Text style={styles.logicDescription}>
                  Choose different music, font, text size, or colours here.
                </Text>
              </View>
            </Pressable>

            {scenePlaySettingsOverride && (
              <View style={styles.sceneAppearanceOverrideBox}>
                <Text style={styles.appearanceOptionLabel}>
                  Background music
                </Text>
                <Text style={styles.sceneAppearanceStatus}>
                  {sceneBackgroundMusicName}
                </Text>

                <View style={styles.appearanceOptionRow}>
                  {SCENE_BACKGROUND_MUSIC.map((track) => {
                    const selected =
                      scenePlaySettingsOverride.backgroundMusic?.type ===
                        "built-in" &&
                      scenePlaySettingsOverride.backgroundMusic.builtInId ===
                        track.id;
                    return (
                      <Pressable
                        key={track.id}
                        style={[
                          styles.appearanceOptionButton,
                          selected && styles.appearanceOptionButtonSelected,
                        ]}
                        onPress={() =>
                          setSceneBackgroundMusic({
                            type: "built-in",
                            builtInId: track.id,
                            name: track.title,
                          })
                        }
                        accessibilityState={{ selected }}
                      >
                        <Text
                          style={[
                            styles.appearanceOptionText,
                            selected && styles.appearanceOptionTextSelected,
                          ]}
                        >
                          {track.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.sceneAppearanceActionRow}>
                  <Pressable
                    style={styles.sceneAppearanceActionButton}
                    onPress={uploadSceneBackgroundMusic}
                  >
                    <Text style={styles.sceneAppearanceActionText}>
                      Upload music
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.sceneAppearanceGhostButton}
                    onPress={() => setSceneBackgroundMusic(null)}
                  >
                    <Text style={styles.sceneAppearanceGhostText}>
                      No music
                    </Text>
                  </Pressable>
                </View>

                <Text style={styles.appearanceOptionLabel}>Play font</Text>
                <View style={styles.appearanceOptionRow}>
                  {PLAY_FONT_OPTIONS.map((option) => {
                    const selected =
                      scenePlaySettingsOverride.playAppearance.font ===
                      option.id;
                    return (
                      <Pressable
                        key={option.id}
                        style={[
                          styles.appearanceOptionButton,
                          selected && styles.appearanceOptionButtonSelected,
                        ]}
                        onPress={() =>
                          updateSceneAppearance({ font: option.id })
                        }
                        accessibilityState={{ selected }}
                      >
                        <Text
                          style={[
                            styles.appearanceOptionText,
                            option.nativeFamily
                              ? { fontFamily: option.nativeFamily }
                              : undefined,
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
                <View style={styles.appearanceOptionRow}>
                  {PLAY_TEXT_SIZE_OPTIONS.map((option) => {
                    const selected =
                      scenePlaySettingsOverride.playAppearance.textSize ===
                      option.id;
                    return (
                      <Pressable
                        key={option.id}
                        style={[
                          styles.appearanceOptionButton,
                          selected && styles.appearanceOptionButtonSelected,
                        ]}
                        onPress={() =>
                          updateSceneAppearance({ textSize: option.id })
                        }
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
                <View style={styles.appearanceOptionRow}>
                  {PLAY_THEMES.map((theme) => {
                    const selected =
                      scenePlaySettingsOverride.playAppearance.theme ===
                      theme.id;
                    return (
                      <Pressable
                        key={theme.id}
                        style={[
                          styles.sceneThemeButton,
                          {
                            backgroundColor: theme.sceneBackground,
                            borderColor: selected
                              ? theme.accent
                              : theme.border,
                          },
                          selected && styles.sceneThemeButtonSelected,
                        ]}
                        onPress={() =>
                          updateSceneAppearance({ theme: theme.id })
                        }
                        accessibilityLabel={`${theme.label} colour theme`}
                        accessibilityState={{ selected }}
                      >
                        <View
                          style={[
                            styles.sceneThemeSwatch,
                            { backgroundColor: theme.choiceBackground },
                          ]}
                        />
                        <Text
                          style={[
                            styles.sceneThemeText,
                            { color: theme.primaryText },
                          ]}
                        >
                          {theme.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  style={styles.resetSceneAppearanceButton}
                  onPress={() => setScenePlaySettingsOverride(undefined)}
                >
                  <Text style={styles.resetSceneAppearanceText}>
                    Reset to global settings
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          <Text style={styles.mainSectionHeading}>Choices</Text>

          {choices.map((choice, index) => {
            const targetScene = scenes.find(
              (scene) => scene.id === choice.targetSceneId,
            );
            const hasMissingTarget =
              Boolean(choice.targetSceneId) && !targetScene;
            const choiceConnectionKey = choice.id || String(index);

            const requiredRememberedChoice = availableRememberedChoices.find(
              (rememberedChoice) =>
                rememberedChoice.id === choice.requiredChoiceId,
            );


            const valueChanges = getChoiceValueChanges(choice);
            const selectedRequiredValue = findStoryValueDefinition(
              choice.requiredValue,
            );

            const requiredChoiceState = getRequiredChoiceState(choice);
            const rememberedMemoryName = choice.rememberChoice
              ? getChoiceMemoryName(choice)
              : undefined;
            const requiredMemoryName = requiredRememberedChoice?.choiceLabel;

            const valueChangeLabels = valueChanges.map((change) => {
              const definition = findStoryValueDefinition(change);
              return `${definition?.name || "A story value"} ${formatSignedAmount(change.amount)}`;
            });

            const requiredValueLabel =
              choice.requiredValue && selectedRequiredValue
                ? `${selectedRequiredValue.name} ${getStoryValueOperatorLabel(
                    choice.requiredValue.operator,
                  )} ${choice.requiredValue.amount ?? selectedRequiredValue.initialValue}`
                : choice.requiredValue?.name?.trim()
                  ? `${choice.requiredValue.name.trim()} ${getStoryValueOperatorLabel(
                      choice.requiredValue.operator,
                    )} ${choice.requiredValue.amount ?? 0}`
                  : undefined;

            return (
              <View key={choice.id || index} style={styles.choiceCard}>
                <View style={styles.choiceHeaderRow}>
                  <TextInput
                    style={styles.choiceTitleInput}
                    value={choice.label}
                    placeholder="Choice text"
                    onChangeText={(text) => {
                      persistChoices((currentChoices) =>
                        currentChoices.map((currentChoice, choiceIndex) =>
                          choiceIndex === index
                            ? { ...currentChoice, label: text }
                            : currentChoice,
                        ),
                      );
                    }}
                  />

                  <Pressable
                    style={styles.deleteChoiceButton}
                    onPress={() => {
                      persistChoices((currentChoices) =>
                        currentChoices.filter(
                          (_, choiceIndex) => choiceIndex !== index,
                        ),
                      );
                    }}
                  >
                    <Text style={styles.deleteChoiceText}>✕</Text>
                  </Pressable>
                </View>

                <View style={styles.choiceDestinationRow}>
                  <Text
                    style={[
                      styles.choiceDestinationText,
                      hasMissingTarget && styles.choiceDestinationMissingText,
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    <Text style={styles.choiceDestinationLabel}>Leads to: </Text>
                    {targetScene
                      ? getSceneDisplayName(targetScene)
                      : hasMissingTarget
                        ? "Missing scene — choose a new destination"
                        : "Not selected"}
                  </Text>

                  {choice.targetSceneId && targetScene && (
                    <Pressable
                      style={styles.destinationJumpButton}
                      onPress={() => {
                        const saved = saveCurrentScene();
                        if (!saved) return;

                        router.replace({
                          pathname: "/scene-editor",
                          params: {
                            sceneId: targetScene.id,
                            returnSceneId: saved.sceneId,
                          },
                        });
                      }}
                    >
                      <Text style={styles.destinationJumpButtonText}>Open {"\u2197"}</Text>
                    </Pressable>
                  )}
                </View>

                {connectionConfirmation?.choiceKey === choiceConnectionKey && (
                  <Text
                    style={styles.connectionConfirmationText}
                    accessibilityRole="alert"
                  >
                    {"\u2713"} Connected to {connectionConfirmation.destination}
                  </Text>
                )}

                {(rememberedMemoryName ||
                  requiredMemoryName ||
                  valueChangeLabels.length > 0 ||
                  requiredValueLabel) && (
                  <View style={styles.logicChipRow}>
                    {requiredValueLabel && (
                      <Text style={[styles.logicChip, styles.logicLockChip]}>
                        🔒 {requiredValueLabel}
                      </Text>
                    )}

                    {requiredMemoryName && (
                      <Text style={[styles.logicChip, styles.logicMemoryChip]}>
                        📌 {requiredChoiceState === "notRemembered" ? "without" : "needs"} {requiredMemoryName}
                      </Text>
                    )}

                    {rememberedMemoryName && (
                      <Text style={[styles.logicChip, styles.logicMemoryChip]}>
                        📌 remembers {rememberedMemoryName}
                      </Text>
                    )}

                    {valueChangeLabels.map((label, valueChangeIndex) => (
                      <Text
                        key={`value-change-${choice.id}-${valueChangeIndex}`}
                        style={[styles.logicChip, styles.logicValueChip]}
                      >
                        {"\uD83E\uDED0"} {label}
                      </Text>
                    ))}
                  </View>
                )}

                <View style={styles.choiceOrderRow}>
                  <Pressable
                    style={[
                      styles.choiceOrderButton,
                      index === 0 && styles.choiceOrderButtonDisabled,
                    ]}
                    disabled={index === 0}
                    onPress={() => moveChoice(index, -1)}
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${choice.label || "choice"} up`}
                    accessibilityState={{ disabled: index === 0 }}
                  >
                    <Text style={[
                      styles.choiceOrderText,
                      index === 0 && styles.choiceOrderTextDisabled,
                    ]}>↑ Move Up</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.choiceOrderButton,
                      index === choices.length - 1 && styles.choiceOrderButtonDisabled,
                    ]}
                    disabled={index === choices.length - 1}
                    onPress={() => moveChoice(index, 1)}
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${choice.label || "choice"} down`}
                    accessibilityState={{ disabled: index === choices.length - 1 }}
                  >
                    <Text style={[
                      styles.choiceOrderText,
                      index === choices.length - 1 && styles.choiceOrderTextDisabled,
                    ]}>↓ Move Down</Text>
                  </Pressable>
                </View>

                <View style={styles.choiceActionStack}>
                  <Pressable
                    style={styles.choiceActionButton}
                    onPress={() => {
                      setExpandedChoiceIndex(
                        expandedChoiceIndex === index ? null : index,
                      );
                    }}
                  >
                    <Text style={styles.choiceActionText}>
                      {expandedChoiceIndex === index
                        ? "Hide destination"
                        : "Change destination"}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.choiceActionButton}
                    onPress={() => setActiveChoiceLogicIndex(index)}
                  >
                    <Text style={styles.choiceActionText}>Choice logic</Text>
                  </Pressable>
                </View>

                {expandedChoiceIndex === index && (
                  <View style={styles.targetBox}>
                    <Text style={styles.logicSectionTitle}>
                      Where does this choice lead?
                    </Text>

                    {scenes.map((destinationScene) => {
                      const isSelected =
                        choice.targetSceneId === destinationScene.id;

                      return (
                        <View
                          key={destinationScene.id}
                          style={[
                            styles.targetOptionRow,
                            isSelected && styles.targetOptionRowSelected,
                          ]}
                        >
                          <Pressable
                            onPress={() => {
                              connectChoiceToScene(
                                choice,
                                index,
                                destinationScene,
                              );
                            }}
                            style={styles.targetSelectButton}
                          >
                            <Text
                              style={[
                                styles.targetCheckText,
                                isSelected && styles.targetOptionTextSelected,
                              ]}
                            >
                              {isSelected ? "\u2713" : " "}
                            </Text>
                            <Text
                              style={[
                                styles.targetOptionText,
                                isSelected && styles.targetOptionTextSelected,
                              ]}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {getSceneDisplayName(destinationScene)}
                              {destinationScene.id === existingScene?.id
                                ? " (this scene — loop)"
                                : ""}
                            </Text>
                          </Pressable>

                          <Pressable
                            style={[
                              styles.openTargetButton,
                              isSelected && styles.openTargetButtonSelected,
                            ]}
                            onPress={() => {
                              const saved = saveCurrentScene();
                              if (!saved) return;

                              router.replace({
                                pathname: "/scene-editor",
                                params: {
                                  sceneId: destinationScene.id,
                                  returnSceneId: saved.sceneId,
                                },
                              });
                            }}
                          >
                            <Text
                              style={[
                                styles.openTargetButtonText,
                                isSelected && styles.openTargetButtonTextSelected,
                              ]}
                            >
                              {"\u2197"}
                            </Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                )}

                {existingScene && (
                  <Pressable
                    style={styles.createNextSceneButton}
                    onPress={() => {
                      confirmAction(
                        "Change destination?",
                        "Create a new scene and change this choice\u2019s destination?",
                        "Create new scene",
                        () => {
                              const saved = flushSceneBeforeNavigation();
                              if (!saved) return;
                              const newSceneId = createSceneFromChoice(
                                saved.sceneId,
                                choice.id,
                                index,
                                true,
                              );

                              if (!newSceneId) {
                                Alert.alert(
                                  "Could not create scene",
                                  "The choice could not be linked. Please try again.",
                                );
                                return;
                              }

                              const linkedChoices = choicesRef.current.map(
                                (currentChoice, choiceIndex) =>
                                  (choice.id &&
                                    currentChoice.id === choice.id) ||
                                  (!choice.id && choiceIndex === index)
                                    ? {
                                        ...currentChoice,
                                        targetSceneId: newSceneId,
                                      }
                                    : currentChoice,
                              );
                              choicesRef.current = linkedChoices;
                              setChoices(linkedChoices);

                              router.push({
                                pathname: "/scene-editor",
                                params: {
                                  sceneId: newSceneId,
                                  returnSceneId: saved.sceneId,
                                  createdFromChoice:
                                    choice.label || "(empty choice)",
                                  createdFromScene:
                                    existingScene.title || "Untitled scene",
                                },
                              });
                        },
                      );
                    }}
                  >
                    <Text style={styles.choiceActionText}>
                      + Create new scene 🌿
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}

          {isAddingChoice ? (
            <View style={styles.addChoiceCard}>
              <View style={styles.titleWithInfo}>
                <Text style={styles.addChoiceTitle}>New choice</Text>

                <Pressable style={styles.infoButton} onPress={showChoiceInfo}>
                  <Text style={styles.infoButtonText}>i</Text>
                </Pressable>
              </View>

              <TextInput
                style={styles.addChoiceInput}
                placeholder="e.g. Follow the path"
                value={newChoice}
                onChangeText={setNewChoice}
                autoFocus
                onFocus={() => {
                  setTimeout(() => {
                    scrollRef.current?.scrollToEnd({ animated: true });
                  }, 300);
                }}
              />

              <View style={styles.addChoiceButtonRow}>
                <Pressable
                  style={styles.addChoiceCancelButton}
                  onPress={() => {
                    setNewChoice("");
                    setIsAddingChoice(false);
                  }}
                >
                  <Text style={styles.addChoiceCancelText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.addChoiceButton,
                    styles.addChoiceSubmitButton,
                    !newChoice.trim() && styles.addChoiceButtonDisabled,
                  ]}
                  onPress={() => {
                    if (!newChoice.trim()) return;

                    persistChoices((currentChoices) => [
                      ...currentChoices,
                      {
                        id: createChoiceId(),
                        label: newChoice.trim(),
                      },
                    ]);

                    setNewChoice("");
                    setIsAddingChoice(false);
                  }}
                >
                  <Text
                    style={[
                      styles.addChoiceButtonText,
                      styles.addChoiceSubmitButtonText,
                      !newChoice.trim() && styles.addChoiceButtonTextDisabled,
                    ]}
                  >
                    Add choice
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.addChoiceStatusRow}>
              <Pressable
                style={styles.addChoicePrimaryButton}
                onPress={() => {
                  setIsAddingChoice(true);
                  setTimeout(() => {
                    scrollRef.current?.scrollToEnd({ animated: true });
                  }, 100);
                }}
              >
                <Text style={styles.addChoicePrimaryText}>+ Add choice</Text>
              </Pressable>

              {isOpeningScene && (
                <View style={[styles.sceneStatusChip, styles.startStatusChip]}>
                  <Text style={[styles.sceneStatusText, styles.startStatusText]}>
                    Start
                  </Text>
                  <Pressable
                    style={styles.statusInfoButton}
                    onPress={showStartSceneInfo}
                  >
                    <Text style={styles.statusInfoButtonText}>i</Text>
                  </Pressable>
                </View>
              )}

              <View
                style={[
                  styles.sceneStatusChip,
                  styles.endingStatusChip,
                  choices.length === 0 && styles.endingStatusChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.sceneStatusText,
                    styles.endingStatusText,
                    choices.length === 0 && styles.endingStatusTextActive,
                  ]}
                >
                  {choices.length === 0 ? "Ending ✓" : "Ending"}
                </Text>
                <Pressable
                  style={styles.statusInfoButton}
                  onPress={showEndingSceneInfo}
                >
                  <Text style={styles.statusInfoButtonText}>i</Text>
                </Pressable>
              </View>
            </View>
          )}
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Scene media 🎨</Text>
              <Pressable
                style={styles.statusInfoButton}
                onPress={showSceneMediaInfo}
              >
                <Text style={styles.statusInfoButtonText}>i</Text>
              </Pressable>
            </View>

            <Text style={styles.mediaStatus}>
              {assets.length > 0
                ? `🎨 ${assets.length} media item${assets.length === 1 ? "" : "s"} added`
                : "No media added yet"}
            </Text>

            <Pressable
              style={styles.mediaButton}
              onPress={() => {
                const saved = saveCurrentScene();
                if (!saved) return;

                rememberScrollPosition(
                  `scene-editor:${saved.sceneId}`,
                  currentScrollY.current,
                );
                router.push({
                  pathname: "/scene-media",
                  params: { sceneId: saved.sceneId },
                });
              }}
            >
              <Text style={styles.mediaButtonText}>Edit media</Text>
            </Pressable>
          </View>

          <View
            style={[
              styles.autoSaveStatusBox,
              displaySaveStatus === "error" && styles.autoSaveStatusErrorBox,
            ]}
            accessibilityRole={displaySaveStatus === "error" ? "alert" : undefined}
          >
            <Text
              style={[
                styles.autoSaveStatusText,
                displaySaveStatus === "error" && styles.autoSaveStatusErrorText,
              ]}
            >
              {displaySaveStatus === "saving"
                ? "Saving..."
                : displaySaveStatus === "saved"
                  ? "Saved automatically"
                  : displaySaveStatus === "error"
                    ? "Could not save changes."
                    : "Changes save automatically"}
            </Text>
            {displaySaveStatus === "error" && (
              <Pressable
                style={styles.autoSaveRetryButton}
                onPress={() => {
                  setSaveStatus("saving");
                  const saved = saveCurrentScene({ showAlerts: false });
                  setSaveStatus(saved ? "saved" : "error");
                }}
                accessibilityRole="button"
                accessibilityLabel="Retry saving scene"
              >
                <Text style={styles.autoSaveRetryText}>Try again</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={activeChoiceLogicIndex !== null}
        animationType="slide"
        onRequestClose={() => setActiveChoiceLogicIndex(null)}
      >
        <KeyboardAvoidingView
          style={styles.logicModalScreen}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {activeChoiceLogicIndex !== null && choice ? (
              <ScrollView
                contentContainerStyle={styles.logicModalContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
              >
                <View style={styles.logicModalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.logicModalTitle}>Choice logic</Text>
                    <Text style={styles.logicModalSubtitle} numberOfLines={2}>
                      {choice.label || "Untitled choice"}
                    </Text>
                  </View>
                  <Pressable
                    style={styles.logicModalCloseButton}
                    onPress={() => setActiveChoiceLogicIndex(null)}
                  >
                    <Text style={styles.logicModalCloseText}>Done</Text>
                  </Pressable>
                </View>

                <View style={styles.logicModalSection}>
                  <View style={styles.logicModalSectionHeader}>
                    <Text style={styles.logicModalSectionTitle}>When the player chooses this</Text>
                    <Pressable style={styles.logicInfoButton} onPress={showChoiceConsequenceInfo}>
                      <Text style={styles.logicInfoButtonText}>i</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.logicModalHelper}>
                    Choose what the story should remember or change.
                  </Text>

                  <View style={styles.logicCompactGroup}>
                    <Pressable
                      style={styles.checkboxRow}
                      onPress={() => {
                        updateChoiceAt(activeChoiceLogicIndex, (currentChoice) => {
                          const shouldRemember = !currentChoice.rememberChoice;
                          return {
                            ...currentChoice,
                            id: currentChoice.id || createChoiceId(),
                            rememberChoice: shouldRemember,
                            rememberFeedbackEnabled: shouldRemember
                              ? currentChoice.rememberFeedbackEnabled
                              : false,
                            memoryName: shouldRemember
                              ? currentChoice.memoryName || createMemoryName(currentChoice.label)
                              : currentChoice.memoryName,
                          };
                        });
                      }}
                    >
                      <Text style={styles.checkbox}>{choice.rememberChoice ? "\u2611" : "\u2610"}</Text>
                      <View style={styles.checkboxTextArea}>
                        <Text style={styles.checkboxLabel}>📌 Remember this choice</Text>
                        <Text style={styles.logicDescription}>
                          The story can use this later to unlock another path.
                        </Text>
                      </View>
                    </Pressable>

                    {choice.rememberChoice && (
                      <View style={styles.memoryNameBox}>
                        <Text style={styles.choiceMetaLabel}>The story will remember</Text>
                        <TextInput
                          style={styles.memoryNameInput}
                          value={getChoiceMemoryName(choice)}
                          onChangeText={(text) => {
                            updateChoiceAt(activeChoiceLogicIndex, (currentChoice) => ({
                              ...currentChoice,
                              id: currentChoice.id || createChoiceId(),
                              memoryName: text,
                            }));
                          }}
                          autoCapitalize="none"
                          autoCorrect={false}
                          placeholder="helped_bird"
                        />

                        <View style={styles.feedbackBox}>
                          <Pressable
                            style={styles.checkboxRow}
                            onPress={() => {
                              updateChoiceAt(activeChoiceLogicIndex, (currentChoice) => ({
                                ...currentChoice,
                                rememberFeedbackEnabled: !currentChoice.rememberFeedbackEnabled,
                              }));
                            }}
                          >
                            <Text style={styles.checkbox}>
                              {choice.rememberFeedbackEnabled ? "\u2611" : "\u2610"}
                            </Text>
                            <View style={styles.checkboxTextArea}>
                              <Text style={styles.checkboxLabel}>Show feedback in Play mode</Text>
                              <Text style={styles.logicDescription}>
                                Briefly tells the player that the choice was remembered.
                              </Text>
                            </View>
                          </Pressable>
                          {choice.rememberFeedbackEnabled && (
                            <TextInput
                              style={styles.feedbackInput}
                              value={choice.rememberFeedbackMessage || ""}
                              onChangeText={(text) => {
                                updateChoiceAt(activeChoiceLogicIndex, (currentChoice) => ({
                                  ...currentChoice,
                                  rememberFeedbackMessage: text,
                                }));
                              }}
                              placeholder="This choice will be remembered."
                              multiline
                            />
                          )}
                        </View>
                      </View>
                    )}
                  </View>

                  <View style={styles.logicCompactGroupLast}>
                    <Text style={styles.logicGroupTitle}>{"\uD83E\uDED0"} Change a story value</Text>
                    <Text style={styles.logicDescription}>
                      Pick a value and enter how much it should increase or decrease.
                    </Text>

                    {storyValueDefinitions.length > 0 ? (
                      <View>
                        {valueChanges.length === 0 && (
                          <View style={styles.valueChipRow}>
                            {storyValueDefinitions.map((storyValue) => (
                              <Pressable
                                key={`change-first-${storyValue.id}`}
                                style={styles.valueChip}
                                onPress={() => updateChoiceAt(
                                  activeChoiceLogicIndex,
                                  (currentChoice) => ({
                                    ...currentChoice,
                                    valueChanges: [
                                      ...getChoiceValueChanges(currentChoice),
                                      { valueId: storyValue.id, amount: 1 },
                                    ],
                                    valueChange: undefined,
                                  }),
                                )}
                              >
                                <Text style={styles.valueChipText}>{storyValue.name}</Text>
                              </Pressable>
                            ))}
                          </View>
                        )}

                        {valueChanges.map((change, changeIndex) => {
                          const selectedValue = findStoryValueDefinition(change);
                          const selectedElsewhere = new Set(
                            valueChanges
                              .filter((_, index) => index !== changeIndex)
                              .map((otherChange) => otherChange.valueId),
                          );

                          return (
                            <View
                              key={`value-change-editor-${changeIndex}-${change.valueId}`}
                              style={styles.valueChangeEditor}
                            >
                              <View style={styles.valueChangeEditorHeader}>
                                <Text style={styles.choiceMetaLabel}>
                                  {valueChanges.length > 1
                                    ? `Value change ${changeIndex + 1}`
                                    : "Story value"}
                                </Text>
                                <Pressable
                                  style={styles.removeValueChangeButton}
                                  onPress={() => updateChoiceAt(
                                    activeChoiceLogicIndex,
                                    (currentChoice) => {
                                      const nextChanges = getChoiceValueChanges(currentChoice)
                                        .filter((_, index) => index !== changeIndex);
                                      return {
                                        ...currentChoice,
                                        valueChanges: nextChanges,
                                        valueChange: undefined,
                                        valueFeedbackEnabled:
                                          nextChanges.length > 0
                                            ? currentChoice.valueFeedbackEnabled
                                            : false,
                                      };
                                    },
                                  )}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Remove ${selectedValue?.name || "story value"} change`}
                                >
                                  <Text style={styles.removeValueChangeText}>Remove</Text>
                                </Pressable>
                              </View>

                              <View style={styles.valueChipRow}>
                                {storyValueDefinitions.map((storyValue) => {
                                  const isSelected = change.valueId === storyValue.id;
                                  const isUnavailable = selectedElsewhere.has(storyValue.id);

                                  return (
                                    <Pressable
                                      key={`change-${changeIndex}-${storyValue.id}`}
                                      style={[
                                        styles.valueChip,
                                        isSelected && styles.valueChipSelected,
                                        isUnavailable && styles.valueChipDisabled,
                                      ]}
                                      disabled={isUnavailable}
                                      onPress={() => updateChoiceAt(
                                        activeChoiceLogicIndex,
                                        (currentChoice) => ({
                                          ...currentChoice,
                                          valueChanges: getChoiceValueChanges(currentChoice).map(
                                            (currentChange, index) =>
                                              index === changeIndex
                                                ? { ...currentChange, valueId: storyValue.id }
                                                : currentChange,
                                          ),
                                          valueChange: undefined,
                                        }),
                                      )}
                                      accessibilityState={{
                                        selected: isSelected,
                                        disabled: isUnavailable,
                                      }}
                                    >
                                      <Text
                                        style={[
                                          styles.valueChipText,
                                          isSelected && styles.valueChipTextSelected,
                                          isUnavailable && styles.valueChipTextDisabled,
                                        ]}
                                      >
                                        {storyValue.name}
                                      </Text>
                                    </Pressable>
                                  );
                                })}
                              </View>

                              <View style={styles.valueChangeAmountRow}>
                                <Text style={styles.choiceMetaLabel}>Change by</Text>
                                <View style={styles.valueAmountControl}>
                                  <Pressable
                                    style={styles.valueAmountButton}
                                    onPress={() => updateChoiceAt(
                                      activeChoiceLogicIndex,
                                      (currentChoice) => ({
                                        ...currentChoice,
                                        valueChanges: getChoiceValueChanges(currentChoice).map(
                                          (currentChange, index) =>
                                            index === changeIndex
                                              ? { ...currentChange, amount: currentChange.amount - 1 }
                                              : currentChange,
                                        ),
                                        valueChange: undefined,
                                      }),
                                    )}
                                    accessibilityLabel={`Decrease ${selectedValue?.name || "story value"} change`}
                                  >
                                    <Text style={styles.valueAmountButtonText}>-</Text>
                                  </Pressable>
                                  <SignedAmountInput
                                    value={change.amount}
                                    onChange={(amount) => updateChoiceAt(
                                      activeChoiceLogicIndex,
                                      (currentChoice) => ({
                                        ...currentChoice,
                                        valueChanges: getChoiceValueChanges(currentChoice).map(
                                          (currentChange, index) =>
                                            index === changeIndex
                                              ? { ...currentChange, amount }
                                              : currentChange,
                                        ),
                                        valueChange: undefined,
                                      }),
                                    )}
                                  />
                                  <Pressable
                                    style={styles.valueAmountButton}
                                    onPress={() => updateChoiceAt(
                                      activeChoiceLogicIndex,
                                      (currentChoice) => ({
                                        ...currentChoice,
                                        valueChanges: getChoiceValueChanges(currentChoice).map(
                                          (currentChange, index) =>
                                            index === changeIndex
                                              ? { ...currentChange, amount: currentChange.amount + 1 }
                                              : currentChange,
                                        ),
                                        valueChange: undefined,
                                      }),
                                    )}
                                    accessibilityLabel={`Increase ${selectedValue?.name || "story value"} change`}
                                  >
                                    <Text style={styles.valueAmountButtonText}>+</Text>
                                  </Pressable>
                                </View>
                              </View>
                            </View>
                          );
                        })}

                        {valueChanges.length > 0 &&
                          valueChanges.length < storyValueDefinitions.length && (
                            <Pressable
                              style={styles.addValueChangeButton}
                              onPress={() => updateChoiceAt(
                                activeChoiceLogicIndex,
                                (currentChoice) => {
                                  const currentChanges = getChoiceValueChanges(currentChoice);
                                  const usedValueIds = new Set(
                                    currentChanges.map((change) => change.valueId),
                                  );
                                  const nextValue = storyValueDefinitions.find(
                                    (storyValue) => !usedValueIds.has(storyValue.id),
                                  );
                                  if (!nextValue) return currentChoice;

                                  return {
                                    ...currentChoice,
                                    valueChanges: [
                                      ...currentChanges,
                                      { valueId: nextValue.id, amount: 1 },
                                    ],
                                    valueChange: undefined,
                                  };
                                },
                              )}
                            >
                              <Text style={styles.addValueChangeButtonText}>
                                + Change another value
                              </Text>
                            </Pressable>
                          )}

                        {valueChanges.length > 0 && (
                          <View style={styles.feedbackBox}>
                            <Pressable
                              style={styles.checkboxRow}
                              onPress={() => updateChoiceAt(
                                activeChoiceLogicIndex,
                                (currentChoice) => ({
                                  ...currentChoice,
                                  valueFeedbackEnabled: !currentChoice.valueFeedbackEnabled,
                                }),
                              )}
                            >
                              <Text style={styles.checkbox}>
                                {choice.valueFeedbackEnabled ? "\u2611" : "\u2610"}
                              </Text>
                              <View style={styles.checkboxTextArea}>
                                <Text style={styles.checkboxLabel}>Show feedback in Play mode</Text>
                                <Text style={styles.logicDescription}>
                                  Briefly summarizes all value changes together.
                                </Text>
                              </View>
                            </Pressable>
                            {choice.valueFeedbackEnabled && (
                              <TextInput
                                style={styles.feedbackInput}
                                value={choice.valueFeedbackMessage || ""}
                                onChangeText={(text) => updateChoiceAt(
                                  activeChoiceLogicIndex,
                                  (currentChoice) => ({
                                    ...currentChoice,
                                    valueFeedbackMessage: text,
                                  }),
                                )}
                                placeholder="Confidence +1 \u00B7 Energy \u22122"
                                multiline
                              />
                            )}
                          </View>
                        )}
                      </View>
                    ) : (
                      <Text style={styles.logicEmptyText}>No story values yet</Text>
                    )}
                  </View>
                </View>

                <View style={styles.logicModalSection}>
                  <View style={styles.logicModalSectionHeader}>
                    <Text style={styles.logicModalSectionTitle}>When this choice appears</Text>
                    <Pressable style={styles.logicInfoButton} onPress={showChoiceVisibilityInfo}>
                      <Text style={styles.logicInfoButtonText}>i</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.logicModalHelper}>
                    Choose one rule for when the player can see this choice.
                  </Text>

                  <Pressable
                    style={[styles.logicRowButton, visibilityMode === "always" && styles.logicRowButtonSelected]}
                    onPress={() => updateChoiceAt(activeChoiceLogicIndex, (currentChoice) => ({
                      ...currentChoice,
                      requiredChoiceId: undefined,
                      requiredChoiceState: undefined,
                      requiredTraceLabel: undefined,
                      requiredValue: undefined,
                    }))}
                  >
                    <Text style={[styles.logicRowButtonText, visibilityMode === "always" && styles.logicRowButtonTextSelected]}>
                      Always
                    </Text>
                  </Pressable>

                  <View style={styles.logicCompactGroup}>
                    <Text style={styles.logicGroupTitle}>📌 Only when a remembered choice condition is met</Text>
                    <Text style={styles.logicDescription}>
                      Show this choice after another choice was remembered, or while it is not remembered.
                    </Text>
                    {modalAvailableConditions.length > 0 ? (
                      <>
                        <View style={styles.rememberedChoiceList}>
                          {modalAvailableConditions.map((rememberedChoice) => {
                            const isSelected = choice.requiredChoiceId === rememberedChoice.id;
                            return (
                              <Pressable
                                key={`condition-${rememberedChoice.id}`}
                                style={[styles.rememberedChoiceChip, isSelected && styles.rememberedChoiceChipSelected]}
                                onPress={() => updateChoiceAt(activeChoiceLogicIndex, (currentChoice) => ({
                                  ...currentChoice,
                                  requiredChoiceId: rememberedChoice.id,
                                  requiredChoiceState: isSelected
                                    ? currentChoice.requiredChoiceState || "remembered"
                                    : "remembered",
                                  requiredTraceLabel: undefined,
                                  requiredValue: undefined,
                                }))}
                              >
                                <Text style={[styles.rememberedChoiceChipText, isSelected && styles.rememberedChoiceChipTextSelected]}>
                                  {rememberedChoice.choiceLabel}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                        {choice.requiredChoiceId && (
                          <View style={styles.conditionStateRow}>
                            {(["remembered", "notRemembered"] as const).map((state) => (
                              <Pressable
                                key={state}
                                style={[styles.logicOptionButton, getRequiredChoiceState(choice) === state && styles.logicOptionButtonSelected]}
                                onPress={() => updateChoiceAt(activeChoiceLogicIndex, (currentChoice) => ({
                                  ...currentChoice,
                                  requiredChoiceState: state,
                                }))}
                              >
                                <Text style={[styles.logicOptionText, getRequiredChoiceState(choice) === state && styles.logicOptionTextSelected]}>
                                  {state === "remembered" ? "Is remembered" : "Is not remembered"}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        )}
                      </>
                    ) : (
                      <Text style={styles.logicEmptyText}>No other remembered choices yet</Text>
                    )}
                  </View>

                  <View style={styles.logicCompactGroupLast}>
                    <Text style={styles.logicGroupTitle}>🫐 Only when a story-value condition is met</Text>
                    <Text style={styles.logicDescription}>
                      Compare one value with a number before showing this choice.
                    </Text>
                    {storyValueDefinitions.length > 0 ? (
                      <View>
                        <View style={styles.valueChipRow}>
                          {storyValueDefinitions.map((storyValue) => {
                            const isSelected =
                              choice.requiredValue?.valueId === storyValue.id ||
                              choice.requiredValue?.name === storyValue.name;
                            return (
                              <Pressable
                                key={`required-${storyValue.id}`}
                                style={[styles.valueChip, isSelected && styles.valueChipSelected]}
                                onPress={() => updateChoiceAt(activeChoiceLogicIndex, (currentChoice) => ({
                                  ...currentChoice,
                                  requiredChoiceId: undefined,
                                  requiredChoiceState: undefined,
                                  requiredTraceLabel: undefined,
                                  requiredValue: {
                                    valueId: storyValue.id,
                                    name: storyValue.name,
                                    operator: isSelected
                                      ? currentChoice.requiredValue?.operator || "atLeast"
                                      : "atLeast",
                                    amount: isSelected
                                      ? currentChoice.requiredValue?.amount ?? storyValue.initialValue
                                      : storyValue.initialValue,
                                  },
                                }))}
                              >
                                <Text style={[styles.valueChipText, isSelected && styles.valueChipTextSelected]}>
                                  {storyValue.name}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>

                        {selectedRequiredValue && choice.requiredValue && (
                          <View style={styles.logicInlineControls}>
                            <Pressable
                              style={styles.operatorPill}
                              onPress={() => updateChoiceAt(activeChoiceLogicIndex, (currentChoice) => ({
                                ...currentChoice,
                                requiredValue: {
                                  ...currentChoice.requiredValue!,
                                  valueId: selectedRequiredValue.id,
                                  name: selectedRequiredValue.name,
                                  operator: getNextStoryValueOperator(currentChoice.requiredValue?.operator),
                                },
                              }))}
                            >
                              <Text style={styles.operatorPillText}>
                                {getStoryValueOperatorLabel(choice.requiredValue.operator)}
                              </Text>
                            </Pressable>
                            <View style={styles.valueAmountControl}>
                              {[-1, 1].map((amountDelta) => (
                                <Pressable
                                  key={amountDelta}
                                  style={styles.valueAmountButton}
                                  onPress={() => updateChoiceAt(activeChoiceLogicIndex, (currentChoice) => ({
                                    ...currentChoice,
                                    requiredValue: {
                                      ...currentChoice.requiredValue!,
                                      amount: (currentChoice.requiredValue?.amount ?? selectedRequiredValue.initialValue) + amountDelta,
                                    },
                                  }))}
                                >
                                  <Text style={styles.valueAmountButtonText}>{amountDelta < 0 ? "-" : "+"}</Text>
                                </Pressable>
                              ))}
                              <Text style={styles.valueAmountText}>{choice.requiredValue.amount}</Text>
                            </View>
                          </View>
                        )}
                      </View>
                    ) : (
                      <Text style={styles.logicEmptyText}>No story values yet</Text>
                    )}
                  </View>
                </View>
              </ScrollView>
          ) : null}
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 52,
    paddingBottom: 100,
    backgroundColor: "#F7F1E1", // Add this extra padding so the button clears the bottom edge!
  },

  buttonSaved: {
    backgroundColor: "#4F6F52",
  },

  autoSaveStatusBox: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D8CCAA",
    backgroundColor: "#E9F2DD",
  },

  autoSaveStatusErrorBox: {
    backgroundColor: "#FFF1EC",
    borderColor: "#C86B55",
  },

  autoSaveStatusText: {
    color: "#4F6F52",
    fontWeight: "900",
  },

  autoSaveStatusErrorText: {
    color: "#8A382B",
  },

  autoSaveRetryButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#C86B55",
  },

  autoSaveRetryText: {
    color: "#8A382B",
    fontSize: 14,
    fontWeight: "800",
  },

  returnSceneButton: {
    backgroundColor: "#FFFCF2",
    borderWidth: 1,
    borderColor: "#D8CCAA",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    marginBottom: 12,
  },

  logicSubsection: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#E6E6E6",
  },

  logicSubsectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#222",
    marginBottom: 8,
  },

  logicSubsectionText: {
    fontSize: 14,
    color: "#665D4E",
    lineHeight: 20,
    marginBottom: 10,
  },

  titleWithInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  infoButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF5EA",
    borderWidth: 1,
    borderColor: "#D6E5D0",
  },

  infoButtonText: {
    color: "#4F6F52",
    fontSize: 16,
    fontWeight: "800",
  },

  inlineLabelWithInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },

  smallInfoButton: {
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF5EA",
    borderWidth: 1,
    borderColor: "#D6E5D0",
  },

  smallInfoButtonText: {
    color: "#4F6F52",
    fontSize: 13,
    fontWeight: "800",
  },

  checkboxTextArea: {
    flex: 1,
  },

  returnSceneButtonText: {
    color: "#3D3528",
    fontWeight: "700",
  },

  choiceTitleInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D8CCAA",
    borderRadius: 22,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 15,
    fontWeight: "600",
    backgroundColor: "#FFFDF7",
    marginRight: 8,
  },

  choiceDestinationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    marginBottom: 6,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },

  choiceDestinationText: {
    flexShrink: 1,
    maxWidth: 250,
    color: "#3D3528",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
  },
  choiceDestinationMissingText: {
    color: "#A33F32",
  },

  connectionConfirmationText: {
    alignSelf: "flex-start",
    color: "#247322",
    backgroundColor: "#E9F2DD",
    borderWidth: 1,
    borderColor: "#BFD5A9",
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginBottom: 8,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900",
  },

  choiceDestinationLabel: {
    color: "#665D4E",
    fontWeight: "700",
  },

  destinationJumpButton: {
    minWidth: 72,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFDF7",
    borderWidth: 1,
    borderColor: "#D8CCAA",
  },

  destinationJumpButtonText: {
    color: "#247322",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
  },

  targetOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D8CCAA",
    backgroundColor: "#FFFDF7",
  },

  targetOptionRowSelected: {
    borderColor: "#247322",
    backgroundColor: "#247322",
  },

  targetSelectButton: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 6,
  },

  targetCheckText: {
    width: 18,
    color: "#8C806F",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },

  openTargetButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
    backgroundColor: "#F7F1E1",
    borderWidth: 1,
    borderColor: "#D8CCAA",
  },

  openTargetButtonSelected: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderColor: "rgba(255, 255, 255, 0.5)",
  },

  openTargetButtonText: {
    color: "#247322",
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 18,
  },

  openTargetButtonTextSelected: {
    color: "#fff",
  },

  originChoiceCard: {
    backgroundColor: "#FFFCF2",
    borderWidth: 1,
    borderColor: "#C9B46F",
    borderRadius: 20,
    padding: 14,
    marginBottom: 16,
  },

  originChoiceLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#8A6400",
    fontWeight: "700",
    marginBottom: 4,
  },

  originChoiceText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#3D3528",
    marginBottom: 4,
  },

  originChoiceSubtext: {
    color: "#665D4E",
    lineHeight: 20,
  },

  valueChipSelected: {
    backgroundColor: "#247322",
    borderColor: "#247322",
  },

  valueChipTextSelected: {
    color: "#fff",
  },

  valueConditionBox: {
    marginTop: 4,
    marginBottom: 8,
    gap: 8,
  },

  valueAmountControl: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#D8CCAA",
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#FFFCF2",
  },

  valueAmountButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },

  valueAmountButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#3D3528",
  },

  valueAmountText: {
    minWidth: 44,
    textAlign: "center",
    fontWeight: "700",
    color: "#3D3528",
  },

  valueChangeDirectionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },

  valueDirectionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#FFFCF2",
    borderWidth: 1,
    borderColor: "#D8CCAA",
  },

  valueDirectionButtonSelected: {
    backgroundColor: "#247322",
    borderColor: "#247322",
  },

  valueDirectionText: {
    color: "#3D3528",
    fontWeight: "700",
  },

  valueDirectionTextSelected: {
    color: "#fff",
  },

  choiceOrderRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  choiceOrderButton: {
    borderWidth: 1,
    borderColor: "#B8CDA4",
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 11,
    backgroundColor: "#F1F7E9",
  },
  choiceOrderButtonDisabled: {
    borderColor: "#DDD6C5",
    backgroundColor: "#F4F1E9",
  },
  choiceOrderText: {
    color: "#247322",
    fontSize: 13,
    fontWeight: "900",
  },
  choiceOrderTextDisabled: {
    color: "#A39A8B",
  },
  choiceActionStack: {
    marginTop: 4,
    gap: 4,
  },

  advancedSectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#3D3528",
    marginTop: 12,
    marginBottom: 6,
  },

  logicHelperText: {
    color: "#8C806F",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },

  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },

  valueInput: {
    borderWidth: 1,
    borderColor: "#D8CCAA",
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: "#FFFCF2",
  },

  valueNameInput: {
    flex: 1,
  },

  valueNumberInput: {
    width: 72,
  },

  operatorPill: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#FFFCF2",
    borderWidth: 1,
    borderColor: "#D8CCAA",
  },

  operatorPillText: {
    fontSize: 12,
    color: "#3D3528",
    fontWeight: "600",
  },

  valueChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },

  valueChangeEditor: {
    borderWidth: 1,
    borderColor: "#D8CCAA",
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
    backgroundColor: "#FFFCF2",
  },

  valueChangeEditorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },

  valueChangeAmountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  valueChangeAmountInput: {
    minWidth: 84,
    minHeight: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#8BA676",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    color: "#2A251D",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },

  removeValueChangeButton: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 8,
  },

  removeValueChangeText: {
    color: "#A44132",
    fontSize: 13,
    fontWeight: "700",
  },

  addValueChangeButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    marginTop: 2,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#4F7F3B",
    borderRadius: 14,
    backgroundColor: "#EEF6E7",
  },

  addValueChangeButtonText: {
    color: "#2D6B2F",
    fontSize: 14,
    fontWeight: "800",
  },

  valueChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#FFFCF2",
    borderWidth: 1,
    borderColor: "#D8CCAA",
  },

  valueChipText: {
    fontSize: 12,
    color: "#3D3528",
  },

  valueChipDisabled: {
    opacity: 0.42,
  },

  valueChipTextDisabled: {
    color: "#746E63",
  },
  mainSectionHeading: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    color: "#2A251D",
    marginTop: 8,
    marginBottom: 14,
  },
  heading: {
    fontSize: 24,
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    marginBottom: 8,
    marginTop: 10,
    color: "#2A251D",
    fontWeight: "800",
  },
  input: {
    borderWidth: 2,
    borderColor: "#9BAF78",
    borderRadius: 20,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "#FFFDF7",
    color: "#1F1A14",
    fontSize: 16,
    fontWeight: "700",
  },
  textArea: {
    minHeight: 140,
    fontWeight: "600",
    lineHeight: 24,
  },

  richTextToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D8CCAA",
    backgroundColor: "#F9F5E8",
  },

  richTextToolbarLabel: {
    flex: 1,
    color: "#665D4E",
    fontSize: 12,
    fontWeight: "800",
  },

  richTextToolbarButtons: {
    flexDirection: "row",
    gap: 6,
  },

  richTextButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#8AAA72",
    backgroundColor: "#FFFDF7",
  },

  richTextButtonDisabled: {
    opacity: 0.35,
  },

  richTextButtonText: {
    color: "#28751F",
    fontSize: 16,
  },

  richTextPreview: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#C9D8B8",
    backgroundColor: "#F2F8E9",
  },

  richTextPreviewLabel: {
    color: "#28751F",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  richTextPreviewText: {
    color: "#2A251D",
    fontSize: 15,
    lineHeight: 22,
  },


  templateHint: {
    borderLeftWidth: 3,
    borderLeftColor: "#8AAA72",
    backgroundColor: "#EEF5E5",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  templateHintLabel: {
    color: "#247322",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 3,
  },
  templateHintText: {
    color: "#4F493E",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
  sceneTypeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },

  sceneTypeButton: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D8CCAA",
    backgroundColor: "#FFFDF7",
    alignItems: "center",
  },

  sceneTypeButtonSelected: {
    backgroundColor: "#247322",
    borderColor: "#247322",
  },

  sceneTypeButtonText: {
    color: "#3D3528",
    fontWeight: "900",
  },

  sceneTypeButtonTextSelected: {
    color: "#fff",
  },

  dialogueEditorBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D8CCAA",
    backgroundColor: "#F5EFD9",
  },

  dialogueEditorTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#2A251D",
    marginBottom: 4,
  },

  dialogueEditorHint: {
    color: "#665D4E",
    lineHeight: 19,
    fontWeight: "700",
    marginBottom: 10,
  },

  dialogueTurnCard: {
    borderWidth: 1,
    borderColor: "#D8CCAA",
    borderRadius: 16,
    padding: 10,
    marginBottom: 10,
    backgroundColor: "#FFFDF7",
  },

  dialogueTurnHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },

  dialogueTurnNumber: {
    color: "#665D4E",
    fontWeight: "900",
  },

  dialogueRemoveButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#FFF0E9",
    borderWidth: 1,
    borderColor: "#E1B7A8",
  },

  dialogueRemoveButtonText: {
    color: "#9B3A2F",
    fontWeight: "900",
    fontSize: 12,
  },

  dialogueSpeakerInput: {
    borderWidth: 1,
    borderColor: "#D8CCAA",
    borderRadius: 16,
    padding: 10,
    marginBottom: 8,
    backgroundColor: "#FFFCF2",
    color: "#1F1A14",
    fontWeight: "800",
  },

  dialogueLineInput: {
    borderWidth: 1,
    borderColor: "#D8CCAA",
    borderRadius: 16,
    padding: 10,
    minHeight: 84,
    backgroundColor: "#FFFCF2",
    color: "#1F1A14",
    fontWeight: "600",
  },

  dialogueAddButton: {
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#6E9358",
    backgroundColor: "#E9F2DD",
    alignItems: "center",
  },

  dialogueAddButtonText: {
    color: "#247322",
    fontWeight: "900",
  },
  storyContext: {
    color: "#4A4034",
    marginBottom: 16,
    fontWeight: "700",
  },

  buttonSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#D8CCAA",
  },
  button: {
    backgroundColor: "#247322",
    paddingVertical: 14,
    borderRadius: 20,
    marginTop: 24,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "900",
  },
  prompt: {
    fontSize: 13,
    color: "#665D4E",
    marginBottom: 8,
    fontStyle: "italic",
  },

  helperText: {
    color: "#8C806F",
    marginBottom: 16,
    lineHeight: 20,
  },

  choiceMetaLabel: {
    fontSize: 12,
    color: "#8C806F",
    marginTop: 10,
    marginBottom: 6,
  },

  choiceCard: {
    borderWidth: 1,
    borderColor: "#D8CCAA",
    borderRadius: 20,
    padding: 12,
    marginBottom: 14,
    backgroundColor: "#FFFCF2",
  },

  choiceHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  choiceTitle: {
    fontWeight: "600",
    fontSize: 15,
    flex: 1,
    paddingRight: 8,
  },

  deleteChoiceButton: {
    padding: 8,
  },

  deleteChoiceText: {
    color: "#ff3b30",
    fontWeight: "700",
    fontSize: 18,
  },

  choiceTargetText: {
    color: "#665D4E",
    marginTop: 4,
    marginBottom: 8,
  },

  choiceActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginTop: 4,
  },

  choiceActionButton: {
    paddingVertical: 6,
  },

  choiceActionText: {
    color: "#247322",
    fontWeight: "600",
  },


  logicChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
    marginBottom: 8,
  },

  logicChip: {
    overflow: "hidden",
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 8,
    fontSize: 12,
    fontWeight: "800",
  },

  logicLockChip: {
    color: "#6E4D00",
    backgroundColor: "#FFF0B8",
  },

  logicMemoryChip: {
    color: "#247322",
    backgroundColor: "#E9F2DD",
  },

  logicValueChip: {
    color: "#2F5D8C",
    backgroundColor: "#E8F0FF",
  },

  logicModalScreen: {
    flex: 1,
    backgroundColor: "#F7F1E1",
  },

  logicModalContent: {
    padding: 20,
    paddingTop: 48,
    paddingBottom: 180,
  },

  logicModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },

  logicModalTitle: {
    color: "#2A251D",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
  },

  logicModalSubtitle: {
    color: "#665D4E",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 3,
  },

  logicModalCloseButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#247322",
    borderWidth: 1,
    borderColor: "#247322",
  },

  logicModalCloseText: {
    color: "#fff",
    fontWeight: "900",
  },

  logicModalSection: {
    backgroundColor: "#FFFCF2",
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "#D8CCAA",
    marginBottom: 14,
  },

  logicModalSectionTitle: {
    color: "#2A251D",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "900",
    marginBottom: 4,
  },

  logicModalSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 4,
  },

  logicInfoButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E9F2DD",
    borderWidth: 1,
    borderColor: "#C9DEBA",
  },

  logicInfoButtonText: {
    color: "#247322",
    fontSize: 14,
    fontWeight: "900",
  },

  logicRowButton: {
    alignSelf: "flex-start",
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#FFFDF7",
    borderWidth: 1,
    borderColor: "#D8CCAA",
    marginBottom: 10,
  },

  logicRowButtonSelected: {
    backgroundColor: "#247322",
    borderColor: "#247322",
  },

  logicRowButtonText: {
    color: "#3D3528",
    fontWeight: "900",
  },

  logicRowButtonTextSelected: {
    color: "#fff",
  },

  logicCompactGroup: {
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: "#E8DCC2",
  },

  logicCompactGroupLast: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E8DCC2",
  },

  logicGroupTitle: {
    color: "#2A251D",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    marginBottom: 8,
  },

  logicDescription: {
    color: "#6D6250",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    marginBottom: 8,
  },

  feedbackBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E8DCC2",
  },

  feedbackInput: {
    borderWidth: 1,
    borderColor: "#D8CCAA",
    borderRadius: 14,
    padding: 10,
    minHeight: 48,
    backgroundColor: "#FFFDF7",
    color: "#1F1A14",
    fontWeight: "700",
    textAlignVertical: "top",
  },

  conditionStateRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  logicEmptyText: {
    color: "#8C806F",
    fontSize: 13,
    fontWeight: "700",
  },

  logicInlineControls: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },

  logicModalHelper: {
    color: "#665D4E",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    marginBottom: 12,
  },

  logicOptionButton: {
    alignSelf: "flex-start",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#FFFDF7",
    borderWidth: 1,
    borderColor: "#D8CCAA",
    marginBottom: 6,
  },

  logicOptionButtonSelected: {
    backgroundColor: "#247322",
    borderColor: "#247322",
  },

  logicOptionText: {
    color: "#3D3528",
    fontWeight: "900",
  },

  logicOptionTextSelected: {
    color: "#fff",
  },

  memoryNameBox: {
    marginTop: 4,
    marginBottom: 12,
  },

  memoryNameInput: {
    borderWidth: 1,
    borderColor: "#D8CCAA",
    borderRadius: 16,
    padding: 10,
    backgroundColor: "#FFFDF7",
    color: "#1F1A14",
    fontWeight: "800",
  },

  logicSummaryBox: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 22,
    backgroundColor: "#F5EFD9",
    marginTop: 4,
    marginBottom: 6,
  },

  logicSummaryText: {
    color: "#665D4E",
    fontSize: 13,
    marginBottom: 2,
  },

  logicBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "#F5EFD9",
    borderWidth: 1,
    borderColor: "#D8CCAA",
  },

  logicSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },

  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    marginBottom: 8,
  },

  checkbox: {
    fontSize: 22,
    marginRight: 10,
  },

  checkboxLabel: {
    fontSize: 15,
    color: "#3D3528",
  },

  rememberedChoiceList: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 6,
    marginBottom: 8,
  },

  rememberedChoiceChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#FFFCF2",
    borderWidth: 1,
    borderColor: "#D8CCAA",
    marginRight: 8,
    marginBottom: 8,
  },

  rememberedChoiceChipSelected: {
    backgroundColor: "#247322",
    borderColor: "#247322",
  },

  rememberedChoiceChipText: {
    fontSize: 12,
    color: "#3D3528",
  },

  rememberedChoiceChipTextSelected: {
    color: "#fff",
  },

  clearLogicButton: {
    marginTop: 4,
    paddingVertical: 6,
  },

  clearLogicText: {
    color: "#8C806F",
    fontSize: 13,
  },

  targetBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "#F5EFD9",
    borderWidth: 1,
    borderColor: "#D8CCAA",
  },

  targetOption: {
    paddingVertical: 7,
  },

  targetOptionText: {
    flex: 1,
    color: "#3D3528",
    fontSize: 14,
    fontWeight: "800",
  },

  targetOptionTextSelected: {
    color: "#fff",
    fontWeight: "900",
  },

  createNextSceneButton: {
    marginTop: 8,
    paddingVertical: 8,
  },

  sectionCard: {
    backgroundColor: "#FFFCF2",
    borderRadius: 22,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#D8CCAA",
  },

  sceneAppearanceHelper: {
    color: "#665D4E",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 14,
  },

  sceneAppearanceToggle: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D8CCAA",
    backgroundColor: "#F9F5E8",
  },

  sceneAppearanceOverrideBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#B8CDA5",
    backgroundColor: "#F2F8E9",
  },

  appearanceOptionLabel: {
    color: "#2A251D",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 14,
    marginBottom: 8,
  },

  sceneAppearanceStatus: {
    color: "#28751F",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 9,
  },

  appearanceOptionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  appearanceOptionButton: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CFC5A8",
    backgroundColor: "#FFFDF7",
  },

  appearanceOptionButtonSelected: {
    borderColor: "#28751F",
    backgroundColor: "#28751F",
  },

  appearanceOptionText: {
    color: "#4B4438",
    fontSize: 13,
    fontWeight: "800",
  },

  appearanceOptionTextSelected: {
    color: "#FFFFFF",
  },

  sceneAppearanceActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },

  sceneAppearanceActionButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#28751F",
  },

  sceneAppearanceActionText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  sceneAppearanceGhostButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BEB392",
    backgroundColor: "#FFFDF7",
  },

  sceneAppearanceGhostText: {
    color: "#4B4438",
    fontSize: 13,
    fontWeight: "800",
  },

  sceneThemeButton: {
    minWidth: 92,
    padding: 10,
    borderRadius: 14,
    borderWidth: 2,
  },

  sceneThemeButtonSelected: {
    borderWidth: 3,
  },

  sceneThemeSwatch: {
    height: 12,
    borderRadius: 999,
    marginBottom: 7,
  },

  sceneThemeText: {
    fontSize: 12,
    fontWeight: "900",
  },

  resetSceneAppearanceButton: {
    alignSelf: "flex-start",
    marginTop: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C86B55",
    backgroundColor: "#FFF7F3",
  },

  resetSceneAppearanceText: {
    color: "#9B4938",
    fontSize: 13,
    fontWeight: "900",
  },

  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#2A251D",
  },

  quickActionRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  quickActionButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#8AAA72",
    backgroundColor: "#F1F7E9",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  quickActionText: {
    color: "#247322",
    fontSize: 14,
    fontWeight: "900",
  },
  headerBackButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBackButtonText: {
    color: "#2A2720",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "500",
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#D8CCAA",
    backgroundColor: "#FFFCF2",
  },

  backButtonText: {
    fontSize: 15,
    color: "#3D3528",
  },


  mediaStatus: {
    color: "#665D4E",
    marginBottom: 14,
    fontWeight: "700",
  },

  mediaButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D8CCAA",
    backgroundColor: "#FFFDF7",
  },

  mediaButtonText: {
    fontWeight: "600",
    color: "#3D3528",
  },

  addChoiceStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
    marginBottom: 24,
  },

  sceneStatusChip: {
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#D8CCAA",
    backgroundColor: "#FFFDF7",
  },

  startStatusChip: {
    backgroundColor: "#E9F2DD",
    borderColor: "#C9DEBA",
  },

  endingStatusChip: {
    backgroundColor: "#FFFDF7",
  },

  endingStatusChipActive: {
    borderColor: "#D8CCAA",
    backgroundColor: "#FFF0B8",
  },

  sceneStatusText: {
    fontSize: 14,
    fontWeight: "800",
  },

  startStatusText: {
    color: "#247322",
  },

  endingStatusText: {
    color: "#8C806F",
  },

  endingStatusTextActive: {
    color: "#6E4D00",
  },

  statusInfoButton: {
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 253, 247, 0.72)",
    borderWidth: 1,
    borderColor: "#D8CCAA",
  },

  statusInfoButtonText: {
    color: "#4F6F52",
    fontSize: 12,
    fontWeight: "900",
  },
  addChoicePrimaryButton: {
    flex: 1,
    backgroundColor: "#247322",
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#247322",
  },

  addChoicePrimaryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  addChoiceCard: {
    backgroundColor: "#FFFCF2",
    borderRadius: 22,
    padding: 16,
    marginTop: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#D8CCAA",
    borderStyle: "dashed",
  },

  addChoiceTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },

  addChoiceHint: {
    color: "#665D4E",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },

  addChoiceInput: {
    borderWidth: 1,
    borderColor: "#D8CCAA",
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "#FFFDF7",
  },

  addChoiceButtonRow: {
    flexDirection: "row",
    gap: 10,
  },

  addChoiceCancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D8CCAA",
    backgroundColor: "#FFFDF7",
  },

  addChoiceCancelText: {
    fontWeight: "700",
    color: "#665D4E",
  },
  addChoiceButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D8CCAA",
    backgroundColor: "#FFFDF7",
  },

  addChoiceSubmitButton: {
    flex: 1,
    backgroundColor: "#247322",
    borderColor: "#247322",
  },
  addChoiceButtonDisabled: {
    opacity: 0.5,
  },

  addChoiceButtonText: {
    fontWeight: "600",
    color: "#3D3528",
  },

  addChoiceSubmitButtonText: {
    color: "#fff",
  },
  addChoiceButtonTextDisabled: {
    color: "#8C806F",
  },
});
