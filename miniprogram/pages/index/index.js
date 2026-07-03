import { callRentApi } from '../../utils/api.js';
import { currentYearMonth, formatYearMonthLabel } from '../../utils/format.js';

const app = getApp();

Page({
  data: {
    rooms: [],
    currentYM: '',
    sumTotal: 0,
  },

  async onShow() {
    if (!app.globalData.isAdmin) {
      wx.reLaunch({ url: '/pages/unauthorized/index' });
      return;
    }
    try { await callRentApi('seedRooms'); } catch (e) {}

    const ym = currentYearMonth();
    const cacheKey = `billsCache:${ym}`;
    let cached = wx.getStorageSync(cacheKey);

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
    const rooms = bills.map(({ room, bill }) => {
      const total = bill?.total ?? 0;
      sum += total;
      return {
        room,
        billTotal: total,
        hasBill: !!bill,
        billLabel: formatYearMonthLabel(ym),
      };
    });
    this.setData({ rooms, currentYM: ym, sumTotal: sum.toFixed(2) });
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
    const ym = currentYearMonth();
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
});
