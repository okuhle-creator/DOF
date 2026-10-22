// src/dof/agent.js
// DOF Agent Lab — GridWorld environment with Q-learning and policy baselines

// ─────────────────────────────────────────────────────────
// GRIDWORLD ENVIRONMENT
// ─────────────────────────────────────────────────────────

/**
 * 10×10 GridWorld environment.
 *
 * Actions: 0=Up, 1=Down, 2=Left, 3=Right
 * Rewards: −1 per step, +10 on goal, −5 on wall hit
 * Terminal: goal reached OR max_steps exceeded
 *
 * Default wall pattern (non-trivial maze):
 *   Row 2: cols 1–5
 *   Row 5: cols 4–8
 *   Row 7: cols 0–3
 */
class GridWorld {
  constructor(config = {}) {
    this.rows = 10;
    this.cols = 10;
    this.maxSteps = config.maxSteps ?? 200;
    this.stochastic = config.stochastic ?? false; // 0.1 slip rate when true

    // Build the wall set from the default pattern (or config override)
    this.walls = new Set(
      (config.walls ?? GridWorld.DEFAULT_WALLS).map(([r, c]) =>
        this._key(r, c),
      ),
    );

    this.start = config.start ?? [0, 0];
    this.goal = config.goal ?? [9, 9];

    /** @type {[number,number]} Current agent position */
    this.agentPos = [...this.start];
    this._steps = 0;
  }

  /** Default wall cells as [row, col] pairs */
  static get DEFAULT_WALLS() {
    const walls = [];
    // Row 2: cols 1–5
    for (let c = 1; c <= 5; c++) walls.push([2, c]);
    // Row 5: cols 4–8
    for (let c = 4; c <= 8; c++) walls.push([5, c]);
    // Row 7: cols 0–3
    for (let c = 0; c <= 3; c++) walls.push([7, c]);
    return walls;
  }

  /** Internal grid key */
  _key(r, c) {
    return r * this.cols + c;
  }

  /** Convert [row, col] → flat integer state index */
  stateIndex([r, c]) {
    return r * this.cols + c;
  }

  /** Convert flat integer state index → [row, col] */
  indexToState(idx) {
    return [Math.floor(idx / this.cols), idx % this.cols];
  }

  /** Returns true if [r, c] is a wall cell */
  isWall(r, c) {
    return this.walls.has(this._key(r, c));
  }

  /** Returns true if [r, c] is out-of-bounds */
  isOutOfBounds(r, c) {
    return r < 0 || r >= this.rows || c < 0 || c >= this.cols;
  }

  /**
   * Compute the next position for (action) from (r, c).
   * Returns { r, c, hitWall } where hitWall indicates the move was blocked.
   */
  _transition(r, c, action) {
    const deltas = [
      [-1, 0], // 0 Up
      [1, 0], // 1 Down
      [0, -1], // 2 Left
      [0, 1], // 3 Right
    ];

    // Stochastic mode: 10% chance of slipping to a perpendicular action
    let effectiveAction = action;
    if (this.stochastic && Math.random() < 0.1) {
      const perp = action < 2 ? [2, 3] : [0, 1];
      effectiveAction = perp[Math.random() < 0.5 ? 0 : 1];
    }

    const [dr, dc] = deltas[effectiveAction];
    const nr = r + dr;
    const nc = c + dc;

    if (this.isOutOfBounds(nr, nc) || this.isWall(nr, nc)) {
      return { r, c, hitWall: true }; // stay in place
    }
    return { r: nr, c: nc, hitWall: false };
  }

  /** Reset the environment. Returns the initial state [row, col]. */
  reset() {
    this.agentPos = [...this.start];
    this._steps = 0;
    return [...this.agentPos];
  }

  /**
   * Take one step.
   * @param {number} action – 0=Up, 1=Down, 2=Left, 3=Right
   * @returns {{ nextState:[number,number], reward:number, done:boolean, info:{} }}
   */
  step(action) {
    this._steps++;
    const [r, c] = this.agentPos;
    const { r: nr, c: nc, hitWall } = this._transition(r, c, action);

    this.agentPos = [nr, nc];

    const atGoal = nr === this.goal[0] && nc === this.goal[1];
    let reward = -1;
    if (hitWall) reward -= 5;
    if (atGoal) reward += 10;

    const done = atGoal || this._steps >= this.maxSteps;
    return {
      nextState: [nr, nc],
      reward,
      done,
      info: { success: atGoal, steps: this._steps, hitWall },
    };
  }

