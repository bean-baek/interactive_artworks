import * as THREE from "three";
import { jellyfishContainer } from "./jellyfish.js";
import { hoverState } from "./interaction.js";

// World-space target the jellyfish flees toward (top-right, off-screen)
export const fleeTarget = new THREE.Vector3(10, 8, 0);

export const theaterState = {
  fleeing: false,
  fleeProgress: 0,
  done: false,
  returning: false,
  returnProgress: 0,
  cameraTargetZ: 8,
};

// --- DOM ---
const videoContainer = document.getElementById("video-container");
const video = videoContainer.querySelector("video");
const playBtn = document.getElementById("play-btn");
const iconPlay = document.getElementById("icon-play");
const iconPause = document.getElementById("icon-pause");
const scrubber = document.getElementById("scrubber");
const timeCurrent = document.getElementById("time-current");
const timeTotal = document.getElementById("time-total");
const backBtn = document.getElementById("back-btn");
const fullscreenBtn = document.getElementById("fullscreen-btn");
const iconFullscreen = document.getElementById("icon-fullscreen");
const iconExitFullscreen = document.getElementById("icon-exit-fullscreen");

function fmt(s) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

function syncPlayIcon() {
  const paused = video.paused;
  iconPlay.style.display = paused ? "" : "none";
  iconPause.style.display = paused ? "none" : "";
}

let isPlayPending = false;

function onPlayBtnClick(e) {
  e.stopPropagation();
  if (isPlayPending) return;
  if (video.paused) {
    isPlayPending = true;
    video
      .play()
      .then(() => { isPlayPending = false; })
      .catch((err) => { isPlayPending = false; console.error("Video play failed:", err); });
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

let wasPlaying = false;

function onScrubberMouseDown() {
  scrubber.dragging = true;
  wasPlaying = !video.paused;
  if (wasPlaying) video.pause();
}

function onScrubberInput() {
  const targetTime = (scrubber.value / 100) * video.duration;
  timeCurrent.textContent = fmt(targetTime);
}

function onScrubberChange() {
  video.currentTime = (scrubber.value / 100) * video.duration;
}

function onScrubberMouseUp() {
  scrubber.dragging = false;
  if (wasPlaying) {
    video.play().catch((err) => console.error("Play prevented:", err));
  }
}

scrubber.addEventListener("mousedown", onScrubberMouseDown);
scrubber.addEventListener("input", onScrubberInput);
scrubber.addEventListener("change", onScrubberChange);
scrubber.addEventListener("mouseup", onScrubberMouseUp);

// --- Fullscreen ---
function onFullscreenBtnClick(e) {
  e.stopPropagation();
  if (!document.fullscreenElement) {
    videoContainer.requestFullscreen().catch((err) => console.error(err));
  } else {
    document.exitFullscreen();
  }
}

function onFullscreenChange() {
  const isFs = !!document.fullscreenElement;
  iconFullscreen.style.display = isFs ? "none" : "";
  iconExitFullscreen.style.display = isFs ? "" : "none";
}

fullscreenBtn.addEventListener("click", onFullscreenBtnClick);
document.addEventListener("fullscreenchange", onFullscreenChange);

// --- Auto-hide controls ---
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

// --- Mesh cache ---
let _fleeMeshes = null;

// --- Back button — return to jellyfish ---
function returnToJellyfish() {
  video.pause();
  videoContainer.classList.remove("theater-active");

  jellyfishContainer.visible = true;
  theaterState.fleeing = false;
  theaterState.done = false;
  theaterState.returning = true;
  theaterState.returnProgress = 0;
  theaterState.cameraTargetZ = 8;

  // Collect meshes and set opacity to 0 for fade-in
  _fleeMeshes = [];
  jellyfishContainer.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material.opacity = 0;
      _fleeMeshes.push(child);
    }
  });
}

function onBackBtnClick(e) {
  e.stopPropagation();
  if (theaterState.returning) return; // already in progress
  returnToJellyfish();
}

backBtn.addEventListener("click", onBackBtnClick);

// Video ended → same flow as back button
function onVideoEnded() {
  if (theaterState.returning || (!theaterState.done && !theaterState.fleeing)) return;
  returnToJellyfish();
}
video.addEventListener("ended", onVideoEnded);

// --- Flee on window click ---
function onWindowClick() {
  if (!hoverState.isHovering) return;
  if (theaterState.fleeing || theaterState.done || theaterState.returning) return;
  theaterState.fleeing = true;
  theaterState.fleeProgress = 0;
  theaterState.cameraTargetZ = 4.5;

  _fleeMeshes = [];
  jellyfishContainer.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material.userData.baseOpacity = child.material.opacity;
      _fleeMeshes.push(child);
    }
  });

  video.play().catch((err) => console.error("Video play failed:", err));

  setTimeout(() => {
    videoContainer.classList.add("theater-active");
  }, 800);
}

window.addEventListener("click", onWindowClick);

// --- Helpers ---
function easeIn(t) {
  return t * t;
}

function easeOut(t) {
  return 1 - (1 - t) * (1 - t);
}

// --- Per-frame update ---
export function updateTheater(delta) {
  // Fade in jellyfish on return
  if (theaterState.returning) {
    theaterState.returnProgress = Math.min(
      1,
      theaterState.returnProgress + delta * 0.7,
    );
    const t = easeOut(theaterState.returnProgress);
    if (_fleeMeshes) {
      for (let i = 0; i < _fleeMeshes.length; i++) {
        const child = _fleeMeshes[i];
        const base = child.material.userData.baseOpacity ?? 1;
        child.material.opacity = base * t;
      }
    }
    if (theaterState.returnProgress >= 1) {
      theaterState.returning = false;
      _fleeMeshes = null;
    }
    return;
  }

  // Fade out jellyfish on flee
  if (!theaterState.fleeing) return;

  theaterState.fleeProgress = Math.min(
    1,
    theaterState.fleeProgress + delta * 0.65, // ~1.5s fade
  );
  const t = easeIn(theaterState.fleeProgress);

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
    _fleeMeshes = null;
  }
}

// --- Cleanup ---
export function disposeTheater() {
  window.removeEventListener("click", onWindowClick);
  playBtn.removeEventListener("click", onPlayBtnClick);
  backBtn.removeEventListener("click", onBackBtnClick);
  fullscreenBtn.removeEventListener("click", onFullscreenBtnClick);
  document.removeEventListener("fullscreenchange", onFullscreenChange);
  video.removeEventListener("play", syncPlayIcon);
  video.removeEventListener("pause", syncPlayIcon);
  video.removeEventListener("loadedmetadata", onLoadedMetadata);
  video.removeEventListener("timeupdate", onTimeUpdate);
  scrubber.removeEventListener("mousedown", onScrubberMouseDown);
  scrubber.removeEventListener("input", onScrubberInput);
  scrubber.removeEventListener("change", onScrubberChange);
  scrubber.removeEventListener("mouseup", onScrubberMouseUp);
  videoContainer.removeEventListener("mousemove", onVideoContainerMouseMove);
  video.removeEventListener("ended", onVideoEnded);
  clearTimeout(hideTimer);
  _fleeMeshes = null;
}
