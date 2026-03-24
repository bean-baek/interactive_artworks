# Project Context: <해파리에 독은 없지만> (There is no poison in jellyfish, but...)

**Type:** 3D Interactive Web Theater & Experience
**Tech Stack:** HTML5, CSS3, Vanilla JavaScript, Three.js, Web Audio API

## 1. AI Assistant Instructions (Read First)

As an AI coding assistant, you MUST adhere to the following rules when generating code for this project:

- **Aesthetic First:** The core of this project is its atmosphere. Always prioritize smooth transitions, soft easing functions (`gsap` or `lerp`), and subtle post-processing effects (Bloom, Fog) over harsh or abrupt UI changes.
- **Performance:** Three.js scenes can get heavy. Ensure you provide code that properly manages memory (disposing of geometries/materials when not in use) and uses lazy loading for audio and video assets.
- **Audio Context:** Always account for browser autoplay policies. Ensure the `AudioContext` is initialized or resumed ONLY upon the user's first explicit interaction.

## 2. Core Concept & Atmosphere

- **Mood:** Dreamy, mystical, blurring the boundaries between deep sea and deep space. It heavily features the feeling of winter and transitions of time (dawn, sunset, morning).
- **Theme:** "MUTED" – telling a tragic but ultimately hopeful story. Emphasizing that true strength isn't about being toxic, but about surviving with a single, gentle light (hope).
- **Key Visual Elements:** Eungabi Jellyfish, Goldfish bowl, Old film cameras, Purple lighting/fireworks.

## 3. Visual & UI References

- **Atmosphere Reference:** The Korean film _Moonlit Winter_ (<윤희에게>).
- **UI/UX Reference (For Phase 3):** The music video _Spaceship_ (<우주선>) by Baek A. The UI should transition into an analog, vintage sketchbook style.

## 4. User Journey & Interactive Flow

- **Phase 1 (Intro):** Dark ocean/space. 3D jellyfish follows the cursor. Text "빛을 따라가 보세요" pulses. Hovering increases the jellyfish's emissive intensity. Clicking starts Phase 2.
- **Phase 2 (Theater):** A 3D plane plays the video, framed by mystical particles and soft `UnrealBloomPass`.
- **Phase 3 (Sound Exploration):** Scene transitions to warm parchment atmosphere with angled top-down camera. User clicks 3 kalimba tine keys to trigger spatial audio. Clicking all 3 triggers Phase 4. A 4096-instance autumn leaf particle system (wind, cursor repulsion, lift/gravity) fills the scene as visual atmosphere — leaves are not clickable. A 3D sketchbook opens on click and auto-closes 1.5s after the last page is read.
- **Phase 4 (Climax):** Soft purple fireworks particle explosion. The jellyfish light fades. Distant children's laughter plays. Text fades in: "해파리에 독은 없지만". Resets to Phase 1.

## 5. Global Technical Variables (Strict Color Palette)

Use these specific colors extracted from the existing codebase to maintain visual consistency:

- **Base Jellyfish Color (Purple):** `#d364ff` (Used for material color and gradients)
- **Emissive Color (Deep Oceanic Blue):** `#122c96` (Used for material emissive property)
- **Gradient Accent (Vibrant Blue):** `#005eff`
- **Cursor/Core Glow (Ice Blue):** `rgba(180, 220, 255, 1.0)`
- **Space/Ocean Background:** Gradient between `#05050A` to `#0B0B1A`
- **Materials:** Rely heavily on `MeshPhysicalMaterial` with high `transmission` (0.7 - 0.85), low `roughness` (0.1 - 0.15), and `emissive` properties.

## 6. Legacy Code & Implementation Style

- **Preserve Existing Logic:** I have already implemented the jellyfish materials using procedural canvas textures (`createBellTexture`, `createTentacleTexture`) and `THREE.MeshPhysicalMaterial`.
- **Rule for AI:** Do NOT overwrite, refactor, or replace my procedural texture generation or physical material configurations unless explicitly asked to fix a bug.
- **Integration:** When adding new features (like Hover Raycaster glow, or Post-processing Bloom), seamlessly integrate them with my existing `bellMaterial` and `tentacleMaterial` (e.g., by tweening `material.emissiveIntensity` from its base value of 0.3/0.4).
