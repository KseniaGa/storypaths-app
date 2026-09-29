import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import type { BackgroundMusic, StoryProject } from "../types/story";
import { normalizeStoryProject } from "./storyData";
import { readUriAsDataUrl } from "./platformFiles";

const extensions: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif",
  "image/webp": "webp", "image/heic": "heic", "image/heif": "heif",
  "image/avif": "avif", "image/bmp": "bmp", "image/svg+xml": "svg",
  "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac",
  "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg",
  "audio/opus": "opus", "audio/flac": "flac", "audio/webm": "webm",
  "audio/3gpp": "3gp", "audio/amr": "amr", "audio/x-caf": "caf",
};

function mediaMime(uri: string, kind: "image" | "audio") {
  const suffix = uri.split(/[?#]/)[0].split(".").pop()?.toLowerCase();
  if (suffix === "jpeg") return "image/jpeg";
  if (suffix === "mp4") return "audio/mp4";
  return Object.entries(extensions).find(([, ext]) => ext === suffix)?.[0]
    || (kind === "image" ? "image/jpeg" : "audio/mp4");
}

function embeddedMedia(uri: string, kind: "image" | "audio") {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(uri);
  if (!match || !match[1].startsWith(`${kind}/`) || !extensions[match[1]] || match[2].length % 4 !== 0) {
    throw new Error("Invalid or unsupported embedded media.");
  }
  return { mime: match[1], base64: match[2] };
}

type ResolveBuiltIn = (id: string) => Promise<string>;

/** Leaves the live story unchanged; missing media aborts the complete backup. */
export async function buildStoryBackup(story: StoryProject, resolveBuiltIn: ResolveBuiltIn) {
  const copy = normalizeStoryProject(JSON.parse(JSON.stringify(story)));
  copy.editorHints = undefined;
  const embedded = new Map<string, string>();
  const embed = async (uri: string | undefined, kind: "image" | "audio", label: string) => {
    try {
      if (!uri) throw new Error("Missing media path");
      const key = `${kind}:${uri}`;
      const previous = embedded.get(key);
      if (previous) return previous;
      let result = await readUriAsDataUrl(uri, mediaMime(uri, kind));
      // Some web servers label media as generic binary data.
      result = result.replace(/^data:application\/octet-stream;/, `data:${mediaMime(uri, kind)};`);
      embeddedMedia(result, kind);
      embedded.set(key, result);
      return result;
    } catch {
      throw new Error(`Could not include ${label}. No complete backup was created. Reattach the missing media and try again.`);
    }
  };
  const music = async (track: BackgroundMusic | null | undefined, label: string) => {
    if (!track) return;
    let uri = track.uri;
    if (!uri && track.type === "built-in") {
      try { uri = await resolveBuiltIn(track.builtInId || ""); }
      catch { throw new Error(`Could not include ${label}. No complete backup was created. Try again when the music is available.`); }
    }
    track.uri = await embed(uri, "audio", label);
  };
  await music(copy.backgroundMusic, "story background music");
  for (const [index, scene] of copy.scenes.entries()) {
    const label = `scene ${index + 1} (${scene.title || "Untitled"})`;
    for (const asset of scene.assets) {
      asset.uri = await embed(asset.uri, asset.type, `${asset.type} in ${label}`);
    }
    await music(scene.playSettingsOverride?.backgroundMusic, `background music in ${label}`);
  }
  return JSON.stringify({ ...copy, backupFormat: "branch-beetle", backupVersion: 1 }, null, 2);
}

/** Prepare all files before the caller replaces any story in the store. */
export async function restoreStoryBackup(value: unknown): Promise<{ story: StoryProject; warnings: string[] }> {
  const story = normalizeStoryProject(JSON.parse(JSON.stringify(value)));
  const metadata = story as StoryProject & { backupFormat?: string; backupVersion?: number };
  if (metadata.backupFormat && (metadata.backupFormat !== "branch-beetle" || metadata.backupVersion !== 1)) {
    throw new Error("This backup version is not supported by this app.");
  }
  const portable = metadata.backupFormat === "branch-beetle";
  delete metadata.backupFormat;
  delete metadata.backupVersion;
  const warnings = new Set<string>();
  const restored = new Map<string, string>();
  let directory: string | undefined;
  let fileIndex = 0;
  const restore = async (uri: string | undefined, kind: "image" | "audio") => {
    if (!uri?.startsWith("data:")) {
      if (portable) throw new Error("This complete backup is missing embedded media. The story was not imported.");
      warnings.add("This older backup contains media links, not the files themselves. Some pictures or audio may only work on the original device.");
      return uri || "";
    }
    const data = embeddedMedia(uri, kind);
    if (Platform.OS === "web") return uri;
    const previous = restored.get(uri);
    if (previous) return previous;
    if (!directory) {
      if (!FileSystem.documentDirectory) throw new Error("Permanent app storage is unavailable.");
      directory = `${FileSystem.documentDirectory}story-media/backup-${Date.now()}-${Math.random().toString(36).slice(2, 11)}/`;
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    }
    const destination = `${directory}${++fileIndex}.${extensions[data.mime]}`;
    await FileSystem.writeAsStringAsync(destination, data.base64, { encoding: FileSystem.EncodingType.Base64 });
    restored.set(uri, destination);
    return destination;
  };
  const music = async (track: BackgroundMusic | null | undefined) => {
    if (!track) return;
    if (!portable && track.type === "built-in" && !track.uri) return;
    const wasEmbedded = track.uri?.startsWith("data:");
    track.uri = await restore(track.uri, "audio");
    // Use the exact included recording, even if the built-in catalogue changes.
    if (track.uri && (portable || wasEmbedded)) {
      track.type = "uploaded";
      delete track.builtInId;
    }
  };
  try {
    await music(story.backgroundMusic);
    for (const scene of story.scenes) {
      for (const asset of scene.assets) asset.uri = await restore(asset.uri, asset.type);
      await music(scene.playSettingsOverride?.backgroundMusic);
    }
    return { story, warnings: [...warnings] };
  } catch (error) {
    if (directory) {
      // Only this import's newly allocated directory can be removed.
      await FileSystem.deleteAsync(directory, { idempotent: true }).catch(() => {});
    }
    throw error;
  }
}
