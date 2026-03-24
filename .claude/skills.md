# 🛡️ Maintainability Guardian: Operational Skills & SOP

This document defines the **Standard Operating Procedures (SOP)** for the Senior Architect agent. These skills must be invoked during every interaction to ensure zero technical debt and absolute architectural integrity.

---

## 1. [Skill] The "Grep-First" Audit

**Goal:** Eliminate redundant logic and prevent code duplication (DRY principle).

- **Trigger:** Any request to add a new feature, utility, or animation behavior.
- **Procedure:**
  1. Identify the core keywords of the requested feature (e.g., `hover`, `physics`, `glow`).
  2. Execute a project-wide search: `grep -r "keyword" src/`
  3. Analyze existing patterns. If a similar implementation exists, **refactor to reuse** instead of writing new code.
  4. Report findings in the "Codebase Audit Results" section of the output.

## 2. [Skill] Three.js Architectural Integrity

**Goal:** Maintain the performance and structure of the WebGL scene.

- **Constraints:**
  - **Material Re-use:** Access `bellMaterial` and `tentacleMaterial` from the global scope. Do not instantiate new materials unless explicitly justified.
  - **Physics Constants:** All movement must strictly adhere to `STIFFNESS=120` and `DAMPING=8`. Any deviation requires a "Design Justification."
  - **Animate Loop:** Never inject heavy logic into the `requestAnimationFrame` block. Pre-calculate values outside the loop whenever possible.

## 3. [Skill] Clean Code & SRP Enforcement

**Goal:** Ensure every function is readable, modular, and has a single responsibility.

- **Rules:**
  - **Naming:** Use intention-revealing names (e.g., `updateJellyfishPosition` instead of `moveObj`).
  - **Modularization:** If a function exceeds 30 lines, it must be evaluated for "Extraction." Extract sub-logic into small, focused helper functions.
  - **No Magic Numbers:** Replace all raw numbers in Three.js math with named constants at the top of the file.

## 4. [Skill] Atomic Refactoring & Commits

**Goal:** Provide a clear, reversible history of changes.

- **Procedure:**
  1. Break down complex refactoring into **Functional Units**.
  2. After each unit of work, generate a **Conventional Commit** message:
     - `feat:` for new capabilities.
     - `refactor:` for structural changes without behavior change.
     - `clean:` for removing dead code or comments.
     - `style:` for formatting/naming changes.

## 5. [Skill] Institutional Memory Sync

**Goal:** Build long-term project knowledge in the agent's memory system.

- **Task:** Upon completing a task, identify any new architectural facts (e.g., "The glow effect logic is now centralized in `materialFactory.js`").
- **Action:** Update the `project.md` or `reference.md` in the agent's persistent memory to avoid re-discovering the same facts in future sessions.
