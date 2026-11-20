(function () {
  'use strict';

  const sum = values => values.reduce((total, value) => total + value, 0);
  const median = values => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  function nightFlow({ baseline, incident, after, floor, hours }) {
    const normal = median(baseline);
    const limit = normal + Math.max(floor, 3 * 1.4826 * median(baseline.map(value => Math.abs(value - normal))));
    const sustained = incident.slice(-3).every(value => value > limit);
    const eventRate = median(incident.slice(-3));
    const latestAfter = after.slice(-3);
    const repaired = sustained && latestAfter.length === 3 && latestAfter.every(value => value <= limit);
    return {
      normal, limit, sustained, repaired,
      excessLitres: sustained ? Math.max(0, eventRate - normal) * hours * 60 : 0,
      recoveryLitres: latestAfter.length === 3 && sustained ? (eventRate - median(latestAfter)) * hours * 60 : null,
      readings: [
        ...baseline.map(value => ({ phase: 'Baseline', value })),
        ...incident.map(value => ({ phase: 'Incident', value })),
        ...after.map(value => ({ phase: 'Post-action', value }))
      ]
    };
  }

  function roofReserve({ rain, demand, area, efficiency, firstFlush, capacity, existing, initial }) {
    function simulate(tankCapacity) {
      let stock = Math.min(initial, tankCapacity);
      return rain.map((rainfall, index) => {
        const captured = Math.max(0, rainfall - firstFlush) * area * efficiency / 100;
        const overflow = Math.max(0, stock + captured - tankCapacity);
        const used = Math.min(demand[index], stock + captured - overflow);
        stock = Math.max(0, stock + captured - overflow - used);
        return { day: index + 1, rainfall, captured, used, backup: demand[index] - used, overflow, stock };
      });
    }
    const rows = simulate(capacity);
    return { rows, demand: sum(demand), used: sum(rows.map(row => row.used)),
      backup: sum(rows.map(row => row.backup)), overflow: sum(rows.map(row => row.overflow)),
      previousUsed: sum(simulate(existing).map(row => row.used)) };
  }

  function irrigateWindow({ rain, et, weights, capacity, initial, trigger, budget, step, area }) {
    const rainfall = index => Math.round(rain[index]);
    const cropUse = index => Math.round(et[index]);
    let states = new Map([[`${initial},0`, { deficit: initial, water: 0, penalty: 0, rows: [] }]]);
    for (let index = 0; index < rain.length; index += 1) {
      const next = new Map();
      for (const state of states.values()) {
        const dryDeficit = Math.max(0, state.deficit + cropUse(index) - rainfall(index));
        const maxIrrigation = Math.min(dryDeficit, budget - state.water);
        for (let irrigation = 0; irrigation <= maxIrrigation; irrigation += step) {
          const deficit = Math.min(capacity, dryDeficit - irrigation);
          const unmet = Math.max(0, dryDeficit - irrigation - capacity);
          const stress = Math.max(0, deficit - trigger) + unmet;
          const water = state.water + irrigation;
          const penalty = state.penalty + stress * weights[index];
          const key = `${deficit},${water}`;
          if (next.has(key) && next.get(key).penalty <= penalty) continue;
          const row = { day: index + 1, rain: rainfall(index), et: cropUse(index), weight: weights[index], irrigation, deficit, stress };
          next.set(key, { deficit, water, penalty, rows: [...state.rows, row] });
        }
      }
      states = next;
    }
    const best = [...states.values()].sort((a, b) => a.penalty - b.penalty || a.water - b.water || a.deficit - b.deficit)[0];
    let dry = initial;
    const baselinePenalty = sum(rain.map((_, index) => {
      const need = Math.max(0, dry + cropUse(index) - rainfall(index));
      dry = Math.min(capacity, need);
      return (Math.max(0, dry - trigger) + Math.max(0, need - capacity)) * weights[index];
    }));
    return { ...best, baselinePenalty, cubicMetres: best.water * area / 1000 };
  }

  const transitions = { reported: 'assigned', assigned: 'on site', 'on site': 'restored' };

  function rankRepairs(tickets, now) {
    return tickets.map(ticket => {
      const age = Math.max(0, (ticket.closedAt ?? now) - ticket.opened);
      const score = Math.round((ticket.households * (ticket.outage === 'full' ? 1 : 0.4))
        + (ticket.alternative ? 0 : 55) + (ticket.critical ? 45 : 0) + Math.min(age, 48));
      return { ...ticket, age, score };
    }).sort((a, b) => Number(a.status === 'restored') - Number(b.status === 'restored')
      || b.score - a.score || a.opened - b.opened || a.id.localeCompare(b.id));
  }

  function advanceRepair(tickets, id, hour, note) {
    const ticket = tickets.find(item => item.id === id);
    if (!ticket || !transitions[ticket.status]) throw new Error('Choose an active report.');
    const status = transitions[ticket.status];
    const evidence = note.trim();
    if (!evidence) throw new Error('Record the assignee, visit note, or restoration check.');
    if (hour < (ticket.history.at(-1)?.hour ?? ticket.opened)) throw new Error('The action hour precedes the last event.');
    return tickets.map(item => item.id === id ? { ...item, status,
      ...(status === 'restored' ? { closedAt: hour } : {}), history: [...item.history, { hour, status, evidence }] } : item);
  }

  function shortestPaths(edges, start, stepFree, closed) {
    const distance = new Map([[start, 0]]);
    const previous = new Map();
    const pending = new Set([start, ...edges.flatMap(edge => [edge.a, edge.b])]);
    while (pending.size) {
      const node = [...pending].reduce((best, point) => (distance.get(point) ?? Infinity) < (distance.get(best) ?? Infinity) ? point : best);
      const elapsed = distance.get(node);
      if (elapsed === undefined) break;
      pending.delete(node);
      for (const edge of edges) {
        if (closed.has(edge.id) || (stepFree && !edge.stepFree)) continue;
        const neighbor = edge.a === node ? edge.b : edge.b === node ? edge.a : null;
        if (!pending.has(neighbor) || elapsed + edge.minutes >= (distance.get(neighbor) ?? Infinity)) continue;
        distance.set(neighbor, elapsed + edge.minutes);
        previous.set(neighbor, node);
      }
    }
    return { distance, path(end) {
      const path = [end];
      while (previous.has(path[0])) path.unshift(previous.get(path[0]));
      return path.join(' → ');
    } };
  }

  function floodRoute({ groups, sites, edges, closures, walk, allotment }) {
    const source = 0;
    const siteOffset = groups.length + 1;
    const sink = siteOffset + sites.length;
    const graph = Array.from({ length: sink + 1 }, () => []);
    function connect(from, to, capacity, cost) {
      const forward = { to, capacity, cost, reverse: graph[to].length };
      graph[to].push({ to: from, capacity: 0, cost: -cost, reverse: graph[from].length });
      graph[from].push(forward);
      return forward;
    }
    const closed = new Set(closures);
    const priorityCost = sum(groups.map(group => group.households)) * walk + 1;
    const siteLinks = sites.map((site, index) => {
      const slots = site.approved && site.open ? Math.floor(site.litres / allotment) : 0;
      return { site, slots, link: connect(siteOffset + index, sink, slots, 0) };
    });
    const links = [];
    groups.forEach((group, index) => {
      const groupNode = index + 1;
      connect(source, groupNode, group.households, group.stepFree ? 0 : priorityCost);
      const paths = shortestPaths(edges, group.node, group.stepFree, closed);
      siteLinks.forEach(({ site, slots }, siteIndex) => {
        const minutes = paths.distance.get(site.node);
        if (!slots || (group.stepFree && !site.stepFree) || minutes === undefined || minutes > walk) return;
        links.push({ group, site, minutes, path: paths.path(site.node),
          link: connect(groupNode, siteOffset + siteIndex, group.households, minutes) });
      });
    });
    // Successive shortest augmenting paths on the residual graph. Reverse links allow reassignment.
    for (;;) {
      const costs = graph.map(() => Infinity);
      const predecessor = graph.map(() => null);
      costs[source] = 0;
      for (let pass = 1; pass < graph.length; pass += 1) {
        let changed = false;
        graph.forEach((adjacent, from) => adjacent.forEach((edge, index) => {
          if (edge.capacity > 0 && costs[from] + edge.cost < costs[edge.to]) {
            costs[edge.to] = costs[from] + edge.cost;
            predecessor[edge.to] = { from, index };
            changed = true;
          }
        }));
        if (!changed) break;
      }
      if (!predecessor[sink]) break;
      const path = [];
      for (let node = sink; node !== source;) {
        const { from, index } = predecessor[node];
        path.push(graph[from][index]);
        node = from;
      }
      const transfer = Math.min(...path.map(edge => edge.capacity));
      for (const edge of path) {
        edge.capacity -= transfer;
        graph[edge.to][edge.reverse].capacity += transfer;
      }
    }
    const assignments = links.map(({ group, site, minutes, path, link }) => ({ group: group.name, site: site.name,
      minutes, path, households: group.households - link.capacity })).filter(row => row.households);
    const unmet = groups.map(group => ({ group: group.name, remaining: group.households
      - sum(assignments.filter(row => row.group === group.name).map(row => row.households)) }));
    return { assignments, unmet, sites: siteLinks.map(({ site, slots, link }) => ({ ...site, slots, allocated: slots - link.capacity })),
      served: sum(assignments.map(row => row.households)), total: sum(groups.map(group => group.households)) };
  }

  function washContinuity({ schools, truck, days, litresEach }) {
    const sites = schools.map(site => {
      const daily = site.students * litresEach;
      const usable = site.stockReleased ? site.stock : 0;
      const need = daily * days;
      return { ...site, daily, usable, need, delivery: 0,
        deliverable: site.stockReleased && site.deliveryOpen ? Math.max(0, Math.min(site.capacity - site.stock, need - usable)) : 0 };
    }).sort((a, b) => a.usable / a.daily - b.usable / b.daily || b.students - a.students);
    let remaining = truck;
    // Give sites with the shortest current runway one day's cover before filling the full horizon.
    for (let target = 1; target <= days; target += 1) {
      for (const site of sites) {
        const amount = Math.max(0, Math.min(remaining, site.deliverable - site.delivery, target * site.daily - site.usable - site.delivery));
        remaining -= amount;
        site.delivery += amount;
      }
    }
    for (const site of sites) {
      site.shortfall = Math.max(0, site.need - site.usable - site.delivery);
      site.baseShortfall = Math.max(0, site.need - site.usable);
    }
    return { sites, remaining, litresDelivered: truck - remaining, shortfall: sum(sites.map(site => site.shortfall)),
      pupilDays: sum(sites.map(site => (site.baseShortfall - site.shortfall) / litresEach)) };
  }

  const models = { nightFlow, roofReserve, irrigateWindow, rankRepairs, advanceRepair, floodRoute, washContinuity, transitions };
  if (typeof module === 'object' && module.exports) module.exports = models;
  else globalThis.WaterModels = models;
})();
