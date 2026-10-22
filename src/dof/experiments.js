// src/dof/experiments.js
// DOF Experiment Manager — create, configure, save, reload, duplicate, compare experiments.
//
// Storage: IndexedDB (database: 'dof-experiments', store: 'experiments')
// Export: JSON configuration, JSON/CSV results
// Validation: schemas checked on import; invalid configs rejected with user-facing errors.
//
// Public API:
//   export function createExperimentsModule(container) → { destroy(), getExperiments() }

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

const DB_NAME = "dof-experiments";
const DB_VERSION = 1;
const STORE = "experiments";

function openDb() {
  return new Promise((resolve, reject) => {
    const idb = window.indexedDB || globalThis.indexedDB;
    const req = idb.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function dbGetAll() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function dbPut(obj) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).put(obj);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function dbDelete(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

// ---------------------------------------------------------------------------
// Experiment schema
// ---------------------------------------------------------------------------

/** Generate a random ID. */
function genId() {
  return `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Create a blank experiment object. */
function blankExperiment(overrides = {}) {
  return {
    id: genId(),
    name: "Untitled Experiment",
    description: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    config: {
      environment: "GridWorld-10x10",
      policy: "qlearn",
      alpha: 0.1,
      gamma: 0.95,
      epsilon: 0.3,
      decay: 0.995,
      episodes: 500,
      trials: 3,
      seed: 42,
      stochastic: false,
    },
    results: [], // [{trialIndex, seed, episodes, totalReward, success, steps, policy}]
    status: "draft", // draft | running | complete | error
    ...overrides,
  };
}

/** Validate a config object. Returns { valid, errors: string[] }. */
function validateConfig(cfg) {
  const errors = [];
  const check = (cond, msg) => {
    if (!cond) errors.push(msg);
  };

  check(typeof cfg === "object" && cfg !== null, "Config must be an object");
  if (errors.length) return { valid: false, errors };

  check(
    typeof cfg.environment === "string" && cfg.environment.length > 0,
    "environment must be a non-empty string",
  );
  check(
    ["qlearn", "greedy", "random"].includes(cfg.policy),
    "policy must be one of: qlearn, greedy, random",
  );
  check(
    typeof cfg.alpha === "number" && cfg.alpha > 0 && cfg.alpha <= 1,
    "alpha must be a number in (0, 1]",
  );
  check(
    typeof cfg.gamma === "number" && cfg.gamma >= 0 && cfg.gamma <= 1,
    "gamma must be a number in [0, 1]",
  );
  check(
    typeof cfg.epsilon === "number" && cfg.epsilon >= 0 && cfg.epsilon <= 1,
    "epsilon must be a number in [0, 1]",
  );
  check(
    typeof cfg.episodes === "number" &&
      Number.isInteger(cfg.episodes) &&
      cfg.episodes >= 1,
    "episodes must be a positive integer",
  );
  check(
    typeof cfg.trials === "number" &&
      Number.isInteger(cfg.trials) &&
      cfg.trials >= 1,
    "trials must be a positive integer",
  );
  check(
    typeof cfg.seed === "number" && Number.isInteger(cfg.seed) && cfg.seed >= 0,
    "seed must be a non-negative integer",
  );

  return { valid: errors.length === 0, errors };
}

/** Validate a full imported experiment record. */
function validateImport(obj) {
  const errors = [];
  if (typeof obj !== "object" || obj === null) {
    return { valid: false, errors: ["Import must be a JSON object"] };
  }
  if (typeof obj.name !== "string") errors.push("name must be a string");
  if (obj.config === undefined) errors.push("config is required");
  else {
    const cv = validateConfig(obj.config);
    if (!cv.valid) errors.push(...cv.errors.map((e) => "config." + e));
  }
  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Inline GridWorld + Q-learning runner (self-contained subset)
// ---------------------------------------------------------------------------

class _GridWorldRunner {
  constructor(cfg) {
    this.rows = 10;
    this.cols = 10;
    this.maxSteps = 200;
    this.stochastic = cfg.stochastic ?? false;
    const wallDefs = [];
    for (let c = 1; c <= 5; c++) wallDefs.push([2, c]);
    for (let c = 4; c <= 8; c++) wallDefs.push([5, c]);
    for (let c = 0; c <= 3; c++) wallDefs.push([7, c]);
    this.walls = new Set(wallDefs.map(([r, c]) => r * this.cols + c));
    this.start = [0, 0];
    this.goal = [9, 9];
    this.agentPos = [...this.start];
    this._steps = 0;
  }
  _key(r, c) {
    return r * this.cols + c;
  }
  stateIndex([r, c]) {
    return r * this.cols + c;
  }
  isWall(r, c) {
    return this.walls.has(this._key(r, c));
  }
  isOOB(r, c) {
    return r < 0 || r >= this.rows || c < 0 || c >= this.cols;
  }
  reset() {
    this.agentPos = [...this.start];
    this._steps = 0;
    return [...this.agentPos];
  }
  step(action) {
    this._steps++;
    const deltas = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    let eff = action;
    if (this.stochastic && Math.random() < 0.1) {
      const perp = action < 2 ? [2, 3] : [0, 1];
      eff = perp[Math.random() < 0.5 ? 0 : 1];
    }
    const [dr, dc] = deltas[eff];
    const [r, c] = this.agentPos;
    const nr = r + dr,
      nc = c + dc;
    const blocked = this.isOOB(nr, nc) || this.isWall(nr, nc);
    if (!blocked) this.agentPos = [nr, nc];
    const atGoal =
      this.agentPos[0] === this.goal[0] && this.agentPos[1] === this.goal[1];
    let reward = -1;
    if (blocked) reward -= 5;
    if (atGoal) reward += 10;
    const done = atGoal || this._steps >= this.maxSteps;
    return {
      nextState: [...this.agentPos],
      reward,
      done,
      info: { success: atGoal },
    };
  }
}

function _runExperimentTrial(cfg, seedOffset = 0) {
  // Seeded pseudo-random (simple LCG for reproducibility)
  let rng = cfg.seed + seedOffset;
  const rand = () => {
    rng = (rng * 1664525 + 1013904223) & 0xffffffff;
    return (rng >>> 0) / 0x100000000;
  };

  const env = new _GridWorldRunner(cfg);
  const N = 100 * 4; // states × actions
  const qtable = new Float64Array(N);
  const { alpha, gamma, epsilon, decay, episodes, policy } = cfg;

  let eps = epsilon;
  let totalReward = 0,
    successes = 0;

  for (let ep = 0; ep < episodes; ep++) {
    let state = env.reset();
    let done = false;

    while (!done) {
      let action;
      if (policy === "random") {
        action = Math.floor(rand() * 4);
      } else if (policy === "greedy") {
        const [r, c] = state,
          [gr, gc] = env.goal;
        let best = -Infinity,
          ba = 0;
        [
          [r - 1, c],
          [r + 1, c],
          [r, c - 1],
          [r, c + 1],
        ].forEach(([nr, nc], a) => {
          const d =
            env.isOOB(nr, nc) || env.isWall(nr, nc)
              ? Infinity
              : Math.abs(nr - gr) + Math.abs(nc - gc);
          if (-d > best) {
            best = -d;
            ba = a;
          }
        });
        action = ba;
      } else {
        // ε-greedy Q
        if (rand() < eps) {
          action = Math.floor(rand() * 4);
        } else {
          const si = env.stateIndex(state);
          const base = si * 4;
          let bi = 0;
          for (let a = 1; a < 4; a++)
            if (qtable[base + a] > qtable[base + bi]) bi = a;
          action = bi;
        }
      }

      const si = env.stateIndex(state);
      const { nextState, reward, done: isDone } = env.step(action);
      const nsi = env.stateIndex(nextState);
      const base = nsi * 4;
      let maxQ = qtable[base];
      for (let a = 1; a < 4; a++)
        if (qtable[base + a] > maxQ) maxQ = qtable[base + a];
      qtable[si * 4 + action] +=
        alpha *
        (reward + gamma * (isDone ? 0 : maxQ) - qtable[si * 4 + action]);

      totalReward += reward;
      state = nextState;
      done = isDone;
    }

    if (env.agentPos[0] === env.goal[0] && env.agentPos[1] === env.goal[1])
      successes++;
    eps *= decay;
  }

  return {
    totalReward,
    successRate: successes / episodes,
    successCount: successes,
    episodes,
    avgReward: totalReward / episodes,
  };
}

// ---------------------------------------------------------------------------
// Module entry point
// ---------------------------------------------------------------------------

export function createExperimentsModule(container) {
  let experiments = []; // current list
  let selected = null; // selected experiment id
  let running = false;

  // ── DOM ────────────────────────────────────────────────
  container.innerHTML = `
<div class="expLab" aria-label="Experiment Manager">

  <!-- Left: experiment list -->
  <aside class="expSidebar">
    <div class="expSidebarHead">
      <h2>Experiments</h2>
      <button id="expNewBtn" class="primary" title="New experiment">+ New</button>
    </div>
    <div id="expList" class="expList" role="list" aria-label="Experiment list">
      <div class="expEmpty">No experiments yet. Press <strong>+ New</strong> to create one.</div>
    </div>
    <div class="expSidebarFoot">
      <button id="expImportBtn" class="wide">↑ Import JSON</button>
      <input id="expImportInput" type="file" accept=".json" hidden>
    </div>
  </aside>

  <!-- Right: detail panel -->
  <main class="expMain">
    <div id="expWelcome" class="expWelcome">
      <h3>Experiment Manager</h3>
      <p>Create and manage reproducible experiments. Configure policies, hyperparameters and trial counts. Results are stored locally in your browser (IndexedDB).</p>
      <p class="note">Each experiment records its configuration, seed, policy, trial outcomes and computed metrics. Import or export as JSON. Results are exported as CSV.</p>
    </div>

    <div id="expDetail" class="expDetail" hidden>

      <div class="expDetailHead">
        <div>
          <input id="expName" class="expNameInput" type="text" placeholder="Experiment name">
          <span id="expStatus" class="expStatusBadge"></span>
        </div>
        <div class="expDetailActions">
          <button id="expSaveBtn" class="primary">Save</button>
          <button id="expRunBtn" class="primary">▶ Run</button>
          <button id="expDuplicateBtn">Duplicate</button>
          <button id="expExportCfgBtn">Export config JSON</button>
          <button id="expExportCsvBtn">Export results CSV</button>
          <button id="expDeleteBtn" class="danger">Delete</button>
        </div>
      </div>

      <textarea id="expDesc" class="expDesc" placeholder="Description (optional)"></textarea>

      <h3>Configuration</h3>
      <div class="expConfigGrid">
        <label>Environment
          <select id="expEnv">
            <option value="GridWorld-10x10" selected>GridWorld 10×10</option>
          </select>
        </label>
        <label>Policy
          <select id="expPolicy">
            <option value="qlearn" selected>Q-Learning</option>
            <option value="greedy">Greedy (Manhattan)</option>
            <option value="random">Random</option>
          </select>
        </label>
        <label>Seed <input id="expSeed" type="number" min="0" value="42"></label>
        <label>Trials <input id="expTrials" type="number" min="1" max="20" value="3"></label>
        <label>Episodes/trial <input id="expEpisodes" type="number" min="100" max="5000" step="100" value="500"></label>
        <label title="Learning rate">α <input id="expAlpha" type="number" min="0.01" max="1" step="0.01" value="0.10"></label>
        <label title="Discount factor">γ <input id="expGamma" type="number" min="0" max="1" step="0.01" value="0.95"></label>
        <label title="Exploration rate">ε <input id="expEpsilon" type="number" min="0.01" max="1" step="0.01" value="0.30"></label>
        <label title="Epsilon decay per episode">ε-decay <input id="expDecay" type="number" min="0.99" max="1" step="0.001" value="0.995"></label>
        <label>Stochastic <input id="expStochastic" type="checkbox"></label>
      </div>

      <div id="expRunStatus" class="expRunStatus" hidden role="status"></div>

      <h3>Results <span id="expResultCount" class="note"></span></h3>
      <div id="expResultsTable" class="expResultsTable">
        <div class="expEmpty">No results yet. Press <strong>▶ Run</strong> to execute trials.</div>
      </div>

      <div id="expMetrics" hidden>
        <h3>Aggregate Metrics</h3>
        <div class="expMetricsGrid" id="expMetricsGrid"></div>
      </div>
    </div>
  </main>
</div>
`;

  // ── DOM refs ───────────────────────────────────────────
  const $ = (id) => container.querySelector(`#${id}`);

  const expList = $("expList");
  const expWelcome = $("expWelcome");
  const expDetail = $("expDetail");
  const expName = $("expName");
  const expDesc = $("expDesc");
  const expStatus = $("expStatus");
  const expSaveBtn = $("expSaveBtn");
  const expRunBtn = $("expRunBtn");
  const expDupBtn = $("expDuplicateBtn");
  const expExportCfg = $("expExportCfgBtn");
  const expExportCsv = $("expExportCsvBtn");
  const expDeleteBtn = $("expDeleteBtn");
  const expRunStatus = $("expRunStatus");
  const expResultsTable = $("expResultsTable");
  const expMetrics = $("expMetrics");
  const expMetricsGrid = $("expMetricsGrid");
  const expResultCount = $("expResultCount");
  const importBtn = $("expImportBtn");
  const importInput = $("expImportInput");

  // Config fields
  const fEnv = $("expEnv");
  const fPolicy = $("expPolicy");
  const fSeed = $("expSeed");
  const fTrials = $("expTrials");
  const fEpisodes = $("expEpisodes");
  const fAlpha = $("expAlpha");
  const fGamma = $("expGamma");
  const fEpsilon = $("expEpsilon");
  const fDecay = $("expDecay");
  const fStochastic = $("expStochastic");

  // ── Load from DB ────────────────────────────────────────

  async function loadAll() {
    try {
      experiments = await dbGetAll();
      experiments.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      renderList();
    } catch (err) {
      console.error("DOF Experiments: IndexedDB load failed", err);
      setRunStatus("Storage unavailable: " + err.message, "error");
    }
  }

  // ── Render list ────────────────────────────────────────

  function renderList() {
    if (experiments.length === 0) {
      expList.innerHTML =
        '<div class="expEmpty">No experiments yet. Press <strong>+ New</strong> to create one.</div>';
      return;
    }
    expList.innerHTML = experiments
      .map(
        (ex) => `
<div class="expListItem ${ex.id === selected ? "expListItem--active" : ""}"
     role="listitem" data-id="${ex.id}" tabindex="0"
     aria-label="${ex.name}, status: ${ex.status}">
  <div class="expListItemName">${ex.name}</div>
  <div class="expListItemMeta">
    <span class="expStatusBadge expStatusBadge--${ex.status}">${ex.status}</span>
    <span class="note">${ex.results.length} trial${ex.results.length !== 1 ? "s" : ""}</span>
  </div>
</div>`,
      )
      .join("");

    expList.querySelectorAll(".expListItem").forEach((el) => {
      const activate = () => selectExperiment(el.dataset.id);
      el.addEventListener("click", activate);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") activate();
      });
    });
  }

  // ── Select experiment ──────────────────────────────────

  function selectExperiment(id) {
    selected = id;
    const ex = experiments.find((e) => e.id === id);
    if (!ex) return;
    renderList();

    expWelcome.hidden = true;
    expDetail.hidden = false;
    expName.value = ex.name;
    expDesc.value = ex.description || "";

    fEnv.value = ex.config.environment;
    fPolicy.value = ex.config.policy;
    fSeed.value = ex.config.seed;
    fTrials.value = ex.config.trials;
    fEpisodes.value = ex.config.episodes;
    fAlpha.value = ex.config.alpha;
    fGamma.value = ex.config.gamma;
    fEpsilon.value = ex.config.epsilon;
    fDecay.value = ex.config.decay;
    fStochastic.checked = ex.config.stochastic;

    setStatusBadge(ex.status);
    renderResults(ex);
    expRunStatus.hidden = true;
  }

  function setStatusBadge(status) {
    expStatus.textContent = status;
    expStatus.className = `expStatusBadge expStatusBadge--${status}`;
  }

  // ── Read config from DOM ───────────────────────────────

  function readConfig() {
    return {
      environment: fEnv.value,
      policy: fPolicy.value,
      seed: parseInt(fSeed.value, 10),
      trials: parseInt(fTrials.value, 10),
      episodes: parseInt(fEpisodes.value, 10),
      alpha: parseFloat(fAlpha.value),
      gamma: parseFloat(fGamma.value),
      epsilon: parseFloat(fEpsilon.value),
      decay: parseFloat(fDecay.value),
      stochastic: fStochastic.checked,
    };
  }

  // ── Render results ─────────────────────────────────────

  function renderResults(ex) {
    expResultCount.textContent = ex.results.length
      ? `(${ex.results.length} trial${ex.results.length !== 1 ? "s" : ""})`
      : "";

    if (ex.results.length === 0) {
      expResultsTable.innerHTML =
        '<div class="expEmpty">No results yet. Press <strong>▶ Run</strong> to execute trials.</div>';
      expMetrics.hidden = true;
      return;
    }

    expResultsTable.innerHTML = `
<table class="expTable" aria-label="Trial results">
  <thead>
    <tr>
      <th>Trial</th>
      <th>Policy</th>
      <th>Episodes</th>
      <th>Seed offset</th>
      <th>Successes</th>
      <th>Success rate</th>
      <th>Avg reward</th>
    </tr>
  </thead>
  <tbody>
    ${ex.results
      .map(
        (r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${r.policy}</td>
      <td>${r.episodes}</td>
      <td>${r.seedOffset}</td>
      <td>${r.successCount}</td>
      <td>${(r.successRate * 100).toFixed(1)}%</td>
      <td>${r.avgReward.toFixed(2)}</td>
    </tr>`,
      )
      .join("")}
  </tbody>
</table>`;

    // Aggregate metrics
    const rates = ex.results.map((r) => r.successRate);
    const rewards = ex.results.map((r) => r.avgReward);
    const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
    const avgRew = rewards.reduce((a, b) => a + b, 0) / rewards.length;

    expMetricsGrid.innerHTML = `
<div><small>AVG SUCCESS RATE</small><strong>${(avgRate * 100).toFixed(1)}%</strong></div>
<div><small>AVG REWARD / EP</small><strong>${avgRew.toFixed(2)}</strong></div>
<div><small>TRIALS</small><strong>${ex.results.length}</strong></div>
<div><small>TOTAL EPISODES</small><strong>${ex.results.reduce((a, r) => a + r.episodes, 0).toLocaleString()}</strong></div>
`;
    expMetrics.hidden = false;
  }

  // ── CRUD ───────────────────────────────────────────────

  $("expNewBtn").addEventListener("click", async () => {
    const ex = blankExperiment({
      name: `Experiment ${experiments.length + 1}`,
    });
    try {
      await dbPut(ex);
      experiments.unshift(ex);
      renderList();
      selectExperiment(ex.id);
    } catch (err) {
      window.alert("Failed to save: " + err.message);
    }
  });

  expSaveBtn.addEventListener("click", async () => {
    if (!selected) return;
    const idx = experiments.findIndex((e) => e.id === selected);
    if (idx === -1) return;
    const cfg = readConfig();
    const cv = validateConfig(cfg);
    if (!cv.valid) {
      window.alert("Config errors:\n" + cv.errors.join("\n"));
      return;
    }

    experiments[idx] = {
      ...experiments[idx],
      name: expName.value.trim() || "Untitled",
      description: expDesc.value,
      config: cfg,
      updatedAt: new Date().toISOString(),
    };
    try {
      await dbPut(experiments[idx]);
      renderList();
      setStatusBadge(experiments[idx].status);
    } catch (err) {
      window.alert("Save failed: " + err.message);
    }
  });

  expDeleteBtn.addEventListener("click", async () => {
    if (!selected) return;
    if (!window.confirm("Delete this experiment? This cannot be undone."))
      return;
    try {
      await dbDelete(selected);
      experiments = experiments.filter((e) => e.id !== selected);
      selected = null;
      expDetail.hidden = true;
      expWelcome.hidden = false;
      renderList();
    } catch (err) {
      window.alert("Delete failed: " + err.message);
    }
  });

  expDupBtn.addEventListener("click", async () => {
    if (!selected) return;
    const src = experiments.find((e) => e.id === selected);
    if (!src) return;
    const dup = blankExperiment({
      name: src.name + " (copy)",
      description: src.description,
      config: { ...src.config },
    });
    try {
      await dbPut(dup);
      experiments.unshift(dup);
      renderList();
      selectExperiment(dup.id);
    } catch (err) {
      window.alert("Duplicate failed: " + err.message);
    }
  });

  // ── Run ────────────────────────────────────────────────

  function setRunStatus(msg, type = "") {
    expRunStatus.hidden = false;
    expRunStatus.textContent = msg;
    expRunStatus.className = "expRunStatus expRunStatus--" + (type || "info");
  }

  expRunBtn.addEventListener("click", async () => {
    if (!selected || running) return;

    // Save first
    await expSaveBtn.click();
    const ex = experiments.find((e) => e.id === selected);
    if (!ex) return;

    const cfg = ex.config;
    const cv = validateConfig(cfg);
    if (!cv.valid) {
      window.alert("Fix config errors first:\n" + cv.errors.join("\n"));
      return;
    }

    running = true;
    expRunBtn.disabled = true;
    ex.status = "running";
    ex.results = [];
    setStatusBadge("running");
    renderResults(ex);

    try {
      for (let t = 0; t < cfg.trials; t++) {
        setRunStatus(`Running trial ${t + 1} of ${cfg.trials}…`);
        // Yield to browser between trials
        await new Promise((r) => setTimeout(r, 0));
        const result = _runExperimentTrial(cfg, t);
        ex.results.push({
          trialIndex: t,
          seedOffset: t,
          policy: cfg.policy,
          episodes: cfg.episodes,
          ...result,
        });
        renderResults(ex);
      }
      ex.status = "complete";
      ex.updatedAt = new Date().toISOString();
      await dbPut(ex);
      setStatusBadge("complete");
      setRunStatus(`✓ ${cfg.trials} trial(s) complete.`, "ok");
      renderList();
    } catch (err) {
      ex.status = "error";
      setStatusBadge("error");
      setRunStatus("Error: " + err.message, "error");
    } finally {
      running = false;
      expRunBtn.disabled = false;
    }
  });

  // ── Export ─────────────────────────────────────────────

  function download(content, filename, mime) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  expExportCfg.addEventListener("click", () => {
    if (!selected) return;
    const ex = experiments.find((e) => e.id === selected);
    if (!ex) return;
    const { id: _id, results: _r, status: _s, ...cfg } = ex;
    download(
      JSON.stringify(cfg, null, 2),
      `${ex.name}.config.json`,
      "application/json",
    );
  });

  expExportCsv.addEventListener("click", () => {
    if (!selected) return;
    const ex = experiments.find((e) => e.id === selected);
    if (!ex || ex.results.length === 0) {
      window.alert("No results to export.");
      return;
    }
    const header =
      "trial,policy,episodes,seedOffset,successCount,successRate,avgReward";
    const rows = ex.results.map((r) =>
      [
        r.trialIndex + 1,
        r.policy,
        r.episodes,
        r.seedOffset,
        r.successCount,
        r.successRate.toFixed(4),
        r.avgReward.toFixed(4),
      ].join(","),
    );
    download(
      [header, ...rows].join("\n"),
      `${ex.name}.results.csv`,
      "text/csv",
    );
  });

  // ── Import ─────────────────────────────────────────────

  importBtn.addEventListener("click", () => importInput.click());

  importInput.addEventListener("change", async () => {
    const file = importInput.files[0];
    if (!file) return;
    importInput.value = "";

    let obj;
    try {
      obj = JSON.parse(await file.text());
    } catch {
      window.alert("Invalid JSON file.");
      return;
    }

    const { valid, errors } = validateImport(obj);
    if (!valid) {
      window.alert("Import validation failed:\n" + errors.join("\n"));
      return;
    }

    const ex = blankExperiment({
      name: (obj.name || "Imported") + " (imported)",
      description: obj.description || "",
      config: obj.config,
    });

    try {
      await dbPut(ex);
      experiments.unshift(ex);
      renderList();
      selectExperiment(ex.id);
    } catch (err) {
      window.alert("Failed to save import: " + err.message);
    }
  });

  // ── Init ───────────────────────────────────────────────
  loadAll();

  return {
    destroy() {
      container.innerHTML = "";
    },
    getExperiments() {
      return experiments;
    },
  };
}
