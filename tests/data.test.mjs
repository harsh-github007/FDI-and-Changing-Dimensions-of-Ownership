import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCSV, summary, likert } from '../assets/data.js';

const load = f => parseCSV(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'));

test('parses quoted fields and numbers', () => {
  const rows = parseCSV('a,b,c\n"x, y",2,"say ""hi"""\n');
  assert.deepEqual(rows, [{ a: 'x, y', b: 2, c: 'say "hi"' }]);
});

test('every data file loads with the expected columns', () => {
  assert.equal(load('data/fdi_inflows_by_year.csv').length, 26);
  assert.equal(load('data/sector_caps.csv').length, 37);
  for (const r of load('data/sector_caps.csv')) assert.ok(r.cap_pct >= 0 && r.cap_pct <= 100, r.sector);
});

test('equity inflows never exceed total inflows', () => {
  for (const y of load('data/fdi_inflows_by_year.csv')) assert.ok(y.equity_inflow_usd_mn <= y.total_fdi_inflow_usd_mn, y.fiscal_year);
});

test('headline figures', () => {
  const s = summary({ years: load('data/fdi_inflows_by_year.csv'), net: load('data/net_fdi.csv') });
  assert.equal(s.year, '2025-26');
  assert.ok(s.record);
  assert.ok(Math.abs(s.total - 94.84) < 0.01);
  assert.ok(Math.abs(s.cumulative - 1.16) < 0.01);
});

test('each survey statement has 100 answers', () => {
  for (const r of load('survey/survey_counts.csv')) assert.equal(likert(r).n, 100, r.id);
});
