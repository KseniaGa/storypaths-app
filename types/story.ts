export type Choice = {
  label: string;
  targetSceneId?: string;
};

export type SceneAsset = {
  id: string;
  type: 'image';
  uri: string;
  x: number;
  y: number;
  width: number;
  height: number;
  alt?: string;
};


export type Scene = {
  id: string;
  title: string;
  text: string;
  choices: Choice[];
  assets: SceneAsset[];
};

export type StoryMode = 'personal' | 'symbolic' | 'fictional';

export type StoryProject = {
  id: string;
  title: string;
  mode: StoryMode;
  scenes: Scene[];
};