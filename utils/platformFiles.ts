import type { DocumentPickerAsset } from "expo-document-picker";
import { File } from "expo-file-system";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

type PickedTextFile = Pick<
  DocumentPickerAsset,
  "uri" | "file" | "base64"
>;

type PickedMediaFile = {
  uri: string;
  name?: string | null;
  fileName?: string | null;
  file?: Blob | null;
  base64?: string | null;
  mimeType?: string | null;
};

const removeByteOrderMark = (text: string) => text.replace(/^\uFEFF/, "");

// Browsers do not expose download completion for anchor-triggered downloads.
// Large portable HTML files need their blob URL beyond the initial click.
const DOWNLOAD_URL_LIFETIME_MS = 5 * 60 * 1000;

export const readPickedTextFile = async (
  asset: PickedTextFile,
): Promise<string> => {
  if (Platform.OS === "android" && asset.uri.startsWith("content://")) {
    // Legacy readAsStringAsync rejects single-document Downloads URIs.
    // The modern reader uses Android's content resolver with the picker grant.
    // Keep File in the startup bundle: a dynamic import can reload Expo Go
    // when its Metro development connection is unavailable.
    return removeByteOrderMark(await new File(asset.uri).text());
  }

  if (Platform.OS !== "web") {
    const text = await FileSystem.readAsStringAsync(asset.uri);
    return removeByteOrderMark(text);
  }

  if (asset.file && typeof asset.file.text === "function") {
    return removeByteOrderMark(await asset.file.text());
  }

  const source = asset.base64 || asset.uri;
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error("The selected file could not be read.");
  }

  return removeByteOrderMark(await response.text());
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("The selected media file could not be read."));
    };
    reader.onerror = () =>
      reject(reader.error || new Error("The selected media file could not be read."));
    reader.readAsDataURL(blob);
  });

export const readUriAsDataUrl = async (
  uri: string,
  mimeType: string,
): Promise<string> => {
  if (uri.startsWith("data:")) return uri;

  if (Platform.OS === "web") {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error("The media file could not be read in this browser.");
    }
    return blobToDataUrl(await response.blob());
  }

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:${mimeType};base64,${base64}`;
};

export const getPersistentMediaUri = async (
  asset: PickedMediaFile,
  fallbackMimeType: string,
): Promise<string> => {
  if (asset.uri.startsWith("data:")) return asset.uri;

  if (Platform.OS !== "web") {
    const root = FileSystem.documentDirectory;
    if (!root) throw new Error("Permanent app storage is unavailable.");
    if (asset.uri.startsWith(root)) return asset.uri;
    const directory = `${root}story-media/`;
    const sourceName = asset.fileName || asset.name || asset.uri.split(/[?#]/)[0];
    const extension = sourceName.match(/\.(png|jpe?g|gif|webp|heic|heif|avif|bmp|mp3|m4a|mp4|aac|wav|ogg|opus|flac|caf|3gp|amr|webm)$/i)?.[1]?.toLowerCase();
    const mimeExtensions: Record<string, string> = {
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
      "image/gif": "gif", "image/heic": "heic", "image/heif": "heif",
      "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac",
      "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg",
      "audio/webm": "webm", "audio/flac": "flac", "audio/3gpp": "3gp",
    };
    const suffix = extension || mimeExtensions[asset.mimeType || fallbackMimeType] || "bin";
    const destination = `${directory}media-${Date.now()}-${Math.random().toString(36).slice(2, 11)}.${suffix}`;
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    await FileSystem.copyAsync({ from: asset.uri, to: destination });
    return destination;
  }

  const mimeType = asset.mimeType || fallbackMimeType;
  if (asset.base64) {
    return asset.base64.startsWith("data:")
      ? asset.base64
      : `data:${mimeType};base64,${asset.base64}`;
  }
  if (asset.file) return blobToDataUrl(asset.file);

  return readUriAsDataUrl(asset.uri, mimeType);
};

export const downloadTextFileOnWeb = (
  content: string,
  fileName: string,
  mimeType: string,
): boolean => {
  if (
    Platform.OS !== "web" ||
    typeof document === "undefined" ||
    typeof URL === "undefined"
  ) {
    return false;
  }

  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);

  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS);
  }

  return true;
};

export const downloadDataUrlOnWeb = (
  dataUrl: string,
  fileName: string,
): boolean => {
  if (
    Platform.OS !== "web" ||
    typeof document === "undefined" ||
    typeof URL === "undefined"
  ) {
    return false;
  }

  const separatorIndex = dataUrl.indexOf(",");
  if (separatorIndex < 0) return false;

  const header = dataUrl.slice(0, separatorIndex);
  const encoded = dataUrl.slice(separatorIndex + 1);
  const mimeType = header.match(/^data:([^;,]+)/)?.[1] || "image/png";
  const isBase64 = /;base64$/i.test(header);

  const decoded = isBase64 ? atob(encoded) : decodeURIComponent(encoded);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }

  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);

  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS);
  }

  return true;
};
