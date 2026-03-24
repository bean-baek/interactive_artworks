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
- **3D assets**: `src/models/` contains GLTF/GLB model files; `src/assets/texture/` holds leaf textures
- **Styling**: `src/style.css` uses CSS custom properties for theming (light/dark via `prefers-color-scheme`) with a design token system (`--text`, `--accent`, `--bg`, etc.)
- **`src/main.js`**: Thin entry point — imports side-effect modules, calls `initAudio()` and `animate()`

Three.js is a runtime dependency (`three@^0.162`); Vite is the only dev dependency.

## Module map

| File | Responsibility |
|------|---------------|
| `scene.js` | Renderer, camera, lights, resize handler |
| `materials.js` | `bellMaterial`, `tentacleMaterial`, `leafMaterial`, `createCursorTexture()` |
| `jellyfish.js` | GLTF load, `bellGroup`/`tentGroup`, `jellyfishState` |
| `interaction.js` | mousemove/wheel listeners, `cursorTarget`, `cursorGlowGroup` |
| `bubbles.js` | Sprite bubbles + Points sparkles; `updateBubbles()`, `fadeBubbles()`, `disposeBubbles()` |
| `theater.js` | Video player controls, flee animation; `updateTheater()`, `disposeTheater()` |
| `animate.js` | Central RAF loop, jellyfish spring physics, calls all `update*()` functions |
| `camera.js` | Phase 3 camera controller — parallax, focus/unfocus, angled top-down view |
| `objects.js` | Phase 3 kalimba (GLTF) + leaf particle system (4096 InstancedMesh); `updateObjects()` |
| `sketchbook.js` | Phase 3 3D book slider with page-flip animation; `updateSketchbook()` |
| `fireworks.js` | Phase 4 particle fireworks; `triggerFireworks()`, `updateFireworks()` |
| `audio.js` | Web Audio API wrappers; `initAudio()`, `playObjectSound()`, `updateAudio()` |
| `main.js` | Entry: imports all modules, calls `initAudio()` + `animate()` |

## Jellyfish behavior

- **Model**: loads `src/models/jelfish_alembic.gltf` via `GLTFLoader`; meshes named `Connect*`, `EDGE*`, `Lathe*` get `bellMaterial`; `TENT` + `Hair.1` get `tentacleMaterial`
- **Bell group** (`bellGroup`): pivots on bell center; corrective `rotation.z = 0.6`
- **Tentacle group** (`tentGroup`): holds `TENT` + `Hair.1`; lags behind body position and swings on cursor X velocity
- **Cursor follow**: raycasts mouse onto a Z=0 plane; body lerps toward target with spring/damping jiggle (`STIFFNESS=100, DAMPING=8`)
- **Procedural textures**: `createBellTexture()` (radial gradient) and `createTentacleTexture()` (linear gradient) are generated on `<canvas>` elements

## Phase 3 — Sound Exploration

Activated after the video ends and the jellyfish returns to center:

- **Camera**: switches to angled top-down view (`camera.js`); Y/Z positioning via `theaterState.cameraTargetZ`; clicking the sketchbook triggers `focusCamera()`, finishing the book triggers `unfocusCamera()`
- **Kalimba**: GLTF model (`kalimba.gltf`) at y=-2.8; 3 chrome tine meshes (`Object_6/7/8`) are interactive — clicking all 3 triggers fireworks + laughter
- **Leaves**: 4096-instance `InstancedMesh` with CPU physics — wind, cursor repulsion, lift/gravity, floor collision, infinite XZ wrap; autumn colours (#c4c557 → #f7782b); purely visual (not clickable)
- **Sketchbook**: 3D page-flip book (`sketchbook.js`); auto-closes 1.5s after the last page is fully flipped
