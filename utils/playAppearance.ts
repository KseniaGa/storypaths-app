import { Platform } from "react-native";
import type {
  PlayAppearance,
  PlayFontId,
  PlayTextSizeId,
  PlayThemeId,
  Scene,
  StoryProject,
} from "../types/story";

export const DEFAULT_PLAY_APPEARANCE: PlayAppearance = {
  font: "branchBeetle",
  textSize: "standard",
  theme: "branchBeetle",
};

export const PLAY_FONT_OPTIONS: Array<{
  id: PlayFontId;
  label: string;
  nativeFamily?: string;
  cssFamily: string;
}> = [
  {
    id: "branchBeetle",
    label: "Branch Beetle",
    nativeFamily: undefined,
    cssFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  {
    id: "storySerif",
    label: "Story Serif",
    nativeFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      default: "serif",
    }),
    cssFamily: "Georgia, 'Times New Roman', serif",
  },
  {
    id: "friendly",
    label: "Friendly",
    nativeFamily: Platform.select({
      ios: "Arial Rounded MT Bold",
      android: "sans-serif-medium",
      default: "sans-serif",
    }),
    cssFamily: "ui-rounded, 'Arial Rounded MT Bold', Arial, sans-serif",
  },
  {
    id: "typewriter",
    label: "Typewriter",
    nativeFamily: Platform.select({
      ios: "Courier New",
      android: "monospace",
      default: "monospace",
    }),
    cssFamily: "'Courier New', Courier, monospace",
  },
];

export const PLAY_TEXT_SIZE_OPTIONS: Array<{
  id: PlayTextSizeId;
  label: string;
  body: number;
  bodyLineHeight: number;
  choice: number;
  dialogue: number;
  feedback: number;
  cssRem: number;
}> = [
  {
    id: "small",
    label: "Small",
    body: 17,
    bodyLineHeight: 27,
    choice: 15,
    dialogue: 15,
    feedback: 14,
    cssRem: 0.94,
  },
  {
    id: "standard",
    label: "Standard",
    body: 19,
    bodyLineHeight: 30,
    choice: 17,
    dialogue: 17,
    feedback: 15,
    cssRem: 1.05,
  },
  {
    id: "large",
    label: "Large",
    body: 22,
    bodyLineHeight: 34,
    choice: 20,
    dialogue: 20,
    feedback: 18,
    cssRem: 1.2,
  },
];

export type PlayTheme = {
  id: PlayThemeId;
  label: string;
  sceneBackground: string;
  primaryText: string;
  secondaryText: string;
  choiceBackground: string;
  choiceText: string;
  accent: string;
  surface: string;
  softSurface: string;
  border: string;
};

export const PLAY_THEMES: PlayTheme[] = [
  {
    id: "branchBeetle",
    label: "Branch Beetle",
    sceneBackground: "#F7F1E1",
    primaryText: "#3D3528",
    secondaryText: "#6F675A",
    choiceBackground: "#247322",
    choiceText: "#FFFFFF",
    accent: "#247322",
    surface: "#FFFCF2",
    softSurface: "#F0F7E8",
    border: "#C9D8B8",
  },
  {
    id: "paper",
    label: "Paper",
    sceneBackground: "#F5F3EE",
    primaryText: "#252525",
    secondaryText: "#595959",
    choiceBackground: "#303030",
    choiceText: "#FFFFFF",
    accent: "#6C4A2D",
    surface: "#FFFFFF",
    softSurface: "#ECE9E2",
    border: "#C8C4BB",
  },
  {
    id: "forest",
    label: "Forest",
    sceneBackground: "#163A2D",
    primaryText: "#F5F2E8",
    secondaryText: "#CAD7CF",
    choiceBackground: "#E9C46A",
    choiceText: "#1D2A22",
    accent: "#F2D58A",
    surface: "#214B3B",
    softSurface: "#2A5847",
    border: "#6F8D7D",
  },
  {
    id: "night",
    label: "Night",
    sceneBackground: "#15171C",
    primaryText: "#F3F4F6",
    secondaryText: "#BEC3CE",
    choiceBackground: "#D8E2FF",
    choiceText: "#172033",
    accent: "#AFC1FF",
    surface: "#22252D",
    softSurface: "#292D37",
    border: "#555C6B",
  },
  {
    id: "berry",
    label: "Berry",
    sceneBackground: "#FAF0F4",
    primaryText: "#3A2630",
    secondaryText: "#755A68",
    choiceBackground: "#8E3F63",
    choiceText: "#FFFFFF",
    accent: "#8E3F63",
    surface: "#FFF9FB",
    softSurface: "#F4DFE8",
    border: "#D9AFC1",
  },
];

const validFontIds = new Set(PLAY_FONT_OPTIONS.map((option) => option.id));
const validTextSizeIds = new Set(
  PLAY_TEXT_SIZE_OPTIONS.map((option) => option.id),
);
const validThemeIds = new Set(PLAY_THEMES.map((theme) => theme.id));

export const normalizePlayAppearance = (value: unknown): PlayAppearance => {
  const candidate =
    typeof value === "object" && value !== null
      ? (value as Partial<PlayAppearance>)
      : {};

  return {
    font: validFontIds.has(candidate.font as PlayFontId)
      ? (candidate.font as PlayFontId)
      : DEFAULT_PLAY_APPEARANCE.font,
    textSize: validTextSizeIds.has(candidate.textSize as PlayTextSizeId)
      ? (candidate.textSize as PlayTextSizeId)
      : DEFAULT_PLAY_APPEARANCE.textSize,
    theme: validThemeIds.has(candidate.theme as PlayThemeId)
      ? (candidate.theme as PlayThemeId)
      : DEFAULT_PLAY_APPEARANCE.theme,
  };
};

export const getStoryPlayAppearance = (
  story?: Pick<StoryProject, "playAppearance">,
) => normalizePlayAppearance(story?.playAppearance);

export const getScenePlayAppearance = (
  story?: Pick<StoryProject, "playAppearance">,
  scene?: Pick<Scene, "playSettingsOverride">,
) =>
  scene?.playSettingsOverride
    ? normalizePlayAppearance(scene.playSettingsOverride.playAppearance)
    : getStoryPlayAppearance(story);

export const getSceneBackgroundMusic = (
  story?: Pick<StoryProject, "backgroundMusic">,
  scene?: Pick<Scene, "playSettingsOverride">,
) =>
  scene?.playSettingsOverride
    ? scene.playSettingsOverride.backgroundMusic ?? undefined
    : story?.backgroundMusic;

export const getPlayFont = (font: PlayFontId) =>
  PLAY_FONT_OPTIONS.find((option) => option.id === font) ||
  PLAY_FONT_OPTIONS[0];

export const getPlayTextSize = (textSize: PlayTextSizeId) =>
  PLAY_TEXT_SIZE_OPTIONS.find((option) => option.id === textSize) ||
  PLAY_TEXT_SIZE_OPTIONS[1];

export const getPlayTheme = (theme: PlayThemeId) =>
  PLAY_THEMES.find((option) => option.id === theme) || PLAY_THEMES[0];
