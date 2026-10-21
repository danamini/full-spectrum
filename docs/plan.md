# Plan: Full Spectrum

Status: **phases 1–7 built 2026-10-20** (Daniel: "develop it all"). Not yet published: see section 10.
Decisions are in section 9.

**Daniel (2026-10-20):** "Some kind of interactive electromagnetic spectrum, the real colour
spectrum, infrared to ultraviolet, etc. A single page app, like Spectrum Aura
and molecule viewer. Wavelengths and animations, full end to end of the spectrum. Plan for now."

## 1. The idea

One continuous journey along the electromagnetic spectrum, from radio waves longer than a country
to gamma rays smaller than a nucleus: 30 powers of ten in wavelength (3 Hz to about 12 PeV, so the
most energetic photon yet seen, 1.4 PeV, is on the dial). It works like Molecule
Viewer's zoom, but the axis is wavelength instead of size. Every position shows the
wave itself, animated at a scale you can feel. Each position also shows its wavelength, frequency and
photon energy, what makes and uses that light, and what it does to matter.

Visible light is the centrepiece and a small part of the axis: 380–750 nm, a ratio of
1.97, so everything humans can see is just under one octave. Its colours are computed from the CIE
1931 colour-matching functions rather than an HSV rainbow, so the violet and red ends darken
the way they do in real life.

The name: *Full Spectrum*. It reuses "spectrum" (Spectrum Aura) and says end to end. Alternatives
are in section 8.

## 2. What's in it

### 2.1 The ribbon (the main control)
- A log-scale band across the screen from about 10⁷ m (ELF) to 10⁻¹⁵ m (high-energy gamma).
  Drag, scroll or pinch to move and zoom; the band names fade in at the scale where they fit.
- Three linked readouts on one cursor: wavelength (λ), frequency (f = c/λ), photon energy
  (E = hf, in eV). Type into any of them to jump there.
- The bands and sub-bands: radio (ITU ELF to EHF), microwave, infrared (far, mid, near), visible,
  ultraviolet (UVA, UVB, UVC, extreme), X-ray (soft, hard), gamma. Edges drawn soft, with a
  note that the boundaries are conventions that overlap; X-ray and gamma are named by their source
  (electrons or nuclei), not by wavelength.

### 2.2 The wave (the main animation)
- An animated wave whose wavelength changes smoothly as you move along the ribbon, drawn against a
  real object at that scale: a city, a football pitch, a hand, a hair, a bacterium, a virus, a
  molecule, an atom, a nucleus. This is Molecule Viewer's "scale you can feel" idea.
- A 3D view of the travelling wave: the electric and magnetic fields at right angles, both at right
  angles to the direction of travel. Polarisation can be switched between linear and circular.
- Photon mode: the same light as particles, with each dot's energy readout. As the energy rises the
  dots get sparser for the same power, which is the reason UV burns and radio doesn't.

### 2.3 The visible band, up close
- True colour from the CIE 1931 2° observer, converted to sRGB with out-of-gamut colours
  marked (spectral colours are more saturated than any screen can show).
- A prism and a rainbow splitting white light, animated.
- Sunlight's spectrum with its Fraunhofer lines, labelled by element.
- Emission lines of hydrogen, helium, sodium, neon and mercury. Each element links to its page in
  Molecule Viewer (`#element-Na`).
- Who sees what: the human cone curves, with bees in the UV and pit vipers in the infrared. Each
  claim is sourced or left out.

### 2.4 Along the spectrum: real things at their wavelengths
Pinned markers you can jump to, each with a line on why it sits there:

| Thing | Wavelength (about) |
| --- | --- |
| Submarine ELF radio | thousands of km |
| AM radio, FM radio | 300 m, 3 m |
| Wi-Fi 2.4 GHz, microwave oven 2.45 GHz | 12 cm |
| 5G mmWave | 1 cm |
| Cosmic microwave background, peak | 1.06 mm (2.725 K) |
| Your body's glow | 9.4 µm (310 K) |
| Fibre-optic internet | 1550 nm |
| TV remote | 940 nm |
| The Sun's peak | 502 nm (5772 K) |
| Sunburn (UVB) | 280–315 nm |
| EUV chip lithography | 13.5 nm |
| Medical X-ray | about 0.03 nm |
| PET scan (positron annihilation) | 0.0024 nm (511 keV) |

