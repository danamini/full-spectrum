// Light from hot things: Planck's law at any temperature, its peak (Wien's law) and the colour it glows.
import { planck, wienPeak } from './physics.js';
import { blackbody as glow, spectral, css, VISIBLE } from './colour.js';
import * as fmt from './format.js';

export const T_MIN = 2.7255, T_MAX = 1e7;

export const PRESETS = [
  { key: 'cmb', name: 'The cosmic microwave background', k: 2.7255 },
  { key: 'nitrogen', name: 'Liquid nitrogen', k: 77 },
  { key: 'you', name: 'You', k: 310 },
  { key: 'oven', name: 'A hot oven (200 °C)', k: 473 },
  { key: 'red-hot', name: 'Red hot (the Draper point)', k: 798 },
  { key: 'lava', name: 'Lava', k: 1400 },
  { key: 'filament', name: 'A tungsten filament', k: 2700 },
  { key: 'sun', name: 'The Sun\'s surface', k: 5772 },
  { key: 'sirius', name: 'Sirius', k: 9940 },
  { key: 'spica', name: 'Spica, a blue giant', k: 25400 },
  { key: 'corona', name: 'The Sun\'s corona', k: 1.5e6 },
];

// Peak spectral radiance (per unit wavelength) of a blackbody, from Wien's law.
const peakB = k => planck(wienPeak(k), k);

// What a blackbody at this temperature looks like, in words.
export function glowText(k) {
  if (k < 700) return 'Too cool to glow: all its light is infrared or longer.';
  if (k < 1000) return 'A dull red glow, only visible in the dark. Objects start to glow visibly at about 800 K, the Draper point.';
  if (k < 2000) return 'Glowing orange-red.';
  if (k < 4000) return 'Glowing yellow-orange, like a filament bulb.';
  if (k < 7000) return 'White. The Sun is white; it only looks yellow low in the sky, through more air.';
  if (k < 40000) return 'Blue-white, like the hottest stars.';
  return 'So hot that most of its light is ultraviolet and X-rays; what reaches the eye looks blue-white.';
}

// For the ribbon: the curve's shape across the whole spectrum, on a log scale (1 at the peak, 0 a millionth of it).
export const ribbonOverlay = k => ({
  colour: '#f2b45a',
  sample: m => { const b = planck(m, k); return b > 0 ? 1 + Math.log10(b / peakB(k)) / 6 : 0; },
});

export class BlackbodyView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.kelvin = 5772;
    this.rect = { x: 0, y: 0, w: 100, h: 100 };
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

  draw() {
    const { ctx, dpr, rect } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.size.w, this.size.h);
    const k = this.kelvin;
    const swatch = Math.min(rect.h * 0.3, 150);
    const x0 = rect.x + 54, x1 = rect.x + rect.w - swatch - 40, y0 = rect.y + rect.h - 34, y1 = rect.y + 20;
    // Wavelength 0.1 nm to 10 cm, log; radiance over 36 decades, log.
    const L0 = -10, L1 = -1, B0 = -8, B1 = 30;
    const xOf = m => x0 + ((Math.log10(m) - L0) / (L1 - L0)) * (x1 - x0);
    const yOf = b => y0 - ((Math.log10(Math.max(b, 1e-300)) - B0) / (B1 - B0)) * (y0 - y1);
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, y1, x1 - x0, y0 - y1); ctx.clip();
    // The visible band, behind.
    for (let x = xOf(VISIBLE.from); x <= xOf(VISIBLE.to); x += 1) {
      const m = 10 ** (L0 + ((x - x0) / (x1 - x0)) * (L1 - L0));
      ctx.fillStyle = css(spectral(m * 1e9).rgb, 0.22); ctx.fillRect(x, y1, 1.2, y0 - y1);
    }
    // The presets, faint, then this temperature.
    const curve = (kk, close) => {
      ctx.beginPath();
      for (let x = x0; x <= x1; x += 2) {
        const m = 10 ** (L0 + ((x - x0) / (x1 - x0)) * (L1 - L0));
        const y = yOf(planck(m, kk));
        x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      if (close) { ctx.lineTo(x1, y0); ctx.lineTo(x0, y0); ctx.closePath(); }
    };
    ctx.strokeStyle = 'rgba(160,180,220,0.16)'; ctx.lineWidth = 1;
    for (const p of PRESETS) { curve(p.k); ctx.stroke(); }
    const g = glow(k);
    const col = g ? g.rgb : [242, 180, 90];
    curve(k, true); ctx.fillStyle = css(col, 0.14); ctx.fill();
    curve(k); ctx.strokeStyle = css(k < 700 ? [242, 180, 90] : col); ctx.lineWidth = 2.4; ctx.stroke();
    ctx.restore();

    // Axes.
    ctx.save();
    ctx.font = '500 11px "IBM Plex Sans", sans-serif'; ctx.fillStyle = '#8b96aa'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let e = L0; e <= L1; e++) { const x = xOf(10 ** e); ctx.fillRect(x, y0, 1, 4); ctx.fillText(fmt.length(10 ** e), x, y0 + 7); }
    ctx.strokeStyle = 'rgba(160,180,220,0.22)'; ctx.strokeRect(x0 + 0.5, y1 + 0.5, x1 - x0, y0 - y1);
    ctx.save(); ctx.translate(rect.x + 18, (y0 + y1) / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = 'middle';
    ctx.fillText('brightness per wavelength (log scale: each step ×10)', 0, 0); ctx.restore();
    // Peak.
    const pk = wienPeak(k);
    if (pk >= 10 ** L0 && pk <= 10 ** L1) {
      const x = xOf(pk), y = yOf(peakB(k));
      ctx.fillStyle = '#f2b45a'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.textBaseline = 'bottom'; ctx.font = '600 12px "IBM Plex Sans", sans-serif';
      ctx.fillText(`peak ${fmt.length(pk)}`, Math.min(Math.max(x, x0 + 40), x1 - 40), y - 8);
    }
    // The glow.
    const sx = rect.x + rect.w - swatch / 2 - 16, sy = rect.y + rect.h * 0.4;
    if (k >= 700 && g) {
      const a = Math.min(1, Math.max(0.15, (k - 700) / 900));
      const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, swatch / 2);
      rg.addColorStop(0, css(col.map(c => Math.min(255, c + 40)), a)); rg.addColorStop(0.6, css(col, a)); rg.addColorStop(1, css(col, 0));
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(sx, sy, swatch / 2, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(160,180,220,0.3)'; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(sx, sy, swatch / 2 - 10, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#e6ebf3'; ctx.font = '700 22px "Big Shoulders Display", sans-serif';
    ctx.fillText(fmt.kelvin(k), sx, sy + swatch / 2 + 8);
    ctx.restore();
  }
}
