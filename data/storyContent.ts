import type { Choice, StoryMode, StoryProject, StoryValueDefinition } from "../types/story";

export const STORY_ICON_PRESETS = [
  "\uD83E\uDEB2",
  "\uD83C\uDF3F",
  "\uD83C\uDF19",
  "\uD83C\uDFE0",
  "\uD83D\uDEAA",
  "\uD83C\uDF0A",
  "\uD83D\uDD25",
  "\u2B50",
  "\uD83E\uDDED",
  "\uD83D\uDC8C",
  "\uD83C\uDF33",
  "\uD83E\uDE90",
];

type BlueprintValue = Omit<StoryValueDefinition, "id"> & { key: string };

type BlueprintChoice = Omit<
  Choice,
  | "id"
  | "targetSceneId"
  | "requiredChoiceId"
  | "valueChanges"
  | "valueChange"
  | "requiredValue"
> & {
  key: string;
  target?: string;
  requiredChoiceKey?: string;
  valueChanges?: { valueKey: string; amount: number }[];
  requiredValue?: {
    valueKey: string;
    operator: "atLeast" | "atMost" | "equals";
    amount: number;
  };
};

type BlueprintScene = {
  key: string;
  title: string;
  text: string;
  editorHint?: string;
  choices: BlueprintChoice[];
};

export type StoryBlueprint = {
  id: string;
  title: string;
  icon: string;
  mode: StoryMode;
  description: string;
  summary: string;
  scenes: BlueprintScene[];
  storyValues?: BlueprintValue[];
};

