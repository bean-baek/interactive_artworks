import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import "./style.css";
import modelUrl from "./models/jelfish_alembic.gltf?url";

// --- Renderer ---
const canvas = document.getElementById("bg");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

// --- Scene & Camera ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020813); // deep-sea background
scene.fog = new THREE.FogExp2(0x020813, 0.08);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.z = 8;

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0x0a1e3f, 2.0);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xaaccff, 1.5);
mainLight.position.set(5, 10, 5);
scene.add(mainLight);

const innerGlowLight = new THREE.PointLight(0x00ffff, 4.0, 15);
innerGlowLight.position.set(0, 1, 0);

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

const bellMaterial = new THREE.MeshPhysicalMaterial({
  map: createBellTexture(),
  transmission: 0.85,
  roughness: 0.1,
  color: new THREE.Color(0x99ccff),
  emissive: new THREE.Color(0x112266),
  emissiveIntensity: 0.3,
  transparent: true,
  side: THREE.DoubleSide,
});

const tentacleMaterial = new THREE.MeshPhysicalMaterial({
  map: createTentacleTexture(),
  transmission: 0.7,
  roughness: 0.15,
  color: new THREE.Color(0x77aaff),
  emissive: new THREE.Color(0x0a1a55),
  emissiveIntensity: 0.4,
  transparent: true,
  opacity: 0.8,
  side: THREE.DoubleSide,
});

// --- Scene state ---
let jellyfish = null;
let jellyfishContainer = new THREE.Group(); // parent group that cursor-follows; model is offset inside it
scene.add(jellyfishContainer);

let mixer = null;
let normalizedScale = 1;
let bellGroup = null;
let tentGroup = null;

// --- Load jellyfish ---
const loader = new GLTFLoader();
loader.load(modelUrl, (gltf) => {
  jellyfish = gltf.scene;

  const bellMeshes = [];
  let meshTent = null;
  let meshHair = null;

  jellyfish.traverse((child) => {
    if (!child.isMesh) return;
    if (
      child.name.includes("Connect") ||
      child.name.includes("EDGE") ||
      child.name.includes("Lathe")
    ) {
      child.material = bellMaterial;
      bellMeshes.push(child);
    } else {
      child.material = tentacleMaterial;
    }
    if (child.name === "TENT") meshTent = child;
    if (child.name === "Hair.1") meshHair = child;
  });

  jellyfish.add(innerGlowLight);

  if (bellMeshes.length > 0) {
    // Find bell's world center before grouping so rotation pivots on it
    const bellBoxPre = new THREE.Box3();
    bellMeshes.forEach((m) => bellBoxPre.expandByObject(m));
    const bellWorldCenter = bellBoxPre.getCenter(new THREE.Vector3());

    bellGroup = new THREE.Group();
    bellGroup.position.copy(bellWorldCenter); // group origin = bell center
    bellMeshes[0].parent.add(bellGroup);
    bellMeshes.forEach((m) => bellGroup.attach(m)); // children now relative to bell center
    bellGroup.rotation.z = 0.6; // corrects the model's exported orientation
  }

  if (meshTent && meshHair) {
    tentGroup = new THREE.Group();
    meshTent.parent.add(tentGroup);
    tentGroup.attach(meshTent);
    tentGroup.attach(meshHair);
  }

  // Scale from whole-model size
  const box = new THREE.Box3().setFromObject(jellyfish);
  const size = box.getSize(new THREE.Vector3());
  normalizedScale = 3 / Math.max(size.x, size.y, size.z);
  jellyfish.scale.setScalar(normalizedScale);

  // Center X/Z on the bell only — tentacles skew the whole-model center
  const bellBox = new THREE.Box3();
  bellMeshes.forEach((m) => bellBox.expandByObject(m));
  const bellCenter = bellBox.getCenter(new THREE.Vector3());

  jellyfish.position.set(
    -bellCenter.x * normalizedScale, // centered on bell X
    -box.max.y * normalizedScale, // bell top → container origin → cursor
    -bellCenter.z * normalizedScale, // centered on bell Z
  );

  jellyfishContainer.add(jellyfish);

  if (gltf.animations.length > 0) {
    mixer = new THREE.AnimationMixer(jellyfish);
    gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
  }
});

// --- Cursor tracking ---
const cursorTarget = new THREE.Vector3(0, 0, 0);
const jellyPos = new THREE.Vector3(0, 0, 0);
const tentPos = new THREE.Vector3(0, 0, 0);

// Reusable scratch vectors — allocated once, reused every frame to avoid GC pressure
const _prevJellyPos = new THREE.Vector3(0, 0, 0);
const _frameVel = new THREE.Vector3();
const _localLag = new THREE.Vector3();

const raycaster = new THREE.Raycaster();
const cursorPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const mouse2D = new THREE.Vector2();

window.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse2D.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse2D.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse2D, camera);
  raycaster.ray.intersectPlane(cursorPlane, cursorTarget);
});

// --- Spring constants ---
// Body lean (jiggle): reacts to frame-to-frame position delta
const STIFFNESS = 120;
const DAMPING = 8;

// Secondary hair wobble: follows body jiggle with its own lag
const HAIR_STIFFNESS = 200;
const HAIR_DAMPING = 6;

