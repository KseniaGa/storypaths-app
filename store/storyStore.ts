import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Scene, StoryMode, StoryProject } from '../types/story';

const universalStorage: StateStorage = {
  getItem: async (name: string) => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return null;
      return window.localStorage.getItem(name);
    }
    return await AsyncStorage.getItem(name);
  },
  setItem: async (name: string, value: string) => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(name, value);
      return;
    }
    await AsyncStorage.setItem(name, value);
  },
  removeItem: async (name: string) => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return;
      window.localStorage.removeItem(name);
      return;
    }
    await AsyncStorage.removeItem(name);
  },
};



const createSceneId = () =>
  `scene-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const createStoryId = () =>
  `story-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

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

  renameStory: (id: string, newTitle: string) => void;

  exportCurrentStory: () => string | null;

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
        };

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
              state.currentStoryId === id ? (filtered[0]?.id ?? null) : state.currentStoryId,
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
          story.id === id
            ? { ...story, title: newTitle }
            : story
        ),
      })),


     exportCurrentStory: () => {
      const state = get();
      const currentStory = state.stories.find(
        (story) => story.id === state.currentStoryId
      );

      if (!currentStory) return null;

      return JSON.stringify(currentStory, null, 2);
    }, 


exportCurrentStoryAsHtml: () => {
  const state = get();
  const currentStory = state.stories.find(
    (story) => story.id === state.currentStoryId
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

      if (scene.choices && scene.choices.length > 0) {
        scene.choices.forEach(choice => {
          const btn = document.createElement('button');
          btn.textContent = choice.label + (choice.targetSceneId ? '' : ' (no target yet)');
          btn.onclick = () => {
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
      renderScene();
    }

    renderScene();
  </script>
</body>
  </div>
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
        : story
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
              : story
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
                          : choice
                      ),
                    })),
                }
              : story
          ),
        })),

      getCurrentStory: () => {
        const state = get();
        return state.stories.find((story) => story.id === state.currentStoryId);
      },

      loadDemoStory: () => {
        const demoStory: StoryProject = {
          id: 'demo-goose-story',
          title: 'Goose Story',
          mode: 'personal',
          scenes: [
            {
              id: 'goose',
              title: 'Goose',
              text: 'You are a goose near a quiet pond.',
              choices: [
                { label: 'Look at pond', targetSceneId: 'pond' },
                { label: 'Walk into forest', targetSceneId: 'forest' },
              ],
              assets: [],
            },
            {
              id: 'pond',
              title: 'Pond',
              text: 'The pond is calm and full of mysterious ripples.',
              choices: [{ label: 'Go back to goose place', targetSceneId: 'goose' }],
              assets: [],
            },
            {
              id: 'forest',
              title: 'Forest',
              text: 'The forest is dark, wet, and smells like moss.',
              choices: [{ label: 'Return to pond', targetSceneId: 'pond' }],
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
      name: 'storypaths-storage-v9',
      storage: createJSONStorage(() => universalStorage),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Zustand Hydration Error:', error);
        }
        state?.setHasHydrated(true);
      },
    }
  )
);