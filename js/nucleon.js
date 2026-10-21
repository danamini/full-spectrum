// Molecule Viewer's subatomic pictures (https://moleculeviewer.org, js/dive.js and js/cloud.js; the same author's,
// MIT): its shimmering point clouds, a packed nucleus, and a proton.
//
// A proton as Molecule Viewer draws it: three valence quarks (two up, one down) whose colour charges keep
// swapping as they trade gluons, gluon flux tubes between them, inside a seething cloud of short-lived
// quark-antiquark pairs. Taken from Molecule Viewer (https://moleculeviewer.org, js/dive.js nucleonLevel and the
// point clouds of js/cloud.js), the same author's, MIT. Changes: only the proton, and point sizes follow the wave
// view's scale (PROJ, set by wave3d.js).
import * as THREE from 'three';

// Every point carries two sampled positions and blinks between them, so the cloud shimmers.
const VERT = /* glsl */`
  attribute vec3 aAlt;
  attribute vec3 aColor;
  attribute float aSeed;
  attribute float aSize;
  uniform float uTime, uProj, uSize, uRate;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float phase = fract(uTime * uRate + aSeed * 7.13);
    vec3 p = phase < 0.5 ? position : aAlt;
    float blink = sin(fract(phase * 2.0) * 3.14159265);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(aSize * uSize * uProj / max(-mv.z, 0.01), 1.0, 96.0);
    vColor = aColor;
    vAlpha = mix(1.0, blink, 0.85);
  }`;
const FRAG = /* glsl */`
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c);
    if (d > 0.25) discard;
    float a = exp(-d * 18.0) * vAlpha * uOpacity;
    gl_FragColor = vec4(vColor * a, a);
  }`;

// Drawing-buffer pixels per scene unit at distance 1; the wave view sets it for the scale the proton is shown at.
export const PROJ = { value: 800 };

export function cloudMaterial({ size = 0.08, rate = 0.12 } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: { uTime: { value: 0 }, uProj: PROJ, uSize: { value: size }, uRate: { value: rate }, uOpacity: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}
export function pointsFrom(buf, material) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(buf.pos, 3));
  g.setAttribute('aAlt', new THREE.Float32BufferAttribute(buf.alt, 3));
  g.setAttribute('aColor', new THREE.Float32BufferAttribute(buf.col, 3));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(buf.seed, 1));
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(buf.size, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  return new THREE.Points(g, material);
}
export const buffer = () => ({ pos: [], alt: [], col: [], seed: [], size: [] });
export function push(buf, a, b, color, size) {
  buf.pos.push(a.x, a.y, a.z); buf.alt.push(b.x, b.y, b.z); buf.col.push(color.r, color.g, color.b);
  buf.seed.push(Math.random()); buf.size.push(size);
}
export const randomDir = (v = new THREE.Vector3()) => {
  const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
  return v.set(r * Math.cos(t), r * Math.sin(t), u);
};
export const tick = (group, t) => group.traverse(o => { if (o.material?.uniforms?.uTime) o.material.uniforms.uTime.value = t; });

const QUARK_COLOURS = [0xff4060, 0x40ff8a, 0x4f8bff];
// The proton is 3.4 scene units in radius (its 0.84 fm charge radius).
export const RADIUS = 3.4;

