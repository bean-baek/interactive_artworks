import * as THREE from "three";
import { scene, camera } from "./scene.js";
import { isCameraFocused, focusCamera } from "./camera.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PAGE_W = 1.28;
const PAGE_H = 1.71;
const PAGE_D = 0.003;
// [수정 포인트 2] 뼈대 개수를 30개로 늘려 종이의 부드러운 곡률 확보
const BONE_COUNT = 30;
const SEGMENT_W = PAGE_W / BONE_COUNT;
const OUTSIDE_CURVE_STRENGTH = 0.18;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let active = false;
let fadeT = 0;

let currentPage = 0;
let displayedPage = 0;
let delayTimer = 0;

// (camera focus state is owned by camera.js — imported as isCameraFocused)

// [수정 포인트 4] Airborne 상태 (타임스탬프 기반 연산을 위해 startTime 저장)
const airborne = [];

// Click bounce spring — nudges book forward on each page turn
const clickSpring = { z: 0, vel: 0 };

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------
function dampAngle(current, target, lambda, delta) {
  return current + (target - current) * (1 - Math.pow(lambda, delta));
}

// ---------------------------------------------------------------------------
// Textures (기존 로직 유지)
// ---------------------------------------------------------------------------
function makeTexture(drawFn) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 682;
  const ctx = canvas.getContext("2d");
  drawFn(ctx, canvas.width, canvas.height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16; // 텍스처 선명도 필터 추가
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

// ───────────────────────────────────────────────────────────────────────────
// 리얼한 종이 질감을 그려주는 헬퍼 함수
// ───────────────────────────────────────────────────────────────────────────
function addPaperTexture(ctx, w, h, isCover = false) {
  // 1. 미세한 노이즈 (종이의 오돌토돌한 표면)
  const noiseDensity = isCover ? 12000 : 8000;
  for (let i = 0; i < noiseDensity; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const opacity = Math.random() * 0.05 + 0.01; // 아주 연하게
    ctx.fillStyle = isCover
      ? `rgba(100, 70, 30, ${opacity})`
      : `rgba(0, 0, 0, ${opacity})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  // 2. 종이 섬유질 (불규칙하게 흩뿌려진 짧은 실선들)
  const fiberCount = isCover ? 500 : 250;
  ctx.lineWidth = 0.5;
  for (let i = 0; i < fiberCount; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const length = Math.random() * 4 + 2; // 섬유질 길이
    const angle = Math.random() * Math.PI * 2;
    const opacity = Math.random() * 0.04 + 0.01;

    ctx.strokeStyle = isCover
      ? `rgba(80, 50, 20, ${opacity})`
      : `rgba(0, 0, 0, ${opacity})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }

  // 3. 빈티지 가장자리 음영 (비네팅 효과 - 표지에만 강하게 적용)
  if (isCover) {
    const gradient = ctx.createRadialGradient(
      w / 2,
      h / 2,
      w * 0.4,
      w / 2,
      h / 2,
      w * 0.9,
    );
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)"); // 중심은 투명
    gradient.addColorStop(1, "rgba(80, 50, 20, 0.2)"); // 가장자리는 어둡게
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 기존 Textures 객체에 질감 함수 적용
// ───────────────────────────────────────────────────────────────────────────
const textures = {
  cover: makeTexture((ctx, w, h) => {
    // 배경색
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#f7f0e0");
    grad.addColorStop(1, "#e6d5b8"); // 살짝 더 어두운 톤으로 깊이감 추가
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // ✨ 종이 질감 추가 (isCover = true)
    addPaperTexture(ctx, w, h, true);

    // 텍스트
    ctx.fillStyle = "rgba(70,45,20,0.85)";
    ctx.font = "bold 26px serif";
    ctx.textAlign = "center";
    ctx.fillText("해파리에 독은 없지만", w / 2, h / 2 - 20);
  }),

  page1: makeTexture((ctx, w, h) => {
    ctx.fillStyle = "#faf6ee";
    ctx.fillRect(0, 0, w, h);
    addPaperTexture(ctx, w, h, false);

    // Ruled lines
    ctx.strokeStyle = "rgba(100,130,180,0.18)";
    ctx.lineWidth = 1;
    for (let y = 60; y < h - 60; y += 28) {
      ctx.beginPath();
      ctx.moveTo(36, y);
      ctx.lineTo(w - 36, y);
      ctx.stroke();
    }
    // Red margin
    ctx.strokeStyle = "rgba(200,80,80,0.2)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(72, 40);
    ctx.lineTo(72, h - 40);
    ctx.stroke();

    // Kalimba tine sketch
    const tineData = [
      { x: -0.32, th: 0.55 },
      { x: -0.22, th: 0.7 },
      { x: -0.12, th: 0.82 },
      { x: 0.0, th: 0.9 },
      { x: 0.12, th: 0.85 },
      { x: 0.22, th: 0.73 },
      { x: 0.32, th: 0.58 },
    ];
    const cx = w / 2,
      cy = h * 0.52,
      sc = 88;
    ctx.strokeStyle = "rgba(60,40,20,0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - sc * 0.45, cy + sc * 0.12);
    ctx.lineTo(cx + sc * 0.45, cy + sc * 0.12);
    ctx.stroke();
    tineData.forEach(({ x, th }) => {
      const tx = cx + x * sc;
      ctx.strokeRect(tx - 6, cy - th * sc, 12, th * sc);
      ctx.beginPath();
      ctx.arc(tx, cy - th * sc, 3, 0, Math.PI * 2);
      ctx.stroke();
    });

    ctx.fillStyle = "rgba(60,40,20,0.45)";
    ctx.font = "italic 15px serif";
    ctx.textAlign = "center";
    ctx.fillText("칼림바 / Kalimba", w / 2, h * 0.88);
  }),

  page2: makeTexture((ctx, w, h) => {
    ctx.fillStyle = "#faf6ee";
    ctx.fillRect(0, 0, w, h);
    addPaperTexture(ctx, w, h, false);

    // Dot grid
    ctx.fillStyle = "rgba(100,130,180,0.2)";
    for (let y = 50; y < h - 40; y += 28) {
      for (let x = 40; x < w - 30; x += 28) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Three leaf sketches
    ctx.strokeStyle = "rgba(40,80,50,0.6)";
    ctx.lineWidth = 1.5;
    function drawLeaf(cx, cy, size, angle) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(
        size * 0.5,
        -size * 0.3,
        size * 0.8,
        -size * 0.8,
        0,
        -size,
      );
      ctx.bezierCurveTo(
        -size * 0.8,
        -size * 0.8,
        -size * 0.5,
        -size * 0.3,
        0,
        0,
      );
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -size * 0.85);
      ctx.stroke();
      ctx.restore();
    }
    drawLeaf(w * 0.38, h * 0.6, 62, -0.3);
    drawLeaf(w * 0.62, h * 0.54, 72, 0.4);
    drawLeaf(w * 0.5, h * 0.7, 48, 0.0);

    ctx.fillStyle = "rgba(40,80,50,0.45)";
    ctx.font = "italic 15px serif";
    ctx.textAlign = "center";
    ctx.fillText("잎사귀 / Leaves", w / 2, h * 0.88);
  }),

  page3: makeTexture((ctx, w, h) => {
    ctx.fillStyle = "#faf6ee";
    ctx.fillRect(0, 0, w, h);
    addPaperTexture(ctx, w, h, false);

    // Three music staves
    ctx.strokeStyle = "rgba(60,40,20,0.25)";
    ctx.lineWidth = 1;
    [0.28, 0.52, 0.72].forEach((yFrac) => {
      const base = h * yFrac;
      for (let l = 0; l < 5; l++) {
        ctx.beginPath();
        ctx.moveTo(50, base + l * 10);
        ctx.lineTo(w - 50, base + l * 10);
        ctx.stroke();
      }
    });
    // Treble clefs
    ctx.fillStyle = "rgba(60,40,20,0.28)";
    ctx.font = "52px serif";
    ctx.textAlign = "left";
    [0.28, 0.52, 0.72].forEach((yFrac) => {
      ctx.fillText("𝄞", 52, h * yFrac + 42);
    });

    ctx.fillStyle = "rgba(60,40,20,0.38)";
    ctx.font = "italic 15px serif";
    ctx.textAlign = "center";
    ctx.fillText("소리를 찾아보세요", w / 2, h * 0.92);
  }),
  blank: makeTexture((ctx, w, h) => {
    ctx.fillStyle = "#faf6ee";
    ctx.fillRect(0, 0, w, h);
    // 아무 글씨도 쓰지 않고 종이 질감만 추가!
    addPaperTexture(ctx, w, h, false);
  }),
};
// ---------------------------------------------------------------------------
// Build a single page mesh
// ---------------------------------------------------------------------------
function buildPage(frontTex, backTex) {
  const geo = new THREE.BoxGeometry(PAGE_W, PAGE_H, PAGE_D, BONE_COUNT, 1, 1);

  // [수정 포인트 1] 지오메트리 자체를 오른쪽으로 밀어 로컬 좌표(0,0,0)를 왼쪽 끝 제본선으로 맞춤

  geo.translate(PAGE_W / 2, 0, 0);

  const positions = geo.attributes.position;
  const vertCount = positions.count;
  const idxArr = new Uint16Array(vertCount * 4);
  const wgtArr = new Float32Array(vertCount * 4);

  for (let v = 0; v < vertCount; v++) {
    // 이제 x 좌표는 -PAGE_W/2 가 아니라 0 부터 PAGE_W 까지입니다.
    const x = positions.getX(v);
    const boneFloat = (x / PAGE_W) * (BONE_COUNT - 1);

    const b0 = Math.max(0, Math.min(BONE_COUNT - 1, Math.floor(boneFloat)));
    const b1 = Math.min(BONE_COUNT - 1, b0 + 1);
    const w1 = boneFloat - b0;
    const w0 = 1 - w1;

    idxArr[v * 4] = b0;
    idxArr[v * 4 + 1] = b1;
    wgtArr[v * 4] = w0;
    wgtArr[v * 4 + 1] = w1;
  }

  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(idxArr, 4));
  geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(wgtArr, 4));

  const edgeMat = () =>
    new THREE.MeshStandardMaterial({
      color: 0xc8b090,
      transparent: true,
      opacity: 0,
    });
  const mats = [
    edgeMat(),
    edgeMat(),
    edgeMat(),
    edgeMat(),
    new THREE.MeshStandardMaterial({
      map: frontTex,
      roughness: 0.95,
      metalness: 0.0,
      transparent: true,
      opacity: 0,
    }),
    new THREE.MeshStandardMaterial({
      map: backTex,
      roughness: 0.95,
      metalness: 0.0,
      transparent: true,
      opacity: 0,
    }),
  ];

  const bones = [];
  for (let i = 0; i < BONE_COUNT; i++) {
    const bone = new THREE.Bone();
    // 지오메트리가 이동했으므로, 루트 본(0번)은 부모 기준 0에서 시작합니다.
    bone.position.x = i === 0 ? 0 : SEGMENT_W;
    if (i > 0) bones[i - 1].add(bone);
    bones.push(bone);
  }

  const skeleton = new THREE.Skeleton(bones);
  const mesh = new THREE.SkinnedMesh(geo, mats);
  mesh.frustumCulled = false;

  mesh.add(bones[0]);
  mesh.bind(skeleton);

  return { mesh, bones, mats };
}

