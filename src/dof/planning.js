// src/dof/planning.js
// DOF Motion Planning — A* grid navigation with interactive canvas
// Part of the DOF (Degrees of Freedom) AI & robotics experimentation platform.

// ---------------------------------------------------------------------------
// Cell state constants
// ---------------------------------------------------------------------------
const CELL = Object.freeze({
  EMPTY: 0,
  OBSTACLE: 1,
  START: 2,
  GOAL: 3,
  OPEN: 4, // A* frontier
  CLOSED: 5, // A* explored
  PATH: 6,
});

// Cell fill colours (dark GitHub-inspired palette)
const CELL_COLOR = {
  [CELL.EMPTY]: "#1c2128",
  [CELL.OBSTACLE]: "#484f58",
  [CELL.START]: "#56d364",
  [CELL.GOAL]: "#2f81f7",
  [CELL.OPEN]: "#d29922",
  [CELL.CLOSED]: "#21262d",
  [CELL.PATH]: "#58a6ff",
};

const GRID_LINE_COLOR = "#30363d";
const SQRT2 = Math.SQRT2;

// ---------------------------------------------------------------------------
// Minimal Binary Min-Heap (keyed on f-score)
// ---------------------------------------------------------------------------
class MinHeap {
  constructor() {
    /** @type {{ f: number, node: object }[]} */
    this._data = [];
  }

  get size() {
    return this._data.length;
  }

  /** Push an item. `item` must have a numeric `.f` property. */
  push(item) {
    this._data.push(item);
    this._bubbleUp(this._data.length - 1);
  }

  /** Remove and return the item with the smallest `.f`. */
  pop() {
    const top = this._data[0];
    const last = this._data.pop();
    if (this._data.length > 0) {
      this._data[0] = last;
      this._siftDown(0);
    }
    return top;
  }

  _bubbleUp(i) {
    const data = this._data;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (data[parent].f <= data[i].f) break;
      [data[parent], data[i]] = [data[i], data[parent]];
      i = parent;
    }
  }

  _siftDown(i) {
    const data = this._data;
    const n = data.length;
    for (;;) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && data[l].f < data[smallest].f) smallest = l;
      if (r < n && data[r].f < data[smallest].f) smallest = r;
      if (smallest === i) break;
      [data[smallest], data[i]] = [data[i], data[smallest]];
      i = smallest;
    }
  }
}

// ---------------------------------------------------------------------------
// A* Algorithm
// ---------------------------------------------------------------------------
/**
 * Run A* on a 2-D boolean grid.
 * @param {boolean[][]} blocked  - blocked[row][col] === true means obstacle
 * @param {number}      rows
 * @param {number}      cols
 * @param {{ r: number, c: number }} start
 * @param {{ r: number, c: number }} goal
 * @returns {{ path: {r,c}[], explored: {r,c}[], pathLength: number,
 *             exploredCount: number, found: boolean, timeMs: number }}
 */
