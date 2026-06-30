import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { useStoryStore } from '../store/storyStore';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

export default function NewStoryScreen() {
  const [title, setTitle] = useState('');
  const createStory = useStoryStore((state) => state.createStory);
  const importStory = useStoryStore((state) => state.importStory);

  const handleImportJson = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      if (!file?.uri) return;

      const jsonString = await FileSystem.readAsStringAsync(file.uri);
      const parsed = JSON.parse(jsonString);

      if (!parsed.id || !parsed.title || !Array.isArray(parsed.scenes)) {
        Alert.alert('Import failed', 'This file does not look like a valid Branch Beetle story JSON.');
        return;
      }

      importStory(parsed);
      Alert.alert('Import successful', `"${parsed.title}" was imported.`);
      router.push('/story');
    } catch (error) {
      console.error('Import error:', error);
      Alert.alert('Import failed', 'Could not read or import the JSON file.');
    }
  };

  const handleCreateStory = () => {
    createStory(title.trim() || 'Untitled story', 'fictional');
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

        <View style={styles.previewTile}>
          <Text style={styles.previewIcon}>🪲</Text>
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
        onPress={() => router.push('/templates')}
      >
        <Text style={styles.secondaryButtonText}>Choose a template</Text>
      </Pressable>

      <Pressable
        style={styles.secondaryButton}
        onPress={handleImportJson}
      >
        <Text style={styles.secondaryButtonText}>Import story</Text>
      </Pressable>
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
