---
name: Project architecture — jellyfish interactive artwork
description: Module layout, key data-flow patterns, and disposal conventions established during the 2026-03-22 refactor
type: project
---

The project is split into six ES modules loaded by `src/main.js`:

- `scene.js` — renderer, camera, lights, resize handler
- `materials.js` — procedural CanvasTexture creation + MeshPhysicalMaterial instances
- `jellyfish.js` — GLTF load, bellGroup/tentGroup construction, jellyfishState export
- `interaction.js` — mousemove / wheel listeners, cursorTarget, cursorGlowGroup
- `bubbles.js` — Sprite bubbles + Points sparkles, updateBubbles()
- `theater.js` — video player controls, flee animation, updateTheater()
- `animate.js` — central RAF loop, physics constants, calls flushMouseMove() at top of each frame
- `main.js` — imports all side-effect modules, starts animate(), wires beforeunload dispose()

**Why:** The codebase was refactored from a monolithic 337-line main.js into these modules before this session. The module boundaries are stable — avoid re-consolidating them.

**How to apply:** Any new feature belongs in the relevant module, not main.js. main.js should stay as the thin orchestrator + teardown point only.
