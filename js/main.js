// The page: routing (#addresses), the readout, the details panel, the views and their controls, the journey,
// tour, keyboard, sound and picture export.
import * as P from './physics.js';
import { BANDS, SPAN, bandAt, subAt, byKey, effectAt } from './bands.js';
import { THINGS, thingByKey } from './things.js';
import { spectral, css, VISIBLE, blackbody as glowColour } from './colour.js';
import { moleculeViewer, siblingApp } from './links.js';
import { Ribbon } from './ribbon.js';
import { WaveView, waveColour } from './wave.js';
import { VisibleView, VIEWS as VIS_VIEWS } from './visible.js';
import { BlackbodyView, PRESETS, T_MIN, T_MAX, glowText, shares as bbShares, ribbonOverlay as bbOverlay } from './blackbody.js';
import { Tone, octaveDown } from './sound.js';
import { JOURNEY } from './journey.js';
import { ANIMALS } from '../data/cones.js';
import { SOLAR } from '../data/solar.js';
import * as fmt from './format.js';
import { fieldNotes, photonNotes, fieldCard } from './notes.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const body = document.body;

const state = {
  view: 'spectrum',   // spectrum | visible | blackbody | air | sky
  mode: 'wave',       // wave | field | photons (spectrum view)
  vis: 'prism',
  kelvin: 5772,
  sky: null,
  scope: null,        // the telescope chosen in Through the air
  thing: null,        // the marked thing, while the cursor is on it
  tour: null,
  journey: null,
  landing: true,
};

// ---------------------------------------------------------------- views
const ribbon = new Ribbon($('#ribbon'), { onChange: changed, onPick: t => go(`thing-${t.key}`) });
const wave = new WaveView($('#waveCanvas'));
const vis = new VisibleView($('#visCanvas'));
const bb = new BlackbodyView($('#bbCanvas'));
let field = null, air = null, sky = null, airMod = null, fieldMod = null;
const tone = new Tone();

async function getField() {
  if (!field) { fieldMod = await import('./field3d.js'); field = new fieldMod.FieldView($('#fieldHost')); field.setColour(waveColour(ribbon.metres).rgb); updateFieldCard(); }
  return field;
}
// The words on the 3D view: the wavelength under its bracket, and the card in the corner.
function updateFieldCard() {
  if (!field) return;
  const m = ribbon.metres;
  $('#fieldCard').innerHTML = fieldCard(m, field.polar, fieldMod.SHOWN_HZ);
  $('#fieldLength').textContent = fmt.length(m);
  $('.field-labels').style.setProperty('--field-e', css(waveColour(m).rgb));
}
async function getAir() {
  if (!air) { airMod = await import('./atmosphere.js'); air = new airMod.AirView($('#airCanvas')); layout(); detailsKey = ''; details(); }
  return air;
}
async function getSky() {
  if (!sky) {
    const mod = await import('./sky.js');
    sky = new mod.SkyView($('#skyHost'), { onPick: im => ribbon.tune(im.metres, ribbon.span, 900) });
    $('#skyTabs').innerHTML = mod.SKY.map(o => `<button type="button" data-sky="${o.key}" aria-pressed="false">${esc(o.name)}</button>`).join('');
    $$('#skyTabs button').forEach(b => b.addEventListener('click', () => go(`sky-${b.dataset.sky}`)));
    sky.objects = mod.SKY;
  }
  return sky;
}

// The rectangle the views may draw in: below the readout, left of the details panel, above the controls.
function layout() {
  const phone = innerWidth < 820;
  const top = $('.readout').getBoundingClientRect().bottom + 10;
  const right = phone ? innerWidth - 12 : $('#details').getBoundingClientRect().left - 16;
  const bottom = $('#controls').getBoundingClientRect().top - 8;
  const left = phone ? 12 : 24;
  const rect = { x: left, y: top, w: Math.max(100, right - left), h: Math.max(120, bottom - top) };
  for (const v of [wave, vis, bb, air]) if (v) v.rect = rect;
  const fh = $('#fieldHost');
  Object.assign(fh.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` });
  const sh = $('#skyHost');
  Object.assign(sh.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` });
  field?.resize();
}
addEventListener('resize', layout);
new ResizeObserver(layout).observe($('#details'));

// ---------------------------------------------------------------- the cursor moved
let hashTimer = 0;
function changed(metres) {
  // Leave a thing once the cursor has moved off it (not while the dial is still flying, which may be on its way to it).
  if (state.thing && !ribbon.anim && Math.abs(Math.log10(metres / state.thing.m)) > ribbon.span * 0.02) { state.thing = null; ribbon.marked = null; ribbon.dirty = true; }
  wave.metres = vis.metres = metres;
  if (air) air.metres = metres;
  sky?.set(metres);
  field?.setColour(waveColour(metres).rgb);
  if (state.mode === 'field') updateFieldCard();
  tone.set(metres);
  readout(metres);
  details();
  clearTimeout(hashTimer);
  // Only if nothing else has changed the address meanwhile: a new address arriving inside the 400 ms must win.
  const was = location.hash;
  if (!state.landing && state.view === 'spectrum' && !state.thing && !state.journey) hashTimer = setTimeout(() => location.hash === was && setHash(addressFor(metres)), 400);
}

