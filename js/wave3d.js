// The 3D layer under the wave view: the thing to compare with as a lit, moving model, and the wave or the
// photons glowing over it. Positions come in screen pixels; the camera is set so that one unit at depth zero
// is one pixel, so the labels and measurements drawn in 2D on top line up exactly. The canvas is black and
// blended onto the page with `screen`, so the bloom can spread without a box round it.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { build } from './models3d.js';
import { MODELS } from '../data/models.js';
import { OBJECTS } from './scale.js';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

// A ready-made model (data/models.js), loaded in the background. Laid with its length across the screen,
// scaled so its measured size (its height for tall things) is one unit, centred, turning gently to and fro,
// and playing its own animation if it has one.
function readyMade(key) {
  const info = MODELS[key], tall = OBJECTS.find(o => o.key === key)?.tall;
  const holder = new THREE.Group(), turn = new THREE.Group();
  holder.rotation.x = 0.12; holder.add(turn);
  let mixer = null, last = 0;
  loader.load(info.file, gltf => {
    const scene = gltf.scene, box = new THREE.Box3();
    // Pose an animated model first, so it is measured as it will be drawn.
    const clip = info.clip && gltf.animations.find(a => new RegExp(info.clip, 'i').test(a.name));
    if (clip) { mixer = new THREE.AnimationMixer(scene); mixer.clipAction(clip).play(); mixer.update(0); }
    const measure = () => { scene.updateMatrixWorld(true); return box.setFromObject(scene, true); };
    let size = measure().getSize(new THREE.Vector3());
    if (!tall && size.z > size.x) { scene.rotation.y = Math.PI / 2; size = measure().getSize(new THREE.Vector3()); }
    scene.scale.multiplyScalar(1 / (tall ? size.y : size.x));
    scene.position.sub(measure().getCenter(new THREE.Vector3()));
    turn.add(scene);
  }, undefined, err => console.warn(`model ${key}:`, err));
  return { obj: holder, update: t => { mixer?.update(Math.min(0.1, t - last)); last = t; turn.rotation.y = Math.sin(t * 0.3) * 0.6; } };
}

const FOV = 24;
const MAX_POINTS = 600;

export class WaveStage {
  constructor(canvas) {
    this.canvas = canvas;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    r.setClearColor(0x000000, 1);
    r.toneMapping = THREE.NeutralToneMapping; // keeps hues, so the wave stays its own colour
    r.toneMappingExposure = 0.95;
    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.35;
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 1, 100000);

