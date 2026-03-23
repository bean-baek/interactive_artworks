/**
 * CameraController — vanilla Three.js translation of camera.md spec
 *
 * Responsibilities:
 *  - Global mode: subtle mouse parallax offsets camera X/Y
 *  - Focus mode: smooth lerp to book on first click (Z via theaterState, Y direct)
 *  - Scroll zoom: modifies theaterState.cameraTargetZ with min/max clamp
 *  - Scroll out: exceeding ZOOM_BLUR_THRESHOLD exits focus and resets Z
 */

import * as THREE from "three";
import { camera } from "./scene.js";
import { theaterState } from "./theater.js";

// ---------------------------------------------------------------------------
// Thresholds (camera.md: strict minDistance / maxDistance)
// ---------------------------------------------------------------------------
const ZOOM_MIN = 3.5; // closest the user can scroll in
const ZOOM_MAX = 10.0; // furthest the user can scroll out
const ZOOM_FOCUSED = 7.0; // Z when focused on book
const ZOOM_GLOBAL = 8.0; // Z in global overview mode
const ZOOM_EXIT_THRESHOLD = 5.0; // scroll past this to leave focus mode

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let cameraActive = false;
export let isCameraFocused = false;
let isTransitioning = false;

// ---------------------------------------------------------------------------
// Mouse NDC — updated from mousemove
// ---------------------------------------------------------------------------
const mouseNDC = new THREE.Vector2();

window.addEventListener("mousemove", (e) => {
  mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

// ---------------------------------------------------------------------------
// Scroll zoom (Phase 3 only)
// camera.md: scroll maps to Z-axis; scroll-out exits focus
// ---------------------------------------------------------------------------
window.addEventListener(
  "wheel",
  (e) => {
    if (!cameraActive) return;

    const dir = e.deltaY > 0 ? 1 : -1;
    const newZ = theaterState.cameraTargetZ + dir * 0.25;
    theaterState.cameraTargetZ = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZ));

    // Scroll out past threshold → exit focus mode
    if (isCameraFocused && theaterState.cameraTargetZ > ZOOM_EXIT_THRESHOLD) {
      isCameraFocused = false;
      isTransitioning = true;
      theaterState.cameraTargetZ = ZOOM_GLOBAL;
    }
  },
  { passive: true },
);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Called by objects.js when Phase 3 activates */
export function activateCameraController() {
  cameraActive = true;
  // Start in global overview
  theaterState.cameraTargetZ = ZOOM_GLOBAL;
}

/**
 * Called by sketchbook.js on the FIRST book click.
 * camera.md: "First Click: Triggers the camera focus animation."
 */
export function focusCamera() {
  if (isCameraFocused) return;
  isCameraFocused = true;
  isTransitioning = true;
  theaterState.cameraTargetZ = ZOOM_FOCUSED;
}

// ---------------------------------------------------------------------------
// Per-frame update — called from animate.js
// ---------------------------------------------------------------------------
export function updateCamera(delta) {
  if (!cameraActive) return;

  // ── Parallax: subtle X/Y camera offset tracks mouse ───────────────────
  // camera.md: "slightly rotate or offset the camera, enhancing 3D depth"
  // Constrained to ±0.3 X and ±0.2 Y
  const targetX = mouseNDC.x * 0.3;
  const targetY = mouseNDC.y * 0.18;
  // Exponential smoothing — slow drift, not snap
  const smooth = 1 - Math.pow(0.02, delta);
  camera.position.x += (targetX - camera.position.x) * smooth;

  // ── Y: blend parallax with focus-mode Y offset ─────────────────────────
  const focusY = isCameraFocused ? 0.3 : 0.0;
  const targetCameraY = focusY + targetY * 0.5; // halved Y so focus Y dominates
  camera.position.y += (targetCameraY - camera.position.y) * smooth;

  // ── Detect transition completion ───────────────────────────────────────
  if (isTransitioning) {
    const distToTarget = Math.abs(
      camera.position.z - theaterState.cameraTargetZ,
    );
    if (distToTarget < 0.05) isTransitioning = false;
  }
}
