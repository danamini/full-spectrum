// The wave view: the light at the cursor as a travelling wave beside a real thing of the same size, or as a
// stream of photons. Words and measurements are drawn on a 2D canvas inside the rectangle the page leaves free;
// the thing, the wave and the photons go to the 3D stage underneath (wave3d.js) once it has loaded. Until then,
// or without WebGL, the wave and photons are drawn flat and the thing is left out.
import { frequency, photonEnergyEV, photons } from './physics.js';
import { bandAt } from './bands.js';
import { spectral, VISIBLE } from './colour.js';
import { pick } from './scale.js';
import * as fmt from './format.js';

const WAVES = 3.25;        // wavelengths across the view
const SHOWN_HZ = 0.55;     // how fast the wave goes by on screen
const MAX_DOTS = 420;

// The colour to draw light of this wavelength: its own colour if we can see it, else its band's false colour.
export function waveColour(metres) {
  if (metres <= VISIBLE.from && metres >= VISIBLE.to) {
    const rgb = spectral(metres * 1e9).rgb;
    const m = Math.max(...rgb, 1);
    return { rgb: rgb.map(c => Math.round(c * Math.min(2.2, 235 / m))), real: true }; // full brightness to draw a line
  }
  const hue = bandAt(metres).hue;
  return { rgb: hue.map(c => Math.min(255, Math.round(c * 1.45))), real: false };
}