    // Light from the upper left, and a rim of the wave's own colour from behind.
    this.scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x0a0a14, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-0.6, 0.8, 1); this.scene.add(key, key.target);
    this.rim = new THREE.DirectionalLight(0xffffff, 2.2); this.rim.position.set(0.9, 0.3, -1); this.scene.add(this.rim, this.rim.target);

    this.models = new Map();
    this.current = null;

    // The wave: a glowing line with a white core, drawn over everything.
    this.waveGeo = new LineGeometry();
    this.glow = new Line2(this.waveGeo, new LineMaterial({ color: 0xffffff, linewidth: 3, transparent: true, depthTest: false }));
    this.core = new Line2(this.waveGeo, new LineMaterial({ color: 0xffffff, linewidth: 1, transparent: true, opacity: 0.7, depthTest: false }));
    this.halo = new Line2(this.waveGeo, new LineMaterial({ color: 0xffffff, linewidth: 12, transparent: true, opacity: 0.07, depthTest: false, blending: THREE.AdditiveBlending }));
    this.halo.renderOrder = 9; this.glow.renderOrder = this.core.renderOrder = 10;
    this.scene.add(this.halo, this.glow, this.core);

    // Photons: soft dots, added together.
    const dot = document.createElement('canvas'); dot.width = dot.height = 64;
    const c = dot.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_POINTS * 3), 3));
    this.dots = new THREE.Points(pg, new THREE.PointsMaterial({ size: 8, map: new THREE.CanvasTexture(dot), transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false }));
    this.dots.renderOrder = 11;
    this.scene.add(this.dots);

    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.5, 1.2);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.size = { w: 0, h: 0 };
  }

  resize(w, h, dpr) {
    if (w === this.size.w && h === this.size.h && dpr === this.dpr) return;
    this.size = { w, h }; this.dpr = dpr;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
    this.camera.aspect = w / h;
    this.camera.position.set(0, 0, h / 2 / Math.tan((FOV / 2) * Math.PI / 180));
    this.camera.far = this.camera.position.z * 4;
    this.camera.updateProjectionMatrix();
    for (const l of [this.halo, this.glow, this.core]) l.material.resolution.set(w, h);
  }

  // Screen pixels to world units at depth zero.
  at(x, y) { return [x - this.size.w / 2, this.size.h / 2 - y]; }

  // The thing to compare with, centred at (x, y) and px pixels across (or tall); null for none.
  model(key, x, y, px) {
    if (this.current && this.current.key !== key) { this.current.obj.visible = false; this.current = null; }
    if (!key) return;
    let m = this.models.get(key);
    if (!m) {
      const b = MODELS[key] ? readyMade(key) : build(key);
      if (!b) return;
      m = { key, ...b, sparks: [] };
      m.obj.traverse(o => { if (o.isPoints && o.userData.base) m.sparks.push(o); });
      this.scene.add(m.obj);
      this.models.set(key, m);
    }
    m.obj.visible = true;
    m.obj.position.set(...this.at(x, y), 0);
    m.obj.scale.setScalar(px);
    m.px = px;
    this.current = m;
  }

  // The wave as a list of screen points [x, y, x, y, …], in the colour rgb (0–255); null to hide.
  wave(points, rgb) {
    const on = !!points;
    this.halo.visible = this.glow.visible = this.core.visible = on;
    if (!on) return;
    const pos = [];
    for (let i = 0; i < points.length; i += 2) pos.push(...this.at(points[i], points[i + 1]), 0);
    // A new geometry when the number of points changes (a resize); otherwise update in place.
    if (pos.length !== this.waveLength) {
      this.waveGeo.dispose();
      this.waveGeo = new LineGeometry();
      this.halo.geometry = this.glow.geometry = this.core.geometry = this.waveGeo;
      this.waveLength = pos.length;
    }
    this.waveGeo.setPositions(pos);
    const c = new THREE.Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);
    // Bright enough to bloom, with a paler core.
    this.halo.material.color.copy(c);
    this.glow.material.color.copy(c).multiplyScalar(1.3);
    this.core.material.color.copy(c).lerp(new THREE.Color(1, 1, 1), 0.55).multiplyScalar(1.3);
    this.rim.color.copy(c);
  }

  // Photons at screen points [x, y, …], each `size` pixels across; null to hide. `energy` from 0 (radio) to 1
  // (the highest-energy gamma rays) sets how much they flare.
  photons(points, size, rgb, energy = 0) {
    this.dots.visible = !!points;
    if (!points) return;
    const p = this.dots.geometry.attributes.position, n = Math.min(MAX_POINTS, points.length / 2);
    for (let i = 0; i < n; i++) p.setXYZ(i, ...this.at(points[i * 2], points[i * 2 + 1]), 0);
    p.needsUpdate = true;
    this.dots.geometry.setDrawRange(0, n);
    this.dots.material.size = size; // three multiplies by the pixel ratio itself
    const c = new THREE.Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);
    // A few energetic photons flare; a crowd of them is kept dim so the beam does not wash out the view.
    this.dots.material.color.copy(c).multiplyScalar(0.7 + 6 * energy * Math.min(1, 40 / n));
    this.rim.color.copy(c);
  }

  render(t) {
    const m = this.current;
    if (m) {
      m.update(t, m.px);
      // Glowing points are sized in the model's units; turn that into the size three wants at this scale.
      const k = m.px / Math.tan((FOV / 2) * Math.PI / 180);
      for (const s of m.sparks) s.material.size = s.userData.base * k;
    }
    this.composer.render();
  }
}
