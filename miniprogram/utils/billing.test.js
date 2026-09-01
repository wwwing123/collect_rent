import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBill } from './billing.js';

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
