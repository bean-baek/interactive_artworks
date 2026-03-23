import * as THREE from "three";
import { camera } from "./scene.js";

const listener = new THREE.AudioListener();
camera.add(listener);

// Resume AudioContext on first user gesture (browser policy)
function resumeContext() {
  if (listener.context.state === "suspended") {
    listener.context.resume();
  }
  window.removeEventListener("click", resumeContext);
}
window.addEventListener("click", resumeContext);

const audioLoader = new THREE.AudioLoader();

// Loaded buffers keyed by object id: 'tine-0'..'tine-7', 'leaf', 'laugh'
const buffers = {};

// Laughter fade-in state
let laughSound = null;
let laughFading = false;
let laughVolume = 0;
const LAUGH_FADE_DURATION = 4.0;

// --- Public API ---

export function initAudio() {
  // Kalimba tines — one sound per key
  for (let i = 0; i < 8; i++) {
    audioLoader.load(
      `src/assets/audio/kalimba-${i + 1}.mp3`,
      (buf) => { buffers[`tine-${i}`] = buf; },
      undefined,
      () => console.warn(`Audio placeholder not found: kalimba-${i + 1}.mp3`),
    );
  }

  // Leaves share one rustle sound
  audioLoader.load(
    "src/assets/audio/leaf-rustle.mp3",
    (buf) => { buffers["leaf"] = buf; },
    undefined,
    () => console.warn("Audio placeholder not found: leaf-rustle.mp3"),
  );

  // Children laughing — fades in on completion
  audioLoader.load(
    "src/assets/audio/children-laugh.mp3",
    (buf) => { buffers["laugh"] = buf; },
    undefined,
    () => console.warn("Audio placeholder not found: children-laugh.mp3"),
  );
}

const activeSounds = new Map();

export function playObjectSound(mesh) {
  const id = mesh.userData.id;
  const bufKey = id.startsWith("leaf") ? "leaf" : id;
  const buf = buffers[bufKey];
  if (!buf) return;

  const sound = new THREE.PositionalAudio(listener);
  sound.setBuffer(buf);
  sound.setRefDistance(3);
  sound.setVolume(1.0);
  mesh.add(sound);
  activeSounds.set(mesh, sound);
  sound.play();
  sound.onEnded = () => {
    mesh.remove(sound);
    sound.disconnect();
    activeSounds.delete(mesh);
  };
}

export function stopObjectSound(mesh) {
  const sound = activeSounds.get(mesh);
  if (!sound) return;
  if (sound.isPlaying) sound.stop();
  mesh.remove(sound);
  sound.disconnect();
  activeSounds.delete(mesh);
}

export function fadeInLaughter() {
  if (laughFading || (laughSound && laughSound.isPlaying)) return;
  const buf = buffers["laugh"];
  if (!buf) return;

  laughSound = new THREE.Audio(listener);
  laughSound.setBuffer(buf);
  laughSound.setLoop(true);
  laughSound.setVolume(0);
  laughSound.play();
  laughFading = true;
  laughVolume = 0;
}

export function updateAudio(delta) {
  if (laughFading && laughSound) {
    laughVolume = Math.min(1.0, laughVolume + delta / LAUGH_FADE_DURATION);
    laughSound.setVolume(laughVolume);
    if (laughVolume >= 1.0) laughFading = false;
  }
}
