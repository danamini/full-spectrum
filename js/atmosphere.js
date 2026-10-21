// Through the air: how much light from space reaches the ground at each wavelength, and so which telescopes can
// sit on a mountain and which must go to space.
import { ATMOSPHERE, WINDOWS } from '../data/atmosphere.js';
import { wavelength, wavelengthFromEV } from './physics.js';
import * as fmt from './format.js';

const LOGS = ATMOSPHERE.metres.map(Math.log10);

// Fraction reaching the ground (0–1), interpolated in log wavelength.
export function transmission(metres) {
  const l = Math.log10(metres), n = LOGS.length;
  // The table may run either way; find the bracketing pair.
  const up = LOGS[n - 1] > LOGS[0];
  if (up ? l <= LOGS[0] : l >= LOGS[0]) return ATMOSPHERE.transmission[0];
  if (up ? l >= LOGS[n - 1] : l <= LOGS[n - 1]) return ATMOSPHERE.transmission[n - 1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; (up ? LOGS[mid] <= l : LOGS[mid] >= l) ? (lo = mid) : (hi = mid); }
  const t = (l - LOGS[lo]) / (LOGS[hi] - LOGS[lo]);
  return ATMOSPHERE.transmission[lo] + (ATMOSPHERE.transmission[hi] - ATMOSPHERE.transmission[lo]) * t;
}

// For the ribbon: the air's opacity hanging down from the top, like a curtain.
export const ribbonOverlay = () => ({ fill: 'rgba(3, 5, 11, 0.62)', sample: m => 1 - transmission(m) });

const hz = f => wavelength(f), ev = e => wavelengthFromEV(e);

