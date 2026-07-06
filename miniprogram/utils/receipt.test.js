import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getReceiptUserName,
  formatReceiptNo,
  formatReceiptDate,
  formatAmount,
  buildReceiptData,
} from './receipt.js';

test('getReceiptUserName: 普通房间 拼接前缀', () => {
  const room = { code: '101', name: 'A栋403房' };
  assert.equal(getReceiptUserName(room), '南东新村6巷92号 A栋403房');
});

test('getReceiptUserName: 旧屋 只用 room.name', () => {
  const room = { code: '旧屋', name: '朗枝岗170号' };
  assert.equal(getReceiptUserName(room), '朗枝岗170号');
});

test('getReceiptUserName: 普通房间 name 为空时只有前缀', () => {
  const room = { code: '101', name: '' };
  assert.equal(getReceiptUserName(room), '南东新村6巷92号');
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
  const d = new Date(2026, 5, 30); // 2026-06-30
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

test('buildReceiptData: 完整账单', () => {
  const room = { code: '101', name: 'A栋403房' };
  const bill = {
    water_fee: 108,
    elec_fee: 314.17,
    rent: 1400,
    garbage_fee: 15,
    internet_fee: 0,
    total: 1837.17,
  };
  const data = buildReceiptData({ room, bill, receiptNo: 1, today: new Date(2026, 5, 30) });
  assert.equal(data.userName, '南东新村6巷92号 A栋403房');
  assert.equal(data.receiptNo, '000001');
  assert.equal(data.date, '2026年6月30日');
  assert.equal(data.items.length, 5);
  assert.equal(data.items[0].label, '水费(元)');
  assert.equal(data.items[0].amount, '108.00');
  assert.equal(data.items[1].amount, '314.17');
  assert.equal(data.items[2].amount, '1400.00');
  assert.equal(data.items[3].amount, '15.00');
  assert.equal(data.items[4].amount, '0.00');
  assert.equal(data.total, '1837.17');
});

test('buildReceiptData: 账单字段缺失时安全降级', () => {
  const data = buildReceiptData({ room: { code: '101', name: 'X' }, bill: null, receiptNo: 5, today: new Date(2026, 0, 1) });
  assert.equal(data.receiptNo, '000005');
  assert.equal(data.items.every(i => i.amount === '0.00'), true);
  assert.equal(data.total, '0.00');
});
