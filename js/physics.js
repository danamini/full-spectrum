// The physics, in one place: every other file asks here rather than repeating a constant or formula.
// Constants are the exact SI values (CODATA 2018), except Wien's b, which is derived.

export const C = 299_792_458;            // speed of light, m/s
export const H = 6.626_070_15e-34;       // Planck constant, J s
export const K_B = 1.380_649e-23;        // Boltzmann constant, J/K
export const EV = 1.602_176_634e-19;     // one electronvolt, J
export const WIEN_B = 2.897_771_955e-3;  // Wien's displacement constant, m K
export const EPS0 = 8.854_187_8188e-12;  // electric constant, F/m (measured; CODATA 2022)
export const SIGMA = (2 * Math.PI ** 5 * K_B ** 4) / (15 * H ** 3 * C ** 2); // Stefan-Boltzmann, W m⁻² K⁻⁴

export const frequency = metres => C / metres;
export const wavelength = hertz => C / hertz;
export const photonEnergyEV = metres => (H * C) / (metres * EV);
export const wavelengthFromEV = ev => (H * C) / (ev * EV);

// Wavelength of a blackbody's peak emission (per unit wavelength).
export const wienPeak = kelvin => WIEN_B / kelvin;

// Planck's law: spectral radiance per unit wavelength, W sr⁻¹ m⁻³.
export function planck(metres, kelvin) {
  const x = (H * C) / (metres * K_B * kelvin);
  return (2 * H * C * C) / metres ** 5 / Math.expm1(x);
}

// Photons in a beam of a given power: how many leave each second, and how many are in each metre of it.
export function photons(metres, watts = 1e-3) {
  const perSecond = watts / ((H * C) / metres);
  return { perSecond, perMetre: perSecond / C };
}

// Peak fields of a single plane wave carrying a given power per square metre: E in V/m, B in tesla.
export function fields(wattsPerSquareMetre) {
  const E = Math.sqrt((2 * wattsPerSquareMetre) / (C * EPS0));
  return { E, B: E / C };
}

// Power a blackbody gives out from each square metre of its surface, W/m².
export const exitance = kelvin => SIGMA * kelvin ** 4;

// The thermal energy of a molecule at room temperature (kT at 293 K), in eV: about 0.025.
export const ROOM_KT_EV = (K_B * 293) / EV;
