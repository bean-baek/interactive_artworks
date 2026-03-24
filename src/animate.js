import { renderer, scene, camera } from "./scene.js";
import { jellyfishContainer, jellyfishState, updateJellyfish } from "./jellyfish.js";
import { cursorTarget, interactionState, hoverState } from "./interaction.js";
import { updateBubbles } from "./bubbles.js";
import { theaterState, fleeTarget, updateTheater } from "./theater.js";
import { updateObjects } from "./objects.js";
import { updateSketchbook } from "./sketchbook.js";
import { updateCamera } from "./camera.js";
import { updateFireworks } from "./fireworks.js";
import { updateAudio } from "./audio.js";

let lastTime = performance.now();
let elapsed = 0;
let hintOpacity = 0;
let hintDismissed = false;

const hintEl = document.getElementById("hint-text");

export function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const delta = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  elapsed += delta;

  if (jellyfishState.jellyfish && jellyfishContainer) {
    updateTheater(delta);
    updateJellyfish(delta, elapsed, cursorTarget, interactionState, hoverState, theaterState, fleeTarget);
  }

  updateBubbles(elapsed);
  updateObjects(delta, elapsed);
  updateSketchbook(delta, elapsed);
  updateCamera(delta);
  updateFireworks(delta);
  updateAudio(delta);

  // Hint text: breathing when idle, dismissed permanently on first jellyfish click
  if (hintEl) {
    if (!hintDismissed && theaterState.fleeing) hintDismissed = true;
    const hintTarget = hintDismissed || hoverState.isHovering
      ? 0
      : 0.575 + Math.sin(elapsed * 1.2) * 0.275;
    hintOpacity += (hintTarget - hintOpacity) * (1 - Math.pow(0.08, delta));
    hintEl.style.opacity = hintOpacity;
  }

  renderer.render(scene, camera);
}
