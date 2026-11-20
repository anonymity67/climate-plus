import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { connectChannels } from '../src/platform/channel-topology.mjs';
test('a crossing without a shared node is not connected, but an internal shared node joins channels', () => {
  const a = {
    osmId: 1,
    nodes: [10, 11, 12],
    geometry: {
      coordinates: [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
    },
  };
  const b = {
    osmId: 2,
    nodes: [20, 21],
    geometry: {
      coordinates: [
        [1, -1],
        [1, 1],
      ],
    },
  };
  const c = {
    osmId: 3,
    nodes: [11, 30],
    geometry: {
      coordinates: [
        [1, 0],
        [1, 2],
      ],
    },
  };
  const result = connectChannels([a, b, c], 'test');
  assert.equal(result.components, 2);
  assert.equal(result.ways[0].component, result.ways[2].component);
  assert.notEqual(result.ways[0].component, result.ways[1].component);
  assert.equal(a.component, undefined);
});
test('all frozen channel components are independently reachable through shared node IDs', () => {
  for (const area of ['dhaka', 'sylhet', 'dacope']) {
    const bytes = readFileSync(
      new URL('../backend/data/streams/' + area + '.json', import.meta.url),
    );
    assert.deepEqual(
      bytes,
      readFileSync(new URL('../public/data/streams/' + area + '.json', import.meta.url)),
    );
    const graph = JSON.parse(bytes),
      atNode = new Map(),
      seen = new Set();
    graph.ways.forEach((w, i) =>
      w.nodes.forEach((n) => {
        if (!atNode.has(n)) atNode.set(n, []);
        atNode.get(n).push(i);
      }),
    );
    let components = 0;
    for (let i = 0; i < graph.ways.length; i++) {
      if (seen.has(i)) continue;
      components++;
      const queue = [i],
        declared = graph.ways[i].component;
      seen.add(i);
      for (let index = 0; index < queue.length; index++) {
        const w = graph.ways[queue[index]];
        assert.equal(w.component, declared);
        for (const n of w.nodes)
          for (const next of atNode.get(n)) {
            if (!seen.has(next)) {
              seen.add(next);
              queue.push(next);
            }
          }
      }
      assert.equal(
        graph.ways.filter((w) => w.component === declared).length,
        queue.length,
        'No disconnected ways may share a component',
      );
    }
    assert.equal(components, graph.components);
  }
});
test('offline channel builder reproduces the shipped assets without rewriting the workspace', () => {
  const result = spawnSync(process.execPath, ['scripts/build-waterways.mjs', '--check'], {
    cwd: new URL('../', import.meta.url),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
});
