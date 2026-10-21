// The bands of the spectrum, longest wavelength first. Lengths are in metres; `from` is the long end.
// The edges are conventions, not physics, and different fields draw them differently: radio sub-bands are
// the ITU's (ITU-R V.431), infrared's are ISO 20473's, ultraviolet, X-ray and gamma follow ISO 21348, and
// the visible edges are the usual 380–750 nm (the CIE tabulates the eye from 360 to 830 nm).

export const SPAN = { long: 1e8, short: 1e-22 }; // 3 Hz to about 12 PeV

export const BANDS = [
  {
    key: 'radio', name: 'Radio', from: 1e8, to: 1, hue: [92, 120, 178],
    short: 'Waves from a metre to the size of the Earth.',
    blurb: 'The longest light. A radio wave is made whenever electrons slosh back and forth in a wire, and caught when it makes electrons slosh in another one. Its waves bend round hills and, at some lengths, bounce off the upper atmosphere and go round the world.',
    made: 'Lightning, aerials, pulsars, the cold hydrogen between the stars.',
    uses: 'Broadcasting, navigation, talking to submarines and spacecraft, radio astronomy.',
    matter: 'Pushes the free electrons in a metal back and forth, which is all an aerial is.',
    links: [['Copper, the metal of aerials', 'copper']],
    subs: [
      { key: 'elf', name: 'ELF', long: 'Extremely low frequency', from: 1e8, to: 1e7 },
      { key: 'slf', name: 'SLF', long: 'Super low frequency', from: 1e7, to: 1e6 },
      { key: 'ulf', name: 'ULF', long: 'Ultra low frequency', from: 1e6, to: 1e5 },
      { key: 'vlf', name: 'VLF', long: 'Very low frequency', from: 1e5, to: 1e4 },
      { key: 'lf', name: 'LF', long: 'Low frequency (long wave)', from: 1e4, to: 1e3 },
      { key: 'mf', name: 'MF', long: 'Medium frequency (medium wave)', from: 1e3, to: 1e2 },
      { key: 'hf', name: 'HF', long: 'High frequency (short wave)', from: 1e2, to: 10 },
      { key: 'vhf', name: 'VHF', long: 'Very high frequency', from: 10, to: 1 },
    ],
  },
  {
    key: 'microwave', name: 'Microwave', from: 1, to: 1e-3, hue: [58, 140, 150],
    short: 'A metre to a millimetre: phones, Wi-Fi, radar and ovens.',
    blurb: 'The short end of radio, short enough to aim in a beam and to fit an aerial inside a phone. Most of the wireless world lives here, and so does the faint afterglow of the Big Bang.',
    made: 'Magnetrons, transistors, masers, and the whole sky (the cosmic microwave background).',
    uses: 'Mobile phones, Wi-Fi, Bluetooth, GPS, radar, satellite TV, cooking.',
    matter: 'Twists molecules that have a positive and a negative end, like water, back and forth; the jostling is heat.',
    links: [['Water, the molecule a microwave oven heats', 'water']],
    subs: [
      { key: 'uhf', name: 'UHF', long: 'Ultra high frequency', from: 1, to: 0.1 },
      { key: 'shf', name: 'SHF', long: 'Super high frequency', from: 0.1, to: 0.01 },
      { key: 'ehf', name: 'EHF', long: 'Extremely high frequency (millimetre wave)', from: 0.01, to: 1e-3 },
    ],
  },
  {
    key: 'infrared', name: 'Infrared', from: 1e-3, to: 750e-9, hue: [150, 70, 70],
    short: 'Heat you can feel but not see.',
    blurb: 'Everything warm glows in infrared, you included. William Herschel found it in 1800 by putting a thermometer past the red end of a prism\'s spectrum and watching it rise.',
    made: 'Anything with a temperature: bodies, engines, the ground at night, cool stars and dust clouds.',
    uses: 'Thermal cameras, remote controls, fibre-optic internet, night vision, the James Webb Space Telescope.',
    matter: 'Makes the bonds between atoms stretch and bend. That is how carbon dioxide traps heat.',
    links: [['Carbon dioxide, whose bending bond traps heat', 'carbon-dioxide']],
    subs: [
      { key: 'far-ir', name: 'Far IR', long: 'Far infrared', from: 1e-3, to: 50e-6 },
      { key: 'mid-ir', name: 'Mid IR', long: 'Mid infrared', from: 50e-6, to: 3e-6 },
      { key: 'near-ir', name: 'Near IR', long: 'Near infrared', from: 3e-6, to: 750e-9 },
    ],
  },
  {
    key: 'visible', name: 'Visible', from: 750e-9, to: 380e-9, hue: null,
    short: 'The sliver we see: just under one octave.',
    blurb: 'All the colours there are, from 750 nm to 380 nm: the longest wave is only 1.97 times the shortest, so everything you have ever seen fits in less than one octave. It is the band where the Sun is brightest and the air is clear, which is probably not a coincidence.',
    made: 'The Sun, flames, hot filaments, LEDs, lasers, fireflies, atoms whose electrons drop between levels.',
    uses: 'Seeing, photosynthesis, photography, lasers.',
    matter: 'Lifts an outer electron to a higher orbital. In your eye, that bends one molecule, retinal, and the bend is the start of sight.',
    links: [['Retinal, the molecule that sees', 'retinal'], ['Sodium, the yellow of old street lamps', 'element-Na']],
    subs: [
      { key: 'red', name: 'Red', from: 750e-9, to: 625e-9 },
      { key: 'orange', name: 'Orange', from: 625e-9, to: 590e-9 },
      { key: 'yellow', name: 'Yellow', from: 590e-9, to: 565e-9 },
      { key: 'green', name: 'Green', from: 565e-9, to: 500e-9 },
      { key: 'cyan', name: 'Cyan', from: 500e-9, to: 485e-9 },
      { key: 'blue', name: 'Blue', from: 485e-9, to: 450e-9 },
      { key: 'violet', name: 'Violet', from: 450e-9, to: 380e-9 },
    ],
  },
  {
    key: 'ultraviolet', name: 'Ultraviolet', from: 380e-9, to: 10e-9, hue: [118, 92, 196],
    short: 'Past violet: sunburn, black lights and ozone.',
    blurb: 'Light with enough energy per photon to break chemical bonds. Johann Ritter found it in 1801, a year after infrared, by watching silver chloride darken beyond the violet. The ozone layer stops most of the Sun\'s shorter UV before it reaches the ground.',
    made: 'The Sun, hot young stars, electric sparks, mercury lamps, UV LEDs.',
    uses: 'Sterilising water, curing glue and nail varnish, forensic lights, making vitamin D, printing computer chips.',
    matter: 'Breaks chemical bonds. In DNA it can weld two neighbouring thymines together, the damage behind sunburn.',
    links: [['Thymine, the DNA base UV welds', 'thymine'], ['Ozone, the shield', 'ozone']],
    subs: [
      { key: 'uva', name: 'UVA', long: 'Ultraviolet A', from: 380e-9, to: 315e-9 },
      { key: 'uvb', name: 'UVB', long: 'Ultraviolet B', from: 315e-9, to: 280e-9 },
      { key: 'uvc', name: 'UVC', long: 'Ultraviolet C', from: 280e-9, to: 100e-9 },
      { key: 'euv', name: 'EUV', long: 'Extreme ultraviolet', from: 100e-9, to: 10e-9 },
    ],
  },
  {
    key: 'xray', name: 'X-ray', from: 10e-9, to: 1e-12, hue: [80, 160, 190],
    short: 'Through skin, stopped by bone.',
    blurb: 'Wilhelm Röntgen found X-rays in 1895 and called them X for unknown. Their waves are the size of atoms, which is why they can show where the atoms in a crystal are. They pass through light elements and are stopped by heavy ones, so bone (calcium) shows and skin (carbon, hydrogen, oxygen) does not.',
    made: 'Electrons slammed into metal, gas at millions of degrees round black holes and in the Sun\'s corona.',
    uses: 'Medical imaging, airport scanners, crystallography (how DNA\'s shape was found), X-ray astronomy.',
    matter: 'Knocks electrons out of the inner shells of atoms; the light emitted as the hole refills is a fingerprint of the element.',
    links: [['Calcium, why bones show', 'element-Ca'], ['Copper, the classic X-ray target', 'element-Cu']],
    subs: [
      { key: 'soft-x', name: 'Soft', long: 'Soft X-rays', from: 10e-9, to: 0.1e-9 },
      { key: 'hard-x', name: 'Hard', long: 'Hard X-rays', from: 0.1e-9, to: 1e-12 },
    ],
  },
  {
    key: 'gamma', name: 'Gamma', from: 1e-12, to: 1e-22, hue: [190, 90, 160],
    short: 'From nuclei and the most violent places in the universe.',
    blurb: 'The most energetic light, and open-ended: no one knows the highest energy a photon can have. Gamma rays come from inside atomic nuclei, from matter meeting antimatter, and from exploding stars and black hole jets. The name is about where a photon comes from, not its wavelength, so a gamma ray from a nucleus can be longer than an X-ray from a tube.',
    made: 'Radioactive nuclei, positrons meeting electrons, lightning, supernovae, blazars, gamma-ray bursts.',
    uses: 'PET scans, radiotherapy, sterilising medical kit and food, gamma-ray astronomy.',
    matter: 'Can turn into matter: above 1.022 MeV a gamma ray passing a nucleus can become an electron and a positron.',
    links: [['The photon, in the particle zoo', 'particle-gamma'], ['Cobalt, the old radiotherapy source', 'element-Co']],
    subs: [
      { key: 'gamma-low', name: 'MeV', long: 'Low-energy gamma (to 100 MeV)', from: 1e-12, to: 1.24e-14 },
      { key: 'gamma-he', name: 'HE', long: 'High-energy gamma (100 MeV–100 GeV)', from: 1.24e-14, to: 1.24e-17 },
      { key: 'gamma-vhe', name: 'VHE', long: 'Very-high-energy gamma (100 GeV–100 TeV)', from: 1.24e-17, to: 1.24e-20 },
      { key: 'gamma-uhe', name: 'UHE', long: 'Ultra-high-energy gamma (over 100 TeV)', from: 1.24e-20, to: 1e-22 },
    ],
  },
];

