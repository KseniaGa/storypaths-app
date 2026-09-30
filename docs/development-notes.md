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

## 2026-09-30: large web imports disappearing after refresh

The user imported a nearly 6 MB JSON on the deployed website. It opened in
memory, but the save-failure banner correctly reported that it was not stored;
refreshing lost that imported copy. That size, plus existing stories, exceeds
the practical localStorage capacity used by the old web backend. No direct
measurement of the user's browser quota was taken.

- Web storage now uses IndexedDB (`branch-beetle`, `story-snapshots`) with the
  same Zustand key (`storypaths-storage-v9`) and JSON format. Android still uses
  AsyncStorage. Backups still contain media as before.
- When the database has no record, it reads the old localStorage snapshot.
  Only after a successful database commit does it remove that app key from
  localStorage. Other website keys are untouched. A failed commit leaves the
  original copy available. Read failures do not fall back to stale data.
- The web UI waits for saved data to load, exposes a retry on load errors, and
  shows an in-progress save message. Refresh/close requests are guarded while
  saves are pending or failed. Browsers control whether the prompt appears;
  forced refresh or abrupt termination before commit can still lose changes.
- Added fake-indexeddb as a development-only test dependency and six storage
  tests, including a real store import/reload with over 7 MB of embedded media.
- Browser-tested the production build locally with a 6.7 MB JSON through the
  normal import picker: refresh retained the story and playback displayed the
  embedded image. Screenshot: `dist/browser-storage-proof.png` (ignored artifact).
- Validation: 67/67 tests, TypeScript, lint (zero errors/seven older warnings),
  production web export, and Android JavaScript/Hermes export passed.

The user subsequently deployed the fix and confirmed that the original nearly
6 MB backup imports successfully and remains after refreshing Google Chrome.
Browser storage is still subject to permission, capacity, and eviction limits;
keep exported JSON backups.

## 2026-09-30: web-to-phone transfer follow-up

After adding a drawing to the imported story on web, the user reported that
Chrome started but could not finish the HTML download. JSON export completed;
after transferring it through Telegram and saving to Downloads, Android import
failed while reading the picker file, before JSON parsing or media restoration.

- Both JSON import screens now request the original Android content URI instead
  of copying into Expo Go's shared DocumentPicker cache. The installed picker
  uses context.cacheDir, while the filesystem reader checks project permissions;
  the screenshot names that shared cache path. Read the granted URI immediately,
  then continue the existing validation and permanent media restoration. iOS and
  web retain their existing picker options. This needs real-phone confirmation.
- Browser download blob URLs now live for five minutes instead of one second,
  for text exports and Story Tree PNGs. The anchor API has no completion signal.
  This mitigates premature cleanup during larger downloads; it is not yet a
  confirmed explanation of Chrome's reported incomplete download.
- Added an execution test of both import handlers with a >7 MB JSON and a reader
  rejecting the shared cache. Tested Android versus retained iOS/web options.
  Download tests verify the URL remains valid after clicking and is later freed.
- Checks: 68 tests passed, TypeScript passed, lint has zero errors/seven existing
  warnings, production web and Android JavaScript/Hermes exports succeeded.
- Local in-app browser: opened the persisted 6.7 MB media fixture and invoked
  Playable HTML. No application error appeared, but the automation's download
  completion event timed out. Do not count this as a successful download check.
- No push or Pages update performed. Web output: `dist/transfer-fix-web`.

## 2026-09-30: Android Downloads reader correction

The user's phone retry reached the original Telegram/Downloads content URI but
failed with `Unsupported scheme` in the legacy reader. This confirms the picker
change loaded, but the earlier fix was incomplete. The previous test double
incorrectly allowed legacy reads of single-document Downloads content URIs.

Android JSON imports with `content://` now use the current Expo `File.text()`
API. Inspection of the installed native implementation confirms it opens both
single-document and generic provider URIs through Android's content resolver.
The original granted URI is preserved; no raw filesystem path is decoded or
guessed. Other native file reads and browser reads retain their existing paths.

The updated large-import handler test rejects legacy reads and uses the exact
URI shape from the screenshot. A second test verifies provider failures are
propagated without a legacy/raw-path fallback. Both failed before the reader
change and pass after it. All 69 regression tests, TypeScript, and lint passed
(zero lint errors, seven existing warnings). Real-phone confirmation is pending.

## 2026-09-30: import interrupted by an Expo development reload

The next phone retry showed the Expo loading screen after selecting the JSON,
then returned home, with `Cannot connect to Expo CLI` and no import exception.
Inspection found that the newly added dynamic `import("expo-file-system")`
can load a split bundle. Expo's installed `loadBundle.ts` registers that bundle
with HMR; `hmr.ts` reloads when the HMR connection is unavailable. This matches
the reported sequence, but no phone-side trace was available to prove causality.

The modern File reader is now statically imported in the startup bundle. JSON
selection no longer needs to load that module from Metro. Added a regression
guard requiring the reader to be eager and disallowing dynamic imports in the
file utility; updated native module mocks in the existing test harnesses.