export function proton() {
  const group = new THREE.Group();
  const quarks = ['up', 'up', 'down'].map((flavour, i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.38, 32, 20), new THREE.MeshBasicMaterial({ color: QUARK_COLOURS[i] }));
    m.userData = { flavour, phase: i * 2.094 };
    group.add(m);
    const halo = buffer(), white = new THREE.Color(1, 1, 1);
    for (let k = 0; k < 30; k++) push(halo, new THREE.Vector3(), new THREE.Vector3(), white, 9);
    const h = pointsFrom(halo, cloudMaterial({ size: 0.12, rate: 0.6 }));
    h.material.uniforms.uOpacity.value = 0.25;
    m.add(h);
    return m;
  });
  // the sea: a dense, fast-flickering cloud filling the proton
  const sea = buffer();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < 12000; i++) {
    const r = RADIUS * Math.cbrt(Math.random()) * (0.75 + 0.25 * Math.random());
    randomDir(a).multiplyScalar(r);
    randomDir(b).multiplyScalar(RADIUS * Math.cbrt(Math.random()));
    c.setHex(QUARK_COLOURS[i % 3]).lerp(new THREE.Color(0x8fa6d8), 0.45);
    push(sea, a, b, c, 0.8 + Math.random() * 0.6);
  }
  const seaPts = pointsFrom(sea, cloudMaterial({ size: 0.07, rate: 0.9 }));
  seaPts.material.uniforms.uOpacity.value = 0.32;
  group.add(seaPts);
  // gluon flux tubes between the quarks: wavy lines of points, rebuilt each frame
  const tubeCount = 3 * 120;
  const tubeGeo = new THREE.BufferGeometry();
  tubeGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(tubeCount * 3), 3));
  tubeGeo.setAttribute('aAlt', new THREE.Float32BufferAttribute(new Float32Array(tubeCount * 3), 3));
  tubeGeo.setAttribute('aColor', new THREE.Float32BufferAttribute(new Float32Array(tubeCount * 3).fill(1), 3));
  tubeGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(Float32Array.from({ length: tubeCount }, Math.random), 1));
  tubeGeo.setAttribute('aSize', new THREE.Float32BufferAttribute(new Float32Array(tubeCount).fill(2.6), 1));
  tubeGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);
  const tubes = new THREE.Points(tubeGeo, cloudMaterial({ size: 0.06, rate: 2.5 }));
  tubes.material.uniforms.uOpacity.value = 0.9;
  group.add(tubes);
  const colour = new THREE.Color(), white = new THREE.Color(1, 1, 1);
  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), pt = new THREE.Vector3();
  return {
    group,
    update: t => {
      tick(group, t);
      quarks.forEach((q, i) => {
        const ph = t * 0.55 + q.userData.phase;
        q.position.set(Math.cos(ph) * 1.5 + Math.sin(t * 1.3 + i) * 0.35, Math.sin(ph * 1.2) * 1.1, Math.sin(ph) * 1.5);
        // colour charge passes round the three: it is the swap, not any one colour, that is real
        q.material.color.setHex(QUARK_COLOURS[Math.floor(t * 0.7 + i) % 3]);
      });
      const pos = tubeGeo.attributes.position, alt = tubeGeo.attributes.aAlt, col = tubeGeo.attributes.aColor;
      for (let e = 0; e < 3; e++) {
        const A = quarks[e].position, B = quarks[(e + 1) % 3].position;
        for (let s = 0; s < 120; s++) {
          const u = s / 119, idx = e * 120 + s;
          pt.lerpVectors(A, B, u);
          const wob = Math.sin(u * Math.PI) * 0.35;
          pa.set(Math.sin(u * 19 + t * 9 + e) * wob, Math.cos(u * 23 - t * 7 + e) * wob, Math.sin(u * 17 + t * 11) * wob).add(pt);
          pb.set(Math.cos(u * 21 - t * 8) * wob, Math.sin(u * 15 + t * 10) * wob, Math.cos(u * 25 + t * 6) * wob).add(pt);
          pos.setXYZ(idx, pa.x, pa.y, pa.z);
          alt.setXYZ(idx, pb.x, pb.y, pb.z);
          colour.copy(quarks[e].material.color).lerp(quarks[(e + 1) % 3].material.color, u).lerp(white, 0.3);
          col.setXYZ(idx, colour.r, colour.g, colour.b);
        }
      }
      pos.needsUpdate = alt.needsUpdate = col.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- nucleus
// Z protons and A - Z neutrons packed into a ball by a few hundred rounds of relaxation: they push apart where
// they overlap and are all drawn inwards, as the strong force does. Nucleon radius 1 scene unit (0.84 fm).
const NUCLEON = new THREE.SphereGeometry(1, 40, 28);
function nucleonMaterial(color, emissive) {
  return new THREE.MeshPhysicalMaterial({ color, emissive, emissiveIntensity: 0.5, roughness: 0.4, envMapIntensity: 0.35,
    clearcoat: 0.6, clearcoatRoughness: 0.25, sheen: 0.4, sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.5) });
}
export function nucleus(Z, A) {
  const r0 = 1, R = 1.08 * r0 * Math.cbrt(A), pos = [], d = new THREE.Vector3();
  for (let i = 0; i < A; i++) pos.push(randomDir(new THREE.Vector3()).multiplyScalar(R * Math.cbrt(Math.random())));
  for (let iter = 0; iter < 240; iter++) {
    for (let i = 0; i < A; i++) {
      for (let j = i + 1; j < A; j++) {
        d.subVectors(pos[i], pos[j]);
        const dist = d.length() || 1e-3, overlap = 2 * r0 * 0.96 - dist;
        if (overlap > 0) { d.multiplyScalar((overlap / dist) * 0.5); pos[i].add(d); pos[j].sub(d); }
      }
      pos[i].multiplyScalar(0.985);
    }
  }
  // spread the protons evenly through the ball rather than leaving them where they fell
  const isProton = new Array(A).fill(false);
  pos.map((p, i) => i).sort(() => Math.random() - 0.5).slice(0, Z).forEach(i => { isProton[i] = true; });
  const group = new THREE.Group(), pm = nucleonMaterial(0xe8432a, 0x4a0c04), nm = nucleonMaterial(0x6f8fc4, 0x0a1430), meshes = [];
  pos.forEach((p, i) => {
    const m = new THREE.Mesh(NUCLEON, isProton[i] ? pm : nm);
    m.position.copy(p); m.scale.setScalar(r0 * 0.98);
    m.userData = { home: p.clone(), phase: Math.random() * 6.28 };
    group.add(m); meshes.push(m);
  });
  const radius = Math.max(...pos.map(p => p.length() + r0));
  return {
    group, radius,
    update: t => meshes.forEach(m => {
      const w = 0.04, h = m.userData.home, ph = m.userData.phase;
      m.position.set(h.x + Math.sin(t * 2.1 + ph) * w, h.y + Math.sin(t * 1.7 + ph * 1.3) * w, h.z + Math.sin(t * 2.5 + ph * 0.7) * w);
    }),
  };
}
