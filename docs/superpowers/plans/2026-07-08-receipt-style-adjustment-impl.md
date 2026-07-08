# 收据样式微调 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `miniprogram/utils/receipt.js` 的渲染逻辑和画布尺寸按 [2026-07-08-receipt-style-adjustment-design.md](../specs/2026-07-08-receipt-style-adjustment-design.md) 改造，使导出的收据 PNG 与 [docs/preview-receipt.html](../../preview-receipt.html) 的 AFTER 画布视觉一致。

**Architecture:** 数据层（`getReceiptUserName`）TDD 先行；渲染层（`drawXxx` 系列）按"先常量后函数"顺序逐个改写；每个函数改写后人工对照预览 HTML 验证。所有几何常量（`W` / `H` / `PADDING` / `COL_WIDTHS` / `HEADER_Y` / `TITLE_Y` / `TITLE_SIZE` / `SIG_GAP` / `SIG_RIGHT_LABEL_X` / `FONT`）集中放在文件顶部。

**Tech Stack:** WeChat Mini Program Canvas 2D API、Node.js `node --test` 测试运行器、纯 HTML/Canvas 预览（无构建工具）。

---

## File Structure

| 文件 | 角色 | 改动类型 |
|---|---|---|
| `miniprogram/utils/receipt.js` | 收据渲染核心（数据 + 画布绘制） | 修改 |
| `miniprogram/utils/receipt.test.js` | 单元测试（覆盖数据层函数） | 修改 |
| `miniprogram/pages/receipt/preview/index.js` | 预览页（持有画布尺寸常量） | 修改（5-6 行） |
| `docs/preview-receipt.html` | BEFORE/AFTER 可视化对照（不部署，仅设计评审用） | 不动 |

---

## Task 1: 修复 `getReceiptUserName`（TDD）

**Files:**
- Modify: `miniprogram/utils/receipt.test.js:12-25`
- Modify: `miniprogram/utils/receipt.js:5-10`

- [ ] **Step 1: 写失败的测试（更新现有 test 1 + test 3）**

修改 `miniprogram/utils/receipt.test.js`：

```js
test('getReceiptUserName: 普通房间 拼接房号', () => {
  const room = { code: '101', name: 'A栋403房' };
  assert.equal(getReceiptUserName(room), '南东新村6巷92号 101 A栋403房');
});

test('getReceiptUserName: 旧屋 只用 room.name', () => {
  const room = { code: '旧屋', name: '朗枝岗170号' };
  assert.equal(getReceiptUserName(room), '朗枝岗170号');
});

test('getReceiptUserName: 普通房间 name 为空时只拼接房号', () => {
  const room = { code: '101', name: '' };
  assert.equal(getReceiptUserName(room), '南东新村6巷92号 101');
});

test('getReceiptUserName: room 为空时返回默认地址', () => {
  assert.equal(getReceiptUserName(null), '南东新村6巷92号');
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npm test
```

预期：test 1 和 test 3 失败，因为当前实现只拼 `name` 不拼 `code`。失败信息形如 `AssertionError: '南东新村6巷92号 A栋403房' === '南东新村6巷92号 101 A栋403房'`。

- [ ] **Step 3: 修 `getReceiptUserName`**

修改 `miniprogram/utils/receipt.js:5-10`：

```js
export function getReceiptUserName(room) {
  if (!room) return PROPERTY_ADDRESS;
  if (room.code === '旧屋') return room.name || '';
  const code = room.code ? ` ${room.code}` : '';
  const name = room.name ? ` ${room.name}` : '';
  return `${PROPERTY_ADDRESS}${code}${name}`;
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
npm test
```

预期：所有 4 条 `getReceiptUserName` 测试通过。

- [ ] **Step 5: 提交**

```bash
git add miniprogram/utils/receipt.js miniprogram/utils/receipt.test.js
git commit -m "fix(receipt): include room.code in getReceiptUserName output"
```

---

