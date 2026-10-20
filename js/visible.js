// The visible band up close: a prism, the lines atoms draw, sunlight above and below the air, and who sees what.
// One canvas; `view` picks which.
import { spectral, css, VISIBLE } from './colour.js';
import { planck } from './physics.js';
import { EMISSION, FRAUNHOFER } from '../data/lines.js';
import { SOLAR } from '../data/solar.js';
import { CONES, ANIMALS } from '../data/cones.js';
import { BANDS } from './bands.js';

export const VIEWS = {
  prism: { name: 'Prism', blurb: 'White light into a dense flint glass prism (Schott SF11), ray-traced with the glass\'s measured dispersion. Shorter waves bend more. The faint dashed rays past each end are the infrared Herschel found with a thermometer in 1800 and the ultraviolet Ritter found with silver chloride in 1801.' },
  lines: { name: 'Atoms\' lines', blurb: 'Each element\'s electrons can only jump between fixed levels, so a glowing gas gives out a few exact colours, a barcode unique to the element. Sunlight has the same barcodes in reverse: dark lines where cooler gas in the Sun\'s atmosphere absorbs. Helium was found in the Sun\'s light in 1868, before anyone found it on Earth.' },
  sunlight: { name: 'Sunlight', blurb: 'The Sun\'s spectrum above the atmosphere and at the ground (with the Sun 48° from overhead), against a 5772 K blackbody. Ozone takes the ultraviolet; oxygen and water vapour bite chunks out of the infrared.' },
  eyes: { name: 'Who sees what', blurb: 'Your three cone types and their sensitivity (Stockman and Sharpe). Colour is the brain comparing them. Other animals cut the spectrum differently: bees see ultraviolet but not red; dogs have two cone types; snakes feel infrared as heat.' },
};

const VMIN = 380, VMAX = 750;
const R_SUN = 6.957e8, AU = 1.495978707e11;

// Schott SF11 dense flint glass, Sellmeier coefficients (Schott datasheet), λ in µm.
function nSF11(nm) {
  const l2 = (nm / 1000) ** 2;
  const B = [1.73759695, 0.313747346, 1.89878101], Cc = [0.013188707, 0.0623068142, 155.23629];
  return Math.sqrt(1 + B.reduce((s, b, i) => s + (b * l2) / (l2 - Cc[i]), 0));
}

// Bright version of a spectral colour, for drawing a thin line of light.
function bright(nm) {
  const rgb = spectral(nm).rgb, m = Math.max(...rgb, 1);
  return rgb.map(c => Math.round(c * Math.min(3, 240 / m)));
}

function refract(d, N, eta) {
  const cosi = -(d[0] * N[0] + d[1] * N[1]);
  const k = 1 - eta * eta * (1 - cosi * cosi);
  if (k < 0) return null;
  const a = eta * cosi - Math.sqrt(k);
  const t = [eta * d[0] + a * N[0], eta * d[1] + a * N[1]];
  const l = Math.hypot(...t);
  return [t[0] / l, t[1] / l];
}
function hit(p, d, a, b) { // ray p + s d against segment a–b
  const e = [b[0] - a[0], b[1] - a[1]], den = d[0] * e[1] - d[1] * e[0];
  if (Math.abs(den) < 1e-9) return null;
  const s = ((a[0] - p[0]) * e[1] - (a[1] - p[1]) * e[0]) / den;
  const u = ((a[0] - p[0]) * d[1] - (a[1] - p[1]) * d[0]) / den;
  return s > 1e-6 && u >= 0 && u <= 1 ? [p[0] + s * d[0], p[1] + s * d[1]] : null;
}

