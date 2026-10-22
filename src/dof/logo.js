/**
 * src/dof/logo.js
 * DOF — Degrees of Freedom logo SVG.
 *
 * Geometric mark: three intersecting arcs representing rotational freedom
 * about X, Y, and Z axes — the three mechanical degrees of rotational freedom.
 *
 * Palette:
 *   Cobalt  #2f81f7  — primary axis ring (X)
 *   Mid     #58a6ff  — secondary ring (Y)
 *   Mint    #56d364  — accent ring (Z) + centre node
 *
 * Usage:
 *   import { DOF_LOGO_SVG } from './dof/logo.js';
 *   element.innerHTML = DOF_LOGO_SVG;
 *
 *   Or as an image src via data URI:
 *   img.src = `data:image/svg+xml,${encodeURIComponent(DOF_LOGO_SVG)}`;
 */

/**
 * Inline SVG string — 40×40 viewBox, transparent background.
 * The mark depicts:
 *   - A large arc ring (X-axis rotation) in cobalt
 *   - A medium arc ring (Y-axis rotation) in cobalt-hi, rotated 60°
 *   - A small arc ring (Z-axis rotation) in mint, rotated -60°
 *   - A small centre sphere node in mint
 *   - Three radial tick marks at axis endpoints
 * @type {string}
 */
export const DOF_LOGO_SVG = `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 40 40"
  width="40"
  height="40"
  fill="none"
  role="img"
  aria-label="DOF – Degrees of Freedom"
>
  <title>DOF – Degrees of Freedom</title>

  <!-- ── Outer ring: X-axis rotational freedom (cobalt) ── -->
  <circle
    cx="20" cy="20" r="16"
    stroke="#2f81f7"
    stroke-width="1.8"
    stroke-dasharray="30 20.1"
    stroke-dashoffset="0"
    stroke-linecap="round"
    opacity="0.9"
  />

  <!-- ── Middle ring: Y-axis (cobalt-hi) — tilted 60° ── -->
  <ellipse
    cx="20" cy="20"
    rx="16" ry="7"
    stroke="#58a6ff"
    stroke-width="1.8"
    stroke-dasharray="26 18"
    stroke-dashoffset="3"
    stroke-linecap="round"
    opacity="0.85"
    transform="rotate(-30 20 20)"
  />

  <!-- ── Inner ring: Z-axis (mint) — tilted -60° ── -->
  <ellipse
    cx="20" cy="20"
    rx="16" ry="7"
    stroke="#56d364"
    stroke-width="1.8"
    stroke-dasharray="22 22.1"
    stroke-dashoffset="6"
    stroke-linecap="round"
    opacity="0.85"
    transform="rotate(30 20 20)"
  />

  <!-- ── X-axis spoke (cobalt) — right endpoint ── -->
  <line
    x1="20" y1="20"
    x2="36" y2="20"
    stroke="#2f81f7"
    stroke-width="1.4"
    stroke-linecap="round"
    opacity="0.6"
  />
  <!-- X endpoint arrow head -->
  <polyline
    points="33,17.5 36,20 33,22.5"
    stroke="#2f81f7"
    stroke-width="1.4"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
    opacity="0.8"
  />

  <!-- ── Y-axis spoke (cobalt-hi) — upper-left endpoint ── -->
  <line
    x1="20" y1="20"
    x2="8" y2="9.5"
    stroke="#58a6ff"
    stroke-width="1.4"
    stroke-linecap="round"
    opacity="0.6"
  />
  <!-- Y endpoint arrow head -->
  <polyline
    points="10.5,7.5 8,9.5 10.5,12"
    stroke="#58a6ff"
    stroke-width="1.4"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
    opacity="0.8"
  />

  <!-- ── Z-axis spoke (mint) — upward ── -->
  <line
    x1="20" y1="20"
    x2="20" y2="4"
    stroke="#56d364"
    stroke-width="1.4"
    stroke-linecap="round"
    opacity="0.6"
  />
  <!-- Z endpoint arrow head -->
  <polyline
    points="17.5,7 20,4 22.5,7"
    stroke="#56d364"
    stroke-width="1.4"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
    opacity="0.8"
  />

  <!-- ── Centre node — glowing mint dot ── -->
  <circle
    cx="20" cy="20" r="2.8"
    fill="#56d364"
    opacity="0.95"
  />
  <circle
    cx="20" cy="20" r="1.2"
    fill="#0d1117"
  />

  <!-- ── Axis labels (tiny, optional — can be toggled off via CSS) ── -->
  <text
    x="37.5" y="20.4"
    font-size="4.5"
    font-family="'JetBrains Mono', 'Fira Code', monospace"
    font-weight="700"
    fill="#2f81f7"
    text-anchor="start"
    dominant-baseline="middle"
    opacity="0.7"
  >x</text>
  <text
    x="6.5" y="8"
    font-size="4.5"
    font-family="'JetBrains Mono', 'Fira Code', monospace"
    font-weight="700"
    fill="#58a6ff"
    text-anchor="end"
    dominant-baseline="auto"
    opacity="0.7"
  >y</text>
  <text
    x="20" y="2.8"
    font-size="4.5"
    font-family="'JetBrains Mono', 'Fira Code', monospace"
    font-weight="700"
    fill="#56d364"
    text-anchor="middle"
    dominant-baseline="auto"
    opacity="0.7"
  >z</text>
</svg>`;

/**
 * Larger variant (80×80) — for splash screens, modals, or about pages.
 * Same geometry, doubled scale — SVG auto-scales so this is just metadata.
 * @type {string}
 */
export const DOF_LOGO_SVG_LG = DOF_LOGO_SVG.replace(
  'width="40"',
  'width="80"',
).replace('height="40"', 'height="80"');

/**
 * Returns a data URI suitable for use as an <img> src or CSS background-image.
 * @param {string} [svg=DOF_LOGO_SVG]
 * @returns {string}
 */
export function logoDataURI(svg = DOF_LOGO_SVG) {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
