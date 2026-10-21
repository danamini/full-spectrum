// The sky in every light: the same object photographed across the spectrum. The image nearest the cursor's
// wavelength is shown; picking one tunes the ribbon to it.
import { SKY } from '../data/sky.js';
import * as fmt from './format.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export { SKY };

export class SkyView {
  constructor(host, { onPick } = {}) {
    this.host = host;
    this.onPick = onPick;
    this.object = SKY[0];
    this.current = null;
    host.innerHTML = '<div class="sky-stage"><img class="sky-a" alt=""><img class="sky-b" alt=""><div class="sky-rows"></div><p class="sky-missing">This picture didn’t load. Is the server still running?</p></div><div class="sky-strip" role="group" aria-label="Wavelengths"></div><p class="sky-credit"></p>';
    this.imgs = [...host.querySelectorAll('.sky-stage > img')];
    this.rows = host.querySelector('.sky-rows');
    this.front = 0;
    this.strip = host.querySelector('.sky-strip');
    this.credit = host.querySelector('.sky-credit');
    // A picture that fails to load is hidden, not shown as a broken icon over its alt text.
    host.addEventListener('error', e => {
      if (e.target.tagName !== 'IMG') return;
      e.target.classList.add('failed');
      if (this.imgs.includes(e.target)) host.classList.add('missing');
    }, true);
  }

  setObject(key) {
    this.object = SKY.find(o => o.key === key) ?? SKY[0];
    this.current = null;
    this.host.classList.remove('strips', 'missing');
    this.imgs.forEach(im => im.classList.remove('on')); // never show one object's picture under another's name
    this.strip.innerHTML = this.object.images.map((im, i) => `<button type="button" data-i="${i}"><img src="${im.file}" alt="" loading="lazy"><span>${esc(im.label)}</span></button>`).join('');
    this.strip.querySelectorAll('button').forEach(b => b.addEventListener('click', () => this.onPick?.(this.object.images[+b.dataset.i])));
    // Panoramic strips (the Milky Way) read best stacked, one band above the next, like NASA's poster.
    this.rows.innerHTML = this.object.images.map((im, i) => `<figure data-i="${i}"><img src="${im.file}" alt="${esc(this.object.name)} in ${esc(im.label)}"><figcaption>${esc(im.label)}</figcaption></figure>`).join('');
    this.rows.querySelectorAll('figure').forEach(f => f.addEventListener('click', () => this.onPick?.(this.object.images[+f.dataset.i])));
    const probe = new Image();
    probe.onload = () => this.host.classList.toggle('strips', probe.naturalWidth / probe.naturalHeight > 5);
    probe.src = this.object.images[0].file;
  }

  // Shows the image whose wavelength is nearest (in log) to the cursor.
  set(metres) {
    const ims = this.object.images;
    let best = ims[0], d = Infinity;
    for (const im of ims) { const dd = Math.abs(Math.log10(im.metres) - Math.log10(metres)); if (dd < d) { d = dd; best = im; } }
    if (best === this.current) return;
    this.current = best;
    const back = this.imgs[1 - this.front];
    back.onload = () => { this.host.classList.remove('missing'); back.classList.add('on'); this.imgs[this.front].classList.remove('on'); this.front = 1 - this.front; };
    back.classList.remove('failed');
    back.src = best.file;
    back.alt = `${this.object.name} in ${best.label}`; // alt is an attribute, not HTML
    this.strip.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-current', ims[i] === best ? 'true' : 'false'));
    this.rows.querySelectorAll('figure').forEach((f, i) => f.classList.toggle('on', ims[i] === best));
    this.rows.querySelector('figure.on')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    this.credit.innerHTML = `${esc(best.label)} · ${fmt.length(best.metres)} · <a href="${esc(best.url)}" target="_blank" rel="noopener">${esc(best.credit)}</a> · ${esc(best.licence)}`;
  }
}
