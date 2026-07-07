# 收据导出图片格式重设计 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `miniprogram/utils/receipt.js` 的 Canvas 渲染逻辑重写，使其与房东提供的纸质收据扫描图 `shouju.png` 视觉一致。

**Architecture:** 不引入新数据字段（沿用现有 `water_fee / elec_fee / rent / garbage_fee / internet_fee`），仅重写 Canvas 绘制函数。数据层 `buildReceiptData` 增加 `usage` 字段（= curr − prev），给水/电行使用。绘制层采用"行驱动 + 单元格对象"抽象，让 7 列布局、合并单元格、拆分行等需求都通过结构化数据表达而非硬编码坐标。视觉常量集中放在文件顶部以便后期调整。

**Tech Stack:**
- 微信小程序 Canvas 2D
- Node.js `node:test`（仅测数据层纯函数）
- ES Modules (`import` / `export`)

**Spec:** `docs/superpowers/specs/2026-07-07-receipt-image-redesign-design.md`

**File Structure:**

```
miniprogram/
├── utils/
│   ├── receipt.js              # 修改：数据层 + 绘制层重写
│   └── receipt.test.js         # 修改：覆盖新结构
├── pages/receipt/preview/
│   ├── index.js                # 修改：RECEIPT_W / RECEIPT_H 常量
│   └── index.wxss              # 修改：canvas 背景色 + 高度
package.json                    # 修改：test 脚本加入 receipt.test.js
```

---

## Task 1: 把 receipt.test.js 加入 npm test 脚本

**Files:**
- Modify: `package.json:6-8`

- [ ] **Step 1: 确认当前 test 脚本**

读 `package.json` 第 6-8 行，确认是 `"test": "node --test miniprogram/utils/billing.test.js"`。

- [ ] **Step 2: 修改 test 脚本**

在 `package.json` 里把 `scripts.test` 改成包含两个测试文件：

```json
"test": "node --test miniprogram/utils/billing.test.js miniprogram/utils/receipt.test.js"
```

- [ ] **Step 3: 跑测试确认通过**

Run: `npm test`
Expected: 两个 test 文件都跑通，所有测试 PASS。

- [ ] **Step 4: 提交**

```bash
git add package.json
git commit -m "chore(test): include receipt.test.js in npm test"
```

---

## Task 2: 在 buildReceiptData 中给水/电行增加 usage 字段

**Files:**
- Modify: `miniprogram/utils/receipt.js:64-85` (`buildReceiptData` 函数)
- Modify: `miniprogram/utils/receipt.test.js:81-121` (`buildReceiptData: 完整账单` 测试)

- [ ] **Step 1: 在 `receipt.test.js` 里加新断言**

在 `buildReceiptData: 完整账单（含上期）` 测试里，在第 105 行（`assert.equal(water.amount, '108.00')`）之后插入：

```js
assert.equal(water.usage, '17');
```

（676 − 659 = 17。注意 curr(676) − prev(659)，不是反过来。）

同样在第 112 行（`assert.equal(elec.amount, '314.17')`）之后插入：

```js
assert.equal(elec.usage, '352');
```

