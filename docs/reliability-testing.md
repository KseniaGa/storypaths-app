# Saving and media checks

These changes are local and are not yet on the public website. Use a disposable
test story in the updated build. Existing stories do not need to be changed.

## Browser

1. Edit an existing scene and immediately attempt to refresh. If the browser
   asks whether to leave, stay and allow saving to finish. Refresh after “Saved”
   and check the latest words. IndexedDB commits asynchronously; forcing a
   refresh before confirmation can lose pending changes.
2. Start a new scene, type a sentence, and immediately switch tabs. Return and
   check the Story Tree: the sentence should be saved in exactly one new scene.
3. Change a choice destination, edit some text, and refresh. Both changes should
   remain, and the choice should reach the chosen scene in Play.
4. Import a media-rich JSON larger than 6 MB, wait for saving to finish, refresh,
   and check that the imported story and media remain. Previously saved stories
   should remain too. Close older Branch Beetle tabs during the first upgrade.

## Android

1. Edit a scene and immediately switch to another app. Return and check the text.
   Repeat with a new scene and check that it was created only once.
2. Import an image and an audio file into a test scene. Leave the editor, close
   and reopen the app after it reports saved, and check both attachments in Play.
3. If a file import fails, the app should explain the failure; existing audio
   should remain attached.

Do not clear app data or uninstall to test this: permanent app storage is still
removed by those actions. Deliberate storage failures and picker-cache deletion
are covered by automated tests using simulated storage.

## Complete backup checks

1. In a test story, include an image, drawing, voice note, background music,
   and a scene music override. Export it with **Backup JSON**.
2. Import the JSON into a fresh browser profile or another device. Check the
   pictures, their positions, audio, choice links, and text formatting.
3. Export that restored story again and import it elsewhere.
4. Try an older JSON backup. Text and choices should import as before. If it
   contains file paths, the app should explain that those media files were not
   included and may only work on the original device.

New complete backups embed media in the JSON. On native devices, import writes
the embedded media into permanent app storage. Missing media stops a complete
export; a failed restore does not replace the existing story. Larger media files
produce larger JSON backups, and browser storage limits still apply.

## Verified automatically

Latest stability pass (2026-09-29): Expo Doctor passes 21/21 checks. The 28 lint
errors from the SDK upgrade are resolved without disabling lint rules.

- 73 regression tests passed, including interrupted saves, storage failures,
  retries, scene-link restoration, and native media copies surviving simulated
  cache deletion, complete backup round trips on simulated Android/web storage,
  older backups, corrupt media, cleanup after a failed restore, and four real
  React first-render checks for playback and scene editing, plus an Expo-compiled
  media-gesture check rejecting shared-value reads during render, and five URL
  decoder/Router compatibility and malformed-input checks. Six new IndexedDB
  tests cover large snapshots, safe legacy transfer, aborted commits/retry,
  storage access errors, clear tombstones, and a real-store import/reload.
- TypeScript passed; lint reported no errors and seven older unused-code warnings.
- Production web export and Android JavaScript/Hermes export succeeded.
- npm audit has 12 moderate dependency-chain findings remaining, from the
  previously reviewed `xcode -> uuid` tooling advisory. The URL-decoder issue
  is resolved; no high or critical findings remain. See development notes.

On 2026-09-30 the local production web build was browser-tested: a 6,720,487-byte
JSON backup was imported through the normal picker, the page was refreshed,
and the restored story played with its embedded BMP image displayed. Earlier
the user confirmed phone playback and drawing, and deployed the prior changes.
The user then deployed the IndexedDB fix and confirmed that the original nearly
6 MB JSON imports successfully and remains after a refresh in Google Chrome.

Follow-up transfer checks:

1. The user confirmed that the JSON saved from Telegram to Downloads now imports
   successfully on their phone. The modern reader is bundled eagerly to avoid
   a development reload. The same 6.3 MB JSON also passed local validation and
   simulated Android restoration (four scenes, five media files, no warnings).
   Full media playback and reopening remain useful follow-up checks.
2. With the updated web build, export the story containing the additional
   drawing to HTML. Keep the tab open until Chrome reports download completion.
   Open the completed HTML and check images, drawing, audio, and choices.
3. If Chrome still fails, record the precise download failure reason. The longer
   blob URL lifetime is a mitigation, not a confirmed diagnosis of that failure.

Import conflict checks (the user confirmed the new dialog works on their phone):

The local production web build passed Cancel, Copy, refresh retention, and
Replace checks using the 6.7 MB test backup. The cases below remain useful for
phone verification; both screen handlers are also covered by regression tests.

Chrome download follow-up: the user reported `Failed - System busy`. Their
6,314,885-byte `.crdownload` contains complete HTML, valid JavaScript syntax,
four scenes, and five embedded media files. An identical `.html` copy is in
`dist/the_stars_will_tell_recovered.html`. Generation is verified for this file;
The user subsequently confirmed that choosing Documents via Chrome's "Ask where
to save each file" completed the download, and that HTML playback worked with
media and choices. The original Downloads-folder failure remains unexplained.
The longer blob lifetime alone did not resolve this case.

1. Export a test story, then change its text locally and import the backup.
   Choose Cancel: local text and story count must stay unchanged.
2. Import again and choose Import as a separate copy: both versions must remain,
   with a `(copy)` title on the imported one. Check links, media, and independent
   editing, then reload and confirm both remain.
3. Import again and choose Replace existing story: the original ID should now
   contain the backup version; the separate copy should stay untouched.
4. A separately created story with the same title must not trigger replacement.
   Renaming an existing story does not change its identity; its own backup must
   still offer the choice. Test both Home and New Story import buttons.

## Limits and next work

- Future cosmetic polish: save new drawings with consistent transparency across
  platforms and exports. Handle older images with baked-in backgrounds separately;
  see development notes. This is not a release blocker.
- Permanent media copies apply to newly imported native attachments. Existing
  attachment paths have not been migrated.
- Portable JSON backups are implemented; the reported phone-to-web transfer
  displayed the media, but a later nearly 6 MB import failed to persist in
  localStorage. The user has now verified the deployed IndexedDB fix in Chrome.
- IndexedDB has more capacity than localStorage but is not unlimited, and browser
  site-data deletion/eviction can still remove stories. Keep portable backups.
- Background and page lifecycle saves reduce loss during ordinary interruptions.
  They cannot guarantee a final save if the OS kills the process without notice.
- Browsers decide whether to display a requested leave-page warning after a
  failed save; this is not a substitute for a backup.
