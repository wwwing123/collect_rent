# 收租小程序 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 家庭自用的微信小程序云开发应用，按月跟踪 7 个出租单元的应收账单。

**Architecture:** 微信小程序 + 微信云开发（云函数 + NoSQL 数据库）。单一聚合云函数 `rentApi`（按 `event.type` 分发），前端 4 屏 + ec-canvas 图表，纯函数 `computeBill` 算费（前后端共用）。多家庭成员登录通过 openid 白名单 + 6 位邀请码。

**Tech Stack:**
- 微信小程序（基础库 ≥ 3.0）
- UI: **Vant Weapp** v1.11+
- 后端: 微信云开发（`wx.cloud`）、`wx-server-sdk ~2.4.0`
- 数据库: 云开发 NoSQL（3 个集合: `rooms`、`bills`、`admins`）
- 图表: **ec-canvas**（ECharts 小程序版）
- 测试: Node.js `node:test`（仅 `computeBill` 纯函数）

**Spec:** `docs/superpowers/specs/2026-07-02-collect-rent-design.md`

**Project Layout（最终目标）:**

```
d:\snc_wai\collect_rent\
├── miniprogram\
│   ├── app.js / app.json / app.wxss
│   ├── pages\
│   │   ├── index\index.{js,wxml,wxss,json}        # 5.1 首页
│   │   ├── rooms\index.{js,wxml,wxss,json}        # 5.2 租金设置
│   │   ├── bill\edit\index.{js,wxml,wxss,json}    # 5.3 生成账单
│   │   ├── bill\history\index.{js,wxml,wxss,json} # 5.4 历史账单
│   │   └── unauthorized\index.{js,wxml,wxss,json} # 6.2 未授权页
│   ├── components\
│   │   ├── roomCard\                             # 首页房间卡片
│   │   ├── billRow\                              # 单行账单
│   │   └── collapsibleRoomForm\                  # 折叠房费表单
│   │   # ec-canvas 直接在 history 页用，不封装 component
│   └── utils\
│       ├── billing.js / billing.test.js          # computeBill + TDD
│       ├── auth.js                               # openid/isAdmin 封装
│       ├── api.js                                # wx.cloud.callFunction 包装
│       └── format.js                             # year_month 工具
└── cloudfunctions\
    └── rentApi\                                   # 单一聚合云函数
        ├── index.js
        ├── billing.js                            # 服务端 computeBill
        ├── package.json
        └── config.json
```

---

## Phase 0：清模板 & 项目结构

### Task 1：清理 QuickStart 默认代码

**Files:**
- Delete: `miniprogram/pages/index/index.{js,wxml,wxss,json}`（默认"云开发"介绍页，删除重建）
- Delete: `miniprogram/pages/example/index.{js,wxml,wxss,json}`（默认数据库 CRUD 演示页，本项目用不到）
- Delete: `miniprogram/components/cloudTipModal/*`（默认云开发提示弹窗）
- Delete: `miniprogram/envList.js`（本项目单环境，不需切换）
- Delete: `cloudfunctions/quickstartFunctions/*`（被 `rentApi` 取代）
- Modify: `miniprogram/app.json`（替换 pages 列表）
- Modify: `miniprogram/app.wxss`（最小全局样式）
- Modify: `project.config.json`（更新 projectname + 设置 npm 构建）
- Modify: `README.md`（替换为本项目说明）

- [ ] **Step 1: 删除默认文件**

```bash
rm -rf miniprogram/pages/index
rm -rf miniprogram/pages/example
rm -rf miniprogram/components/cloudTipModal
rm -f miniprogram/envList.js
rm -rf cloudfunctions/quickstartFunctions
```

- [ ] **Step 2: 重写 `miniprogram/app.json`**

完整文件内容:
```json
{
  "pages": [
    "pages/index/index",
    "pages/rooms/index",
    "pages/bill/edit/index",
    "pages/bill/history/index",
    "pages/unauthorized/index"
  ],
  "window": {
    "backgroundColor": "#F6F6F6",
    "backgroundTextStyle": "light",
    "navigationBarBackgroundColor": "#F6F6F6",
    "navigationBarTitleText": "收租",
    "navigationBarTextStyle": "black"
  },
  "sitemapLocation": "sitemap.json",
  "style": "v2",
  "lazyCodeLoading": "requiredComponents"
}
```

- [ ] **Step 3: 简化 `miniprogram/app.wxss`**

完整文件内容:
```css
page {
  background: #f6f6f6;
  font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
}
button {
  background: initial;
}
button:focus {
  outline: 0;
}
button::after {
  border: none;
}
```

- [ ] **Step 4: 改 `project.config.json` 的关键字段**

修改:
- `projectname`: 改为 `"collect_rent"`
- `setting.es6`: 已是 `true`
- `setting.enhance`: 已是 `true`
- 保留 `miniprogramRoot: "miniprogram/"`、`cloudfunctionRoot: "cloudfunctions/"`
- `libVersion`: 改为 `"3.16.1"`（与 private 一致）
- 删除 `condition` 里的 databaseGuide 残留（如存在）

- [ ] **Step 5: 替换 `README.md`**

完整内容:
```markdown
# 收租小程序

家庭自用的微信小程序，跟踪 7 间出租房（101、201、301、302、401、402、旧屋）
的每月应收账单。基于微信云开发。

## 本地运行

1. 在微信开发者工具打开本目录
2. 在 `miniprogram/app.js` 把 `globalData.env` 改为云开发环境 ID
3. 上传并部署 `cloudfunctions/rentApi`
4. 编译运行

## 目录

- `miniprogram/` — 小程序前端
- `cloudfunctions/rentApi/` — 聚合云函数
- `docs/superpowers/` — 设计文档与实施计划
```

- [ ] **Step 6: 创建后续需要的目录骨架**

```bash
mkdir -p miniprogram/utils
mkdir -p miniprogram/components/roomCard
mkdir -p miniprogram/components/billRow
mkdir -p miniprogram/components/collapsibleRoomForm
mkdir -p miniprogram/pages/unauthorized
mkdir -p miniprogram/pages/bill/edit
mkdir -p miniprogram/pages/bill/history
mkdir -p cloudfunctions/rentApi
```

预计不运行此步骤不会报错，留空目录在小程序中会被忽略。

- [ ] **Step 7: 验证开发者工具能编译空骨架**

打开微信开发者工具 → 编译 → 报"app.json pages 路径找不到"是预期的（因为页面文件还未创建），但项目应能正常打开。

---

### Task 2：初始化项目为 Git 仓库（可选，便于频繁 commit）

**Files:**
- Create: `.gitignore`
- Create: `.git/`（由 `git init` 创建）

- [ ] **Step 1: 创建 `.gitignore`**

完整内容:
```
node_modules/
miniprogram_npm/
.superpowers/brainstorm/
.DS_Store
*.log
```

- [ ] **Step 2: 初始化 git 并首次提交**

```bash
git init
git add .
git commit -m "chore: clean QuickStart and scaffold directories"
```

**注意**：项目当前不是 git 仓库（见环境元信息）。如果不想用 git，可跳过此 Task，余下 Task 中所有 commit 步骤可改为"继续下一步"。后续 Task 的 commit 命令会保留，因为该工程化习惯有助于追踪改动。

---

## Phase 1：安装 Vant Weapp

### Task 3：安装 Vant Weapp 与 ec-canvas

**Files:**
- Modify: `project.config.json`
- Create: `miniprogram/package.json`
- Create: `miniprogram/.npmrc`

- [ ] **Step 1: 在 `miniprogram/` 创建 `package.json`**

完整内容:
```json
{
  "name": "collect-rent-miniprogram",
  "version": "1.0.0",
  "description": "收租小程序前端",
  "dependencies": {
    "@vant/weapp": "^1.11.7",
    "ec-canvas": "^1.0.0"
  }
}
```

- [ ] **Step 2: 在 `miniprogram/` 创建 `.npmrc`**

完整内容:
```
registry=https://registry.npmmirror.com
```

用 npmmirror 避免国内下不动（不必亦可）。

- [ ] **Step 3: 配置 `project.config.json` 让开发者工具启用 npm 构建**

修改（合并到现有 `setting` 字段）:
```json
"setting": {
  "es6": true,
  "enhance": true,
  "postcss": true,
  "minified": true,
  "useCompilerModule": true,
  "userConfirmedUseCompilerModuleSwitch": true
}
```

并在顶层加 `compileType: "miniprogram"`（如有则保留）。

- [ ] **Step 4: 在 `miniprogram/` 目录运行 npm install**

```bash
cd miniprogram
npm install
cd ..
```

期望输出: `node_modules/` 与 `miniprogram_npm/` 被创建。

- [ ] **Step 5: 在开发者工具里点"工具" → "构建 npm"**

期望: `miniprogram/miniprogram_npm/` 出现 `@vant/weapp/` 与 `ec-canvas/`。