export const TUTORIALS: StoryBlueprint[] = [
  {
    id: "connecting-scenes",
    title: "Connecting Scenes",
    icon: "\uD83C\uDF3F",
    mode: "fictional",
    description:
      "A tiny hands-on example for changing a choice destination and checking the connection.",
    summary: "Scene links \u2022 Confirmation \u2022 Story Tree \u2022 Preview",
    scenes: [
      {
        key: "starting-point",
        title: "The Starting Point",
        text: "A beetle reaches a fork in the branch.\n\nPlay this short example once, then edit this scene and change where the choice leads.",
        editorHint:
          "Practice connecting scenes: find the choice below, tap Change destination, and choose a numbered scene. Look for the green Connected to confirmation. Then open Story Tree or Preview to check the path.",
        choices: [
          {
            key: "choose-path",
            label: "Choose a path",
            target: "first-destination",
          },
        ],
      },
      {
        key: "first-destination",
        title: "The Sunny Leaf",
        text: "The beetle arrives on a sunny leaf. This is the choice's current destination.",
        editorHint:
          "This scene is currently connected to the choice in Scene 1. Return to Scene 1 if you want to change that destination.",
        choices: [],
      },
      {
        key: "second-destination",
        title: "The Mossy Branch",
        text: "The beetle arrives on a mossy branch. Connect the opening choice here to try a different path.",
        editorHint:
          "This is an alternative destination. In Scene 1, use Change destination to connect the choice here.",
        choices: [],
      },
    ],
  },
  {
    id: "beetles-first-branch",
    title: "The Beetle's First Branch",
    icon: "\uD83E\uDEB2",
    mode: "fictional",
    description:
      "A completed example you can play, then open scene by scene to see how a small branch works.",
    summary: "Scenes \u2022 Choices \u2022 Play mode \u2022 Remembered choice",
    scenes: [
      {
        key: "morning",
        title: "Morning on the Branch",
        text: "A tiny beetle wakes up on a warm green branch.\n\nAhead, the branch splits in two directions. One side glows in the sun. The other disappears under a shadowy leaf.\n\nTutorial note: This opening scene introduces the story and gives the player their first choices.",
        editorHint:
          "These two choices are already connected. Open Change destination to see their numbered destination scenes, then use Story Tree or Preview to follow the branches.",
        choices: [
          { key: "sunny", label: "Follow the sunny branch", target: "sunny" },
          { key: "leaf", label: "Crawl under the shadowy leaf", target: "leaf" },
        ],
      },
      {
        key: "sunny",
        title: "The Sunny Branch",
        text: "The beetle finds a golden berry glowing in the sun.\n\nIt smells sweet, bright, and a little mysterious.\n\nTutorial note: The story can remember this choice and use it later.",
        choices: [
          {
            key: "nibble",
            label: "Nibble the golden berry",
            target: "hollow",
            rememberChoice: true,
            memoryName: "nibbled_golden_berry",
          },
        ],
      },
      {
        key: "leaf",
        title: "Under the Leaf",
        text: "Under the leaf, the beetle finds a tiny raindrop hanging like a mirror.\n\nFor a moment, the whole tree seems upside down.\n\nTutorial note: Different branches can meet again later.",
        choices: [{ key: "touch", label: "Touch the raindrop", target: "hollow" }],
      },
      {
        key: "hollow",
        title: "The Nest in the Bark",
        text: "The beetle finds a quiet hollow in the tree bark.\n\nIt feels like a safe place to rest.\n\nTutorial note: This scene reconnects the earlier branches.",
        editorHint:
          "Two earlier branches reconnect here. The Look back choice is also a back-link to Scene 1, showing that paths do not always have to move forward.",
        choices: [
          { key: "rest", label: "Rest in the hollow", target: "ending" },
          { key: "look-back", label: "Look back at the branch", target: "morning" },
        ],
      },
      {
        key: "ending",
        title: "A Small Ending",
        text: "The beetle curls up in the bark hollow.\n\nTomorrow, there will be more branches to explore.\n\nTutorial note: A scene without choices is an ending.",
        choices: [],
      },
    ],
  },
  {
    id: "berries-locked-gate",
    title: "Berries and the Locked Gate",
    icon: "\uD83E\uDED0",
    mode: "fictional",
    description:
      "A completed example showing remembered choices, story values, and rules that reveal new paths.",
    summary: "Choices \u2022 Remembered choices \u2022 Story values \u2022 Choice logic",
    storyValues: [
      { key: "berries", name: "Berries", initialValue: 0, minValue: 0, maxValue: 5, step: 1 },
    ],
    scenes: [
      {
        key: "path",
        title: "The Berry Path",
        text: "The beetle arrives at a forest path. Ahead is a locked gate. Nearby are berries, a shiny key, and a small side path.",
        choices: [
          { key: "side", label: "Follow the side path", target: "side" },
          {
            key: "key",
            label: "Pick up the shiny key",
            target: "after-key",
            rememberChoice: true,
            memoryName: "picked_up_shiny_key",
          },
          {
            key: "berry",
            label: "Collect a berry",
            target: "after-berry",
            valueChanges: [{ valueKey: "berries", amount: 1 }],
          },
        ],
      },
      {
        key: "side",
        title: "A Simple Choice",
        text: "This choice moved the beetle to another scene without changing the story's memory or values.",
        choices: [{ key: "side-gate", label: "Go to the gate", target: "gate" }],
      },
      {
        key: "after-key",
        title: "A Remembered Choice",
        text: "The story now remembers that the beetle picked up the key.",
        choices: [{ key: "key-gate", label: "Go to the gate", target: "gate" }],
      },
      {
        key: "after-berry",
        title: "A Story Value",
        text: "Collecting the berry increased a story value.\n\nTutorial note: Collect another berry intentionally returns to this same scene. This self-loop lets the player repeat an action before choosing to leave.",
        editorHint:
          "Collect another berry is an intentional self-loop: its destination is this same scene. Each visit adds another berry, while Go to the gate gives the player a clear exit.",
        choices: [
          {
            key: "another-berry",
            label: "Collect another berry",
            target: "after-berry",
            valueChanges: [{ valueKey: "berries", amount: 1 }],
          },
          { key: "berry-gate", label: "Go to the gate", target: "gate" },
        ],
      },
      {
        key: "gate",
        title: "The Locked Gate",
        text: "Some choices only appear when the story remembers something or a value is high enough.",
        choices: [
          {
            key: "open-key",
            label: "Open the gate with the shiny key",
            target: "key-ending",
            requiredChoiceKey: "key",
          },
          {
            key: "trade",
            label: "Trade 3 berries for help",
            target: "berry-ending",
            requiredValue: { valueKey: "berries", operator: "atLeast", amount: 3 },
          },
          { key: "wait", label: "Wait by the gate", target: "wait-ending" },
        ],
      },
      { key: "key-ending", title: "The Key Ending", text: "The shiny key fits perfectly.", choices: [] },
      { key: "berry-ending", title: "The Berry Ending", text: "The berries are traded and the gate opens.", choices: [] },
      { key: "wait-ending", title: "The Waiting Ending", text: "The beetle waits and wonders what another choice might have changed.", choices: [] },
    ],
  },
];

