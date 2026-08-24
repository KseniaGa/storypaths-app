import type { Choice, StoryValueChange } from "../types/story";

type ChoiceWithLegacyValueChange = Pick<
  Choice,
  "valueChanges" | "valueChange"
>;

export const getChoiceValueChanges = (
  choice?: ChoiceWithLegacyValueChange | null,
): StoryValueChange[] => {
  if (Array.isArray(choice?.valueChanges)) {
    const usedValueIds = new Set<string>();

    return choice.valueChanges.filter((change) => {
      const valueId = change?.valueId?.trim();
      if (!valueId || !Number.isFinite(change.amount) || usedValueIds.has(valueId)) {
        return false;
      }

      usedValueIds.add(valueId);
      return true;
    });
  }

  const legacyChange = choice?.valueChange;
  if (!legacyChange || !Number.isFinite(legacyChange.amount)) return [];

  const valueId = legacyChange.valueId?.trim();
  if (!valueId) return [];

  return [{ valueId, amount: legacyChange.amount }];
};
