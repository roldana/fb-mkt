From the project directory:

```bash
npm ci
npm start
```

If running inside this Codex environment, unset its Node-only Electron flag:

```bash
env -u ELECTRON_RUN_AS_NODE npm start
```

### Testing

There is no automated `npm test` script yet. Run syntax checks and an isolated manual test:

```bash
node --check main.js
node --check preload.js
node --check renderer.js
node --check sidebar.js

npm start -- --user-data-dir=/tmp/fb-marketplace-pro-test
```

Create an unpacked test build:

```bash
npm run dist -- --dir
```

### Building installers

Build for the current platform:

```bash
npm run dist
```

Artifacts are written to `dist/`.

Explicit targets:

```bash
# Linux AppImage
npm run dist -- --linux AppImage

# Windows NSIS installer and ZIP (build on Windows)
npm run dist -- --win nsis zip

# macOS DMG and ZIP (build on Mac)
npm run dist -- --mac dmg zip
```