// Links to the sibling apps.
export const MOLECULE_VIEWER = 'https://moleculeviewer.org/';
export const SOLAR_TIMELINE = 'https://solartimeline.org/';

export const moleculeViewer = hash => `${MOLECULE_VIEWER}#${hash}`;
// A body in Solar Timeline's explorer, by its id there ('sun', 'earth', 'moon', 'jupiter', ...).
export const solarTimeline = body => `${SOLAR_TIMELINE}explorer#${body}`;
// Things in this app that Solar Timeline shows, and its id for each.
export const SOLAR_BODIES = { earth: 'earth', moon: 'moon', jupiter: 'jupiter', neptune: 'neptune' };
