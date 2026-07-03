import * as echarts from '../../../miniprogram_npm/ec-canvas/echarts';
import { callRentApi } from '../../../utils/api.js';

Page({
  data: {
    roomId: '',
    roomLabel: '',
    history: [],
    ec: { lazyLoad: true },
  },

  async onLoad(options) {
    const { roomId } = options;
    this.chart = null;
    this.setData({ roomId });
    await this.refresh();
  },

  async refresh() {
    const { roomId } = this.data;
    const roomsRes = await callRentApi('getRooms');
    const room = roomsRes.rooms.find(r => r._id === roomId);
    this.setData({
      roomLabel: room.code + (room.name ? ' · ' + room.name : ''),
    });

    const { bills } = await callRentApi('getHistory', { roomId, limit: 36, offset: 0 });
    const history = bills.map(b => ({
      year_month: b.year_month,
      rent: room.rent,
      water_fee: b.water_fee,
      elec_fee: b.elec_fee,
      other: (b.base_fee || 0) - room.rent,
      total: b.total,
    }));
    this.setData({ history });
    this.updateChart(bills);
  },

  updateChart(bills) {
    if (!this.chart) {
      this.ecComponent = this.selectComponent('#history-chart');
      this.ecComponent.init((canvas, width, height, dpr) => {
        const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
        this.chart = chart;
        this._renderChart(bills);
        return chart;
      });
    } else {
      this._renderChart(bills);
    }
  },

  _renderChart(bills) {
    const sorted = [...bills].sort((a, b) => a.year_month < b.year_month ? -1 : 1);
    const months = sorted.map(b => b.year_month);
    const water = sorted.map(b => b.water_reading ?? 0);
    const elec  = sorted.map(b => b.elec_reading ?? 0);
    this.chart.setOption({
      grid: { left: 40, right: 20, top: 30, bottom: 30 },
      legend: { top: 0 },
      xAxis: { type: 'category', data: months },
      yAxis: { type: 'value' },
      series: [
        { name: '水(吨)', type: 'line', data: water, smooth: true, itemStyle: { color: '#3a8ee6' } },
        { name: '电(度)', type: 'line', data: elec,  smooth: true, itemStyle: { color: '#f59e0b' } },
      ],
    });
  },

  onTapRow(e) {
    const { yearmonth } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/bill/edit/index?roomId=${this.data.roomId}&yearMonth=${yearmonth}` });
  },

  async onExport() {
    wx.showLoading({ title: '生成中...' });
    try {
      const { fileID } = await callRentApi('exportCsv', { roomId: this.data.roomId });
      const dl = await wx.cloud.downloadFile({ fileID });
      wx.hideLoading();
      await wx.openDocument({
        filePath: dl.tempFilePath,
        fileType: 'csv',
        showMenu: true,
      });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '导出失败', icon: 'none' });
    }
  },
});