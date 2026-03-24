# Role

You are a Senior 3D Web Interactive Developer with deep expertise in React Three Fiber (R3F), Three.js, and complex mathematical rendering optimization. You excel at procedural SkinnedMesh manipulation, custom shader logic, and complex state-driven animations.

# Task

Based on the highly detailed technical specifications below, build a "SkinnedMesh-based 3D Interactive Book Slider" component strictly using code. **Do not use any external 3D models (GLTF/GLB).** Everything must be generated programmatically to simulate the exact physical properties and rhythmic motion of paper.

# Tech Stack

- **JavaScript (ES6+, JSX) - Strictly NO TypeScript.**
- React, React Three Fiber (@react-three/fiber)
- @react-three/drei (useTexture, useCursor, Float)
- maath (for easing/interpolation like dampAngle)
- Three.js (BoxGeometry, SkinnedMesh, Skeleton, Bone, Vector3, etc.)

# Technical Specifications & Implementation Rules

## 1. Geometry & Material System

- **Geometry Setup**: Use `BoxGeometry` with a strict 4:3 aspect ratio (`args={[1.28, 1.71, 0.003, 30, 1, 1]}`).
  - **CRITICAL - Pivot Offset**: Immediately apply `geometry.translate(width / 2, 0, 0)` so the local origin (0,0,0) is exactly at the left edge (the spine of the book).
- **Culling**: Apply `frustumCulled={false}` to the mesh to prevent disappearing during dynamic deformation.
- **Material Mapping**: Define an array of 6 `MeshStandardMaterial` instances.
  - Apply `roughness: 0.95` and `metalness: 0.0` to ALL materials (including the edges) to simulate realistic, matte paper without any glossy or glowing artifacts.
  - Index 4 (Front) and Index 5 (Back) are the core texture layers. Apply `sRGBColorSpace`.
  - Use Canvas API to generate procedural paper textures (noise dots, fibers, vignette) to be used as maps.

## 2. SkinnedMesh & Skeleton Architecture

- Build the skeleton and perform weight painting programmatically using `useMemo`.
- **Bone Hierarchy (Chain)**: Create a chain of 30 bones.
  - Offset: Since the geometry is translated, the Root Bone (index 0) MUST be at `x = 0`. All subsequent child bones (index 1 to 29) must have a local X-axis offset equal to `segmentWidth` (1.28 / 30).
- **Procedural Weight Painting**:
  - Skin Index: Calculate which bone affects each vertex using `index = Math.floor((x) / segmentWidth)` (since X goes from 0 to 1.28 after translation).
  - Skin Weight: Restrict influence to a maximum of 2 adjacent bones per vertex.

## 3. Mathematical Animation Modeling

- Use trigonometry and delayed interpolation to simulate the physics of page-turning inside `useFrame`.
- **Root vs. Child Bones Rotation Logic**:
  - Root Bone (i=0): Rotate only this bone by `Math.PI` to flip the entire page.
  - Child Bones (i>0): Apply curvature formulas to simulate paper bending.
- **Curve Intensity Formulas** (for i > 0):
  - Inside Curve (`i < 8`): `Math.sin(i * 0.2 + 0.25) * 0.18`
  - Outside Curve (`i >= 8`): `(Math.sin(i * 0.3) + 0.09) * 0.18`
- **Timestamp-based Airborne/Flutter Effect**:
  - Track the `startTime` of each flipping page. Calculate `progress = (elapsed - startTime) / duration` (duration = 0.4s).
  - Expansion: Add `Math.sin(progress * Math.PI) * 0.04` to the Y rotation for a dynamic mid-air arc.
  - Flutter (Torsion): Add `Math.sign(direction) * (Math.sin(progress * Math.PI) * 0.1) * Math.sin(i * 0.3)` to the X rotation.

## 4. State Management & Interaction

- **Book Configuration (Cascade Logic)**:
  - Create a `bookConfig` array defining each page's front/back textures and an `isStop: boolean` property.
  - Some pages are purely blank with `isStop: false`. Content pages have `isStop: true`.
- **Click Interaction (Skip & Jump)**:
  - On first click, trigger an initial cascade (flip all pages to the end).
  - On subsequent clicks, calculate the click side (Left/Right) in local space. Jump `currentPage` directly to the next/previous index where `isStop` is `true`.
- **Delayed State Logic**:
  - Compare `displayedPage` to `currentPage` sequentially.
  - Delay Timing: Apply a 30ms delay if `Math.abs(currentPage - displayedPage) >= 2` (creates a rapid "촤라락" cascade effect for blank pages), and 150ms for single page turns.
- **Camera Focus**: On the first interaction, use `camera.position.lerp` and `camera.lookAt` inside `useFrame` to smoothly zoom in on the book from its initial position.

# Output Format

Provide a clean, highly modularized React component code in pure JavaScript (.jsx). You MUST add detailed comments explaining the complex math sections, pivot translation, timestamp logic, and the cascade state management.
