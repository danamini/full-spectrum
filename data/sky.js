// The same objects seen in different bands. Images fetched and resized by tools/fetch_sky.py;
// full credits and licence notes in docs/credits-sky.md.
// `band` is one of: radio, microwave, infrared, visible, ultraviolet, xray, gamma (an object can
// have several images in one band). `metres` is a representative wavelength, not a band edge.
// Images are ordered longest wavelength first. Everything except the `visible` images is false
// colour.

const MWMW = 'https://asd.gsfc.nasa.gov/archive/mwmw/mmw_sci.html';
const MWMW_CREDIT = 'NASA Goddard Space Flight Center, Multiwavelength Milky Way';
const NASA_PD = 'NASA: not subject to copyright in the US (NASA media usage guidelines)';
const SDO_CREDIT = 'Courtesy of NASA/SDO and the AIA, EVE, and HMI science teams. Rendered with Helioviewer.org.';
const SDO_LICENCE = 'SDO images are not copyrighted; non-commercial and educational use encouraged with attribution (SDO data rules)';
const CRAB = 'https://chandra.harvard.edu/photo/2017/crab/more.html';

export const SKY = [
  {
    key: 'milkyway',
    name: 'The Milky Way',
    note: 'A 360-degree strip along the plane of our Galaxy, 10 degrees either side, with the Galactic centre in the middle.',
    images: [
      { band: 'radio', label: '408 MHz radio continuum', metres: 0.7348, file: 'assets/sky/milkyway-radio-408mhz.jpg',
        credit: `${MWMW_CREDIT}; data: Haslam et al. 1982 (Jodrell Bank, Bonn 100 m, Parkes 64 m)`, licence: NASA_PD, url: MWMW },
      { band: 'radio', label: '21 cm atomic hydrogen', metres: 0.2110, file: 'assets/sky/milkyway-radio-21cm.jpg',
        credit: `${MWMW_CREDIT}; data: Leiden-Dwingeloo survey (Hartmann & Burton 1997), Kerr et al. 1986`, licence: NASA_PD, url: MWMW },
      { band: 'radio', label: '2.4-2.7 GHz radio continuum', metres: 0.12, file: 'assets/sky/milkyway-radio-2.5ghz.jpg',
        credit: `${MWMW_CREDIT}; data: Reich et al. 1990, Fuerst et al. 1990 (Bonn 100 m), Duncan et al. 1995 (Parkes 64 m)`, licence: NASA_PD, url: MWMW },
      { band: 'microwave', label: '115 GHz carbon monoxide (molecular gas)', metres: 2.601e-3, file: 'assets/sky/milkyway-microwave-co.jpg',
        credit: `${MWMW_CREDIT}; data: Dame, Hartmann & Thaddeus 2001 (CfA 1.2 m telescopes)`, licence: NASA_PD, url: MWMW },
      { band: 'infrared', label: '12, 60 and 100 micron infrared (IRAS)', metres: 6e-5, file: 'assets/sky/milkyway-infrared-far.jpg',
        credit: `${MWMW_CREDIT}; data: IRAS Sky Survey Atlas (Wheelock et al. 1994)`, licence: NASA_PD, url: MWMW },
      { band: 'infrared', label: '8.3 micron mid-infrared (MSX)', metres: 8.28e-6, file: 'assets/sky/milkyway-infrared-mid.jpg',
        credit: `${MWMW_CREDIT}; data: MSX SPIRIT III (Price et al. 2001)`, licence: NASA_PD, url: MWMW },
      { band: 'infrared', label: '1.25, 2.2 and 3.5 micron near-infrared (COBE DIRBE)', metres: 2.2e-6, file: 'assets/sky/milkyway-infrared-near.jpg',
        credit: `${MWMW_CREDIT}; data: COBE DIRBE (Hauser et al. 1995)`, licence: NASA_PD, url: MWMW },
      { band: 'visible', label: 'Visible light (photographic panorama)', metres: 5.5e-7, file: 'assets/sky/milkyway-visible.jpg',
        credit: 'ESO/S. Brunier (cropped to 10 degrees either side of the Galactic plane)', licence: 'CC BY 4.0',
        url: 'https://www.eso.org/public/images/eso0932a/' },
      { band: 'xray', label: '0.25, 0.75 and 1.5 keV soft X-rays (ROSAT)', metres: 1.653e-9, file: 'assets/sky/milkyway-xray.jpg',
        credit: `${MWMW_CREDIT}; data: ROSAT PSPC All-Sky Survey (Snowden et al. 1997)`, licence: NASA_PD, url: MWMW },
      { band: 'gamma', label: 'Gamma rays above 300 MeV (CGRO EGRET)', metres: 4.133e-15, file: 'assets/sky/milkyway-gamma.jpg',
        credit: `${MWMW_CREDIT}; data: CGRO EGRET (Hartman et al. 1999, Hunter et al. 1997)`, licence: NASA_PD, url: MWMW },
    ],
  },
  {
    key: 'sun',
    name: 'The Sun',
    note: 'One day, 18 December 2015: the big sunspot group near the centre shows in every band, from millimetre waves to X-rays.',
    images: [
      { band: 'microwave', label: '1.25 mm millimetre waves (ALMA)', metres: 1.25e-3, file: 'assets/sky/sun-microwave.jpg',
        credit: 'ALMA (ESO/NAOJ/NRAO)', licence: 'CC BY 4.0', observed: '2015-12-18',
        url: 'https://www.eso.org/public/images/eso1703c/' },
      { band: 'visible', label: 'Visible light, 617 nm (SDO HMI)', metres: 6.173e-7, file: 'assets/sky/sun-visible.jpg',
        credit: SDO_CREDIT, licence: SDO_LICENCE, observed: '2015-12-18T18:59:38Z',
        url: 'https://sdo.gsfc.nasa.gov/data/rules.php' },
      { band: 'ultraviolet', label: 'Ultraviolet, 170 nm (SDO AIA 1700)', metres: 1.7e-7, file: 'assets/sky/sun-ultraviolet-1700.jpg',
        credit: SDO_CREDIT, licence: SDO_LICENCE, observed: '2015-12-18T18:59:42Z',
        url: 'https://sdo.gsfc.nasa.gov/data/rules.php' },
      { band: 'ultraviolet', label: 'Extreme ultraviolet, 30.4 nm (SDO AIA 304)', metres: 3.04e-8, file: 'assets/sky/sun-ultraviolet-304.jpg',
        credit: SDO_CREDIT, licence: SDO_LICENCE, observed: '2015-12-18T19:00:06Z',
        url: 'https://sdo.gsfc.nasa.gov/data/rules.php' },
      { band: 'ultraviolet', label: 'Extreme ultraviolet, 17.1 nm (SDO AIA 171)', metres: 1.71e-8, file: 'assets/sky/sun-ultraviolet-171.jpg',
        credit: SDO_CREDIT, licence: SDO_LICENCE, observed: '2015-12-18T19:00:10Z',
        url: 'https://sdo.gsfc.nasa.gov/data/rules.php' },
      { band: 'xray', label: 'Soft X-rays (Hinode XRT, Al-poly filter)', metres: 2e-9, file: 'assets/sky/sun-xray.jpg',
        credit: 'Hinode XRT (SAO, NASA, JAXA, NAOJ). Rendered with Helioviewer.org.',
        licence: 'Free use with acknowledgement of the contributing institutions (XRT data policy)', observed: '2015-12-18T17:54:05Z',
        url: 'https://xrt.cfa.harvard.edu/' },
    ],
  },
  {
    key: 'crab',
    name: 'The Crab Nebula',
    note: 'What is left of a star seen to explode in 1054, about 6,500 light years away; the frames are about 5 arcminutes (10 light years) across. The gamma-ray view is far wider and the nebula is a single dot in it.',
    images: [
      { band: 'radio', label: '3 GHz radio (VLA)', metres: 0.1, file: 'assets/sky/crab-radio.jpg',
        credit: 'Radio: NSF/NRAO/VLA', licence: 'Third-party (NRAO) data in a NASA/CXC image; NRAO images are CC BY 4.0 with credit',
        url: CRAB },
      { band: 'infrared', label: '24 micron infrared (Spitzer)', metres: 2.4e-5, file: 'assets/sky/crab-infrared.jpg',
        credit: 'Infrared: NASA/JPL/Caltech', licence: 'NASA/JPL: any purpose without prior permission, with credit (JPL image use policy)',
        url: CRAB },
      { band: 'visible', label: 'Visible light, 673 nm sulphur emission (Hubble)', metres: 6.73e-7, file: 'assets/sky/crab-visible.jpg',
        credit: 'Optical: NASA/STScI', licence: NASA_PD, url: CRAB },
      { band: 'ultraviolet', label: 'Ultraviolet, ~291 nm (XMM-Newton Optical Monitor)', metres: 2.91e-7, file: 'assets/sky/crab-ultraviolet.jpg',
        credit: 'Ultraviolet: ESA/XMM-Newton', licence: 'Third-party (ESA) data in a NASA/CXC image; ESA permits non-commercial educational use with credit',
        url: CRAB },
      { band: 'xray', label: 'X-rays, 0.5-8 keV (Chandra)', metres: 8.27e-10, file: 'assets/sky/crab-xray.jpg',
        credit: 'X-ray: NASA/CXC/SAO', licence: 'No copyright asserted; use per NASA guidelines (Chandra image use policy)',
        url: CRAB },
      { band: 'gamma', label: 'Gamma rays above 100 MeV (Fermi LAT), normal and flaring', metres: 1.24e-14, file: 'assets/sky/crab-gamma.jpg',
        credit: 'NASA/DOE/Fermi LAT/R. Buehler', licence: NASA_PD,
        url: 'https://heasarc.gsfc.nasa.gov/docs/objects/heapow/archive/transients/crabflare_fermi.html' },
    ],
  },
];
