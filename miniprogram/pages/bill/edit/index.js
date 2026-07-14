import { callRentApi } from '../../../utils/api.js';
import { computeBill } from '../../../utils/billing.js';
import {
  MIN_YEAR_MONTH,
  canShiftToPrev,
  canShiftToNext,
  currentYearMonth,
  formatYearMonthLabel,
  maxSelectableYearMonth,
  shiftYearMonth,
} from '../../../utils/format.js';

Page({
  data: {
    roomId: '',
    room: null,
    yearMonth: '',
    monthLabel: '',
    minYearMonth: MIN_YEAR_MONTH,
    maxYearMonth: '',
    canPrev: true,
    canNext: true,
    waterReading: '',
    elecReading: '',
    prevWater: null,
    prevElec: null,
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
    });

    const maxYearMonth = maxSelectableYearMonth();
    this.setData({
      maxYearMonth,
      canPrev: canShiftToPrev(shiftYearMonth(yearMonth, -1)),
      canNext: canShiftToNext(shiftYearMonth(yearMonth, 1), yearMonth),
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
    const { room, prevWater, prevElec, waterReading, elecReading } = this.data;
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
    const waterUsage = prev ? Math.max(0, w - prevWater) : 0;
    const elecUsage  = prev ? Math.max(0, e - prevElec)  : 0;
    this.setData({
      breakdown: {
        ...result,
        water_usage: waterUsage.toFixed(2),
        elec_usage: elecUsage.toFixed(2),
        garbage_fee: room.garbage_fee,
        internet_fee: room.internet_fee,
      },
    });
  },

  _goToMonth(targetYM) {
    const { roomId, yearMonth } = this.data;
    if (!/^\d{4}-\d{2}$/.test(targetYM)) return;
    if (targetYM === yearMonth) return;
    if (!canShiftToPrev(targetYM)) return;
    if (!canShiftToNext(targetYM)) return;
    wx.redirectTo({ url: `/pages/bill/edit/index?roomId=${roomId}&yearMonth=${targetYM}` });
  },

  onPrevMonth() {
    if (!this.data.canPrev) return;
    this._goToMonth(shiftYearMonth(this.data.yearMonth, -1));
  },

  onNextMonth() {
    if (!this.data.canNext) return;
    this._goToMonth(shiftYearMonth(this.data.yearMonth, 1));
  },

  onPickMonth(e) {
    const value = e.detail.value || '';
    const targetYM = value.length >= 7 ? value.slice(0, 7) : '';
    this._goToMonth(targetYM);
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