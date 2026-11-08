import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../src/report.js';
import { SAMPLES } from '../src/demo.js';

const report = (s) => analyze({ url: s.url, status: 200, html: s.html, ms: s.ms, bytes: s.bytes });
const ids = (s) => report(s).problems.map((p) => p.id);

test('the samples use reserved example addresses, not real sites', () => {
  for (const s of SAMPLES) assert.match(new URL(s.url).hostname, /\.example$/);
});

test('the samples go from bad to good', () => {
  const counts = SAMPLES.map((s) => ids(s).length);
  assert.ok(counts[0] > counts[1] && counts[1] > counts[2], counts.join());
  assert.equal(counts[2], 0);
});

test('the old site shows the problems an owner would recognise', () => {
  for (const id of ['slow', 'noHttps', 'noViewport', 'noPhoneLink']) assert.ok(ids(SAMPLES[0]).includes(id), id);
});
