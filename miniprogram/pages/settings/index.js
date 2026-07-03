import { callRentApi } from '../../utils/api.js';

Page({
  data: { code: '' },
  async onShow() {
    const { code } = await callRentApi('getInviteCode');
    this.setData({ code });
  },
  onCopy() {
    wx.setClipboardData({ data: this.data.code });
  },
  async onRegenerate() {
    const { code } = await callRentApi('regenerateInviteCode');
    this.setData({ code });
    wx.showToast({ title: '已重新生成', icon: 'success' });
  },
});