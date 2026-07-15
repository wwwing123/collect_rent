# 空置月份同步（「同步数据」）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为收租小程序增加「同步数据」功能，一键把空置（没人租、表没动）的缺失月份补全为账单记录，使历史表格、趋势图、CSV 导出连续完整。

**Architecture:** 云函数新增纯函数 `computeVacancyBills(bills, roomId)` 计算相邻已录入月份之间的空缺；`syncVacancyMonths` handler 负责查库 / 写库，支持单房间（传 `roomId`）与全房间（不传，遍历 `status:'active'`）。`bills` 记录新增可选 `vacancy` 标记。前端在历史页（当前房间）和首页（所有房间）各加一个「同步数据」入口，点击后弹确认框、确定后才同步、完成后 Toast 反馈；表格中空置月用浅色 +「空置」标签区分。

**Tech Stack:** 微信小程序（WXML/WXSS/JS）、微信云函数（Node CommonJS + wx-server-sdk）、`node --test` + `node:assert/strict` 单测、ECharts（已有趋势图，不改）。

**对应 spec：** `docs/superpowers/specs/2026-07-14-vacancy-months-sync-design.md`

---

## 文件结构

| 文件 | 职责 | 动作 |
|---|---|---|
| `cloudfunctions/rentApi/vacancy.js` | 纯函数：根据已有 bills 计算待补的空缺月份记录（含自带月份工具） | 新建 |
| `cloudfunctions/rentApi/vacancy.test.js` | `computeVacancyBills` 单测（补缺 / 幂等 / 跨年 / 边界） | 新建 |
| `cloudfunctions/rentApi/index.js` | 新增 `syncVacancyMonths` handler；`upsertBill` 更新分支置 `vacancy:false` | 修改 |
| `miniprogram/pages/bill/history/index.js` | `refresh` map 保留 `vacancy`；新增 `onSync` | 修改 |
| `miniprogram/pages/bill/history/index.wxml` | footer 加「同步数据」按钮；表格行按 `vacancy` 加样式与「空置」标签 | 修改 |
| `miniprogram/pages/bill/history/index.wxss` | 同步按钮、footer 双按钮、空置行与标签样式 | 修改 |
| `miniprogram/pages/index/index.js` | 新增 `onSync`（全房间） | 修改 |
| `miniprogram/pages/index/index.wxml` | greeting 管理员区加「同步数据」圆形按钮 | 修改 |
| `miniprogram/pages/index/index.wxss` | `.greeting-actions` 包裹容器 | 修改 |
| `package.json` | `test` 脚本纳入 `format.test.js` 与 `vacancy.test.js` | 修改 |

---

## Task 1: 云函数空缺补全算法（纯函数，TDD）

**Files:**
- Create: `cloudfunctions/rentApi/vacancy.js`
- Test: `cloudfunctions/rentApi/vacancy.test.js`

- [ ] **Step 1: 写失败测试**

创建 `cloudfunctions/rentApi/vacancy.test.js`：

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeVacancyBills } = require('./vacancy');

test('补出中间空缺月份，读数=前一条，各项 0，vacancy=true', () => {
  const bills = [
    { year_month: '2026-01', water_reading: 100, elec_reading: 200 },
    { year_month: '2026-04', water_reading: 130, elec_reading: 230 },
  ];
  const out = computeVacancyBills(bills, 'room1');
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], {
    room_id: 'room1', year_month: '2026-02',
    water_reading: 100, elec_reading: 200,
    water_fee: 0, elec_fee: 0, base_fee: 0,
    rent: 0, garbage_fee: 0, internet_fee: 0, total: 0, vacancy: true,
  });
  assert.equal(out[1].year_month, '2026-03');
  assert.equal(out[1].water_reading, 100);
});

test('跨年空缺：2025-12 -> 2026-02 补出 2026-01', () => {
  const bills = [
    { year_month: '2025-12', water_reading: 50, elec_reading: 60 },
    { year_month: '2026-02', water_reading: 70, elec_reading: 80 },
  ];
  const out = computeVacancyBills(bills, 'room1');
  assert.equal(out.length, 1);
  assert.equal(out[0].year_month, '2026-01');
  assert.equal(out[0].water_reading, 50);
});

