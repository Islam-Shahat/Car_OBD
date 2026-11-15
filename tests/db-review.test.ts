import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import dtcData from '../src/data/dtc-codes.json';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXPORT_SCRIPT = join(ROOT, 'tools', 'review-dtc-export.mjs');
const IMPORT_SCRIPT = join(ROOT, 'tools', 'review-dtc-import.mjs');
const AT = '2026-11-14T12:00:00.000Z';

interface SeedRow {
  code: string;
  tier: number;
  category: string;
  descriptionEn: string;
  needsReview: boolean;
  descriptionAr: string;
}

const seedRows = (dtcData as unknown as { codes: SeedRow[] }).codes;
const tier1 = seedRows.find((row) => row.tier === 1);
const tier2 = seedRows.find((row) => row.tier === 2);
if (!tier1 || !tier2) throw new Error('The shipped seed needs one Tier 1 and one Tier 2 row');

let workDir = '';

function run(script: string, args: string[]): { status: number | null; output: string } {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return {
    status: result.status,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

function cell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), 'obd-review-'));
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe('review CSV round trip', () => {
  it('exports Tier 1 first, imports corrections into the overlay, and stays idempotent', () => {
    const seedPath = join(workDir, 'seed.json');
    const csvPath = join(workDir, 'review.csv');
    const editedPath = join(workDir, 'edited.csv');
    const overlayPath = join(workDir, 'overlay.json');

    writeFileSync(
      seedPath,
      JSON.stringify({
        source: 'OBDex',
        sourceVersion: 'test-version',
        generatedAt: '2026-11-14',
        codes: [tier2, tier1],
      }),
    );

    const exported = run(EXPORT_SCRIPT, ['--seed', seedPath, '--out', csvPath]);
    expect(exported.status).toBe(0);
    expect(exported.output).toContain('Exported 2 rows');

    const lines = readFileSync(csvPath, 'utf8')
      .replace(/^\uFEFF/, '')
      .trimEnd()
      .split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('code,tier,category,description_en,description_ar');
    expect(lines[1]?.startsWith('P0100,1,')).toBe(true);
    expect(lines[2]?.startsWith(`${tier2.code},2,`)).toBe(true);

    const corrected = [
      'code,tier,category,description_en,description_ar,causes_ar,steps_ar,reviewer',
      [
        cell(tier1.code),
        '1',
        cell(tier1.category),
        cell(tier1.descriptionEn),
        cell('وصف عربي مُراجع من الميكانيكي.'),
        cell('سبب أول | سبب ثانٍ'),
        cell('خطوة أولى | خطوة ثانية'),
        cell('م. أحمد'),
      ].join(','),
    ].join('\r\n');
    writeFileSync(editedPath, `\uFEFF${corrected}\r\n`, 'utf8');

    const imported = run(IMPORT_SCRIPT, [
      '--in',
      editedPath,
      '--seed',
      seedPath,
      '--overlay',
      overlayPath,
      '--reviewer',
      'م. أحمد',
      '--at',
      AT,
    ]);
    expect(imported.status).toBe(0);
    expect(imported.output).toContain('Applied 1 reviews');

    const overlay = JSON.parse(readFileSync(overlayPath, 'utf8')) as {
      updatedAt: string;
      reviews: Record<
        string,
        {
          descriptionAr: string;
          causesAr: string[];
          stepsAr: string[];
          reviewedBy: string;
          reviewedAt: string;
        }
      >;
    };
    expect(overlay.updatedAt).toBe(AT);
    expect(overlay.reviews[tier1.code]).toEqual({
      descriptionAr: 'وصف عربي مُراجع من الميكانيكي.',
      causesAr: ['سبب أول', 'سبب ثانٍ'],
      stepsAr: ['خطوة أولى', 'خطوة ثانية'],
      reviewedBy: 'م. أحمد',
      reviewedAt: AT,
    });

    const again = run(IMPORT_SCRIPT, [
      '--in',
      editedPath,
      '--seed',
      seedPath,
      '--overlay',
      overlayPath,
      '--reviewer',
      'م. أحمد',
      '--at',
      AT,
    ]);
    expect(again.status).toBe(0);
    const after = JSON.parse(readFileSync(overlayPath, 'utf8')) as {
      reviews: Record<string, unknown>;
    };
    expect(Object.keys(after.reviews)).toEqual([tier1.code]);
  });

  it('rejects an unknown code without writing a review', () => {
    const seedPath = join(workDir, 'small-seed.json');
    const csvPath = join(workDir, 'unknown.csv');
    const overlayPath = join(workDir, 'never-written.json');

    writeFileSync(
      seedPath,
      JSON.stringify({
        source: 'OBDex',
        sourceVersion: 'test-version',
        generatedAt: '2026-11-14',
        codes: [tier1],
      }),
    );
    writeFileSync(
      csvPath,
      'code,description_ar,causes_ar,steps_ar\r\nP9999,نص,سبب,خطوة\r\n',
      'utf8',
    );

    const result = run(IMPORT_SCRIPT, [
      '--in',
      csvPath,
      '--seed',
      seedPath,
      '--overlay',
      overlayPath,
      '--reviewer',
      'م. أحمد',
    ]);
    expect(result.status).not.toBe(0);
    expect(result.output).toContain('unknown code P9999');
    expect(() => readFileSync(overlayPath, 'utf8')).toThrow();
  });
});
