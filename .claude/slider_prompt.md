# Role

You are a Senior 3D Web Interactive Developer with deep expertise in React Three Fiber (R3F), Three.js, and complex mathematical rendering optimization. You excel at procedural SkinnedMesh manipulation and custom shader logic.

# Task

Based on the highly detailed technical specifications below, build a "SkinnedMesh-based 3D Interactive Book Slider" component strictly using code. **Do not use any external 3D models (GLTF/GLB).** Everything must be generated programmatically to simulate the exact physical properties of paper.

# Tech Stack

- React, React Three Fiber (@react-three/fiber)
- @react-three/drei (useTexture, useCursor, Float)
- maath (for easing/interpolation like dampAngle)
- Three.js (BoxGeometry, SkinnedMesh, Skeleton, Bone, etc.)

# Technical Specifications & Implementation Rules

## 1. Geometry & Material System

- **Geometry Setup**: Use `BoxGeometry` with a strict 4:3 aspect ratio.
  - Dimensions: `args={[1.28, 1.71, 0.003, 30, 1, 1]}`. (Crucial: `widthSegments` must be at least 30 to match the bone count and prevent aliasing during interpolation).
- **Culling**: You MUST apply `frustumCulled={false}` to the mesh, as the dynamic deformation will frequently exceed the initial bounding box.
- **Material Mapping**: Define an array of 6 `MeshStandardMaterial` instances.
  - Index 4 (Front) and Index 5 (Back) are the core texture layers.
  - Color Accuracy: Apply `sRGBColorSpace` to all `map` properties.
  - Dual-Texture Roughness: Use a `pictureRoughness` map (Black/White). Glossy areas (logos/text) should be `0.1`, and matte areas (paper texture) should be `1.0`.
  - Asset Preloading: Use `useTexture.preload` to load all page assets into memory during the initial phase.

## 2. SkinnedMesh & Skeleton Architecture

- Build the skeleton and perform weight painting programmatically using `useMemo` without external software like Blender.
- **Bone Hierarchy (Chain)**: Create a chain of 30 bones starting from a Root Bone (`bone.add(nextBone)`). This accumulates rotation for a natural rolling effect.
  - Offset: Each bone must have an X-axis offset equal to `segmentWidth` (1.28 / 30).
- **Procedural Weight Painting**:
  - Skin Index: Calculate which bone affects each vertex using `index = Math.floor((x + width/2) / segmentWidth)`.
  - Skin Weight: For performance, restrict influence to a maximum of 2 adjacent bones per vertex. (e.g., `skinWeight.set(weight1, weight2, 0, 0)` and `skinIndex.set(index1, index2, 0, 0)`).

## 3. Mathematical Animation Modeling

- Use trigonometry and delayed interpolation to simulate the physics of page-turning inside `useFrame`.
- **Curve Intensity Formulas** (based on bone index `i`):
  - Inside Curve (`i < 8`): `Math.sin(i * 0.2 + 0.25) * 0.18`
  - Outside Curve (`i >= 8`): `(Math.sin(i * 0.3) + 0.09) * OUTSIDE_CURVE_STRENGTH`
  - Turning/Airborne Curve: When the page is airborne (approx. 400ms duration), add a temporary expansion effect using `Math.sin(normalizedTime * Math.PI)`.
- **Frame-based Control**: Use `maath`'s `dampAngle` to smoothly interpolate each bone's rotation to its target angle every frame.
- **Fold Effect (Flutter)**: Apply a torsion effect along the X-axis during the turn. Use a `foldIntensity` algorithm based on `Math.sign(targetAngle)` to create a 3D flutter.

## 4. State Management & Interaction

- **Delayed State Logic**: To prevent visual clipping when a user flips multiple pages rapidly, implement sequential update logic using a `delayedPage` state.
  - Delay Timing: Apply a 50ms delay if the distance is >= 2 pages, and a 150ms delay if < 2 pages, creating a rhythmic, sequential flipping effect.
- **Interactive Feedback**:
  - Emissive Highlight: On hover, adjust the `emissive` intensity of materials 4 & 5 to `0.22`. Integrate the `useCursor` hook to change the pointer state dynamically.
- **Performance**: Cache the mesh and skeleton instances using `useMemo`. Keep the bone animation calculations inside `useFrame` as lightweight as possible.
- **Environmental Animation**: Wrap the entire 3D scene in Drei's `<Float>` component to add a subtle, floating micro-animation for overall vitality.

# Output Format

Provide a clean, highly modularized React component code encompassing all the logic above. You MUST add detailed comments explaining the complex math sections (specifically the procedural weight calculations and sine wave curvature logic).
