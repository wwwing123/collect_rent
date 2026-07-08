const PROPERTY_ADDRESS = '南东新村6巷92号';

const DIGITS = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
const UNITS = ['', '拾', '佰', '仟'];
export function getReceiptUserName(room) {
  if (!room) return PROPERTY_ADDRESS;
  if (room.code === '旧屋') return room.name || '';
  const code = room.code ? ` ${room.code}` : '';
  const name = room.name ? ` ${room.name}` : '';
  return `${PROPERTY_ADDRESS}${code}${name}`;
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

const W = 960;
const H = 530;
const PADDING = 70;
const TABLE_W = W - PADDING * 2;

const BG = '#fadade';
const INK = '#222';
const NO_COLOR = '#ff8c00';
const FONT = '"Microsoft YaHei", "微软雅黑", sans-serif';

const COL_WIDTHS = [175, 85, 85, 120, 75, 160, 120];
const COL_X = (() => {
  const xs = [PADDING];
  for (let i = 0; i < COL_WIDTHS.length; i++) xs.push(xs[i] + COL_WIDTHS[i]);
  return xs;
})();

const HEADER_Y = 145;
const ROW_H = 52;
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

// 哪些 (rowIdx, colX_idx) 在该行被合并，跳过竖线段
// rowIdx: 0=header, 1=water, 2=elec, 3=rent, 4=split, 5=total
// 当前布局：rent 描述跨 cols 1-4、split 垃圾费跨 cols 1-2 + 网络费跨 cols 4-5、total CN 跨 cols 0-4 + 金额跨 cols 5-6
const SKIP_VERTICALS = {
  3: [2, 3, 4],       // rent row: 描述跨 cols 1-4
  4: [2, 5],          // split row: 垃圾费跨 cols 1-2、网络费跨 cols 4-5
  5: [1, 2, 3, 4],    // total row: CN 跨 cols 0-4；col 5 金额 + col 6 备注都是独立格
};

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

  // 大标题：bold 38px，水平居中（W/2）
  ctx.font = `bold 38px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('收  据', W / 2, 60);

  // NO 编号：24px，右对齐，橙色
  ctx.fillStyle = NO_COLOR;
  ctx.font = `24px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(`NO:${receiptNo}`, W - PADDING, 60);

  // 用户名称行：label 不加粗，value/日期加粗
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  const labelText = '用户名称: ';
  ctx.font = `22px ${FONT}`;
  ctx.fillText(labelText, PADDING, 120);
  const labelW = ctx.measureText(labelText).width;
  ctx.font = `bold 22px ${FONT}`;
  ctx.fillText(userName, PADDING + labelW, 120);
  ctx.textAlign = 'right';
  ctx.font = `bold 22px ${FONT}`;
  ctx.fillText(date, W - PADDING, 120);

  // （删除 y=148 横线：让用户名称行紧凑贴近表格）
  ctx.restore();
}

function drawTable(ctx, { rows, total, totalCN }) {
  ctx.save();
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.font = `22px ${FONT}`;
  ctx.textBaseline = 'middle';

  drawTableGrid(ctx);
  drawTableHeader(ctx);
  drawTableBody(ctx, rows);
  drawTableTotal(ctx, total, totalCN);
  ctx.restore();
}

function drawTableGrid(ctx) {
  const left = PADDING;
  const right = PADDING + TABLE_W;
  ctx.lineWidth = 1;
  ctx.strokeStyle = INK;
  ctx.beginPath();

  // ── 横线 ──
  // 表格顶边（跨整宽）
  ctx.moveTo(left, HEADER_Y);
  ctx.lineTo(right, HEADER_Y);
  // 表头下边 = 合并备注格的顶部边界（跨整宽）
  ctx.moveTo(left, HEADER_Y + ROW_H);
  ctx.lineTo(right, HEADER_Y + ROW_H);
  // 其余内部横线（不跨备注 col 6）
  for (let r = 2; r <= ROW_COUNT + 1; r++) {
    const y = HEADER_Y + ROW_H * r;
    ctx.moveTo(left, y);
    ctx.lineTo(COL_X[6], y);
  }
  // 合计行下边（跨整宽）
  ctx.moveTo(left, TABLE_BOTTOM);
  ctx.lineTo(right, TABLE_BOTTOM);

  // ── 纵线（修复 bug B：合并区竖线按行跳过） ──
  for (let i = 0; i < COL_X.length; i++) {
    const x = COL_X[i];
    let prevY = HEADER_Y;
    for (let r = 0; r <= ROW_COUNT + 1; r++) {
      const y = HEADER_Y + ROW_H * (r + 1);
      const skip = SKIP_VERTICALS[r] && SKIP_VERTICALS[r].includes(i);
      if (!skip) {
        ctx.moveTo(x, prevY);
        ctx.lineTo(x, y);
      }
      prevY = y;
    }
  }

  ctx.stroke();
}

