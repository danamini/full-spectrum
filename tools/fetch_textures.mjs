// Fetches real maps for the wave view's planets and Everest, and writes:
//   assets/textures/<name>.webp     planet maps from Solar System Scope (CC BY 4.0, from NASA data), resized
//   assets/textures/everest.bin     the ground round Everest: Int16 heights in metres, a square grid
//   assets/textures/everest.json    its size, and where it is
//   data/textures.js                credits and sizes for the app (do not edit by hand)
//   docs/credits-textures.md        the same, for people
// The Everest heights are the Terrain Tiles on AWS Open Data (Mapzen's terrarium encoding), from SRTM and
// GMTED2010 (USGS) and ETOPO1 (NOAA), credited as Mapzen asks.
//
// Run: node tools/fetch_textures.mjs [name ...]
import { writeFile, mkdir, readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'assets/textures');
const SSS = 'https://www.solarsystemscope.com/textures/download/';
const SSS_CREDIT = { author: 'Solar System Scope (INOVE), based on NASA elevation and imagery data', source: 'https://www.solarsystemscope.com/textures/', licence: 'CC BY 4.0', licenceUrl: 'https://creativecommons.org/licenses/by/4.0/' };

// name: [file at Solar System Scope, width to keep, how to treat it]
const MAPS = {
  'earth-day': ['2k_earth_daymap.jpg', 2048],
  'earth-clouds': ['2k_earth_clouds.jpg', 2048, 'grey'],
  'earth-normal': ['2k_earth_normal_map.tif', 1024],
  'earth-roughness': ['2k_earth_specular_map.tif', 1024, 'invert'], // shiny seas, matt land
  'earth-night': ['2k_earth_nightmap.jpg', 2048],
  moon: ['2k_moon.jpg', 2048],
  jupiter: ['2k_jupiter.jpg', 2048],
  neptune: ['2k_neptune.jpg', 1024],
};

const bytes = async url => { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`); return Buffer.from(await r.arrayBuffer()); };

async function planetMap(name, [file, width, treat]) {
  let img = sharp(await bytes(SSS + file)).resize({ width });
  if (treat === 'grey') img = img.greyscale();
  if (treat === 'invert') img = img.greyscale().linear(-0.41, 254.6); // inverted and kept from 0.59 to 1 in one step (sharp runs negate after linear): a soft sheen on the sea, not a hot spot
  await img.webp({ quality: 86 }).toFile(join(OUT, `${name}.webp`));
  return { name, kind: 'map', title: file, ...SSS_CREDIT, changes: `resized to ${width} px wide${treat === 'invert' ? ', inverted into a roughness map (from 0.59 to 1)' : treat === 'grey' ? ', made grey' : ''}, saved as WebP` };
}

// ---------------------------------------------------------------- Everest
const SUMMIT = { lat: 27.98806, lon: 86.92528 }; // the summit (WGS84)
const Z = 13, SPAN_M = 16000, GRID = 321;           // a 16 km square, sampled 321 x 321 (about 19 m a sample at zoom 13)
const tileXY = (lat, lon, z) => {
  const n = 2 ** z, x = ((lon + 180) / 360) * n, r = (lat * Math.PI) / 180;
  return [x, ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n];
};
async function everest() {
  const [cx, cy] = tileXY(SUMMIT.lat, SUMMIT.lon, Z);
  const mPerPx = (40075016.686 * Math.cos((SUMMIT.lat * Math.PI) / 180)) / (256 * 2 ** Z);
  const halfPx = SPAN_M / 2 / mPerPx;
  const x0 = Math.floor(cx * 256 - halfPx), y0 = Math.floor(cy * 256 - halfPx), size = Math.ceil(halfPx * 2);
  const tiles = new Map();
  const heightAt = async (px, py) => {
    const tx = Math.floor(px / 256), ty = Math.floor(py / 256), k = `${tx}/${ty}`;
    if (!tiles.has(k)) {
      const png = await bytes(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${tx}/${ty}.png`);
      tiles.set(k, await sharp(png).removeAlpha().raw().toBuffer());
    }
    const t = tiles.get(k), i = ((py - ty * 256) * 256 + (px - tx * 256)) * 3;
    return t[i] * 256 + t[i + 1] + t[i + 2] / 256 - 32768;
  };
  const h = new Int16Array(GRID * GRID);
  let max = -1e9, min = 1e9;
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
    // bilinear between the four nearest samples
    const fx = x0 + (i / (GRID - 1)) * size, fy = y0 + (j / (GRID - 1)) * size, ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy;
    const [a, b, c, d] = await Promise.all([heightAt(ix, iy), heightAt(ix + 1, iy), heightAt(ix, iy + 1), heightAt(ix + 1, iy + 1)]);
    const z = a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
    h[j * GRID + i] = Math.round(z); max = Math.max(max, z); min = Math.min(min, z);
  }
  await writeFile(join(OUT, 'everest.bin'), Buffer.from(h.buffer));
  const meta = { name: 'everest', kind: 'terrain', grid: GRID, spanMetres: SPAN_M, min: Math.round(min), max: Math.round(max), summit: SUMMIT, zoom: Z,
    title: `Terrain Tiles (terrarium), zoom ${Z}`, author: 'Mapzen; SRTM and GMTED2010 courtesy of the U.S. Geological Survey; ETOPO1 courtesy of U.S. NOAA',
    source: 'https://registry.opendata.aws/terrain-tiles/', licence: 'public domain data (SRTM, GMTED2010, ETOPO1), credited as Mapzen asks', licenceUrl: 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
    changes: `a ${SPAN_M / 1000} km square round the summit, resampled to ${GRID} x ${GRID} heights in metres` };
  await writeFile(join(OUT, 'everest.json'), JSON.stringify(meta, null, 2) + '\n');
  return meta;
}

