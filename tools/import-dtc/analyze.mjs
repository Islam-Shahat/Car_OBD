import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const dir = 'C:/Users/enges/AppData/Local/Temp/opencode/obdex/yaml';
const files = [
  'B0xxx_enriched.yaml',
  'C0xxx_enriched.yaml',
  'P0xxx_enriched.yaml',
  'P2xxx_enriched.yaml',
  'P3xxx_enriched.yaml',
  'U0xxx_enriched.yaml',
  'U3xxx_enriched.yaml',
];

const codes = [];
for (const file of files) {
  const docs = parse(readFileSync(`${dir}/${file}`, 'utf8'));
  for (const entry of docs) codes.push(entry);
}
codes.sort((a, b) => a.code.localeCompare(b.code));
console.log('total', codes.length, 'unique', new Set(codes.map((c) => c.code)).size);
const byCategory = {};
for (const c of codes) byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;
console.log('categories', byCategory);

const ranges = [
  ['P0100', 'P0199'],
  ['P0300', 'P0312'],
  ['P0420', 'P0431'],
  ['P0440', 'P0457'],
  ['P0500', 'P0559'],
  ['P0600', 'P0629'],
  ['P0641', 'P0659'],
  ['P0700', 'P0749'],
  ['U0100', 'U0199'],
];
const tier1 = codes.filter(
  (c) => ranges.some(([a, b]) => c.code >= a && c.code <= b) && /^[A-Z]\d{4}$/.test(c.code),
);
console.log('tier1 count', tier1.length);
console.log('tier1 titles:');
for (const c of tier1) console.log(`${c.code}\t${c.title.en}`);
