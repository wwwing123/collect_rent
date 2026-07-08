import { callRentApi } from '../../../utils/api.js';
import { currentYearMonth } from '../../../utils/format.js';
import { buildReceiptData, drawReceipt } from '../../../utils/receipt.js';

const RECEIPT_W = 960;
const RECEIPT_H = 530;

Page({
  data: {
    loading: true,
  },

  async onLoad(options) {
    const { roomId, receiptNo } = options;
    this.canvasNode = null;
    this.setData({ loading: true });
    try {
      const roomsRes = await callRentApi('getRooms');
      const room = roomsRes.rooms.find(r => r._id === roomId);
      if (!room) throw new Error('房间不存在');
      const ym = currentYearMonth();
      const [{ bill }, { prev }] = await Promise.all([
        callRentApi('getBill', { roomId, yearMonth: ym }),
        callRentApi('getPrevBill', { roomId, yearMonth: ym }),
      ]);
      if (!bill) {
        wx.showToast({ title: '当月无账单', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 800);
        return;
      }
      this._room = room;
      this._bill = bill;
      this._prevBill = prev || null;
      this._receiptNo = receiptNo;
      this._today = new Date();
      this.setData({ loading: false });
      this._renderCanvas();
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '加载失败', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
    }
  },

  _renderCanvas() {
    const data = buildReceiptData({
      room: this._room,
      bill: this._bill,
      prevBill: this._prevBill,
      receiptNo: this._receiptNo,
      today: this._today,
    });
    const query = wx.createSelectorQuery();
    query.select('#receipt-canvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) {
          console.error('canvas node not ready');
          return;
        }
        const canvas = res[0].node;
        const dpr = wx.getSystemInfoSync().pixelRatio || 1;
        canvas.width = RECEIPT_W * dpr;
        canvas.height = RECEIPT_H * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        drawReceipt(ctx, data);
        this.canvasNode = canvas;
      });
  },

  _exportToTemp() {
    return new Promise((resolve, reject) => {
      if (!this.canvasNode) return reject(new Error('canvas not ready'));
      wx.canvasToTempFilePath({
        canvas: this.canvasNode,
        fileType: 'png',
        success: (res) => resolve(res.tempFilePath),
        fail: reject,
      });
    });
  },

  async onSave() {
    try {
      const tempPath = await this._exportToTemp();
      await this._saveToAlbum(tempPath);
      wx.showToast({ title: '已保存到相册', icon: 'success' });
    } catch (e) {
      if (e && e.errMsg && e.errMsg.includes('auth deny')) {
        wx.showModal({
          title: '需要相册权限',
          content: '保存到相册需要您授权，请在设置中开启。',
          confirmText: '去设置',
          success: (r) => {
            if (r.confirm) wx.openSetting();
          },
        });
      } else {
        console.error(e);
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
    }
  },

  _saveToAlbum(tempPath) {
    return new Promise((resolve, reject) => {
      wx.saveImageToPhotosAlbum({
        filePath: tempPath,
        success: resolve,
        fail: reject,
      });
    });
  },

  async onShareAppMessage() {
    try {
      const tempPath = await this._exportToTemp();
      return {
        title: `${this._room.code} 收据`,
        path: '/pages/index/index',
        imageUrl: tempPath,
      };
    } catch (e) {
      return {
        title: '收据',
        path: '/pages/index/index',
      };
    }
  },
});