// What the air does to each stretch of the spectrum, longest first. The pieces tile the whole dial.
export const ABSORBERS = [
  { from: 1e8, to: 20, title: 'Turned back by the ionosphere',
    text: 'From about 60 km up, sunlight strips electrons off atoms and leaves a layer of free electrons, the ionosphere. Radio waves longer than about 10 to 30 metres (below roughly 10 to 30 MHz; it changes with the time of day, the season and the Sun\'s activity) bounce off it. From space they cannot get in. From the ground, short-wave radio bounces off it and round the world. Astronomers hope to listen at these wavelengths from the far side of the Moon, away from Earth\'s radio noise as well.' },
  { from: 20, to: 0.01, title: 'The radio window',
    text: 'Wide open, day and night, through cloud. That is why radio astronomy can work from the ground in daylight and under cloud. Above about 10 GHz (wavelengths under 3 cm) water vapour and rain start to absorb, with the first water line at 22 GHz (1.35 cm), which is why satellite TV can fade in a downpour.' },
  { from: 0.01, to: 3e-4, title: 'Millimetre waves: oxygen and water vapour',
    text: 'Oxygen absorbs strongly around 60 GHz (5 mm) and 119 GHz (2.5 mm), and water vapour at 183 GHz (1.6 mm) and in more lines beyond. Between them are windows at about 3 mm, 1.3 mm and 850 µm, and narrower ones that open only in the driest air. That is why ALMA is 5,000 m up in the Atacama desert, above much of the water vapour.' },
  { from: 3e-4, to: 3e-5, title: 'Far infrared: water vapour, opaque',
    text: 'Water molecules spin, and they absorb at thousands of wavelengths here, enough to make the air opaque even from the highest, driest mountains. Astronomers flew telescopes on balloons and aircraft (SOFIA, a 2.5 m telescope in a converted Boeing 747, flew above 99% of the water vapour from 2010 to 2022) and sent satellites such as Herschel.' },
  { from: 3e-5, to: 1.3e-5, title: 'Carbon dioxide and water vapour',
    text: 'Carbon dioxide\'s strong band at 15 µm and water vapour lines close most of this stretch, with a patchy window (the Q band, 17 to 25 µm) usable from high, dry sites. The 15 µm band is the heart of the greenhouse effect: the Earth glows in infrared, brightest near 10 µm, and carbon dioxide absorbs the part near 15 µm and sends some of it back down.' },
  { from: 1.3e-5, to: 8e-6, title: 'The Earth\'s own window',
    text: 'Clear, apart from a dip at 9.6 µm where ozone absorbs. The Earth\'s glow is brightest here, so much of the heat it loses to space leaves through this window; thermal cameras, which see people and buildings in the dark, work here too. Telescopes can observe, but the warm sky and the telescope itself glow brightly at these wavelengths, a little like stargazing in daylight.' },
  { from: 8e-6, to: 5.5e-6, title: 'Water vapour, opaque',
    text: 'Water vapour\'s strong band around 6.3 µm blocks everything here, from any site on the ground.' },
  { from: 5.5e-6, to: 7.5e-7, title: 'Near infrared: windows between water bands',
    text: 'Water vapour absorbs in bands near 0.94, 1.1, 1.4, 1.9 and 2.7 µm, and carbon dioxide at 4.3 µm. Between them are the windows astronomers call J, H, K, L and M. Telescopes on dry mountains such as Maunakea and Paranal observe in them, using adaptive optics to cancel the air\'s shimmer, which is weaker at these wavelengths than in visible light.' },
  { from: 7.5e-7, to: 4e-7, title: 'Visible light: the clear window',
    text: 'The air is almost clear. Its molecules scatter short waves more than long, by the fourth power of the frequency: violet at 400 nm scatters about nine times as much as red at 700 nm. That is why the sky is blue and the setting Sun red. The clear window lines up with where the Sun is brightest, and with what our eyes see.' },
  { from: 4e-7, to: 3.15e-7, title: 'UVA: mostly gets through',
    text: 'Ozone barely touches UVA, so nearly all the ultraviolet that reaches the ground, about 95% of it, is UVA. It tans skin and ages it, and makes white shirts and some minerals glow under a black light.' },
  { from: 3.15e-7, to: 2.8e-7, title: 'UVB: mostly stopped by ozone',
    text: 'The ozone layer absorbs most UVB, more strongly the shorter the wavelength. The little that gets through causes sunburn and makes vitamin D in skin. Thinning of the ozone layer lets more through, which is why the ozone hole mattered.' },
  { from: 2.8e-7, to: 2e-7, title: 'UVC: all stopped by ozone',
    text: 'Ozone in the stratosphere, 15 to 35 km up, absorbs all of it, most strongly near 255 nm. UVC breaks DNA, which is why germicidal lamps use it; without the ozone layer, life on land would be scorched. The ozone layer itself comes from the next stretch down.' },
  { from: 2e-7, to: 1e-7, title: 'Absorbed by oxygen',
    text: 'Oxygen molecules absorb this ultraviolet high in the atmosphere and split into single oxygen atoms. Those join other oxygen molecules to make ozone, so this light builds the ozone layer that stops the UVC.' },
  { from: 1e-7, to: 1e-8, title: 'Extreme ultraviolet: makes the ionosphere',
    text: 'Absorbed 100 km up and more by oxygen and nitrogen, knocking electrons off them. That is what makes the ionosphere, and it heats the thin upper air (the thermosphere) to between about 500 and 2,000 °C, depending on how active the Sun is.' },
  { from: 1e-8, to: 1e-10, title: 'Soft X-rays: absorbed high up',
    text: 'Each X-ray is absorbed by an atom of the upper air, which loses an electron. None get near the ground. X-ray astronomy began in 1962, when a rocket carried detectors above the air for a few minutes and found the first X-ray star, Scorpius X-1.' },
  { from: 1e-10, to: ev(30e6), title: 'Hard X-rays and gamma rays: scattered and absorbed',
    text: 'These bounce off electrons in the air (Compton scattering), losing energy each time until they are absorbed. The whole atmosphere is as much shielding as about 10 metres of water, so none from space reach the ground. Telescopes for them fly on satellites and balloons.' },
  { from: ev(30e6), to: 1e-22, title: 'High-energy gamma rays: particle showers',
    text: 'A gamma ray this energetic turns into an electron and a positron when it hits the air, and they make more gamma rays, and so on: a shower of particles. From a few tens of GeV the shower gives a flash of blue light a few billionths of a second long, which telescopes such as H.E.S.S. photograph. At the highest energies the shower\'s particles reach the ground, where LHAASO catches them. The air itself becomes the detector.' },
];
export const absorberAt = m => ABSORBERS.find(a => m <= a.from && m > a.to) ?? (m > ABSORBERS[0].from ? ABSORBERS[0] : ABSORBERS[ABSORBERS.length - 1]);
export const windowAt = m => WINDOWS.find(w => m <= Math.max(w.from, w.to) && m >= Math.min(w.from, w.to)) ?? null;