## Task 2: 更新画布尺寸常量（`preview/index.js`）

**Files:**
- Modify: `miniprogram/pages/receipt/preview/index.js:5-6`

- [ ] **Step 1: 改 `RECEIPT_W` 和 `RECEIPT_H`**

修改 `miniprogram/pages/receipt/preview/index.js:5-6`：

```js
const RECEIPT_W = 930;
const RECEIPT_H = 460;
```

- [ ] **Step 2: 确认没有其他引用需要改**

```bash
grep -rn "RECEIPT_W\|RECEIPT_H" miniprogram/
```

预期：只匹配到 `index.js:5/6`（常量定义）和 `index.js:63/64`（canvas.width/height 赋值），无需其他改动。

- [ ] **Step 3: 跑测试确认无回归**

```bash
npm test
```

预期：所有现有测试仍然通过（这次改动只影响画布尺寸，对纯数据函数无影响）。

- [ ] **Step 4: 提交**

```bash
git add miniprogram/pages/receipt/preview/index.js
git commit -m "chore(receipt): resize canvas to 930x460 per design spec"
```

---

## Task 3: 更新 `receipt.js` 几何与样式常量

**Files:**
- Modify: `miniprogram/utils/receipt.js:81-111`

只动常量定义，不动函数体。改完所有 `drawXxx` 函数的视觉输出都会跟着变。

- [ ] **Step 1: 改 `W`、`H`、`PADDING`、`BG`、`INK`、`NO_COLOR`、`FONT`**

修改 `miniprogram/utils/receipt.js:81-89`：

```js
const W = 930;
const H = 460;
const PADDING = 70;
const TABLE_W = W - PADDING * 2;

const BG = '#fadade';
const INK = '#222';
const NO_COLOR = '#ff8c00';
const FONT = '"Microsoft YaHei", "微软雅黑", sans-serif';
```

- [ ] **Step 2: 改列宽和 `COL_X`**

修改 `miniprogram/utils/receipt.js:91-96`：

```js
const COL_WIDTHS = [175, 85, 85, 120, 75, 160, 90];
const COL_X = (() => {
  const xs = [PADDING];
  for (let i = 0; i < COL_WIDTHS.length; i++) xs.push(xs[i] + COL_WIDTHS[i]);
  return xs;
})();
```

- [ ] **Step 3: 改 `HEADER_Y`、`ROW_H`、`ROW_COUNT`、`TABLE_HEADERS`、`TABLE_BOTTOM`**

修改 `miniprogram/utils/receipt.js:98-103`：

```js
const HEADER_Y = 145;
const ROW_H = 38;
const TABLE_HEADERS = ['项 目', '上 月', '本 月', '实 用', '单 价', '金额小计(元)', '备 注'];
const ROW_COUNT = 4; // 水费 / 电费 / 租金 / 拆分行(垃圾费+网络费)
const TABLE_BOTTOM = HEADER_Y + ROW_H * (ROW_COUNT + 2); // +2 = header row + total row
```

- [ ] **Step 4: 跑测试确认无回归**

```bash
npm test
```

预期：所有现有测试仍然通过（`getReceiptUserName` 已修复，列宽变化不影响纯数据函数）。

- [ ] **Step 5: 提交**

```bash
git add miniprogram/utils/receipt.js
git commit -m "refactor(receipt): update geometry constants per design spec"
```

---

## Task 4: 重写 `drawTableGrid`（顶部横线 + 合并区竖线跳过 + 拆分行下边）

**Files:**
- Modify: `miniprogram/utils/receipt.js:174-206`（`drawTableGrid` 函数）
- Insert before `drawTableGrid`: 在 `RECEIPT_ROWS` 定义之后插入 `SKIP_VERTICALS`

- [ ] **Step 1: 添加 `SKIP_VERTICALS` 常量**

在 `miniprogram/utils/receipt.js` 的 `RECEIPT_ROWS` 定义（`[104-110]`）之后、`let currentRow = 0;`（`[112]`）之前，插入：

