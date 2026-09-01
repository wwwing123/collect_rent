import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getReceiptUserName,
  formatReceiptNo,
  formatReceiptDate,
  formatAmount,
  formatCNY,
  buildReceiptData,
  rentMonthLabel,
} from './receipt.js';

test('getReceiptUserName: 普通房间 拼接房号', () => {
  const room = { code: '101', name: 'A栋403房' };
  assert.equal(getReceiptUserName(room), '南东新村6巷92号 101 A栋403房');
});

test('getReceiptUserName: 旧屋 只用 room.name', () => {
  const room = { code: '旧屋', name: '朗枝岗170号' };
  assert.equal(getReceiptUserName(room), '朗枝岗170号');
});

test('getReceiptUserName: 普通房间 name 为空时只拼接房号', () => {
  const room = { code: '101', name: '' };
  assert.equal(getReceiptUserName(room), '南东新村6巷92号 101');
});

test('getReceiptUserName: room 为空时返回默认地址', () => {
  assert.equal(getReceiptUserName(null), '南东新村6巷92号');
});

test('formatReceiptNo: 补零到 6 位', () => {
  assert.equal(formatReceiptNo(1), '000001');
  assert.equal(formatReceiptNo(42), '000042');
  assert.equal(formatReceiptNo(123456), '123456');
  assert.equal(formatReceiptNo(1234567), '1234567');
});

test('formatReceiptDate: 中文格式 YYYY年M月D日', () => {
  const d = new Date(2026, 5, 30);
  assert.equal(formatReceiptDate(d), '2026年6月30日');
});

test('formatAmount: 保留 2 位小数', () => {
  assert.equal(formatAmount(100), '100.00');
  assert.equal(formatAmount(100.5), '100.50');
  assert.equal(formatAmount(100.567), '100.57');
  assert.equal(formatAmount(0), '0.00');
  assert.equal(formatAmount(undefined), '0.00');
  assert.equal(formatAmount(null), '0.00');
});

test('formatCNY: 整数', () => {
  assert.equal(formatCNY(0), '零圆整');
  assert.equal(formatCNY(1), '壹圆整');
  assert.equal(formatCNY(10), '壹拾圆整');
  assert.equal(formatCNY(100), '壹佰圆整');
  assert.equal(formatCNY(1000), '壹仟圆整');
  assert.equal(formatCNY(1400), '壹仟肆佰圆整');
});

test('formatCNY: 4 位数含零', () => {
  assert.equal(formatCNY(2037), '贰仟零叁拾柒圆整');
  assert.equal(formatCNY(1001), '壹仟零壹圆整');
  assert.equal(formatCNY(1010), '壹仟零壹拾圆整');
  assert.equal(formatCNY(1100), '壹仟壹佰圆整');
});

test('formatCNY: 小数（图片原样式）', () => {
  assert.equal(formatCNY(2037.5), '贰仟零叁拾柒.伍圆整');
  assert.equal(formatCNY(100.05), '壹佰.零伍圆整');
  assert.equal(formatCNY(0.5), '零.伍圆整');
  assert.equal(formatCNY(99.99), '玖拾玖.玖玖圆整');
});

test('formatCNY: 边界值', () => {
  assert.equal(formatCNY(null), '零圆整');
  assert.equal(formatCNY(undefined), '零圆整');
  assert.equal(formatCNY(NaN), '零圆整');
});

