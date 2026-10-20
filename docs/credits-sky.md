# Credits: the sky in every light, and the atmosphere

Images are fetched and resized by `tools/fetch_sky.py` (to 1600 px or smaller on the long side,
JPEG quality 82) into `assets/sky/`. The atmosphere curve is built by
`tools/build_atmosphere.py` into `data/atmosphere.js`. Licence terms were read on each source's own
page on 2026-10-20. Every image except the visible-light ones is false colour.

## The Milky Way

All strips cover 360 degrees of Galactic longitude, 10 degrees either side of the plane, with the
Galactic centre in the middle. The NASA strips come from the 4x versions (2880 x 160 px) of the
Multiwavelength Milky Way maps. Those images were made by Jay Friedlander (GSFC SED Visualization
Lab) with Seth Digel. The site names no specific credit line or licence. It is a NASA GSFC site,
so the NASA media usage guidelines apply: NASA material "generally [is] not subject to copyright
in the United States" and may be used on "Internet Web pages"
(https://www.nasa.gov/nasa-brand-center/images-and-media/). The credit line we use follows.

- **408 MHz radio continuum**: `milkyway-radio-408mhz.jpg`. Credit: NASA Goddard Space Flight Center, Multiwavelength Milky Way; data: Haslam et al. 1982 (Jodrell Bank, Bonn 100 m, Parkes 64 m). Licence: NASA, not copyrighted. Source: https://asd.gsfc.nasa.gov/archive/mwmw/mmw_sci.html (image `images/rc408_poster_mag4.jpg`).
- **21 cm atomic hydrogen**: `milkyway-radio-21cm.jpg`. Credit: as above; data: Leiden-Dwingeloo survey (Hartmann & Burton 1997), Kerr et al. 1986. Licence: NASA, not copyrighted. Source: same page (`nhi_poster_mag4.jpg`).
- **2.4-2.7 GHz radio continuum**: `milkyway-radio-2.5ghz.jpg`. Credit: as above; data: Reich et al. 1990, Fuerst et al. 1990 (Bonn 100 m), Duncan et al. 1995 (Parkes 64 m). The bright Galactic ridge has been subtracted, and the map covers only 5 degrees either side of the plane. Licence: NASA, not copyrighted. Source: same page (`rc2695_poster_mag4.jpg`).
- **115 GHz carbon monoxide**: `milkyway-microwave-co.jpg`. Credit: as above; data: Dame, Hartmann & Thaddeus 2001. Licence: NASA, not copyrighted. Source: same page (`wco_poster_mag4.jpg`).
- **12/60/100 micron infrared (IRAS)**: `milkyway-infrared-far.jpg`. Credit: as above; data: IRAS Sky Survey Atlas (Wheelock et al. 1994). Licence: NASA, not copyrighted. Source: same page (`iras_poster_mag4.jpg`).
- **8.3 micron mid-infrared (MSX)**: `milkyway-infrared-mid.jpg`. Credit: as above; data: MSX SPIRIT III (Price et al. 2001). Covers 5 degrees either side of the plane. Licence: NASA, not copyrighted. Source: same page (`mir_poster_mag4.jpg`).
- **1.25/2.2/3.5 micron near-infrared (COBE DIRBE)**: `milkyway-infrared-near.jpg`. Credit: as above; data: COBE DIRBE (Hauser et al. 1995). Licence: NASA, not copyrighted. Source: same page (`dirbe_poster_mag4.jpg`).
- **Visible light**: `milkyway-visible.jpg`. Credit: **ESO/S. Brunier**. Licence: CC BY 4.0 (https://www.eso.org/public/copyright/). Change made: the full-sky panorama (plate carree in Galactic coordinates, 6000 x 3000 px) is cropped to 10 degrees either side of the plane, to match the other strips, and resized. Source: https://www.eso.org/public/images/eso0932a/. The MWMW optical strip was not used: it is "Image courtesy of A. Mellinger", copyright Axel Mellinger, and no public licence was found.
- **0.25/0.75/1.5 keV soft X-rays (ROSAT)**: `milkyway-xray.jpg`. Credit: as above; data: ROSAT PSPC All-Sky Survey (Snowden et al. 1997). Licence: NASA, not copyrighted. Source: same page (`rosat_poster_mag4.jpg`).
- **Gamma rays above 300 MeV (EGRET)**: `milkyway-gamma.jpg`. Credit: as above; data: CGRO EGRET (Hartman et al. 1999; Hunter et al. 1997). Licence: NASA, not copyrighted. Source: same page (`egret_poster_mag4.jpg`).

## The Sun, 18 December 2015

ALMA's solar science-verification day. The SDO and Hinode images were rendered at 1.5 arcsec per
pixel, 1600 x 1600 px, through the Helioviewer.org API (https://api.helioviewer.org/), because
SDO's own browse archive starts in 2016.

- **1.25 mm (ALMA, single-dish fast-scan map)**: `sun-microwave.jpg`. Credit: **ALMA (ESO/NAOJ/NRAO)**. Licence: CC BY 4.0 (ESO image). Source: https://www.eso.org/public/images/eso1703c/. Date 2015-12-18 per NRAO's gallery entry (https://public.nrao.edu/gallery/the-sun-at-1-25mm/).
- **Visible, 617 nm continuum (SDO HMI)**, 18:59:38 UT: `sun-visible.jpg`.
- **170 nm ultraviolet (SDO AIA 1700)**, 18:59:42 UT: `sun-ultraviolet-1700.jpg`.
- **30.4 nm extreme UV (SDO AIA 304)**, 19:00:06 UT: `sun-ultraviolet-304.jpg`.
- **17.1 nm extreme UV (SDO AIA 171)**, 19:00:10 UT: `sun-ultraviolet-171.jpg`.
  For all four SDO images: credit **"Courtesy of NASA/SDO and the AIA, EVE, and HMI science teams."**
  The SDO data rules (https://sdo.gsfc.nasa.gov/data/rules.php) say: "SDO images and movies are not
  copyrighted unless explicitly noted. The use of SDO images for non-commercial purposes and public
  education and information efforts is strongly encouraged and requires no expressed authorization."
- **Soft X-rays (Hinode XRT, Al-poly filter)**, 17:54:05 UT: `sun-xray.jpg`. Credit: **Hinode XRT (SAO, NASA, JAXA, NAOJ)**. The XRT site asks, "If an XRT image is displayed in a popular article, on a website, et cetera, then please acknowledge the contributing institutions: '(SAO, NASA, JAXA, NAOJ)'" (https://xrt.cfa.harvard.edu/). Helioviewer's standard scaling saturates the brightest active regions.
- **Helioviewer.org**: renders the SDO and XRT images above. Acknowledged in the credit lines as "Rendered with Helioviewer.org".

## The Crab Nebula

The five matched single-band images (864 x 864 px, about 5 arcmin or 10 light years across) come
from the Chandra release "Crab Nebula" of 10 May 2017 (https://chandra.harvard.edu/photo/2017/crab/,
single bands at https://chandra.harvard.edu/photo/2017/crab/more.html). The science paper is Dubner
et al. 2017, ApJ 840, 82. Chandra's image use policy
(https://chandra.harvard.edu/photo/image_use.html) says: "For Chandra content, no claim to
copyright is being asserted and the material may be used in accordance with NASA guidelines". It
warns that multiwavelength images with non-NASA data may carry third-party rights. Those parts are
noted below.

- **3 GHz radio (VLA)**: `crab-radio.jpg`. Credit: **Radio: NSF/NRAO/VLA**. Licence: third-party data. NRAO licenses its own images under CC BY 4.0 with the credit kept visible (https://public.nrao.edu/media-resources/).
- **24 micron infrared (Spitzer MIPS)**: `crab-infrared.jpg`. Credit: **Infrared: NASA/JPL/Caltech**. Licence: the JPL image use policy allows use "for any purpose without prior permission" (https://www.jpl.nasa.gov/jpl-image-use-policy). The wavelength comes from the Spitzer release ssc2017-05a (https://www.spitzer.caltech.edu/image/ssc2017-05a-crab-nebula-from-five-observatories).
- **673 nm visible, [S II] (Hubble WFPC2)**: `crab-visible.jpg`. Credit: **Optical: NASA/STScI**. Licence: NASA, not copyrighted.
- **~291 nm ultraviolet (XMM-Newton Optical Monitor)**: `crab-ultraviolet.jpg`. Credit: **Ultraviolet: ESA/XMM-Newton**. Licence: third-party (ESA) data. ESA allows educational and informational use without separate authorisation, with credit, and bars commercial use (https://www.esa.int/ESA_Multimedia/Copyright_Notice_Images). The 291 nm wavelength comes from Dubner et al. 2017. AstroPix lists 390 nm.
- **0.5-8 keV X-rays (Chandra ACIS)**: `crab-xray.jpg`. Credit: **X-ray: NASA/CXC/SAO**. Licence: no copyright asserted (Chandra image use policy).
- **Gamma rays above 100 MeV (Fermi LAT)**: `crab-gamma.jpg`. Credit: **NASA/DOE/Fermi LAT/R. Buehler**. Shows the Crab's normal state beside its April 2011 flare, with the Geminga pulsar below. The field is degrees wide and the Crab is unresolved. Licence: NASA, not copyrighted. Source: https://heasarc.gsfc.nasa.gov/docs/objects/heapow/archive/transients/crabflare_fermi.html.

## Atmosphere (`data/atmosphere.js`, schematic)

No single licensed dataset covers 1e-15 m to 1e4 m, so the curve is stitched together and marked
`schematic: true`. The segments are documented in the file header and in `tools/build_atmosphere.py`.

- **ASTM G173-03 reference spectra** (280 nm-0.9 um): from SMARTS2 v2.9.2, US Standard Atmosphere 1976, rural aerosol, air mass 1.5. Transmission is (direct normal / extraterrestrial)^(1/1.5). Table as distributed by NREL, fetched from the copy in pvlib-python (BSD-3): https://github.com/pvlib/pvlib-python/blob/main/pvlib/data/ASTMG173.csv. The standard: ASTM G173-03.
- **ATRAN model transmission, Maunakea** (0.9-5.6 um and 7-26 um; 1.6 mm precipitable water vapour, air mass 1.0): files `mktrans_zm_16_10.dat` and `mktrans_nq_16_10.dat` from Gemini Observatory (https://www.gemini.edu/observing/telescopes-and-sites/sites). Gemini's terms: "Any use of these data should reference Lord, S. D., 1992, NASA Technical Memorandum 103957, and acknowledge Gemini Observatory." Credit: **ATRAN (Lord 1992, NASA TM 103957); data courtesy of Gemini Observatory.**
- **ITU-R P.676-12, Attenuation by atmospheric gases** (0.3 mm-30 cm): Annex 1 line-by-line oxygen and water-vapour absorption, integrated to the zenith from 4.2 km through the ITU-R P.835 reference standard atmosphere, with water vapour scaled to 1.6 mm to match the ATRAN segment. Computed with ITU-Rpy 0.4.0 (MIT licence, https://github.com/inigodelportillo/ITU-Rpy). Recommendation: https://www.itu.int/rec/R-REC-P.676/en.
- **Schematic pieces** (not from a dataset): 0 below 280 nm (ozone and O2 absorption; photoionisation for X-rays and gamma rays); 0 for 5.6-7 um (the 6.3 um water band) and 26-300 um (the water rotation band). Beyond 30 cm, an ionospheric cut-off 1/(1+(15 MHz/f)^6) puts half transmission at 15 MHz (20 m). The real cut-off is the F2-layer critical frequency, from a few MHz at night to roughly 10-15 MHz by day, changing with season and the solar cycle.
- **Named windows** (`WINDOWS`): conventional band edges (J, H, K, L, M, N, Q; sub-mm 350/450/850 um; 1.3 mm and 3 mm; radio window). They are conventions, not hard limits.

## Considered and left out

- **The Sun in radio below millimetre waves**: the Nobeyama Radioheliograph (17 GHz) has daily images for 2015-12-18, but its data-use policy page returns 403 Forbidden and no reuse terms could be read. Left out.
- **The Sun in infrared and gamma rays**: no matched, licensable full-disc image was found. In gamma rays the quiet Sun is an unresolved point to Fermi.
- **The Milky Way in ultraviolet**: no all-sky Galactic-plane UV strip with clear terms was found. GALEX avoided the plane.
- **The MWMW optical strip** (A. Mellinger, copyright): replaced by the ESO/S. Brunier panorama.