test('幂等：已含 vacancy 记录则不再补', () => {
  const bills = [
    { year_month: '2026-01', water_reading: 100, elec_reading: 200 },
    { year_month: '2026-02', water_reading: 100, elec_reading: 200, vacancy: true },
    { year_month: '2026-03', water_reading: 100, elec_reading: 200, vacancy: true },
    { year_month: '2026-04', water_reading: 130, elec_reading: 230 },
  ];
  assert.equal(computeVacancyBills(bills, 'room1').length, 0);
});

test('全连续不补', () => {
  const bills = [
    { year_month: '2026-01', water_reading: 100, elec_reading: 200 },
    { year_month: '2026-02', water_reading: 110, elec_reading: 210 },
  ];
  assert.equal(computeVacancyBills(bills, 'room1').length, 0);
});

test('少于 2 条不补', () => {
  assert.equal(computeVacancyBills([], 'room1').length, 0);
  assert.equal(
    computeVacancyBills([{ year_month: '2026-01', water_reading: 1, elec_reading: 1 }], 'room1').length,
    0
  );
});

test('多段空缺都补', () => {
  const bills = [
    { year_month: '2026-01', water_reading: 100, elec_reading: 200 },
    { year_month: '2026-03', water_reading: 120, elec_reading: 220 },
    { year_month: '2026-06', water_reading: 150, elec_reading: 250 },
  ];
  const out = computeVacancyBills(bills, 'room1');
  assert.equal(out.length, 3);
  assert.deepEqual(out.map(r => r.year_month), ['2026-02', '2026-04', '2026-05']);
});

test('读数缺失时用 0 兜底', () => {
  const bills = [
    { year_month: '2026-01' },
    { year_month: '2026-03', water_reading: 10, elec_reading: 20 },
  ];
  const out = computeVacancyBills(bills, 'room1');
  assert.equal(out[0].water_reading, 0);
  assert.equal(out[0].elec_reading, 0);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test cloudfunctions/rentApi/vacancy.test.js`
Expected: FAIL，报 `Cannot find module './vacancy'`。

- [ ] **Step 3: 写最小实现**

创建 `cloudfunctions/rentApi/vacancy.js`：

```js
// 空置月份补全纯函数。CommonJS，不依赖 wx-server-sdk，便于单测。

function shiftYM(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  let mm = m + delta;
  let yy = y;
  while (mm < 1) { mm += 12; yy -= 1; }
  while (mm > 12) { mm -= 12; yy += 1; }
  return `${yy}-${String(mm).padStart(2, '0')}`;
}

function nextYM(ym) {
  return shiftYM(ym, 1);
}

/**
 * 根据已有账单，计算需要补全的空置月份记录。
 * 只补「最早记录 ↔ 最近记录」之间的空缺；读数取自前一条记录（表没动）。
 * @param {Array} bills 已有账单（每条含 year_month，可选 water_reading/elec_reading）
 * @param {string} roomId
 * @returns {Array} 待插入的空置记录数组
 */
function computeVacancyBills(bills, roomId) {
  if (!Array.isArray(bills) || bills.length < 2) return [];
  const sorted = [...bills].sort((a, b) => (a.year_month < b.year_month ? -1 : 1));
  const result = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    let cursor = nextYM(a.year_month);
    while (cursor < b.year_month) {
      result.push({
        room_id: roomId,
        year_month: cursor,
        water_reading: a.water_reading ?? 0,
        elec_reading: a.elec_reading ?? 0,
        water_fee: 0,
        elec_fee: 0,
        base_fee: 0,
        rent: 0,
        garbage_fee: 0,
        internet_fee: 0,
        total: 0,
        vacancy: true,
      });
      cursor = nextYM(cursor);
    }
  }
  return result;
}

module.exports = { computeVacancyBills, shiftYM, nextYM };
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test cloudfunctions/rentApi/vacancy.test.js`
Expected: PASS（7 个 test 全过）。

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions/rentApi/vacancy.js cloudfunctions/rentApi/vacancy.test.js
git commit -m "feat(rentApi): add computeVacancyBills pure function

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: 云函数 syncVacancyMonths handler + upsertBill 标记

**Files:**
- Modify: `cloudfunctions/rentApi/index.js`

- [ ] **Step 1: 顶部引入 vacancy 模块**

在 `cloudfunctions/rentApi/index.js` 第 5 行 `const { computeBill } = require('./billing');` 之后新增一行：

```js
const { computeVacancyBills } = require('./vacancy');
```

- [ ] **Step 2: 新增 syncVacancyMonths handler**

在 `handlers` 对象中，`getHistory` 之后插入新 handler（位于 `getHistory` 闭合 `}),` 与 `exportCsv:` 之间）：

```js
  syncVacancyMonths: requireAuth(async ({ openid, event }) => {
    const { roomId } = event;
    let roomIds;
    if (roomId) {
      roomIds = [roomId];
    } else {
      const { data: rooms } = await db.collection('rooms').where({ status: 'active' }).get();
      roomIds = rooms.map(r => r._id);
    }
    let inserted = 0;
    for (const rid of roomIds) {
      const { data: bills } = await db.collection('bills').where({ room_id: rid }).get();
      const toInsert = computeVacancyBills(bills, rid);
      for (const rec of toInsert) {
        await db.collection('bills').add({
          data: { ...rec, _openid: openid, created_at: new Date(), updated_at: new Date() },
        });
        inserted += 1;
      }
    }
    return { syncedRooms: roomIds.length, inserted };
  }),
