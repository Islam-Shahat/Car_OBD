import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DATA_FILES, PINNED_COMMIT, REPOSITORY, rawUrl } from './sources.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cacheDir = join(here, '.cache');

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function fetchVerified(file) {
  const target = join(cacheDir, file.name);
  if (existsSync(target)) {
    const cached = sha256(readFileSync(target));
    if (cached === file.sha256) {
      console.log(`cached  ${file.name}`);
      return;
    }
    console.warn(`stale cache for ${file.name}, downloading again`);
  }

  const url = rawUrl(file.name);
  console.log(`fetch   ${url}`);
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const actual = sha256(bytes);
  if (actual !== file.sha256) {
    throw new Error(
      `${file.name} checksum mismatch\nexpected ${file.sha256}\nactual   ${actual}\n` +
        'The pinned upstream commit changed, which must never happen. Refusing to import.',
    );
  }
  writeFileSync(target, bytes);
  console.log(`ok      ${file.name} ${bytes.length} bytes`);
}

async function main() {
  mkdirSync(cacheDir, { recursive: true });
  console.log(`Source: ${REPOSITORY}@${PINNED_COMMIT}`);
  for (const file of DATA_FILES) await fetchVerified(file);
  console.log('All upstream files match the pinned checksums.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
