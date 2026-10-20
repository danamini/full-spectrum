// The physics, in one place: every other file asks here rather than repeating a constant or formula.
// Constants are the exact SI values (CODATA 2018), except Wien's b, which is derived.

export const C = 299_792_458;            // speed of light, m/s
export const H = 6.626_070_15e-34;       // Planck constant, J s
export const K_B = 1.380_649e-23;        // Boltzmann constant, J/K
export const EV = 1.602_176_634e-19;     // one electronvolt, J
export const WIEN_B = 2.897_771_955e-3;  // Wien's displacement constant, m K

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
