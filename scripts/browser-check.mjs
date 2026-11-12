#!/usr/bin/env node
// Screenshots pages of the local dev server and reports browser errors.
// Used by AI runs to check UI changes (AGENTS.md → "When an AI works tickets
// on its own" → step 4). Start the dev server first, in test mode:
//
//   VITE_DEV_TEST_MODE=1 VITE_DEV_AUTH_BYPASS=1 npm run dev
//   node scripts/browser-check.mjs /dashboard /step/1-name [--mobile]
//
// Screenshots go to .browser-check/ (gitignored). Exits 1 if any page logs a
// console error or fails to load.
//
// Wizard answers live in React memory, so a page loaded directly (like
// /step/11-preview) may redirect to step 1. For flows, write a short Playwright
// script that clicks through instead (see docs/manual-testing.md for the test panel).
import { mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function parseArgs(argv) {
  const opts = { baseUrl: "http://localhost:8080", paths: [], mobile: false, outDir: ".browser-check" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--mobile") opts.mobile = true;
    else if (arg === "--base-url") opts.baseUrl = argv[++i];
    else if (arg === "--out") opts.outDir = argv[++i];
    else opts.paths.push(arg);
  }
  opts.baseUrl = opts.baseUrl.replace(/\/+$/, "");
  // AIDEV-NOTE: only the local dev server. Test mode fakes the backend there;
  // staging and production share the real Supabase project (AGENTS.md).
  if (!LOCAL_HOSTS.has(new URL(opts.baseUrl).hostname)) {
    throw new Error(`--base-url must be a local dev server, got ${opts.baseUrl}`);
  }
  if (opts.paths.length === 0) opts.paths.push("/");
  return opts;
}

export function screenshotName(pagePath, mobile) {
  const slug = pagePath.replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9]+/gi, "-") || "home";
  return `${slug}-${mobile ? "mobile" : "desktop"}.png`;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { chromium, devices } = await import("playwright");
  const browser = await chromium.launch();
  const context = await browser.newContext(
    opts.mobile ? devices["iPhone 13"] : { viewport: { width: 1280, height: 900 } },
  );
  mkdirSync(opts.outDir, { recursive: true });
  let problems = 0;

  for (const pagePath of opts.paths) {
    const page = await context.newPage();
    const errors = [];
    page.on("console", (msg) => msg.type() === "error" && errors.push(`console: ${msg.text()}`));
    page.on("pageerror", (err) => errors.push(`page error: ${err.message}`));
    const url = opts.baseUrl + pagePath;
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    } catch (err) {
      errors.push(`load failed: ${err.message}`);
    }
    const file = path.join(opts.outDir, screenshotName(pagePath, opts.mobile));
    await page.screenshot({ path: file, fullPage: true }).catch(() => {});
    console.log(`${errors.length ? "✗" : "✓"} ${url} (ended at ${page.url()}) → ${file}`);
    for (const e of errors) console.log(`    ${e}`);
    problems += errors.length;
    await page.close();
  }

  await browser.close();
  process.exit(problems ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
