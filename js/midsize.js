// The middle-sized things in the wave view, from a grain of sand to London and Edinburgh: modelled in code, with
// their textures drawn in code. Each returns { obj, update(t) } with its measured size one unit (its length,
// or its height for tall things; for a hair, its thickness), like js/models3d.js.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { TAU, V, hash, fbm, rng, canvasTexture, lin, mix, smooth, sparks, std, phys, tube } from './model-kit.js';
import { TEXTURES } from '../data/textures.js';

// A smooth curve through (s, value) points, for body outlines.
function spline(points) {
  return s => {
    const i = Math.max(0, Math.min(points.length - 2, points.findIndex((p, k) => k < points.length - 1 && s <= points[k + 1][0])));
    const [s0, v0] = points[i], [s1, v1] = points[i + 1], u = Math.min(1, Math.max(0, (s - s0) / (s1 - s0))), e = u * u * (3 - 2 * u);
    return v0 + (v1 - v0) * e;
  };
}

// ---------------------------------------------------------------- the blue whale
// 25 m, the largest animal there has ever been. Long and slender, with a broad flat U-shaped head, the grooves of
// its throat pleats running back to the navel, slim flippers, a tiny dorsal fin far back and broad flukes. Its
// skin is blue-grey, mottled paler; its underside paler still. It swims by beating its tail up and down.
export function whale() {
  const NS = 170, NR = 64, BODY = 0.86;
  // half-width, half-height and the line of the middle, along the body from the snout (s = 0) to the tail stock
  const hw = spline([[0, 0.016], [0.05, 0.05], [0.16, 0.075], [0.32, 0.084], [0.55, 0.07], [0.72, 0.045], [0.86, 0.01]]);
  const hh = spline([[0, 0.008], [0.05, 0.03], [0.18, 0.06], [0.34, 0.076], [0.55, 0.064], [0.72, 0.042], [0.86, 0.022]]);
  const mid = s => -0.012 * Math.sin(Math.PI * Math.min(1, s / 0.8));
  const pos = new Float32Array((NS + 1) * (NR + 1) * 3), col = [], rest = [];
  const r = rng(31);
  const spots = Array.from({ length: 140 }, () => [r(), r() * TAU, 0.01 + r() * 0.03]);
  for (let i = 0; i <= NS; i++) {
    const s = (i / NS) * BODY;
    for (let j = 0; j <= NR; j++) {
      const th = (j / NR) * TAU, c = Math.cos(th), sn = Math.sin(th);
      let w = hw(s), h = hh(s);
      // the head is flat on top; the throat pleats are grooves on the underside, chin to navel
      const top = sn > 0 && s < 0.3 ? 1 - 0.35 * smooth(0.3, 0.0, s) * sn : 1;
      const pleat = sn < -0.25 && s > 0.03 && s < 0.5 ? 1 - 0.035 * (0.5 + 0.5 * Math.cos(th * 80)) * smooth(0.5, 0.42, s) : 1;
      const x = 0.5 - s, y = mid(s) + h * sn * top * pleat, z = w * c * pleat;
      pos.set([x, y, z], (i * (NR + 1) + j) * 3);
      rest.push(x, y, z);
      let colour = mix([0.22, 0.3, 0.4], [0.17, 0.24, 0.33], fbm(x * 40, y * 40, z * 40, 3));
      for (const [ss, a, rad] of spots) if (Math.abs(ss * BODY - s) < rad && Math.abs(((th - a + Math.PI) % TAU) - Math.PI) < rad * 6) colour = mix(colour, [0.42, 0.5, 0.58], 0.55);
      colour = mix(colour, [0.52, 0.55, 0.52], smooth(-0.1, -0.6, sn));                        // the paler underside
      if (sn < -0.25 && s > 0.03 && s < 0.5) colour = mix(colour, [0.42, 0.44, 0.44], (0.5 + 0.5 * Math.cos(th * 80)) * 0.5);
      if (s < 0.2 && Math.abs(sn + 0.05) < 0.06) colour = mix(colour, [0.12, 0.14, 0.17], 0.7);  // the line of the mouth
      col.push(...lin(colour));
    }
  }
  const idx = [];
  for (let i = 0; i < NS; i++) for (let j = 0; j < NR; j++) { const a = i * (NR + 1) + j, b = a + NR + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); } // wound to face outwards
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  const skin = phys(0xffffff, { vertexColors: true, roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.5 });
  const body = new THREE.Mesh(geo, skin);
  const flat = (shape, depth, mat = skin) => new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: depth * 0.6, bevelThickness: depth * 0.6, bevelSegments: 3, curveSegments: 24 }), mat);
  // the flukes, a quarter of its length across, with a notch in the middle
  const fl = new THREE.Shape();
  fl.moveTo(0.02, 0); fl.bezierCurveTo(-0.02, 0.05, -0.07, 0.12, -0.13, 0.15); fl.bezierCurveTo(-0.11, 0.09, -0.1, 0.03, -0.12, 0.006);
  fl.lineTo(-0.105, 0); fl.lineTo(-0.12, -0.006); fl.bezierCurveTo(-0.1, -0.03, -0.11, -0.09, -0.13, -0.15); fl.bezierCurveTo(-0.07, -0.12, -0.02, -0.05, 0.02, 0);
  const flukes = flat(fl, 0.003); flukes.geometry.rotateX(Math.PI / 2); flukes.geometry.translate(0, 0.0045, 0);
  const tail = new THREE.Group(); tail.add(flukes);
  // the slim flippers, a seventh of its length
  const fp = new THREE.Shape(); fp.moveTo(0, 0); fp.bezierCurveTo(-0.02, 0.012, -0.09, 0.012, -0.13, 0.003); fp.bezierCurveTo(-0.09, -0.006, -0.03, -0.012, 0, -0.01);
  const flippers = [-1, 1].map(sd => { const f = flat(fp, 0.0025); f.rotation.set(Math.PI / 2 + sd * 0.55, 0, sd * 0.25 - 0.2); f.position.set(0.5 - 0.27, -0.045, sd * 0.06); return f; });
  // the small dorsal fin, three-quarters of the way back
  const df = new THREE.Shape(); df.moveTo(0, 0); df.quadraticCurveTo(-0.004, 0.012, -0.022, 0.016); df.quadraticCurveTo(-0.018, 0.006, -0.03, 0);
  const dorsal = flat(df, 0.002); dorsal.position.set(0.5 - 0.72, hh(0.72) - 0.012, -0.001);
  const eyes = [-1, 1].map(sd => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.004, 12, 8), phys(0x050608, { roughness: 0.05, clearcoat: 1 })); e.position.set(0.5 - 0.19, -0.012, sd * hw(0.19) * 0.98); return e; });
  const animal = new THREE.Group(); animal.add(body, tail, dorsal, ...flippers, ...eyes);
  // the sea round it: drifting specks, and light falling from the surface
  const sea = new THREE.Group(), snow = [];
  for (let i = 0; i < 260; i++) snow.push((r() - 0.5) * 1.6, (r() - 0.5) * 0.6, (r() - 0.5) * 0.8);
  const specks = sparks(snow, 0x9fd0ff, 0.006, { opacity: 0.35 }); sea.add(specks);
  const rayTex = canvasTexture(64, 256, ctx => { const gr = ctx.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(160,210,255,0.5)'); gr.addColorStop(1, 'rgba(160,210,255,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, 64, 256); });
  for (let k = 0; k < 5; k++) {
    const ray = new THREE.Mesh(new THREE.PlaneGeometry(0.12 + r() * 0.1, 1.2), new THREE.MeshBasicMaterial({ map: rayTex, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    ray.position.set(-0.6 + k * 0.3, 0.35, -0.3 - r() * 0.3); ray.rotation.z = 0.25; sea.add(ray);
  }
  const g = new THREE.Group(); g.add(animal, sea);
  const p = geo.attributes.position;
  return { obj: g, update: t => {
    // the body bends up and down, more towards the tail
    const wave = s => 0.028 * smooth(0.3, 0.86, s) ** 1.5 * Math.sin(t * 1.4 - s * 5);
    for (let i = 0; i <= NS; i++) {
      const s = (i / NS) * BODY, dy = wave(s);
      for (let j = 0; j <= NR; j++) { const k = (i * (NR + 1) + j) * 3; p.setY(k / 3, rest[k + 1] + dy); }
    }
    p.needsUpdate = true; geo.computeVertexNormals();
    const end = BODY, slope = (wave(end) - wave(end - 0.02)) / 0.02;
    tail.position.set(0.5 - end, mid(end) + wave(end), 0); tail.rotation.z = Math.atan(slope) * 1.6;
    animal.rotation.set(0.05, Math.sin(t * 0.2) * 0.35 - 0.3, 0.03);
    specks.position.y = ((t * 0.01) % 0.1) - 0.05;
  } };
}

// ---------------------------------------------------------------- the football pitch
// A pitch of 105 m by 68 m under floodlights: mown stripes, the markings to their rules, goals with nets,
// corner flags, two teams and a referee, advertising boards and stands full of people.
export function pitch() {
  const L = 1, Wd = 68 / 105, k = 1 / 105;
  const grass = canvasTexture(2048, Math.round(2048 * Wd), (ctx, w, h) => {
    const img = ctx.createImageData(w, h), d = img.data, px = w / 105;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const stripe = Math.floor(x / (w / 18)) % 2, n = hash(x, y, 7) * 0.12 + fbm(x / 60, y / 60, 1, 3) * 0.1;
      const g = mix(stripe ? [0.2, 0.47, 0.2] : [0.24, 0.53, 0.23], [0.16, 0.38, 0.15], n);
      const i = (y * w + x) * 4; d[i] = g[0] * 255; d[i + 1] = g[1] * 255; d[i + 2] = g[2] * 255; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    ctx.strokeStyle = 'rgba(245,248,240,0.92)'; ctx.lineWidth = Math.max(2, 0.12 * px); ctx.fillStyle = 'rgba(245,248,240,0.92)';
    const m = ctx.lineWidth / 2;
    ctx.strokeRect(m, m, w - 2 * m, h - 2 * m);
    ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
    ctx.beginPath(); ctx.arc(w / 2, h / 2, 9.15 * px, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(w / 2, h / 2, 0.25 * px, 0, TAU); ctx.fill();
    for (const side of [0, 1]) {
      const X = side ? w : 0, d1 = side ? -1 : 1;
      ctx.strokeRect(side ? w - 16.5 * px : m, h / 2 - 20.16 * px, 16.5 * px, 40.32 * px);
      ctx.strokeRect(side ? w - 5.5 * px : m, h / 2 - 9.16 * px, 5.5 * px, 18.32 * px);
      ctx.beginPath(); ctx.arc(X + d1 * 11 * px, h / 2, 0.25 * px, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(X + d1 * 11 * px, h / 2, 9.15 * px, side ? Math.PI - 0.927 : -0.927, side ? Math.PI + 0.927 : 0.927); ctx.stroke();
      for (const cy of [0, h]) { ctx.beginPath(); ctx.arc(X, cy, 1 * px, 0, TAU); ctx.stroke(); }
    }
  });
  const g = new THREE.Group();
  const turf = new THREE.Mesh(new THREE.PlaneGeometry(L, Wd), std(0xffffff, { map: grass, roughness: 0.9 })); turf.rotation.x = -Math.PI / 2; g.add(turf);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(L + 0.12, Wd + 0.1), std(0x1d4a24, { roughness: 1 })); apron.rotation.x = -Math.PI / 2; apron.position.y = -0.002; g.add(apron);
  // advertising boards round the pitch, lit
  const ads = canvasTexture(1024, 32, (ctx, w, h) => { const cols = ['#e63946', '#1d3557', '#f2b45a', '#2a9d8f', '#ffffff', '#7b2cbf']; for (let i = 0; i < 16; i++) { ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(i * 64, 0, 64, h); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(i * 64 + 12, 12, 40, 6); } });
  ads.wrapS = THREE.RepeatWrapping; ads.repeat.set(3, 1);
  const boardMat = std(0x111111, { emissive: 0xffffff, emissiveMap: ads, emissiveIntensity: 0.9 });
  for (const [x, z, len, rot] of [[0, -Wd / 2 - 0.045, L + 0.06, 0], [0, Wd / 2 + 0.045, L + 0.06, 0], [-L / 2 - 0.05, 0, Wd + 0.06, Math.PI / 2], [L / 2 + 0.05, 0, Wd + 0.06, Math.PI / 2]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(len, 1 * k, 0.002), boardMat); b.position.set(x, 0.5 * k, z); b.rotation.y = rot; g.add(b);
  }
  // stands: stepped tiers of seats, with the crowd as coloured dots
  // Fans gather by their team, in soft patches along rows: random specks shimmer as the stadium turns.
  const crowd = canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#2b2f3a'; ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 32; row++) for (let i = 0; i < 128; i++) {
      const home = fbm(i / 7, row / 3, 3, 2) > 0.5, c = hash(i, row, 6);
      ctx.fillStyle = c < 0.08 ? '#8a8476' : home ? '#9a3434' : '#3a5596';
      ctx.fillRect(i * 4, row * 4 + 1, 3, 3);
    }
  });
  crowd.wrapS = crowd.wrapT = THREE.RepeatWrapping;
  const roofMat = std(0xc9d0da, { metalness: 0.5, roughness: 0.35, transparent: true, opacity: 0.55, side: THREE.DoubleSide }), backMat = std(0x2a2e38, { roughness: 0.9 });
  const stand = (len, rot, dist) => {
    const sg = new THREE.Group();
    // a sloping bank of seats, full, then the back wall and a light roof
    const tex = crowd.clone(); tex.needsUpdate = true; tex.repeat.set(len * 3, 1);
    const rake = new THREE.Mesh(new THREE.PlaneGeometry(len, 26 * k), std(0xffffff, { map: tex, roughness: 0.9 }));
    rake.rotation.x = -Math.PI / 2 + 0.6; rake.position.set(0, 7 * k, -12 * k); sg.add(rake);
    const back = new THREE.Mesh(new THREE.BoxGeometry(len, 15 * k, 1 * k), backMat); back.position.set(0, 7.5 * k, -23 * k); sg.add(back);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(len, 0.4 * k, 7 * k), roofMat); roof.position.set(0, 17 * k, -20 * k); sg.add(roof);
    sg.rotation.y = rot; sg.position.copy(V(Math.sin(rot) * -dist, 0, Math.cos(rot) * -dist));
    return sg;
  };
  g.add(stand(L + 0.04, 0, Wd / 2 + 0.07), stand(L + 0.04, Math.PI, Wd / 2 + 0.07), stand(Wd + 0.04, Math.PI / 2, L / 2 + 0.08), stand(Wd + 0.04, -Math.PI / 2, L / 2 + 0.08));
  // goals with their nets, and corner flags
  const white = phys(0xffffff, { roughness: 0.3, emissive: 0x333333 });
  for (const sd of [-1, 1]) {
    const x = sd * L / 2, gw = 7.32 * k, gh = 2.44 * k, depth = 2 * k;
    g.add(tube([V(x, 0, -gw / 2), V(x, gh, -gw / 2), V(x, gh, gw / 2), V(x, 0, gw / 2)], 0.06 * k, white, 24, 6));
    const net = [];
    for (let i = 0; i <= 24; i++) { const z = -gw / 2 + (i / 24) * gw; net.push(V(x, gh, z), V(x + sd * depth, gh * 0.75, z), V(x + sd * depth, gh * 0.75, z), V(x + sd * depth, 0, z)); }
    for (let j = 0; j <= 8; j++) { const y = (j / 8) * gh * 0.75; net.push(V(x + sd * depth, y, -gw / 2), V(x + sd * depth, y, gw / 2)); }
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(net), new THREE.LineBasicMaterial({ color: 0xe8ecf2, transparent: true, opacity: 0.5 })));
  }
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02 * k, 0.02 * k, 1.5 * k, 6), white); pole.position.set(x * L / 2, 0.75 * k, z * Wd / 2); g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5 * k, 0.4 * k), std(0xffd23f, { side: THREE.DoubleSide, emissive: 0x332200 })); flag.position.set(x * L / 2 + 0.25 * k, 1.3 * k, z * Wd / 2); g.add(flag);
  }
  // the players: two sides of eleven in a 4-4-2 and a referee, each 1.8 m tall
  const shape = [[0.08, 0], [0.25, 0.2], [0.25, -0.2], [0.25, 0.4], [0.25, -0.4], [0.5, 0.15], [0.5, -0.15], [0.5, 0.38], [0.5, -0.38], [0.7, 0.1], [0.7, -0.1]];
  const players = [];
  const person = (shirt, shorts) => {
    const p = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22 * k, 0.5 * k, 4, 8), std(shirt, { roughness: 0.7 })); torso.position.y = 1.2 * k;
    const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.17 * k, 0.6 * k, 4, 8), std(shorts)); legs.position.y = 0.5 * k;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12 * k, 10, 8), std(0xd9b08c)); head.position.y = 1.7 * k;
    p.add(torso, legs, head); return p;
  };
  for (const [side, shirt, shorts, keeper] of [[-1, 0xd7263d, 0xffffff, 0x2ecc71], [1, 0x1f6fd1, 0x0b1f3a, 0xf1c40f]]) {
    shape.forEach(([fx, fz], i) => {
      const p = person(i === 0 ? keeper : shirt, shorts), home = V(side * (L / 2 - fx * L / 2), 0, fz * Wd);
      p.position.copy(home); g.add(p); players.push({ p, home, phase: r01(i, side) * TAU });
    });
  }
  const ref = person(0x111111, 0x111111); g.add(ref); players.push({ p: ref, home: V(0.05, 0, 0.1), phase: 1 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.11 * k * 1.5, 12, 8), white); g.add(ball);
  // floodlight masts at the corners, their lamps glowing and their light falling on the pitch
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xfff6dd, transparent: true, opacity: 0.045, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const mx = x * (L / 2 + 0.12), mz = z * (Wd / 2 + 0.14), top = 0.36;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.005, top, 8), std(0x8b96aa, { metalness: 0.7, roughness: 0.4 })); mast.position.set(mx, top / 2, mz); g.add(mast);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.006), std(0x222222, { emissive: 0xfff4d6, emissiveIntensity: 3 })); lamp.position.set(mx, top, mz); lamp.lookAt(0, 0, 0); g.add(lamp);
    g.add(sparks([mx, top, mz], 0xfff6dd, 0.035));
    const len = Math.hypot(mx, top, mz) * 0.95, cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, len, 24, 1, true), coneMat);
    cone.position.set(mx / 2, top / 2, mz / 2); cone.lookAt(0, 0, 0); cone.rotateX(-Math.PI / 2); g.add(cone);
  }
  const holder = new THREE.Group(); holder.rotation.x = 0.62; holder.add(g);
  return { obj: holder, update: t => {
    g.rotation.y = Math.sin(t * 0.12) * 0.35;
    const bx = Math.sin(t * 0.37) * 0.32, bz = Math.sin(t * 0.53) * 0.2;
    ball.position.set(bx, 0.16 * k, bz);
    for (const { p, home, phase } of players) {
      const pull = 0.25; // everyone drifts towards the ball, around their place
      p.position.set(home.x + (bx - home.x) * pull * 0.4 + Math.sin(t * 0.9 + phase) * 0.01, 0, home.z + (bz - home.z) * pull * 0.5 + Math.cos(t * 0.7 + phase) * 0.008);
    }
  } };
}
const r01 = (i, j) => hash(i, j, 99);

