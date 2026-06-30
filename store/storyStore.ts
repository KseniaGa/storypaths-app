import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import {
  Scene,
  StoryMode,
  StoryProject,
  StoryValueDefinition,
} from "../types/story";

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

  createStory: (title: string, mode: StoryMode) => void;
  openStory: (id: string) => void;
  deleteStory: (id: string) => void;

  addScene: (scene: Scene) => string;
  updateScene: (index: number, scene: Scene) => void;
  deleteScene: (id: string) => void;

  toggleSceneDone: (id: string) => void;

  renameStory: (id: string, newTitle: string) => void;
  setStoryIcon: (id: string, icon: string) => void;

  toggleShowSceneTitlesInPlay: () => void;

  setBackgroundMusic: (music: BackgroundMusic) => void;
  removeBackgroundMusic: () => void;

  exportCurrentStory: () => string | null;

  addStoryValue: (value: Omit<StoryValueDefinition, "id">) => string;
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

      setHasHydrated: (state: boolean) => set({ _hasHydrated: state }),

      createStory: (title, mode) => {
        const newStory: StoryProject = {
          id: createStoryId(),
          title,
          mode,
          scenes: [],
          storyValues: [],
          backgroundMusic: undefined,
          icon: "🪲",
        } as StoryProject;

        set((state) => ({
          stories: [...state.stories, newStory],
          currentStoryId: newStory.id,
        }));
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
          const existing = state.stories.find((s) => s.id === story.id);

          const stories = existing
            ? state.stories.map((s) => (s.id === story.id ? story : s))
            : [...state.stories, story];

          return {
            stories,
            currentStoryId: story.id,
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
                    choices: scene.choices.map((choice) => ({
                      ...choice,
                      valueChange:
                        choice.valueChange?.valueId === id
                          ? undefined
                          : choice.valueChange,
                      requiredValue:
                        choice.requiredValue?.valueId === id
                          ? undefined
                          : choice.requiredValue,
                    })),
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

        return JSON.stringify(currentStory, null, 2);
      },

      exportCurrentStoryAsHtml: () => {
        const state = get();
        const currentStory = state.stories.find(
          (story) => story.id === state.currentStoryId,
        );

        if (!currentStory) return null;

        const storyJson = JSON.stringify(currentStory);

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${currentStory.title}</title>
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
      <div>
        <div class="story-title">${currentStory.title} · ${currentStory.mode}</div>
      </div>
      <button class="restart" onclick="restartStory()">Restart</button>
    </div>

    <h1 id="scene-title"></h1>
    <img id="scene-image" class="scene-image" style="display:none;" />
    <div id="scene-text" class="scene-text"></div>
    <div id="choices" class="choices"></div>
    <div id="empty" class="empty" style="display:none;"></div>
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

      if (!scene) {
        titleEl.textContent = 'Missing scene';
        textEl.textContent = '';
        choicesEl.innerHTML = '';
        emptyEl.style.display = 'block';
        emptyEl.textContent = 'This scene could not be found.';
        imageEl.style.display = 'none';
        return;
      }

      titleEl.textContent = scene.title || 'Untitled scene';
      textEl.textContent = scene.text || '';

      const firstImage = scene.assets && scene.assets.length > 0 ? scene.assets[0] : null;
      if (firstImage && firstImage.uri) {
        imageEl.src = firstImage.uri;
        imageEl.alt = firstImage.alt || '';
        imageEl.style.display = 'block';
      } else {
        imageEl.style.display = 'none';
        imageEl.removeAttribute('src');
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

function restartStory() {
  currentSceneId = story.scenes[0]?.id;
  chosenChoiceIds = [];
  activeTraces = [];
  storyValues = createInitialStoryValues();
  renderScene();
}

        renderScene();
  </script>
  </div>
</body>
</html>`;
      },

      addScene: (scene) => {
        const newId = scene.id || createSceneId();

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

      updateScene: (index, scene) =>
        set((state) => ({
          stories: state.stories.map((story) =>
            story.id === state.currentStoryId
              ? {
                  ...story,
                  scenes: story.scenes.map((s, i) => (i === index ? scene : s)),
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
      storage: createJSONStorage(() => universalStorage),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("Zustand Hydration Error:", error);
        }
        state?.setHasHydrated(true);
      },
    },
  ),
);
