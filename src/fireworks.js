import * as THREE from "three";
import { scene } from "./scene.js";

const PARTICLES = 150;
const GRAVITY = 4.0;

// Burst palette — cycles per burst index
const PALETTE = [0x7b00d4, 0xff00ff, 0xe066ff, 0xffffff, 0xda70d6];

// --- Texture ---
function createFireworkTexture() {
  const size = 64;
  const cvs = document.createElement("canvas");
  cvs.width = cvs.height = size;
  const ctx = cvs.getContext("2d");
  const cx = size / 2, cy = size / 2;
  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
  grd.addColorStop(0.0, "rgba(255, 255, 255, 1.0)"); // white core
  grd.addColorStop(0.2, "rgba(224, 102, 255, 0.9)"); // lavender
  grd.addColorStop(0.5, "rgba(123,   0, 212, 0.6)"); // purple
  grd.addColorStop(0.8, "rgba( 50,   0, 100, 0.2)"); // deep violet
  grd.addColorStop(1.0, "rgba(  0,   0,   0, 0.0)"); // transparent
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(cvs);
}

const fireworkTexture = createFireworkTexture();

// --- State ---
const bursts = [];
const pendingBursts = [];
let fireworksTimer = 0;
let fireworksActive = false;

// --- Burst spawning ---
function spawnBurst(x, y, z, color) {
  const positions    = new Float32Array(PARTICLES * 3);
  const velocities   = new Float32Array(PARTICLES * 3);
  const lifetimes    = new Float32Array(PARTICLES);
  const maxLifetimes = new Float32Array(PARTICLES);

  for (let i = 0; i < PARTICLES; i++) {
    positions[i * 3]     = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // Hemispherical velocity — upper hemisphere only
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.random() * Math.PI * 0.5;
    const speed = 2.5 + Math.random() * 3.0;
    velocities[i * 3]     = Math.sin(phi) * Math.cos(theta) * speed;
    velocities[i * 3 + 1] = Math.cos(phi) * speed;
    velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;

    lifetimes[i] = maxLifetimes[i] = 1.2 + Math.random() * 0.8;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    map: fireworkTexture,
    color,
    size: 0.18,
    transparent: true,
    opacity: 1.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geo, mat);
  scene.add(points);

  bursts.push({ points, material: mat, positions, velocities, lifetimes, maxLifetimes });
}

// --- Public API ---

export function triggerFireworks() {
  fireworksActive = true;
  fireworksTimer = 0;
  pendingBursts.length = 0;

  const sequence = [
    { delay: 0.0, x:  0.0, y: 3.0, z: 0 },
    { delay: 0.4, x: -2.5, y: 2.0, z: 0 },
    { delay: 0.8, x:  2.5, y: 2.5, z: 0 },
    { delay: 1.2, x: -1.2, y: 4.2, z: 0 },
    { delay: 1.6, x:  1.8, y: 1.5, z: 0 },
  ];
  sequence.forEach((entry, i) => {
    pendingBursts.push({ ...entry, color: PALETTE[i % PALETTE.length] });
  });
}

export function updateFireworks(delta) {
  // Spawn queued bursts by delay
  if (fireworksActive && pendingBursts.length > 0) {
    fireworksTimer += delta;
    for (let i = pendingBursts.length - 1; i >= 0; i--) {
      if (fireworksTimer >= pendingBursts[i].delay) {
        const { x, y, z, color } = pendingBursts[i];
        spawnBurst(x, y, z, color);
        pendingBursts.splice(i, 1);
      }
    }
  }

  // Update active bursts
  for (let b = bursts.length - 1; b >= 0; b--) {
    const burst = bursts[b];
    let totalLife = 0;
    let aliveCount = 0;

    for (let i = 0; i < PARTICLES; i++) {
      if (burst.lifetimes[i] <= 0) continue;

      burst.lifetimes[i] -= delta;
      if (burst.lifetimes[i] <= 0) continue;

      aliveCount++;
      totalLife += burst.lifetimes[i];

      const i3 = i * 3;
      burst.velocities[i3 + 1] -= GRAVITY * delta;
      burst.positions[i3]      += burst.velocities[i3]     * delta;
      burst.positions[i3 + 1]  += burst.velocities[i3 + 1] * delta;
      burst.positions[i3 + 2]  += burst.velocities[i3 + 2] * delta;
    }

    burst.points.geometry.attributes.position.needsUpdate = true;

    // Fade opacity with remaining average lifetime
    const avgLife = aliveCount > 0 ? totalLife / aliveCount : 0;
    burst.material.opacity = Math.max(0, Math.min(1, avgLife / 1.5));

    // Clean up exhausted bursts
    if (aliveCount === 0) {
      scene.remove(burst.points);
      burst.points.geometry.dispose();
      burst.material.dispose();
      bursts.splice(b, 1);
    }
  }

  if (fireworksActive && pendingBursts.length === 0 && bursts.length === 0) {
    fireworksActive = false;
  }
}