  /**
   * Returns the array of valid action indices from `state`.
   * All 4 directions are always "valid" in the sense that the agent can
   * attempt them; wall hits are penalised but not blocked at the action level.
   * We keep all 4 so Q-learning can learn wall penalties properly.
   */
  validActions(_state) {
    return [0, 1, 2, 3];
  }
}

// ─────────────────────────────────────────────────────────
// POLICIES
// ─────────────────────────────────────────────────────────

/** Pick a uniformly random action. */
function randomPolicy(_state, _qtable, env) {
  const actions = env.validActions(_state);
  return actions[Math.floor(Math.random() * actions.length)];
}

/**
 * Manhattan-distance greedy policy.
 *
 * Computes the resulting position for each action and picks the one
 * that minimises Manhattan distance to goal. Ties broken randomly.
 *
 * Limitation: can get stuck in dead-ends when all forward moves go into
 * walls (the agent oscillates). This is documented, not hidden.
 */
function greedyPolicy(state, _qtable, env) {
  const [gr, gc] = env.goal;
  const deltas = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  const [r, c] = state;

  let bestDist = Infinity;
  let bestActions = [];

  for (let a = 0; a < 4; a++) {
    const [dr, dc] = deltas[a];
    const nr = r + dr;
    const nc = c + dc;
    // Moves into walls or out-of-bounds get a huge distance penalty
    const blocked = env.isOutOfBounds(nr, nc) || env.isWall(nr, nc);
    const dist = blocked ? Infinity : Math.abs(nr - gr) + Math.abs(nc - gc);
    if (dist < bestDist) {
      bestDist = dist;
      bestActions = [a];
    } else if (dist === bestDist) {
      bestActions.push(a);
    }
  }
  return bestActions[Math.floor(Math.random() * bestActions.length)];
}

/**
 * ε-greedy policy over a tabular Q-table.
 * @param {[number,number]} state
 * @param {Float64Array} qtable – flat array of size states × 4
 * @param {GridWorld} env
 * @param {number} epsilon – exploration rate
 */
function qPolicy(state, qtable, env, epsilon = 0) {
  if (Math.random() < epsilon) {
    return randomPolicy(state, qtable, env);
  }
  const si = env.stateIndex(state);
  const base = si * 4;
  let best = base;
  for (let a = 1; a < 4; a++) {
    if (qtable[base + a] > qtable[best]) best = base + a;
  }
  return best - base;
}

// ─────────────────────────────────────────────────────────
// Q-LEARNING TRAINER
// ─────────────────────────────────────────────────────────

/**
 * Run a single full Q-learning episode.
 * Returns { totalReward, steps, success }.
 * Mutates the qtable in-place.
 */
function runQLearningEpisode(env, qtable, params, visitCount) {
  const { alpha, gamma, epsilon } = params;
  let state = env.reset();
  let totalReward = 0;
  let done = false;

  while (!done) {
    const action = qPolicy(state, qtable, env, epsilon);
    const si = env.stateIndex(state);
    const { nextState, reward, done: isDone, info } = env.step(action);
    const nsi = env.stateIndex(nextState);

    // Track visitation
    visitCount[si * 4 + action]++;

    // Greedy max Q for next state
    const base = nsi * 4;
    let maxQ = qtable[base];
    for (let a = 1; a < 4; a++) {
      if (qtable[base + a] > maxQ) maxQ = qtable[base + a];
    }

    // TD update: Q(s,a) ← Q(s,a) + α(r + γ·max Q(s',·) − Q(s,a))
    const qIdx = si * 4 + action;
    qtable[qIdx] +=
      alpha * (reward + gamma * (isDone ? 0 : maxQ) - qtable[qIdx]);

    totalReward += reward;
    state = nextState;
    done = isDone;
  }

  return {
    totalReward,
    steps: env._steps,
    success: env.agentPos[0] === env.goal[0] && env.agentPos[1] === env.goal[1],
  };
}

/**
 * Run a single evaluation episode (greedy, ε=0).
 * Does NOT mutate qtable. Returns path array for animation.
 */
