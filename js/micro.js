// The small things in the wave view as bead models, the way molecular illustrators draw them (js/beads.js).
// Real structures from the Protein Data Bank (assets/molecules/, tools/build_molecules.mjs) for haemoglobin,
// DNA and the ribosome; a flu virus built from real copies of its two spike proteins on a modelled membrane;
// and a giant virus and a bacterium modelled in code. The three whole things are cut open towards you.
// Each returns { obj, update(t) } with its measured size one unit, like js/models3d.js; the beads arrive
// once their data has loaded.
import * as THREE from 'three';
import { Beads, loadStructure } from './beads.js';
import { MOLECULES } from '../data/molecules.js';

const TAU = Math.PI * 2;
const col = hex => new THREE.Color(hex);
function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296); }
// n points spread evenly over a sphere of radius r (a Fibonacci lattice)
function* sphere(n, r) {
  for (let i = 0; i < n; i++) { const y = 1 - (2 * (i + 0.5)) / n, s = Math.sqrt(1 - y * y), a = i * 2.399963; yield new THREE.Vector3(Math.cos(a) * s * r, y * r, Math.sin(a) * s * r); }
}

// ---------------------------------------------------------------- structures from the PDB
// Beads as [x, y, z, r, palette index] rows, from a .bin.
const rows = flat => Array.from({ length: flat.length / 5 }, (_, i) => Array.from(flat.subarray(i * 5, i * 5 + 5)));
// The direction the beads are most spread along (power iteration on their covariance).
function longAxis(rs, which = 0) {
  const c = [0, 1, 2].map(k => rs.reduce((s, b) => s + b[k], 0) / rs.length);
  const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const b of rs) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[i][j] += (b[i] - c[i]) * (b[j] - c[j]);
  const found = [];
  for (let k = 0; k <= which; k++) {
    let v = new THREE.Vector3(1, 0.3, 0.2).normalize();
    for (let it = 0; it < 60; it++) {
      const w = new THREE.Vector3(m[0][0] * v.x + m[0][1] * v.y + m[0][2] * v.z, m[1][0] * v.x + m[1][1] * v.y + m[1][2] * v.z, m[2][0] * v.x + m[2][1] * v.y + m[2][2] * v.z);
      for (const f of found) w.addScaledVector(f, -w.dot(f));
      v = w.normalize();
    }
    found.push(v);
  }
  return found[which];
}
// Group beads into cells `size` across, one bead per cell at the mean place, in the commonest colour there.
function coarse(rs, size) {
  const cells = new Map();
  for (const b of rs) { const k = b.slice(0, 3).map(v => Math.floor(v / size)).join(); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(b); }
  return [...cells.values()].map(g => {
    const n = g.length, counts = {};
    for (const b of g) counts[b[4]] = (counts[b[4]] ?? 0) + 1;
    return [g.reduce((s, b) => s + b[0], 0) / n, g.reduce((s, b) => s + b[1], 0) / n, g.reduce((s, b) => s + b[2], 0) / n, size * 0.62, +Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]];
  });
}

// A real structure, turned so `axis` (its longest, unless given) lies across the screen, and scaled so
// `across` ångströms is one unit.
function structure(key, { across, axisFrom = rs => longAxis(rs), spin = 0.2, tilt = 0.25 }) {
  const info = MOLECULES[key], holder = new THREE.Group(), turn = new THREE.Group();
  holder.rotation.x = tilt; holder.add(turn);
  loadStructure(info.file).then(flat => {
    const rs = rows(flat), q = new THREE.Quaternion().setFromUnitVectors(axisFrom(rs), new THREE.Vector3(1, 0, 0));
    const palette = info.palette.map(col), b = new Beads(), v = new THREE.Vector3(), k = 1 / (across ?? Math.max(...info.size));
    for (const r of rs) { v.set(r[0], r[1], r[2]).applyQuaternion(q).multiplyScalar(k); b.add(v.x, v.y, v.z, r[3] * k, palette[r[4]]); }
    turn.add(b.points());
  });
  return { obj: holder, update: t => { turn.rotation.y = t * spin; } };
}

