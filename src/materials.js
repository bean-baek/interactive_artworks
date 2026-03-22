import * as THREE from "three";

// --- Procedural Textures ---
function createBellTexture() {
  const size = 512;
  const cvs = document.createElement("canvas");
  cvs.width = cvs.height = size;
  const ctx = cvs.getContext("2d");
  const cx = size / 2,
    cy = size / 2;
  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
  bg.addColorStop(0, "rgba(210, 235, 255, 1.0)");
  bg.addColorStop(0.5, "rgba(130, 180, 255, 0.85)");
  bg.addColorStop(1, "rgba(60, 90, 220, 0.3)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(cvs);
}

function createTentacleTexture() {
  const w = 64,
    h = 512;
  const cvs = document.createElement("canvas");
  cvs.width = w;
  cvs.height = h;
  const ctx = cvs.getContext("2d");
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "rgba(160, 210, 255, 0.95)");
  bg.addColorStop(1, "rgba(60, 90, 220, 0)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  return new THREE.CanvasTexture(cvs);
}

export function createCursorTexture() {
  const size = 128;
  const cvs = document.createElement("canvas");
  cvs.width = cvs.height = size;
  const ctx = cvs.getContext("2d");
  const cx = size / 2,
    cy = size / 2;
  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
  grd.addColorStop(0, "rgba(180, 220, 255, 1.0)");
  grd.addColorStop(0.4, "rgba(100, 180, 255, 0.6)");
  grd.addColorStop(1, "rgba(60, 120, 220, 0.0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(cvs);
}

// --- Materials ---
export const bellMaterial = new THREE.MeshPhysicalMaterial({
  map: createBellTexture(),
  transmission: 0.85,
  roughness: 0.1,
  color: new THREE.Color(0x99ccff),
  emissive: new THREE.Color(0x112266),
  emissiveIntensity: 0.3,
  transparent: true,
  side: THREE.DoubleSide,
  reflectivity: 200,
});

export const tentacleMaterial = new THREE.MeshPhysicalMaterial({
  map: createTentacleTexture(),
  transmission: 0.7,
  roughness: 0.15,
  color: new THREE.Color(0x77aaff),
  emissive: new THREE.Color(0x0a1a55),
  emissiveIntensity: 0.4,
  transparent: true,
  opacity: 0.8,
  reflectivity: 900,
});