// "#nm-550", "#ghz-2.45", "#kev-511": the unit the number reads best in.
function addressFor(m) {
  const [num, unit] = fmt.length(m).split(' ');
  if (!unit || num.includes('×')) return `m-${Number(m.toPrecision(4))}`;
  return `${unit.replace('µ', 'u')}-${num.replace(/,/g, '')}`;
}

function setHash(h) { if (location.hash.slice(1) !== h) history.replaceState(null, '', `#${h}`); }

// ---------------------------------------------------------------- readout
const inputs = { length: $('#inLength'), freq: $('#inFreq'), energy: $('#inEnergy') };
function readout(m) {
  const band = bandAt(m), sub = subAt(m);
  const thing = state.thing;
  $('#name').textContent = thing ? thing.name : band.key === 'visible' && sub ? sub.name : band.name;
  $('#kicker').textContent = thing ? `${band.name}${sub && sub.name !== thing.name ? ` · ${sub.long ?? sub.name}` : ''}` : band.key === 'visible' ? 'Visible light' : sub ? sub.long ?? sub.name : '';
  const isVis = m <= VISIBLE.from && m >= VISIBLE.to;
  $('#name').style.color = isVis ? css(waveColour(m).rgb) : '';
  for (const [k, el] of Object.entries(inputs)) {
    if (document.activeElement === el) continue;
    el.value = k === 'length' ? fmt.length(m) : k === 'freq' ? fmt.frequency(P.frequency(m)) : fmt.energy(P.photonEnergyEV(m));
  }
}
for (const [k, el] of Object.entries(inputs)) {
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const m = fmt.parse(el.value, k === 'length' ? 'm' : k === 'freq' ? 'hz' : 'ev', P);
      if (m && m <= SPAN.long && m >= SPAN.short) { el.blur(); stopAll(); showSpectrumIfNeeded(); ribbon.tune(m, Math.min(ribbon.span, 2)); }
      else { el.classList.add('bad'); setTimeout(() => el.classList.remove('bad'), 600); }
    } else if (e.key === 'Escape') { el.blur(); readout(ribbon.metres); }
    e.stopPropagation();
  });
  el.addEventListener('focus', () => el.select());
  el.addEventListener('blur', () => readout(ribbon.metres));
}