export const haemoglobin = () => structure('haemoglobin', {});
// DNA lies across with its 20 Å width as one unit, turning about its own axis. The structure is twelve base
// pairs; two copies end to end, the second turned by B-DNA's 34.3° a base pair, show the helix and its grooves.
export function dna() {
  const info = MOLECULES.dna, holder = new THREE.Group(), spin = new THREE.Group();
  holder.add(spin);
  loadStructure(info.file).then(flat => {
    const rs = rows(flat), x = new THREE.Vector3(1, 0, 0), q = new THREE.Quaternion().setFromUnitVectors(longAxis(rs), x);
    const pts = rs.map(r => ({ p: new THREE.Vector3(r[0], r[1], r[2]).applyQuaternion(q), r: r[3], c: r[4] }));
    const lo = Math.min(...pts.map(p => p.p.x)), hi = Math.max(...pts.map(p => p.p.x));
    const rise = 12 * 3.38, twist = new THREE.Quaternion().setFromAxisAngle(x, 12 * 34.3 * Math.PI / 180), palette = info.palette.map(col), b = new Beads(), k = 1 / 20;
    for (const copy of [0, 1]) for (const p of pts) {
      const v = p.p.clone();
      if (copy) v.applyQuaternion(twist).x += rise;
      v.x -= (lo + hi + rise) / 2;
      b.add(v.x * k, v.y * k, v.z * k, p.r * k, palette[p.c]);
    }
    spin.add(b.points());
  });
  return { obj: holder, update: t => { spin.rotation.x = t * 0.5; holder.rotation.y = Math.sin(t * 0.3) * 0.25; } };
}
export const ribosome = () => structure('ribosome', {});

