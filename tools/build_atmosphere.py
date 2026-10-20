"""Build data/atmosphere.js: fraction of radiation from space reaching the ground, 1e-15 m to 1e4 m.

No single licensed dataset covers the whole spectrum, so the curve is stitched from sourced
pieces and marked schematic. Segments (see SEGMENTS in the output file for the same list):

  < 280 nm          0. Absorbed high in the atmosphere (ozone, O2, N2; photoionisation for
                    X-ray and gamma). Half-absorption altitudes 20-100+ km.
  280 nm - 0.9 um   ASTM G173-03 reference spectra (SMARTS2 v2.9.2; US Standard Atmosphere 1976,
                    rural aerosol, air mass 1.5): T = (direct normal / extraterrestrial)^(1/1.5),
                    i.e. converted from air mass 1.5 to the zenith. Includes ozone, Rayleigh
                    scattering and aerosol. Table as distributed by NREL (copy in pvlib-python).
  0.9 - 5.6 um      ATRAN (Lord 1992, NASA TM 103957) model for Maunakea, 1.6 mm precipitable
  7 - 26 um         water vapour, air mass 1.0, from Gemini Observatory (mktrans_zm_16_10.dat,
                    mktrans_nq_16_10.dat). "Any use of these data should reference Lord, S. D.,
                    1992, NASA Technical Memorandum 103957, and acknowledge Gemini Observatory."
  5.6 - 7 um        0 (the 6.3 um water band; ATRAN already reads < 0.25 at both edges).
  26 - 300 um       0 (water-vapour rotation band; no ground-based data used).
  0.3 mm - 30 cm    ITU-R P.676-12 Annex 1 line-by-line gaseous attenuation (O2 + H2O), zenith,
                    integrated from 4.2 km (Maunakea) through the ITU-R P.835 reference
                    atmosphere, with water vapour scaled to 1.6 mm, to match the ATRAN segment.
                    Computed with ITU-Rpy 0.4.0 (pip install itur==0.4.0).
  > 30 cm           P.676 value at 1 GHz times a schematic ionospheric cut-off:
                    1 / (1 + (15 MHz / f)^6), i.e. half transmission at 15 MHz (20 m). The real
                    cut-off is the F2-layer critical frequency, a few MHz at night to ~10-15 MHz
                    by day, varying with season and the solar cycle.

Every output point is the mean transmission across its log-spaced bin (100 per decade), so
narrow lines are averaged, not sampled.

Run:  python3 -m venv /tmp/fs-venv && /tmp/fs-venv/bin/pip install itur==0.4.0
      /tmp/fs-venv/bin/python -I tools/build_atmosphere.py
Downloads go to a fresh temporary directory outside the repo.
"""

import json
import math
import os
import tempfile
import urllib.request

import numpy as np
import itur.models.itu676 as p676
import itur.models.itu835 as p835

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, 'data', 'atmosphere.js')

G173_URL = 'https://raw.githubusercontent.com/pvlib/pvlib-python/main/pvlib/data/ASTMG173.csv'
GEMINI = 'https://www.gemini.edu/sciops/ObsProcess/obsConstraints/atm-models/'
ATRAN_NEAR = GEMINI + 'mktrans_zm_16_10.dat'
ATRAN_MID = GEMINI + 'mktrans_nq_16_10.dat'

C = 299792458.0
PER_DECADE = 100
LO, HI = -15, 4                  # log10 metres
SITE_KM = 4.2                    # Maunakea
PWV_MM = 1.6                     # precipitable water vapour above the site, mm (= kg/m^2)


def fetch(url, tmp):
    path = os.path.join(tmp, url.rsplit('/', 1)[1])
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 full-spectrum-build'})
    with urllib.request.urlopen(req, timeout=600) as r, open(path, 'wb') as f:
        f.write(r.read())
    return path


def load_g173(path):
    """Return (metres, zenith transmission) from the ASTM G173 table."""
    lam, t = [], []
    with open(path) as f:
        for line in f.readlines()[2:]:
            nm, etr, _glob, direct = (float(x) for x in line.split(',')[:4])
            lam.append(nm * 1e-9)
            t.append((direct / etr) ** (1 / 1.5) if etr > 0 else 0.0)
    return np.array(lam), np.clip(np.array(t), 0, 1)


