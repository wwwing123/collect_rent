Component({
  properties: {
    rooms: { type: Array, value: [] },
    activeNames: { type: Array, value: [] },
  },
  methods: {
    onChange(e) {
      this.triggerEvent('collapsechange', { activeNames: e.detail });
    },
    onField(e) {
      const { key, code } = e.currentTarget.dataset;
      const value = key === 'name' ? e.detail : Number(e.detail);
      this.triggerEvent('fieldchange', { key, code, value });
    },
  },
});
