Complete Technical Analysis: Interactive Three.js Leaves (TSL)
This simulation, inspired by the reference video, uses Three.js and the Three.js Shading Language (TSL) for massive particle instancing and high-performance physics computation directly on the GPU. The following is a detailed, structure-based analysis of the entire system.

1. Structure and Scene Geometry
   To achieve realistic density while maintaining performance, the system uses an InstancedMesh.

Instance Count: The simulation manages 16,384 (Math.pow(2, 14)) unique leaf instances, ensuring a dense, convincing environment.

Base Geometry: A simple new THREE.PlaneGeometry(1, 1) serves as the foundation.

Geometric Distortion (Skewing): To avoid perfectly uniform, artificial shapes, the positions of the vertices in the PlaneGeometry are manually distorted.

Vertex Index 0 & 3: positionsArray[0, 3] = positionsArray[0, 3] + 0.15; (Vertices are skewed outwards.)

Vertex Index 6 & 9: positionsArray[6, 9] = positionsArray[6, 9] - 0.15; (Vertices are skewed inwards.)

Result: This transformation results in a slightly imperfect, trapezoidal, or kite-like shape, making the leaves look organic rather than manufactured. The geometry is then rotated (rotateX(-Math.PI \* 0.5)) to lie flat against the ground plane.

2. Materials and Persistent Data
   Material: The leaves are rendered using a MeshLambertNodeMaterial set to DoubleSide.

Data Buffers (Persistent Memory): Because the simulation must maintain the state of each leaf across every frame, dedicated TSL buffers are required. These persist data between compute iterations.

positionBuffer: instancedArray(this.count, 'vec3') (Stores the current XYZ position of all 16,384 instances.)

velocityBuffer: instancedArray(this.count, 'vec3') (Stores the current XYZ velocity vector for each instance.)

3. Compute Shaders: Initialization and State Updates
   The core of the simulation runs within compute functions.

A. Init Compute (The Setup Function)
Executed once at the beginning of the simulation.

Logic: For each leaf instance (identified by its instanceIndex), a hash function generating deterministic noise is used to assign a random initial XY and Z coordinate within a large defined bounds (this.size). This creates the initial, sparse scattering effect.

B. Update Compute (The Physics Engine)
This is the main computation loop, executed on every single frame for all instances. It performs a sequence of vector operations that simulate physics.

Mouse Cursor Interaction (Push Out Force):

Input: The currentCursorPosition vector (passed from the application based on raycasting).

Calculation: cursorDelta = leafPosition.sub(currentCursorPosition)

Force: A repelling force (pushVelocity) is calculated based on the distance between the leaf and the cursor. The remapClamp function is used: leaves very close to the cursor receive the strongest force, while those beyond a certain radius are unaffected.

Result: The pushVelocity vector is added to the leaf’s velocityBuffer.

Environmental Wind (Noise-Based):

Calculation: The leaf's current 월드 XZ position, a wind frequency parameter, and a time variable (elapsedTime) are combined to sample a TSL noise texture.

Smoothing: smoothstep(0.4, 1) is applied to the noise sample to define wind bursts and calm areas.

Result: A random, undulating wind vector (windStrength) is calculated and added to the velocity (velocity.xz.add(windStrength)).

Damping (Friction and Air Resistance):

Calculation: The system calculates two damping values: groundDamping (high resistance, when position.y is 0) and airDamping (low resistance, when airborne). These are merged using max().

Result: velocity.mulAssign(float(1).sub(mergedDamping)). The leaf is slowed down over time, simulating friction.

Lift (Aerodynamics) and Gravity:

Lift Logic: Fast-moving leaves (those with high velocity.xz.length()) should rise. A lift factor (upwardMultiplier) is multiplied by the speed and added directly to the velocity.y (the vertical component).

Gravity: A constant downward acceleration (this.gravity) is subtracted from the velocity.y on every frame.

Floor Collision (The "Hard Stop"): To prevent leaves from falling through the floor, a mandatory correction is applied: position.y.assign(max(position.y, 0)). This locks the leaf to the ground plane (Y=0) if gravity would have pulled it lower.

Position Update and Infinite Looping (The "Conveyor Belt"):

Movement: position.addAssign(velocity) (The new velocity is applied to the position).

Looping: The leaf's position relative to the camera’s focusPoint is checked. If it moves beyond a defined boundary (halfSize), a modulo (mod) function is used to reset the leaf’s position to the exact opposite boundary. This creates an infinite, repeating world where the number of visible leaves remains constant.

4. Vertex Assembly and Shader Effects
   After the updates are complete, the resulting data is used to assembly the vertices for the scene.

Position Node: The material's positionNode is constructed by adding the base geometry coordinates to the resulting coordinates from the positionBuffer. This places each leaf instance in its correct calculated position.

Rotation: To create dynamic, unstable spinning (like real falling leaves), a rotation based on the leaf’s world XZ coordinates (sin) is applied. This rotation is only enabled when the leaf is above the ground, using max(leavePosition.y, 0) as a coefficient to prevent rotation when the leaf is static.

5. Instance-Specific Variety (Randomization)
   To ensure visual diversity, instance attributes are randomized outside the compute loop during initialization.

Scale: Math.random() \* 0.5 + 0.5 is used to give each leaf a random scaling factor, making the leaves vary between 50% and 100% of their base size.

Color: The simulation uses a lerp (linear interpolation) function. It defines a start color (#c4c557 - green/yellow) and an end color (#f7782b - orange). A random value for each instance smoothly transitions its color between these two points, creating a natural mix of autumn leaves.
