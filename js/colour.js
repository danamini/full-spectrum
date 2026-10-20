// Colour from physics: the CIE 1931 2° observer turns a spectrum into what a person sees, and IEC 61966-2-1
// turns that into screen sRGB. Every pure spectral colour lies outside what a screen can show. We clip the
// channel that goes negative, which nudges hues toward the screen's primaries but keeps the band smooth and
// saturated. Tried and rejected (2026-10-20): adding white (washes out green, turns red pink) and OKLab
// hue-preserving projection (breaks the band where it crosses the screen's blue and green primaries).
import { CIE1931 } from '../data/cie1931.js';
import { planck } from './physics.js';
import { byKey } from './bands.js';

export const VISIBLE = byKey('visible'); // from (long end) and to, in metres

// Colour-matching functions at a wavelength in nm (linear interpolation; zero outside the table).
export function cmf(nm) {
  const { start, step, x, y, z } = CIE1931;
  const i = (nm - start) / step;
  if (i < 0 || i > x.length - 1) return [0, 0, 0];
  const i0 = Math.floor(i), t = i - i0, i1 = Math.min(i0 + 1, x.length - 1);
  return [x[i0] + (x[i1] - x[i0]) * t, y[i0] + (y[i1] - y[i0]) * t, z[i0] + (z[i1] - z[i0]) * t];
}

export const xyzToLinear = ([X, Y, Z]) => [
  3.2406 * X - 1.5372 * Y - 0.4986 * Z,
  -0.9689 * X + 1.8758 * Y + 0.0415 * Z,
  0.0557 * X - 0.204 * Y + 1.057 * Z,
];
const encode = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
export const toSrgb = lin => lin.map(c => Math.round(255 * Math.min(1, Math.max(0, encode(c)))));

// Brings a linear colour into gamut by adding white; reports whether it had to. Used for blackbodies, which
// are close to the white point and barely change.
function intoGamut(lin) {
  const lo = Math.min(...lin);
  return lo < 0 ? { lin: lin.map(c => c - lo), outside: true } : { lin, outside: false };
}

// Exposure: the eye's peak (555 nm) shown at this luminance, so both ends fall away to dark as they do.
const PEAK_Y = 0.8;

// The colour of light of one wavelength, as bright as the eye finds it (dim at both ends). `outside` is
// true when the screen cannot show it exactly, which for pure spectral light is nearly always.
export function spectral(nm) {
  const lin = xyzToLinear(cmf(nm).map(v => v * PEAK_Y));
  const outside = lin.some(c => c < 0);
  const clipped = lin.map(c => Math.max(0, c));
  const top = Math.max(1, ...clipped);
  return { rgb: toSrgb(clipped.map(c => c / top)), outside };
}

// The hue of a blackbody at a temperature, at full brightness (null if it gives no visible light worth
// drawing, which the caller explains).
export function blackbody(kelvin) {
  let X = 0, Y = 0, Z = 0;
  for (let nm = 380; nm <= 780; nm += 5) {
    const b = planck(nm * 1e-9, kelvin), [x, y, z] = cmf(nm);
    X += b * x; Y += b * y; Z += b * z;
  }
  if (!(Y > 0)) return null;
  const { lin } = intoGamut(xyzToLinear([X / Y, 1, Z / Y]));
  const m = Math.max(...lin);
  return { rgb: toSrgb(lin.map(c => c / m)), Y };
}

export const css = ([r, g, b], a = 1) => (a === 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${a})`);
