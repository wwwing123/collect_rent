const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeVacancyBills } = require('./vacancy');

test('补出中间空缺月份，读数=前一条，各项 0，vacancy=true', () => {
  const bills = [
    { year_month: '2026-01', water_reading: 100, elec_reading: 200 },
    { year_month: '2026-04', water_reading: 130, elec_reading: 230 },
  ];
  const out = computeVacancyBills(bills, 'room1');
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], {
    room_id: 'room1', year_month: '2026-02',
    water_reading: 100, elec_reading: 200,
    water_fee: 0, elec_fee: 0, base_fee: 0,
    rent: 0, garbage_fee: 0, internet_fee: 0, total: 0, vacancy: true,
  });
  assert.equal(out[1].year_month, '2026-03');
  assert.equal(out[1].water_reading, 100);
});

test('跨年空缺：2025-12 -> 2026-02 补出 2026-01', () => {
  const bills = [
    { year_month: '2025-12', water_reading: 50, elec_reading: 60 },
    { year_month: '2026-02', water_reading: 70, elec_reading: 80 },
  ];
  const out = computeVacancyBills(bills, 'room1');
  assert.equal(out.length, 1);
  assert.equal(out[0].year_month, '2026-01');
  assert.equal(out[0].water_reading, 50);
});

test('幂等：已含 vacancy 记录则不再补', () => {
  const bills = [
    { year_month: '2026-01', water_reading: 100, elec_reading: 200 },
    { year_month: '2026-02', water_reading: 100, elec_reading: 200, vacancy: true },
    { year_month: '2026-03', water_reading: 100, elec_reading: 200, vacancy: true },
    { year_month: '2026-04', water_reading: 130, elec_reading: 230 },
  ];
  assert.equal(computeVacancyBills(bills, 'room1').length, 0);
});

test('全连续不补', () => {
  const bills = [
    { year_month: '2026-01', water_reading: 100, elec_reading: 200 },
    { year_month: '2026-02', water_reading: 110, elec_reading: 210 },
  ];
  assert.equal(computeVacancyBills(bills, 'room1').length, 0);
});

test('少于 2 条不补', () => {
  assert.equal(computeVacancyBills([], 'room1').length, 0);
  assert.equal(
    computeVacancyBills([{ year_month: '2026-01', water_reading: 1, elec_reading: 1 }], 'room1').length,
    0
  );
});

test('多段空缺都补', () => {
  const bills = [
    { year_month: '2026-01', water_reading: 100, elec_reading: 200 },
    { year_month: '2026-03', water_reading: 120, elec_reading: 220 },
    { year_month: '2026-06', water_reading: 150, elec_reading: 250 },
  ];
  const out = computeVacancyBills(bills, 'room1');
  assert.equal(out.length, 3);
  assert.deepEqual(out.map(r => r.year_month), ['2026-02', '2026-04', '2026-05']);
});

test('读数缺失时用 0 兜底', () => {
  const bills = [
    { year_month: '2026-01' },
    { year_month: '2026-03', water_reading: 10, elec_reading: 20 },
  ];
  const out = computeVacancyBills(bills, 'room1');
  assert.equal(out[0].water_reading, 0);
  assert.equal(out[0].elec_reading, 0);
});
