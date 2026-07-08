import { joinFamily } from '../../utils/auth.js';

Page({
  data: { code: '', err: '' },
  onInput(e) {
    // Vant Weapp 的 van-field 在 extraEventParams=false（默认）时，
    // e.detail 本身就是字符串值；只有 extraEventParams=true 时才是 {value, cursor} 对象。
    const raw = typeof e.detail === 'string' ? e.detail : (e.detail && e.detail.value) || '';
    this.setData({ code: raw.toUpperCase(), err: '' });
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
