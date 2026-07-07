const PROPERTY_ADDRESS = '南东新村6巷92号';

const DIGITS = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
const UNITS = ['', '拾', '佰', '仟'];
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

function intToCN(n) {
  if (n === 0) return '零';
  let str = '';
  const s = String(n);
  for (let i = 0; i < s.length; i++) {
    const d = parseInt(s[i], 10);
    const u = UNITS[s.length - 1 - i];
    if (d === 0) {
      if (str && !str.endsWith('零')) str += '零';
    } else {
      str += DIGITS[d] + u;
    }
  }
  str = str.replace(/零+$/, '');
  return str || '零';
}

export function formatCNY(n) {
  const num = Number(n) || 0;
  const [intPart, decPart] = num.toFixed(2).split('.');
  const intStr = intToCN(parseInt(intPart, 10));
  const trimmed = decPart.replace(/0+$/, '');
  if (!trimmed) {
    return `${intStr}圆整`;
  }
  const decCN = trimmed.split('').map(d => DIGITS[parseInt(d, 10)]).join('');
  return `${intStr}.${decCN}圆整`;
}

export function buildReceiptData({ room, bill, prevBill, receiptNo, today }) {
  const rows = RECEIPT_ROWS.map(({ key, label, hasUsage }) => {
    const row = { label, prev: '', curr: '', unit: '', amount: formatAmount(bill?.[key] ?? 0) };
    if (hasUsage && bill) {
      const currReading = key === 'water_fee' ? bill.water_reading : bill.elec_reading;
      const prevReading = key === 'water_fee' ? prevBill?.water_reading : prevBill?.elec_reading;
      if (typeof currReading === 'number') row.curr = String(currReading);
      if (typeof prevReading === 'number') row.prev = String(prevReading);
      if (typeof currReading === 'number' && typeof prevReading === 'number') {
        row.usage = String(Math.max(0, currReading - prevReading));
      }
      const unit = key === 'water_fee' ? room?.water_unit_price : room?.elec_unit_price;
      if (typeof unit === 'number') row.unit = formatAmount(unit);
    }
    return row;
  });
  return {
    userName: getReceiptUserName(room),
    receiptNo: formatReceiptNo(receiptNo),
    date: formatReceiptDate(today),
    rows,
    total: formatAmount(bill?.total ?? 0),
    totalCN: formatCNY(bill?.total ?? 0),
  };
}

const W = 900;
const H = 560;
const PADDING = 50;
const TABLE_W = W - PADDING * 2;

const BG = '#fadade';
const INK = '#222';
const NO_COLOR = '#ff8c00';
const FONT = 'SimSun, "宋体", serif';

const COL_WIDTHS = [180, 90, 90, 90, 90, 130, 130];
const COL_X = (() => {
  const xs = [PADDING];
  for (let i = 0; i < COL_WIDTHS.length; i++) xs.push(xs[i] + COL_WIDTHS[i]);
  return xs;
})();

const HEADER_Y = 175;
const ROW_H = 38;
const TABLE_HEADERS = ['项 目', '上 月', '本 月', '实 用', '单 价', '金额小计(元)', '备 注'];
const ROW_COUNT = 4; // 水费 / 电费 / 租金 / 拆分行(垃圾费+网络费)
const TABLE_BOTTOM = HEADER_Y + ROW_H * (ROW_COUNT + 2); // +2 = header row + total row

const RECEIPT_ROWS = [
  { key: 'water_fee',    label: '水费(吨)',  hasUsage: true  },
  { key: 'elec_fee',     label: '电费(度)',  hasUsage: true  },
  { key: 'rent',         label: '租金(元)',  hasUsage: false },
  { key: 'garbage_fee',  label: '垃圾费(元)', hasUsage: false },
  { key: 'internet_fee', label: '网络费(元)', hasUsage: false },
];

let currentRow = 0;

export function drawReceipt(ctx, data) {
  drawBackground(ctx);
  drawHeader(ctx, data);
  drawTable(ctx, data);
  drawSignature(ctx);
  drawVerticalText(ctx);
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
  ctx.font = `bold 48px ${FONT}`;

  ctx.textAlign = 'center';
  ctx.fillText('收  据', W / 2 - 80, 80);

  ctx.fillStyle = NO_COLOR;
  ctx.font = `24px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(`NO:${receiptNo}`, W - PADDING, 80);

  ctx.fillStyle = INK;
  ctx.font = `22px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(`用户名称: ${userName}`, PADDING, 120);

  ctx.textAlign = 'right';
  ctx.fillText(date, W - PADDING, 120);

  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING, 148);
  ctx.lineTo(W - PADDING, 148);
  ctx.stroke();
  ctx.restore();
}

function drawTable(ctx, { rows, total, totalCN }) {
  ctx.save();
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.font = '22px sans-serif';
  ctx.textBaseline = 'middle';

  drawTableGrid(ctx);
  drawTableHeader(ctx);
  drawTableBody(ctx, rows);
  drawTableTotal(ctx, total, totalCN);
  ctx.restore();
}

