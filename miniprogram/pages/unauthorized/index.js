import { joinFamily } from '../../utils/auth.js';

Page({
  data: { code: '', err: '' },
  onInput(e) {
    this.setData({ code: e.detail.value.toUpperCase(), err: '' });
  },
  async onSubmit() {
    const code = (this.data.code || '').trim();
    if (code.length !== 6) {
      this.setData({ err: '请输入 6 位邀请码' });
      return;
    }
    try {
      await joinFamily(code);
      wx.reLaunch({ url: '/pages/index/index' });
    } catch (e) {
      const msg = e.code === 'BAD_CODE' ? '邀请码不正确' : '加入失败，请重试';
      this.setData({ err: msg });
    }
  },
});
