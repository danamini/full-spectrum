// End-to-end smoke tests: serve the site, drive it in Chromium, and fail on any broken step or console
// error. Run with `npm test` (first time: `npm install && npx playwright install chromium`).
// Set CHROME_PATH to use an existing Chromium instead.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };

const server = http.createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = path.endsWith('/') || path.endsWith('\\') ? `${path}index.html` : path;
  try {
    const body = await readFile(join(ROOT, file));
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

let failures = 0;
async function test(name, fn, { viewport = { width: 1440, height: 900 }, mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  try {
    await fn(page);
    if (errors.length) throw new Error(`console errors:\n    ${errors.join('\n    ')}`);
    console.log(`  ok    ${name}`);
  } catch (err) {
    failures++;
    console.log(`  FAIL  ${name}\n    ${err.message}`);
  }
  await ctx.close();
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

await test('landing page loads and computes a readout', async page => {
  await page.goto(BASE);
  const text = await page.locator('#readout').textContent();
  expect(/545 THz/.test(text), `readout was "${text}"`);
});
await test('phone layout', async page => {
  await page.goto(BASE);
  expect(await page.locator('h1').isVisible(), 'title not visible');
}, { viewport: { width: 390, height: 844 }, mobile: true });

await browser.close();
server.close();
if (failures) { console.log(`${failures} failed`); process.exit(1); }
