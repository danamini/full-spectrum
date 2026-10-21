// Downloads the ready-made 3D models the wave view uses, slims them, and writes:
//   assets/models/<key>.glb   the model, simplified, with WebP textures and meshopt compression
//   assets/models/<key>.json  where it came from: title, author, licence, links, what we changed
//   data/models.js            those credits for the app (do not edit by hand)
//   docs/credits-models.md    the same, for people
// Author and licence are read from each source's own API or page, never typed in here, and a licence that
// forbids commercial use or changes (NC, ND) is refused. Things without an entry here keep the model drawn in
// code (js/models3d.js), which is our own.
//
// Sketchfab downloads need an API token (sketchfab.com > Settings > Password & API): set SKETCHFAB_TOKEN, or
// put it in ~/.config/full-spectrum/sketchfab-token. Without one, Sketchfab models are skipped.
//
// Run: node tools/fetch_models.mjs            fetch anything missing, then rebuild the credits
//      node tools/fetch_models.mjs whale bus  fetch these again
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, textureCompress, meshopt, resample } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'assets/models');

// One entry per thing in js/scale.js that has a ready-made model. `faces`: simplify to about this many
// triangles if it has more. `clip`: the animation to loop, by name (a regular expression).
const SOURCES = [
  { key: 'eiffel', polypizza: 'aIpJchqtRTg', faces: 40000 },
  { key: 'whale', polypizza: '7-TgeTuwbzw', faces: 0 },
  { key: 'bus', polypizza: '4CPpvEmrMoF', faces: 0 },
  { key: 'ant', polypizza: '2YvCk4p0xdH', faces: 0 },
  { key: 'person', polypizza: 'HMnuH5geEG', faces: 0, clip: /idle/i },
];

const token = process.env.SKETCHFAB_TOKEN
  || (existsSync(join(homedir(), '.config/full-spectrum/sketchfab-token')) ? (await readFile(join(homedir(), '.config/full-spectrum/sketchfab-token'), 'utf8')).trim() : '');

const json = async (url, headers = {}) => { const r = await fetch(url, { headers }); if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.json(); };
const bytes = async url => { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`); return new Uint8Array(await r.arrayBuffer()); };
const LICENCES = { by: ['CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/'], 'by-sa': ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'], cc0: ['CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/'] };

async function fromSketchfab(s) {
  const m = await json(`https://api.sketchfab.com/v3/models/${s.sketchfab}`);
  const slug = m.license?.slug ?? '';
  if (!LICENCES[slug]) throw new Error(`${s.key}: licence "${m.license?.label}" is not one we can use`);
  if (!token) return null;
  const d = await json(`https://api.sketchfab.com/v3/models/${s.sketchfab}/download`, { Authorization: `Token ${token}` });
  if (!d.glb?.url) throw new Error(`${s.key}: no glb download offered`);
  const [licence, licenceUrl] = LICENCES[slug];
  return { glb: await bytes(d.glb.url), meta: { title: m.name, author: m.user.displayName, authorUrl: m.user.profileUrl, source: m.viewerUrl, site: 'Sketchfab', licence, licenceUrl } };
}

async function fromPolyPizza(s) {
  const page = await (await fetch(`https://poly.pizza/m/${s.polypizza}`)).text();
  const title = /og:title" content="([^"]+)/.exec(page)?.[1] ?? '';
  const [, name, author] = /^(.*) - Free Model By (.*)$/.exec(title) ?? [];
  const lic = /CC[ -]?(BY 3\.0|0)/.exec(page)?.[1];
  const glbUrl = /static\.poly\.pizza\/[0-9a-f-]+\.glb/.exec(page)?.[0];
  if (!name || !lic || !glbUrl) throw new Error(`${s.key}: could not read title, licence or file from Poly Pizza`);
  const [licence, licenceUrl] = lic === '0' ? LICENCES.cc0 : ['CC BY 3.0', 'https://creativecommons.org/licenses/by/3.0/'];
  const authorUrl = /href="(\/u\/[^"]+)"/.exec(page)?.[1];
  return { glb: await bytes(`https://${glbUrl}`), meta: { title: name, author, authorUrl: authorUrl ? `https://poly.pizza${encodeURI(authorUrl)}` : null, source: `https://poly.pizza/m/${s.polypizza}`, site: 'Poly Pizza', licence, licenceUrl } };
}

