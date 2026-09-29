const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loader(mocks = {}) {
  const cache = new Map();
  const load = (relativePath) => {
    const filename = path.resolve(relativePath);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    const localRequire = (id) => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id.startsWith('.')) return load(path.resolve(path.dirname(filename), id + '.ts'));
      return require(id);
    };
    Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
    return module.exports;
  };
  return load;
}

const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test('browser interruption saves the latest draft synchronously before refresh', () => {
  const load = loader();
  const { createTrackedStorage } = load('utils/trackedStorage.ts');
  const { protectBrowserEdits } = load('utils/interruptionProtection.ts');
  const browser = new EventTarget();
  const page = new EventTarget();
  page.visibilityState = 'visible';
  let draft = 'first';
  let disk;
  let saves = 0;
  const tracker = createTrackedStorage({
    getItem: () => disk, removeItem: () => {}, setItem: (key, value) => { disk = value; },
  }, true);
  const cleanup = protectBrowserEdits(browser, page, () => {
    saves++;
    tracker.storage.setItem('story', draft);
    return tracker.getStatus() === 'saved';
  });
  page.dispatchEvent(new Event('visibilitychange'));
  assert.equal(saves, 0);
  draft = 'the final keystroke';
  const unload = new Event('beforeunload', { cancelable: true });
  browser.dispatchEvent(unload);
  assert.equal(disk, 'the final keystroke');
  assert.equal(unload.defaultPrevented, false);
  page.visibilityState = 'hidden';
  page.dispatchEvent(new Event('visibilitychange'));
  browser.dispatchEvent(new Event('pagehide'));
  assert.equal(saves, 3);
  cleanup();
  browser.dispatchEvent(new Event('beforeunload'));
  browser.dispatchEvent(new Event('pagehide'));
  page.dispatchEvent(new Event('visibilitychange'));
  assert.equal(saves, 3, 'an unfocused editor must no longer save its old draft');
});

test('browser refresh requests a warning when saving fails, then allows leaving after retry', () => {
  const load = loader();
  const { createTrackedStorage } = load('utils/trackedStorage.ts');
  const { protectBrowserEdits } = load('utils/interruptionProtection.ts');
  let broken = true;
  let disk;
  const tracker = createTrackedStorage({
    getItem: () => disk, removeItem: () => {},
    setItem: (key, value) => { if (broken) throw new Error('Quota'); disk = value; },
  }, true);
  const browser = new EventTarget();
  const cleanup = protectBrowserEdits(browser, new EventTarget(), () => {
    tracker.storage.setItem('story', 'latest');
    return tracker.getStatus() === 'saved';
  });
  const failed = new Event('beforeunload', { cancelable: true });
  browser.dispatchEvent(failed);
  assert.equal(failed.defaultPrevented, true);
  assert.equal(tracker.getStatus(), 'error');
  broken = false;
  const retried = new Event('beforeunload', { cancelable: true });
  browser.dispatchEvent(retried);
  assert.equal(retried.defaultPrevented, false);
  assert.equal(disk, 'latest');
  cleanup();
});

test('native interruptions flush on inactive/background and detach on blur', () => {
  const { protectNativeEdits } = loader()('utils/interruptionProtection.ts');
  let listener;
  let saves = 0;
  let removed = false;
  const cleanup = protectNativeEdits((callback) => {
    listener = callback;
    return { remove: () => { removed = true; } };
  }, () => { saves++; return true; });
  listener('active');
  assert.equal(saves, 0);
  listener('inactive');
  listener('background');
  assert.equal(saves, 2);
  cleanup();
  assert.equal(removed, true);
});

