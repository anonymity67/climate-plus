import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
const dir = new URL('../drizzle/', import.meta.url);
const sql = readdirSync(dir)
  .filter((n) => n.endsWith('.sql'))
  .sort()
  .map((n) => readFileSync(new URL(n, dir), 'utf8'))
  .join('\n');
writeFileSync(new URL('../backend/schema.sql', import.meta.url), sql);
console.log('Test schema synchronized to the ordered, unchanged versioned migrations.');
