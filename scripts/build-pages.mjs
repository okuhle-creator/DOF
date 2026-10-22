import { mkdir, copyFile } from "node:fs/promises";
await mkdir("_site", { recursive: true });
await copyFile("dist/dof.html", "_site/index.html");
await copyFile("dist/dof.html", "_site/dof.html");
await copyFile(
  "dist/robotics-arm-studio.html",
  "_site/robotics-arm-studio.html",
);
console.log("GitHub Pages artifacts in _site/:");
console.log("  - index.html (DOF platform)");
console.log("  - dof.html (DOF platform)");
console.log("  - robotics-arm-studio.html (ARMATURE robot studio)");
