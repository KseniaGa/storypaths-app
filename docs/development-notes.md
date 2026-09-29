# Playtest notes

## 2026-09-29

User tested the upgraded app on a phone. Exporting a JSON story and importing it
into the current GitHub Pages build worked, with all media preserved. This is
user-reported confirmation of that transfer, not complete device coverage.

Follow-up fixes:
- Drawing palette: renamed its ordinary `value` property to `hex` so the Worklets
  inline-style check does not mistake colour strings for animated shared values.
- Native drawing: compensate for changes between the canvas bitmap size and
  its displayed size, preserving the artwork. This addresses a likely cause of
  the brush offset. The user subsequently confirmed the drawing pad works well
  on the phone.
- Playable HTML: remove the retired storytelling-mode label from both export
  implementations. Already downloaded HTML files need to be exported again.

## Expo 57 stability pass

- Fixed the React checks without disabling lint rules. Drawing controls now read
  state, save/back callbacks update after rendering, scene drafts initialize when
  their scene changes, and media screens use the store's latest attachments.
- Playback initializes its starting scene, story values, and visit count together.
  Starting a different story/preview creates a fresh playback session. Visiting a
  destination updates the visit count in the same action.
- Added four real React first-render tests for normal playback, preview/fallback,
  populated scene editing, and blank new scenes. These complement store/lifecycle
  tests; they do not simulate touch gestures or audio playback.
- Validation: 55/55 tests; TypeScript; lint with zero errors and seven older
  unused-code warnings; production web export; Android JavaScript/Hermes export;
  Expo Doctor 21/21. Android export is not an APK or a phone test.
- Applied reviewed, non-forced npm audit updates inside compatible dependency
  ranges. Audit findings fell from 23 to 15, with no high or critical findings
  remaining. The 15 remaining moderate findings are dependency-chain reports
  from two underlying advisories, not 15 independent vulnerabilities.

Remaining dependency review:

- Resolved in the URL-decoder follow-up below: `expo-router -> query-string -> decode-uri-component@0.2.2`. Malformed URL
  input could consume excessive CPU. The patched decoder is 0.5.0, outside
  query-string's declared range and using a different module format. The
  adapter and compatibility tests described below now bridge those differences.
  [Advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr).
- Expo config tooling uses `xcode -> uuid@7.0.3`. The advisory concerns v3/v5/v6
  output-buffer handling. The installed xcode implementation calls `uuid.v4()`
  without an output buffer, so this inspected path does not exercise the reported
  flaw. This is an assessment of that call site, not a claim the dependency is
  fully free of vulnerabilities. Await a compatible upstream update; avoid
  downgrading Expo or overriding multiple major UUID versions just to clear the
  report. [Advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq).

No commit, push, or GitHub Pages deployment was performed. Next device check:
edit/save/reopen two different scenes, create a scene from a choice, draw and
undo/redo, move an image, preview/restart with audio, and reopen a JSON backup.

## Media-editor animation warning follow-up

The user reported the stability-pass phone checks worked, with repeated
Reanimated shared-value read warnings in the scene/media editor.
Compiling `DraggableAsset` with Expo's React Compiler enabled reproduced the
cause: `.value` reads in the drag-end callback were copied into render-time
memoization comparisons/assignments. Changed its remaining coordinate reads
to `.get()` inside gesture and animated-style callbacks, following
[Reanimated's compiler guidance](https://docs.swmansion.com/react-native-reanimated/docs/core/useSharedValue/).
Strict logging remains enabled.

Added a regression test that executes the Expo-compiled component with shared
values that reject render-time reads. It failed before the fix and passes after,
and checks dragging, boundary clamping, animated coordinates, and saved position.
The user subsequently reported that it works well on the phone.
Validation: 56/56 tests, TypeScript, lint (zero errors/seven older warnings),
production web export, and Android JavaScript/Hermes export all passed.

## URL-decoder security follow-up

Replaced the vulnerable decoder with the official 0.5.0 implementation through
a small local CommonJS adapter. The older query-string version in Expo Router
expects a callable CommonJS export, while the fixed decoder is ESM. The adapter
bridges that format difference and retains the old plus-to-space behavior.
The upstream algorithm is unmodified and pinned through an npm alias.

`package.json` overrides the decoder using a root local dependency so npm can
deduplicate it correctly. Keep `vendor/decode-uri-component-compat/` with the
project for future installs and builds. The local `0.5.0-compat.1` version belongs
to the adapter, not upstream. Remove the adapter when a compatible Expo Router
update no longer needs it. npm also deduplicated compatible packages in the lockfile.

Five added tests exercise the actual installed Router/query-string code: module
compatibility, editor/preview URL round trips, Unicode and plus signs, repeated
parameters, malformed encodings, and long malformed input with a process timeout.
Validation: 61/61 tests, TypeScript, lint (zero errors/seven older warnings),
Expo Doctor 21/21, web export, and Android JavaScript/Hermes export passed.
An isolated `npm ci --ignore-scripts` using the saved lockfile also passed;
decoder resolution and parsing were verified entirely inside that clean install.

The latest npm audit reports 12 moderate findings, all tracing to the previously
reviewed `xcode -> uuid` build-tool dependency. No URL-decoder, high, or critical
findings remain. This does not certify the whole app as vulnerability-free.
No commit, push, or deployment was performed.

## Future idea: insertable story structures

Let creators add a small structure inside any existing story, rather than only
starting a whole story from a template. Initial candidates: a loop with an exit,
a fork with two branches, and branches that rejoin.

Not implemented yet. Decisions to explore: where the fragment connects, how to
choose entry/exit scenes, how to preview it before insertion, and how to avoid
overwriting existing links. Each insertion would need fresh scene/choice IDs.
