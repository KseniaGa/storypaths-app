import type { DocumentPickerAsset } from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

type PickedTextFile = Pick<
  DocumentPickerAsset,
  "uri" | "file" | "base64"
>;

type PickedMediaFile = {
  uri: string;
  file?: Blob | null;
  base64?: string | null;
  mimeType?: string | null;
};

const removeByteOrderMark = (text: string) => text.replace(/^\uFEFF/, "");

export const readPickedTextFile = async (
  asset: PickedTextFile,
): Promise<string> => {
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
  if (Platform.OS !== "web") return asset.uri;
  if (asset.uri.startsWith("data:")) return asset.uri;

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
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return true;
};
