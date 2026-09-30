import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_YEAR_MONTH,
  maxSelectableYearMonth,
  canShiftToPrev,
  canShiftToNext,
  isInRange,
  formatUsage,
} from './format.js';

test('MIN_YEAR_MONTH is 2018-01', () => {
  assert.equal(MIN_YEAR_MONTH, '2018-01');
});

test('maxSelectableYearMonth: caps at current month', () => {
  assert.equal(maxSelectableYearMonth('2026-07'), '2026-07');
  assert.equal(maxSelectableYearMonth('2026-01'), '2026-01');
});

test('maxSelectableYearMonth: caps across year boundary', () => {
  assert.equal(maxSelectableYearMonth('2026-12'), '2026-12');
});

test('canShiftToPrev: false at MIN_YEAR_MONTH, true after', () => {
  assert.equal(canShiftToPrev('2018-01'), false);
  assert.equal(canShiftToPrev('2017-12'), false);
  assert.equal(canShiftToPrev('2018-02'), true);
  assert.equal(canShiftToPrev('2026-07'), true);
});

test('canShiftToNext: false at max, true before', () => {
  assert.equal(canShiftToNext('2026-08', '2026-07'), false);
  assert.equal(canShiftToNext('2026-09', '2026-07'), false);
  assert.equal(canShiftToNext('2026-07', '2026-07'), false);
  assert.equal(canShiftToNext('2026-01', '2026-07'), true);
});

test('isInRange: closed [min, max] boundary', () => {
  assert.equal(isInRange('2018-01', '2018-01', '2026-08'), true);
  assert.equal(isInRange('2026-08', '2018-01', '2026-08'), true);
  assert.equal(isInRange('2017-12', '2018-01', '2026-08'), false);
  assert.equal(isInRange('2026-09', '2018-01', '2026-08'), false);
  assert.equal(isInRange('2026-07', '2018-01', '2026-08'), true);
});

test('formatUsage: keeps at most 2 decimals, drops trailing zeros', () => {
  assert.equal(formatUsage(12), '12');
  assert.equal(formatUsage(12.3), '12.3');
  assert.equal(formatUsage(12.345), '12.35');
  assert.equal(formatUsage(12.3449), '12.34');
});

test('formatUsage: absorbs float noise from summing rooms', () => {
  assert.equal(formatUsage(12.3 + 0.1), '12.4');
});

test('formatUsage: missing reading shows 0', () => {
  assert.equal(formatUsage(undefined), '0');
  assert.equal(formatUsage(null), '0');
  assert.equal(formatUsage(NaN), '0');
});
