// Checks js/physics.js against known values. Run with `node tests/physics.mjs`.
import * as p from '../js/physics.js';

let failures = 0;
function near(name, got, want, rel = 1e-3) {
  const ok = Math.abs(got - want) <= Math.abs(want) * rel;
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}: ${got.toPrecision(6)} (want ${want})`);
}

near('microwave oven 2.45 GHz is 12.24 cm', p.wavelength(2.45e9), 0.12236);
near('550 nm is 545 THz', p.frequency(550e-9), 5.4508e14);
near('1 eV is 1239.84 nm', p.wavelengthFromEV(1), 1239.84e-9);
near('PET 511 keV is 2.426 pm', p.wavelengthFromEV(511e3), 2.4263e-12, 1e-3);
near('124 nm is 10 eV', p.photonEnergyEV(124e-9), 9.9987);
near('the Sun (5772 K) peaks at 502 nm', p.wienPeak(5772), 502.04e-9);
near('the CMB (2.725 K) peaks at 1.063 mm', p.wienPeak(2.725), 1.0634e-3);
near('you (310 K) peak at 9.35 µm', p.wienPeak(310), 9.348e-6);
const peak = p.wienPeak(5772);
const flat = [0.98, 1.02].every(f => p.planck(peak * f, 5772) < p.planck(peak, 5772));
if (!flat) failures++;
console.log(`  ${flat ? 'ok  ' : 'FAIL'}  Planck curve is highest at Wien's peak`);

if (failures) { console.log(`${failures} failed`); process.exit(1); }
