"""Fetch and resize the "sky in every light" images into assets/sky/.

Run from anywhere with:  python3 -I tools/fetch_sky.py
macOS only (uses `sips` for cropping, resizing and JPEG encoding).

Downloads are untrusted: they go into a fresh temporary directory outside the
repo and only the final resized JPEGs are written into assets/sky/.
Sources, credits and licences are recorded in data/sky.js and docs/credits-sky.md.
"""

import os
import subprocess
import sys
import tempfile
import urllib.request

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, 'assets', 'sky')
MAX_PX = 1600
QUALITY = 82

MWMW = 'https://asd.gsfc.nasa.gov/archive/mwmw/images/'
CRAB = 'https://chandra.harvard.edu/photo/2017/crab/'


def helioviewer(source_id, date):
    """Full-disc render (1600 px, 1.5 arcsec/px) from the Helioviewer.org API."""
    return ('https://api.helioviewer.org/v2/takeScreenshot/?date=' + date +
            '&imageScale=1.5&layers=%5B' + str(source_id) + ',1,100%5D'
            '&x0=0&y0=0&width=1600&height=1600&display=true&watermark=false')


# (output name, URL, crop) — crop is None or (height, width, offset_y, offset_x)
# in source pixels, applied before resizing.
IMAGES = [
    # The Milky Way: NASA GSFC Multiwavelength Milky Way strips, |b| <= 10 deg, 2880 x 160 px.
    ('milkyway-radio-408mhz', MWMW + 'rc408_poster_mag4.jpg', None),
    ('milkyway-radio-21cm', MWMW + 'nhi_poster_mag4.jpg', None),
    ('milkyway-radio-2.5ghz', MWMW + 'rc2695_poster_mag4.jpg', None),
    ('milkyway-microwave-co', MWMW + 'wco_poster_mag4.jpg', None),
    ('milkyway-infrared-far', MWMW + 'iras_poster_mag4.jpg', None),
    ('milkyway-infrared-mid', MWMW + 'mir_poster_mag4.jpg', None),
    ('milkyway-infrared-near', MWMW + 'dirbe_poster_mag4.jpg', None),
    # Visible: ESO/S. Brunier panorama (6000 x 3000, plate carree in Galactic
    # coordinates, centre l = 0, b = 0). Cropped to |b| <= 10 deg to match the
    # MWMW strips: 3000 px / 180 deg = 16.67 px/deg, so 333 px centred on row 1500.
    ('milkyway-visible', 'https://cdn.eso.org/images/large/eso0932a.jpg', (334, 6000, 1333, 0)),
    ('milkyway-xray', MWMW + 'rosat_poster_mag4.jpg', None),
    ('milkyway-gamma', MWMW + 'egret_poster_mag4.jpg', None),

    # The Sun, 18 December 2015 (ALMA solar science verification day).
    ('sun-microwave', 'https://cdn.eso.org/images/large/eso1703c.jpg', None),
    ('sun-visible', helioviewer(18, '2015-12-18T19:00:00Z'), None),     # SDO/HMI continuum
    ('sun-ultraviolet-1700', helioviewer(16, '2015-12-18T19:00:00Z'), None),  # SDO/AIA 1700
    ('sun-ultraviolet-304', helioviewer(13, '2015-12-18T19:00:00Z'), None),   # SDO/AIA 304
    ('sun-ultraviolet-171', helioviewer(10, '2015-12-18T19:00:00Z'), None),   # SDO/AIA 171
    ('sun-xray', helioviewer(48, '2015-12-18T17:54:05Z'), None),        # Hinode/XRT Al_poly

    # The Crab Nebula: Chandra 2017 multiwavelength set (single-band images, 864 px).
    ('crab-radio', CRAB + 'crab_radio.jpg', None),
    ('crab-infrared', CRAB + 'crab_ir.jpg', None),
    ('crab-visible', CRAB + 'crab_optical.jpg', None),
    ('crab-ultraviolet', CRAB + 'crab_uv.jpg', None),
    ('crab-xray', CRAB + 'crab_xray.jpg', None),
    ('crab-gamma', 'https://heasarc.gsfc.nasa.gov/Images/objects/heapow/transients/crabflare_fermi.jpg', None),
]


def fetch(url, path):
    req = urllib.request.Request(url, headers={'User-Agent': 'full-spectrum-fetch/1.0'})
    with urllib.request.urlopen(req, timeout=300) as r, open(path, 'wb') as f:
        f.write(r.read())


def sips(*args):
    subprocess.run(['sips', *args], check=True, stdout=subprocess.DEVNULL)


def size(path):
    out = subprocess.run(['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', path],
                         check=True, capture_output=True, text=True).stdout.split()
    return int(out[-3]), int(out[-1])


def main(only=None):
    os.makedirs(OUT, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix='fs-sky-')
    for name, url, crop in IMAGES:
        if only and name not in only:
            continue
        raw = os.path.join(tmp, name + '.raw')
        fetch(url, raw)
        src = raw
        if crop:
            h, w, oy, ox = crop
            src = os.path.join(tmp, name + '.crop.png')
            sips('-s', 'format', 'png', '-c', str(h), str(w),
                 '--cropOffset', str(oy), str(ox), raw, '--out', src)
        dest = os.path.join(OUT, name + '.jpg')
        resize = ['-Z', str(MAX_PX)] if max(size(src)) > MAX_PX else []  # never upscale
        sips('-s', 'format', 'jpeg', '-s', 'formatOptions', str(QUALITY),
             *resize, src, '--out', dest)
        print(f'{name}.jpg  {os.path.getsize(dest) // 1024} KB')
    print('downloads left in', tmp)


if __name__ == '__main__':
    main(set(sys.argv[1:]) or None)
