# Saving and media checks

These changes are local and are not yet on the public website. Use a disposable
test story in the updated build. Existing stories do not need to be changed.

## Browser

1. Edit an existing scene and immediately refresh, without waiting for “Saved.”
   The latest words should still be there.
2. Start a new scene, type a sentence, and immediately switch tabs. Return and
   check the Story Tree: the sentence should be saved in exactly one new scene.
3. Change a choice destination, edit some text, and refresh. Both changes should
   remain, and the choice should reach the chosen scene in Play.

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

- 61 regression tests passed, including interrupted saves, storage failures,
  retries, scene-link restoration, and native media copies surviving simulated
  cache deletion, complete backup round trips on simulated Android/web storage,
  older backups, corrupt media, cleanup after a failed restore, and four real
  React first-render checks for playback and scene editing, plus an Expo-compiled
  media-gesture check rejecting shared-value reads during render, and five URL
  decoder/Router compatibility and malformed-input checks.
- TypeScript passed; lint reported no errors and seven older unused-code warnings.
- Production web export and Android JavaScript/Hermes export succeeded.
- npm audit has 12 moderate dependency-chain findings remaining, from the
  previously reviewed `xcode -> uuid` tooling advisory. The URL-decoder issue
  is resolved; no high or critical findings remain. See development notes.

Browser UI verification was attempted but the browser tool could not load the
local preview. The user has since confirmed phone playback, drawing alignment,
and a JSON transfer to the public web app with media preserved. The changes in
this latest stability pass still need a short phone smoke test; exports and
automated tests are not a replacement for real touch/audio checks.

## Limits and next work

- Permanent media copies apply to newly imported native attachments. Existing
  attachment paths have not been migrated.
- Portable JSON backups are implemented; the reported phone-to-web transfer
  passed. Fresh-device restore/re-export coverage remains incomplete. The public
  website has not been updated.
- Background and page lifecycle saves reduce loss during ordinary interruptions.
  They cannot guarantee a final save if the OS kills the process without notice.
- Browsers decide whether to display a requested leave-page warning after a
  failed save; this is not a substitute for a backup.
