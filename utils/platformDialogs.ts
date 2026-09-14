import { Alert, Platform } from "react-native";

export const confirmAction = (
  title: string,
  message: string,
  confirmText: string,
  onConfirm: () => void,
  destructive = false,
) => {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }

  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    {
      text: confirmText,
      style: destructive ? "destructive" : "default",
      onPress: onConfirm,
    },
  ]);
};