def load_atran(path):
    d = np.loadtxt(path)
    return d[:, 0] * 1e-6, np.clip(d[:, 1], 0, 1)


def p676_zenith(f_ghz):
    """Zenith transmission from SITE_KM to 100 km, ITU-R P.676-12 Annex 1 + P.835 reference atmosphere."""
    inst = p676.__model.instance
    # water vapour: P.835 exponential profile (scale height 2 km), scaled to PWV_MM above the site
    h0 = 2.0
    rho0 = PWV_MM / (h0 * math.exp(-SITE_KM / h0))      # g/m^3 at sea level
    # layers with geometrically growing thickness
    edges = [SITE_KM]
    dz = 0.02
    while edges[-1] < 100:
        edges.append(min(100.0, edges[-1] + dz))
        dz *= 1.06
    layers = []
    for a, b in zip(edges[:-1], edges[1:]):
        h = 0.5 * (a + b)
        T = float(p835.standard_temperature(h).value)
        P = float(p835.standard_pressure(h).value)
        rho = rho0 * math.exp(-h / h0) if h < 20 else 0.0
        e = rho * T / 216.7
        layers.append((b - a, max(P - e, 0.0), rho, T))
    out = []
    for f in f_ghz:
        db = sum(dz * (inst.gamma0_exact(f, p, rho, T) + inst.gammaw_exact(f, p, rho, T))
                 for dz, p, rho, T in layers)
        out.append(10 ** (-db / 10))
    return np.array(out)


def bin_mean(lam, t, lo, hi):
    """Mean of t for samples with lo <= lam < hi, or None."""
    i, j = np.searchsorted(lam, [lo, hi])
    return float(t[i:j].mean()) if j > i else None


def main():
    tmp = tempfile.mkdtemp(prefix='fs-atm-')
    g_lam, g_t = load_g173(fetch(G173_URL, tmp))
    n_lam, n_t = load_atran(fetch(ATRAN_NEAR, tmp))
    m_lam, m_t = load_atran(fetch(ATRAN_MID, tmp))

    n = (HI - LO) * PER_DECADE + 1
    centres = np.logspace(LO, HI, n)
    half = 10 ** (0.5 / PER_DECADE)
    trans = []
    for lam in centres:
        lo, hi = lam / half, lam * half
        if lam < 280e-9:
            v = 0.0
        elif lam < 0.9e-6:
            v = bin_mean(g_lam, g_t, lo, hi)
            if v is None:
                v = float(np.interp(lam, g_lam, g_t))
        elif lam < 5.6e-6:
            v = bin_mean(n_lam, n_t, lo, hi)
        elif lam < 7e-6:
            v = 0.0
        elif lam < 26e-6:
            v = bin_mean(m_lam, m_t, lo, hi)
        elif lam < 3e-4:
            v = 0.0
        else:
            # P.676: average over 9 sub-samples across the bin (in frequency)
            f_hi, f_lo = C / lo / 1e9, C / hi / 1e9
            if f_lo >= 1.0:
                fs = np.linspace(f_lo, min(f_hi, 1000.0), 9)
                v = float(p676_zenith(fs).mean())
            else:
                f_mhz = C / lam / 1e6
                v = float(p676_zenith([1.0])[0]) / (1 + (15.0 / f_mhz) ** 6)
        trans.append(0.0 if v is None else v)

    metres = [float(f'{x:.4g}') for x in centres]
    trans = [round(min(max(x, 0.0), 1.0), 4) for x in trans]
    write(metres, trans)
    print('wrote', OUT, len(metres), 'points; downloads in', tmp)