The actual 6,292,139-byte JSON in Downloads was checked locally using the real
validation/restoration helpers and simulated Android filesystem operations:
four scenes, four scene assets verified byte-for-byte, five media files restored
including music, zero warnings, 4,716,382 restored media bytes. The source file
was read only. This is not a real-device import test. Diagnostic script is an
ignored local artifact at `dist/check-phone-backup.cjs`.

All 70 tests, TypeScript, and lint passed (zero errors/seven existing warnings).
Metro was listening on 0.0.0.0:8081 and its localhost status endpoint returned
`packager-status:running`; this does not verify the phone's WebSocket connection.
The user subsequently confirmed the phone import succeeded. They also noticed
that the imported backup replaced the earlier version, leading to the import
choice improvement below. Nothing was pushed or deployed by the assistant.

## 2026-09-30: choose how to import an existing story

Previously, importing a backup silently replaced any story with the same internal
story ID. Titles did not determine replacement. This explains the version update
the user observed; it did not cause the preceding file-reader or Expo errors.

Both the Home and New Story import buttons now show a shared native/web dialog
when the backup's ID matches an existing story:

- **Import as a separate copy:** keeps the original and assigns the imported
  story a fresh ID and a unique `(copy)` title. Scene links, remembered-choice
  references, and media composition remain intact. Editing the copy affects only
  that story. Future exports carry the copy's new ID.
- **Replace existing story:** explicitly overwrites the matching version after
  media restoration succeeds. The dialog warns that local edits will be lost.
- **Cancel:** stops before restoring media or changing the story store. Closing
  the dialog or leaving its screen also cancels the pending decision.

Unrelated stories with the same title import normally. The store also defaults
to keeping both on an unexpected ID conflict, so replacement always requires
an explicit `replace` option. No old media files are deleted during replacement.

Validation: 73 regression tests pass, including real-store copy/replacement,
independent edits, retained links/media, persistence/reload on native and web,
and both import handlers waiting for the decision before restoring media.
TypeScript passes; lint has no errors and seven existing warnings.
Production web and Android JavaScript/Hermes exports passed. The local production
web build was tested with a 6.7 MB backup: Cancel retained one story; Copy created
the second version, which survived refresh; Replace reopened the original while
the copy remained in the two-story library. No browser console errors appeared.
Dialog screenshot: `dist/import-choice-dialog.png` (ignored local artifact).
The user subsequently confirmed the new dialog works on their phone. No push or Pages
deployment performed. Web build output: `dist/import-choice-web`.

## 2026-09-30: Chrome HTML download reports System busy

The user confirmed the import conflict dialog works on their phone. The remaining
Chrome HTML download failure now has a precise message: `Failed - System busy`.
The supplied `Unconfirmed 259557.crdownload` was inspected read-only. It is
6,314,885 bytes and contains a complete HTML document with its closing tags,
one syntactically valid JavaScript block (compiled without executing it), four
scenes, and five embedded media files whose Base64 round trips correctly.

An unchanged copy was saved to `dist/the_stars_will_tell_recovered.html` without
modifying the original download. This establishes that this export was fully
generated; no further speculative exporter change was made. It does not establish
which local process or filesystem condition prevented Chrome from finalizing
the download. Google Chrome Help describes System busy as a failure to save the
file locally and recommends retrying or selecting another accessible folder:
https://support.google.com/chrome/answer/2898334?hl=en-Gb

The earlier longer blob-URL lifetime did not resolve the user's reported failure.
No browser/security settings were changed. Playback of the recovered file and
a retry to another folder are the next checks. No push or deployment performed.

User follow-up: enabling Chrome's "Ask where to save each file" and selecting
Documents allowed the download to finish. The user then confirmed exported HTML
playback worked, including media and choices. The underlying reason Downloads
failed remains unknown; saving to Documents is the verified workaround.

## Future polish: consistent transparent drawing backgrounds

The exported heart drawing appeared on a cream rectangle against a dark scene,
while another drawing blended into the scene background. The screenshots suggest
the cream background is part of the saved image; confirm the drawing save paths
before implementing a fix. The user considers this cosmetic, not a release blocker.

- Make newly saved drawings consistently preserve transparency on web and native,
  including after JSON transfer and playable HTML export.
- Verify against both light and dark scene themes.
- Treat existing drawings with baked-in backgrounds separately. Preserve originals;
  do not automatically remove light pixels, which may be intentional artwork.

Recorded for a future update at the user's request; no drawing code changed.

## Future idea: insertable story structures

Let creators add a small structure inside any existing story, rather than only
starting a whole story from a template. Initial candidates: a loop with an exit,
a fork with two branches, and branches that rejoin.

Not implemented yet. Decisions to explore: where the fragment connects, how to
choose entry/exit scenes, how to preview it before insertion, and how to avoid
overwriting existing links. Each insertion would need fresh scene/choice IDs.
