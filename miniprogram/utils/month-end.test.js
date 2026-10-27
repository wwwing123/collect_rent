import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLastDayOfMonthBeijing, formatBeijingTime } from './month-end.js';

test('7月31日是月末（10:00 UTC = 北京 18:00，次日为 8/1）', () => {
  assert.equal(isLastDayOfMonthBeijing(new Date('2026-07-31T10:00:00Z')), true);
});

test('7月30日不是月末', () => {
  assert.equal(isLastDayOfMonthBeijing(new Date('2026-07-30T10:00:00Z')), false);
});

test('12月31日是月末', () => {
  assert.equal(isLastDayOfMonthBeijing(new Date('2026-12-31T10:00:00Z')), true);
});

test('1月31日是月末', () => {
  assert.equal(isLastDayOfMonthBeijing(new Date('2026-01-31T10:00:00Z')), true);
});

test('平年2月28日是月末（2027 次日为 3/1）', () => {
  assert.equal(isLastDayOfMonthBeijing(new Date('2027-02-28T10:00:00Z')), true);
});

test('闰年2月28日不是月末（2028 闰年，次日为 2/29）', () => {
  assert.equal(isLastDayOfMonthBeijing(new Date('2028-02-28T10:00:00Z')), false);
});

test('闰年2月29日是月末', () => {
  assert.equal(isLastDayOfMonthBeijing(new Date('2028-02-29T10:00:00Z')), true);
});

test('UTC 边界：UTC 15:59（北京 7/30 23:59）仍按当日算，不是月末', () => {
  assert.equal(isLastDayOfMonthBeijing(new Date('2026-07-30T15:59:00Z')), false);
});

test('UTC 边界：UTC 16:00（北京 7/31 00:00）按次日算，7/31 判定为月末', () => {
  assert.equal(isLastDayOfMonthBeijing(new Date('2026-07-30T16:00:00Z')), true);
});

test('4月30日是月末（30天月份）', () => {
  assert.equal(isLastDayOfMonthBeijing(new Date('2026-04-30T10:00:00Z')), true);
});

test('formatBeijingTime：time2 格式（北京 18:00）', () => {
  assert.equal(formatBeijingTime(new Date('2026-07-31T10:00:00Z')), '2026年7月31日 18:00');
});

test('formatBeijingTime：21 点格式', () => {
  assert.equal(formatBeijingTime(new Date('2026-07-31T13:00:00Z')), '2026年7月31日 21:00');
});

test('formatBeijingTime：两位月份', () => {
  assert.equal(formatBeijingTime(new Date('2026-12-31T13:00:00Z')), '2026年12月31日 21:00');
});
