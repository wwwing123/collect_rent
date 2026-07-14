# 数据录入与月份切换 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把首页入口与导航标题统一改为“数据录入”，在数据录入页加入原生月份选择器与受控左右箭头，并删除历史账单页的补录区域。

**Architecture:** 复用现有 `wx.redirectTo` 月份切换流程，仅在数据录入页内引入月份范围常量、上下限计算和统一跳转入口。新增 TDD 覆盖的范围工具函数（`maxSelectableYearMonth`、`canShiftToPrev`、`canShiftToNext`）放在 `miniprogram/utils/format.js`，由 Node 测试直接覆盖。

**Tech Stack:**
- 微信小程序（基础库 ≥ 3.0）
- Vant Weapp（保持现有使用）
- Node.js `node:test`（仅用于新增工具函数）

**Spec:** `docs/superpowers/specs/2026-07-13-data-entry-month-navigation-design.md`

## 文件结构

新增：

- `miniprogram/utils/format.test.js` — `format.js` 中范围工具函数的单元测试

修改：

- `miniprogram/utils/format.js` — 新增月份范围工具
- `miniprogram/pages/bill/edit/index.json` — 导航标题改为“数据录入”
- `miniprogram/pages/bill/edit/index.wxml` — 用 `picker` 包裹月份区，根据状态为箭头添加 `disabled` 类
- `miniprogram/pages/bill/edit/index.wxss` — 补充箭头禁用样式和月份区可点击反馈
- `miniprogram/pages/bill/edit/index.js` — 计算上下限与箭头状态，添加 `onPickMonth`，统一跳转入口
- `miniprogram/components/roomCard/index.wxml` — 入口按钮文案改为“数据录入”
- `miniprogram/pages/bill/history/index.wxml` — 删除补录区
- `miniprogram/pages/bill/history/index.js` — 删除 `backfillYM` 与 `onPickMonth`
- `miniprogram/pages/bill/history/index.wxss` — 删除仅供补录区使用的样式

保持不变：

- 云函数、数据库、`computeBill`、`receipt.js`、首页其他内容、历史表格与图表、CSV 导出。

---

## Task 1：月份范围工具函数（TDD）

**Files:**
- Modify: `miniprogram/utils/format.js`
- Create: `miniprogram/utils/format.test.js`

- [ ] **Step 1: 写失败的测试**

完整写入 `miniprogram/utils/format.test.js`：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_YEAR_MONTH,
  maxSelectableYearMonth,
  canShiftToPrev,
  canShiftToNext,
} from './format.js';

test('MIN_YEAR_MONTH is 2018-01', () => {
  assert.equal(MIN_YEAR_MONTH, '2018-01');
});

test('maxSelectableYearMonth: explicit current +1 month', () => {
  assert.equal(maxSelectableYearMonth('2026-07'), '2026-08');
  assert.equal(maxSelectableYearMonth('2026-01'), '2026-02');
});

test('maxSelectableYearMonth: cross year boundary', () => {
  assert.equal(maxSelectableYearMonth('2026-12'), '2027-01');
});

test('canShiftToPrev: false at MIN_YEAR_MONTH, true after', () => {
  assert.equal(canShiftToPrev('2018-01'), false);
  assert.equal(canShiftToPrev('2017-12'), false);
  assert.equal(canShiftToPrev('2018-02'), true);
  assert.equal(canShiftToPrev('2026-07'), true);
});

