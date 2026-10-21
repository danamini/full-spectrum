// The things of known size from scale.js, as small 3D models. Each builder returns an Object3D whose measured
// size is one unit: its width, or its height for tall things (the thickness for a hair and DNA, laid flat).
// Some also return update(t, px, perUnit), called every frame with the time, the unit's size in screen pixels,
// and drawing-buffer pixels per unit at a distance of one (for point sizes).
// Textures are drawn in code, so nothing is downloaded.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import * as micro from './micro.js';
import { TEXTURES } from '../data/textures.js';
import { proton as protonCloud, PROJ, RADIUS as PROTON_RADIUS, nucleus, cloudMaterial, pointsFrom, buffer, push, randomDir, tick } from './nucleon.js';
import { Beads } from './beads.js';

const TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- noise
// Value noise in 3D, summed over octaves. Deterministic, so every model looks the same each visit.
function hash(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function noise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const s = t => t * t * (3 - 2 * t), u = s(xf), v = s(yf), w = s(zf);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (i, j, k) => hash(xi + i, yi + j, zi + k);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
function fbm(x, y, z, octaves = 5) {
  let sum = 0, amp = 0.5, f = 1;
  for (let i = 0; i < octaves; i++) { sum += amp * noise(x * f, y * f, z * f); f *= 2.03; amp *= 0.5; }
  return sum / (1 - 0.5 ** octaves);
}
// A seeded random sequence for placing things.
function rng(seed) { let s = seed >>> 0; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 >>> 0) / 4294967296); }

// ---------------------------------------------------------------- textures
function canvasTexture(w, h, paint, colour = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  paint(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  if (colour) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// Vertex colours are linear light; these helpers take the usual display (sRGB) values.
const lin = c => c.map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.min(1, Math.max(0, t)));
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// A soft round dot, for glows and particles.
let dotTexture;
function dot() {
  return dotTexture ??= canvasTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  });
}

// ---------------------------------------------------------------- shared pieces
// A rim of light that brightens towards the edge, like an atmosphere or a membrane seen side-on.
export function glowShell(geometry, colour, { power = 3, strength = 1.2 } = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { colour: { value: new THREE.Color(colour) }, power: { value: power }, strength: { value: strength } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 colour; uniform float power; uniform float strength; varying vec3 vN; varying vec3 vV; void main() { float f = pow(1.0 - abs(dot(vN, vV)), power) * strength; gl_FragColor = vec4(colour * f, f); }',
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  return new THREE.Mesh(geometry, mat);
}
// Points drawn as soft glowing dots that add up where they overlap.
function sparks(positions, colour, size, { colours = null, opacity = 1 } = {}) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (colours) g.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  const m = new THREE.PointsMaterial({ color: new THREE.Color(colour).multiplyScalar(2), size, map: dot(), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: !!colours, sizeAttenuation: true });
  const p = new THREE.Points(g, m);
  p.userData.base = size; // in model units; the stage scales it to the screen
  return p;
}
// A sphere pushed in and out by noise, for blobby proteins and grains.
function lumpy(radius, amount, freq, seed = 0, detail = 4) {
  const ico = new THREE.IcosahedronGeometry(radius, detail);
  ico.deleteAttribute('normal'); ico.deleteAttribute('uv');
  const g = mergeVertices(ico), p = g.attributes.position, v = new THREE.Vector3(); // shared corners, so it shades smoothly
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize().multiplyScalar(freq);
    v.multiplyScalar(1 + amount * (fbm(n.x + seed, n.y, n.z, 4) - 0.5) * 2);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
const std = (colour, o = {}) => new THREE.MeshStandardMaterial({ color: colour, roughness: 0.55, metalness: 0, ...o });
const phys = (colour, o = {}) => new THREE.MeshPhysicalMaterial({ color: colour, roughness: 0.4, metalness: 0, ...o });
function tube(points, radius, mat, segs = 64, radial = 8, closed = false) {
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed), segs, radius, radial, closed), mat);
}
// Turn about the vertical, at `speed` radians a second, with a fixed tilt towards the viewer.
function turntable(obj, speed = 0.35, tilt = 0.25) {
  const holder = new THREE.Group(); holder.rotation.x = tilt; holder.add(obj);
  return { obj: holder, update: t => { obj.rotation.y = t * speed; } };
}

