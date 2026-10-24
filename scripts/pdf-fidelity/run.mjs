// PDF fidelity test: renders sample pages in Chromium, then compares
//   (A) the browser's own on-screen render at print scale (= what the editor shows)
//   (B) the PDF pipeline's raster, and (C) the actual PDF page rasterized back.
// Usage: node run.mjs <serveRoot> <outDir>
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
const [root, out, strategy] = process.argv.slice(2); // strategy optional: viewbox | css-transform | scaled-image
const pages = JSON.parse(fs.readFileSync(path.join(root, "pages.json"), "utf8"));
const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 6, viewport: { width: 500, height: 1200 } });
const page = await ctx.newPage();
page.on("console", m => console.log("[browser]", m.text()));
page.on("pageerror", e => console.log("[pageerror]", e.message));
await page.goto("http://127.0.0.1:8765/harness.html");
await page.waitForFunction(() => window.harnessReady);
console.log("calibration:", JSON.stringify(await page.evaluate(() => window.calibrate())));
const res = await page.evaluate(([p, s]) => window.runTest(p, s || undefined), [pages, strategy]);
const els = await page.$$("[data-page]");
for (let i = 0; i < els.length; i++) {
  await els[i].screenshot({ path: path.join(out, `screen-${i}.png`) });
  fs.writeFileSync(path.join(out, `raster-${i}.png`), Buffer.from(res.rasters[i].split(",")[1], "base64"));
}
fs.writeFileSync(path.join(out, "album.pdf"), Buffer.from(res.pdf.split(",")[1], "base64"));
await browser.close();
console.log("done", els.length, "pages");
