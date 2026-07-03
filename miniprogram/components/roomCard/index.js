Component({
  properties: {
    room: { type: Object, value: {} },
    billTotal: { type: Number, value: 0 },
    hasBill: { type: Boolean, value: false },
    billLabel: { type: String, value: '' },
    isActive: { type: Boolean, value: true },
  },
  methods: {
    onSettings()   { this.triggerEvent('settings',   { roomId: this.data.room._id }); },
    onGenerate()   { this.triggerEvent('generate',   { roomId: this.data.room._id }); },
    onHistory()    { this.triggerEvent('history',    { roomId: this.data.room._id }); },
  },
});
