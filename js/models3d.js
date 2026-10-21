// The things of known size from scale.js, as small 3D models. Each builder returns an Object3D whose measured
// size is one unit: its width, or its height for tall things (the thickness for a hair and DNA, laid flat).
// Some also return update(t, px), called every frame with the time and the unit's size in screen pixels.
// Textures are drawn in code, so nothing is downloaded.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

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
// A texture for a sphere: fn gets the point on the unit sphere and the latitude, and returns [r, g, b, a?].
function sphereTexture(w, h, fn, colour = true) {
  return canvasTexture(w, h, (ctx) => {
    const img = ctx.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) {
      const lat = Math.PI / 2 - (y + 0.5) / h * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
      for (let x = 0; x < w; x++) {
        const lon = (x + 0.5) / w * TAU;
        const [r, g, b, a = 255] = fn(cl * Math.cos(lon), sl, -cl * Math.sin(lon), lat, lon);
        const i = (y * w + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, colour);
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
function planet(map, { bump = null, roughness = 0.9, roughnessMap = null, oblate = 1, tilt = 0.4, spin = 0.12, atmosphere = null, clouds = null } = {}) {
  const group = new THREE.Group(), axis = new THREE.Group();
  axis.rotation.z = tilt; group.add(axis);
  const mat = std(0xffffff, { map, roughness, roughnessMap, bumpMap: bump, bumpScale: bump ? 2.5 : 0 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.5, 96, 64), mat);
  ball.scale.y = oblate; axis.add(ball);
  let cloud = null;
  if (clouds) {
    cloud = new THREE.Mesh(new THREE.SphereGeometry(0.508, 96, 64), std(0xffffff, { alphaMap: clouds, transparent: true, depthWrite: false, roughness: 1 }));
    axis.add(cloud);
  }
  if (atmosphere) group.add(glowShell(new THREE.SphereGeometry(0.53, 64, 48), atmosphere, { power: 3.5, strength: 0.9 }));
  return { obj: group, update: t => { ball.rotation.y = t * spin; if (cloud) cloud.rotation.y = t * spin * 1.25; } };
}

let earthTex;
function earthTextures() {
  if (earthTex) return earthTex;
  const land = (x, y, z) => fbm(x * 1.7 + 3, y * 1.7, z * 1.7, 6);
  const map = sphereTexture(512, 256, (x, y, z, lat) => {
    const h = land(x, y, z), ice = Math.abs(lat) > 1.2 + 0.15 * (fbm(x * 4, y * 4, z * 4, 3) - 0.5);
    if (ice) return [236, 242, 248];
    if (h < 0.53) { const deep = smooth(0.53, 0.35, h); return mix([40, 110, 170], [10, 38, 92], deep); }
    const dry = smooth(0.3, 0.0, Math.abs(lat) - 0.35) * smooth(0.55, 0.7, fbm(x * 3, y * 3, z * 3, 4));
    return mix(mix([64, 118, 52], [120, 140, 70], (h - 0.53) * 6), [196, 168, 112], dry);
  });
  const rough = sphereTexture(256, 128, (x, y, z) => { const v = land(x, y, z) < 0.53 ? 70 : 230; return [v, v, v]; }, false);
  const clouds = sphereTexture(512, 256, (x, y, z) => { const c = smooth(0.58, 0.8, fbm(x * 3 + 9, y * 6, z * 3, 6)) * 0.9; const v = Math.round(255 * c); return [v, v, v]; }, false);
  return (earthTex = { map, rough, clouds });
}
let moonTex;
function moonTexture() {
  if (moonTex) return moonTex;
  const r = rng(7), craters = Array.from({ length: 90 }, () => { const u = r() * 2 - 1, a = r() * TAU, s = Math.sqrt(1 - u * u); return [s * Math.cos(a), u, s * Math.sin(a), 0.03 + r() ** 3 * 0.25]; });
  return (moonTex = sphereTexture(512, 256, (x, y, z) => {
    let v = 150 + 70 * (fbm(x * 4, y * 4, z * 4, 6) - 0.5);
    v -= 55 * smooth(0.45, 0.62, fbm(x * 1.3 + 5, y * 1.3, z * 1.3, 4)); // the dark maria
    for (const [cx, cy, cz, cr] of craters) {
      const d = Math.acos(Math.min(1, x * cx + y * cy + z * cz)) / cr;
      if (d < 1.25) v += d < 1 ? -26 * (1 - d * d) : 30 * (1.25 - d) * 4 * (d - 1);
    }
    return [v, v, v * 0.98];
  }));
}

const MODELS = {
  jupiter() {
    const map = sphereTexture(512, 256, (x, y, z, lat, lon) => {
      const warp = fbm(x * 3, y * 3, z * 3, 5) - 0.5;
      const band = Math.sin(lat * 14 + warp * 3.2 + fbm(x * 9, y * 22, z * 9, 3) * 0.8);
      let c = mix([222, 196, 160], [150, 96, 62], band * 0.5 + 0.5);
      c = mix(c, [240, 226, 205], smooth(0.2, 0.0, Math.abs(lat)) * 0.6);
      const d = Math.hypot((lat + 0.39) / 0.075, ((lon - 2.4 + Math.PI) % TAU - Math.PI) / 0.16); // the Great Red Spot
      return mix(c, [196, 92, 60], smooth(1.1, 0.5, d + warp * 0.6));
    });
    return planet(map, { oblate: 0.935, tilt: 0.05, spin: 0.25 });
  },
  neptune() {
    const map = sphereTexture(512, 256, (x, y, z, lat) => {
      const band = Math.sin(lat * 9 + (fbm(x * 3, y * 3, z * 3, 4) - 0.5) * 3);
      const c = mix([86, 128, 214], [44, 76, 170], band * 0.5 + 0.5);
      return mix(c, [210, 230, 255], smooth(0.72, 0.85, fbm(x * 5, y * 12, z * 5, 4)) * 0.8);
    });
    return planet(map, { tilt: 0.49, spin: 0.2, atmosphere: '#7fb2ff' });
  },
  earth() {
    const { map, rough, clouds } = earthTextures();
    return planet(map, { roughness: 1, roughnessMap: rough, tilt: 0.41, spin: 0.15, atmosphere: '#6fb6ff', clouds });
  },
  moon() { const m = moonTexture(); return planet(m, { bump: m, tilt: 0.03, spin: 0.08 }); },

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

  everest() {
    const S = 140, size = 2.0, g = new THREE.PlaneGeometry(size, size, S, S);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, col = [];
    let max = 0;
    const height = (x, z) => {
      const r = Math.hypot(x * 1.2, z);
      const ridge = 1 - Math.abs(fbm(x * 2.2 + 4, 0, z * 2.2, 5) * 2 - 1);
      return Math.exp(-r * r * 2.2) * (0.75 + 0.35 * ridge) + 0.18 * ridge * Math.exp(-r * r * 0.7) - 0.04 * r;
    };
    for (let i = 0; i < p.count; i++) { const h = height(p.getX(i), p.getZ(i)); p.setY(i, h); max = Math.max(max, h); }
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) / max);
    g.computeVertexNormals();
    const n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      const h = p.getY(i), steep = 1 - n.getY(i), x = p.getX(i), z = p.getZ(i);
      const snow = smooth(0.42, 0.55, h + 0.12 * (fbm(x * 8, h * 3, z * 8, 3) - 0.5)) * smooth(0.5, 0.25, steep);
      const rock = mix([0.2, 0.19, 0.21], [0.36, 0.32, 0.29], fbm(x * 6, h * 4, z * 6, 3));
      const c = mix(mix(rock, [0.2, 0.24, 0.18], smooth(0.12, 0.0, h)), [0.78, 0.82, 0.88], snow);
      col.push(...lin(c));
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    // Fade the square edges of the terrain into the dark.
    const fade = canvasTexture(128, 128, (ctx) => { const gr = ctx.createRadialGradient(64, 64, 30, 64, 64, 64); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#000'); ctx.fillStyle = gr; ctx.fillRect(0, 0, 128, 128); }, false);
    const land = new THREE.Mesh(g, std(0xffffff, { vertexColors: true, roughness: 0.95, alphaMap: fade, transparent: true }));
    land.position.y = -0.5;
    const inner = new THREE.Group(); inner.add(land);
    // A plume of snow blown off the summit, the way the jet stream does.
    const r = rng(3), plume = [];
    for (let i = 0; i < 260; i++) { const k = r(); plume.push(0.05 + k * 0.7, 0.45 - k * 0.12 + (r() - 0.5) * 0.08 * (1 + k * 2), (r() - 0.5) * 0.1 * (1 + k * 3)); }
    const snow = sparks(plume, 0xeaf2ff, 0.025, { opacity: 0.12 });
    inner.add(snow);
    const holder = new THREE.Group(); holder.rotation.x = 0.32; holder.add(inner);
    return { obj: holder, update: (t) => { inner.rotation.y = Math.sin(t * 0.15) * 0.6 + 0.3; snow.position.x = (t * 0.02) % 0.1; snow.material.opacity = 0.1 + 0.04 * Math.sin(t * 1.3); } };
  },

  burj() {
    const g = new THREE.Group();
    // Three wings round a core, stepping back as the tower rises.
    const windows = canvasTexture(64, 256, (ctx) => {
      ctx.fillStyle = '#20283a'; ctx.fillRect(0, 0, 64, 256);
      for (let y = 0; y < 256; y += 4) for (let x = 0; x < 64; x += 4) { const on = hash(x, y, 1) > 0.72; ctx.fillStyle = on ? `rgba(255,214,150,${0.5 + hash(x, y, 2) * 0.5})` : '#3a4a66'; ctx.fillRect(x + 1, y + 1, 2, 2); }
    });
    windows.wrapS = windows.wrapT = THREE.RepeatWrapping;
    const glass = phys(0x9fb4cc, { metalness: 0.85, roughness: 0.18, emissive: 0xffffff, emissiveMap: windows, emissiveIntensity: 0.55, clearcoat: 1, envMapIntensity: 1.2 });
    const tiers = 14, H = 0.78;
    for (let i = 0; i < tiers; i++) {
      const y0 = (i / tiers) * H, h = H / tiers + 0.002, s = 0.16 * (1 - i / tiers * 0.82);
      const shape = new THREE.Shape();
      for (let k = 0; k <= 96; k++) {
        const a = (k / 96) * TAU, r = s * (0.45 + 0.55 * Math.abs(Math.cos((3 * a) / 2)) ** 3);
        k ? shape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 48 });
      geo.rotateX(-Math.PI / 2); geo.translate(0, y0, 0);
      g.add(new THREE.Mesh(geo, glass));
    }
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.018, 1 - H, 12), phys(0xc8d4e4, { metalness: 1, roughness: 0.15 }));
    spire.position.y = H + (1 - H) / 2; g.add(spire);
    const beacon = sparks([0, 1, 0], 0xff3a2a, 0.06);
    g.add(beacon);
    g.position.y = -0.5;
    const holder = new THREE.Group(); holder.rotation.x = 0.12; holder.add(g);
    return { obj: holder, update: t => { g.rotation.y = t * 0.2; beacon.material.opacity = (t % 1.5) < 0.18 ? 1 : 0.08; } };
  },

  eiffel() {
    const g = new THREE.Group();
    // Half the width of the tower at each height (0 at the ground, 1 at the top), from its 125 m base.
    const half = y => 0.19 * Math.exp(-3.3 * y) * (1 - y) + 0.012;
    const corners = (y) => [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([a, b]) => V(a * half(y), y, b * half(y)));
    const iron = phys(0xb3865a, { metalness: 0.7, roughness: 0.45 });
    // The four legs.
    for (let c = 0; c < 4; c++) {
      const pts = []; for (let i = 0; i <= 24; i++) pts.push(corners((i / 24) * 0.96)[c]);
      g.add(tube(pts, 0.011, iron, 48, 6));
    }
    // Lattice: crossed bracing on every face, finer towards the top.
    const seg = [];
    const levels = []; for (let y = 0; y < 0.95; y += 0.012 + y * 0.03) levels.push(y);
    for (let i = 0; i < levels.length - 1; i++) {
      const a = corners(levels[i]), b = corners(levels[i + 1]);
      for (let c = 0; c < 4; c++) { const d = (c + 1) % 4; seg.push(a[c], b[d], a[d], b[c], a[c], a[d]); }
    }
    const lattice = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg), new THREE.LineBasicMaterial({ color: 0xd8a870, transparent: true, opacity: 0.75 }));
    g.add(lattice);
    // The three platforms and the arches between the legs.
    for (const [y, t] of [[0.17, 0.018], [0.35, 0.014], [0.84, 0.01]]) {
      const w = half(y) * 2 + 0.03, deck = new THREE.Mesh(new THREE.BoxGeometry(w, t, w), iron);
      deck.position.y = y; g.add(deck);
    }
    for (let c = 0; c < 4; c++) {
      const a = corners(0.02)[c], b = corners(0.02)[(c + 1) % 4], m = a.clone().add(b).multiplyScalar(0.5);
      const top = corners(0.155)[c].clone().add(corners(0.155)[(c + 1) % 4]).multiplyScalar(0.5);
      g.add(tube([a.clone().lerp(corners(0.1)[c], 0.6), m.clone().setY(top.y - 0.012), b.clone().lerp(corners(0.1)[(c + 1) % 4], 0.6)], 0.006, iron, 24, 5));
    }
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.008, 0.06, 8), iron);
    mast.position.y = 0.98; g.add(mast);
    // The lights that sparkle for five minutes every hour after dark.
    const r = rng(11), pos = [];
    for (let i = 0; i < 700; i++) { const y = r() ** 1.3 * 0.95, c = corners(y), k = Math.floor(r() * 4), p = c[k].clone().lerp(c[(k + 1) % 4], r()); pos.push(p.x, p.y, p.z); }
    const lights = sparks(pos, 0xffffff, 0.012, { colours: pos.map(() => 1) });
    g.add(lights);
    const beam = sparks([0, 1.0, 0], 0xfff2c0, 0.09);
    g.add(beam);
    g.position.y = -0.5;
    const holder = new THREE.Group(); holder.rotation.x = 0.1; holder.add(g);
    const col = lights.geometry.attributes.color;
    return { obj: holder, update: t => {
      g.rotation.y = t * 0.18;
      for (let i = 0; i < col.count; i++) { const v = hash(i, Math.floor(t * 9), 5) > 0.88 ? 1 : 0.04; col.setXYZ(i, v, v * 0.95, v * 0.8); }
      col.needsUpdate = true;
      beam.material.opacity = 0.6 + 0.4 * Math.sin(t * 2);
    } };
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

  whale() {
    // The body as a solid of revolution along x, nose at +0.5, then flattened a little.
    const prof = [];
    for (let i = 0; i <= 40; i++) {
      const u = i / 40, x = -0.5 + u * 0.92;
      const r = 0.075 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.62)), 0.9) * (u > 0.85 ? 1 - (u - 0.85) * 2.2 : 1) + 0.004;
      prof.push(new THREE.Vector2(Math.max(0.002, r), x));
    }
    prof.push(new THREE.Vector2(0.001, 0.43));
    const geo = new THREE.LatheGeometry(prof, 48);
    geo.rotateZ(-Math.PI / 2);
    geo.scale(1, 0.85, 1);
    const p = geo.attributes.position, col = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const belly = smooth(0.0, -0.04, y) * (x > -0.1 ? 1 : 0.3);
      const mottle = fbm(x * 40, y * 40, z * 40, 3);
      const grooves = belly * (0.5 + 0.5 * Math.sin(z * 900)) * smooth(-0.15, 0.2, x);
      col.push(...lin(mix(mix([0.27, 0.36, 0.46], [0.4, 0.48, 0.58], mottle), [0.68, 0.72, 0.78], belly * 0.7 - grooves * 0.15)));
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const skin = phys(0xffffff, { vertexColors: true, roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.4 });
    const body = new THREE.Mesh(geo, skin);
    const rest = Float32Array.from(p.array);
    const fluke = new THREE.Shape();
    fluke.moveTo(0, 0); fluke.bezierCurveTo(-0.02, 0.04, -0.06, 0.09, -0.09, 0.11); fluke.bezierCurveTo(-0.07, 0.06, -0.06, 0.02, -0.065, 0);
    fluke.bezierCurveTo(-0.06, -0.02, -0.07, -0.06, -0.09, -0.11); fluke.bezierCurveTo(-0.06, -0.09, -0.02, -0.04, 0, 0);
    const tail = new THREE.Mesh(new THREE.ExtrudeGeometry(fluke, { depth: 0.006, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2 }), skin);
    tail.geometry.rotateX(Math.PI / 2); tail.geometry.translate(0, 0.003, 0);
    const tailPivot = new THREE.Group(); tailPivot.position.x = -0.45; tailPivot.add(tail);
    const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.quadraticCurveTo(-0.03, 0.02, -0.12, 0.012); fin.quadraticCurveTo(-0.04, -0.006, 0, -0.01);
    const fins = new THREE.Group();
    for (const s of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.ExtrudeGeometry(fin, { depth: 0.004, bevelEnabled: false }), skin);
      f.rotation.set(Math.PI / 2 - s * 0.5, 0, s * 0.3); f.position.set(0.22, -0.035, s * 0.06); fins.add(f);
    }
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 6), std(0x0a0a0a, { roughness: 0.1 }));
    eye.position.set(0.33, -0.012, 0.052);
    const whale = new THREE.Group(); whale.add(body, tailPivot, fins, eye);
    // Bubbles rising from the blowhole.
    const r = rng(5), bub = []; for (let i = 0; i < 40; i++) bub.push(0.3 + (r() - 0.5) * 0.06, r() * 0.4, (r() - 0.5) * 0.05);
    const bubbles = sparks(bub, 0xbfe4ff, 0.012, { opacity: 0.7 });
    const g = new THREE.Group(); g.add(whale, bubbles);
    return { obj: g, update: t => {
      const w = Math.sin(t * 1.6);
      for (let i = 0; i < p.count; i++) { const x = rest[i * 3], k = smooth(0.1, -0.5, x); p.setY(i, rest[i * 3 + 1] + w * 0.05 * k * k); }
      p.needsUpdate = true; body.geometry.computeVertexNormals();
      tailPivot.position.y = w * 0.05 * 0.95; tailPivot.rotation.z = -w * 0.35;
      whale.rotation.set(0.15 + w * 0.03, Math.sin(t * 0.25) * 0.6 - 0.35, 0);
      const b = bubbles.geometry.attributes.position;
      for (let i = 0; i < b.count; i++) b.setY(i, ((bub[i * 3 + 1] + t * 0.08) % 0.4) + 0.04);
      b.needsUpdate = true;
    } };
  },

  bus() {
    const L = 1, H = 4.4 / 11.2, W = 2.55 / 11.2;
    const g = new THREE.Group();
    const paint = phys(0xc8212e, { roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
    const body = new THREE.Mesh(new RoundedBoxGeometry(L, H * 0.86, W, 4, 0.025), paint);
    body.position.y = H * 0.07 + 0.035; g.add(body);
    // Two decks of windows, lit inside.
    const glass = phys(0x0a0e16, { roughness: 0.05, metalness: 0.2, clearcoat: 1, emissive: 0xffd9a0, emissiveIntensity: 0.08 });
    for (const y of [H * 0.27, H * 0.62]) for (const z of [-1, 1]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(L * 0.9, H * 0.17, 0.004), glass);
      win.position.set(-0.02, y, z * (W / 2 + 0.001)); g.add(win);
    }
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.004, H * 0.5, W * 0.84), glass);
    front.position.set(L / 2 + 0.001, H * 0.45, 0); g.add(front);
    const blind = new THREE.Mesh(new THREE.BoxGeometry(0.005, H * 0.06, W * 0.6), std(0x111111, { emissive: 0xffb84a, emissiveIntensity: 1.4 }));
    blind.position.set(L / 2 + 0.003, H * 0.73, 0); g.add(blind);
    for (const z of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), std(0xffffff, { emissive: 0xfff3d0, emissiveIntensity: 2.5 }));
      lamp.position.set(L / 2, 0.06, z * W * 0.36); g.add(lamp);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.03, 0.02), std(0x400000, { emissive: 0xff2020, emissiveIntensity: 1.6 }));
      tail.position.set(-L / 2 - 0.001, 0.08, z * W * 0.4); g.add(tail);
    }
    const wheels = [];
    const tyre = std(0x111216, { roughness: 0.8 }), hub = phys(0xc0c6d0, { metalness: 1, roughness: 0.25 });
    for (const x of [-0.3, 0.32]) for (const z of [-1, 1]) {
      const w = new THREE.Group();
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 24), tyre); t.rotation.x = Math.PI / 2; w.add(t);
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.032, 6), hub); h.rotation.x = Math.PI / 2; w.add(h);
      w.position.set(x, 0.05, z * (W / 2 - 0.01)); g.add(w); wheels.push(w);
    }
    g.position.y = -H / 2;
    const holder = new THREE.Group(); holder.rotation.x = 0.18; holder.add(g);
    return { obj: holder, update: t => {
      g.rotation.y = Math.sin(t * 0.3) * 0.5 - 0.45;
      for (const w of wheels) w.rotation.z = -t * 3;
      body.position.y = H * 0.07 + 0.035 + Math.sin(t * 9) * 0.0015;
    } };
  },

  person() {
    const g = new THREE.Group();
    const skin = phys(0xd9b49a, { roughness: 0.55, sheen: 0.4 }), shirt = phys(0x3f6fb5, { roughness: 0.8, sheen: 1, sheenColor: 0x88aaff }), trousers = phys(0x2b3140, { roughness: 0.85 });
    const limb = (r, len, mat, x, y, z = 0) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 16), mat); m.position.set(x, y, z); return m; };
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.065, 32, 24), skin); head.scale.set(0.9, 1.08, 0.95); head.position.y = 0.43;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.068, 32, 16, 0, TAU, 0, Math.PI * 0.55), phys(0x3a2618, { roughness: 0.6, sheen: 1 }));
    hair.position.y = 0.445; hair.rotation.x = -0.2;
    const neck = limb(0.025, 0.03, skin, 0, 0.35);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.22, 8, 20), shirt); torso.scale.z = 0.55; torso.position.y = 0.18;
    const hips = limb(0.09, 0.04, trousers, 0, 0.0); hips.scale.z = 0.6;
    const legs = [-1, 1].map(s => { const p = new THREE.Group(); p.position.set(s * 0.05, 0.01, 0); const l = limb(0.042, 0.4, trousers, 0, -0.23); p.add(l); const foot = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.035, 0.12, 2, 0.015), std(0x1d1f24)); foot.position.set(0, -0.48, 0.025); p.add(foot); return p; });
    const arms = [-1, 1].map(s => { const p = new THREE.Group(); p.position.set(s * 0.125, 0.3, 0); p.rotation.z = s * 0.12; p.add(limb(0.033, 0.2, shirt, 0, -0.11)); const fore = limb(0.028, 0.18, skin, 0, -0.33); p.add(fore); return p; });
    g.add(head, hair, neck, torso, hips, ...legs, ...arms);
    const holder = new THREE.Group(); holder.add(g);
    return { obj: holder, update: t => {
      g.rotation.y = Math.sin(t * 0.3) * 0.8;
      const b = Math.sin(t * 1.6);
      torso.scale.x = 1 + b * 0.012; arms.forEach((a, i) => { a.rotation.x = Math.sin(t * 0.8 + i * Math.PI) * 0.08; });
      head.rotation.y = Math.sin(t * 0.5) * 0.25;
    } };
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
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.43, 0.94), std(0x000000, { emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: 1.1, roughness: 0.05 }));
    screen.position.z = 0.0281; g.add(screen);
    const cover = new THREE.Mesh(new THREE.PlaneGeometry(0.43, 0.94), phys(0x000000, { transparent: true, opacity: 0.25, roughness: 0, clearcoat: 1 }));
    cover.position.z = 0.0285; g.add(cover);
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

  ant() {
    const g = new THREE.Group();
    const shell = phys(0x2a1810, { roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15, sheen: 0.3 });
    const seg = (rx, ry, rz, x, y = 0) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), shell); m.scale.set(rx, ry, rz); m.position.set(x, y, 0); g.add(m); return m; };
    seg(0.2, 0.13, 0.14, -0.29, 0.02); // gaster
    seg(0.04, 0.05, 0.035, -0.09, 0.0); // petiole
    seg(0.15, 0.065, 0.065, 0.04, 0.02); // thorax
    const head = seg(0.1, 0.085, 0.09, 0.27, 0.05);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), phys(0x050505, { roughness: 0.05, clearcoat: 1 }));
      eye.position.set(0.3, 0.08, s * 0.07); g.add(eye);
      g.add(tube([V(0.33, 0.09, s * 0.03), V(0.38, 0.22, s * 0.09), V(0.52, 0.2, s * 0.16), V(0.6, 0.12, s * 0.2)], 0.007, shell, 20, 5));
    }
    const legs = [];
    for (const s of [-1, 1]) for (const [i, x] of [-0.03, 0.04, 0.11].entries()) {
      const leg = new THREE.Group(); leg.position.set(x, -0.01, s * 0.04);
      leg.add(tube([V(0, 0, 0), V((i - 1) * 0.08, 0.1, s * 0.16), V((i - 1) * 0.16, -0.12, s * 0.3)], 0.008, shell, 16, 5));
      g.add(leg); legs.push({ leg, phase: (i % 2 === 0 ? 0 : Math.PI) + (s > 0 ? Math.PI : 0) });
    }
    g.position.y = 0.06;
    const holder = new THREE.Group(); holder.rotation.x = 0.4; holder.add(g);
    return { obj: holder, update: t => {
      for (const { leg, phase } of legs) { leg.rotation.y = Math.sin(t * 8 + phase) * 0.3; leg.rotation.x = Math.max(0, Math.sin(t * 8 + phase + 1.57)) * 0.15 * Math.sign(leg.position.z); }
      head.rotation.z = Math.sin(t * 2) * 0.1; g.rotation.y = Math.sin(t * 0.3) * 0.7 - 0.3;
    } };
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

  bloodCell() {
    // The resting red cell's biconcave outline (Evans and Fung), as a solid of revolution.
    const prof = [];
    for (let i = 0; i <= 48; i++) { const r = (i / 48) * 0.5, x = r / 0.5, z = 0.5 * Math.sqrt(Math.max(0, 1 - x * x)) * (0.0518 + 2.0026 * x * x - 1.1214 * x ** 4) * 0.6; prof.push(new THREE.Vector2(r, z)); }
    for (let i = 47; i >= 0; i--) prof.push(new THREE.Vector2(prof[i].x, -prof[i].y));
    const geo = new THREE.LatheGeometry(prof.map(v => new THREE.Vector2(Math.max(v.x, 0.0001), v.y)), 72);
    const cell = new THREE.Mesh(geo, phys(0xc4202a, { roughness: 0.45, sheen: 1, sheenColor: 0xff8080, clearcoat: 0.3, emissive: 0x3a0000 }));
    const g = new THREE.Group(); g.add(cell);
    // Two more behind, out of focus.
    for (const [x, y, z, s] of [[-0.7, 0.35, -0.8, 0.8], [0.75, -0.3, -1.1, 0.7]]) { const c = cell.clone(); c.material = cell.material.clone(); c.material.transparent = true; c.material.opacity = 0.35; c.position.set(x, y, z); c.scale.setScalar(s); g.add(c); }
    return { obj: g, update: t => { g.children.forEach((c, i) => c.rotation.set(0.75 + Math.sin(t * 0.4 + i) * 0.35, 0, Math.sin(t * 0.3 + i) * 0.3)); } };
  },

  bacterium() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.7, 12, 32), phys(0x7fbf6a, { roughness: 0.3, transmission: 0.4, thickness: 0.2, transparent: true, opacity: 0.92, sheen: 1, sheenColor: 0xd0ffc0, clearcoat: 0.4 }));
    body.rotation.z = Math.PI / 2; g.add(body);
    g.add(glowShell(new THREE.CapsuleGeometry(0.155, 0.7, 12, 32).rotateZ(Math.PI / 2), '#b6ff9a', { power: 2.5, strength: 0.7 }));
    const r = rng(4), dna = [];
    for (let i = 0; i < 260; i++) { const a = r() * TAU, u = r(); dna.push((u - 0.5) * 0.6, Math.cos(a) * 0.08 * r(), Math.sin(a) * 0.08 * r()); }
    g.add(sparks(dna, 0x2f6a3a, 0.03, { opacity: 0.8 }));
    // Pili: short hairs all over.
    const seg = [];
    for (let i = 0; i < 90; i++) { const x = (r() - 0.5) * 0.8, a = r() * TAU, n = V(0, Math.cos(a), Math.sin(a)); const p0 = V(x, 0, 0).addScaledVector(n, 0.15), p1 = p0.clone().addScaledVector(n, 0.04 + r() * 0.03); seg.push(p0, p1); }
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg), new THREE.LineBasicMaterial({ color: 0xa8e090, transparent: true, opacity: 0.6 })));
    // Flagella: corkscrews that turn and push it along.
    const flag = new THREE.Group(); flag.position.x = -0.5; g.add(flag);
    for (const k of [0, 1]) {
      const pts = []; for (let i = 0; i <= 80; i++) { const u = i / 80; pts.push(V(-u * 1.1, Math.cos(u * 22 + k * 2) * 0.04 * Math.min(1, u * 6) + (k - 0.5) * 0.04, Math.sin(u * 22 + k * 2) * 0.04 * Math.min(1, u * 6))); }
      flag.add(tube(pts, 0.006, std(0x9fd08a, { roughness: 0.5 }), 160, 5));
    }
    const holder = new THREE.Group(); holder.add(g);
    return { obj: holder, update: t => { flag.rotation.x = t * 8; g.rotation.set(Math.sin(t * 0.4) * 0.3, Math.sin(t * 0.25) * 0.5, Math.sin(t * 0.3) * 0.15); g.position.x = Math.sin(t * 0.7) * 0.03; } };
  },

  mimivirus() {
    const g = new THREE.Group();
    const capsid = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), phys(0x6f8f5a, { roughness: 0.35, flatShading: true, clearcoat: 0.5, emissive: 0x18240f }));
    g.add(capsid);
    // A dense coat of fibres, about 125 nm long on a 400 nm capsid.
    const r = rng(8), fibres = [];
    for (let i = 0; i < 1400; i++) { const d = V(r() - 0.5, r() - 0.5, r() - 0.5).normalize(); const a = d.clone().multiplyScalar(0.3 + 0.02 * r()), b = d.clone().multiplyScalar(0.46 + 0.04 * r()).add(V(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.03)); fibres.push(a, b); }
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(fibres), new THREE.LineBasicMaterial({ color: 0xc8e0a0, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending })));
    g.add(glowShell(new THREE.SphereGeometry(0.47, 48, 32), '#b9e08a', { power: 2.2, strength: 0.8 }));
    // The 'stargate' at one vertex, where the genome leaves.
    const star = sparks([0, 0.34, 0], 0xfff2a0, 0.12); g.add(star);
    return { obj: g, update: t => { g.rotation.set(t * 0.15, t * 0.25, 0); star.material.opacity = 0.6 + 0.4 * Math.sin(t * 2.5); } };
  },

  flu() {
    const g = new THREE.Group();
    const envelope = new THREE.Mesh(lumpy(0.36, 0.04, 2.5, 6), phys(0x8a63b8, { roughness: 0.5, sheen: 1, sheenColor: 0xd8b8ff, emissive: 0x1a0d2a }));
    g.add(envelope);
    // Haemagglutinin rods and neuraminidase mushrooms, the H and N of a flu strain's name.
    const r = rng(12), n = 260;
    const ha = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.016, 0.12, 6).translate(0, 0.06, 0), phys(0x5ad6c0, { roughness: 0.4, emissive: 0x0a3a30 }), n);
    const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.026, 10, 8).translate(0, 0.125, 0), phys(0xff7ab8, { roughness: 0.35, emissive: 0x3a0a20 }), n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = V(0, 1, 0);
    for (let i = 0; i < n; i++) {
      const y = 1 - (i + 0.5) / n * 2, rad = Math.sqrt(1 - y * y), a = i * 2.39996 + r() * 0.2, d = V(Math.cos(a) * rad, y, Math.sin(a) * rad);
      q.setFromUnitVectors(up, d); m.compose(d.clone().multiplyScalar(0.35), q, V(1, 1, 1));
      ha.setMatrixAt(i, m); head.setMatrixAt(i, i % 5 === 0 ? m : m.clone().scale(V(0.75, 1, 0.75)));
    }
    g.add(ha, head, glowShell(new THREE.SphereGeometry(0.5, 48, 32), '#c9a0ff', { power: 2, strength: 0.6 }));
    return { obj: g, update: t => g.rotation.set(t * 0.12, t * 0.22, 0) };
  },

  ribosome() {
    const g = new THREE.Group();
    const large = new THREE.Mesh(lumpy(0.3, 0.14, 2.2, 1), phys(0xc48a42, { roughness: 0.6 }));
    large.position.y = 0.06; large.scale.set(1.25, 1, 1.05);
    const small = new THREE.Mesh(lumpy(0.22, 0.15, 2.6, 2), phys(0xd8b878, { roughness: 0.6 }));
    small.position.set(0.02, -0.27, 0.02); small.scale.set(1.3, 0.75, 1);
    g.add(large, small);
    // The messenger RNA threading through, and the new protein chain coming out of the top.
    const mrna = tube([V(-0.8, -0.24, 0.1), V(-0.4, -0.2, 0.15), V(0, -0.2, 0.12), V(0.4, -0.22, 0.1), V(0.8, -0.18, 0.05)], 0.012, std(0x7cc4ff, { emissive: 0x1a4a7a, emissiveIntensity: 1.2 }), 64, 6);
    const chainPts = []; for (let i = 0; i <= 60; i++) { const u = i / 60; chainPts.push(V(Math.sin(u * 9) * 0.08 * u + 0.05, 0.3 + u * 0.55, Math.cos(u * 7) * 0.08 * u)); }
    const chain = tube(chainPts, 0.016, std(0xff8a5c, { emissive: 0x6a2010, emissiveIntensity: 1.4 }), 120, 6);
    g.add(mrna, chain);
    const count = chain.geometry.index.count;
    return { obj: g, update: t => {
      g.rotation.y = t * 0.25; mrna.position.x = ((t * 0.05) % 0.2) - 0.1;
      chain.geometry.setDrawRange(0, Math.floor(count * (0.15 + 0.85 * ((t * 0.08) % 1)) / 6) * 6);
    } };
  },

  haemoglobin() {
    const g = new THREE.Group();
    const heme = std(0x5a0a10, { emissive: 0xff3020, emissiveIntensity: 0.5, roughness: 0.3 });
    const iron = [];
    [[-1, 1, 1, 0xd65a5a], [1, -1, 1, 0xc04a6a], [-1, -1, -1, 0xc04a6a], [1, 1, -1, 0xd65a5a]].forEach(([x, y, z, c], i) => {
      const sub = new THREE.Mesh(lumpy(0.26, 0.12, 2.4, i * 3), phys(c, { roughness: 0.5, sheen: 0.8, sheenColor: 0xffc0c0 }));
      sub.position.set(x * 0.15, y * 0.15, z * 0.15); g.add(sub);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.01, 24), heme);
      const out = V(x, y, z).normalize();
      disc.position.copy(sub.position).addScaledVector(out, 0.2); disc.lookAt(disc.position.clone().add(out)); disc.rotateX(Math.PI / 2);
      g.add(disc); iron.push(disc.position.clone().addScaledVector(out, 0.012));
    });
    // The iron at the centre of each haem, where oxygen binds.
    const fe = sparks(iron.flatMap(v => [v.x, v.y, v.z]), 0xffa060, 0.1);
    g.add(fe);
    const holder = new THREE.Group(); holder.add(g);
    return { obj: holder, update: t => { g.rotation.set(t * 0.1, t * 0.2, 0); g.scale.setScalar(1 + Math.sin(t * 1.2) * 0.015); fe.material.opacity = 0.5 + 0.5 * Math.sin(t * 1.2); } };
  },

  // DNA lying across, measured through its 2 nm width. A turn every 3.4 nm; the strands are offset, which
  // makes the major and minor grooves.
  dna() {
    const g = new THREE.Group(), len = 3.4, turn = 1.7, R = 0.42, offset = 2.4;
    const strand = (ph, colour) => { const pts = []; for (let i = 0; i <= 220; i++) { const x = -len / 2 + (i / 220) * len, a = (x / turn) * TAU + ph; pts.push(V(x, Math.cos(a) * R, Math.sin(a) * R)); } return tube(pts, 0.06, phys(colour, { roughness: 0.3, clearcoat: 0.6, emissive: colour, emissiveIntensity: 0.05 }), 440, 8); };
    g.add(strand(0, 0x7cc4ff), strand(offset, 0xe58cff));
    const pairs = Math.round((len / turn) * 10.5), cols = [0xff6b6b, 0xffd166, 0x06d6a0, 0x4cc9f0];
    const rung = new THREE.CylinderGeometry(0.035, 0.035, 1, 8);
    for (let i = 0; i < pairs; i++) {
      const x = -len / 2 + ((i + 0.5) / pairs) * len, a = (x / turn) * TAU;
      const p = V(x, Math.cos(a) * R, Math.sin(a) * R), q = V(x, Math.cos(a + offset) * R, Math.sin(a + offset) * R), mid = p.clone().lerp(q, 0.5);
      const k = Math.floor(hash(i, 3, 3) * 4);
      for (const [from, c] of [[p, cols[k]], [q, cols[3 - k]]]) {
        const m = new THREE.Mesh(rung, std(c, { roughness: 0.5, emissive: c, emissiveIntensity: 0.08 }));
        m.position.copy(from).lerp(mid, 0.5); m.scale.y = from.distanceTo(mid); m.quaternion.setFromUnitVectors(V(0, 1, 0), mid.clone().sub(from).normalize());
        g.add(m);
      }
    }
    const holder = new THREE.Group(); holder.add(g);
    return { obj: holder, update: t => { g.rotation.x = t * 0.5; holder.rotation.y = Math.sin(t * 0.3) * 0.3; } };
  },

  water() {
    const g = new THREE.Group(), angle = (104.5 / 180) * Math.PI, bond = 0.32;
    const o = new THREE.Mesh(new THREE.SphereGeometry(0.3, 48, 32), phys(0xe2483f, { roughness: 0.2, clearcoat: 1 }));
    const hs = [-1, 1].map(s => { const h = new THREE.Mesh(new THREE.SphereGeometry(0.2, 48, 32), phys(0xd8dce4, { roughness: 0.3, clearcoat: 0.6 })); h.position.set(Math.sin(angle / 2) * bond * s, -Math.cos(angle / 2) * bond, 0); return h; });
    g.add(o, ...hs);
    g.add(glowShell(new THREE.SphereGeometry(0.4, 48, 32), '#ff9a8a', { power: 2.5, strength: 0.5 }));
    for (const h of hs) { const s = glowShell(new THREE.SphereGeometry(0.26, 32, 24), '#9ac4ff', { power: 3, strength: 0.3 }); s.position.copy(h.position); g.add(s); h.userData.shell = s; }
    g.position.y = 0.08;
    const holder = new THREE.Group(); holder.add(g);
    return { obj: holder, update: t => {
      // The bending vibration, slowed down a long way.
      const a = angle / 2 + Math.sin(t * 3) * 0.06;
      hs.forEach((h, i) => { const s = i ? 1 : -1; h.position.set(Math.sin(a) * bond * s, -Math.cos(a) * bond, 0); h.userData.shell.position.copy(h.position); });
      g.rotation.y = Math.sin(t * 0.35) * 1.1;
    } };
  },

  hydrogen() {
    // The electron in its lowest state: a cloud, densest at the centre, sampled at random each frame.
    const n = 2600, pos = new Float32Array(n * 3);
    const a0 = 0.25; // so that two Bohr radii, the atom's usual quoted size, is one unit
    const sample = (r, i) => {
      const rad = -a0 / 2 * Math.log(r() * r() * r()); // the 1s radial distribution is a gamma(3) in 2r/a0
      const u = r() * 2 - 1, phi = r() * TAU, s = Math.sqrt(1 - u * u);
      pos.set([s * Math.cos(phi) * rad, u * rad, s * Math.sin(phi) * rad], i * 3);
    };
    const r = rng(21); for (let i = 0; i < n; i++) sample(r, i);
    const cloud = sparks(pos, 0x7cc4ff, 0.03, { opacity: 0.22 });
    const nucleus = sparks([0, 0, 0], 0xffc070, 0.08);
    const g = new THREE.Group(); g.add(cloud, nucleus, glowShell(new THREE.SphereGeometry(0.5, 48, 32), '#4a8cff', { power: 2, strength: 0.15 }));
    let k = 0;
    return { obj: g, update: t => {
      for (let j = 0; j < 120; j++) sample(Math.random, (k = (k + 1) % n));
      cloud.geometry.attributes.position.needsUpdate = true;
      g.rotation.y = t * 0.1;
    } };
  },

  uranium() {
    // 92 protons and 146 neutrons, packed.
    const n = 238, r = rng(17), mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 14), phys(0xffffff, { roughness: 0.35, clearcoat: 0.6 }), n);
    const pts = [], m = new THREE.Matrix4(), c = new THREE.Color();
    const rad = 0.075;
    for (let i = 0; i < n; i++) { const y = 1 - (i + 0.5) / n * 2, s = Math.sqrt(1 - y * y), a = i * 2.39996, d = Math.cbrt((i + 0.5) / n) * 0.42; pts.push(V(Math.cos(a) * s * d, y * d, Math.sin(a) * s * d)); }
    pts.sort(() => r() - 0.5);
    pts.forEach((p, i) => { mesh.setColorAt(i, c.set(i < 92 ? 0xe2504a : 0x9aa6bc)); });
    const g = new THREE.Group(); g.add(mesh, glowShell(new THREE.SphereGeometry(0.52, 48, 32), '#ff7a5a', { power: 2, strength: 0.6 }));
    return { obj: g, update: t => {
      pts.forEach((p, i) => { const j = 0.008; m.makeScale(rad, rad, rad).setPosition(p.x + Math.sin(t * 7 + i) * j, p.y + Math.sin(t * 6.3 + i * 1.7) * j, p.z + Math.sin(t * 5.1 + i * 2.3) * j); mesh.setMatrixAt(i, m); });
      mesh.instanceMatrix.needsUpdate = true;
      g.rotation.y = t * 0.2;
    } };
  },

  proton() {
    const g = new THREE.Group();
    g.add(glowShell(new THREE.SphereGeometry(0.5, 48, 32), '#ff6a5a', { power: 1.6, strength: 0.7 }));
    const colours = [new THREE.Color(0xff3030), new THREE.Color(0x20c040), new THREE.Color(0x3a6aff)];
    // Two up quarks and a down quark, each carrying a colour charge they swap by exchanging gluons.
    const quarks = colours.map(c => { const q = new THREE.Mesh(new THREE.SphereGeometry(0.075, 32, 24), std(0x000000, { emissive: c.clone(), emissiveIntensity: 1.5 })); g.add(q); return q; });
    const flux = [0, 1, 2].map(() => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 40 }, () => V(0, 0, 0))), new THREE.LineBasicMaterial({ color: 0xffd080, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending })); g.add(l); return l; });
    // Quark–antiquark pairs that flicker in and out of the sea.
    const sea = sparks(new Array(60 * 3).fill(0), 0xffffff, 0.03, { colours: new Array(60 * 3).fill(1), opacity: 0.5 }); g.add(sea);
    const sp = sea.geometry.attributes.position, sc = sea.geometry.attributes.color;
    const at = [V(), V(), V()];
    return { obj: g, update: t => {
      quarks.forEach((q, i) => { const a = t * 0.6 + i * TAU / 3; q.position.set(Math.cos(a) * 0.2 + Math.sin(t * 1.7 + i) * 0.03, Math.sin(a) * 0.2, Math.sin(t * 1.3 + i * 2) * 0.12); at[i].copy(q.position); q.material.emissive.copy(colours[(i + Math.floor(t / 1.6)) % 3]); });
      flux.forEach((l, i) => {
        const a = at[i], b = at[(i + 1) % 3], p = l.geometry.attributes.position, d = b.clone().sub(a), n = V(-d.y, d.x, 0.3).normalize();
        for (let k = 0; k < 40; k++) { const u = k / 39, w = Math.sin(u * Math.PI) * Math.sin(u * 30 - t * 12) * 0.025; p.setXYZ(k, a.x + d.x * u + n.x * w, a.y + d.y * u + n.y * w, a.z + d.z * u + n.z * w); }
        p.needsUpdate = true;
      });
      for (let k = 0; k < 60; k++) {
        const life = (t * 0.9 + hash(k, 1, 1)) % 1, seed = Math.floor(t * 0.9 + hash(k, 1, 1));
        const d = V(hash(k, seed, 2) - 0.5, hash(k, seed, 3) - 0.5, hash(k, seed, 4) - 0.5).normalize().multiplyScalar(0.12 + 0.3 * hash(k, seed, 5));
        sp.setXYZ(k, d.x, d.y, d.z); const v = Math.sin(life * Math.PI) ** 2, c = colours[k % 3]; sc.setXYZ(k, c.r * v, c.g * v, c.b * v);
      }
      sp.needsUpdate = sc.needsUpdate = true;
      g.rotation.y = t * 0.15;
    } };
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