function runAStar(blocked, rows, cols, start, goal) {
  const t0 = performance.now();

  // Early-exit: start === goal
  if (start.r === goal.r && start.c === goal.c) {
    return {
      path: [start],
      explored: [],
      pathLength: 1,
      exploredCount: 0,
      found: true,
      timeMs: performance.now() - t0,
    };
  }

  // Octile heuristic (consistent for 8-neighbour grid)
  function h(r, c) {
    const dr = Math.abs(r - goal.r);
    const dc = Math.abs(c - goal.c);
    return dr + dc + (SQRT2 - 2) * Math.min(dr, dc);
  }

  const INF = Infinity;
  const gScore = Array.from({ length: rows }, () =>
    new Float64Array(cols).fill(INF),
  );
  const cameFrom = Array.from({ length: rows }, () =>
    new Array(cols).fill(null),
  );
  const inClosed = Array.from({ length: rows }, () => new Uint8Array(cols));

  gScore[start.r][start.c] = 0;

  const heap = new MinHeap();
  heap.push({ f: h(start.r, start.c), g: 0, r: start.r, c: start.c });

  const explored = []; // cells popped from open set (closed-set order)

  // 8 neighbours: [dr, dc, cost]
  const NEIGHBORS = [
    [-1, 0, 1],
    [1, 0, 1],
    [0, -1, 1],
    [0, 1, 1],
    [-1, -1, SQRT2],
    [-1, 1, SQRT2],
    [1, -1, SQRT2],
    [1, 1, SQRT2],
  ];

  let found = false;

  while (heap.size > 0) {
    const { r, c, g } = heap.pop();

    if (inClosed[r][c]) continue;
    inClosed[r][c] = 1;

    // Record as explored (but not start/goal for cleaner visualisation)
    if (!(r === start.r && c === start.c) && !(r === goal.r && c === goal.c)) {
      explored.push({ r, c });
    }

    if (r === goal.r && c === goal.c) {
      found = true;
      break;
    }

    for (const [dr, dc, cost] of NEIGHBORS) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (blocked[nr][nc] || inClosed[nr][nc]) continue;

      // Block diagonal movement through a "pinched" corner
      if (dr !== 0 && dc !== 0) {
        if (blocked[r][nc] && blocked[nr][c]) continue;
      }

      const tentG = g + cost;
      if (tentG < gScore[nr][nc]) {
        gScore[nr][nc] = tentG;
        cameFrom[nr][nc] = { r, c };
        heap.push({ f: tentG + h(nr, nc), g: tentG, r: nr, c: nc });
      }
    }
  }

  // Reconstruct path
  const path = [];
  if (found) {
    let cur = goal;
    while (cur) {
      path.push(cur);
      const prev = cameFrom[cur.r][cur.c];
      cur = prev;
    }
    path.reverse();
  }

  return {
    path,
    explored,
    pathLength: path.length,
    exploredCount: explored.length,
    found,
    timeMs: parseFloat((performance.now() - t0).toFixed(3)),
  };
}

// ---------------------------------------------------------------------------
// Seeded pseudo-random number generator (xorshift32)
// ---------------------------------------------------------------------------
function makeRng(seed) {
  let s = seed >>> 0 || 0xdeadbeef;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0x100000000;
  };
}

// ---------------------------------------------------------------------------
// Preset scenarios
// ---------------------------------------------------------------------------

/**
 * Returns a { start, goal, obstacles } descriptor for a named scenario.
 * Obstacle coordinates are [row, col] pairs.
 * @param {string} name  'straight' | 'maze' | 'blocked'
 * @param {number} size  grid dimension (NxN)
 */
function buildScenario(name, size) {
  const N = size;
  switch (name) {
    case "straight":
      return {
        start: { r: 0, c: 0 },
        goal: { r: N - 1, c: N - 1 },
        obstacles: [],
      };

    case "maze": {
      // A hand-crafted channel maze that always has a solution.
      // We use proportional placement so it scales with grid size.
      const obs = [];
      const wall = (r0, c0, r1, c1) => {
        for (let r = r0; r <= r1; r++)
          for (let c = c0; c <= c1; c++)
            if (r !== r0 || c !== c0) obs.push([r, c]); // keep entrance
      };
      // Vertical barriers with gaps
      const q = Math.floor(N / 4);
      // Column 1*q: barrier from top, gap at bottom 3 rows
      for (let r = 0; r < N - 3; r++) obs.push([r, q]);
      // Column 2*q: barrier from bottom, gap at top 3 rows
      for (let r = 3; r < N; r++) obs.push([r, 2 * q]);
      // Column 3*q: barrier from top, gap at bottom 3 rows
      for (let r = 0; r < N - 3; r++) obs.push([r, 3 * q]);
      return {
        start: { r: 0, c: 0 },
        goal: { r: N - 1, c: N - 1 },
        obstacles: obs,
      };
    }

    case "blocked": {
      // Completely seal column N/2 — no path possible.
      const mid = Math.floor(N / 2);
      const obs = [];
      for (let r = 0; r < N; r++) obs.push([r, mid]);
      return {
        start: { r: 0, c: 0 },
        goal: { r: N - 1, c: N - 1 },
        obstacles: obs,
      };
    }

    default:
      return { start: null, goal: null, obstacles: [] };
  }
}

