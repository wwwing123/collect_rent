import { callRentApi } from '../../../utils/api.js';
import { computeBill } from '../../../utils/billing.js';
import { shiftYearMonth, formatYearMonthLabel, currentYearMonth } from '../../../utils/format.js';

Page({
  data: {
    roomId: '',
    room: null,
    yearMonth: '',
    monthLabel: '',
    waterReading: '',
    elecReading: '',
    prevWater: null,
    prevElec: null,
    initialWater: 0,
    initialElec: 0,
    breakdown: { water_fee: 0, elec_fee: 0, base_fee: 0, total: 0, water_usage: 0, elec_usage: 0, garbage_fee: 0, internet_fee: 0 },
  },

  async onLoad(options) {
    const roomId = options.roomId;
    const yearMonth = options.yearMonth || currentYearMonth();
    const rooms = (await callRentApi('getRooms')).rooms;
    const room = rooms.find(r => r._id === roomId);
    const { bill } = await callRentApi('getBill', { roomId, yearMonth });
    const { prev } = await callRentApi('getPrevBill', { roomId, yearMonth });

    this.setData({
      roomId,
      room,
      yearMonth,
      monthLabel: formatYearMonthLabel(yearMonth),
      waterReading: bill?.water_reading ?? '',
      elecReading: bill?.elec_reading ?? '',
      prevWater: prev?.water_reading ?? null,
      prevElec: prev?.elec_reading ?? null,
      initialWater: room.initial_water_reading ?? 0,
      initialElec: room.initial_elec_reading ?? 0,
    });

    if (this.data.waterReading !== '' || this.data.elecReading !== '') {
      this.recalc();
    }
  },

  onReading(e) {
    const { key } = e.currentTarget.dataset;
    this.setData({ [key]: e.detail }, () => this.recalc());
  },

  recalc() {
    const { room, prevWater, prevElec, initialWater, initialElec, waterReading, elecReading } = this.data;
    if (waterReading === '' || elecReading === '') {
      this.setData({
        breakdown: { water_fee: 0, elec_fee: 0, base_fee: room.rent + room.garbage_fee + room.internet_fee, total: room.rent + room.garbage_fee + room.internet_fee, water_usage: 0, elec_usage: 0, garbage_fee: room.garbage_fee, internet_fee: room.internet_fee },
      });
      return;
    }
    const prev = (prevWater !== null) ? { water_reading: prevWater, elec_reading: prevElec } : null;
    const w = Number(waterReading);
    const e = Number(elecReading);
    const result = computeBill(room, prev, { water_reading: w, elec_reading: e });
    const waterUsage = prev ? Math.max(0, w - prevWater) : w - (initialWater || 0);
    const elecUsage  = prev ? Math.max(0, e - prevElec)  : e - (initialElec  || 0);
    this.setData({
      breakdown: {
        ...result,
        water_usage: Math.max(0, waterUsage).toFixed(2),
        elec_usage: Math.max(0, elecUsage).toFixed(2),
        garbage_fee: room.garbage_fee,
        internet_fee: room.internet_fee,
      },
    });
  },

  onPrevMonth() {
    const ym = shiftYearMonth(this.data.yearMonth, -1);
    wx.redirectTo({ url: `/pages/bill/edit/index?roomId=${this.data.roomId}&yearMonth=${ym}` });
  },

  onNextMonth() {
    const ym = shiftYearMonth(this.data.yearMonth, 1);
    wx.redirectTo({ url: `/pages/bill/edit/index?roomId=${this.data.roomId}&yearMonth=${ym}` });
  },

  async onSave() {
    const { roomId, yearMonth, waterReading, elecReading } = this.data;
    if (waterReading === '' || elecReading === '') {
      wx.showToast({ title: '请填写水/电度数', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '保存中' });
    try {
      await callRentApi('upsertBill', {
        roomId,
        yearMonth,
        water_reading: Number(waterReading),
        elec_reading: Number(elecReading),
      });
      wx.removeStorageSync('billsCache:' + yearMonth);
      wx.hideLoading();
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },
});