test('native imported media survives deletion of the picker cache', async () => {
  const files = new Map([
    ['file:///cache/photo.HEIC', 'image bytes'],
    ['content://picker/42', 'audio bytes'],
  ]);
  const directories = [];
  const { getPersistentMediaUri } = loader({
    'react-native': { Platform: { OS: 'android' } },
    'expo-file-system/legacy': {
      documentDirectory: 'file:///documents/',
      makeDirectoryAsync: async (uri) => { directories.push(uri); },
      copyAsync: async ({ from, to }) => { files.set(to, files.get(from)); },
    },
  })('utils/platformFiles.ts');
  const image = await getPersistentMediaUri({ uri: 'file:///cache/photo.HEIC' }, 'image/jpeg');
  const audio = await getPersistentMediaUri({ uri: 'content://picker/42', name: 'Voice.m4a' }, 'audio/mpeg');
  files.delete('file:///cache/photo.HEIC');
  files.delete('content://picker/42');
  assert.match(image, /^file:\/\/\/documents\/story-media\/.*\.heic$/);
  assert.match(audio, /^file:\/\/\/documents\/story-media\/.*\.m4a$/);
  assert.equal(files.get(image), 'image bytes');
  assert.equal(files.get(audio), 'audio bytes');
  assert.ok(directories.every((uri) => uri === 'file:///documents/story-media/'));
  const copies = files.size;
  assert.equal(await getPersistentMediaUri({ uri: image }, 'image/heic'), image);
  assert.equal(files.size, copies);
});

test('native attachment is not returned until copying finishes and failures propagate', async () => {
  const copying = deferred();
  let finished = false;
  let broken = false;
  const { getPersistentMediaUri } = loader({
    'react-native': { Platform: { OS: 'android' } },
    'expo-file-system/legacy': {
      documentDirectory: 'file:///documents/',
      makeDirectoryAsync: async () => {},
      copyAsync: async () => { if (broken) throw new Error('No space'); await copying.promise; },
    },
  })('utils/platformFiles.ts');
  const importing = getPersistentMediaUri({ uri: 'content://picker/42', mimeType: 'audio/wav' }, 'audio/mpeg')
    .then((uri) => { finished = true; return uri; });
  await tick();
  assert.equal(finished, false);
  copying.resolve();
  assert.match(await importing, /\.wav$/);
  broken = true;
  await assert.rejects(getPersistentMediaUri({ uri: 'file:///cache/image.jpg' }, 'image/jpeg'), /No space/);
});

test('missing permanent native storage fails without falling back to temporary storage', async () => {
  const { getPersistentMediaUri } = loader({
    'react-native': { Platform: { OS: 'android' } },
    'expo-file-system/legacy': { documentDirectory: null },
  })('utils/platformFiles.ts');
  await assert.rejects(getPersistentMediaUri({ uri: 'file:///cache/image.jpg' }, 'image/jpeg'), /Permanent app storage/);
});

test('web media stays embedded and does not access the native filesystem', async () => {
  const { getPersistentMediaUri } = loader({
    'react-native': { Platform: { OS: 'web' } },
    'expo-file-system/legacy': {},
  })('utils/platformFiles.ts');
  assert.equal(await getPersistentMediaUri({ uri: 'blob:photo', base64: 'aW1hZ2U=' }, 'image/png'), 'data:image/png;base64,aW1hZ2U=');
  assert.equal(await getPersistentMediaUri({ uri: 'data:image/png;base64,aW1hZ2U=' }, 'image/png'), 'data:image/png;base64,aW1hZ2U=');
});

test('saved is published only after the device acknowledges the write', async () => {
  const write = deferred();
  const { createTrackedStorage } = loader()('utils/trackedStorage.ts');
  const tracker = createTrackedStorage({ getItem: () => null, removeItem: () => {}, setItem: () => write.promise });
  const statuses = [];
  tracker.subscribe(() => statuses.push(tracker.getStatus()));
  const saving = tracker.storage.setItem('stories', 'first');
  await tick();
  assert.equal(tracker.getStatus(), 'saving');
  assert.deepEqual(statuses, ['saving']);
  write.resolve();
  await saving;
  assert.equal(tracker.getStatus(), 'saved');
});

