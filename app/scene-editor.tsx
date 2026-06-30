import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, KeyboardAvoidingView, Platform, Alert, BackHandler } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useState, useEffect, useRef  } from 'react';
import { useStoryStore } from '../store/storyStore';


export default function SceneEditorScreen() {

  const { sceneId, parentSceneId, choiceIndex, returnSceneId } = useLocalSearchParams();

  const createChoiceId = () =>
  `choice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const getStoryValueOperatorLabel = (operator?: string) => {
  if (operator === 'atMost') return 'is at most';
  if (operator === 'equals') return 'is exactly';
  return 'is at least';
};

const getNextStoryValueOperator = (operator?: string) => {
  if (operator === 'atLeast') return 'atMost';
  if (operator === 'atMost') return 'equals';
  return 'atLeast';
};

  const currentStory = useStoryStore((state) => state.getCurrentStory());
  const scenes = currentStory?.scenes || [];
  const storyTitle = currentStory?.title || 'Untitled story';

  const addScene = useStoryStore((state) => state.addScene);
  const updateScene = useStoryStore((state) => state.updateScene);

  const scrollRef = useRef<ScrollView>(null);

  const [expandedChoiceIndex, setExpandedChoiceIndex] = useState<number | null>(null);

  const [expandedLogicChoiceIndex, setExpandedLogicChoiceIndex] = useState<number | null>(null);


  const showChoiceInfo = () => {
  Alert.alert(
    'Choice',
    'A choice is a button the player can press. It usually leads the player to another scene.'
  );
};

const showStoryTraceInfo = () => {
  Alert.alert(
    'Story trace ✨',
    'A story trace records something the player did or experienced. For example, the player picked up a key, helped a character, made a promise, or visited a place. Story traces let later parts of the story react to earlier choices.'
  );
};

const showStoryValueInfo = () => {
  Alert.alert(
    'Story value 🫐',
    'A story value keeps track of something that can increase or decrease, like coins, berries, trust, energy, hope, or suspicion.'
  );
};

const showConditionalChoiceInfo = () => {
  Alert.alert(
    'Conditional choice',
    'A conditional choice is a choice the player only sees if the story has the right story trace or story value. For example, “Open the locked door” might only appear if the player has found the key.'
  );
};

  const existingScene =
    sceneId !== undefined && sceneId !== ''
      ? scenes.find((scene) => scene.id === sceneId)
      : undefined;

  const returnScene =
  typeof returnSceneId === 'string'
    ? scenes.find((scene) => scene.id === returnSceneId)
    : undefined;

  const parentScene =
  typeof parentSceneId === 'string'
    ? scenes.find((scene) => scene.id === parentSceneId)
    : undefined;

const parentChoiceNumber =
  typeof choiceIndex === 'string' ? Number(choiceIndex) : undefined;

const parentChoice =
  parentScene &&
  parentChoiceNumber !== undefined &&
  !Number.isNaN(parentChoiceNumber)
    ? parentScene.choices[parentChoiceNumber]
    : undefined;

  const [sceneTitle, setSceneTitle] = useState('');
  const [sceneText, setSceneText] = useState('');

  const [choices, setChoices] = useState(existingScene?.choices || []);

  const [newChoice, setNewChoice] = useState('');

  const [assets, setAssets] = useState(existingScene?.assets || []);


  useEffect(() => {
    if (sceneId !== undefined && sceneId !== '') {
      setSceneTitle(existingScene?.title || '');
      setSceneText(existingScene?.text || '');
      setChoices(existingScene?.choices || []);
      setAssets(existingScene?.assets || []);
    } else {
      setSceneTitle('');
      setSceneText('');
      setChoices([]);
      setAssets([]);
    }
    setNewChoice('');
  }, [sceneId, existingScene]);


  const rememberedChoices = scenes.flatMap((scene) =>
  scene.choices
    .filter((choice) => choice.rememberChoice && choice.id)
    .map((choice) => ({
      id: choice.id!,
      sceneTitle: scene.title || 'Untitled scene',
      choiceLabel: choice.label || '(empty choice)',
    }))
);

const currentSceneRememberedChoices = choices
  .filter((choice) => choice.rememberChoice && choice.id)
  .map((choice) => ({
    id: choice.id!,
    sceneTitle: sceneTitle || 'This scene',
    choiceLabel: choice.label || '(empty choice)',
  }));

const availableRememberedChoices = Array.from(
  new Map(
    [...rememberedChoices, ...currentSceneRememberedChoices].map((item) => [
      item.id,
      item,
    ])
  ).values()
);

const storyValueDefinitions = currentStory?.storyValues || [];

const hasStoryValues = storyValueDefinitions.length > 0;

const findStoryValueDefinition = (
  value?: { valueId?: string; name?: string }
) =>
  storyValueDefinitions.find(
    (storyValue) =>
      storyValue.id === value?.valueId || storyValue.name === value?.name
  );

const formatSignedAmount = (amount: number) =>
  `${amount >= 0 ? '+' : ''}${amount}`;

const clampNumber = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const getCleanSceneTitle = () => sceneTitle.trim() || 'Untitled scene';

const hasDuplicateSceneTitle = (candidateTitle: string, currentSceneId?: string) =>
  scenes.some((scene) => {
    const sameScene = currentSceneId && scene.id === currentSceneId;
    return (
      !sameScene &&
      scene.title.trim().toLowerCase() === candidateTitle.trim().toLowerCase()
    );
  });

const saveCurrentScene = (): { sceneId: string; wasNew: boolean } | null => {
  const cleanTitle = getCleanSceneTitle();
  const currentSceneId = existingScene?.id;

  if (hasDuplicateSceneTitle(cleanTitle, currentSceneId)) {
    Alert.alert(
      'Scene name already exists',
      'Another scene already has this name. Please choose a different scene name.'
    );
    return null;
  }

  if (existingScene) {
    const existingIndex = scenes.findIndex((scene) => scene.id === existingScene.id);

    if (existingIndex === -1) {
      Alert.alert('Could not save scene', 'This scene could not be found.');
      return null;
    }

    updateScene(existingIndex, {
      id: existingScene.id,
      title: cleanTitle,
      text: sceneText || '',
      choices,
      assets,
      isDone: existingScene.isDone,
    });

    return { sceneId: existingScene.id, wasNew: false };
  }

  const newSceneId = addScene({
    id: '',
    title: cleanTitle,
    text: sceneText || '',
    choices,
    assets,
  });

  if (parentSceneId && choiceIndex !== undefined) {
    const parentIndex = scenes.findIndex((scene) => scene.id === parentSceneId);

    if (parentIndex !== -1) {
      const parentScene = scenes[parentIndex];
      const updatedChoices = [...parentScene.choices];

      updatedChoices[Number(choiceIndex)] = {
        ...updatedChoices[Number(choiceIndex)],
        targetSceneId: newSceneId,
      };

      updateScene(parentIndex, {
        ...parentScene,
        choices: updatedChoices,
      });
    }
  }

  return { sceneId: newSceneId, wasNew: true };
};

  const hasUnsavedChanges =
  sceneTitle !== (existingScene?.title || '') ||
  sceneText !== (existingScene?.text || '') ||
  JSON.stringify(choices) !== JSON.stringify(existingScene?.choices || []) ||
  JSON.stringify(assets) !== JSON.stringify(existingScene?.assets || []) ||
  newChoice.trim().length > 0;

const goBackSafely = () => {
  if (!hasUnsavedChanges) {
    router.replace('/story');
    return;
  }

  Alert.alert(
    'Leave without saving?',
    'You have unsaved changes in this scene. If you go back now, they will be lost.',
    [
      {
        text: 'Stay here',
        style: 'cancel',
      },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => router.replace('/story'),
      },
    ]
  );
};

useEffect(() => {
  const backHandler = BackHandler.addEventListener(
    'hardwareBackPress',
    () => {
      goBackSafely();
      return true;
    }
  );

  return () => backHandler.remove();
}, [hasUnsavedChanges]);



 
 return (
  <>
    <Stack.Screen
      options={{
        title: sceneId !== undefined && sceneId !== '' ? 'Edit scene' : 'New scene',
      }}
    />

    <KeyboardAvoidingView
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={[styles.container, { paddingBottom: 200 }]}
      keyboardShouldPersistTaps="handled"
    >


<Pressable
  style={styles.backButton}
  onPress={goBackSafely}
>
  <Text style={styles.backButtonText}>← Back to story</Text>
</Pressable>

{returnScene && (
  <Pressable
    style={styles.returnSceneButton}
    onPress={() => {
      const saved = saveCurrentScene();
      if (!saved) return;

      router.replace({
        pathname: '/scene-editor',
        params: {
          sceneId: returnScene.id,
        },
      });
    }}
  >
    <Text style={styles.returnSceneButtonText}>
      ← Return to "{returnScene.title || 'previous scene'}" Scene
    </Text>
  </Pressable>
)}

{!existingScene && parentScene && parentChoice && (
  <View style={styles.originChoiceCard}>
    <Text style={styles.originChoiceLabel}>Creating a new scene from</Text>

    <Text style={styles.originChoiceText}>
      “{parentChoice.label || '(empty choice)'}”
    </Text>

    <Text style={styles.originChoiceSubtext}>
      From scene: {parentScene.title || 'Untitled scene'}
    </Text>
  </View>
)}

<View style={styles.sectionCard}>
  <Text style={styles.sectionTitle}>Scene details 🌿</Text>

  <Text style={styles.storyContext}>Story: {storyTitle}</Text>

  <Text style={styles.label}>Scene title</Text>
  <TextInput
    style={styles.input}
    placeholder="Arrival"
    value={sceneTitle}
    onChangeText={setSceneTitle}
  />

  <Text style={styles.label}>Scene text</Text>

  <TextInput
    style={[styles.input, styles.textArea]}
    placeholder="Write what happens..."
    value={sceneText}
    onChangeText={setSceneText}
    multiline
    textAlignVertical="top"
  />
</View>


      <Text style={styles.mainSectionHeading}>Choices</Text>


{choices.map((choice, index) => {
  const targetScene = scenes.find(
    (scene) => scene.id === choice.targetSceneId
  );

  const requiredRememberedChoice = availableRememberedChoices.find(
    (rememberedChoice) => rememberedChoice.id === choice.requiredChoiceId
  );

  const availableConditions = availableRememberedChoices.filter(
    (rememberedChoice) => rememberedChoice.id !== choice.id
  );

const selectedChangeValue = findStoryValueDefinition(choice.valueChange);
const selectedRequiredValue = findStoryValueDefinition(choice.requiredValue);

const valueChangeLabel =
  choice.valueChange && selectedChangeValue
    ? `${selectedChangeValue.name} ${formatSignedAmount(
        choice.valueChange.amount ?? selectedChangeValue.step
      )}`
    : choice.valueChange?.name?.trim()
      ? `${choice.valueChange.name.trim()} ${formatSignedAmount(
          choice.valueChange.amount ?? 0
        )}`
      : undefined;

const requiredValueLabel =
  choice.requiredValue && selectedRequiredValue
    ? `${selectedRequiredValue.name} ${getStoryValueOperatorLabel(
        choice.requiredValue.operator
      )} ${choice.requiredValue.amount ?? selectedRequiredValue.initialValue}`
    : choice.requiredValue?.name?.trim()
      ? `${choice.requiredValue.name.trim()} ${getStoryValueOperatorLabel(
          choice.requiredValue.operator
        )} ${choice.requiredValue.amount ?? 0}`
      : undefined;

  return (
    <View key={choice.id || index} style={styles.choiceCard}>
      <View style={styles.choiceHeaderRow}>
        <TextInput
  style={styles.choiceTitleInput}
  value={choice.label}
  placeholder="Choice text"
  onChangeText={(text) => {
    setChoices((currentChoices) =>
      currentChoices.map((currentChoice, choiceIndex) =>
        choiceIndex === index
          ? { ...currentChoice, label: text }
          : currentChoice
      )
    );
  }}
/>

        <Pressable
          style={styles.deleteChoiceButton}
          onPress={() => {
            setChoices((currentChoices) =>
              currentChoices.filter((_, choiceIndex) => choiceIndex !== index)
            );
          }}
        >
          <Text style={styles.deleteChoiceText}>✕</Text>
        </Pressable>
      </View>

      <Text style={styles.choiceTargetText}>
        {choice.targetSceneId
          ? `Leads to: ${targetScene?.title || 'Unknown scene'}`
          : 'No target selected'}
      </Text>

      {(choice.rememberChoice ||
  requiredRememberedChoice ||
  valueChangeLabel ||
  requiredValueLabel) && (
        <View style={styles.logicSummaryBox}>
          {choice.rememberChoice && (
            <Text style={styles.logicSummaryText}>✨Leaves a story trace</Text>
          )}

          {requiredRememberedChoice && (
            <Text style={styles.logicSummaryText}>
              🔒 Needs trace: {requiredRememberedChoice.sceneTitle} →{' '}
              {requiredRememberedChoice.choiceLabel}
            </Text>
          )}

          {valueChangeLabel && (
  <Text style={styles.logicSummaryText}>
    🔢 Changes: {valueChangeLabel}
  </Text>
)}

{requiredValueLabel && (
  <Text style={styles.logicSummaryText}>
    🔒 If value: {requiredValueLabel}
  </Text>
)}
        </View>
      )}

<View style={styles.choiceActionStack}>
  <Pressable
    style={styles.choiceActionButton}
    onPress={() => {
      setExpandedChoiceIndex(
        expandedChoiceIndex === index ? null : index
      );
    }}
  >
    <Text style={styles.choiceActionText}>
      {expandedChoiceIndex === index ? 'Hide destination' : 'Leads to...'}
    </Text>
  </Pressable>

  <Pressable
    style={styles.choiceActionButton}
    onPress={() => {
      setExpandedLogicChoiceIndex(
        expandedLogicChoiceIndex === index ? null : index
      );
    }}
  >
    <Text style={styles.choiceActionText}>
      {expandedLogicChoiceIndex === index ? 'Hide story memory' : 'Story memory'}
    </Text>
  </Pressable>
</View>

      {expandedChoiceIndex === index && (
        <View style={styles.targetBox}>
          <Text style={styles.logicSectionTitle}>Where does this choice lead?</Text>

{scenes.map((targetScene, sceneIdx) => {
  const isSelected = choice.targetSceneId === targetScene.id;

  return (
    <View key={targetScene.id} style={styles.targetOptionRow}>
      <Pressable
        onPress={() => {
          const updatedChoices = [...choices];
          updatedChoices[index] = {
            ...choice,
            targetSceneId: targetScene.id,
          };
          setChoices(updatedChoices);
          setExpandedChoiceIndex(null);
        }}
        style={[
          styles.targetSelectButton,
          isSelected && styles.targetSelectButtonSelected,
        ]}
      >
        <Text
          style={[
            styles.targetOptionText,
            isSelected && styles.targetOptionTextSelected,
          ]}
        >
          → {targetScene.title || `Scene ${sceneIdx + 1}`}
        </Text>
      </Pressable>

      <Pressable
        style={styles.openTargetButton}
        onPress={() => {
          const saved = saveCurrentScene();
          if (!saved) return;

          router.replace({
  pathname: '/scene-editor',
  params: {
    sceneId: targetScene.id,
    returnSceneId: saved.sceneId,
  },
});
        }}
      >
        <Text style={styles.openTargetButtonText}>Open</Text>
      </Pressable>
    </View>
  );
})}
        </View>
      )}

      {expandedLogicChoiceIndex === index && (
        <View style={styles.logicBox}>
          <View style={styles.titleWithInfo}>
  <Text style={styles.logicSectionTitle}> Story memory for this choice</Text>

  <Pressable style={styles.infoButton} onPress={showConditionalChoiceInfo}>
    <Text style={styles.infoButtonText}>ⓘ</Text>
  </Pressable>
</View>

<View style={styles.logicSubsection}>
  <Text style={styles.logicSubsectionTitle}>✨ Story trace</Text>

         <Text style={styles.advancedSectionLabel}>
    Only show this choice if...
</Text>

<Text style={styles.choiceMetaLabel}>
  The player has a story trace:
</Text>

          {availableConditions.length > 0 ? (
            <View style={styles.rememberedChoiceList}>
              {availableConditions.map((rememberedChoice) => {
                const isSelected =
                  choice.requiredChoiceId === rememberedChoice.id;

                return (
                  <Pressable
                    key={rememberedChoice.id}
                    style={[
                      styles.rememberedChoiceChip,
                      isSelected && styles.rememberedChoiceChipSelected,
                    ]}
                    onPress={() => {
                      setChoices((currentChoices) =>
                        currentChoices.map((currentChoice, choiceIndex) =>
                          choiceIndex === index
                            ? {
                                ...currentChoice,
                                requiredChoiceId: isSelected
                                  ? undefined
                                  : rememberedChoice.id,
                              }
                            : currentChoice
                        )
                      );
                    }}
                  >
                    <Text
                      style={[
                        styles.rememberedChoiceChipText,
                        isSelected &&
                          styles.rememberedChoiceChipTextSelected,
                      ]}
                    >
                      {rememberedChoice.sceneTitle} →{' '}
                      {rememberedChoice.choiceLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={styles.helperText}>
              No story traces yet. Turn on “Leave a story trace” for another choice first.
            </Text>
          )}


                    <Text style={styles.advancedSectionLabel}>After the player chooses this...</Text>

          <Pressable
            style={styles.checkboxRow}
            onPress={() => {
              setChoices((currentChoices) =>
                currentChoices.map((currentChoice, choiceIndex) =>
                  choiceIndex === index
                    ? {
                        ...currentChoice,
                        id: currentChoice.id || createChoiceId(),
                        rememberChoice: !currentChoice.rememberChoice,
                      }
                    : currentChoice
                )
              );
            }}
          >
            <Text style={styles.checkbox}>
              {choice.rememberChoice ? '☑' : '☐'}
            </Text>
            <View style={styles.checkboxTextArea}>
  <View style={styles.inlineLabelWithInfo}>
    <Text style={styles.checkboxLabel}>Leave a story trace?</Text>

    <Pressable style={styles.smallInfoButton} onPress={showStoryTraceInfo}>
      <Text style={styles.smallInfoButtonText}>ⓘ</Text>
    </Pressable>
  </View>

</View>
          </Pressable>

</View>


{hasStoryValues && (
  <View style={styles.logicSubsection}>
    <Text style={styles.logicSubsectionTitle}>🫐 Story values</Text>
          <Text style={styles.choiceMetaLabel}>
  This choice is visible only if this condition is true...
</Text>

{storyValueDefinitions.length > 0 ? (
  <>
    <View style={styles.valueChipRow}>
      {storyValueDefinitions.map((storyValue) => {
        const isSelected =
          choice.requiredValue?.valueId === storyValue.id ||
          choice.requiredValue?.name === storyValue.name;

        return (
          <Pressable
            key={storyValue.id}
            style={[
              styles.valueChip,
              isSelected && styles.valueChipSelected,
            ]}
            onPress={() => {
              setChoices((currentChoices) =>
                currentChoices.map((currentChoice, choiceIndex) =>
                  choiceIndex === index
                    ? {
                        ...currentChoice,
                        requiredValue: isSelected
                          ? undefined
                          : {
                              valueId: storyValue.id,
                              name: storyValue.name,
                              operator:
                                currentChoice.requiredValue?.operator ||
                                'atLeast',
                              amount:
                                currentChoice.requiredValue?.amount ??
                                storyValue.initialValue,
                            },
                      }
                    : currentChoice
                )
              );
            }}
          >
            <Text
              style={[
                styles.valueChipText,
                isSelected && styles.valueChipTextSelected,
              ]}
            >
              {storyValue.name}
            </Text>
          </Pressable>
        );
      })}
    </View>

    {selectedRequiredValue && choice.requiredValue && (
      <View style={styles.valueConditionBox}>
        <Pressable
          style={styles.operatorPill}
          onPress={() => {
            setChoices((currentChoices) =>
              currentChoices.map((currentChoice, choiceIndex) =>
                choiceIndex === index
                  ? {
                      ...currentChoice,
                      requiredValue: {
                        valueId: selectedRequiredValue.id,
                        name: selectedRequiredValue.name,
                        operator: getNextStoryValueOperator(
                          currentChoice.requiredValue?.operator
                        ),
                        amount:
                          currentChoice.requiredValue?.amount ??
                          selectedRequiredValue.initialValue,
                      },
                    }
                  : currentChoice
              )
            );
          }}
        >
          <Text style={styles.operatorPillText}>
            {getStoryValueOperatorLabel(choice.requiredValue.operator)}
          </Text>
        </Pressable>

        <View style={styles.valueAmountControl}>
          <Pressable
            style={styles.valueAmountButton}
            onPress={() => {
              setChoices((currentChoices) =>
                currentChoices.map((currentChoice, choiceIndex) => {
                  if (choiceIndex !== index) return currentChoice;

                  const currentAmount =
                    currentChoice.requiredValue?.amount ??
                    selectedRequiredValue.initialValue;

                  return {
                    ...currentChoice,
                    requiredValue: {
                      valueId: selectedRequiredValue.id,
                      name: selectedRequiredValue.name,
                      operator:
                        currentChoice.requiredValue?.operator || 'atLeast',
                      amount: clampNumber(
                        currentAmount - selectedRequiredValue.step,
                        selectedRequiredValue.minValue,
                        selectedRequiredValue.maxValue
                      ),
                    },
                  };
                })
              );
            }}
          >
            <Text style={styles.valueAmountButtonText}>−</Text>
          </Pressable>

          <Text style={styles.valueAmountText}>
            {choice.requiredValue.amount ?? selectedRequiredValue.initialValue}
          </Text>

          <Pressable
            style={styles.valueAmountButton}
            onPress={() => {
              setChoices((currentChoices) =>
                currentChoices.map((currentChoice, choiceIndex) => {
                  if (choiceIndex !== index) return currentChoice;

                  const currentAmount =
                    currentChoice.requiredValue?.amount ??
                    selectedRequiredValue.initialValue;

                  return {
                    ...currentChoice,
                    requiredValue: {
                      valueId: selectedRequiredValue.id,
                      name: selectedRequiredValue.name,
                      operator:
                        currentChoice.requiredValue?.operator || 'atLeast',
                      amount: clampNumber(
                        currentAmount + selectedRequiredValue.step,
                        selectedRequiredValue.minValue,
                        selectedRequiredValue.maxValue
                      ),
                    },
                  };
                })
              );
            }}
          >
            <Text style={styles.valueAmountButtonText}>+</Text>
          </Pressable>
        </View>
      </View>
    )}
  </>
) : (
  <Text style={styles.helperText}>
    Set up something that can increase or decrease on the Story screen first.
  </Text>
)}


<View style={styles.inlineLabelWithInfo}>
  <Text style={styles.logicHelperText}>
    Choose a story value, then decide whether this choice increases or decreases it.
  </Text>

  <Pressable style={styles.smallInfoButton} onPress={showStoryValueInfo}>
    <Text style={styles.smallInfoButtonText}>ⓘ</Text>
  </Pressable>
</View>

{storyValueDefinitions.length > 0 ? (
  <>
    <View style={styles.valueChipRow}>
      {storyValueDefinitions.map((storyValue) => {
        const isSelected =
          choice.valueChange?.valueId === storyValue.id ||
          choice.valueChange?.name === storyValue.name;

        return (
          <Pressable
            key={storyValue.id}
            style={[
              styles.valueChip,
              isSelected && styles.valueChipSelected,
            ]}
            onPress={() => {
              setChoices((currentChoices) =>
                currentChoices.map((currentChoice, choiceIndex) =>
                  choiceIndex === index
                    ? {
                        ...currentChoice,
                        valueChange: isSelected
                          ? undefined
                          : {
                              valueId: storyValue.id,
                              name: storyValue.name,
                              amount: storyValue.step,
                            },
                      }
                    : currentChoice
                )
              );
            }}
          >
            <Text
              style={[
                styles.valueChipText,
                isSelected && styles.valueChipTextSelected,
              ]}
            >
              {storyValue.name}
            </Text>
          </Pressable>
        );
      })}
    </View>

    {selectedChangeValue && choice.valueChange && (
      <View style={styles.valueChangeDirectionRow}>
        <Pressable
          style={[
            styles.valueDirectionButton,
            choice.valueChange.amount === -selectedChangeValue.step &&
              styles.valueDirectionButtonSelected,
          ]}
          onPress={() => {
            setChoices((currentChoices) =>
              currentChoices.map((currentChoice, choiceIndex) =>
                choiceIndex === index
                  ? {
                      ...currentChoice,
                      valueChange: {
                        valueId: selectedChangeValue.id,
                        name: selectedChangeValue.name,
                        amount: -selectedChangeValue.step,
                      },
                    }
                  : currentChoice
              )
            );
          }}
        >
          <Text
            style={[
              styles.valueDirectionText,
              choice.valueChange.amount === -selectedChangeValue.step &&
                styles.valueDirectionTextSelected,
            ]}
          >
            −{selectedChangeValue.step}
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.valueDirectionButton,
            choice.valueChange.amount === selectedChangeValue.step &&
              styles.valueDirectionButtonSelected,
          ]}
          onPress={() => {
            setChoices((currentChoices) =>
              currentChoices.map((currentChoice, choiceIndex) =>
                choiceIndex === index
                  ? {
                      ...currentChoice,
                      valueChange: {
                        valueId: selectedChangeValue.id,
                        name: selectedChangeValue.name,
                        amount: selectedChangeValue.step,
                      },
                    }
                  : currentChoice
              )
            );
          }}
        >
          <Text
            style={[
              styles.valueDirectionText,
              choice.valueChange.amount === selectedChangeValue.step &&
                styles.valueDirectionTextSelected,
            ]}
          >
            +{selectedChangeValue.step}
          </Text>
        </Pressable>
      </View>
    )}
  </>
) : (
  <Text style={styles.helperText}>
    Set up something that can increase or decrease on the Story screen first.
  </Text>
)}

{(choice.valueChange?.valueId || choice.valueChange?.name?.trim()) ? (
  <Pressable
    style={styles.clearLogicButton}
    onPress={() => {
      setChoices((currentChoices) =>
        currentChoices.map((currentChoice, choiceIndex) =>
          choiceIndex === index
            ? { ...currentChoice, valueChange: undefined }
            : currentChoice
        )
      );
    }}
  >
    <Text style={styles.clearLogicText}>Clear value change</Text>
  </Pressable>
) : null}

 
{(choice.requiredValue?.valueId || choice.requiredValue?.name?.trim()) ? (
  <Pressable
    style={styles.clearLogicButton}
    onPress={() => {
      setChoices((currentChoices) =>
        currentChoices.map((currentChoice, choiceIndex) =>
          choiceIndex === index
            ? { ...currentChoice, requiredValue: undefined }
            : currentChoice
        )
      );
    }}
  >
    <Text style={styles.clearLogicText}>Clear value condition</Text>
  </Pressable>
) : null}

          {choice.requiredChoiceId ? (
            <Pressable
              style={styles.clearLogicButton}
              onPress={() => {
                setChoices((currentChoices) =>
                  currentChoices.map((currentChoice, choiceIndex) =>
                    choiceIndex === index
                      ? { ...currentChoice, requiredChoiceId: undefined }
                      : currentChoice
                  )
                );
              }}
            >
              <Text style={styles.clearLogicText}>Clear condition</Text>
            </Pressable>
          ) : null}
    </View>

)}

        </View>
      )}

      



      {choice.targetSceneId === undefined && existingScene && (
        <Pressable
          style={styles.createNextSceneButton}
          onPress={() => {
            const existingIndex = scenes.findIndex(
              (scene) => scene.id === existingScene.id
            );

            updateScene(existingIndex, {
              id: existingScene.id,
              title: sceneTitle || 'Untitled scene',
              text: sceneText || '',
              choices,
              assets,
            });

            router.push({
              pathname: '/scene-editor',
              params: {
                parentSceneId: existingScene.id,
                choiceIndex: index.toString(),
              },
            });
          }}
        >
          <Text style={styles.choiceActionText}>+ Create next scene 🌿</Text>
        </Pressable>
      )}
    </View>
  );
})}
      
<View style={styles.addChoiceCard}>
  <View style={styles.titleWithInfo}>
  <Text style={styles.addChoiceTitle}>Add a choice ➡️ </Text>

  <Pressable style={styles.infoButton} onPress={showChoiceInfo}>
    <Text style={styles.infoButtonText}>ⓘ</Text>
  </Pressable>
</View>


  <TextInput
    style={styles.addChoiceInput}
    placeholder="e.g. Follow the path"
    value={newChoice}
    onChangeText={setNewChoice}
    onFocus={() => {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 300);
    }}
  />

  <Pressable
    style={[
      styles.addChoiceButton,
      !newChoice.trim() && styles.addChoiceButtonDisabled,
    ]}
    onPress={() => {
      if (!newChoice.trim()) return;

      setChoices([
        ...choices,
        {
          id: createChoiceId(),
          label: newChoice.trim(),
        },
      ]);

      setNewChoice('');
    }}
  >
    <Text
      style={[
        styles.addChoiceButtonText,
        !newChoice.trim() && styles.addChoiceButtonTextDisabled,
      ]}
    >
      Add choice ➡️
    </Text>
  </Pressable>
</View>

 <View style={styles.sectionCard}>
  <Text style={styles.sectionTitle}>Scene media 🎨</Text>

  <Text style={styles.mediaStatus}>
    {assets.length > 0
      ? `🎨 ${assets.length} media item${assets.length === 1 ? '' : 's'} added`
      : 'No media added yet'}
  </Text>

  <Text style={styles.helperText}>
    Add images, drawings, audio, or voice notes. Your scene will be saved first so the media has somewhere to live.
  </Text>

  <Pressable
    style={styles.mediaButton}
    onPress={() => {
      const saved = saveCurrentScene();
      if (!saved) return;

      router.push({
        pathname: '/scene-media',
        params: {
          sceneId: saved.sceneId,
        },
      });
    }}
  >
    <Text style={styles.mediaButtonText}>Edit media</Text>
  </Pressable>
</View>

<Pressable
  style={styles.button}
  onPress={() => {
    const saved = saveCurrentScene();
    if (!saved) return;

    if (saved.wasNew) {
      router.replace({
        pathname: '/scene-editor',
        params: {
          sceneId: saved.sceneId,
          returnSceneId: typeof parentSceneId === 'string' ? parentSceneId : undefined,
        },
      });
    }
  }}
>
  <Text style={styles.buttonText}>Save scene</Text>
</Pressable>

    </ScrollView>
</KeyboardAvoidingView>
  </>
);
}

const styles = StyleSheet.create({
    container: {
        padding: 24,
        paddingTop: 52,
        paddingBottom: 100,
        backgroundColor: '#F7F1E1', // Add this extra padding so the button clears the bottom edge!
      },


returnSceneButton: {
  backgroundColor: '#FFFCF2',
  borderWidth: 1,
  borderColor: '#D8CCAA',
  paddingVertical: 12,
  paddingHorizontal: 14,
  borderRadius: 18,
  marginBottom: 12,
},

logicSubsection: {
  marginTop: 18,
  paddingTop: 14,
  borderTopWidth: 1,
  borderTopColor: '#E6E6E6',
},

logicSubsectionTitle: {
  fontSize: 17,
  fontWeight: '800',
  color: '#222',
  marginBottom: 8,
},

logicSubsectionText: {
  fontSize: 14,
  color: '#665D4E',
  lineHeight: 20,
  marginBottom: 10,
},

titleWithInfo: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
},

infoButton: {
  width: 28,
  height: 28,
  borderRadius: 999,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#EEF5EA',
  borderWidth: 1,
  borderColor: '#D6E5D0',
},

infoButtonText: {
  color: '#4F6F52',
  fontSize: 16,
  fontWeight: '800',
},

inlineLabelWithInfo: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  flexShrink: 1,
},

smallInfoButton: {
  width: 22,
  height: 22,
  borderRadius: 999,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#EEF5EA',
  borderWidth: 1,
  borderColor: '#D6E5D0',
},

smallInfoButtonText: {
  color: '#4F6F52',
  fontSize: 13,
  fontWeight: '800',
},

checkboxTextArea: {
  flex: 1,
},

returnSceneButtonText: {
  color: '#3D3528',
  fontWeight: '700',
},

      choiceTitleInput: {
  flex: 1,
  borderWidth: 1,
  borderColor: '#D8CCAA',
  borderRadius: 22,
  paddingVertical: 8,
  paddingHorizontal: 10,
  fontSize: 15,
  fontWeight: '600',
  backgroundColor: '#FFFDF7',
  marginRight: 8,
},

targetOptionRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  marginBottom: 8,
},

targetSelectButton: {
  flex: 1,
  paddingVertical: 12,
  paddingHorizontal: 12,
  borderRadius: 18,
  backgroundColor: '#247322',
  borderWidth: 1,
  borderColor: '#247322',
},

targetSelectButtonSelected: {
  borderColor: '#34C759',
  backgroundColor: '#247322',
},

openTargetButton: {
  paddingVertical: 10,
  paddingHorizontal: 12,
  borderRadius: 22,
  backgroundColor: '#FFFCF2',
  borderWidth: 1,
  borderColor: '#D8CCAA',
},

openTargetButtonText: {
  color: '#3D3528',
  fontWeight: '700',
  fontSize: 13,
},

originChoiceCard: {
  backgroundColor: '#FFFCF2',
  borderWidth: 1,
  borderColor: '#C9B46F',
  borderRadius: 20,
  padding: 14,
  marginBottom: 16,
},

originChoiceLabel: {
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  color: '#8A6400',
  fontWeight: '700',
  marginBottom: 4,
},

originChoiceText: {
  fontSize: 16,
  fontWeight: '700',
  color: '#3D3528',
  marginBottom: 4,
},

originChoiceSubtext: {
  color: '#665D4E',
  lineHeight: 20,
},

valueChipSelected: {
  backgroundColor: '#247322',
  borderColor: '#247322',
},

valueChipTextSelected: {
  color: '#fff',
},

valueConditionBox: {
  marginTop: 4,
  marginBottom: 8,
  gap: 8,
},

valueAmountControl: {
  flexDirection: 'row',
  alignItems: 'center',
  alignSelf: 'flex-start',
  borderWidth: 1,
  borderColor: '#D8CCAA',
  borderRadius: 999,
  overflow: 'hidden',
  backgroundColor: '#FFFCF2',
},

valueAmountButton: {
  paddingVertical: 8,
  paddingHorizontal: 14,
},

valueAmountButtonText: {
  fontSize: 18,
  fontWeight: '700',
  color: '#3D3528',
},

valueAmountText: {
  minWidth: 44,
  textAlign: 'center',
  fontWeight: '700',
  color: '#3D3528',
},

valueChangeDirectionRow: {
  flexDirection: 'row',
  gap: 8,
  marginTop: 4,
  marginBottom: 8,
},

valueDirectionButton: {
  paddingVertical: 10,
  paddingHorizontal: 16,
  borderRadius: 999,
  backgroundColor: '#FFFCF2',
  borderWidth: 1,
  borderColor: '#D8CCAA',
},

valueDirectionButtonSelected: {
  backgroundColor: '#247322',
  borderColor: '#247322',
},

valueDirectionText: {
  color: '#3D3528',
  fontWeight: '700',
},

valueDirectionTextSelected: {
  color: '#fff',
},

choiceActionStack: {
  marginTop: 4,
  gap: 4,
},

advancedSectionLabel: {
  fontSize: 13,
  fontWeight: '700',
  color: '#3D3528',
  marginTop: 12,
  marginBottom: 6,
},

      logicHelperText: {
  color: '#8C806F',
  fontSize: 12,
  lineHeight: 18,
  marginBottom: 8,
},

valueRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  marginBottom: 8,
},

valueInput: {
  borderWidth: 1,
  borderColor: '#D8CCAA',
  borderRadius: 22,
  paddingVertical: 10,
  paddingHorizontal: 10,
  backgroundColor: '#FFFCF2',
},

valueNameInput: {
  flex: 1,
},

valueNumberInput: {
  width: 72,
},

operatorPill: {
  paddingVertical: 10,
  paddingHorizontal: 10,
  borderRadius: 999,
  backgroundColor: '#FFFCF2',
  borderWidth: 1,
  borderColor: '#D8CCAA',
},

operatorPillText: {
  fontSize: 12,
  color: '#3D3528',
  fontWeight: '600',
},

valueChipRow: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 8,
  marginBottom: 8,
},

valueChip: {
  paddingVertical: 6,
  paddingHorizontal: 10,
  borderRadius: 999,
  backgroundColor: '#FFFCF2',
  borderWidth: 1,
  borderColor: '#D8CCAA',
},

valueChipText: {
  fontSize: 12,
  color: '#3D3528',
},
  mainSectionHeading: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    color: '#2A251D',
    marginTop: 8,
    marginBottom: 14,
  },
  heading: {
    fontSize: 24,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D8CCAA',
    borderRadius: 20,
    padding: 12,
    marginBottom: 12,
  },
  textArea: {
    minHeight: 120,
  },

  storyContext: {
    color: '#665D4E',
    marginBottom: 16,
  },

  buttonSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#D8CCAA',
  },
  button: {
    backgroundColor: '#247322',
    paddingVertical: 14,
    borderRadius: 20,
    marginTop: 24,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
  },
  prompt: {
    fontSize: 13,
    color: '#665D4E',
    marginBottom: 8,
    fontStyle: 'italic',
  },

helperText: {
  color: '#8C806F',
  marginBottom: 16,
  lineHeight: 20,
},

choiceMetaLabel: {
  fontSize: 12,
  color: '#8C806F',
  marginTop: 10,
  marginBottom: 6,
},

choiceCard: {
  borderWidth: 1,
  borderColor: '#D8CCAA',
  borderRadius: 20,
  padding: 12,
  marginBottom: 14,
  backgroundColor: '#FFFCF2',
},

choiceHeaderRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},

choiceTitle: {
  fontWeight: '600',
  fontSize: 15,
  flex: 1,
  paddingRight: 8,
},

deleteChoiceButton: {
  padding: 8,
},

deleteChoiceText: {
  color: '#ff3b30',
  fontWeight: '700',
  fontSize: 18,
},

choiceTargetText: {
  color: '#665D4E',
  marginTop: 4,
  marginBottom: 8,
},

choiceActionRow: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 16,
  marginTop: 4,
},

choiceActionButton: {
  paddingVertical: 6,
},

choiceActionText: {
  color: '#247322',
  fontWeight: '600',
},

logicSummaryBox: {
  paddingVertical: 8,
  paddingHorizontal: 10,
  borderRadius: 22,
  backgroundColor: '#F5EFD9',
  marginTop: 4,
  marginBottom: 6,
},

logicSummaryText: {
  color: '#665D4E',
  fontSize: 13,
  marginBottom: 2,
},

logicBox: {
  marginTop: 10,
  padding: 12,
  borderRadius: 18,
  backgroundColor: '#F5EFD9',
  borderWidth: 1,
  borderColor: '#D8CCAA',
},

logicSectionTitle: {
  fontSize: 14,
  fontWeight: '600',
  marginBottom: 8,
},

checkboxRow: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 8,
  marginBottom: 8,
},

checkbox: {
  fontSize: 22,
  marginRight: 10,
},

checkboxLabel: {
  fontSize: 15,
  color: '#3D3528',
},

rememberedChoiceList: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  marginTop: 6,
  marginBottom: 8,
},

rememberedChoiceChip: {
  paddingVertical: 8,
  paddingHorizontal: 12,
  borderRadius: 999,
  backgroundColor: '#FFFCF2',
  borderWidth: 1,
  borderColor: '#D8CCAA',
  marginRight: 8,
  marginBottom: 8,
},

rememberedChoiceChipSelected: {
  backgroundColor: '#247322',
  borderColor: '#247322',
},

rememberedChoiceChipText: {
  fontSize: 12,
  color: '#3D3528',
},

rememberedChoiceChipTextSelected: {
  color: '#fff',
},

clearLogicButton: {
  marginTop: 4,
  paddingVertical: 6,
},

clearLogicText: {
  color: '#8C806F',
  fontSize: 13,
},

targetBox: {
  marginTop: 10,
  padding: 12,
  borderRadius: 18,
  backgroundColor: '#F5EFD9',
  borderWidth: 1,
  borderColor: '#D8CCAA',
},

targetOption: {
  paddingVertical: 7,
},

targetOptionText: {
  color: '#fff',
},

targetOptionTextSelected: {
  color: '#fff',
  fontWeight: '800',
},

createNextSceneButton: {
  marginTop: 8,
  paddingVertical: 8,
},

sectionCard: {
  backgroundColor: '#FFFCF2',
  borderRadius: 22,
  padding: 16,
  marginBottom: 20,
  borderWidth: 1,
  borderColor: '#D8CCAA',
},

sectionTitle: {
  fontSize: 18,
  fontWeight: '600',
  marginBottom: 12,
},

backButton: {
  paddingVertical: 12,
  paddingHorizontal: 14,
  borderRadius: 18,
  alignItems: 'center',
  marginBottom: 16,
  borderWidth: 1,
  borderColor: '#D8CCAA',
  backgroundColor: '#FFFCF2',
},

backButtonText: {
  fontSize: 15,
  color: '#3D3528',
},

mediaDescription: {
  color: '#665D4E',
  lineHeight: 20,
  marginBottom: 12,
},

mediaStatus: {
  color: '#665D4E',
  marginBottom: 12,
},

mediaButton: {
  paddingVertical: 12,
  paddingHorizontal: 14,
  borderRadius: 18,
  alignItems: 'center',
  borderWidth: 1,
  borderColor: '#D8CCAA',
  backgroundColor: '#FFFDF7',
},

mediaButtonText: {
  fontWeight: '600',
  color: '#3D3528',
},

addChoiceCard: {
  backgroundColor: '#FFFCF2',
  borderRadius: 22,
  padding: 16,
  marginTop: 4,
  marginBottom: 24,
  borderWidth: 1,
  borderColor: '#D8CCAA',
  borderStyle: 'dashed',
},

addChoiceTitle: {
  fontSize: 16,
  fontWeight: '600',
  marginBottom: 6,
},

addChoiceHint: {
  color: '#665D4E',
  fontSize: 14,
  lineHeight: 20,
  marginBottom: 12,
},

addChoiceInput: {
  borderWidth: 1,
  borderColor: '#D8CCAA',
  borderRadius: 18,
  padding: 12,
  marginBottom: 12,
  backgroundColor: '#FFFDF7',
},

addChoiceButton: {
  paddingVertical: 12,
  paddingHorizontal: 14,
  borderRadius: 18,
  alignItems: 'center',
  borderWidth: 1,
  borderColor: '#D8CCAA',
  backgroundColor: '#FFFDF7',
},

addChoiceButtonDisabled: {
  opacity: 0.5,
},

addChoiceButtonText: {
  fontWeight: '600',
  color: '#3D3528',
},

addChoiceButtonTextDisabled: {
  color: '#8C806F',
},

});