// Things of known size, from the Earth–Moon distance down to a proton. The wave view picks the one that best
// fits beside the current wavelength so the scale can be felt, and shows its 3D model (models3d.js, by key).
// Sizes: NASA planetary fact sheets; buildings and objects from their owners' published figures; cells and
// molecules typical values; the proton's charge radius (CODATA 2018, 0.84 fm) doubled. An atom's innermost (1s)
// electrons, like the hydrogen atom, are measured across twice their most likely distance from the nucleus: the
// Bohr radius over the charge they feel (Slater's rules: Z − 0.3), times √(1 − (Zα)²) for lead, whose 1s
// electrons move fast enough for relativity to pull them in by a fifth.
// `maps`: the real maps or heights it is drawn with (data/textures.js), credited under it.
// `pdb`: the Protein Data Bank structures its bead model is built from (data/molecules.js), credited under it.
// `along`: a distance between two points; `tall`: measured up the screen (for a hair and DNA, their thickness).

export const OBJECTS = [
  { key: 'earthMoon', name: 'Earth to the Moon', m: 3.844e8, along: true, maps: ['earth-day', 'moon'] },
  { key: 'jupiter', name: 'Jupiter', m: 1.3982e8, maps: ['jupiter'] },
  { key: 'neptune', name: 'Neptune', m: 4.9528e7, maps: ['neptune'] },
  { key: 'earth', name: 'The Earth', m: 1.2742e7, maps: ['earth-day'] },
  { key: 'moon', name: 'The Moon', m: 3.4748e6, maps: ['moon'] },
  { key: 'londonEdinburgh', name: 'London to Edinburgh', m: 5.34e5, along: true, maps: ['britain'] },
  { key: 'marathon', name: 'A marathon', m: 42195, along: true },
  { key: 'everest', name: 'Mount Everest', m: 8849, tall: true, maps: ['everest'] },
  { key: 'burj', name: 'Burj Khalifa', m: 828, tall: true },
  { key: 'eiffel', name: 'The Eiffel Tower', m: 330, tall: true },
  { key: 'pitch', name: 'A football pitch', m: 105 },
  { key: 'whale', name: 'A blue whale', m: 25 },
  { key: 'bus', name: 'A double-decker bus', m: 11.2 },
  { key: 'person', name: 'A person', m: 1.7, tall: true },
  { key: 'phone', name: 'A phone', m: 0.147, tall: true },
  { key: 'coin', name: 'A £1 coin', m: 0.02343 },
  { key: 'ant', name: 'An ant', m: 0.005 },
  { key: 'sand', name: 'A grain of sand', m: 5e-4 },
  { key: 'hair', name: 'The width of a hair', m: 8e-5, tall: true },
  { key: 'bloodCell', name: 'A red blood cell', m: 8e-6 },
  { key: 'bacterium', name: 'A bacterium', m: 2e-6 },
  { key: 'mimivirus', name: 'A giant virus (mimivirus)', m: 5e-7 },
  { key: 'flu', name: 'A flu virus', m: 1e-7, pdb: ['ha', 'na'] },
  { key: 'ribosome', name: 'A ribosome', m: 2.5e-8, pdb: ['ribosome'] },
  { key: 'haemoglobin', name: 'A haemoglobin protein', m: 5.5e-9, pdb: ['haemoglobin'] },
  { key: 'dna', name: 'The width of DNA', m: 2e-9, tall: true, pdb: ['dna'] },
  { key: 'water', name: 'A water molecule', m: 2.8e-10 },
  { key: 'hydrogen', name: 'A hydrogen atom', m: 1.06e-10 },
  { key: 'oxygenCore', name: "An oxygen atom's innermost electrons", m: 1.4e-11 },
  { key: 'leadCore', name: "A lead atom's innermost electrons", m: 1.0e-12 },
  { key: 'uranium', name: 'A uranium nucleus', m: 1.5e-14 },
  { key: 'proton', name: 'A proton', m: 1.68e-15 },
];

// The object that sits best beside a picture `width` metres across: about a third of the width if possible, and
// never one too big to fit (the wave view draws things up to 1.6 times the picture), unless nothing fits.
export const FITS = 1.6;
export function pick(width) {
  let best = null, bestD = Infinity;
  for (const o of OBJECTS) {
    const d = Math.abs(Math.log(o.m / (width * 0.33))) + (o.m > width * FITS ? 100 : 0);
    if (d < bestD) { best = o; bestD = d; }
  }
  return best;
}