// ---------------------------------------------------------------- the double-decker bus
// A London double-decker, 11.2 m long, 4.4 m tall and 2.55 m wide: red, two decks of windows lit warm inside,
// the destination blind, doors, wheels in their arches and a long advert down the side.
export function bus() {
  const L = 1, H = 4.4 / 11.2, W = 2.55 / 11.2, clear = 0.03;
  const g = new THREE.Group();
  const red = phys(0xc8102e, { roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 });
  const black = std(0x15161a, { roughness: 0.6 });
  const glass = phys(0x0b1018, { roughness: 0.04, metalness: 0.3, clearcoat: 1, emissive: 0xffd9a0, emissiveIntensity: 0.1 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(L, H - clear, W, 6, 0.035), red); body.position.y = clear + (H - clear) / 2; g.add(body);
  const skirt = new THREE.Mesh(new RoundedBoxGeometry(L * 0.998, 0.035, W * 1.004, 3, 0.01), black); skirt.position.y = clear + 0.018; g.add(skirt);
  // windows down each side on both decks, with pillars between
  const deck = (y, h) => {
    for (const sd of [-1, 1]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(L * 0.86, h, 0.004), glass); band.position.set(-0.035, y, sd * (W / 2 + 0.0015)); g.add(band);
      for (let i = 0; i <= 8; i++) { const pil = new THREE.Mesh(new THREE.BoxGeometry(0.008, h * 1.02, 0.006), red); pil.position.set(-0.035 - L * 0.43 + i * (L * 0.86 / 8), y, sd * (W / 2 + 0.002)); g.add(pil); }
    }
  };
  deck(clear + 0.13, 0.085); deck(clear + 0.285, 0.075);
  // the front: two big windscreens, the destination blind between, lights
  const front = L / 2 + 0.002;
  const ws = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.13, W * 0.86), glass); ws.position.set(front, clear + 0.13, 0); g.add(ws);
  const ws2 = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.08, W * 0.86), glass); ws2.position.set(front, clear + 0.29, 0); g.add(ws2);
  const blindTex = canvasTexture(512, 64, (ctx, w, h) => { ctx.fillStyle = '#0b0b0b'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#ffb400'; ctx.font = 'bold 44px sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText('24', 14, h / 2 + 2); ctx.font = 'bold 30px sans-serif'; ctx.fillText('HAMPSTEAD HEATH', 90, h / 2 + 2); });
  const blind = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.8, 0.03), std(0x000000, { emissive: 0xffffff, emissiveMap: blindTex, emissiveIntensity: 1.2 }));
  blind.rotation.y = Math.PI / 2; blind.position.set(front + 0.003, clear + 0.222, 0); g.add(blind);
  for (const sd of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.011, 16), std(0x000000, { emissive: 0xfff3d0, emissiveIntensity: 2 })); lamp.rotation.y = Math.PI / 2; lamp.position.set(front + 0.002, clear + 0.045, sd * W * 0.36); g.add(lamp);
    const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.014, 0.05), std(0x000000, { emissive: 0xff1a1a, emissiveIntensity: 1.6 })); tail.rotation.y = -Math.PI / 2; tail.position.set(-front - 0.002, clear + 0.07, sd * W * 0.4); g.add(tail);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.004), black); mirror.position.set(front - 0.02, clear + 0.19, sd * (W / 2 + 0.018)); g.add(mirror);
  }
  // doors on the kerb side, and the advert along the upper deck
  for (const x of [L * 0.42, 0.02]) { const door = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.17, 0.004), glass); door.position.set(x, clear + 0.1, W / 2 + 0.0025); g.add(door); }
  const ad = canvasTexture(1024, 96, (ctx, w, h) => {
    const gr = ctx.createLinearGradient(0, 0, w, 0); ['#ff4d4d', '#ffb84d', '#ffe14d', '#4dff88', '#4db8ff', '#9a4dff'].forEach((c, i) => gr.addColorStop(i / 5, c));
    ctx.fillStyle = '#0b0f1a'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = gr; ctx.fillRect(0, h - 10, w, 10);
    ctx.fillStyle = '#fff'; ctx.font = '800 54px sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText('FULL SPECTRUM', 30, h / 2 - 4); ctx.font = '400 26px sans-serif'; ctx.fillText('radio to gamma rays', 560, h / 2 - 2);
  });
  for (const sd of [-1, 1]) { const a = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.045), std(0xffffff, { map: ad, roughness: 0.5 })); a.position.set(-0.08, clear + 0.215, sd * (W / 2 + 0.0026)); if (sd < 0) a.rotation.y = Math.PI; g.add(a); }
  // wheels, turning
  const wheels = [], tyre = std(0x111216, { roughness: 0.85 }), hub = phys(0xc8102e, { metalness: 0.4, roughness: 0.3 });
  for (const x of [L * 0.33, -L * 0.25]) for (const sd of [-1, 1]) {
    const w = new THREE.Group();
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.016, 12, 24), tyre); w.add(t);
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.02, 10), hub); h.rotation.x = Math.PI / 2; w.add(h);
    w.position.set(x, 0.05, sd * (W / 2 - 0.012)); g.add(w); wheels.push(w);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.006, 6, 20, Math.PI), black); arch.position.set(x, 0.05, sd * (W / 2 + 0.002)); g.add(arch);
  }
  g.position.y = -H / 2;
  const holder = new THREE.Group(); holder.rotation.x = 0.16; holder.add(g);
  return { obj: holder, update: t => {
    g.rotation.y = Math.sin(t * 0.25) * 0.5 - 0.5;
    for (const w of wheels) w.rotation.z = -t * 3;
    body.position.y = clear + (H - clear) / 2 + Math.sin(t * 9) * 0.0012;
  } };
}