（11979 − 11627 = 352。）

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test`
Expected: FAIL，错误信息包含 `water.usage` 或 `elec.usage`，因为当前 `row` 对象没有 `usage` 字段。

- [ ] **Step 3: 在 `buildReceiptData` 中实现 usage 计算**

修改 `miniprogram/utils/receipt.js` 的 `buildReceiptData` 函数。在 `hasUsage` 分支里加一行计算 `usage`。把：

```js
if (hasUsage && bill) {
  const currReading = key === 'water_fee' ? bill.water_reading : bill.elec_reading;
  const prevReading = key === 'water_fee' ? prevBill?.water_reading : prevBill?.elec_reading;
  if (typeof currReading === 'number') row.curr = String(currReading);
  if (typeof prevReading === 'number') row.prev = String(prevReading);
  const unit = key === 'water_fee' ? room?.water_unit_price : room?.elec_unit_price;
  if (typeof unit === 'number') row.unit = formatAmount(unit);
}
```

改成：

```js
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
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add miniprogram/utils/receipt.js miniprogram/utils/receipt.test.js
git commit -m "feat(receipt): add usage field to water/elec rows in buildReceiptData"
```

---

## Task 3: 更新 receipt.js 顶部常量（画布尺寸、列宽、字体、颜色）

**Files:**
- Modify: `miniprogram/utils/receipt.js:87-104`（顶部常量块）

- [ ] **Step 1: 替换常量块**

把 `miniprogram/utils/receipt.js` 第 87-104 行（从 `const W = 900;` 到 `const TABLE_BOTTOM = ...;`）整段替换为：

```js
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
```

注意：
- `RECEIPT_ROWS` 数组里实际渲染 5 行数据（水/电/租金/垃圾费/网络费），但垃圾费+网络费合并成视觉上的 1 行，所以 `ROW_COUNT = 4`。
- `TABLE_BOTTOM` 计算 `HEADER_Y + ROW_H * (4 + 2)` = `175 + 228` = `403`，对应表头 + 4 数据行 + 1 合计行 = 6 行总高度。

- [ ] **Step 2: 跑测试确认通过**

Run: `npm test`
Expected: PASS（改动不影响数据层函数）。

- [ ] **Step 3: 提交**

```bash
git add miniprogram/utils/receipt.js
git commit -m "refactor(receipt): update canvas size, column widths, fonts and colors"
```

---

## Task 4: 重写 drawBackground 与 drawHeader

**Files:**
- Modify: `miniprogram/utils/receipt.js:114-148`（`drawBackground` + `drawHeader`）

- [ ] **Step 1: 重写 drawBackground**

把 `drawBackground` 函数整个替换为：

```js
function drawBackground(ctx) {
  ctx.save();
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
```

（与原实现基本相同，仅使用更新后的 `BG` 常量。无功能变化。）

- [ ] **Step 2: 重写 drawHeader**

把 `drawHeader` 函数整个替换为：

```js
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
```

注意 `NO:` 标签颜色用 `NO_COLOR`（橙色），其他文字用 `INK`（深灰）。

- [ ] **Step 3: 提交**

```bash
git add miniprogram/utils/receipt.js
git commit -m "feat(receipt): rewrite drawHeader with SimSun font and orange NO label"
```

---

## Task 5: 重写 drawTableGrid（7 列 + 拆分行中间竖线）

**Files:**
- Modify: `miniprogram/utils/receipt.js:164-183`（`drawTableGrid` 函数）

- [ ] **Step 1: 重写 drawTableGrid**

把 `drawTableGrid` 函数整个替换为：

```js
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
```

注意：
- 7 列纵线由 `COL_X` 自动生成（7 个左边界）
- 显式画右侧边框（因为 `COL_X` 不包含最右）
- 拆分行（垃圾费+网络费）的中间竖线在 `COL_X[3]` 处

- [ ] **Step 2: 提交**

```bash
git add miniprogram/utils/receipt.js
git commit -m "feat(receipt): draw 7-column grid with middle divider for split row"
```

---

## Task 6: 重写 drawTableHeader（7 列表头）

**Files:**
- Modify: `miniprogram/utils/receipt.js:185-196`（`drawTableHeader` 函数）

- [ ] **Step 1: 重写 drawTableHeader**

把 `drawTableHeader` 函数整个替换为：

```js
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
```

注意：
- 0 列（项 目）左对齐
- 5 列（金额小计）右对齐（数字贴近右边线）
- 6 列（备 注）左对齐
- 其他列居中

- [ ] **Step 2: 提交**

```bash
git add miniprogram/utils/receipt.js
git commit -m "feat(receipt): draw 7-column header row"
```

---

## Task 7: 实现 drawCell 通用渲染函数

**Files:**
- Modify: `miniprogram/utils/receipt.js`（在 `drawTableHeader` 之后插入新函数）

- [ ] **Step 1: 添加 drawCell 函数**

在 `drawTableHeader` 函数体结束后，紧接着插入：

```js
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
```

注意：`currentRow` 是模块级变量，由 `drawTableBody` 在迭代每行前赋值。这样 `drawCell` 能自动知道自己在哪一行。

- [ ] **Step 2: 在 drawTable 之前声明 currentRow 变量**

在 `HEADER_Y` / `ROW_H` 等常量之后、`drawReceipt` 函数之前，添加：

```js
let currentRow = 0;
```

这是模块级 let，供 `drawCell` 在渲染每行时读取当前行号。

- [ ] **Step 3: 提交**

```bash
git add miniprogram/utils/receipt.js
git commit -m "feat(receipt): add drawCell helper for row-driven cell rendering"
```

---

## Task 8: 重写 drawTableBody（水费/电费/租金/拆分行）

**Files:**
- Modify: `miniprogram/utils/receipt.js:198-211`（`drawTableBody` 函数）

- [ ] **Step 1: 重写 drawTableBody**

把 `drawTableBody` 函数整个替换为：

```js
function drawTableBody(ctx, rows) {
  const today = new Date();
  const monthLabel = `${today.getFullYear()}年${today.getMonth() + 1}月份房租`;

  for (let r = 0; r < ROW_COUNT; r++) {
    currentRow = r;
    if (r < 3) {
      // 水费 / 电费 / 租金 三行
      const row = rows[r];
      if (r === 2) {
        // 租金行：项目 + 合并描述 + 金额
        drawCell(ctx, row.label, 0, 1, 'left', false);
        drawCell(ctx, monthLabel, 1, 4, 'center', false);
        drawCell(ctx, row.amount, 5, 1, 'right', false);
      } else {
        // 水费 / 电费
        drawCell(ctx, row.label, 0, 1, 'left', false);
        drawCell(ctx, row.prev, 1, 1, 'center', false);
        drawCell(ctx, row.curr, 2, 1, 'center', false);
        drawCell(ctx, row.usage, 3, 1, 'center', false);
        drawCell(ctx, row.unit, 4, 1, 'center', false);
        drawCell(ctx, row.amount, 5, 1, 'right', false);
      }
    } else {
      // 拆分行：垃圾费 + 网络费
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
```

注意：
- 描述文字"2026年7月份房租"基于 `new Date()` 计算（与 `today` 参数同源）
- 合并单元格通过 `colStart + span` 跨越多列
- 拆分行的小计 = 垃圾费金额 + 网络费金额
- 拆分行 col 2 是空的（视觉上由网格的竖线分隔两半）

- [ ] **Step 2: 提交**

```bash
git add miniprogram/utils/receipt.js
git commit -m "feat(receipt): rewrite table body with row-driven cells + split row"
```

---

## Task 9: 重写 drawTableTotal（合计行）

**Files:**
- Modify: `miniprogram/utils/receipt.js:213-220`（`drawTableTotal` 函数）

- [ ] **Step 1: 重写 drawTableTotal**

把 `drawTableTotal` 函数整个替换为：

```js
function drawTableTotal(ctx, total, totalCN) {
  currentRow = ROW_COUNT; // 合计行
  drawCell(ctx, `合计人民币（大写）: ${totalCN}`, 0, 5, 'left', false);
  ctx.font = `bold 24px ${FONT}`;
  ctx.fillStyle = INK;
  ctx.textAlign = 'right';
  const right = COL_X[6];
  ctx.fillText(`¥${total}`, right - 10, HEADER_Y + ROW_H * (currentRow + 1) + ROW_H / 2);
}
```

注意：
- 合计行在数据行（ROW_COUNT=4）之后，所以 `currentRow = ROW_COUNT` = 4
- 中文大写文字从 col 0 跨到 col 5（span=5），右对齐 ¥金额放在 col 5
- ¥金额加粗 24px

- [ ] **Step 2: 提交**

```bash
git add miniprogram/utils/receipt.js
git commit -m "feat(receipt): rewrite total row layout (text spans left, amount right)"
```

---

## Task 10: 重写 drawSignature（只画下划线，不写字）

**Files:**
- Modify: `miniprogram/utils/receipt.js:222-242`（`drawSignature` 函数）

- [ ] **Step 1: 重写 drawSignature**

把 `drawSignature` 函数整个替换为：

```js
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
```

注意：
- 移除了"开票人:"后方的原来下划线（`y + 2`）位置，改成 `y + 18` 留出与文字的间距
- 不在收款人下方写"Lucky"等任何文字
- 下划线长度 160 单位

- [ ] **Step 2: 提交**

```bash
git add miniprogram/utils/receipt.js
git commit -m "feat(receipt): signature with underline only (no handwritten text)"
```

---

## Task 11: 重写 drawVerticalText（使用 SimSun 字体）

**Files:**
- Modify: `miniprogram/utils/receipt.js:244-261`（`drawVerticalText` 函数）

- [ ] **Step 1: 重写 drawVerticalText**

把 `drawVerticalText` 函数整个替换为：

```js
function drawVerticalText(ctx) {
  ctx.save();
  ctx.fillStyle = INK;
  ctx.font = `20px ${FONT}`;
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
```

注意：与原实现基本相同，仅字体改用 `FONT` 常量。无功能变化。

- [ ] **Step 2: 提交**

```bash
git add miniprogram/utils/receipt.js
git commit -m "feat(receipt): vertical text uses SimSun font"
```

---

## Task 12: 更新 preview 页常量与 CSS

**Files:**
- Modify: `miniprogram/pages/receipt/preview/index.js:5-6`（`RECEIPT_W` / `RECEIPT_H`）
- Modify: `miniprogram/pages/receipt/preview/index.wxss:24-29`（`.receipt-canvas` 样式）

- [ ] **Step 1: 更新 index.js 的尺寸常量**

把 `miniprogram/pages/receipt/preview/index.js` 第 5-6 行：

```js
const RECEIPT_W = 900;
const RECEIPT_H = 600;
```

改成：

```js
const RECEIPT_W = 900;
const RECEIPT_H = 560;
```

- [ ] **Step 2: 更新 index.wxss 的 canvas 样式**

把 `miniprogram/pages/receipt/preview/index.wxss` 第 24-29 行（`.receipt-canvas` 块）：

```css
.receipt-canvas {
  width: 670rpx;
  height: 447rpx;
  background: #fce4d6;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.08);
}
```

改成：

```css
.receipt-canvas {
  width: 670rpx;
  height: 417rpx;
  background: #fadade;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.08);
}
```

注意：
- 高度从 447rpx 改为 417rpx，保持与新 RECEIPT_H=560 的宽高比（670/900 ≈ 0.744, 417/560 ≈ 0.745）
- 背景色从 `#fce4d6` 改为 `#fadade`

- [ ] **Step 3: 提交**

```bash
git add miniprogram/pages/receipt/preview/index.js miniprogram/pages/receipt/preview/index.wxss
git commit -m "feat(receipt): preview page canvas size and background color"
```

---

## Task 13: 手动视觉验证

**Files:**
- No code changes; verification only.

- [ ] **Step 1: 跑全部测试**

Run: `npm test`
Expected: 所有测试 PASS（billing.test.js + receipt.test.js）。

- [ ] **Step 2: 在微信开发者工具里预览**

1. 打开微信开发者工具，加载 `d:\snc_wai\collect_rent` 项目
2. 编译并运行
3. 进入"首页" → 选择任意有账单的月份 → 进入任意房间 → 点击"收据"入口
4. 进入 `pages/receipt/preview` 页面
5. 对照 `shouju.png` 视觉检查以下点：
   - 背景色：`#fadade`（与图片接近的浅粉色）
   - 标题"收  据"加粗居中
   - "NO:XXXXXX" 在右侧为橙色
   - 表格有 7 列：项目/上月/本月/实用/单价/金额小计/备注
   - 水费/电费行的"实用"列显示本月−上月的差值
   - 租金行中间合并单元格写"YYYY年M月份房租"
   - 倒数第二行（拆分行）左半"垃圾费(元)" + 金额，右半"网络费(元)" + 金额，金额小计列 = 两者之和，中间有竖线
   - 最末行：左半"合计人民币（大写）：XXX圆整"，右半"¥XXX.XX"加粗
   - 底部"开票人:"和"收款人:"后只有下划线，没有文字
   - 右侧竖排"存根(白) / 客户(红)"

- [ ] **Step 3: 测试保存到相册**

1. 在预览页点击"保存到相册"
2. 允许相册权限
3. 打开手机相册，确认图片已保存
4. 视觉检查与步骤 2 一致

- [ ] **Step 4: 测试分享**

1. 在预览页点击"发送给朋友"
2. 选择任意好友
3. 检查分享卡片的缩略图是否正常显示收据内容

- [ ] **Step 5: 提交（如有调整）**

如果步骤 2-4 发现问题，回到对应 Task 修改后提交。如果没有调整则跳过此步。

---

## 验收标准

- 生成的 PNG 与 `shouju.png` 在以下方面一致：
  - 列数（7 列）
  - 行数（表头 + 水费 + 电费 + 租金 + 拆分行 + 合计 = 6 行）
  - 合并单元格位置（租金行的描述文本、合计行的中文大写）
  - 拆分行布局（垃圾费 + 网络费 + 中间竖线 + 右侧小计）
  - 颜色（背景 `#fadade`、NO: `#ff8c00`）
  - 字体（SimSun 宋体）
- 现有 `npm test` 通过
- "保存到相册"与"分享给朋友"两条已有路径功能不变