```

> 说明：幂等由 `computeVacancyBills` 天然保证——它只产出「当前 bills 之间的空缺」，已补过的 vacancy 记录已在 bills 中，再次调用返回空数组，不会重复插入。

- [ ] **Step 3: upsertBill 更新分支置 vacancy:false**

定位 `upsertBill` 中的更新分支（约第 198–201 行），将：

```js
    if (existing) {
      doc._openid = existing._openid;
      await db.collection('bills').doc(existing._id).update({ data: doc });
      return { ok: true, _id: existing._id };
```

改为：

```js
    if (existing) {
      doc._openid = existing._openid;
      doc.vacancy = false;
      await db.collection('bills').doc(existing._id).update({ data: doc });
      return { ok: true, _id: existing._id };
```

> 说明：用户手动编辑已补全的空置月并保存后，转回真实月，避免「标着空置但费用非 0」的矛盾。

- [ ] **Step 4: 语法自检**

Run: `node --check cloudfunctions/rentApi/index.js`
Expected: 无输出、退出码 0（仅做语法解析，不执行、不触发依赖加载）。若有 SyntaxError，检查逗号 / 括号配对。

- [ ] **Step 5: 部署云函数**

在微信开发者工具中，右键 `cloudfunctions/rentApi` →「上传并部署：云端安装依赖」。等待部署完成。

- [ ] **Step 6: Commit**

```bash
git add cloudfunctions/rentApi/index.js
git commit -m "feat(rentApi): add syncVacancyMonths handler, clear vacancy on manual edit

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: 历史页同步按钮 + 空置行样式

**Files:**
- Modify: `miniprogram/pages/bill/history/index.js`
- Modify: `miniprogram/pages/bill/history/index.wxml`
- Modify: `miniprogram/pages/bill/history/index.wxss`

- [ ] **Step 1: refresh 的 map 保留 vacancy 字段**

在 `miniprogram/pages/bill/history/index.js` 的 `refresh()` 中，`history` 的 map 返回对象里，在 `total: b.total,` 之后加一行 `vacancy: !!b.vacancy,`，即：

```js
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
```

- [ ] **Step 2: 新增 onSync 方法**

在 `miniprogram/pages/bill/history/index.js` 的 `onTapRow` 方法之前插入：

```js
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
```

- [ ] **Step 3: wxml footer 加同步按钮**

在 `miniprogram/pages/bill/history/index.wxml` 中，将 footer 区块：

```xml
  <view class="footer">
    <view class="export-btn" bindtap="onExport" hover-class="press">
      <text class="export-label">↓ 导出 CSV</text>
    </view>
  </view>
```

改为：

```xml
  <view class="footer">
    <view class="sync-btn" bindtap="onSync" hover-class="press">
      <text class="sync-label">↻ 同步数据</text>
    </view>
    <view class="export-btn" bindtap="onExport" hover-class="press">
      <text class="export-label">↓ 导出 CSV</text>
    </view>
  </view>
```

- [ ] **Step 4: wxml 表格行加空置样式与标签**

将表格数据行（`wx:for="{{ history }}"` 那个 `<view>`）：

```xml
    <view wx:for="{{ history }}" wx:key="year_month"
      class="tr {{ item.highlight ? 'highlight' : '' }}"
      hover-class="tr-hover"
      data-yearmonth="{{ item.year_month }}"
      bindtap="onTapRow"
    >
      <text class="td col-month">{{ item.year_month }}</text>
```

改为：

```xml
    <view wx:for="{{ history }}" wx:key="year_month"
      class="tr {{ item.vacancy ? 'tr-vacancy' : '' }}"
      hover-class="tr-hover"
      data-yearmonth="{{ item.year_month }}"
      bindtap="onTapRow"
    >
      <text class="td col-month">{{ item.year_month }}<text wx:if="{{ item.vacancy }}" class="vacancy-tag">空置</text></text>
```

> 说明：原 `item.highlight` 从未被任何代码赋值（dead class），替换为 `item.vacancy`。

- [ ] **Step 5: wxss 加 footer 双按钮 + 空置行样式**

在 `miniprogram/pages/bill/history/index.wxss` 末尾追加：

```css
/* —— 底部按钮区（同步 + 导出） —— */
.footer {
  padding: var(--s-3) 0 0;
  display: flex;
  gap: var(--s-2);
}
.sync-btn {
  flex: 1;
  height: 96rpx;
  background: var(--paper-2);
  color: var(--ink);
  border: 1rpx solid var(--line);
  border-radius: var(--r-pill);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-sm);
  transition: opacity 0.15s ease;
}
.sync-btn.press { opacity: 0.85; }
.sync-label {
  font-size: 30rpx;
  font-weight: 600;
  letter-spacing: 0.32em;
  padding-right: 0.32em;
  color: var(--ink);
}

/* —— 空置行 —— */
.tr.tr-vacancy {
  background: var(--paper-3);
}
.tr.tr-vacancy .td {
  color: var(--ink-3);
}
.vacancy-tag {
  display: inline-block;
  margin-left: 8rpx;
  padding: 2rpx 10rpx;
  font-size: 18rpx;
  color: var(--ink-3);
  background: var(--paper-2);
  border: 1rpx solid var(--line);
  border-radius: var(--r-pill);
  letter-spacing: 0.08em;
  vertical-align: middle;
}
```

并把现有 `.export-btn` 规则块（约第 186–197 行）中的首行 `.export-btn {` 之后补上 `flex: 1;`，使其与 `.sync-btn` 等分：

```css
.export-btn {
  flex: 1;
  height: 96rpx;
  background: var(--ink);
  color: #FFFFFF;
  border-radius: var(--r-pill);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 20rpx rgba(42, 38, 34, 0.18);
  transition: box-shadow 0.15s ease, opacity 0.15s ease;
}
```

- [ ] **Step 6: 手工验证**

在微信开发者工具中，打开一个**存在缺月**的房间历史页：
1. 底部出现「↻ 同步数据」与「↓ 导出 CSV」两个并排按钮。
2. 点「同步数据」→ 弹出确认框，文案含当前房号 → 点「取消」应什么都不做。
3. 再点「同步数据」→ 确认 → loading → Toast「已补全 N 条」→ 表格出现缺失月份行（浅色 +「空置」标签、数字为 0）→ 趋势图月份轴变连续。
4. 再次点「同步数据」→ 确认 → Toast「已是最新，无需补全」（幂等）。

- [ ] **Step 7: Commit**

```bash
git add miniprogram/pages/bill/history/index.js miniprogram/pages/bill/history/index.wxml miniprogram/pages/bill/history/index.wxss
git commit -m "feat(history): add sync button and vacant-row styling

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: 首页同步按钮（全房间）

**Files:**
- Modify: `miniprogram/pages/index/index.js`
- Modify: `miniprogram/pages/index/index.wxml`
- Modify: `miniprogram/pages/index/index.wxss`

- [ ] **Step 1: 新增 onSync 方法**

在 `miniprogram/pages/index/index.js` 的 `onHeaderSettings` 方法之后插入：

```js
  async onSync() {
    const { rooms } = this.data;
    const activeCount = rooms.filter(r => r.room && r.room.status === 'active').length;
    const res = await wx.showModal({
      title: '同步数据',
      content: `将补全全部 ${activeCount} 个房间缺失的空置月份，可能需要几秒，是否继续？`,
      confirmText: '确定',
      cancelText: '取消',
    });
    if (!res.confirm) return;
    wx.showLoading({ title: '同步中', mask: true });
    try {
      const { inserted } = await callRentApi('syncVacancyMonths', {});
      wx.hideLoading();
      wx.showToast({
        title: inserted > 0 ? `已补全 ${inserted} 条` : '已是最新，无需补全',
        icon: inserted > 0 ? 'success' : 'none',
      });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '同步失败', icon: 'none' });
    }
  },
