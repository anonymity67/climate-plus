import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchScenarioPlan } from '../src/mvp/scenario-transport.mjs';
const input = {
  regionId: 'tongi',
  hazard: 'storm',
  severity: 'moderate',
  destinationRole: 'reserve',
  blockedEdgeIds: [],
};
const result = {
  regionId: 'tongi',
  hazard: 'storm',
  calculation: 'server',
  sourceKind: 'representational',
  waterSafety: 'unknown',
  source: { graphSha256: 'hash' },
  status: 'ok',
  routes: [],
};
test('map requests a real server calculation with the selected scenario contract', async () => {
  let sent;
  const r = await fetchScenarioPlan(input, {
    expectedGraphHash: 'hash',
    transport: async (path, options) => {
      sent = { path, ...options };
      return result;
    },
  });
  assert.equal(sent.path, '/scenario-route');
  assert.equal(sent.method, 'POST');
  assert.deepEqual(sent.body, input);
  assert.equal(r.calculation, 'server');
});
test('mismatched regional or road snapshots cannot become the current displayed server result', async () => {
  for (const changed of [
    { regionId: 'ukhia' },
    { hazard: 'salinity' },
    { source: { graphSha256: 'different' } },
    { sourceKind: 'device' },
    { waterSafety: 'safe' },
  ])
    await assert.rejects(
      () =>
        fetchScenarioPlan(input, {
          expectedGraphHash: 'hash',
          transport: async () => ({ ...result, ...changed }),
        }),
      /mismatch|reload|representational|safety/i,
    );
});
