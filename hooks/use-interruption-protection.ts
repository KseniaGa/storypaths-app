import { useCallback, useLayoutEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { useFocusEffect } from "expo-router";
import { protectBrowserEdits, protectNativeEdits } from "../utils/interruptionProtection";

export function useInterruptionProtection(flush: () => boolean) {
  const latestFlush = useRef(flush);
  useLayoutEffect(() => {
    latestFlush.current = flush;
  }, [flush]);
  useFocusEffect(useCallback(() => {
    const save = () => latestFlush.current();
    if (Platform.OS === "web") {
      return protectBrowserEdits(window, document, save);
    }
    return protectNativeEdits((listener) => AppState.addEventListener("change", listener), save);
  }, []));
}
