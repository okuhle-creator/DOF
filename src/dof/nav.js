/**
 * src/dof/nav.js
 * DOF navigation rail — manages module switching and URL hash routing.
 *
 * Public API
 * ----------
 * createNav(container, modules, onSwitch) → { switchTo(id) }
 *
 * Each module descriptor:
 *   { id: string, icon: string (raw SVG markup), label: string, title: string }
 *
 * The nav reads `location.hash` on init and updates it on every switch.
 * Keyboard: ArrowUp / ArrowDown navigate between rail items.
 */

// ---------------------------------------------------------------------------
// SVG icon library — 20×20 viewBox, stroke-based, geometric
// ---------------------------------------------------------------------------

/** @type {Record<string, string>} */
const NAV_ICONS = {
  /* grid + robot caret */
  simulation: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.4"/>
      <rect x="8.5" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.4"/>
      <rect x="2" y="8.5" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.4"/>
      <path d="M11 11.5h6M14 8.5v6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      <circle cx="14" cy="14.5" r="2.5" stroke="currentColor" stroke-width="1.4"/>
    </svg>`,

  /* path through grid with arrows */
  planning: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="1.5" y="1.5" width="17" height="17" rx="1.5" stroke="currentColor" stroke-width="1.2" stroke-dasharray="3 2"/>
      <path d="M4 16 L4 9 L10 9 L10 4 L16 4" stroke="currentColor" stroke-width="1.6"
            stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="4" cy="16" r="1.5" fill="currentColor"/>
      <circle cx="16" cy="4" r="1.5" fill="currentColor"/>
    </svg>`,

  /* brain / neural forward arrow */
  agent: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="7" cy="8" r="4.5" stroke="currentColor" stroke-width="1.4"/>
      <path d="M4.5 6.5 Q7 4.5 9.5 6.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M4.5 9.5 Q7 11.5 9.5 9.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M12 10 L18 10 M15.5 7 L18 10 L15.5 13" stroke="currentColor" stroke-width="1.5"
            stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,

  /* eye / camera */
  perception: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M2 10 C5 5 15 5 18 10 C15 15 5 15 2 10Z" stroke="currentColor" stroke-width="1.4"
            stroke-linejoin="round"/>
      <circle cx="10" cy="10" r="2.8" stroke="currentColor" stroke-width="1.4"/>
      <circle cx="10" cy="10" r="1" fill="currentColor"/>
    </svg>`,

  /* flask / beaker */
  experiments: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M7.5 2.5 L7.5 9 L3 16.5 Q2.5 17.5 3.5 17.5 L16.5 17.5 Q17.5 17.5 17 16.5 L12.5 9 L12.5 2.5"
            stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M6 2.5 L14 2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      <circle cx="8" cy="13.5" r="1" fill="currentColor" opacity="0.7"/>
      <circle cx="12" cy="15" r="0.8" fill="currentColor" opacity="0.5"/>
    </svg>`,

  /* bar chart */
  analytics: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="11" width="3.5" height="6" rx="0.8" stroke="currentColor" stroke-width="1.3"/>
      <rect x="7.25" y="7" width="3.5" height="10" rx="0.8" stroke="currentColor" stroke-width="1.3"/>
      <rect x="12.5" y="3" width="3.5" height="14" rx="0.8" stroke="currentColor" stroke-width="1.3"/>
      <path d="M2 18.5 L18 18.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
    </svg>`,

  /* database / cylinders */
  registry: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <ellipse cx="10" cy="5" rx="7" ry="2.5" stroke="currentColor" stroke-width="1.4"/>
      <path d="M3 5 L3 15" stroke="currentColor" stroke-width="1.4"/>
      <path d="M17 5 L17 15" stroke="currentColor" stroke-width="1.4"/>
      <ellipse cx="10" cy="10" rx="7" ry="2.5" stroke="currentColor" stroke-width="1.4"/>
      <ellipse cx="10" cy="15" rx="7" ry="2.5" stroke="currentColor" stroke-width="1.4"/>
    </svg>`,

  /* open book */
  tutorials: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M10 5 L10 17" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M10 5 C8 3.5 3 3.5 2 4.5 L2 16.5 C3 15.5 8 15.5 10 17"
            stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="M10 5 C12 3.5 17 3.5 18 4.5 L18 16.5 C17 15.5 12 15.5 10 17"
            stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>`,
};

// ---------------------------------------------------------------------------
// Default module definitions (used when caller passes only IDs)
// ---------------------------------------------------------------------------

/** @type {Array<{id:string, label:string, title:string}>} */
export const DEFAULT_MODULES = [
  { id: "simulation", label: "Sim", title: "Simulation Studio" },
  { id: "planning", label: "Plan", title: "Motion Planning" },
  { id: "agent", label: "Agent", title: "Agent Lab" },
  { id: "perception", label: "Percept", title: "Perception Lab" },
  { id: "experiments", label: "Exper", title: "Experiments" },
  { id: "analytics", label: "Stats", title: "Analytics" },
  { id: "registry", label: "Reg", title: "Model Registry" },
  { id: "tutorials", label: "Docs", title: "Tutorials" },
];

// ---------------------------------------------------------------------------
// createNav — public factory
// ---------------------------------------------------------------------------

/**
 * Build and mount the DOF navigation rail into `container`.
 *
 * @param {HTMLElement} container   - The #dof-rail element (or any wrapper)
 * @param {Array<{id:string, icon?:string, label:string, title:string}>} modules
 *   - Module descriptors. `icon` is optional; falls back to NAV_ICONS[id].
 * @param {(moduleId: string) => void} onSwitch
 *   - Callback fired whenever the active module changes.
 * @returns {{ switchTo: (id: string) => void, destroy: () => void }}
 */
export function createNav(container, modules, onSwitch) {
  if (
    typeof window !== "undefined" &&
    window.HTMLElement &&
    !(container instanceof window.HTMLElement)
  ) {
    throw new TypeError("createNav: container must be an HTMLElement");
  }
  if (!Array.isArray(modules) || modules.length === 0) {
    throw new TypeError("createNav: modules must be a non-empty array");
  }

  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  let activeId = null;

  /** @type {Map<string, HTMLButtonElement>} */
  const itemMap = new Map();

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  /**
   * Resolve the module icon — prefer explicit icon in descriptor,
   * then look up NAV_ICONS, then fall back to a generic diamond shape.
   * @param {{id:string, icon?:string}} mod
   * @returns {string} SVG markup
   */
  function resolveIcon(mod) {
    if (mod.icon && mod.icon.trim().startsWith("<")) return mod.icon;
    return NAV_ICONS[mod.id] ?? NAV_ICONS_FALLBACK;
  }

  /**
   * Parse the id portion from location.hash (#planning → 'planning').
   * @returns {string|null}
   */
  function hashToId() {
    const raw = location.hash.replace(/^#/, "").trim();
    return raw || null;
  }

  /**
   * Write location.hash without pushing a history entry.
   * @param {string} id
   */
  function setHash(id) {
    if (typeof window !== "undefined" && window.history?.replaceState) {
      window.history.replaceState(null, "", `#${id}`);
    }
  }

  // ------------------------------------------------------------------
  // Build DOM
  // ------------------------------------------------------------------

  /** Build a single rail button element for a module. */
  function buildItem(mod) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dof-nav-item";
    btn.setAttribute("data-module", mod.id);
    btn.setAttribute("title", mod.title);
    btn.setAttribute("aria-label", mod.title);
    btn.setAttribute("data-tip", mod.title);

    // Icon wrapper
    const iconEl = document.createElement("span");
    iconEl.className = "dof-nav-icon";
    iconEl.innerHTML = resolveIcon(mod);

    // Short label below icon
    const labelEl = document.createElement("span");
    labelEl.className = "dof-nav-label";
    labelEl.textContent = mod.label ?? mod.title;

    btn.append(iconEl, labelEl);

    // Click handler
    btn.addEventListener("click", () => {
      activateModule(mod.id);
    });

    return btn;
  }

  /** Render separator element. */
  function buildSep() {
    const sep = document.createElement("div");
    sep.className = "dof-nav-sep";
    sep.setAttribute("role", "separator");
    sep.setAttribute("aria-hidden", "true");
    return sep;
  }

  // Clear existing rail content and rebuild
  function buildRail() {
    container.innerHTML = "";
    container.setAttribute("role", "navigation");
    container.setAttribute("aria-label", "DOF modules");

    // Split modules into primary (first 5) and secondary (rest)
    const primary = modules.slice(0, 5);
    const secondary = modules.slice(5);

    primary.forEach((mod) => {
      const btn = buildItem(mod);
      itemMap.set(mod.id, btn);
      container.appendChild(btn);
    });

    if (secondary.length > 0) {
      container.appendChild(buildSep());
      secondary.forEach((mod) => {
        const btn = buildItem(mod);
        itemMap.set(mod.id, btn);
        container.appendChild(btn);
      });
    }

    // Spacer pushes any overflow items to bottom if we add more later
    const spacer = document.createElement("div");
    spacer.className = "dof-nav-spacer";
    spacer.setAttribute("aria-hidden", "true");
    container.appendChild(spacer);
  }

  // ------------------------------------------------------------------
  // Activation logic
  // ------------------------------------------------------------------

  /**
   * Activate a module by id.
   * - Updates button active states in the rail
   * - Updates location.hash
   * - Fires onSwitch callback
   * - Shows/hides .dof-module panels in #dof-main (if present)
   *
   * @param {string} id
   * @param {boolean} [silent=false] - If true, skip the onSwitch callback
   */
  function activateModule(id, silent = false) {
    // Validate
    const target = itemMap.get(id);
    if (!target) {
      console.warn(`[DOF nav] Unknown module id: "${id}"`);
      return;
    }

    if (id === activeId) return; // no-op

    // Deactivate current
    if (activeId) {
      const prev = itemMap.get(activeId);
      if (prev) {
        prev.classList.remove("active");
        prev.setAttribute("aria-current", "false");
      }
      // Hide panel
      const prevPanel = document.getElementById(`dof-module-${activeId}`);
      if (prevPanel) prevPanel.classList.remove("active");
    }

    // Activate new
    activeId = id;
    target.classList.add("active");
    target.setAttribute("aria-current", "page");

    // Show panel
    const panel = document.getElementById(`dof-module-${id}`);
    if (panel) panel.classList.add("active");

    // Sync URL hash
    setHash(id);

    // Callback
    if (!silent && typeof onSwitch === "function") {
      onSwitch(id);
    }
  }

  // ------------------------------------------------------------------
  // Keyboard navigation
  // ------------------------------------------------------------------

  /**
   * Returns the ordered list of module item buttons (in DOM order).
   * @returns {HTMLButtonElement[]}
   */
  function getOrderedItems() {
    return modules.map((m) => itemMap.get(m.id)).filter(Boolean);
  }

  /**
   * Move focus/activation by delta within the rail.
   * @param {number} delta  +1 = down, -1 = up
   */
  function navigate(delta) {
    const items = getOrderedItems();
    const currentIdx = items.findIndex(
      (btn) => btn.dataset.module === activeId,
    );
    const nextIdx = Math.max(0, Math.min(items.length - 1, currentIdx + delta));
    const nextBtn = items[nextIdx];
    if (nextBtn) {
      nextBtn.focus();
      activateModule(nextBtn.dataset.module);
    }
  }

  /** Keydown handler for keyboard navigation within the rail. */
  function handleKeyDown(e) {
    switch (e.key) {
      case "ArrowDown":
      case "ArrowRight":
        e.preventDefault();
        navigate(+1);
        break;
      case "ArrowUp":
      case "ArrowLeft":
        e.preventDefault();
        navigate(-1);
        break;
      case "Home":
        e.preventDefault();
        navigate(-Infinity);
        break;
      case "End":
        e.preventDefault();
        navigate(+Infinity);
        break;
    }
  }

  // ------------------------------------------------------------------
  // Hash routing — react to browser back/forward
  // ------------------------------------------------------------------

  function handleHashChange() {
    const id = hashToId();
    if (id && itemMap.has(id)) {
      activateModule(id);
    }
  }

  // ------------------------------------------------------------------
  // Initialise
  // ------------------------------------------------------------------

  buildRail();
  container.addEventListener("keydown", handleKeyDown);
  window.addEventListener("hashchange", handleHashChange);

  // Determine initial active module:
  //   1. Match location.hash
  //   2. Fall back to first module
  const initialId = (() => {
    const fromHash = hashToId();
    if (fromHash && itemMap.has(fromHash)) return fromHash;
    return modules[0]?.id ?? null;
  })();

  if (initialId) {
    // Silent — don't fire onSwitch on first paint, let the app decide
    activateModule(initialId, true);
    // But do fire the callback so the app can render the initial panel
    if (typeof onSwitch === "function") {
      onSwitch(initialId);
    }
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  /**
   * Programmatically switch to a module.
   * @param {string} id
   */
  function switchTo(id) {
    activateModule(id);
  }

  /**
   * Tear down event listeners (call when the nav is removed from DOM).
   */
  function destroy() {
    container.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("hashchange", handleHashChange);
    container.innerHTML = "";
    itemMap.clear();
    activeId = null;
  }

  return { switchTo, destroy };
}

// ---------------------------------------------------------------------------
// Fallback icon (generic diamond) — used if id has no mapping
// ---------------------------------------------------------------------------
const NAV_ICONS_FALLBACK = `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M10 2 L18 10 L10 18 L2 10 Z"
          stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
  </svg>`;

// Re-export icon library so individual modules can reference icons
export { NAV_ICONS };
