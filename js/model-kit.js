// The pieces the 3D models are made from: noise, textures drawn in code, glows, sparks, materials and tubes.
// Shared by js/models3d.js and js/midsize.js.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const TAU = Math.PI * 2;
export const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- noise
// Value noise in 3D, summed over octaves. Deterministic, so every model looks the same each visit.
export function hash(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export function noise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const s = t => t * t * (3 - 2 * t), u = s(xf), v = s(yf), w = s(zf);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (i, j, k) => hash(xi + i, yi + j, zi + k);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
export function fbm(x, y, z, octaves = 5) {
  let sum = 0, amp = 0.5, f = 1;
  for (let i = 0; i < octaves; i++) { sum += amp * noise(x * f, y * f, z * f); f *= 2.03; amp *= 0.5; }
  return sum / (1 - 0.5 ** octaves);
}
// A seeded random sequence for placing things.
export function rng(seed) { let s = seed >>> 0; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 >>> 0) / 4294967296); }

// ---------------------------------------------------------------- textures
export function canvasTexture(w, h, paint, colour = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  paint(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  if (colour) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// Vertex colours are linear light; these helpers take the usual display (sRGB) values.
export const lin = c => c.map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
export const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.min(1, Math.max(0, t)));
export const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// A soft round dot, for glows and particles.
export let dotTexture;
export function dot() {
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
export function sparks(positions, colour, size, { colours = null, opacity = 1 } = {}) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (colours) g.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  const m = new THREE.PointsMaterial({ color: new THREE.Color(colour).multiplyScalar(2), size, map: dot(), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: !!colours, sizeAttenuation: true });
  const p = new THREE.Points(g, m);
  p.userData.base = size; // in model units; the stage scales it to the screen
  return p;
}
// A sphere pushed in and out by noise, for blobby proteins and grains.
export function lumpy(radius, amount, freq, seed = 0, detail = 4) {
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
export const std = (colour, o = {}) => new THREE.MeshStandardMaterial({ color: colour, roughness: 0.55, metalness: 0, ...o });
export const phys = (colour, o = {}) => new THREE.MeshPhysicalMaterial({ color: colour, roughness: 0.4, metalness: 0, ...o });
export function tube(points, radius, mat, segs = 64, radial = 8, closed = false) {
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed), segs, radius, radial, closed), mat);
}
// Turn about the vertical, at `speed` radians a second, with a fixed tilt towards the viewer.
export function turntable(obj, speed = 0.35, tilt = 0.25) {
  const holder = new THREE.Group(); holder.rotation.x = tilt; holder.add(obj);
  return { obj: holder, update: t => { obj.rotation.y = t * speed; } };
}

