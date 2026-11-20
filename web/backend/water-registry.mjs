import dhaka from './data/streams/dhaka.json' with { type: 'json' };
import sylhet from './data/streams/sylhet.json' with { type: 'json' };
import dacope from './data/streams/dacope.json' with { type: 'json' };
import { createWaterCatalogue } from './water-catalogue.mjs';
let catalogue;
export function waterCatalogue() {
  return (catalogue ??= createWaterCatalogue({ streams: { dhaka, sylhet, dacope } }));
}
