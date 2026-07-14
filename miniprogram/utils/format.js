export const MIN_YEAR_MONTH = '2018-01';

export function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftYearMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  let mm = m + delta;
  let yy = y;
  while (mm < 1) { mm += 12; yy -= 1; }
  while (mm > 12) { mm -= 12; yy += 1; }
  return `${yy}-${String(mm).padStart(2, '0')}`;
}

export function compareYearMonth(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function maxSelectableYearMonth(currentYM) {
  const ref = currentYM || currentYearMonth();
  return shiftYearMonth(ref, 1);
}

export function canShiftToPrev(ym) {
  return compareYearMonth(ym, MIN_YEAR_MONTH) > 0;
}

export function canShiftToNext(ym, currentYM) {
  return compareYearMonth(ym, maxSelectableYearMonth(currentYM)) < 0;
}

export function formatYearMonthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${y} 年 ${m} 月`;
}

export function formatMoney(n) {
  return Number(n || 0).toFixed(2);
}