export const STORY_TEMPLATES: StoryBlueprint[] = [
  {
    id: "moment-reimagined",
    title: "A Moment Reimagined",
    icon: "\uD83C\uDF19",
    mode: "fictional",
    description:
      "Return to one moment and explore different ways it could unfold. It can be personal, fictional, or completely invented.",
    summary: "Branching \u2022 6 scenes",
    scenes: [
      {
        key: "opening",
        title: "The moment",
        text: "",
        editorHint: "Describe one moment just before a response is needed.",
        choices: [
          { key: "respond-a", label: "Respond one way", target: "consequence-a" },
          { key: "respond-b", label: "Respond another way", target: "consequence-b" },
        ],
      },
      {
        key: "consequence-a",
        title: "What follows",
        text: "",
        editorHint: "Show the immediate effect of the first response.",
        choices: [
          { key: "continue-a", label: "Continue", target: "ending-a" },
          { key: "reconsider", label: "Reconsider", target: "ending-shared" },
        ],
      },
      {
        key: "consequence-b",
        title: "A different turn",
        text: "",
        editorHint: "Show how the second response changes the moment.",
        choices: [
          { key: "continue-b", label: "Continue", target: "ending-b" },
          { key: "pause", label: "Pause", target: "ending-shared" },
        ],
      },
      { key: "ending-a", title: "One ending", text: "", editorHint: "Let this ending carry one distinct feeling or result.", choices: [] },
      { key: "ending-b", title: "Another ending", text: "", editorHint: "Make this ending meaningfully different from the first.", choices: [] },
      { key: "ending-shared", title: "A third possibility", text: "", editorHint: "Offer a quieter or less certain ending.", choices: [] },
    ],
  },
  {
    id: "different-paths-same-place",
    title: "Different Paths, Same Place",
    icon: "\uD83E\uDDED",
    mode: "fictional",
    description:
      "Explore a situation where choices exist, but circumstances still shape the outcome.",
    summary: "Reconnecting paths \u2022 5 scenes",
    scenes: [
      {
        key: "situation",
        title: "A difficult situation",
        text: "",
        editorHint: "Describe a situation with several possible responses.",
        choices: [
          { key: "path-a", label: "Try one response", target: "consequence-a" },
          { key: "path-b", label: "Try another response", target: "consequence-b" },
          { key: "path-c", label: "Take a quieter approach", target: "consequence-c" },
        ],
      },
      { key: "consequence-a", title: "First consequence", text: "", editorHint: "Show the short-term effect of this response.", choices: [{ key: "reconnect-a", label: "Continue", target: "outcome" }] },
      { key: "consequence-b", title: "Second consequence", text: "", editorHint: "Let this path feel different before it reconnects.", choices: [{ key: "reconnect-b", label: "Continue", target: "outcome" }] },
      { key: "consequence-c", title: "Third consequence", text: "", editorHint: "Show what this approach changes, even if the destination stays the same.", choices: [{ key: "reconnect-c", label: "Continue", target: "outcome" }] },
      { key: "outcome", title: "The shared outcome", text: "", editorHint: "Bring the paths together while acknowledging how each journey differed.", choices: [] },
    ],
  },
  {
    id: "small-moments-along-way",
    title: "Small Moments Along the Way",
    icon: "\uD83C\uDF3F",
    mode: "fictional",
    description:
      "Build a story from small moments. It does not need to resolve everything.",
    summary: "Open-ended \u2022 5 scenes",
    scenes: [
      { key: "place-one", title: "The first place", text: "", editorHint: "Begin with a place, routine, or small movement.", choices: [{ key: "notice", label: "Notice something", target: "encounter" }, { key: "keep-going", label: "Keep going", target: "encounter" }] },
      { key: "encounter", title: "A small encounter", text: "", editorHint: "Add a person, object, sound, or brief interruption.", choices: [{ key: "respond", label: "Respond", target: "place-two" }, { key: "observe", label: "Observe", target: "place-two" }] },
      { key: "place-two", title: "Further along", text: "", editorHint: "Let the journey continue with a small change in mood or attention.", choices: [{ key: "detour", label: "Take a small detour", target: "last-moment" }, { key: "continue", label: "Continue", target: "last-moment" }] },
      { key: "last-moment", title: "One more moment", text: "", editorHint: "Offer one final small choice before the story opens outward.", choices: [{ key: "linger", label: "Linger", target: "open-end" }, { key: "move-on", label: "Move on", target: "open-end" }] },
      { key: "open-end", title: "What comes next", text: "", editorHint: "End with an image, question, or possibility rather than a complete resolution.", choices: [] },
    ],
  },
];