// ---------------------------------------------------------------- the flu virus
// About 100 nm across: a membrane from the infected cell, studded with about 300 haemagglutinin and 50
// neuraminidase spikes (real structures, coarsened), a layer of matrix protein M1 inside it, and the genome in
// eight rod-shaped segments, seven round one. A wedge is cut away towards you to show them.
const cut = v => v.x > 0 && v.z > 0 && v.y > -18;   // the open wedge, in nm, before the turn that faces it to you
export function flu() {
  const holder = new THREE.Group(), turn = new THREE.Group();
  holder.add(turn); turn.scale.setScalar(1 / 100); turn.rotation.y = -Math.PI / 4;
  Promise.all([loadStructure(MOLECULES.ha.file), loadStructure(MOLECULES.na.file)]).then(([haFlat, naFlat]) => {
    const r = rng(42), R = 50, up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), q = new THREE.Quaternion();
    // Spike templates in nm, base at the origin, pointing up.
    const template = (flat, palette, head) => {
      const rs = coarse(rows(flat).map(b => [b[0] / 10, b[1] / 10, b[2] / 10, b[3] / 10, b[4]]), 1.15);
      const axis = head(rs), toUp = new THREE.Quaternion().setFromUnitVectors(axis, up);
      const pts = rs.map(b => ({ p: new THREE.Vector3(b[0], b[1], b[2]).applyQuaternion(toUp), r: b[3], c: palette[b[4]] }));
      const base = Math.min(...pts.map(p => p.p.y - p.r));
      pts.forEach(p => { p.p.y -= base; });
      return pts;
    };
    const centroid = (rs, k) => { const g = rs.filter(b => b[4] === k); return new THREE.Vector3(...[0, 1, 2].map(i => g.reduce((s, b) => s + b[i], 0) / g.length)); };
    const ha = template(haFlat, MOLECULES.ha.palette.map(col), rs => centroid(rs, 0).sub(centroid(rs, 1)).normalize()); // stalk (HA2) to head (HA1)
    const naHead = template(naFlat, MOLECULES.na.palette.map(col), rs => longAxis(rs, 2));                             // the four-fold axis
    // neuraminidase stands on a thin stalk, missing from the crystal structure
    const naStalk = Array.from({ length: 7 }, (_, i) => ({ p: new THREE.Vector3(0, i * 1.1 + 0.6, 0), r: 0.9, c: col('#5fb39a') }));
    const na = [...naStalk, ...naHead.map(p => ({ ...p, p: p.p.clone().add(new THREE.Vector3(0, 7.5, 0)) }))];

    const membrane = new Beads(), matrix = new Beads(), spikes = new Beads(), genome = new Beads();
    const lipid = [col('#e9dcb8'), col('#dccb9c'), col('#f1e6c8')];
    for (const p of sphere(5200, R)) if (!cut(p)) membrane.add(p.x, p.y, p.z, 1.25, lipid[Math.floor(r() * 3)]);
    for (const p of sphere(4200, R - 3.6)) if (!cut(p)) membrane.add(p.x, p.y, p.z, 1.25, lipid[Math.floor(r() * 3)]);
    for (const p of sphere(3300, R - 7.5)) if (!cut(p)) matrix.add(p.x, p.y, p.z, 1.75, col(r() < 0.5 ? '#9db8de' : '#8fa9d3'));
    // spikes: one in about six is neuraminidase
    for (const p of sphere(350, R + 0.5)) {
      if (cut(p)) continue;
      const n = p.clone().normalize(), t = r() < 0.16 ? na : ha;
      q.setFromUnitVectors(up, n).multiply(new THREE.Quaternion().setFromAxisAngle(up, r() * TAU));
      for (const s of t) { v.copy(s.p).applyQuaternion(q).add(p); spikes.add(v.x, v.y, v.z, s.r, s.c); }
    }
    // the genome: eight segments, each a looped double helix of nucleoprotein with the polymerase at one end
    const np = [col('#4f7fd8'), col('#5b8be6')], pol = col('#ff7a59');
    const rods = [[0, 0, 92], ...[0, 1, 2, 3, 4, 5, 6].map(k => [Math.cos(k * TAU / 7) * 13.5, Math.sin(k * TAU / 7) * 13.5, [88, 80, 76, 70, 62, 52, 44][k]])];
    for (const [x, z, L] of rods) {
      for (let s = 0; s < L; s += 1.6) for (const strand of [0, Math.PI]) {
        const a = s * 0.55 + strand;
        genome.add(x + Math.cos(a) * 4, s - L / 2, z + Math.sin(a) * 4, 2.1, np[strand ? 1 : 0]);
      }
      for (const dx of [-2, 2]) genome.add(x + dx, L / 2 + 2.5, z, 3, pol);
    }
    turn.add(membrane.points(), matrix.points(), spikes.points(), genome.points());
  });
  return { obj: holder, update: t => { turn.rotation.y = -Math.PI / 4 + Math.sin(t * 0.25) * 0.35; holder.rotation.x = 0.2 + Math.sin(t * 0.2) * 0.08; } };
}

