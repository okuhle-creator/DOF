# DOF — Degrees of Freedom
### Intelligence in Action

> **A unified AI and robotics experimentation platform for simulating intelligent systems, evaluating algorithms, and studying how agents perceive, learn, and act.**

[![Deploy DOF to GitHub Pages](https://github.com/okuhle-creator/DOF/actions/workflows/deploy.yml/badge.svg)](https://github.com/okuhle-creator/DOF/actions/workflows/deploy.yml)
[![License: GPL-3.0-only](https://img.shields.io/badge/License-GPL--3.0--only-blue.svg)](LICENSE)

DOF (Degrees of Freedom) is a browser-first, deep-tech software platform for embodied AI, robotics simulation, machine learning, and autonomous systems. DOF integrates 3D robotic arm simulation, 2D motion planning, reinforcement learning, browser-based neural perception, experiment management, and real-data analytics into a single self-contained application.

**[🚀 Launch Live Platform](https://okuhle-creator.github.io/DOF/)** · **[🤖 Simulation Studio](https://okuhle-creator.github.io/DOF/robotics-arm-studio.html)** · [Architecture](docs/architecture.md) · [Validation](docs/validation.md)

---

## Brand & Trademark Notice
*DOF* is used solely as an academic and portfolio project identity ("Degrees of Freedom", referencing physical and mechanical axes of motion in robotics). This project does not claim trademark ownership, commercial availability, or affiliation with DOF Robotics or any other commercial entity.

---

## Core Platform Modules

```
       ┌─────────────────────────────────────────────────────────────┐
       │                DOF — DEGREES OF FREEDOM                     │
       └──────────────────────────────┬──────────────────────────────┘
                                      │
  ┌─────────────────┬─────────────────┼─────────────────┬─────────────────┐
  │                 │                 │                 │                 │
┌─▼──────────────┐┌─▼──────────────┐┌─▼──────────────┐┌─▼──────────────┐┌─▼──────────────┐
│  Simulation    ││  Motion        ││  Agent &        ││  Perception   ││  Experiment    │
│  Studio        ││  Planning      ││  Policy Lab     ││  Lab          ││  Manager       │
│  Three.js +    ││  A* grid       ││  Tabular        ││  ONNX Runtime ││  IndexedDB     │
│  Cannon-ES     ││  search +      ││  Q-learning +   ││  Web (WASM/   ││  persistence,  │
│  Panda, SO-101 ││  heuristics    ││  baselines      ││  WebGPU)      ││  JSON/CSV      │
└────────────────┘└────────────────┘└────────────────┘└────────────────┘└────────────────┘
```

1. **Simulation Studio**: Full 3D kinematic and experimental dynamic robot arm simulation (Franka Panda 7-DOF, SO-101 5-DOF, UR5e 6-DOF, xArm 6 6-DOF). Real-time collision proxies, kitting cell, camera rigs (RGB feeds), and LeRobot v3 Parquet dataset capture.
2. **Motion Planning & Navigation**: Interactive A* grid search with customizable start/goal, obstacle placement, 4- and 8-directional routing, octile/Manhattan heuristics, and explored-node metrics.
3. **Agent & Policy Lab**: Reproducible 10×10 GridWorld environment. Includes Tabular Q-learning with ε-decay, greedy Manhattan baseline, random baseline, live training charts, and policy-arrow overlays.
4. **Perception Lab**: Client-side neural vision inference via ONNX Runtime Web (WASM & WebGPU). Test real models (e.g., MobileNetV2 ImageNet-1K) on uploaded or sample images with genuine class probabilities and timings.
5. **Experiment Manager**: Create, configure, execute, and compare multi-trial experiments. Stored locally in browser IndexedDB. Full JSON config import/export and CSV results export.
6. **Analytics & Evaluation**: Honest metric visualization. Plots success rates, average rewards, and trial outcome distributions derived exclusively from real trial runs.
7. **Model Registry**: Local catalogue tracking model formats, tasks, input/output tensors, preprocessing specs, and verified validation status.
8. **Tutorials & Research Workspace**: Interactive walkthroughs explaining algorithms, theoretical assumptions, mathematical formulas (Bellman equations, A* admissibility), and honest limitations.

---

## Quickstart — Run Locally in 60 Seconds

Requires **Node.js 22+**.

```sh
# 1. Clone repository
git clone https://github.com/okuhle-creator/DOF.git
cd DOF

# 2. Install dependencies
npm ci

# 3. Build & start local development server
npm start
```

Open your browser to:
- **DOF Platform:** [http://127.0.0.1:3000/](http://127.0.0.1:3000/)
- **Simulation Studio:** [http://127.0.0.1:3000/robotics-arm-studio.html](http://127.0.0.1:3000/robotics-arm-studio.html)

---

## Easy Push & Run on GitHub

The repository is pre-configured with a zero-configuration **GitHub Actions workflow** (`.github/workflows/deploy.yml`).

### To deploy your own instance to GitHub Pages:
1. **Push your code to GitHub:**
   ```sh
   git add .
   git commit -m "Deploy DOF Day 10 finale"
   git push origin main
   ```
2. **Enable GitHub Pages:**
   - In your GitHub repo, go to **Settings** → **Pages**.
   - Under **Build and deployment** → **Source**, select **GitHub Actions**.
3. **Done!**
   GitHub Actions will automatically run tests, build self-contained single-page bundles, and publish the site.

---

## Test & Build Commands

```sh
npm run build         # Bundle dist/dof.html and dist/robotics-arm-studio.html
npm test              # Run validation suite (source bindings, protocols, physics, worker)
npm run build:pages   # Prepare _site/ distribution bundle for GitHub Pages
npm run test:pages    # Playwright browser smoke test under project-path routing
npm run serve         # Run local HTTP preview server without rebuilding
```

---

## Technical Architecture & Limitations

- **Self-Contained Bundles:** `scripts/build.mjs` uses `esbuild` to embed all JS, CSS, Web Workers, 3D meshes, and licenses into standalone HTML files (`dist/dof.html` and `dist/robotics-arm-studio.html`). No Node or Python backend required at runtime.
- **Physics Fidelity:** The default robot arm simulation utilizes velocity-limited kinematic servos with collision proxies; dynamic Panda mode is experimental (Cannon-ES constraint solver), not MuJoCo-certified.
- **Perception:** ONNX Runtime Web operates client-side via WebAssembly with optional WebGPU acceleration. Large model downloads depend on user network speed and CORS settings.
- **Honest Metrics:** All charts, tables, and inference outputs derive from real client-side execution. Empty states are explicitly shown when no data exists.

---

## License & Attribution

- **DOF** (Degrees of Freedom) — A unified browser-first AI and robotics experimentation platform.
- **License:** Licensed under the [GNU General Public License v3.0 only](LICENSE) (`GPL-3.0-only`).
- Bundled third-party libraries (Three.js, Cannon-ES, LeRobot schemas, ONNX Runtime Web) retain their respective upstream licenses as detailed in `assets/third-party-notices.json`.
