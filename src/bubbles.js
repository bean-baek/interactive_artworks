import * as THREE from "three";
import { scene } from "./scene.js";

const BUBBLE_COUNT = 55;

// --- Textures ---
function createBubbleTexture() {
  const size = 128;
  const cvs = document.createElement("canvas");
  cvs.width = cvs.height = size;
  const ctx = cvs.getContext("2d");
  const cx = size / 2,
    cy = size / 2,
    r = size * 0.44;

  // Thin translucent rim
  const rim = ctx.createRadialGradient(cx, cy, r * 0.72, cx, cy, r);
  rim.addColorStop(0, "rgba(180, 215, 255, 0.0)");
  rim.addColorStop(0.5, "rgba(170, 210, 255, 0.18)");
  rim.addColorStop(0.5, "rgba(200, 230, 255, 0.55)");
  rim.addColorStop(1.0, "rgba(255, 255, 255, 0.0)");
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, size, size);

  // Top-left specular highlight
  const hl = ctx.createRadialGradient(
    cx - r * 0.3,
    cy - r * 0.35,
    0,
    cx - r * 0.25,
    cy - r * 0.3,
    r * 0.28,
  );
  hl.addColorStop(0, "rgba(255, 255, 255, 0.85)");
  hl.addColorStop(0.5, "rgba(224, 220, 255, 0.3)");
  hl.addColorStop(1, "rgba(255, 255, 255, 0.0)");
  ctx.fillStyle = hl;
  ctx.fillRect(0, 0, size, size);

  // Faint bottom-right secondary reflection
  const hl2 = ctx.createRadialGradient(
    cx + r * 0.25,
    cy + r * 0.3,
    0,
    cx + r * 0.25,
    cy + r * 0.3,
    r * 0.18,
  );
  hl2.addColorStop(0, "rgba(200, 230, 255, 0.35)");
  hl2.addColorStop(0.5, "rgba(246, 251, 255, 0)");
  ctx.fillStyle = hl2;
  ctx.fillRect(0, 0, size, size);

  return new THREE.CanvasTexture(cvs);
}

// Texture is created once and shared across all bubble materials
const bubbleTex = createBubbleTexture();

// --- Bubbles ---
// Each bubble is a Sprite; per-bubble state tracked alongside it.
// Each sprite needs its own SpriteMaterial because initial opacity varies per
// bubble. The shared texture keeps GPU memory usage flat; only the JS-side
// material objects are duplicated.
const bubbles = [];
// Collect materials for bulk disposal
const _bubbleMaterials = [];

for (let i = 0; i < BUBBLE_COUNT; i++) {
  const mat = new THREE.SpriteMaterial({
    map: bubbleTex,
    transparent: true,
    opacity: 0.04 + Math.random() * 0.08,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  _bubbleMaterials.push(mat);

  const sprite = new THREE.Sprite(mat);
  // Wide size range: tiny wisps up to large slow orbs
  const s = 0.008 + Math.pow(Math.random(), 2) * 0.55;
  sprite.scale.setScalar(s);

  // Spread initial positions so they don't all start at the bottom at once
  const x = (Math.random() - 0.5) * 20;
  const y = (Math.random() - 0.5) * 20; // random start across full height
  const z = -0.3 - Math.random() * 5; // wider depth spread
  sprite.position.set(x, y, z);

  scene.add(sprite);

  bubbles.push({
    sprite,
    speed: 0.06 + Math.random() * 0.14, // upward drift — slow, underwater
    driftFreq: 0.1 + Math.random() * 0.2, // primary X wobble frequency
    driftAmp: 0.08 + Math.random() * 0.25,
    driftFreq2: 0.05 + Math.random() * 0.12, // secondary harmonic for organic curve
    driftAmp2: 0.04 + Math.random() * 0.12,
    phase: Math.random() * Math.PI * 2,
    phase2: Math.random() * Math.PI * 2,
    zFreq: 0.04 + Math.random() * 0.08, // slow depth oscillation
    zAmp: 0.1 + Math.random() * 0.4,
    zPhase: Math.random() * Math.PI * 2,
    originX: x,
    originZ: z,
    resetY: -8,
    topY: 7.5,
  });
}

// --- Update (called every frame from animate.js) ---
export function updateBubbles(elapsed) {
  for (let i = 0; i < bubbles.length; i++) {
    const b = bubbles[i];
    const { sprite } = b;

    // Float upward
    sprite.position.y += b.speed * 0.06;

    // Two-harmonic horizontal sway for an organic, non-repeating path
    sprite.position.x =
      b.originX +
      Math.sin(elapsed * b.driftFreq + b.phase) * b.driftAmp +
      Math.sin(elapsed * b.driftFreq2 + b.phase2) * b.driftAmp2;

    // Slow depth drift — bubbles gently move toward/away from camera
    sprite.position.z =
      b.originZ + Math.sin(elapsed * b.zFreq + b.zPhase) * b.zAmp;

    // Reset below screen when bubble reaches the top
    if (sprite.position.y > b.topY) {
      sprite.position.y = b.resetY;
      const nx = (Math.random() - 0.5) * 16;
      sprite.position.x = nx;
      b.originX = nx;
      b.originZ = -0.3 - Math.random() * 5;
    }
  }
}

// --- Cleanup ---
export function disposeBubbles() {
  for (let i = 0; i < bubbles.length; i++) {
    scene.remove(bubbles[i].sprite);
  }
  // Dispose all per-bubble materials; shared texture disposed once after
  for (let i = 0; i < _bubbleMaterials.length; i++) {
    _bubbleMaterials[i].dispose();
  }
  bubbleTex.dispose();
}
