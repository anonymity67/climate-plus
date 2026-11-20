/** Real HTTP smoke against the loopback built-app adapter. Uses only labelled QA fixtures. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const origin = process.argv[2] || 'http://127.0.0.1:5198';
const url = new URL(origin);
if (url.hostname !== '127.0.0.1') throw Error('This smoke is loopback-only.');
const report = { origin, at: new Date().toISOString(), checks: [] };
async function call(path, { method = 'GET', body, cookie, headers = {} } = {}) {
  const response = await fetch(origin + path, {
    method,
    redirect: 'manual',
    headers: {
      ...(method === 'GET' ? {} : { origin }),
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const contentType = response.headers.get('content-type') || '';
  return {
    response,
    data: contentType.includes('application/json') ? await response.json() : await response.text(),
  };
}
function check(label, value) {
  assert.ok(value, label);
  report.checks.push(label);
}
const page = await call('/');
check(
  'Built HTML served',
  page.response.status === 200 && String(page.data).includes('Find water. Know what to check.'),
);
const meta = (await call('/api/water/meta')).data;
check(
  '20,084 original inventory records and 3 channel areas',
  meta.source.records === 20084 && meta.streamAreas.length === 3,
);
check(
  'Unauthenticated private checks rejected',
  (await call('/api/water/checks')).response.status === 401,
);
check(
  'User-supplied identity headers stripped',
  (
    await call('/api/water/checks', {
      headers: {
        'oai-authenticated-user-id': 'spoof',
        'oai-authenticated-user-email': 'spoof@example.test',
      },
    })
  ).response.status === 401,
);
const koyra = meta.areas.find((area) => area.key === 'Khulna/Koyra');
const byArea = (
  await call('/api/water/sources?' + new URLSearchParams({ area: koyra.key, limit: 7 }))
).data;
check(
  'Area search reaches inventory beyond the original presets',
  meta.areas.length === 46 &&
    koyra.count === 34 &&
    byArea.total === 34 &&
    byArea.points.length === 7,
);
check(
  'Area results preserve original inventory geography',
  byArea.points.every((p) => p.district === 'Khulna' && p.subdistrict === 'Koyra'),
);
check(
  'An unknown coverage area returns a clear 404',
  (await call('/api/water/sources?area=Unknown')).response.status === 404,
);
const { lat, lon } = meta.presets[0];
const near = await call('/api/water/nearby', {
  method: 'POST',
  body: { latitude: lat, longitude: lon, radiusKm: 5, offset: 0 },
});
check(
  'Nearby search returns results without echoing device coordinates',
  near.response.ok && near.data.points.length === 20 && !('center' in near.data),
);
check(
  'Anonymous session advertises the local test sign-in',
  (await call('/api/water/session')).data.mode === 'local',
);
const preset = meta.presets[0];
const search = (
  await call(
    '/api/water/sources?' +
      new URLSearchParams({ latitude: preset.lat, longitude: preset.lon, radiusKm: 2, limit: 3 }),
  )
).data;
check('Public bounded search is paginated', search.points.length === 3 && search.total > 3);
const sourceId = search.points[0].id;
check(
  'Encoded original plus-code resolves',
  (await call('/api/water/source?id=' + encodeURIComponent(sourceId))).data.point.id === sourceId,
);
const siteList = (await call('/api/water/sites?river=Tongi%20Khal')).data.sites;
const site = siteList.find((s) => s.name === 'u/s Ijtema Field');
assert.ok(site);
const detail = (await call('/api/water/site?id=' + site.id)).data;
check(
  'Original dated sample and partial fishery screen',
  detail.site.latest.date === '2021-07-15' &&
    detail.site.latest.do === 4.62 &&
    detail.site.latest.screening.failed === 2 &&
    detail.site.channel.gapM <= 750,
);
for (const [area, ways] of [
  ['dhaka', 2431],
  ['sylhet', 293],
  ['dacope', 2159],
]) {
  const response = await call('/api/water/streams?area=' + area);
  check(
    area + ' channel snapshot served',
    response.response.status === 200 && response.data.ways.length === ways,
  );
}
const input = {
  roofM2: 100,
  runoff: 0.8,
  tankL: 1000,
  startL: 200,
  dailyDemandL: 100,
  lossMm: 1,
  rainfallMm: [20, 0, 0, 5, 0],
};
const plan = (await call('/api/water/rainwater', { method: 'POST', body: input })).data.result;
check(
  'Server water balance conserves volume',
  input.startL + plan.totalCollectedL === plan.totalServedL + plan.totalSpillL + plan.closingL &&
    plan.totalSpillL === 740,
);
check(
  'Cross-origin mutation rejected',
  (
    await call('/api/water/rainwater', {
      method: 'POST',
      body: input,
      headers: { origin: 'https://other.example' },
    })
  ).response.status === 403,
);
const login = await call('/signin-with-chatgpt?return_to=%2F%3Fview%3Drecords');
assert.equal(login.response.status, 302);
const cookie = login.response.headers.get('set-cookie').split(';')[0];
const date = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Dhaka',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
const checkInput = {
  sourceId,
  clientId: 'v4-http-check-fixture',
  status: 'needs-check',
  visitDate: date,
  note: 'QA HTTP fixture only. No physical visit or water-safety clearance. Request current source evidence.',
};
const a = await call('/api/water/checks', { method: 'POST', body: checkInput, cookie }),
  b = await call('/api/water/checks', { method: 'POST', body: checkInput, cookie });
check(
  'Private check save and retry return one row',
  a.response.status === 201 && a.data.check.id === b.data.check.id,
);
const listed = (
  await call('/api/water/checks?sourceId=' + encodeURIComponent(sourceId), { cookie })
).data.checks;
check(
  'Saved check re-read through HTTP',
  listed.some((c) => c.id === a.data.check.id && c.note === checkInput.note),
);
check(
  'Conflicting check retry rejected',
  (
    await call('/api/water/checks', {
      method: 'POST',
      body: { ...checkInput, note: 'Changed fixture' },
      cookie,
    })
  ).response.status === 409,
);
const observation = {
  date: '2026-10-01',
  latitude: 23.8917228,
  longitude: 90.38988667,
  ph: 7,
  do: 3,
  cod: 60,
  location: 'QA fixture; no actual sample',
  river: 'Tongi Khal',
  units: { do: 'mg/L', cod: 'mg/L' },
  metadata: {
    sourceKind: 'representational',
    sourceLabel: 'HTTP QA fixture only; invented measurements',
  },
  clientId: 'v4-http-observation-fixture',
};
const o1 = await call('/api/observations', { method: 'POST', body: observation, cookie }),
  o2 = await call('/api/observations', { method: 'POST', body: observation, cookie });
check(
  'Measurement retry is idempotent',
  o1.response.status === 201 && o1.data.observation.id === o2.data.observation.id,
);
const caseInput = {
  observationId: o1.data.observation.id,
  title: 'QA fixture follow-up',
  note: 'No actual investigation or field outcome.',
  clientId: 'v4-http-case-fixture',
};
const c1 = await call('/api/cases', { method: 'POST', body: caseInput, cookie }),
  c2 = await call('/api/cases', { method: 'POST', body: caseInput, cookie });
check(
  'Case retry is idempotent',
  c1.response.status === 201 && c1.data.case.id === c2.data.case.id,
);
const history = (await call('/api/export', { cookie })).data;
check(
  'Creation audit matches saved rows',
  history.events.some((e) => e.type === 'water-check.created' && e.subjectId === a.data.check.id) &&
    history.events.filter(
      (e) => e.type === 'observation.created' && e.subjectId === o1.data.observation.id,
    ).length === 1 &&
    history.events.filter((e) => e.type === 'case.created' && e.subjectId === c1.data.case.id)
      .length === 1,
);
const seasonalInput = {
  profile: 'D',
  rainfall: 'lower',
  roofM2: 600,
  tankL: 60000,
  dailyDemandL: 2000,
};
const seasonal = await call('/api/water/rainwater/seasonal', {
  method: 'POST',
  body: seasonalInput,
});
check(
  'Seasonal plan exposes 12 months and a backup water shortfall',
  seasonal.response.ok &&
    seasonal.data.result.months.length === 12 &&
    seasonal.data.result.dryShortL > 0,
);
check(
  'Seasonal plan rejects an unknown rainfall profile',
  (
    await call('/api/water/rainwater/seasonal', {
      method: 'POST',
      body: { ...seasonalInput, profile: 'fixture-unknown' },
    })
  ).response.status === 400,
);
check(
  'Seasonal plan requires a same-origin request',
  (
    await call('/api/water/rainwater/seasonal', {
      method: 'POST',
      body: seasonalInput,
      headers: { origin: 'http://fixture.example' },
    })
  ).response.status === 403,
);
const signout = await call('/signout-with-chatgpt');
check(
  'Local sign-out clears the test cookie',
  signout.response.status === 302 &&
    signout.response.headers.get('set-cookie').includes('Max-Age=0'),
);
report.ok = true;
report.count = report.checks.length;
const output = process.argv[3];
if (output) writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