function runEvalEpisode(env, qtable, policyName) {
  let state = env.reset();
  const path = [[...state]];
  let totalReward = 0;
  let done = false;

  while (!done) {
    let action;
    if (policyName === "random") {
      action = randomPolicy(state, qtable, env);
    } else if (policyName === "greedy") {
      action = greedyPolicy(state, qtable, env);
    } else {
      action = qPolicy(state, qtable, env, 0); // greedy Q
    }
    const { nextState, reward, done: isDone } = env.step(action);
    totalReward += reward;
    state = nextState;
    path.push([...state]);
    done = isDone;
  }

  return {
    totalReward,
    steps: env._steps,
    success: env.agentPos[0] === env.goal[0] && env.agentPos[1] === env.goal[1],
    path,
  };
}

// ─────────────────────────────────────────────────────────
// CANVAS DRAWING HELPERS
// ─────────────────────────────────────────────────────────

const CELL_COLORS = {
  empty: "#1c2128",
  wall: "#484f58",
  start: "#56d364",
  goal: "#2f81f7",
};

const AGENT_COLOR = "#4d9ef7";
const TRAIL_COLOR = "rgba(77, 158, 247, 0.25)";
const ARROW_COLOR = "rgba(195, 239, 116, 0.85)";
const GRID_LINE_COLOR = "rgba(255,255,255,0.06)";

/**
 * Draw the 10×10 grid on `ctx`.
 * @param {CanvasRenderingContext2D} ctx
 * @param {GridWorld} env
 * @param {Float64Array|null} qtable – if provided, draw heatmap overlay
 * @param {boolean} showArrows – draw policy arrows
 * @param {[number,number]|null} agentPos
 * @param {[number,number][]} trail
 */
