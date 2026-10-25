import { mkdirSync, writeFileSync } from 'node:fs';
import { scenarioConfig, plan, baseline, simulate } from '../src/engine.mjs';
const results = [];
for (const scenario of ['storm', 'salinity', 'dry'])
  for (const budget of [0, 1600, 2400, 4000])
    for (const demandMultiplier of [0.8, 1, 1.2]) {
      const c = scenarioConfig(scenario),
        o = { budget, demandMultiplier };
      const fixed = baseline(c, o),
        threshold = baseline(c, o, 'threshold'),
        p = plan(c, o),
        sameSchedule = simulate(c, p.schedule, { ...o, allocation: 'first-arrival' });
      for (const [policy, r] of [
        ['fixed-first-arrival', fixed],
        ['threshold-first-arrival', threshold],
        ['optimized-first-arrival-ablation', sameSchedule],
        ['climate-plus', p],
      ])
        results.push({
          scenario,
          budget,
          demandMultiplier,
          policy,
          unmet: r.unmet,
          worstHouseholdCoverage: r.worstCoverage,
          schoolCoverage: r.coverage[2],
          cost: r.cost,
          shortageDays: r.shortageDays,
          terminalStock: r.terminalStock,
          spill: r.spill,
          schedule: r.schedule,
        });
    }
mkdirSync('public/data', { recursive: true });
writeFileSync(
  'public/data/benchmark.json',
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      provenance: 'simulated',
      note: '36 known-input scenarios, four policies. Sensitivity grid, not independent field trials. Scheduling and allocation ablation included. No stochastic forecast skill claimed.',
      results,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    {
      scenarios: 36,
      policyRuns: results.length,
      example: results.filter(
        (r) => r.scenario === 'salinity' && r.budget === 2400 && r.demandMultiplier === 1,
      ),
    },
    null,
    2,
  ),
);