// ---------------------------------------------------------------- details panel
let detailsKey = '', detailsNumbers = '';
function details() {
  const m = ribbon.metres, band = bandAt(m), sub = subAt(m), ev = P.photonEnergyEV(m);
  const v = state.view;
  const tones = tone.on ? octaveDown(P.frequency(m)).octaves : '';
  // Through the air rebuilds only for a new telescope; what is under the dial is patched in place by airLive.
  const key = v === 'air' ? [v, !!airMod, state.scope?.name, tones].join('|')
    : [v, state.vis, band.key, state.thing?.key, v === 'blackbody' ? bbPreset()?.key ?? 'other' : '', effectAt(ev).ev, tones, state.sky?.key, sky?.current?.file, state.mode, field?.polar].join('|');
  // The fields and photons notes quote numbers for the exact wavelength; those change without moving the reader.
  const numbers = v === 'spectrum' && state.mode !== 'wave' ? fmt.length(m) : v === 'blackbody' ? Math.round(state.kelvin) : '';
  if (key + numbers === detailsKey + detailsNumbers) { if (v === 'air') airLive(m); return; }
  const keepScroll = key === detailsKey;
  detailsKey = key; detailsNumbers = numbers;
  let html = '';
  if (v === 'visible') {
    const info = VIS_VIEWS[state.vis];
    html += `<h2>${esc(info.name)}</h2><p>${esc(info.blurb)}</p>`;
    for (const [h, t] of info.more ?? []) html += `<h3>${esc(h)}</h3><p>${esc(t)}</p>`;
    if (state.vis === 'lines') html += `<h3>In Molecule Viewer</h3><ul class="links">${[['H', 'Hydrogen'], ['He', 'Helium'], ['Na', 'Sodium'], ['Ne', 'Neon'], ['Hg', 'Mercury']].map(([s, n]) => `<li><a href="${moleculeViewer(`element-${s}`)}" target="_blank" rel="noopener">${n}</a></li>`).join('')}</ul><p class="note">Hover a line to read its wavelength.</p>`;
    if (state.vis === 'eyes') html += ANIMALS.map(a => `<h3>${esc(a.animal)}</h3><p>${esc(a.note)}</p>`).join('') + `<h3>In Molecule Viewer</h3><ul class="links"><li><a href="${moleculeViewer('retinal')}" target="_blank" rel="noopener">Retinal, the molecule in every cone</a></li></ul>`;
    if (state.vis === 'sunlight') html += sunShares();
  } else if (v === 'blackbody') {
    const k = state.kelvin, pk = P.wienPeak(k), preset = bbPreset();
    html += `<h2>${preset ? esc(preset.name) : 'A blackbody'}</h2><p class="big">${fmt.kelvin(k)} · peak ${fmt.length(pk)} (${esc(bandAt(pk).name.toLowerCase())})</p><p>${esc(glowText(k))}</p>`;
    if (preset?.about) html += `<p>${esc(preset.about)}</p>`;
    html += `<h3>Examples</h3><ul class="things examples">${PRESETS.map(p => `<li><a href="#blackbody-${p.key}"${p === preset ? ' aria-current="true"' : ''}><span><i class="swatch" style="${swatch(p.k)}"></i>${esc(p.name)}</span><small>${fmt.kelvin(p.k)}</small></a></li>`).join('')}</ul>`;
    const sh = bbShares(k), pct = x => (x * 100 >= 99.95 ? 'all' : x * 100 < 0.01 ? '<0.01%' : `${fmt.sig(x * 100, 2)}%`);
    html += `<h3>Where its power goes</h3><ul class="shares">${[['Infrared and longer', sh.infrared], ['Visible', sh.visible], ['Ultraviolet', sh.ultraviolet], ['X-rays and shorter', sh.xray]].map(([n, x]) => `<li><span>${n}</span><span class="bar" style="--w:${(x * 100).toFixed(2)}%"></span><b>${pct(x)}</b></li>`).join('')}</ul>`;
    html += `<h3>How much</h3><p>Each square metre of its surface gives out ${watts(P.exitance(k))}. Double the temperature and it gives out 16 times as much (the Stefan–Boltzmann law): that is why a little more heat makes a filament so much brighter.</p>`;
    html += `<h3>One photon at the peak</h3><p>${fmt.energy(P.photonEnergyEV(pk))}. ${esc(effectAt(P.photonEnergyEV(pk)).text)}</p>`;
    html += `<p>Everything glows with a spectrum set by its temperature. Hotter things glow brighter at every wavelength, and their peak moves to shorter waves: double the temperature, halve the peak's wavelength (Wien's law). The orange line on the spectrum below is this curve.</p>`;
    html += `<p class="note">The curves are Planck's law for a perfect absorber and emitter. Real surfaces give out somewhat less, but the shape and the peak hold.</p>`;
  } else if (v === 'air' && airMod) {
    html += airDetails();
  } else if (v === 'sky' && state.sky) {
    const o = state.sky, cur = sky?.current;
    html += `<h2>${esc(o.name)}</h2><p>${esc(o.note ?? '')}</p>`;
    if (cur) {
      html += `<div class="thing"><p class="known">${esc(cur.label)}</p><p class="range">${fmt.length(cur.metres)} · ${fmt.frequency(P.frequency(cur.metres))} · ${fmt.energy(P.photonEnergyEV(cur.metres))}</p>`;
      html += `<h3>What you are seeing</h3><p>${esc(cur.seeing)}</p><h3>The colours</h3><p>${esc(cur.colours)}</p><h3>Taken from</h3><p>${esc(cur.where)}</p></div>`;
    }
    html += `<h3>Every picture</h3><ul class="things pictures">${o.images.map((im, i) => `<li><button type="button" data-picture="${i}"${im === cur ? ' aria-current="true"' : ''}><span>${esc(bandAt(im.metres).name)}<small>${fmt.length(im.metres)}</small></span><span class="short">${esc(im.short)}</span></button></li>`).join('')}</ul>`;
    html += `<p class="note">Each picture shows the same object in a different light: different matter, at different temperatures, shines in each. Tune the spectrum below, or pick a picture. Pictures in light we cannot see are given false colours.</p>`;
    const st = state.sky.key === 'sun' && siblingApp('#sun');
    if (st) html += `<ul class="links"><li><a href="${st}" target="_blank" rel="noopener">The Sun in a sibling app</a></li></ul>`;
  } else {
    const t = state.thing;
    if (t) html += `<div class="thing"><p class="known">${esc(t.known)}</p><p>${esc(t.why)}</p></div>`;
    if (state.mode === 'field') html += `<section class="mode-notes">${fieldNotes(m, field?.polar ?? 'linear')}</section>`;
    if (state.mode === 'photons') html += `<section class="mode-notes">${photonNotes(m)}</section>`;
    const range = `${fmt.length(band.from)} to ${fmt.length(band.to)}`;
    html += `<h2>${esc(band.name)}${sub && band.key !== 'visible' ? ` <small>${esc(sub.long ?? sub.name)}</small>` : ''}</h2>`;
    html += `<p class="range">${band.key === 'gamma' ? `shorter than ${fmt.length(band.from)}` : band.key === 'radio' ? `longer than ${fmt.length(band.to)}` : range}</p>`;
    html += `<p>${esc(band.blurb)}</p>`;
    html += `<h3>Made by</h3><p>${esc(band.made)}</p><h3>Used for</h3><p>${esc(band.uses)}</p>`;
    html += `<h3>What it does to matter</h3><p>${esc(band.matter)}</p>`;
    html += `<h3>One photon</h3><p>${esc(effectAt(ev).text)}</p>`;
    if (band.links.length) html += `<ul class="links">${band.links.map(([label, hash]) => `<li><a href="${moleculeViewer(hash)}" target="_blank" rel="noopener">${esc(label)}</a> <small>Molecule Viewer</small></li>`).join('')}</ul>`;
    const near = THINGS.filter(x => x.m <= band.from && x.m > band.to);
    if (near.length) html += `<h3>In this band</h3><ul class="things">${near.map(x => `<li><a href="#thing-${x.key}"${x === t ? ' aria-current="true"' : ''}>${esc(x.name)}<small>${fmt.length(x.m)}</small></a></li>`).join('')}</ul>`;
  }
  if (tone.on) { const o = octaveDown(P.frequency(m)); html += `<p class="note">Sound: ${Math.round(o.hz)} Hz, the frequency halved ${o.octaves} times.</p>`; }
  const d = $('#details');
  const top = d.scrollTop;
  d.innerHTML = html;
  d.scrollTop = keepScroll ? top : 0;
  airShown = '';
  if (v === 'air') airLive(m);
}

