// Run with: node --test test/*.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../tools/speed-converter.js');
const dart = require('./dart-vectors.json');

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('unit factors agree with the app (run on its Dart code)', () => {
  for (const v of dart.factors) {
    close(S.convert(v.mps, 'ms', 'kmh'), v.kmh, 1e-9);
    close(S.convert(v.mps, 'ms', 'mph'), v.mph, 1e-9);
    close(S.convert(v.mps, 'ms', 'kn'), v.kn, 1e-9);
  }
});

test('known conversions', () => {
  close(S.convert(100, 'kmh', 'mph'), 62.1371, 1e-4);
  close(S.convert(60, 'mph', 'kmh'), 96.56064, 1e-9);
  close(S.convert(1, 'kn', 'kmh'), 1.852, 1e-12);
  close(S.convert(1, 'kn', 'mph'), 1.15078, 1e-5);
  close(S.convert(10, 'ms', 'kmh'), 36, 1e-12);
  close(S.convert(100, 'kmh', 'ms'), 27.7778, 1e-4);
  close(S.convert(0, 'mph', 'kn'), 0, 1e-12);
  for (const from of ['kmh', 'mph', 'kn', 'ms']) {
    for (const to of ['kmh', 'mph', 'kn', 'ms']) close(S.convert(S.convert(73.2, from, to), to, from), 73.2, 1e-9);
  }
});

test('parsing accepts decimal commas and rejects junk', () => {
  assert.strictEqual(S.parseSpeed('55'), 55);
  assert.strictEqual(S.parseSpeed('55,5'), 55.5);
  assert.strictEqual(S.parseSpeed(' 55.5 '), 55.5);
  assert.strictEqual(S.parseSpeed('.5'), 0.5);
  assert.strictEqual(S.parseSpeed(''), null);
  assert.strictEqual(S.parseSpeed('-5'), null);
  assert.strictEqual(S.parseSpeed('abc'), null);
  assert.strictEqual(S.parseSpeed('1e3'), null);
  assert.strictEqual(S.fmt(62.1371), '62.14');
  assert.strictEqual(S.fmt(36), '36');
  assert.strictEqual(S.fmt(53.996), '54');
});

test('UN R39 maximum matches the table in the accuracy guide', () => {
  close(S.r39MaxIndicatedKmh(50), 59);
  close(S.r39MaxIndicatedKmh(100), 114);
  const mph = S.convert(S.r39MaxIndicatedKmh(S.convert(60, 'mph', 'kmh')), 'kmh', 'mph');
  assert.strictEqual(mph.toFixed(1), '68.5');
  const html = fs.readFileSync(path.join(__dirname, '../guides/gps-speedometer-accuracy.html'), 'utf8');
  assert.ok(html.includes('<td>50 km/h</td><td>52 to 54 km/h</td><td>59 km/h</td>'));
  assert.ok(html.includes('<td>100 km/h</td><td>103 to 106 km/h</td><td>114 km/h</td>'));
  assert.ok(html.includes('<td>60 mph</td><td>62 to 64 mph</td><td>68.5 mph</td>'));
});

test('the 4 km/h in R39 is converted, not read as 4 mph', () => {
  const r = S.compare(70, 67, 'mph');
  const wrong = 1.1 * 67 + 4;
  assert.strictEqual(r.maxIndicated.toFixed(2), '76.19');
  assert.ok(Math.abs(r.maxIndicated - wrong) > 1);
});

test('true speed range for a compliant speedometer', () => {
  const r = S.r39TrueRangeKmh(114);
  close(r.low, 100);
  close(r.high, 114);
  assert.strictEqual(S.r39TrueRangeKmh(2).low, 0);
});

test('comparison: the worked examples on the page', () => {
  const a = S.compare(110, 105, 'kmh');
  assert.strictEqual(a.diff, 5);
  assert.strictEqual(a.percent.toFixed(1), '4.8');
  assert.strictEqual(a.maxIndicated.toFixed(1), '119.5');
  assert.strictEqual(a.factor.toFixed(3), '0.955');
  assert.strictEqual(a.status, 'over');
  const b = S.compare(70, 67, 'mph');
  assert.strictEqual(b.diff, 3);
  assert.strictEqual(b.percent.toFixed(1), '4.5');
  assert.strictEqual(b.status, 'over');
});

