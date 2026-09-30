function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * 某个月的实用量（吨 / 度）= 本月读数 − 上月读数，负数按 0。
 * 没有本月账单则不计入；没有上月账单（首月）用量为 0。
 * @param {object|null} prevBill 本月之前最近一条账单
 * @param {object|null} bill 本月账单
 * @returns {{water: number, elec: number}}
 */
export function computeUsage(prevBill, bill) {
  if (!bill) return { water: 0, elec: 0 };
  const water = prevBill ? Math.max(0, (bill.water_reading ?? 0) - (prevBill.water_reading ?? 0)) : 0;
  const elec  = prevBill ? Math.max(0, (bill.elec_reading  ?? 0) - (prevBill.elec_reading  ?? 0))  : 0;
  return { water, elec };
}

/**
 * 汇总多间房同月的用量，形状为 [{ bill, prev }]。
 * @param {Array<{bill: object|null, prev: object|null}>} entries
 * @returns {{water: number, elec: number}}
 */
export function sumUsage(entries) {
  return (entries || []).reduce((acc, { bill, prev }) => {
    const { water, elec } = computeUsage(prev, bill);
    return { water: acc.water + water, elec: acc.elec + elec };
  }, { water: 0, elec: 0 });
}

export function computeBill(room, prevBill, current) {
  const baseFee = room.rent + room.garbage_fee + room.internet_fee;
  const { water: waterUsage, elec: elecUsage } = computeUsage(prevBill, current);
  const waterFee = round2(waterUsage * room.water_unit_price);
  const elecFee  = round2(elecUsage  * room.elec_unit_price);
  return {
    water_fee: waterFee,
    elec_fee:  elecFee,
    base_fee:  baseFee,
    total:     Math.floor(round2(baseFee + waterFee + elecFee)),
  };
}