// ---------------------------------------------------------------- the ant
// A worker ant, 5 mm long: head with jaws, compound eyes and elbowed antennae; a slim thorax carrying six
// jointed legs; the waist (petiole); the gaster, banded; fine hairs all over. Glossy, dark red-brown chitin.
// It walks with the alternating tripod gait insects use: three legs down while the other three swing.
export function ant() {
  const g = new THREE.Group(), r = rng(77);
  const chitin = phys(0x3b1a10, { roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.4, sheenColor: 0x8a4a2a });
  const dark = phys(0x24100a, { roughness: 0.3, clearcoat: 1 });
  const blob = (rx, ry, rz, x, y, z = 0, mat = chitin) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), mat); m.scale.set(rx, ry, rz); m.position.set(x, y, z); g.add(m); return m; };
  // gaster with its segment bands
  const bands = canvasTexture(256, 64, (ctx, w, h) => { ctx.fillStyle = '#5a2a18'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#2a120a'; for (const x of [0.22, 0.45, 0.66, 0.84]) ctx.fillRect(x * w, 0, 6, h); });
  const gaster = blob(0.19, 0.13, 0.135, -0.3, 0.05, 0, phys(0xffffff, { map: bands, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }));
  blob(0.045, 0.06, 0.04, -0.105, 0.04);                                                // the petiole's node
  const thorax = new THREE.Group(); g.add(thorax);
  for (const [rx, ry, x, y] of [[0.085, 0.06, 0.04, 0.06], [0.07, 0.05, 0.13, 0.065], [0.05, 0.045, -0.04, 0.05]]) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), chitin); m.scale.set(rx, ry, ry * 0.95); m.position.set(x, y, 0); thorax.add(m); }
  const head = new THREE.Group(); head.position.set(0.27, 0.075, 0); g.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), chitin); skull.scale.set(0.085, 0.075, 0.09); head.add(skull);
  // compound eyes: many facets
  const facets = canvasTexture(64, 64, (ctx, w, h) => { ctx.fillStyle = '#080808'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#3a3a3a'; for (let y = 0; y < h; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < w; x += 4) ctx.fillRect(x, y, 2, 2); }, false);
  facets.wrapS = facets.wrapT = THREE.RepeatWrapping; facets.repeat.set(3, 3);
  for (const sd of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 24, 16), phys(0x0a0a0a, { roughness: 0.15, clearcoat: 1, bumpMap: facets, bumpScale: 1.5 })); eye.position.set(0.03, 0.02, sd * 0.075); head.add(eye);
    // jaws
    head.add(tube([V(0.07, -0.03, sd * 0.03), V(0.12, -0.035, sd * 0.035), V(0.145, -0.035, sd * 0.01), V(0.14, -0.033, -sd * 0.012)], 0.009, dark, 16, 6));
    // antennae: a long first segment out from the head, then the elbow and a chain of beads
    const base = V(0.06, 0.03, sd * 0.035), elbow = V(0.13, 0.15, sd * 0.11);
    head.add(tube([base, base.clone().lerp(elbow, 0.5).add(V(0, 0.01, 0)), elbow], 0.006, chitin, 16, 6));
    for (let i = 1; i <= 11; i++) { const u = i / 11, p = elbow.clone().add(V(0.13 * u, -0.05 * u - 0.03 * u * u, sd * 0.06 * u)); const b = new THREE.Mesh(new THREE.SphereGeometry(0.0075 + u * 0.004, 10, 8), chitin); b.position.copy(p); head.add(b); }
  }
  // six legs, each from the thorax: femur up and out, tibia down, tarsus along the ground
  const legs = [];
  for (const sd of [-1, 1]) for (const [i, x] of [-0.035, 0.05, 0.12].entries()) {
    const leg = new THREE.Group(); leg.position.set(x, 0.025, sd * 0.03); g.add(leg);
    const reach = [-0.17, 0.02, 0.15][i], knee = V(reach * 0.45, 0.13, sd * 0.17), ankle = V(reach, -0.01, sd * 0.28), toe = V(reach * 1.25, -0.065, sd * 0.33);
    leg.add(tube([V(0, 0, 0), knee.clone().multiplyScalar(0.5).add(V(0, 0.03, 0)), knee], 0.011, chitin, 12, 6));
    leg.add(tube([knee, knee.clone().lerp(ankle, 0.5).add(V(0, 0.02, 0)), ankle], 0.008, chitin, 12, 6));
    leg.add(tube([ankle, ankle.clone().lerp(toe, 0.5), toe], 0.0055, dark, 10, 5));
    legs.push({ leg, phase: (i % 2 === 0) === (sd > 0) ? 0 : Math.PI, sd });
  }
  // fine hairs, standing off the body
  const hairs = [];
  for (const [m, n] of [[gaster, 120], [skull, 30]]) {
    const c = m.position, s = m.scale;
    for (let i = 0; i < n; i++) {
      const d = V(r() - 0.5, r() - 0.2, r() - 0.5).normalize(), p = V(d.x * s.x, d.y * s.y, d.z * s.z).add(c);
      if (m === skull) p.add(head.position);
      hairs.push(p, p.clone().addScaledVector(d, 0.01 + r() * 0.01));
    }
  }
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(hairs), new THREE.LineBasicMaterial({ color: 0xc8a888, transparent: true, opacity: 0.5 })));
  g.position.set(0.02, 0.0, 0);
  const holder = new THREE.Group(); holder.rotation.x = 0.42; holder.add(g);
  return { obj: holder, update: t => {
    for (const { leg, phase, sd } of legs) { const s = Math.sin(t * 7 + phase); leg.rotation.y = s * 0.28 * sd; leg.position.y = 0.025 + Math.max(0, Math.cos(t * 7 + phase)) * 0.012; }
    head.rotation.z = Math.sin(t * 1.7) * 0.06; gaster.rotation.z = Math.sin(t * 2.3) * 0.03;
    g.rotation.y = Math.sin(t * 0.25) * 0.6 - 0.35; g.position.y = Math.abs(Math.sin(t * 7)) * 0.004;
  } };
}