- [ ] **Step 6: 提交**

```bash
git add miniprogram/package.json miniprogram/package-lock.json miniprogram/.npmrc miniprogram/miniprogram_npm/ project.config.json
git commit -m "chore: install Vant Weapp and ec-canvas"
```

---

## Phase 2：核心纯函数 `computeBill`（TDD）

### Task 4：建测试 runner

**Files:**
- Create: `package.json`（项目根，区分 miniprogram 内的）
- Modify: 后续运行 `npm test` 用 node 内置 `node --test`

- [ ] **Step 1: 在项目根创建 `package.json`**

完整内容:
```json
{
  "name": "collect-rent",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test miniprogram/utils/billing.test.js"
  }
}
```

- [ ] **Step 2: 确认 Node.js 可用**

```bash
node --version
```

期望: `v18.0.0` 或更高（`node:test` 需要）。

---

### Task 5：TDD — `computeBill` 基础（月费固定 + 第一张账单）

**Files:**
- Create: `miniprogram/utils/billing.js`
- Test: `miniprogram/utils/billing.test.js`

- [ ] **Step 1: 写失败的测试**

`miniprogram/utils/billing.test.js` 完整内容:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBill } from './billing.js';

const baseRoom = {
  rent: 500,
  water_unit_price: 3,
  elec_unit_price: 0.6,
  garbage_fee: 10,
  internet_fee: 50,
  initial_water_reading: 0,
  initial_elec_reading: 0,
};

test('first month: usage is current - initial, fees calculated', () => {
  const bill = computeBill(baseRoom, null, { water_reading: 10, elec_reading: 100 });
  assert.equal(bill.water_fee, 30);     // 10 * 3
  assert.equal(bill.elec_fee, 60);      // 100 * 0.6
  assert.equal(bill.base_fee, 560);     // 500 + 10 + 50
  assert.equal(bill.total, 650);
});

test('subsequent month: usage is current - prev', () => {
  const prev = { water_reading: 10, elec_reading: 100 };
  const bill = computeBill(baseRoom, prev, { water_reading: 15, elec_reading: 140 });
  assert.equal(bill.water_fee, 15);     // 5 * 3
  assert.equal(bill.elec_fee, 24);      // 40 * 0.6
  assert.equal(bill.base_fee, 560);
  assert.equal(bill.total, 599);
});

test('usage never negative', () => {
  const prev = { water_reading: 100, elec_reading: 2000 };
  const bill = computeBill(baseRoom, prev, { water_reading: 90, elec_reading: 1990 });
  assert.equal(bill.water_fee, 0);
  assert.equal(bill.elec_fee, 0);
});

test('rounds to 2 decimal places', () => {
  const room = { ...baseRoom, water_unit_price: 3.33 };
  const bill = computeBill(room, null, { water_reading: 0.1, elec_reading: 0 });
  assert.equal(bill.water_fee, 0.33); // 0.1 * 3.33 = 0.333 -> rounded
});

