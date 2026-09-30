const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

test('native drawing coordinates stay under the finger after layout changes without clearing artwork', () => {
  const { NATIVE_DRAWING_COORDINATES } = loadTypeScriptModule('utils/nativeDrawingCoordinates.ts');
  for (const density of [1, 2, 3]) {
    let rect = { left: 8, top: 12, width: 300, height: 150 };
    const artwork = { existingStrokes: ['drawing', 'eraser stroke'] };
    const canvas = {
      width: 300 * density, height: 150 * density,
      getBoundingClientRect: () => rect,
      getContext: () => ({ getTransform: () => ({ a: density, d: density }) }),
    };
    const signaturePad = {
      canvas, artwork,
      _createPoint(x, y) { return { x: x - rect.left, y: y - rect.top }; },
    };
    const context = vm.createContext({ signaturePad });
    vm.runInContext(NATIVE_DRAWING_COORDINATES, context);
    assert.deepEqual(signaturePad._createPoint(158, 87), { x: 150, y: 75 });
    rect = { left: 20, top: 30, width: 450, height: 300 };
    // A finger at the displayed centre must still map to the bitmap centre.
    assert.deepEqual(signaturePad._createPoint(245, 180), { x: 150, y: 75 });
    assert.deepEqual(signaturePad._createPoint(470, 330), { x: 300, y: 150 });
    vm.runInContext(NATIVE_DRAWING_COORDINATES, context);
    assert.deepEqual(signaturePad._createPoint(245, 180), { x: 150, y: 75 });
    assert.equal(signaturePad.artwork, artwork);
    assert.equal(canvas.height, 150 * density);
  }
});

test('both HTML exports omit the retired storytelling mode from the visible header', () => {
  for (const file of ['app/story.tsx', 'store/storyStore.ts']) {
    const header = read(file).match(/<div class="story-title">(.*?)<\/div>/)?.[1];
    assert.ok(header);
    assert.doesNotMatch(header, /\.mode|fictional|personal|symbolic/);
    assert.match(header, /\.title/);
  }
});