// ---------------------------------------------------------------- the phone
// A phone 14.7 cm tall: an aluminium frame, a glass front with the lock screen lit and a notch for the camera,
// and on the back a glass panel with the camera block, three lenses and a flash.
export function phone() {
  const g = new THREE.Group(), w = 0.48, d = 0.055;
  const frame = new THREE.Mesh(new RoundedBoxGeometry(w, 1, d, 8, 0.075), phys(0x9aa4b2, { metalness: 1, roughness: 0.28 })); g.add(frame);
  const screenTex = canvasTexture(480, 1000, (ctx, W, H) => {
    const gr = ctx.createRadialGradient(W * 0.3, H * 0.75, 40, W * 0.5, H * 0.5, H * 0.8);
    gr.addColorStop(0, '#ff7a59'); gr.addColorStop(0.35, '#7b2cbf'); gr.addColorStop(0.7, '#1d3a8a'); gr.addColorStop(1, '#070b1a');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 6; i++) { ctx.strokeStyle = `rgba(255,255,255,${0.05 + i * 0.02})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, H * (0.55 + i * 0.05)); ctx.bezierCurveTo(W * 0.3, H * (0.45 + i * 0.05), W * 0.7, H * (0.7 + i * 0.03), W, H * (0.6 + i * 0.05)); ctx.stroke(); }
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = '500 34px sans-serif'; ctx.fillText('Tuesday 21 October', W / 2, 190);
    ctx.font = '700 150px sans-serif'; ctx.fillText('9:41', W / 2, 340);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.roundRect(40, 400, W - 80, 110, 28); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '600 26px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('Full Spectrum', 70, 445); ctx.font = '400 24px sans-serif'; ctx.fillText('A photon of 2.33 eV: green light', 70, 482);
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.roundRect(W / 2 - 70, 26, 140, 40, 20); ctx.fill();          // the notch
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.roundRect(W / 2 - 80, H - 30, 160, 8, 4); ctx.fill();
    for (const x of [70, W - 70]) { ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.arc(x, H - 110, 34, 0, TAU); ctx.fill(); }
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.92, 0.955), std(0x000000, { emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: 1, roughness: 0.05, metalness: 0.3 }));
  screen.position.z = d / 2 + 0.002; g.add(screen);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.94, 0.97), phys(0x2b3a4a, { roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.05 }));
  back.rotation.y = Math.PI; back.position.z = -d / 2 - 0.002; g.add(back);
  const bump = new THREE.Mesh(new RoundedBoxGeometry(0.21, 0.21, 0.02, 4, 0.05), phys(0x34465a, { roughness: 0.2, clearcoat: 1 })); bump.position.set(0.1, 0.36, -d / 2 - 0.008); g.add(bump);
  for (const [x, y] of [[0.055, 0.405], [0.145, 0.405], [0.055, 0.315]]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.016, 32), phys(0xc0c8d4, { metalness: 1, roughness: 0.2 })); ring.rotation.x = Math.PI / 2; ring.position.set(x, y, -d / 2 - 0.02); g.add(ring);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.018, 32), phys(0x05070c, { roughness: 0.02, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.5 })); lens.rotation.x = Math.PI / 2; lens.position.set(x, y, -d / 2 - 0.021); g.add(lens);
  }
  const flash = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.01, 16), std(0xfff6dd, { emissive: 0x332a10 })); flash.rotation.x = Math.PI / 2; flash.position.set(0.145, 0.315, -d / 2 - 0.016); g.add(flash);
  for (const [y, h, sd] of [[0.25, 0.1, 1], [0.3, 0.06, -1], [0.2, 0.06, -1]]) { const b = new THREE.Mesh(new RoundedBoxGeometry(0.012, h, 0.022, 2, 0.005), phys(0x9aa4b2, { metalness: 1, roughness: 0.25 })); b.position.set(sd * (w / 2 + 0.004), y, 0); g.add(b); }
  const holder = new THREE.Group(); holder.add(g);
  return { obj: holder, update: t => { g.rotation.y = Math.sin(t * 0.35) * 1.5; g.rotation.x = 0.1 + Math.sin(t * 0.5) * 0.06; } };
}

// ---------------------------------------------------------------- the £1 coin
// The twelve-sided £1 coin, 23.43 mm across: a nickel-brass ring round a nickel-plated centre, with milled and
// smooth sections alternating round its edge. The faces carry a simple relief of our own, not the real designs.
export function coin() {
  const R = 0.5, T = 2.8 / 23.43, g = new THREE.Group();
  const relief = canvasTexture(512, 512, ctx => {
    ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#b0b0b0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(256, 256, 238, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(256, 256, 170, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#c8c8c8'; ctx.textAlign = 'center'; ctx.font = '700 34px serif';
    for (const [i, ch] of [...'ONE POUND · ONE POUND · '].entries()) { ctx.save(); ctx.translate(256, 256); ctx.rotate((i / 24) * TAU); ctx.fillText(ch, 0, -196); ctx.restore(); }
    ctx.font = '700 120px serif'; ctx.fillText('£1', 256, 300);
    for (let i = 0; i < 24; i++) { ctx.save(); ctx.translate(256, 256); ctx.rotate((i / 24) * TAU); ctx.fillRect(-2, -160, 4, 18); ctx.restore(); }
  }, false);
  const ring = new THREE.Shape(), hole = new THREE.Path(), inner = new THREE.Shape();
  for (let i = 0; i <= 12; i++) { const a = (i / 12) * TAU + Math.PI / 12; i ? ring.lineTo(Math.cos(a) * R, Math.sin(a) * R) : ring.moveTo(Math.cos(a) * R, Math.sin(a) * R); }
  for (let i = 0; i <= 96; i++) { const a = (i / 96) * TAU, p = [Math.cos(a) * R * 0.66, Math.sin(a) * R * 0.66]; i ? (hole.lineTo(...p), inner.lineTo(...p)) : (hole.moveTo(...p), inner.moveTo(...p)); }
  ring.holes.push(hole);
  const extrude = sh => {
    const geo = new THREE.ExtrudeGeometry(sh, { depth: T * 0.7, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.022, bevelSegments: 4, curveSegments: 32 });
    geo.translate(0, 0, -T * 0.35);
    const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) + 0.5, p.getY(i) + 0.5);
    return geo;
  };
  g.add(new THREE.Mesh(extrude(ring), phys(0xcfae5a, { metalness: 0.9, roughness: 0.38, bumpMap: relief, bumpScale: 1.5, envMapIntensity: 0.45 })));
  g.add(new THREE.Mesh(extrude(inner), phys(0xc9ced6, { metalness: 0.9, roughness: 0.36, bumpMap: relief, bumpScale: 1.5, envMapIntensity: 0.45 })));
  // milling on alternate edges
  const mill = std(0xb8964a, { metalness: 0.6, roughness: 0.55 });
  for (let e = 0; e < 12; e += 2) {
    const a0 = (e / 12) * TAU + Math.PI / 12, a1 = a0 + TAU / 12, p0 = V(Math.cos(a0) * R, Math.sin(a0) * R, 0), p1 = V(Math.cos(a1) * R, Math.sin(a1) * R, 0), n = p0.clone().add(p1).normalize();
    for (let k = 1; k < 18; k++) { const p = p0.clone().lerp(p1, k / 18).addScaledVector(n, 0.012); const m = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, T * 0.9), mill); m.position.copy(p); m.rotation.z = Math.atan2(n.y, n.x); g.add(m); }
  }
  const holder = new THREE.Group(); holder.add(g);
  return { obj: holder, update: t => { g.rotation.y = t * 0.8; g.rotation.x = 0.25 + Math.sin(t * 0.4) * 0.1; } };
}

// ---------------------------------------------------------------- the grain of sand
// Half a millimetre of quartz, rounded by water and wind: clear and frosted, with a few specks inside, among
// grains of feldspar (pink), a dark mineral and a fragment of shell.
export function sand() {
  const g = new THREE.Group(), r = rng(5);
  const pebble = (rad, rough, seed) => {
    const ico = new THREE.IcosahedronGeometry(rad, 5); ico.deleteAttribute('normal'); ico.deleteAttribute('uv');
    const geo = mergeVertices(ico), p = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = v.clone().normalize(); v.multiplyScalar(1 + rough * (fbm(n.x * 1.8 + seed, n.y * 1.8, n.z * 1.8, 4) - 0.5) + 0.02 * (fbm(n.x * 9 + seed, n.y * 9, n.z * 9, 2) - 0.5)); p.setXYZ(i, v.x, v.y, v.z); }
    geo.computeVertexNormals(); return geo;
  };
  const frost = canvasTexture(256, 256, (ctx, w, h) => { const img = ctx.createImageData(w, h); for (let i = 0; i < w * h; i++) { const v = 150 + hash(i, 2, 3) * 105; img.data.set([v, v, v, 255], i * 4); } ctx.putImageData(img, 0, 0); }, false);
  const quartz = new THREE.Mesh(pebble(0.42, 0.45, 2), phys(0xe9dcc4, { roughness: 0.42, roughnessMap: frost, clearcoat: 0.7, clearcoatRoughness: 0.35, sheen: 0.6, sheenColor: 0xfff4dc, emissive: 0x2a2216, transparent: true, opacity: 0.93 }));
  quartz.scale.set(1.08, 0.82, 0.95); g.add(quartz);
  const inside = []; for (let i = 0; i < 20; i++) { const d = V(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.45); inside.push(d.x, d.y, d.z); }
  g.add(sparks(inside, 0x8a6a40, 0.03, { opacity: 0.5 }));
  for (const [x, y, z, rad, colour, o] of [[-0.62, -0.28, -0.3, 0.2, 0xe8a98a, { roughness: 0.6, sheen: 0.5 }], [0.6, -0.3, -0.25, 0.16, 0x2b2b30, { roughness: 0.3, metalness: 0.4 }], [0.48, 0.38, -0.5, 0.18, 0xf1ead8, { roughness: 0.5, clearcoat: 0.6 }]]) {
    const m = new THREE.Mesh(pebble(rad, 0.5, x * 10), phys(colour, o)); m.position.set(x, y, z); g.add(m);
  }
  return { obj: g, update: t => { quartz.rotation.set(t * 0.18, t * 0.25, 0); g.rotation.y = Math.sin(t * 0.2) * 0.3; } };
}

// ---------------------------------------------------------------- the hair
// A hair seen as an electron microscope sees it: a column about 80 µm thick, wrapped in the overlapping scales
// of its cuticle, their free edges pointing towards the tip, each a few micrometres apart.
export function hair() {
  const N = 260, R = 96, len = 2.6, geo = new THREE.CylinderGeometry(0.5, 0.5, len, R, N, true);
  geo.rotateZ(Math.PI / 2);
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.y), x = v.x;
    // the scale edges are wavy rings, about a tenth of the width apart; each scale rises from its root to its edge
    const edge = x * 9 + 0.35 * Math.sin(a * 3 + Math.floor(x * 9) * 1.7) + 0.15 * Math.sin(a * 7);
    const f = edge - Math.floor(edge), lift = 1 + 0.035 * f ** 1.5 - 0.012;
    v.y *= lift; v.z *= lift; p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const fade = canvasTexture(256, 4, (ctx, w) => { const gr = ctx.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#000'); gr.addColorStop(0.18, '#fff'); gr.addColorStop(0.82, '#fff'); gr.addColorStop(1, '#000'); ctx.fillStyle = gr; ctx.fillRect(0, 0, w, 4); }, false);
  const uv = geo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / len + 0.5, uv.getY(i));
  const strand = new THREE.Mesh(geo, phys(0x6b4428, { roughness: 0.38, sheen: 1, sheenColor: 0xe0a870, sheenRoughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.3, alphaMap: fade, transparent: true }));
  const holder = new THREE.Group(); holder.add(strand);
  return { obj: holder, update: t => { strand.rotation.x = t * 0.25; holder.rotation.y = Math.sin(t * 0.3) * 0.35; holder.rotation.z = 0.08; } };
}

// ---------------------------------------------------------------- London to Edinburgh
// The two cities on a map of Britain and Ireland (Natural Earth's coastlines), the straight line between them
// 534 km, the unit, laid across the screen.
export function londonEdinburgh() {
  const holder = new THREE.Group(), map = new THREE.Group(); holder.add(map);
  holder.rotation.x = 0.55;
  fetch(TEXTURES.britain.file).then(r => r.json()).then(data => {
    const { london, edinburgh } = data.places, dx = edinburgh[0] - london[0], dy = edinburgh[1] - london[1], km = Math.hypot(dx, dy);
    const turn = -Math.atan2(dy, dx), cos = Math.cos(turn), sin = Math.sin(turn), mid = [(london[0] + edinburgh[0]) / 2, (london[1] + edinburgh[1]) / 2];
    const at = ([x, y]) => { const u = x - mid[0], v = y - mid[1]; return [(u * cos - v * sin) / km, (u * sin + v * cos) / km]; };
    const land = std(0x3d6b45, { roughness: 0.9 }), edgeMat = std(0x2a4a30, { roughness: 1 });
    for (const ring of data.rings) {
      const shape = new THREE.Shape(ring.map(p => new THREE.Vector2(...at(p))));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
      map.add(new THREE.Mesh(geo, [land, edgeMat]));
    }
    const seaFade = canvasTexture(128, 128, ctx => { const gr = ctx.createRadialGradient(64, 64, 20, 64, 64, 64); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#000'); ctx.fillStyle = gr; ctx.fillRect(0, 0, 128, 128); }, false);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), std(0x123456, { roughness: 0.6, transparent: true, alphaMap: seaFade, depthWrite: false })); sea.rotation.x = -Math.PI / 2; sea.position.y = -0.002; map.add(sea);
    const [lx, ly] = at(london), [ex, ey] = at(edinburgh);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(lx, 0.02, -ly), V(ex, 0.02, -ey)]), new THREE.LineDashedMaterial({ color: 0xf2b45a, dashSize: 0.02, gapSize: 0.012 }));
    line.computeLineDistances(); map.add(line);
    for (const [x, y] of [[lx, ly], [ex, ey]]) { map.add(sparks([x, 0.03, -y], 0xffd27a, 0.06)); const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.05, 8), std(0xffd27a, { emissive: 0x553300 })); pin.position.set(x, 0.037, -y); map.add(pin); }
    map.userData.runner = sparks([lx, 0.03, -ly], 0xffffff, 0.035); map.add(map.userData.runner); map.userData.ends = [V(lx, 0.03, -ly), V(ex, 0.03, -ey)];
  });
  return { obj: holder, update: t => {
    map.rotation.y = Math.sin(t * 0.15) * 0.2;
    const r = map.userData.runner;
    if (r) { const [a, b] = map.userData.ends, p = a.clone().lerp(b, (t * 0.1) % 1); r.geometry.attributes.position.setXYZ(0, p.x, p.y, p.z); r.geometry.attributes.position.needsUpdate = true; }
  } };
}

// ---------------------------------------------------------------- finishing ready-made models
// Touches applied to a ready-made model (data/models.js) once it has loaded: given its scene and the group it
// sits in (one unit = its measured size), they may add to it, and return a function called every frame.
export const DRESS = {
  // The Eiffel Tower in its own colour, 'Eiffel Tower brown', a bronze repainted every seven years, and the
  // lights that sparkle for five minutes every hour after dark.
  eiffel(scene, holder) {
    scene.traverse(o => { if (o.isMesh) o.material = phys(0x7d5e43, { metalness: 0.55, roughness: 0.5 }); });
    scene.updateMatrixWorld(true); holder.updateMatrixWorld(true);
    const toHolder = holder.matrixWorld.clone().invert(), pts = [], v = new THREE.Vector3(), r = rng(9);
    scene.traverse(o => {
      if (!o.isMesh) return;
      const p = o.geometry.attributes.position;
      for (let i = 0; i < 500 && pts.length < 3 * 900; i++) { v.fromBufferAttribute(p, Math.floor(r() * p.count)).applyMatrix4(o.matrixWorld).applyMatrix4(toHolder); pts.push(v.x, v.y, v.z); }
    });
    const lights = sparks(pts, 0xffffff, 0.0045, { colours: pts.map(() => 1), opacity: 0.8 });
    holder.add(lights);
    const col = lights.geometry.attributes.color;
    return t => {
      for (let i = 0; i < col.count; i++) { const on = hash(i, Math.floor(t * 8), 5) > 0.93 ? 0.8 : 0.02; col.setXYZ(i, on, on * 0.96, on * 0.85); }
      col.needsUpdate = true;
    };
  },
};