function drawTableHeader(ctx) {
  ctx.fillStyle = INK;
  ctx.font = `bold 20px ${FONT}`;
  ctx.textBaseline = 'middle';

  const cy = HEADER_Y + ROW_H / 2;
  TABLE_HEADERS.forEach((text, i) => {
    let x, align;
    if (i === 0) { x = COL_X[i] + 10; align = 'left'; }
    else if (i === 5) { x = COL_X[i] + COL_WIDTHS[i] - 10; align = 'right'; }
    else if (i === 6) { x = (COL_X[i] + COL_X[i + 1]) / 2; align = 'center'; }
    else { x = (COL_X[i] + COL_X[i + 1]) / 2; align = 'center'; }
    ctx.textAlign = align;
    ctx.fillText(text, x, cy);
  });
}

function drawCell(ctx, text, colStart, span, align, bold, rowIdx, fontSize = 20) {
  const left = COL_X[colStart];
  const right = colStart + span < COL_X.length ? COL_X[colStart + span] : PADDING + TABLE_W;
  const width = right - left;
  let x;
  const padL = 14, padR = 14;  // 10→14
  if (align === 'left') x = left + padL;
  else if (align === 'right') x = right - padR;
  else x = left + width / 2;
  ctx.font = `${bold ? 'bold ' : ''}${fontSize}px ${FONT}`;
  ctx.fillStyle = INK;
  ctx.textAlign = align;
  const r = rowIdx === undefined ? currentRow : rowIdx;
  ctx.fillText(text || '', x, HEADER_Y + ROW_H * (r + 1) + ROW_H / 2);
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
      // （小计已移除：col 6 留给备注的合并格）
    }
  }
}

function drawTableTotal(ctx, total, totalCN) {
  currentRow = ROW_COUNT;
  // CN 大写文字：cols 0-4（span 5），左对齐，bold
  drawCell(ctx, `合计人民币（大写）: ${totalCN}`, 0, 5, 'left', true, ROW_COUNT);
  // ¥金额：col 5（span 1），右对齐，bold 22px
  drawCell(ctx, `¥${total}`, 5, 1, 'right', true, ROW_COUNT, 22);
}

function drawSignature(ctx) {
  ctx.save();
  ctx.fillStyle = INK;
  ctx.font = `18px ${FONT}`;
  ctx.textBaseline = 'middle';

  const y = TABLE_BOTTOM + 30;  // SIG_GAP = 30
  ctx.textAlign = 'left';
  ctx.fillText('开票人:', PADDING, y);
  // 收款人靠最右：label 起始 x = W - PADDING - 260，下划线延伸到 W - PADDING
  ctx.fillText('收款人:', W - PADDING - 260, y);

  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  // 开票人下划线
  ctx.moveTo(PADDING + 100, y + 18);
  ctx.lineTo(PADDING + 260, y + 18);
  // 收款人下划线（靠最右）
  ctx.moveTo(W - PADDING - 160, y + 18);
  ctx.lineTo(W - PADDING, y + 18);
  ctx.stroke();
  ctx.restore();
}

function drawVerticalText(ctx) {
  ctx.save();
  ctx.fillStyle = INK;
  ctx.font = `20px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  const cx = W - 25;
  const cyStart = HEADER_Y + 20;
  const lineH = 20;
  const groupGap = 30;  // 两组之间的额外间隙
  // 字符顺序：存根（白） 客户（红）
  const chars = ['存', '根', '（', '白', '）', '客', '户', '（', '红', '）'];

  chars.forEach((char, i) => {
    let offset = i * lineH;
    if (i >= 5) offset += groupGap;  // 第二组往下多空 groupGap
    ctx.fillText(char, cx, cyStart + offset);
  });
  ctx.restore();
}
