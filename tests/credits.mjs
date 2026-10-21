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
// Every Protein Data Bank structure a model uses is built, cited and in docs/credits-molecules.md.
const { MOLECULES } = await import('../data/molecules.js');
const molDoc = await readFile(`${ROOT}docs/credits-molecules.md`, 'utf8');
for (const o of OBJECTS) for (const k of o.pdb ?? []) {
  const m = MOLECULES[k];
  check(m && existsSync(ROOT + m.file), `${o.key}: structure ${k} not built`);
  if (m) check(m.cite && m.source && m.licence && molDoc.includes(m.source), `${o.key}: structure ${k} not credited`);
}

// Every Hot things example has its picture, credited in the app's data and in docs/credits-examples.md.
const { PRESETS } = await import('../js/blackbody.js');
const { EXAMPLE_PICTURES } = await import('../data/examples.js');
const exDoc = await readFile(`${ROOT}docs/credits-examples.md`, 'utf8');
for (const p of PRESETS) {
  const pic = EXAMPLE_PICTURES[p.key];
  check(pic && existsSync(ROOT + pic.file), `${p.key}: no picture`);
  if (pic) {
    check(pic.author && pic.licence && pic.source, `${p.key}: picture without author, licence or source`);
    check(!/NC|ND/.test(pic.licence), `${p.key}: picture licence ${pic.licence}`);
    check(exDoc.includes(pic.source), `${p.key}: picture not in docs/credits-examples.md`);
  }
}
console.log(failures ? `${failures} credit problems` : `  ok    credits for ${Object.keys(MODELS).length} models`);
process.exitCode = failures ? 1 : 0;
