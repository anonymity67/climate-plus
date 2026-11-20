/** Static bundled inputs work in Workers; no runtime filesystem or network fetch. */
import { createRoutingEngine } from './engine.mjs';
import dacopeGraph from '../backend/data/regions/dacope-graph.json' with { type: 'json' };
import ukhiaGraph from '../backend/data/regions/ukhia-graph.json' with { type: 'json' };
import chattogramGraph from '../backend/data/regions/chattogram-graph.json' with { type: 'json' };
import khulnaGraph from '../backend/data/regions/khulna-graph.json' with { type: 'json' };
import tongiGraph from '../backend/data/regions/tongi-graph.json' with { type: 'json' };
import regionIndex from '../public/data/regions/index.json' with { type: 'json' };
import dacopeScenario from '../public/data/regions/dacope-scenario.json' with { type: 'json' };
import ukhiaScenario from '../public/data/regions/ukhia-scenario.json' with { type: 'json' };
import chattogramScenario from '../public/data/regions/chattogram-scenario.json' with { type: 'json' };
import khulnaScenario from '../public/data/regions/khulna-scenario.json' with { type: 'json' };
import tongiScenario from '../public/data/regions/tongi-scenario.json' with { type: 'json' };

const graphs = {
  dacope: dacopeGraph,
  ukhia: ukhiaGraph,
  chattogram: chattogramGraph,
  khulna: khulnaGraph,
  tongi: tongiGraph,
};
const scenarios = {
  dacope: dacopeScenario,
  ukhia: ukhiaScenario,
  chattogram: chattogramScenario,
  khulna: khulnaScenario,
  tongi: tongiScenario,
};
const engines = new Map();

export const routingPool = {
  get metadata() {
    return this.forRegion('dacope').metadata;
  },
  regionIds: Object.freeze(regionIndex.regions.map((region) => region.id)),
  forRegion(regionId) {
    if (!Object.hasOwn(graphs, regionId)) return undefined;
    if (!engines.has(regionId)) engines.set(regionId, createRoutingEngine(graphs[regionId]));
    return engines.get(regionId);
  },
  scenarioForRegion(regionId) {
    return Object.hasOwn(scenarios, regionId) ? scenarios[regionId] : undefined;
  },
};

const assetsFor = (regionId) =>
  scenarios[regionId].assets.map((asset) => ({
    ...asset,
    regionId,
    qualification: 'A scenario asset; water quality and current operational status are unverified.',
  }));

export const regionalCatalogue = {
  regions: regionIndex.regions.map((region) => ({
    ...region,
    assets: assetsFor(region.id),
    scenarioSource: scenarios[region.id].source,
  })),
  // Existing clients expect Dacope presets at the top level.
  assets: assetsFor('dacope'),
  source: scenarios.dacope.source,
  sourceRegister: '/data/source-register.json',
};