// ---------------------------------------------------------------- the giant virus
// Mimivirus, about 0.5 µm with its fibres: an icosahedral shell of capsid proteins about 0.4 µm across, a dense
// coat of fibres tipped with sugars, the 'stargate' at one corner where the genome leaves, and inside, a
// membrane round a core packed with DNA. In units of the whole: the shell's corners at 0.38.
export function mimivirus() {
  const holder = new THREE.Group(), turn = new THREE.Group();
  holder.add(turn); turn.rotation.y = -Math.PI / 4;
  const r = rng(7), shell = new Beads(), fibres = new Beads(), inside = new Beads();
  const ico = new THREE.IcosahedronGeometry(0.38, 0), p = ico.attributes.position, open = v => v.x > 0 && v.z > 0;
  // Capsid: points on each face of the icosahedron in a triangular grid.
  const N = 26, capsid = [col('#c9a46a'), col('#bf9a5e'), col('#d4b07a')];
  let starVertex = new THREE.Vector3(), best = -1;
  for (let i = 0; i < p.count; i++) { const w = new THREE.Vector3().fromBufferAttribute(p, i); if (w.y > best) { best = w.y; starVertex = w; } }
  for (let f = 0; f < p.count; f += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p, f), b = new THREE.Vector3().fromBufferAttribute(p, f + 1), c = new THREE.Vector3().fromBufferAttribute(p, f + 2);
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N - i; j++) {
      const w = a.clone().multiplyScalar((N - i - j) / N).addScaledVector(b, i / N).addScaledVector(c, j / N);
      if (open(w)) continue;
      const nearStar = w.distanceTo(starVertex);
      const arm = nearStar < 0.14 && Math.abs(Math.sin(Math.atan2(w.z - starVertex.z, w.x - starVertex.x) * 2.5)) < 0.18;
      shell.add(w.x, w.y, w.z, 0.0085, arm ? col('#ffd27a') : capsid[Math.floor(r() * 3)]);
    }
  }
  // Fibres: about 2,000, each a few beads straight out from the shell, with a knob of sugar at the tip.
  const toShell = d => { // where a ray from the centre meets the shell
    let lo = 0, hi = 0.5;
    for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; (insideIco(d.clone().multiplyScalar(m)) ? (lo = m) : (hi = m)); }
    return lo;
  };
  const planes = [];
  for (let f = 0; f < p.count; f += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p, f), b = new THREE.Vector3().fromBufferAttribute(p, f + 1), c = new THREE.Vector3().fromBufferAttribute(p, f + 2);
    const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    planes.push([n, n.dot(a)]);
  }
  const insideIco = w => planes.every(([n, d]) => n.dot(w) <= Math.abs(d) + 1e-6);
  const fibre = [col('#d9e8a6'), col('#cfe39a')], knob = col('#f4f1c8');
  for (const d of sphere(2200, 1)) {
    const base = toShell(d), w = d.clone().multiplyScalar(base);
    if (open(w) || w.distanceTo(starVertex) < 0.12) continue;
    const bend = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.012);
    for (let k = 1; k <= 6; k++) { const x = d.clone().multiplyScalar(base + k * 0.016).addScaledVector(bend, k * k * 0.12); fibres.add(x.x, x.y, x.z, 0.0055, fibre[k % 2]); }
    const tip = d.clone().multiplyScalar(base + 0.112).addScaledVector(bend, 4.5);
    fibres.add(tip.x, tip.y, tip.z, 0.011, knob);
  }
  // Inside, seen through the cut: an inner membrane, then the core with its DNA, a long chain packed tight.
  for (const w of sphere(5200, 0.31)) if (!open(w)) inside.add(w.x, w.y, w.z, 0.0075, col('#e6d3a8'));
  let x = new THREE.Vector3(), dir = new THREE.Vector3(1, 0, 0);
  const dnaCol = [col('#ffcf5c'), col('#f2b84a')];
  for (let k = 0; k < 3600; k++) {
    dir.add(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.9)).normalize();
    x.addScaledVector(dir, 0.012);
    if (x.length() > 0.27) { x.multiplyScalar(0.27 / x.length()); dir.reflect(x.clone().normalize()); }
    inside.add(x.x, x.y, x.z, 0.0105, dnaCol[k % 2]);
  }
  turn.add(shell.points(), fibres.points(), inside.points());
  return { obj: holder, update: t => { turn.rotation.y = -Math.PI / 4 + Math.sin(t * 0.22) * 0.35; holder.rotation.x = 0.35 + Math.sin(t * 0.17) * 0.08; } };
}

