// src/dof/tutorials.js
// DOF Tutorials & Research Workspace — interactive tutorials connecting to live modules.
//
// Each tutorial is structured content with step-by-step instructions, assumptions,
// limitations, and direct links to the relevant live application features.
//
// Public API:
//   export function createTutorialsModule(container, nav) → { destroy() }
//   nav: { switchTo(moduleId: string) } — for deep-linking to other modules

// ---------------------------------------------------------------------------
// Tutorial content definitions
// ---------------------------------------------------------------------------

const TUTORIALS = [
  {
    id: "navigation-basics",
    title: "Navigation & Path Planning",
    category: "Planning",
    difficulty: "Beginner",
    duration: "5 min",
    summary:
      "Understand how A* finds paths through a grid environment. Set start and goal cells, add obstacles and observe how the explored frontier expands.",
    module: "planning",
    steps: [
      {
        title: "Open the Motion Planning module",
        body: `Switch to the <strong>Motion Planning</strong> module using the navigation rail. You will see a grid with start (green) and goal (red) cells.`,
        action: { label: "Open Motion Planning", moduleId: "planning" },
      },
      {
        title: "Place start and goal cells",
        body: `Click a cell on the grid to set the <strong>start</strong> position. Then click a different cell to set the <strong>goal</strong>. The algorithm will search for the shortest path between them.`,
      },
      {
        title: "Add obstacles",
        body: `Click empty cells to toggle them as <strong>obstacles</strong> (grey cells). Obstacles block the path. The algorithm must route around them. Try creating a wall that forces a longer route.`,
      },
      {
        title: "Run A*",
        body: `Press <strong>Find Path</strong> to run the A* algorithm. Watch the frontier expand (yellow/orange cells) before the shortest path (blue cells) is highlighted. The sidebar shows explored node count and path length.`,
      },
      {
        title: "Impossible paths",
        body: `Surround the goal completely with obstacles and run again. The algorithm will explore all reachable cells and correctly report that no path exists. The application never invents a path.`,
      },
      {
        title: "Assumptions and limitations",
        body: `
<ul>
  <li>Grid navigation only — not 3D collision avoidance.</li>
  <li>Diagonal moves are optional (toggleable).</li>
  <li>Heuristic: octile distance for 8-directional, Manhattan for 4-directional.</li>
  <li>No kinodynamic constraints — the agent can move to any adjacent free cell.</li>
  <li>The algorithm is correct for grid graphs but does not generalise to continuous configuration space.</li>
</ul>`,
      },
    ],
  },

  {
    id: "agent-evaluation",
    title: "Agent Evaluation & Baselines",
    category: "Agent Lab",
    difficulty: "Beginner",
    duration: "8 min",
    summary:
      "Evaluate and compare three baseline policies — Random, Greedy (Manhattan), and Q-Learning — on a 10×10 GridWorld. Understand what each policy does and where it fails.",
    module: "agent",
    steps: [
      {
        title: "Open the Agent Lab",
        body: `Switch to the <strong>Agent Lab</strong> module. You will see the 10×10 GridWorld with start (green), goal (blue) and wall cells (grey).`,
        action: { label: "Open Agent Lab", moduleId: "agent" },
      },
      {
        title: "Run the Random policy",
        body: `Select <strong>Random</strong> from the Policy selector and press <strong>Run Single Episode</strong>. The agent picks a random action at each step. Because it ignores the goal, it rarely succeeds before the step limit.`,
      },
      {
        title: "Run the Greedy policy",
        body: `Select <strong>Greedy (Manhattan)</strong> and run an episode. The agent always moves toward the goal by Manhattan distance. It works in open grids but gets stuck in dead-ends formed by walls — the documented limitation is shown in the warning panel.`,
      },
      {
        title: "Understand Q-Learning",
        body: `Select <strong>Q-Learning</strong>. The Q-table stores learned values for each (state, action) pair. During training, the agent explores with ε-greedy action selection and updates Q-values using the Bellman equation: Q(s,a) ← Q(s,a) + α(r + γ·max Q(s',·) − Q(s,a)).`,
      },
      {
        title: "Train the Q-Learning agent",
        body: `Press <strong>▶ Train</strong>. The agent runs the configured number of episodes. Reward and episode length charts update as training progresses. After training completes, use <strong>Evaluate</strong> to run greedy episodes and compare with the training statistics.`,
      },
      {
        title: "Inspect the Q-table",
        body: `With <strong>Show policy arrows</strong> checked, policy arrows on the grid show the greedy action for each cell according to the current Q-table. Brighter blue cells have higher Q-values. The agent learns to route around walls.`,
      },
      {
        title: "Assumptions and limitations",
        body: `
<ul>
  <li>GridWorld is a simplified environment — not a continuous robot workspace.</li>
  <li>Q-learning is tabular — it does not generalise to unseen states or large state spaces.</li>
  <li>The stochastic mode (10% action slip) tests robustness but increases learning difficulty.</li>
  <li>Greedy policy can oscillate permanently in certain wall configurations — this is documented behaviour, not a bug.</li>
  <li>Episode rewards and success counts are real; no results are fabricated.</li>
</ul>`,
      },
    ],
  },

  {
    id: "reinforcement-learning",
    title: "Reinforcement Learning with Q-Learning",
    category: "Agent Lab",
    difficulty: "Intermediate",
    duration: "12 min",
    summary:
      "A technical walkthrough of tabular Q-learning: the Bellman update, exploration vs exploitation, ε-decay, and hyperparameter effects.",
    module: "agent",
    steps: [
      {
        title: "The reward structure",
        body: `The GridWorld environment uses a simple reward function: <strong>−1</strong> per step (encourages efficiency), <strong>−5</strong> for hitting a wall, <strong>+10</strong> on reaching the goal. Terminal conditions: goal reached, or step limit (200) exceeded.`,
      },
      {
        title: "The Q-table",
        body: `The Q-table is a Float64Array of size 100×4 (100 states × 4 actions). It is initialised to zero. Each entry Q(s,a) represents the expected cumulative discounted return from state s, taking action a, then following the current policy.`,
      },
      {
        title: "The Bellman update",
        body: `At each step, the Q-value is updated:
<pre>Q(s,a) ← Q(s,a) + α · (r + γ · max_a' Q(s',a') − Q(s,a))</pre>
Where α is the learning rate, γ is the discount factor, r is the immediate reward, and s' is the next state.`,
      },
      {
        title: "Exploration vs exploitation (ε-greedy)",
        body: `With probability ε, the agent picks a random action (exploration). Otherwise it picks the action with highest Q-value (exploitation). Exploration is critical early in training; ε decays each episode by the configured decay factor.`,
      },
      {
        title: "Effect of hyperparameters",
        body: `Try different values:
<ul>
  <li><strong>High α (0.5):</strong> faster learning but noisier Q-values.</li>
  <li><strong>Low γ (0.5):</strong> agent is myopic — values immediate reward over long-term return.</li>
  <li><strong>High ε (0.5) with slow decay:</strong> more exploration, slower convergence.</li>
  <li><strong>Low episodes (100):</strong> insufficient training for complex paths.</li>
</ul>
All effects are observable in the reward and episode-length charts.`,
      },
      {
        title: "Evaluation on held-out episodes",
        body: `After training, press <strong>Evaluate</strong>. Evaluation runs greedy episodes (ε=0) — no exploration. Good training should yield near-100% success rate and short paths. Compare against the Greedy baseline.`,
      },
      {
        title: "Saving results as an experiment",
        body: `Switch to the <strong>Experiments</strong> module to record a full experiment with the same hyperparameters. Run multiple trials for statistical reliability. Export results as CSV for external analysis.`,
        action: { label: "Open Experiments", moduleId: "experiments" },
      },
    ],
  },

  {
    id: "perception-inference",
    title: "Image Classification with ONNX Runtime Web",
    category: "Perception",
    difficulty: "Intermediate",
    duration: "10 min",
    summary:
      "Load an ONNX model into the browser, preprocess an image, run genuine inference and interpret the results.",
    module: "perception",
    steps: [
      {
        title: "Open the Perception Lab",
        body: `Switch to the <strong>Perception Lab</strong> module. The lab allows you to load ONNX models and run inference directly in the browser using ONNX Runtime Web.`,
        action: { label: "Open Perception Lab", moduleId: "perception" },
      },
      {
        title: "Load MobileNetV2",
        body: `The default model URL is MobileNetV2 pre-trained on ImageNet 1000 classes. Press <strong>Load Model</strong>. ONNX Runtime Web will be loaded from CDN (first time) and the model fetched from HuggingFace. This may take 20–60 seconds depending on your connection.`,
      },
      {
        title: "Preprocessing: what happens to your image",
        body: `Before inference, the image is:
<ol>
  <li>Centre-cropped to a square.</li>
  <li>Resized to 224×224 pixels.</li>
  <li>Converted to Float32 in range [0, 1].</li>
  <li>Normalised: (pixel − mean) / std, using ImageNet mean [0.485, 0.456, 0.406] and std [0.229, 0.224, 0.225].</li>
  <li>Arranged in NCHW format: batch=1, channels=3, height=224, width=224.</li>
</ol>`,
      },
      {
        title: "Upload an image or use a sample",
        body: `Click <strong>Choose image file</strong> or use one of the sample images (Dog, Cat, Binoculars). The preview shows the original image. Preprocessing happens at inference time.`,
      },
      {
        title: "Run inference",
        body: `Press <strong>▶ Run Inference</strong>. The model runs in the browser via WebAssembly (or WebGPU if available). Genuine softmax probabilities are displayed for the top 5 predicted classes with confidence scores and inference timing.`,
      },
      {
        title: "Interpreting results",
        body: `The top-1 label and confidence are the model's best prediction. A low top-1 confidence (< 30%) means the model is uncertain — this is honest, not an error. ImageNet labels include 1000 classes of animals, objects and scenes.`,
      },
      {
        title: "Limitations",
        body: `
<ul>
  <li>Classification only — bounding-box detection is not implemented.</li>
  <li>MobileNetV2 is not fine-tuned for robotics objects (tools, parts, bins).</li>
  <li>Results depend on CORS policy of the model host and network availability.</li>
  <li>The WASM backend is slower than native Python inference but runs entirely in-browser.</li>
  <li>No confidence scores are ever fabricated — all values derive from actual model output.</li>
</ul>`,
      },
    ],
  },

  {
    id: "experiment-reproducibility",
    title: "Reproducible Experiments",
    category: "Experiments",
    difficulty: "Beginner",
    duration: "7 min",
    summary:
      "Create a fully reproducible experiment: configure it, run multiple trials, save results, and export for analysis.",
    module: "experiments",
    steps: [
      {
        title: "Open the Experiment Manager",
        body: `Switch to the <strong>Experiments</strong> module. Experiments are stored in your browser\'s IndexedDB — they persist across page reloads.`,
        action: { label: "Open Experiments", moduleId: "experiments" },
      },
      {
        title: "Create a new experiment",
        body: `Press <strong>+ New</strong>. Give it a descriptive name like "Q-Learning Baseline α=0.1". Add a description explaining what you are testing.`,
      },
      {
        title: "Configure hyperparameters",
        body: `Set the policy (Q-Learning, Greedy, or Random), seed, number of trials, episodes per trial and learning parameters. The seed ensures reproducibility — the same seed produces the same trial results.`,
      },
      {
        title: "Run trials",
        body: `Press <strong>▶ Run</strong>. Each trial is an independent run with a different seed offset. Results are shown in the table as they complete. Success rate and average reward are computed from actual episode outcomes.`,
      },
      {
        title: "Aggregate metrics",
        body: `After all trials complete, the <strong>Aggregate Metrics</strong> section shows mean success rate and mean reward across trials. The sample size (total episodes) is always displayed.`,
      },
      {
        title: "Export results",
        body: `Press <strong>Export results CSV</strong> to download all trial data. Press <strong>Export config JSON</strong> to save the configuration for sharing or reimport. Imported configurations are validated before being added.`,
      },
      {
        title: "Compare in Analytics",
        body: `Run another experiment with a different policy and compare them in the <strong>Analytics</strong> module. Policy-level comparisons show success rates and rewards across all recorded trials.`,
        action: { label: "Open Analytics", moduleId: "analytics" },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

function renderTutorialCard(tut) {
  return `
<div class="tutCard" data-id="${tut.id}" role="listitem" tabindex="0"
     aria-label="${tut.title}, ${tut.difficulty}, ${tut.duration}">
  <div class="tutCardHeader">
    <span class="tutTag tutTag--${tut.category.toLowerCase().replace(/\s/g, "-")}">${tut.category}</span>
    <span class="tutDifficulty">${tut.difficulty}</span>
    <span class="tutDuration">${tut.duration}</span>
  </div>
  <h4>${tut.title}</h4>
  <p class="note">${tut.summary}</p>
</div>`;
}

function renderStep(step, index, total, nav) {
  const actionBtn = step.action
    ? `<button class="tutActionBtn" data-module="${step.action.moduleId}">${step.action.label} →</button>`
    : "";
  return `
<div class="tutStep">
  <div class="tutStepNum">Step ${index + 1} of ${total}</div>
  <h4>${step.title}</h4>
  <div class="tutStepBody">${step.body}</div>
  ${actionBtn}
</div>`;
}

// ---------------------------------------------------------------------------
// Module entry point
// ---------------------------------------------------------------------------

export function createTutorialsModule(container, nav) {
  let activeTutId = null;
  let activeStep = 0;

  container.innerHTML = `
<div class="tutLab" aria-label="Tutorials and Research Workspace">
  <aside class="tutSidebar">
    <h2>Tutorials</h2>
    <p class="note">Step-by-step guides connecting to live application features. Each tutorial states its assumptions and limitations honestly.</p>
    <div class="tutList" id="tutList" role="list" aria-label="Tutorial list">
      ${TUTORIALS.map(renderTutorialCard).join("")}
    </div>
  </aside>

  <main class="tutMain">
    <div id="tutWelcome" class="tutWelcome">
      <h3>Research Workspace</h3>
      <p>Select a tutorial on the left to begin. Each tutorial walks you through a live feature of DOF with step-by-step instructions, algorithm details and honest documentation of limitations.</p>

      <div class="tutQuickRef">
        <h4>Quick Reference</h4>
        <div class="tutQuickRefGrid">
          <div class="tutQuickCard">
            <strong>Planning</strong>
            <p>A* on a 20×20 grid. 4- or 8-directional. Diagonal moves optional. Heuristic: octile / Manhattan.</p>
          </div>
          <div class="tutQuickCard">
            <strong>Agent Lab</strong>
            <p>10×10 GridWorld. 4 actions. Tabular Q-learning. ε-greedy with decay. 100 states × 4 actions Q-table.</p>
          </div>
          <div class="tutQuickCard">
            <strong>Perception</strong>
            <p>ONNX Runtime Web (WASM/WebGPU). MobileNetV2 classifier. ImageNet-1K. Centre-crop 224×224. CHW normalised.</p>
          </div>
          <div class="tutQuickCard">
            <strong>Experiments</strong>
            <p>IndexedDB persistence. Reproducible seeds. Multi-trial. JSON config export. CSV result export.</p>
          </div>
        </div>
      </div>

      <div class="tutAlgorithmRef">
        <h4>Algorithm Reference</h4>
        <details>
          <summary>A* path planning</summary>
          <div class="tutAlgoContent">
            <p>A* maintains an open set (priority queue keyed on f = g + h) and a closed set. At each iteration the node with minimum f is expanded. Neighbours are added to the open set with updated g-costs if not already closed or with better cost. The algorithm terminates when the goal is dequeued or the open set is empty (no path).</p>
            <p><strong>Heuristic:</strong> octile distance (allows diagonal) or Manhattan (4-directional only). Both are admissible — A* is guaranteed to find the optimal path.</p>
          </div>
        </details>
        <details>
          <summary>Tabular Q-learning</summary>
          <div class="tutAlgoContent">
            <p>Q-learning is an off-policy temporal difference algorithm. The Q-table Q(s,a) is updated at each step:</p>
            <pre>Q(s,a) ← Q(s,a) + α · (r + γ · max_a' Q(s',a') − Q(s,a))</pre>
            <p>The TD error is <code>r + γ · max Q(s',·) − Q(s,a)</code>. With sufficient exploration and a decaying learning rate, Q-learning converges to the optimal Q-function for finite MDPs.</p>
            <p><strong>Convergence conditions:</strong> every (s,a) pair must be visited infinitely often; α must decay to zero at an appropriate rate. In practice, finite training with fixed α produces near-optimal policies for small GridWorlds.</p>
          </div>
        </details>
        <details>
          <summary>ONNX Runtime Web</summary>
          <div class="tutAlgoContent">
            <p>ONNX Runtime Web runs ONNX-format models in the browser using WebAssembly (wasm backend) or WebGPU (gpu backend). Models are fetched from a URL and compiled at load time. Inference runs entirely client-side — no data leaves the browser.</p>
            <p><strong>Supported ops:</strong> the wasm backend supports most standard ONNX operators. Some custom ops or very new operators may not be supported. The Perception Lab uses opset 10+ models.</p>
            <p><strong>Performance:</strong> WASM inference is typically 5–50× slower than native Python+PyTorch but requires no server or GPU.</p>
          </div>
        </details>
      </div>
    </div>

    <div id="tutReader" class="tutReader" hidden>
      <div class="tutReaderHead">
        <button id="tutBackBtn" class="wide">← Back to tutorials</button>
        <div>
          <span id="tutReaderCategory" class="tutTag"></span>
          <span id="tutReaderDifficulty" class="tutDifficulty"></span>
          <span id="tutReaderDuration" class="tutDuration"></span>
        </div>
      </div>
      <h3 id="tutReaderTitle"></h3>
      <p class="note" id="tutReaderSummary"></p>

      <div id="tutStepContainer"></div>

      <div class="tutNav">
        <button id="tutPrevBtn" disabled>← Previous</button>
        <span id="tutStepIndicator" class="note"></span>
        <button id="tutNextBtn">Next →</button>
      </div>

      <button id="tutOpenModuleBtn" class="wide primary" hidden></button>
    </div>
  </main>
</div>
`;

  const $ = (id) => container.querySelector(`#${id}`);

  const tutList = $("tutList");
  const tutWelcome = $("tutWelcome");
  const tutReader = $("tutReader");
  const tutBackBtn = $("tutBackBtn");
  const tutTitle = $("tutReaderTitle");
  const tutSummary = $("tutReaderSummary");
  const tutCategory = $("tutReaderCategory");
  const tutDifficulty = $("tutReaderDifficulty");
  const tutDuration = $("tutReaderDuration");
  const tutStepCont = $("tutStepContainer");
  const tutPrevBtn = $("tutPrevBtn");
  const tutNextBtn = $("tutNextBtn");
  const tutIndicator = $("tutStepIndicator");
  const tutOpenModule = $("tutOpenModuleBtn");

  // ── Tutorial navigation ────────────────────────────────

  function openTutorial(id) {
    const tut = TUTORIALS.find((t) => t.id === id);
    if (!tut) return;
    activeTutId = id;
    activeStep = 0;

    tutWelcome.hidden = true;
    tutReader.hidden = false;

    tutTitle.textContent = tut.title;
    tutSummary.textContent = tut.summary;
    tutCategory.textContent = tut.category;
    tutCategory.className = `tutTag tutTag--${tut.category.toLowerCase().replace(/\s/g, "-")}`;
    tutDifficulty.textContent = tut.difficulty;
    tutDuration.textContent = tut.duration;

    renderTutStep(tut, 0);
  }

  function renderTutStep(tut, stepIndex) {
    activeStep = stepIndex;
    const step = tut.steps[stepIndex];
    tutStepCont.innerHTML = renderStep(step, stepIndex, tut.steps.length, nav);

    // Wire action buttons inside step
    tutStepCont.querySelectorAll(".tutActionBtn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (nav && nav.switchTo) nav.switchTo(btn.dataset.module);
      });
    });

    tutPrevBtn.disabled = stepIndex === 0;
    tutNextBtn.disabled = stepIndex === tut.steps.length - 1;
    tutIndicator.textContent = `Step ${stepIndex + 1} of ${tut.steps.length}`;

    // Show "Open module" button
    if (tut.module && nav) {
      tutOpenModule.hidden = false;
      tutOpenModule.textContent = `Open ${tut.module.charAt(0).toUpperCase() + tut.module.slice(1)} →`;
      tutOpenModule.dataset.module = tut.module;
    } else {
      tutOpenModule.hidden = true;
    }
  }

  tutPrevBtn.addEventListener("click", () => {
    const tut = TUTORIALS.find((t) => t.id === activeTutId);
    if (!tut || activeStep <= 0) return;
    renderTutStep(tut, activeStep - 1);
  });

  tutNextBtn.addEventListener("click", () => {
    const tut = TUTORIALS.find((t) => t.id === activeTutId);
    if (!tut || activeStep >= tut.steps.length - 1) return;
    renderTutStep(tut, activeStep + 1);
  });

  tutBackBtn.addEventListener("click", () => {
    activeTutId = null;
    tutReader.hidden = true;
    tutWelcome.hidden = false;
  });

  tutOpenModule.addEventListener("click", () => {
    if (nav && nav.switchTo) nav.switchTo(tutOpenModule.dataset.module);
  });

  // ── Bind tutorial cards ────────────────────────────────

  tutList.querySelectorAll(".tutCard").forEach((card) => {
    const open = () => openTutorial(card.dataset.id);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") open();
    });
  });

  return {
    destroy() {
      container.innerHTML = "";
    },
  };
}
