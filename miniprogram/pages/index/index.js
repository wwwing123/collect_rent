import { callRentApi } from '../../utils/api.js';
import { isAdmin } from '../../utils/auth.js';
import { sumUsage } from '../../utils/billing.js';
import {
  MIN_YEAR_MONTH,
  canShiftToPrev,
  canShiftToNext,
  currentYearMonth,
  formatUsage,
  formatYearMonthLabel,
  isInRange,
  maxSelectableYearMonth,
  shiftYearMonth,
} from '../../utils/format.js';

const app = getApp();

// v2：缓存里额外存 prev（上月账单），用于汇总本月水电用量
const CACHE_VERSION = 2;

Page({
  data: {
    rooms: [],
    currentYM: '',
    sumTotal: 0,
    waterUsage: '0',
    elecUsage: '0',
    pendingCount: 0,
    isAdmin: false,
    canPrev: true,
    canNext: false,
    minYearMonth: MIN_YEAR_MONTH,
    maxYearMonth: '',
    loading: false,
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
      maxYearMonth: maxSelectableYearMonth(),
      canPrev: canShiftToPrev(ym),
      canNext: canShiftToNext(ym),
    });

    const cacheKey = `billsCache:${ym}`;
    const cached = wx.getStorageSync(cacheKey);
    const cacheHit = !!(cached && cached.ym === ym && cached.v === CACHE_VERSION);

    if (cacheHit) {
      this.render(cached.rooms, ym);
    } else {
      // 无缓存：清空旧月数据并进入 loading 态，避免显示上月数据误导
      this.setData({ loading: true, rooms: [], sumTotal: '0.00', waterUsage: '0', elecUsage: '0', pendingCount: 0 });
    }

    try {
      const { rooms } = await callRentApi('getRooms');
      const entries = await Promise.all(rooms.map(async (room) => {
        const { bill } = await callRentApi('getBill', { roomId: room._id, yearMonth: ym });
        // 本月没账单则用量为 0，不必再查上月读数
        const { prev } = bill
          ? await callRentApi('getPrevBill', { roomId: room._id, yearMonth: ym })
          : { prev: null };
        return { room, bill, prev };
      }));
      // 快速连续切换月份时，丢弃过期的请求结果
      if (this._ym !== ym) return;
      wx.setStorageSync(cacheKey, { ym, rooms: entries, v: CACHE_VERSION });
      this.render(entries, ym);
    } catch (e) {
      console.error(e);
      if (this._ym === ym && !cacheHit) {
        wx.showToast({ title: '加载失败，请重试', icon: 'none' });
      }
    } finally {
      if (this._ym === ym) this.setData({ loading: false });
    }
  },

  render(entries, ym) {
    let sum = 0;
    let pending = 0;
    const rooms = entries.map(({ room, bill }) => {
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
    const usage = sumUsage(entries);
    this.setData({
      rooms,
      sumTotal: sum.toFixed(2),
      waterUsage: formatUsage(usage.water),
      elecUsage: formatUsage(usage.elec),
      pendingCount: pending,
    });
  },

  onHeaderSettings() {
    wx.navigateTo({ url: '/pages/settings/index' });
  },

  // 订阅抄表提醒：每点一次并「允许」攒 1 条额度，月末当天会发 2 条（18:00/21:00）
  // 多点几次可攒多条，避免 21:00 那条因额度不足收不到
  async onSubscribeReminder() {
    const TEMPLATE_ID = 'J9g9WGKUHvl40BGLE-k6LZIUTojypWyV8qs2vC7Rudw';
    try {
      const res = await wx.requestSubscribeMessage({ tmplIds: [TEMPLATE_ID] });
      if (res[TEMPLATE_ID] === 'accept') {
        wx.showToast({ title: '已订阅，多点几次攒额度', icon: 'none' });
      } else {
        wx.showToast({ title: '已拒绝，将收不到提醒', icon: 'none' });
      }
    } catch (e) {
      // errMsg 可能是 requestSubscribeMessage:fail 禁用/用户关闭订阅功能
      wx.showToast({ title: '订阅不可用，请检查设置', icon: 'none' });
    }
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

  onPickMonth(e) {
    const value = e.detail.value || '';
    const targetYM = value.length >= 7 ? value.slice(0, 7) : '';
    if (!/^\d{4}-\d{2}$/.test(targetYM)) return;
    if (targetYM === this._ym) return;
    if (!isInRange(targetYM, MIN_YEAR_MONTH, maxSelectableYearMonth())) return;
    this.loadMonth(targetYM);
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