// Tentacle swing: reacts to raw cursor X velocity — slow settle, high amplitude
const TENT_SWING_STIFFNESS = 60;
const TENT_SWING_DAMPING = 5;

// --- Jiggle spring state ---
const jiggle = { rotX: 0, rotZ: 0, velX: 0, velZ: 0 };
const hairJiggle = { rotX: 0, rotZ: 0, velX: 0, velZ: 0 };
const tentSwing = { rot: 0, vel: 0 };

// Track raw cursor X velocity each frame
let prevCursorX = 0;

// --- Scroll: scale multiplier ---
let scrollScale = 1;
window.addEventListener(
  "wheel",
  (e) => {
    scrollScale *= e.deltaY > 0 ? 0.95 : 1.05;
    scrollScale = Math.max(0.2, Math.min(4, scrollScale));
  },
  { passive: true },
);

// --- Animation loop ---
let lastTime = performance.now();
let elapsed = 0;

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const delta = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  elapsed += delta;

  if (jellyfish && jellyfishContainer) {
    // 1. Position lerp — slow drift like a real jellyfish (~2% per frame at 60fps)
    const followSpeed = 1 - Math.pow(0.18, delta);
    _prevJellyPos.copy(jellyPos);
    jellyPos.lerp(cursorTarget, followSpeed);
    _frameVel.subVectors(jellyPos, _prevJellyPos);

    jellyfishContainer.position.copy(jellyPos);
    jellyfishContainer.position.y += Math.sin(elapsed * 0.8) * 0.15; // gentle slow bob

    // 2. Tentacle lag — tentacles follow even slower
    const tentLag = 1 - Math.pow(0.04, delta);
    tentPos.lerp(jellyPos, tentLag);
    if (tentGroup) {
      _localLag
        .subVectors(tentPos, jellyPos)
        .divideScalar(normalizedScale || 1);
      tentGroup.position.x = _localLag.x * 0.5;
      tentGroup.position.y = _localLag.y * 0.5;
    }

    // 3. Lean: spring toward movement direction
    const targetRotZ = -_frameVel.x * 10; // move right → lean right
    const targetRotX = _frameVel.y * 5;   // move up → lean forward
    const fx = (targetRotZ - jiggle.rotZ) * STIFFNESS - jiggle.velZ * DAMPING;
    const fy = (targetRotX - jiggle.rotX) * STIFFNESS - jiggle.velX * DAMPING;
    jiggle.velZ += fx * delta;
    jiggle.velX += fy * delta;
    jiggle.rotZ += jiggle.velZ * delta;
    jiggle.rotX += jiggle.velX * delta;

    jellyfishContainer.rotation.x = jiggle.rotX;
    jellyfishContainer.rotation.z = jiggle.rotZ;

    // 4. Bulge + squish on movement
    const bulge = Math.sin(elapsed * 1.2);
    const speed = _frameVel.length();
    const squish = Math.max(0, Math.min(0.4, speed * 10));
    const baseScale = normalizedScale * scrollScale;
    jellyfish.scale.set(
      baseScale * (1 + bulge * 0.1 + squish * 0.3),
      baseScale * (1 - bulge * 0.15 - squish * 0.25),
      baseScale * (1 + bulge * 0.1 + squish * 0.3),
    );
    jellyfish.rotation.set(0, elapsed * 0.5, 0);
    if (bellGroup) bellGroup.scale.x = 1 - bulge * 0.1; // Bell squish (independent of tentacles)

    // Cursor X velocity (raw, per-frame)
    const cursorVelX = cursorTarget.x - prevCursorX;
    prevCursorX = cursorTarget.x;

    if (tentGroup) {
      tentGroup.scale.y = 1 + bulge * 0.3;

      // Hairjiggle: secondary wobble from body spring
      const hfx =
        (jiggle.rotX - hairJiggle.rotX) * HAIR_STIFFNESS -
        hairJiggle.velX * HAIR_DAMPING;
      const hfz =
        (jiggle.rotZ - hairJiggle.rotZ) * HAIR_STIFFNESS -
        hairJiggle.velZ * HAIR_DAMPING;
      hairJiggle.velX += hfx * delta;
      hairJiggle.velZ += hfz * delta;
      hairJiggle.rotX += hairJiggle.velX * delta;
      hairJiggle.rotZ += hairJiggle.velZ * delta;

      // Cursor-X swing spring: tent/hair rotate on Z following horizontal movement
      const swingTarget = -cursorVelX * 60;
      const swingForce =
        (swingTarget - tentSwing.rot) * TENT_SWING_STIFFNESS -
        tentSwing.vel * TENT_SWING_DAMPING;
      tentSwing.vel += swingForce * delta;
      tentSwing.rot += tentSwing.vel * delta;

      tentGroup.rotation.y = Math.sin(elapsed * 1.5) * 0.2;
      tentGroup.rotation.x = hairJiggle.rotX + Math.sin(elapsed * 3) * 0.1;
      tentGroup.rotation.z = hairJiggle.rotZ + tentSwing.rot;
    }
  }

  if (mixer) mixer.update(delta);
  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
