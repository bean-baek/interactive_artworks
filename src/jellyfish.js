import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import modelUrl from "./models/jelfish_alembic.gltf?url";
import { scene, innerGlowLight } from "./scene.js";
import { bellMaterial, tentacleMaterial } from "./materials.js";

// ---------------------------------------------------------------------------
// Spring constants
// ---------------------------------------------------------------------------
const STIFFNESS            = 100;
const DAMPING              = 8;
const HAIR_STIFFNESS       = 200;
const HAIR_DAMPING         = 6;
const TENT_SWING_STIFFNESS = 60;
const TENT_SWING_DAMPING   = 5;

// Spring state
const jiggle      = { rotX: 0, rotZ: 0, velX: 0, velZ: 0 };
const squishSpring = { val: 0, vel: 0 };
const hairJiggle  = { rotX: 0, rotZ: 0, velX: 0, velZ: 0 };
const tentSwing   = { rot: 0, vel: 0 };

// Position trackers
const jellyPos = new THREE.Vector3(0, 0, 0);
const tentPos  = new THREE.Vector3(0, 0, 0);

// Reusable scratch vectors
const _prevJellyPos = new THREE.Vector3(0, 0, 0);
const _frameVel     = new THREE.Vector3();
const _localLag     = new THREE.Vector3();

let prevCursorX = 0;

export const jellyfishContainer = new THREE.Group();
scene.add(jellyfishContainer);

// Mutable state — animate.js reads these by reference via the exported object
export const jellyfishState = {
  jellyfish: null,
  bellGroup: null,
  tentGroup: null,
  normalizedScale: 1,
  mixer: null,
};

const loader = new GLTFLoader();
loader.load(modelUrl, (gltf) => {
  const jellyfish = gltf.scene;
  jellyfishState.jellyfish = jellyfish;

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
    const bellBoxPre = new THREE.Box3();
    bellMeshes.forEach((m) => bellBoxPre.expandByObject(m));
    const bellWorldCenter = bellBoxPre.getCenter(new THREE.Vector3());

    const bellGroup = new THREE.Group();
    bellGroup.position.copy(bellWorldCenter);
    bellMeshes[0].parent.add(bellGroup);
    bellMeshes.forEach((m) => bellGroup.attach(m));
    bellGroup.rotation.z = 0.6;
    jellyfishState.bellGroup = bellGroup;
  }

  if (meshTent && meshHair) {
    const tentGroup = new THREE.Group();
    meshTent.parent.add(tentGroup);
    tentGroup.attach(meshTent);
    tentGroup.attach(meshHair);
    jellyfishState.tentGroup = tentGroup;
  }

  const box = new THREE.Box3().setFromObject(jellyfish);
  const size = box.getSize(new THREE.Vector3());
  const normalizedScale = 3 / Math.max(size.x, size.y, size.z);
  jellyfishState.normalizedScale = normalizedScale;
  jellyfish.scale.setScalar(normalizedScale);

  const bellBox = new THREE.Box3();
  bellMeshes.forEach((m) => bellBox.expandByObject(m));
  const bellCenter = bellBox.getCenter(new THREE.Vector3());

  jellyfish.position.set(
    -bellCenter.x * normalizedScale,
    -box.max.y * normalizedScale,
    -bellCenter.z * normalizedScale,
  );

  jellyfishContainer.add(jellyfish);

  if (gltf.animations.length > 0) {
    jellyfishState.mixer = new THREE.AnimationMixer(jellyfish);
    gltf.animations.forEach((clip) =>
      jellyfishState.mixer.clipAction(clip).play(),
    );
  }
});

