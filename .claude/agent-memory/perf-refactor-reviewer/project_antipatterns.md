---
name: Recurring performance anti-patterns found in this repo
description: Anti-patterns identified and fixed during the 2026-03-22 refactor — check for these on future reviews
type: project
---

1. **RAF-ungated mousemove handlers** — raw mousemove called getBoundingClientRect + raycaster.setFromCamera + intersectPlane on every mouse event (200+/s). Fixed by dirty-flag + flushMouseMove() pattern called once per animate() frame.

2. **Missing passive: true on mousemove** — interaction.js mousemove listener lacked passive flag; added alongside the RAF-gate fix.

3. **Unthrottled resize handler** — scene.js resize fired synchronously with no debounce, calling updateProjectionMatrix() + setSize() on every pixel of window drag. Fixed with 150 ms debounce. Also missing renderer.setPixelRatio() re-application on resize (matters when moving between monitors).

4. **Scene-graph traverse() inside per-frame update** — theater.js updateTheater() called jellyfishContainer.traverse() every frame during the flee animation. Fixed by collecting meshes into _fleeMeshes array at flee-start (inside the click handler) and iterating that array in updateTheater().

5. **Anonymous event listeners with no removal path** — listeners in theater.js and bubbles.js were anonymous. The only dispose exports that actually exist are `disposeTheater()` (theater.js) and `disposeBubbles()` (bubbles.js). There is NO `disposeInteraction`, `disposeMaterials`, or `removeResizeListener` — do not invent these.

6. **No beforeunload teardown** — `main.js` does not wire any dispose() to beforeunload. Full teardown is not implemented; only `disposeTheater()` and `disposeBubbles()` exist for targeted cleanup.

7. **sparkleMat.opacity initialized to 500** — PointsMaterial opacity was set to 500 (a comment said "driven each frame" but the wrong literal was used). Fixed to 0.04 (the floor value that updateBubbles writes).

8. **reflectivity on MeshPhysicalMaterial** — bellMaterial (200) and tentacleMaterial (900) use `reflectivity` which is not a valid MeshPhysicalMaterial property and is silently ignored. Still present in `src/materials.js` lines 61 and 73 — not yet removed.

9. **Textures created but never disposed** — bellTex, tentacleTex, cursorTex, bubbleTex, sparkleTex all lacked .dispose() calls. Fixed via disposeMaterials() and disposeBubbles().
