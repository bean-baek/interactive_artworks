---
name: Project architecture — jellyfish interactive artwork
description: Module layout, key data-flow patterns, and disposal conventions established during the 2026-03-22 refactor
type: project
---

The project is split into ES modules loaded by `src/main.js`:

- `scene.js` — renderer, camera, lights, resize handler
- `materials.js` — procedural CanvasTexture creation + MeshPhysicalMaterial instances (`bellMaterial`, `tentacleMaterial`)
- `jellyfish.js` — GLTF load, bellGroup/tentGroup construction, jellyfishState export
- `interaction.js` — mousemove / wheel listeners, cursorTarget, cursorGlowGroup
- `bubbles.js` — Sprite bubbles + Points sparkles, updateBubbles(), fadeBubbles(), disposeBubbles()
- `theater.js` — video player controls, flee animation, updateTheater(), disposeTheater()
- `animate.js` — central RAF loop, jellyfish spring physics, calls all update*() functions each frame
- `camera.js` — Phase 3 camera controller; parallax, focus/unfocus, angled top-down view; exports isCameraFocused, activateCameraController(), focusCamera(), unfocusCamera(), updateCamera()
- `objects.js` — Phase 3 kalimba GLTF + 4096-instance leaf particle system (CPU physics); exports updateObjects()
- `sketchbook.js` — Phase 3 3D page-flip book; auto-closes 1.5s after last page; exports bookGroup, activateSketchbook(), updateSketchbook()
- `fireworks.js` — Phase 4 particle fireworks; exports triggerFireworks(), updateFireworks()
- `audio.js` — Web Audio API; exports initAudio(), playObjectSound(), stopObjectSound(), fadeInLaughter(), updateAudio()
- `main.js` — thin entry point; imports side-effect modules, calls initAudio() + animate()

**Why:** The codebase was refactored from a monolithic 337-line main.js into these modules before this session. The module boundaries are stable — avoid re-consolidating them.

**How to apply:** Any new feature belongs in the relevant module, not main.js. main.js should stay as the thin orchestrator + teardown point only.