// ---------------------------------------------------------------------------
// Per-frame update — called from animate.js
// Receives external state as params to avoid circular imports
// (interaction.js and theater.js both import jellyfishContainer from here)
// ---------------------------------------------------------------------------
export function updateJellyfish(delta, elapsed, cursorTarget, interactionState, hoverState, theaterState, fleeTarget) {
  const { jellyfish, bellGroup, tentGroup, normalizedScale, mixer } = jellyfishState;
  if (!jellyfish) return;

  if (mixer) mixer.update(delta);

  if (jellyfishContainer.visible) {
    let activeTarget = cursorTarget;
    let currentSpeed = 1 - Math.pow(0.65, delta);

    if (theaterState.fleeing) {
      activeTarget = fleeTarget;
      currentSpeed = 1 - Math.pow(0.6, delta);
    }

    _prevJellyPos.copy(jellyPos);
    jellyPos.lerp(activeTarget, currentSpeed);
    _frameVel.subVectors(jellyPos, _prevJellyPos);

    jellyfishContainer.position.copy(jellyPos);
    jellyfishContainer.position.y += Math.sin(elapsed * 0.8) * 0.15;

    const tentLag = 1 - Math.pow(0.04, delta);
    tentPos.lerp(jellyPos, tentLag);
    if (tentGroup) {
      _localLag.subVectors(tentPos, jellyPos).divideScalar(normalizedScale || 1);
      tentGroup.position.x = _localLag.x * 0.2;
      tentGroup.position.y = _localLag.y * 0.2;
    }

    const targetRotZ = -_frameVel.x * 10;
    const targetRotX =  _frameVel.y * 15;
    const fx = (targetRotZ - jiggle.rotZ) * STIFFNESS - jiggle.velZ * DAMPING;
    const fy = (targetRotX - jiggle.rotX) * STIFFNESS - jiggle.velX * DAMPING;
    jiggle.velZ += fx * delta * 0.5;
    jiggle.velX += fy * delta * 0.5;
    jiggle.rotZ += jiggle.velZ * delta * 0.5;
    jiggle.rotX += jiggle.velX * delta * 0.5;

    jellyfishContainer.rotation.x = jiggle.rotX;
    jellyfishContainer.rotation.z = jiggle.rotZ;

    const bulge = Math.sin(elapsed * 1.2);
    const speed = _frameVel.length();
    const squishTarget = Math.min(0.7, speed * 14);
    squishSpring.vel += ((squishTarget - squishSpring.val) * 80 - squishSpring.vel * 10) * delta;
    squishSpring.val  = Math.max(0, squishSpring.val + squishSpring.vel * delta);
    const squish    = squishSpring.val;
    const baseScale = normalizedScale * interactionState.scrollScale;
    jellyfish.scale.set(
      baseScale * (1 + bulge * 0.1  + squish * -0.45),
      baseScale * (1 - bulge * 0.15 - squish * -0.38),
      baseScale * (1 + bulge * 0.1  + squish * -0.45),
    );
    jellyfish.rotation.set(0, elapsed * 0.5, 0);
    if (bellGroup) bellGroup.scale.x = 1 - bulge * 0.1;

    const cursorVelX = cursorTarget.x - prevCursorX;
    prevCursorX = cursorTarget.x;

    if (tentGroup) {
      tentGroup.scale.y = 1 + bulge * 0.3;

      const hfx = (jiggle.rotX - hairJiggle.rotX) * HAIR_STIFFNESS - hairJiggle.velX * HAIR_DAMPING;
      const hfz = (jiggle.rotZ - hairJiggle.rotZ) * HAIR_STIFFNESS - hairJiggle.velZ * HAIR_DAMPING;
      hairJiggle.velX += hfx * delta;
      hairJiggle.velZ += hfz * delta;
      hairJiggle.rotX += hairJiggle.velX * delta;
      hairJiggle.rotZ += hairJiggle.velZ * delta;

      const swingTarget = -cursorVelX * 60;
      const swingForce  = (swingTarget - tentSwing.rot) * TENT_SWING_STIFFNESS - tentSwing.vel * TENT_SWING_DAMPING;
      tentSwing.vel += swingForce * delta;
      tentSwing.rot += tentSwing.vel * delta;

      tentGroup.rotation.y = Math.sin(elapsed * 1.5) * 0.2;
      tentGroup.rotation.x = hairJiggle.rotX + Math.sin(elapsed * 3) * 0.1;
      tentGroup.rotation.z = hairJiggle.rotZ + tentSwing.rot;
    }

    // Emissive hover glow
    const smooth = 1 - Math.pow(0.05, delta);
    bellMaterial.emissiveIntensity     += ((hoverState.isHovering ? 1.6 : 0.3) - bellMaterial.emissiveIntensity)     * smooth;
    tentacleMaterial.emissiveIntensity += ((hoverState.isHovering ? 1.8 : 0.4) - tentacleMaterial.emissiveIntensity) * smooth;
  }
}
