/**
 * 北京时区（UTC+8）月末判断与时间格式化。
 * 云函数运行环境为 UTC，所有时刻先加 8 小时换算成北京时间再判断。
 */

function beijingDate(now) {
  return new Date(now.getTime() + 8 * 3600 * 1000);
}

/** 北京时间的「明天」是否为 1 号 → 今天是该月最后一天 */
function isLastDayOfMonthBeijing(now) {
  const bj = beijingDate(now);
  // 用 UTC 的 getUTC* 读取偏移后的字段，避免本地时区干扰
  const tomorrow = new Date(bj.getTime() + 24 * 3600 * 1000);
  return tomorrow.getUTCDate() === 1;
}

/** 格式化为订阅消息 time 字段样式：2026年7月31日 18:00 */
function formatBeijingTime(now) {
  const bj = beijingDate(now);
  const y = bj.getUTCFullYear();
  const m = bj.getUTCMonth() + 1;
  const d = bj.getUTCDate();
  const hh = String(bj.getUTCHours()).padStart(2, '0');
  const mm = String(bj.getUTCMinutes()).padStart(2, '0');
  return `${y}年${m}月${d}日 ${hh}:${mm}`;
}

export { isLastDayOfMonthBeijing, formatBeijingTime };
