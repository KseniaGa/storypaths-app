const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const routerRequire = createRequire(require.resolve('expo-router/package.json'));
const query = routerRequire('query-string');
const queryRequire = createRequire(routerRequire.resolve('query-string'));
const decode = queryRequire('decode-uri-component');
const { getStateFromPath } = routerRequire('./build/react-navigation/core/getStateFromPath');
const { getPathFromState } = routerRequire('./build/react-navigation/core/getPathFromState');

test('Router resolves the compatibility adapter and the official patched decoder', () => {
  assert.equal(typeof decode, 'function');
  const adapterRequire = createRequire(queryRequire.resolve('decode-uri-component'));
  assert.equal(typeof adapterRequire('decode-uri-component-patched').default, 'function');
  assert.equal(decode('A+B%2BC'), 'A B+C');
  assert.throws(() => decode(null), TypeError);
});

test('story editor and preview route parameters survive URL encoding and decoding', () => {
  const parameters = {
    sceneId: 'scene-123', parentSceneId: 'scene-456', choiceId: 'choice-789',
    returnSceneId: 'scene-456', restoreScroll: 'true', preview: 'true',
    createdFromChoice: 'Stars + moon / 100%? 🌙 & café',
    createdFromScene: 'Зорі — 星',
  };
  const config = { screens: { Editor: 'scene-editor', Play: 'play' } };
  for (const name of ['Editor', 'Play']) {
    const path = getPathFromState({ routes: [{ name, params: parameters }] }, config);
    const restored = getStateFromPath(path, config);
    assert.equal(restored.routes[0].name, name);
    assert.deepEqual({ ...restored.routes[0].params }, parameters);
  }
});

test('query parsing preserves plus signs, repeated keys, empty values, and encoded delimiters', () => {
  assert.deepEqual({ ...query.parse('label=A+B&literal=A%2BB&tag=one&tag=two&empty=&flag&data=a%26b%3Dc%23d') }, {
    label: 'A B', literal: 'A+B', tag: ['one', 'two'], empty: '', flag: null, data: 'a&b=c#d',
  });
  assert.deepEqual({ ...query.parse('label=A+B%20C', { decode: false }) }, { label: 'A+B%20C' });
});

test('malformed percent encodings remain readable without throwing', () => {
  for (const [input, expected] of [
    ['%', '%'], ['%GG', '%GG'], ['%E0%A4%A', '%E0%A4%A'],
    ['%41%80%42', 'A%80B'], ['%F0%9F%8C%99%FF', '🌙%FF'],
  ]) {
    assert.equal(query.parse(`sceneId=${input}`).sceneId, expected);
  }
});

test('long malformed URL input completes within a bounded worker process', () => {
  // Separate process bounds the regression even if a vulnerable decoder returns.
  const script = `
    const {createRequire} = require('node:module');
    const query = createRequire(require.resolve('expo-router/package.json'))('query-string');
    const input = '%80'.repeat(12000) + '%41';
    const decoded = query.parse('sceneId=' + input).sceneId;
    if (decoded !== '%80'.repeat(12000) + 'A') process.exit(1);
  `;
  const result = spawnSync(process.execPath, ['-e', script], { timeout: 5000, encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});
