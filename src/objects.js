import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { scene, camera } from "./scene.js";
import { theaterState } from "./theater.js";
import { jellyfishContainer } from "./jellyfish.js";
import { triggerFireworks } from "./fireworks.js";
import { fadeBubbles } from "./bubbles.js";
import { playObjectSound, stopObjectSound, fadeInLaughter } from "./audio.js";
import { activateSketchbook } from "./sketchbook.js";
import { activateCameraController } from "./camera.js";

// Phase 3 atmosphere targets
const _bgPhase1 = new THREE.Color(0x020813);
const _bgPhase3 = new THREE.Color(0xf5efe0);
const _fogPhase1 = new THREE.Color(0xffffff);
const _fogPhase3 = new THREE.Color(0xe8dcc8);
let atmosphereT = 0;

// ---------------------------------------------------------------------------
// Progress tracking
// ---------------------------------------------------------------------------
const REQUIRED_COUNT = 6; // 3 tine groups + 3 leaves
const clicked = new Set();

// Per-mesh hover state (0 → 1)
const hoverT = new Map();

// ---------------------------------------------------------------------------
// Phase state
// ---------------------------------------------------------------------------
let videoEntered = false;
let objectsActive = false;
let fadeInProgress = 0;

// ---------------------------------------------------------------------------
// Mesh collections
// ---------------------------------------------------------------------------
const interactiveMeshes = [];
const fadeMeshes = []; // all meshes (tines + body + leaves) to fade in/out

// ---------------------------------------------------------------------------
// Raycasting
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const mouse2D = new THREE.Vector2();
let hoveredMesh = null;

function getNDC(clientX, clientY) {
  mouse2D.x = (clientX / window.innerWidth) * 2 - 1;
  mouse2D.y = -(clientY / window.innerHeight) * 2 + 1;
}

window.addEventListener("mousemove", (e) => {
  if (!objectsActive) return;
  getNDC(e.clientX, e.clientY);
  raycaster.setFromCamera(mouse2D, camera);
  const hits = raycaster.intersectObjects(interactiveMeshes, false);
  hoveredMesh = hits.length > 0 ? hits[0].object : null;
});

window.addEventListener("mousedown", (e) => {
  if (!objectsActive) return;
  getNDC(e.clientX, e.clientY);
  raycaster.setFromCamera(mouse2D, camera);
  const hits = raycaster.intersectObjects(interactiveMeshes, false);
  if (hits.length > 0) onObjectClicked(hits[0].object);
});

// ---------------------------------------------------------------------------
// Load GLTF kalimba
// ---------------------------------------------------------------------------
const kalimbaRoot = new THREE.Group();
// Position to match the old procedural kalimba placement
kalimbaRoot.position.set(0, -2.8, 1.5);
// Scale up: the GLTF model is ~0.13m wide in real-world units
kalimbaRoot.scale.setScalar(10);
scene.add(kalimbaRoot);

const loader = new GLTFLoader();
loader.load(
  "src/models/kalimba.gltf",
  (gltf) => {
    kalimbaRoot.add(gltf.scene);

    // The 3 chrome tine mesh nodes — these are the playable keys
    ["Object_6", "Object_7", "Object_8"].forEach((name, i) => {
      const node = gltf.scene.getObjectByName(name);
      if (!node) return;

      // Replace material to support emissive hover glow and opacity fade-in
      node.material = new THREE.MeshPhysicalMaterial({
        color: 0xb0a898,
        metalness: 0.85,
        roughness: 0.2,
        transparent: true,
        opacity: 0,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0,
      });

      node.userData.id = `tine-${i}`;
      hoverT.set(node, 0);
      interactiveMeshes.push(node);
      fadeMeshes.push(node);
    });

    // Body mesh — visual only, not interactive
    const body = gltf.scene.getObjectByName("Object_4");
    if (body) {
      body.material = new THREE.MeshPhysicalMaterial({
        color: 0x8b6340,
        metalness: 0.0,
        roughness: 0.75,
        transparent: true,
        opacity: 0,
      });
      fadeMeshes.push(body);
    }
  },
  undefined,
  (err) =>
    console.warn(
      "kalimba.gltf failed to load — add scene.bin and textures/ to src/models/:",
      err,
    ),
);

// ---------------------------------------------------------------------------
// Build leaves
// ---------------------------------------------------------------------------
const LEAF_DEFS = [
  { w: 0.45, h: 0.7, x: -2.8, y: -1.6, z: 0.8, ry: 0.3, rz: 0.4 },
  { w: 0.55, h: 0.85, x: 2.6, y: -1.2, z: 0.5, ry: -0.5, rz: -0.3 },
  { w: 0.35, h: 0.55, x: -2.0, y: -2.2, z: 1.2, ry: 0.7, rz: 0.6 },
];

LEAF_DEFS.forEach((def, i) => {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x2a7a3b,
    metalness: 0.05,
    roughness: 0.7,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(def.w, def.h), mat);
  mesh.position.set(def.x, def.y, def.z);
  mesh.rotation.y = def.ry;
  mesh.rotation.z = def.rz;
  mesh.userData.id = `leaf-${i}`;
  hoverT.set(mesh, 0);
  scene.add(mesh);
  interactiveMeshes.push(mesh);
  fadeMeshes.push(mesh);
});

