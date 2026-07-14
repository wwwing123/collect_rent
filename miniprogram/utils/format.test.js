import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_YEAR_MONTH,
  maxSelectableYearMonth,
  canShiftToPrev,
  canShiftToNext,
  isInRange,
} from './format.js';

test('MIN_YEAR_MONTH is 2018-01', () => {
  assert.equal(MIN_YEAR_MONTH, '2018-01');
});

test('maxSelectableYearMonth: explicit current +1 month', () => {
  assert.equal(maxSelectableYearMonth('2026-07'), '2026-08');
  assert.equal(maxSelectableYearMonth('2026-01'), '2026-02');
});

test('maxSelectableYearMonth: cross year boundary', () => {
  assert.equal(maxSelectableYearMonth('2026-12'), '2027-01');
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
  assert.equal(canShiftToNext('2026-07', '2026-07'), true);
  assert.equal(canShiftToNext('2026-01', '2026-07'), true);
});

test('isInRange: closed [min, max] boundary', () => {
  assert.equal(isInRange('2018-01', '2018-01', '2026-08'), true);
  assert.equal(isInRange('2026-08', '2018-01', '2026-08'), true);
  assert.equal(isInRange('2017-12', '2018-01', '2026-08'), false);
  assert.equal(isInRange('2026-09', '2018-01', '2026-08'), false);
  assert.equal(isInRange('2026-07', '2018-01', '2026-08'), true);
});
