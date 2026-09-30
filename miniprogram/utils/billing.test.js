import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBill, computeUsage, sumUsage } from './billing.js';

const baseRoom = {
  rent: 500,
  water_unit_price: 3,
  elec_unit_price: 0.6,
  garbage_fee: 10,
  internet_fee: 50,
};

test('first month: no prev bill, only base fee charged', () => {
  const bill = computeBill(baseRoom, null, { water_reading: 10, elec_reading: 100 });
  assert.equal(bill.water_fee, 0);
  assert.equal(bill.elec_fee, 0);
  assert.equal(bill.base_fee, 560);
  assert.equal(bill.total, 560);
});

test('subsequent month: usage is current - prev', () => {
  const prev = { water_reading: 10, elec_reading: 100 };
  const bill = computeBill(baseRoom, prev, { water_reading: 15, elec_reading: 140 });
  assert.equal(bill.water_fee, 15);
  assert.equal(bill.elec_fee, 24);
  assert.equal(bill.base_fee, 560);
  assert.equal(bill.total, 599);
});

test('usage never negative', () => {
  const prev = { water_reading: 100, elec_reading: 2000 };
  const bill = computeBill(baseRoom, prev, { water_reading: 90, elec_reading: 1990 });
  assert.equal(bill.water_fee, 0);
  assert.equal(bill.elec_fee, 0);
});

test('rounds to 2 decimal places', () => {
  const room = { ...baseRoom, water_unit_price: 3.33 };
  const bill = computeBill(room, { water_reading: 0, elec_reading: 0 }, { water_reading: 0.1, elec_reading: 0 });
  assert.equal(bill.water_fee, 0.33);
});

test('total is floored to whole yuan', () => {
  const room = { ...baseRoom, water_unit_price: 3.33 };
  const bill = computeBill(room, { water_reading: 0, elec_reading: 0 }, { water_reading: 0.1, elec_reading: 0 });
  // 560 + 0.33 + 0 = 560.33 → 向下取整 → 560
  assert.equal(bill.total, 560);
});

test('total floors even when float noise present', () => {
  const room = { ...baseRoom, rent: 500.1, garbage_fee: 10.2, internet_fee: 50.3 };
  const bill = computeBill(room, null, { water_reading: 0, elec_reading: 0 });
  // 560.6 → 560
  assert.equal(bill.total, 560);
});

test('subsequent months chain correctly after backfill', () => {
  // No prior bill → first bill: usage = 0
  const first = computeBill(baseRoom, null, { water_reading: 100, elec_reading: 2000 });
  assert.equal(first.total, 560);
  // Second bill uses first as prev
  const second = computeBill(baseRoom, { water_reading: 100, elec_reading: 2000 }, { water_reading: 110, elec_reading: 2050 });
  assert.equal(second.water_fee, 30);
  assert.equal(second.elec_fee, 30);
});

test('computeUsage: no bill for the month means zero usage', () => {
  assert.deepEqual(computeUsage({ water_reading: 10, elec_reading: 100 }, null), { water: 0, elec: 0 });
});

test('computeUsage: first bill without prev means zero usage', () => {
  const usage = computeUsage(null, { water_reading: 10, elec_reading: 100 });
  assert.deepEqual(usage, { water: 0, elec: 0 });
});

test('computeUsage: usage is current reading minus prev reading', () => {
  const usage = computeUsage(
    { water_reading: 10, elec_reading: 100 },
    { water_reading: 17.5, elec_reading: 452 },
  );
  assert.deepEqual(usage, { water: 7.5, elec: 352 });
});

test('computeUsage: usage never negative', () => {
  const usage = computeUsage(
    { water_reading: 100, elec_reading: 2000 },
    { water_reading: 90, elec_reading: 1990 },
  );
  assert.deepEqual(usage, { water: 0, elec: 0 });
});

test('sumUsage: rooms missing a bill contribute nothing', () => {
  const usage = sumUsage([
    { prev: { water_reading: 10, elec_reading: 100 }, bill: { water_reading: 15, elec_reading: 140 } },
    { prev: { water_reading: 5, elec_reading: 50 }, bill: null },
  ]);
  assert.deepEqual(usage, { water: 5, elec: 40 });
});

test('sumUsage: adds usage across rooms', () => {
  const usage = sumUsage([
    { prev: { water_reading: 0, elec_reading: 0 }, bill: { water_reading: 12, elec_reading: 300 } },
    { prev: { water_reading: 0, elec_reading: 0 }, bill: { water_reading: 0.5, elec_reading: 45 } },
  ]);
  assert.equal(usage.water, 12.5);
  assert.equal(usage.elec, 345);
});

test('sumUsage: empty list is zero', () => {
  assert.deepEqual(sumUsage([]), { water: 0, elec: 0 });
});
