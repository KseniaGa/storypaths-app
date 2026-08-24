import { normalizePlayAppearance } from "./playAppearance";
import { getRichTextDocument } from "./richText";
import type {
  Choice,
  DialogueTurn,
  RichTextFormat,
  Scene,
  SceneAsset,
  StoryMode,
  StoryProject,
  StoryValueChange,
} from "../types/story";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const nonEmptyString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;

const createUniqueId = (prefix: string, usedIds: Set<string>) => {
  let id = "";

  do {
    id = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  } while (usedIds.has(id));

  usedIds.add(id);
  return id;
};

const claimId = (
  candidate: unknown,
  prefix: string,
  usedIds: Set<string>,
) => {
  const requestedId = nonEmptyString(candidate);

  if (requestedId && !usedIds.has(requestedId)) {
    usedIds.add(requestedId);
    return requestedId;
  }

  return createUniqueId(prefix, usedIds);
};

const normalizeMode = (value: unknown): StoryMode =>
  value === "personal" || value === "symbolic" || value === "fictional"
    ? value
    : "fictional";

const normalizeDialogueTurns = (value: unknown): DialogueTurn[] =>
  Array.isArray(value)
    ? value.filter(isRecord).map((turn, index) => ({
        id: nonEmptyString(turn.id) || `dialogue-legacy-${index}`,
        speaker: typeof turn.speaker === "string" ? turn.speaker : "",
        text: typeof turn.text === "string" ? turn.text : "",
      }))
    : [];

const normalizeAsset = (
  value: unknown,
  usedAssetIds: Set<string>,
): SceneAsset | null => {
  if (!isRecord(value) || (value.type !== "image" && value.type !== "audio")) {
    return null;
  }

  const originalId = nonEmptyString(value.id);
  const id = claimId(originalId, "asset", usedAssetIds);
  const uri = typeof value.uri === "string" ? value.uri : "";
  const libraryItemId =
    nonEmptyString(value.libraryItemId) ||
    nonEmptyString(value.reusedFromAssetId) ||
    originalId ||
    uri ||
    id;

  if (value.type === "audio") {
    return {
      id,
      type: "audio",
      uri,
      ...(typeof value.name === "string" ? { name: value.name } : {}),
      libraryItemId,
      ...(nonEmptyString(value.reusedFromAssetId)
        ? { reusedFromAssetId: nonEmptyString(value.reusedFromAssetId) }
        : {}),
    };
  }

  return {
    id,
    type: "image",
    uri,
    x: typeof value.x === "number" ? value.x : 0,
    y: typeof value.y === "number" ? value.y : 0,
    width: typeof value.width === "number" ? value.width : 220,
    height: typeof value.height === "number" ? value.height : 160,
    ...(typeof value.alt === "string" ? { alt: value.alt } : {}),
    libraryItemId,
    ...(nonEmptyString(value.reusedFromAssetId)
      ? { reusedFromAssetId: nonEmptyString(value.reusedFromAssetId) }
      : {}),
  };
};

export const validateStoryImport = (
  value: unknown,
): { valid: true } | { valid: false; message: string } => {
  if (!isRecord(value)) {
    return { valid: false, message: "The JSON root must be a story object." };
  }

  if (!Array.isArray(value.scenes)) {
    return { valid: false, message: "The story must contain a scenes list." };
  }

  if (value.title !== undefined && typeof value.title !== "string") {
    return { valid: false, message: "The story title must be text." };
  }

  if (value.scenes.some((scene) => !isRecord(scene))) {
    return { valid: false, message: "Every scene must be an object." };
  }

  return { valid: true };
};

