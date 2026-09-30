const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { IDBFactory } = require('fake-indexeddb');

function loader(mocks = {}) {
  const cache = new Map();
  const load = (filename) => {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    Function('require', 'module', 'exports', code)((id) => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      return id.startsWith('.') ? load(path.resolve(path.dirname(filename), id + '.ts')) : require(id);
    }, module, module.exports);
    return module.exports;
  };
  return load;
}

const { createBrowserStorage } = loader()('utils/browserStorage.ts');
const { createTrackedStorage } = loader()('utils/trackedStorage.ts');
const key = 'storypaths-storage-v9';
function environment() {
  const indexedDB = new IDBFactory();
  const legacy = new Map();
  const localStorage = {
    getItem: (name) => legacy.get(name) ?? null,
    setItem(name, value) {
      if (value.length > 5 * 1024 * 1024) throw new Error('QuotaExceededError');
      legacy.set(name, value);
    },
    removeItem: (name) => legacy.delete(name),
  };
  return { indexedDB, legacy, localStorage, storage: createBrowserStorage(() => indexedDB, () => localStorage) };
}

test('browser saves more than 6 MB and restores identical bytes from a new storage instance', async () => {
  const env = environment();
  const snapshot = JSON.stringify({ media: 'A'.repeat(7 * 1024 * 1024) });
  assert.throws(() => env.localStorage.setItem(key, snapshot), /Quota/);
  await env.storage.setItem(key, snapshot);
  const reopened = createBrowserStorage(() => env.indexedDB, () => env.localStorage);
  assert.equal(await reopened.getItem(key), snapshot);
});

test('legacy stories remain until database commit, then database data wins on reload', async () => {
  const env = environment();
  env.legacy.set(key, 'old snapshot');
  env.legacy.set('personal-website-setting', 'keep');
  assert.equal(await env.storage.getItem(key), 'old snapshot');
  assert.equal(env.legacy.get(key), 'old snapshot');
  const save = env.storage.setItem(key, 'new snapshot');
  assert.equal(env.legacy.get(key), 'old snapshot', 'do not remove legacy before commit');
  await save;
  assert.equal(env.legacy.has(key), false);
  env.legacy.set(key, 'stale snapshot');
  assert.equal(await env.storage.getItem(key), 'new snapshot');
  assert.equal(env.legacy.get('personal-website-setting'), 'keep');
});

test('a transaction abort after request success retains legacy data and reports an unsaved snapshot', async () => {
  const env = environment();
  env.legacy.set(key, 'original');
  let abortWrites = true;
  const factory = {
    open(...args) {
      const request = env.indexedDB.open(...args);
      request.addEventListener('success', () => {
        const db = request.result;
        const transaction = db.transaction.bind(db);
        db.transaction = (...args) => {
          const tx = transaction(...args);
          if (args[1] === 'readwrite' && abortWrites) {
            const objectStore = tx.objectStore.bind(tx);
            tx.objectStore = (...args) => {
              const store = objectStore(...args);
              const put = store.put.bind(store);
              store.put = (...args) => {
                const write = put(...args);
                write.addEventListener('success', () => tx.abort());
                return write;
              };
              return store;
            };
          }
          return tx;
        };
      });
      return request;
    },
  };
  const tracker = createTrackedStorage(createBrowserStorage(() => factory, () => env.localStorage));
  await tracker.storage.setItem(key, 'latest');
  assert.equal(tracker.getStatus(), 'error');
  assert.equal(env.legacy.get(key), 'original');
  assert.equal(await env.storage.getItem(key), 'original');
  abortWrites = false;
  await tracker.retry();
  assert.equal(tracker.getStatus(), 'saved');
  assert.equal(await env.storage.getItem(key), 'latest');
});

test('database errors do not silently load stale localStorage data', async () => {
  const env = environment();
  env.legacy.set(key, 'old snapshot');
  const tracker = createTrackedStorage(createBrowserStorage(() => { throw new Error('Storage denied'); }, () => env.localStorage));
  await assert.rejects(tracker.storage.getItem(key), /Storage denied/);
  assert.equal(tracker.getReadError(), 'Storage denied');
  assert.equal(env.legacy.get(key), 'old snapshot');
});

test('clearing database storage cannot resurrect an old copy if legacy cleanup is denied', async () => {
  const env = environment();
  env.legacy.set(key, 'old snapshot');
  const storage = createBrowserStorage(() => env.indexedDB, () => ({ ...env.localStorage, removeItem() { throw new Error('denied'); } }));
  await storage.setItem(key, 'new snapshot');
  await storage.removeItem(key);
  assert.equal(await storage.getItem(key), null);
  assert.equal(env.legacy.get(key), 'old snapshot');
});

test('real web store imports media-heavy stories and preserves old stories after reloading', async (t) => {
  const env = environment();
  const previousWindow = global.window;
  global.window = { indexedDB: env.indexedDB, localStorage: env.localStorage };
  t.after(() => { if (previousWindow === undefined) delete global.window; else global.window = previousWindow; });
  const mocks = {
    'react-native': { Platform: { OS: 'web', select: (options) => options.web ?? options.default } },
    '@react-native-async-storage/async-storage': {},
  };
  const original = { id: 'old', title: 'Existing story', mode: 'fictional', scenes: [], storyValues: [] };
  env.legacy.set(key, JSON.stringify({ state: { stories: [original], currentStoryId: 'old', hasCompletedWelcome: true }, version: 4 }));
  const hydrate = async (module) => {
    if (!module.useStoryStore.persist.hasHydrated()) await new Promise((resolve) => {
      const unsubscribe = module.useStoryStore.persist.onFinishHydration(() => { unsubscribe(); resolve(); });
    });
    await module.storyPersistence.retry();
  };
  const first = loader(mocks)('store/storyStore.ts');
  await hydrate(first);
  const media = 'data:image/png;base64,' + 'AAAA'.repeat(1800000);
  first.useStoryStore.getState().importStory({
    id: 'large', title: 'Large imported story', mode: 'fictional', storyValues: [],
    scenes: [{ id: 'scene', title: 'Scene', text: 'Kept after refresh', choices: [], assets: [{ id: 'image', type: 'image', uri: media, x: 12, y: 23, width: 100, height: 80 }] }],
  });
  await first.storyPersistence.retry();
  assert.equal(first.storyPersistence.getStatus(), 'saved');
  const reopened = loader(mocks)('store/storyStore.ts');
  await hydrate(reopened);
  const stories = reopened.useStoryStore.getState().stories;
  assert.equal(stories.length, 2);
  assert.equal(stories.find((story) => story.id === 'old').title, 'Existing story');
  const restored = stories.find((story) => story.title === 'Large imported story');
  assert.equal(restored.scenes[0].assets[0].uri, media);
  assert.equal(restored.scenes[0].assets[0].x, 12);
  assert.equal(restored.scenes[0].text, 'Kept after refresh');
});
