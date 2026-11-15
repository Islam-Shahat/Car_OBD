/**
 * Exports every needs_review row of src/data/dtc-codes.json to CSV, Tier 1
 * first. The mechanic edits description_ar / causes_ar / steps_ar and sends the
 * file back; tools/review-dtc-import.mjs applies it.
 *
 * Usage: node tools/review-dtc-export.mjs [--out dtc-review.csv] [--tier 1|2] [--seed path]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const defaultSeedPath = join(here, '..', 'src', 'data', 'dtc-codes.json');

const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

const outPath = resolve(option('--out', 'dtc-review.csv'));
const seedPath = resolve(option('--seed', defaultSeedPath));
const tier = option('--tier', '');
if (tier && tier !== '1' && tier !== '2') {
  throw new Error('--tier must be 1 or 2');
}
if (!existsSync(seedPath)) {
  throw new Error(`${seedPath} is missing; run npm run import:dtc first`);
}

const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
const rows = seed.codes
  .filter((row) => row.needsReview && (!tier || String(row.tier) === tier))
  .sort((left, right) => left.tier - right.tier || left.code.localeCompare(right.code));

const HEADER = [
  'code',
  'tier',
  'category',
  'description_en',
  'description_ar',
  'causes_ar',
  'steps_ar',
  'reviewer',
];

function cell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const lines = [HEADER.join(',')];
for (const row of rows) {
  lines.push(
    [
      row.code,
      row.tier,
      row.category,
      row.descriptionEn,
      row.descriptionAr,
      row.causesAr.join(' | '),
      row.stepsAr.join(' | '),
      '',
    ]
      .map(cell)
      .join(','),
  );
}

writeFileSync(outPath, `\uFEFF${lines.join('\r\n')}\r\n`, 'utf8');
console.log(`Exported ${rows.length} rows awaiting review to ${outPath}`);
console.log(`Tier 1: ${rows.filter((row) => row.tier === 1).length}`);
console.log(`Tier 2: ${rows.filter((row) => row.tier === 2).length}`);
console.log('Edit the Arabic columns, fill reviewer, then run npm run review:import.');
