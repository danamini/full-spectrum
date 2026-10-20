// Through the air: how much light from space reaches the ground at each wavelength, and so which telescopes can
// sit on a mountain and which must go to space.
import { ATMOSPHERE, WINDOWS } from '../data/atmosphere.js';
import { wavelength, wavelengthFromEV } from './physics.js';
import * as fmt from './format.js';

const LOGS = ATMOSPHERE.metres.map(Math.log10);

// Fraction reaching the ground (0–1), interpolated in log wavelength.
export function transmission(metres) {
  const l = Math.log10(metres), n = LOGS.length;
  // The table may run either way; find the bracketing pair.
  const up = LOGS[n - 1] > LOGS[0];
  if (up ? l <= LOGS[0] : l >= LOGS[0]) return ATMOSPHERE.transmission[0];
  if (up ? l >= LOGS[n - 1] : l <= LOGS[n - 1]) return ATMOSPHERE.transmission[n - 1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; (up ? LOGS[mid] <= l : LOGS[mid] >= l) ? (lo = mid) : (hi = mid); }
  const t = (l - LOGS[lo]) / (LOGS[hi] - LOGS[lo]);
  return ATMOSPHERE.transmission[lo] + (ATMOSPHERE.transmission[hi] - ATMOSPHERE.transmission[lo]) * t;
}

// For the ribbon: the air's opacity hanging down from the top, like a curtain.
export const ribbonOverlay = () => ({ fill: 'rgba(3, 5, 11, 0.62)', sample: m => 1 - transmission(m) });

const hz = f => wavelength(f), ev = e => wavelengthFromEV(e);
// Telescopes, each with the range it works over (long end first) and where it is.
export const TELESCOPES = [
  { name: 'FAST', where: 'ground', from: hz(70e6), to: hz(3e9), note: 'China, 500 m dish' },
  { name: 'Very Large Array', where: 'ground', from: hz(74e6), to: hz(50e9), note: 'New Mexico' },
  { name: 'ALMA', where: 'ground', from: 3.6e-3, to: 0.32e-3, note: 'Chile, 5,000 m up, in some of the driest air on Earth' },
  { name: 'Planck', where: 'space', from: hz(30e9), to: hz(857e9), note: 'mapped the cosmic microwave background (2009–2013)' },
  { name: 'Herschel', where: 'space', from: 672e-6, to: 55e-6, note: 'far infrared (2009–2013)' },
  { name: 'James Webb', where: 'space', from: 28.5e-6, to: 0.6e-6, note: 'infrared, since 2022' },
  { name: 'Very Large Telescope', where: 'ground', from: 24e-6, to: 300e-9, note: 'Chile, visible and the infrared windows' },
  { name: 'Hubble', where: 'space', from: 2.5e-6, to: 115e-9, note: 'ultraviolet, visible and near infrared' },
  { name: 'Chandra', where: 'space', from: ev(100), to: ev(10e3), note: 'X-rays, since 1999' },
  { name: 'Fermi', where: 'space', from: ev(8e3), to: ev(300e9), note: 'gamma rays, since 2008' },
  { name: 'H.E.S.S.', where: 'ground', from: ev(30e9), to: ev(100e12), note: 'on the ground, but it watches the flashes gamma rays make high in the air' },
  { name: 'LHAASO', where: 'ground', from: ev(100e9), to: ev(1e16), note: 'catches the particle showers that reach a mountain in Tibet' },
];

