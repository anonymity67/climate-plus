(function () {
  'use strict';

  const models = window.WaterModels;
  const stockPlan = window.WaterProjects.floodroute.scenarios.bridge;
  const numbers = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });
  const caseId = 'WARD-01-INC-001';
  const bridgeId = 'E2';
  const publicLot = 'LOT-PUBLIC-01';
  const cargoLot = 'LOT-TRUCK-01';
  const schools = window.WaterProjects.washcontinuity.scenarios.short.schools.slice(0, 3).map((school, index) => ({ ...school, id: `SCH-0${index + 1}` }));
  const actions = [
    ['Report outage', 'Caretaker', 'Open the shared incident and record the bridge observation.'],
    ['Assign repair', 'Repair coordinator', 'Assign the case to a technician while the dispatcher checks backup supply.'],
    ['Build shared plan', 'Dispatcher', 'Calculate pickup and school allocations against the same stock ledger.'],
    ['Authorize and reserve', 'Incident lead', 'Check source release and confirmed vehicle access. Freeze the plan and reserve stock.'],
    ['Dispatch orders', 'Dispatcher', 'Issue the approved version to pickup staff, schools and the tanker driver.'],
    ['Record delivery receipts', 'Site receivers', 'Reconcile planned and physically received litres at each destination.'],
    ['Log site repair', 'Technician', 'Record the repair and submit it for the local return-to-service checks.'],
    ['Authorize restoration', 'Water authority', 'Release the repaired point only after the applicable checks are recorded.'],
    ['Hand over remaining needs', 'Incident lead', 'Assign any unresolved pickup or school gaps before closing the repair handoff.']
  ];
  const authorizationStep = 3;
  const restorationStep = 7;
  const nodes = {
    'North bank': [19, 19, 'WP-01', 'North Bank pump and two household groups. The incident affects this point.'],
    'Bridge': [43, 17, 'E2', 'Bridge crossing into the clinic route. Click to see its current exercise status.'],
    'Clinic': [77, 17, 'PUP-01', 'Clinic public pickup. Verified opening stock is 440 L.'],
    'Embankment': [33, 52, 'N-04', 'Step-free bypass from North Bank to the clinic.'],
    'Market': [17, 78, 'PUP-03', 'Proposed mobile pickup point. It requires route and site verification and a tanker reservation.'],
    'School': [63, 76, 'PUP-02', 'School courtyard public pickup holds 600 L in a separate store from institutional tanks.'],
    'South lane': [67, 46, 'GRP-03', 'South Lane household group. The short link to Bridge has steps.'],
    'Temporary stand': [88, 57, 'PUP-04', 'Unapproved temporary stand. It has no eligible pickup capacity.']
  };

  const form = document.querySelector('#exercise-form');
  const stageHeading = document.querySelector('#exercise-stage');
  const stageInstruction = document.querySelector('#exercise-instruction');
  const stageList = document.querySelector('#exercise-steps');
  const stateRoot = document.querySelector('#exercise-results');
  const logRoot = document.querySelector('#exercise-log');
  const status = document.querySelector('#exercise-status');
  const alert = document.querySelector('#exercise-error');
  const button = document.querySelector('#exercise-next');
  const evidence = document.querySelector('#exercise-evidence');
  const map = document.querySelector('#exercise-map');
  const canvas = map.querySelector('canvas');
  const mapInfo = document.querySelector('#map-feature');
  const exportButton = document.querySelector('#exercise-export');
  let selectedNode = 'North bank';
  let step = 0;
  let report = null;
  let plan = null;
  let receipts = null;
  let events = [];

  function node(tag, attrs = {}, ...children) {
    const created = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) created.setAttribute(key, value);
    created.append(...children.flat());
    return created;
  }

  function config() {
    const data = new FormData(form);
    return {
      load: Number(data.get('load')), reserve: Number(data.get('reserve')), schoolFloor: Number(data.get('school-floor')),
      walk: Number(data.get('walk')), bridged: data.has('bridge'), mobileEligible: data.has('mobile'),
      sourceReleased: data.has('released'), vehicleVerified: data.has('vehicle'), short: data.has('short')
    };
  }

  function message(title, detail, data = {}) {
    events.push({ sequence: events.length + 1, hour: step + 1, incidentId: caseId, actorRole: actions[step][1], title, detail, ...data });
  }

  function householdPlan(settings, mobileLitres) {
    return models.floodRoute({ ...stockPlan, walk: settings.walk, closures: settings.bridged ? [bridgeId] : [],
      sites: [...stockPlan.sites, { name: 'Market mobile pickup', node: 'Market', litres: mobileLitres,
        approved: settings.mobileEligible, open: true, stepFree: true }] });
  }

  function buildPlan(settings) {
    if (settings.reserve > settings.load) throw new Error('Protected reserve cannot exceed the tanker load.');
    const baseline = householdPlan(settings, 0);
    const available = settings.sourceReleased && settings.vehicleVerified ? settings.load - settings.reserve : 0;
    const criteria = { schools, days: 3, litresEach: 5 };
    const eligibleNeed = models.washContinuity({ ...criteria, truck: 0 }).sites.reduce((total, site) => total + site.deliverable, 0);
    const protectedSchool = Math.min(available, settings.schoolFloor, eligibleNeed);
    const target = Math.min((baseline.total - baseline.served) * stockPlan.allotment, Math.max(0, available - protectedSchool));
    const candidate = householdPlan(settings, target);
    const mobile = (candidate.served - baseline.served) * stockPlan.allotment;
    const households = householdPlan(settings, mobile);
    const continuity = models.washContinuity({ ...criteria, truck: available - mobile });
    return { id: `${caseId}-PLAN-01`, stockLot: cargoLot, existingPublicStock: publicLot, settings, baseline, households, continuity,
      mobile, available, protectedSchool, reserved: mobile + continuity.litresDelivered };
  }

  function receive(approved) {
    const shortSite = approved.settings.short ? approved.continuity.sites.find(site => site.delivery > 0)?.id : undefined;
    const schoolReceipts = approved.continuity.sites.map(site => {
      const actual = site.id === shortSite ? Math.max(0, site.delivery - 100) : site.delivery;
      return { id: site.id, name: site.name, planned: site.delivery, actual, shortage: site.baseShortfall - actual };
    });
    const mobileActual = approved.settings.short && !shortSite ? Math.max(0, approved.mobile - 100) : approved.mobile;
    const actual = mobileActual + schoolReceipts.reduce((total, site) => total + site.actual, 0);
    return { mobileActual, schoolReceipts, actual, unreconciled: approved.reserved - actual,
      households: householdPlan(approved.settings, mobileActual) };
  }

  function drawMap() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const settings = plan?.settings ?? config();
    for (const edge of stockPlan.edges) {
      const [x1, y1] = nodes[edge.a];
      const [x2, y2] = nodes[edge.b];
      const closed = step > 0 && settings.bridged && edge.id === bridgeId;
      ctx.strokeStyle = closed ? '#a33927' : edge.stepFree ? '#52737a' : '#72634f';
      ctx.lineWidth = closed ? 3 : 2;
      ctx.setLineDash(closed ? [6, 6] : edge.stepFree ? [] : [2, 5]);
      ctx.beginPath();
      ctx.moveTo(rect.width * x1 / 100, rect.height * y1 / 100);
      ctx.lineTo(rect.width * x2 / 100, rect.height * y2 / 100);
      ctx.stroke();
    }
  }

  function mapDetails() {
    const [, , id, info] = nodes[selectedNode];
    const state = plan?.settings ?? config();
    let suffix = '';
    if (selectedNode === 'Bridge') suffix = step === 0 ? ' The outage has not yet been logged.' : state.bridged ? ' Closed in this exercise.' : ' Open in this exercise.';
    if (selectedNode === 'North bank' && report) suffix = ` Repair status is ${report.status}.`;
    if (selectedNode === 'Market' && plan) suffix = ` Planned volume ${numbers.format(plan.mobile)} L${receipts ? ` and confirmed receipt ${numbers.format(receipts.mobileActual)} L` : ''}.`;
    mapInfo.replaceChildren(node('strong', {}, `${selectedNode} · ${id}`), node('p', {}, info + suffix));
    map.querySelectorAll('button').forEach(pin => pin.setAttribute('aria-pressed', String(pin.dataset.feature === selectedNode)));
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify({ scenario: 'Synthetic tabletop exercise', incidentId: caseId, phase: step,
      repair: report, plan, receipts, events }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const file = node('a', { href: url, download: `${caseId}-exercise-log.json` });
    document.body.append(file);
    file.click();
    file.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function resultTable(caption, columns, data) {
    const id = `exercise-table-${caption.toLowerCase().replaceAll(' ', '-')}`;
    const header = node('tr', {}, columns.map(column => node('th', { scope: 'col' }, column)));
    const rows = data.map(([heading, ...values]) => {
      const cells = values.map(value => node('td', {}, String(value)));
      return node('tr', {}, node('th', { scope: 'row' }, String(heading)), cells);
    });
    const table = node('table', {}, node('caption', { id }, caption), node('thead', {}, header), node('tbody', {}, rows));
    return node('div', { class: 'table-scroll', role: 'region', tabindex: '0', 'aria-labelledby': id }, table);
  }

  function count(label, value) {
    return node('div', { class: 'metric' }, node('dt', {}, label), node('dd', {}, String(value)));
  }

  function renderResults() {
    if (!report) {
      stateRoot.replaceChildren(node('p', {}, 'Log the outage to open the shared incident card.'));
      return;
    }
    const ranked = models.rankRepairs([report], step)[0];
    const stats = [count('Repair status', ranked.status), count('Repair priority score', ranked.score)];
    if (plan) {
      const routing = receipts?.households ?? plan.households;
      stats.push(count(receipts ? 'Households with a supported pickup slot' : 'Household slots in proposed plan', `${routing.served} / ${routing.total}`),
        count('Households needing fallback', routing.total - routing.served), count(step <= authorizationStep ? 'Tanker volume proposed' : 'Tanker volume reserved in plan', `${numbers.format(plan.reserved)} L`),
        count('School water gap over three days', `${numbers.format(receipts ? receipts.schoolReceipts.reduce((total, site) => total + site.shortage, 0) : plan.continuity.shortfall)} L`));
    }
    const children = [node('h3', {}, caseId), node('dl', { class: 'metrics' }, stats)];
    if (plan) {
      const routing = receipts?.households ?? plan.households;
      const settings = plan.settings;
      const unusable = settings.sourceReleased && settings.vehicleVerified ? settings.reserve : settings.load;
      children.push(node('p', {}, `Existing public stock supports ${plan.baseline.served} of ${plan.baseline.total} household slots. The rest of the plan draws from the shared tanker load.`),
        node('p', {}, `Tanker load ${numbers.format(settings.load)} L. Held or unreleased ${numbers.format(unusable)} L. Mobile pickup ${numbers.format(plan.mobile)} L and school delivery ${numbers.format(plan.continuity.litresDelivered)} L planned. Unassigned released volume ${numbers.format(plan.available - plan.reserved)} L.`));
      if (receipts) children.push(node('p', { class: 'receipt-line' }, `${numbers.format(receipts.actual)} L confirmed at destinations. ${numbers.format(receipts.unreconciled)} L unreconciled. In this exercise pickup slots represent capacity, while collections would be counted separately by point staff.`));
      const assignments = routing.assignments.map(row => [row.group, row.site, row.households, row.minutes, row.path]);
      if (!assignments.length) assignments.push(['No eligible assignment', '—', 0, '—', '—']);
      children.push(resultTable('Household pickup slots', ['Group', 'Point', 'Slots', 'Walk (min)', 'Path'], assignments),
        resultTable('Household fallback', ['Group', 'Households awaiting fallback'], routing.unmet.map(row => [row.group, row.remaining])),
        resultTable('School dispatch and coverage', ['School', 'Opening usable stock (L)', 'Planned (L)', 'Confirmed (L)', 'Uncovered (L)'],
          plan.continuity.sites.map(site => {
            const receipt = receipts?.schoolReceipts.find(row => row.id === site.id);
            return [site.name, site.usable, site.delivery, receipt?.actual ?? 'Pending', receipt?.shortage ?? site.shortfall];
          })));
    }
    stateRoot.replaceChildren(...children);
  }

  function render() {
    const done = step === actions.length;
    stageHeading.textContent = done ? 'Exercise complete' : actions[step][0];
    stageInstruction.textContent = done ? 'Review the map, receipt variances and the handover before resetting or exporting.' : `${actions[step][1]} · ${actions[step][2]}`;
    stageList.replaceChildren(...actions.map(([name], index) => node('li', index === step ? { 'aria-current': 'step' } : {},
      node('span', { 'aria-hidden': 'true' }, index < step ? '✓' : String(index + 1)), name)));
    form.querySelector('fieldset').disabled = step > authorizationStep;
    evidence.hidden = step !== restorationStep;
    evidence.querySelector('input').required = step === restorationStep;
    exportButton.disabled = !events.length;
    button.textContent = done ? 'Exercise complete' : actions[step][0];
    button.disabled = done;
    logRoot.replaceChildren(...events.map(event => node('li', {}, node('strong', {}, `H+${event.hour} · ${event.actorRole} · ${event.title}`), node('p', {}, event.detail))));
    renderResults();
    drawMap();
    mapDetails();
  }

  map.append(...Object.entries(nodes).map(([name, [x, y, id]]) => {
    const pin = node('button', { class: 'map-pin', type: 'button', style: `--x:${x}%;--y:${y}%`, 'data-feature': name, 'aria-label': `${name}, ${id}` }, node('span', {}, name));
    pin.addEventListener('click', () => { selectedNode = name; mapDetails(); });
    return pin;
  }));

  function advance() {
    if (step === 0) {
      report = { id: 'WP-01', name: 'North Bank pump', opened: 1, households: 32, outage: 'full', alternative: false,
        critical: true, status: 'reported', history: [{ hour: 1, status: 'reported', evidence: 'DEMO-CALL-01' }] };
      message('Joint incident opened', 'Caretaker logged the failed pump. The duty board linked the bridge observation and three school stock reports to the same incident.');
    } else if (step === 1) {
      report = models.advanceRepair([report], report.id, 2, 'Assigned to technician crew A')[0];
      message('Repair assigned', 'The repair coordinator confirmed crew A. Backup supply planning can continue in parallel.');
    } else if (step === 2) {
      plan = buildPlan(config());
      message('Shared supply plan proposed', 'Pickup slots and school tanker orders were calculated from one supply ledger. No stock is deducted at proposal.', { planId: plan.id });
    } else if (step === authorizationStep) {
      const settings = config();
      if (!settings.sourceReleased || !settings.vehicleVerified) throw new Error('Reserve is blocked. Check an authorized cargo release and a verified tanker route, or escalate to the duty lead for an alternative.');
      plan = buildPlan(settings);
      message('Plan authorized and volume reserved', `${numbers.format(plan.reserved)} L reserved across pickup and schools from ${cargoLot}.`, { planId: plan.id, reservedL: plan.reserved });
    } else if (step === 4) {
      message('Pickup and tanker orders issued', 'Recipients received the approved version and its validity window in the drill. Unallocated households went to the exception list.');
    } else if (step === 5) {
      receipts = receive(plan);
      message('Physical receipts reconciled', `${numbers.format(receipts.actual)} L confirmed. ${numbers.format(receipts.unreconciled)} L held for variance review. School coverage was recalculated from receipts.`);
    } else if (step === 6) {
      report = models.advanceRepair([report], report.id, step + 1, 'Repair evidence DEMO-JOB-01 submitted')[0];
      message('Mechanical repair logged', 'Technician recorded the repair. The water point remains pending authorized return to service.');
    } else if (step === restorationStep) {
      const ref = evidence.querySelector('input').value.trim();
      if (!ref) throw new Error('Enter a simulated return-to-service approval reference.');
      report = models.advanceRepair([report], report.id, step + 1, `Authorized return-to-service evidence ${ref}`)[0];
      message('Return to service authorized', `Water authority accepted reference ${ref}. Existing distribution orders must still be reconciled.`);
    } else if (step === 8) {
      const uncovered = receipts.households.total - receipts.households.served;
      const shortage = receipts.schoolReceipts.reduce((total, site) => total + site.shortage, 0);
      message('Outstanding needs handed over', `${uncovered} households need follow-up and schools have ${numbers.format(shortage)} L of uncovered forecast need. Duty and school leads receive the next-shift cases. Capacity still requires collection confirmation.`);
    }
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (step >= actions.length) return;
    try {
      advance();
      alert.textContent = '';
      step += 1;
      render();
      status.textContent = events.at(-1).title;
      if (step === restorationStep) evidence.querySelector('input').focus();
      if (step === actions.length) exportButton.focus();
    } catch (error) {
      alert.textContent = error.message;
      alert.focus();
    }
  });
  form.addEventListener('invalid', event => {
    const settings = event.target.closest('details');
    if (settings) settings.open = true;
  }, true);
  form.addEventListener('input', () => {
    alert.textContent = '';
    if (step === authorizationStep) {
      status.textContent = 'Settings changed. Review the recalculated proposal before authorizing.';
      try { plan = buildPlan(config()); renderResults(); }
      catch { status.textContent = 'Settings changed. Correct the tanker and reserve inputs before authorizing.'; }
    }
    drawMap();
    mapDetails();
  });
  document.querySelector('#exercise-reset').addEventListener('click', () => {
    step = 0;
    report = plan = receipts = null;
    events = [];
    form.reset();
    alert.textContent = '';
    status.textContent = 'Exercise reset.';
    render();
    button.focus();
  });
  exportButton.addEventListener('click', downloadJson);
  new ResizeObserver(drawMap).observe(map);
  render();
})();