async function slim(glb, s) {
  await MeshoptSimplifier.ready; await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  const doc = await io.readBinary(glb);
  const count = () => doc.getRoot().listMeshes().flatMap(m => m.listPrimitives()).reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);
  const before = Math.round(count());
  const steps = [dedup(), prune(), resample()];
  if (s.faces && before > s.faces) steps.push(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: s.faces / before, error: 0.001 }));
  steps.push(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024] }), prune(), meshopt({ encoder: MeshoptEncoder }));
  await doc.transform(...steps);
  const after = Math.round(count());
  const changes = [after < before ? `simplified from ${before.toLocaleString('en-GB')} to ${after.toLocaleString('en-GB')} triangles` : null, 'textures resized to at most 1024 px and saved as WebP', 'compressed'].filter(Boolean);
  return { glb: await io.writeBinary(doc), changes };
}

await mkdir(OUT, { recursive: true });
const wanted = process.argv.slice(2);
for (const s of SOURCES) {
  const file = join(OUT, `${s.key}.glb`);
  if (wanted.length ? !wanted.includes(s.key) : existsSync(file)) continue;
  try {
    const got = s.sketchfab ? await fromSketchfab(s) : await fromPolyPizza(s);
    if (!got) { console.log(`skip  ${s.key}: Sketchfab needs a token`); continue; }
    const { glb, changes } = await slim(got.glb, s);
    await writeFile(file, glb);
    const meta = { key: s.key, ...got.meta, changes: changes.join('; '), clip: s.clip?.source ?? null, fetched: new Date().toISOString().slice(0, 10) };
    await writeFile(join(OUT, `${s.key}.json`), JSON.stringify(meta, null, 2) + '\n');
    console.log(`ok    ${s.key}: ${got.meta.title} by ${got.meta.author}, ${got.meta.licence} (${(glb.length / 1e6).toFixed(2)} MB; ${changes[0]})`);
  } catch (err) { console.log(`FAIL  ${s.key}: ${err.message}`); process.exitCode = 1; }
}

// The credits, rebuilt from every model on disk.
const metas = [];
for (const f of (await readdir(OUT)).filter(f => f.endsWith('.json')).sort()) metas.push(JSON.parse(await readFile(join(OUT, f), 'utf8')));
const entries = metas.map(m => `  ${m.key}: ${JSON.stringify({ file: `assets/models/${m.key}.glb`, title: m.title, author: m.author, authorUrl: m.authorUrl, source: m.source, site: m.site, licence: m.licence, licenceUrl: m.licenceUrl, clip: m.clip })},`);
await writeFile(join(ROOT, 'data/models.js'), `// Generated by tools/fetch_models.mjs from assets/models/*.json; do not edit by hand.
// Ready-made 3D models for the wave view, with their credits. Full notes: docs/credits-models.md.
export const MODELS = {
${entries.join('\n')}
};
`);
const rows = metas.map(m => `- **${m.key}**: [${m.title}](${m.source}) by ${m.authorUrl ? `[${m.author}](${m.authorUrl})` : m.author}, from ${m.site}. Licence: [${m.licence}](${m.licenceUrl}). Changes: ${m.changes}. Fetched ${m.fetched}.`);
await writeFile(join(ROOT, 'docs/credits-models.md'), `# Credits: 3D models

Generated by \`tools/fetch_models.mjs\`, which reads each model's title, author and licence from its source
(the Sketchfab API, or the Poly Pizza page) and refuses licences that forbid commercial use or changes. The
files are in \`assets/models/\`. The app names the model, its author and licence under the picture whenever
one is shown.

The other things in the wave view (the planets and Moon, Everest, the Burj Khalifa, the football pitch, the
phone, the coin, the grain of sand, the hair, the red blood cell and the water molecule) are modelled in code in
\`js/models3d.js\`; the planets' and Moon's maps and Everest's heights are real (\`docs/credits-textures.md\`). They are this project's own, as are the bacterium and the giant virus, built from beads in
\`js/micro.js\`. Haemoglobin, DNA, the ribosome and the flu virus's spikes are real structures from the Protein Data
Bank: see \`docs/credits-molecules.md\`. The proton, the uranium nucleus and the shimmering electron clouds of
hydrogen and water are drawn as Molecule Viewer (https://moleculeviewer.org, the same author's, MIT) draws them,
in \`js/nucleon.js\`.

${rows.join('\n')}
`);
console.log(`credits: ${metas.length} models`);