test('canShiftToNext: false at max, true before', () => {
  assert.equal(canShiftToNext('2026-08', '2026-07'), false);
  assert.equal(canShiftToNext('2026-09', '2026-07'), false);
  assert.equal(canShiftToNext('2026-07', '2026-07'), true);
  assert.equal(canShiftToNext('2026-01', '2026-07'), true);
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
node --test miniprogram/utils/format.test.js
```

期望：失败信息为 `SyntaxError: The requested module './format.js' does not provide an export named 'MIN_YEAR_MONTH'`。

- [ ] **Step 3: 在 `miniprogram/utils/format.js` 新增工具函数**

完整替换 `miniprogram/utils/format.js`：

```js
export const MIN_YEAR_MONTH = '2018-01';

export function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftYearMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  let mm = m + delta;
  let yy = y;
  while (mm < 1) { mm += 12; yy -= 1; }
  while (mm > 12) { mm -= 12; yy += 1; }
  return `${yy}-${String(mm).padStart(2, '0')}`;
}

export function compareYearMonth(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function maxSelectableYearMonth(currentYM) {
  const ref = currentYM || currentYearMonth();
  return shiftYearMonth(ref, 1);
}

export function canShiftToPrev(ym) {
  return compareYearMonth(ym, MIN_YEAR_MONTH) > 0;
}

export function canShiftToNext(ym, currentYM) {
  return compareYearMonth(ym, maxSelectableYearMonth(currentYM)) < 0;
}

export function formatYearMonthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${y} 年 ${m} 月`;
}

export function formatMoney(n) {
  return Number(n || 0).toFixed(2);
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
node --test miniprogram/utils/format.test.js
```

期望：5 个 test 全部 PASS。

- [ ] **Step 5: 运行全套测试，确认未回归**

```bash
npm test
```

期望：原有 `computeBill` / `getReceiptUserName` 测试仍 PASS。

- [ ] **Step 6: 提交**

```bash
git add miniprogram/utils/format.js miniprogram/utils/format.test.js
git commit -m "feat(utils): add month range helpers for data entry page"
```

---

## Task 2：数据录入页导航标题改为“数据录入”

**Files:**
- Modify: `miniprogram/pages/bill/edit/index.json`

- [ ] **Step 1: 修改 `navigationBarTitleText`**

将 `miniprogram/pages/bill/edit/index.json` 完整替换为：

```json
{
  "navigationBarTitleText": "数据录入",
  "usingComponents": {
    "van-field": "@vant/weapp/field/index",
    "van-button": "@vant/weapp/button/index"
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add miniprogram/pages/bill/edit/index.json
git commit -m "feat(bill/edit): rename navigation title to 数据录入"
```

---

## Task 3：数据录入页 WXML 增加原生月份选择器和禁用状态

**Files:**
- Modify: `miniprogram/pages/bill/edit/index.wxml`

- [ ] **Step 1: 替换月份栏的 `month-bar` 段**

将 `miniprogram/pages/bill/edit/index.wxml` 中第 2-13 行：

```xml
  <!-- 月份选择器 -->
  <view class="month-bar">
    <view class="month-arrow" bindtap="onPrevMonth" hover-class="press">
      <text class="arrow">‹</text>
    </view>
    <view class="month-display">
      <text class="month-eyebrow">账目月份</text>
      <text class="month-name">{{ monthLabel }}</text>
    </view>
    <view class="month-arrow" bindtap="onNextMonth" hover-class="press">
      <text class="arrow">›</text>
    </view>
  </view>
```

替换为：

```xml
  <!-- 月份选择器 -->
  <view class="month-bar">
    <view class="month-arrow {{ canPrev ? '' : 'disabled' }}" bindtap="onPrevMonth" hover-class="{{ canPrev ? 'press' : 'none' }}">
      <text class="arrow">‹</text>
    </view>
    <picker mode="date" fields="month" value="{{ yearMonth }}" start="{{ minYearMonth }}" end="{{ maxYearMonth }}" bindchange="onPickMonth">
      <view class="month-display month-display-picker" hover-class="press">
        <text class="month-eyebrow">账目月份</text>
        <text class="month-name">{{ monthLabel }}</text>
      </view>
    </picker>
    <view class="month-arrow {{ canNext ? '' : 'disabled' }}" bindtap="onNextMonth" hover-class="{{ canNext ? 'press' : 'none' }}">
      <text class="arrow">›</text>
    </view>
  </view>
```

- [ ] **Step 2: 提交**

```bash
git add miniprogram/pages/bill/edit/index.wxml
git commit -m "feat(bill/edit): wrap month display with picker and disabled arrows"
```

---

## Task 4：数据录入页 WXSS 增加禁用样式与点击反馈

**Files:**
- Modify: `miniprogram/pages/bill/edit/index.wxss`

- [ ] **Step 1: 在 `.month-arrow` 段后增加禁用样式**

在 `miniprogram/pages/bill/edit/index.wxss` 中找到：

```css
.month-arrow.press { background: var(--amber-soft); opacity: 0.85; }
```

在其后追加：

```css
.month-arrow.disabled { opacity: 0.35; pointer-events: none; }
```

- [ ] **Step 2: 在 `.month-display` 段后增加 picker 可点击反馈**

在 `miniprogram/pages/bill/edit/index.wxss` 中找到：

```css
.month-name {
  font-family: var(--font-serif);
  font-size: var(--fs-xl);
  font-weight: 600;
  color: var(--ink);
  letter-spacing: 0.08em;
}
```

在其后追加：

```css
.month-display-picker { cursor: pointer; }
.month-display-picker.press { opacity: 0.85; }
```

- [ ] **Step 3: 提交**

```bash
git add miniprogram/pages/bill/edit/index.wxss
git commit -m "style(bill/edit): add disabled arrow and picker feedback styles"
```

---

## Task 5：数据录入页 JS 增加上下限、禁用状态、统一跳转

**Files:**
- Modify: `miniprogram/pages/bill/edit/index.js`

- [ ] **Step 1: 更新 import 与 `data` 默认值**

将 `miniprogram/pages/bill/edit/index.js` 顶部：

```js
import { callRentApi } from '../../../utils/api.js';
import { computeBill } from '../../../utils/billing.js';
import { shiftYearMonth, formatYearMonthLabel, currentYearMonth } from '../../../utils/format.js';
```

替换为：

```js
import { callRentApi } from '../../../utils/api.js';
import { computeBill } from '../../../utils/billing.js';
import {
  MIN_YEAR_MONTH,
  canShiftToPrev,
  canShiftToNext,
  currentYearMonth,
  formatYearMonthLabel,
  maxSelectableYearMonth,
  shiftYearMonth,
} from '../../../utils/format.js';
```

- [ ] **Step 2: 在 `data` 块中增加范围与禁用字段**

将 `data` 替换为：

```js
  data: {
    roomId: '',
    room: null,
    yearMonth: '',
    monthLabel: '',
    minYearMonth: MIN_YEAR_MONTH,
    maxYearMonth: '',
    canPrev: true,
    canNext: true,
    waterReading: '',
    elecReading: '',
    prevWater: null,
    prevElec: null,
    breakdown: { water_fee: 0, elec_fee: 0, base_fee: 0, total: 0, water_usage: 0, elec_usage: 0, garbage_fee: 0, internet_fee: 0 },
  },
```

- [ ] **Step 3: 在 `onLoad` 末尾增加上下限和箭头状态计算**

找到 `onLoad` 末尾的：

```js
    if (this.data.waterReading !== '' || this.data.elecReading !== '') {
      this.recalc();
    }
  },
```

替换为：

```js
    const maxYearMonth = maxSelectableYearMonth();
    this.setData({
      maxYearMonth,
      canPrev: canShiftToPrev(yearMonth),
      canNext: canShiftToNext(yearMonth),
    });

    if (this.data.waterReading !== '' || this.data.elecReading !== '') {
      this.recalc();
    }
  },
```

- [ ] **Step 4: 增加统一跳转入口与 picker 处理**

将 `onPrevMonth`、`onNextMonth` 两段替换为：

```js
  _goToMonth(targetYM) {
    const { roomId, yearMonth } = this.data;
    if (!/^\d{4}-\d{2}$/.test(targetYM)) return;
    if (targetYM === yearMonth) return;
    if (!canShiftToPrev(targetYM)) return;
    if (!canShiftToNext(targetYM)) return;
    wx.redirectTo({ url: `/pages/bill/edit/index?roomId=${roomId}&yearMonth=${targetYM}` });
  },

  onPrevMonth() {
    if (!this.data.canPrev) return;
    this._goToMonth(shiftYearMonth(this.data.yearMonth, -1));
  },

  onNextMonth() {
    if (!this.data.canNext) return;
    this._goToMonth(shiftYearMonth(this.data.yearMonth, 1));
  },

  onPickMonth(e) {
    const value = e.detail.value || '';
    const targetYM = value.length >= 7 ? value.slice(0, 7) : '';
    this._goToMonth(targetYM);
  },
```

- [ ] **Step 5: 提交**

```bash
git add miniprogram/pages/bill/edit/index.js
git commit -m "feat(bill/edit): bound month picker and arrows to allowed range"
```

---

## Task 6：首页房间卡片入口文案改为“数据录入”

**Files:**
- Modify: `miniprogram/components/roomCard/index.wxml`

- [ ] **Step 1: 修改按钮文字**

将 `miniprogram/components/roomCard/index.wxml` 第 36-38 行：

```xml
    <view class="action-btn primary {{ !isActive ? 'disabled' : '' }}" bindtap="onGenerate" hover-class="press">
      <text class="action-label">生成账单</text>
    </view>
```

替换为：

```xml
    <view class="action-btn primary {{ !isActive ? 'disabled' : '' }}" bindtap="onGenerate" hover-class="press">
      <text class="action-label">数据录入</text>
    </view>
```

- [ ] **Step 2: 提交**

```bash
git add miniprogram/components/roomCard/index.wxml
git commit -m "feat(roomCard): rename entry button to 数据录入"
```

---

## Task 7：删除历史账单页补录区（WXML）

**Files:**
- Modify: `miniprogram/pages/bill/history/index.wxml`

- [ ] **Step 1: 移除整段补录块**

将 `miniprogram/pages/bill/history/index.wxml` 第 9-17 行：

```xml
  <!-- 补录 -->
  <view class="backfill">
    <picker mode="date" fields="month" value="{{ backfillYM }}" start="2018-01" end="2099-12" bindchange="onPickMonth">
      <view class="backfill-btn" hover-class="press">
        <text class="backfill-label">＋ 补录历史读数</text>
      </view>
    </picker>
    <view class="backfill-hint">选择月份后跳转录入页。补录中间月份后再保存后续月份，会自动用最新的上月读数重算。</view>
  </view>
```

替换为：

```xml
  <!-- 表格 -->
```

（即整段删除，第 9 行开始只保留 `<!-- 表格 -->` 注释，以便后续继续看到表格段的开头。）

- [ ] **Step 2: 提交**

```bash
git add miniprogram/pages/bill/history/index.wxml
git commit -m "refactor(history): remove backfill history entry"
```

---

## Task 8：删除历史账单页补录相关数据与事件（JS）

**Files:**
- Modify: `miniprogram/pages/bill/history/index.js`

- [ ] **Step 1: 从 `data` 中删除 `backfillYM`**

找到：

```js
  data: {
    roomId: '',
    roomLabel: '',
    history: [],
    backfillYM: '',
    latestYM: '',
    latestWater: 0,
    latestElec: 0,
    ec: { lazyLoad: true },
  },
```

替换为：

```js
  data: {
    roomId: '',
    roomLabel: '',
    history: [],
    latestYM: '',
    latestWater: 0,
    latestElec: 0,
    ec: { lazyLoad: true },
  },
```

- [ ] **Step 2: 删除 `onPickMonth` 方法**

找到：

```js
  onPickMonth(e) {
    const ym = e.detail.value;
    wx.redirectTo({ url: `/pages/bill/edit/index?roomId=${this.data.roomId}&yearMonth=${ym}` });
  },

```

整段删除（包括后面跟随的 `async onExport()` 之前的所有空白行保持 1 行）。

- [ ] **Step 3: 提交**

```bash
git add miniprogram/pages/bill/history/index.js
git commit -m "refactor(history): drop unused backfill picker handler"
```

---

## Task 9：删除历史账单页补录相关样式（WXSS）

**Files:**
- Modify: `miniprogram/pages/bill/history/index.wxss`

- [ ] **Step 1: 删除 `.backfill*` 样式块**

将 `miniprogram/pages/bill/history/index.wxss` 第 34-69 行：

```css
/* —— 补录区 —— */
.backfill {
  background: var(--paper-2);
  border: 1rpx solid var(--line);
  border-radius: var(--r-md);
  padding: var(--s-3);
}
.backfill-btn {
  height: 84rpx;
  background: var(--amber-tint);
  border: 1rpx dashed rgba(234, 123, 58, 0.35);
  border-radius: var(--r-pill);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--amber-2);
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, opacity 0.15s ease;
}
.backfill-btn.press {
  background: var(--amber-soft);
  border-color: var(--amber);
  color: var(--amber-3);
  opacity: 0.92;
}
.backfill-label {
  font-size: var(--fs-base);
  letter-spacing: 0.08em;
  font-weight: 500;
}
.backfill-hint {
  font-size: var(--fs-xs);
  color: var(--ink-3);
  margin-top: var(--s-2);
  line-height: 1.6;
  letter-spacing: 0.02em;
}

/* —— 表格 —— */
```

替换为：

```css
/* —— 表格 —— */
```

- [ ] **Step 2: 提交**

```bash
git add miniprogram/pages/bill/history/index.wxss
git commit -m "style(history): remove backfill section styles"
```

---

## Task 10：全量回归与最终提交

**Files:** 无新增或修改

- [ ] **Step 1: 运行单元测试**

```bash
npm test
```

期望：原有 `computeBill`、`getReceiptUserName` 测试和新加的 `format.js` 测试全部 PASS。

- [ ] **Step 2: 在微信开发者工具中编译**

期望：项目可正常编译，无 `pages/bill/edit/index.json` 或 `pages/bill/history/index` 路径相关报错。

- [ ] **Step 3: 手工验证验收标准**

逐条对照 [spec 验收标准](docs/superpowers/specs/2026-07-13-data-entry-month-navigation-design.md#9-验收标准)：

1. 首页入口显示“数据录入”。
2. 进入页面后微信导航栏显示“数据录入”。
3. 点击顶部中间月份区域能打开原生年月选择器。
4. 选择历史月份、当前月份和当前月份的下一个月都能加载对应数据。
5. 选择当前显示月份不会重复跳转。
6. 左右箭头逐月切换能正确跨年（2026-01 向左 → 2025-12；2026-12 向右 → 2027-01）。
7. 在 2018-01 时左箭头禁用。
8. 在当前月份的下一个月时右箭头禁用。
9. 原生选择器不允许选择 2018-01 之前或当前月份下一个月之后的月份。
10. 历史账单页不再显示补录按钮和说明。
11. 点击已有历史账单仍能进入对应月份的数据录入页。
12. 账单计算、保存、趋势图与 CSV 导出功能保持正常。

- [ ] **Step 4: 检查无遗留代码**

```bash
git -C "d:/snc_wai/collect_rent" grep -nE "生成账单|补录历史|backfillYM|onPickMonth" miniprogram
```

期望：无匹配结果。

---

## 自审记录

- Spec 验收点 1-2：Task 2、Task 6 覆盖。
- Spec 验收点 3-9：Task 3、Task 4、Task 5 覆盖（含 TDD）。
- Spec 验收点 10：Task 7、Task 9 覆盖。
- Spec 验收点 11-12：Task 7 + Task 10 验证步骤覆盖。
- 未引入新依赖，未改动云函数或数据库。
- 所有代码步骤给出完整片段，未使用“类似 Task N”或“适当处理”类占位符。
- 命名一致：`_goToMonth` 在 Task 5 中定义并在同 Task 内被引用；`canPrev` / `canNext` 在 Task 5 写入 data，Task 3 中读取；`MIN_YEAR_MONTH` 在 Task 1 导出，Task 2/Task 5 中导入。