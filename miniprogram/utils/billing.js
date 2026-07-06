function round2(n) {
  return Math.round(n * 100) / 100;
}

export function computeBill(room, prevBill, current) {
  const baseFee = room.rent + room.garbage_fee + room.internet_fee;
  const waterUsage = prevBill ? Math.max(0, current.water_reading - prevBill.water_reading) : 0;
  const elecUsage  = prevBill ? Math.max(0, current.elec_reading  - prevBill.elec_reading)  : 0;
  const waterFee = round2(waterUsage * room.water_unit_price);
  const elecFee  = round2(elecUsage  * room.elec_unit_price);
  return {
    water_fee: waterFee,
    elec_fee:  elecFee,
    base_fee:  baseFee,
    total:     round2(baseFee + waterFee + elecFee),
  };
}
