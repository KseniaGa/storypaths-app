export type StoryValueDefinition = {
  id: string;
  name: string;
  initialValue: number;
  minValue: number;
  maxValue: number;
  step: number;
};

export type StoryValueChange = {
  valueId: string;
  amount: number;
};

export type LegacyStoryValueChange = {
  valueId?: string;
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
  id: string;
  label: string;
  targetSceneId?: string;

  // legacy trace system
  traceLabel?: string;
  requiredTraceLabel?: string;

  // remembered-choice system
  rememberChoice?: boolean;
  requiredChoiceId?: string;
  requiredChoiceState?: 'remembered' | 'notRemembered';
  memoryName?: string;
  rememberFeedbackEnabled?: boolean;
  rememberFeedbackMessage?: string;

  // story-level values
  valueChanges?: StoryValueChange[];

  // legacy single-value effect, normalized on load/import
  valueChange?: LegacyStoryValueChange;
  valueFeedbackEnabled?: boolean;
  valueFeedbackMessage?: string;
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
      libraryItemId?: string;
      reusedFromAssetId?: string;
    }
  | {
      id: string;
      type: 'audio';
      uri: string;
      name?: string;
      libraryItemId?: string;
      reusedFromAssetId?: string;
    };

export type DialogueTurn = {
  id: string;
  speaker: string;
  text: string;
};

export type BackgroundMusic = {
  type?: 'uploaded' | 'built-in';
  uri?: string;
  builtInId?: string;
  name?: string;
};

export type ScenePlaySettingsOverride = {
  playAppearance: PlayAppearance;
  backgroundMusic: BackgroundMusic | null;
};

export type RichTextFormat = {
  start: number;
  end: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

export type Scene = {
  id: string;
  title: string;
  text: string;
  textFormatting?: RichTextFormat[];
  sceneType?: 'story' | 'dialogue';
  dialogueTurns?: DialogueTurn[];
  choices: Choice[];
  assets: SceneAsset[];
  isDone?: boolean;
  playSettingsOverride?: ScenePlaySettingsOverride;
};

export type StoryMode = 'personal' | 'symbolic' | 'fictional';

export type PlayFontId =
  | 'branchBeetle'
  | 'storySerif'
  | 'friendly'
  | 'typewriter';

export type PlayTextSizeId = 'small' | 'standard' | 'large';

export type PlayThemeId =
  | 'branchBeetle'
  | 'paper'
  | 'forest'
  | 'night'
  | 'berry';

export type PlayAppearance = {
  font: PlayFontId;
  textSize: PlayTextSizeId;
  theme: PlayThemeId;
};

export type StoryProject = {
  id: string;
  title: string;
  mode: StoryMode;
  scenes: Scene[];
  showSceneTitlesInPlay?: boolean;
  autoplayBackgroundMusic?: boolean;
  autoplayVoiceNotes?: boolean;
  playAppearance?: PlayAppearance;
  icon?: string;
  editorHints?: Record<string, string>;
  storyValues?: StoryValueDefinition[];
  backgroundMusic?: BackgroundMusic;
};
