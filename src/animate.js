import * as THREE from "three";
import { renderer, scene, camera } from "./scene.js";
import { jellyfishContainer, jellyfishState } from "./jellyfish.js";
import { cursorTarget, interactionState } from "./interaction.js";
import { updateBubbles } from "./bubbles.js";
import { theaterState, fleeTarget, updateTheater } from "./theater.js";

// --- Spring constants ---
// Body lean (jiggle): reacts to frame-to-frame position delta
const STIFFNESS = 100;
const DAMPING = 8;

// Secondary hair wobble: follows body jiggle with its own lag
const HAIR_STIFFNESS = 200;
const HAIR_DAMPING = 6;

// Tentacle swing: reacts to raw cursor X velocity — slow settle, high amplitude
const TENT_SWING_STIFFNESS = 60;
const TENT_SWING_DAMPING = 5;

// --- Spring state ---
const jiggle = { rotX: 0, rotZ: 0, velX: 0, velZ: 0 };
const squishSpring = { val: 0, vel: 0 };
const hairJiggle = { rotX: 0, rotZ: 0, velX: 0, velZ: 0 };
const tentSwing = { rot: 0, vel: 0 };

// --- Position state ---
const jellyPos = new THREE.Vector3(0, 0, 0);
const tentPos = new THREE.Vector3(0, 0, 0);

// Reusable scratch vectors — allocated once, reused every frame to avoid GC pressure
const _prevJellyPos = new THREE.Vector3(0, 0, 0);
const _frameVel = new THREE.Vector3();
const _localLag = new THREE.Vector3();

let prevCursorX = 0;
let lastTime = performance.now();
let elapsed = 0;

export function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const delta = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  elapsed += delta;

  const { jellyfish, bellGroup, tentGroup, normalizedScale, mixer } =
    jellyfishState;

  if (jellyfish && jellyfishContainer) {
    // 1. Position lerp — cursor follow normally; flee to top-right on theater trigger
    const isFleeing = theaterState.fleeing || theaterState.done;
    const posTarget = isFleeing ? fleeTarget : cursorTarget;
    const followSpeed = isFleeing
      ? 1 - Math.pow(0.15, delta) // faster flee
      : 1 - Math.pow(0.6, delta); // normal slow drift
    _prevJellyPos.copy(jellyPos);
    jellyPos.lerp(posTarget, followSpeed);
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
      tentGroup.position.x = _localLag.x * 0.2;
      tentGroup.position.y = _localLag.y * 0.2;
    }

    // 3. Lean: spring toward movement direction
    const targetRotZ = -_frameVel.x * 10; // move right → lean right
    const targetRotX = _frameVel.y * 15; // move up → lean forward
    const fx = (targetRotZ - jiggle.rotZ) * STIFFNESS - jiggle.velZ * DAMPING;
    const fy = (targetRotX - jiggle.rotX) * STIFFNESS - jiggle.velX * DAMPING;
    jiggle.velZ += fx * delta * 0.5;
    jiggle.velX += fy * delta * 0.5;
    jiggle.rotZ += jiggle.velZ * delta * 0.5;
    jiggle.rotX += jiggle.velX * delta * 0.5;

    jellyfishContainer.rotation.x = jiggle.rotX;
    jellyfishContainer.rotation.z = jiggle.rotZ;

    // 4. Bulge + squish on movement
    const bulge = Math.sin(elapsed * 1.2);
    const speed = _frameVel.length();
    const squishTarget = Math.min(0.7, speed * 14);
    squishSpring.vel +=
      ((squishTarget - squishSpring.val) * 80 - squishSpring.vel * 10) * delta;
    squishSpring.val = Math.max(0, squishSpring.val + squishSpring.vel * delta);
    const squish = squishSpring.val;
    const baseScale = normalizedScale * interactionState.scrollScale;
    jellyfish.scale.set(
      baseScale * (1 + bulge * 0.1 + squish * -0.45),
      baseScale * (1 - bulge * 0.15 - squish * -0.38),
      baseScale * (1 + bulge * 0.1 + squish * -0.45),
    );
    jellyfish.rotation.set(0, elapsed * 0.5, 0);
    if (bellGroup) bellGroup.scale.x = 1 - bulge * 0.1;

    // Cursor X velocity (raw, per-frame)
    const cursorVelX = cursorTarget.x - prevCursorX;
    prevCursorX = cursorTarget.x;

    if (tentGroup) {
      tentGroup.scale.y = 1 + bulge * 0.3;

      // Hair jiggle: secondary wobble from body spring
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

  updateBubbles(elapsed);
  updateTheater(delta);

  if (mixer) mixer.update(delta);
  renderer.render(scene, camera);
}