HEADER = '''// Fraction of radiation from space that reaches the ground, at the zenith, 1e-15 m to 1e4 m.
// Generated by tools/build_atmosphere.py; do not edit by hand. Sources: docs/credits-sky.md.
//
// SCHEMATIC: no single dataset covers the whole spectrum, so this is stitched from sourced pieces:
//   < 280 nm        0: absorbed high up (ozone and O2 in the UV; photoionisation for X-ray, gamma).
//   280 nm-0.9 um   ASTM G173-03 (SMARTS2; US Standard Atmosphere 1976, rural aerosol), sea level:
//                   (direct normal / extraterrestrial)^(1/1.5), air mass 1.5 converted to zenith.
//   0.9-5.6 um and  ATRAN (Lord 1992, NASA TM 103957), Maunakea 4.2 km, 1.6 mm water vapour,
//   7-26 um         air mass 1.0; data from Gemini Observatory.
//   5.6-7 um        0 (6.3 um water band).  26-300 um: 0 (water-vapour rotation band).
//   0.3 mm-30 cm    ITU-R P.676-12 Annex 1 line-by-line O2 + H2O, zenith from 4.2 km through the
//                   ITU-R P.835 reference atmosphere, water vapour scaled to 1.6 mm (ITU-Rpy 0.4.0).
//   > 30 cm         P.676 at 1 GHz x schematic ionospheric cut-off 1/(1+(15 MHz/f)^6); the real
//                   cut-off (F2 critical frequency) runs from a few MHz at night to ~10-15 MHz by day.
// Each point is the mean transmission over its log bin (100 per decade).
// Sites differ by segment (sea level for the optical, Maunakea from 0.9 um on), so steps at the
// joins are not physical.
'''

WINDOWS = [
    {'name': 'Optical window', 'from': 300e-9, 'to': 1.0e-6,
     'note': 'Ozone closes it below ~300 nm; water bands start beyond ~0.9 µm.'},
    {'name': 'J band', 'from': 1.1e-6, 'to': 1.4e-6, 'note': 'Near-IR window between water bands.'},
    {'name': 'H band', 'from': 1.5e-6, 'to': 1.8e-6, 'note': 'Near-IR window.'},
    {'name': 'K band', 'from': 2.0e-6, 'to': 2.4e-6, 'note': 'Near-IR window.'},
    {'name': 'L band', 'from': 3.0e-6, 'to': 4.1e-6, 'note': 'Thermal-IR window; sky glows warm.'},
    {'name': 'M band', 'from': 4.5e-6, 'to': 5.2e-6, 'note': 'Narrow window, CO2 on the short side, water on the long.'},
    {'name': 'N band', 'from': 8e-6, 'to': 13e-6, 'note': 'Main mid-IR window; ozone dip at 9.6 µm.'},
    {'name': 'Q band', 'from': 17e-6, 'to': 25e-6, 'note': 'Patchy; usable only from high, dry sites.'},
    {'name': '350 µm window', 'from': 330e-6, 'to': 370e-6, 'note': 'Sub-mm; opens only in the driest conditions at high sites.'},
    {'name': '450 µm window', 'from': 420e-6, 'to': 480e-6, 'note': 'Sub-mm; only from high, dry sites.'},
    {'name': '850 µm window', 'from': 800e-6, 'to': 920e-6, 'note': 'Sub-mm; only from high, dry sites.'},
    {'name': '1.3 mm window', 'from': 1.1e-3, 'to': 1.4e-3, 'note': 'Millimetre window.'},
    {'name': '3 mm window', 'from': 2.6e-3, 'to': 3.6e-3, 'note': 'Millimetre window; the 60 GHz (5 mm) oxygen band lies just longward.'},
    {'name': 'Radio window', 'from': 1e-2, 'to': 20, 'note': 'Long end set by the ionosphere: ~10-30 MHz, varying with day, season and solar cycle.'},
]


def write(metres, trans):
    with open(OUT, 'w') as f:
        f.write(HEADER)
        f.write('export const ATMOSPHERE = {\n')
        f.write("  source: 'ASTM G173-03 (280 nm-0.9 um); ATRAN via Gemini Observatory (0.9-26 um); "
                "ITU-R P.676-12 (0.3 mm-30 cm); schematic ionospheric cut-off and opaque bands elsewhere',\n")
        f.write('  schematic: true,\n')
        f.write('  site: \'Optical: sea level. From 0.9 um: Maunakea, 4.2 km, 1.6 mm precipitable water.\',\n')
        f.write('  metres: ' + json.dumps(metres, separators=(',', ':')) + ',\n')
        f.write('  transmission: ' + json.dumps(trans, separators=(',', ':')) + ',\n')
        f.write('};\n\n')
        f.write('// Named windows (metres). Edges are conventions, not hard limits.\n')
        f.write('export const WINDOWS = [\n')
        for w in WINDOWS:
            f.write(f"  {{ name: {json.dumps(w['name'], ensure_ascii=False)}, from: {w['from']:.4g}, to: {w['to']:.4g}, "
                    f"note: {json.dumps(w['note'], ensure_ascii=False)} }},\n")
        f.write('];\n')


if __name__ == '__main__':
    main()