function drawTableGrid(ctx) {
  const left = PADDING;
  const right = PADDING + COL_WIDTHS.reduce((a, b) => a + b, 0);
  ctx.lineWidth = 1;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  // 7 列的纵向分隔线
  for (let i = 0; i < COL_X.length; i++) {
    ctx.moveTo(COL_X[i], HEADER_Y);
    ctx.lineTo(COL_X[i], TABLE_BOTTOM);
  }
  // 右侧边框
  ctx.moveTo(right, HEADER_Y);
  ctx.lineTo(right, TABLE_BOTTOM);
  // 拆分行（row index 3）的中间竖线：col 3 左边界
  const splitRowY = HEADER_Y + ROW_H * 3;
  const splitRowBottom = HEADER_Y + ROW_H * 4;
  ctx.moveTo(COL_X[3], splitRowY);
  ctx.lineTo(COL_X[3], splitRowBottom);
  // 表头下边线
  ctx.moveTo(left, HEADER_Y + ROW_H);
  ctx.lineTo(right, HEADER_Y + ROW_H);
  // 每个数据行下边线
  for (let r = 1; r <= ROW_COUNT; r++) {
    const y = HEADER_Y + ROW_H * r;
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
  }
  // 合计行下边线
  ctx.moveTo(left, TABLE_BOTTOM);
  ctx.lineTo(right, TABLE_BOTTOM);
  ctx.stroke();
}

function drawTableHeader(ctx) {
  ctx.fillStyle = INK;
  ctx.font = `bold 22px ${FONT}`;
  ctx.textBaseline = 'middle';

  const cy = HEADER_Y + ROW_H / 2;
  TABLE_HEADERS.forEach((text, i) => {
    let x, align;
    if (i === 0) { x = COL_X[i] + 10; align = 'left'; }
    else if (i === 5) { x = COL_X[i] + COL_WIDTHS[i] - 10; align = 'right'; }
    else if (i === 6) { x = COL_X[i] + 10; align = 'left'; }
    else { x = (COL_X[i] + COL_X[i + 1]) / 2; align = 'center'; }
    ctx.textAlign = align;
    ctx.fillText(text, x, cy);
  });
}

function drawCell(ctx, text, colStart, span, align, bold) {
  const left = COL_X[colStart];
  const right = colStart + span < COL_X.length ? COL_X[colStart + span] : COL_X[COL_X.length - 1] + COL_WIDTHS[COL_WIDTHS.length - 1];
  const width = right - left;
  let x;
  if (align === 'left') x = left + 10;
  else if (align === 'right') x = right - 10;
  else x = left + width / 2;
  ctx.font = `${bold ? 'bold ' : ''}22px ${FONT}`;
  ctx.fillStyle = INK;
  ctx.textAlign = align;
  ctx.fillText(text || '', x, HEADER_Y + ROW_H * (currentRow + 1) + ROW_H / 2);
}

function drawTableBody(ctx, rows) {
  const today = new Date();
  const monthLabel = `${today.getFullYear()}年${today.getMonth() + 1}月份房租`;

  for (let r = 0; r < ROW_COUNT; r++) {
    currentRow = r;
    if (r < 3) {
      const row = rows[r];
      if (r === 2) {
        drawCell(ctx, row.label, 0, 1, 'left', false);
        drawCell(ctx, monthLabel, 1, 4, 'center', false);
        drawCell(ctx, row.amount, 5, 1, 'right', false);
      } else {
        drawCell(ctx, row.label, 0, 1, 'left', false);
        drawCell(ctx, row.prev, 1, 1, 'center', false);
        drawCell(ctx, row.curr, 2, 1, 'center', false);
        drawCell(ctx, row.usage, 3, 1, 'center', false);
        drawCell(ctx, row.unit, 4, 1, 'center', false);
        drawCell(ctx, row.amount, 5, 1, 'right', false);
      }
    } else {
      const garbage = rows[3];
      const internet = rows[4];
      drawCell(ctx, garbage.label, 0, 1, 'left', false);
      drawCell(ctx, garbage.amount, 1, 1, 'right', false);
      drawCell(ctx, internet.label, 3, 1, 'left', false);
      drawCell(ctx, internet.amount, 4, 1, 'right', false);
      const subtotal = (Number(garbage.amount) + Number(internet.amount)).toFixed(2);
      drawCell(ctx, subtotal, 5, 1, 'right', false);
    }
  }
}

function drawTableTotal(ctx, total, totalCN) {
  currentRow = ROW_COUNT;
  drawCell(ctx, `合计人民币（大写）: ${totalCN}`, 0, 5, 'left', false);
  ctx.font = `bold 24px ${FONT}`;
  ctx.fillStyle = INK;
  ctx.textAlign = 'right';
  const right = COL_X[6];
  ctx.fillText(`¥${total}`, right - 10, HEADER_Y + ROW_H * (currentRow + 1) + ROW_H / 2);
}

function drawSignature(ctx) {
  ctx.save();
  ctx.fillStyle = INK;
  ctx.font = `22px ${FONT}`;
  ctx.textBaseline = 'middle';

  const y = TABLE_BOTTOM + 80;
  ctx.textAlign = 'left';
  ctx.fillText('开票人:', PADDING, y);
  ctx.fillText('收款人:', W / 2, y);

  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING + 100, y + 18);
  ctx.lineTo(PADDING + 260, y + 18);
  ctx.moveTo(W / 2 + 100, y + 18);
  ctx.lineTo(W / 2 + 260, y + 18);
  ctx.stroke();
  ctx.restore();
}

function drawVerticalText(ctx) {
  ctx.save();
  ctx.fillStyle = INK;
  ctx.font = '20px sans-serif';
  ctx.textBaseline = 'middle';

  const cx = W - 25;
  const cyStart = HEADER_Y + 20;
  const lineH = 28;

  ctx.translate(cx, cyStart);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('存根(白)', 0, 0);
  ctx.fillText('客户(红)', 0, lineH);
  ctx.fillText('', 0, lineH * 2);
  ctx.restore();
}