### 2.5 What each band does to matter
Radio drives currents in conductors, microwaves spin molecules, infrared makes bonds vibrate,
visible and UV light move outer electrons, and above about 10 eV (124 nm) light ionises. X-rays knock
out inner electrons and gamma rays come from nuclei. Each step links to the matching level in Molecule
Viewer (molecule, atom, nucleus).

### 2.6 Light from hot things
- A blackbody slider: temperature to Planck curve, the peak (Wien's law), and the colour it glows.
  Presets: the CMB, you, a hotplate, lava, a tungsten filament, the Sun, a blue giant.

### 2.7 Seeing through the air, and the sky in every light
- The atmosphere's transmission across the whole spectrum shows the radio and optical windows,
  which is why some telescopes are on the ground and the rest are in space.
- The same object (the Sun, the Crab Nebula, the Milky Way) in radio, infrared, visible, X-ray and
  gamma, using real survey images with credits.

### 2.8 Around it, as in the other apps
- A landing page with chapters (radio, microwave, infrared, visible, ultraviolet, X-ray, gamma).
- *Start the journey*: a captioned trip from the longest waves to the shortest.
- Tour and Surprise me, keyboard throughout (`?`), a phone layout, picture export.
- A shareable address for every place: `#visible`, `#nm-550`, `#ghz-2.45`, `#thing-microwave`,
  `#blackbody-5772`.
- Optional sound: each frequency shifted down by whole octaves into hearing, so the ribbon plays a
  pitch.
- Links out to Molecule Viewer (elements, atom, nucleus) from the first phase that has them.

## 3. Accuracy and sources

Every number and image is credited when it first appears, as in Molecule Viewer's README:

- Constants: CODATA 2018 exact values (c, h, k_B, Wien's b).
- Colour: CIE 1931 2° colour-matching functions (CVRL, UCL), IEC 61966-2-1 for sRGB.
- Band names: ITU-R V.431 (radio), ISO 21348 (solar spectral categories: UV, IR sub-bands).
- Spectral lines: NIST Atomic Spectra Database. Sunlight: ASTM G173 reference spectrum.
- Atmosphere: a sourced transmission dataset if one is licensed for reuse; if not, the plot is
  labelled schematic.
- Sky images: NASA (public domain) first; ESA and others only with a licence that allows public
  display, recorded in `docs/credits.md`.

The physics (unit conversion, Planck, CIE to sRGB) lives in one module with unit tests against
known values, so no number is copied across files.

## 4. How it's built

The same approach as Molecule Viewer: a static site with no build step.

- `index.html`, `css/app.css`, ES modules in `js/`, and three.js (the same release as Molecule
  Viewer) from jsDelivr through an import map.
- Proposed files:

| File | What it does |
| --- | --- |
| `js/main.js` | Routing (`#key`), landing page, panels, tour, journey, keyboard. |
| `js/physics.js` | λ ↔ f ↔ E, Planck, Wien, CIE → sRGB. The one definition. |
| `js/ribbon.js` | The log-scale band, zoom, cursor, readouts. |
| `js/wave.js` | The 2D wave, the 3D E and B fields, photon mode. |
| `js/visible.js` | Prism, rainbow, spectral lines, vision curves. |
| `js/blackbody.js`, `js/atmosphere.js`, `js/sky.js` | Sections 2.6 and 2.7. |
| `js/bands.js`, `js/things.js` | Data: bands and the pinned things. |
| `data/` | CIE tables, NIST lines, ASTM G173, generated by `tools/` scripts. |

- Tests: `tests/smoke.mjs` with Playwright drives every band, address, the journey and the phone
  layout, and fails on any console error. `tests/physics.mjs` checks the physics against
  known values.
- Performance: one canvas or WebGL context for the ribbon and the wave; the 3D field view runs only
  while it is open. Aim for 60 fps on a mid-range phone.

## 5. Look

Dark by default, so the visible band is the brightest thing on screen and the bands beyond it are
drawn in false colour clearly marked as such: a muted cool palette for long waves and a hot one
for short waves, never mistaken for real colour. Type follows the family (Big Shoulders Display and
IBM Plex Sans) so the apps sit together.

## 6. Phases

1. **Skeleton.** Repo, `index.html`, import map, `physics.js` with its tests, the smoke test running.
2. **The ribbon.** The log axis end to end, bands, linked readouts, zoom, addresses.
3. **The wave.** The 2D wave with scale objects, then the 3D E and B view and photon mode.
4. **Visible.** True colour, prism, rainbow, Fraunhofer and emission lines.
5. **Things and matter.** The pinned markers (2.4) and what each band does (2.5), with
   Molecule Viewer links.
6. **Hot things and the sky.** Blackbody, atmosphere, multiwavelength images.
7. **Story and release.** Landing page, the journey, tour, phone, picture export, README with
   screenshots and a GIF, credits, publish.

Each phase ends with something usable that can be reviewed before the next one starts.

## 7. Not in scope (for now)

- A backend. It's static; any live data must be fetched by the browser from its source.
- Gravitational waves, sound and other non-EM waves (a "Not light" note may go on the landing page
  later).

## 8. Hosting

GitHub Pages, from a **private** repo `danamini/full-spectrum`, served at `spectrum.moleculeviewer.org`:

- The repo holds a `CNAME` file with the subdomain, as Molecule Viewer does.
- DNS: one `CNAME` record, `spectrum` → `danamini.github.io`, at the domain's DNS host
  (moleculeviewer.org's is GoDaddy). Then *Enforce HTTPS* in the repo's Pages settings.
- Verify the domain in GitHub's account settings (Pages → verified domains) so nobody else's
  repo can claim the subdomain.
- **Catch:** Pages from a private repo needs a paid GitHub plan (Pro or above). On the free plan the
  repo has to go public before it can publish, or it publishes from a separate public repo
  holding only the site. Check the plan before phase 7.

## 9. Decisions (Daniel, 2026-10-20)

1. **Name:** Full Spectrum.
2. **Stack:** as Molecule Viewer: static, no build, three.js by import map.
3. **Hosting:** GitHub Pages for now, on a subdomain of an existing domain (section 8).
4. **Cross-links:** yes, to Molecule Viewer from the start.
5. **Repo:** private to start with; public from 2026-10-21 (v0.0.1), so GitHub Pages can serve it.
6. **Domain:** `spectrum.moleculeviewer.org` (the `CNAME` file is in the repo). Live since 2026-10-21: GoDaddy
   CNAME `spectrum` to `danamini.github.io`, Pages from `main`, HTTPS enforced (certificate renews itself).

## 10. Next work

Built 2026-10-20: the dial, the wave beside real objects, 3D fields, photons, forty things, visible light
(prism, lines, sunlight, eyes), hot things, through the air, the sky (Milky Way, Sun, Crab), journey, tour,
sound, pictures, keyboard, phone layout, addresses. Tests: `tests/physics.mjs`, `tests/smoke.mjs`.

Still to do:

Done 2026-10-21: published at https://spectrum.moleculeviewer.org (repo made public; code MIT, data and
pictures under their owners' terms); v0.0.1 tagged; What's new and releases (README, Releases).

1. **Release 0.0.2** when Daniel asks: its notes are in `assets/releases.json` (status `next`).
2. **Sky gaps** (docs/credits-sky.md, "Left out"): the Sun in radio (Nobeyama 17 GHz, terms page
   unreachable), infrared and gamma; the Milky Way in ultraviolet. Add if a licensable image turns up.
3. **Atmosphere** is approximate (`schematic: true`): its optical segment is sea level and the rest Maunakea,
   so there is a small step at 0.9 µm. A single consistent model would remove it.
4. **Unchecked figures:** the honeybee peaks (344/436/556 nm, Peitsch et al. 1992) were checked against
   the abstract only; check the full text.
5. **Unchecked figures:** the dark-adapted eye's threshold (Hecht, Shlaer and Pirenne 1942: 54 to 148 photons
   at the cornea, 5 to 14 absorbed) in the photon cards is from memory; check the paper.
6. **README GIF**, like Molecule Viewer's, now the site is live.

