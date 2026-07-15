import * as echarts from '../../../miniprogram_npm/ec-canvas/echarts';
import { callRentApi } from '../../../utils/api.js';

Page({
  data: {
    roomId: '',
    roomLabel: '',
    history: [],
    latestYM: '',
    latestWater: 0,
    latestElec: 0,
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
        vacancy: !!b.vacancy,
      };
    });
    this.setData({ history });
    this._setLatestStats(bills);
    this.updateChart(bills);
  },

  _setLatestStats(bills) {
    if (!bills || !bills.length) return;
    const sorted = [...bills].sort((a, b) => a.year_month < b.year_month ? -1 : 1);
    const last = sorted[sorted.length - 1];
    const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
    const water = prev
      ? Math.max(0, (last.water_reading ?? 0) - (prev.water_reading ?? 0))
      : 0;
    const elec = prev
      ? Math.max(0, (last.elec_reading ?? 0) - (prev.elec_reading ?? 0))
      : 0;
    this.setData({
      latestYM: last.year_month || '',
      latestWater: water.toFixed(2),
      latestElec: elec.toFixed(0),
    });
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

    // 调色板：和 app.wxss 保持一致
    const C = {
      ink:    '#2A2622',
      ink2:   '#5C564F',
      ink3:   '#908A82',
      line:   '#ECE4D4',
      paper:  '#FFFFFF',
      paper2: '#FAF6F0',
      amber:  '#EA7B3A',
      water:  '#4A8FB8',   // 冷蓝，呼应「水」
      elec:   '#E5854A',   // 暖橙，呼应「电」，与品牌主色一系
    };

    this.chart.setOption({
      grid: { left: 8, right: 8, top: 32, bottom: 12, containLabel: true },
      legend: {
        top: 0, right: 0,
        textStyle: { color: C.ink2, fontSize: 11 },
        icon: 'roundRect',
        itemWidth: 22, itemHeight: 4,
        itemGap: 20,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 252, 247, 0.98)',
        borderColor: C.line,
        borderWidth: 1,
        padding: [10, 14],
        extraCssText: 'box-shadow: 0 8rpx 24rpx rgba(58, 36, 14, 0.10); border-radius: 12rpx; backdrop-filter: blur(8rpx);',
        textStyle: { color: C.ink, fontSize: 12 },
        axisPointer: {
          type: 'line',
          lineStyle: { color: C.amber, width: 1, type: 'solid', opacity: 0.4 },
        },
      },
      xAxis: {
        type: 'category', data: months,
        boundaryGap: false,
        axisLine: { show: true, lineStyle: { color: C.line } },
        axisLabel: { color: C.ink3, fontSize: 10, margin: 12 },
        axisTick: { show: false },
      },
      yAxis: [
        {
          type: 'value', name: '水(吨)', position: 'left',
          nameTextStyle: { color: C.water, fontSize: 10, padding: [0, 0, 4, 0] },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { lineStyle: { color: C.line, type: 'dashed' } },
          axisLabel: { color: C.ink3, fontSize: 10 },
        },
        {
          type: 'value', name: '电(度)', position: 'right',
          nameTextStyle: { color: C.elec, fontSize: 10, padding: [0, 0, 4, 0] },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { color: C.ink3, fontSize: 10 },
        },
      ],
      series: [
        {
          name: '水(吨)', type: 'line', data: water, smooth: 0.4, yAxisIndex: 0,
          symbol: 'circle', symbolSize: 8,
          lineStyle: { width: 2.5, color: C.water },
          itemStyle: { color: C.water, borderColor: '#FFFFFF', borderWidth: 2 },
          emphasis: {
            focus: 'series',
            scale: 1.3,
            lineStyle: { width: 3.5 },
            itemStyle: { borderWidth: 3 },
          },
          areaStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(74, 143, 184, 0.22)' },
                { offset: 1, color: 'rgba(74, 143, 184, 0.00)' },
              ],
            },
          },
          animationDuration: 900,
          animationEasing: 'cubicOut',
        },
        {
          name: '电(度)', type: 'line', data: elec, smooth: 0.4, yAxisIndex: 1,
          symbol: 'circle', symbolSize: 8,
          lineStyle: { width: 2.5, color: C.elec },
          itemStyle: { color: C.elec, borderColor: '#FFFFFF', borderWidth: 2 },
          emphasis: {
            focus: 'series',
            scale: 1.3,
            lineStyle: { width: 3.5 },
            itemStyle: { borderWidth: 3 },
          },
          animationDuration: 900,
          animationEasing: 'cubicOut',
        },
      ],
    });
  },

  async onSync() {
    const { roomId, roomLabel } = this.data;
    const res = await wx.showModal({
      title: '同步数据',
      content: `将补全当前房间【${roomLabel}】缺失的空置月份，是否继续？`,
      confirmText: '确定',
      cancelText: '取消',
    });
    if (!res.confirm) return;
    wx.showLoading({ title: '同步中', mask: true });
    try {
      const { inserted } = await callRentApi('syncVacancyMonths', { roomId });
      wx.hideLoading();
      wx.showToast({
        title: inserted > 0 ? `已补全 ${inserted} 条` : '已是最新，无需补全',
        icon: inserted > 0 ? 'success' : 'none',
      });
      await this.refresh();
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '同步失败', icon: 'none' });
    }
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