import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (name) => JSON.parse(readFileSync(path.join(root, name), 'utf8'));
const manifest = read('DATA-MANIFEST.json');
let failures = 0;
for (const file of manifest.files) {
  try {
    const bytes = readFileSync(path.join(root, file.path));
    if (
      bytes.length !== file.bytes ||
      createHash('sha256').update(bytes).digest('hex') !== file.sha256
    ) {
      throw new Error('Hash or size differs');
    }
  } catch (error) {
    failures++;
    console.error(file.path + ': ' + error.message);
  }
}
for (const dataset of read('DATASETS.json')) {
  const registered = manifest.files.find((file) => file.path === dataset.path);
  if (!registered || registered.sha256 !== dataset.sha256 || registered.bytes !== dataset.bytes) {
    failures++;
    console.error('Dataset register disagrees with snapshot manifest: ' + dataset.id);
  }
}
console.log(`${manifest.files.length} frozen data/reference assets checked; ${failures} failures.`);
process.exitCode = failures ? 1 : 0;
