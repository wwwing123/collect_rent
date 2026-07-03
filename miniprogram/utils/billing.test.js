import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBill } from './billing.js';

const baseRoom = {
  rent: 500,
  water_unit_price: 3,
  elec_unit_price: 0.6,
  garbage_fee: 10,
  internet_fee: 50,
  initial_water_reading: 0,
  initial_elec_reading: 0,
};

test('first month: usage is current - initial, fees calculated', () => {
  const bill = computeBill(baseRoom, null, { water_reading: 10, elec_reading: 100 });
  assert.equal(bill.water_fee, 30);     // 10 * 3
  assert.equal(bill.elec_fee, 60);      // 100 * 0.6
  assert.equal(bill.base_fee, 560);     // 500 + 10 + 50
  assert.equal(bill.total, 650);
});

test('subsequent month: usage is current - prev', () => {
  const prev = { water_reading: 10, elec_reading: 100 };
  const bill = computeBill(baseRoom, prev, { water_reading: 15, elec_reading: 140 });
  assert.equal(bill.water_fee, 15);     // 5 * 3
  assert.equal(bill.elec_fee, 24);      // 40 * 0.6
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
  const bill = computeBill(room, null, { water_reading: 0.1, elec_reading: 0 });
  assert.equal(bill.water_fee, 0.33); // 0.1 * 3.33 = 0.333 -> rounded
});

test('uses initial reading when no prev bill', () => {
  const room = { ...baseRoom, initial_water_reading: 1000 };
  const bill = computeBill(room, null, { water_reading: 1010, elec_reading: 0 });
  assert.equal(bill.water_fee, 30);    // 10 * 3
});
