import { getOpenId, isAdmin } from './utils/auth.js';

App({
  globalData: {
    env: '',
    isAdmin: false,
    openid: null,
  },

  async onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }
    wx.cloud.init({
      env: this.globalData.env,
      traceUser: true,
    });

    try {
      this.globalData.openid = await getOpenId();
      this.globalData.isAdmin = await isAdmin();
    } catch (e) {
      console.error('auth init failed', e);
    }
  },

  ensureAdmin() {
    return this.globalData.isAdmin;
  },
});
