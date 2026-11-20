import { screenWater } from './water-engine.mjs';

export function markerColor(observation, layer = 'quality') {
  if (layer === 'survey') return '#357e8d';
  const screen = screenWater(observation);
  if (screen.index === null) return '#77817c';
  return screen.failed >= 2 ? '#a74635' : screen.failed === 1 ? '#a87920' : '#3d7a66';
}
