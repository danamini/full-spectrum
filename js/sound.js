// The spectrum as a pitch: each frequency is halved (an octave down) until it lands between 220 and 440 Hz,
// so neighbouring colours sound like neighbouring notes and the visible band spans just under one octave.
import { frequency } from './physics.js';

export function octaveDown(hz) {
  let n = 0, f = hz;
  while (f >= 440) { f /= 2; n++; }
  while (f < 220) { f *= 2; n--; }
  return { hz: f, octaves: n };
}

export class Tone {
  constructor() { this.on = false; }

  start() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 1800;
      this.gain.connect(filter).connect(this.ctx.destination);
      this.osc = this.ctx.createOscillator();
      this.osc.type = 'triangle';
      this.osc.connect(this.gain);
      this.osc.start();
    }
    this.ctx.resume();
    this.on = true;
    this.gain.gain.setTargetAtTime(0.08, this.ctx.currentTime, 0.08);
  }

  stop() {
    this.on = false;
    if (this.ctx) this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
  }

  set(metres) {
    if (!this.on) return;
    this.osc.frequency.setTargetAtTime(octaveDown(frequency(metres)).hz, this.ctx.currentTime, 0.03);
  }
}