const bookConfig = [
  { front: textures.cover, back: textures.blank, isStop: true }, // [0] 표지 (멈춤)
  { front: textures.blank, back: textures.blank, isStop: false }, // [1] 휘리릭 넘어갈 빈 페이지
  { front: textures.blank, back: textures.blank, isStop: false }, // [2] 빈 페이지
  { front: textures.page1, back: textures.blank, isStop: true }, // [3] 칼림바 내용 (멈춤)
  { front: textures.blank, back: textures.blank, isStop: false }, // [4] 빈 페이지
  { front: textures.blank, back: textures.blank, isStop: false }, // [5] 빈 페이지
  { front: textures.page2, back: textures.blank, isStop: true }, // [6] 잎사귀 내용 (멈춤)
  { front: textures.blank, back: textures.blank, isStop: false }, // [7] 빈 페이지
  { front: textures.page3, back: textures.cover, isStop: true }, // [8] 소리를 찾아보세요 & 뒷면 표지 (멈춤)
];

// 책의 전체 페이지 데이터를 생성
const pageData = bookConfig.map((config) =>
  buildPage(config.front, config.back),
);
pageData.forEach(() => airborne.push(null));

// 사용자가 클릭했을 때 멈춰야 할 타겟 인덱스(validStops)만 따로 배열로 수집합니다.
// 결과: [0, 3, 6, 8, 9] (9는 책이 완전히 덮였을 때)
const validStops = [];
bookConfig.forEach((config, index) => {
  if (config.isStop) validStops.push(index);
});
validStops.push(bookConfig.length); // 책을 완전히 덮는 마지막 지점 추가

