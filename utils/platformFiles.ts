import type { DocumentPickerAsset } from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

type PickedTextFile = Pick<
  DocumentPickerAsset,
  "uri" | "file" | "base64"
>;

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
