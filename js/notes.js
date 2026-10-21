// The longer explanations in the details panel for the fields and photons views. Every number is worked out
// from physics.js, never typed in.
import * as P from './physics.js';
import * as fmt from './format.js';

// Full sunlight at the ground, W/m²: the ASTM G173 global reference spectrum adds up to about 1,000.
export const SUNLIGHT = 1000;
const EARTH_FIELD = 50e-6; // tesla, a typical strength of the Earth's magnetic field at the surface

const volts = v => `${fmt.sig(v, 2)} volts per metre`;
const tesla = b => (b >= 1e-3 ? `${fmt.sig(b * 1e3, 2)} millitesla` : `${fmt.sig(b * 1e6, 2)} microtesla`);

// The card on the 3D view itself: short, and about what you are looking at.
export function fieldCard(metres, polar, shownHz) {
  const f = P.frequency(metres), sun = P.fields(SUNLIGHT);
  return [
    polar === 'circular'
      ? '<strong>Circular polarisation:</strong> the electric field turns as it goes, one full turn every wavelength.'
      : '<strong>Linear polarisation:</strong> the electric field stays in one plane, and so does the magnetic field.',
    `<strong>Slowed down ${fmt.sci(f / shownHz)} times.</strong> Each field really swings back and forth ${fmt.count(f)} times a second.`,
    `<strong>In full sunlight</strong> the electric field peaks near ${volts(sun.E)} and the magnetic field near ${tesla(sun.B)}.`,
  ].map(t => `<p>${t}</p>`).join('');
}

export function fieldNotes(metres, polar) {
  const f = P.frequency(metres), sun = P.fields(SUNLIGHT);
  const share = Math.round(EARTH_FIELD / sun.B);
  return `<h2>Fields in 3D</h2>
<p>Light is two fields travelling together: an electric field and a magnetic field. Each points at right angles to the other, and both point at right angles to the way the light is going. That takes three dimensions to draw, so this view is 3D. Drag to turn it.</p>
<h3>The electric field</h3>
<p>Drawn in the colour of the light. The electric field pushes on electric charges: one way while it points up, the other way while it points down. That push on electrons is how light does everything it does. It shakes electrons in an aerial, which is radio reception; it lifts them in the molecules of your retina, which is sight; it jostles water molecules, which is a microwave oven.</p>
<h3>The magnetic field</h3>
<p>Drawn pale. It rises and falls in step with the electric field, always at right angles to it. It pushes only on charges that are moving, and in light its push is smaller than the electric push by the charge's speed divided by the speed of light. So for anything not moving near the speed of light, the electric field does nearly all the work.</p>
<h3>Each makes the other</h3>
<p>A changing magnetic field makes an electric field (Faraday, 1831), and a changing electric field makes a magnetic field. In the 1860s James Clerk Maxwell wrote the rules down together and found they allow a wave that carries itself along, at a speed set by two constants measured with coils and capacitors. It came out at the measured speed of light, and he concluded that light is that wave. Heinrich Hertz made and caught such waves with sparks in 1886–88, the first radio waves made on purpose.</p>
<h3>Polarisation${polar === 'circular' ? ': circular' : ': linear'}</h3>
<p>${polar === 'circular'
    ? 'In circularly polarised light the field turns as it goes, a full turn each wavelength, one way or the other. Cinema 3D glasses use it, a different hand for each eye, and GPS satellites send circularly polarised signals so a receiver\'s aerial need not line up with them.'
    : 'In linearly polarised light the electric field stays in one plane. Sunlight and lamplight are a jumble of every direction. Light reflected off water or a wet road is partly polarised side to side, so polarising sunglasses, which pass only up-and-down, cut the glare.'}</p>
<h3>How strong?</h3>
<p>In full sunlight, about ${SUNLIGHT.toLocaleString('en-GB')} watts on each square metre, a single wave carrying the same power has an electric field peaking near ${volts(sun.E)} and a magnetic field near ${tesla(sun.B)}, about 1/${share} of the Earth's own magnetic field. Real sunlight is a jumble of many waves, so these are a guide to the size, not a measurement.</p>
<h3>At this wavelength</h3>
<p>Each field swings back and forth ${fmt.count(f)} times a second (${fmt.frequency(f)}), and the pattern repeats every ${fmt.length(metres)}. Apart from that, the picture looks the same for every kind of light, from radio to gamma rays: only the length and the rate change, and with them the energy of each photon.</p>`;
}

export function photonNotes(metres) {
  const ev = P.photonEnergyEV(metres), n = P.photons(metres);
  return `<h2>Photons</h2>
<p>Light is given out and taken in only in whole lumps, photons. Each carries an energy set by its frequency: Planck's constant times the frequency. Here that is ${fmt.energy(ev)}.</p>
<p>Max Planck assumed it in 1900 to explain the way hot things glow. Albert Einstein took it literally in 1905 to explain why light knocks electrons out of a metal only if its frequency is high enough, however bright it is. That earned him his Nobel Prize.</p>
<h3>Wave or particle?</h3>
<p>Both, depending on what you ask. Light travels like a wave: it spreads, bends round edges and interferes with itself. It arrives like a particle, one photon at a time at a single spot. Send photons one by one through two slits and each lands as a single dot, yet the dots build up the stripes of a wave.</p>
<h3>Counting them</h3>
<p>The picture shows a beam of 1 milliwatt, about a laser pointer. At this wavelength it carries ${fmt.count(n.perSecond)} photons a second, ${fmt.count(n.perMetre)} in each metre of beam.</p>
<p>At long wavelengths each photon carries so little that there are vast numbers of them, and the beam behaves exactly like a smooth wave: radio engineers never need photons. At short wavelengths each photon carries enough to break a chemical bond. That is why ultraviolet burns and X-rays ionise, however dim the light.</p>`;
}

// The cards under the photon beam: what one photon carries and can do, how many a beam holds, and its push.
const BEAM = 1e-3;          // watts, as in photonNotes: about a laser pointer
const RED_CELL = 2.7e-14;   // kg, the mass of one red blood cell (about 27 picograms)
const G = 9.81;             // m/s², gravity at the Earth's surface
export function photonFacts(metres, effect, visible) {
  const ev = P.photonEnergyEV(metres), n = P.photons(metres, BEAM), push = BEAM / P.C;
  const cells = Math.round(push / (RED_CELL * G));
  const card = (label, big, text) => `<div class="pf"><p class="pf-label">${label}</p><p class="pf-big">${big}</p><p>${text}</p></div>`;
  return [
    card('One photon', fmt.energy(ev), `${fmt.sci(ev * P.EV)} joules: Planck's constant times the frequency, ${fmt.frequency(P.frequency(metres))}.`),
    card('What one can do', effect.name, effect.text),
    card('Every second', `${fmt.count(n.perSecond)}`, 'photons in a 1 milliwatt beam, about a laser pointer. Dimmer light means fewer photons, never smaller ones.'),
    card('Its push', `${fmt.sig(push * 1e12, 2)} piconewtons`, `Light carries momentum. The whole beam pushes on what absorbs it about as hard as ${cells} red blood cells weigh; each photon gives ${fmt.sci(P.H / metres)} kg m/s.`),
    visible ? card('Your eye', 'About 100', 'photons in a flash are enough for a dark-adapted eye to notice it; only 5 to 14 of them are caught by rods (Hecht, Shlaer and Pirenne, 1942).') : '',
  ].join('');
}
