export const OBJECTIVES = {
  ph: { name: 'pH', min: 6, max: 9, unit: 'pH units' },
  do: { name: 'Dissolved oxygen', min: 5, unit: 'mg/L' },
  cod: { name: 'Chemical oxygen demand', max: 50, unit: 'mg/L' },
};
export const OBJECTIVE_PROFILE = {
  id: 'bd-ecr2023-fisheries-partial-v1',
  source: 'https://www.dpp.gov.bd/upload_file/gazettes/47999_44880.pdf',
  page: 53,
  gazettePage: 3061,
  intendedUse: 'Inland surface water for fisheries',
  coverage: '3 of 12 listed parameters',
  note: 'Retrospective screening against 2023 objectives; not historical legal compliance, overall ecological status or potability.',
};
const numeric = (v) => typeof v === 'number' && Number.isFinite(v);
const validDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return Number.isFinite(+d) && d.toISOString().slice(0, 10) === value;
};
function validParameter(k, v) {
  return numeric(v) && v >= 0 && (k !== 'ph' || v <= 14) && (k !== 'do' || v <= 30);
}
function excursion(v, o) {
  if (o.min !== undefined && v < o.min) return v === 0 ? Infinity : o.min / v - 1;
  if (o.max !== undefined && v > o.max) return v / o.max - 1;
  return 0;
}
export function screenWater(observation) {
  const tests = [],
    excluded = [];
  for (const [key, o] of Object.entries(OBJECTIVES)) {
    const value = observation[key];
    if (!validParameter(key, value)) {
      excluded.push({ key, reason: value == null ? 'not measured' : 'invalid value' });
      continue;
    }
    const ex = excursion(value, o);
    tests.push({
      key,
      ...o,
      value,
      failed: ex > 0,
      excursion: Number.isFinite(ex) ? ex : null,
      zeroBelowMinimum: ex === Infinity,
    });
  }
  const failed = tests.filter((t) => t.failed).length;
  return {
    index: tests.length ? (100 * failed) / tests.length : null,
    tested: tests.length,
    failed,
    tests,
    excluded,
    overallStatus: 'partial-screen',
    profile: OBJECTIVE_PROFILE,
    ccmeEligible: false,
    ccmeReason: 'Only three unambiguously matched parameters; no standard CCME score is reported.',
    oxygenDeficit:
      numeric(observation.do) && observation.do >= 0
        ? Math.max(0, (100 * (5 - observation.do)) / 5)
        : null,
  };
}
export function ccme(rows, objectives) {
  if (
    !Array.isArray(rows) ||
    !rows.length ||
    rows.some((r) => !r || typeof r.site !== 'string' || !r.site.trim() || !validDate(r.date)) ||
    new Set(rows.map((r) => r.site)).size !== 1
  )
    return {
      score: null,
      status: 'insufficient-data',
      reason:
        'One declared assessment site and real calendar dates are required; unrelated sites cannot be pooled.',
    };
  const keys = Object.keys(objectives),
    tests = [];
  for (const [key, o] of Object.entries(objectives)) {
    if (
      (o.max !== undefined && (!numeric(o.max) || o.max <= 0)) ||
      (o.min !== undefined && (!numeric(o.min) || o.min <= 0)) ||
      (o.min === undefined && o.max === undefined) ||
      (o.min !== undefined && o.max !== undefined && o.min > o.max)
    )
      throw Error('Invalid objective');
    for (const row of rows)
      if (numeric(row[key]) && row[key] >= 0)
        tests.push({ key, date: row.date, excursion: excursion(row[key], o) });
  }
  const minimum =
    keys.length >= 4 &&
    keys.every(
      (k) =>
        new Set(
          tests.filter((t) => t.key === k && /^\d{4}-\d{2}-\d{2}$/.test(t.date)).map((t) => t.date),
        ).size >= 4,
    );
  if (!minimum)
    return {
      score: null,
      status: 'insufficient-data',
      reason:
        'At least four parameters, each on four distinct dates, are required by this minimum-screen implementation. CCME 2017 recommends larger panels and sampling effort.',
    };
  const fails = tests.filter((t) => t.excursion > 0),
    f1 = (100 * new Set(fails.map((t) => t.key)).size) / keys.length,
    f2 = (100 * fails.length) / tests.length,
    nse = fails.reduce((s, t) => s + t.excursion, 0) / tests.length,
    f3 = nse === Infinity ? 100 : (100 * nse) / (nse + 1);
  return {
    score: Math.max(0, 100 - Math.sqrt((f1 * f1 + f2 * f2 + f3 * f3) / 3)),
    f1,
    f2,
    f3,
    tests: tests.length,
    status: 'minimum-panel-only',
    warning:
      'Parameter selection, intended use and sampling representativeness require expert review. A short campaign is not an annual assessment.',
  };
}
export function mixLoad(v, reduction = 0, tolerance = 0.2) {
  if (
    !['qu', 'qs', 'qd', 'cu', 'cs', 'cd'].every((k) => numeric(v[k]) && v[k] >= 0) ||
    v.qu + v.qs <= 0 ||
    v.qd <= 0
  )
    throw Error('Invalid concentration or flow');
  if (!numeric(reduction) || reduction < 0 || reduction > 1)
    throw Error('Reduction must be between zero and one');
  if (!numeric(tolerance) || tolerance < 0 || tolerance > 1)
    throw Error('Tolerance must be between zero and one');
  const sourceLoad = v.qs * v.cs,
    upstreamLoad = v.qu * v.cu,
    incoming = sourceLoad + upstreamLoad,
    observed = v.qd * v.cd,
    flow = v.qu + v.qs;
  if (![sourceLoad, upstreamLoad, incoming, observed, flow].every(Number.isFinite))
    throw Error('Numerical overflow: loads and total flow must be finite');
  const flowClosure = (v.qd - flow) / flow,
    loadClosure = observed ? (observed - incoming) / observed : incoming ? Infinity : 0;
  return {
    predicted: incoming / flow,
    after: (upstreamLoad + sourceLoad * (1 - reduction)) / flow,
    sourceShare: incoming ? sourceLoad / incoming : 0,
    flowClosure,
    loadClosure: Number.isFinite(loadClosure) ? loadClosure : null,
    incomingLoad: incoming,
    observedLoad: observed,
    status:
      Math.abs(flowClosure) <= tolerance && Math.abs(loadClosure) <= tolerance
        ? 'within-screening-tolerance'
        : 'closure-failed',
    tolerance,
    note: 'Steady, well-mixed short-reach scenario. Source share refers only to measured incoming load; it does not identify an industrial emitter.',
  };
}
export function validateObservation(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v))
    return { valid: false, errors: ['Provide one observation object.'] };
  const errors = [];
  if (!validDate(v.date)) errors.push('Use a real date in YYYY-MM-DD format.');
  else if (v.date > new Date(Date.now() + 6 * 3600000).toISOString().slice(0, 10))
    errors.push('A measured observation cannot be dated in the future.');
  for (const k of ['location', 'river'])
    if (v[k] !== undefined && (typeof v[k] !== 'string' || v[k].length > 200))
      errors.push(k + ' must be a text label of at most 200 characters.');
  if (
    !numeric(v.latitude) ||
    Math.abs(v.latitude) > 90 ||
    !numeric(v.longitude) ||
    Math.abs(v.longitude) > 180
  )
    errors.push('Valid WGS84 latitude and longitude are required.');
  for (const k of ['ph', 'do', 'cod'])
    if (v[k] != null && !validParameter(k, v[k])) errors.push('Invalid ' + k + ' measurement.');
  for (const k of ['do', 'cod'])
    if (v[k] != null && v.units?.[k] !== 'mg/L') errors.push(k + ' must explicitly use mg/L.');
  if (['ph', 'do', 'cod'].every((k) => v[k] == null))
    errors.push('Provide at least one measured parameter.');
  return { valid: errors.length === 0, errors };
}
export function inferDO(model, values) {
  const unsupported = model.features.filter(
    (k) => !numeric(values[k]) || values[k] < model.ranges[k][0] || values[k] > model.ranges[k][1],
  );
  if (unsupported.length) return { status: 'outside-domain', fields: unsupported, value: null };
  const x = model.features.map((k) => values[k]);
  let value;
  if (model.kind === 'ridge')
    value =
      model.intercept +
      x.reduce(
        (s, v, i) => s + (model.coefficients[i] * (v - model.means[i])) / model.scales[i],
        0,
      );
  else if (model.kind === 'forest') {
    // scikit-learn tree inference casts predictors to float32. Preserve that
    // boundary behavior so browser and training-runtime predictions agree.
    const treeX = x.map(Math.fround);
    value =
      model.trees.reduce((sum, t) => {
        let node = 0;
        while (t.left[node] !== -1)
          node = treeX[t.feature[node]] <= t.threshold[node] ? t.left[node] : t.right[node];
        return sum + t.value[node];
      }, 0) / model.trees.length;
  } else throw Error('Unsupported model');
  value = Math.max(0, value);
  return {
    status: 'research-estimate',
    value,
    lower: Math.max(0, value - model.interval),
    upper: value + model.interval,
    note: 'Approximate calibration interval, not a safety guarantee. Obtain a calibrated DO measurement.',
  };
}
