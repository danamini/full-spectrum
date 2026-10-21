// Builds bead models of real molecules from the Protein Data Bank for the wave view, and writes:
//   assets/molecules/<key>.bin   Float32 beads: x, y, z, radius (ångströms, centred), palette index
//   assets/molecules/<key>.json  the structure's title, citation, palette, bead count and size
//   data/molecules.js            the credits for the app (do not edit by hand)
//   docs/credits-molecules.md    the same, for people
// PDB data is CC0. Titles and citations are read from the RCSB PDB's API, never typed in here.
//
// Each structure is drawn as atoms (every heavy atom, at its van der Waals radius) or as residues (one bead per
// amino acid or nucleotide, slightly enlarged so the surface closes), coloured by what each part is.
//
// Run: node tools/build_molecules.mjs [key ...]
import { writeFile, mkdir, readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'assets/molecules');

const VDW = { C: 1.7, N: 1.55, O: 1.52, S: 1.8, P: 1.8, FE: 1.9 };
const GLYCANS = new Set(['NAG', 'MAN', 'BMA', 'FUC', 'GAL', 'NDG', 'SIA', 'FUL']);
const BACKBONE = new Set(['P', 'OP1', 'OP2', 'O5\'', 'C5\'', 'C4\'', 'O4\'', 'C3\'', 'O3\'', 'C2\'', 'C1\'']);

// key: the thing in js/scale.js (or a part of one). `colour(atom, info)` returns a palette index.
const SOURCES = {
  haemoglobin: {
    entry: '2HHB', mode: 'atoms', what: 'Human deoxyhaemoglobin: two alpha and two beta chains, each holding a haem',
    palette: ['#e86f5c', '#f2a37e', '#5c0a14', '#ff9a3c'],
    colour: (a, info) => (a.comp === 'HEM' ? (a.el === 'FE' ? 3 : 2) : /alpha/i.test(info.entity(a.asym)) ? 0 : 1),
  },
  dna: {
    entry: '1BNA', mode: 'atoms', what: 'The Dickerson dodecamer: twelve base pairs of B-DNA, the first DNA structure solved to atomic detail',
    palette: ['#5aa6e6', '#c07ae0', '#ff6b6b', '#ffd166', '#06d6a0', '#4cc9f0'],
    colour: (a, info) => (BACKBONE.has(a.atom) ? info.strand(a.asym) : 2 + ['DA', 'DT', 'DG', 'DC'].indexOf(a.comp)),
  },
  ha: {
    entry: '3HMG', mode: 'residues', what: 'Influenza haemagglutinin (H3), the spike that binds a cell and fuses with it',
    palette: ['#f0a0b4', '#c9567a', '#c8e6a0'],
    colour: (a, info) => (GLYCANS.has(a.comp) ? 2 : info.entityId(a.asym) === '1' ? 0 : 1), // entity 1 is HA1, the head
  },
  na: {
    entry: '2HTY', mode: 'residues', what: 'Influenza neuraminidase (N1, from H5N1), the enzyme that cuts new viruses free',
    palette: ['#7fd1b9', '#c8e6a0'],
    colour: a => (GLYCANS.has(a.comp) ? 1 : 0),
  },
  ribosome: {
    entry: '7K00', mode: 'residues', what: 'The E. coli ribosome, its two subunits of RNA and protein, which reads mRNA to build proteins',
    palette: ['#f2c14e', '#f28c28', '#6b8fd6', '#8a6bd6', '#ff6b6b', '#7cc4ff'],
    colour: (a, info) => {
      const d = info.entity(a.asym);
      if (/16S/i.test(d)) return 0;
      if (/23S|5S/i.test(d)) return 1;
      if (/30S/i.test(d)) return 2;
      if (/50S/i.test(d)) return 3;
      if (/tRNA/i.test(d)) return 4;
      return 5;
    },
  },
};

