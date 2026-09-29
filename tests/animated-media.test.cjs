const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const babel = require('@babel/core');

test('compiled media gestures read coordinates only in callbacks and save their latest position', () => {
  const source = fs.readFileSync('app/scene-media.tsx', 'utf8') + '\nexport { DraggableAsset };';
  const { code } = babel.transformSync(source, {
    filename: 'app/scene-media.tsx',
    presets: ['babel-preset-expo'],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
    caller: { name: 'metro', platform: 'android', isDev: true, supportsStaticESM: true, supportsReactCompiler: true },
  });
  let rendering = true;
  const shared = [];
  const gestures = [];
  const styles = [];
  const cache = [];
  const makeGesture = () => {
    const gesture = {
      onChange(callback) { this.change = callback; return this; },
      onEnd(callback) { this.end = callback; return this; },
    };
    gestures.push(gesture);
    return gesture;
  };
  const mocks = {
    'react/compiler-runtime': { c: (size) => {
      if (!cache.length) cache.push(...Array(size).fill(Symbol.for('react.memo_cache_sentinel')));
      return cache;
    } },
    react: { useEffect: () => {} },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    'react-native': { StyleSheet: { create: (styles) => styles } },
    'react-native-reanimated': {
      __esModule: true, default: { Image: 'AnimatedImage' },
      useSharedValue(initial) {
        let position = initial;
        const value = {
          get value() { assert.equal(rendering, false, 'shared value read during render'); return position; },
          get() { assert.equal(rendering, false, 'shared get during render'); return position; },
          set(next) { position = next; },
        };
        shared.push(value);
        return value;
      },
      useAnimatedStyle(callback) { styles.push(callback); return {}; },
      runOnJS: (callback) => callback,
    },
    'react-native-gesture-handler': {
      GestureDetector: 'GestureDetector',
      Gesture: { Tap: makeGesture, Pan: makeGesture, Simultaneous: (...items) => items },
    },
  };
  const module = { exports: {} };
  Function('require', 'module', 'exports', code)(
    (id) => mocks[id] || (id.startsWith('@babel/runtime/') ? require(id) : {}), module, module.exports,
  );
  const moves = [];
  module.exports.DraggableAsset({
    asset: { id: 'picture', x: 10, y: 15, width: 220, height: 160, uri: 'image.png' },
    isSelected: false, onSelect: () => {}, onMoveEnd: (...args) => moves.push(args),
  });
  rendering = false;
  const pan = gestures.find((gesture) => gesture.change);
  pan.change({ changeX: 20, changeY: 10 });
  pan.end();
  assert.deepEqual(moves[0], ['picture', 30, 25]);
  assert.deepEqual(styles[0](), { transform: [{ translateX: 30 }, { translateY: 25 }] });
  pan.change({ changeX: 1000, changeY: -1000 });
  pan.end();
  assert.deepEqual(moves[1], ['picture', 160, -20]);
  assert.equal(shared.length, 2);
});
