const PROPERTY_ADDRESS = '南东新村6巷92号';

const RECEIPT_ITEMS = [
  { key: 'water_fee',     label: '水费(元)' },
  { key: 'elec_fee',      label: '电费(元)' },
  { key: 'rent',          label: '租金(元)' },
  { key: 'garbage_fee',   label: '垃圾费(元)' },
  { key: 'internet_fee',  label: '网络费(元)' },
];

export function getReceiptUserName(room) {
  if (!room) return PROPERTY_ADDRESS;
  if (room.code === '旧屋') return room.name || '';
  const name = room.name ? ` ${room.name}` : '';
  return `${PROPERTY_ADDRESS}${name}`;
}

export function formatReceiptNo(n) {
  return String(n).padStart(6, '0');
}

export function formatReceiptDate(date) {
  const d = date instanceof Date ? date : new Date();
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export function formatAmount(n) {
  const v = Number(n) || 0;
  return v.toFixed(2);
}

export function buildReceiptData({ room, bill, receiptNo, today }) {
  const items = RECEIPT_ITEMS.map(({ key, label }) => ({
    label,
    amount: formatAmount(bill?.[key] ?? 0),
  }));
  return {
    userName: getReceiptUserName(room),
    receiptNo: formatReceiptNo(receiptNo),
    date: formatReceiptDate(today),
    items,
    total: formatAmount(bill?.total ?? 0),
  };
}

const W = 750;
const H = 500;
const PADDING = 40;
const BG = '#fce4d6';
const INK = '#222';
const RULE = '#666';

const FONT_TITLE = 'bold 40px sans-serif';
const FONT_HEAD = '24px sans-serif';
const FONT_BODY = '26px sans-serif';
const FONT_TOTAL = 'bold 28px sans-serif';

export function drawReceipt(ctx, data) {
  drawBackground(ctx);
  drawHeader(ctx, data);
  drawTable(ctx, data);
  drawTotal(ctx, data);
  drawSignature(ctx);
}

function drawBackground(ctx) {
  ctx.save();
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawHeader(ctx, { userName, receiptNo, date }) {
  ctx.save();
  ctx.fillStyle = INK;
  ctx.textBaseline = 'middle';

  ctx.font = FONT_TITLE;
  ctx.textAlign = 'center';
  ctx.fillText('收  据', W / 2 - 80, 50);

  ctx.font = FONT_HEAD;
  ctx.textAlign = 'right';
  ctx.fillText(`NO:${receiptNo}`, W - PADDING, 50);

  ctx.font = FONT_BODY;
  ctx.textAlign = 'left';
  ctx.fillText(`用户名称: ${userName}`, PADDING, 110);

  ctx.textAlign = 'right';
  ctx.fillText(date, W - PADDING, 110);

  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING, 140);
  ctx.lineTo(W - PADDING, 140);
  ctx.stroke();
  ctx.restore();
}

function drawTable(ctx, { items }) {
  ctx.save();
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.font = FONT_BODY;
  ctx.textBaseline = 'middle';

  const rowH = 38;
  const labelX = PADDING;
  const amountX = W - PADDING;
  const top = 165;

  items.forEach((item, i) => {
    const y = top + i * rowH;
    ctx.textAlign = 'left';
    ctx.fillText(item.label, labelX, y);
    ctx.textAlign = 'right';
    ctx.fillText(`¥${item.amount}`, amountX, y);
  });

  ctx.beginPath();
  ctx.moveTo(PADDING, top + items.length * rowH);
  ctx.lineTo(W - PADDING, top + items.length * rowH);
  ctx.stroke();
  ctx.restore();
}

function drawTotal(ctx, { total }) {
  ctx.save();
  ctx.fillStyle = INK;
  ctx.font = FONT_TOTAL;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('合计人民币', PADDING, 410);
  ctx.textAlign = 'right';
  ctx.fillText(`¥${total}`, W - PADDING, 410);
  ctx.restore();
}

function drawSignature(ctx) {
  ctx.save();
  ctx.fillStyle = INK;
  ctx.font = FONT_BODY;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('开票人:', PADDING, 460);
  ctx.fillText('收款人:', W / 2, 460);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING + 80, 462);
  ctx.lineTo(PADDING + 220, 462);
  ctx.moveTo(W / 2 + 80, 462);
  ctx.lineTo(W / 2 + 220, 462);
  ctx.stroke();
  ctx.restore();
}