// Through the air: what happens at the cursor, the chosen telescope, every telescope, and why it matters.
// A range in the units that read best there: frequency for radio, energy for X-rays and gamma rays.
function rangeText(a, b) {
  const long = Math.max(a, b), short = Math.min(a, b);
  if (short >= 1e-3) return `${fmt.frequency(P.frequency(long))} to ${fmt.frequency(P.frequency(short))}`;
  if (long <= 2e-8) return `${fmt.energy(P.photonEnergyEV(long))} to ${fmt.energy(P.photonEnergyEV(short))}`;
  return `${fmt.length(long)} to ${fmt.length(short)}`;
}
const airCovering = m => (airMod ? airMod.TELESCOPES.filter(t => m <= t.from && m >= t.to) : []);
// The part that follows the dial: how much gets through, the window, what absorbs it, which telescopes work.
let airShown = '';
function airLive(m) {
  const d = $('#details'), el = d.querySelector('.air-here');
  if (!el || !airMod) return;
  const { absorberAt, windowAt, transmission } = airMod;
  const pct = transmission(m) * 100, a = absorberAt(m), w = windowAt(m);
  const reach = pct >= 99.5 ? 'almost all of it reaches the ground' : pct < 0.5 ? 'none of it reaches the ground' : `about ${fmt.sig(pct, 2)}% reaches the ground`;
  let html = `<p class="big">At ${fmt.length(m)}, ${reach}.</p>`;
  if (w) html += `<p>Inside the <strong>${esc(w.name)}</strong>. ${esc(w.note)}</p>`;
  html += `<h3>${esc(a.title)}</h3><p>${esc(a.text)}</p>`;
  if (html === airShown) return;
  airShown = html;
  el.innerHTML = html;
  const here = airCovering(m);
  for (const b of d.querySelectorAll('[data-scope]')) {
    const t = airMod.TELESCOPES.find(x => x.name === b.dataset.scope), s = b.querySelector('small');
    const text = `${here.includes(t) ? 'works here · ' : ''}${airWhere(t)}`;
    if (s.textContent !== text) s.textContent = text;
  }
}
const airWhere = t => (t.where === 'space' ? 'in space' : 'on the ground');
function airDetails() {
  const sc = state.scope, where = airWhere;
  let html = `<h2>Through the air</h2><div class="air-here"></div>`;
  if (sc) {
    html += `<div class="thing scope"><p class="known">${esc(sc.name)} <small>${where(sc)}</small></p><p class="range">${rangeText(sc.from, sc.to)}</p>`;
    html += `<h3>Where</h3><p>${esc(sc.place)}</p><h3>The telescope</h3><p>${esc(sc.size)} ${esc(sc.years)}</p><h3>What it does</h3><p>${esc(sc.story)}</p><h3>Why there</h3><p>${esc(sc.why)}</p></div>`;
  }
  html += `<h3>Telescopes</h3><ul class="things pictures scopes">${airMod.TELESCOPES.map(t => `<li><button type="button" data-scope="${esc(t.name)}"${t === sc ? ' aria-current="true"' : ''}><span>${esc(t.name)}<small>${where(t)}</small></span><span class="short">${esc(t.note)}</span></button></li>`).join('')}</ul>`;
  html += `<h3>Why it matters</h3><p>The air is clear in two wide windows: visible light, with a little infrared and ultraviolet either side, and radio from about a centimetre to a few tens of metres. Everything else is absorbed somewhere on the way down, and that shapes life, climate and astronomy.</p>`;
  html += `<p><strong>Life:</strong> ozone and oxygen take out the ultraviolet that breaks DNA. The visible window is where the Sun is brightest, and it is the light eyes evolved to see and plants to use.</p>`;
  html += `<p><strong>Climate:</strong> sunlight comes in through the visible window; the Earth's heat goes out as infrared, much of it through the window near 10 µm. Water vapour and carbon dioxide absorb the infrared either side and send some back down. That greenhouse effect keeps the Earth about 33 °C warmer than it would otherwise be, and more carbon dioxide strengthens it.</p>`;
  html += `<p><strong>Astronomy:</strong> radio and visible telescopes can stay on the ground, on high, dry mountains away from town lights. For millimetre and infrared waves they climb higher and drier, or fly. For far infrared, ultraviolet, X-rays and most gamma rays they must go to space, except at the very highest energies, where the air becomes the detector.</p>`;
  html += `<p class="note">Click a telescope, here or on the chart, to read about it. Hover the chart for the named windows. The shaded curtain on the spectrum below is the air's opacity.</p>`;
  return html;
}

const watts = w => w < 1e3 ? `${fmt.sig(w, 2)} watts` : w < 1e6 ? `${fmt.sig(w / 1e3, 2)} kilowatts` : w < 1e9 ? `${fmt.sig(w / 1e6, 2)} megawatts` : `${fmt.sci(w)} watts`;

