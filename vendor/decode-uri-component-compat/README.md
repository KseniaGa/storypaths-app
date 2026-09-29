# URL-decoder compatibility adapter

`expo-router@57.0.24` uses `query-string@7.1.3`, which requires a CommonJS
function from `decode-uri-component@^0.2.2`. The fixed upstream decoder 0.5.0
is ESM. Overriding it directly would turn that function into a module object.

The root override replaces the decoder dependency with this local adapter.
Its only current transitive consumer is query-string 7.1.3. The root dependency
reference lets npm deduplicate the local package reliably. The local version
`0.5.0-compat.1` identifies this adapter, not an upstream release.
It calls the unmodified, pinned upstream 0.5.0 decoder through an npm alias,
and preserves the older decoder's `+` to space conversion. No decoding algorithm
is copied or patched. The dependency and its integrity are in package-lock.json.

The adapter requires the modern Node versions already required by React Native
0.86 (Node 20.19.4+, 22.13+, 24.3+, or newer supported majors) and is also bundled
by Metro for Android/web. Keep the adapter and lockfile with the project when
installing dependencies or building remotely.

Remove this override and directory once a compatible Expo Router update uses a
patched decoder natively. Re-run tests/url-decoding.test.cjs and both platform
exports when changing this dependency.

Advisory: https://github.com/advisories/GHSA-vcc3-ghjq-m6fr
Upstream fix: https://github.com/SamVerschueren/decode-uri-component/releases/tag/v0.5.0