// ---------------------------------------------------------------------------
// Book Group Setup
// ---------------------------------------------------------------------------
export const bookGroup = new THREE.Group();
// Shift left by half page-width so the book is centered (spine at world x=0)
bookGroup.position.set(-PAGE_W / 2, 0.3, 3);
bookGroup.rotation.x = -0.12;
bookGroup.rotation.y = -0.15; // slight angle to show spine depth
bookGroup.visible = false;
scene.add(bookGroup);

pageData.forEach(({ mesh }, i) => {
  // [수정 포인트 1-2] 지오메트리를 이미 이동시켰으므로 mesh 위치는 0(제본선 축)으로 둡니다.
  mesh.position.x = 0;
  mesh.position.z = i * PAGE_D * -4;
  bookGroup.add(mesh);
});

// ── Notebook structural pieces (spine + back board) ──────────────────────────
const totalStackZ = (bookConfig.length - 1) * PAGE_D * -4;

const spineMat = new THREE.MeshStandardMaterial({
  color: 0x5c3a1e,
  roughness: 0.85,
  metalness: 0.0,
  transparent: true,
  opacity: 0,
});
const spineMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.045, PAGE_H * 1.01, totalStackZ + 0.025),
  spineMat,
);
spineMesh.position.set(0, 0, totalStackZ / 2);
bookGroup.add(spineMesh);

