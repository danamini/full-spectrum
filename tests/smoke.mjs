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

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });

let failures = 0;
async function test(name, fn, { viewport = { width: 1440, height: 900 }, mobile = false, timeout = false } = {}) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  if (timeout) page.setDefaultTimeout(0);
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

const wait = (page, ms) => page.waitForTimeout(ms);
const go = async (page, hash, ms = 2200) => { await page.goto(`${BASE}#${hash}`); await wait(page, ms); };
const app = page => page.evaluate(() => ({ view: spectrum.state.view, metres: spectrum.ribbon.metres, span: spectrum.ribbon.span, name: document.querySelector('#name').textContent, landing: document.body.classList.contains('at-landing') }));
const near = (a, b, rel = 0.02) => Math.abs(Math.log(a / b)) < rel;

await test('landing page, chapters and the full spectrum', async page => {
  await page.goto(BASE); await wait(page, 1200);
  const s = await app(page);
  expect(s.landing, 'landing not shown');
  expect(await page.locator('.chapters li').count() === 7, 'expected 7 chapters');
  expect(s.span > 25, `span ${s.span}`);
  await page.click('#explore'); await wait(page, 2000);
  expect(!(await app(page)).landing, 'explore did not leave the landing page');
});

await test('every band and sub-band address', async page => {
  const keys = await page.goto(BASE).then(() => page.evaluate(() => import('./js/bands.js').then(m => m.BANDS.flatMap(b => [b.key, ...b.subs.map(s => s.key)]))));
  for (const k of keys) {
    await page.evaluate(k => spectrum.go(k), k); await wait(page, 120);
  }
  await wait(page, 2000);
  const s = await app(page);
  expect(s.view === 'spectrum', s.view);
});

await test('every thing lands on its wavelength', async page => {
  await page.goto(BASE); await wait(page, 500);
  const things = await page.evaluate(() => import('./js/things.js').then(m => m.THINGS.map(t => [t.key, t.m])));
  for (const [key, m] of things) {
    await page.evaluate(k => spectrum.go(`thing-${k}`), key);
    await page.evaluate(() => new Promise(r => setTimeout(r, 2100)));
    const s = await app(page);
    expect(near(s.metres, m, 0.01), `${key}: at ${s.metres}, want ${m}`);
  }
}, { timeout: true });

await test('unit addresses', async page => {
  for (const [hash, want] of [['nm-550', 550e-9], ['ghz-2.45', 0.12236], ['kev-511', 2.4263e-12], ['cm-21', 0.21], ['m-3', 3]]) {
    await go(page, hash, 2400);
    const s = await app(page);
    expect(near(s.metres, want), `${hash}: ${s.metres}`);
  }
});

await test('typing a value into the readout', async page => {
  await go(page, 'visible');
  for (const [sel, text, want] of [['#inLength', '21 cm', 0.21], ['#inFreq', '2.45 GHz', 0.12236], ['#inEnergy', '13.6 eV', 91.16e-9]]) {
    await page.fill(sel, text); await page.press(sel, 'Enter'); await wait(page, 2400);
    const s = await app(page);
    expect(near(s.metres, want), `${text}: ${s.metres}`);
  }
});

await test('wave, 3D fields and photons', async page => {
  await go(page, 'thing-fm');
  for (const mode of ['field', 'photons', 'wave']) {
    await page.click(`.seg [data-mode="${mode}"]`); await wait(page, 1500);
    expect(await page.evaluate(() => spectrum.state.mode) === mode, mode);
  }
  await page.click('.seg [data-mode="field"]'); await wait(page, 800);
  await page.click('[data-polar="circular"]'); await wait(page, 800);
  expect(await page.locator('#fieldHost canvas').count() === 1, 'no 3D canvas');
});

await test('visible light views', async page => {
  for (const v of ['prism', 'lines', 'sunlight', 'eyes']) {
    await go(page, v, 1800);
    const s = await app(page);
    expect(s.view === 'visible', `${v}: ${s.view}`);
    expect(s.span < 3, `${v}: ribbon not zoomed (${s.span})`);
  }
  await page.hover('#visCanvas', { position: { x: 400, y: 300 } });
});