```js
// 哪些 (rowIdx, colX_idx) 在该行被合并，跳过竖线段
// rowIdx: 0=header, 1=water, 2=elec, 3=rent, 4=split, 5=total
// 当前布局：rent 描述跨 cols 1-4、split 垃圾费跨 cols 1-2 + 网络费跨 cols 4-5、total CN 跨 cols 0-4 + 金额跨 cols 5-6
const SKIP_VERTICALS = {
  3: [2, 3, 4],       // rent row: 描述跨 cols 1-4
  4: [2, 5],          // split row: 垃圾费跨 cols 1-2、网络费跨 cols 4-5
  5: [1, 2, 3, 4, 6], // total row: CN 跨 cols 0-4、金额跨 cols 5-6
};
```

- [ ] **Step 2: 重写 `drawTableGrid` 函数**

替换 `miniprogram/utils/receipt.js:174-206` 的 `drawTableGrid` 整段函数体：

```js
function drawTableGrid(ctx) {
  const left = PADDING;
  const right = PADDING + TABLE_W;
  ctx.lineWidth = 1;
  ctx.strokeStyle = INK;
  ctx.beginPath();

  // ── 横线（修复 bug A：补顶部；修复 bug C：补拆分行下边） ──
  // 表格顶边
  ctx.moveTo(left, HEADER_Y);
  ctx.lineTo(right, HEADER_Y);
  // 表头下边
  ctx.moveTo(left, HEADER_Y + ROW_H);
  ctx.lineTo(right, HEADER_Y + ROW_H);
  // 每个数据行下边（包括拆分行 = r=ROW_COUNT+1）
  for (let r = 1; r <= ROW_COUNT + 1; r++) {
    const y = HEADER_Y + ROW_H * r;
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
  }
  // 合计行下边
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
```

- [ ] **Step 3: 跑测试确认无回归**

```bash
npm test
```

预期：所有现有测试仍然通过（`drawTableGrid` 是渲染层，不被现有数据层测试覆盖，但语法错误会让 `import` 失败）。

- [ ] **Step 4: 视觉对照**

打开浏览器双击 [docs/preview-receipt.html](../../preview-receipt.html)，AFTER 画布的表格区应满足：
- 顶部有完整横线
- 7 条横线齐全（顶、HEADER 下、water 下、elec 下、rent 下、split 下、total 下）
- 租金行中间 3 条竖线（col 2/3/4）消失
- 拆分行只剩 col 3 中线，其他合并区竖线消失
- 合计行 col 1/2/3/4/6 竖线消失，col 0/5/7 保留

- [ ] **Step 5: 提交**

```bash
git add miniprogram/utils/receipt.js
git commit -m "fix(receipt): add top line, skip merged-cell verticals, add split-row bottom line"
```

---

## Task 5: 重写 `drawHeader`（标题位置/字号 + 移除横线 + subtitle 拆 3 段）

**Files:**
- Modify: `miniprogram/utils/receipt.js:129-158`（`drawHeader` 函数）

- [ ] **Step 1: 重写 `drawHeader` 函数**

替换 `miniprogram/utils/receipt.js:129-158` 的 `drawHeader` 整段函数体：

```js
function drawHeader(ctx, { userName, receiptNo, date }) {
  ctx.save();
  ctx.fillStyle = INK;
  ctx.textBaseline = 'middle';

  // 大标题：bold 40px，水平居中（W/2）
  ctx.font = `bold 40px ${FONT}`;
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
```

- [ ] **Step 2: 跑测试确认无回归**

```bash
npm test
```

预期：所有现有测试仍然通过。

- [ ] **Step 3: 视觉对照**

打开 [docs/preview-receipt.html](../../preview-receipt.html)，AFTER 画布的标题区应满足：
- "收  据" 水平居中，40px 加粗
- NO 编号靠右，橙色
- "用户名称:" 不加粗，地址房号"南东新村6巷92号 101"加粗，日期"2026年6月30日"加粗
- 用户名称行下方无横线
- 用户名称行与表格之间紧凑（25px 左右）

