// Shareable links: ?view=hazard&scenario=storm&condition=severe opens that exact state.
// Unknown or invalid values are ignored, so a bad link falls back to the normal start screen.

export const VIEWS = [
  'desk',
  'hazard',
  'pollution',
  'intensity',
  'compare',
  'tasks',
  'residents',
  'evidence',
];
export const LINK_SCENARIOS = ['storm', 'salinity', 'dry'];
export const LINK_CONDITIONS = ['clear', 'moderate', 'severe'];

export function parseDeepLink(search = '') {
  const params = new URLSearchParams(search);
  const pick = (key, allowed) => {
    const value = params.get(key);
    return allowed.includes(value) ? value : undefined;
  };
  const out = {};
  const view = pick('view', VIEWS);
  const scenario = pick('scenario', LINK_SCENARIOS);
  const condition = pick('condition', LINK_CONDITIONS);
  if (view) out.view = view;
  if (scenario) out.scenario = scenario;
  if (condition) out.condition = condition;
  return out;
}

// Always writes the view and scenario; writes the storm severity only where it matters.
export function buildDeepLink({ view, scenario, condition }) {
  const params = new URLSearchParams();
  params.set('view', view);
  params.set('scenario', scenario);
  if (view === 'hazard' && scenario === 'storm') params.set('condition', condition);
  return '?' + params.toString();
}