test('rapid snapshots are serialized and the newest one is retained', async () => {
  const first = deferred();
  const writes = [];
  const { createTrackedStorage } = loader()('utils/trackedStorage.ts');
  const tracker = createTrackedStorage({
    getItem: () => null, removeItem: () => {},
    setItem: async (name, value) => {
      writes.push(value);
      if (value === 'old') await first.promise;
    },
  });
  const saving = tracker.storage.setItem('stories', 'old');
  await tick();
  tracker.storage.setItem('stories', 'middle');
  tracker.storage.setItem('stories', 'newest');
  assert.deepEqual(writes, ['old']);
  first.resolve();
  await saving;
  assert.deepEqual(writes, ['old', 'newest']);
  assert.equal(tracker.getStatus(), 'saved');
});

for (const failure of ['throw', 'reject']) {
  test(`${failure} from storage is visible and retry saves the latest snapshot`, async () => {
    let broken = true;
    let disk;
    const { createTrackedStorage } = loader()('utils/trackedStorage.ts');
    const tracker = createTrackedStorage({
      getItem: () => null, removeItem: () => {},
      setItem: (name, value) => {
        if (broken) {
          if (failure === 'throw') throw new Error('Quota exceeded');
          return Promise.reject(new Error('Device write failed'));
        }
        disk = value;
      },
    });
    await tracker.storage.setItem('stories', 'first');
    assert.equal(tracker.getStatus(), 'error');
    await tracker.storage.setItem('stories', 'latest');
    assert.equal(tracker.getStatus(), 'error');
    broken = false;
    await tracker.retry();
    assert.equal(disk, 'latest');
    assert.equal(tracker.getStatus(), 'saved');
  });
}

test('a failed older write does not stop a queued newer write', async () => {
  const first = deferred();
  const writes = [];
  const { createTrackedStorage } = loader()('utils/trackedStorage.ts');
  const tracker = createTrackedStorage({
    getItem: () => null, removeItem: () => {},
    setItem: (name, value) => {
      writes.push(value);
      if (value === 'old') return first.promise;
    },
  });
  const saving = tracker.storage.setItem('stories', 'old');
  await tick();
  tracker.storage.setItem('stories', 'new');
  first.reject(new Error('Failed'));
  await saving;
  assert.deepEqual(writes, ['old', 'new']);
  assert.equal(tracker.getStatus(), 'saved');
});

for (const platform of ['android', 'web']) {
test(`${platform}: real store retains text and replacement links after a failed save and reload`, async () => {
  const disk = new Map();
  let broken = false;
  const backingStorage = {
      getItem: (key) => disk.get(key) ?? null,
      setItem: (key, value) => {
        if (broken) throw new Error('Disk full');
        disk.set(key, value);
      },
      removeItem: (key) => { disk.delete(key); },
  };
  const originalWindow = global.window;
  if (platform === 'web') global.window = { localStorage: backingStorage };
  const mocks = {
    'react-native': { Platform: { OS: platform, select: (options) => options[platform] ?? options.default } },
    '@react-native-async-storage/async-storage': backingStorage,
  };
  try {
  const { useStoryStore, storyPersistence } = loader(mocks)('store/storyStore.ts');
  await tick();
  const store = useStoryStore.getState();
  store.createStory('Save test', 'fictional');
  store.addScene({ id: 'start', title: 'Start', text: '', assets: [], choices: [{ id: 'go', label: 'Go' }] });
  const oldDestination = store.createSceneFromChoice('start', 'go', 0);
  await tick();
  broken = true;
  store.updateScene('start', { text: 'Latest words' });
  const newDestination = store.createSceneFromChoice('start', 'go', 0, true);
  await tick();
  assert.equal(storyPersistence.getStatus(), 'error');
  assert.equal(store.getCurrentStory().scenes[0].text, 'Latest words');
  broken = false;
  await storyPersistence.retry();
  const restored = loader(mocks)('store/storyStore.ts');
  await tick();
  const story = restored.useStoryStore.getState().getCurrentStory();
  const start = story.scenes.find((scene) => scene.id === 'start');
  assert.equal(start.text, 'Latest words');
  assert.equal(start.choices[0].targetSceneId, newDestination);
  assert.ok(story.scenes.some((scene) => scene.id === oldDestination));
  assert.notEqual(oldDestination, newDestination);
  } finally {
    if (originalWindow === undefined) delete global.window;
    else global.window = originalWindow;
  }
});
}