export class WaveView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.metres = 550e-9;
    this.mode = 'wave';
    this.rect = { x: 0, y: 0, w: 100, h: 100 };
    this.dots = Array.from({ length: MAX_DOTS }, () => ({ x: Math.random(), y: (Math.random() + Math.random() + Math.random()) / 3 - 0.5 }));
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    this.size = { w: r.width, h: r.height };
  }

  draw(t) {
    const { ctx, dpr, stage } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.size.w, this.size.h);
    if (stage) stage.resize(this.size.w, this.size.h, Math.min(this.dpr, 1.5));
    if (this.mode === 'photons') this.drawPhotons(t); else this.drawWave(t);
    stage?.render(t);
  }

  drawWave(t) {
    const { ctx, rect } = this;
    const λ = this.metres;
    const W = rect.w * 0.88, x0 = rect.x + (rect.w - W) / 2, cy = rect.y + rect.h * 0.46;
    const A = Math.min(rect.h * 0.2, W * 0.12);
    const physW = WAVES * λ;
    const pxPerλ = W / WAVES;
    const { rgb } = waveColour(λ);
    const colour = `rgb(${rgb.join(' ')})`;

    // The thing to compare with, behind the wave.
    const obj = pick(physW);
    const spx = (obj.m / physW) * W;
    const ocx = rect.x + rect.w / 2;
    const shown = spx >= 3 && spx <= W * 1.6;
    this.stage?.model(shown ? obj.key : null, ocx, cy, spx);
    this.shown = shown && this.stage ? obj.key : null; // for the credit under the picture
    ctx.save();
    if (shown) {
      // Its size, measured underneath (or beside, for tall things).
      ctx.strokeStyle = 'rgba(230, 235, 243, 0.45)'; ctx.fillStyle = '#c4ccdb'; ctx.lineWidth = 1;
      ctx.font = '500 12px "IBM Plex Sans", sans-serif'; ctx.textAlign = 'center';
      const label = `${obj.name} · ${fmt.length(obj.m)}`;
      if (obj.tall) {
        const lx = ocx + Math.max(spx * 0.3, 14) + 8, top = cy - spx / 2, bot = cy + spx / 2;
        if (spx < rect.h * 1.2) { this.dim(lx, top, lx, bot); }
        ctx.textAlign = 'left';
        ctx.fillText(label, lx + 8, Math.min(rect.y + rect.h - 10, Math.max(rect.y + 16, cy + A + 34)));
      } else {
        const ly = Math.min(rect.y + rect.h - 26, cy + Math.max(A, spx * 0.36) + 22);
        this.dim(ocx - spx / 2, ly, ocx + spx / 2, ly);
        ctx.fillText(label, ocx, ly + 18);
      }
    } else {
      ctx.fillStyle = '#c4ccdb'; ctx.font = '500 12px "IBM Plex Sans", sans-serif'; ctx.textAlign = 'center';
      const n = fmt.count(spx < 3 ? physW / obj.m : obj.m / physW);
      if (spx < 3) {
        ctx.beginPath(); ctx.arc(ocx, cy, 5, 0, Math.PI * 2); ctx.strokeStyle = '#f2b45a'; ctx.stroke();
        ctx.fillText(`${obj.name} (${fmt.length(obj.m)}) is in the ring, ${n} times smaller than this picture`, ocx, cy + A + 40);
      } else {
        ctx.fillText(`${obj.name} (${fmt.length(obj.m)}) is ${n} times wider than this whole picture`, ocx, cy + A + 40);
      }
    }
    ctx.restore();

    // The wave, glowing.
    const phase = 2 * Math.PI * SHOWN_HZ * t;
    const pts = [];
    for (let i = 0; i <= W; i += 2) {
      const e = Math.min(1, Math.min(i, W - i) / 70), envelope = e * e * (3 - 2 * e);
      pts.push(x0 + i, cy - A * envelope * Math.sin((2 * Math.PI * i) / pxPerλ - phase));
    }
    if (this.stage) { this.stage.wave(pts, rgb); this.stage.photons(null); }
    else {
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < pts.length; i += 2) i ? ctx.lineTo(pts[i], pts[i + 1]) : ctx.moveTo(pts[i], pts[i + 1]);
      ctx.lineJoin = 'round';
      ctx.shadowColor = colour; ctx.shadowBlur = 18;
      ctx.strokeStyle = colour; ctx.lineWidth = 3;
      ctx.stroke();
      ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }

    // One wavelength, crest to crest, measured above.
    let crest = ((0.25 + phase / (2 * Math.PI)) % 1) * pxPerλ;
    if (crest < pxPerλ * 0.6) crest += pxPerλ;
    const yb = cy - A - 26;
    ctx.save();
    ctx.strokeStyle = '#f2b45a'; ctx.fillStyle = '#f2b45a'; ctx.lineWidth = 1;
    this.dim(x0 + crest, yb, x0 + crest + pxPerλ, yb, '#f2b45a');
    ctx.setLineDash([2, 3]);
    for (const x of [x0 + crest, x0 + crest + pxPerλ]) { ctx.beginPath(); ctx.moveTo(x, yb + 4); ctx.lineTo(x, cy - A + 2); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.font = '600 13px "IBM Plex Sans", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`one wavelength: ${fmt.length(λ)}`, x0 + crest + pxPerλ / 2, yb - 9);
    ctx.restore();

    // How much it is slowed down.
    const f = frequency(λ);
    ctx.fillStyle = '#5b6578'; ctx.font = '400 12px "IBM Plex Sans", sans-serif'; ctx.textAlign = 'center';
    const slow = [`Slowed down ${fmt.sci(f / SHOWN_HZ)} times:`, `it really goes by ${fmt.count(f)} times a second.`];
    if (ctx.measureText(slow.join(' ')).width < rect.w - 16) ctx.fillText(slow.join(' '), rect.x + rect.w / 2, rect.y + rect.h - 6);
    else slow.forEach((line, i) => ctx.fillText(line, rect.x + rect.w / 2, rect.y + rect.h - 22 + i * 16));
  }

  drawPhotons(t) {
    const { ctx, rect } = this;
    const λ = this.metres;
    const ev = photonEnergyEV(λ);
    const { perMetre } = photons(λ);
    const exact = perMetre <= MAX_DOTS;
    const n = exact ? Math.max(0, Math.round(perMetre)) : MAX_DOTS;
    const { rgb } = waveColour(λ);
    const W = rect.w * 0.88, x0 = rect.x + (rect.w - W) / 2, cy = rect.y + rect.h * 0.3; // high, to leave room for the cards below
    const beam = Math.min(rect.h * 0.26, 150);
    // Size and glow grow with energy: from a speck for radio to a flare for gamma.
    const e = Math.min(1, Math.max(0, (Math.log10(ev) + 9) / 24));
    const r = 0.9 + e * 3.6;

    ctx.save();
    const g = ctx.createLinearGradient(0, cy - beam / 2, 0, cy + beam / 2);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(${rgb.join(',')},0.07)`); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(x0, cy - beam / 2, W, beam);
    const speed = 0.16, pts = [];
    for (let i = 0; i < n; i++) { const d = this.dots[i]; pts.push(x0 + (((d.x + t * speed) % 1) * W), cy + d.y * beam); }
    this.shown = null;
    if (this.stage) { this.stage.model(null); this.stage.wave(null); this.stage.photons(pts, r * 2 + 3 + e * 10, rgb, e); }
    else {
      ctx.fillStyle = `rgb(${rgb.join(' ')})`;
      ctx.shadowColor = `rgb(${rgb.join(' ')})`; ctx.shadowBlur = 4 + e * 14;
      for (let i = 0; i < pts.length; i += 2) { ctx.beginPath(); ctx.arc(pts[i], pts[i + 1], r, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();

    ctx.save();
    this.dim(x0, cy + beam / 2 + 18, x0 + W, cy + beam / 2 + 18);
    ctx.fillStyle = '#c4ccdb'; ctx.font = '500 12px "IBM Plex Sans", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('one metre of a 1 milliwatt beam', rect.x + rect.w / 2, cy + beam / 2 + 36);
    this.below = cy + beam / 2 + 56; // where the cards under the beam can start
    ctx.font = '600 15px "IBM Plex Sans", sans-serif'; ctx.fillStyle = '#e6ebf3';
    const what = exact ? `${n === 1 ? 'one photon' : `${fmt.count(perMetre)} photons`}, each carrying ${fmt.energy(ev)}`
      : `${fmt.count(perMetre)} photons, far too many to draw; each carries just ${fmt.energy(ev)}`;
    // On a narrow screen, two lines, broken at the semicolon or comma.
    if (ctx.measureText(what).width < rect.w - 16) ctx.fillText(what, rect.x + rect.w / 2, cy - beam / 2 - 18);
    else { const i = what.search(/[;,] /); [what.slice(0, i + 1), what.slice(i + 2)].forEach((line, k) => ctx.fillText(line, rect.x + rect.w / 2, cy - beam / 2 - 36 + k * 18)); }
    ctx.restore();
  }

  // A dimension line with end ticks.
  dim(x1, y1, x2, y2, colour = 'rgba(230, 235, 243, 0.55)') {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = colour; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    const vertical = Math.abs(x2 - x1) < Math.abs(y2 - y1);
    for (const [x, y] of [[x1, y1], [x2, y2]]) {
      if (vertical) { ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); } else { ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5); }
    }
    ctx.stroke();
    ctx.restore();
  }
}
