// Every ready-made model ships with its credit: the file exists, the app knows who made it and under what
// licence, and docs/credits-models.md names it. Run with `npm test`.
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { MODELS } from '../data/models.js';
import { OBJECTS } from '../js/scale.js';

const ROOT = new URL('..', import.meta.url).pathname;
const doc = await readFile(`${ROOT}docs/credits-models.md`, 'utf8');
let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log(`  FAIL  ${msg}`); } };
for (const [key, m] of Object.entries(MODELS)) {
  check(OBJECTS.some(o => o.key === key), `${key}: not a thing in js/scale.js`);
  check(existsSync(ROOT + m.file), `${key}: ${m.file} missing`);
  for (const f of ['title', 'author', 'source', 'site', 'licence', 'licenceUrl']) check(m[f], `${key}: no ${f}`);
  check(!/NC|ND/.test(m.licence), `${key}: licence ${m.licence} forbids commercial use or changes`);
  check(doc.includes(m.source) && doc.includes(m.author), `${key}: not credited in docs/credits-models.md`);
}
console.log(failures ? `${failures} credit problems` : `  ok    credits for ${Object.keys(MODELS).length} models`);
process.exitCode = failures ? 1 : 0;