await mkdir(OUT, { recursive: true });
const wanted = process.argv.slice(2);
const want = n => (wanted.length ? wanted.includes(n) : !existsSync(join(OUT, `${n}.json`)));
for (const [name, spec] of Object.entries(MAPS)) {
  if (!want(name)) continue;
  try { const meta = await planetMap(name, spec); await writeFile(join(OUT, `${name}.json`), JSON.stringify({ ...meta, fetched: new Date().toISOString().slice(0, 10) }, null, 2) + '\n'); console.log(`ok    ${name}`); }
  catch (err) { console.log(`FAIL  ${name}: ${err.message}`); process.exitCode = 1; }
}
if (want('everest')) {
  try { const m = await everest(); await writeFile(join(OUT, 'everest.json'), JSON.stringify({ ...m, fetched: new Date().toISOString().slice(0, 10) }, null, 2) + '\n'); console.log(`ok    everest: ${m.min} to ${m.max} m`); }
  catch (err) { console.log(`FAIL  everest: ${err.message}`); process.exitCode = 1; }
}

const metas = [];
for (const f of (await readdir(OUT)).filter(f => f.endsWith('.json')).sort()) metas.push(JSON.parse(await readFile(join(OUT, f), 'utf8')));
await writeFile(join(ROOT, 'data/textures.js'), `// Generated by tools/fetch_textures.mjs from assets/textures/*.json; do not edit by hand.
// Real maps for the wave view's planets and Everest, with their credits. Full notes: docs/credits-textures.md.
export const TEXTURES = {
${metas.map(m => `  ${JSON.stringify(m.name)}: ${JSON.stringify(m.kind === 'terrain'
    ? { file: 'assets/textures/everest.bin', grid: m.grid, spanMetres: m.spanMetres, min: m.min, max: m.max, author: m.author, source: m.source, licence: m.licence, licenceUrl: m.licenceUrl }
    : { file: `assets/textures/${m.name}.webp`, author: m.author, source: m.source, licence: m.licence, licenceUrl: m.licenceUrl })},`).join('\n')}
};
`);
await writeFile(join(ROOT, 'docs/credits-textures.md'), `# Credits: planet maps and Everest's terrain

Fetched by \`tools/fetch_textures.mjs\` into \`assets/textures/\`. The planet maps are Solar System Scope's
(https://www.solarsystemscope.com/textures/), under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/),
made from NASA elevation and imagery data. Everest's heights are the Terrain Tiles on AWS Open Data; the
colouring of snow, ice and rock on them is ours, from height and steepness.

${metas.map(m => `- **${m.name}**: ${m.title}, by ${m.author}. Source: ${m.source}. Licence: ${m.licence}. Changes: ${m.changes}. Fetched ${m.fetched}.`).join('\n')}
`);
console.log(`credits: ${metas.length}`);