test('uses initial reading when no prev bill', () => {
  const room = { ...baseRoom, initial_water_reading: 1000 };
  const bill = computeBill(room, null, { water_reading: 1010, elec_reading: 0 });
  assert.equal(bill.water_fee, 30);    // 10 * 3
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npm test
```

期望: 5 个 test 全部 FAIL（`Cannot find module './billing.js'`）。

- [ ] **Step 3: 实现 `billing.js`**

`miniprogram/utils/billing.js` 完整内容:
```js
function round2(n) {
  return Math.round(n * 100) / 100;
}

export function computeBill(room, prevBill, current) {
  const prevWater = prevBill ? prevBill.water_reading : (room.initial_water_reading ?? 0);
  const prevElec  = prevBill ? prevBill.elec_reading  : (room.initial_elec_reading  ?? 0);
  const baseFee = room.rent + room.garbage_fee + room.internet_fee;
  const waterUsage = Math.max(0, current.water_reading - prevWater);
  const elecUsage  = Math.max(0, current.elec_reading  - prevElec);
  const waterFee = round2(waterUsage * room.water_unit_price);
  const elecFee  = round2(elecUsage  * room.elec_unit_price);
  return {
    water_fee: waterFee,
    elec_fee:  elecFee,
    base_fee:  baseFee,
    total:     round2(baseFee + waterFee + elecFee),
  };
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npm test
```

期望: 5 个 test 全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add package.json miniprogram/utils/billing.js miniprogram/utils/billing.test.js
git commit -m "feat: implement computeBill with TDD"
```

---

## Phase 3：云函数 `rentApi`

### Task 6：云函数基础（package.json + index.js 骨架）

**Files:**
- Create: `cloudfunctions/rentApi/package.json`
- Create: `cloudfunctions/rentApi/index.js`
- Create: `cloudfunctions/rentApi/billing.js`
- Create: `cloudfunctions/rentApi/config.json`

- [ ] **Step 1: 创建 `cloudfunctions/rentApi/package.json`**

完整内容:
```json
{
  "name": "rentApi",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~2.4.0"
  }
}
```

- [ ] **Step 2: 创建 `cloudfunctions/rentApi/billing.js`**

完整内容（与前端一致的纯函数，在云端 Node.js CommonJS 环境运行）:
```js
function round2(n) {
  return Math.round(n * 100) / 100;
}

function computeBill(room, prevBill, current) {
  const prevWater = prevBill ? prevBill.water_reading : (room.initial_water_reading ?? 0);
  const prevElec  = prevBill ? prevBill.elec_reading  : (room.initial_elec_reading  ?? 0);
  const baseFee = room.rent + room.garbage_fee + room.internet_fee;
  const waterUsage = Math.max(0, current.water_reading - prevWater);
  const elecUsage  = Math.max(0, current.elec_reading  - prevElec);
  const waterFee = round2(waterUsage * room.water_unit_price);
  const elecFee  = round2(elecUsage  * room.elec_unit_price);
  return {
    water_fee: waterFee,
    elec_fee:  elecFee,
    base_fee:  baseFee,
    total:     round2(baseFee + waterFee + elecFee),
  };
}

module.exports = { computeBill, round2 };
```

- [ ] **Step 3: 创建 `cloudfunctions/rentApi/index.js`（骨架）**

完整内容:
```js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const { computeBill } = require('./billing');

const SEED_ROOMS = [
  { code: '101',  name: '', rent: 0, water_unit_price: 0, elec_unit_price: 0, garbage_fee: 0, internet_fee: 0, initial_water_reading: 0, initial_elec_reading: 0, status: 'active' },
  { code: '201',  name: '', rent: 0, water_unit_price: 0, elec_unit_price: 0, garbage_fee: 0, internet_fee: 0, initial_water_reading: 0, initial_elec_reading: 0, status: 'active' },
  { code: '301',  name: '', rent: 0, water_unit_price: 0, elec_unit_price: 0, garbage_fee: 0, internet_fee: 0, initial_water_reading: 0, initial_elec_reading: 0, status: 'active' },
  { code: '302',  name: '', rent: 0, water_unit_price: 0, elec_unit_price: 0, garbage_fee: 0, internet_fee: 0, initial_water_reading: 0, initial_elec_reading: 0, status: 'active' },
  { code: '401',  name: '', rent: 0, water_unit_price: 0, elec_unit_price: 0, garbage_fee: 0, internet_fee: 0, initial_water_reading: 0, initial_elec_reading: 0, status: 'active' },
  { code: '402',  name: '', rent: 0, water_unit_price: 0, elec_unit_price: 0, garbage_fee: 0, internet_fee: 0, initial_water_reading: 0, initial_elec_reading: 0, status: 'active' },
  { code: '旧屋',  name: '', rent: 0, water_unit_price: 0, elec_unit_price: 0, garbage_fee: 0, internet_fee: 0, initial_water_reading: 0, initial_elec_reading: 0, status: 'active' },
];

async function isAuthorized(openid) {
  const { total } = await db.collection('admins').where({ _id: openid }).count();
  return total > 0;
}

async function ensureFirstAdmin(openid) {
  const { total } = await db.collection('admins').count();
  if (total === 0) {
    await db.collection('admins').add({
      data: { _id: openid, name: '管理员', created_at: new Date() },
    });
  }
  return await isAuthorized(openid);
}

async function seedRoomsIfEmpty() {
  const { total } = await db.collection('rooms').count();
  if (total === 0) {
    for (const room of SEED_ROOMS) {
      await db.collection('rooms').add({
        data: {
          ...room,
          _openid: 'system',
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
    }
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const t = event.type;

  try {
    switch (t) {
      case 'getOpenId': {
        const ok = await ensureFirstAdmin(openid);
        return { openid, isAdmin: ok };
      }
      case 'seedRooms': {
        await seedRoomsIfEmpty();
        return { ok: true };
      }
      case 'getRooms': {
        if (!await isAuthorized(openid)) return { errCode: 'NOT_AUTHORIZED' };
        const { data } = await db.collection('rooms').orderBy('code', 'asc').get();
        return { rooms: data };
      }
      default:
        return { errCode: 'UNKNOWN_TYPE', type: t };
    }
  } catch (e) {
    return { errCode: 'INTERNAL', message: e.message };
  }
};
```

**注**：`'旧屋'` 字符串在 JSON/JS 里合法，但 DB 索引对其支持依赖云开发 V2 SDK。测试时留意排序。

- [ ] **Step 4: 创建 `cloudfunctions/rentApi/config.json`**

完整内容:
```json
{
  "permissions": {
    "openapi": []
  }
}
```

现在无需 openapi 权限（没用 `cloud.openapi.*`）。

- [ ] **Step 5: 在开发者工具右键 `cloudfunctions/rentApi` → "上传并部署-云端安装依赖"**

期望: 上传成功；云开发控制台能看到 `rentApi` 函数。

- [ ] **Step 6: 在云开发控制台创建 3 个集合（如果还没有）**

集合: `rooms`、`bills`、`admins`。

- [ ] **Step 7: 验证：首次调用 getOpenId 应创建 admins 文档**

小程序端或在云开发控制台 → 云函数测试：
```
event = { "type": "getOpenId" }
```

期望: `{ openid: "oXxx...", isAdmin: true }`。然后查 `admins` 集合，应有 1 条文档，`_id === openid`。

---

### Task 7：云函数 — `seedRooms` 真测试

**Files:** (无修改，仅验证)

- [ ] **Step 1: 调用 seedRooms**

```
event = { "type": "seedRooms" }
```

期望: `{ ok: true }`。

- [ ] **Step 2: 查询 rooms 集合**

期望: 7 条文档，code 字段分别为 `"101"`, `"201"`, `"301"`, `"302"`, `"401"`, `"402"`, `"旧屋"`。

- [ ] **Step 3: 再次调用 seedRooms**

期望: 仍是 `{ ok: true }`，但 rooms 数量仍为 7（idempotent）。

- [ ] **Step 4: 提交**

```bash
git add cloudfunctions/rentApi/
git commit -m "feat(cloud): rentApi skeleton + seed + auth + getOpenId"
```

---

### Task 8：云函数 — `getRooms` + `upsertRoom`

**Files:**
- Modify: `cloudfunctions/rentApi/index.js`

- [ ] **Step 1: 添加 `getRooms` 分支（已有确认）**

`exports.main` switch 里 `getRooms` 分支保留——已通过 auth 校验后查 rooms。

- [ ] **Step 2: 添加 `upsertRoom` 分支**

替换 `exports.main` 末尾的 `default` 之前，在 `getRooms` 后加:
```js
      case 'upsertRoom': {
        if (!await isAuthorized(openid)) return { errCode: 'NOT_AUTHORIZED' };
        const r = event.room;
        if (!r || !r.code) return { errCode: 'INVALID_INPUT' };
        const { _id } = r;
        delete r._id;
        const data = {
          ...r,
          updated_at: new Date(),
        };
        if (_id) {
          await db.collection('rooms').doc(_id).update({ data });
        } else {
          const { total } = await db.collection('rooms').where({ code: r.code }).count();
          if (total > 0) return { errCode: 'ROOM_CODE_DUPLICATE' };
          data._openid = openid;
          data.created_at = new Date();
          await db.collection('rooms').add({ data });
        }
        return { ok: true };
      }
```

- [ ] **Step 3: 上传部署 + 测试**

在云函数测试面板：
```
event = { "type": "getRooms" }
```

期望: `rooms: [7 条]`，按 code 升序。

然后:
```
event = { "type": "upsertRoom", "room": { "code": "101", "name": "张老师", "rent": 500, "water_unit_price": 3, "elec_unit_price": 0.6, "garbage_fee": 10, "internet_fee": 50, "initial_water_reading": 0, "initial_elec_reading": 0, "status": "active" } }
```

期望: `{ ok: true }`。再调用 `getRooms`，101 房间应已更新。

---

### Task 9：云函数 — `getPrevBill` + `getBill` + `upsertBill`

**Files:**
- Modify: `cloudfunctions/rentApi/index.js`

- [ ] **Step 1: 添加 `getPrevBill` 分支**

```js
      case 'getPrevBill': {
        if (!await isAuthorized(openid)) return { errCode: 'NOT_AUTHORIZED' };
        const { roomId, yearMonth } = event;
        if (!roomId || !yearMonth) return { errCode: 'INVALID_INPUT' };
        const { data } = await db.collection('bills').where({
          room_id: roomId,
          year_month: _.lt(yearMonth),
        }).orderBy('year_month', 'desc').limit(1).get();
        return { prev: data[0] || null };
      }
```

- [ ] **Step 2: 添加 `getBill` 分支**

```js
      case 'getBill': {
        if (!await isAuthorized(openid)) return { errCode: 'NOT_AUTHORIZED' };
        const { roomId, yearMonth } = event;
        const { data } = await db.collection('bills').where({
          room_id: roomId,
          year_month: yearMonth,
        }).limit(1).get();
        return { bill: data[0] || null };
      }
```

- [ ] **Step 3: 添加 `upsertBill` 分支**

```js
      case 'upsertBill': {
        if (!await isAuthorized(openid)) return { errCode: 'NOT_AUTHORIZED' };
        const { roomId, yearMonth, water_reading, elec_reading } = event;
        if (!roomId || !yearMonth) return { errCode: 'INVALID_INPUT' };
        if (typeof water_reading !== 'number' || typeof elec_reading !== 'number') {
          return { errCode: 'INVALID_READING' };
        }

        const roomRes = await db.collection('rooms').doc(roomId).get();
        const room = roomRes.data;
        if (!room) return { errCode: 'ROOM_NOT_FOUND' };

        const prevRes = await db.collection('bills').where({
          room_id: roomId,
          year_month: _.lt(yearMonth),
        }).orderBy('year_month', 'desc').limit(1).get();
        const prevBill = prevRes.data[0] || null;

        const result = computeBill(room, prevBill, {
          water_reading,
          elec_reading,
        });

        const doc = {
          room_id: roomId,
          year_month: yearMonth,
          water_reading,
          elec_reading,
          water_fee: result.water_fee,
          elec_fee: result.elec_fee,
          base_fee: result.base_fee,
          total: result.total,
          updated_at: new Date(),
        };

        const existingRes = await db.collection('bills').where({
          room_id: roomId,
          year_month: yearMonth,
        }).limit(1).get();
        const existing = existingRes.data[0];

        if (existing) {
          doc._openid = existing._openid;
          await db.collection('bills').doc(existing._id).update({ data: doc });
          return { ok: true, _id: existing._id };
        } else {
          doc._openid = openid;
          doc.created_at = new Date();
          const addRes = await db.collection('bills').add({ data: doc });
          return { ok: true, _id: addRes._id };
        }
      }
```

- [ ] **Step 4: 上传部署 + 验证**

测试序列：

4a. `getBill` 不存在的账单：
```
event = { "type": "getBill", "roomId": "<rooms._id>", "yearMonth": "2026-07" }
```
期望: `{ bill: null }`。

4b. `upsertBill` 第一张账单（无 prev，应得到 base_fee + 0 水电费）：
```
event = { "type": "upsertBill", "roomId": "<rooms._id>", "yearMonth": "2026-07", "water_reading": 0, "elec_reading": 0 }
```
（如果 initial_* = 0）期望: `{ ok: true, _id: "..." }`，并 bill.total = room.rent + room.garbage_fee + room.internet_fee。

4c. `getPrevBill` 验证：
```
event = { "type": "getPrevBill", "roomId": "<rooms._id>", "yearMonth": "2026-08" }
```
期望: `{ prev: { room_id, year_month: "2026-07", water_reading: 0, ... } }`。

- [ ] **Step 5: 提交**

```bash
git add cloudfunctions/rentApi/index.js
git commit -m "feat(cloud): getPrevBill, getBill, upsertBill with server-side computeBill"
```

---

### Task 10：云函数 — `getHistory`

**Files:**
- Modify: `cloudfunctions/rentApi/index.js`

- [ ] **Step 1: 添加 `getHistory` 分支**

```js
      case 'getHistory': {
        if (!await isAuthorized(openid)) return { errCode: 'NOT_AUTHORIZED' };
        const { roomId, limit = 12, offset = 0 } = event;
        const { data } = await db.collection('bills').where({ room_id: roomId })
          .orderBy('year_month', 'desc')
          .skip(offset)
          .limit(limit)
          .get();
        return { bills: data };
      }
```

- [ ] **Step 2: 上传部署 + 验证**

```
event = { "type": "getHistory", "roomId": "<rooms._id>", "limit": 12, "offset": 0 }
```

期望: `{ bills: [{...}] }`，按 `year_month` 倒序。

---

### Task 11：云函数 — `exportCsv`（写云存储 → 返回 fileID）

**Files:**
- Modify: `cloudfunctions/rentApi/index.js`
- Modify: `cloudfunctions/rentApi/config.json`

- [ ] **Step 1: 给 `config.json` 加云存储权限**

`cloudfunctions/rentApi/config.json` 完整内容:
```json
{
  "permissions": {
    "openapi": []
  }
}
```

云存储上传不需要额外的 openapi 权限（使用 `cloud.uploadFile` 是 backend API）。

- [ ] **Step 2: 添加 `exportCsv` 分支**

```js
      case 'exportCsv': {
        if (!await isAuthorized(openid)) return { errCode: 'NOT_AUTHORIZED' };
        const { roomId } = event;
        if (!roomId) return { errCode: 'INVALID_INPUT' };

        const roomRes = await db.collection('rooms').doc(roomId).get();
        const room = roomRes.data;
        if (!room) return { errCode: 'ROOM_NOT_FOUND' };

        const { data: bills } = await db.collection('bills').where({ room_id: roomId })
          .orderBy('year_month', 'asc').get();

        const header = 'year_month,water_reading,water_fee,elec_reading,elec_fee,base_fee,total\n';
        const rows = bills.map(b =>
          [b.year_month, b.water_reading, b.water_fee, b.elec_reading, b.elec_fee, b.base_fee, b.total].join(',')
        ).join('\n');
        const csv = header + rows + '\n';

        const fileName = `rent-${room.code}-${Date.now()}.csv`;
        const upload = await cloud.uploadFile({
          cloudPath: `exports/${fileName}`,
          fileContent: Buffer.from(csv, 'utf-8'),
        });

        // 24h 后清理
        setTimeout(async () => {
          try { await cloud.deleteFile({ fileList: [upload.fileID] }); } catch (e) {}
        }, 24 * 60 * 60 * 1000);

        return { fileID: upload.fileID };
      }
```

**注意**：微信云开发的 `setTimeout` 在云函数里最长 24h（不会阻塞返回，因为是异步的）。

- [ ] **Step 3: 上传部署 + 验证**

```
event = { "type": "exportCsv", "roomId": "<rooms._id>" }
```

期望: `{ fileID: "cloud://..../exports/rent-101-....csv" }`。

云开发控制台 → 存储 → `exports/` 目录下应能看到文件。

- [ ] **Step 4: 提交**

```bash
git add cloudfunctions/rentApi/
git commit -m "feat(cloud): getHistory + exportCsv"
```

---

## Phase 4：邀请码与 joinFamily

### Task 12：云函数 — 邀请码（生成/读取/重新生成/加入）

**Files:**
- Modify: `cloudfunctions/rentApi/index.js`

- [ ] **Step 1: 添加三个分支**

```js
      case 'getInviteCode': {
        if (!await isAuthorized(openid)) return { errCode: 'NOT_AUTHORIZED' };
        const { data } = await db.collection('_config').doc('inviteCode').get();
        if (data && data.code) return { code: data.code };
        const code = generateCode();
        await db.collection('_config').add({
          data: { _id: 'inviteCode', code, created_at: new Date() },
        });
        return { code };
      }
      case 'regenerateInviteCode': {
        if (!await isAuthorized(openid)) return { errCode: 'NOT_AUTHORIZED' };
        const code = generateCode();
        try {
          await db.collection('_config').doc('inviteCode').update({ data: { code } });
        } catch (e) {
          await db.collection('_config').add({
            data: { _id: 'inviteCode', code, created_at: new Date() },
          });
        }
        return { code };
      }
      case 'joinFamily': {
        const { code } = event;
        if (!code) return { errCode: 'INVALID_INPUT' };
        const { data } = await db.collection('_config').doc('inviteCode').get();
        if (!data || data.code !== code) return { errCode: 'BAD_CODE' };
        const dup = await db.collection('admins').where({ _id: openid }).count();
        if (dup.total > 0) return { ok: true };
        await db.collection('admins').add({
          data: { _id: openid, name: '管理员', created_at: new Date() },
        });
        return { ok: true };
      }
```

- [ ] **Step 2: 在顶部加 `generateCode` 工具**

`cloudfunctions/rentApi/index.js` 顶部加:
```js
function generateCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 排除容易混淆的
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
```

- [ ] **Step 3: 上传部署 + 测试**

3a. `getInviteCode`：期望得到 6 位字符串。

3b. `joinFamily` 用错误码：`{ type: 'joinFamily', code: 'WRONG1' }` → `{ errCode: 'BAD_CODE' }`。

3c. `joinFamily` 用正确码 → `{ ok: true }`，再查 `admins` 集合多了一条。

- [ ] **Step 4: 提交**

```bash
git add cloudfunctions/rentApi/index.js
git commit -m "feat(cloud): invite code generation and join"
```

---

## Phase 5：前端基础

### Task 13：`utils/format.js` — `year_month` 工具

**Files:**
- Create: `miniprogram/utils/format.js`

- [ ] **Step 1: 实现**

完整内容:
```js
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

export function formatYearMonthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${y} 年 ${m} 月`;
}

export function formatMoney(n) {
  return Number(n || 0).toFixed(2);
}
```

- [ ] **Step 2: 提交**

```bash
git add miniprogram/utils/format.js
git commit -m "feat(utils): year-month and money formatters"
```

---

### Task 14：`utils/api.js` — `rentApi` 调用封装

**Files:**
- Create: `miniprogram/utils/api.js`

- [ ] **Step 1: 实现**

完整内容:
```js
export async function callRentApi(type, data = {}) {
  const res = await wx.cloud.callFunction({ name: 'rentApi', data: { type, ...data } });
  if (res.result && res.result.errCode) {
    const err = new Error(res.result.errCode);
    err.code = res.result.errCode;
    throw err;
  }
  return res.result;
}
```

- [ ] **Step 2: 提交**

```bash
git add miniprogram/utils/api.js
git commit -m "feat(utils): api wrapper for rentApi"
```

---

### Task 15：`utils/auth.js` — 登录 & 白名单判定

**Files:**
- Create: `miniprogram/utils/auth.js`

- [ ] **Step 1: 实现**

完整内容:
```js
import { callRentApi } from './api.js';

let _openid = null;
let _isAdmin = null;

export async function getOpenId() {
  if (_openid) return _openid;
  const res = await callRentApi('getOpenId');
  _openid = res.openid;
  _isAdmin = res.isAdmin;
  return _openid;
}

export async function isAdmin() {
  if (_isAdmin === null) await getOpenId();
  return _isAdmin === true;
}

export async function joinFamily(code) {
  const res = await callRentApi('joinFamily', { code });
  _isAdmin = true;
  return res;
}

export function clearSession() {
  _openid = null;
  _isAdmin = null;
}
```

- [ ] **Step 2: 提交**

```bash
git add miniprogram/utils/auth.js
git commit -m "feat(utils): auth helpers"
```

---

### Task 16：改写 `miniprogram/app.js` — 登录 + 种子 rooms

**Files:**
- Modify: `miniprogram/app.js`

- [ ] **Step 1: 替换 `app.js`**

完整内容:
```js
import { getOpenId, isAdmin } from './utils/auth.js';

App({
  globalData: {
    env: '',  // 填入云开发环境 ID
    isAdmin: false,
    openid: null,
  },

  async onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }
    wx.cloud.init({
      env: this.globalData.env,
      traceUser: true,
    });

    try {
      this.globalData.openid = await getOpenId();
      this.globalData.isAdmin = await isAdmin();
    } catch (e) {
      console.error('auth init failed', e);
    }
  },

  ensureAdmin() {
    return this.globalData.isAdmin;
  },
});
```

- [ ] **Step 2: 提交**

```bash
git add miniprogram/app.js
git commit -m "feat(app): init cloud + login flow on launch"
```

---

### Task 17：未授权页面 `pages/unauthorized`

**Files:**
- Create: `pages/unauthorized/index.{js,wxml,wxss,json}`

- [ ] **Step 1: `index.json`**

完整内容:
```json
{ "navigationBarTitleText": "未授权" }
```

- [ ] **Step 2: `index.wxml`**

完整内容:
```xml
<view class="wrap">
  <view class="title">尚未加入家庭</view>
  <view class="tip">向家庭管理员索取邀请码，输入下方以加入。</view>
  <van-field
    label="邀请码"
    placeholder="6 位字母数字"
    value="{{ code }}"
    bind:input="onInput"
    maxlength="{{ 6 }}"
  />
  <van-button type="primary" block bind:click="onSubmit">加入</van-button>
  <view wx:if="{{ err }}" class="err">{{ err }}</view>
