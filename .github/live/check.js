const { chromium } = require('playwright');
const U = 'https://aquavelle.ahnafantar.workers.dev';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const log = [];
  p.on('pageerror', (e) => log.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') log.push('CONSOLE ' + m.type() + ' ' + m.text()); });
  p.on('requestfailed', (r) => log.push('REQFAIL ' + r.url() + ' ' + (r.failure() || {}).errorText));
  p.on('response', (r) => { if (r.status() >= 400) log.push('HTTP ' + r.status() + ' ' + r.url()); });
  const tiles = { ok: 0, bad: 0 };
  p.on('response', (r) => { if (/tile\.openstreetmap/.test(r.url())) r.status() < 400 ? tiles.ok++ : tiles.bad++; });
  for (const v of ['rivers', 'hubs', 'samples', 'water']) {
    log.length = 0; tiles.ok = tiles.bad = 0;
    await p.goto(U + '/?view=' + v, { waitUntil: 'networkidle' }).catch((e) => log.push('GOTO ' + e.message));
    await p.waitForTimeout(4000);
    if (v === 'water') {
      await p.locator('select').first().selectOption({ index: 1 }).catch((e) => log.push('SEL ' + e.message));
      await p.click('text=Find sources').catch((e) => log.push('FIND ' + e.message));
      await p.waitForTimeout(3000);
      await p.click('text=Show map').catch((e) => log.push('SHOWMAP ' + e.message));
      await p.waitForTimeout(4000);
    }
    const maps = await p.evaluate(() => [...document.querySelectorAll('.leaflet-container')].map((c) => {
      const r = c.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), tileImgs: c.querySelectorAll('img.leaflet-tile-loaded').length, shapes: c.querySelectorAll('path,.leaflet-marker-icon').length };
    }));
    const el = await p.$('.leaflet-container');
    if (el) await el.scrollIntoViewIfNeeded();
    await p.screenshot({ path: 'shots/' + v + '.png' });
    console.log('=== ' + v + ' maps=' + JSON.stringify(maps) + ' osmTiles ok=' + tiles.ok + ' bad=' + tiles.bad);
    for (const l of [...new Set(log)].slice(0, 15)) console.log('   ' + l.slice(0, 300));
  }
  await b.close();
})();
