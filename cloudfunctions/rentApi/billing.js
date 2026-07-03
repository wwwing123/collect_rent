function round2(n) {
  return Math.round(n * 100) / 100;
}

function computeBill(room, prevBill, current) {
  const prevWater = prevBill ? prevBill.water_reading : (room.initial_water_reading ?? 0);
  const prevElec  = prevBill ? prevBill.elec_reading  : (room.initial_elec_reading  ?? 0);
  const baseFee = room.rent + room.garbage_fee + room.internet_fee;
  const waterUsage = Math.max(0, current.water_reading - prevWater);
  const elecUsage  = Math.max(0, current.elec_reading  - prevElec);
  const waterFee = round2(waterUsage * room.water_unit_price);
  const elecFee  = round2(elecUsage  * room.elec_unit_price);
  return {
    water_fee: waterFee,
    elec_fee:  elecFee,
    base_fee:  baseFee,
    total:     round2(baseFee + waterFee + elecFee),
  };
}

module.exports = { computeBill, round2 };
