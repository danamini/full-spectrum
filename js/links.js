// Links to the sibling apps. a sibling app is private (it may never be published), so its links stay off
// until it is public: while off, places that would link to it show no link at all.
export const MOLECULE_VIEWER = 'https://moleculeviewer.org/';
export const SIBLING_APP = { enabled: false, url: 'https://example.org/' };

export const moleculeViewer = hash => `${MOLECULE_VIEWER}#${hash}`;
export const siblingApp = path => (SIBLING_APP.enabled ? `${SIBLING_APP.url}${path}` : null);
