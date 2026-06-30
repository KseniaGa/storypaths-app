export type StoryValueDefinition = {
  id: string;
  name: string;
  initialValue: number;
  minValue: number;
  maxValue: number;
  step: number;
};

export type StoryValueChange = {
  valueId?: string;

  // legacy support, in case older choices used name-based values
  name?: string;

  amount: number;
};

export type StoryValueCondition = {
  valueId?: string;

  // legacy support
  name?: string;

  operator: 'atLeast' | 'atMost' | 'equals';
  amount: number;
};

export type Choice = {
  id?: string;
  label: string;
  targetSceneId?: string;

  // legacy trace system
  traceLabel?: string;
  requiredTraceLabel?: string;

  // remembered-choice system
  rememberChoice?: boolean;
  requiredChoiceId?: string;

  // story-level values
  valueChange?: StoryValueChange;
  requiredValue?: StoryValueCondition;
};

export type SceneAsset =
  | {
      id: string;
      type: 'image';
      uri: string;
      x: number;
      y: number;
      width: number;
      height: number;
      alt?: string;
    }
  | {
      id: string;
      type: 'audio';
      uri: string;
      name?: string;
    };

export type Scene = {
  id: string;
  title: string;
  text: string;
  choices: Choice[];
  assets: SceneAsset[];
  isDone?: boolean;
};

export type StoryMode = 'personal' | 'symbolic' | 'fictional';

export type StoryProject = {
  id: string;
  title: string;
  mode: StoryMode;
  scenes: Scene[];
  showSceneTitlesInPlay?: boolean;
  storyValues?: StoryValueDefinition[];
  backgroundMusic?: {
  uri: string;
  name?: string;
};
};