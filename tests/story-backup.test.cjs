const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { Buffer } = require('node:buffer');

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

function harness(platform, failWrite = 0) {
  const files = new Map();
  const deleted = [];
  let writes = 0;
  const load = loader({
    'react-native': { Platform: { OS: platform, select: (options) => options[platform] ?? options.default } },
    'expo-file-system/legacy': {
      documentDirectory: 'file:///new-device/',
      EncodingType: { Base64: 'base64' },
      makeDirectoryAsync: async () => {},
      readAsStringAsync: async (uri) => {
        if (!files.has(uri)) throw new Error('Missing file');
        return files.get(uri);
      },
      writeAsStringAsync: async (uri, bytes, options) => {
        assert.equal(options.encoding, 'base64');
        if (++writes === failWrite) throw new Error('Disk full');
        files.set(uri, bytes);
      },
      deleteAsync: async (directory) => {
        deleted.push(directory);
        for (const key of files.keys()) if (key.startsWith(directory)) files.delete(key);
      },
    },
  });
  return { ...load('utils/storyBackup.ts'), files, deleted };
}

const bytes = (text) => Buffer.from(text).toString('base64');
const appearance = { font: 'friendly', theme: 'forest', textSize: 'large' };
function fixture() {
  return {
    id: 'story', title: 'Portable story', mode: 'fictional', icon: '🌳',
    autoplayBackgroundMusic: true, autoplayVoiceNotes: true,
    backgroundMusic: { type: 'uploaded', uri: 'file:///old/music.mp3', name: 'Rain' },
    storyValues: [{ id: 'berries', name: 'Berries', initialValue: 1, minValue: 0, maxValue: 9, step: 1 }],
    playAppearance: appearance,
    scenes: [
      { id: 'one', title: 'Start', text: 'Hello', textFormatting: [{ start: 0, end: 5, bold: true }],
        choices: [{ id: 'go', label: 'Go', targetSceneId: 'two', rememberChoice: true, valueChanges: [{ valueId: 'berries', amount: 1 }] }],
        assets: [
          { id: 'photo', type: 'image', uri: 'file:///old/photo.heic', x: 12, y: 24, width: 200, height: 100 },
          { id: 'drawing', type: 'image', uri: 'data:image/png;base64,' + bytes('drawing'), x: 3, y: 4, width: 100, height: 80, alt: 'Drawing' },
          { id: 'voice', type: 'audio', uri: 'file:///old/voice.m4a', name: 'Voice note' },
        ],
        playSettingsOverride: { playAppearance: appearance, backgroundMusic: { type: 'built-in', builtInId: 'piano-remix', name: 'Tiny Piano' } },
      },
      { id: 'two', title: 'End', text: 'Done', choices: [], assets: [], playSettingsOverride: { playAppearance: appearance, backgroundMusic: null } },
    ],
  };
}

async function completeBackup() {
  const source = harness('android');
  for (const [uri, content] of [['file:///old/music.mp3', 'music'], ['file:///old/photo.heic', 'photo'], ['file:///old/voice.m4a', 'voice'], ['file:///bundled/piano.mp3', 'piano']]) source.files.set(uri, bytes(content));
  const story = fixture();
  const before = JSON.stringify(story);
  const json = await source.buildStoryBackup(story, async () => 'file:///bundled/piano.mp3');
  assert.equal(JSON.stringify(story), before, 'export must not replace live media paths');
  return JSON.parse(json);
}

test('complete JSON embeds images, drawings, voice, global and scene music', async () => {
  const backup = await completeBackup();
  assert.equal(backup.backupVersion, 1);
  assert.match(backup.scenes[0].assets[0].uri, /^data:image\/heic;base64,/);
  assert.equal(backup.scenes[0].assets[1].uri, 'data:image/png;base64,' + bytes('drawing'));
  assert.equal(backup.scenes[0].assets[2].uri, 'data:audio/mp4;base64,' + bytes('voice'));
  assert.equal(backup.backgroundMusic.uri, 'data:audio/mpeg;base64,' + bytes('music'));
  assert.equal(backup.scenes[0].playSettingsOverride.backgroundMusic.uri, 'data:audio/mpeg;base64,' + bytes('piano'));
  assert.equal(backup.scenes[1].playSettingsOverride.backgroundMusic, null);
});