// Telescopes, each with the range it works over (long end first) and where it is. `note` is the one-line
// tooltip; the rest is for the details panel.
export const TELESCOPES = [
  { name: 'FAST', where: 'ground', from: hz(70e6), to: hz(3e9), note: 'China, 500 m dish',
    place: 'Guizhou, south-west China, in a natural bowl among limestone hills.', size: 'A 500 m dish of 4,450 panels; it uses a 300 m patch at a time.', years: 'Since 2016.',
    story: 'The largest single-dish radio telescope. Motors pull the panels into a perfect curve wherever it is looking. It has found more than 1,000 new pulsars, spinning neutron stars.',
    why: 'Radio passes straight through the air, and a natural basin made a giant dish affordable.' },
  { name: 'Very Large Array', where: 'ground', from: hz(74e6), to: hz(50e9), note: 'New Mexico',
    place: 'The Plains of San Agustin, New Mexico, 2,124 m up.', size: '27 dishes, each 25 m, moved on rails to spread up to 36 km across.', years: 'Since 1980; renamed the Karl G. Jansky VLA in 2012.',
    story: 'The dishes are combined into one telescope that sees detail as fine as a single dish as wide as their spread. It made the radio picture of the Crab Nebula in The sky.',
    why: 'High, flat and dry, and far from towns\' radio noise.' },
  { name: 'ALMA', where: 'ground', from: 3.6e-3, to: 0.32e-3, note: 'Chile, 5,000 m up, in some of the driest air on Earth',
    place: 'The Chajnantor plateau in the Atacama desert, Chile, 5,000 m up.', size: '66 dishes, 54 of 12 m and 12 of 7 m, which can spread up to 16 km apart.', years: 'Fully working since 2013.',
    story: 'Photographed the rings in the planet-forming disc around the young star HL Tauri (2014), and was part of the Event Horizon Telescope that pictured the black holes in the galaxy M87 (2019) and at the centre of the Milky Way (2022). Its map of the Sun is in The sky.',
    why: 'Water vapour absorbs millimetre waves, so it sits above much of it, in one of the driest places on Earth.' },
  { name: 'Planck', where: 'space', from: hz(30e9), to: hz(857e9), note: 'mapped the cosmic microwave background (2009–2013)',
    place: 'Around the L2 point, 1.5 million km from Earth on the side away from the Sun.', size: 'A 1.5 m telescope; its most sensitive detectors were cooled to a tenth of a degree above absolute zero.', years: '2009 to 2013 (European Space Agency).',
    story: 'Mapped the faint afterglow of the Big Bang over the whole sky, pinning down the age of the universe at 13.8 billion years and what it is made of.',
    why: 'It had to see the whole sky and be colder than the 2.7 K glow it measured; the warm Earth and its air would swamp it.' },
  { name: 'Herschel', where: 'space', from: 672e-6, to: 55e-6, note: 'far infrared (2009–2013)',
    place: 'Around the L2 point, 1.5 million km from Earth.', size: 'A 3.5 m mirror, the largest in space until James Webb.', years: '2009 to 2013, until its liquid helium coolant ran out (European Space Agency).',
    story: 'Mapped the cold dust and gas where stars form and found them threaded with long filaments, with young stars strung along them like beads. It also traced water from clouds to comets.',
    why: 'Water vapour blocks the far infrared even from mountains, and a far-infrared telescope must be very cold.' },
  { name: 'James Webb', where: 'space', from: 28.5e-6, to: 0.6e-6, note: 'infrared, since 2022',
    place: 'Around the L2 point, 1.5 million km from Earth.', size: 'A 6.5 m mirror of 18 gold-coated segments, behind a sunshield the size of a tennis court that keeps it below about −220 °C.', years: 'Launched on Christmas Day 2021; observing since July 2022 (NASA, ESA and the Canadian Space Agency).',
    story: 'Sees the first galaxies, whose light the expanding universe has stretched from visible into infrared, and reads the gases in the atmospheres of planets round other stars.',
    why: 'Faint infrared is drowned by the glow of warm air and a warm telescope, so it must be cold and above the air.' },
  { name: 'Very Large Telescope', where: 'ground', from: 24e-6, to: 300e-9, note: 'Chile, visible and the infrared windows',
    place: 'Cerro Paranal in the Atacama desert, Chile, 2,635 m up.', size: 'Four 8.2 m telescopes, which can work together, and four movable 1.8 m ones.', years: 'Since 1998 (European Southern Observatory).',
    story: 'Took the first picture of a planet outside the Solar System (2004), and tracked stars orbiting the black hole at the centre of the Milky Way, work that shared the 2020 Nobel Prize in Physics.',
    why: 'Visible light and the infrared windows pass through the air, and a high desert has clear, steady skies most nights. Adaptive optics cancel the air\'s shimmer.' },
  { name: 'Hubble', where: 'space', from: 2.5e-6, to: 115e-9, note: 'ultraviolet, visible and near infrared',
    place: 'Low Earth orbit, about 540 km up, circling every 95 minutes.', size: 'A 2.4 m mirror.', years: 'Since 1990; repaired and upgraded by five Space Shuttle crews (NASA and ESA).',
    story: 'Its deep fields found thousands of galaxies in a speck of dark sky. It measured how fast the universe is expanding and helped show the expansion is speeding up.',
    why: 'Above the air it sees the ultraviolet that ozone blocks, and the stars do not shimmer.' },
  { name: 'Chandra', where: 'space', from: ev(100), to: ev(10e3), note: 'X-rays, since 1999',
    place: 'A long, looping orbit that reaches about a third of the way to the Moon.', size: 'Nested mirror shells up to 1.2 m across. X-rays only reflect at grazing angles, like a stone skimming water, so the mirrors are nearly parallel tubes.', years: 'Since 1999 (NASA).',
    story: 'The sharpest X-ray telescope: it sees gas at millions of degrees between galaxies, matter falling into black holes, and the pulsar wind in its picture of the Crab Nebula in The sky.',
    why: 'X-rays never reach the ground.' },
  { name: 'Fermi', where: 'space', from: ev(8e3), to: ev(300e9), note: 'gamma rays, since 2008',
    place: 'Low Earth orbit, about 550 km up.', size: 'No mirror: gamma rays go straight through anything that could focus them. Each one is turned into an electron and a positron inside sheets of tungsten, and their tracks show where it came from.', years: 'Since 2008 (NASA and partners).',
    story: 'Sees the whole sky every three hours. It found the Crab Nebula\'s gamma-ray flares (in The sky), and in 2017 caught the gamma-ray burst from two neutron stars colliding, whose gravitational waves LIGO and Virgo had felt 1.7 seconds earlier.',
    why: 'Gamma rays at these energies are absorbed high in the air.' },
  { name: 'H.E.S.S.', where: 'ground', from: ev(30e9), to: ev(100e12), note: 'on the ground, but it watches the flashes gamma rays make high in the air',
    place: 'The Khomas Highland, Namibia, 1,800 m up.', size: 'Four 12 m telescopes and one of 28 m, with fast cameras.', years: 'Since 2004 (the big one since 2012).',
    story: 'A very high energy gamma ray hits the top of the air and sets off a shower of particles that gives a flash of blue light a few billionths of a second long. The telescopes photograph each flash from several sides and work out where the gamma ray came from. It mapped dozens of new gamma-ray sources along the Milky Way.',
    why: 'Dark, clear southern skies. The gamma rays never reach it; the air is part of the detector.' },
  { name: 'LHAASO', where: 'ground', from: ev(100e9), to: ev(1e16), note: 'catches the particle showers that reach a mountain in Tibet',
    place: 'Mount Haizi, Sichuan, on the Tibetan Plateau, 4,410 m up.', size: 'More than 5,000 particle detectors and 1,000 buried muon detectors spread over 1.3 km², 78,000 m² of water-filled pools, and 18 telescopes.', years: 'Complete since 2021 (Chinese Academy of Sciences).',
    story: 'At the very highest energies the particle shower reaches the ground. LHAASO catches its particles and works back to the gamma ray. It has seen gamma rays above 1 PeV, the most energetic light ever recorded, from places in the Milky Way where particles are being accelerated.',
    why: 'High on a plateau, more of the shower is left to catch.' },
];

