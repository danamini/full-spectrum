// Numbers for people: lengths, frequencies, energies and counts with sensible units and precision.

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
export const sup = n => String(n).replace(/[-0-9]/g, c => SUP[c]);
export const pow10 = n => `10${sup(n)}`;

// Three significant figures, no trailing zeros ("12.2", "545", "0.5").
export function sig(x, digits = 3) {
  if (x === 0) return '0';
  const s = Number(x.toPrecision(digits));
  return Math.abs(s) >= 1e4 ? s.toLocaleString('en-GB', { maximumFractionDigits: 0 }) : String(s);
}

// "3.2 × 10¹⁵" for numbers too big or small for a unit to help.
export function sci(x, digits = 2) {
  if (x === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(x)));
  if (e >= -2 && e < 6) return sig(x, digits + 1);
  const m = x / 10 ** e;
  return `${sig(m, digits)} × ${pow10(e)}`;
}

function scaled(x, units) {
  for (const [f, u] of units) if (Math.abs(x) >= f) return `${sig(x / f)} ${u}`;
  const [f, u] = units[units.length - 1];
  return `${sci(x / f)} ${u}`;
}

const LENGTH = [[1e3, 'km'], [1, 'm'], [1e-2, 'cm'], [1e-3, 'mm'], [1e-6, 'µm'], [1e-9, 'nm'], [1e-12, 'pm'], [1e-15, 'fm']];
export function length(m) {
  if (m >= 1e6) return `${sig(m / 1e3)} km`;
  if (m < 1e-15) return `${sci(m)} m`;
  return scaled(m, LENGTH);
}

const FREQ = [[1e24, 'YHz'], [1e21, 'ZHz'], [1e18, 'EHz'], [1e15, 'PHz'], [1e12, 'THz'], [1e9, 'GHz'], [1e6, 'MHz'], [1e3, 'kHz'], [1, 'Hz']];
export const frequency = hz => (hz >= 1e27 ? `${sci(hz)} Hz` : scaled(hz, FREQ));

const ENERGY = [[1e15, 'PeV'], [1e12, 'TeV'], [1e9, 'GeV'], [1e6, 'MeV'], [1e3, 'keV'], [1, 'eV'], [1e-3, 'meV'], [1e-6, 'µeV'], [1e-9, 'neV'], [1e-12, 'peV'], [1e-15, 'feV']];
export const energy = ev => scaled(ev, ENERGY);

export const kelvin = k => (k >= 1e5 ? `${sci(k)} K` : `${Math.round(k).toLocaleString('en-GB')} K`);

// Large counts in words where words help ("2.4 billion"), else powers of ten.
export function count(n) {
  const words = [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']];
  if (n < 1e3) return sig(n);
  if (n >= 1e15) return sci(n);
  for (const [f, w] of words) if (n >= f) return `${sig(n / f)} ${w}`;
  return sig(n);
}

// Reads "550 nm", "2.45 GHz", "13.6 eV", "1e-3 m" or "21cm" and returns a wavelength in metres (or null).
// A bare number is read in `fallback`, the unit of the box it was typed into.
const UNITS = {
  km: ['m', 1e3], m: ['m', 1], cm: ['m', 1e-2], mm: ['m', 1e-3], um: ['m', 1e-6], µm: ['m', 1e-6], μm: ['m', 1e-6], nm: ['m', 1e-9], pm: ['m', 1e-12], fm: ['m', 1e-15], å: ['m', 1e-10], a: ['m', 1e-10],
  hz: ['hz', 1], khz: ['hz', 1e3], mhz: ['hz', 1e6], ghz: ['hz', 1e9], thz: ['hz', 1e12], phz: ['hz', 1e15], ehz: ['hz', 1e18], zhz: ['hz', 1e21],
  ev: ['ev', 1], mev: ['ev', 1e6], kev: ['ev', 1e3], gev: ['ev', 1e9], tev: ['ev', 1e12], pev: ['ev', 1e15], µev: ['ev', 1e-6], uev: ['ev', 1e-6], nev: ['ev', 1e-9],
};
export function parse(text, fallback = 'm', { C, H, EV }) {
  const s = text.trim().replace(/,/g, '').replace(/\s*[×x*]\s*10\^?/g, 'e').replace(/\s+/g, ' ');
  const m = /^([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*([a-zA-Zµμå]*)$/i.exec(s);
  if (!m) return null;
  const v = parseFloat(m[1]);
  let unit = m[2];
  // "meV" (milli) and "MeV" (mega) differ only by case.
  let entry = unit === 'meV' ? ['ev', 1e-3] : unit === 'MeV' ? ['ev', 1e6] : unit === 'mm' ? UNITS.mm : UNITS[unit.toLowerCase()];
  if (!unit) entry = [fallback, 1];
  if (!entry || !(v > 0)) return null;
  const [kind, f] = entry;
  const x = v * f;
  return kind === 'm' ? x : kind === 'hz' ? C / x : (H * C) / (x * EV);
}