for (const platform of ['web', 'android']) {
  test(`${platform}: restore on a fresh device preserves story structure and exact media bytes`, async () => {
    const backup = await completeBackup();
    const target = harness(platform);
    const { story, warnings } = await target.restoreStoryBackup(backup);
    assert.deepEqual(warnings, []);
    assert.equal(story.scenes[0].choices[0].targetSceneId, 'two');
    assert.deepEqual(story.scenes[0].choices[0].valueChanges, fixture().scenes[0].choices[0].valueChanges);
    assert.deepEqual(story.scenes[0].textFormatting, fixture().scenes[0].textFormatting);
    assert.equal(story.scenes[0].assets[0].x, 12);
    assert.equal(story.scenes[0].assets[0].width, 200);
    assert.equal(story.scenes[1].playSettingsOverride.backgroundMusic, null);
    assert.deepEqual(story.storyValues, backup.storyValues);
    assert.equal(story.autoplayVoiceNotes, true);
    assert.equal(story.scenes[0].playSettingsOverride.backgroundMusic.type, 'uploaded');
    const uris = [story.backgroundMusic.uri, ...story.scenes[0].assets.map((asset) => asset.uri), story.scenes[0].playSettingsOverride.backgroundMusic.uri];
    assert.deepEqual(uris.map((uri) => platform === 'web' ? uri.split(',')[1] : target.files.get(uri)), ['music', 'photo', 'drawing', 'voice', 'piano'].map(bytes));
    if (platform === 'android') assert.ok(uris.every((uri) => uri.startsWith('file:///new-device/story-media/')));
    else assert.equal(target.files.size, 0);
    const again = JSON.parse(await target.buildStoryBackup(story, async () => { throw new Error('Must use restored recording'); }));
    assert.deepEqual(again.scenes[0].assets.map((asset) => asset.uri), backup.scenes[0].assets.map((asset) => asset.uri));
    assert.equal(again.backgroundMusic.uri, backup.backgroundMusic.uri);
  });
}

test('missing attachment or built-in track prevents a misleading complete export', async () => {
  const target = harness('android');
  await assert.rejects(target.buildStoryBackup(fixture(), async () => ''), /No complete backup was created/);
  const story = fixture();
  delete story.backgroundMusic;
  story.scenes[0].assets = [];
  await assert.rejects(target.buildStoryBackup(story, async () => { throw new Error('Unavailable'); }), /background music in scene 1/);
});

test('older JSON remains importable and reports original-device media links', async () => {
  const target = harness('web');
  const { story, warnings } = await target.restoreStoryBackup(fixture());
  assert.equal(story.scenes[0].assets[0].uri, 'file:///old/photo.heic');
  assert.equal(story.scenes[0].playSettingsOverride.backgroundMusic.builtInId, 'piano-remix');
  assert.equal(warnings.length, 1);
  const plain = await target.restoreStoryBackup({ title: 'Old text-only story', scenes: [] });
  assert.deepEqual(plain.warnings, []);
});

test('failed native restore cleans up only its new files and leaves input unchanged', async () => {
  const target = harness('android', 2);
  target.files.set('file:///new-device/existing.mp3', bytes('keep'));
  const backup = await completeBackup();
  const original = JSON.stringify(backup);
  await assert.rejects(target.restoreStoryBackup(backup), /Disk full/);
  assert.equal(JSON.stringify(backup), original);
  assert.deepEqual([...target.files.keys()], ['file:///new-device/existing.mp3']);
  assert.equal(target.deleted.length, 1);
  assert.match(target.deleted[0], /^file:\/\/\/new-device\/story-media\/backup-/);
});

test('damaged and unsupported complete backups fail before replacing a story', async () => {
  const target = harness('web');
  const backup = await completeBackup();
  backup.backupVersion = 99;
  await assert.rejects(target.restoreStoryBackup(backup), /version is not supported/);
  backup.backupVersion = 1;
  backup.scenes[0].assets[0].uri = 'file:///missing.jpg';
  await assert.rejects(target.restoreStoryBackup(backup), /missing embedded media/);
  backup.scenes[0].assets[0].uri = 'data:image/png;base64,!!!';
  await assert.rejects(target.restoreStoryBackup(backup), /Invalid or unsupported/);
});