// Shares of the Sun's energy above the air, by band, from the ASTM G173 spectrum (280 nm–4 µm).
const SUN_SHARES = (() => {
  let uv = 0, visible = 0, ir = 0;
  SOLAR.nm.forEach((n, i) => { const e = SOLAR.am0[i] * ((SOLAR.nm[i + 1] ?? n + 10) - n); n < 380 ? (uv += e) : n <= 750 ? (visible += e) : (ir += e); });
  const tot = uv + visible + ir, pc = x => `${Math.round((100 * x) / tot)}%`;
  return `Above the air, the Sun's light from 280 nm to 4 µm is ${pc(uv)} ultraviolet, ${pc(visible)} visible and ${pc(ir)} infrared by energy: ${Math.round(tot)} W on each square metre.`;
})();
const sunShares = () => `<p>${SUN_SHARES}</p>`;

$('#details').addEventListener('click', e => {
  const b = e.target.closest('[data-picture]');
  if (b && state.sky) ribbon.tune(state.sky.images[+b.dataset.picture].metres, ribbon.span, 900);
  const s = e.target.closest('[data-scope]');
  if (s && airMod) pickScope(airMod.TELESCOPES.find(t => t.name === s.dataset.scope));
});
// Choosing a telescope shows its card and tunes the dial to the middle of its range.
function pickScope(t) {
  state.scope = state.scope === t ? null : t;
  if (air) { air.selected = state.scope?.name ?? null; }
  details();
  if (state.scope) ribbon.tune(Math.sqrt(t.from * t.to), Math.max(ribbon.span, Math.log10(t.from / t.to) * 1.3 + 1), 900);
}

// ---------------------------------------------------------------- switching views
function setView(v) {
  state.view = v;
  body.dataset.view = v;
  $$('.sections a').forEach(a => a.setAttribute('aria-current', a.dataset.section === v ? 'true' : 'false'));
  ribbon.setOverlays(v === 'blackbody' ? [bbOverlay(state.kelvin)] : v === 'air' && airMod ? [airMod.ribbonOverlay()] : []);
  detailsKey = '';
  details();
  layout();
}
function setMode(mode) {
  state.mode = mode;
  body.dataset.mode = mode;
  wave.mode = mode;
  $$('[data-mode]').forEach(b => b.matches('button') && b.setAttribute('aria-pressed', b.dataset.mode === mode ? 'true' : 'false'));
  if (mode === 'field') getField().then(() => { updateFieldCard(); layout(); });
  details();
}
function setVis(v) {
  state.vis = v;
  vis.view = v;
  $$('[data-vis]').forEach(b => b.setAttribute('aria-pressed', b.dataset.vis === v ? 'true' : 'false'));
  detailsKey = '';
  details();
}
const bbPreset = () => PRESETS.find(p => Math.abs(Math.log(p.k / state.kelvin)) < 0.01);
// The colour each example glows; things too cool to glow visibly get an empty ring.
const swatch = k => (k < 700 ? '' : `background:${css(glowColour(k).rgb)}`);
function setKelvin(k) {
  state.kelvin = Math.min(T_MAX, Math.max(T_MIN, k));
  bb.kelvin = state.kelvin;
  $('#tempSlider').value = Math.round((1000 * Math.log(state.kelvin / T_MIN)) / Math.log(T_MAX / T_MIN));
  $('#tempPreset').value = bbPreset()?.key ?? '';
  if (state.view === 'blackbody') ribbon.setOverlays([bbOverlay(state.kelvin)]);
  details();
}
function showSpectrumIfNeeded() { if (state.view !== 'spectrum') { setView('spectrum'); } }