export const normalizeStoryProject = (value: unknown): StoryProject => {
  if (!isRecord(value)) {
    throw new Error("Story data must be an object.");
  }

  const validation = validateStoryImport(value);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const rawScenes = value.scenes as UnknownRecord[];
  const rawStoryValues = Array.isArray(value.storyValues)
    ? value.storyValues.filter(isRecord)
    : [];
  const storyValueIdByName = new Map<string, string>();

  rawStoryValues.forEach((storyValue) => {
    const id = nonEmptyString(storyValue.id);
    const name = nonEmptyString(storyValue.name)?.toLowerCase();
    if (id && name && !storyValueIdByName.has(name)) {
      storyValueIdByName.set(name, id);
    }
  });

  const normalizeValueChanges = (choice: UnknownRecord): StoryValueChange[] => {
    const candidates = Array.isArray(choice.valueChanges)
      ? choice.valueChanges
      : isRecord(choice.valueChange)
        ? [choice.valueChange]
        : [];
    const usedValueIds = new Set<string>();

    return candidates.filter(isRecord).flatMap((change) => {
      const legacyName = nonEmptyString(change.name);
      const valueId =
        nonEmptyString(change.valueId) ||
        (legacyName
          ? storyValueIdByName.get(legacyName.toLowerCase())
          : undefined);
      const amount =
        typeof change.amount === "number" && Number.isFinite(change.amount)
          ? change.amount
          : undefined;

      if (!valueId || amount === undefined || usedValueIds.has(valueId)) {
        return [];
      }

      usedValueIds.add(valueId);
      return [{ valueId, amount }];
    });
  };

  const usedSceneIds = new Set<string>();
  const usedChoiceIds = new Set<string>();
  const usedAssetIds = new Set<string>();
  const sceneIdMap = new Map<string, string>();
  const choiceIdMap = new Map<string, string>();
  const normalizedChoiceIds = new WeakMap<UnknownRecord, string>();

  const sceneIdentities = rawScenes.map((scene) => {
    const originalId = nonEmptyString(scene.id);
    const id = claimId(originalId, "scene", usedSceneIds);

    if (originalId && !sceneIdMap.has(originalId)) {
      sceneIdMap.set(originalId, id);
    }

    return { raw: scene, id };
  });

  const titleCounts = new Map<string, number>();
  sceneIdentities.forEach(({ raw }) => {
    const title = nonEmptyString(raw.title)?.toLowerCase();
    if (title) titleCounts.set(title, (titleCounts.get(title) || 0) + 1);
  });

  const uniqueTitleToId = new Map<string, string>();
  sceneIdentities.forEach(({ raw, id }) => {
    const title = nonEmptyString(raw.title)?.toLowerCase();
    if (title && titleCounts.get(title) === 1) uniqueTitleToId.set(title, id);
  });

  sceneIdentities.forEach(({ raw }) => {
    const rawChoices = Array.isArray(raw.choices) ? raw.choices : [];
    rawChoices.filter(isRecord).forEach((choice) => {
      const originalId = nonEmptyString(choice.id);
      const id = claimId(originalId, "choice", usedChoiceIds);
      if (originalId && !choiceIdMap.has(originalId)) {
        choiceIdMap.set(originalId, id);
      }
      normalizedChoiceIds.set(choice, id);
    });
  });

  const scenes: Scene[] = sceneIdentities.map(({ raw, id }) => {
    const rawChoices = Array.isArray(raw.choices) ? raw.choices : [];
    const choices: Choice[] = rawChoices.filter(isRecord).map((choice) => {
      const rawTarget = nonEmptyString(choice.targetSceneId);
      const targetSceneId = rawTarget
        ? sceneIdMap.get(rawTarget) ||
          uniqueTitleToId.get(rawTarget.toLowerCase()) ||
          rawTarget
        : undefined;
      const rawRequiredChoiceId = nonEmptyString(choice.requiredChoiceId);

      const {
        valueChange: _legacyValueChange,
        valueChanges: _rawValueChanges,
        ...choiceWithoutValueChanges
      } = choice;

      return {
        ...choiceWithoutValueChanges,
        id: normalizedChoiceIds.get(choice)!,
        label: typeof choice.label === "string" ? choice.label : "",
        valueChanges: normalizeValueChanges(choice),
        ...(targetSceneId ? { targetSceneId } : { targetSceneId: undefined }),
        ...(rawRequiredChoiceId
          ? {
              requiredChoiceId:
                choiceIdMap.get(rawRequiredChoiceId) || rawRequiredChoiceId,
            }
          : {}),
      } as Choice;
    });

    const assets = (Array.isArray(raw.assets) ? raw.assets : [])
      .map((asset) => normalizeAsset(asset, usedAssetIds))
      .filter((asset): asset is SceneAsset => asset !== null);
    const rawPlaySettingsOverride =
      typeof raw.playSettingsOverride === "object" &&
      raw.playSettingsOverride !== null
        ? (raw.playSettingsOverride as Record<string, unknown>)
        : undefined;
    const richTextDocument = getRichTextDocument(
      typeof raw.text === "string" ? raw.text : "",
      Array.isArray(raw.textFormatting)
        ? (raw.textFormatting as RichTextFormat[])
        : undefined,
    );

    return {
      ...raw,
      id,
      title: typeof raw.title === "string" ? raw.title : "",
      text: richTextDocument.text,
      textFormatting: richTextDocument.formatting,
      sceneType: raw.sceneType === "dialogue" ? "dialogue" : "story",
      dialogueTurns: normalizeDialogueTurns(raw.dialogueTurns),
      choices,
      assets,
      playSettingsOverride: rawPlaySettingsOverride
          ? {
              playAppearance: normalizePlayAppearance(
                rawPlaySettingsOverride.playAppearance,
              ),
              backgroundMusic:
                rawPlaySettingsOverride.backgroundMusic === null
                  ? null
                  : typeof rawPlaySettingsOverride.backgroundMusic === "object"
                    ? rawPlaySettingsOverride.backgroundMusic
                    : null,
            }
          : undefined,
      ...(typeof raw.isDone === "boolean" ? { isDone: raw.isDone } : {}),
    } as Scene;
  });

  return {
    ...value,
    id: nonEmptyString(value.id) || createUniqueId("story", new Set()),
    title: typeof value.title === "string" ? value.title : "Untitled story",
    mode: normalizeMode(value.mode),
    scenes,
    storyValues: Array.isArray(value.storyValues) ? value.storyValues : [],
    playAppearance: normalizePlayAppearance(value.playAppearance),
  } as StoryProject;
};
