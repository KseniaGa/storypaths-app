import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useStoryStore } from '../store/storyStore';
import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export default function StoryScreen() {
    const currentStory = useStoryStore((state) => state.getCurrentStory());
    const deleteScene = useStoryStore((state) => state.deleteScene);
    const scenes = currentStory?.scenes || [];
    const title = currentStory?.title || 'Untitled story';
    const exportCurrentStory = useStoryStore((state) => state.exportCurrentStory);
    const exportCurrentStoryAsHtml = useStoryStore((state) => state.exportCurrentStoryAsHtml);

    const getMimeTypeFromUri = (uri: string) => {
    const lower = uri.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  };


  const buildPortableHtml = async () => {
  if (!currentStory) return null;

  const scenesWithEmbeddedAssets = await Promise.all(
    currentStory.scenes.map(async (scene) => {
      const embeddedAssets = await Promise.all(
        (scene.assets || []).map(async (asset) => {
          if (asset.type !== 'image' || !asset.uri) return asset;

          try {
            const base64 = await FileSystem.readAsStringAsync(asset.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });

            const mimeType = getMimeTypeFromUri(asset.uri);

            return {
              ...asset,
              uri: `data:${mimeType};base64,${base64}`,
            };
          } catch (error) {
            console.error('Could not embed image:', asset.uri, error);
            return asset;
          }
        })
      );

      return {
        ...scene,
        assets: embeddedAssets,
      };
    })
  );

  const portableStory = {
    ...currentStory,
    scenes: scenesWithEmbeddedAssets,
  };

  const storyJson = JSON.stringify(portableStory);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${portableStory.title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(180deg, #fdf6ff 0%, #f5f9ff 100%);
      color: #2a2a2a;
      margin: 0;
      padding: 0;
    }

    .container {
      max-width: 720px;
      margin: 40px auto;
      padding: 0 20px;
    }

    .card {
      background: white;
      border-radius: 16px;
      padding: 28px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    }

    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      gap: 12px;
    }

    .story-title {
      font-size: 0.9rem;
      color: #888;
    }

    h1 {
      font-size: 1.8rem;
      margin-bottom: 16px;
      margin-top: 0;
    }

    .scene-image {
      width: 100%;
      border-radius: 10px;
      margin-bottom: 20px;
      max-height: 340px;
      object-fit: cover;
    }

    .scene-text {
      font-size: 1.05rem;
      line-height: 1.7;
      margin-bottom: 24px;
      white-space: pre-wrap;
    }

    .choices {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    button {
      border: none;
      border-radius: 10px;
      padding: 14px 16px;
      font-size: 1rem;
      background: #3a3a3a;
      color: white;
      cursor: pointer;
      transition: all 0.15s ease;
      text-align: left;
    }

    button:hover {
      background: #555;
      transform: translateY(-1px);
    }

    .restart {
      background: #bbb;
      color: #222;
    }

    .restart:hover {
      background: #999;
    }

    .empty {
      color: #999;
      margin-top: 16px;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="topbar">
        <div class="story-title">${portableStory.title} · ${portableStory.mode}</div>
        <button class="restart" onclick="restartStory()">Restart</button>
      </div>

      <h1 id="scene-title"></h1>
      <img id="scene-image" class="scene-image" style="display:none;" />
      <div id="scene-text" class="scene-text"></div>
      <div id="choices" class="choices"></div>
      <div id="empty" class="empty" style="display:none;"></div>
    </div>
  </div>

  <script>
    const story = ${storyJson};
    let currentSceneId = story.scenes[0]?.id;

    function getSceneById(id) {
      return story.scenes.find(scene => scene.id === id);
    }

    function renderScene() {
      const scene = getSceneById(currentSceneId);
      const titleEl = document.getElementById('scene-title');
      const textEl = document.getElementById('scene-text');
      const choicesEl = document.getElementById('choices');
      const emptyEl = document.getElementById('empty');
      const imageEl = document.getElementById('scene-image');

      if (!scene) {
        titleEl.textContent = 'Missing scene';
        textEl.textContent = '';
        choicesEl.innerHTML = '';
        emptyEl.style.display = 'block';
        emptyEl.textContent = 'This scene could not be found.';
        imageEl.style.display = 'none';
        return;
      }

      titleEl.textContent = scene.title || 'Untitled scene';
      textEl.textContent = scene.text || '';

      const firstImage = scene.assets && scene.assets.length > 0 ? scene.assets[0] : null;
      if (firstImage && firstImage.uri) {
        imageEl.src = firstImage.uri;
        imageEl.alt = firstImage.alt || '';
        imageEl.style.display = 'block';
      } else {
        imageEl.style.display = 'none';
        imageEl.removeAttribute('src');
      }

      choicesEl.innerHTML = '';
      emptyEl.style.display = 'none';

      if (scene.choices && scene.choices.length > 0) {
        scene.choices.forEach(choice => {
          const btn = document.createElement('button');
          btn.textContent = choice.label + (choice.targetSceneId ? '' : ' (no target yet)');
          btn.onclick = () => {
            if (choice.targetSceneId) {
              currentSceneId = choice.targetSceneId;
              renderScene();
            }
          };
          choicesEl.appendChild(btn);
        });
      } else {
        emptyEl.style.display = 'block';
        emptyEl.textContent = 'The story ends here.';
      }
    }

    function restartStory() {
      currentSceneId = story.scenes[0]?.id;
      renderScene();
    }

    renderScene();
  </script>
</body>
</html>`;
};

  return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
      <Text style={styles.title}>{title || 'Untitled story'}</Text>

      {scenes.length === 0 && (
        <Text style={styles.subtitle}>Your story has no scenes yet.</Text>
      )}

      {scenes.map((scene) => (
        <Pressable
          key={scene.id}
          style={styles.sceneCard}
          onPress={() =>
            router.push({
              pathname: '/scene-editor',
              params: {
                sceneId: scene.id,
              },
            })
          }
        >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.sceneTitle}>{scene.title}</Text>

            <Pressable
              onPress={() => deleteScene(scene.id)}
              style={{ padding: 6 }}
            >
              <Text style={{ color: '#ff3b30', fontWeight: '600' }}>✕</Text>
            </Pressable>
          </View>

          <Text style={styles.sceneText}>{scene.text}</Text>

            {scene.choices?.map((choice, i) => {
              const targetScene = scenes.find((s) => s.id === choice.targetSceneId);

              return (
                <Text key={i} style={styles.choice}>
                  → {choice.label}
                  {choice.targetSceneId ? ` → ${targetScene?.title || 'Unknown'}` : ''}
                </Text>
              );
            })}
        </Pressable>
      ))}

      <Pressable
        style={styles.button}
        onPress={() =>
          router.push({
            pathname: '/scene-editor',
            params: { storyTitle: title },
          })
        }
      >
        <Text style={styles.buttonText}>+ Add scene</Text>
      </Pressable>

      <Pressable
      style={styles.playButton}
      onPress={() => router.push('/play')}
    >
      <Text style={styles.buttonText}>▶ Play story</Text>
    </Pressable>

    <Pressable
      style={styles.exportButton}

onPress={async () => {
  const json = exportCurrentStory();

  if (!json) {
    Alert.alert('Export failed', 'No current story to export.');
    return;
  }

  try {
    const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'story'}.json`;
    const fileUri = FileSystem.documentDirectory + fileName;

    await FileSystem.writeAsStringAsync(fileUri, json, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const canShare = await Sharing.isAvailableAsync();

    if (!canShare) {
      Alert.alert('Export saved', `JSON saved to: ${fileUri}`);
      return;
    }

    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: 'Export story JSON',
    });
  } catch (error) {
    console.error('Export error:', error);
    Alert.alert('Export failed', 'Could not create or share the JSON file.');
  }
}}

    >
      <Text style={styles.buttonText}>⬇ Export JSON</Text>
    </Pressable>

    <Pressable
      style={styles.exportButton}
      onPress={async () => {
        const html = await buildPortableHtml();

        if (!html) {
          Alert.alert('Export failed', 'No current story to export.');
          return;
        }

        try {
          const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'story'}.html`;
          const fileUri = FileSystem.documentDirectory + fileName;

          await FileSystem.writeAsStringAsync(fileUri, html, {
            encoding: FileSystem.EncodingType.UTF8,
          });

          const canShare = await Sharing.isAvailableAsync();

          if (!canShare) {
            Alert.alert('Export saved', `HTML saved to: ${fileUri}`);
            return;
          }

          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/html',
            dialogTitle: 'Export story HTML',
          });
        } catch (error) {
          console.error('HTML export error:', error);
          Alert.alert('Export failed', 'Could not create or share the HTML file.');
        }
      }}
    >
      <Text style={styles.buttonText}>🌐 Export HTML</Text>
    </Pressable>

      



    </ScrollView>
  );
}


const styles = StyleSheet.create({
container: {
    padding: 24,
    paddingBottom: 80, // Gives your 'Play story' button room to breathe!
  },
  title: {
    fontSize: 24,
    marginBottom: 12,
  },
  subtitle: {
    color: '#666',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#222',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
  sceneCard: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    width: '100%',
  },
  sceneTitle: {
    fontSize: 18,
    marginBottom: 4,
  },
  sceneText: {
    color: '#555',
  },
  choice: {
    color: '#777',
    marginTop: 4,
  },

  playButton: {
    backgroundColor: '#444',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
},

exportButton: {
  backgroundColor: '#666',
  paddingVertical: 14,
  paddingHorizontal: 20,
  borderRadius: 8,
  alignItems: 'center',
  marginTop: 12,
},

});