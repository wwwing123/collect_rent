// 空置月份补全纯函数。CommonJS，不依赖 wx-server-sdk，便于单测。

function shiftYM(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  let mm = m + delta;
  let yy = y;
  while (mm < 1) { mm += 12; yy -= 1; }
  while (mm > 12) { mm -= 12; yy += 1; }
  return `${yy}-${String(mm).padStart(2, '0')}`;
}

function nextYM(ym) {
  return shiftYM(ym, 1);
}

/**
 * 根据已有账单，计算需要补全的空置月份记录。
 * 只补「最早记录 ↔ 最近记录」之间的空缺；读数取自前一条记录（表没动）。
 * @param {Array} bills 已有账单（每条含 year_month，可选 water_reading/elec_reading）
 * @param {string} roomId
 * @returns {Array} 待插入的空置记录数组
 */
function computeVacancyBills(bills, roomId) {
  if (!Array.isArray(bills) || bills.length < 2) return [];
  const sorted = [...bills].sort((a, b) => (a.year_month < b.year_month ? -1 : a.year_month > b.year_month ? 1 : 0));
  const result = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    let cursor = nextYM(a.year_month);
    while (cursor < b.year_month) {
      result.push({
        room_id: roomId,
        year_month: cursor,
        water_reading: a.water_reading ?? 0,
        elec_reading: a.elec_reading ?? 0,
        water_fee: 0,
        elec_fee: 0,
        base_fee: 0,
        rent: 0,
        garbage_fee: 0,
        internet_fee: 0,
        total: 0,
        vacancy: true,
      });
      cursor = nextYM(cursor);
    }
  }
  return result;
}

module.exports = { computeVacancyBills, shiftYM, nextYM };
