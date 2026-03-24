# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (http://localhost:5173)
npm run build    # Production build → dist/
npm run preview  # Serve production build locally
```

No lint or test scripts are configured.

## Architecture

This is a vanilla JavaScript + Three.js interactive artwork project bundled with Vite (no framework).

- **Entry**: `index.html` loads `src/main.js` as an ES module
- **Canvas**: A full-screen `<canvas id="bg">` is the Three.js render target; `<div id="app">` is currently hidden (`display: none`) and reserved for UI overlay
- **3D assets**: `src/models/` contains several GLTF/GLB variants of a jellyfish model (`jelfish.gltf`, `jelfish_32.glb`, etc.) — load via Three.js `GLTFLoader`
- **Styling**: `src/style.css` uses CSS custom properties for theming (light/dark via `prefers-color-scheme`) with a design token system (`--text`, `--accent`, `--bg`, etc.)
- **`src/main.js`**: Contains the full Three.js scene — renderer, camera, lighting, GLTF model loading, procedural textures, cursor-tracking physics (spring/damping), scroll-to-scale, and the `animate()` loop

Three.js is a runtime dependency (`three@^0.162`); Vite is the only dev dependency.

## Jellyfish behavior

- **Model**: loads `src/models/jelfish_alembic.gltf` via `GLTFLoader`; meshes named `Connect*`, `EDGE*`, `Lathe*` get `bellMaterial`; `TENT` + `Hair.1` get `tentacleMaterial`
- **Bell group** (`bellGroup`): pivots on bell center; corrective `rotation.z = 0.6`
- **Tentacle group** (`tentGroup`): holds `TENT` + `Hair.1`; lags behind body position and swings on cursor X velocity
- **Cursor follow**: raycasts mouse onto a Z=0 plane; body lerps toward target with spring/damping jiggle (`STIFFNESS=120, DAMPING=8`)
- **Scroll**: `wheel` event scales jellyfish (`scrollScale`, clamped 0.2–4)
- **Procedural textures**: `createBellTexture()` (radial gradient) and `createTentacleTexture()` (linear gradient) are generated on `<canvas>` elements