$$('.seg [data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
async function setPolar(polar) {
  (await getField()).polar = polar;
  updateFieldCard(); details();
  $$('[data-polar]').forEach(x => x.setAttribute('aria-pressed', x.dataset.polar === polar ? 'true' : 'false'));
}
$$('[data-polar]').forEach(b => b.addEventListener('click', () => setPolar(b.dataset.polar)));
$$('[data-vis]').forEach(b => b.addEventListener('click', () => go(b.dataset.vis)));
$('#tempPreset').innerHTML = `<option value="">Examples…</option>${PRESETS.map(p => `<option value="${p.key}">${esc(p.name)} · ${fmt.kelvin(p.k)}</option>`).join('')}`;
$('#tempPreset').addEventListener('change', e => { const p = PRESETS.find(p => p.key === e.target.value); if (p) go(`blackbody-${p.key}`); });
$('#tempSlider').addEventListener('input', e => { setKelvin(T_MIN * (T_MAX / T_MIN) ** (e.target.value / 1000)); setHash(`blackbody-${Math.round(state.kelvin)}`); });

// ---------------------------------------------------------------- routing
// Units an address can use, and what each means in metres, hertz or electronvolts.
const ADDR_UNITS = { km: 1e3, m: 1, cm: 1e-2, mm: 1e-3, um: 1e-6, nm: 1e-9, pm: 1e-12, fm: 1e-15, hz: 1, khz: 1e3, mhz: 1e6, ghz: 1e9, thz: 1e12, phz: 1e15, ehz: 1e18, zhz: 1e21, ev: 1, kev: 1e3, mev: 1e6, gev: 1e9, tev: 1e12, pev: 1e15 };
function metresFromAddress(key) {
  const m = /^([a-z]+)-([\d.e+-]+)$/.exec(key);
  if (!m || !(m[1] in ADDR_UNITS)) return null;
  const v = parseFloat(m[2]) * ADDR_UNITS[m[1]];
  if (!(v > 0)) return null;
  return m[1].endsWith('hz') ? P.wavelength(v) : m[1].endsWith('ev') ? P.wavelengthFromEV(v) : v;
}

async function go(key, { from = 'user' } = {}) {
  if (from === 'user') stopAll();
  hideLanding();
  key = key || 'visible';
  setHash(key);
  const band = byKey(key);
  if (band) {
    setView('spectrum');
    const decades = Math.log10(band.from / band.to);
    return ribbon.tune(Math.sqrt(band.from * band.to) * (band.key === 'gamma' ? 1e4 : 1), Math.max(0.05, Math.min(decades * 1.5, 30)));
  }
  const thing = thingByKey(key.replace(/^thing-/, ''));
  if (key.startsWith('thing-') && thing) {
    setView('spectrum');
    state.thing = thing; ribbon.marked = thing;
    const p = ribbon.tune(thing.m, Math.min(Math.max(ribbon.span, 1.2), 4));
    readout(ribbon.metres); detailsKey = ''; details();
    await p;
    state.thing = thing; ribbon.marked = thing; ribbon.dirty = true; readout(ribbon.metres); detailsKey = ''; details();
    return;
  }
  if (key in VIS_VIEWS) {
    setView('visible'); setVis(key);
    if (!(ribbon.metres <= 1100e-9 && ribbon.metres >= 300e-9) || ribbon.span > 3) ribbon.tune(ribbon.metres <= 1100e-9 && ribbon.metres >= 300e-9 ? ribbon.metres : 550e-9, 0.6);
    return;
  }
  const bbm = /^blackbody(?:-(.+))?$/.exec(key);
  if (bbm) {
    const preset = PRESETS.find(p => p.key === bbm[1]);
    setKelvin(preset ? preset.k : bbm[1] ? parseFloat(bbm[1]) || 5772 : state.kelvin);
    setView('blackbody');
    return ribbon.tune(P.wienPeak(state.kelvin), 9);
  }
  if (key === 'air') {
    await getAir();
    setView('air');
    return ribbon.tune(1e-4, 28);
  }
  const skym = /^sky(?:-(.+))?$/.exec(key);
  if (skym) {
    const s = await getSky();
    const obj = s.objects.find(o => o.key === skym[1]) ?? s.objects[0];
    state.sky = obj;
    s.setObject(obj.key);
    $$('#skyTabs button').forEach(b => b.setAttribute('aria-pressed', b.dataset.sky === obj.key ? 'true' : 'false'));
    s.set(ribbon.metres);
    setView('sky');
    const ms = obj.images.map(i => i.metres);
    const lo = Math.min(...ms), hi = Math.max(...ms);
    const span = Math.log10(hi / lo) * 1.3 + 1;
    if (ribbon.metres > hi * 3 || ribbon.metres < lo / 3 || ribbon.span > span * 1.5) ribbon.tune(ribbon.metres <= hi * 3 && ribbon.metres >= lo / 3 ? ribbon.metres : obj.images.find(i => i.band === 'visible')?.metres ?? ms[0], span);
    return;
  }
  if (key === 'journey') return startJourney();
  const m = metresFromAddress(key);
  if (m && m <= SPAN.long && m >= SPAN.short) {
    setView('spectrum');
    return ribbon.tune(m, ribbon.span > 6 ? 2 : ribbon.span);
  }
  return go('visible', { from });
}

addEventListener('hashchange', () => {
  const k = location.hash.slice(1);
  if (!k) return showLanding();
  if (k !== addressFor(ribbon.metres)) go(k);
});

// ---------------------------------------------------------------- landing
$('#chapters').innerHTML = BANDS.map((b, i) => {
  const swatch = b.key === 'visible'
    ? `linear-gradient(90deg, ${[700, 620, 580, 550, 500, 470, 430].map(n => css(spectral(n).rgb)).join(', ')})`
    : css(b.hue);
  return `<li><a href="#${b.key}" style="--sw: ${swatch}"><span class="n">${i + 1}</span><b>${esc(b.name)}</b><small>${esc(b.short)}</small></a></li>`;
}).join('');
function showLanding() {
  stopAll();
  state.landing = true;
  body.classList.add('at-landing');
  history.replaceState(null, '', location.pathname);
  ribbon.tune(550e-9, 30, 2200);
}
function hideLanding() {
  if (!state.landing) return;
  state.landing = false;
  body.classList.remove('at-landing');
  layout();
}
$('#explore').addEventListener('click', () => go('visible'));
$('#startJourney').addEventListener('click', () => startJourney());
$('.mark').addEventListener('click', e => { e.preventDefault(); showLanding(); });

// ---------------------------------------------------------------- journey and tour
async function startJourney() {
  stopAll();
  hideLanding();
  state.journey = { i: -1 };
  $('#caption').hidden = false;
  stepJourney(1);
}
async function stepJourney(d) {
  const j = state.journey;
  if (!j) return;
  j.i = Math.max(0, Math.min(JOURNEY.length - 1, j.i + d));
  clearTimeout(j.timer);
  const stop = JOURNEY[j.i];
  $('#captionText').textContent = stop.text ?? thingByKey(stop.go.replace('thing-', ''))?.why ?? '';
  $('#captionStep').textContent = `${j.i + 1} / ${JOURNEY.length}`;
  if (stop.mode) setMode(stop.mode);
  await go(stop.go, { from: 'journey' });
  if (state.journey !== j) return;
  setHash('journey');
  if (j.i < JOURNEY.length - 1) j.timer = setTimeout(() => stepJourney(1), stop.ms ?? 9000);
}
function stopJourney() {
  if (!state.journey) return;
  clearTimeout(state.journey.timer);
  state.journey = null;
  $('#caption').hidden = true;
  setHash(addressFor(ribbon.metres));
}
$('#captionNext').addEventListener('click', () => stepJourney(1));
$('#captionPrev').addEventListener('click', () => stepJourney(-1));
$('#captionStop').addEventListener('click', stopJourney);
$('#journeyBtn').addEventListener('click', () => (state.journey ? stopJourney() : startJourney()));

// The tour shows off every kind of view in turn, with something chosen at random in each.
const pick = a => a[Math.floor(Math.random() * a.length)];
const TOUR = [
  async () => { setMode('wave'); await go(pick(THINGS.map(t => `thing-${t.key}`)), { from: 'tour' }); },
  () => go(pick(Object.keys(VIS_VIEWS)), { from: 'tour' }),
  async () => { setMode('field'); await setPolar(pick(['linear', 'circular'])); await go(`thing-${pick(THINGS).key}`, { from: 'tour' }); },
  () => go(`blackbody-${pick(PRESETS).key}`, { from: 'tour' }),
  async () => { await go('air', { from: 'tour' }); if (state.tour) { state.scope = null; pickScope(pick(airMod.TELESCOPES)); } },
  async () => { setMode('photons'); await go(`thing-${pick(THINGS).key}`, { from: 'tour' }); },
  async () => { setMode('wave'); await go(pick(BANDS).key, { from: 'tour' }); },
  async () => go(`sky-${pick((await getSky()).objects).key}`, { from: 'tour' }),
];
function tourStep() {
  const i = state.tourStep = ((state.tourStep ?? Math.floor(Math.random() * TOUR.length)) + 1) % TOUR.length;
  TOUR[i]();
  state.tour = setTimeout(tourStep, 8000);
}
function startTour() { stopAll(); hideLanding(); $('#tourBtn').setAttribute('aria-pressed', 'true'); tourStep(); }
function stopTour() { if (state.tour) { clearTimeout(state.tour); state.tour = null; } $('#tourBtn').setAttribute('aria-pressed', 'false'); }
$('#tourBtn').addEventListener('click', () => (state.tour ? stopTour() : startTour()));
function surprise() { const t = THINGS[Math.floor(Math.random() * THINGS.length)]; go(`thing-${t.key}`); }
$('#randomBtn').addEventListener('click', surprise);
function stopAll() { stopTour(); stopJourney(); }

// Any hand on the controls stops the tour (not the journey, which has its own buttons).
for (const el of [$('#ribbon'), $('#fieldHost')]) el.addEventListener('pointerdown', () => { stopTour(); if (state.journey) stopJourney(); });
$('#ribbon').addEventListener('wheel', () => { stopTour(); if (state.journey) stopJourney(); }, { passive: true });

// ---------------------------------------------------------------- sound, picture, help, tooltips
$('#soundBtn').addEventListener('click', toggleSound);
function toggleSound() {
  tone.on ? tone.stop() : (tone.start(), tone.set(ribbon.metres));
  $('#soundBtn').setAttribute('aria-pressed', String(tone.on));
  detailsKey = ''; details();
}
$('#helpBtn').addEventListener('click', () => $('#help').showModal());
$('#photoBtn').addEventListener('click', photo);
function photo() {
  const out = document.createElement('canvas');
  const dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight;
  out.width = W * dpr; out.height = H * dpr;
  const c = out.getContext('2d');
  c.scale(dpr, dpr);
  c.fillStyle = '#03050b'; c.fillRect(0, 0, W, H);
  const src = state.view === 'spectrum' ? (state.mode === 'field' ? field?.renderer.domElement : $('#waveCanvas'))
    : { visible: $('#visCanvas'), blackbody: $('#bbCanvas'), air: $('#airCanvas') }[state.view];
  if (src) { const r = src.getBoundingClientRect(); c.drawImage(src, r.left, r.top, r.width, r.height); }
  if (state.view === 'sky') { const im = $('#skyHost .sky-stage img.on'), r = im?.getBoundingClientRect(); if (im?.complete && r) c.drawImage(im, r.left, r.top, r.width, r.height); }
  const rr = $('#ribbon').getBoundingClientRect();
  c.drawImage($('#ribbon'), rr.left, rr.top, rr.width, rr.height);
  c.fillStyle = '#e6ebf3'; c.font = '800 44px "Big Shoulders Display", sans-serif'; c.textBaseline = 'top';
  c.fillText($('#name').textContent.toUpperCase(), 24, 70);
  c.font = '500 15px "IBM Plex Sans", sans-serif'; c.fillStyle = '#c4ccdb';
  c.fillText(`${inputs.length.value} · ${inputs.freq.value} · ${inputs.energy.value}`, 24, 124);
  c.fillStyle = '#5b6578'; c.fillText('Full Spectrum', 24, 24);
  const a = document.createElement('a');
  a.download = `full-spectrum-${location.hash.slice(1) || 'view'}.png`;
  a.href = out.toDataURL('image/png');
  a.click();
  toast('Picture saved');
}
let toastTimer = 0;
function toast(text) { const t = $('#toast'); t.textContent = text; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 1800); }