test('buildReceiptData: 完整账单（含上期）', () => {
  const room = { code: '101', name: 'A栋403房', water_unit_price: 6, elec_unit_price: 0.89 };
  const bill = {
    water_reading: 676,
    elec_reading: 11979,
    water_fee: 108,
    elec_fee: 314.17,
    rent: 1400,
    garbage_fee: 15,
    internet_fee: 0,
    total: 1837.17,
  };
  const prevBill = { water_reading: 659, elec_reading: 11627 };
  const data = buildReceiptData({ room, bill, prevBill, receiptNo: 1, today: new Date(2026, 5, 30) });
  assert.equal(data.userName, '南东新村6巷92号 101 A栋403房');
  assert.equal(data.receiptNo, '000001');
  assert.equal(data.date, '2026年6月30日');
  assert.equal(data.rows.length, 5);

  const water = data.rows[0];
  assert.equal(water.label, '水费(吨)');
  assert.equal(water.prev, '659');
  assert.equal(water.curr, '676');
  assert.equal(water.unit, '6.00');
  assert.equal(water.amount, '108.00');
  assert.equal(water.usage, '17');

  const elec = data.rows[1];
  assert.equal(elec.label, '电费(度)');
  assert.equal(elec.prev, '11627');
  assert.equal(elec.curr, '11979');
  assert.equal(elec.unit, '0.89');
  assert.equal(elec.amount, '314.17');
  assert.equal(elec.usage, '352');

  const rent = data.rows[2];
  assert.equal(rent.label, '租金(元)');
  assert.equal(rent.prev, '');
  assert.equal(rent.amount, '1400.00');

  assert.equal(data.total, '1837.00');
  assert.equal(data.totalCN, '壹仟捌佰叁拾柒圆整');
});

test('buildReceiptData: 首月（无上期）', () => {
  const room = { code: '101', name: 'X', water_unit_price: 3, elec_unit_price: 0.6 };
  const bill = {
    water_reading: 100,
    elec_reading: 2000,
    water_fee: 0,
    elec_fee: 0,
    rent: 500,
    garbage_fee: 10,
    internet_fee: 50,
    total: 560,
  };
  const data = buildReceiptData({ room, bill, prevBill: null, receiptNo: 5, today: new Date(2026, 0, 1) });
  assert.equal(data.rows[0].prev, '');
  assert.equal(data.rows[0].curr, '100');
  assert.equal(data.rows[0].unit, '3.00');
  assert.equal(data.total, '560.00');
  assert.equal(data.totalCN, '伍佰陆拾圆整');
});

test('buildReceiptData: 旧账单带小数的 total 展示时向下取整', () => {
  const room = { code: '101', name: '', water_unit_price: 3, elec_unit_price: 0.6 };
  const bill = {
    year_month: '2026-08',
    water_reading: 100, elec_reading: 2000,
    water_fee: 15.5, elec_fee: 24.99,
    rent: 500, garbage_fee: 10, internet_fee: 50,
    total: 600.49, // 存量数据未取整
  };
  const data = buildReceiptData({ room, bill, prevBill: null, receiptNo: 5, today: new Date(2026, 8, 10) });
  assert.equal(data.total, '600.00');
  assert.equal(data.totalCN, '陆佰圆整');
});

test('buildReceiptData: 账单字段缺失时安全降级', () => {
  const data = buildReceiptData({ room: null, bill: null, prevBill: null, receiptNo: 5, today: new Date(2026, 0, 1) });
  assert.equal(data.receiptNo, '000005');
  assert.equal(data.rows.every(r => r.amount === '0.00' && r.prev === '' && r.curr === '' && r.unit === ''), true);
  assert.equal(data.total, '0.00');
  assert.equal(data.totalCN, '零圆整');
});

test('rentMonthLabel: 账单月份 +1（跨年）', () => {
  assert.equal(rentMonthLabel('2026-08'), '2026年9月份房租');
  assert.equal(rentMonthLabel('2026-12'), '2027年1月份房租');
  assert.equal(rentMonthLabel('2026-11'), '2026年12月份房租');
});

test('rentMonthLabel: 账单月份缺失时返回空串', () => {
  assert.equal(rentMonthLabel(undefined), '');
  assert.equal(rentMonthLabel(null), '');
  assert.equal(rentMonthLabel(''), '');
});

test('buildReceiptData: 输出房租行月份标签（账单月+1）', () => {
  const room = { code: '101', name: '', water_unit_price: 3, elec_unit_price: 0.6 };
  const bill = {
    year_month: '2026-08',
    water_reading: 100, elec_reading: 2000,
    water_fee: 0, elec_fee: 0,
    rent: 500, garbage_fee: 10, internet_fee: 50,
    total: 560,
  };
  const data = buildReceiptData({ room, bill, prevBill: null, receiptNo: 5, today: new Date(2026, 8, 10) });
  assert.equal(data.rentMonthLabel, '2026年9月份房租');
});
