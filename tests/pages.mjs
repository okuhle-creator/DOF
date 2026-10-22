import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { chromium } from "playwright";

// Serve under a project path, as GitHub Pages does.
const dofHtml = await readFile("_site/index.html");
const studioHtml = await readFile("_site/robotics-arm-studio.html");

const server = createServer((req, res) => {
  const path = req.url.split("?")[0];
  if (
    path === "/" ||
    path === "/index.html" ||
    path === "/dof.html" ||
    path === "/DOF/" ||
    path === "/DOF/index.html" ||
    path === "/DOF/dof.html" ||
    path === "/armature/" ||
    path === "/armature/index.html" ||
    path === "/armature/dof.html"
  ) {
    res.setHeader("Content-Type", "text/html");
    res.end(dofHtml);
    return;
  }
  if (
    path === "/robotics-arm-studio.html" ||
    path === "/DOF/robotics-arm-studio.html" ||
    path === "/armature/robotics-arm-studio.html"
  ) {
    res.setHeader("Content-Type", "text/html");
    res.end(studioHtml);
    return;
  }
  res.writeHead(404).end();
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({
    ...(process.env.CI ? {} : { channel: "chrome" }),
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage();
  const errors = [],
    requests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (req) => requests.push(req.url()));
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 1;
  });

  // 1. Test DOF Platform landing page
  await page.goto(origin + "/DOF/");
  await page.waitForSelector(".dof-shell");
  const title = await page.title();
  assert.ok(title.includes("DOF"), `Title must mention DOF: ${title}`);
  assert.equal(
    await page.locator(".dof-rail-brand svg").count(),
    1,
    "DOF logo present in rail",
  );
  assert.ok(
    await page.locator('.dof-nav-item[data-module="planning"]').isVisible(),
    "Planning module in nav",
  );
  assert.ok(
    await page.locator('.dof-nav-item[data-module="agent"]').isVisible(),
    "Agent module in nav",
  );

  // Switch to planning tab and verify canvas
  await page.click('.dof-nav-item[data-module="planning"]');
  await page.waitForSelector("#dof-canvas");
  assert.ok(
    await page.locator("#dof-canvas").isVisible(),
    "A* planning canvas visible",
  );

  // Switch to agent tab and verify agent lab
  await page.click('.dof-nav-item[data-module="agent"]');
  await page.waitForSelector("#agentGridCanvas");
  assert.ok(
    await page.locator("#agentGridCanvas").isVisible(),
    "GridWorld canvas visible",
  );

  assert.deepEqual(errors, [], "No page errors in DOF platform");
  console.log(
    "DOF Pages smoke passed: navigation rail, logo, planning & agent modules boot cleanly.",
  );

  // 2. Test Studio page
  errors.length = 0;
  requests.length = 0;
  await page.goto(origin + "/DOF/robotics-arm-studio.html");
  await page.waitForFunction(() => window.armature?.builder);
  assert.equal(await page.locator('#task option[value^="memory_"]').count(), 0);
  assert.equal(await page.evaluate(() => !!armature.memory), false);
  assert.equal(await page.locator("#memorySettingsHost").isVisible(), false);
  const result = await page.evaluate(() => {
    armature.reset({ robotId: "so101", task: "kit", seed: 42 });
    const action = armature.observe().state;
    for (let i = 0; i < 30; i++) armature.step(action);
    return armature.observe();
  });
  assert.ok(result);
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, [origin + "/DOF/robotics-arm-studio.html"]);
  await page.goto(origin + "/DOF/robotics-arm-studio.html?memory=1");
  await page.waitForFunction(() => !!window.armature?.memory);
  assert.equal(await page.locator('#task option[value^="memory_"]').count(), 4);
  assert.deepEqual(errors, []);
  console.log(
    "Studio Pages smoke passed: project-path boot, hidden memory, simulation steps, no dependencies, research opt-in.",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
