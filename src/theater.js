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

playBtn.addEventListener("click", (e) => {
  e.stopPropagation();

  // ignore additional clicks while a play() call is still resolving
  if (isPlayPending) return;

  if (video.paused) {
    const playPromise = video.play();

    // modern browsers return a Promise from play()
    if (playPromise !== undefined) {
      isPlayPending = true;

      playPromise
        .then(() => {
          isPlayPending = false;
        })
        .catch((error) => {
          isPlayPending = false;
          console.error("Video play failed:", error);
        });
    }
  } else {
    video.pause();
  }
});
video.addEventListener("play", syncPlayIcon);
video.addEventListener("pause", syncPlayIcon);

video.addEventListener("loadedmetadata", () => {
  timeTotal.textContent = fmt(video.duration);
});

video.addEventListener("timeupdate", () => {
  if (!scrubber.dragging) {
    scrubber.value = video.duration
      ? (video.currentTime / video.duration) * 100
      : 0;
  }
  timeCurrent.textContent = fmt(video.currentTime);
});
let wasPlaying = false; // remembers playback state at the start of a scrub

scrubber.addEventListener("mousedown", () => {
  scrubber.dragging = true;
  wasPlaying = !video.paused;
  if (wasPlaying) video.pause(); // pause during drag for smooth seeking
});

scrubber.addEventListener("input", () => {
  // update the time display eagerly without seeking video.currentTime
  const targetTime = (scrubber.value / 100) * video.duration;
  timeCurrent.textContent = fmt(targetTime);
});

scrubber.addEventListener("change", () => {
  // seek to the final chosen position exactly once on commit
  video.currentTime = (scrubber.value / 100) * video.duration;
});

scrubber.addEventListener("mouseup", () => {
  scrubber.dragging = false;

  // resume from the new position if video was playing before the scrub
  if (wasPlaying) {
    video.play().catch((err) => console.error("Play prevented:", err));
  }
});

// Auto-hide controls after 3s of inactivity
let hideTimer;
videoContainer.addEventListener("mousemove", () => {
  videoContainer.classList.add("controls-visible");
  clearTimeout(hideTimer);
  hideTimer = setTimeout(
    () => videoContainer.classList.remove("controls-visible"),
    3000,
  );
});

window.addEventListener("click", () => {
  if (theaterState.fleeing || theaterState.done) return;
  theaterState.fleeing = true;
  theaterState.fleeProgress = 0; // Capture each material's current opacity before we start fading

  jellyfishContainer.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material.userData.baseOpacity = child.material.opacity;
    }
  }); // play() must be called synchronously inside the click handler —
  // browsers block it if called after a setTimeout (gesture context expires)

  video.play().catch((err) => console.error("Video play failed:", err)); // Delay showing the theater overlay until the jellyfish has started to leave

  setTimeout(() => {
    videoContainer.classList.add("theater-active");
  }, 800);
});

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
  const t = easeIn(theaterState.fleeProgress); // Fade out all jellyfish meshes

  jellyfishContainer.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const base = child.material.userData.baseOpacity ?? 1;
    child.material.opacity = base * (1 - t);
  });

  if (theaterState.fleeProgress >= 1) {
    theaterState.fleeing = false;
    theaterState.done = true;
    jellyfishContainer.visible = false;
  }
}
