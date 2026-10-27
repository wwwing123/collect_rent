import { isLastDayOfMonthBeijing, formatBeijingTime } from './month-end.js';

// 月末 18:00 UTC（北京 7/31 18:00+ 次日判定为 8/1）——7 月 31 日应为 true
console.assert(isLastDayOfMonthBeijing(new Date('2026-07-31T10:00:00Z')) === true, '7月31日应为月末');
// 7 月 30 日应为 false
console.assert(isLastDayOfMonthBeijing(new Date('2026-07-30T10:00:00Z')) === false, '7月30日不是月末');
// 12 月 31 日 true
console.assert(isLastDayOfMonthBeijing(new Date('2026-12-31T10:00:00Z')) === true, '12月31日应为月末');
// 平年 2 月 28 日 true（次日 3/1）
console.assert(isLastDayOfMonthBeijing(new Date('2027-02-28T10:00:00Z')) === true, '平年2月28日应为月末');
// 闰年 2 月 28 日 false（2028 闰年，次日 2/29）
console.assert(isLastDayOfMonthBeijing(new Date('2028-02-28T10:00:00Z')) === false, '闰年2月28日不是月末');
// 闰年 2 月 29 日 true
console.assert(isLastDayOfMonthBeijing(new Date('2028-02-29T10:00:00Z')) === true, '闰年2月29日应为月末');
// UTC 边界：UTC 15:59（北京 23:59）7/30 仍是 7/30 → false
console.assert(isLastDayOfMonthBeijing(new Date('2026-07-30T15:59:00Z')) === false, '北京23:59仍按当日算');
// UTC 16:00（北京 7/31 00:00）→ 明天是 8/1 → true
console.assert(isLastDayOfMonthBeijing(new Date('2026-07-30T16:00:00Z')) === true, '北京0:00后按次日算');
// 1 月 31 日 true
console.assert(isLastDayOfMonthBeijing(new Date('2026-01-31T10:00:00Z')) === true, '1月31日应为月末');

// formatBeijingTime
console.assert(formatBeijingTime(new Date('2026-07-31T10:00:00Z')) === '2026年7月31日 18:00', 'time2 格式');
console.assert(formatBeijingTime(new Date('2026-07-31T13:00:00Z')) === '2026年7月31日 21:00', '21点格式');
console.assert(formatBeijingTime(new Date('2026-12-31T13:00:00Z')) === '2026年12月31日 21:00', '两位月份');

console.log('month-end tests passed');
