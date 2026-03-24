# Role

You are a Senior Interactive Engineer specializing in complex camera cinematics and state-based interactions within React Three Fiber (R3F) and Three.js environments.

# Task Overview

Create an independent `CameraController.jsx` file that interfaces with the existing 3D Book Slider. Develop an advanced camera system that organically responds to user inputs: mouse movement, scrolling, and clicking.

# Core Interaction Requirements

## 1. State-based Focusing System

- **Global Mode**: The camera provides an overview of the scene with a subtle parallax effect driven by mouse movement.
- **Focus Mode**: Upon clicking the object (the book), the camera smoothly interpolates (Lerp) to a predefined `focusedPosition` and `targetLookAt`.
- **Interaction Hand-off**:
  - **First Click**: Triggers the camera focus animation.
  - **Subsequent Clicks (while focused)**: Triggers internal object interactions (e.g., flipping pages).
  - **Scroll Out**: Disengages focus and returns to Global Mode.

## 2. Mouse Responsive Movement (Parallax)

- Use the mouse position (`state.mouse.x, y`) to slightly rotate or offset the camera, enhancing the sense of 3D depth.
- Strictly constrain the movement range to prevent excessive swaying.

## 3. Scroll Zoom & Constraints

- Map mouse wheel scrolling to the camera’s Z-axis or Zoom value.
- Implement strict `minDistance` and `maxDistance` thresholds to keep the user within the scene boundaries.
- The act of "Scrolling Out" must serve as a trigger to exit Focus Mode.

## 4. Visual Feedback (Hover Glow)

- Apply a subtle `emissive` glow effect to the object’s material on hover.
- Use the `useCursor` hook to dynamically change the pointer state.

# Technical Implementation Guidelines

- **Modularity**: The camera logic must be encapsulated in a `CameraController` component for declarative use inside the main `Canvas`.
- **Smooth Interpolation**: All transitions must use `maath` library’s `damp` functions or Three.js `lerp` for seamless motion.
- **State Management**: Manage states like `isFocused` and `isTransitioning` to prevent overlapping interactions or logic conflicts during animations.

# Output Format

Provide the complete code for `CameraController.jsx` and a guide on how to integrate it with the main component. Include detailed comments for each logic section (parallax formulas, focus transition conditions).