export class AirView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
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

  hitAt(x, y) { return this.hits.find(h => x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) ?? null; }

  draw() {
    const { ctx, dpr, rect } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.size.w, this.size.h);
    this.hits = [];
    const L0 = 4, L1 = -18; // 10 km to 1 am
    const x0 = rect.x + 8, x1 = rect.x + rect.w - 44;
    const xOf = m => x0 + ((L0 - Math.log10(m)) / (L0 - L1)) * (x1 - x0);
    const chartTop = rect.y + 30, chartBot = rect.y + rect.h * 0.48;
    ctx.save();
    // Sky above, ground below; the curtain is what the air absorbs.
    const sky = ctx.createLinearGradient(0, chartTop, 0, chartBot);
    sky.addColorStop(0, 'rgba(40,60,110,0.25)'); sky.addColorStop(1, 'rgba(40,60,110,0.05)');
    ctx.fillStyle = sky; ctx.fillRect(x0, chartTop, x1 - x0, chartBot - chartTop);
    ctx.beginPath(); ctx.moveTo(x0, chartTop);
    for (let x = x0; x <= x1; x += 1.5) {
      const m = 10 ** (L0 - ((x - x0) / (x1 - x0)) * (L0 - L1));
      ctx.lineTo(x, chartTop + (1 - transmission(m)) * (chartBot - chartTop));
    }
    ctx.lineTo(x1, chartTop); ctx.closePath();
    const curtain = ctx.createLinearGradient(0, chartTop, 0, chartBot);
    curtain.addColorStop(0, '#5b6578'); curtain.addColorStop(1, '#2a3140');
    ctx.fillStyle = curtain; ctx.fill();
    ctx.strokeStyle = 'rgba(230,235,243,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(160,180,220,0.18)'; ctx.fillRect(x0, chartBot, x1 - x0, 2);
    ctx.font = '500 11px "IBM Plex Sans", sans-serif'; ctx.fillStyle = '#8b96aa'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('absorbed by the air', x0 + 6, chartTop + 4);
    ctx.textBaseline = 'bottom'; ctx.fillText('reaches the ground', x0 + 6, chartBot - 4);
    // The named windows.
    ctx.textAlign = 'center'; ctx.fillStyle = '#e6ebf3'; ctx.font = '600 11px "IBM Plex Sans", sans-serif';
    let lastX = -1e9;
    for (const w of WINDOWS) {
      const xa = xOf(w.from), xb = xOf(w.to), xm = (xa + xb) / 2;
      const tw = ctx.measureText(w.name).width;
      if (xm - tw / 2 < lastX + 6) continue;
      ctx.fillText(w.name, xm, chartBot - 18);
      lastX = xm + tw / 2;
      this.hits.push({ x0: xa, x1: Math.max(xb, xa + 6), y0: chartTop, y1: chartBot, text: `${w.name}: ${fmt.length(w.from)} – ${fmt.length(w.to)}${w.note ? `. ${w.note}` : ''}` });
    }
    // Scale.
    ctx.fillStyle = '#8b96aa'; ctx.font = '500 11px "IBM Plex Sans", sans-serif'; ctx.textBaseline = 'top';
    for (let e = L0; e >= L1; e -= 2) { const x = xOf(10 ** e); ctx.fillRect(x, chartBot + 2, 1, 4); ctx.fillText(fmt.length(10 ** e), x, chartBot + 8); }
    // Telescopes: ground ones below the line, space ones above the chart, as bars over their ranges.
    const rows = { space: [], ground: [] };
    const groundTop = chartBot + 36;
    ctx.font = '500 11.5px "IBM Plex Sans", sans-serif'; ctx.textBaseline = 'middle';
    for (const t of TELESCOPES) {
      const xa = xOf(t.from), xb = xOf(t.to);
      const tw = ctx.measureText(t.name).width;
      const x = Math.min(Math.max((xa + xb) / 2, x0 + tw / 2), x1 - tw / 2);
      const lane = t.where === 'space' ? rows.space : rows.ground;
      let row = 0;
      while (lane.some(r => r.row === row && x - tw / 2 - 8 < r.x1 && Math.max(xb, x + tw / 2) + 8 > r.x0)) row++;
      lane.push({ row, x0: Math.min(xa, x - tw / 2), x1: Math.max(xb, x + tw / 2) });
      const y = t.where === 'space' ? rect.y + rect.h * 0.62 + row * 30 : groundTop + row * 30;
      const col = t.where === 'space' ? '#7cc4ff' : '#f2b45a';
      ctx.fillStyle = col; ctx.globalAlpha = 0.85;
      ctx.fillRect(xa, y + 8, Math.max(3, xb - xa), 3);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center'; ctx.fillStyle = '#e6ebf3';
      ctx.fillText(t.name, x, y);
      this.hits.push({ x0: Math.min(xa, x - tw / 2), x1: Math.max(xb, x + tw / 2), y0: y - 9, y1: y + 12, text: `${t.name} (${t.where === 'space' ? 'in space' : 'on the ground'}): ${fmt.length(t.from)} – ${fmt.length(t.to)}. ${t.note}` });
    }
    // Legend.
    ctx.textAlign = 'left'; ctx.font = '500 11px "IBM Plex Sans", sans-serif';
    const ly = rect.y + rect.h - 12;
    ctx.fillStyle = '#f2b45a'; ctx.fillRect(x0, ly - 2, 14, 3); ctx.fillStyle = '#8b96aa'; ctx.fillText('on the ground', x0 + 20, ly);
    ctx.fillStyle = '#7cc4ff'; ctx.fillRect(x0 + 120, ly - 2, 14, 3); ctx.fillStyle = '#8b96aa'; ctx.fillText('in space', x0 + 140, ly);
    if (ATMOSPHERE.schematic) { ctx.fillStyle = '#5b6578'; ctx.textAlign = 'right'; ctx.fillText('Curve assembled from several sources; shape is approximate. See credits.', x1, ly); }
    // The cursor.
    const cx = xOf(this.metres);
    if (cx >= x0 && cx <= x1) { ctx.strokeStyle = '#f2b45a'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(cx, chartTop); ctx.lineTo(cx, chartBot); ctx.stroke(); ctx.setLineDash([]); }
    ctx.restore();
  }
}
