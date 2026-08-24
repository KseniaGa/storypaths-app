const scrollPositions = new Map<string, number>();

export const rememberScrollPosition = (key: string, y: number) => {
  scrollPositions.set(key, Math.max(0, y));
};

export const getScrollPosition = (key: string) =>
  scrollPositions.get(key) || 0;

export const clearScrollPosition = (key: string) => {
  scrollPositions.delete(key);
};
