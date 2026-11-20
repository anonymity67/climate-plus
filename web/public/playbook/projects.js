(function () {
  'use strict';

  const m = globalThis.WaterModels;
  const n = (value, digits = 0) => new Intl.NumberFormat('en', { maximumFractionDigits: digits }).format(value);
  const num = (key, label, min, max, step = 1) => ({ key, label, min, max, step });
  const series = (key, label, min, max, count, optional = false) => ({ key, label, min, max, count, optional, type: 'series' });
  const metric = (label, value, unit = '') => ({ label, value, unit });
  const table = (title, columns, rows) => ({ title, columns, rows });

  const repairs = [
    { id: 'WP-01', name: 'Market standpipe', opened: 3, households: 82, outage: 'partial', alternative: true, critical: false, status: 'reported' },
    { id: 'WP-02', name: 'East ridge handpump', opened: 9, households: 38, outage: 'full', alternative: false, critical: false, status: 'reported' },
    { id: 'WP-03', name: 'Clinic borehole', opened: 14, households: 22, outage: 'full', alternative: false, critical: true, status: 'reported' },
    { id: 'WP-04', name: 'South school tap', opened: 0, households: 31, outage: 'partial', alternative: true, critical: true, status: 'assigned' },
    { id: 'WP-05', name: 'Bridge kiosk', opened: 10, households: 54, outage: 'full', alternative: true, critical: false, status: 'reported' }
  ].map(ticket => ({ ...ticket, history: [
    { hour: ticket.opened, status: 'reported', evidence: 'Caretaker reported a service interruption.' },
    ...(ticket.status === 'assigned' ? [{ hour: 4, status: 'assigned', evidence: 'Local technician accepted the job.' }] : [])
  ] }));

  const routes = [
    { id: 'E1', a: 'North bank', b: 'Bridge', minutes: 4, stepFree: true },
    { id: 'E2', a: 'Bridge', b: 'Clinic', minutes: 5, stepFree: true },
    { id: 'E3', a: 'North bank', b: 'Embankment', minutes: 6, stepFree: true },
    { id: 'E4', a: 'Embankment', b: 'Clinic', minutes: 9, stepFree: true },
    { id: 'E5', a: 'South lane', b: 'Bridge', minutes: 3, stepFree: false },
    { id: 'E6', a: 'South lane', b: 'School', minutes: 6, stepFree: true },
    { id: 'E7', a: 'Market', b: 'School', minutes: 4, stepFree: true },
    { id: 'E8', a: 'Market', b: 'Embankment', minutes: 4, stepFree: true },
    { id: 'E9', a: 'South lane', b: 'Temporary stand', minutes: 2, stepFree: true }
  ];
  const groups = [
    { name: 'North bank · step-free', node: 'North bank', households: 18, stepFree: true },
    { name: 'North bank · general', node: 'North bank', households: 14, stepFree: false },
    { name: 'South lane · general', node: 'South lane', households: 23, stepFree: false },
    { name: 'Market · step-free', node: 'Market', households: 11, stepFree: true }
  ];
  const sites = [
    { name: 'Clinic distribution', node: 'Clinic', litres: 440, approved: true, open: true, stepFree: true },
    { name: 'School courtyard', node: 'School', litres: 600, approved: true, open: true, stepFree: true },
    { name: 'Temporary stand', node: 'Temporary stand', litres: 700, approved: false, open: true, stepFree: true }
  ];

  const schools = [
    { name: 'Canal Primary', students: 88, stock: 160, capacity: 1700, stockReleased: true, deliveryOpen: true },
    { name: 'South Bank School', students: 150, stock: 820, capacity: 2600, stockReleased: true, deliveryOpen: true },
    { name: 'Ridge Learning Centre', students: 72, stock: 140, capacity: 1200, stockReleased: true, deliveryOpen: true },
    { name: 'Char Community School', students: 90, stock: 480, capacity: 1600, stockReleased: false, deliveryOpen: true },
    { name: 'Railway Primary', students: 130, stock: 1600, capacity: 2300, stockReleased: true, deliveryOpen: false }
  ];

  const projects = {
    nightflow: {
      track: 1, name: 'NightFlow', icon: 'pulse', task: 'Find and verify hidden leaks', operator: 'Campus facilities team',
      intro: 'Turn repeated overnight meter readings into a maintenance ticket, then check whether flow returned to its usual range after the work.',
      fields: [series('baseline', 'Normal nights (L/min)', 0, 50000, [7, 21]), series('incident', 'Recent nights (L/min)', 0, 50000, [3, 14]),
        series('after', 'Post-action nights (L/min)', 0, 50000, [3, 14], true), num('floor', 'Minimum alert margin (L/min)', 0.1, 100, 0.1), num('hours', 'Comparable quiet hours', 1, 12, 0.5)],
      scenarios: {
        repair: { label: 'Successful repair', baseline: '1.8, 2.1, 2, 2, 2.2, 1.9, 2.1, 2, 2.1, 1.9, 2, 2.2, 2.1, 2', incident: '5.2, 5.9, 6.0, 6.1', after: '2.4, 2.2, 2.1', floor: 0.7, hours: 6 },
        spike: { label: 'One-night spike', baseline: '1.8, 2.1, 2, 2.2, 1.9, 2.1, 2', incident: '2.2, 7.1, 2.1', after: '', floor: 0.7, hours: 6 },
        persists: { label: 'Fault persists after action', baseline: '1.8, 2.1, 2, 2.2, 1.9, 2.1, 2', incident: '5.8, 5.9, 6.1', after: '4.2, 4.4, 4.1', floor: 0.7, hours: 6 }
      },
      run(data) {
        const out = m.nightFlow(data);
        const message = out.repaired ? 'The last three post-action readings were at or below the alert threshold. Confirm the cause and close the ticket after a site check.'
          : out.sustained ? 'Three recent readings exceeded the alert threshold. Check scheduled overnight use, then inspect the meter zone.'
            : 'Recent readings did not meet the three-night trigger. Continue observing comparable nights.';
        return { headline: out.repaired ? 'Flow returned to its normal range' : out.sustained ? 'Investigate sustained night flow' : 'Continue monitoring', message,
          metrics: [metric('Baseline median', n(out.normal, 2), 'L/min'), metric('Alert threshold', n(out.limit, 2), 'L/min'),
            metric('Estimated excess during incident', n(out.excessLitres), 'L / quiet window'),
            metric('Modeled before/after difference', out.recoveryLitres === null ? '—' : n(out.recoveryLitres), 'L / quiet window')],
          chart: { title: 'Overnight median flow', unit: 'L/min', line: out.limit, points: out.readings.map((row, i) => ({ label: `${row.phase} ${i + 1}`, value: row.value, tone: row.phase === 'Incident' ? 'alert' : row.phase === 'Post-action' ? 'teal' : 'base' })),
            legend: [['base', 'Baseline'], ['alert', 'Incident'], ['teal', 'Post-action'], ['line', 'Alert threshold']] },
          tables: [table('Meter readings', ['Reading', 'Phase', 'Flow (L/min)'], out.readings.map((row, i) => [i + 1, row.phase, row.value]))] };
      }
    },
    roofreserve: {
      track: 1, name: 'RoofReserve', icon: 'tank', task: 'Size school rainwater storage', operator: 'School facilities planner',
      intro: 'Compare two tank sizes against the same rainfall and non-potable demand. See which dry days still need backup water and when a larger tank helps.',
      fields: [series('rain', 'Daily rain (mm)', 0, 500, [3, 60]), series('demand', 'Daily approved non-potable demand (L)', 0, 1000000, [3, 60]),
        num('area', 'Roof catchment (m²)', 1, 100000), num('efficiency', 'Collection efficiency (%)', 1, 100), num('firstFlush', 'First-flush allowance per wet day (mm)', 0, 20, 0.1),
        num('existing', 'Existing tank (L)', 0, 1000000), num('capacity', 'Proposed tank (L)', 0, 1000000), num('initial', 'Starting stock per tank (L)', 0, 1000000)],
      scenarios: {
        term: { label: 'Mixed rain during term', rain: '11, 0, 0, 4, 0, 24, 1, 0, 6, 0, 0, 16, 0, 0', demand: '1010, 1010, 1010, 1010, 1010, 0, 0, 1010, 1010, 1010, 1010, 1010, 0, 0', area: 320, efficiency: 78, firstFlush: 0.8, existing: 1900, capacity: 4300, initial: 0 },
        stress: { label: 'Extended dry spell', rain: '15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2', demand: '1010, 1010, 1010, 1010, 1010, 0, 0, 1010, 1010, 1010, 1010, 1010', area: 320, efficiency: 78, firstFlush: 0.8, existing: 1900, capacity: 4300, initial: 0 }
      },
      run(data) {
        if (data.rain.length !== data.demand.length) throw new Error('Rain and demand must have the same number of daily values.');
        if (data.initial > Math.min(data.capacity, data.existing)) throw new Error('Starting stock must fit both tanks for a fair comparison.');
        const out = m.roofReserve(data);
        const coverage = out.demand ? n(100 * out.used / out.demand, 1) + '%' : '—';
        return { headline: `${n(out.used)} L of modeled reuse`, message: 'Review the dry-day shortfall and overflow together. Test a full year of local rainfall before selecting a tank.',
          metrics: [metric('Demand met by rainwater', coverage), metric('Change versus existing tank', n(out.used - out.previousUsed), 'L'), metric('Backup water required', n(out.backup), 'L'), metric('Tank overflow', n(out.overflow), 'L')],
          chart: { title: 'Water in proposed tank at day end', unit: 'L', points: out.rows.map(row => ({ label: `Day ${row.day}`, value: row.stock, tone: row.backup > 0 ? 'alert' : 'teal' })), legend: [['teal', 'Demand covered or zero'], ['alert', 'Backup needed']] },
          tables: [table('Daily mass balance (litres unless shown)', ['Day', 'Rain (mm)', 'Captured', 'Supplied', 'Backup', 'Overflow', 'End stock'], out.rows.map(row => [row.day, row.rainfall, ...[row.captured, row.used, row.backup, row.overflow, row.stock].map(value => Number(value.toFixed(2)))]))] };
      }
    },
    irrigatewindow: {
      track: 1, name: 'IrrigateWindow', icon: 'field', task: 'Budget irrigation by crop stage', operator: 'Grower or irrigation advisor',
      intro: 'Test when to irrigate under a fixed water allowance. The planner protects higher-priority crop days using explicit soil, rain and crop-demand assumptions.',
      fields: [series('rain', 'Daily effective rain (whole mm)', 0, 100, [3, 14]), series('et', 'Daily crop water demand (whole mm)', 0, 25, [3, 14]), series('weights', 'Daily crop-stage weights (1–5)', 1, 5, [3, 14]),
        num('area', 'Field area (m²)', 1, 1000000), num('capacity', 'Root-zone available water (mm)', 5, 100), num('initial', 'Starting depletion (mm)', 0, 100),
        num('trigger', 'Stress threshold (mm)', 0, 100), num('budget', 'Net irrigation allowance (mm)', 0, 100), num('step', 'Application increment (mm)', 2, 10)],
      scenarios: {
        flowering: { label: 'Dry flowering window', rain: '0, 0, 0, 0, 9, 1, 0, 0', et: '4, 5, 6, 6, 5, 5, 4, 4', weights: '1, 2, 5, 5, 4, 2, 1, 1', area: 1800, capacity: 45, initial: 12, trigger: 18, budget: 18, step: 3 },
        rainy: { label: 'Rain arrives early', rain: '0, 16, 3, 0, 2, 0, 0, 0', et: '4, 5, 6, 6, 5, 5, 4, 4', weights: '1, 2, 5, 5, 4, 2, 1, 1', area: 1800, capacity: 45, initial: 12, trigger: 18, budget: 18, step: 3 }
      },
      run(data) {
        if (data.rain.length !== data.et.length || data.rain.length !== data.weights.length) throw new Error('Rain, crop demand and weights must cover the same days.');
        if ([...data.rain, ...data.et, ...data.weights].some(value => !Number.isInteger(value))) throw new Error('Use whole numbers in the daily series.');
        if (data.initial > data.capacity || data.trigger > data.capacity) throw new Error('Starting depletion and the stress threshold must fit within root-zone available water.');
        const out = m.irrigateWindow(data);
        const events = out.rows.filter(row => row.irrigation).length;
        return { headline: events ? `Irrigate on ${events} of ${out.rows.length} days` : 'No irrigation scheduled',
          message: events ? 'Recheck the plan each day using updated rain and field readings. Scheduled depth is net water reaching the root zone.' : 'Current inputs and allowance produced no application. Check the stress score and remaining allowance before acting.',
          metrics: [metric('Net application', n(out.water), 'mm'), metric('Root-zone water', n(out.cubicMetres, 2), 'm³'), metric('Unused allowance', n(data.budget - out.water), 'mm'), metric('Weighted stress index', `${n(out.penalty)} / ${n(out.baselinePenalty)}`, 'plan / no irrigation')],
          chart: { title: 'End-of-day root-zone depletion', unit: 'mm', line: data.trigger, points: out.rows.map(row => ({ label: `Day ${row.day}`, value: row.deficit, tone: row.irrigation ? 'teal' : 'base' })), legend: [['base', 'No application'], ['teal', 'Irrigation applied'], ['line', 'Stress threshold']] },
          tables: [table('Field plan', ['Day', 'Rain (mm)', 'Demand (mm)', 'Crop-stage weight', 'Irrigate (mm)', 'Depletion (mm)', 'Stress (mm)'], out.rows.map(row => [row.day, row.rain, row.et, row.weight, row.irrigation, row.deficit, row.stress]))] };
      }
    },
    servicerelay: {
      track: 3, name: 'ServiceRelay', icon: 'relay', task: 'Prioritize rural water-point repairs', operator: 'Rural maintenance coordinator',
      intro: 'Rank outages by service impact, alternate access, critical users and age. Log assignment, site visit and restoration evidence locally.',
      fields: [num('now', 'Incident clock (hour)', 0, 8760)],
      scenarios: { district: { label: 'District repair queue', now: 24, tickets: repairs }, later: { label: 'Queue after 48 more hours', now: 72, tickets: repairs } },
      run(data) {
        const rows = m.rankRepairs(data.tickets, data.now);
        const open = rows.filter(row => row.status !== 'restored');
        const noAlternative = open.filter(row => !row.alternative).reduce((acc, row) => acc + row.households, 0);
        return { headline: open.length ? `Review ${open[0].name} first` : 'All demo reports restored',
          message: 'The queue is a dispatch aid. A coordinator checks the report, assigns the repair and records the applicable return-to-service check.',
          metrics: [metric('Active reports', n(open.length)), metric('Households without an alternate point', n(noAlternative)), metric('Longest active outage', n(Math.max(0, ...open.map(row => row.age))), 'hours'), metric('Logged restorations', n(rows.length - open.length))],
          chart: { title: 'Dispatch priority of open reports', unit: 'points', points: open.map(row => ({ label: row.name, value: row.score, tone: row.alternative ? 'base' : 'teal' })), legend: [['teal', 'No alternate point'], ['base', 'Alternate point reported']] },
          tables: [table('Ranked repair queue', ['Water point', 'Status', 'Households', 'Outage', 'Alternate', 'Critical', 'Age (h)', 'Priority'], rows.map(row => [row.name, row.status, row.households, row.outage, row.alternative ? 'Yes' : 'No', row.critical ? 'Yes' : 'No', row.age, row.score])),
            table('Repair activity log', ['Water point', 'Hour', 'Action', 'Evidence'], rows.flatMap(row => row.history.map(event => [row.name, event.hour, event.status, event.evidence])))] };
      }
    },
    floodroute: {
      track: 3, name: 'FloodRoute', icon: 'route', task: 'Allocate water pickup after flooding', operator: 'Emergency WASH coordinator',
      intro: 'Allocate household pickup slots across approved sites while accounting for verified closures, available stock and step-free access.',
      fields: [num('walk', 'Maximum one-way walk (min)', 1, 120), num('allotment', 'Planning allotment per household (L)', 1, 500)],
      scenarios: {
        bridge: { label: 'Bridge closed', walk: 16, allotment: 20, closures: ['E2'], groups, sites, edges: routes },
        reopen: { label: 'Bridge cleared', walk: 16, allotment: 20, closures: [], groups, sites, edges: routes },
        resupply: { label: 'Clinic resupplied', walk: 16, allotment: 20, closures: ['E2'], groups, sites: sites.map(site => site.node === 'Clinic' ? { ...site, litres: 800 } : site), edges: routes }
      },
      run(data) {
        const out = m.floodRoute(data);
        const missing = out.total - out.served;
        return { headline: missing ? `${n(missing)} households need a fallback` : 'Every household has a pickup allocation',
          message: missing ? 'Review unallocated groups for an accessible delivery or mobile point. Confirm access and supply with field staff before dispatch.' : 'Confirm route conditions and point stock with field staff before sharing allocations.',
          metrics: [metric('Households allocated', `${n(out.served)} / ${n(out.total)}`), metric('Water committed', n(out.served * data.allotment), 'L'),
            metric('Longest assigned walk', out.served ? n(Math.max(...out.assignments.map(row => row.minutes))) : '—', 'min'), metric('Routes closed in scenario', n(data.closures.length))],
          chart: { title: 'Pickup slots used by eligible site', unit: 'households', points: out.sites.filter(site => site.approved && site.open).map(site => ({ label: site.name, value: site.allocated, tone: 'teal' })) },
          tables: [table('Pickup assignments', ['Household group', 'Site', 'Households', 'Walk (min)', 'Path'], out.assignments.map(row => [row.group, row.site, row.households, row.minutes, row.path])),
            table('Fallback list by group', ['Household group', 'Unallocated households'], out.unmet.map(row => [row.group, row.remaining])),
            table('Site capacity', ['Site', 'Approval', 'Released stock (L)', 'Eligible slots', 'Allocated'], out.sites.map(site => [site.name, site.approved ? (site.open ? 'Approved and open' : 'Closed') : 'Excluded: unapproved', site.approved && site.open ? site.litres : '—', site.slots, site.allocated]))] };
      }
    },
    washcontinuity: {
      track: 3, name: 'WASH Continuity', icon: 'supply', task: 'Keep school WASH water available', operator: 'District school WASH manager',
      intro: 'Use a limited tanker load to stretch water service across schools until their next supply. Flag storage and access constraints for manual follow-up.',
      fields: [num('truck', 'Available tanker load (L)', 0, 50000), num('days', 'School days to bridge', 1, 15), num('litresEach', 'Local WASH demand (L / pupil / day)', 1, 50, 0.5)],
      scenarios: {
        short: { label: 'Shortened supply window', truck: 2700, days: 3, litresEach: 5, schools },
        extended: { label: 'Five-day outage', truck: 2700, days: 5, litresEach: 5, schools },
        access: { label: 'Storage released and road open', truck: 4300, days: 3, litresEach: 5, schools: schools.map(site => ({ ...site, stockReleased: true, deliveryOpen: true })) }
      },
      run(data) {
        const out = m.washContinuity(data);
        return { headline: `${n(out.litresDelivered)} L scheduled for delivery`,
          message: 'Follow up with any school whose stock is on hold, route is closed or demand remains uncovered. This model tracks water volume for WASH services.',
          metrics: [metric('Pupil-days of modeled water demand covered by tanker', n(out.pupilDays, 1)), metric('Remaining water shortfall', n(out.shortfall), 'L'),
            metric('Tanker load unassigned', n(out.remaining), 'L'), metric('Sites receiving water', n(out.sites.filter(site => site.delivery > 0).length))],
          chart: { title: 'Uncovered water demand after delivery', unit: 'L', points: out.sites.map(site => ({ label: site.name, value: site.shortfall, tone: site.stockReleased && site.deliveryOpen ? 'base' : 'alert' })), legend: [['base', 'Delivery eligible'], ['alert', 'Storage or route constraint']] },
          tables: [table('School dispatch plan', ['School', 'Pupils', 'Usable stock (L)', 'Need (L)', 'Tanker (L)', 'Shortfall (L)', 'Constraint'], out.sites.map(site => [site.name, site.students, site.usable, site.need, site.delivery, site.shortfall, !site.stockReleased ? 'Stock on hold' : !site.deliveryOpen ? 'Delivery route closed' : '—']))] };
      }
    }
  };

  globalThis.WaterProjects = projects;
})();
