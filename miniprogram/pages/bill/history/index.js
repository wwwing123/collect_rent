import * as echarts from '../../../miniprogram_npm/ec-canvas/echarts';
import { callRentApi } from '../../../utils/api.js';

Page({
  data: {
    roomId: '',
    roomLabel: '',
    history: [],
    backfillYM: '',
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
    const history = bills.map(b => {
      const hasBreakdown = b.rent !== undefined;
      return {
        year_month: b.year_month,
        rent: hasBreakdown ? b.rent : (b.base_fee || 0),
        water_fee: b.water_fee,
        elec_fee: b.elec_fee,
        other: hasBreakdown ? (b.garbage_fee || 0) + (b.internet_fee || 0) : 0,
        total: b.total,
      };
    });
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
    const water = sorted.map((b, i) => {
      if (i === 0) return 0;
      return Math.max(0, (b.water_reading ?? 0) - (sorted[i - 1].water_reading ?? 0));
    });
    const elec = sorted.map((b, i) => {
      if (i === 0) return 0;
      return Math.max(0, (b.elec_reading ?? 0) - (sorted[i - 1].elec_reading ?? 0));
    });
    const ink = '#1A1814';
    const ink2 = '#8A857A';
    const line = '#E5DFD2';
    this.chart.setOption({
      grid: { left: 50, right: 50, top: 56, bottom: 36, containLabel: true },
      legend: {
        top: 8, right: 0,
        textStyle: { color: ink, fontFamily: 'Source Han Serif SC, serif', fontSize: 12 },
        icon: 'roundRect',
        itemWidth: 18, itemHeight: 4,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#FBF8F2',
        borderColor: line,
        borderWidth: 1,
        textStyle: { color: ink, fontFamily: 'Source Han Serif SC, serif' },
        axisPointer: { lineStyle: { color: line } },
      },
      xAxis: {
        type: 'category', data: months,
        axisLine: { lineStyle: { color: line } },
        axisLabel: { color: ink2, fontFamily: 'Source Han Serif SC, serif' },
        axisTick: { show: false },
      },
      yAxis: [
        { type: 'value', name: '水(吨)', position: 'left',
          nameTextStyle: { color: '#3a8ee6', fontSize: 11 },
          axisLine: { show: true, lineStyle: { color: '#3a8ee6' } },
          splitLine: { lineStyle: { color: line, type: 'dashed' } },
          axisLabel: { color: ink2 },
        },
        { type: 'value', name: '电(度)', position: 'right',
          nameTextStyle: { color: '#B8893D', fontSize: 11 },
          axisLine: { show: true, lineStyle: { color: '#B8893D' } },
          splitLine: { show: false },
          axisLabel: { color: ink2 },
        },
      ],
      series: [
        { name: '水(吨)', type: 'line', data: water, smooth: true, yAxisIndex: 0,
          symbol: 'circle', symbolSize: 8,
          lineStyle: { width: 3, color: '#3a8ee6' },
          itemStyle: { color: '#3a8ee6', borderColor: '#FBF8F2', borderWidth: 2 },
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
            { offset: 0, color: 'rgba(58,142,230,0.18)' },
            { offset: 1, color: 'rgba(58,142,230,0)' },
          ]}},
        },
        { name: '电(度)', type: 'line', data: elec,  smooth: true, yAxisIndex: 1,
          symbol: 'circle', symbolSize: 8,
          lineStyle: { width: 3, color: '#B8893D' },
          itemStyle: { color: '#B8893D', borderColor: '#FBF8F2', borderWidth: 2 },
        },
      ],
    });
  },

  onTapRow(e) {
    const { yearmonth } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/bill/edit/index?roomId=${this.data.roomId}&yearMonth=${yearmonth}` });
  },

  onPickMonth(e) {
    const ym = e.detail.value;
    wx.redirectTo({ url: `/pages/bill/edit/index?roomId=${this.data.roomId}&yearMonth=${ym}` });
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