```

- [ ] **Step 2: wxml greeting 区加按钮**

在 `miniprogram/pages/index/index.wxml` 中，将管理员设置入口：

```xml
    <view wx:if="{{ isAdmin }}" class="settings-link" bindtap="onHeaderSettings" hover-class="press">
      <text class="settings-link-glyph">⚙</text>
    </view>
```

改为用 `.greeting-actions` 包裹两个圆形按钮（复用 `.settings-link` 圆形样式）：

```xml
    <view wx:if="{{ isAdmin }}" class="greeting-actions">
      <view class="settings-link" bindtap="onSync" hover-class="press">
        <text class="settings-link-glyph">↻</text>
      </view>
      <view class="settings-link" bindtap="onHeaderSettings" hover-class="press">
        <text class="settings-link-glyph">⚙</text>
      </view>
    </view>
```

- [ ] **Step 3: wxss 加 greeting-actions 容器**

在 `miniprogram/pages/index/index.wxss` 的 `.settings-link-glyph` 规则之后追加：

```css
.greeting-actions {
  display: flex;
  gap: var(--s-1);
  margin-top: 4rpx;
}
```

- [ ] **Step 4: 手工验证**

在微信开发者工具中，进入首页（管理员账号）：
1. 顶部管理员区出现「↻」和「⚙」两个圆形按钮并排；非管理员账号不显示。
2. 点「↻」→ 弹出确认框，文案含 active 房间数 → 点「取消」应什么都不做。
3. 点「↻」→ 确认 → loading → Toast「已补全 N 条」。
4. 进入任一此前缺月的房间历史页，确认表格已连续、空置月带「空置」标签。

- [ ] **Step 5: Commit**

```bash
git add miniprogram/pages/index/index.js miniprogram/pages/index/index.wxml miniprogram/pages/index/index.wxss
git commit -m "feat(index): add sync-all-rooms button in admin area

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: 测试脚本纳入新测试 + 全量回归

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 更新 test 脚本**