await test('hot things: presets and slider', async page => {
  await go(page, 'blackbody-sun');
  expect(near(await page.evaluate(() => spectrum.state.kelvin), 5772, 0.001), 'sun preset');
  await page.selectOption('#tempPreset', 'lava'); await wait(page, 1500);
  expect(near(await page.evaluate(() => spectrum.state.kelvin), 1400, 0.001), 'lava preset');
  await page.fill('#tempSlider', '100'); await wait(page, 300);
  const k = await page.evaluate(() => spectrum.state.kelvin);
  expect(k > 11 && k < 14, `slider at 100/1000 should be about 12 K (log scale, 2.7 K to 10 million K), was ${k}`);
  await go(page, 'blackbody-310');
  const s = await app(page);
  expect(near(s.metres, 9.35e-6, 0.02), `body peak ${s.metres}`);
});

await test('through the air and the sky', async page => {
  await go(page, 'air', 2600);
  expect((await app(page)).view === 'air', 'air');
  await page.hover('#airCanvas', { position: { x: 300, y: 330 } });
  for (const k of ['milkyway', 'sun', 'crab']) {
    await go(page, `sky-${k}`, 2600);
    expect((await app(page)).view === 'sky', `sky-${k}`);
    const loaded = await page.evaluate(() => [...document.querySelectorAll('#skyHost img')].filter(i => i.src && i.complete && i.naturalWidth === 0).map(i => i.src));
    expect(!loaded.length, `broken images: ${loaded.join(', ')}`);
  }
  await page.click('.sky-strip button:last-child'); await wait(page, 1500);
});

await test('journey, tour, surprise and the keyboard', async page => {
  await page.goto(BASE); await wait(page, 800);
  await page.click('#startJourney'); await wait(page, 2500);
  expect(!(await page.locator('#caption').isHidden()), 'caption hidden');
  await page.click('#captionNext'); await wait(page, 2200);
  await page.click('#captionStop');
  expect(await page.locator('#caption').isHidden(), 'caption still shown');
  await page.keyboard.press('t'); await wait(page, 1500);
  expect(await page.evaluate(() => !!spectrum.state.tour), 'tour not running');
  await page.keyboard.press('Escape'); await wait(page, 300);
  expect(await page.evaluate(() => !spectrum.state.tour), 'tour not stopped');
  await page.keyboard.press('r'); await wait(page, 2200);
  expect((await page.evaluate(() => location.hash)).startsWith('#thing-'), 'surprise');
  for (const k of ['ArrowLeft', 'ArrowRight', '+', '-', '0', '3', 'v', 'b', 'a', 'k', 'w', '?']) { await page.keyboard.press(k); await wait(page, 350); }
  expect(await page.locator('#help').isVisible(), 'help not open');
});

await test('dragging and zooming the ribbon', async page => {
  await go(page, 'visible');
  const before = await app(page);
  const box = await page.locator('#ribbon').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 80);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 200, box.y + 80, { steps: 8 }); await page.mouse.up();
  await wait(page, 900);
  const after = await app(page);
  expect(after.metres > before.metres, 'dragging right should tune to longer waves');
  await page.mouse.wheel(0, 300); await wait(page, 200);
  expect((await app(page)).span > after.span, 'scroll did not zoom out');
});

await test('phone layout', async page => {
  await go(page, 'thing-wifi');
  expect(await page.locator('#name').isVisible(), 'title not visible');
  await page.click('#sheetToggle'); await wait(page, 300);
  expect(await page.locator('#details').isVisible(), 'details sheet did not open');
  await page.click('.sections a[data-section="blackbody"]'); await wait(page, 1500);
  expect((await app(page)).view === 'blackbody', 'section link on phone');
}, { viewport: { width: 390, height: 844 }, mobile: true });

await browser.close();
server.close();
if (failures) { console.log(`${failures} failed`); process.exit(1); }
