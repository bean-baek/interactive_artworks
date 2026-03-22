import * as THREE from "three";
import { scene } from "./scene.js";

const BUBBLE_COUNT = 55;
const SPARKLE_COUNT = 90;

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
  hl.addColorStop(0.5, "rgba(220, 240, 255, 0.3)");
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
  hl2.addColorStop(0.5, "rgba(200, 230, 255, 0.0)");
  ctx.fillStyle = hl2;
  ctx.fillRect(0, 0, size, size);

  return new THREE.CanvasTexture(cvs);
}

function createSparkleTexture() {
  const size = 128;
  const cvs = document.createElement("canvas");
  cvs.width = cvs.height = size;
  const ctx = cvs.getContext("2d");
  const cx = size / 2,
    cy = size / 2;
  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
  grd.addColorStop(0, "rgba(220, 240, 255, 1.0)");
  grd.addColorStop(0.5, "rgba(160, 211, 255, 0.24)");
  grd.addColorStop(1, "rgba(80, 140, 255, 0.0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(cvs);
}

const bubbleTex = createBubbleTexture();
const sparkleTex = createSparkleTexture();

// --- Bubbles ---
// Each bubble is a Sprite; per-bubble state tracked alongside it
const bubbles = [];

for (let i = 0; i < BUBBLE_COUNT; i++) {
  const mat = new THREE.SpriteMaterial({
    map: bubbleTex,
    transparent: true,
    opacity: 0.15 + Math.random() * 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  const s = 0.08 + Math.random() * 0.22;
  sprite.scale.setScalar(s);

  // Spread initial positions so they don't all start at the bottom at once
  const x = (Math.random() - 0.5) * 20;
  const y = (Math.random() - 0.5) * 20; // random start across full height
  const z = -0.5 - Math.random() * 2.5;
  sprite.position.set(x, y, z);

  scene.add(sprite);

  bubbles.push({
    sprite,
    speed: 0.3 + Math.random() * 0.7, // upward drift speed
    driftFreq: 0.4 + Math.random() * 0.5, // horizontal wobble frequency
    driftAmp: 0.15 + Math.random() * 0.5, // horizontal wobble amplitude
    phase: Math.random() * Math.PI * 2, // phase offset so they're desynchronised
    originX: x,
    resetY: -8,
    topY: 7.5,
  });
}

// --- Sparkles (Points — single draw call for all) ---
const sparklePositions = new Float32Array(SPARKLE_COUNT * 3);
const sparklePhases = new Float32Array(SPARKLE_COUNT); // per-sparkle twinkle offset

for (let i = 0; i < SPARKLE_COUNT; i++) {
  sparklePositions[i * 3 + 0] = (Math.random() - 0.5) * 100;
  sparklePositions[i * 3 + 1] = (Math.random() - 0.5) * 100;
  sparklePositions[i * 3 + 2] = -1.5 - Math.random() * 100;
  sparklePhases[i] = Math.random() * Math.PI * 2;
}

const sparkleGeo = new THREE.BufferGeometry();
sparkleGeo.setAttribute(
  "position",
  new THREE.BufferAttribute(sparklePositions, 3),
);

const sparkleMat = new THREE.PointsMaterial({
  map: sparkleTex,
  size: 10,
  sizeAttenuation: true,
  transparent: true,
  opacity: 500, // driven each frame via the per-sparkle average
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

const sparklePoints = new THREE.Points(sparkleGeo, sparkleMat);
scene.add(sparklePoints);

// --- Update (called every frame from animate.js) ---
export function updateBubbles(elapsed) {
  for (let i = 0; i < bubbles.length; i++) {
    const b = bubbles[i];
    const { sprite } = b;

    // Float upward
    sprite.position.y += b.speed * 0.005;

    // Gentle horizontal sway
    sprite.position.x =
      b.originX + Math.sin(elapsed * b.driftFreq + b.phase) * b.driftAmp;

    // Reset below screen when bubble reaches the top
    if (sprite.position.y > b.topY) {
      sprite.position.y = b.resetY;
      sprite.position.x = (Math.random() - 0.5) * 16;
      b.originX = sprite.position.x;
    }
  }

  // Twinkle sparkles: vary overall opacity with a slow composite wave
  // (single-material limitation — average of multiple frequencies gives organic feel)
  const t1 = Math.sin(elapsed * 0.7) * 0.5 + 0.5;
  const t2 = Math.sin(elapsed * 1.3 + 1.2) * 0.5 + 0.5;
  const t3 = Math.sin(elapsed * 2.1 + 2.4) * 0.5 + 0.5;
  sparkleMat.opacity = 0.04 + ((t1 + t2 + t3) / 3) * 0.14;
}