// ---------------------------------------------------------------------------
// Main exported factory
// ---------------------------------------------------------------------------

/**
 * Create and mount the Motion Planning module into `container`.
 * @param {HTMLElement} container
 * @returns {{ destroy(): void }}
 */
export function createPlanningModule(container) {
  // ── State ──────────────────────────────────────────────────────────────────
  let gridSize = 20; // NxN
  let grid = []; // grid[r][c] = CELL.*
  let startCell = null; // { r, c } or null
  let goalCell = null; // { r, c } or null
  let clickMode = "obstacle"; // 'obstacle' | 'setStart' | 'setGoal'
  let animTimer = null; // setTimeout handle for animation
  let animFrames = null; // { explored, path, frameIdx } during animation
  let isRunning = false;

  // Cleanup registry
  const _listeners = [];
  function on(el, ev, fn) {
    el.addEventListener(ev, fn);
    _listeners.push([el, ev, fn]);
  }

  // ── DOM Construction ───────────────────────────────────────────────────────
  container.innerHTML = ""; // clear any previous content

  // Inject module-scoped styles (idempotent — only once per document)
  const STYLE_ID = "dof-planning-styles";
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .dof-module {
        display: flex;
        flex-direction: row;
        gap: 16px;
        padding: 16px;
        height: 100%;
        box-sizing: border-box;
        background: #0d1117;
        color: #e6edf3;
        font-family: system-ui, sans-serif;
        font-size: 13px;
        overflow: hidden;
      }
      .dof-card {
        background: #161b22;
        border: 1px solid #30363d;
        border-radius: 8px;
        padding: 14px;
        box-sizing: border-box;
      }
      .dof-card h3 {
        margin: 0 0 12px;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 2px;
        color: #8b949e;
      }
      .dof-controls-col {
        width: 220px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        gap: 12px;
        overflow-y: auto;
      }
      .dof-canvas-col {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-width: 0;
      }
      .dof-canvas-wrap {
        flex: 1;
        position: relative;
        border-radius: 8px;
        overflow: hidden;
        background: #0d1117;
        border: 1px solid #30363d;
      }
      .dof-canvas-wrap canvas {
        display: block;
        width: 100%;
        height: 100%;
        cursor: crosshair;
      }
      .dof-btn {
        display: block;
        width: 100%;
        padding: 8px 10px;
        margin-bottom: 6px;
        border: 1px solid #30363d;
        border-radius: 6px;
        background: #21262d;
        color: #c9d1d9;
        font-size: 12px;
        cursor: pointer;
        text-align: left;
        transition: background 0.15s;
      }
      .dof-btn:hover { background: #2d333b; }
      .dof-btn:last-child { margin-bottom: 0; }
      .dof-btn-primary {
        background: #1f6feb;
        border-color: #388bfd;
        color: #fff;
        font-weight: 600;
      }
      .dof-btn-primary:hover { background: #388bfd; }
      .dof-btn.active {
        background: #d29922;
        border-color: #d29922;
        color: #0d1117;
        font-weight: 600;
      }
      .dof-stat-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
      }
      .dof-stat {
        background: #0d1117;
        border: 1px solid #30363d;
        border-radius: 6px;
        padding: 7px 9px;
      }
      .dof-stat .label {
        font-size: 10px;
        color: #6e7681;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .dof-stat .value {
        font-size: 14px;
        font-weight: 700;
        color: #e6edf3;
        margin-top: 2px;
      }
      .dof-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.5px;
      }
      .dof-badge.found    { background: #1a7f37; color: #7ee787; }
      .dof-badge.notfound { background: #6e1c1c; color: #f85149; }
      .dof-input-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      .dof-input-row label { color: #8b949e; font-size: 12px; white-space: nowrap; }
      .dof-input-row input[type=number] {
        width: 60px;
        padding: 5px 7px;
        background: #0d1117;
        border: 1px solid #30363d;
        border-radius: 5px;
        color: #e6edf3;
        font-size: 12px;
      }
      .dof-separator {
        border: none;
        border-top: 1px solid #30363d;
        margin: 6px 0;
      }
      .dof-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-top: 4px;
      }
      .dof-legend-item {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 10px;
        color: #8b949e;
      }
      .dof-legend-swatch {
        width: 10px;
        height: 10px;
        border-radius: 2px;
        flex-shrink: 0;
      }
      .dof-status-bar {
        font-size: 11px;
        color: #8b949e;
        padding: 4px 0 0;
        min-height: 16px;
      }
    `;
    document.head.appendChild(style);
  }

  // Build the module HTML
  const moduleEl = document.createElement("div");
  moduleEl.className = "dof-module";
  moduleEl.innerHTML = `
    <div class="dof-controls-col">

      <div class="dof-card">
        <h3>Grid</h3>
        <div class="dof-input-row">
          <label for="dof-grid-size">Size</label>
          <input id="dof-grid-size" type="number" min="10" max="40" value="20">
          <button class="dof-btn" id="dof-apply-size" style="width:auto;padding:5px 10px;margin:0">Apply</button>
        </div>
      </div>

      <div class="dof-card">
        <h3>Edit Mode</h3>
        <button class="dof-btn active" id="dof-mode-obstacle">✏ Obstacles</button>
        <button class="dof-btn" id="dof-mode-start">⬤ Set Start</button>
        <button class="dof-btn" id="dof-mode-goal">◎ Set Goal</button>
        <hr class="dof-separator">
        <button class="dof-btn" id="dof-clear-obs">⌫ Clear Obstacles</button>
        <button class="dof-btn" id="dof-reset">↺ Reset All</button>
        <button class="dof-btn" id="dof-maze">⧉ Random Maze</button>
      </div>

      <div class="dof-card">
        <h3>Scenarios</h3>
        <button class="dof-btn" id="dof-scenario-straight">→ Straight Shot</button>
        <button class="dof-btn" id="dof-scenario-maze">⧉ Maze</button>
        <button class="dof-btn" id="dof-scenario-blocked">✖ Blocked</button>
      </div>

      <div class="dof-card">
        <h3>Run</h3>
        <button class="dof-btn dof-btn-primary" id="dof-run">▶ Find Path (A*)</button>
      </div>

      <div class="dof-card">
        <h3>Legend</h3>
        <div class="dof-legend" id="dof-legend"></div>
      </div>

    </div>

    <div class="dof-canvas-col">

      <div class="dof-card" style="padding:10px 14px">
        <h3 style="margin-bottom:6px">Statistics</h3>
        <div class="dof-stat-grid" id="dof-stats">
          <div class="dof-stat"><div class="label">Path Found</div><div class="value" id="dof-s-found">—</div></div>
          <div class="dof-stat"><div class="label">Path Length</div><div class="value" id="dof-s-len">—</div></div>
          <div class="dof-stat"><div class="label">Explored Nodes</div><div class="value" id="dof-s-explored">—</div></div>
          <div class="dof-stat"><div class="label">Algorithm Time</div><div class="value" id="dof-s-time">—</div></div>
          <div class="dof-stat"><div class="label">Grid Size</div><div class="value" id="dof-s-grid">${gridSize}×${gridSize}</div></div>
        </div>
      </div>

      <div class="dof-canvas-wrap" id="dof-canvas-wrap">
        <canvas id="dof-canvas"></canvas>
      </div>
      <div class="dof-status-bar" id="dof-status">Click cells to toggle obstacles, then press ▶ Find Path.</div>

    </div>
  `;
  container.appendChild(moduleEl);

  // Populate legend
  const legendEl = moduleEl.querySelector("#dof-legend");
  const LEGEND_LABELS = {
    [CELL.EMPTY]: "Empty",
    [CELL.OBSTACLE]: "Obstacle",
    [CELL.START]: "Start",
    [CELL.GOAL]: "Goal",
    [CELL.OPEN]: "Frontier",
    [CELL.CLOSED]: "Explored",
    [CELL.PATH]: "Path",
  };
  for (const [type, label] of Object.entries(LEGEND_LABELS)) {
    const item = document.createElement("div");
    item.className = "dof-legend-item";
    item.innerHTML = `<div class="dof-legend-swatch" style="background:${CELL_COLOR[type]}"></div>${label}`;
    legendEl.appendChild(item);
  }

  // DOM refs
  const canvas = moduleEl.querySelector("#dof-canvas");
  const ctx = canvas.getContext("2d");
  const canvasWrap = moduleEl.querySelector("#dof-canvas-wrap");
  const statusBar = moduleEl.querySelector("#dof-status");

  // ── Grid Logic ─────────────────────────────────────────────────────────────

  function initGrid(size) {
    gridSize = size;
    grid = Array.from({ length: size }, () => new Uint8Array(size));
    startCell = null;
    goalCell = null;
    stopAnimation();
    updateGridSizeStat();
    draw();
  }

  function setCellState(r, c, state) {
    if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) return;
    grid[r][c] = state;
  }

  function clearOverlays() {
    // Remove OPEN, CLOSED, PATH overlays but keep OBSTACLE, START, GOAL
    for (let r = 0; r < gridSize; r++)
      for (let c = 0; c < gridSize; c++)
        if (
          grid[r][c] === CELL.OPEN ||
          grid[r][c] === CELL.CLOSED ||
          grid[r][c] === CELL.PATH
        )
          grid[r][c] = CELL.EMPTY;
  }

  function clearObstacles() {
    for (let r = 0; r < gridSize; r++)
      for (let c = 0; c < gridSize; c++)
        if (grid[r][c] === CELL.OBSTACLE) grid[r][c] = CELL.EMPTY;
  }

  function resetAll() {
    stopAnimation();
    grid = Array.from({ length: gridSize }, () => new Uint8Array(gridSize));
    startCell = null;
    goalCell = null;
    clearStats();
    setStatus("Grid reset. Click to place obstacles, start and goal.");
    draw();
  }

  // ── Drawing ────────────────────────────────────────────────────────────────

  /** Resize canvas buffer to match its CSS size (device-pixel-aware). */
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvasWrap.getBoundingClientRect();
    const w = Math.floor(rect.width * dpr);
    const h = Math.floor(rect.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      ctx.scale(dpr, dpr); // keep coordinate space in CSS pixels
    }
  }

  function draw() {
    resizeCanvas();
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;

    // Reset transform to avoid accumulated scaling
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cellW = cssW / gridSize;
    const cellH = cssH / gridSize;
    const cellSz = Math.min(cellW, cellH); // square cells
    // Centre the grid
    const offX = (cssW - cellSz * gridSize) / 2;
    const offY = (cssH - cellSz * gridSize) / 2;

    // Background
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, cssW, cssH);

    // Cells
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const state = grid[r][c];
        ctx.fillStyle = CELL_COLOR[state] || CELL_COLOR[CELL.EMPTY];
        ctx.fillRect(
          offX + c * cellSz + 0.5,
          offY + r * cellSz + 0.5,
          cellSz - 1,
          cellSz - 1,
        );
      }
    }

    // Grid lines
    ctx.strokeStyle = GRID_LINE_COLOR;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= gridSize; i++) {
      // Vertical
      ctx.beginPath();
      ctx.moveTo(offX + i * cellSz, offY);
      ctx.lineTo(offX + i * cellSz, offY + gridSize * cellSz);
      ctx.stroke();
      // Horizontal
      ctx.beginPath();
      ctx.moveTo(offX, offY + i * cellSz);
      ctx.lineTo(offX + gridSize * cellSz, offY + i * cellSz);
      ctx.stroke();
    }

    // Draw start marker (S)
    if (startCell)
      drawMarker(
        startCell.r,
        startCell.c,
        "S",
        CELL_COLOR[CELL.START],
        offX,
        offY,
        cellSz,
      );
    // Draw goal marker (G)
    if (goalCell)
      drawMarker(
        goalCell.r,
        goalCell.c,
        "G",
        CELL_COLOR[CELL.GOAL],
        offX,
        offY,
        cellSz,
      );
  }

  function drawMarker(r, c, letter, color, offX, offY, cellSz) {
    const cx = offX + c * cellSz + cellSz / 2;
    const cy = offY + r * cellSz + cellSz / 2;
    ctx.font = `bold ${Math.floor(cellSz * 0.55)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#0d1117";
    ctx.fillText(letter, cx, cy);
  }

  // ── Canvas Hit-Test ────────────────────────────────────────────────────────

  /** Convert a canvas-relative (cssX, cssY) to { r, c } grid cell. Returns null if outside. */
  function canvasToCell(cssX, cssY) {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;
    const cellSz = Math.min(cssW / gridSize, cssH / gridSize);
    const offX = (cssW - cellSz * gridSize) / 2;
    const offY = (cssH - cellSz * gridSize) / 2;
    const c = Math.floor((cssX - offX) / cellSz);
    const r = Math.floor((cssY - offY) / cellSz);
    if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) return null;
    return { r, c };
  }

  // ── Animation ─────────────────────────────────────────────────────────────

  function stopAnimation() {
    if (animTimer !== null) {
      clearTimeout(animTimer);
      animTimer = null;
    }
    animFrames = null;
    isRunning = false;
  }

  /**
   * Animate the A* result step-by-step.
   * Batches 5 exploration cells per 10 ms tick, then draws path once done.
   */
  function animateResult(result) {
    stopAnimation();
    clearOverlays();
    draw();

    const explored = result.explored.slice();
    const path = result.path.slice();
    let idx = 0;
    isRunning = true;

    function step() {
      const BATCH = 5;
      let count = 0;
      while (idx < explored.length && count < BATCH) {
        const { r, c } = explored[idx++];
        // Don't overwrite start/goal
        if (grid[r][c] !== CELL.START && grid[r][c] !== CELL.GOAL)
          grid[r][c] =
            grid[r][c] === CELL.OBSTACLE ? CELL.OBSTACLE : CELL.CLOSED;
        count++;
      }
      draw();

      if (idx < explored.length) {
        animTimer = setTimeout(step, 10);
      } else {
        // Draw final path
        for (const { r, c } of path) {
          if (grid[r][c] !== CELL.START && grid[r][c] !== CELL.GOAL)
            grid[r][c] = CELL.PATH;
        }
        draw();
        isRunning = false;
        animTimer = null;
        setStatus(
          result.found
            ? `Path found! Length ${result.pathLength} cells · ${result.exploredCount} nodes explored · ${result.timeMs} ms`
            : `No path exists between start and goal. ${result.exploredCount} nodes explored.`,
        );
      }
    }

    animTimer = setTimeout(step, 10);
  }

  // ── Stats Panel ───────────────────────────────────────────────────────────

  function updateStats(result) {
    const foundEl = moduleEl.querySelector("#dof-s-found");
    const lenEl = moduleEl.querySelector("#dof-s-len");
    const exploredEl = moduleEl.querySelector("#dof-s-explored");
    const timeEl = moduleEl.querySelector("#dof-s-time");

    if (result.found) {
      foundEl.innerHTML = '<span class="dof-badge found">YES</span>';
    } else {
      foundEl.innerHTML = '<span class="dof-badge notfound">NO</span>';
    }
    lenEl.textContent = result.found ? `${result.pathLength} cells` : "—";
    exploredEl.textContent = `${result.exploredCount}`;
    timeEl.textContent = `${result.timeMs} ms`;
  }

  function clearStats() {
    ["#dof-s-found", "#dof-s-len", "#dof-s-explored", "#dof-s-time"].forEach(
      (id) => {
        moduleEl.querySelector(id).textContent = "—";
      },
    );
  }

  function updateGridSizeStat() {
    moduleEl.querySelector("#dof-s-grid").textContent =
      `${gridSize}×${gridSize}`;
  }

  function setStatus(msg) {
    statusBar.textContent = msg;
  }

  // ── Mode buttons ──────────────────────────────────────────────────────────

  function setMode(mode) {
    clickMode = mode;
    ["obstacle", "start", "goal"].forEach((m) => {
      moduleEl
        .querySelector(`#dof-mode-${m}`)
        .classList.toggle("active", m === mode);
    });
    const hints = {
      obstacle: "Click cells to toggle obstacles.",
      start: "Click a cell to place the start marker.",
      goal: "Click a cell to place the goal marker.",
    };
    setStatus(hints[mode]);
  }

  // ── Mouse / Touch Handling ────────────────────────────────────────────────

  let isDragging = false;
  let dragMode = null; // 'add' | 'remove' for obstacle dragging

  function getCanvasPos(evt) {
    const rect = canvas.getBoundingClientRect();
    const touch = evt.touches ? evt.touches[0] : evt;
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  }

  function handleCellInteraction(evt, isDown) {
    const { x, y } = getCanvasPos(evt);
    const cell = canvasToCell(x, y);
    if (!cell) return;
    const { r, c } = cell;

    if (clickMode === "setStart") {
      // Remove old start
      if (startCell) grid[startCell.r][startCell.c] = CELL.EMPTY;
      startCell = { r, c };
      grid[r][c] = CELL.START;
      clearOverlays();
      setMode("obstacle"); // revert to obstacle mode
      draw();
      return;
    }

    if (clickMode === "setGoal") {
      if (goalCell) grid[goalCell.r][goalCell.c] = CELL.EMPTY;
      goalCell = { r, c };
      grid[r][c] = CELL.GOAL;
      clearOverlays();
      setMode("obstacle");
      draw();
      return;
    }

    // Obstacle mode
    if (clickMode === "obstacle") {
      // Don't overwrite start/goal
      if (grid[r][c] === CELL.START || grid[r][c] === CELL.GOAL) return;
      if (isDown) {
        dragMode = grid[r][c] === CELL.OBSTACLE ? "remove" : "add";
      }
      const newState = dragMode === "add" ? CELL.OBSTACLE : CELL.EMPTY;
      // Only clear overlay cells too
      if (grid[r][c] !== CELL.START && grid[r][c] !== CELL.GOAL) {
        grid[r][c] = newState;
        clearOverlays();
        draw();
      }
    }
  }

  on(canvas, "mousedown", (e) => {
    isDragging = true;
    handleCellInteraction(e, true);
  });
  on(canvas, "mousemove", (e) => {
    if (!isDragging || clickMode !== "obstacle") return;
    handleCellInteraction(e, false);
  });
  on(document, "mouseup", () => {
    isDragging = false;
    dragMode = null;
  });

  on(
    canvas,
    "touchstart",
    (e) => {
      e.preventDefault();
      isDragging = true;
      handleCellInteraction(e, true);
    },
    { passive: false },
  );
  on(
    canvas,
    "touchmove",
    (e) => {
      e.preventDefault();
      if (!isDragging || clickMode !== "obstacle") return;
      handleCellInteraction(e, false);
    },
    { passive: false },
  );
  on(document, "touchend", () => {
    isDragging = false;
    dragMode = null;
  });

  // ── Button Wiring ─────────────────────────────────────────────────────────

  on(moduleEl.querySelector("#dof-mode-obstacle"), "click", () =>
    setMode("obstacle"),
  );
  on(moduleEl.querySelector("#dof-mode-start"), "click", () =>
    setMode("setStart"),
  );
  on(moduleEl.querySelector("#dof-mode-goal"), "click", () =>
    setMode("setGoal"),
  );

  on(moduleEl.querySelector("#dof-apply-size"), "click", () => {
    const input = moduleEl.querySelector("#dof-grid-size");
    const val = Math.max(10, Math.min(40, parseInt(input.value, 10) || 20));
    input.value = val;
    stopAnimation();
    clearStats();
    initGrid(val);
    setStatus(`Grid resized to ${val}×${val}.`);
  });

  on(moduleEl.querySelector("#dof-clear-obs"), "click", () => {
    stopAnimation();
    clearObstacles();
    clearOverlays();
    clearStats();
    draw();
    setStatus("Obstacles cleared.");
  });

  on(moduleEl.querySelector("#dof-reset"), "click", () => resetAll());

  on(moduleEl.querySelector("#dof-maze"), "click", () => {
    stopAnimation();
    clearStats();
    // Clear non-start/goal cells
    for (let r = 0; r < gridSize; r++)
      for (let c = 0; c < gridSize; c++)
        if (grid[r][c] !== CELL.START && grid[r][c] !== CELL.GOAL)
          grid[r][c] = CELL.EMPTY;

    // Seeded random: ~30% obstacles, skip start and goal
    const rng = makeRng(42 + gridSize);
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (grid[r][c] === CELL.START || grid[r][c] === CELL.GOAL) continue;
        if (rng() < 0.3) grid[r][c] = CELL.OBSTACLE;
      }
    }
    draw();
    setStatus("Random maze generated (seed=42). Press ▶ Find Path.");
  });

  // Scenario buttons
  function applyScenario(name) {
    stopAnimation();
    clearStats();
    const scenario = buildScenario(name, gridSize);
    // Wipe grid
    grid = Array.from({ length: gridSize }, () => new Uint8Array(gridSize));
    startCell = null;
    goalCell = null;

    for (const [r, c] of scenario.obstacles) {
      if (r >= 0 && r < gridSize && c >= 0 && c < gridSize)
        grid[r][c] = CELL.OBSTACLE;
    }

    if (scenario.start) {
      startCell = scenario.start;
      grid[scenario.start.r][scenario.start.c] = CELL.START;
    }
    if (scenario.goal) {
      goalCell = scenario.goal;
      grid[scenario.goal.r][scenario.goal.c] = CELL.GOAL;
    }
    draw();
    setStatus(`Scenario loaded: "${name}". Press ▶ Find Path.`);
  }

  on(moduleEl.querySelector("#dof-scenario-straight"), "click", () =>
    applyScenario("straight"),
  );
  on(moduleEl.querySelector("#dof-scenario-maze"), "click", () =>
    applyScenario("maze"),
  );
  on(moduleEl.querySelector("#dof-scenario-blocked"), "click", () =>
    applyScenario("blocked"),
  );

  on(moduleEl.querySelector("#dof-run"), "click", () => {
    if (isRunning) {
      stopAnimation();
      clearOverlays();
      draw();
      setStatus("Search cancelled.");
      return;
    }

    // Validate
    if (!startCell) {
      setStatus("⚠ Please place a start cell first.");
      return;
    }
    if (!goalCell) {
      setStatus("⚠ Please place a goal cell first.");
      return;
    }

    // Build blocked array
    const blocked = grid.map((row) =>
      Array.from(row).map((v) => v === CELL.OBSTACLE),
    );

    setStatus("Running A*…");
    const result = runAStar(blocked, gridSize, gridSize, startCell, goalCell);
    updateStats(result);
    animateResult(result);
  });

  // ── Resize Observer ────────────────────────────────────────────────────────

  let resizeObserver = null;
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => {
      if (!isRunning) draw();
    });
    resizeObserver.observe(canvasWrap);
  } else {
    // Fallback
    on(window, "resize", () => {
      if (!isRunning) draw();
    });
  }

  // ── Initial Render ─────────────────────────────────────────────────────────

  initGrid(gridSize);
  setStatus("Click cells to toggle obstacles, then press ▶ Find Path.");

  // ── Destroy / Cleanup ──────────────────────────────────────────────────────

  function destroy() {
    stopAnimation();
    for (const [el, ev, fn] of _listeners) el.removeEventListener(ev, fn);
    resizeObserver?.disconnect();
    container.innerHTML = "";
    // Remove the injected style (safe to leave it if multiple instances existed,
    // but we remove for a clean destroy)
    document.getElementById(STYLE_ID)?.remove();
  }

  return { destroy };
}
