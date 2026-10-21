// Light in 3D: the electric field (in the wave's colour) and the magnetic field (pale blue) at right angles to
// each other and to the direction of travel. Linear or circular polarisation. Only runs while it is shown.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const N = 160, LENGTH = 12, WAVES = 3, AMP = 1.6;
export const SHOWN_HZ = 0.45; // cycles a second on screen

export class FieldView {
  constructor(host) {
    this.host = host;
    this.polar = 'linear';
    this.colour = new THREE.Color('#7cff7c');
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    host.appendChild(r.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.camera.position.set(-5.2, 3.4, 8.6);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 30;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.35;
    r.domElement.addEventListener('pointerdown', () => { this.controls.autoRotate = false; });

    // Direction of travel: the axis, with an arrowhead.
    const axisMat = new THREE.LineBasicMaterial({ color: 0x8b96aa, transparent: true, opacity: 0.6 });
    this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-LENGTH / 2 - 0.5, 0, 0), new THREE.Vector3(LENGTH / 2 + 0.8, 0, 0)]), axisMat));
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.45, 16), new THREE.MeshBasicMaterial({ color: 0x8b96aa }));
    head.rotation.z = -Math.PI / 2; head.position.x = LENGTH / 2 + 0.9;
    this.scene.add(head);

    // One wavelength, measured off under the wave like a dimension line.
    const y = -AMP - 0.6, x0 = -LENGTH / WAVES / 2, x1 = LENGTH / WAVES / 2, t = 0.18;
    const dim = [[x0, y, 0], [x1, y, 0], [x0, y - t, 0], [x0, y + t, 0], [x1, y - t, 0], [x1, y + t, 0]].map(p => new THREE.Vector3(...p));
    this.scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(dim), new THREE.LineBasicMaterial({ color: 0xf2b45a, transparent: true, opacity: 0.8 })));

    this.e = this.field(0xffffff);
    this.b = this.field(0xe8edf5);
    this.resize();
    new ResizeObserver(() => this.resize()).observe(host);
  }

  // A field: its curve plus a comb of vectors from the axis.
  field(colour) {
    const curve = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: colour }));
    curve.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    const comb = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity: 0.4 }));
    comb.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
    this.scene.add(curve, comb);
    return { curve, comb };
  }

  resize() {
    const { width, height } = this.host.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.renderer.domElement.style.width = `${width}px`;
    this.renderer.domElement.style.height = `${height}px`;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  setColour(rgb) {
    this.colour.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);
    this.e.curve.material.color.copy(this.colour);
    this.e.comb.material.color.copy(this.colour);
  }

  draw(t) {
    const phase = t * 2 * Math.PI * SHOWN_HZ;
    const circular = this.polar === 'circular';
    const ec = this.e.curve.geometry.attributes.position.array, eb = this.e.comb.geometry.attributes.position.array;
    const bc = this.b.curve.geometry.attributes.position.array, bb = this.b.comb.geometry.attributes.position.array;
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1), x = -LENGTH / 2 + u * LENGTH;
      const a = 2 * Math.PI * WAVES * u - phase;
      const env = Math.min(1, u * 12, (1 - u) * 12);
      // E along y (and z when circular); B is E turned 90° about the direction of travel.
      const ey = AMP * env * Math.sin(a), ez = circular ? AMP * env * Math.cos(a) : 0;
      const by = -ez, bz = ey;
      ec.set([x, ey, ez], i * 3); bc.set([x, by * 0.8, bz * 0.8], i * 3);
      eb.set([x, 0, 0, x, ey, ez], i * 6); bb.set([x, 0, 0, x, by * 0.8, bz * 0.8], i * 6);
    }
    for (const f of [this.e, this.b]) { f.curve.geometry.attributes.position.needsUpdate = true; f.comb.geometry.attributes.position.needsUpdate = true; }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  // Where to put the E, B and travel labels (screen pixels inside the host).
  labelPositions() {
    const { width, height } = this.host.getBoundingClientRect();
    const at = v => { const p = v.clone().project(this.camera); return { x: (p.x + 1) / 2 * width, y: (1 - p.y) / 2 * height }; };
    return { e: at(new THREE.Vector3(-LENGTH / 2 + 0.6, AMP + 0.5, 0)), b: at(new THREE.Vector3(-LENGTH / 2 + 0.6, 0, AMP * 0.8 + 0.4)), go: at(new THREE.Vector3(LENGTH / 2 + 1.3, 0.4, 0)), l: at(new THREE.Vector3(0, -AMP - 1.25, 0)) };
  }
}