const backCoverMat = new THREE.MeshStandardMaterial({
  color: 0x8b5e3c,
  roughness: 0.8,
  metalness: 0.0,
  transparent: true,
  opacity: 0,
});
const backCoverMesh = new THREE.Mesh(
  new THREE.BoxGeometry(PAGE_W + 0.02, PAGE_H + 0.02, 0.006),
  backCoverMat,
);
backCoverMesh.position.set(PAGE_W / 2, 0, totalStackZ + 0.005);
bookGroup.add(backCoverMesh);

// Extra structural meshes that need to fade in with the pages
const extraMeshes = [spineMesh, backCoverMesh];

// ---------------------------------------------------------------------------
// Interactions
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const mouse2D = new THREE.Vector2();
const pageMeshes = pageData.map(({ mesh }) => mesh);

window.addEventListener("click", (e) => {
  if (!active) return;
  mouse2D.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse2D.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse2D, camera);
  const hits = raycaster.intersectObjects(pageMeshes, false);
  if (hits.length === 0) return;

  // camera.md: "First Click → focus camera. Subsequent clicks → flip pages."
  if (!isCameraFocused) {
    focusCamera();
    return;
  }

  // Camera is focused — navigate pages by click side
  const localPt = bookGroup.worldToLocal(hits[0].point.clone());
  if (localPt.x > 0) {
    const nextStop = validStops.find((stop) => stop > currentPage);
    if (nextStop !== undefined) {
      currentPage = nextStop;
      clickSpring.vel += 0.1;
    }
  } else {
    const prevStops = validStops.filter((stop) => stop < currentPage);
    if (prevStops.length > 0) {
      currentPage = prevStops[prevStops.length - 1];
      clickSpring.vel += 0.1;
    }
  }
});

export function activateSketchbook() {
  active = true;
  bookGroup.visible = true;
  fadeT = 0;
}