export class AirView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.metres = 550e-9;
    this.rect = { x: 0, y: 0, w: 100, h: 100 };
    this.hits = [];
    this.selected = null; // a telescope's name
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    this.size = { w: r.width, h: r.height };
  }

  hitAt(x, y) { return this.hits.find(h => x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) ?? null; }

  draw() {
    const { ctx, dpr, rect } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.size.w, this.size.h);
    this.hits = [];
    const L0 = 4, L1 = -22; // 10 km to the end of the dial
    const x0 = rect.x + 8, x1 = rect.x + rect.w - 44;
    const xOf = m => x0 + ((L0 - Math.log10(m)) / (L0 - L1)) * (x1 - x0);
    const chartTop = rect.y + 30, chartBot = rect.y + rect.h * 0.48;
    ctx.save();
    // Sky above, ground below; the curtain is what the air absorbs.
    const sky = ctx.createLinearGradient(0, chartTop, 0, chartBot);
    sky.addColorStop(0, 'rgba(40,60,110,0.25)'); sky.addColorStop(1, 'rgba(40,60,110,0.05)');
    ctx.fillStyle = sky; ctx.fillRect(x0, chartTop, x1 - x0, chartBot - chartTop);
    ctx.beginPath(); ctx.moveTo(x0, chartTop);
    for (let x = x0; x <= x1; x += 1.5) {
      const m = 10 ** (L0 - ((x - x0) / (x1 - x0)) * (L0 - L1));
      ctx.lineTo(x, chartTop + (1 - transmission(m)) * (chartBot - chartTop));
    }
    ctx.lineTo(x1, chartTop); ctx.closePath();
    const curtain = ctx.createLinearGradient(0, chartTop, 0, chartBot);
    curtain.addColorStop(0, '#5b6578'); curtain.addColorStop(1, '#2a3140');
    ctx.fillStyle = curtain; ctx.fill();
    ctx.strokeStyle = 'rgba(230,235,243,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(160,180,220,0.18)'; ctx.fillRect(x0, chartBot, x1 - x0, 2);
    ctx.font = '500 11px "IBM Plex Sans", sans-serif'; ctx.fillStyle = '#8b96aa'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('absorbed by the air', x0 + 6, chartTop + 4);
    ctx.textBaseline = 'bottom'; ctx.fillText('reaches the ground', x0 + 6, chartBot - 4);
    // The named windows.
    ctx.textAlign = 'center'; ctx.fillStyle = '#e6ebf3'; ctx.font = '600 11px "IBM Plex Sans", sans-serif';
    let lastX = -1e9;
    for (const w of WINDOWS) {
      const xa = xOf(w.from), xb = xOf(w.to), xm = (xa + xb) / 2;
      const tw = ctx.measureText(w.name).width;
      if (xm - tw / 2 < lastX + 6) continue;
      ctx.fillText(w.name, xm, chartBot - 18);
      lastX = xm + tw / 2;
      this.hits.push({ window: w, x0: Math.min(xa, xb), x1: Math.max(xa, xb, Math.min(xa, xb) + 6), y0: chartTop, y1: chartBot, text: `${w.name}: ${fmt.length(w.from)} – ${fmt.length(w.to)}${w.note ? `. ${w.note}` : ''}` });
    }
    // Scale.
    ctx.fillStyle = '#8b96aa'; ctx.font = '500 11px "IBM Plex Sans", sans-serif'; ctx.textBaseline = 'top';
    for (let e = L0; e >= L1; e -= 2) { const x = xOf(10 ** e); ctx.fillRect(x, chartBot + 2, 1, 4); ctx.fillText(fmt.length(10 ** e), x, chartBot + 8); }
    // Telescopes: ground ones below the line, space ones above the chart, as bars over their ranges.
    const rows = { space: [], ground: [] };
    const groundTop = chartBot + 36;
    ctx.font = '500 11.5px "IBM Plex Sans", sans-serif'; ctx.textBaseline = 'middle';
    for (const t of TELESCOPES) {
      const xa = Math.max(x0, xOf(t.from)), xb = Math.min(x1, xOf(t.to));
      const tw = ctx.measureText(t.name).width;
      const x = Math.min(Math.max((xa + xb) / 2, x0 + tw / 2), x1 - tw / 2);
      const lane = t.where === 'space' ? rows.space : rows.ground;
      let row = 0;
      while (lane.some(r => r.row === row && x - tw / 2 - 8 < r.x1 && Math.max(xb, x + tw / 2) + 8 > r.x0)) row++;
      lane.push({ row, x0: Math.min(xa, x - tw / 2), x1: Math.max(xb, x + tw / 2) });
      const y = t.where === 'space' ? rect.y + rect.h * 0.62 + row * 30 : groundTop + row * 30;
      const col = t.where === 'space' ? '#7cc4ff' : '#f2b45a', on = t.name === this.selected;
      if (on) { ctx.fillStyle = 'rgba(242, 180, 90, 0.12)'; ctx.beginPath(); ctx.roundRect(Math.min(xa, x - tw / 2) - 6, y - 11, Math.max(xb, x + tw / 2) - Math.min(xa, x - tw / 2) + 12, 26, 7); ctx.fill(); }
      ctx.fillStyle = col; ctx.globalAlpha = on ? 1 : 0.85;
      ctx.fillRect(xa, y + 8, Math.max(3, xb - xa), on ? 4 : 3);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center'; ctx.fillStyle = on ? '#f2b45a' : '#e6ebf3';
      ctx.fillText(t.name, x, y);
      this.hits.push({ scope: t, x0: Math.min(xa, x - tw / 2), x1: Math.max(xb, x + tw / 2), y0: y - 9, y1: y + 12, text: `${t.name} (${t.where === 'space' ? 'in space' : 'on the ground'}): ${fmt.length(t.from)} – ${fmt.length(t.to)}. ${t.note}` });
    }
    // Legend.
    ctx.textAlign = 'left'; ctx.font = '500 11px "IBM Plex Sans", sans-serif';
    const ly = rect.y + rect.h - 12;
    ctx.fillStyle = '#f2b45a'; ctx.fillRect(x0, ly - 2, 14, 3); ctx.fillStyle = '#8b96aa'; ctx.fillText('on the ground', x0 + 20, ly);
    ctx.fillStyle = '#7cc4ff'; ctx.fillRect(x0 + 120, ly - 2, 14, 3); ctx.fillStyle = '#8b96aa'; ctx.fillText('in space', x0 + 140, ly);
    if (ATMOSPHERE.schematic) { ctx.fillStyle = '#5b6578'; ctx.textAlign = 'right'; ctx.fillText('Curve assembled from several sources; shape is approximate. See credits.', x1, ly); }
    // The cursor.
    const cx = xOf(this.metres);
    if (cx >= x0 && cx <= x1) { ctx.strokeStyle = '#f2b45a'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(cx, chartTop); ctx.lineTo(cx, chartBot); ctx.stroke(); ctx.setLineDash([]); }
    ctx.restore();
  }
}
