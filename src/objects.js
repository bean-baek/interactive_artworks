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
const REQUIRED_COUNT = 3; // 3 tine groups
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
// Build leaves — instanced particle system with CPU physics
// ---------------------------------------------------------------------------
const LEAF_COUNT = 4096; // instances (2^12 — CPU-friendly on WebGL)
const LEAF_SIZE = 14; // half-extent of spawn / wrap bounds (world units)
const LEAF_GRAVITY = 0.0025; // downward acceleration per frame
const LEAF_PUSH_R = 2.5; // cursor repulsion radius (world units)

// Physics state — flat Float32 arrays for cache efficiency
const _leafPos = new Float32Array(LEAF_COUNT * 3); // x,y,z per leaf
const _leafVel = new Float32Array(LEAF_COUNT * 3); // vx,vy,vz per leaf
const _leafScl = new Float32Array(LEAF_COUNT); // uniform scale per leaf

// Autumn colour palette: green-yellow (#c4c557) → orange (#f7782b)
const _cA = new THREE.Color(0xc4c557);
const _cB = new THREE.Color(0xf7782b);
const _cTmp = new THREE.Color();

/** PlaneGeometry skewed into a kite-like shape, rotated flat in the XZ plane. */
function _buildLeafGeo() {
  const g = new THREE.PlaneGeometry(1, 1);
  const p = g.attributes.position.array;
  // Skew: widen top edge (x += 0.15), narrow bottom edge (x -= 0.15)
  p[0] += 0.15;
  p[3] += 0.15; // top-left & top-right x
  p[6] -= 0.15;
  p[9] -= 0.15; // bottom-left & bottom-right x
  g.attributes.position.needsUpdate = true;
  g.computeVertexNormals();
  g.rotateX(-Math.PI * 0.5); // lay flat in XZ plane
  return g;
}

const _leafGeo = _buildLeafGeo();
const _leafMat = new THREE.MeshLambertMaterial({
  color: 0xffffff, // white base — instance colours multiply on top
  map: new THREE.TextureLoader().load("src/assets/texture/leaf.png"),
  transparent: true,
  opacity: 0,
  side: THREE.DoubleSide,
  depthWrite: false,
});

const leafMesh = new THREE.InstancedMesh(_leafGeo, _leafMat, LEAF_COUNT);
leafMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

const _leafDummy = new THREE.Object3D();
let _leavesReady = false;

// Ground plane for projecting the cursor ray to world space
const _leafGroundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _cursorOnGround = new THREE.Vector3();

function _initLeafParticles() {
  for (let i = 0; i < LEAF_COUNT; i++) {
    const b = i * 3;
    _leafPos[b] = (Math.random() * 2 - 1) * LEAF_SIZE;
    _leafPos[b + 1] = -0.5 + Math.random() * 0.2; // slight initial drop height
    _leafPos[b + 2] = (Math.random() * 2 - 1) * LEAF_SIZE;
    _leafVel[b] = _leafVel[b + 1] = _leafVel[b + 2] = 0;
    _leafScl[i] = Math.random() * 0.8 + 0.2; // 20%–100% of base size

    _cTmp.lerpColors(_cA, _cB, Math.random());
    leafMesh.setColorAt(i, _cTmp);

    _leafDummy.position.set(_leafPos[b], _leafPos[b + 1], _leafPos[b + 2]);
    _leafDummy.rotation.set(1, Math.random() * Math.PI * 2, 0);
    _leafDummy.scale.setScalar(_leafScl[i]);
    _leafDummy.updateMatrix();
    leafMesh.setMatrixAt(i, _leafDummy.matrix);
  }
  if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
  leafMesh.instanceMatrix.needsUpdate = true;
  scene.add(leafMesh);
  fadeMeshes.push(leafMesh);
  _leavesReady = true;
}

function _updateLeafParticles(delta, elapsed) {
  if (!_leavesReady) return;

  // Project last-known cursor ray onto y=0 ground plane
  raycaster.ray.intersectPlane(_leafGroundPlane, _cursorOnGround);

  const hs = LEAF_SIZE;

  for (let i = 0; i < LEAF_COUNT; i++) {
    const b = i * 3;
    let px = _leafPos[b],
      py = _leafPos[b + 1],
      pz = _leafPos[b + 2];
    let vx = _leafVel[b],
      vy = _leafVel[b + 1],
      vz = _leafVel[b + 2];

    // Cursor repulsion (XZ plane)
    const cdx = px - _cursorOnGround.x;
    const cdz = pz - _cursorOnGround.z;
    const cd2 = cdx * cdx + cdz * cdz;
    if (cd2 < LEAF_PUSH_R * LEAF_PUSH_R && cd2 > 0.0001) {
      const cd = Math.sqrt(cd2);
      const str = (1 - cd / LEAF_PUSH_R) * 0.04;
      vx += (cdx / cd) * str;
      vz += (cdz / cd) * str;
    }

    // Wind — layered sin/cos noise
    vx +=
      Math.sin(px * 0.28 + elapsed * 0.71) *
      Math.cos(pz * 0.19 + elapsed * 0.53) *
      0.0001;

    // Horizontal speed for lift calculation
    const spd = Math.sqrt(vx * vx + vz * vz);

    // Damping — high ground friction, low air resistance
    const damp = py < 0.01 ? 0.8 : 0.985;
    vx *= damp;
    vz *= damp;

    // Lift (fast-moving leaves rise) + gravity
    vy += spd * 0.015 - LEAF_GRAVITY;

    // Integrate position
    px += vx;
    py += vy;
    pz += vz;

    // Floor collision
    if (py < 0) {
      py = 0;
      vy = 0;
    }

    // Infinite-world wrapping
    if (px > hs) px -= hs * 2;
    if (px < -hs) px += hs * 2;
    if (pz > hs) pz -= hs * 2;
    if (pz < -hs) pz += hs * 2;

    _leafPos[b] = px;
    _leafPos[b + 1] = py;
    _leafPos[b + 2] = pz;
    _leafVel[b] = vx;
    _leafVel[b + 1] = vy;
    _leafVel[b + 2] = vz;

    // Instance matrix — spin only when airborne
    const airF = Math.min(py, 1);
    const baseRotation = i * 1.618;
    const spin = Math.sin(px * 0.8 + pz * 0.6 + elapsed * 0.4) * (Math.PI / 2);
    _leafDummy.position.set(px, py, pz);
    _leafDummy.rotation.set(0, baseRotation + spin * airF, 0);
    _leafDummy.scale.setScalar(_leafScl[i]);
    _leafDummy.updateMatrix();
    leafMesh.setMatrixAt(i, _leafDummy.matrix);
  }
  leafMesh.instanceMatrix.needsUpdate = true;
}

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

  // Spawn the leaf particle system
  _initLeafParticles();
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
  _updateLeafParticles(delta, elapsed);
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