// ---------------------------------------------------------------- mmCIF
const tokens = line => line.match(/'[^']*'|"[^"]*"|\S+/g)?.map(t => t.replace(/^['"]|['"]$/g, '')) ?? [];
// The rows of one loop_ (or a single key-value block) in an mmCIF file, as objects.
function loop(text, category) {
  const lines = text.split('\n'), rows = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== 'loop_' || !lines[i + 1]?.startsWith(`_${category}.`)) continue;
    const cols = [];
    let j = i + 1;
    for (; lines[j]?.startsWith(`_${category}.`); j++) cols.push(lines[j].trim().slice(category.length + 2));
    let buf = [];
    for (; j < lines.length && !lines[j].startsWith('#') && lines[j].trim() !== 'loop_'; j++) {
      if (lines[j].startsWith(';')) { buf.push(lines[j].slice(1)); while (!lines[++j].startsWith(';')) buf[buf.length - 1] += ` ${lines[j]}`; continue; }
      buf.push(...tokens(lines[j]));
      while (buf.length >= cols.length) { rows.push(Object.fromEntries(cols.map((c, k) => [c, buf[k]]))); buf = buf.slice(cols.length); }
    }
    return rows;
  }
  // a category with one row is written as key-value pairs
  const one = {};
  for (const l of lines) if (l.startsWith(`_${category}.`)) { const [k, ...v] = tokens(l); one[k.slice(category.length + 2)] = v.join(' '); }
  return Object.keys(one).length ? [one] : [];
}

async function get(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r;
}

async function build(key, s) {
  const gz = new Uint8Array(await (await get(`https://files.rcsb.org/download/${s.entry}-assembly1.cif.gz`)).arrayBuffer());
  const cif = gunzipSync(gz).toString('utf8');
  const entities = Object.fromEntries(loop(cif, 'entity').map(e => [e.id, e.pdbx_description ?? '']));
  const asymEntity = Object.fromEntries(loop(cif, 'struct_asym').map(a => [a.id, a.entity_id]));
  const strands = [...new Set(loop(cif, 'entity_poly').map(p => p.entity_id))];
  const info = {
    entity: asym => entities[asymEntity[asym.replace(/-\d+$/, '')]] ?? '',
    entityId: asym => asymEntity[asym.replace(/-\d+$/, '')],
    strand: asym => [...new Set(atoms.filter(a => BACKBONE.has(a.atom)).map(a => a.asym))].indexOf(asym) % 2,
  };
  const model = loop(cif, 'atom_site')[0]?.pdbx_PDB_model_num;
  const atoms = loop(cif, 'atom_site')
    .filter(r => r.pdbx_PDB_model_num === model && r.label_comp_id !== 'HOH' && r.type_symbol !== 'H')
    .map(r => ({ el: r.type_symbol.toUpperCase(), atom: r.label_atom_id, comp: r.label_comp_id, asym: r.label_asym_id, seq: r.label_seq_id, x: +r.Cartn_x, y: +r.Cartn_y, z: +r.Cartn_z }));
  let beads;
  if (s.mode === 'atoms') beads = atoms.filter(a => s.colour(a, info) >= 0).map(a => [a.x, a.y, a.z, VDW[a.el] ?? 1.7, s.colour(a, info)]);
  else {
    // one bead per residue, at the residue's centre; glycans and other small groups by their C1 or first atom
    const groups = new Map();
    for (const a of atoms) { const id = `${a.asym}/${a.seq}/${a.comp}`; if (!groups.has(id)) groups.set(id, []); groups.get(id).push(a); }
    beads = [...groups.values()].map(g => {
      const n = g.length, c = g.reduce((p, a) => [p[0] + a.x / n, p[1] + a.y / n, p[2] + a.z / n], [0, 0, 0]);
      const nucleic = g.some(a => a.atom === 'P' || a.atom === 'C4\'');
      return [...c, nucleic ? 4.4 : GLYCANS.has(g[0].comp) ? 3.4 : 3.6, s.colour(g[0], info)];
    });
  }
  // centre on the middle of the box
  const min = [0, 1, 2].map(k => Math.min(...beads.map(b => b[k] - b[3]))), max = [0, 1, 2].map(k => Math.max(...beads.map(b => b[k] + b[3])));
  const mid = min.map((m, k) => (m + max[k]) / 2);
  const flat = new Float32Array(beads.length * 5);
  beads.forEach((b, i) => flat.set([b[0] - mid[0], b[1] - mid[1], b[2] - mid[2], b[3], b[4]], i * 5));
  await writeFile(join(OUT, `${key}.bin`), Buffer.from(flat.buffer));
  const entry = await (await get(`https://data.rcsb.org/rest/v1/core/entry/${s.entry}`)).json();
  const c = entry.rcsb_primary_citation ?? {};
  const authors = c.rcsb_authors ?? [];
  const meta = {
    key, entry: s.entry, what: s.what, title: entry.struct?.title, mode: s.mode, beads: beads.length, palette: s.palette,
    size: max.map((m, k) => +(m - min[k]).toFixed(1)),
    citation: { authors: authors.length > 3 ? `${authors[0]} et al.` : authors.join(', '), year: c.year, title: c.title, journal: c.journal_abbrev, doi: c.pdbx_database_id_DOI ?? null },
    source: `https://www.rcsb.org/structure/${s.entry}`, licence: 'CC0 1.0', licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    fetched: new Date().toISOString().slice(0, 10),
  };
  await writeFile(join(OUT, `${key}.json`), JSON.stringify(meta, null, 2) + '\n');
  console.log(`ok    ${key}: ${s.entry} ${beads.length} beads, ${meta.size.join(' x ')} Å (${meta.citation.authors}, ${meta.citation.year})`);
}

