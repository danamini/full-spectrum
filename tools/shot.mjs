// Screenshots of the running site, for checking layouts and for the README.
// node tools/shot.mjs http://localhost:8123/ out-dir hash1 hash2 ... [--w 1440 --h 900 --wait 2500]
import { chromium } from 'playwright';
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args.splice(i, 2)[1] : d; };
const w = +opt('w', 1440), h = +opt('h', 900), wait = +opt('wait', 2500), mobile = !!+opt('mobile', 0);
const [base, out, ...hashes] = args;
const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
for (const hash of hashes.length ? hashes : ['']) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${base}#${hash}`);
  await page.waitForTimeout(wait);
  const name = (hash || 'landing').replace(/[^\w.-]/g, '_');
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(name, errors.length ? `ERRORS: ${errors.join(' | ')}` : 'ok');
  await page.close();
}
await browser.close();
