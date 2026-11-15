/**
 * Imports the mechanic's corrected CSV into src/data/dtc-reviews.json.
 *
 * A review overlay is used instead of editing dtc-codes.json directly, so
 * re-running the upstream import never discards reviewed Arabic text. The next
 * `npm run import:dtc` merges the overlay, sets needs_review = 0 and writes
 * reviewed_by / reviewed_at into the shipped seed.
 *
 * Usage: node tools/review-dtc-import.mjs --in dtc-review.csv --reviewer "Name" [--seed path] [--overlay path]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const defaultSeedPath = join(here, '..', 'src', 'data', 'dtc-codes.json');
const defaultOverlayPath = join(here, '..', 'src', 'data', 'dtc-reviews.json');

const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

const inPath = resolve(option('--in', 'dtc-review.csv'));
const seedPath = resolve(option('--seed', defaultSeedPath));
const overlayPath = resolve(option('--overlay', defaultOverlayPath));
const reviewer = option('--reviewer', '').trim();
const reviewedAt = option('--at', new Date().toISOString());
if (!reviewer) throw new Error('Missing --reviewer "Name"; every reviewed row needs an author');
if (!existsSync(inPath)) throw new Error(`CSV not found: ${inPath}`);
if (!existsSync(seedPath)) throw new Error(`${seedPath} is missing; run npm run import:dtc first`);

const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
const known = new Map(seed.codes.map((row) => [row.code, row]));

/** Minimal RFC 4180 parser: quoted fields, doubled quotes, CRLF or LF. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') cell += char;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function splitList(value) {
  return value
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

const text = readFileSync(inPath, 'utf8').replace(/^\uFEFF/, '');
const [headerRow, ...dataRows] = parseCsv(text);
if (!headerRow) throw new Error('The CSV is empty');
const column = new Map(headerRow.map((name, index) => [name.trim(), index]));

for (const required of ['code', 'description_ar', 'causes_ar', 'steps_ar']) {
  if (!column.has(required)) throw new Error(`The CSV is missing the ${required} column`);
}

const overlay = existsSync(overlayPath)
  ? JSON.parse(readFileSync(overlayPath, 'utf8'))
  : { reviews: {} };
overlay.reviews ??= {};

let applied = 0;
const rejected = [];
for (const [index, row] of dataRows.entries()) {
  if (row.every((cell) => cell.trim() === '')) continue;
  const code = (row[column.get('code')] ?? '').trim().toUpperCase();
  const record = known.get(code);
  if (!record) {
    rejected.push(`line ${index + 2}: unknown code ${code}`);
    continue;
  }
  const descriptionAr = (row[column.get('description_ar')] ?? '').trim();
  const causesAr = splitList(row[column.get('causes_ar')] ?? '');
  const stepsAr = splitList(row[column.get('steps_ar')] ?? '');
  if (!descriptionAr) {
    rejected.push(`line ${index + 2}: ${code} has an empty description_ar`);
    continue;
  }
  overlay.reviews[code] = { descriptionAr, causesAr, stepsAr, reviewedBy: reviewer, reviewedAt };
  applied += 1;
}

if (rejected.length > 0) {
  console.error(`Rejected ${rejected.length} rows:\n${rejected.join('\n')}`);
  process.exitCode = 1;
}
if (applied === 0) throw new Error('No reviewed rows were applied');

overlay.updatedAt = reviewedAt;
writeFileSync(overlayPath, `${JSON.stringify(overlay, null, 2)}\n`, 'utf8');
console.log(`Applied ${applied} reviews from ${inPath} to ${overlayPath}`);
console.log('Run npm run import:dtc to rebuild src/data/dtc-codes.json with needs_review = 0.');
