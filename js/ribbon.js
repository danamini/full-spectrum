// The ribbon: the whole spectrum on a log scale, longest waves on the left, read through a fixed cursor in
// the middle like a radio dial. Drag or scroll to tune, pinch or scroll with ctrl to zoom, click to go.
import { C, photonEnergyEV, wavelengthFromEV } from './physics.js';
import { BANDS, SPAN } from './bands.js';
import { THINGS } from './things.js';
import { spectral, VISIBLE, css } from './colour.js';
import * as fmt from './format.js';

const LOG_LONG = Math.log10(SPAN.long), LOG_SHORT = Math.log10(SPAN.short);
const FULL = LOG_LONG - LOG_SHORT;
const MIN_SPAN = 0.006, MAX_SPAN = FULL * 1.06;

// Track layout, top to bottom (CSS pixels).
const T = { freq: 16, bands: 20, subs: 18, strip: 46, things: 30, wave: 16, energy: 16 };

const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

// Tick values between lo and hi (both > 0) that are round in their own units and at least `minPx` apart.
function ticks(lo, hi, pxPerDecade, minPx) {
  const out = [];
  const decades = Math.log10(hi / lo);
  if (decades > 1.2 || pxPerDecade < minPx * 3) {
    const every = Math.max(1, Math.ceil(minPx / pxPerDecade));
    for (let k = Math.ceil(Math.log10(lo)); k <= Math.floor(Math.log10(hi)); k++) if (k % every === 0) out.push(10 ** k);
    if (pxPerDecade > minPx * 3) {
      for (let k = Math.floor(Math.log10(lo)); k <= Math.ceil(Math.log10(hi)); k++) {
        for (const m of pxPerDecade > minPx * 6 ? [2, 5] : [3]) { const v = m * 10 ** k; if (v >= lo && v <= hi) out.push(v); }
      }
    }
    return out;
  }
  // Under about a decade wide: round steps in the local unit.
  const n = Math.max(2, (decades * pxPerDecade) / minPx);
  const raw = (hi - lo) / n, p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * p).find(s => s >= raw);
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(Number(v.toPrecision(12)));
  return out;
}

export class Ribbon {
  constructor(canvas, { onChange, onPick } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onChange = onChange;
    this.onPick = onPick;
    this.centre = Math.log10(550e-9);
    this.span = FULL;
    this.overlays = [];
    this.marked = null; // a thing to highlight
    this.anim = null;
    this.velocity = 0;
    this.dirty = true;
    this.hits = [];
    this.height = Object.values(T).reduce((a, b) => a + b, 0);
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    this.bindPointer();
  }

