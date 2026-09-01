import { callRentApi } from '../../utils/api.js';
import { isAdmin } from '../../utils/auth.js';
import {
  canShiftToPrev,
  canShiftToNext,
  currentYearMonth,
  formatYearMonthLabel,
  shiftYearMonth,
} from '../../utils/format.js';

const app = getApp();

Page({
  data: {
    rooms: [],
    currentYM: '',
    sumTotal: 0,
    pendingCount: 0,
    isAdmin: false,
    canPrev: true,
    canNext: false,
  },

  async onShow() {
    const admin = app.globalData.isAdmin || await isAdmin();
    app.globalData.isAdmin = admin;
    this.setData({ isAdmin: admin });
    if (!admin) {
      wx.reLaunch({ url: '/pages/unauthorized/index' });
      return;
    }
    try { await callRentApi('seedRooms'); } catch (e) {}

    // 无选中月份时默认当前月；从编辑页返回时保留原选中月份刷新
    const ym = this._ym || currentYearMonth();
    await this.loadMonth(ym);
  },

  async loadMonth(ym) {
    this._ym = ym;
    this.setData({
      currentYM: ym,
      canPrev: canShiftToPrev(ym),
      canNext: canShiftToNext(ym),
    });

    const cacheKey = `billsCache:${ym}`;
    const cached = wx.getStorageSync(cacheKey);

    if (cached && cached.ym === ym) {
      this.render(cached.rooms, ym);
    }

    try {
      const { rooms } = await callRentApi('getRooms');
      const billPromises = rooms.map(r => callRentApi('getBill', { roomId: r._id, yearMonth: ym }).then(res => ({ room: r, bill: res.bill })));
      const bills = await Promise.all(billPromises);
      wx.setStorageSync(cacheKey, { ym, rooms: bills });
      this.render(bills, ym);
    } catch (e) {
      console.error(e);
    }
  },

  render(bills, ym) {
    let sum = 0;
    let pending = 0;
    const rooms = bills.map(({ room, bill }) => {
      // 存量账单 total 可能带小数（旧口径），展示统一向下取整
      const total = Math.floor(bill?.total ?? 0);
      sum += total;
      if (room.status === 'active' && !bill) pending += 1;
      return {
        room,
        billTotal: total,
        hasBill: !!bill,
        billLabel: formatYearMonthLabel(ym),
      };
    });
    this.setData({
      rooms,
      sumTotal: sum.toFixed(2),
      pendingCount: pending,
    });
  },

  onHeaderSettings() {
    wx.navigateTo({ url: '/pages/settings/index' });
  },

  async onSync() {
    const { rooms } = this.data;
    const activeCount = rooms.filter(r => r.room && r.room.status === 'active').length;
    const res = await wx.showModal({
      title: '同步数据',
      content: `将补全全部 ${activeCount} 个房间缺失的空置月份，可能需要几秒，是否继续？`,
      confirmText: '确定',
      cancelText: '取消',
    });
    if (!res.confirm) return;
    wx.showLoading({ title: '同步中', mask: true });
    try {
      const { inserted } = await callRentApi('syncVacancyMonths', {});
      wx.hideLoading();
      wx.showToast({
        title: inserted > 0 ? `已补全 ${inserted} 条` : '已是最新，无需补全',
        icon: inserted > 0 ? 'success' : 'none',
      });
      // 同步后当前月数据可能变化，刷新当前选中月
      await this.loadMonth(this._ym);
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '同步失败', icon: 'none' });
    }
  },

  onPrevMonth() {
    if (!this.data.canPrev) return;
    this.loadMonth(shiftYearMonth(this._ym, -1));
  },

  onNextMonth() {
    if (!this.data.canNext) return;
    this.loadMonth(shiftYearMonth(this._ym, 1));
  },

  onSettings(e) {
    const roomId = e.detail?.roomId;
    if (roomId) {
      wx.navigateTo({ url: '/pages/rooms/index?focus=' + roomId });
    } else {
      wx.navigateTo({ url: '/pages/rooms/index' });
    }
  },

  async onGenerate(e) {
    const roomId = e.detail.roomId;
    const ym = this._ym;
    try {
      const { bill } = await callRentApi('getBill', { roomId, yearMonth: ym });
      wx.navigateTo({ url: `/pages/bill/edit/index?roomId=${roomId}&yearMonth=${ym}&id=${bill?._id || ''}` });
    } catch (err) {
      wx.showToast({ title: '打开失败', icon: 'none' });
    }
  },

  onHistory(e) {
    const roomId = e.detail.roomId;
    wx.navigateTo({ url: `/pages/bill/history/index?roomId=${roomId}` });
  },

  async onReceipt(e) {
    const roomId = e.detail.roomId;
    wx.showLoading({ title: '生成中...' });
    try {
      const { receiptNo } = await callRentApi('nextReceiptNo');
      wx.hideLoading();
      const ym = this._ym || currentYearMonth();
      wx.navigateTo({ url: `/pages/receipt/preview/index?roomId=${roomId}&receiptNo=${receiptNo}&yearMonth=${ym}` });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '生成失败', icon: 'none' });
    }
  },
});