- [ ] **Step 4: 提交**

```bash
git add miniprogram/utils/receipt.js
git commit -m "feat(receipt): center title at 40px, restructure subtitle bold/no-line"
```

---

## Task 6: 重写 `drawTableTotal`（CN 跨 5 列加粗 + 金额跨 cols 5-6）

**Files:**
- Modify: `miniprogram/utils/receipt.js:272-280`（`drawTableTotal` 函数）

- [ ] **Step 1: 重写 `drawTableTotal` 函数**

替换 `miniprogram/utils/receipt.js:272-280` 的 `drawTableTotal` 整段函数体：

```js
function drawTableTotal(ctx, total, totalCN) {
  currentRow = ROW_COUNT;
  // CN 大写文字：cols 0-4（span 5），左对齐，bold
  drawCell(ctx, `合计人民币（大写）: ${totalCN}`, 0, 5, 'left', true, ROW_COUNT);
  // ¥金额：cols 5-6（span 2），右对齐，bold 24px
  drawCell(ctx, `¥${total}`, 5, 2, 'right', true, ROW_COUNT, 24);
}
```

- [ ] **Step 2: 跑测试确认无回归**

```bash
npm test
```

预期：所有现有测试仍然通过。

- [ ] **Step 3: 视觉对照**

打开 [docs/preview-receipt.html](../../preview-receipt.html)，AFTER 画布的合计行应满足：
- "合计人民币（大写）: 壹仟捌佰叁拾柒.壹柒圆整" 跨 5 列（左到 col 4 右边），加粗，左对齐
- "¥1837.17" 在 cols 5-6 右对齐，bold 24px
- 合计行 col 1/2/3/4/6 竖线已隐藏（由 Task 4 的 SKIP_VERTICALS 处理）

- [ ] **Step 4: 提交**

```bash
git add miniprogram/utils/receipt.js
git commit -m "feat(receipt): total row CN spans 5 cols bold, amount in cols 5-6"
```

---

## Task 7: 重写 `drawVerticalText`（逐字正立，组间空隙 30px）

**Files:**
- Modify: `miniprogram/utils/receipt.js:304-321`（`drawVerticalText` 函数）

- [ ] **Step 1: 重写 `drawVerticalText` 函数**

替换 `miniprogram/utils/receipt.js:304-321` 的 `drawVerticalText` 整段函数体：

```js
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
```

- [ ] **Step 2: 跑测试确认无回归**

```bash
npm test
```

预期：所有现有测试仍然通过。

- [ ] **Step 3: 视觉对照**

打开 [docs/preview-receipt.html](../../preview-receipt.html)，AFTER 画布的最右侧应满足：
- 10 个字符从 `HEADER_Y + 20 = 165` 开始向下逐字堆叠
- 每个字正立（不旋转）
- "存根（白）"和"客户（红）"之间有 30px 额外空隙
- 字符依次是：存 / 根 / （ / 白 / ） / [空 30px] / 客 / 户 / （ / 红 / ）

- [ ] **Step 4: 提交**

```bash
git add miniprogram/utils/receipt.js
git commit -m "fix(receipt): vertical text renders char-by-char upright with group gap"
```

---

## Task 8: 重写 `drawSignature`（收款人靠最右）

**Files:**
- Modify: `miniprogram/utils/receipt.js:282-302`（`drawSignature` 函数）

- [ ] **Step 1: 重写 `drawSignature` 函数**

替换 `miniprogram/utils/receipt.js:282-302` 的 `drawSignature` 整段函数体：

```js
function drawSignature(ctx) {
  ctx.save();
  ctx.fillStyle = INK;
  ctx.font = `22px ${FONT}`;
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
```

- [ ] **Step 2: 跑测试确认无回归**

```bash
npm test
```

预期：所有现有测试仍然通过。

- [ ] **Step 3: 视觉对照**

