# Full Spectrum

The whole electromagnetic spectrum, end to end: radio waves longer than a country down to gamma rays
smaller than a nucleus, with the real colours of visible light, animated waves at a scale you can feel,
and what each band does to matter.

Status: early. The plan is [docs/plan.md](docs/plan.md).

## Run it

A static site with no build step. Serve the folder and open it:

```
python3 -m http.server 8000
```

then go to http://localhost:8000. (Opening `index.html` straight from disk will not work: browsers block
ES modules over `file://`.)

## Test it

```
npm install
npx playwright install chromium
npm test
```

`tests/physics.mjs` checks the physics against known values; `tests/smoke.mjs` serves the site and drives
it in Chromium. Any console error fails the run.
