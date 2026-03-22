import "./style.css";
import { animate } from "./animate.js";
import { renderer, scene, removeResizeListener } from "./scene.js";
import { disposeInteraction } from "./interaction.js";
import { disposeTheater } from "./theater.js";
import { disposeBubbles } from "./bubbles.js";
import { disposeMaterials } from "./materials.js";

animate();

// --- Teardown ---
// Releases GPU-side resources (textures, geometries, materials, render targets)
// and removes all event listeners when the page is unloaded. Prevents memory
// leaks in long-lived browser tabs and during hot-module-replacement in dev.
function dispose() {
  disposeInteraction();
  disposeTheater();
  disposeBubbles();
  disposeMaterials();
  removeResizeListener();
  renderer.dispose();
  // Traverse the scene and dispose any remaining geometries / materials /
  // textures attached to objects we did not explicitly track above (e.g. GLTF
  // meshes loaded asynchronously).
  scene.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    if (object.material) {
      const mats = Array.isArray(object.material)
        ? object.material
        : [object.material];
      mats.forEach((m) => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    }
  });
}

window.addEventListener("beforeunload", dispose);
