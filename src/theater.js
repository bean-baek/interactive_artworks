import * as THREE from "three";
import { jellyfishContainer } from "./jellyfish.js";

// World-space target the jellyfish flees toward (top-right, off-screen)
export const fleeTarget = new THREE.Vector3(10, 8, 0);

export const theaterState = {
  fleeing: false,
  fleeProgress: 0, // 0 → 1 over the flee duration
  done: false,
};

// --- DOM setup ---
const videoContainer = document.getElementById("video-container");
const video = videoContainer.querySelector("video");
const playBtn = document.getElementById("play-btn");
const iconPlay = document.getElementById("icon-play");
const iconPause = document.getElementById("icon-pause");
const scrubber = document.getElementById("scrubber");
const timeCurrent = document.getElementById("time-current");
const timeTotal = document.getElementById("time-total");

function fmt(s) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

function syncPlayIcon() {
  const paused = video.paused;
  iconPlay.style.display = paused ? "" : "none";
  iconPause.style.display = paused ? "none" : "";
}

let isPlayPending = false; // guards against overlapping play() calls

function onPlayBtnClick(e) {
  e.stopPropagation();

  // ignore additional clicks while a play() call is still resolving
  if (isPlayPending) return;

  if (video.paused) {
    isPlayPending = true;
    video
      .play()
      .then(() => {
        isPlayPending = false;
      })
      .catch((error) => {
        isPlayPending = false;
        console.error("Video play failed:", error);
      });
  } else {
    video.pause();
  }
}

playBtn.addEventListener("click", onPlayBtnClick);
video.addEventListener("play", syncPlayIcon);
video.addEventListener("pause", syncPlayIcon);

function onLoadedMetadata() {
  timeTotal.textContent = fmt(video.duration);
}
video.addEventListener("loadedmetadata", onLoadedMetadata);

function onTimeUpdate() {
  if (!scrubber.dragging) {
    scrubber.value = video.duration
      ? (video.currentTime / video.duration) * 100
      : 0;
  }
  timeCurrent.textContent = fmt(video.currentTime);
}
video.addEventListener("timeupdate", onTimeUpdate);

let wasPlaying = false; // remembers playback state at the start of a scrub

function onScrubberMouseDown() {
  scrubber.dragging = true;
  wasPlaying = !video.paused;
  if (wasPlaying) video.pause(); // pause during drag for smooth seeking
}

function onScrubberInput() {
  // update the time display eagerly without seeking video.currentTime
  const targetTime = (scrubber.value / 100) * video.duration;
  timeCurrent.textContent = fmt(targetTime);
}

function onScrubberChange() {
  // seek to the final chosen position exactly once on commit
  video.currentTime = (scrubber.value / 100) * video.duration;
}

function onScrubberMouseUp() {
  scrubber.dragging = false;

  // resume from the new position if video was playing before the scrub
  if (wasPlaying) {
    video.play().catch((err) => console.error("Play prevented:", err));
  }
}

scrubber.addEventListener("mousedown", onScrubberMouseDown);
scrubber.addEventListener("input", onScrubberInput);
scrubber.addEventListener("change", onScrubberChange);
scrubber.addEventListener("mouseup", onScrubberMouseUp);

// Auto-hide controls after 3s of inactivity
let hideTimer = null;
function onVideoContainerMouseMove() {
  videoContainer.classList.add("controls-visible");
  clearTimeout(hideTimer);
  hideTimer = setTimeout(
    () => videoContainer.classList.remove("controls-visible"),
    3000,
  );
}
videoContainer.addEventListener("mousemove", onVideoContainerMouseMove);

// Cache of jellyfish meshes collected at flee-start — avoids re-traversing the
// scene graph on every frame inside updateTheater (which runs up to ~60 times/s
// during the flee animation).
let _fleeMeshes = null; // Array<THREE.Mesh> | null

function onWindowClick() {
  if (theaterState.fleeing || theaterState.done) return;
  theaterState.fleeing = true;
  theaterState.fleeProgress = 0;

  // Collect meshes and capture each material's current opacity exactly once.
  // Storing the result avoids repeated traverse() calls in updateTheater.
  _fleeMeshes = [];
  jellyfishContainer.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material.userData.baseOpacity = child.material.opacity;
      _fleeMeshes.push(child);
    }
  });

  // play() must be called synchronously inside the click handler —
  // browsers block it if called after a setTimeout (gesture context expires)
  video.play().catch((err) => console.error("Video play failed:", err));

  // Delay showing the theater overlay until the jellyfish has started to leave
  setTimeout(() => {
    videoContainer.classList.add("theater-active");
  }, 800);
}

window.addEventListener("click", onWindowClick);

// --- Helpers ---
function easeIn(t) {
  return t * t;
}

// --- Per-frame update (called from animate.js) ---
export function updateTheater(delta) {
  if (!theaterState.fleeing) return;

  theaterState.fleeProgress = Math.min(
    1,
    theaterState.fleeProgress + delta * 0.35,
  );
  const t = easeIn(theaterState.fleeProgress);

  // Iterate the pre-collected array instead of traversing the scene graph every frame
  if (_fleeMeshes) {
    for (let i = 0; i < _fleeMeshes.length; i++) {
      const child = _fleeMeshes[i];
      const base = child.material.userData.baseOpacity ?? 1;
      child.material.opacity = base * (1 - t);
    }
  }

  if (theaterState.fleeProgress >= 1) {
    theaterState.fleeing = false;
    theaterState.done = true;
    jellyfishContainer.visible = false;
    _fleeMeshes = null; // release references
  }
}

// --- Cleanup ---
export function disposeTheater() {
  window.removeEventListener("click", onWindowClick);
  playBtn.removeEventListener("click", onPlayBtnClick);
  video.removeEventListener("play", syncPlayIcon);
  video.removeEventListener("pause", syncPlayIcon);
  video.removeEventListener("loadedmetadata", onLoadedMetadata);
  video.removeEventListener("timeupdate", onTimeUpdate);
  scrubber.removeEventListener("mousedown", onScrubberMouseDown);
  scrubber.removeEventListener("input", onScrubberInput);
  scrubber.removeEventListener("change", onScrubberChange);
  scrubber.removeEventListener("mouseup", onScrubberMouseUp);
  videoContainer.removeEventListener("mousemove", onVideoContainerMouseMove);
  clearTimeout(hideTimer);
  _fleeMeshes = null;
}