// ---------------------------------------------------------------------------
// Animation Loop (updateSketchbook)
// ---------------------------------------------------------------------------
export function updateSketchbook(delta, elapsed) {
  if (!bookGroup.visible) return;

  // ── Fade-in (~2.5s) ───────────────────────────────────────────────────────
  if (fadeT < 1) {
    fadeT = Math.min(1, fadeT + delta * 0.4);
    const opacity = fadeT * fadeT; // easeIn
    pageData.forEach(({ mats }) => {
      mats.forEach((m) => {
        m.opacity = opacity;
      });
    });
    extraMeshes.forEach((m) => {
      m.material.opacity = opacity;
    });
  }

  // ── [수정 포인트 3] Delayed Page & Airborne Trigger ───────────────────────
  if (delayTimer > 0) {
    delayTimer -= delta;
  } else if (displayedPage !== currentPage) {
    const step = Math.sign(currentPage - displayedPage);
    const turningIdx = step > 0 ? displayedPage : displayedPage - 1;

    if (turningIdx >= 0 && turningIdx < pageData.length) {
      airborne[turningIdx] = {
        startTime: elapsed, // 현재 시간을 기록
        duration: 0.4,
        dir: step,
      };
    }
    displayedPage += step;

    const dist = Math.abs(currentPage - displayedPage);
    if (dist > 0) delayTimer = dist >= 2 ? 0.003 : 0.15;
  }

  // ── Click bounce spring — forward nudge on page turn ─────────────────────
  clickSpring.vel += (-clickSpring.z * 40 - clickSpring.vel * 8) * delta;
  clickSpring.z += clickSpring.vel * delta;
  bookGroup.position.z = 3 + clickSpring.z;

  // ── 부유 효과 ────────────────────────────────────────────────────────────
  bookGroup.position.y = 0.3 + Math.sin(elapsed * 0.8) * 0.04;
  bookGroup.rotation.z = Math.sin(elapsed * 0.5) * 0.01;

  // ── Per-page Bone Animation ─────────────────────────────────────────────
  pageData.forEach(({ mesh, bones }, p) => {
    const isFlipped = p < displayedPage;
    let progress = 0;
    let isTurning = false;

    // [수정 포인트 4] 타임스탬프 기반 진행도 계산
    if (airborne[p]) {
      const t = elapsed - airborne[p].startTime;
      if (t >= airborne[p].duration) {
        airborne[p] = null;
      } else {
        progress = t / airborne[p].duration; // 0.0 ~ 1.0 사이 값
        isTurning = true;
      }
    }

    // [수정된 Per-page Bone Animation 로직]
    for (let i = 0; i < BONE_COUNT; i++) {
      if (i === 0) {
        // 루트 본(제본선 축)을 180도 넘김
        const targetRootY = isFlipped ? Math.PI : 0;
        bones[0].rotation.y = dampAngle(
          bones[0].rotation.y,
          targetRootY,
          0.003, // faster root turn (~0.6s to settle)
          delta,
        );
      } else {
        // 하위 뼈대들의 곡률 계산
        const insideCurve = i < 8 ? Math.sin(i * 0.2 + 0.25) * 0.18 : 0;
        const outsideCurve =
          i >= 8 ? (Math.sin(i * 0.3) + 0.09) * OUTSIDE_CURVE_STRENGTH : 0;

        // 완전히 넘겨졌을 때 곡률 유지 여부 (평평하게 하려면 0, 구부린 채 두려면 isFlipped 조건 추가)
        let targetBoneY = isFlipped ? (insideCurve + outsideCurve) * 0.5 : 0;
        let targetBoneX = 0;

        // 공중에 떠서 넘어갈 때의 다이나믹한 효과
        if (isTurning) {
          const expansion = Math.sin(progress * Math.PI) * 0.08; // visible page-lift arc
          targetBoneY += airborne[p].dir * expansion;

          // 비틀림(펄럭임) 효과
          const foldIntensity = Math.sin(progress * Math.PI) * 0.1;
          targetBoneX =
            Math.sign(isFlipped ? 1 : -1) * foldIntensity * Math.sin(i * 0.3);
        }

        bones[i].rotation.y = dampAngle(
          bones[i].rotation.y,
          targetBoneY,
          0.008,
          delta,
        );
        bones[i].rotation.x = dampAngle(
          bones[i].rotation.x,
          targetBoneX,
          0.012,
          delta,
        );
      }
    }
  });
}
