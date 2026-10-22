import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const PORT = process.env.PORT || 3000;
const DIST_DIR = path.resolve("dist");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  const urlPath = req.url.split("?")[0];
  let filePath =
    urlPath === "/" || urlPath === "/index.html"
      ? "dof.html"
      : urlPath.replace(/^\//, "");
  let fullPath = path.join(DIST_DIR, filePath);

  // If path doesn't exist directly in dist, check _site or root
  if (!fs.existsSync(fullPath)) {
    fullPath = path.join(DIST_DIR, "dof.html");
  }

  const ext = path.extname(fullPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n  DOF — Degrees of Freedom`);
  console.log(`  Local server running at: http://127.0.0.1:${PORT}/`);
  console.log(
    `  - DOF Platform:          http://127.0.0.1:${PORT}/dof.html (or /)`,
  );
  console.log(
    `  - Simulation Studio:     http://127.0.0.1:${PORT}/robotics-arm-studio.html\n`,
  );
});
