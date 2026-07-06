import { callRentApi } from '../../utils/api.js';
import { currentYearMonth } from '../../utils/format.js';

Page({
  data: {
    rooms: [],
    activeNames: [],
  },

  async onLoad(options) {
    const { rooms } = await callRentApi('getRooms');
    const focus = options.focus;
    const active = focus ? [rooms.find(r => r._id === focus)?.code].filter(Boolean) : [];
    this.setData({ rooms, activeNames: active });
  },

  onCollapse(e) {
    this.setData({ activeNames: e.detail.activeNames });
  },

  onField(e) {
    const { key, code, value } = e.detail;
    const rooms = this.data.rooms.map(r =>
      r.code === code ? { ...r, [key]: value } : r
    );
    this.setData({ rooms });
  },

  async onSave() {
    wx.showLoading({ title: '保存中...' });
    try {
      for (const room of this.data.rooms) {
        const cleaned = {
          ...room,
          rent: Number(room.rent) || 0,
          water_unit_price: Number(room.water_unit_price) || 0,
          elec_unit_price: Number(room.elec_unit_price) || 0,
          garbage_fee: Number(room.garbage_fee) || 0,
          internet_fee: Number(room.internet_fee) || 0,
        };
        await callRentApi('upsertRoom', { room: cleaned });
      }
      wx.hideLoading();
      wx.showToast({ title: '已保存', icon: 'success' });
      wx.removeStorageSync('billsCache:' + currentYearMonth());
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },
});
