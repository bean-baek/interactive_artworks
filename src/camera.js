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

/** Exits focus mode and returns camera to global overview. */
export function unfocusCamera() {
  if (!isCameraFocused) return;
  isCameraFocused = false;
  isTransitioning = true;
  theaterState.cameraTargetZ = ZOOM_GLOBAL;
}
// ---------------------------------------------------------------------------
// Per-frame update — called from animate.js
// ---------------------------------------------------------------------------
export function updateCamera(delta) {
  if (!cameraActive) {
    // Phase 1 / 2: simple Z lerp toward theater target
    camera.position.z += (theaterState.cameraTargetZ - camera.position.z) * (1 - Math.pow(0.1, delta));
    return;
  }

  // ── 1. Parallax: 탑다운 뷰에 맞게 마우스 축 변경 ───────────────────
  // 이제 마우스를 위아래(Y)로 움직이면 카메라의 높이(Y)가 아니라 앞뒤(Z)가 움직여야 자연스럽습니다.
  const targetX = mouseNDC.x * 0.3;
  const targetZ_parallax = -mouseNDC.y * 0.3; // 마우스를 올리면 앞(Z축 -)으로 쏠림

  const smooth = 1 - Math.pow(0.02, delta);
  camera.position.x += (targetX - camera.position.x) * smooth;

  // ── 2. Zoom & Position: 비스듬한 얼짱 각도 내려다보기 ─────────────────────────
  // 기존에는 targetZ가 순수하게 Z축 거리였지만,
  // 탑다운 뷰에서는 Z(거리)와 Y(높이)를 비율로 나눠서 대각선 위에서 보게 만듭니다.
  const currentZoom = theaterState.cameraTargetZ; // 확대/축소 기준값 (3.5 ~ 10)

  // 수치를 조절해서 카메라 각도를 바꿀 수 있습니다. (Y가 클수록 더 정수리 위에서 봅니다)
  const targetY = currentZoom * 0.8; // 카메라 높이
  const targetZ = currentZoom * 0.5 + targetZ_parallax; // 카메라 앞뒤 거리 + 마우스 패럴랙스

  // 포커스 모드일 때 책 쪽으로 살짝 더 다가가기 위한 Y, Z 미세 보정
  const focusOffset = isCameraFocused ? -0.5 : 0.0;

  camera.position.y += (targetY + focusOffset - camera.position.y) * smooth;
  camera.position.z += (targetZ + focusOffset - camera.position.z) * smooth;

  // ── 3. ★ 핵심: 카메라 시선 바닥으로 고정 ─────────────────────────
  // 카메라가 허공을 보지 않고 무조건 스케치북 중심(대략 0, 0, 0)을 내려다보게 멱살을 잡습니다.
  camera.lookAt(0, 0, 0);

  // ── 4. Detect transition completion ───────────────────────────────────────
  if (isTransitioning) {
    const distToTarget = Math.abs(
      // 이제 Z뿐만 아니라 Y 높이도 변하므로, 전체적인 거리 변화량으로 체크하거나 기존 타겟을 활용합니다.
      camera.position.y / 0.8 - theaterState.cameraTargetZ,
    );
    if (distToTarget < 0.05) isTransitioning = false;
  }
}
