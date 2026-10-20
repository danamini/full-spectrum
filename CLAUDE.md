# Full Spectrum: working notes

Start with `docs/plan.md`: sections 6 (phases) and 9 (decisions).

- **Same shape as Molecule Viewer** (`../molecule-viewer`): static site, no build step, ES modules,
  three.js r170 by import map, Playwright smoke test. Borrow its patterns before inventing new ones.
- **One definition:** every constant and formula lives in `js/physics.js`; other files import it.
- **Accuracy, credited:** every number, dataset and image gets its source when it first appears;
  sources listed in the README's Data section once there is one. Band boundaries are conventions:
  say so rather than drawing hard edges.
- **Real colour vs false colour:** only the visible band is drawn in real (CIE-derived) colour;
  everything else is false colour, and must look it.
- **a sibling app is private.** Links to it stay behind the switch in `js/links.js`, off by default;
  never put its unpublished content or addresses in this repo.
- **Checks:** `npm test` before committing. A fixed bug gets a test.
- Repo: private `danamini/full-spectrum`. Commit as work lands.
