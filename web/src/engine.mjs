export const ENGINE_VERSION = '0.1.0';
export const SCENARIOS = {
  storm: {
    name: 'Nor’wester disruption',
    short: 'Storm',
    signal: 'A pump is offline. Tomorrow’s access route is closed.',
    initial: 4200,
    inflows: [500, 500, 500, 1200, 1200, 1200, 1200],
    blockedDays: [1],
    restrictedSources: ['pump'],
    evidence:
      'Illustrative storm interruption, informed by BMD and Bangladesh Red Crescent reports. This is not a current warning.',
    action: 'Inspect pump power and the access route before reopening.',
    source:
      'https://bdrcs.org/wp-content/uploads/2026/03/Sitrep-1-Norwester-Kalbaishakhi-Storm_30-march-2026.pdf',
  },
  salinity: {
    name: 'Coastal salinity',
    short: 'Salinity',
    signal: 'A source is held for quality review. Usable inflow falls.',
    initial: 3000,
    inflows: Array(7).fill(400),
    blockedDays: [],
    restrictedSources: ['pond'],
    evidence:
      'Synthetic quality hold. Conductivity is a screening observation, not proof of microbiological safety.',
    action: 'Request quality review; replenish only from cleared supply.',
    source: 'https://reachwater.uk/datasets/',
  },
  dry: {
    name: 'Seasonal dry-period stress',
    short: 'Dry period',
    signal: 'Lower replenishment persists across the planning horizon.',
    initial: 4000,
    inflows: Array(7).fill(700),
    blockedDays: [],
    restrictedSources: [],
    evidence:
      'A dry-period stress scenario, not an ENSO forecast of local tank stock. Historical climate analysis appears in Evidence.',
    action: 'Check supplier commitments and reserve storage before the dry period.',
    source: 'https://www.noaa.gov/understanding-el-nino',
  },
};
export function scenarioConfig(id = 'storm') {
  if (!SCENARIOS[id]) throw new Error('Unknown scenario');
  return structuredClone({
    id,
    ...SCENARIOS[id],
    days: 7,
    capacity: 10000,
    demands: [1200, 800, 300],
    areas: ['East catchment', 'West catchment', 'School'],
    deliverySize: 2000,
    deliveryCost: 800,
    provenance: 'synthetic',
  });
}
function options(c, o = {}) {
  const v = { budget: 2400, demandMultiplier: 1, schoolFloor: 0.8, allocation: 'balanced', ...o };
  if (!Number.isFinite(v.budget) || v.budget < 0) throw new Error('Invalid budget');
  if (!Number.isFinite(v.demandMultiplier) || v.demandMultiplier < 0 || v.demandMultiplier > 3)
    throw new Error('Invalid demand multiplier');
  if (!Number.isFinite(v.schoolFloor) || v.schoolFloor < 0 || v.schoolFloor > 1)
    throw new Error('Invalid school floor');
  if (
    !c ||
    c.days !== 7 ||
    !Array.isArray(c.demands) ||
    c.demands.length !== 3 ||
    !Array.isArray(c.inflows) ||
    c.inflows.length !== 7
  )
    throw new Error('Invalid scenario dimensions');
  if (
    !Array.isArray(c.blockedDays) ||
    c.blockedDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
  )
    throw new Error('Invalid delivery windows');
  if (
    ![c.initial, c.capacity, ...c.inflows, ...c.demands, c.deliveryCost, c.deliverySize].every(
      (n) => Number.isFinite(n) && n >= 0,
    ) ||
    c.initial > c.capacity ||
    c.deliveryCost <= 0 ||
    c.deliverySize <= 0
  )
    throw new Error('Invalid water quantities');
  return v;
}
function allocate(available, demands, floor, policy) {
  const a = [0, 0, 0];
  let left = available;
  if (policy === 'first-arrival') {
    for (let i = 0; i < 3; i++) {
      a[i] = Math.min(left, demands[i]);
      left -= a[i];
    }
    return a;
  }
  a[2] = Math.min(left, demands[2] * floor);
  left -= a[2];
  const households = demands[0] + demands[1];
  const share = households ? Math.min(1, left / households) : 0;
  a[0] = demands[0] * share;
  a[1] = demands[1] * share;
  left -= a[0] + a[1];
  a[2] += Math.min(Math.max(0, left), demands[2] - a[2]);
  return a;
}
export function simulate(c, deliveryDays = [], o = {}) {
  const v = options(c, o);
  const schedule = [...new Set(deliveryDays)].sort((a, b) => a - b);
  if (schedule.some((d) => !Number.isInteger(d) || d < 0 || d > 6 || c.blockedDays.includes(d)))
    throw new Error('Unavailable delivery window');
  if (schedule.length * c.deliveryCost > v.budget) throw new Error('Delivery budget exceeded');
  const demands = c.demands.map((x) => x * v.demandMultiplier);
  let stock = c.initial;
  const totals = [0, 0, 0];
  let priorityShortfall = 0;
  const rows = Array.from({ length: 7 }, (_, day) => {
    const open = stock,
      inflow = c.inflows[day],
      delivery = schedule.includes(day) ? c.deliverySize : 0;
    const spill = Math.max(0, open + inflow + delivery - c.capacity),
      available = Math.min(c.capacity, open + inflow + delivery);
    const allocation = allocate(available, demands, v.schoolFloor, v.allocation),
      served = allocation.reduce((a, b) => a + b, 0),
      demand = demands.reduce((a, b) => a + b, 0);
    stock = Math.max(0, available - served);
    allocation.forEach((x, i) => (totals[i] += x));
    priorityShortfall += Math.max(0, demands[2] * v.schoolFloor - allocation[2]);
    return {
      day,
      open,
      inflow,
      delivery,
      spill,
      served,
      demand,
      allocation,
      unmet: Math.max(0, demand - served),
      close: stock,
    };
  });
  const demand = demands.reduce((a, b) => a + b, 0) * 7,
    served = totals.reduce((a, b) => a + b, 0),
    coverage = totals.map((x, i) => (demands[i] ? x / (demands[i] * 7) : 1)),
    cost = schedule.length * c.deliveryCost;
  const worstCoverage = Math.min(...coverage.slice(0, 2));
  return {
    scenario: c.id,
    rows,
    schedule,
    cost,
    demand,
    served,
    unmet: Math.max(0, demand - served),
    coverage,
    worstCoverage,
    priorityShortfall,
    terminalStock: stock,
    spill: rows.reduce((s, r) => s + r.spill, 0),
    shortageDays: rows.filter((r) => r.unmet > 1e-6).length,
    score: [priorityShortfall, 1 - worstCoverage, Math.max(0, demand - served), cost],
    config: v,
    provenance: 'simulated',
  };
}
function better(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > 1e-7) return a[i] < b[i];
  }
  return false;
}
export function plan(c, o = {}) {
  const v = options(c, o);
  let best = null;
  for (let mask = 0; mask < 128; mask++) {
    const days = Array.from({ length: 7 }, (_, i) => i).filter((i) => mask & (1 << i));
    if (days.length * c.deliveryCost > v.budget || days.some((d) => c.blockedDays.includes(d)))
      continue;
    const p = simulate(c, days, v);
    if (!best || better(p.score, best.score)) best = p;
  }
  return best;
}
export function baseline(c, o = {}, type = 'fixed') {
  const v = options(c, o),
    limit = Math.floor(v.budget / c.deliveryCost);
  let schedule = [];
  if (type === 'fixed')
    schedule = [2, 4, 6].filter((d) => !c.blockedDays.includes(d)).slice(0, limit);
  else {
    let stock = c.initial,
      remaining = limit;
    const demand = c.demands.reduce((a, b) => a + b, 0) * v.demandMultiplier;
    for (let day = 0; day < 7; day++) {
      stock += c.inflows[day];
      if (stock < demand * 3 && remaining && !c.blockedDays.includes(day)) {
        schedule.push(day);
        stock += c.deliverySize;
        remaining--;
      }
      stock = Math.max(0, Math.min(c.capacity, stock) - demand);
    }
  }
  return simulate(c, schedule, { ...v, allocation: 'first-arrival' });
}
export function inspect(jobs, hours) {
  if (
    !Number.isFinite(hours) ||
    hours < 0 ||
    !Array.isArray(jobs) ||
    jobs.length > 20 ||
    jobs.some(
      (j) =>
        !j ||
        !Number.isFinite(j.hours) ||
        j.hours < 0 ||
        !Number.isFinite(j.priority) ||
        j.priority < 0 ||
        typeof j.accessible !== 'boolean',
    )
  )
    throw new Error('Invalid inspection budget or job');
  let best = [],
    score = -1;
  for (let mask = 0; mask < 2 ** jobs.length; mask++) {
    const selected = jobs.filter((_, i) => mask & (1 << i));
    if (selected.some((j) => !j.accessible) || selected.reduce((s, j) => s + j.hours, 0) > hours)
      continue;
    const value = selected.reduce((s, j) => s + j.priority, 0);
    if (value > score) {
      score = value;
      best = selected;
    }
  }
  return best;
}
export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return (
    '{' +
    Object.keys(value)
      .sort()
      .map((k) => JSON.stringify(k) + ':' + canonical(value[k]))
      .join(',') +
    '}'
  );
}
export async function receipt(manifest) {
  const copy = JSON.parse(JSON.stringify(manifest));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(copy)));
  return {
    manifest: copy,
    digest: '0x' + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join(''),
    algorithm: 'SHA-256',
    anchoring: 'not-anchored',
  };
}
export async function verifyReceipt(r) {
  return Boolean(r && r.digest === (await receipt(r.manifest)).digest);
}