const tip = $('#tip');
$('#airCanvas').addEventListener('click', e => {
  const h = air?.hitAt(e.offsetX, e.offsetY);
  if (h?.scope) pickScope(h.scope);
  else if (h?.window) ribbon.tune(Math.sqrt(h.window.from * h.window.to), ribbon.span, 900);
});
for (const [sel, view] of [['#visCanvas', () => vis], ['#airCanvas', () => air]]) {
  $(sel).addEventListener('pointermove', e => {
    const h = view()?.hitAt(e.offsetX, e.offsetY);
    if (!h) { tip.hidden = true; return; }
    tip.textContent = h.text; tip.hidden = false;
    tip.style.left = `${Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 10)}px`; tip.style.top = `${e.clientY + 16}px`;
  });
  $(sel).addEventListener('pointerleave', () => (tip.hidden = true));
}

// Phone: the details panel is a sheet.
$('#sheetToggle').addEventListener('click', () => {
  const open = body.classList.toggle('sheet-open');
  $('#sheetToggle').setAttribute('aria-expanded', String(open));
  $('#sheetToggle').textContent = open ? 'Close' : 'More';
});

// ---------------------------------------------------------------- keyboard
addEventListener('keydown', e => {
  if (e.target.matches('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
  if ($('#help').open) return;
  const k = e.key;
  const pan = ribbon.span * (e.shiftKey ? 0.2 : 0.03);
  switch (k) {
    case 'ArrowLeft': e.preventDefault(); stopAll(); hideLanding(); ribbon.nudge(pan); break;
    case 'ArrowRight': e.preventDefault(); stopAll(); hideLanding(); ribbon.nudge(-pan); break;
    case 'ArrowUp': case '+': case '=': e.preventDefault(); ribbon.zoomBy(0.8); break;
    case 'ArrowDown': case '-': case '_': e.preventDefault(); ribbon.zoomBy(1.25); break;
    case '0': hideLanding(); ribbon.tune(ribbon.metres, 30); break;
    case '1': case '2': case '3': case '4': case '5': case '6': case '7': go(BANDS[+k - 1].key); break;
    case 'w': case 'W': hideLanding(); if (state.view !== 'spectrum') setView('spectrum'); setMode({ wave: 'field', field: 'photons', photons: 'wave' }[state.mode]); break;
    case 'v': case 'V': go(state.view === 'visible' ? Object.keys(VIS_VIEWS)[(Object.keys(VIS_VIEWS).indexOf(state.vis) + 1) % 4] : state.vis); break;
    case 'b': case 'B': go('blackbody'); break;
    case 'a': case 'A': go('air'); break;
    case 'k': case 'K': go('sky'); break;
    case 'j': case 'J': state.journey ? stopJourney() : startJourney(); break;
    case 't': case 'T': state.tour ? stopTour() : startTour(); break;
    case 'r': case 'R': surprise(); break;
    case 's': case 'S': toggleSound(); break;
    case 'p': case 'P': photo(); break;
    case '?': $('#help').showModal(); break;
    case 'Escape': if (state.tour || state.journey) stopAll(); else if (!state.landing) showLanding(); break;
    default: return;
  }
});

// ---------------------------------------------------------------- the loop
const t0 = performance.now();
function frame(now) {
  const t = (now - t0) / 1000;
  ribbon.step(now);
  try { drawView(t); } catch (err) { if (!frame.failed) { frame.failed = true; console.error(err); } }
  requestAnimationFrame(frame);
}
function drawView(t) {
  if (state.view === 'spectrum') {
    if (state.mode === 'field' && field) {
      field.draw(t);
      const p = field.labelPositions();
      const host = $('#fieldHost');
      for (const [cls, pos] of [['lab-e', p.e], ['lab-b', p.b], ['lab-go', p.go], ['lab-l', p.l]]) { const el = $(`.field-labels .${cls}`); el.style.transform = `translate(${host.offsetLeft + pos.x}px, ${host.offsetTop + pos.y}px)`; }
      const card = $('#fieldCard');
      card.style.transform = `translate(${host.offsetLeft + host.offsetWidth - card.offsetWidth - 12}px, ${host.offsetTop + 12}px)`;
    } else wave.draw(t);
  } else if (state.view === 'visible') vis.draw(t);
  else if (state.view === 'blackbody') bb.draw(t);
  else if (state.view === 'air') air?.draw(t);
}

// ---------------------------------------------------------------- start
setKelvin(5772);
setVis('prism');
setMode('wave');
layout();
const start = location.hash.slice(1);
if (start) { state.landing = true; go(start); }
else { body.classList.add('at-landing'); ribbon.set(550e-9, 30); }
changed(ribbon.metres);
requestAnimationFrame(frame);
document.fonts?.ready.then(() => { ribbon.dirty = true; });

// For tests and the console.
window.spectrum = { ribbon, state, go, P };
