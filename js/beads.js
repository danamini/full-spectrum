// Beads: many small spheres drawn as single points the GPU shades as balls, with true depth, so tens of
// thousands stay smooth. The way molecular illustrators draw atoms, residues and whole viruses. Each bead has a
// position, radius and colour; how buried it is among its neighbours darkens it, like ambient occlusion.
import * as THREE from 'three';

// Drawing-buffer height in pixels; the wave view sets it each frame (beads are sized from it).
export const VIEWPORT = { value: 800 };

const VERT = /* glsl */`
  in float aRadius;
  in vec3 aColor;
  in float aShade;
  uniform float uViewport;
  out vec3 vColor;
  out float vShade;
  out vec3 vCentre;
  out float vRadius;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vRadius = aRadius * length(modelViewMatrix[0].xyz);
    vCentre = mv.xyz;
    vColor = aColor;
    vShade = aShade;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = 2.0 * vRadius * projectionMatrix[1][1] * 0.5 * uViewport / -mv.z;
  }`;
const FRAG = /* glsl */`
  uniform mat4 projectionMatrix;
  uniform vec3 uLight;
  in vec3 vColor;
  in float vShade;
  in vec3 vCentre;
  in float vRadius;
  out vec4 fragColor;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    p.y = -p.y;
    float r2 = dot(p, p);
    if (r2 > 1.0) discard;
    vec3 n = vec3(p, sqrt(1.0 - r2));
    vec4 clip = projectionMatrix * vec4(vCentre + n * vRadius, 1.0);
    gl_FragDepth = clip.z / clip.w * 0.5 + 0.5;
    float diffuse = max(dot(n, uLight), 0.0);
    float sky = 0.5 + 0.5 * n.y;
    float spec = pow(max(dot(reflect(-uLight, n), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);
    vec3 c = vColor * (0.32 * sky + 0.9 * diffuse) * vShade + vec3(0.22 * spec * vShade);
    c += vColor * pow(1.0 - n.z, 3.0) * 0.25;                // a little light round the edge
    c *= mix(1.0, 0.45, smoothstep(0.78, 1.0, r2));           // and a soft dark outline, as in an illustration
    fragColor = vec4(c, 1.0);
  }`;

const material = () => new THREE.ShaderMaterial({
  glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: FRAG,
  uniforms: { uViewport: VIEWPORT, uLight: { value: new THREE.Vector3(-0.45, 0.65, 0.62).normalize() } },
});

// How buried each bead is: neighbours within reach, counted on a grid, scaled between the model's own
// quiet and crowded beads. Returns a brightness per bead, 0.45 (deep in) to 1 (on the surface).
function shade(pos, rad, reach = 2.2) {
  const n = rad.length, maxR = Math.max(...rad), cell = maxR * 2 * reach, grid = new Map(), counts = new Float32Array(n);
  const key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (let i = 0; i < n; i++) { const k = key(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); }
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2], cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
    let c = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let d = -1; d <= 1; d++) {
      for (const j of grid.get(`${cx + a},${cy + b},${cz + d}`) ?? []) {
        const dx = pos[j * 3] - x, dy = pos[j * 3 + 1] - y, dz = pos[j * 3 + 2] - z, r = (rad[i] + rad[j]) * reach;
        if (dx * dx + dy * dy + dz * dz < r * r) c++;
      }
    }
    counts[i] = c;
  }
  const sorted = Float32Array.from(counts).sort(), lo = sorted[Math.floor(n * 0.1)], hi = sorted[Math.floor(n * 0.9)] || lo + 1;
  return counts.map(c => 0.45 + 0.55 * (1 - Math.min(1, Math.max(0, (c - lo) / Math.max(1, hi - lo)))));
}

// A collector for beads: add(x, y, z, r, colour), then points() to draw them.
export class Beads {
  constructor() { this.pos = []; this.rad = []; this.col = []; }
  add(x, y, z, r, colour) { this.pos.push(x, y, z); this.rad.push(r); this.col.push(colour.r, colour.g, colour.b); return this; }
  get count() { return this.rad.length; }
  points() {
    const g = new THREE.BufferGeometry(), pos = Float32Array.from(this.pos), rad = Float32Array.from(this.rad);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aRadius', new THREE.BufferAttribute(rad, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(Float32Array.from(this.col), 3));
    g.setAttribute('aShade', new THREE.BufferAttribute(shade(pos, rad), 1));
    g.computeBoundingSphere();
    return new THREE.Points(g, material());
  }
}

// A structure from assets/molecules/ (tools/build_molecules.mjs): beads of x, y, z, radius, palette index.
export async function loadStructure(file) {
  return new Float32Array(await (await fetch(file)).arrayBuffer());
}