// ---------------------------------------------------------------- the bacterium
// E. coli, about 2 µm long: an outer membrane, a thin cell wall and the inner membrane, cut open to show the
// cytoplasm crowded with ribosomes and proteins round the tangled DNA of the nucleoid, with a bundle of
// flagella turning at the back and short pili all over. In units of its length.
export function bacterium() {
  const holder = new THREE.Group(), body = new THREE.Group(), flag = new THREE.Group();
  holder.add(body, flag); holder.rotation.x = 0.25;
  const r = rng(11), R = 0.2, H = 0.3; // radius, and half the length of the straight part
  const open = v => v.y > 0 && v.z > 0 && v.x > -0.2;
  // a point on the capsule's surface, from u in [0, 1) round and s along
  const surface = (count, rad) => {
    const pts = [], area = TAU * rad * 2 * H + 4 * Math.PI * rad * rad;
    for (let i = 0; i < count; i++) {
      const a = r() * area;
      if (a < TAU * rad * 2 * H) { const t = r() * TAU, x = -H + r() * 2 * H; pts.push(new THREE.Vector3(x, Math.cos(t) * rad, Math.sin(t) * rad)); }
      else { const d = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(rad); d.x += Math.sign(d.x || 1) * H; pts.push(d); }
    }
    return pts;
  };
  const insideBody = v => { const x = Math.max(-H, Math.min(H, v.x)); return Math.hypot(v.x - x, v.y, v.z) < R - 0.03; };
  const outer = new Beads(), insideB = new Beads();
  const om = [col('#8cc472'), col('#7fb866'), col('#9ad081')], wall = col('#d9c98a'), im = [col('#b9d68d'), col('#c6df9c')];
  for (const v of surface(9000, R)) if (!open(v)) outer.add(v.x, v.y, v.z, 0.0068, om[Math.floor(r() * 3)]);
  for (const v of surface(7000, R - 0.012)) if (!open(v)) outer.add(v.x, v.y, v.z, 0.006, wall);
  for (const v of surface(7000, R - 0.022)) if (!open(v)) outer.add(v.x, v.y, v.z, 0.0065, im[Math.floor(r() * 2)]);
  // Pili: short straight hairs all over.
  for (const v of surface(140, R)) {
    if (open(v)) continue;
    const x0 = Math.max(-H, Math.min(H, v.x)), n = new THREE.Vector3(v.x - x0, v.y, v.z).normalize();
    for (let k = 1; k <= 9; k++) { const w = v.clone().addScaledVector(n, k * 0.007); outer.add(w.x, w.y, w.z, 0.0028, col('#b7dd9e')); }
  }
  // The cytoplasm: the nucleoid's DNA as one long tangled chain near the middle, ribosomes and proteins round it.
  let x = new THREE.Vector3(), dir = new THREE.Vector3(1, 0, 0);
  for (let k = 0; k < 5000; k++) {
    dir.add(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.8)).normalize();
    x.addScaledVector(dir, 0.006);
    const lim = new THREE.Vector3(x.x / 0.24, x.y / 0.1, x.z / 0.1);
    if (lim.length() > 1) { x.multiplyScalar(0.98 / lim.length()); dir.negate(); }
    insideB.add(x.x, x.y, x.z, 0.0045, col(k % 2 ? '#f6cf57' : '#eebc3f'));
  }
  for (let k = 0; k < 9000; k++) {
    const v = new THREE.Vector3((r() * 2 - 1) * (H + R), (r() * 2 - 1) * R, (r() * 2 - 1) * R);
    if (!insideBody(v)) continue;
    const nearDNA = Math.hypot(v.x / 0.24, v.y / 0.1, v.z / 0.1) < 1;
    if (nearDNA && r() < 0.8) continue;
    const ribo = r() < 0.35;
    insideB.add(v.x, v.y, v.z, ribo ? 0.0085 : 0.0042, ribo ? col(r() < 0.5 ? '#e87fa8' : '#d96a98') : col(r() < 0.5 ? '#7d9be0' : '#9a86d8'));
  }
  body.add(outer.points(), insideB.points());
  // Flagella: a bundle of corkscrews from the back, turning together.
  const fl = new Beads();
  for (let f = 0; f < 4; f++) {
    const a0 = (f / 4) * TAU, base = new THREE.Vector3(-H - R * 0.6, Math.cos(a0) * 0.1, Math.sin(a0) * 0.1);
    for (let k = 0; k < 260; k++) {
      const s = k * 0.0042, a = s * 52 + a0;
      fl.add(base.x - s, base.y * (1 - Math.min(1, s * 3)) + Math.cos(a) * 0.03 * Math.min(1, s * 8), base.z * (1 - Math.min(1, s * 3)) + Math.sin(a) * 0.03 * Math.min(1, s * 8), 0.0042, col('#a8d38d'));
    }
  }
  flag.add(fl.points());
  return { obj: holder, update: t => { flag.rotation.x = t * 6; holder.rotation.y = -0.5 + Math.sin(t * 0.25) * 0.35; } };
}
