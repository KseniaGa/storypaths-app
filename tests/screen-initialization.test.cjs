const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// Real React rendering, with native UI and device services replaced at the boundary.
// Server rendering deliberately does not run effects: the first frame must be correct.
function renderScreen(file, story, params = {}) {
  const box = ({ children }) => React.createElement('div', null, children);
  const state = { currentStoryId: story?.id, getCurrentStory: () => story };
  const useStoryStore = (selector) => selector(state);
  useStoryStore.getState = () => state;
  const mocks = {
    'react-native': {
      View: box, Text: box, Pressable: box, ScrollView: box, KeyboardAvoidingView: box,
      Modal: ({ visible, children }) => visible ? box({ children }) : null,
      Image: ({ source }) => React.createElement('img', { src: source?.uri }),
      TextInput: ({ value, placeholder }) => React.createElement('input', { value, placeholder, readOnly: true }),
      StyleSheet: { create: (styles) => styles },
      Platform: { OS: 'web', select: (options) => options.web ?? options.default },
      Alert: {}, BackHandler: {},
    },
    'expo-router': { useLocalSearchParams: () => params, router: {}, Stack: { Screen: () => null } },
    'expo-audio': { useAudioPlayer: () => ({}), useAudioPlayerStatus: () => ({}) },
    'expo-document-picker': {},
    'expo-file-system/legacy': {},
    '../store/storyStore': { useStoryStore, storyPersistence: {} },
    '../hooks/use-persistence-status': { usePersistenceStatus: () => 'saved' },
    '../hooks/use-interruption-protection': { useInterruptionProtection: () => {} },
    '../utils/platformFiles': {},
  };
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    function localRequire(id) {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id.endsWith('.mp3')) return id;
      if (!id.startsWith('.')) return require(id);
      return load(path.resolve(path.dirname(filename), id + '.ts'));
    }
    Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
    return module.exports;
  }
  const Screen = load(path.resolve(file)).default;
  return renderToStaticMarkup(React.createElement(Screen));
}

const story = {
  id: 'story-one', title: 'Test story',
  storyValues: [{ id: 'courage', name: 'Courage', initialValue: 3 }],
  scenes: [
    { id: 'opening', title: 'Opening scene', text: 'Opening words', choices: [], assets: [] },
    { id: 'ending', title: 'Ending scene', text: 'Ending words', choices: [], assets: [] },
  ],
};

test('playback opens the first scene with initialized values and visit count on its first frame', () => {
  const html = renderScreen('app/play.tsx', story);
  assert.match(html, /Opening words/);
  assert.match(html, /Visited scenes: 1/);
  assert.match(html, /Courage: 3/);
  assert.doesNotMatch(html, /Ending words/);
});

test('preview starts at its requested scene and invalid scene IDs fall back to the opening', () => {
  const preview = renderScreen('app/play.tsx', story, { startSceneId: 'ending', preview: 'true' });
  assert.match(preview, /Ending words/);
  assert.doesNotMatch(preview, /Opening words/);
  const fallback = renderScreen('app/play.tsx', story, { startSceneId: 'deleted' });
  assert.match(fallback, /Opening words/);
});

test('scene editor opens with the saved title, text, and choices already populated', () => {
  const withChoice = { ...story, scenes: [{ ...story.scenes[0], choices: [{ id: 'choice-one', label: 'Continue', targetSceneId: 'opening' }] }] };
  const html = renderScreen('app/scene-editor.tsx', withChoice, { sceneId: 'opening' });
  assert.match(html, /value="Opening scene"/);
  assert.match(html, /value="Opening words"/);
  assert.match(html, /value="Continue"/);
});

test('new scene editor starts empty rather than inheriting another scene draft', () => {
  const html = renderScreen('app/scene-editor.tsx', story);
  assert.doesNotMatch(html, /value="Opening words"|value="Opening scene"/);
  assert.match(html, /placeholder="Untitled Scene"[^>]*value=""/);
});
