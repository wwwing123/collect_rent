const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeBill } = require('./billing');

const baseRoom = {
  rent: 500,
  water_unit_price: 3,
  elec_unit_price: 0.6,
  garbage_fee: 10,
  internet_fee: 50,
};

test('云函数 computeBill: total 向下取整到元', () => {
  const room = { ...baseRoom, water_unit_price: 3.33 };
  const bill = computeBill(room, { water_reading: 0, elec_reading: 0 }, { water_reading: 0.1, elec_reading: 0 });
  // 560 + 0.33 + 0 = 560.33 → 560
  assert.equal(bill.total, 560);
});

test('云函数 computeBill: total 为整数时保持不变', () => {
  const bill = computeBill(baseRoom, { water_reading: 10, elec_reading: 100 }, { water_reading: 15, elec_reading: 140 });
  // 560 + 15 + 24 = 599
  assert.equal(bill.total, 599);
});
