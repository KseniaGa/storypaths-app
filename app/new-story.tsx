import { restoreStoryBackup } from '../utils/storyBackup';
import { useStoryImportConflict } from '../components/story-import-conflict';
import { showMessage } from '../utils/platformDialogs';
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { useState, useRef } from 'react';
import { router } from 'expo-router';
import { useStoryStore, storyPersistence } from '../store/storyStore';
import * as DocumentPicker from 'expo-document-picker';
import { validateStoryImport } from '../utils/storyData';
import { readPickedTextFile } from '../utils/platformFiles';
import { STORY_ICON_PRESETS } from '../data/storyContent';

export default function NewStoryScreen() {
  const importInProgress = useRef(false);
  const { chooseImportConflict, importConflictDialog } = useStoryImportConflict();
  const [title, setTitle] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(STORY_ICON_PRESETS[0]);
  const createStory = useStoryStore((state) => state.createStory);
  const importStory = useStoryStore((state) => state.importStory);

  const handleImportJson = async () => {
    if (importInProgress.current) return;
    importInProgress.current = true;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        // Read Android's granted content URI immediately, avoiding Expo Go's
        // shared picker cache (which can fail project-scoped permissions).
        copyToCacheDirectory: Platform.OS !== 'android',
        base64: false,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      if (!file?.uri) return;

      const jsonString = await readPickedTextFile(file);
      const parsed = JSON.parse(jsonString);

      const validation = validateStoryImport(parsed);
      if (!validation.valid) {
        showMessage('Import failed', validation.message);
        return;
      }

      const existing = useStoryStore.getState().stories.find((story) => story.id === parsed.id);
      const importMode = existing ? await chooseImportConflict(existing.title) : undefined;
      if (importMode === 'cancel') return;

      const restored = await restoreStoryBackup(parsed);
      importStory(restored.story, importMode);
      await storyPersistence.retry();
      if (storyPersistence.getStatus() === 'error') {
        showMessage('Imported, but not saved', 'The story is open in this session, but could not be saved to this device. Keep the app open and retry saving.');
      }
      if (restored.warnings.length) showMessage('Check imported media', restored.warnings.join('\n'));
      router.push('/story');
    } catch (error) {
      console.error('Import error:', error);
      showMessage('Import failed', error instanceof Error ? error.message : 'Could not read or import the JSON file.');
    } finally {
      importInProgress.current = false;
    }
  };

  const handleCreateStory = () => {
    createStory(title.trim() || 'Untitled story', 'fictional', selectedIcon);
    router.push('/story');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>← Home</Text>
      </Pressable>

      <View style={styles.heroCard}>
        <View style={styles.heroIconTile}>
          <Text style={styles.heroIcon}>🌱</Text>
        </View>

        <View style={styles.heroTextArea}>
          <Text style={styles.heading}>Start a new story</Text>
          <Text style={styles.intro}>
            Give your story a name. You can start simple and change things later.
          </Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.label}>Story title</Text>

        <TextInput
          style={styles.input}
          placeholder="My story"
          placeholderTextColor="#8C806F"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.iconLabel}>Story icon</Text>
        <View style={styles.iconGrid}>
          {STORY_ICON_PRESETS.map((icon) => (
            <Pressable
              key={icon}
              style={[
                styles.iconChoice,
                selectedIcon === icon && styles.iconChoiceSelected,
              ]}
              onPress={() => setSelectedIcon(icon)}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedIcon === icon }}
              accessibilityLabel={`Use ${icon} as the story icon`}
            >
              <Text style={styles.iconChoiceText}>{icon}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.previewTile}>
          <Text style={styles.previewIcon}>{selectedIcon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.previewLabel}>Preview</Text>
            <Text style={styles.previewTitle}>{title.trim() || 'Untitled story'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.reassuranceBox}>
        <Text style={styles.reassuranceText}>
          Your story can be based on real experience, told through symbols, or completely fictional.
        </Text>
      </View>

      <Pressable style={styles.button} onPress={handleCreateStory}>
        <Text style={styles.buttonText}>Create blank story</Text>
      </Pressable>

      <Pressable
        style={styles.secondaryButton}
        onPress={() =>
          router.push({
            pathname: '/templates',
            params: {
              storyTitle: title.trim() || 'Untitled story',
              storyIcon: selectedIcon,
            },
          })
        }
      >
        <Text style={styles.secondaryButtonText}>Choose a template</Text>
      </Pressable>

      <Pressable
        style={styles.secondaryButton}
        onPress={handleImportJson}
      >
        <Text style={styles.secondaryButtonText}>Import story</Text>
      </Pressable>
      {importConflictDialog}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 52,
    paddingBottom: 80,
    backgroundColor: '#F7F1E1',
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8CCAA',
    backgroundColor: '#FFFCF2',
    marginBottom: 18,
  },
  backButtonText: {
    color: '#3D3528',
    fontSize: 16,
    fontWeight: '800',
  },
  heroCard: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    backgroundColor: '#F5EFD9',
    borderWidth: 2,
    borderColor: '#C9B46F',
    borderRadius: 28,
    padding: 18,
    marginBottom: 22,
  },
  heroIconTile: {
    width: 74,
    height: 74,
    borderRadius: 24,
    backgroundColor: '#E9F2DD',
    borderWidth: 2,
    borderColor: '#6E9358',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIcon: {
    fontSize: 36,
  },
  heroTextArea: {
    flex: 1,
  },
  heading: {
    fontSize: 30,
    fontWeight: '900',
    color: '#247322',
    marginBottom: 6,
  },
  intro: {
    fontSize: 16,
    color: '#665D4E',
    lineHeight: 23,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: '#FFFCF2',
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#D8CCAA',
  },
  label: {
    fontSize: 15,
    fontWeight: '900',
    color: '#2A251D',
    marginBottom: 10,
  },
  input: {
    borderWidth: 2,
    borderColor: '#6E9358',
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    fontSize: 18,
    color: '#2A251D',
    backgroundColor: '#FFFDF7',
    fontWeight: '700',
  },
  iconLabel: {
    fontSize: 15,
    fontWeight: '900',
    color: '#2A251D',
    marginTop: 2,
    marginBottom: 9,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  iconChoice: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8CCAA',
    backgroundColor: '#FFFDF7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconChoiceSelected: {
    borderWidth: 2,
    borderColor: '#247322',
    backgroundColor: '#E9F2DD',
  },
  iconChoiceText: {
    fontSize: 23,
  },
  previewTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: '#EEF7E4',
  },
  previewIcon: {
    fontSize: 30,
  },
  previewLabel: {
    color: '#6F675A',
    fontSize: 13,
    fontWeight: '800',
  },
  previewTitle: {
    color: '#2A251D',
    fontSize: 17,
    fontWeight: '900',
  },
  reassuranceBox: {
    backgroundColor: '#FFFCF2',
    borderWidth: 1,
    borderColor: '#D8CCAA',
    borderRadius: 24,
    padding: 18,
    marginBottom: 22,
  },
  reassuranceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  reassuranceIcon: {
    fontSize: 22,
  },
  reassuranceTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#2A251D',
  },
  reassuranceText: {
    fontSize: 15,
    color: '#665D4E',
    lineHeight: 22,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#247322',
    paddingVertical: 17,
    borderRadius: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#D8CCAA',
    backgroundColor: '#FFFCF2',
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: '#3D3528',
    fontSize: 17,
    fontWeight: '900',
  },
});