function drawGrid(ctx, env, qtable, showArrows, agentPos, trail) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const cw = W / env.cols;
  const ch = H / env.rows;

  // Compute Q-value range for heatmap
  let qMin = 0,
    qMax = 0;
  if (qtable && showArrows) {
    for (let i = 0; i < qtable.length; i++) {
      if (qtable[i] < qMin) qMin = qtable[i];
      if (qtable[i] > qMax) qMax = qtable[i];
    }
  }

  // Clear
  ctx.clearRect(0, 0, W, H);

  for (let r = 0; r < env.rows; r++) {
    for (let c = 0; c < env.cols; c++) {
      const x = c * cw;
      const y = r * ch;
      const key = env._key(r, c);
      const isStart = r === env.start[0] && c === env.start[1];
      const isGoal = r === env.goal[0] && c === env.goal[1];
      const isWall = env.walls.has(key);

      // Cell background
      if (isWall) {
        ctx.fillStyle = CELL_COLORS.wall;
      } else if (isGoal) {
        ctx.fillStyle = CELL_COLORS.goal;
      } else if (isStart) {
        ctx.fillStyle = CELL_COLORS.start;
      } else {
        ctx.fillStyle = CELL_COLORS.empty;
      }
      ctx.fillRect(x, y, cw, ch);

      // Q-value heatmap overlay for non-special cells
      if (qtable && !isWall && !isGoal && !isStart) {
        const si = env.stateIndex([r, c]);
        const base = si * 4;
        let maxQ = qtable[base];
        for (let a = 1; a < 4; a++) {
          if (qtable[base + a] > maxQ) maxQ = qtable[base + a];
        }
        const range = qMax - qMin || 1;
        const t = Math.max(0, Math.min(1, (maxQ - qMin) / range));
        ctx.fillStyle = `rgba(47, 129, 247, ${(t * 0.38).toFixed(3)})`;
        ctx.fillRect(x, y, cw, ch);
      }

      // Grid lines
      ctx.strokeStyle = GRID_LINE_COLOR;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x, y, cw, ch);

      // Policy arrow overlay
      if (showArrows && qtable && !isWall && !isGoal) {
        const si = env.stateIndex([r, c]);
        const base = si * 4;
        let bestA = 0;
        for (let a = 1; a < 4; a++) {
          if (qtable[base + a] > qtable[base + bestA]) bestA = a;
        }
        drawArrow(ctx, x + cw / 2, y + ch / 2, bestA, cw * 0.28);
      }
    }
  }

  // Draw trail
  if (trail && trail.length > 1) {
    ctx.beginPath();
    ctx.strokeStyle = TRAIL_COLOR;
    ctx.lineWidth = cw * 0.18;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (let i = 0; i < trail.length; i++) {
      const [tr, tc] = trail[i];
      const px = tc * cw + cw / 2;
      const py = tr * ch + ch / 2;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // Draw agent
  if (agentPos) {
    const [ar, ac] = agentPos;
    const px = ac * cw + cw / 2;
    const py = ar * ch + ch / 2;
    const radius = Math.min(cw, ch) * 0.3;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fillStyle = AGENT_COLOR;
    ctx.fill();
    // Bright inner dot
    ctx.beginPath();
    ctx.arc(px, py, radius * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fill();
  }
}

/**
 * Draw a direction arrow centred at (cx, cy).
 * direction: 0=Up, 1=Down, 2=Left, 3=Right
 */
function drawArrow(ctx, cx, cy, direction, size) {
  const angle = [
    -Math.PI / 2, // Up
    Math.PI / 2, // Down
    Math.PI, // Left
    0, // Right
  ][direction];

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.5, size * 0.5);
  ctx.lineTo(-size * 0.5, -size * 0.5);
  ctx.closePath();
  ctx.fillStyle = ARROW_COLOR;
  ctx.fill();
  ctx.restore();
}

// ─────────────────────────────────────────────────────────
// CHART DRAWING (pure Canvas 2D, no libraries)
// ─────────────────────────────────────────────────────────

const CHART_BG = "#0d1117";
const CHART_LINE_COLOR = "#4d9ef7";
const CHART_AVG_COLOR = "#c3ef74";
const CHART_AXIS_COLOR = "rgba(255,255,255,0.2)";
const CHART_TEXT_COLOR = "rgb(155,173,181)";

/**
 * Draw a line chart on `ctx`.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number[]} data – raw series
 * @param {number[]} smoothed – rolling-average series
 * @param {string} title
 * @param {string} yLabel
 */
function drawLineChart(ctx, data, smoothed, title, yLabel) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const PAD = { top: 28, right: 14, bottom: 28, left: 44 };
  const pw = W - PAD.left - PAD.right;
  const ph = H - PAD.top - PAD.bottom;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = CHART_BG;
  ctx.fillRect(0, 0, W, H);

  if (data.length === 0) {
    ctx.fillStyle = CHART_TEXT_COLOR;
    ctx.font = "12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("No data yet", W / 2, H / 2);
    return;
  }

  const allVals = [...data, ...smoothed];
  let yMin = Math.min(...allVals);
  let yMax = Math.max(...allVals);
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }

  // Scale helpers
  const sx = (i) => PAD.left + (i / Math.max(data.length - 1, 1)) * pw;
  const sy = (v) => PAD.top + ph - ((v - yMin) / (yMax - yMin)) * ph;

  // Axes
  ctx.strokeStyle = CHART_AXIS_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD.left, PAD.top);
  ctx.lineTo(PAD.left, PAD.top + ph);
  ctx.lineTo(PAD.left + pw, PAD.top + ph);
  ctx.stroke();

  // Y tick labels
  ctx.fillStyle = CHART_TEXT_COLOR;
  ctx.font = "10px monospace";
  ctx.textAlign = "right";
  const ticks = 4;
  for (let t = 0; t <= ticks; t++) {
    const v = yMin + (t / ticks) * (yMax - yMin);
    const y = sy(v);
    ctx.fillText(v.toFixed(1), PAD.left - 5, y + 3);
    ctx.strokeStyle = CHART_AXIS_COLOR;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + pw, y);
    ctx.stroke();
  }

  // Raw data line (faint)
  ctx.beginPath();
  ctx.strokeStyle = "rgba(77,158,247,0.3)";
  ctx.lineWidth = 1;
  data.forEach((v, i) => {
    const x = sx(i);
    const y = sy(v);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Smoothed average line
  if (smoothed.length > 1) {
    ctx.beginPath();
    ctx.strokeStyle = CHART_AVG_COLOR;
    ctx.lineWidth = 2;
    smoothed.forEach((v, i) => {
      const x = sx(i);
      const y = sy(v);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // Title
  ctx.fillStyle = "rgb(183,195,201)";
  ctx.font = "11px system-ui";
  ctx.textAlign = "left";
  ctx.fillText(title, PAD.left + 4, 18);

  // Y label
  ctx.save();
  ctx.translate(10, PAD.top + ph / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = CHART_TEXT_COLOR;
  ctx.font = "10px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();
}

/** Compute rolling average with a window of `window` episodes. */
function rollingAverage(data, window = 10) {
  return data.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1);
    return slice.reduce((s, v) => s + v, 0) / slice.length;
  });
}

// ─────────────────────────────────────────────────────────
// MODULE ENTRY POINT
// ─────────────────────────────────────────────────────────

/**
 * Create and mount the Agent & Policy Lab inside `container`.
 * @param {HTMLElement} container
 * @returns {{ destroy(): void }}
 */
export function createAgentModule(container) {
  // ── Build DOM ──────────────────────────────────────────
  container.innerHTML = `
<div class="agentLab">
  <!-- Left: Controls + Stats -->
  <aside class="agentControls">
    <h2>Agent &amp; Policy Lab</h2>

    <section>
      <label>Policy
        <select id="agentPolicy">
          <option value="random">Random</option>
          <option value="greedy">Greedy (Manhattan)</option>
          <option value="qlearn" selected>Q-Learning</option>
        </select>
      </label>
    </section>

    <section id="qLearnParams">
      <h2>Q-Learning Parameters</h2>
      <label>α (learning rate) <b id="alphaVal">0.10</b>
        <input id="alphaSlider" type="range" min="0.01" max="0.5" step="0.01" value="0.10">
      </label>
      <label>γ (discount) <b id="gammaVal">0.95</b>
        <input id="gammaSlider" type="range" min="0.5" max="0.99" step="0.01" value="0.95">
      </label>
      <label>ε (exploration) <b id="epsilonVal">0.30</b>
        <input id="epsilonSlider" type="range" min="0.01" max="0.5" step="0.01" value="0.30">
      </label>
      <label>ε-decay <b id="decayVal">0.9950</b>
        <input id="decaySlider" type="range" min="0.99" max="0.9999" step="0.0001" value="0.9950">
      </label>
      <label>Training episodes <b id="episodesVal">500</b>
        <input id="episodesSlider" type="range" min="100" max="2000" step="100" value="500">
      </label>
    </section>

    <section>
      <h2>Environment</h2>
      <label>
        <input id="stochasticCheck" type="checkbox"> Stochastic transitions (10% slip)
      </label>
    </section>

    <section class="agentBtnGroup">
      <button id="trainBtn" class="primary wide">▶ Train</button>
      <button id="evalBtn" class="wide" disabled>Evaluate</button>
      <button id="runEpisodeBtn" class="wide" disabled>Run Single Episode</button>
      <button id="resetQBtn" class="wide">Reset Q-Table</button>
    </section>

    <section>
      <label>Animation speed <b id="speedVal">Medium</b>
        <input id="speedSlider" type="range" min="1" max="5" step="1" value="3">
      </label>
    </section>

    <section>
      <label>
        <input id="showArrowsCheck" type="checkbox" checked> Show policy arrows
      </label>
    </section>

    <section id="agentStats">
      <h2>Training Stats</h2>
      <div class="agentMetrics">
        <div><small>EPISODES</small><strong id="statEpisodes">0</strong></div>
        <div><small>AVG REWARD (last 100)</small><strong id="statAvgReward">—</strong></div>
        <div><small>SUCCESS RATE (last 100)</small><strong id="statSuccess">—</strong></div>
        <div><small>Q-TABLE COVERAGE</small><strong id="statCoverage">0%</strong></div>
      </div>
    </section>

    <section id="evalStats" hidden>
      <h2>Evaluation Results</h2>
      <div class="agentMetrics">
        <div><small>SUCCESSES</small><strong id="evalSuccesses">—</strong></div>
        <div><small>AVG STEPS</small><strong id="evalAvgSteps">—</strong></div>
        <div><small>AVG REWARD</small><strong id="evalAvgReward">—</strong></div>
      </div>
    </section>

    <p class="note" id="agentStatusMsg">Ready. Select a policy and press Train or Run Single Episode.</p>

    <section id="greedyWarning" hidden>
      <p class="note" style="color:rgb(240,175,127)">⚠ Greedy (Manhattan) policy can get stuck in dead-ends where all forward-moving actions lead into walls, causing the agent to oscillate without reaching the goal.</p>
    </section>
  </aside>

  <!-- Right: Grid + Charts -->
  <main class="agentMain">
    <div class="agentGridWrap">
      <canvas id="agentGridCanvas" width="400" height="400"></canvas>
      <div class="agentGridLegend">
        <span class="agentLegStart">■ Start</span>
        <span class="agentLegGoal">■ Goal</span>
        <span class="agentLegWall">■ Wall</span>
        <span class="agentLegAgent">● Agent</span>
        <span class="agentLegArrow">▶ Policy</span>
      </div>
    </div>
    <div class="agentCharts">
      <div class="agentChartWrap">
        <canvas id="rewardChart" width="480" height="140"></canvas>
      </div>
      <div class="agentChartWrap">
        <canvas id="lengthChart" width="480" height="140"></canvas>
      </div>
    </div>
  </main>
</div>
`;

  // ── State ──────────────────────────────────────────────
  let env = new GridWorld({ stochastic: false });
  const N_STATES = 100;
  const N_ACTIONS = 4;

  /** @type {Float64Array} */
  let qtable = new Float64Array(N_STATES * N_ACTIONS);
  /** @type {Float64Array} – count of visits per (state, action) pair */
  let visitCount = new Float64Array(N_STATES * N_ACTIONS);

  let episodeRewards = []; // raw per-episode rewards
  let episodeLengths = []; // raw per-episode step counts
  let episodeSuccesses = []; // boolean success per episode
  let totalTrained = 0;

  let trainingActive = false;
  let animActive = false;
  let cancelTraining = false;
  let animTimeout = null;
  let trainTimeout = null;

  // Grid canvas state
  let animTrail = [];
  let animAgentPos = env.agentPos;

  // ── DOM refs ───────────────────────────────────────────
  const $ = (id) => container.querySelector(`#${id}`);

  const gridCanvas = $("agentGridCanvas");
  const gridCtx = gridCanvas.getContext("2d");
  const rewardCanvas = $("rewardChart");
  const rewardCtx = rewardCanvas.getContext("2d");
  const lengthCanvas = $("lengthChart");
  const lengthCtx = lengthCanvas.getContext("2d");

  // ── Slider sync ────────────────────────────────────────
  function bindSlider(sliderId, labelId, decimals = 2) {
    const slider = $(sliderId);
    const label = $(labelId);
    slider.addEventListener("input", () => {
      label.textContent = Number(slider.value).toFixed(decimals);
      onParamChange();
    });
  }

  bindSlider("alphaSlider", "alphaVal", 2);
  bindSlider("gammaSlider", "gammaVal", 2);
  bindSlider("epsilonSlider", "epsilonVal", 2);
  bindSlider("decaySlider", "decayVal", 4);
  bindSlider("episodesSlider", "episodesVal", 0);

  const speedLabels = ["", "Very Slow", "Slow", "Medium", "Fast", "Very Fast"];
  $("speedSlider").addEventListener("input", () => {
    $("speedVal").textContent = speedLabels[$("speedSlider").value];
  });

  function onParamChange() {
    // Nothing dynamic needed here; params read fresh on train/eval
  }

  // ── Policy selector ───────────────────────────────────
  $("agentPolicy").addEventListener("change", () => {
    const p = $("agentPolicy").value;
    $("qLearnParams").hidden = p !== "qlearn";
    $("greedyWarning").hidden = p !== "greedy";
    $("evalBtn").disabled = p === "qlearn" && totalTrained === 0;
  });

  $("stochasticCheck").addEventListener("change", () => {
    env = new GridWorld({ stochastic: $("stochasticCheck").checked });
    resetQTable();
    setStatus(
      "Environment reset (stochastic: " + $("stochasticCheck").checked + ").",
    );
    redrawGrid();
  });

  $("showArrowsCheck").addEventListener("change", redrawGrid);

  // ── Helpers ────────────────────────────────────────────
  function getParams() {
    return {
      alpha: parseFloat($("alphaSlider").value),
      gamma: parseFloat($("gammaSlider").value),
      epsilon: parseFloat($("epsilonSlider").value),
      decay: parseFloat($("decaySlider").value),
      totalEpisodes: parseInt($("episodesSlider").value, 10),
    };
  }

  function setStatus(msg) {
    $("agentStatusMsg").textContent = msg;
  }

  function resetQTable() {
    qtable = new Float64Array(N_STATES * N_ACTIONS);
    visitCount = new Float64Array(N_STATES * N_ACTIONS);
    episodeRewards = [];
    episodeLengths = [];
    episodeSuccesses = [];
    totalTrained = 0;
    updateStats();
    drawLineChart(rewardCtx, [], [], "Episode Reward", "reward");
    drawLineChart(lengthCtx, [], [], "Episode Length", "steps");
    $("evalStats").hidden = true;
    $("evalBtn").disabled = true;
    $("runEpisodeBtn").disabled = false;
    animTrail = [];
    animAgentPos = env.start;
    redrawGrid();
  }

  function updateStats() {
    $("statEpisodes").textContent = totalTrained;
    const window = 100;
    const last = episodeRewards.slice(-window);
    const lastS = episodeSuccesses.slice(-window);
    $("statAvgReward").textContent =
      last.length > 0
        ? (last.reduce((a, b) => a + b, 0) / last.length).toFixed(2)
        : "—";
    $("statSuccess").textContent =
      lastS.length > 0
        ? ((lastS.filter(Boolean).length / lastS.length) * 100).toFixed(1) + "%"
        : "—";
    const visited = visitCount.reduce((s, v) => s + (v > 0 ? 1 : 0), 0);
    $("statCoverage").textContent =
      ((visited / (N_STATES * N_ACTIONS)) * 100).toFixed(1) + "%";
  }

  function redrawGrid() {
    const showArrows = $("showArrowsCheck").checked && totalTrained > 0;
    const qdata = totalTrained > 0 ? qtable : null;
    drawGrid(gridCtx, env, qdata, showArrows, animAgentPos, animTrail);
  }

  function updateCharts() {
    const smoothReward = rollingAverage(episodeRewards, 10);
    const smoothLength = rollingAverage(episodeLengths, 10);
    drawLineChart(
      rewardCtx,
      episodeRewards,
      smoothReward,
      "Episode Reward  (blue = raw, green = 10-ep avg)",
      "reward",
    );
    drawLineChart(
      lengthCtx,
      episodeLengths,
      smoothLength,
      "Episode Length  (blue = raw, green = 10-ep avg)",
      "steps",
    );
  }

  // ── Training ───────────────────────────────────────────
  const BATCH_SIZE = 50; // episodes per setTimeout batch

  $("trainBtn").addEventListener("click", () => {
    if (trainingActive) {
      // User clicked Stop mid-training
      cancelTraining = true;
      return;
    }

    const policy = $("agentPolicy").value;
    if (policy !== "qlearn") {
      setStatus("Training only applies to Q-Learning. Switch the policy.");
      return;
    }

    // Fresh training resets the Q-table
    resetQTable();
    trainingActive = true;
    cancelTraining = false;

    $("trainBtn").textContent = "■ Stop";
    $("trainBtn").classList.remove("primary");
    $("evalBtn").disabled = true;
    $("runEpisodeBtn").disabled = true;

    const params = getParams();
    let remaining = params.totalEpisodes;
    let currentEpsilon = params.epsilon;

    function runBatch() {
      if (cancelTraining || remaining <= 0) {
        trainingActive = false;
        cancelTraining = false;
        $("trainBtn").textContent = "▶ Train";
        $("trainBtn").classList.add("primary");
        $("evalBtn").disabled = false;
        $("runEpisodeBtn").disabled = false;
        animAgentPos = env.start;
        animTrail = [];
        redrawGrid();
        updateStats();
        updateCharts();
        setStatus(
          `Training complete. ${totalTrained} episodes, ε final = ${currentEpsilon.toFixed(4)}.`,
        );
        return;
      }

      const batchCount = Math.min(BATCH_SIZE, remaining);
      for (let b = 0; b < batchCount; b++) {
        const result = runQLearningEpisode(
          env,
          qtable,
          { alpha: params.alpha, gamma: params.gamma, epsilon: currentEpsilon },
          visitCount,
        );
        episodeRewards.push(result.totalReward);
        episodeLengths.push(result.steps);
        episodeSuccesses.push(result.success);
        totalTrained++;
        currentEpsilon = Math.max(0.01, currentEpsilon * params.decay);
      }
      remaining -= batchCount;

      updateStats();
      updateCharts();
      redrawGrid();
      setStatus(
        `Training… ${totalTrained}/${params.totalEpisodes} episodes — ε = ${currentEpsilon.toFixed(4)}`,
      );

      trainTimeout = setTimeout(runBatch, 0);
    }

    trainTimeout = setTimeout(runBatch, 0);
  });

  // ── Evaluate ───────────────────────────────────────────
  $("evalBtn").addEventListener("click", () => {
    const policy = $("agentPolicy").value;
    const EVAL_EPISODES = 20;
    let successes = 0;
    let totalSteps = 0;
    let totalReward = 0;

    for (let i = 0; i < EVAL_EPISODES; i++) {
      const result = runEvalEpisode(env, qtable, policy);
      if (result.success) successes++;
      totalSteps += result.steps;
      totalReward += result.totalReward;
    }

    $("evalStats").hidden = false;
    $("evalSuccesses").textContent = `${successes} / ${EVAL_EPISODES}`;
    $("evalAvgSteps").textContent = (totalSteps / EVAL_EPISODES).toFixed(1);
    $("evalAvgReward").textContent = (totalReward / EVAL_EPISODES).toFixed(2);
    setStatus(
      `Evaluation: ${successes}/${EVAL_EPISODES} success, avg ${(totalSteps / EVAL_EPISODES).toFixed(1)} steps.`,
    );
  });

  // ── Run Single Episode (animated) ─────────────────────
  $("runEpisodeBtn").addEventListener("click", () => {
    if (animActive) {
      animActive = false;
      clearTimeout(animTimeout);
      $("runEpisodeBtn").textContent = "Run Single Episode";
      $("trainBtn").disabled = false;
      return;
    }

    const policy = $("agentPolicy").value;
    // Run the full episode to get the path, then animate it
    const result = runEvalEpisode(env, qtable, policy);

    if (result.path.length === 0) return;

    animActive = true;
    $("runEpisodeBtn").textContent = "■ Stop Animation";
    $("trainBtn").disabled = true;
    $("evalBtn").disabled = true;
    animTrail = [];

    const path = result.path;
    let step = 0;

    // Speed → delay mapping (ms per step)
    const speedDelays = [0, 280, 160, 80, 30, 8];
    function getDelay() {
      return speedDelays[parseInt($("speedSlider").value, 10)] ?? 80;
    }

    function animStep() {
      if (!animActive || step >= path.length) {
        animActive = false;
        $("runEpisodeBtn").textContent = "Run Single Episode";
        $("trainBtn").disabled = trainingActive;
        $("evalBtn").disabled = totalTrained === 0;

        // Keep final position shown
        setStatus(
          result.success
            ? `Episode complete — Goal reached in ${result.steps} steps! Reward: ${result.totalReward.toFixed(1)}`
            : `Episode ended — Goal not reached. Steps: ${result.steps}, Reward: ${result.totalReward.toFixed(1)}`,
        );
        return;
      }

      animAgentPos = path[step];
      animTrail = path.slice(0, step + 1);
      redrawGrid();
      step++;
      animTimeout = setTimeout(animStep, getDelay());
    }

    animTimeout = setTimeout(animStep, 0);
  });

  // ── Reset Q-Table button ──────────────────────────────
  $("resetQBtn").addEventListener("click", () => {
    if (trainingActive) {
      cancelTraining = true;
    }
    clearTimeout(animTimeout);
    animActive = false;
    resetQTable();
    setStatus("Q-table reset. Ready to train.");
    $("runEpisodeBtn").textContent = "Run Single Episode";
    $("trainBtn").textContent = "▶ Train";
    $("trainBtn").classList.add("primary");
    $("trainBtn").disabled = false;
  });

  // ── Initial render ─────────────────────────────────────
  animAgentPos = env.start;
  redrawGrid();
  drawLineChart(rewardCtx, [], [], "Episode Reward", "reward");
  drawLineChart(lengthCtx, [], [], "Episode Length", "steps");
  $("qLearnParams").hidden = false;

  // ── Cleanup ────────────────────────────────────────────
  return {
    destroy() {
      cancelTraining = true;
      animActive = false;
      clearTimeout(animTimeout);
      clearTimeout(trainTimeout);
      container.innerHTML = "";
    },
  };
}
