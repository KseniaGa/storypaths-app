import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import {
  Scene,
  StoryMode,
  StoryProject,
  StoryValueDefinition,
  PlayAppearance,
} from "../types/story";
import { normalizeStoryProject } from "../utils/storyData";
import { getChoiceValueChanges } from "../utils/storyValueChanges";
import {
  DEFAULT_PLAY_APPEARANCE,
  getPlayFont,
  getPlayTextSize,
  getPlayTheme,
  getStoryPlayAppearance,
} from "../utils/playAppearance";

const universalStorage: StateStorage = {
  getItem: async (name: string) => {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return null;
      return window.localStorage.getItem(name);
    }
    return await AsyncStorage.getItem(name);
  },
  setItem: async (name: string, value: string) => {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(name, value);
      return;
    }
    await AsyncStorage.setItem(name, value);
  },
  removeItem: async (name: string) => {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return;
      window.localStorage.removeItem(name);
      return;
    }
    await AsyncStorage.removeItem(name);
  },
};

const createStoryValueId = () =>
  `value-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const createSceneId = () =>
  `scene-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const createStoryId = () =>
  `story-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;


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

type StoryStore = {
  stories: StoryProject[];
  currentStoryId: string | null;
  _hasHydrated: boolean;
  hasCompletedWelcome: boolean;

  createStory: (title: string, mode: StoryMode, icon?: string) => string;
  completeWelcome: () => void;
  openStory: (id: string) => void;
  deleteStory: (id: string) => void;

  addScene: (scene: Scene) => string;
  createSceneFromChoice: (
    parentSceneId: string,
    choiceId: string | undefined,
    choiceIndex: number,
    replaceExistingTarget?: boolean,
  ) => string | null;
  duplicateScene: (id: string) => string | null;
  updateScene: (
    id: string,
    update: Partial<Scene> | ((scene: Scene) => Scene),
  ) => void;
  deleteScene: (id: string) => void;
  setStartScene: (id: string) => void;

  toggleSceneDone: (id: string) => void;

  renameStory: (id: string, newTitle: string) => void;
  setStoryIcon: (id: string, icon: string) => void;

  toggleShowSceneTitlesInPlay: () => void;
  toggleAutoplayBackgroundMusic: () => void;
  toggleAutoplayVoiceNotes: () => void;
  setPlayAppearance: (update: Partial<PlayAppearance>) => void;

  setBackgroundMusic: (music: BackgroundMusic) => void;
  removeBackgroundMusic: () => void;

  exportCurrentStory: () => string | null;

  addStoryValue: (value: Omit<StoryValueDefinition, "id">) => string;
  renameStoryValue: (id: string, name: string) => void;
  deleteStoryValue: (id: string) => void;

  importStory: (story: StoryProject) => void;

  exportCurrentStoryAsHtml: () => string | null;

  getCurrentStory: () => StoryProject | undefined;
  loadDemoStory: () => void;
  setHasHydrated: (state: boolean) => void;
};

export const useStoryStore = create<StoryStore>()(
  persist(
    (set, get) => ({
      stories: [],
      currentStoryId: null,
      _hasHydrated: false,
      hasCompletedWelcome: false,

      setHasHydrated: (state: boolean) => set({ _hasHydrated: state }),
      completeWelcome: () => set({ hasCompletedWelcome: true }),

      createStory: (title, mode, icon) => {
        const newStory: StoryProject = {
          id: createStoryId(),
          title,
          mode,
          scenes: [],
          storyValues: [],
          autoplayBackgroundMusic: false,
          autoplayVoiceNotes: false,
          playAppearance: DEFAULT_PLAY_APPEARANCE,
          backgroundMusic: undefined,
          icon: icon || "🪲",
        } as StoryProject;

        set((state) => ({
          stories: [...state.stories, newStory],
          currentStoryId: newStory.id,
        }));

        return newStory.id;
      },

      openStory: (id) => set({ currentStoryId: id }),

      deleteStory: (id) =>
        set((state) => {
          const filtered = state.stories.filter((story) => story.id !== id);
          return {
            stories: filtered,
            currentStoryId:
              state.currentStoryId === id
                ? (filtered[0]?.id ?? null)
                : state.currentStoryId,
          };
        }),

      importStory: (story) =>
        set((state) => {
          const normalizedStory = normalizeStoryProject(story);
          const existing = state.stories.find(
            (existingStory) => existingStory.id === normalizedStory.id,
          );

          const stories = existing
            ? state.stories.map((existingStory) =>
                existingStory.id === normalizedStory.id
                  ? normalizedStory
                  : existingStory,
              )
            : [...state.stories, normalizedStory];

          return {
            stories,
            currentStoryId: normalizedStory.id,
          };
        }),

      renameStory: (id, newTitle) =>
        set((state) => ({
          stories: state.stories.map((story) =>
            story.id === id ? { ...story, title: newTitle } : story,
          ),
        })),

      setStoryIcon: (id, icon) =>
        set((state) => ({
          stories: state.stories.map((story) =>
            story.id === id ? ({ ...story, icon } as StoryProject) : story,
          ),
        })),

      toggleShowSceneTitlesInPlay: () =>
        set((state) => ({
          stories: state.stories.map((story) =>
            story.id === state.currentStoryId
              ? {
                  ...story,
                  showSceneTitlesInPlay: !(story.showSceneTitlesInPlay ?? true),
                }
              : story,
          ),
        })),

      toggleAutoplayBackgroundMusic: () =>
        set((state) => ({
          stories: state.stories.map((story) =>
            story.id === state.currentStoryId
              ? {
                  ...story,
                  autoplayBackgroundMusic: !(story.autoplayBackgroundMusic ?? false),
                }
              : story,
          ),
        })),

      toggleAutoplayVoiceNotes: () =>
        set((state) => ({
          stories: state.stories.map((story) =>
            story.id === state.currentStoryId
              ? {
                  ...story,
                  autoplayVoiceNotes: !(story.autoplayVoiceNotes ?? false),
                }
              : story,
          ),
        })),

      setPlayAppearance: (update) =>
        set((state) => ({
          stories: state.stories.map((story) =>
            story.id === state.currentStoryId
              ? {
                  ...story,
                  playAppearance: {
                    ...getStoryPlayAppearance(story),
                    ...update,
                  },
                }
              : story,
          ),
        })),

      setBackgroundMusic: (music) =>
        set((state) => ({
          stories: state.stories.map((story) =>
            story.id === state.currentStoryId
              ? {
                  ...story,
                  backgroundMusic: music as any,
                }
              : story,
          ),
        })),

      removeBackgroundMusic: () =>
        set((state) => ({
          stories: state.stories.map((story) =>
            story.id === state.currentStoryId
              ? {
                  ...story,
                  backgroundMusic: undefined,
                }
              : story,
          ),
        })),

      addStoryValue: (value) => {
        const newId = createStoryValueId();

        const newValue: StoryValueDefinition = {
          id: newId,
          name: value.name,
          initialValue: value.initialValue,
          minValue: value.minValue,
          maxValue: value.maxValue,
          step: value.step,
        };

        set((state) => ({
          stories: state.stories.map((story) =>
            story.id === state.currentStoryId
              ? {
                  ...story,
                  storyValues: [...(story.storyValues || []), newValue],
                }
              : story,
          ),
        }));

        return newId;
      },

      renameStoryValue: (id, name) => {
        const trimmedName = name.trim();
        if (!trimmedName) return;

        set((state) => ({
          stories: state.stories.map((story) =>
            story.id === state.currentStoryId
              ? {
                  ...story,
                  storyValues: (story.storyValues || []).map((value) =>
                    value.id === id ? { ...value, name: trimmedName } : value,
                  ),
                  scenes: story.scenes.map((scene) => ({
                    ...scene,
                    choices: scene.choices.map((choice) => ({
                      ...choice,
                      requiredValue:
                        choice.requiredValue?.valueId === id
                          ? { ...choice.requiredValue, name: trimmedName }
                          : choice.requiredValue,
                    })),
                  })),
                }
              : story,
          ),
        }));
      },

      deleteStoryValue: (id) =>
        set((state) => ({
          stories: state.stories.map((story) =>
            story.id === state.currentStoryId
              ? {
                  ...story,
                  storyValues: (story.storyValues || []).filter(
                    (value) => value.id !== id,
                  ),
                  scenes: story.scenes.map((scene) => ({
                    ...scene,
                    choices: scene.choices.map((choice) => {
                      const valueChanges = getChoiceValueChanges(choice).filter(
                        (change) => change.valueId !== id,
                      );

                      return {
                        ...choice,
                        valueChanges,
                        valueChange: undefined,
                        valueFeedbackEnabled:
                          valueChanges.length > 0
                            ? choice.valueFeedbackEnabled
                            : false,
                        valueFeedbackMessage:
                          valueChanges.length > 0
                            ? choice.valueFeedbackMessage
                            : undefined,
                        requiredValue:
                          choice.requiredValue?.valueId === id
                            ? undefined
                            : choice.requiredValue,
                      };
                    }),
                  })),
                }
              : story,
          ),
        })),

      exportCurrentStory: () => {
        const state = get();
        const currentStory = state.stories.find(
          (story) => story.id === state.currentStoryId,
        );

        if (!currentStory) return null;

        const exportableStory = {
          ...normalizeStoryProject(currentStory),
          editorHints: undefined,
        };
        return JSON.stringify(exportableStory, null, 2);
      },

      exportCurrentStoryAsHtml: () => {
        const state = get();
        const currentStory = state.stories.find(
          (story) => story.id === state.currentStoryId,
        );

        if (!currentStory) return null;

        const storyJson = JSON.stringify({
          ...currentStory,
          editorHints: undefined,
        });
        const appearance = getStoryPlayAppearance(currentStory);
        const appearanceFont = getPlayFont(appearance.font);
        const appearanceSize = getPlayTextSize(appearance.textSize);
        const appearanceTheme = getPlayTheme(appearance.theme);

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${currentStory.title}</title>
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
            font-weight: 800;
            color: ${appearanceTheme.accent};
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
</head>
<body>
  <div class="container">
    <div class="card">
    <div class="topbar">
      <div>
        <div class="story-title">${currentStory.title} · ${currentStory.mode}</div>
      </div>
      <button class="restart" onclick="restartStory()">Restart</button>
    </div>

    <h1 id="scene-title"></h1>
    <div id="scene-images" class="scene-images" style="display:none;"></div>
    <div id="scene-text" class="scene-text"></div>
    <div id="scene-dialogue" class="dialogue"></div>
    <div id="choices" class="choices"></div>
    <div id="choice-feedback" class="choice-feedback" role="status" aria-live="polite" aria-atomic="true"></div>
    <div id="empty" class="empty" style="display:none;"></div>
  </div>

  <script>
    const story = ${storyJson};
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

      if (!scene) {
        titleEl.textContent = 'Missing scene';
        textEl.textContent = '';
        dialogueEl.innerHTML = '';
        choicesEl.innerHTML = '';
        emptyEl.style.display = 'block';
        emptyEl.textContent = 'This scene could not be found.';
        imagesEl.replaceChildren();
        imagesEl.style.display = 'none';
        return;
      }

      titleEl.textContent = scene.title || 'Untitled scene';
      renderRichText(textEl, scene.text, scene.textFormatting);
      dialogueEl.innerHTML = '';
      if (scene.sceneType === 'dialogue' && scene.dialogueTurns && scene.dialogueTurns.length > 0) {
        scene.dialogueTurns.forEach((turn) => {
          const bubble = document.createElement('div');
          bubble.className = 'dialogue-bubble';

          if (turn.speaker && turn.speaker.trim()) {
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

function restartStory() {
  currentSceneId = story.scenes[0]?.id;
  chosenChoiceIds = [];
  activeTraces = [];
  storyValues = createInitialStoryValues();
  showChoiceFeedback([]);
  renderScene();
}

        renderScene();
  </script>
  </div>
</body>
</html>`;
      },

      addScene: (scene) => {
        const currentStory = get().stories.find(
          (story) => story.id === get().currentStoryId,
        );
        const usedIds = new Set(currentStory?.scenes.map((item) => item.id) || []);
        let newId = scene.id || createSceneId();

        while (usedIds.has(newId)) {
          newId = createSceneId();
        }

        const newScene = {
          ...scene,
          id: newId,
        };

        set((state) => ({
          stories: state.stories.map((story) =>
            story.id === state.currentStoryId
              ? {
                  ...story,
                  scenes: [...story.scenes, newScene],
                }
              : story,
          ),
        }));

        return newId;
      },

      createSceneFromChoice: (
        parentSceneId,
        choiceId,
        choiceIndex,
        replaceExistingTarget = false,
      ) => {
        let createdSceneId: string | null = null;

        set((state) => ({
          stories: state.stories.map((story) => {
            if (story.id !== state.currentStoryId) return story;

            const parentSceneIndex = story.scenes.findIndex(
              (scene) => scene.id === parentSceneId,
            );
            if (parentSceneIndex < 0) return story;

            const parentScene = story.scenes[parentSceneIndex];
            const resolvedChoiceIndex = choiceId
              ? parentScene.choices.findIndex((choice) => choice.id === choiceId)
              : choiceIndex;
            if (
              resolvedChoiceIndex < 0 ||
              resolvedChoiceIndex >= parentScene.choices.length
            ) {
              return story;
            }

            const selectedChoice = parentScene.choices[resolvedChoiceIndex];
            const validExistingTarget = selectedChoice.targetSceneId
              ? story.scenes.find((scene) => scene.id === selectedChoice.targetSceneId)
              : undefined;
            if (validExistingTarget && !replaceExistingTarget) {
              createdSceneId = validExistingTarget.id;
              return story;
            }

            const usedIds = new Set(story.scenes.map((scene) => scene.id));
            let newSceneId = createSceneId();
            while (usedIds.has(newSceneId)) newSceneId = createSceneId();

            const newScene: Scene = {
              id: newSceneId,
              title: "",
              text: "",
              sceneType: "story",
              dialogueTurns: [],
              choices: [],
              assets: [],
            };
            const updatedParent: Scene = {
              ...parentScene,
              choices: parentScene.choices.map((choice, index) =>
                index === resolvedChoiceIndex
                  ? { ...choice, targetSceneId: newSceneId }
                  : choice,
              ),
            };
            const nextScenes = [...story.scenes];
            nextScenes[parentSceneIndex] = updatedParent;
            nextScenes.splice(parentSceneIndex + 1, 0, newScene);
            createdSceneId = newSceneId;

            return { ...story, scenes: nextScenes };
          }),
        }));

        return createdSceneId;
      },

      duplicateScene: (id) => {
        let duplicatedSceneId: string | null = null;

        set((state) => ({
          stories: state.stories.map((story) => {
            if (story.id !== state.currentStoryId) return story;

            const originalIndex = story.scenes.findIndex(
              (scene) => scene.id === id,
            );
            if (originalIndex < 0) return story;

            const original = story.scenes[originalIndex];
            const usedSceneIds = new Set(story.scenes.map((scene) => scene.id));
            const usedChoiceIds = new Set(
              story.scenes.flatMap((scene) => scene.choices.map((choice) => choice.id)),
            );
            const usedAssetIds = new Set(
              story.scenes.flatMap((scene) => scene.assets.map((asset) => asset.id)),
            );
            const usedDialogueIds = new Set(
              story.scenes.flatMap((scene) =>
                (scene.dialogueTurns || []).map((turn) => turn.id),
              ),
            );
            const createUniqueId = (prefix: string, usedIds: Set<string>) => {
              let nextId = "";
              do {
                nextId = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
              } while (usedIds.has(nextId));
              usedIds.add(nextId);
              return nextId;
            };

            const sceneId = createUniqueId("scene", usedSceneIds);
            const duplicatedChoiceIds = original.choices.map(() =>
              createUniqueId("choice", usedChoiceIds),
            );
            const choiceIdMap = new Map<string, string>();
            original.choices.forEach((choice, index) => {
              if (choice.id && !choiceIdMap.has(choice.id)) {
                choiceIdMap.set(choice.id, duplicatedChoiceIds[index]);
              }
            });
            const originalTitle = original.title.trim() || "Untitled Scene";
            const existingTitles = new Set(
              story.scenes.map((scene) => scene.title.trim().toLowerCase()),
            );
            let copyNumber = 1;
            let copyTitle = `${originalTitle} - copy`;
            while (existingTitles.has(copyTitle.toLowerCase())) {
              copyNumber += 1;
              copyTitle = `${originalTitle} - copy ${copyNumber}`;
            }

            const duplicate: Scene = {
              ...original,
              id: sceneId,
              title: copyTitle,
              dialogueTurns: (original.dialogueTurns || []).map((turn) => ({
                ...turn,
                id: createUniqueId("dialogue", usedDialogueIds),
              })),
              choices: original.choices.map((choice, choiceIndex) => ({
                ...choice,
                id: duplicatedChoiceIds[choiceIndex],
                requiredChoiceId: choice.requiredChoiceId
                  ? choiceIdMap.get(choice.requiredChoiceId) || choice.requiredChoiceId
                  : undefined,
                valueChanges: choice.valueChanges?.map((change) => ({ ...change })),
                valueChange: choice.valueChange
                  ? { ...choice.valueChange }
                  : undefined,
                requiredValue: choice.requiredValue
                  ? { ...choice.requiredValue }
                  : undefined,
              })),
              assets: original.assets.map((asset) => ({
                ...asset,
                id: createUniqueId(
                  asset.type === "audio" ? "audio" : "asset",
                  usedAssetIds,
                ),
                libraryItemId:
                  asset.libraryItemId ||
                  asset.reusedFromAssetId ||
                  asset.id ||
                  asset.uri,
                reusedFromAssetId: asset.id,
              })),
            };

            duplicatedSceneId = sceneId;
            const nextScenes = [...story.scenes];
            nextScenes.splice(originalIndex + 1, 0, duplicate);

            return {
              ...story,
              scenes: nextScenes,
              editorHints: story.editorHints?.[original.id]
                ? {
                    ...story.editorHints,
                    [sceneId]: story.editorHints[original.id],
                  }
                : story.editorHints,
            };
          }),
        }));

        return duplicatedSceneId;
      },

      updateScene: (id, update) =>
        set((state) => ({
          stories: state.stories.map((story) =>
            story.id === state.currentStoryId
              ? {
                  ...story,
                  scenes: story.scenes.map((scene) => {
                    if (scene.id !== id) return scene;

                    const nextScene =
                      typeof update === "function"
                        ? update(scene)
                        : { ...scene, ...update, id: scene.id };

                    return { ...nextScene, id: scene.id };
                  }),
                }
              : story,
          ),
        })),

      deleteScene: (id) =>
        set((state) => ({
          stories: state.stories.map((story) =>
            story.id === state.currentStoryId
              ? {
                  ...story,
                  scenes: story.scenes
                    .filter((scene) => scene.id !== id)
                    .map((scene) => ({
                      ...scene,
                      choices: scene.choices.map((choice) =>
                        choice.targetSceneId === id
                          ? { ...choice, targetSceneId: undefined }
                          : choice,
                      ),
                    })),
                }
              : story,
          ),
        })),

      setStartScene: (id) =>
        set((state) => ({
          stories: state.stories.map((story) => {
            if (story.id !== state.currentStoryId) return story;

            const sceneIndex = story.scenes.findIndex((scene) => scene.id === id);
            if (sceneIndex <= 0) return story;

            return {
              ...story,
              scenes: [
                story.scenes[sceneIndex],
                ...story.scenes.slice(0, sceneIndex),
                ...story.scenes.slice(sceneIndex + 1),
              ],
            };
          }),
        })),

      toggleSceneDone: (id) =>
        set((state) => ({
          stories: state.stories.map((story) =>
            story.id === state.currentStoryId
              ? {
                  ...story,
                  scenes: story.scenes.map((scene) =>
                    scene.id === id
                      ? { ...scene, isDone: !scene.isDone }
                      : scene,
                  ),
                }
              : story,
          ),
        })),

      getCurrentStory: () => {
        const state = get();
        return state.stories.find((story) => story.id === state.currentStoryId);
      },

      loadDemoStory: () => {
        const demoStory: StoryProject = {
          id: "demo-goose-story",
          title: "Goose Story",
          mode: "personal",
          scenes: [
            {
              id: "goose",
              title: "Goose",
              text: "You are a goose near a quiet pond.",
              choices: [
                {
                  id: "choice-look-at-pond",
                  label: "Look at pond",
                  targetSceneId: "pond",
                  rememberChoice: true,
                },
                {
                  id: "choice-walk-into-forest",
                  label: "Walk into forest",
                  targetSceneId: "forest",
                  rememberChoice: true,
                },
              ],
              assets: [],
            },
            {
              id: "pond",
              title: "Pond",
              text: "The pond is calm and full of mysterious ripples.",
              choices: [
                {
                  id: "choice-go-back-to-goose",
                  label: "Go back to goose place",
                  targetSceneId: "goose",
                },
              ],
              assets: [],
            },
            {
              id: "forest",
              title: "Forest",
              text: "The forest is dark, wet, and smells like moss.",
              choices: [
                {
                  id: "choice-return-to-pond",
                  label: "Return to pond",
                  targetSceneId: "pond",
                },
                {
                  id: "choice-remember-the-pond",
                  label: "Remember the pond",
                  targetSceneId: "pond",
                  requiredChoiceId: "choice-look-at-pond",
                },
              ],
              assets: [],
            },
          ],
        };

        set((state) => {
          const existing = state.stories.find((s) => s.id === demoStory.id);
          const stories = existing
            ? state.stories.map((s) => (s.id === demoStory.id ? demoStory : s))
            : [...state.stories, demoStory];

          return {
            stories,
            currentStoryId: demoStory.id,
          };
        });
      },
    }),
    {
      name: "storypaths-storage-v9",
      version: 4,
      storage: createJSONStorage(() => universalStorage),
      migrate: (persistedState: any) => {
        const persistedStories = Array.isArray(persistedState?.stories)
          ? persistedState.stories
          : [];

        return {
          ...persistedState,
          hasCompletedWelcome:
            typeof persistedState?.hasCompletedWelcome === "boolean"
              ? persistedState.hasCompletedWelcome
              : persistedStories.length > 0,
          stories: persistedStories.map((story: unknown) =>
            normalizeStoryProject(story),
          ),
        };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("Zustand Hydration Error:", error);
        }
        state?.setHasHydrated(true);
      },
    },
  ),
);
