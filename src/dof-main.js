// src/dof-main.js
// DOF — Degrees of Freedom
// Application entry point: initialises the navigation rail and mounts all modules.
//
// License: GPL-3.0-only (C) 2026 Arpit Gupta
// This file is part of the DOF platform, built on the ARMATURE project.

import { createNav, DEFAULT_MODULES } from "./dof/nav.js";
import { DOF_LOGO_SVG } from "./dof/logo.js";
import { createPlanningModule } from "./dof/planning.js";
import { createAgentModule } from "./dof/agent.js";
import { createPerceptionModule } from "./dof/perception.js";
import { createExperimentsModule } from "./dof/experiments.js";
import { createAnalyticsModule } from "./dof/analytics.js";
import { createRegistryModule } from "./dof/registry.js";
import { createTutorialsModule } from "./dof/tutorials.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODULES = DEFAULT_MODULES; // simulation, planning, agent, perception, experiments, analytics, registry, tutorials

// ---------------------------------------------------------------------------
// Module instances (lazy — created on first visit)
// ---------------------------------------------------------------------------

const moduleInstances = new Map();

// Experiment data bridge: analytics reads from experiments module
let experimentsModule = null;

// ---------------------------------------------------------------------------
// Panel helpers
// ---------------------------------------------------------------------------

function getPanel(moduleId) {
  return document.getElementById(`panel-${moduleId}`);
}

function showPanel(moduleId) {
  MODULES.forEach((m) => {
    const p = getPanel(m.id);
    if (p) p.hidden = m.id !== moduleId;
  });
}

function setHeaderModule(title) {
  const el = document.getElementById("dof-header-module");
  if (el) el.textContent = title;
}

// ---------------------------------------------------------------------------
// Simulation module — embed the ARMATURE studio in an iframe-like wrapper.
// The full studio is in a separate HTML; within DOF we provide a bridge panel.
// ---------------------------------------------------------------------------

function mountSimulation(panel) {
  panel.innerHTML = `
<div class="simBridge" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:24px;padding:32px;text-align:center;">
  <div style="max-width:600px;">
    <h2 style="color:var(--dof-text-hi);margin-bottom:16px;">Simulation Studio</h2>
    <p style="color:var(--dof-text-md);margin-bottom:8px;">
      The full ARMATURE robot simulation is available as a separate self-contained page.
      It includes Three.js + Cannon-ES physics, Franka Panda, SO-101, UR5e and xArm 6 robots,
      kitting cell scene, LeRobot v3 dataset recording, stress testing and CEM reach training.
    </p>
    <p style="color:var(--dof-text-md);margin-bottom:24px;">
      Opening it in a new tab preserves the DOF platform in this tab.
    </p>
    <a href="robotics-arm-studio.html"
       target="_blank" rel="noopener"
       style="display:inline-block;padding:10px 24px;background:var(--dof-cobalt);color:#fff;border-radius:var(--dof-r-md);text-decoration:none;font-weight:600;">
      Open Simulation Studio ↗
    </a>
    <div style="margin-top:32px;padding:16px;background:var(--dof-bg-card);border:1px solid var(--dof-border);border-radius:var(--dof-r-md);text-align:left;">
      <h4 style="color:var(--dof-text-hi);margin-bottom:8px;">Simulation capabilities</h4>
      <ul style="color:var(--dof-text-md);padding-left:18px;line-height:1.7;">
        <li>Kinematic and experimental dynamic robot control (Cannon-ES physics)</li>
        <li>Pick-and-place, sorting, stacking, peg insertion, reach tasks</li>
        <li>Overhead + wrist camera feeds (RGB)</li>
        <li>LeRobot v3-style dataset export (Parquet)</li>
        <li>Stress testing with batch trials and failure analysis</li>
        <li>CEM reach controller training (4 generations × 6 candidates)</li>
        <li>Developer API: <code style="font-family:var(--dof-font-mono);font-size:12px;">window.armature.step(action)</code></li>
      </ul>
      <p style="color:var(--dof-text-md);margin-top:8px;font-size:12px;">
        ⚠ Dynamic physics mode (Cannon-ES) is an experiment — not MuJoCo-equivalent. Kinematic mode is validated.
      </p>
    </div>
  </div>
</div>`;
}

// ---------------------------------------------------------------------------
// Module mount dispatcher
// ---------------------------------------------------------------------------

function mountModule(moduleId, panel) {
  if (moduleInstances.has(moduleId)) return; // already mounted

  switch (moduleId) {
    case "simulation":
      mountSimulation(panel);
      moduleInstances.set("simulation", { destroy() {} });
      break;

    case "planning": {
      const m = createPlanningModule(panel);
      moduleInstances.set("planning", m);
      break;
    }

    case "agent": {
      const m = createAgentModule(panel);
      moduleInstances.set("agent", m);
      break;
    }

    case "perception": {
      const m = createPerceptionModule(panel);
      moduleInstances.set("perception", m);
      break;
    }

    case "experiments": {
      const m = createExperimentsModule(panel);
      experimentsModule = m;
      moduleInstances.set("experiments", m);
      break;
    }

    case "analytics": {
      const m = createAnalyticsModule(panel, () =>
        experimentsModule ? experimentsModule.getExperiments() : [],
      );
      moduleInstances.set("analytics", m);
      break;
    }

    case "registry": {
      const m = createRegistryModule(panel);
      moduleInstances.set("registry", m);
      break;
    }

    case "tutorials": {
      // Pass nav reference so tutorials can deep-link to modules
      const m = createTutorialsModule(panel, nav);
      moduleInstances.set("tutorials", m);
      break;
    }

    default:
      panel.innerHTML = `<div style="padding:32px;color:var(--dof-text-md);">Module "${moduleId}" not implemented.</div>`;
      moduleInstances.set(moduleId, { destroy() {} });
  }
}

// ---------------------------------------------------------------------------
// Navigation wiring
// ---------------------------------------------------------------------------

// The nav instance — needs to be accessible to tutorials for deep-linking
let nav = null;

function onModuleSwitch(moduleId) {
  const mod = MODULES.find((m) => m.id === moduleId);
  const panel = getPanel(moduleId);
  if (!panel) return;

  // Mount on first visit
  mountModule(moduleId, panel);

  // Show this panel, hide others
  showPanel(moduleId);

  // Update header
  setHeaderModule(mod?.title ?? moduleId);

  // If analytics, refresh charts (new data may have arrived from experiments)
  if (moduleId === "analytics") {
    const inst = moduleInstances.get("analytics");
    if (inst?.refresh) inst.refresh();
  }
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

function init() {
  // Inject logo
  const brandEl = document.getElementById("dof-rail-brand");
  if (brandEl) brandEl.innerHTML = DOF_LOGO_SVG;

  // Build nav rail
  const railItems = document.getElementById("dof-rail-items");
  nav = createNav(railItems, MODULES, onModuleSwitch);

  // Activate initial module from URL hash or default
  const hash = location.hash.replace(/^#/, "").trim();
  const initial = MODULES.find((m) => m.id === hash) ? hash : "simulation";
  nav.switchTo(initial);
}

// Run after DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