将 `package.json` 的 `scripts.test`：

```json
    "test": "node --test miniprogram/utils/billing.test.js miniprogram/utils/receipt.test.js"
```

改为：

```json
    "test": "node --test miniprogram/utils/billing.test.js miniprogram/utils/receipt.test.js miniprogram/utils/format.test.js cloudfunctions/rentApi/vacancy.test.js"
```

> 说明：顺带把原本漏跑的 `format.test.js` 纳入（与本功能同属月份工具，确保回归覆盖）。

- [ ] **Step 2: 跑全量测试**

Run: `npm test`
Expected: 全部 PASS（billing、receipt、format、vacancy 四组测试均通过，无失败）。

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "test: include format and vacancy tests in npm test

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 端到端验收清单（对应 spec 第 9 节）

全部任务完成后，在微信开发者工具中逐项确认：

- [ ] 1. 历史页底部出现「同步数据」按钮，与「导出 CSV」并排。
- [ ] 2. 点历史页「同步数据」弹出确认框，文案含当前房号。
- [ ] 3. 确认后补全当前房间，Toast 显示补全条数，表格与趋势图变连续。
- [ ] 4. 首页顶部管理员区出现「同步数据」按钮，非管理员不可见。
- [ ] 5. 点首页「同步数据」弹出确认框，文案含房间数。
- [ ] 6. 确认后补全所有 active 房间，Toast 显示补全条数。
- [ ] 7. 重复点「同步数据」不产生重复记录（幂等）。
- [ ] 8. 表格空置月显示浅色背景 +「空置」标签，数字为 0，与真实月视觉区分。
- [ ] 9. 趋势图补全后月份轴连续、空置月用量为 0。
- [ ] 10. 空置记录读数 = 上一条真实记录读数，水电费 / 租金 / 合计均为 0，`vacancy` 为 `true`。
- [ ] 11. 跨年空缺（如 2025-12 → 2026-02）能正确补出 2026-01。
- [ ] 12. 最近记录之后的月份不被自动补全。
- [ ] 13. 现有账单计算、保存、收据、CSV 导出功能正常。
- [ ] 14. 手动编辑一条空置月并保存后，该行「空置」标签消失（vacancy 转 false）。