// ---------------------------------------------------------------- planets and moons
// Real maps (assets/textures/, tools/fetch_textures.mjs: Solar System Scope, CC BY 4.0, from NASA data).
const loader = new THREE.TextureLoader(), maps = new Map();
function map(name, colour = true) {
  if (!maps.has(name)) {
    const t = loader.load(TEXTURES[name].file);
    if (colour) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    maps.set(name, t);
  }
  return maps.get(name);
}
// The direction the sunlight comes from, as the stage's key light (view space: the camera never turns).
const SUN = new THREE.Vector3(-0.6, 0.8, 1).normalize();
function planet(colourMap, { roughness = 0.9, roughnessMap = null, normalMap = null, night = null, oblate = 1, tilt = 0.4, spin = 0.12, atmosphere = null, clouds = null } = {}) {
  const group = new THREE.Group(), axis = new THREE.Group();
  axis.rotation.z = tilt; group.add(axis);
  const mat = std(0xffffff, { map: colourMap, roughness, roughnessMap, normalMap, normalScale: new THREE.Vector2(1.5, 1.5), envMapIntensity: 0.12 });
  if (night) {
    // city lights on the night side only: the emissive map, faded out where the sun is up
    Object.assign(mat, { emissive: new THREE.Color(0xffc98a), emissiveMap: night, emissiveIntensity: 0.8 });
    mat.onBeforeCompile = sh => {
      sh.uniforms.uSun = { value: SUN };
      sh.fragmentShader = 'uniform vec3 uSun;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= smoothstep(0.05, -0.3, dot(normal, uSun)) * smoothstep(0.05, 0.35, normal.z);');
    };
  }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.5, 128, 96), mat);
  ball.scale.y = oblate; axis.add(ball);
  let cloud = null;
  if (clouds) {
    cloud = new THREE.Mesh(new THREE.SphereGeometry(0.506, 128, 96), std(0xffffff, { alphaMap: clouds, transparent: true, depthWrite: false, roughness: 1 }));
    axis.add(cloud);
  }
  if (atmosphere) group.add(glowShell(new THREE.SphereGeometry(0.525, 64, 48), atmosphere, { power: 4, strength: 1 }));
  return { obj: group, update: t => { ball.rotation.y = t * spin; if (cloud) cloud.rotation.y = t * spin * 1.2; } };
}