// ---------------------------------------------------------------------------
// Interaction
// ---------------------------------------------------------------------------
function onObjectClicked(mesh) {
  if (clicked.has(mesh.userData.id)) {
    stopObjectSound(mesh);
    return;
  }
  clicked.add(mesh.userData.id);

  // Permanent purple glow to mark as collected
  mesh.material.emissive = new THREE.Color(0x9b30ff);
  mesh.material.emissiveIntensity = 0.5;

  playObjectSound(mesh);

  if (clicked.size === REQUIRED_COUNT) {
    triggerFireworks();
    fadeInLaughter();
  }
}

// ---------------------------------------------------------------------------
// Phase activation
// ---------------------------------------------------------------------------
let jellyFadeProgress = 0;
let jellyFadeMeshes = null;

function activateObjects() {
  objectsActive = true;
  fadeInProgress = 0;

  // Fade out bubbles — jellyfish is leaving, underwater atmosphere ends
  fadeBubbles();

  // Activate 3D sketchbook book slider + camera controller
  activateSketchbook();
  activateCameraController();

  // Add warm ambient light for parchment atmosphere
  const warmLight = new THREE.PointLight(0xffb347, 4.0, 30);
  warmLight.position.set(0, 6, 4);
  scene.add(warmLight);

  // Fade out the jellyfish as the kalimba takes over
  jellyFadeMeshes = [];
  jellyfishContainer.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material.userData.baseOpacity = child.material.opacity;
      jellyFadeMeshes.push(child);
    }
  });
  jellyFadeProgress = 0;
}

// Video-ended trigger
const _video = document.querySelector("#video-container video");
const _videoContainer = document.getElementById("video-container");

if (_video) {
  _video.addEventListener("ended", () => {
    if (theaterState.returning || (!theaterState.done && !theaterState.fleeing))
      return;
    _video.pause();
    _videoContainer.classList.remove("theater-active");
    jellyfishContainer.visible = true;
    theaterState.fleeing = false;
    theaterState.done = false;
    theaterState.returning = true;
    theaterState.returnProgress = 0;
  });
}

// ---------------------------------------------------------------------------
// Per-frame update (called from animate.js)
// ---------------------------------------------------------------------------
export function updateObjects(delta, elapsed) {
  // Track when user first enters video mode
  if (!videoEntered && theaterState.done) {
    videoEntered = true;
  }

  // Activate once the return-to-jellyfish animation completes
  if (
    videoEntered &&
    !objectsActive &&
    !theaterState.returning &&
    !theaterState.done &&
    !theaterState.fleeing
  ) {
    activateObjects();
  }

  // Fade out jellyfish (~1s) then hide it
  if (jellyFadeMeshes) {
    jellyFadeProgress = Math.min(1, jellyFadeProgress + delta);
    const t = 1 - jellyFadeProgress * jellyFadeProgress;
    for (const child of jellyFadeMeshes) {
      const base = child.material.userData.baseOpacity ?? 1;
      child.material.opacity = base * t;
    }
    if (jellyFadeProgress >= 1) {
      jellyfishContainer.visible = false;
      jellyFadeMeshes = null;
    }
  }

  if (!objectsActive) return;

  // Lerp scene atmosphere toward warm parchment (~3s)
  if (atmosphereT < 1) {
    atmosphereT = Math.min(1, atmosphereT + delta * 0.33);
    const t = atmosphereT * atmosphereT * (3 - 2 * atmosphereT); // smoothstep
    scene.background.lerpColors(_bgPhase1, _bgPhase3, t);
    scene.fog.color.lerpColors(_fogPhase1, _fogPhase3, t);
  }

  // Fade in all meshes over ~2s
  if (fadeInProgress < 1) {
    fadeInProgress = Math.min(1, fadeInProgress + delta * 0.5);
    const t = fadeInProgress * fadeInProgress; // easeIn
    for (const mesh of fadeMeshes) {
      if (!clicked.has(mesh.userData.id)) {
        mesh.material.opacity = t;
      }
    }
  }

  // Hover glow — smooth lerp per mesh
  for (const mesh of interactiveMeshes) {
    const isHovered = mesh === hoveredMesh && !clicked.has(mesh.userData.id);
    const target = isHovered ? 1 : 0;
    const current = hoverT.get(mesh);
    const next = current + (target - current) * (1 - Math.pow(0.001, delta));
    hoverT.set(mesh, next);
    if (!clicked.has(mesh.userData.id)) {
      mesh.material.emissiveIntensity = next * 0.6;
      if (!mesh.material.emissive || mesh.material.emissive.getHex() === 0) {
        mesh.material.emissive = new THREE.Color(0x7b00d4);
      }
    }
  }

  // Idle: gentle slow sway on the kalimba root
  kalimbaRoot.rotation.y = Math.sin(elapsed * 0.35) * 0.06;
}
