// assets/releases.json, the versions and What's new (as Solar Timeline's): newest first, numbered up, every
// released one dated, one 'next' at most (and first), known kinds, Show me as an address in the app, and
// package.json at the newest released version. The smoke test follows every Show me. Run with `npm test`.
import { readFile } from 'node:fs/promises';

const ROOT = new URL('..', import.meta.url).pathname;
const R = JSON.parse(await readFile(`${ROOT}assets/releases.json`, 'utf8'));
const pkg = JSON.parse(await readFile(`${ROOT}package.json`, 'utf8'));
let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log(`  FAIL  ${msg}`); } };
const rs = R.releases, nums = rs.map(r => r.version.split('.').map(Number));
const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
check(nums.every((n, i) => i === 0 || cmp(nums[i - 1], n) > 0), 'releases newest first, no repeats');
const nexts = rs.filter(r => r.status === 'next');
check(nexts.length <= 1 && (!nexts.length || rs[0] === nexts[0]), "at most one 'next', and it comes first");
for (const r of rs) {
  check(['released', 'next'].includes(r.status), `${r.version}: status ${r.status}`);
  if (r.status === 'released') check(/^\d{4}-\d{2}-\d{2}$/.test(r.date ?? '') && !Number.isNaN(Date.parse(r.date)), `${r.version}: no date`);
  check(r.stage && r.title && r.items?.length, `${r.version}: needs a stage, title and items`);
  for (const it of r.items) {
    check(['new', 'better', 'fix'].includes(it.kind), `${r.version}: kind ${it.kind}`);
    if (it.go) check(/^#[\w.-]+$/.test(it.go), `${r.version}: Show me ${it.go} is not an address`);
  }
}
const latest = rs.find(r => r.status === 'released');
check(latest && pkg.version === latest.version, `package.json is ${pkg.version}, the newest release ${latest?.version}`);
check(R.feedback?.startsWith('https://github.com/danamini/full-spectrum/'), 'feedback goes to the repo');
console.log(failures ? `${failures} release problems` : `  ok    releases (${rs.length}), newest ${latest.version}`);
process.exitCode = failures ? 1 : 0;
