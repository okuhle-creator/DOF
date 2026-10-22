// src/dof/analytics.js
// DOF Analytics & Evaluation — charts from real trial data.
//
// All charts derive exclusively from data recorded through the Experiment Manager.
// Empty states are shown when no data exists; no results are ever fabricated.
//
// Public API:
//   export function createAnalyticsModule(container, getExperiments) → { destroy(), refresh() }

// ---------------------------------------------------------------------------
// Chart drawing (pure Canvas 2D, no external libraries)
// ---------------------------------------------------------------------------

const C = {
  bg: "#0d1117",
  panel: "#161b22",
  card: "#1c2128",
  border: "#30363d",
  text: "#8b949e",
  textHi: "#f0f3f4",
  cobalt: "#2f81f7",
  cobaltHi: "#58a6ff",
  mint: "#56d364",
  warn: "#d29922",
  danger: "#da3633",
  axis: "rgba(255,255,255,0.12)",
};

const PALETTE = [
  "#2f81f7",
  "#56d364",
  "#d29922",
  "#da3633",
  "#79c0ff",
  "#3fb950",
  "#f0883e",
  "#ff7b72",
];

/** Compute nice y-axis tick range for [min, max]. */
function niceRange(min, max, ticks = 4) {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const range = max - min;
  const step = Math.pow(10, Math.floor(Math.log10(range / ticks)));
  const nMin = Math.floor(min / step) * step;
  const nMax = Math.ceil(max / step) * step;
  return { min: nMin, max: nMax };
}

/** Draw axes on ctx in the given padding box. Returns scale functions sx, sy. */
function drawAxes(ctx, W, H, PAD, { min, max }, dataLen) {
  const pw = W - PAD.l - PAD.r;
  const ph = H - PAD.t - PAD.b;

  ctx.strokeStyle = C.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD.l, PAD.t);
  ctx.lineTo(PAD.l, PAD.t + ph);
  ctx.lineTo(PAD.l + pw, PAD.t + ph);
  ctx.stroke();

  const sx = (i) => PAD.l + (i / Math.max(dataLen - 1, 1)) * pw;
  const sy = (v) => PAD.t + ph - ((v - min) / (max - min)) * ph;

  // Y ticks
  const ticks = 4;
  ctx.fillStyle = C.text;
  ctx.font = "10px monospace";
  ctx.textAlign = "right";
  for (let t = 0; t <= ticks; t++) {
    const v = min + (t / ticks) * (max - min);
    const y = sy(v);
    ctx.fillText(v.toFixed(1), PAD.l - 5, y + 3);
    ctx.strokeStyle = C.axis;
    ctx.beginPath();
    ctx.moveTo(PAD.l, y);
    ctx.lineTo(PAD.l + pw, y);
    ctx.stroke();
  }

  return { sx, sy, pw, ph };
}