await mkdir(OUT, { recursive: true });
const wanted = process.argv.slice(2);
for (const [key, s] of Object.entries(SOURCES)) {
  if (wanted.length ? !wanted.includes(key) : existsSync(join(OUT, `${key}.bin`))) continue;
  try { await build(key, s); } catch (err) { console.log(`FAIL  ${key}: ${err.message}`); process.exitCode = 1; }
}

const metas = [];
for (const f of (await readdir(OUT)).filter(f => f.endsWith('.json')).sort()) metas.push(JSON.parse(await readFile(join(OUT, f), 'utf8')));
await writeFile(join(ROOT, 'data/molecules.js'), `// Generated by tools/build_molecules.mjs from assets/molecules/*.json; do not edit by hand.
// Real structures from the Protein Data Bank, as beads, with their credits. Full notes: docs/credits-molecules.md.
export const MOLECULES = {
${metas.map(m => `  ${m.key}: ${JSON.stringify({ file: `assets/molecules/${m.key}.bin`, entry: m.entry, what: m.what, palette: m.palette, size: m.size, cite: `${m.citation.authors} (${m.citation.year})`, source: m.source, licence: m.licence, licenceUrl: m.licenceUrl })},`).join('\n')}
};
`);
const cite = c => `${c.authors} (${c.year}). ${c.title} *${c.journal}*.${c.doi ? ` doi:${c.doi}` : ''}`;
await writeFile(join(ROOT, 'docs/credits-molecules.md'), `# Credits: molecules from the Protein Data Bank

Built by \`tools/build_molecules.mjs\` from each entry's first biological assembly, downloaded from the RCSB
Protein Data Bank (https://www.rcsb.org; Berman et al. (2000) *Nucleic Acids Res.* 28:235). PDB data is
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/); we cite each structure's paper as the PDB asks.
Each is drawn as beads: every heavy atom at its van der Waals radius, or one bead per amino acid or nucleotide.
The flu virus places copies of the two spike proteins on a membrane modelled in code; its other parts, and the
giant virus and the bacterium, are modelled in code in \`js/micro.js\`.

${metas.map(m => `- **${m.key}**: [PDB ${m.entry}](${m.source}), ${m.title}. ${m.what}. ${m.beads.toLocaleString('en-GB')} beads (${m.mode}). Paper: ${cite(m.citation)}. Fetched ${m.fetched}.`).join('\n')}
`);
console.log(`credits: ${metas.length} structures`);