const MODELS = {
  // Bead models of real structures and whole microbes: js/micro.js.
  haemoglobin: micro.haemoglobin, dna: micro.dna, ribosome: micro.ribosome, flu: micro.flu, mimivirus: micro.mimivirus, bacterium: micro.bacterium,

  jupiter: () => planet(map('jupiter'), { oblate: 0.935, tilt: 0.05, spin: 0.25 }),
  neptune: () => planet(map('neptune'), { tilt: 0.49, spin: 0.2, atmosphere: '#7fb2ff' }),
  earth: () => planet(map('earth-day'), { roughness: 1, roughnessMap: map('earth-roughness', false), normalMap: map('earth-normal', false), night: map('earth-night'), clouds: map('earth-clouds', false), tilt: 0.41, spin: 0.15, atmosphere: '#6fb6ff' }),
  moon: () => planet(map('moon'), { tilt: 0.03, spin: 0.08, roughness: 0.95 }),

  // Two bodies, or two places, a distance apart. Their dots keep a fixed size on screen.
  earthMoon() {
    const g = new THREE.Group();
    const e = MODELS.earth(), m = MODELS.moon();
    e.obj.position.x = -0.5; m.obj.position.x = 0.5;
    const line = dashed([V(-0.5, 0, 0), V(0.5, 0, 0)]);
    g.add(e.obj, m.obj, line);
    return { obj: g, update: (t, px) => { e.update(t); m.update(t); e.obj.scale.setScalar(26 / px); m.obj.scale.setScalar(9 / px); line.material.dashSize = line.material.gapSize = 5 / px; } };
  },
  londonEdinburgh: () => route([V(-0.5, -0.02, 0), V(-0.25, 0.05, 0.03), V(0, 0.02, -0.02), V(0.25, 0.06, 0.02), V(0.5, 0, 0)], '#f2b45a'),
  marathon: () => route([V(-0.5, 0, 0), V(-0.35, 0.08, 0.05), V(-0.15, -0.05, -0.06), V(0.05, 0.07, 0.02), V(0.22, -0.06, 0.05), V(0.38, 0.05, -0.03), V(0.5, 0, 0)], '#8ef0b0'),

  // Everest from real heights (assets/textures/everest.bin: a 16 km square round the summit), as a block of
  // ground from sea level up, so its full 8,849 m is the unit. Snow, glacier and rock are coloured from height
  // and steepness; the dark Yellow Band of limestone crosses the summit pyramid near 8,300 m.
  everest() {
    const info = TEXTURES.everest, M = 8849, holder = new THREE.Group(), inner = new THREE.Group();
    holder.rotation.x = 0.38; holder.add(inner);
    const plume = new THREE.Group(); inner.add(plume);
    fetch(info.file).then(r => r.arrayBuffer()).then(buf => {
      const full = new Int16Array(buf), F = info.grid, KEEP = 11000;                 // the middle 11 km: Everest, Lhotse and Nuptse
      const N = Math.round((KEEP / info.spanMetres) * (F - 1)) + 1, off = Math.round((F - N) / 2), h = new Int16Array(N * N);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) h[j * N + i] = full[(j + off) * F + i + off];
      const span = ((N - 1) / (F - 1)) * info.spanMetres / M, step = span / (N - 1);
      const g = new THREE.PlaneGeometry(span, span, N - 1, N - 1); g.rotateX(-Math.PI / 2);
      const p = g.attributes.position;
      let top = 0, peak = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) { const y = h[i] / M; p.setY(i, y); if (y > top) { top = y; peak.set(p.getX(i), y, p.getZ(i)); } }
      g.computeVertexNormals();
      const n = g.attributes.normal, col = [];
      for (let i = 0; i < p.count; i++) {
        const metres = p.getY(i) * M, steep = 1 - n.getY(i), x = p.getX(i), z = p.getZ(i), noise = fbm(x * 40, 0.5, z * 40, 4);
        const rock = mix([0.32, 0.29, 0.27], [0.47, 0.42, 0.37], noise);
        let c = mix(rock, [0.24, 0.22, 0.22], smooth(0.45, 0.8, steep));                                   // steep faces darker
        c = mix(c, [0.55, 0.48, 0.33], smooth(8150, 8250, metres) * smooth(8500, 8400, metres) * smooth(0.25, 0.5, steep)); // the Yellow Band
        const snow = smooth(5900 + 600 * noise, 6400 + 600 * noise, metres) * smooth(0.42, 0.22, steep);
        const glacier = smooth(5000, 5300, metres) * smooth(0.16, 0.05, steep) * (1 - snow);
        c = mix(c, [0.8, 0.84, 0.9], snow);
        c = mix(c, [0.62, 0.7, 0.76], glacier * 0.8);
        col.push(...lin(c));
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const land = new THREE.Mesh(g, std(0xffffff, { vertexColors: true, roughness: 0.92 }));
      // the block's sides, from the surface's edge down to sea level, in bands of rock
      const sides = [], sideCol = [], half = span / 2;
      const edge = [];
      for (let i = 0; i < N; i++) edge.push([-half + i * step, -half, 0, i]);
      for (let j = 0; j < N; j++) edge.push([half, -half + j * step, 1, j]);
      for (let i = N - 1; i >= 0; i--) edge.push([-half + i * step, half, 2, i]);
      for (let j = N - 1; j >= 0; j--) edge.push([-half, -half + j * step, 3, j]);
      const at = (x, z) => h[Math.round((z + half) / step) * N + Math.round((x + half) / step)] / M;
      for (let k = 0; k < edge.length - 1; k++) {
        const [x1, z1] = edge[k], [x2, z2] = edge[k + 1], y1 = at(x1, z1), y2 = at(x2, z2);
        sides.push(x1, y1, z1, x2, y2, z2, x1, 0, z1, x2, y2, z2, x2, 0, z2, x1, 0, z1);
        for (const y of [y1, y2, 0, y2, 0, 0]) { const band = 0.5 + 0.5 * Math.sin(y * 90 + fbm(x1 * 30, y * 20, z1 * 30, 3) * 4); sideCol.push(...lin(mix([0.2, 0.17, 0.15], [0.34, 0.29, 0.25], band * (0.4 + y)))); }
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.Float32BufferAttribute(sides, 3));
      sg.setAttribute('color', new THREE.Float32BufferAttribute(sideCol, 3));
      sg.computeVertexNormals();
      const walls = new THREE.Mesh(sg, std(0xffffff, { vertexColors: true, roughness: 1, side: THREE.DoubleSide, emissive: 0x1c140e }));
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(span, span).rotateX(Math.PI / 2), std(0x15120f));
      const block = new THREE.Group(); block.add(land, walls, floor); block.position.y = -0.5;
      inner.add(block);
      // snow blown off the summit by the jet stream
      const r = rng(3), pts = [];
      for (let i = 0; i < 220; i++) { const k = r(); pts.push(peak.x + 0.02 + k * 0.5, peak.y - 0.5 - k * 0.05 + (r() - 0.5) * 0.04 * (1 + k * 2), peak.z + (r() - 0.5) * 0.05 * (1 + k * 3)); }
      plume.add(sparks(pts, 0xeaf2ff, 0.02, { opacity: 0.1 }));
    });
    return { obj: holder, update: t => { inner.rotation.y = 0.6 + Math.sin(t * 0.12) * 0.5; plume.position.x = (t * 0.015) % 0.06; } };
  },

  // The Burj Khalifa: three wings round a hexagonal core (its 'Y' plan, from the desert flower Hymenocallis),
  // stepping back one wing at a time in a spiral, 27 times, up to the top floor near 585 m; then the core alone,
  // and the spire to 828 m, the unit. Glass and steel, with lights in some windows.
  burj() {
    const g = new THREE.Group(), W = 0.012, CORE = 0.026, BASE = 0.093, TOP = 0.71, TIERS = 27;
    const windows = canvasTexture(128, 256, ctx => {
      ctx.fillStyle = '#1b2433'; ctx.fillRect(0, 0, 128, 256);
      for (let y = 0; y < 256; y += 4) for (let x = 0; x < 128; x += 4) { const on = hash(x, y, 1) > 0.8; ctx.fillStyle = on ? `rgba(255,214,150,${0.45 + hash(x, y, 2) * 0.5})` : '#2b3a52'; ctx.fillRect(x + 1, y + 1, 2, 2); }
      ctx.fillStyle = 'rgba(210,225,240,0.55)'; for (let x = 0; x < 128; x += 8) ctx.fillRect(x, 0, 1, 256);   // the steel fins
    });
    windows.wrapS = windows.wrapT = THREE.RepeatWrapping; windows.repeat.set(30, 6);
    const glass = phys(0xc2d0e0, { metalness: 0.75, roughness: 0.16, clearcoat: 1, envMapIntensity: 1.8, emissive: 0xffffff, emissiveMap: windows, emissiveIntensity: 0.65 });
    const steel = phys(0xd8dee6, { metalness: 1, roughness: 0.22 });
    // the radius of the floor plate in each direction: the furthest of the core and the three wings, each wing a
    // rounded bar from the centre out to its length
    const wingDist = (dx, dy, a, len) => { const c = Math.cos(a), s = Math.sin(a), u = dx * c + dy * s, v = -dx * s + dy * c, uc = Math.max(0, Math.min(len - W, u)); return Math.hypot(u - uc, v); };
    const plan = lens => {
      const shape = new THREE.Shape();
      for (let k = 0; k <= 240; k++) {
        const th = (k / 240) * TAU, dx = Math.cos(th), dy = Math.sin(th);
        let lo = 0, hi = BASE + W;
        for (let it = 0; it < 22; it++) { const m = (lo + hi) / 2, x = dx * m, y = dy * m; const inside = Math.hypot(x, y) < CORE || lens.some((L, i) => wingDist(x, y, (i * TAU) / 3 + Math.PI / 2, L) < W); inside ? (lo = m) : (hi = m); }
        k ? shape.lineTo(dx * lo, dy * lo) : shape.moveTo(dx * lo, dy * lo);
      }
      return shape;
    };
    const lens = [BASE, BASE, BASE];
    for (let k = 0; k < TIERS; k++) {
      const y0 = (k / TIERS) * TOP, dy = TOP / TIERS;
      lens[k % 3] = CORE + (BASE - CORE) * (1 - (Math.floor(k / 3) + 1) / 10) ** 1.15;   // one wing steps back, round and round
      const geo = new THREE.ExtrudeGeometry(plan(lens), { depth: dy * 0.94, bevelEnabled: false, curveSegments: 1 });
      geo.rotateX(-Math.PI / 2); geo.translate(0, y0, 0);
      g.add(new THREE.Mesh(geo, glass));
      const ledge = new THREE.Mesh(new THREE.ExtrudeGeometry(plan(lens.map(L => L + 0.0012)), { depth: dy * 0.06, bevelEnabled: false }), steel);
      ledge.geometry.rotateX(-Math.PI / 2); ledge.geometry.translate(0, y0 + dy * 0.94, 0);
      g.add(ledge);
    }
    // above the floors: the core narrowing, then the spire
    const core = new THREE.Mesh(new THREE.CylinderGeometry(CORE * 0.55, CORE * 0.9, 0.09, 6), glass); core.position.y = TOP + 0.045; g.add(core);
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, CORE * 0.5, 1 - TOP - 0.09, 12), steel); spire.position.y = TOP + 0.09 + (1 - TOP - 0.09) / 2; g.add(spire);
    for (let k = 0; k < 6; k++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(CORE * (0.48 - k * 0.06), 0.0012, 6, 24), steel); ring.rotation.x = Math.PI / 2; ring.position.y = TOP + 0.1 + k * 0.03; g.add(ring); }
    const beacon = sparks([0, 1, 0], 0xff3a2a, 0.02); g.add(beacon);
    g.position.y = -0.5;
    const holder = new THREE.Group(); holder.rotation.x = 0.1; holder.add(g);
    return { obj: holder, update: t => { g.rotation.y = t * 0.15; beacon.material.opacity = (t % 1.5) < 0.18 ? 1 : 0.08; } };
  },

  pitch() {
    const L = 1, W = 0.65;
    const tex = canvasTexture(1050, 680, (ctx, w, h) => {
      for (let i = 0; i < 14; i++) { ctx.fillStyle = i % 2 ? '#2e6e36' : '#357d3e'; ctx.fillRect((i * w) / 14, 0, w / 14 + 1, h); }
      const k = w / 105; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.14 * k * 1.2;
      const m = 0;
      ctx.strokeRect(m + 1, m + 1, w - 2, h - 2);
      ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
      ctx.beginPath(); ctx.arc(w / 2, h / 2, 9.15 * k, 0, TAU); ctx.stroke();
      for (const s of [0, 1]) {
        const x = s ? w : 0, d = s ? -1 : 1;
        ctx.strokeRect(s ? w - 16.5 * k : 0, h / 2 - 20.16 * k, 16.5 * k, 40.32 * k);
        ctx.strokeRect(s ? w - 5.5 * k : 0, h / 2 - 9.16 * k, 5.5 * k, 18.32 * k);
        ctx.beginPath(); ctx.arc(x + d * 11 * k, h / 2, 9.15 * k, s ? Math.PI - 0.93 : -0.93, s ? Math.PI + 0.93 : 0.93); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + d * 11 * k, h / 2, 0.3 * k, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(w / 2, h / 2, 0.3 * k, 0, TAU); ctx.fill();
    });
    const g = new THREE.Group();
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(L, W), std(0xffffff, { map: tex, roughness: 0.9 }));
    grass.rotation.x = -Math.PI / 2; g.add(grass);
    const surround = new THREE.Mesh(new THREE.PlaneGeometry(L * 1.12, W * 1.18), std(0x1f4a27, { roughness: 1 }));
    surround.rotation.x = -Math.PI / 2; surround.position.y = -0.001; g.add(surround);
    const white = std(0xffffff, { roughness: 0.3, emissive: 0x333333 });
    for (const s of [-1, 1]) {
      const gw = 7.32 / 105, gh = 2.44 / 105, x = s * L / 2;
      g.add(tube([V(x, 0, -gw / 2), V(x, gh, -gw / 2), V(x, gh, gw / 2), V(x, 0, gw / 2)], 0.0012, white, 12, 4));
    }
    // Floodlights at the corners, with their glow.
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const mx = x * L * 0.55, mz = z * W * 0.58;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.003, 0.22, 6), std(0x8b96aa));
      mast.position.set(mx, 0.11, mz); g.add(mast);
      const lamp = sparks([mx, 0.225, mz], 0xfff6dd, 0.08); g.add(lamp);
    }
    // A ball, rolling up and down.
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.006, 16, 12), white);
    g.add(ball);
    const holder = new THREE.Group(); holder.rotation.x = 0.7; holder.add(g);
    return { obj: holder, update: t => { g.rotation.y = Math.sin(t * 0.2) * 0.35; ball.position.set(Math.sin(t * 0.7) * 0.4, 0.006, Math.sin(t * 1.1) * 0.2); } };
  },

  phone() {
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new RoundedBoxGeometry(0.48, 1, 0.055, 6, 0.07), phys(0x2a3140, { metalness: 0.9, roughness: 0.3 }));
    g.add(frame);
    const screenTex = canvasTexture(240, 500, (ctx, w, h) => {
      const gr = ctx.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#2b1a6b'); gr.addColorStop(0.5, '#1d5fa8'); gr.addColorStop(1, '#f2b45a');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = '600 44px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('09:41', w / 2, 90);
      const cols = ['#ff6b6b', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#f78c6b', '#90be6d', '#f9c74f'];
      for (let i = 0; i < 16; i++) { ctx.fillStyle = cols[i % cols.length]; ctx.beginPath(); ctx.roundRect(22 + (i % 4) * 52, 170 + Math.floor(i / 4) * 64, 40, 40, 10); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.roundRect(16, h - 80, w - 32, 60, 20); ctx.fill();
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.43, 0.94), std(0x000000, { emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: 1.1, roughness: 0.05, metalness: 0.3 }));
    screen.position.z = 0.03; g.add(screen); // clear of the frame's face, so the two never fight for depth
    const bump = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.2, 0.02, 3, 0.04), phys(0x3a4254, { metalness: 0.6, roughness: 0.2 }));
    bump.position.set(-0.11, 0.36, -0.03); g.add(bump);
    for (const [x, y] of [[-0.155, 0.41], [-0.07, 0.41], [-0.155, 0.32]]) {
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.012, 24), phys(0x05070c, { roughness: 0.02, metalness: 0.5, clearcoat: 1 }));
      lens.rotation.x = Math.PI / 2; lens.position.set(x, y, -0.042); g.add(lens);
    }
    const holder = new THREE.Group(); holder.add(g);
    return { obj: holder, update: t => { g.rotation.y = Math.sin(t * 0.35) * 1.4; g.rotation.x = 0.12 + Math.sin(t * 0.5) * 0.06; } };
  },

  coin() {
    // The 12-sided bimetallic £1 coin: a gold-coloured ring round a silver-coloured centre.
    const R = 0.5, T = 2.8 / 23.43;
    const outer = new THREE.Shape(), hole = new THREE.Path(), inner = new THREE.Shape();
    for (let i = 0; i <= 12; i++) { const a = (i / 12) * TAU + Math.PI / 12; i ? outer.lineTo(Math.cos(a) * R, Math.sin(a) * R) : outer.moveTo(Math.cos(a) * R, Math.sin(a) * R); }
    for (let i = 0; i <= 64; i++) { const a = (i / 64) * TAU; const p = [Math.cos(a) * R * 0.66, Math.sin(a) * R * 0.66]; i ? hole.lineTo(...p) : hole.moveTo(...p); i ? inner.lineTo(...p) : inner.moveTo(...p); }
    outer.holes.push(hole);
    const relief = canvasTexture(256, 256, (ctx) => {
      ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = '#c0c0c0'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(128, 128, 118, 0, TAU); ctx.stroke();
      ctx.font = '700 22px serif'; ctx.fillStyle = '#d0d0d0'; ctx.textAlign = 'center';
      for (const [i, ch] of [...'ELIZABETH II · D · G · REG · F · D · 2017 · '].entries()) { ctx.save(); ctx.translate(128, 128); ctx.rotate((i / 44) * TAU); ctx.fillText(ch, 0, -100); ctx.restore(); }
      ctx.font = '700 64px serif'; ctx.fillText('£1', 128, 150);
    }, false);
    const bevel = { depth: T * 0.7, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.02, bevelSegments: 3, curveSegments: 24 };
    const gold = phys(0xe5c46a, { metalness: 1, roughness: 0.22, bumpMap: relief, bumpScale: 3, clearcoat: 0.4 });
    const silver = phys(0xd8dde4, { metalness: 1, roughness: 0.2, bumpMap: relief, bumpScale: 3 });
    const ringGeo = new THREE.ExtrudeGeometry(outer, bevel), coreGeo = new THREE.ExtrudeGeometry(inner, bevel);
    for (const geo of [ringGeo, coreGeo]) {
      geo.translate(0, 0, -T * 0.35);
      const p = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) + 0.5, p.getY(i) + 0.5);
    }
    const g = new THREE.Group(); g.add(new THREE.Mesh(ringGeo, gold), new THREE.Mesh(coreGeo, silver));
    const holder = new THREE.Group(); holder.add(g);
    return { obj: holder, update: t => { g.rotation.y = t * 0.9; g.rotation.x = 0.25; } };
  },

  sand() {
    const geo = lumpy(0.45, 0.16, 1.6, 2, 5), p = geo.attributes.position, col = [];
    for (let i = 0; i < p.count; i++) { const k = fbm(p.getX(i) * 10, p.getY(i) * 10, p.getZ(i) * 10, 3); col.push(...lin(mix([0.86, 0.74, 0.52], [0.62, 0.48, 0.3], k))); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const grain = new THREE.Mesh(geo, phys(0xffffff, { vertexColors: true, roughness: 0.6, clearcoat: 0.3, clearcoatRoughness: 0.4 }));
    grain.scale.set(1.08, 0.86, 0.95);
    // Glints off the crystal faces.
    const r = rng(9), gl = []; for (let i = 0; i < 30; i++) { const v = V(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(0.47); gl.push(v.x, v.y, v.z); }
    const glints = sparks(gl, 0xffffff, 0.06, { colours: gl.map(() => 1) });
    const g = new THREE.Group(); g.add(grain, glints);
    const col2 = glints.geometry.attributes.color;
    return { obj: g, update: t => { g.rotation.set(t * 0.2, t * 0.3, 0); for (let i = 0; i < col2.count; i++) { const v = Math.max(0, Math.sin(t * 2 + i * 1.7)) ** 12; col2.setXYZ(i, v, v, v); } col2.needsUpdate = true; } };
  },

  // A hair lying across, measured through its thickness.
  hair() {
    const cuticle = canvasTexture(512, 64, (ctx, w, h) => {
      ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 9) { ctx.strokeStyle = '#c8c8c8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 0); for (let y = 0; y <= h; y += 4) ctx.lineTo(x + Math.sin(y * 0.3 + x) * 2.5, y); ctx.stroke(); }
    }, false);
    cuticle.wrapS = cuticle.wrapT = THREE.RepeatWrapping; cuticle.repeat.set(2, 1);
    const fade = canvasTexture(256, 4, (ctx, w) => { const gr = ctx.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#000'); gr.addColorStop(0.2, '#fff'); gr.addColorStop(0.8, '#fff'); gr.addColorStop(1, '#000'); ctx.fillStyle = gr; ctx.fillRect(0, 0, w, 4); }, false);
    const geo = new THREE.CylinderGeometry(0.5, 0.5, 2.6, 48, 1, true); geo.rotateZ(Math.PI / 2);
    // Map the length along the hair to the fade's u.
    const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 2.6 + 0.5, uv.getX(i));
    const mat = phys(0x5a3a22, { roughness: 0.35, bumpMap: cuticle, bumpScale: 4, alphaMap: fade, transparent: true, sheen: 1, sheenColor: 0xd9a066, clearcoat: 0.5 });
    const hair = new THREE.Mesh(geo, mat);
    const holder = new THREE.Group(); holder.add(hair);
    return { obj: holder, update: t => { hair.rotation.x = t * 0.4; holder.rotation.y = Math.sin(t * 0.3) * 0.35; } };
  },

  // The resting red cell's biconcave outline (Evans and Fung), 8 µm across, cut open to show it is packed with
  // haemoglobin (drawn far larger than the real 5.5 nm, a third of a billion of them), with others drifting behind.
  bloodCell() {
    const half = r => 0.5 * Math.sqrt(Math.max(0, 1 - (r / 0.5) ** 2)) * (0.0518 + 2.0026 * (r / 0.5) ** 2 - 1.1214 * (r / 0.5) ** 4) * 0.62;
    const prof = [];
    for (let i = 0; i <= 64; i++) { const r = (i / 64) * 0.5; prof.push(new THREE.Vector2(Math.max(r, 0.0001), half(r))); }
    for (let i = 63; i >= 0; i--) prof.push(new THREE.Vector2(prof[i].x, -prof[i].y));
    const skin = canvasTexture(256, 256, (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = 110 + 120 * fbm(x / 22, y / 22, 3, 4); const i = (y * w + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
      ctx.putImageData(img, 0, 0);
    }, false);
    skin.wrapS = skin.wrapT = THREE.RepeatWrapping; skin.repeat.set(4, 2);
    const mat = () => phys(0xb3141f, { roughness: 0.42, sheen: 1, sheenColor: 0xff7a6a, sheenRoughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.4, bumpMap: skin, bumpScale: 0.6, emissive: 0x2a0204, side: THREE.DoubleSide });
    const cut = new THREE.Mesh(new THREE.LatheGeometry(prof, 160, Math.PI * 0.5, Math.PI * 1.5), mat());
    const g = new THREE.Group(), main = new THREE.Group(); main.add(cut);
    // the inside of the cut: haemoglobin, packed
    const r = rng(23), hb = new Beads(), hues = [new THREE.Color('#c0392b'), new THREE.Color('#a93226'), new THREE.Color('#d24d3c')];
    for (let k = 0; k < 9000; k++) {
      const rad = Math.sqrt(r()) * 0.49, a = r() * Math.PI * 0.5, z = (r() * 2 - 1) * half(rad) * 0.92;
      hb.add(Math.cos(a) * rad, z, Math.sin(a) * rad, 0.0085, hues[k % 3]);
    }
    main.add(hb.points());
    g.add(main);
    // others, further back and softer
    const others = [[-0.75, 0.32, -0.9, 0.85], [0.8, -0.28, -1.2, 0.75], [0.15, 0.55, -1.6, 0.7], [-0.3, -0.6, -1.4, 0.65]].map(([x, y, z, sc], i) => {
      const m = mat(); m.transparent = true; m.opacity = 0.55 - i * 0.08;
      const c = new THREE.Mesh(new THREE.LatheGeometry(prof, 96), m);
      c.position.set(x, y, z); c.scale.setScalar(sc); g.add(c); return c;
    });
    return { obj: g, update: t => {
      main.rotation.set(0.95 + Math.sin(t * 0.35) * 0.18, -0.6 + Math.sin(t * 0.22) * 0.3, 0.15);
      others.forEach((c, i) => { c.rotation.set(0.6 + Math.sin(t * 0.4 + i) * 0.5, t * 0.1 * (i % 2 ? 1 : -1), Math.sin(t * 0.3 + i) * 0.3); c.position.x += Math.sin(t * 0.2 + i) * 0.0004; });
    } };
  },

  // Water: oxygen and two hydrogens at their measured bond length (0.958 Å) and angle (104.5°), as balls and
  // sticks inside a shimmering cloud of its ten electrons. The cloud is the molecule's real size and shape (one
  // unit is 2.8 Å); it gathers towards the oxygen (pink) and thins round the hydrogens (blue): water is polar.
  water() {
    const g = new THREE.Group(), k = 1 / 2.8, half = (104.45 / 2) * Math.PI / 180, bond = 0.9584 * k;
    const o = new THREE.Mesh(new THREE.SphereGeometry(0.42 * k, 48, 32), phys(0xe2483f, { roughness: 0.25, clearcoat: 1, sheen: 0.4 }));
    const hs = [-1, 1].map(s => new THREE.Mesh(new THREE.SphereGeometry(0.26 * k, 48, 32), phys(0xeef1f6, { roughness: 0.3, clearcoat: 0.8 })));
    const stick = phys(0xb8c0cc, { roughness: 0.35, metalness: 0.1 });
    const sticks = hs.map(() => new THREE.Mesh(new THREE.CylinderGeometry(0.09 * k, 0.09 * k, 1, 16), stick));
    const place = a => hs.forEach((h, i) => {
      h.position.set(Math.sin(a) * bond * (i ? 1 : -1), -Math.cos(a) * bond, 0);
      sticks[i].position.copy(h.position).multiplyScalar(0.5); sticks[i].scale.y = bond;
      sticks[i].quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), h.position.clone().normalize());
    });
    place(half);
    const atoms = new THREE.Group(); atoms.add(o, ...hs, ...sticks);
    // the electrons: 8 round the oxygen (pulled in, and bulging away from the hydrogens where its lone pairs
    // are), one shared towards each hydrogen
    const b = buffer(), c = new THREE.Color(), gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
    const sample = v => {
      const which = Math.random();
      if (which < 0.8) { v.set(gauss(), gauss(), gauss()).multiplyScalar(0.62 * k); v.y += 0.18 * k; }
      else { const s = which < 0.9 ? -1 : 1; v.set(gauss(), gauss(), gauss()).multiplyScalar(0.45 * k).add(new THREE.Vector3(Math.sin(half) * bond * s * 0.8, -Math.cos(half) * bond * 0.8, 0)); }
      return v;
    };
    for (let i = 0; i < 16000; i++) {
      const a = sample(new THREE.Vector3()), d = sample(new THREE.Vector3());
      c.set(a.y > -0.25 * k ? '#ff8f80' : '#86bfff');
      push(b, a, d, c, 0.8 + Math.random() * 0.6);
    }
    const cloud = pointsFrom(b, cloudMaterial({ size: 0.034, rate: 0.12 }));
    cloud.material.uniforms.uOpacity.value = 0.42;
    g.add(atoms, cloud);
    g.position.y = 0.06;
    const holder = new THREE.Group(); holder.add(g);
    return { obj: holder, update: (t, px, perUnit) => {
      if (perUnit) PROJ.value = perUnit;
      tick(g, t);
      place(half + Math.sin(t * 3) * 0.035); // the bending vibration, slowed down a long way
      g.rotation.y = Math.sin(t * 0.35) * 1.1;
    } };
  },

  // Hydrogen's electron in its lowest state, as Molecule Viewer draws a cloud: each point blinks between two
  // places it might be found, so the cloud shimmers. Densest at the centre, with no edge; two Bohr radii, the
  // size usually quoted, is one unit. The nucleus is drawn far too large to see: at true scale it would be
  // 60,000 times smaller than the cloud.
  hydrogen() {
    const a0 = 0.25, b = buffer(), c = new THREE.Color();
    const sample = v => randomDir(v).multiplyScalar(-a0 / 2 * Math.log(Math.random() * Math.random() * Math.random())); // 1s: gamma(3) in 2r/a0
    for (let i = 0; i < 12000; i++) {
      const p = sample(new THREE.Vector3()), q = sample(new THREE.Vector3());
      c.set('#7cc4ff').lerp(new THREE.Color('#d6ecff'), Math.max(0, 1 - p.length() / 0.25) * 0.6);
      push(b, p, q, c, 0.8 + Math.random() * 0.5);
    }
    const cloud = pointsFrom(b, cloudMaterial({ size: 0.03, rate: 0.12 }));
    cloud.material.uniforms.uOpacity.value = 0.75;
    const core = sparks([0, 0, 0], 0xffd9a0, 0.03);
    const g = new THREE.Group(); g.add(cloud, core);
    return { obj: g, update: (t, px, perUnit) => { if (perUnit) PROJ.value = perUnit; tick(g, t); g.rotation.y = t * 0.08; } };
  },

  // Uranium-238 as Molecule Viewer packs a nucleus: 92 protons and 146 neutrons, jostling.
  uranium() {
    const n = nucleus(92, 238), g = new THREE.Group();
    n.group.scale.setScalar(0.5 / n.radius); g.add(n.group);
    return { obj: g, update: t => { n.update(t); g.rotation.y = t * 0.2; g.rotation.x = 0.2; } };
  },

  // Molecule Viewer's proton (js/nucleon.js), sized so its charge radius fills the unit.
  proton() {
    const p = protonCloud(), g = new THREE.Group(), inner = 0.5 / PROTON_RADIUS;
    p.group.scale.setScalar(inner); g.add(p.group);
    // Molecule Viewer shows it filling the screen; here it is a few hundred pixels across, so its points are
    // drawn larger than to scale (up to 2x) to keep the cloud's look.
    return { obj: g, update: (t, px, perUnit) => { if (perUnit) PROJ.value = perUnit * inner * Math.min(2, Math.max(1, 800 / px)); p.update(t); g.rotation.y = t * 0.15; } };
  },
};

// A route between two places: a pin at each end, the way between, and a dot that travels it.
function route(points, colour) {
  const g = new THREE.Group(), curve = new THREE.CatmullRomCurve3(points);
  const line = dashed(curve.getPoints(80), colour);
  const pins = [points[0], points.at(-1)].map(p => { const s = sparks([p.x, p.y, p.z], colour, 1); g.add(s); return s; });
  const runner = sparks([0, 0, 0], 0xffffff, 1); g.add(line, runner);
  return { obj: g, update: (t, px) => {
    const p = curve.getPoint((t * 0.12) % 1);
    runner.geometry.attributes.position.setXYZ(0, p.x, p.y, p.z); runner.geometry.attributes.position.needsUpdate = true;
    for (const s of pins) s.userData.base = 22 / px; runner.userData.base = 14 / px;
    line.material.dashSize = line.material.gapSize = 5 / px;
    g.rotation.x = 0.5;
  } };
}
function dashed(points, colour = 0xe6ebf3) {
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineDashedMaterial({ color: colour, dashSize: 0.01, gapSize: 0.01, transparent: true, opacity: 0.7 }));
  line.computeLineDistances();
  return line;
}

export function build(key) {
  const make = MODELS[key];
  if (!make) return null;
  const m = make();
  return { obj: m.obj, update: m.update ?? (() => {}) };
}
