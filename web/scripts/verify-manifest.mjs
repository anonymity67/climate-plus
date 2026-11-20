import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(path.join(root, 'EVIDENCE-MANIFEST.json')));
let failures = 0;
for (const f of manifest.files) {
  try {
    const bytes = readFileSync(path.join(root, f.path));
    if (createHash('sha256').update(bytes).digest('hex') !== f.sha256 || bytes.length !== f.bytes) {
      console.error('MISMATCH', f.path);
      failures++;
    }
  } catch {
    console.error('MISSING', f.path);
    failures++;
  }
}
console.log(
  `${manifest.files.length - failures}/${manifest.files.length} evidence files match the manifest.`,
);
process.exitCode = failures ? 1 : 0;
