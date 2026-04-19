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