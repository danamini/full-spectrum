// The page. For now, a placeholder that proves the modules load.
import { frequency, photonEnergyEV } from './physics.js';

const green = 550e-9;
document.querySelector('#readout').textContent =
  `550 nm · ${(frequency(green) / 1e12).toFixed(0)} THz · ${photonEnergyEV(green).toFixed(2)} eV`;