打开 [docs/preview-receipt.html](../../preview-receipt.html)，AFTER 画布的签名行应满足：
- "开票人:" 在最左（x=70），下划线 x=170→330
- "收款人:" 靠最右（x=600），下划线 x=700→860
- 两组中间 370px 空白
- y 坐标 = TABLE_BOTTOM + 30 = 403

- [ ] **Step 4: 提交**

```bash
git add miniprogram/utils/receipt.js
git commit -m "feat(receipt): 收款人 label moves to right side of signature row"
```

---

## Task 9: 最终验证（所有任务完成后）

- [ ] **Step 1: 跑完整测试套件**

```bash
npm test
```

预期：所有测试通过（4 条 `getReceiptUserName` + 8 条 format + 3 条 `buildReceiptData`）。

- [ ] **Step 2: 最终视觉对照**

打开 [docs/preview-receipt.html](../../preview-receipt.html) 并对照 spec 第 7 节"验收标准"的 11 条逐一确认：
1. 标题 40px 加粗居中
2. 用户名称行无横线、label 不加粗 value/日期加粗
3. 表头 Microsoft YaHei 加粗明显
4. 水费/电费行正常
5. 租金行描述居中、金额右对齐
6. 拆分行金额跨列、小计在 col 6
7. 合计行 CN 跨 5 列加粗、金额跨 cols 5-6
8. 签名行：开票人最左、收款人最右
9. 右侧"存根（白）客户（红）"10 字中文竖排正立
10. 表格外框完整（顶部 7 条横线 + 合并区竖线处理正确）
11. 整图 930×460，底部 ~39px 空白

- [ ] **Step 3: 检查工作区状态**

```bash
git status
```

预期：除了 `miniprogram/pages/index/index.js`（与本次设计无关的空白字符变更）外，工作区应已干净。

- [ ] **Step 4: （可选）打 tag 或推送**

如需要：
```bash
git log --oneline -10    # 确认提交链
```

---

## Self-Review

### 1. Spec coverage

- 9 条用户样式调整（Task 1-8 全部覆盖，列宽 / 标题 / 描述 / 拆分行 / 合计 / 签名行 / 实用 / 项目 / 间距）✓
- 4 个渲染 bug（Task 4 集中修复 A/B/C，Task 7 修复 D）✓
- 字体全局更换（Task 3 改 `FONT` 常量）✓
- 画布尺寸与版心（Task 2 改 `RECEIPT_W/H`，Task 3 改 `W/H/PADDING`）✓
- 列宽（Task 3 改 `COL_WIDTHS`）✓
- 各行布局（Task 4-8）✓
- `getReceiptUserName` 修复（Task 1）✓
- 测试更新（Task 1 步骤 1-2）✓
- 文件变更清单：receipt.js、receipt.test.js、preview/index.js — Task 1/2/3-8 分别覆盖 ✓
- 验收标准（Task 9 Step 2）✓
- 风险与边界（spec 已记录，实施不引入新风险）✓

### 2. Placeholder scan

- 无 "TBD" / "TODO" / "fill in details"
- 无 "类似 Task N"（每个 Task 都有独立代码）
- 无 "add appropriate error handling"（现有 `getReceiptUserName` 已有 `if (!room)` 处理，保持不动）
- 所有代码块都是完整的、可粘贴的实现

### 3. Type consistency

- `SKIP_VERTICALS` 在 Task 4 步骤 1 定义，Task 4 步骤 2 立即使用，类型一致（`{ [rowIdx]: number[] }`）
- `W` / `H` / `PADDING` / `COL_WIDTHS` 在 Task 3 定义，Task 4-8 使用，名称一致
- `currentRow` 全局变量在 `drawTableBody` 设置、在 `drawTableTotal` 读取，Task 6 沿用现有行为不变
- `drawCell` 函数签名（`text, colStart, span, align, bold, rowIdx, fontSize`）在 Task 6 调用时与原定义匹配