export class VisibleView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.view = 'prism';
    this.metres = 550e-9;
    this.rect = { x: 0, y: 0, w: 100, h: 100 };
    this.hits = [];
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
    const { ctx, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.size.w, this.size.h);
    this.hits = [];
    this[this.view](t);
  }

  hitAt(x, y) { return this.hits.find(h => Math.abs(h.x - x) <= 4 && y >= h.y0 && y <= h.y1) ?? null; }

  get cursorNm() { return this.metres * 1e9; }

  // ------------------------------------------------------------------ prism
  prism(t) {
    const { ctx, rect } = this;
    // Built around the prism's centre, then turned so the light comes in rising and leaves nearly level:
    // dense flint bends light by about 65°, too much to fit the view otherwise.
    const s = Math.min(rect.w * 0.22, rect.h * 0.5);
    const A = [0, -s * 0.577], BL = [-s / 2, s * 0.289], BR = [s / 2, s * 0.289];
    const unit = v => { const l = Math.hypot(...v); return [v[0] / l, v[1] / l]; };
    const nIn = unit([-(A[1] - BL[1]), A[0] - BL[0]]);      // inward normal of the left face
    const outN = unit([BR[1] - A[1], -(BR[0] - A[0])]);     // outward normal of the right face
    const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
    // Aim so yellow (589 nm) passes at minimum deviation: inside, parallel to the base.
    const n0 = nSF11(589), th1 = Math.asin(n0 * Math.sin(Math.PI / 6));
    const sgn = Math.sign(-nIn[1]) || 1;
    const d0 = rot(nIn, sgn * th1);
    const E = [(BL[0] + A[0]) / 2 + (A[0] - BL[0]) * 0.08, (BL[1] + A[1]) / 2 + (A[1] - BL[1]) * 0.08];
    const trace = nm => {
      const n = nSF11(nm);
      const t1 = refract(d0, nIn.map(v => -v), 1 / n);
      const P = t1 && (hit(E, t1, A, BR) ?? hit(E, t1, BR, BL));
      const t2 = P && refract(t1, outN.map(v => -v), n);
      return t2 ? { P, dir: t2 } : null;
    };
    const ref = trace(589);
    const dev = Math.atan2(ref.dir[1], ref.dir[0]) - Math.atan2(d0[1], d0[0]);
    const phi = -Math.atan2(ref.dir[1], ref.dir[0]) + dev * 0.18;  // leave the fan tilted slightly down
    // A screen square to the yellow ray.
    const L = rect.w * 0.5;
    const S0 = [ref.P[0] + ref.dir[0] * L, ref.P[1] + ref.dir[1] * L], sn = ref.dir;
    const onScreen = r => { const k = ((S0[0] - r.P[0]) * sn[0] + (S0[1] - r.P[1]) * sn[1]) / (r.dir[0] * sn[0] + r.dir[1] * sn[1]); return [r.P[0] + r.dir[0] * k, r.P[1] + r.dir[1] * k]; };
    const full = nm => { const r = trace(nm); return r && { E, P: r.P, Q: onScreen(r) }; };
    const cx = rect.x + rect.w * 0.3, cy = rect.y + rect.h * 0.5;
    const toPage = v => { const r = rot(v, phi); return [cx + r[0], cy + r[1]]; };

    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(phi);
    // The glass.
    ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...BR); ctx.lineTo(...BL); ctx.closePath();
    const g = ctx.createLinearGradient(BL[0], A[1], BR[0], BL[1]);
    g.addColorStop(0, 'rgba(160,190,230,0.12)'); g.addColorStop(1, 'rgba(160,190,230,0.04)');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(200,215,240,0.45)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    // The white beam in.
    const inLen = rect.w * 0.3;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3; ctx.shadowColor = '#fff'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.moveTo(E[0] - d0[0] * inLen, E[1] - d0[1] * inLen); ctx.lineTo(...E); ctx.stroke();
    ctx.shadowBlur = 0;
    // Infrared and ultraviolet, faint and dashed; then the visible fan.
    ctx.setLineDash([3, 5]); ctx.lineWidth = 1;
    for (const nm of [800, 900, 1000]) { const r = full(nm); if (r) { ctx.strokeStyle = 'rgba(190,90,90,0.55)'; this.ray(r); } }
    for (const nm of [365, 375]) { const r = full(nm); if (r) { ctx.strokeStyle = 'rgba(140,110,230,0.55)'; this.ray(r); } }
    ctx.setLineDash([]);
    const spots = [];
    for (let nm = VMIN; nm <= VMAX; nm += 3) {
      const r = full(nm); if (!r) continue;
      ctx.strokeStyle = css(bright(nm), 0.22); ctx.lineWidth = 2;
      this.ray(r);
      spots.push([nm, r.Q]);
    }
    // Pulses travelling along the fan.
    const u = (t * 0.35) % 1;
    for (let nm = VMIN; nm <= VMAX; nm += 15) {
      const r = full(nm); if (!r) continue;
      ctx.fillStyle = css(bright(nm), 0.9);
      ctx.beginPath(); ctx.arc(r.P[0] + (r.Q[0] - r.P[0]) * u, r.P[1] + (r.Q[1] - r.P[1]) * u, 2, 0, Math.PI * 2); ctx.fill();
    }
    // The cursor's wavelength, if it is in the fan.
    const cursor = this.cursorNm;
    if (cursor >= 330 && cursor <= 1050) {
      const r = full(cursor);
      if (r) { ctx.strokeStyle = cursor >= VMIN && cursor <= VMAX ? css(bright(cursor)) : '#f2b45a'; ctx.lineWidth = 2.5; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 10; this.ray(r); ctx.shadowBlur = 0; }
    }
    // The screen and the spectrum it catches.
    const along = [-sn[1], sn[0]];
    const ends = [full(1000) ?? full(VMAX), full(365) ?? full(VMIN)].map(r => r.Q);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(200,215,240,0.25)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(ends[0][0] - along[0] * 30, ends[0][1] - along[1] * 30); ctx.lineTo(ends[1][0] + along[0] * 30, ends[1][1] + along[1] * 30); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 10;
    for (let i = 0; i < spots.length - 1; i++) {
      ctx.strokeStyle = css(spectral(spots[i][0]).rgb);
      ctx.beginPath(); ctx.moveTo(spots[i][1][0] + sn[0] * 5, spots[i][1][1] + sn[1] * 5); ctx.lineTo(spots[i + 1][1][0] + sn[0] * 5, spots[i + 1][1][1] + sn[1] * 5); ctx.stroke();
    }
    ctx.restore();

    // Labels, upright.
    ctx.save();
    ctx.font = '500 12px "IBM Plex Sans", sans-serif'; ctx.fillStyle = '#8b96aa'; ctx.textAlign = 'left';
    const ir = full(1000), uv = full(365);
    if (ir) { const q = toPage(ir.Q); ctx.fillText('infrared', q[0] + 12, q[1] + 4); }
    if (uv) { const q = toPage(uv.Q); ctx.fillText('ultraviolet', q[0] + 12, q[1] + 4); }
    const w0 = toPage([E[0] - d0[0] * inLen * 0.8, E[1] - d0[1] * inLen * 0.8]);
    ctx.fillText('white light', w0[0] + 10, w0[1] + 18);
    const base = toPage(BL);
    ctx.fillStyle = '#5b6578'; ctx.textAlign = 'left';
    ctx.fillText('SF11 glass: refractive index', base[0] + 6, base[1] + 30);
    ctx.fillText(`${nSF11(700).toFixed(3)} at 700 nm, ${nSF11(400).toFixed(3)} at 400 nm`, base[0] + 6, base[1] + 46);
    ctx.restore();
  }

  ray({ E, P, Q }) {
    const { ctx } = this;
    ctx.beginPath(); ctx.moveTo(...E); ctx.lineTo(...P); ctx.lineTo(...Q); ctx.stroke();
  }

  // ------------------------------------------------------------------ lines
  lines() {
    const { ctx, rect } = this;
    const rows = [['Sunlight', null], ['Hydrogen', 'H'], ['Helium', 'He'], ['Sodium', 'Na'], ['Neon', 'Ne'], ['Mercury', 'Hg']];
    const labelW = 96, x0 = rect.x + labelW, x1 = rect.x + rect.w - 16;
    const rowH = Math.min(58, (rect.h - 70) / rows.length), gap = Math.min(16, rowH * 0.3);
    const xOf = nm => x0 + ((nm - VMIN) / (VMAX - VMIN)) * (x1 - x0);
    let y = rect.y + 34;
    ctx.save();
    ctx.font = '500 13px "IBM Plex Sans", sans-serif'; ctx.textBaseline = 'middle';
    for (const [name, el] of rows) {
      const h = rowH - gap;
      ctx.fillStyle = '#c4ccdb'; ctx.textAlign = 'left'; ctx.fillText(name, rect.x, y + h / 2);
      if (!el) {
        for (let x = x0; x < x1; x++) { const nm = VMIN + ((x - x0) / (x1 - x0)) * (VMAX - VMIN); ctx.fillStyle = css(spectral(nm).rgb); ctx.fillRect(x, y, 1.5, h); }
        const seen = new Set();
        ctx.font = '600 10.5px "IBM Plex Sans", sans-serif'; ctx.textAlign = 'center';
        for (const f of FRAUNHOFER.filter(f => !['Hg', 'He'].includes(f.element))) {
          const x = xOf(f.nm);
          if (x < x0 || x > x1) continue;
          const strong = ['C', 'D1', 'D2', 'F', 'H', 'K', 'b1', 'b2', 'G'].includes(f.name);
          ctx.fillStyle = `rgba(3,5,11,${strong ? 0.92 : 0.7})`;
          ctx.fillRect(x - (strong ? 1 : 0.6), y, strong ? 2 : 1.2, h);
          // One label for each close group (D1 and D2 read as "D", b1–b4 as "b").
          const label = /^[Db]\d$/.test(f.name) ? f.name[0] : f.name;
          if (!seen.has(label)) {
            seen.add(label);
            ctx.fillStyle = f.telluric ? '#5b6578' : '#8b96aa';
            ctx.fillText(label, label.length < f.name.length ? xOf(label === 'D' ? 589.29 : 517.5) : x, y - 9);
          }
          this.hits.push({ x, y0: y - 16, y1: y + h, text: `${f.name}: ${f.nm} nm, ${f.note}` });
        }
        ctx.font = '500 13px "IBM Plex Sans", sans-serif';
      } else {
        ctx.fillStyle = '#05070d'; ctx.fillRect(x0, y, x1 - x0, h);
        ctx.strokeStyle = 'rgba(160,180,220,0.14)'; ctx.strokeRect(x0 + 0.5, y + 0.5, x1 - x0 - 1, h - 1);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const [nm, rel] of EMISSION[el]) {
          if (nm < VMIN || nm > VMAX) continue;
          const x = xOf(nm), a = 0.3 + 0.7 * Math.sqrt(rel);
          ctx.fillStyle = css(bright(nm), a); ctx.shadowColor = css(bright(nm)); ctx.shadowBlur = 8 * a;
          ctx.fillRect(x - 1, y + 1, 2, h - 2);
          this.hits.push({ x, y0: y, y1: y + h, text: `${name}: ${nm} nm` });
        }
        ctx.restore();
      }
      y += rowH;
    }
    // Scale.
    ctx.fillStyle = '#8b96aa'; ctx.font = '500 11px "IBM Plex Sans", sans-serif'; ctx.textAlign = 'center';
    for (let nm = 400; nm <= 750; nm += 50) { const x = xOf(nm); ctx.fillRect(x, y - gap + 2, 1, 4); ctx.fillText(`${nm} nm`, x, y - gap + 16); }
    // The cursor.
    const c = this.cursorNm;
    if (c >= VMIN && c <= VMAX) {
      const x = xOf(c);
      ctx.strokeStyle = '#f2b45a'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(x, rect.y + 20); ctx.lineTo(x, y - gap); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ sunlight
  sunlight() {
    const { ctx, rect } = this;
    const lo = 280, hi = 2500, top = 2.25;
    const x0 = rect.x + 48, x1 = rect.x + rect.w - 12, y0 = rect.y + rect.h - 40, y1 = rect.y + 30;
    const xOf = nm => x0 + ((nm - lo) / (hi - lo)) * (x1 - x0);
    const yOf = v => y0 - (v / top) * (y0 - y1);
    const { nm, am0, am15g } = SOLAR;
    const sel = nm.map((n, i) => i).filter(i => nm[i] <= hi);
    ctx.save();
    // Axes and grid.
    ctx.strokeStyle = 'rgba(160,180,220,0.12)'; ctx.fillStyle = '#5b6578'; ctx.font = '500 11px "IBM Plex Sans", sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let v = 0; v <= 2; v += 0.5) { const y = yOf(v); ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.fillText(v.toFixed(1), x0 - 6, y); }
    ctx.save(); ctx.translate(rect.x + 10, (y0 + y1) / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText('W per m² per nm', 0, 0); ctx.restore();
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let v = 500; v <= hi; v += 500) { const x = xOf(v); ctx.fillText(v < 1000 ? `${v} nm` : `${v / 1000} µm`, x, y0 + 6); }
    // Above the air: filled, coloured by what the eye would see, false colour outside.
    for (const i of sel) {
      const n = nm[i], w = (i + 1 < nm.length ? xOf(nm[i + 1]) : x1) - xOf(n) + 0.6;
      const vis = n >= VMIN && n <= VMAX;
      const band = BANDS.find(b => n * 1e-9 <= b.from && n * 1e-9 > b.to);
      ctx.fillStyle = vis ? css(spectral(n).rgb, 0.85) : css(band.hue, 0.35);
      ctx.fillRect(xOf(n), yOf(am0[i]), w, y0 - yOf(am0[i]));
    }
    // At the ground.
    ctx.beginPath();
    sel.forEach((i, k) => (k ? ctx.lineTo(xOf(nm[i]), yOf(am15g[i])) : ctx.moveTo(xOf(nm[i]), yOf(am15g[i]))));
    ctx.strokeStyle = '#e6ebf3'; ctx.lineWidth = 1.4; ctx.stroke();
    // A 5772 K blackbody the size and distance of the Sun.
    ctx.beginPath();
    for (let n = lo; n <= hi; n += 5) {
      const v = Math.PI * planck(n * 1e-9, 5772) * (R_SUN / AU) ** 2 * 1e-9;
      n === lo ? ctx.moveTo(xOf(n), yOf(v)) : ctx.lineTo(xOf(n), yOf(v));
    }
    ctx.setLineDash([5, 4]); ctx.strokeStyle = '#f2b45a'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]);
    // Where the air takes its share.
    ctx.fillStyle = '#c4ccdb'; ctx.textBaseline = 'bottom';
    for (const [n, label] of [[300, 'ozone'], [762, 'oxygen'], [940, 'water'], [1130, 'water'], [1380, 'water'], [1870, 'water']]) {
      const i = nm.findIndex(v => v >= n);
      ctx.fillText(label, xOf(n), yOf(am15g[i]) - 6);
    }
    // Legend.
    const lx = x1 - 250, ly = y1 + 4;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(200,200,200,0.5)'; ctx.fillRect(lx, ly - 5, 18, 10); ctx.fillStyle = '#c4ccdb'; ctx.fillText('above the atmosphere', lx + 26, ly);
    ctx.strokeStyle = '#e6ebf3'; ctx.beginPath(); ctx.moveTo(lx, ly + 20); ctx.lineTo(lx + 18, ly + 20); ctx.stroke(); ctx.fillText('at the ground', lx + 26, ly + 20);
    ctx.setLineDash([5, 4]); ctx.strokeStyle = '#f2b45a'; ctx.beginPath(); ctx.moveTo(lx, ly + 40); ctx.lineTo(lx + 18, ly + 40); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillText('a 5772 K blackbody', lx + 26, ly + 40);
    // The cursor.
    const c = this.cursorNm;
    if (c >= lo && c <= hi) { ctx.strokeStyle = '#f2b45a'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(xOf(c), y0); ctx.lineTo(xOf(c), y1); ctx.stroke(); }
    ctx.restore();
  }

  // ------------------------------------------------------------------ eyes
  eyes() {
    const { ctx, rect } = this;
    const lo = 300, hi = 750;
    const labelW = 150;
    const x0 = rect.x + labelW, x1 = rect.x + rect.w - 16;
    const xOf = nm => x0 + ((nm - lo) / (hi - lo)) * (x1 - x0);
    const chartTop = rect.y + 24, chartBot = rect.y + rect.h * 0.52;
    const yOf = v => chartBot - v * (chartBot - chartTop);
    ctx.save();
    // The band underneath.
    for (let x = x0; x < x1; x++) {
      const nm = lo + ((x - x0) / (x1 - x0)) * (hi - lo);
      ctx.fillStyle = nm >= VMIN ? css(spectral(nm).rgb) : 'rgba(118,92,196,0.35)';
      ctx.fillRect(x, chartBot + 4, 1.5, 10);
    }
    ctx.fillStyle = '#8b96aa'; ctx.font = '500 11px "IBM Plex Sans", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let nm = 300; nm <= 750; nm += 50) ctx.fillText(`${nm}`, xOf(nm), chartBot + 18);
    ctx.fillText('ultraviolet', xOf(340), chartBot - 16);
    // Human cones.
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#c4ccdb'; ctx.font = '500 13px "IBM Plex Sans", sans-serif';
    ctx.fillText('You', rect.x, (chartTop + chartBot) / 2 - 8);
    ctx.fillStyle = '#5b6578'; ctx.font = '400 11px "IBM Plex Sans", sans-serif';
    ctx.fillText('three cone types', rect.x, (chartTop + chartBot) / 2 + 8);
    const { start, step } = CONES;
    for (const [key, label, colour] of [['s', 'S cones', '#6f7bff'], ['m', 'M cones', '#59d36b'], ['l', 'L cones', '#ff6a5a']]) {
      const arr = CONES[key];
      ctx.beginPath();
      arr.forEach((v, i) => { const nm = start + i * step; if (nm > hi) return; const x = xOf(nm), y = yOf(v); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.strokeStyle = colour; ctx.lineWidth = 2; ctx.stroke();
      const peak = arr.indexOf(Math.max(...arr));
      // M and L peak close together: label M to the left of its peak, L to the right.
      const align = { s: 'center', m: 'right', l: 'left' }[key], dx = { s: 0, m: -6, l: 6 }[key];
      ctx.fillStyle = colour; ctx.font = '600 11px "IBM Plex Sans", sans-serif'; ctx.textAlign = align;
      ctx.fillText(`${label} · ${start + peak * step} nm`, xOf(start + peak * step) + dx, yOf(1) - 10);
    }
    // Other animals, one row each.
    let y = chartBot + 52;
    const rowH = Math.min(40, (rect.y + rect.h - y) / ANIMALS.length);
    for (const a of ANIMALS) {
      ctx.textAlign = 'left'; ctx.fillStyle = '#c4ccdb'; ctx.font = '500 12px "IBM Plex Sans", sans-serif';
      ctx.fillText(a.animal.replace(/ \(.*\)/, ''), rect.x, y);
      ctx.strokeStyle = 'rgba(160,180,220,0.14)'; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      if (a.peaksNm) for (const p of a.peaksNm) {
        const col = p < VMIN ? '#9a7cff' : css(bright(p));
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(xOf(p), y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.font = '500 10.5px "IBM Plex Sans", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`${p}`, xOf(p), y - 12);
      } else if (a.rangeNm) {
        const g = ctx.createLinearGradient(xOf(a.rangeNm[0]), 0, xOf(a.rangeNm[1]), 0);
        g.addColorStop(0, '#9a7cff'); g.addColorStop(0.5, '#59d36b'); g.addColorStop(1, '#ff6a5a');
        ctx.fillStyle = g; ctx.fillRect(xOf(a.rangeNm[0]), y - 3, xOf(a.rangeNm[1]) - xOf(a.rangeNm[0]), 6);
        ctx.fillStyle = '#8b96aa'; ctx.font = '500 10.5px "IBM Plex Sans", sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('12 receptor types, 300–720 nm', (xOf(a.rangeNm[0]) + xOf(a.rangeNm[1])) / 2, y - 12);
      } else {
        ctx.fillStyle = '#c87878'; ctx.textAlign = 'right'; ctx.font = '500 11px "IBM Plex Sans", sans-serif';
        ctx.fillText('feels infrared as heat, far past red →', x1, y - 10);
      }
      y += rowH;
    }
    // The cursor.
    const c = this.cursorNm;
    if (c >= lo && c <= hi) { ctx.strokeStyle = '#f2b45a'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(xOf(c), chartTop); ctx.lineTo(xOf(c), y - rowH + 8); ctx.stroke(); }
    ctx.restore();
  }
}

export { VISIBLE };