test('comparison: verdicts', () => {
  assert.strictEqual(S.compare(100, 100, 'kmh').status, 'same');
  assert.strictEqual(S.compare(100.9, 100, 'kmh').status, 'same');     // inside GPS noise
  assert.strictEqual(S.compare(100, 100.9, 'kmh').status, 'same');
  assert.strictEqual(S.compare(100, 105, 'kmh').status, 'under');
  assert.strictEqual(S.compare(114, 100, 'kmh').status, 'over');       // exactly at the limit
  assert.strictEqual(S.compare(116, 100, 'kmh').status, 'above-limit');
  assert.strictEqual(S.compare(0, 100, 'kmh'), null);
  assert.strictEqual(S.compare(100, 0, 'kmh'), null);
  // Noise band is 1 km/h in every unit: 0.5 mph is under it, 1 mph is not.
  assert.strictEqual(S.compare(60.5, 60, 'mph').status, 'same');
  assert.strictEqual(S.compare(61, 60, 'mph').status, 'over');
});

test('every row of the table on the page is right', () => {
  const html = fs.readFileSync(path.join(__dirname, '../tools/speed-converter.html'), 'utf8');
  const rows = [...html.matchAll(/<tr><td>([\d.]+) km\/h<\/td><td>([\d.]+) mph<\/td><td>([\d.]+) kn<\/td><td>([\d.]+) m\/s<\/td><\/tr>/g)];
  assert.ok(rows.length >= 8, `found ${rows.length} rows`);
  for (const [, kmh, mph, kn, ms] of rows) {
    assert.strictEqual(S.convert(+kmh, 'kmh', 'mph').toFixed(1), mph, `${kmh} mph`);
    assert.strictEqual(S.convert(+kmh, 'kmh', 'kn').toFixed(1), kn, `${kmh} kn`);
    assert.strictEqual(S.convert(+kmh, 'kmh', 'ms').toFixed(1), ms, `${kmh} m/s`);
  }
});

test('the mph-first table on the page is right (mph-first)', () => {
  const html = fs.readFileSync(path.join(__dirname, '../tools/speed-converter.html'), 'utf8');
  const rows = [...html.matchAll(/<tr><td>([\d.]+) mph<\/td><td>([\d.]+) km\/h<\/td><td>([\d.]+) kn<\/td><td>([\d.]+) m\/s<\/td><\/tr>/g)];
  assert.ok(rows.length >= 6, `found ${rows.length} rows`);
  for (const [, mph, kmh, kn, ms] of rows) {
    assert.strictEqual(S.convert(+mph, 'mph', 'kmh').toFixed(1), kmh);
    assert.strictEqual(S.convert(+mph, 'mph', 'kn').toFixed(1), kn);
    assert.strictEqual(S.convert(+mph, 'mph', 'ms').toFixed(1), ms);
  }
});

test('other numbers quoted on the page are right', () => {
  assert.strictEqual(S.convert(4, 'kmh', 'mph').toFixed(2), '2.49');
  assert.strictEqual(S.convert(1, 'kn', 'mph').toFixed(3), '1.151');
  assert.strictEqual(S.convert(100, 'kmh', 'mph').toFixed(2), '62.14');
  assert.strictEqual(S.convert(67, 'mph', 'kmh').toFixed(1), '107.8');
  assert.strictEqual(S.convert(122.6, 'kmh', 'mph').toFixed(1), '76.2');
  assert.strictEqual((1.1 * 67 + 4).toFixed(1), '77.7');
  assert.strictEqual(S.fmt(S.convert(100, 'kmh', 'kn')), '54');
  assert.strictEqual(S.fmt(S.convert(100, 'kmh', 'ms')), '27.78');
});