const read = (relativePath) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const loadTypeScriptModule = (relativePath, mocks = {}) => {
  const code = ts.transpileModule(read(relativePath), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  const localRequire = (id) => {
    if (Object.prototype.hasOwnProperty.call(mocks, id)) return mocks[id];
    if (id === 'expo-file-system') return { File: class { constructor() { throw new Error('Unexpected modern file read'); } } };
    return require(id);
  };
  Function('require', 'module', 'exports', code)(
    localRequire,
    module,
    module.exports,
  );
  return module.exports;
};

test('Drawing Pad tool changes do not reconfigure the canvas', () => {
  const source = read('app/draw.tsx');
  const canvas = source.match(/<DrawingCanvas\s[\s\S]*?\/>/)?.[0] || '';

  assert.match(canvas, /penColor="#111111"/);
  assert.match(canvas, /minWidth=\{3\}/);
  assert.match(canvas, /maxWidth=\{5\}/);
  assert.doesNotMatch(canvas, /penColor=\{selectedColor\}/);
  assert.doesNotMatch(canvas, /minWidth=\{selectedSize/);
  assert.doesNotMatch(canvas, /maxWidth=\{selectedSize/);

  const controls = source.slice(
    source.indexOf('const selectColor'),
    source.indexOf('const restoreHistory'),
  );
  assert.match(controls, /changePenColor/);
  assert.match(controls, /changePenSize/);
  assert.doesNotMatch(controls, /clearSignature|setDataURL/);

  const webCanvas = read('components/drawing-canvas.web.tsx');
  assert.match(webCanvas, /<canvas/);
  assert.match(webCanvas, /onPointerDown=\{startStroke\}/);
  assert.match(webCanvas, /canvas\.toDataURL\("image\/png"\)/);
  assert.match(source, /Platform\.OS !== "web"/);
  assert.match(source, /drawingUri = signature/);
});

test('Creating a scene from a choice links it in the same store update', () => {
  const store = read('store/storyStore.ts');
  const editor = read('app/scene-editor.tsx');
  const action = store.slice(
    store.indexOf('      createSceneFromChoice: ('),
    store.indexOf('      duplicateScene: (id)', store.indexOf('      createSceneFromChoice: (')),
  );

  assert.match(action, /targetSceneId: newSceneId/);
  assert.match(action, /nextScenes\[parentSceneIndex\] = updatedParent/);
  assert.match(action, /nextScenes\.splice\(parentSceneIndex \+ 1, 0, newScene\)/);
  assert.match(editor, /const newSceneId = createSceneFromChoice\(/);
  assert.match(editor, /sceneId: newSceneId/);
  assert.match(editor, /choicesRef\.current = linkedChoices/);
  assert.match(editor, /targetSceneId: newSceneId/);
});

test('Immediate choice updates invalidate older full-scene autosaves', () => {
  const editor = read('app/scene-editor.tsx');
  const persistChoices = editor.slice(
    editor.indexOf('const persistChoices ='),
    editor.indexOf('const updateChoiceAt ='),
  );
  const destinationSelection = editor.slice(
    editor.indexOf('Where does this choice lead?'),
    editor.indexOf('{existingScene && ('),
  );

  assert.match(persistChoices, /autoSaveGeneration\.current \+= 1/);
  assert.match(persistChoices, /clearTimeout\(autoSaveTimer\.current\)/);
  assert.match(destinationSelection, /connectChoiceToScene\(/);
  assert.match(editor, /const connectChoiceToScene[\s\S]*?updateChoiceAt\(choiceIndex/);
});

test('scene linking is explicit and every back route saves the latest editor state', () => {
  const editor = read('app/scene-editor.tsx');
  const play = read('app/play.tsx');

  assert.match(editor, /Scene \$\{sceneNumber\} · \$\{cleanTitle \|\| "Untitled"\}/);
  assert.match(editor, /Missing scene — choose a new destination/);
  assert.match(editor, /Connected to \{connectionConfirmation\.destination\}/);
  assert.match(editor, /Link back to this scene\?/);
  assert.match(editor, /headerBackVisible: false/);
  assert.match(editor, /gestureEnabled: false/);
  assert.match(editor, /safeBackNavigation\.current = goBackSafely/);
  assert.match(editor, /safeBackNavigation\.current\(\)/);

  assert.match(play, /destination missing/);
  assert.match(play, /disabled=\{!targetScene\}/);
  assert.match(play, /setCurrentSceneId\(targetScene\.id\)/);
});

test('HTML exports disable choices with missing destinations', () => {
  for (const file of ['app/story.tsx', 'store/storyStore.ts']) {
    const source = read(file);
    const choices = source.slice(
      source.indexOf('if (visibleChoices.length > 0)'),
      source.indexOf('} else {', source.indexOf('if (visibleChoices.length > 0)')),
    );

    assert.match(choices, /getSceneById\(choice\.targetSceneId\)/);
    assert.match(choices, /destination missing/);
    assert.match(choices, /btn\.disabled = !targetScene/);
  }
});

test('Creating a new destination can replace a choice link without deleting the old scene', () => {
  const store = read('store/storyStore.ts');
  const editor = read('app/scene-editor.tsx');
  const action = store.slice(
    store.indexOf('      createSceneFromChoice: ('),
    store.indexOf('      duplicateScene: (id)', store.indexOf('      createSceneFromChoice: (')),
  );
  const createOption = editor.slice(
    editor.indexOf('{existingScene && ('),
    editor.indexOf('{isAddingChoice ?'),
  );

  assert.match(action, /replaceExistingTarget = false/);
  assert.match(action, /validExistingTarget && !replaceExistingTarget/);
  assert.match(action, /nextScenes = \[\.\.\.story\.scenes\]/);
  assert.doesNotMatch(action, /\.filter\(/);
  assert.match(createOption, /Create a new scene and change this choice\\u2019s destination\?/);
  assert.match(createOption, /createSceneFromChoice\([\s\S]*?true,/);
  assert.match(createOption, /\+ Create new scene/);
  assert.match(createOption, /confirmAction\(/);
});

test('web scene actions use browser confirmation and omit the duplicate native header', () => {
  const editor = read('app/scene-editor.tsx');
  const dialogs = read('utils/platformDialogs.ts');

  assert.match(dialogs, /Platform\.OS === "web"/);
  assert.match(dialogs, /window\.confirm/);
  assert.match(editor, /headerShown: Platform\.OS !== "web"/);
  assert.match(editor, /confirmAction\([\s\S]*?Create new scene/);
});

test('Export catches build errors and supports native and web delivery', () => {
  const source = read('app/story.tsx');
  const platformFiles = read('utils/platformFiles.ts');
  const shareHtml = source.slice(
    source.indexOf('const shareHtml = async'),
    source.indexOf('const openShareOptions'),
  );

  assert.ok(shareHtml.indexOf('try {') < shareHtml.indexOf('await buildPortableHtml()'));
  assert.match(shareHtml, /HTML export failed/);
  assert.match(source, /downloadTextFileOnWeb\(content, fileName, mimeType\)/);
  assert.match(platformFiles, /new Blob\(\[content\]/);
  assert.match(platformFiles, /link\.download = fileName/);
  assert.match(source, /Platform\.OS === "web"[\s\S]*?setIsExportPickerOpen\(true\)/);
  assert.match(source, /visible=\{isExportPickerOpen\}/);
  assert.match(source, />Playable HTML</);
  assert.match(source, />Backup JSON</);
  assert.match(source, /Sharing\.shareAsync/);
  assert.match(source, /JSON\.parse\(json\)/);
});

test('JSON imports use browser File text while native imports keep FileSystem', async () => {
  const webFileSystemCalls = [];
  const webFiles = loadTypeScriptModule('utils/platformFiles.ts', {
    'react-native': { Platform: { OS: 'web' } },
    'expo-file-system/legacy': {
      readAsStringAsync: async (uri) => {
        webFileSystemCalls.push(uri);
        return 'wrong path';
      },
    },
  });

  const webText = await webFiles.readPickedTextFile({
    uri: 'blob:web-story',
    file: {
      text: async () => '\uFEFF{"title":"Browser story"}',
    },
  });

  assert.equal(webText, '{"title":"Browser story"}');
  assert.deepEqual(webFileSystemCalls, []);

  const nativeFileSystemCalls = [];
  const nativeFiles = loadTypeScriptModule('utils/platformFiles.ts', {
    'react-native': { Platform: { OS: 'android' } },
    'expo-file-system/legacy': {
      readAsStringAsync: async (uri) => {
        nativeFileSystemCalls.push(uri);
        return '{"title":"Native story"}';
      },
    },
  });

  assert.equal(
    await nativeFiles.readPickedTextFile({ uri: 'file:///story.json' }),
    '{"title":"Native story"}',
  );
  assert.deepEqual(nativeFileSystemCalls, ['file:///story.json']);

  for (const screen of ['app/(tabs)/index.tsx', 'app/new-story.tsx']) {
    const source = read(screen);
    assert.match(source, /readPickedTextFile\(file\)/);
    assert.match(source, /base64: false/);
    assert.doesNotMatch(source, /FileSystem\.readAsStringAsync\(file\.uri\)/);
  }

  assert.match(
    read('app/(tabs)/index.tsx'),
    /onPress=\{handleImportJson\}[\s\S]*?>Import story</,
  );
});

test('both Android import screens read the granted document instead of Expo Go shared cache', async () => {
  const contentUri = 'content://com.android.providers.downloads.documents/document/raw%3A%2Fstorage%2Femulated%2F0%2FDownload%2FTelegram%2Fthe_stars_will_tell%20(1).json';
  const text = '\uFEFF' + JSON.stringify({ title: 'From Telegram Downloads', scenes: [], media: 'x'.repeat(7 * 1024 * 1024) });
  const files = loadTypeScriptModule('utils/platformFiles.ts', {
    'react-native': { Platform: { OS: 'android' } },
    'expo-file-system/legacy': {
      readAsStringAsync: async () => {
        throw new Error('Unsupported scheme: legacy reader cannot open Downloads content URIs');
      },
    },
    'expo-file-system': {
      File: class {
        constructor(uri) { assert.equal(uri, contentUri, 'preserve the granted URI exactly'); }
        async text() { return text; }
      },
    },
  });
  for (const screen of ['app/(tabs)/index.tsx', 'app/new-story.tsx']) {
    const ast = ts.createSourceFile(screen, read(screen), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let handler;
    const visit = (node) => {
      if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'handleImportJson') handler = node.initializer.getText(ast);
      ts.forEachChild(node, visit);
    };
    visit(ast);
    assert.ok(handler);
    for (const os of ['android', 'ios', 'web']) {
      let imported;
      const progress = { current: false };
      const dependencies = {
        importInProgress: progress,
        Platform: { OS: os },
        DocumentPicker: { getDocumentAsync: async (options) => {
          assert.equal(options.copyToCacheDirectory, os !== 'android');
          assert.equal(options.base64, false);
          return { canceled: false, assets: [{ uri: contentUri }] };
        } },
        readPickedTextFile: files.readPickedTextFile,
        useStoryStore: { getState: () => ({ stories: [] }) },
        chooseImportConflict: () => assert.fail('no conflict expected'),
        validateStoryImport: () => ({ valid: true }),
        restoreStoryBackup: async (story) => ({ story, warnings: [] }),
        importStory: (story) => { imported = story; },
        storyPersistence: { retry: async () => {}, getStatus: () => 'saved' },
        showMessage: (...args) => assert.fail(args.join(': ')),
        router: { push: () => {} },
      };
      await Function(...Object.keys(dependencies), `return (${handler});`)(...Object.values(dependencies))();
      assert.equal(imported.title, 'From Telegram Downloads');
      assert.equal(imported.media.length, 7 * 1024 * 1024);
      assert.equal(progress.current, false);
    }
  }
});

test('Android document reader is available in the startup bundle without a development-server fetch', () => {
  const source = read('utils/platformFiles.ts');
  const ast = ts.createSourceFile('platformFiles.ts', source, ts.ScriptTarget.Latest, true);
  const fileImport = ast.statements.find((node) => ts.isImportDeclaration(node) && node.moduleSpecifier.text === 'expo-file-system');
  assert.ok(fileImport, 'the file reader must be eagerly bundled, even when Metro disconnects');
  assert.equal(fileImport.importClause.isTypeOnly, false);
  assert.ok(fileImport.importClause.namedBindings.elements.some((item) => item.name.text === 'File' && !item.isTypeOnly));
  const visit = (node) => {
    if (ts.isCallExpression(node)) assert.notEqual(node.expression.kind, ts.SyntaxKind.ImportKeyword, 'file utilities must not trigger a split-bundle load');
    ts.forEachChild(node, visit);
  };
  visit(ast);
});

test('both import screens await the conflict decision before restoring media; cancel leaves storage untouched', async () => {
  for (const screen of ['app/(tabs)/index.tsx', 'app/new-story.tsx']) {
    const ast = ts.createSourceFile(screen, read(screen), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let handler;
    const visit = (node) => {
      if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'handleImportJson') handler = node.initializer.getText(ast);
      ts.forEachChild(node, visit);
    };
    visit(ast);
    for (const decision of ['cancel', 'copy', 'replace']) {
      const events = [];
      let answer;
      const prompt = new Promise((resolve) => { answer = resolve; });
      const progress = { current: false };
      const dependencies = {
        importInProgress: progress, Platform: { OS: 'android' },
        DocumentPicker: { getDocumentAsync: async () => ({ canceled: false, assets: [{ uri: 'content://backup' }] }) },
        readPickedTextFile: async () => JSON.stringify({ id: 'matching', title: 'Backup title', scenes: [] }),
        validateStoryImport: () => ({ valid: true }),
        useStoryStore: { getState: () => ({ stories: [{ id: 'matching', title: 'Renamed locally' }] }) },
        chooseImportConflict: (title) => { assert.equal(title, 'Renamed locally'); events.push('prompt'); return prompt; },
        restoreStoryBackup: async (story) => { events.push('restore'); return { story, warnings: [] }; },
        importStory: (story, mode) => { assert.equal(mode, decision); events.push('import'); },
        storyPersistence: { retry: async () => { events.push('save'); }, getStatus: () => 'saved' },
        showMessage: (...args) => assert.fail(args.join(': ')), router: { push: () => events.push('navigate') },
      };
      const running = Function(...Object.keys(dependencies), `return (${handler});`)(...Object.values(dependencies))();
      await new Promise((resolve) => setImmediate(resolve));
      assert.deepEqual(events, ['prompt']);
      answer(decision);
      await running;
      assert.deepEqual(events, decision === 'cancel' ? ['prompt'] : ['prompt', 'restore', 'import', 'save', 'navigate']);
      assert.equal(progress.current, false);
    }
  }
});

test('Android document reader propagates provider failures without guessing a filesystem path', async () => {
  const failure = new Error('Document permission expired');
  const files = loadTypeScriptModule('utils/platformFiles.ts', {
    'react-native': { Platform: { OS: 'android' } },
    'expo-file-system/legacy': {
      readAsStringAsync: () => assert.fail('must not fall back to legacy or a decoded raw path'),
    },
    'expo-file-system': {
      File: class { async text() { throw failure; } },
    },
  });
  await assert.rejects(files.readPickedTextFile({
    uri: 'content://com.android.providers.downloads.documents/document/raw%3A%2FDownload%2Fstory.json',
  }), (error) => error === failure);
});

test('web text exports create and clean up a browser download link', () => {
  const originalDocument = global.document;
  const originalUrl = global.URL;
  const originalBlob = global.Blob;
  const originalSetTimeout = global.setTimeout;
  const events = [];
  let finishDownloadLifetime;
  const link = {
    href: '',
    download: '',
    style: {},
    click: () => events.push('click'),
    remove: () => events.push('remove'),
  };

  try {
    global.document = {
      createElement: (tagName) => {
        assert.equal(tagName, 'a');
        return link;
      },
      body: {
        appendChild: (element) => {
          assert.equal(element, link);
          events.push('append');
        },
      },
    };
    global.URL = {
      createObjectURL: (blob) => {
        assert.equal(blob.type, 'application/json;charset=utf-8');
        events.push('create-url');
        return 'blob:story-download';
      },
      revokeObjectURL: (url) => {
        assert.equal(url, 'blob:story-download');
        events.push('revoke-url');
      },
    };
    global.Blob = class TestBlob {
      constructor(parts, options) {
        this.parts = parts;
        this.type = options.type;
      }
    };
    global.setTimeout = (callback, delay) => {
      assert.ok(delay >= 60_000, 'large downloads must retain their URL beyond the first second');
      finishDownloadLifetime = callback;
      return 1;
    };

    const webFiles = loadTypeScriptModule('utils/platformFiles.ts', {
      'react-native': { Platform: { OS: 'web' } },
      'expo-file-system/legacy': {},
    });

    assert.equal(
      webFiles.downloadTextFileOnWeb(
        '{"title":"Download"}',
        'download.json',
        'application/json',
      ),
      true,
    );
    assert.equal(link.href, 'blob:story-download');
    assert.equal(link.download, 'download.json');
    assert.equal(link.style.display, 'none');
    assert.deepEqual(events, ['create-url', 'append', 'click', 'remove']);
    finishDownloadLifetime();
    assert.deepEqual(events, [
      'create-url',
      'append',
      'click',
      'remove',
      'revoke-url',
    ]);
  } finally {
    if (originalDocument === undefined) delete global.document;
    else global.document = originalDocument;
    global.URL = originalUrl;
    global.Blob = originalBlob;
    global.setTimeout = originalSetTimeout;
  }
});

test('web media exports use browser data URLs and Story Tree downloads', () => {
  const source = read('app/story.tsx');
  const platformFiles = read('utils/platformFiles.ts');

  assert.match(platformFiles, /export const readUriAsDataUrl/);
  assert.match(platformFiles, /response\.blob\(\)/);
  assert.match(platformFiles, /export const getPersistentMediaUri/);
  assert.match(platformFiles, /export const downloadDataUrlOnWeb/);
  assert.match(source, /readUriAsDataUrl\(asset\.uri, mimeType\)/);
  assert.match(source, /await import\("html2canvas"\)/);
  assert.match(source, /canvas\.toDataURL\("image\/png", 1\)/);
  assert.match(source, /result: "tmpfile"/);
  assert.match(source, /downloadDataUrlOnWeb\(uri, fileName\)/);
});

test('HTML export skips inaccessible media instead of aborting the story', () => {
  const source = read('app/story.tsx');
  const builder = source.slice(
    source.indexOf('const embedBackgroundMusic'),
    source.indexOf('const parseNumberOrDefault'),
  );

  assert.match(builder, /portableExportWarnings\.current\.push/);
  assert.match(builder, /return null/);
  assert.match(builder, /availableAssets/);
  assert.doesNotMatch(builder, /throw new Error\(\s*"The background music could not be included/);
});

test('HTML exporters preserve every image in one responsive scene composition', () => {
  for (const file of ['app/story.tsx', 'store/storyStore.ts']) {
    const source = read(file);
    const imageStyles = source.slice(
      source.indexOf('.scene-images'),
      source.indexOf('.scene-text', source.indexOf('.scene-images')),
    );
    const imageRendering = source.slice(
      source.indexOf("const imageAssets = (scene.assets || []).filter"),
      source.indexOf("const audioAsset", source.indexOf("const imageAssets = (scene.assets || []).filter")) > -1
        ? source.indexOf("const audioAsset", source.indexOf("const imageAssets = (scene.assets || []).filter"))
        : source.indexOf("choicesEl.innerHTML", source.indexOf("const imageAssets = (scene.assets || []).filter")),
    );

    assert.match(imageStyles, /position: relative/);
    assert.match(imageStyles, /aspect-ratio: 400 \/ 260/);
    assert.match(imageStyles, /overflow: hidden/);
    assert.match(imageRendering, /asset\.type === 'image' && asset\.uri/);
    assert.match(imageRendering, /imageAssets\.forEach/);
    assert.match(imageRendering, /image\.style\.left/);
    assert.match(imageRendering, /image\.style\.top/);
    assert.match(imageRendering, /image\.style\.width/);
    assert.match(imageRendering, /image\.style\.height/);
    assert.match(imageRendering, /asset\.alt === 'Drawing' \? 'contain' : 'cover'/);
    assert.match(imageRendering, /imagesEl\.appendChild\(image\)/);
    assert.doesNotMatch(imageRendering, /firstImage/);
  }
});

test('portable HTML retries requested music autoplay after a user gesture', () => {
  const source = read('app/story.tsx');
  const exporter = source.slice(
    source.indexOf('const backgroundAudioEl'),
    source.indexOf('const parseNumberOrDefault'),
  );

  assert.match(exporter, /Boolean\(story\.autoplayBackgroundMusic\)/);
  assert.match(exporter, /function tryStartBackgroundMusic/);
  assert.match(exporter, /▶ Start music/);
  assert.match(exporter, /document\.addEventListener\('pointerdown', startMusicAfterFirstInteraction/);
  assert.match(exporter, /story\.autoplayVoiceNotes/);
});

test('music picker keeps Done outside its scrollable content', () => {
  const source = read('app/story.tsx');
  const modal = source.slice(
    source.indexOf('visible={isMusicPickerOpen}'),
    source.indexOf('visible={!!sceneMenuTarget}'),
  );

  assert.match(modal, /<ScrollView/);
  assert.match(modal, /musicPickerScrollContent/);
  assert.match(modal, /musicPickerDoneButton/);
  assert.ok(
    modal.lastIndexOf('</ScrollView>') < modal.lastIndexOf('musicPickerDoneButton'),
    'Done must remain outside the scrollable picker body',
  );
});

test('HTML exporters preserve escaped feedback newlines in generated JavaScript', () => {
  for (const file of ['app/story.tsx', 'store/storyStore.ts']) {
    const source = read(file);
    assert.ok(
      source.includes("messages.filter(Boolean).join('\\\\n')"),
      `${file} must emit a JavaScript newline escape instead of a literal line break`,
    );
  }
});

test('choice memory feedback remains visible long enough to read', () => {
  for (const file of ['app/play.tsx', 'app/story.tsx', 'store/storyStore.ts']) {
    const source = read(file);
    const feedback = source.slice(
      source.indexOf('showChoiceFeedback'),
      source.indexOf('createInitialStoryValues', source.indexOf('showChoiceFeedback')),
    );

    assert.match(feedback, /5500/);
    assert.doesNotMatch(feedback, /2800/);
  }
});

test('JSON normalization preserves current fields and migrates legacy value effects', () => {
  const playAppearance = loadTypeScriptModule('utils/playAppearance.ts', {
    'react-native': {
      Platform: {
        select: (options) => options.default ?? options.android ?? options.ios,
      },
    },
  });
  const richText = loadTypeScriptModule('utils/richText.ts');
  const { normalizeStoryProject } = loadTypeScriptModule('utils/storyData.ts', {
    './playAppearance': playAppearance,
    './richText': richText,
  });
  const legacyStory = {
    id: 'story-old',
    title: 'Older story',
    mode: 'personal',
    icon: 'B',
    showSceneTitlesInPlay: false,
    autoplayBackgroundMusic: true,
    autoplayVoiceNotes: true,
    playAppearance: { font: 'friendly', textSize: 'large', theme: 'forest' },
    backgroundMusic: { type: 'uploaded', uri: 'file:///music.m4a', name: 'Rain' },
    storyValues: [
      { id: 'berries', name: 'Berries', initialValue: 2, minValue: 0, maxValue: 9, step: 1 },
    ],
    scenes: [
      {
        id: 'start',
        title: 'Start',
        text: 'Hello <strong>there</strong>',
        choices: [
          {
            id: 'go',
            label: 'Go',
            targetSceneId: 'end',
            traceLabel: 'went',
            rememberChoice: true,
            memoryName: 'went',
            valueChange: { valueId: 'berries', amount: 2 },
          },
        ],
        assets: [
          { id: 'drawing', type: 'image', uri: 'file:///drawing.png', x: 1, y: 2, width: 200, height: 160, alt: 'Drawing' },
          { id: 'voice', type: 'audio', uri: 'file:///voice.m4a', name: 'Voice note' },
        ],
        playSettingsOverride: {
          playAppearance: { font: 'typewriter', textSize: 'small', theme: 'night' },
          backgroundMusic: { type: 'built-in', builtInId: 'piano-remix', name: 'Tiny Piano' },
        },
      },
      { id: 'end', title: 'End', text: 'Done', choices: [], assets: [] },
    ],
  };

  const first = normalizeStoryProject(legacyStory);
  const roundTrip = normalizeStoryProject(JSON.parse(JSON.stringify(first)));

  assert.equal(roundTrip.id, 'story-old');
  assert.equal(roundTrip.scenes[0].choices[0].targetSceneId, 'end');
  assert.deepEqual(roundTrip.scenes[0].choices[0].valueChanges, [
    { valueId: 'berries', amount: 2 },
  ]);
  assert.equal(roundTrip.scenes[0].assets.length, 2);
  assert.equal(roundTrip.backgroundMusic.uri, 'file:///music.m4a');
  assert.equal(roundTrip.autoplayVoiceNotes, true);
  assert.equal(roundTrip.playAppearance.theme, 'forest');
  assert.equal(roundTrip.scenes[0].text, 'Hello there');
  assert.deepEqual(roundTrip.scenes[0].textFormatting, [
    { start: 6, end: 11, bold: true },
  ]);
  assert.equal(roundTrip.scenes[0].playSettingsOverride.playAppearance.theme, 'night');
  assert.equal(roundTrip.scenes[0].playSettingsOverride.backgroundMusic.builtInId, 'piano-remix');
});

test('Scene appearance uses global settings until an override is enabled', () => {
  const playAppearance = loadTypeScriptModule('utils/playAppearance.ts', {
    'react-native': {
      Platform: {
        select: (options) => options.default ?? options.android ?? options.ios,
      },
    },
  });
  const story = {
    playAppearance: { font: 'friendly', textSize: 'large', theme: 'forest' },
    backgroundMusic: { type: 'uploaded', uri: 'file:///global.mp3', name: 'Global' },
  };
  const globalScene = {};
  const customScene = {
    playSettingsOverride: {
      playAppearance: { font: 'typewriter', textSize: 'small', theme: 'night' },
      backgroundMusic: null,
    },
  };

  assert.equal(playAppearance.getScenePlayAppearance(story, globalScene).theme, 'forest');
  assert.equal(playAppearance.getSceneBackgroundMusic(story, globalScene).name, 'Global');
  assert.equal(playAppearance.getScenePlayAppearance(story, customScene).theme, 'night');
  assert.equal(playAppearance.getSceneBackgroundMusic(story, customScene), undefined);
});

test('Scene Editor saves appearance overrides and exposes reset controls', () => {
  const editor = read('app/scene-editor.tsx');
  const player = read('app/play.tsx');
  const exporter = read('app/story.tsx');

  assert.match(editor, /Scene Appearance/);
  assert.match(editor, /Override global settings for this scene/);
  assert.match(editor, /Reset to global settings/);
  assert.match(editor, /playSettingsOverride: scenePlaySettingsOverride/);
  assert.match(player, /getScenePlayAppearance\(currentStory, settingsScene\)/);
  assert.match(player, /getSceneBackgroundMusic\(currentStory, settingsScene\)/);
  assert.match(exporter, /applyScenePlaySettings\(scene\)/);
  assert.match(exporter, /embeddedSceneBackgroundMusic/);
});

test('Rich scene text supports nested bold, italic, and underline formatting', () => {
  const {
    getRichTextDocument,
    parseRichText,
    toggleRichTextFormatting,
  } = loadTypeScriptModule('utils/richText.ts');
  const spans = parseRichText(
    'Plain <strong>bold <em>and italic</em></strong> <u>underlined</u>',
  );

  assert.deepEqual(spans, [
    { text: 'Plain ', bold: false, italic: false, underline: false },
    { text: 'bold ', bold: true, italic: false, underline: false },
    { text: 'and italic', bold: true, italic: true, underline: false },
    { text: ' ', bold: false, italic: false, underline: false },
    { text: 'underlined', bold: false, italic: false, underline: true },
  ]);

  const migrated = getRichTextDocument(
    'Plain <strong>bold</strong> and <u>underlined</u>',
  );
  assert.equal(migrated.text, 'Plain bold and underlined');
  assert.doesNotMatch(migrated.text, /<[^>]+>/);

  const italicized = toggleRichTextFormatting(
    migrated.text,
    migrated.formatting,
    6,
    10,
    'italic',
  );
  assert.deepEqual(parseRichText(migrated.text, italicized)[1], {
    text: 'bold',
    bold: true,
    italic: true,
    underline: false,
  });
});

test('Scene text formatting is editable, playable, and safely exported', () => {
  const editor = read('app/scene-editor.tsx');
  const player = read('app/play.tsx');
  const appExporter = read('app/story.tsx');
  const storeExporter = read('store/storyStore.ts');

  assert.match(editor, /Select text, then format/);
  assert.match(editor, /toggleRichTextFormatting/);
  assert.match(editor, /sceneTextFormatting/);
  assert.match(editor, /Formatting preview/);
  assert.doesNotMatch(editor, /formatSelectedSceneText\("<strong>"/);
  assert.match(player, /currentScene\.textFormatting/);
  assert.match(appExporter, /renderRichText\(textEl, scene\.text, scene\.textFormatting\)/);
  assert.match(storeExporter, /renderRichText\(textEl, scene\.text, scene\.textFormatting\)/);
  assert.doesNotMatch(
    appExporter.slice(
      appExporter.indexOf('function renderRichText'),
      appExporter.indexOf('function renderScene', appExporter.indexOf('function renderRichText')),
    ),
    /innerHTML/,
  );
});

test('Every tutorial and template clone has unique IDs and valid internal links', () => {
  const content = loadTypeScriptModule('data/storyContent.ts');
  const blueprints = [...content.TUTORIALS, ...content.STORY_TEMPLATES];
  const firstCopies = blueprints.map(content.cloneStoryBlueprint);
  const secondCopies = blueprints.map(content.cloneStoryBlueprint);

  firstCopies.forEach((story, templateIndex) => {
    const sceneIds = new Set(story.scenes.map((scene) => scene.id));
    const choiceIds = story.scenes.flatMap((scene) => scene.choices.map((choice) => choice.id));
    assert.equal(sceneIds.size, story.scenes.length);
    assert.equal(new Set(choiceIds).size, choiceIds.length);
    story.scenes.forEach((scene) => {
      scene.choices.forEach((choice) => {
        if (choice.targetSceneId) assert.ok(sceneIds.has(choice.targetSceneId));
      });
    });
    assert.notEqual(story.id, secondCopies[templateIndex].id);
    assert.notEqual(story.scenes[0].id, secondCopies[templateIndex].scenes[0].id);
  });
});

test('connection tutorial teaches the current destination workflow without broken links', () => {
  const content = loadTypeScriptModule('data/storyContent.ts');
  const tutorial = content.TUTORIALS.find(
    (item) => item.id === 'connecting-scenes',
  );

  assert.ok(tutorial);
  assert.match(tutorial.summary, /Scene links/);
  assert.match(tutorial.scenes[0].editorHint, /Change destination/);
  assert.match(tutorial.scenes[0].editorHint, /Connected to/);
  assert.match(tutorial.scenes[0].editorHint, /Story Tree/);
  assert.ok(tutorial.scenes[0].choices[0].target);
});

test('berry tutorial explains its intentional self-loop and exit', () => {
  const content = loadTypeScriptModule('data/storyContent.ts');
  const tutorial = content.TUTORIALS.find(
    (item) => item.id === 'berries-locked-gate',
  );
  const berryScene = tutorial.scenes.find(
    (scene) => scene.key === 'after-berry',
  );

  assert.equal(berryScene.choices[0].target, berryScene.key);
  assert.match(berryScene.editorHint, /intentional self-loop/);
  assert.match(berryScene.editorHint, /clear exit/);
});

test('Applying a template preserves the user story title and icon', () => {
  const content = loadTypeScriptModule('data/storyContent.ts');
  const template = content.STORY_TEMPLATES[0];
  const story = content.cloneStoryBlueprint(template, {
    title: 'My own story',
    icon: '🌙',
  });

  assert.equal(story.title, 'My own story');
  assert.equal(story.icon, '🌙');
  assert.equal(story.mode, template.mode);
  assert.equal(story.scenes.length, template.scenes.length);
  assert.notEqual(story.scenes[0].id, template.scenes[0].key);
});

test('Scene audio cleanup cannot pause story background music', () => {
  const source = read('app/play.tsx');
  assert.match(source, /return \(\) => pausePlayerSafely\(player\)/);
  assert.match(source, /return \(\) => pausePlayerSafely\(backgroundPlayer\)/);
  const cleanupStart = source.indexOf('return () => pausePlayerSafely(player)');
  const cleanupEnd = source.indexOf('useEffect(() => {', cleanupStart + 20);
  assert.doesNotMatch(source.slice(cleanupStart, cleanupEnd), /backgroundPlayer|stopAllAudio/);
});

test('Story Tree paths use stable colours and direction markers', () => {
  const source = read('app/story.tsx');
  assert.match(source, /stableStoryTreeHash/);
  assert.match(source, /STORY_TREE_BRANCH_COLORS\[colorIndex\]/);
  assert.match(source, /styles\.storyTreeDownArrow/g);
  assert.match(source, /borderTopColor: color/);
});