for (const b of BANDS) for (const s of b.subs) s.band = b;

export const bandAt = metres => BANDS.find(b => metres <= b.from && metres > b.to) ?? (metres > SPAN.long / 2 ? BANDS[0] : BANDS[BANDS.length - 1]);
export const subAt = metres => bandAt(metres).subs.find(s => metres <= s.from && metres > s.to) ?? null;
export const centre = r => Math.sqrt(r.from * r.to);
export const byKey = key => BANDS.find(b => b.key === key) ?? BANDS.flatMap(b => b.subs).find(s => s.key === key) ?? null;

// What one photon has enough energy to do, by its energy in eV (each step is the lowest energy it starts at).
export const EFFECTS = [
  { ev: 0, name: 'Too weak alone', text: 'Less energy than the jiggle of a molecule at room temperature: only many photons together, pushing electrons, do anything.' },
  { ev: 0.025, name: 'Warms', text: 'Enough to set molecules spinning and bonds vibrating: it warms what absorbs it.' },
  { ev: 1.65, name: 'Can be seen', text: 'Enough to lift an outer electron, which is what the molecules in your eye need: you can see it.' },
  { ev: 3.26, name: 'Breaks bonds', text: 'Enough to break chemical bonds: it fades dyes, burns skin and damages DNA.' },
  { ev: 13.6, name: 'Ionises', text: 'Enough to tear electrons off atoms: ionising radiation.' },
  { ev: 1.022e6, name: 'Can make matter', text: 'Enough to turn into matter: near a nucleus it can become an electron and a positron.' },
];
export const effectAt = ev => [...EFFECTS].reverse().find(e => ev >= e.ev);