/** Draw a line series on ctx. */
function drawLineSeries(ctx, data, sx, sy, color, lineWidth = 1.5, alpha = 1) {
  if (data.length < 2) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.beginPath();
  data.forEach((v, i) => {
    const x = sx(i),
      y = sy(v);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();
}

/** Draw a bar chart on ctx. */
function drawBars(ctx, labels, values, colors, W, H, PAD) {
  const pw = W - PAD.l - PAD.r;
  const ph = H - PAD.t - PAD.b;
  const n = labels.length;
  const barW = Math.max(8, (pw / n) * 0.6);
  const gap = pw / n;
  const max = Math.max(...values, 0.001);

  ctx.fillStyle = C.text;
  ctx.font = "10px monospace";
  ctx.textAlign = "center";

  labels.forEach((lbl, i) => {
    const v = values[i] ?? 0;
    const bh = (v / max) * ph;
    const x = PAD.l + i * gap + gap / 2 - barW / 2;
    const y = PAD.t + ph - bh;

    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(x, y, barW, bh);

    // Value label above bar
    ctx.fillStyle = C.textHi;
    ctx.fillText(
      typeof v === "number" && !Number.isInteger(v) ? v.toFixed(1) : v,
      x + barW / 2,
      y - 4,
    );

    // X label
    ctx.fillStyle = C.text;
    ctx.fillText(lbl, x + barW / 2, PAD.t + ph + 14);
  });

  // Axis
  ctx.strokeStyle = C.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD.l, PAD.t + ph);
  ctx.lineTo(PAD.l + pw, PAD.t + ph);
  ctx.stroke();
}

/** Draw chart title */
function drawTitle(ctx, title, subtitle, PAD) {
  ctx.fillStyle = C.textHi;
  ctx.font = "11px system-ui";
  ctx.textAlign = "left";
  ctx.fillText(title, PAD.l, 15);
  if (subtitle) {
    ctx.fillStyle = C.text;
    ctx.font = "10px system-ui";
    ctx.fillText(subtitle, PAD.l, 27);
  }
}

/** Draw empty-state message on canvas. */
function drawEmpty(ctx, msg) {
  const W = ctx.canvas.width,
    H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.text;
  ctx.font = "12px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(msg, W / 2, H / 2);
}

// ---------------------------------------------------------------------------
// Module entry point
// ---------------------------------------------------------------------------

/**
 * @param {HTMLElement} container
 * @param {() => object[]} getExperiments – returns current experiments array
 */
export function createAnalyticsModule(container, getExperiments) {
  container.innerHTML = `
<div class="analyticsLab" aria-label="Analytics and Evaluation">
  <aside class="analyticsControls">
    <h2>Analytics</h2>
    <p class="note">Charts are generated from actual experiment trial data recorded in the Experiment Manager. Empty states reflect genuine absence of data.</p>

    <section>
      <label for="analyticsFilter">Filter by experiment</label>
      <select id="analyticsFilter" class="wide">
        <option value="">All experiments</option>
      </select>
    </section>

    <section>
      <label for="analyticsPolicy">Filter by policy</label>
      <select id="analyticsPolicy" class="wide">
        <option value="">All policies</option>
        <option value="qlearn">Q-Learning</option>
        <option value="greedy">Greedy</option>
        <option value="random">Random</option>
      </select>
    </section>

    <section>
      <button id="analyticsRefresh" class="primary wide">↻ Refresh</button>
    </section>

    <section id="analyticsSummary" class="analyticsSummary" hidden>
      <h3>Summary</h3>
      <div id="analyticsSummaryGrid" class="analyticsMetrics"></div>
    </section>

    <section>
      <h3>Metric definitions</h3>
      <div class="note">
        <p><strong>Success rate:</strong> fraction of episodes where the agent reached the goal within the step limit.</p>
        <p><strong>Avg reward:</strong> total reward ÷ episodes. Negative for agents that collide with walls or time out.</p>
        <p><strong>Trial count:</strong> number of independent runs of the same configuration.</p>
        <p>All values derive from recorded experiment results. Sample sizes are always shown.</p>
      </div>
    </section>
  </aside>

  <main class="analyticsMain">
    <div id="analyticsEmpty" class="analyticsEmpty">
      <h3>No experiment data yet</h3>
      <p>Run experiments in the <strong>Experiments</strong> module to generate data for analytics.</p>
      <p class="note">Once results are recorded, this panel will show success rates, reward curves, policy comparisons and failure breakdowns.</p>
    </div>

    <div id="analyticsCharts" hidden>
      <div class="analyticsGrid">

        <div class="analyticsCard">
          <h4>Success Rate by Policy</h4>
          <canvas id="chartSuccessRate" width="340" height="200" aria-label="Success rate by policy"></canvas>
        </div>

        <div class="analyticsCard">
          <h4>Average Reward by Policy</h4>
          <canvas id="chartAvgReward" width="340" height="200" aria-label="Average reward by policy"></canvas>
        </div>

        <div class="analyticsCard analyticsCard--wide">
          <h4>Success Rate Across Experiments</h4>
          <canvas id="chartExpComparison" width="700" height="200" aria-label="Success rate across experiments"></canvas>
        </div>

        <div class="analyticsCard">
          <h4>Trial Outcomes</h4>
          <canvas id="chartOutcomes" width="340" height="200" aria-label="Trial outcome distribution"></canvas>
        </div>

        <div class="analyticsCard">
          <h4>Avg Reward per Experiment</h4>
          <canvas id="chartRewardExp" width="340" height="200" aria-label="Average reward per experiment"></canvas>
        </div>

      </div>

      <div class="analyticsTrialsTable" id="analyticsTrialsTable">
        <h4>All Trials</h4>
        <table class="expTable" aria-label="All recorded trials">
          <thead>
            <tr><th>Experiment</th><th>Policy</th><th>Trial</th><th>Episodes</th><th>Success rate</th><th>Avg reward</th></tr>
          </thead>
          <tbody id="analyticsTrialsBody"></tbody>
        </table>
      </div>
    </div>
  </main>
</div>
`;

  const $ = (id) => container.querySelector(`#${id}`);

  const filterExp = $("analyticsFilter");
  const filterPolicy = $("analyticsPolicy");
  const refreshBtn = $("analyticsRefresh");
  const summaryPanel = $("analyticsSummary");
  const summaryGrid = $("analyticsSummaryGrid");
  const emptyState = $("analyticsEmpty");
  const chartsPanel = $("analyticsCharts");
  const trialsBody = $("analyticsTrialsBody");

  // Canvas refs
  const ctxSuccessRate = $("chartSuccessRate").getContext("2d");
  const ctxAvgReward = $("chartAvgReward").getContext("2d");
  const ctxExpComp = $("chartExpComparison").getContext("2d");
  const ctxOutcomes = $("chartOutcomes").getContext("2d");
  const ctxRewardExp = $("chartRewardExp").getContext("2d");

  function clearCanvas(ctx) {
    const { width: W, height: H } = ctx.canvas;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
  }

  // ── Collect data ────────────────────────────────────────

  function collectTrials() {
    const exps = getExperiments();
    const expId = filterExp.value;
    const pol = filterPolicy.value;

    let trials = [];
    exps.forEach((ex) => {
      if (expId && ex.id !== expId) return;
      ex.results.forEach((r) => {
        if (pol && r.policy !== pol) return;
        trials.push({ expId: ex.id, expName: ex.name, ...r });
      });
    });
    return trials;
  }

  // ── Refresh charts ──────────────────────────────────────

  function refresh() {
    const exps = getExperiments();
    const trials = collectTrials();

    // Populate filter
    filterExp.innerHTML =
      '<option value="">All experiments</option>' +
      exps.map((ex) => `<option value="${ex.id}">${ex.name}</option>`).join("");

    if (trials.length === 0) {
      emptyState.hidden = false;
      chartsPanel.hidden = true;
      summaryPanel.hidden = true;
      [
        ctxSuccessRate,
        ctxAvgReward,
        ctxExpComp,
        ctxOutcomes,
        ctxRewardExp,
      ].forEach((c) => drawEmpty(c, "No data"));
      return;
    }

    emptyState.hidden = true;
    chartsPanel.hidden = false;

    // Aggregate by policy
    const byPolicy = {};
    trials.forEach((t) => {
      byPolicy[t.policy] = byPolicy[t.policy] || { rates: [], rewards: [] };
      byPolicy[t.policy].rates.push(t.successRate);
      byPolicy[t.policy].rewards.push(t.avgReward);
    });
    const pols = Object.keys(byPolicy);
    const avgRates = pols.map(
      (p) =>
        byPolicy[p].rates.reduce((a, b) => a + b, 0) / byPolicy[p].rates.length,
    );
    const avgRews = pols.map(
      (p) =>
        byPolicy[p].rewards.reduce((a, b) => a + b, 0) /
        byPolicy[p].rewards.length,
    );

    // Chart 1: Success rate by policy
    {
      const PAD = { l: 40, r: 10, t: 32, b: 24 };
      const ctx = ctxSuccessRate;
      clearCanvas(ctx);
      drawTitle(ctx, "Success Rate by Policy", `${trials.length} trials`, PAD);
      drawBars(
        ctx,
        pols,
        avgRates.map((r) => r * 100),
        PALETTE,
        ctx.canvas.width,
        ctx.canvas.height,
        PAD,
      );
    }

    // Chart 2: Avg reward by policy
    {
      const PAD = { l: 48, r: 10, t: 32, b: 24 };
      const ctx = ctxAvgReward;
      clearCanvas(ctx);
      drawTitle(ctx, "Avg Reward by Policy", "", PAD);
      drawBars(
        ctx,
        pols,
        avgRews,
        PALETTE,
        ctx.canvas.width,
        ctx.canvas.height,
        PAD,
      );
    }

    // Chart 3: Success rate across experiments
    {
      const PAD = { l: 48, r: 10, t: 32, b: 30 };
      const ctx = ctxExpComp;
      clearCanvas(ctx);
      drawTitle(ctx, "Success Rate Across Experiments", "", PAD);
      // Group by experiment
      const expMap = {};
      trials.forEach((t) => {
        expMap[t.expName] = expMap[t.expName] || [];
        expMap[t.expName].push(t.successRate);
      });
      const names = Object.keys(expMap).slice(0, 8); // cap at 8
      const vals = names.map((n) => {
        const arr = expMap[n];
        return (arr.reduce((a, b) => a + b, 0) / arr.length) * 100;
      });
      drawBars(
        ctx,
        names.map((n) => (n.length > 12 ? n.slice(0, 12) + "…" : n)),
        vals,
        PALETTE,
        ctx.canvas.width,
        ctx.canvas.height,
        PAD,
      );
    }

    // Chart 4: Outcome distribution
    {
      const PAD = { l: 40, r: 10, t: 32, b: 24 };
      const ctx = ctxOutcomes;
      clearCanvas(ctx);
      drawTitle(ctx, "Trial Outcomes", "", PAD);
      const totalEps = trials.reduce((a, t) => a + t.episodes, 0);
      const totalSuc = trials.reduce((a, t) => a + t.successCount, 0);
      const totalFail = totalEps - totalSuc;
      drawBars(
        ctx,
        ["Successes", "Failures"],
        [totalSuc, totalFail],
        [C.mint, C.danger],
        ctx.canvas.width,
        ctx.canvas.height,
        PAD,
      );
    }

    // Chart 5: Avg reward per experiment
    {
      const PAD = { l: 48, r: 10, t: 32, b: 30 };
      const ctx = ctxRewardExp;
      clearCanvas(ctx);
      drawTitle(ctx, "Avg Reward per Experiment", "", PAD);
      const expMap = {};
      trials.forEach((t) => {
        expMap[t.expName] = expMap[t.expName] || [];
        expMap[t.expName].push(t.avgReward);
      });
      const names = Object.keys(expMap).slice(0, 8);
      const vals = names.map((n) => {
        const arr = expMap[n];
        return arr.reduce((a, b) => a + b, 0) / arr.length;
      });
      drawBars(
        ctx,
        names.map((n) => (n.length > 12 ? n.slice(0, 12) + "…" : n)),
        vals,
        PALETTE,
        ctx.canvas.width,
        ctx.canvas.height,
        PAD,
      );
    }

    // Summary
    const totalSuccess = trials.reduce((a, t) => a + t.successCount, 0);
    const totalEps = trials.reduce((a, t) => a + t.episodes, 0);
    summaryGrid.innerHTML = `
<div><small>TOTAL TRIALS</small><strong>${trials.length}</strong></div>
<div><small>TOTAL EPISODES</small><strong>${totalEps.toLocaleString()}</strong></div>
<div><small>OVERALL SUCCESS RATE</small><strong>${((totalSuccess / totalEps) * 100).toFixed(1)}%</strong></div>
<div><small>EXPERIMENTS INCLUDED</small><strong>${new Set(trials.map((t) => t.expId)).size}</strong></div>
`;
    summaryPanel.hidden = false;

    // Trials table
    trialsBody.innerHTML = trials
      .map(
        (t) => `
<tr>
  <td>${t.expName}</td>
  <td>${t.policy}</td>
  <td>${t.trialIndex + 1}</td>
  <td>${t.episodes}</td>
  <td>${(t.successRate * 100).toFixed(1)}%</td>
  <td>${t.avgReward.toFixed(2)}</td>
</tr>`,
      )
      .join("");
  }

  refreshBtn.addEventListener("click", refresh);
  filterExp.addEventListener("change", refresh);
  filterPolicy.addEventListener("change", refresh);

  // Initial render
  refresh();

  return {
    destroy() {
      container.innerHTML = "";
    },
    refresh,
  };
}
