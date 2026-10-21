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
near('Stefan-Boltzmann is 5.670374e-8', p.SIGMA, 5.670374419e-8, 1e-6);
near('the Sun gives out 63 MW per square metre', p.exitance(5772), 6.294e7, 2e-3);
near('1 kW/m² sunlight: E peaks at 868 V/m', p.fields(1000).E, 868.0, 2e-3);
near('... and B at 2.895 µT', p.fields(1000).B, 2.8953e-6, 2e-3);
const { shares } = await import('../js/blackbody.js');
const sunShares = shares(5772), sum = Object.values(sunShares).reduce((a, b) => a + b, 0);
near('a 5772 K blackbody is 44% visible (380-750 nm)', sunShares.visible, 0.44, 0.02);
near('... and its shares add up to 1', sum, 1, 1e-9);
check('a 2700 K filament is over 90% infrared', shares(2700).infrared > 0.9);
const peak = p.wienPeak(5772);
const flat = [0.98, 1.02].every(f => p.planck(peak * f, 5772) < p.planck(peak, 5772));
if (!flat) failures++;
console.log(`  ${flat ? 'ok  ' : 'FAIL'}  Planck curve is highest at Wien's peak`);

function check(name, ok) { if (!ok) failures++; console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}`); }

// Colour: the CIE observer peaks at 555 nm, spectral colours have the right dominant channel, and the Sun is white.
const { spectral, blackbody, cmf } = await import('../js/colour.js');
near('CIE y peaks at 1 at 555 nm', cmf(555)[1], 1, 1e-3);
const [r650, g650, b650] = spectral(650).rgb, [r530, g530, b530] = spectral(530).rgb, [r450, g450, b450] = spectral(450).rgb;
check('650 nm is red', r650 > g650 && r650 > b650);
check('530 nm is green', g530 > r530 && g530 > b530);
check('450 nm is blue-violet', b450 > r450 && b450 > g450);
check('the ends of the visible band are dim', Math.max(...spectral(390).rgb) < 60 && Math.max(...spectral(740).rgb) < 60);
const sun = blackbody(5772).rgb;
check('a 5772 K blackbody is near white', Math.min(...sun) > 220);
const lamp = blackbody(2700).rgb;
check('a 2700 K filament is warm', lamp[0] > lamp[2] + 80);

// The Sun: the measured spectrum above the air agrees with a 5772 K blackbody of the Sun's size and distance.
const { SOLAR } = await import('../data/solar.js');
let am0 = 0, bb = 0;
SOLAR.nm.forEach((n, i) => { const w = (SOLAR.nm[i + 1] ?? n + 10) - n; am0 += SOLAR.am0[i] * w; bb += Math.PI * p.planck(n * 1e-9, 5772) * (6.957e8 / 1.495978707e11) ** 2 * 1e-9 * w; });
near('ASTM G173 above the air matches a 5772 K Sun (280 nm–4 µm)', am0, bb, 0.05);

// Typing values.
const fmt = await import('../js/format.js');
near('"2.45 GHz" reads as 12.24 cm', fmt.parse('2.45 GHz', 'm', p), 0.12236);
near('"1 MeV" is mega, not milli', fmt.parse('1 MeV', 'm', p), 1.23984e-12);
near('"1 meV" is milli', fmt.parse('1 meV', 'm', p), 1.23984e-3);
near('"5 × 10^14 Hz" reads', fmt.parse('5 × 10^14 Hz', 'm', p), 5.99585e-7);
check('nonsense is refused', fmt.parse('blue', 'm', p) === null);

// Bands: contiguous from end to end, and every thing sits inside the span.
const { BANDS, SPAN } = await import('../js/bands.js');
check('bands run without gaps', BANDS.every((b, i) => i === 0 || b.from === BANDS[i - 1].to) && BANDS[0].from === SPAN.long && BANDS.at(-1).to === SPAN.short);
check('sub-bands tile each band', BANDS.every(b => b.subs[0].from === b.from && b.subs.at(-1).to === b.to && b.subs.every((s, i) => i === 0 || s.from === b.subs[i - 1].to)));
const { THINGS } = await import('../js/things.js');
check('every thing is inside the spectrum', THINGS.every(t => t.m <= SPAN.long && t.m >= SPAN.short));
check('things run longest first', THINGS.every((t, i) => i === 0 || t.m <= THINGS[i - 1].m));

if (failures) { console.log(`${failures} failed`); process.exit(1); }
