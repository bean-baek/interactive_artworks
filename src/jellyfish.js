import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import modelUrl from "./models/jelfish_alembic.gltf?url";
import { scene, innerGlowLight } from "./scene.js";
import { bellMaterial, tentacleMaterial } from "./materials.js";

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
