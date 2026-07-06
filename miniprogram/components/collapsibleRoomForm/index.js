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
      this.triggerEvent('fieldchange', { key, code, value: e.detail });
    },
  },
});
