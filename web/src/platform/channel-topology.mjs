/** Connectivity is undirected and depends on shared source node identity, not geometry crossings. */
export function connectChannels(input, area) {
  const ways = input.map((w) => ({ ...w })),
    parents = ways.map((_, i) => i),
    atNode = new Map();
  const find = (i) => {
    while (parents[i] !== i) {
      parents[i] = parents[parents[i]];
      i = parents[i];
    }
    return i;
  };
  for (let i = 0; i < ways.length; i++)
    for (const node of ways[i].nodes) {
      if (atNode.has(node)) parents[find(i)] = find(atNode.get(node));
      else atNode.set(node, i);
    }
  const components = new Map();
  for (let i = 0; i < ways.length; i++) {
    const root = find(i);
    if (!components.has(root)) components.set(root, []);
    components.get(root).push(i);
  }
  for (const indices of components.values()) {
    const id = area + '-' + Math.min(...indices.map((i) => ways[i].osmId));
    for (const i of indices) ways[i].component = id;
  }
  return { ways, components: components.size };
}
