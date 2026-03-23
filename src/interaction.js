import * as THREE from "three";
import { scene, camera, canvas } from "./scene.js";
import { createCursorTexture } from "./materials.js";
import { jellyfishContainer } from "./jellyfish.js";

// --- Cursor tracking ---
export const cursorTarget = new THREE.Vector3(0, 0, 0);
export const interactionState = { scrollScale: 1 };
export const hoverState = { isHovering: false };

const raycaster = new THREE.Raycaster();
const cursorPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const mouse2D = new THREE.Vector2();

window.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse2D.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse2D.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse2D, camera);
  raycaster.ray.intersectPlane(cursorPlane, cursorTarget);
  cursorGlowGroup.position.copy(cursorTarget);

  // Jellyfish hover detection
  const hits = raycaster.intersectObject(jellyfishContainer, true);
  const wasHovering = hoverState.isHovering;
  hoverState.isHovering = hits.length > 0 && jellyfishContainer.visible;
  if (hoverState.isHovering !== wasHovering) {
    document.body.style.cursor = hoverState.isHovering ? "pointer" : "default";
  }
});

window.addEventListener(
  "wheel",
  (e) => {
    interactionState.scrollScale *= e.deltaY > 0 ? 0.95 : 1.05;
    interactionState.scrollScale = Math.max(
      0.2,
      Math.min(4, interactionState.scrollScale),
    );
  },
  { passive: true },
);

// --- Cursor Glow ---
export const cursorGlowGroup = new THREE.Group();
scene.add(cursorGlowGroup);

const cursorSpriteMat = new THREE.SpriteMaterial({
  map: createCursorTexture(),
  color: 0xffffff,
  transparent: true,
  opacity: 0.8,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

const cursorSprite = new THREE.Sprite(cursorSpriteMat);
cursorSprite.scale.set(0.8, 0.8, 1.0);
cursorGlowGroup.add(cursorSprite);

const cursorLight = new THREE.PointLight(0x88ccff, 2.0, 5.0);
cursorGlowGroup.add(cursorLight);
