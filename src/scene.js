import * as THREE from "three";

export const canvas = document.getElementById("bg");

// --- Renderer ---
export const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

// --- Scene ---
export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020813);
scene.fog = new THREE.FogExp2(0xffffff, 0.08);

// --- Camera ---
export const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.z = 8;

// --- Lights ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2); // 뚜렷한 그림자와 굴곡을 만드는 주조명
dirLight.position.set(2, 5, 4); // 우측 상단 앞쪽에서 비스듬히 쏘기
dirLight.castShadow = true;
scene.add(dirLight);

const mainLight = new THREE.DirectionalLight(0xaaccff, 10);
mainLight.position.set(5, 10, 5);
scene.add(mainLight);

const backLight = new THREE.DirectionalLight(0x88ccff, 5);
backLight.position.set(-5, 10, -5);
scene.add(backLight);

const fillLight = new THREE.DirectionalLight(0x88ccff, 3);
fillLight.position.set(0, -10, 5);
scene.add(fillLight);

// Soft off-screen ambient glow — positioned far upper-left outside the view
const offScreenGlow = new THREE.PointLight(0x6699cc, 1.8, 60);
offScreenGlow.position.set(-18, 14, -6);
scene.add(offScreenGlow);

// Exported so jellyfish.js can attach it to the loaded model
export const innerGlowLight = new THREE.PointLight(0x00ffff, 10.0, 15);
innerGlowLight.position.set(0, 1, 0);
scene.add(innerGlowLight);

// --- Resize ---
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