export const INSPIRATION_PROMPTS = [
  "A choice you still think about",
  "Two routes that lead to the same place",
  "A small encounter that changes the mood of a day",
  "Something noticed on an ordinary journey",
];

const createToken = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export const cloneStoryBlueprint = (
  blueprint: StoryBlueprint,
  identity: { title?: string; icon?: string } = {},
): StoryProject => {
  const token = createToken();
  const sceneIds = new Map(
    blueprint.scenes.map((scene) => [scene.key, `scene-${token}-${scene.key}`]),
  );
  const choiceIds = new Map(
    blueprint.scenes.flatMap((scene) =>
      scene.choices.map((choice) => [choice.key, `choice-${token}-${choice.key}`] as const),
    ),
  );
  const valueIds = new Map(
    (blueprint.storyValues || []).map((value) => [value.key, `value-${token}-${value.key}`]),
  );

  const editorHints = Object.fromEntries(
    blueprint.scenes
      .filter((scene) => scene.editorHint)
      .map((scene) => [sceneIds.get(scene.key)!, scene.editorHint!]),
  );

  return {
    id: `story-${blueprint.id}-${token}`,
    title: identity.title ?? blueprint.title,
    mode: blueprint.mode,
    icon: identity.icon ?? blueprint.icon,
    showSceneTitlesInPlay: true,
    autoplayBackgroundMusic: false,
    autoplayVoiceNotes: false,
    storyValues: (blueprint.storyValues || []).map(({ key, ...value }) => ({
      ...value,
      id: valueIds.get(key)!,
    })),
    editorHints,
    scenes: blueprint.scenes.map((scene) => ({
      id: sceneIds.get(scene.key)!,
      title: scene.title,
      text: scene.text,
      assets: [],
      choices: scene.choices.map((choice) => ({
        id: choiceIds.get(choice.key)!,
        label: choice.label,
        targetSceneId: choice.target ? sceneIds.get(choice.target) : undefined,
        rememberChoice: choice.rememberChoice,
        memoryName: choice.memoryName,
        requiredChoiceId: choice.requiredChoiceKey
          ? choiceIds.get(choice.requiredChoiceKey)
          : undefined,
        requiredChoiceState: choice.requiredChoiceKey ? "remembered" : undefined,
        valueChanges: choice.valueChanges
          ?.map((change) => ({
            valueId: valueIds.get(change.valueKey),
            amount: change.amount,
          }))
          .filter(
            (change): change is { valueId: string; amount: number } =>
              typeof change.valueId === "string",
          ),
        requiredValue: choice.requiredValue
          ? {
              valueId: valueIds.get(choice.requiredValue.valueKey),
              operator: choice.requiredValue.operator,
              amount: choice.requiredValue.amount,
            }
          : undefined,
      })),
    })),
  };
};
