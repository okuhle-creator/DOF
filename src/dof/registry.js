// src/dof/registry.js
// DOF Model Registry — local catalogue for model names, descriptions, tasks,
// formats, input/output metadata, and compatibility status.
//
// Storage: localStorage (JSON serialised; models are metadata only — no binary weights stored)
// Validation: on registration and before enabling inference
//
// Public API:
//   export function createRegistryModule(container) → { destroy() }

const STORAGE_KEY = "dof-model-registry";

// ---------------------------------------------------------------------------
// Supported tasks and formats
// ---------------------------------------------------------------------------

const TASKS = [
  "Image Classification",
  "Object Detection",
  "Image Segmentation",
  "Depth Estimation",
  "Pose Estimation",
  "Natural Language Processing",
  "Time Series",
  "Other",
];

const FORMATS = [
  "ONNX",
  "TensorFlow Lite",
  "TensorFlow SavedModel",
  "PyTorch",
  "CoreML",
  "Other",
];

const BACKENDS = [
  "ONNX Runtime Web (WASM)",
  "ONNX Runtime Web (WebGPU)",
  "TensorFlow.js",
  "Not browser-compatible",
];

// ---------------------------------------------------------------------------
// Schema and validation
// ---------------------------------------------------------------------------

function blankEntry(overrides = {}) {
  return {
    id: `model-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: "",
    description: "",
    task: "Image Classification",
    format: "ONNX",
    backend: "ONNX Runtime Web (WASM)",
    modelUrl: "",
    sourceUrl: "",
    license: "",
    inputShape: "1,3,224,224",
    outputShape: "1,1000",
    inputMean: "0.485,0.456,0.406",
    inputStd: "0.229,0.224,0.225",
    notes: "",
    validated: false, // true only after actual inference tested
    addedAt: new Date().toISOString(),
    ...overrides,
  };
}

function validateEntry(obj) {
  const errors = [];
  if (!obj.name || !obj.name.trim()) errors.push("Name is required");
  if (!obj.task) errors.push("Task is required");
  if (!obj.format) errors.push("Format is required");
  if (obj.modelUrl && obj.modelUrl.trim()) {
    try {
      new URL(obj.modelUrl.trim());
    } catch {
      errors.push("Model URL is not a valid URL");
    }
  }
  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function loadRegistry() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRegistry(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch (err) {
    console.error("DOF Registry: localStorage save failed", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Module entry point
// ---------------------------------------------------------------------------

export function createRegistryModule(container) {
  let entries = loadRegistry();
  let selected = null;

  // Pre-populate with well-known example if empty
  if (entries.length === 0) {
    entries = [
      blankEntry({
        name: "MobileNetV2 ImageNet-1K",
        description:
          "Lightweight image classifier trained on ImageNet 1000 classes. Compatible with ONNX Runtime Web WASM backend. Use in the Perception Lab for genuine inference.",
        task: "Image Classification",
        format: "ONNX",
        backend: "ONNX Runtime Web (WASM)",
        modelUrl:
          "https://huggingface.co/onnx-community/mobilenetv2-10/resolve/main/onnx/model.onnx",
        sourceUrl: "https://huggingface.co/onnx-community/mobilenetv2-10",
        license: "Apache-2.0",
        inputShape: "1,3,224,224",
        outputShape: "1,1000",
        inputMean: "0.485,0.456,0.406",
        inputStd: "0.229,0.224,0.225",
        notes:
          "Centre-crop to 224×224, normalise with ImageNet mean/std. Output is raw logits; apply softmax for probabilities. Validated by DOF Perception Lab.",
        validated: false,
      }),
    ];
    saveRegistry(entries);
  }

  // ── DOM ────────────────────────────────────────────────
  container.innerHTML = `
<div class="registryLab" aria-label="Model Registry">

  <aside class="registrySidebar">
    <div class="registryHead">
      <h2>Model Registry</h2>
      <button id="regNewBtn" class="primary" title="Register new model">+ Register</button>
    </div>
    <div id="regList" class="regList" role="list" aria-label="Model list"></div>
    <div class="registryFoot">
      <button id="regExportBtn" class="wide">↓ Export JSON</button>
      <button id="regImportBtn" class="wide">↑ Import JSON</button>
      <input id="regImportInput" type="file" accept=".json" hidden>
    </div>
  </aside>

  <main class="registryMain">
    <div id="regWelcome" class="regWelcome">
      <h3>Model Registry</h3>
      <p>A local catalogue for tracking model metadata, compatibility and source information. No model weights are stored here — only metadata. Select a model on the left or register a new one.</p>
      <p class="note">Validation status is set manually after you verify that the model produces genuine inference results in the Perception Lab. DOF never claims a model is validated unless that claim is supported by actual testing.</p>
    </div>

    <div id="regDetail" class="regDetail" hidden>
      <div class="regDetailHead">
        <h3 id="regDetailTitle">Model Detail</h3>
        <div class="regDetailActions">
          <button id="regSaveBtn" class="primary">Save</button>
          <button id="regDeleteBtn" class="danger">Delete</button>
        </div>
      </div>

      <div class="regFormGrid">
        <label>Name <span class="req">*</span>
          <input id="regName" type="text" placeholder="Model name">
        </label>

        <label>Task <span class="req">*</span>
          <select id="regTask">${TASKS.map((t) => `<option>${t}</option>`).join("")}</select>
        </label>

        <label>Format
          <select id="regFormat">${FORMATS.map((f) => `<option>${f}</option>`).join("")}</select>
        </label>

        <label>Browser backend
          <select id="regBackend">${BACKENDS.map((b) => `<option>${b}</option>`).join("")}</select>
        </label>

        <label class="regWide">Model URL (.onnx or direct download link)
          <input id="regModelUrl" type="url" placeholder="https://…">
        </label>

        <label class="regWide">Source / paper URL
          <input id="regSourceUrl" type="url" placeholder="https://…">
        </label>

        <label>License
          <input id="regLicense" type="text" placeholder="e.g. Apache-2.0">
        </label>

        <label>Input shape (comma-separated)
          <input id="regInputShape" type="text" placeholder="1,3,224,224">
        </label>

        <label>Output shape
          <input id="regOutputShape" type="text" placeholder="1,1000">
        </label>

        <label>Input mean
          <input id="regInputMean" type="text" placeholder="0.485,0.456,0.406">
        </label>

        <label>Input std
          <input id="regInputStd" type="text" placeholder="0.229,0.224,0.225">
        </label>

        <label class="regWide">Description
          <textarea id="regDescription" rows="3" placeholder="Brief description of the model and its intended use."></textarea>
        </label>

        <label class="regWide">Notes / limitations
          <textarea id="regNotes" rows="3" placeholder="Preprocessing requirements, known limitations, validation status, etc."></textarea>
        </label>

        <div class="regValidationRow">
          <label>
            <input id="regValidated" type="checkbox">
            Mark as validated
          </label>
          <span class="note">Only check this after you have confirmed the model produces genuine inference results in the Perception Lab.</span>
        </div>
      </div>

      <div id="regValidationBanner" class="regValidationBanner" hidden></div>

      <div class="regCompatCard" id="regCompatCard" hidden>
        <h4>Compatibility Assessment</h4>
        <div id="regCompatGrid" class="regCompatGrid"></div>
      </div>

      <div class="regOpenIn">
        <button id="regOpenPerception" class="wide" hidden>Open in Perception Lab →</button>
      </div>
    </div>
  </main>
</div>
`;

  const $ = (id) => container.querySelector(`#${id}`);

  const regList = $("regList");
  const regWelcome = $("regWelcome");
  const regDetail = $("regDetail");
  const regTitle = $("regDetailTitle");

  // Form fields
  const fName = $("regName");
  const fTask = $("regTask");
  const fFormat = $("regFormat");
  const fBackend = $("regBackend");
  const fModelUrl = $("regModelUrl");
  const fSourceUrl = $("regSourceUrl");
  const fLicense = $("regLicense");
  const fInputShape = $("regInputShape");
  const fOutputShape = $("regOutputShape");
  const fInputMean = $("regInputMean");
  const fInputStd = $("regInputStd");
  const fDescription = $("regDescription");
  const fNotes = $("regNotes");
  const fValidated = $("regValidated");

  const validationBanner = $("regValidationBanner");
  const compatCard = $("regCompatCard");
  const compatGrid = $("regCompatGrid");
  const openPercBtn = $("regOpenPerception");

  // ── Render list ────────────────────────────────────────

  function renderList() {
    if (entries.length === 0) {
      regList.innerHTML =
        '<div class="expEmpty">No models registered. Press <strong>+ Register</strong>.</div>';
      return;
    }
    regList.innerHTML = entries
      .map(
        (e) => `
<div class="regListItem ${e.id === selected ? "regListItem--active" : ""}"
     role="listitem" data-id="${e.id}" tabindex="0"
     aria-label="${e.name}, ${e.task}">
  <div class="regListName">${e.name}</div>
  <div class="regListMeta">
    <span class="regTag">${e.format}</span>
    <span class="regTag">${e.task}</span>
    ${e.validated ? '<span class="regTag regTag--ok">✓ Validated</span>' : '<span class="regTag regTag--warn">Unvalidated</span>'}
  </div>
</div>`,
      )
      .join("");

    regList.querySelectorAll(".regListItem").forEach((el) => {
      const activate = () => selectEntry(el.dataset.id);
      el.addEventListener("click", activate);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") activate();
      });
    });
  }

  // ── Select entry ───────────────────────────────────────

  function selectEntry(id) {
    selected = id;
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    renderList();

    regWelcome.hidden = true;
    regDetail.hidden = false;
    regTitle.textContent = entry.name || "Untitled Model";

    fName.value = entry.name;
    fTask.value = entry.task;
    fFormat.value = entry.format;
    fBackend.value = entry.backend;
    fModelUrl.value = entry.modelUrl;
    fSourceUrl.value = entry.sourceUrl;
    fLicense.value = entry.license;
    fInputShape.value = entry.inputShape;
    fOutputShape.value = entry.outputShape;
    fInputMean.value = entry.inputMean;
    fInputStd.value = entry.inputStd;
    fDescription.value = entry.description;
    fNotes.value = entry.notes;
    fValidated.checked = entry.validated;

    renderCompatibility(entry);
    renderValidationBanner(entry);
  }

  function readEntry() {
    return {
      name: fName.value.trim(),
      task: fTask.value,
      format: fFormat.value,
      backend: fBackend.value,
      modelUrl: fModelUrl.value.trim(),
      sourceUrl: fSourceUrl.value.trim(),
      license: fLicense.value.trim(),
      inputShape: fInputShape.value.trim(),
      outputShape: fOutputShape.value.trim(),
      inputMean: fInputMean.value.trim(),
      inputStd: fInputStd.value.trim(),
      description: fDescription.value.trim(),
      notes: fNotes.value.trim(),
      validated: fValidated.checked,
    };
  }

  // ── Compatibility assessment ───────────────────────────

  function renderCompatibility(entry) {
    const isOnnx = entry.format === "ONNX";
    const isBrowserBE =
      entry.backend.includes("ONNX Runtime") ||
      entry.backend.includes("TensorFlow.js");
    const hasUrl = !!entry.modelUrl;
    const isClassify = entry.task === "Image Classification";

    const checks = [
      {
        label: "ONNX format",
        ok: isOnnx,
        note: isOnnx
          ? "Compatible with ONNX Runtime Web"
          : "Convert to ONNX for browser use",
      },
      {
        label: "Browser backend",
        ok: isBrowserBE,
        note: isBrowserBE
          ? entry.backend
          : "No browser-compatible backend selected",
      },
      {
        label: "Model URL provided",
        ok: hasUrl,
        note: hasUrl
          ? entry.modelUrl.slice(0, 60) + "…"
          : "Required for Perception Lab inference",
      },
      {
        label: "Perception Lab support",
        ok: isClassify,
        note: isClassify
          ? "Classification is supported"
          : "Only classification is currently supported",
      },
    ];

    compatGrid.innerHTML = checks
      .map(
        (c) => `
<div class="regCompatRow ${c.ok ? "regCompatRow--ok" : "regCompatRow--warn"}">
  <span class="regCompatIcon">${c.ok ? "✓" : "⚠"}</span>
  <div>
    <strong>${c.label}</strong>
    <div class="note">${c.note}</div>
  </div>
</div>`,
      )
      .join("");

    compatCard.hidden = false;

    // Show "Open in Perception" only if model looks usable
    openPercBtn.hidden = !(isOnnx && isBrowserBE && hasUrl && isClassify);
  }

  function renderValidationBanner(entry) {
    if (entry.validated) {
      validationBanner.hidden = false;
      validationBanner.className =
        "regValidationBanner regValidationBanner--ok";
      validationBanner.textContent =
        "✓ This model is marked as validated. Validation was confirmed through actual inference in the Perception Lab.";
    } else {
      validationBanner.hidden = false;
      validationBanner.className =
        "regValidationBanner regValidationBanner--warn";
      validationBanner.textContent =
        "⚠ This model has not been validated. Inference results cannot be guaranteed until the model is tested in the Perception Lab.";
    }
  }

  // ── CRUD ───────────────────────────────────────────────

  $("regNewBtn").addEventListener("click", () => {
    const entry = blankEntry({ name: `New Model ${entries.length + 1}` });
    entries.unshift(entry);
    saveRegistry(entries);
    renderList();
    selectEntry(entry.id);
  });

  $("regSaveBtn").addEventListener("click", () => {
    if (!selected) return;
    const idx = entries.findIndex((e) => e.id === selected);
    if (idx === -1) return;
    const updated = { ...entries[idx], ...readEntry() };
    const { valid, errors } = validateEntry(updated);
    if (!valid) {
      window.alert("Validation errors:\n" + errors.join("\n"));
      return;
    }
    entries[idx] = updated;
    if (!saveRegistry(entries))
      window.alert("Failed to save — localStorage may be full.");
    else {
      renderList();
      regTitle.textContent = updated.name;
      renderCompatibility(updated);
      renderValidationBanner(updated);
    }
  });

  $("regDeleteBtn").addEventListener("click", () => {
    if (!selected) return;
    if (
      !window.confirm(
        "Delete this model entry? No weights are deleted (only metadata).",
      )
    )
      return;
    entries = entries.filter((e) => e.id !== selected);
    saveRegistry(entries);
    selected = null;
    regDetail.hidden = true;
    regWelcome.hidden = false;
    renderList();
  });

  // ── Export / Import ────────────────────────────────────

  $("regExportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "dof-model-registry.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $("regImportBtn").addEventListener("click", () =>
    $("regImportInput").click(),
  );

  $("regImportInput").addEventListener("change", async () => {
    const file = $("regImportInput").files[0];
    if (!file) return;
    $("regImportInput").value = "";
    let imported;
    try {
      imported = JSON.parse(await file.text());
    } catch {
      window.alert("Invalid JSON file.");
      return;
    }
    if (!Array.isArray(imported)) {
      window.alert("Expected a JSON array of model entries.");
      return;
    }

    let added = 0;
    imported.forEach((obj) => {
      const { valid } = validateEntry(obj);
      if (valid) {
        const entry = blankEntry({ ...obj });
        entries.push(entry);
        added++;
      }
    });
    saveRegistry(entries);
    renderList();
    window.alert(`Imported ${added} of ${imported.length} model entries.`);
  });

  // ── Init ───────────────────────────────────────────────
  renderList();

  return {
    destroy() {
      container.innerHTML = "";
    },
  };
}