  get metres() { return 10 ** this.centre; }
  get pxPerDecade() { return this.w / this.span; }
  xOf(metres) { return this.w / 2 - (Math.log10(metres) - this.centre) * this.pxPerDecade; }
  metresAt(x) { return 10 ** (this.centre - (x - this.w / 2) / this.pxPerDecade); }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.w = Math.max(1, r.width);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.canvas.style.height = `${this.height}px`;
    this.dirty = true;
  }

  // Sets the view at once (no animation).
  set(metres, span = this.span) {
    this.anim = null;
    this.velocity = 0;
    this.centre = Math.min(LOG_LONG, Math.max(LOG_SHORT, Math.log10(metres)));
    this.span = Math.min(MAX_SPAN, Math.max(MIN_SPAN, span));
    this.changed();
  }

  // Glides to a wavelength and zoom; long trips zoom out on the way so you see where you are going.
  tune(metres, span = this.span, ms = 1600) {
    const c1 = Math.min(LOG_LONG, Math.max(LOG_SHORT, Math.log10(metres)));
    const s1 = Math.min(MAX_SPAN, Math.max(MIN_SPAN, span));
    const c0 = this.centre, s0 = this.span;
    const lift = Math.max(0, Math.log(Math.abs(c1 - c0) * 1.4) - Math.max(Math.log(s0), Math.log(s1)));
    this.velocity = 0;
    const duration = ms * (lift > 0 ? 1.25 : Math.abs(c1 - c0) > 0.001 || Math.abs(s1 - s0) > 0.001 ? 1 : 0);
    if (!duration) return Promise.resolve();
    return new Promise(done => { this.anim = { c0, c1, s0, s1, lift, t0: performance.now(), duration, done }; });
  }

  zoomBy(f) { this.anim = null; this.span = Math.min(MAX_SPAN, Math.max(MIN_SPAN, this.span * f)); this.changed(); }
  nudge(decades) { this.anim = null; this.set(10 ** (this.centre + decades)); }

  changed() { this.dirty = true; this.onChange?.(this.metres, this.span); }

  setOverlays(list) { this.overlays = list; this.dirty = true; }

  step(now) {
    if (this.anim) {
      const a = this.anim, t = Math.min(1, (now - a.t0) / a.duration), e = ease(t);
      this.centre = a.c0 + (a.c1 - a.c0) * e;
      this.span = Math.exp(Math.log(a.s0) + (Math.log(a.s1) - Math.log(a.s0)) * e + a.lift * Math.sin(Math.PI * e));
      if (t >= 1) { this.anim = null; a.done(); }
      this.changed();
    } else if (Math.abs(this.velocity) > 1e-4 && !this.dragging) {
      this.centre = Math.min(LOG_LONG, Math.max(LOG_SHORT, this.centre + this.velocity));
      this.velocity *= 0.92;
      this.changed();
    }
    if (this.dirty) { this.dirty = false; this.draw(); }
  }

  bindPointer() {
    const c = this.canvas, pts = new Map();
    let start = null, moved = 0, last = null, pinch = null;
    c.addEventListener('pointerdown', e => {
      c.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, e.clientX);
      this.anim = null; this.velocity = 0;
      if (pts.size === 1) { start = e.clientX; last = { x: e.clientX, t: performance.now() }; moved = 0; this.dragging = true; }
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.abs(a - b), span: this.span }; }
    });
    c.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) {
        const hit = this.hitAt(e.offsetX, e.offsetY);
        c.style.cursor = hit ? 'pointer' : 'grab';
        c.title = hit ? `${hit.thing.name}: ${fmt.length(hit.thing.m)}` : '';
        return;
      }
      pts.set(e.pointerId, e.clientX);
      if (pts.size === 2 && pinch) {
        const [a, b] = [...pts.values()];
        this.span = Math.min(MAX_SPAN, Math.max(MIN_SPAN, pinch.span * pinch.d / Math.max(20, Math.abs(a - b))));
        this.changed();
        return;
      }
      const now = performance.now(), dx = e.clientX - last.x;
      moved += Math.abs(dx);
      this.centre = Math.min(LOG_LONG, Math.max(LOG_SHORT, this.centre + dx / this.pxPerDecade));
      this.velocity = (dx / this.pxPerDecade) * Math.min(1, 16 / Math.max(1, now - last.t));
      last = { x: e.clientX, t: now };
      this.changed();
    });
    const up = e => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 0) {
        this.dragging = false;
        if (moved < 5) {
          this.velocity = 0;
          const hit = this.hitAt(e.offsetX, e.offsetY);
          if (hit) this.onPick?.(hit.thing);
          else this.tune(this.metresAt(e.offsetX), this.span, 700);
        }
      }
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', e => {
      e.preventDefault();
      this.anim = null; this.velocity = 0;
      if (e.ctrlKey || Math.abs(e.deltaY) > Math.abs(e.deltaX) * 1.2 && !e.shiftKey) {
        this.span = Math.min(MAX_SPAN, Math.max(MIN_SPAN, this.span * Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))));
      } else {
        const d = e.shiftKey ? e.deltaY : e.deltaX;
        this.centre = Math.min(LOG_LONG, Math.max(LOG_SHORT, this.centre - d / this.pxPerDecade));
      }
      this.changed();
    }, { passive: false });
  }

  hitAt(x, y) { return this.hits.find(h => x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) ?? null; }

  draw() {
    const { ctx, w, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, this.height);
    const lo = this.metresAt(w), hi = this.metresAt(0); // shortest, longest on screen
    const ppd = this.pxPerDecade;
    let y = 0;

    // Frequency scale.
    ctx.font = '500 10.5px "IBM Plex Sans", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    this.scale(ticks(C / hi, C / lo, ppd, 84), f => this.xOf(C / f), fmt.frequency, y, T.freq, 'top');
    y += T.freq;

    // Bands and sub-bands.
    for (const [list, h, big] of [[BANDS, T.bands, true], [BANDS.flatMap(b => b.subs), T.subs, false]]) {
      for (const b of list) {
        const x0 = Math.max(-2, this.xOf(b.from)), x1 = Math.min(w + 2, this.xOf(b.to));
        if (x1 < 0 || x0 > w) continue;
        ctx.fillStyle = 'rgba(160, 180, 220, 0.22)';
        if (this.xOf(b.from) >= 0) ctx.fillRect(this.xOf(b.from), y + 3, 1, h - 6);
        const label = big ? b.name.toUpperCase() : b.name;
        ctx.font = big ? '700 13px "Big Shoulders Display", sans-serif' : '500 10.5px "IBM Plex Sans", sans-serif';
        const tw = ctx.measureText(label).width;
        if (x1 - x0 < tw + 10) continue;
        const cx = Math.min(Math.max((x0 + x1) / 2, x0 + tw / 2 + 6), x1 - tw / 2 - 6);
        const here = this.metres <= b.from && this.metres > b.to;
        ctx.fillStyle = here ? '#e6ebf3' : big ? '#8b96aa' : '#5b6578';
        ctx.letterSpacing = big ? '0.08em' : '0';
        ctx.fillText(label, cx, y + h / 2 + 1);
        ctx.letterSpacing = '0';
      }
      y += h;
    }

    // The strip: true colour in the visible band, muted and hatched false colour everywhere else.
    const sy = y, sh = T.strip;
    const step = 2;
    for (let x = 0; x < w; x += step) {
      const m = this.metresAt(x + step / 2);
      let fill;
      if (m <= VISIBLE.from && m >= VISIBLE.to) fill = css(spectral(m * 1e9).rgb);
      else {
        const band = BANDS.find(b => m <= b.from && m > b.to) ?? BANDS[m > 1 ? 0 : BANDS.length - 1];
        // Dim toward the far ends of each band so the edges read as soft.
        const t = (Math.log10(band.from) - Math.log10(m)) / (Math.log10(band.from) - Math.log10(band.to));
        const k = 0.42 + 0.28 * Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
        fill = css(band.hue.map(c => Math.round(c * k)));
      }
      ctx.fillStyle = fill;
      ctx.fillRect(x, sy, step + 0.5, sh);
    }
    ctx.save();
    ctx.beginPath();
    const v0 = this.xOf(VISIBLE.from), v1 = this.xOf(VISIBLE.to);
    ctx.rect(0, sy, Math.max(0, v0), sh);
    ctx.rect(v1, sy, Math.max(0, w - v1), sh);
    ctx.clip();
    ctx.strokeStyle = 'rgba(3, 5, 11, 0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -sh; x < w + sh; x += 6) { ctx.moveTo(x, sy + sh); ctx.lineTo(x + sh, sy); }
    ctx.stroke();
    ctx.restore();

    // Overlays (atmosphere, a blackbody curve, ...), drawn over the strip.
    for (const o of this.overlays) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, sy, w, sh);
      ctx.clip();
      ctx.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const v = Math.min(1, Math.max(0, o.sample(this.metresAt(x))));
        const yy = sy + sh - 3 - v * (sh - 8);
        x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
      }
      if (o.fill) {
        ctx.lineTo(w, sy + sh); ctx.lineTo(0, sy + sh); ctx.closePath();
        ctx.fillStyle = o.fill; ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(3, 5, 11, 0.7)'; ctx.lineWidth = 4; ctx.stroke();
        ctx.strokeStyle = o.colour; ctx.lineWidth = 1.8; ctx.stroke();
      }
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(160, 180, 220, 0.22)';
    ctx.strokeRect(-1, sy + 0.5, w + 2, sh - 1);
    y += sh;

    // Things: a tick each, labels where they fit, nearest the cursor first.
    this.hits = [];
    ctx.font = '500 11px "IBM Plex Sans", sans-serif';
    ctx.textBaseline = 'alphabetic';
    const shown = THINGS.map(t => ({ t, x: this.xOf(t.m) })).filter(o => o.x > -40 && o.x < w + 40);
    const taken = [];
    shown.sort((a, b) => (a.t === this.marked ? -1 : b.t === this.marked ? 1 : Math.abs(a.x - w / 2) - Math.abs(b.x - w / 2)));
    for (const { t, x } of shown) {
      const on = t === this.marked;
      ctx.fillStyle = on ? '#f2b45a' : 'rgba(230, 235, 243, 0.55)';
      ctx.fillRect(Math.round(x), sy + sh - 8, 1, on ? 14 : 10);
      const tw = ctx.measureText(t.name).width;
      const x0 = Math.min(Math.max(x - tw / 2, 4), w - tw - 4);
      for (const row of [0, 1]) {
        if (taken.some(r => r.row === row && x0 < r.x1 + 10 && x0 + tw > r.x0 - 10)) continue;
        taken.push({ row, x0, x1: x0 + tw });
        const ty = y + 12 + row * 13;
        ctx.fillStyle = on ? '#f2b45a' : '#8b96aa';
        ctx.fillText(t.name, x0 + tw / 2, ty);
        this.hits.push({ thing: t, x0, x1: x0 + tw, y0: ty - 11, y1: ty + 3 });
        break;
      }
    }
    y += T.things;

    // Wavelength and energy scales.
    ctx.textBaseline = 'middle';
    ctx.font = '500 10.5px "IBM Plex Sans", sans-serif';
    this.scale(ticks(lo, hi, ppd, 76), m => this.xOf(m), fmt.length, y, T.wave, 'mid', '#c4ccdb');
    y += T.wave;
    this.scale(ticks(photonEnergyEV(hi), photonEnergyEV(lo), ppd, 76), e => this.xOf(wavelengthFromEV(e)), fmt.energy, y, T.energy, 'mid');

    // The cursor.
    const cx = Math.round(w / 2) + 0.5;
    ctx.strokeStyle = '#f2b45a';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, T.freq); ctx.lineTo(cx, this.height - T.energy); ctx.stroke();
    ctx.fillStyle = '#f2b45a';
    ctx.beginPath(); ctx.moveTo(cx - 6, sy - 1); ctx.lineTo(cx + 6, sy - 1); ctx.lineTo(cx, sy + 6); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 6, sy + sh + 1); ctx.lineTo(cx + 6, sy + sh + 1); ctx.lineTo(cx, sy + sh - 6); ctx.fill();
  }

  scale(values, xOf, label, y, h, where, colour = '#8b96aa') {
    const { ctx, w } = this;
    let lastX = -1e9;
    for (const v of values.map(v => [v, xOf(v)]).sort((a, b) => a[1] - b[1])) {
      const [val, x] = v;
      if (x < -20 || x > w + 20) continue;
      ctx.fillStyle = 'rgba(160, 180, 220, 0.3)';
      ctx.fillRect(Math.round(x), where === 'top' ? y + h - 4 : y, 1, 4);
      const text = label(val);
      const tw = ctx.measureText(text).width;
      if (x - tw / 2 < lastX + 8 || Math.abs(x - w / 2) < tw / 2 + 4) continue;
      ctx.fillStyle = colour;
      ctx.fillText(text, x, y + h / 2 + (where === 'top' ? -1 : 2));
      lastX = x + tw / 2;
    }
  }
}