</view>
```

- [ ] **Step 3: `index.wxss`**

完整内容:
```css
.wrap {
  padding: 60rpx 40rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
.title {
  font-size: 40rpx;
  font-weight: 600;
}
.tip {
  font-size: 26rpx;
  color: #888;
}
.err {
  color: #e54545;
  font-size: 26rpx;
}
```

- [ ] **Step 4: `index.js`**

完整内容:
```js
import { joinFamily } from '../../utils/auth.js';

Page({
  data: { code: '', err: '' },
  onInput(e) {
    this.setData({ code: e.detail.value.toUpperCase(), err: '' });
  },
  async onSubmit() {
    const code = (this.data.code || '').trim();
    if (code.length !== 6) {
      this.setData({ err: '请输入 6 位邀请码' });
      return;
    }
    try {
      await joinFamily(code);
      wx.reLaunch({ url: '/pages/index/index' });
    } catch (e) {
      const msg = e.code === 'BAD_CODE' ? '邀请码不正确' : '加入失败，请重试';
      this.setData({ err: msg });
    }
  },
});
```

- [ ] **Step 5: 测试**

在 WeChat DevTools 模拟器打开，从未授权状态进入，输入错误码 → "邀请码不正确"；用 getInviteCode 查到的真码 → 应跳首页。

---

## Phase 6：首页（房间卡片）

### Task 18：`components/roomCard`

**Files:**
- Create: `miniprogram/components/roomCard/index.{js,wxml,wxss,json}`

- [ ] **Step 1: `index.json`**

```json
{
  "component": true,
  "usingComponents": {
    "van-button": "@vant/weapp/button/index"
  }
}
```

- [ ] **Step 2: `index.wxml`**

完整内容:
```xml
<view class="card">
  <view class="head">
    <view class="title">{{ room.code }}<text wx:if="{{ room.name }}" class="name"> · {{ room.name }}</text></view>
    <view class="amount">
      <text wx:if="{{ hasBill }}">{{ billLabel }} 应缴 <text class="num">¥{{ billTotal }}</text></text>
      <text wx:else class="empty">{{ billLabel }} 未生成</text>
    </view>
  </view>
  <view class="actions">
    <van-button size="small" bind:click="onSettings">⚙️ 租金设置</van-button>
    <van-button size="small" type="primary" bind:click="onGenerate" disabled="{{ !isActive }}">📝 生成账单</van-button>
    <van-button size="small" bind:click="onHistory">📊 历史账单</van-button>
  </view>
</view>
```

- [ ] **Step 3: `index.wxss`**

```css
.card {
  border: 2rpx solid #e5e5e5;
  border-radius: 16rpx;
  padding: 24rpx;
  background: #fff;
  margin-bottom: 24rpx;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16rpx;
}
.title {
  font-size: 32rpx;
  font-weight: 600;
}
.name { color: #888; font-weight: 400; font-size: 28rpx; }
.amount {
  font-size: 24rpx;
  color: #888;
  text-align: right;
}
.num {
  color: #e54545;
  font-weight: 600;
}
.empty { color: #aaa; }
.actions {
  display: flex;
  gap: 16rpx;
}
.actions van-button { flex: 1; }
```

- [ ] **Step 4: `index.js`**

完整内容:
```js
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
```

---

### Task 19：`pages/index/index` — 首页组装

**Files:**
- Create: `miniprogram/pages/index/index.{js,wxml,wxss,json}`

- [ ] **Step 1: `index.json`**

```json
{
  "navigationBarTitleText": "收租",
  "usingComponents": {
    "room-card": "/components/roomCard/index",
    "van-button": "@vant/weapp/button/index"
  }
}
```

- [ ] **Step 2: `index.wxml`**

```xml
<view class="container">
  <view class="header">
    <view class="title">本月 ({{ currentYM }}): ¥{{ sumTotal }}</view>
    <van-button size="mini" bind:click="onSettings">⚙️</van-button>
  </view>
  <view class="cards">
    <room-card
      wx:for="{{ rooms }}"
      wx:key="_id"
      room="{{ item.room }}"
      bill-total="{{ item.billTotal }}"
      has-bill="{{ item.hasBill }}"
      bill-label="{{ item.billLabel }}"
      is-active="{{ item.room.status === 'active' }}"
      bind:settings="onSettings"
      bind:generate="onGenerate"
      bind:history="onHistory"
    />
  </view>
</view>
```

- [ ] **Step 3: `index.wxss`**

```css
.container {
  padding: 24rpx;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 12rpx 30rpx;
}
.title {
  font-size: 30rpx;
  font-weight: 600;
}
.cards {
  display: flex;
  flex-direction: column;
}
```

- [ ] **Step 4: `index.js`**

完整内容:
```js
import { callRentApi } from '../../utils/api.js';
import { currentYearMonth, shiftYearMonth, formatYearMonthLabel } from '../../utils/format.js';

const app = getApp();

Page({
  data: {
    rooms: [],
    currentYM: '',
    sumTotal: 0,
  },

  async onShow() {
    if (!app.globalData.isAdmin) {
      wx.reLaunch({ url: '/pages/unauthorized/index' });
      return;
    }
    // 触发 seedRooms（如首次启动还没种）
    try { await callRentApi('seedRooms'); } catch (e) {}

    const ym = currentYearMonth();
    const cacheKey = `billsCache:${ym}`;
    let cached = wx.getStorageSync(cacheKey);

    if (cached && cached.ym === ym) {
      this.render(cached.rooms, ym);
    }

    try {
      const { rooms } = await callRentApi('getRooms');
      const billPromises = rooms.map(r => callRentApi('getBill', { roomId: r._id, yearMonth: ym }).then(res => ({ room: r, bill: res.bill })));
      const bills = await Promise.all(billPromises);
      wx.setStorageSync(cacheKey, { ym, rooms: bills });
      this.render(bills, ym);
    } catch (e) {
      console.error(e);
    }
  },

  render(bills, ym) {
    let sum = 0;
    const rooms = bills.map(({ room, bill }) => {
      const total = bill?.total ?? 0;
      sum += total;
      return {
        room,
        billTotal: total,
        hasBill: !!bill,
        billLabel: formatYearMonthLabel(ym),
      };
    });
    this.setData({ rooms, currentYM: ym, sumTotal: sum.toFixed(2) });
  },

  onSettings(e) {
    const roomId = e.detail?.roomId;
    if (roomId) {
      wx.navigateTo({ url: '/pages/rooms/index?focus=' + roomId });
    } else {
      wx.navigateTo({ url: '/pages/rooms/index' });
    }
  },

  async onGenerate(e) {
    const roomId = e.detail.roomId;
    const ym = currentYearMonth();
    try {
      const { bill } = await callRentApi('getBill', { roomId, yearMonth: ym });
      wx.navigateTo({ url: `/pages/bill/edit/index?roomId=${roomId}&yearMonth=${ym}&id=${bill?._id || ''}` });
    } catch (err) {
      wx.showToast({ title: '打开失败', icon: 'none' });
    }
  },

  onHistory(e) {
    const roomId = e.detail.roomId;
    wx.navigateTo({ url: `/pages/bill/history/index?roomId=${roomId}` });
  },
});
```

- [ ] **Step 5: 验证**

- 启动小程序，期望首页显示 7 张卡片（除 `seedRooms` 没装之外）
- 当月账单未录入 → 显示"未生成"
- 点"租金设置"进入设置页
- 点"生成账单"进入账单编辑页
- 点"历史账单"进入历史页

---

## Phase 7：租金设置页

### Task 20：`components/collapsibleRoomForm`

**Files:**
- Create: `miniprogram/components/collapsibleRoomForm/index.{js,wxml,wxss,json}`

- [ ] **Step 1: `index.json`**

```json
{
  "component": true,
  "usingComponents": {
    "van-collapse": "@vant/weapp/collapse/index",
    "van-collapse-item": "@vant/weapp/collapse-item/index",
    "van-field": "@vant/weapp/field/index"
  }
}
```

- [ ] **Step 2: `index.wxml`**

```xml
<van-collapse value="{{ activeNames }}" bind:change="onChange">
  <van-collapse-item
    wx:for="{{ rooms }}"
    wx:key="_id"
    name="{{ item.code }}"
    title="{{ item.code + (item.name ? ' · ' + item.name : '') }}"
  >
    <view class="section">
      <view class="section-title">费率</view>
      <view class="grid">
        <van-field label="月租 (元)" type="digit" value="{{ item.rent }}" data-key="rent" data-code="{{ item.code }}" bind:change="onField" />
        <van-field label="水单价 (元/吨)" type="digit" value="{{ item.water_unit_price }}" data-key="water_unit_price" data-code="{{ item.code }}" bind:change="onField" />
        <van-field label="电电价 (元/度)" type="digit" value="{{ item.elec_unit_price }}" data-key="elec_unit_price" data-code="{{ item.code }}" bind:change="onField" />
        <van-field label="垃圾费 (元)" type="digit" value="{{ item.garbage_fee }}" data-key="garbage_fee" data-code="{{ item.code }}" bind:change="onField" />
        <van-field label="网络费 (元)" type="digit" value="{{ item.internet_fee }}" data-key="internet_fee" data-code="{{ item.code }}" bind:change="onField" />
      </view>
    </view>
    <view class="section">
      <view class="section-title">表基线</view>
      <view class="hint">在没有账单之前的初始读数；不填默认为 0</view>
      <view class="grid">
        <van-field label="起始水表 (吨)" type="digit" value="{{ item.initial_water_reading }}" data-key="initial_water_reading" data-code="{{ item.code }}" bind:change="onField" />
        <van-field label="起始电表 (度)" type="digit" value="{{ item.initial_elec_reading }}" data-key="initial_elec_reading" data-code="{{ item.code }}" bind:change="onField" />
      </view>
    </view>
    <view class="section">
      <view class="section-title">备注</view>
      <van-field label="备注姓名" value="{{ item.name }}" data-key="name" data-code="{{ item.code }}" bind:change="onField" />
    </view>
  </van-collapse-item>
</van-collapse>
```

- [ ] **Step 3: `index.wxss`**

```css
.section { padding: 16rpx 0; }
.section-title { font-size: 26rpx; color: #888; padding: 8rpx 16rpx; }
.hint { font-size: 22rpx; color: #aaa; padding: 0 16rpx 12rpx; }
.grid { display: flex; flex-direction: column; }
```

- [ ] **Step 4: `index.js`**

```js
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
```

---

### Task 21：`pages/rooms/index` — 租金设置页组装

**Files:**
- Create: `miniprogram/pages/rooms/index.{js,wxml,wxss,json}`

- [ ] **Step 1: `index.json`**

```json
{
  "navigationBarTitleText": "租金设置",
  "usingComponents": {
    "collapsible-room-form": "/components/collapsibleRoomForm/index",
    "van-button": "@vant/weapp/button/index"
  }
}
```

- [ ] **Step 2: `index.wxml`**

```xml
<view class="container">
  <view class="banner">此页设置影响未来账单的费率；改历史读数会自动重算后续账单</view>
  <collapsible-room-form
    rooms="{{ rooms }}"
    active-names="{{ activeNames }}"
    bind:collapsechange="onCollapse"
    bind:fieldchange="onField"
  />
  <view class="footer">
    <van-button type="primary" block bind:click="onSave">保存全部</van-button>
  </view>
</view>
```

- [ ] **Step 3: `index.wxss`**

```css
.container { padding: 24rpx; }
.banner {
  background: #f6f6f6;
  padding: 16rpx 20rpx;
  font-size: 24rpx;
  color: #888;
  border-radius: 8rpx;
  margin-bottom: 20rpx;
}
.footer { padding: 30rpx 0; }
```

- [ ] **Step 4: `index.js`**

```js
import { callRentApi } from '../../utils/api.js';
import { showToast } from '@vant/weapp/toast/toast';

Page({
  data: {
    rooms: [],
    activeNames: [],
  },

  async onLoad(options) {
    const { rooms } = await callRentApi('getRooms');
    const focus = options.focus;
    const active = focus ? [rooms.find(r => r._id === focus)?.code].filter(Boolean) : [];
    this.setData({ rooms, activeNames: active });
  },

  onCollapse(e) {
    this.setData({ activeNames: e.detail.activeNames });
  },

  onField(e) {
    const { key, code, value } = e.detail;
    const rooms = this.data.rooms.map(r =>
      r.code === code ? { ...r, [key]: value } : r
    );
    this.setData({ rooms });
  },

  async onSave() {
    wx.showLoading({ title: '保存中...' });
    try {
      for (const room of this.data.rooms) {
        await callRentApi('upsertRoom', { room });
      }
      wx.hideLoading();
      wx.showToast({ title: '已保存', icon: 'success' });
      // 失效本月账单缓存
      wx.removeStorageSync('billsCache:' + currentYearMonth());
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },
});
```

注：顶部需 `import { currentYearMonth } from '../../utils/format.js';`

- [ ] **Step 5: 验证**

打开设置页 → 改某房间字段 → 保存 → 重新进首页 → 卡片显示当月应缴金额应变化。

---

## Phase 8：生成账单页

### Task 22：`pages/bill/edit/index` — 单房间单月录入

**Files:**
- Create: `miniprogram/pages/bill/edit/index.{js,wxml,wxss,json}`

- [ ] **Step 1: `index.json`**

```json
{
  "navigationBarTitleText": "生成账单",
  "usingComponents": {
    "van-field": "@vant/weapp/field/index",
    "van-button": "@vant/weapp/button/index"
  }
}
```

- [ ] **Step 2: `index.wxml`**

```xml
<view class="container">
  <view class="header">
    <text class="back" bindtap="onPrevMonth">←</text>
    <text class="month">{{ monthLabel }}</text>
    <text class="next" bindtap="onNextMonth">→</text>
  </view>
  <view class="room-label">{{ room.code }}{{ room.name ? ' · ' + room.name : '' }}</view>
  <view class="ref" wx:if="{{ prevWater !== null }}">上月水表：{{ prevWater }} 吨 · 上月电表：{{ prevElec }} 度</view>
  <view class="ref first" wx:elif="{{ !prevWater && prevWater !== null }}">无上月读数，本次度数将作为基线（参考：起始水 {{ initialWater }} 吨 / 起始电 {{ initialElec }} 度）</view>

  <view class="form">
    <van-field label="水表 (吨)" type="digit" value="{{ waterReading }}" data-key="waterReading" bind:change="onReading" />
    <van-field label="电表 (度)" type="digit" value="{{ elecReading }}" data-key="elecReading" bind:change="onReading" />
  </view>

  <view class="breakdown">
    <view class="row"><text>月租</text><text>¥{{ breakdown.base_fee - breakdown.garbage_fee - breakdown.internet_fee }}</text></view>
    <view class="row" wx:if="{{ breakdown.garbage_fee > 0 }}"><text>垃圾费</text><text>¥{{ breakdown.garbage_fee }}</text></view>
    <view class="row" wx:if="{{ breakdown.internet_fee > 0 }}"><text>网络费</text><text>¥{{ breakdown.internet_fee }}</text></view>
    <view class="row"><text>水（{{ breakdown.water_usage }} 吨 × ¥{{ room.water_unit_price }}）</text><text>¥{{ breakdown.water_fee }}</text></view>
    <view class="row"><text>电（{{ breakdown.elec_usage }} 度 × ¥{{ room.elec_unit_price }}）</text><text>¥{{ breakdown.elec_fee }}</text></view>
    <view class="row total"><text>合计应缴</text><text>¥{{ breakdown.total }}</text></view>
  </view>

  <van-button type="primary" block bind:click="onSave">保存</van-button>
</view>
```

- [ ] **Step 3: `index.wxss`**

```css
.container { padding: 30rpx 40rpx; display: flex; flex-direction: column; }
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #eee;
  margin-bottom: 30rpx;
}
.back, .next { font-size: 40rpx; padding: 0 20rpx; }
.month { font-size: 32rpx; font-weight: 600; }
.room-label { font-size: 36rpx; font-weight: 600; margin-bottom: 20rpx; }
.ref { background: #f6f6f6; padding: 16rpx 20rpx; border-radius: 8rpx; font-size: 24rpx; color: #666; margin-bottom: 30rpx; }
.ref.first { background: #fff7e6; }
.form { margin-bottom: 30rpx; }
.breakdown { background: #fafafa; padding: 20rpx; border-radius: 8rpx; margin-bottom: 30rpx; }
.row { display: flex; justify-content: space-between; padding: 8rpx 0; font-size: 26rpx; }
.row.total { border-top: 2rpx solid #333; margin-top: 8rpx; padding-top: 16rpx; font-size: 32rpx; font-weight: 600; }
.row.total text:last-child { color: #e54545; }
```

- [ ] **Step 4: `index.js`**

完整内容:
```js
import { callRentApi } from '../../../utils/api.js';
import { computeBill } from '../../../utils/billing.js';
import { shiftYearMonth, formatYearMonthLabel, currentYearMonth } from '../../../utils/format.js';

Page({
  data: {
    roomId: '',
    room: null,
    yearMonth: '',
    monthLabel: '',
    waterReading: '',
    elecReading: '',
    prevWater: null,
    prevElec: null,
    initialWater: 0,
    initialElec: 0,
    breakdown: { water_fee: 0, elec_fee: 0, base_fee: 0, total: 0, water_usage: 0, elec_usage: 0, garbage_fee: 0, internet_fee: 0 },
  },

  async onLoad(options) {
    const roomId = options.roomId;
    const yearMonth = options.yearMonth || currentYearMonth();
    const rooms = (await callRentApi('getRooms')).rooms;
    const room = rooms.find(r => r._id === roomId);
    const { bill } = await callRentApi('getBill', { roomId, yearMonth });
    const { prev } = await callRentApi('getPrevBill', { roomId, yearMonth });

    this.setData({
      roomId,
      room,
      yearMonth,
      monthLabel: formatYearMonthLabel(yearMonth),
      waterReading: bill?.water_reading ?? '',
      elecReading: bill?.elec_reading ?? '',
      prevWater: prev?.water_reading ?? null,
      prevElec: prev?.elec_reading ?? null,
      initialWater: room.initial_water_reading ?? 0,
      initialElec: room.initial_elec_reading ?? 0,
    });

    if (this.data.waterReading !== '' || this.data.elecReading !== '') {
      this.recalc();
    }
  },

  onReading(e) {
    const { key } = e.currentTarget.dataset;
    this.setData({ [key]: e.detail }, () => this.recalc());
  },

  recalc() {
    const { room, prevWater, prevElec, initialWater, initialElec, waterReading, elecReading } = this.data;
    if (waterReading === '' || elecReading === '') {
      this.setData({
        breakdown: { water_fee: 0, elec_fee: 0, base_fee: room.rent + room.garbage_fee + room.internet_fee, total: room.rent + room.garbage_fee + room.internet_fee, water_usage: 0, elec_usage: 0, garbage_fee: room.garbage_fee, internet_fee: room.internet_fee },
      });
      return;
    }
    const prev = (prevWater !== null) ? { water_reading: prevWater, elec_reading: prevElec } : null;
    const w = Number(waterReading);
    const e = Number(elecReading);
    const result = computeBill(room, prev, { water_reading: w, elec_reading: e });
    const waterUsage = prev ? Math.max(0, w - prevWater) : w - (initialWater || 0);
    const elecUsage  = prev ? Math.max(0, e - prevElec)  : e - (initialElec  || 0);
    this.setData({
      breakdown: {
        ...result,
        water_usage: Math.max(0, waterUsage).toFixed(2),
        elec_usage: Math.max(0, elecUsage).toFixed(2),
        garbage_fee: room.garbage_fee,
        internet_fee: room.internet_fee,
      },
    });
  },

  onPrevMonth() {
    const ym = shiftYearMonth(this.data.yearMonth, -1);
    wx.redirectTo({ url: `/pages/bill/edit/index?roomId=${this.data.roomId}&yearMonth=${ym}` });
  },

  onNextMonth() {
    const ym = shiftYearMonth(this.data.yearMonth, 1);
    wx.redirectTo({ url: `/pages/bill/edit/index?roomId=${this.data.roomId}&yearMonth=${ym}` });
  },

  async onSave() {
    const { roomId, yearMonth, waterReading, elecReading } = this.data;
    if (waterReading === '' || elecReading === '') {
      wx.showToast({ title: '请填写水/电度数', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '保存中' });
    try {
      await callRentApi('upsertBill', {
        roomId,
        yearMonth,
        water_reading: Number(waterReading),
        elec_reading: Number(elecReading),
      });
      wx.removeStorageSync('billsCache:' + yearMonth);
      wx.hideLoading();
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },
});
```

- [ ] **Step 5: 验证**

- 首页 → 生成账单 → 显示当月空表单
- 输入水表/电表 → 实时算费显示
- 保存 → 返回首页 → 卡片显示当月应缴金额

---

## Phase 9：历史账单页（含 ec-canvas + CSV 导出）

### Task 23：`pages/bill/history/index` — 历史页组装

**Files:**
- Create: `miniprogram/pages/bill/history/index.{js,wxml,wxss,json}`

- [ ] **Step 1: `index.json`**

```json
{
  "navigationBarTitleText": "历史账单",
  "usingComponents": {
    "van-button": "@vant/weapp/button/index",
    "ec-canvas": "../../../miniprogram_npm/ec-canvas/ec-canvas"
  }
}
```

注：`ec-canvas` 直接放在页面 json 中（不走自定义组件封装），更稳。

- [ ] **Step 2: `index.wxml`**

```xml
<view class="container">
  <view class="room-label">{{ roomLabel }}</view>

  <view class="table">
    <view class="tr th">
      <text class="td">月份</text>
      <text class="td">租金</text>
      <text class="td">水</text>
      <text class="td">电</text>
      <text class="td">其他</text>
      <text class="td right">合计</text>
    </view>
    <view wx:for="{{ history }}" wx:key="year_month"
      class="tr {{ item.highlight ? 'highlight' : '' }}"
      hover-class="tr-hover"
      data-yearmonth="{{ item.year_month }}"
      bindtap="onTapRow"
    >
      <text class="td">{{ item.year_month }}</text>
      <text class="td">{{ item.rent }}</text>
      <text class="td">{{ item.water_fee }}</text>
      <text class="td">{{ item.elec_fee }}</text>
      <text class="td">{{ item.other }}</text>
      <text class="td right">{{ item.total }}</text>
    </view>
  </view>

  <view class="section-title">水/电用量趋势</view>
  <view class="chart">
    <ec-canvas id="history-chart" canvas-id="history-chart" ec="{{ ec }}"></ec-canvas>
  </view>

  <view class="footer">
    <van-button type="primary" block bind:click="onExport">导出 CSV</van-button>
  </view>
</view>
```

- [ ] **Step 3: `index.wxss`**

```css
.container { padding: 24rpx; }
.room-label { font-size: 30rpx; font-weight: 600; margin-bottom: 16rpx; }
.table { border: 1rpx solid #eee; border-radius: 8rpx; overflow: hidden; background: #fff; margin-bottom: 30rpx; }
.tr { display: flex; padding: 16rpx 12rpx; border-bottom: 1rpx solid #f0f0f0; font-size: 24rpx; }
.tr.th { background: #f6f6f6; font-weight: 600; }
.tr-hover { background: #f0f0f0; }
.td { flex: 1; text-align: center; }
.td:first-child { flex: 1.2; text-align: left; }
.td.right { flex: 1.2; text-align: right; font-weight: 600; color: #e54545; }
.section-title { font-size: 26rpx; color: #888; padding: 12rpx 0; }
.chart { width: 100%; height: 480rpx; }
.footer { padding: 30rpx 0; }
```

- [ ] **Step 4: `index.js`**

完整内容:
```js
import * as echarts from '../../../miniprogram_npm/ec-canvas/echarts';
import { callRentApi } from '../../../utils/api.js';

Page({
  data: {
    roomId: '',
    roomLabel: '',
    history: [],
    ec: { lazyLoad: true },
  },

  async onLoad(options) {
    const { roomId } = options;
    this.chart = null;
    this.setData({ roomId });
    await this.refresh();
  },

  async refresh() {
    const { roomId } = this.data;
    const roomsRes = await callRentApi('getRooms');
    const room = roomsRes.rooms.find(r => r._id === roomId);
    this.setData({
      roomLabel: room.code + (room.name ? ' · ' + room.name : ''),
    });

    const { bills } = await callRentApi('getHistory', { roomId, limit: 36, offset: 0 });
    const history = bills.map(b => ({
      year_month: b.year_month,
      rent: room.rent,
      water_fee: b.water_fee,
      elec_fee: b.elec_fee,
      other: (b.base_fee || 0) - room.rent,
      total: b.total,
    }));
    this.setData({ history });
    this.updateChart(bills);
  },

  updateChart(bills) {
    if (!this.chart) {
      this.ecComponent = this.selectComponent('#history-chart');
      this.ecComponent.init((canvas, width, height, dpr) => {
        const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
        this.chart = chart;
        this._renderChart(bills);
        return chart;
      });
    } else {
      this._renderChart(bills);
    }
  },

  _renderChart(bills) {
    const sorted = [...bills].sort((a, b) => a.year_month < b.year_month ? -1 : 1);
    const months = sorted.map(b => b.year_month);
    const water = sorted.map(b => b.water_reading ?? 0);
    const elec  = sorted.map(b => b.elec_reading ?? 0);
    this.chart.setOption({
      grid: { left: 40, right: 20, top: 30, bottom: 30 },
      legend: { top: 0 },
      xAxis: { type: 'category', data: months },
      yAxis: { type: 'value' },
      series: [
        { name: '水(吨)', type: 'line', data: water, smooth: true, itemStyle: { color: '#3a8ee6' } },
        { name: '电(度)', type: 'line', data: elec,  smooth: true, itemStyle: { color: '#f59e0b' } },
      ],
    });
  },

  onTapRow(e) {
    const { yearmonth } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/bill/edit/index?roomId=${this.data.roomId}&yearMonth=${yearmonth}` });
  },

  async onExport() {
    wx.showLoading({ title: '生成中...' });
    try {
      const { fileID } = await callRentApi('exportCsv', { roomId: this.data.roomId });
      const dl = await wx.cloud.downloadFile({ fileID });
      wx.hideLoading();
      await wx.openDocument({
        filePath: dl.tempFilePath,
        fileType: 'csv',
        showMenu: true,
      });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '导出失败', icon: 'none' });
    }
  },
});
```

**注意**：上面 `history` 数组里的 `other` 字段 = `b.base_fee - room.rent`，即"垃圾费 + 网络费"。

如果 page 想完整利用 ec-canvas 的 lazyload，需要在 page 文件顶部提前 import echarts，否则会因为 ec-canvas 的 lazyload 配置晚于 import 时机失败——上面写法已满足。

- [ ] **Step 5: 验证**

- 进历史页 → 顶部表格显示倒序月度账单
- 点某行 → 进入账单编辑页（可改）
- 下方折线图显示水/电用量曲线
- 点导出 → 打开 CSV 文件

---

## Phase 10：邀请码管理（系统设置）

### Task 24：`pages/index/index` 顶栏"⚙️"链接到邀请码页

**Files:**
- Create: `miniprogram/pages/settings/index.{js,wxml,wxss,json}`（新建轻量页）
- Modify: `miniprogram/pages/index/index.js`（已实现 onSettings，新增 URL）

- [ ] **Step 1: 创建 `pages/settings/index.json`**

```json
{ "navigationBarTitleText": "系统设置" }
```

- [ ] **Step 2: 创建 `pages/settings/index.wxml`**

```xml
<view class="container">
  <view class="row">
    <text class="label">家庭邀请码</text>
    <text class="code" bindtap="onCopy">{{ code }}</text>
  </view>
  <van-button type="warning" block bind:click="onRegenerate">重新生成</van-button>
</view>
```

- [ ] **Step 3: 创建 `pages/settings/index.wxss`**

```css
.container { padding: 40rpx; }
.row {
  background: #fff;
  border-radius: 12rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.label { color: #888; font-size: 26rpx; }
.code { font-size: 56rpx; font-weight: 600; letter-spacing: 8rpx; color: #06c; }
```

- [ ] **Step 4: 创建 `pages/settings/index.js`**

完整内容:
```js
import { callRentApi } from '../../utils/api.js';

Page({
  data: { code: '' },
  async onShow() {
    const { code } = await callRentApi('getInviteCode');
    this.setData({ code });
  },
  onCopy() {
    wx.setClipboardData({ data: this.data.code });
  },
  async onRegenerate() {
    const { code } = await callRentApi('regenerateInviteCode');
    this.setData({ code });
    wx.showToast({ title: '已重新生成', icon: 'success' });
  },
});
```

- [ ] **Step 5: 在 `app.json` 注册 `pages/settings/index`**

修改 `miniprogram/app.json`，在 pages 数组首插入（page 顺序决定首页；这里不是首页，是二级页，append 即可）:
```json
"pages": [
  "pages/index/index",
  "pages/rooms/index",
  "pages/bill/edit/index",
  "pages/bill/history/index",
  "pages/unauthorized/index",
  "pages/settings/index"
]
```

- [ ] **Step 6: 修改首页 `onSettings` 跳到 settings 页**

`miniprogram/pages/index/index.js` 的 `onSettings(e)` 方法：
```js
  onSettings(e) {
    const roomId = e.detail?.roomId;
    if (roomId) {
      wx.navigateTo({ url: '/pages/rooms/index?focus=' + roomId });
    } else {
      // 头条右上角 ⚙️ 进入系统设置
      wx.navigateTo({ url: '/pages/settings/index' });
    }
  },
```

**注意**：当前首页 `onSettings` 的 fallback 跳 `/pages/rooms/index`。调整为：room card 的设置按钮 → rooms/index；顶部 ⚙️ 按钮 → settings/index。需要拆分 `onSettings`：从 card 来的 `e.detail.roomId` 存在，从 header 来的不存在。

修改首页 `header.wxml` 和 `header` 事件：
- header 的"⚙️"按钮 bind:click 用一个新的 `onHeaderSettings` 方法
- card 触发时依旧 `onSettings`（带 roomId）

```xml
<!-- index.wxml 顶部 -->
<view class="header">
  <view class="title">本月 ({{ currentYM }}): ¥{{ sumTotal }}</view>
  <van-button size="mini" bind:click="onHeaderSettings">⚙️</van-button>
</view>
```

```js
// index.js
onHeaderSettings() {
  wx.navigateTo({ url: '/pages/settings/index' });
},
```

---

## Phase 11：集联与 smoke 测试

### Task 25：联调 — 端到端流程

**Files:** 无修改，纯手动验证

- [ ] **Step 1: 第一次安装流程**

1. 打开小程序（首次）
2. 在云函数 console 手动 ensureSeed 被触发，或在小程序 app.js 加 `await callRentApi('seedRooms')` 兜底
3. 期望：首页显示 7 张卡，每张卡"未生成"

- [ ] **Step 2: 录入 baseline**

1. 进入 租金设置
2. 给 101 房间填：月租 500、水单价 3、电单价 0.6、垃圾费 10、网络费 50、起始水表 12345、起始电表 6789、备注"张老师"
3. 点保存 → 期望 toast"已保存"

- [ ] **Step 3: 录入第一张账单**

1. 回首页 → 101 卡"生成账单"
2. 默认 2026-07，输入水表 12355、电表 6800
3. 实时算费显示：水用量 = 12355-12345 = 10 → 30 元，电用量 = 6800-6789 = 11 → 6.6 元，合计 = 500+10+50+30+6.6 = 596.6
4. 保存 → 返回首页 → 101 卡片显示"¥596.60"

- [ ] **Step 4: 历史 + 趋势**

1. 进入 101 历史页
2. 表格只有 1 行 2026-07
3. 折线图显示 1 个点
4. 点该行 → 进入编辑页（应回填）
5. 改水表为 12360 → 实时算费水用量 = 15 → 45 元（替代原 30 元）
6. 保存 → 返回历史 → 该月金额应已更新

- [ ] **Step 5: 录入第二个月验证级联**

1. 改 → 2026-08 → 改输入水表 12370、电表 6810
2. 用量 = (12370-12360) = 10 → 30 元，电 = (6810 - 6800) = 10 → 6 元
3. 保存 → 回首页 → 8 月应缴 = 500+10+50+30+6 = 596 → 但首页只显示当月
4. 进 101 历史页 → 应有 2 行（07、08）

- [ ] **Step 6: 修改初始读数级联测试**

1. 进设置 → 改 101 起始水表为 12000
2. 保存 → 进历史 07 月 → 应仍是 596.6（实际：初始读数改了不影响已存月，因为有独立 prev bill 缓存）
3. **预期**：07 月金额不变；因为 8 月用的是 7 月的 water_reading（12360）作为 prev，**与 initial 无关**
4. **这是预期行为**：initial_water_reading 仅在第一张账单之前无 prev 时生效；8 月有 7 月作为 prev，initial 被绕过

- [ ] **Step 7: CSV 导出**

1. 历史页 → 点导出 → 弹出文件选择 / 打开
2. CSV 内容含 2 行 07、08

- [ ] **Step 8: 邀请码**

1. 右上 ⚙️ → 系统设置 → 显示 6 位邀请码
2. 复制邀请码，打开第二个微信号扫该码登录小程序 → 期望进入"未授权"页
3. 输入邀请码 → 加入成功 → 跳首页

---

## Phase 12：清理 & 交付

### Task 26：移除 QuickStart 残留 & 文档

- [ ] **Step 1: 确认无 QuickStart 残留**

```bash
ls miniprogram/pages/index/ miniprogram/pages/example/ 2>&1
ls miniprogram/components/cloudTipModal/ 2>&1
ls cloudfunctions/quickstartFunctions/ 2>&1
```

期望: 全部 `No such file or directory`。

- [ ] **Step 2: 删除默认 images（如未使用）**

```bash
ls miniprogram/images/
```

可选：保留 icons 子集，删除 create_*.png、database_*.png 等不用的。

- [ ] **Step 3: 更新 README（已含主要命令，简化即可）**

```markdown
# 收租小程序
家庭自用微信小程序，跟踪 7 个出租房（101、201、301、302、401、402、旧屋）按月应收账单。

## 运行

1. 微信开发者工具打开本目录
2. 修改 `miniprogram/app.js` 的 `globalData.env` 为云开发环境 ID
3. 右键 `cloudfunctions/rentApi` → 上传并部署-云端安装依赖
4. 工具 → 构建 npm
5. 编译

## 测试

\`\`\`bash
npm test
\`\`\`

运行 `computeBill` 单元测试。
```

---

## 完成标准

- [ ] 26 个任务全部 ✅
- [ ] `npm test` 5 个用例通过
- [ ] Phase 11 所有 8 个 smoke 步骤表现符合预期
- [ ] 7 房间硬编码、5+2 字段、4 屏、可编辑、邀请码、Vant Weapp、ec-canvas — 全部按 spec 实现
