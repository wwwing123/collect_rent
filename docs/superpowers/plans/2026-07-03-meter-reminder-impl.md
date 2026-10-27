# 抄表提醒推送 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每月最后一天北京时间 18:00 与 21:00，向所有 admins 的微信发送「收租日期」订阅消息，提醒录入水电读数。

**Architecture:** 新增独立云函数 `sendMeterReminder`（两个 timer 触发器 + `subscribeMessage.send` openapi 权限），函数内判断「北京时间明天是 1 号」才发送；首页增加「订阅抄表提醒」按钮攒订阅额度。月末判断逻辑抽纯函数放 `utils/month-end.js`，云函数内联同份代码（云函数无法 require miniprogram 目录）。

**Tech Stack:** 微信云开发（wx-server-sdk ~2.4.0）、小程序订阅消息、Node.js 16（云函数运行时）。

## Global Constraints

- template_id 固定为：`J9g9WGKUHvl40BGLE-k6LZIUTojypWyV8qs2vC7Rudw`（模板「收租日期」，字段 `time2`、`thing7`）
- `thing7` 文案：`月底了，请准时录入水电读数`（15 字，≤20 字）
- 触发时刻：北京时间 18:00、21:00 = UTC 10:00、13:00（云函数环境是 UTC）
- errcode 43101（额度用尽/未订阅）静默跳过；其他错误 console.error
- 不新建集合、不做发送历史表、不做失败重试
- 部署注意事项需写入代码注释：上传云函数时勾选「同步云函数本地触发器配置」

---

### Task 1: 月末判断纯函数 + 单测

**Files:**
- Create: `miniprogram/utils/month-end.js`
- Create: `miniprogram/utils/month-end.test.js`

**Interfaces:**
- Produces: `isLastDayOfMonthBeijing(now: Date): boolean` —— 传入 UTC 时刻 Date，判断北京时间的「明天」是否为 1 号。`formatBeijingTime(now: Date): string` —— 格式化为 `2026年7月31日 18:00` 样式（供 time2 字段用）。

- [ ] **Step 1: 写失败测试**

`miniprogram/utils/month-end.test.js`（Node 内置 test runner，无需装依赖）：

```js
const { isLastDayOfMonthBeijing, formatBeijingTime } = require('./month-end.js');

// 月末 18:00 UTC（北京 7/31 18:00+ 次日判定为 8/1）——7 月 31 日应为 true
console.assert(isLastDayOfMonthBeijing(new Date('2026-07-31T10:00:00Z')) === true, '7月31日应为月末');
// 7 月 30 日应为 false
console.assert(isLastDayOfMonthBeijing(new Date('2026-07-30T10:00:00Z')) === false, '7月30日不是月末');
// 12 月 31 日 true
console.assert(isLastDayOfMonthBeijing(new Date('2026-12-31T10:00:00Z')) === true, '12月31日应为月末');
// 平年 2 月 28 日 true（次日 3/1）
console.assert(isLastDayOfMonthBeijing(new Date('2027-02-28T10:00:00Z')) === true, '平年2月28日应为月末');
// 闰年 2 月 28 日 false（2028 闰年，次日 2/29）
console.assert(isLastDayOfMonthBeijing(new Date('2028-02-28T10:00:00Z')) === false, '闰年2月28日不是月末');
// 闰年 2 月 29 日 true
console.assert(isLastDayOfMonthBeijing(new Date('2028-02-29T10:00:00Z')) === true, '闰年2月29日应为月末');
// UTC 边界：UTC 15:59（北京 23:59）7/30 仍是 7/30 → false
console.assert(isLastDayOfMonthBeijing(new Date('2026-07-30T15:59:00Z')) === false, '北京23:59仍按当日算');
// UTC 16:00（北京 7/31 00:00）→ 明天是 8/1 → true
console.assert(isLastDayOfMonthBeijing(new Date('2026-07-30T16:00:00Z')) === true, '北京0:00后按次日算');
// 1 月 31 日 true
console.assert(isLastDayOfMonthBeijing(new Date('2026-01-31T10:00:00Z')) === true, '1月31日应为月末');

// formatBeijingTime
console.assert(formatBeijingTime(new Date('2026-07-31T10:00:00Z')) === '2026年7月31日 18:00', 'time2 格式');
console.assert(formatBeijingTime(new Date('2026-07-31T13:00:00Z')) === '2026年7月31日 21:00', '21点格式');
console.assert(formatBeijingTime(new Date('2026-12-31T13:00:00Z')) === '2026年12月31日 21:00', '两位月份');

console.log('month-end tests passed');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node miniprogram/utils/month-end.test.js`
Expected: 报错 `Cannot find module './month-end.js'`

- [ ] **Step 3: 最小实现**

`miniprogram/utils/month-end.js`：

```js
/**
 * 北京时区（UTC+8）月末判断与时间格式化。
 * 云函数运行环境为 UTC，所有时刻先加 8 小时换算成北京时间再判断。
 */

function beijingDate(now) {
  return new Date(now.getTime() + 8 * 3600 * 1000);
}

/** 北京时间的「明天」是否为 1 号 → 今天是该月最后一天 */
function isLastDayOfMonthBeijing(now) {
  const bj = beijingDate(now);
  // 用 UTC 的 getUTC* 读取偏移后的字段，避免本地时区干扰
  const tomorrow = new Date(bj.getTime() + 24 * 3600 * 1000);
  return tomorrow.getUTCDate() === 1;
}

/** 格式化为订阅消息 time 字段样式：2026年7月31日 18:00 */
function formatBeijingTime(now) {
  const bj = beijingDate(now);
  const y = bj.getUTCFullYear();
  const m = bj.getUTCMonth() + 1;
  const d = bj.getUTCDate();
  const hh = String(bj.getUTCHours()).padStart(2, '0');
  const mm = String(bj.getUTCMinutes()).padStart(2, '0');
  return `${y}年${m}月${d}日 ${hh}:${mm}`;
}

module.exports = { isLastDayOfMonthBeijing, formatBeijingTime };
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node miniprogram/utils/month-end.test.js`
Expected: 输出 `month-end tests passed`，exit 0

- [ ] **Step 5: Commit**

```bash
git add miniprogram/utils/month-end.js miniprogram/utils/month-end.test.js
git commit -m "feat: 北京时区月末判断与时间格式化纯函数"
```

---

### Task 2: 云函数 sendMeterReminder

**Files:**
- Create: `cloudfunctions/sendMeterReminder/index.js`
- Create: `cloudfunctions/sendMeterReminder/package.json`
- Create: `cloudfunctions/sendMeterReminder/config.json`
- Create: `cloudfunctions/sendMeterReminder/month-end.js`（Task 1 同款代码的内联副本，云函数无法 require miniprogram 目录；两处同步维护）
- Test: `cloudfunctions/sendMeterReminder/month-end.test.js`（同 Task 1 测试的副本）

**Interfaces:**
- Consumes: `admins` 集合（`_id` 即 openid，结构见 rentApi/index.js:18-31）
- Produces: 定时触发的云函数本身，无后续任务依赖其导出

- [ ] **Step 1: 创建 package.json 与 config.json**

`cloudfunctions/sendMeterReminder/package.json`：

```json
{
  "name": "sendMeterReminder",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~2.4.0"
  }
}
```

`cloudfunctions/sendMeterReminder/config.json`（**部署时须在微信开发者工具里右键该函数 → 上传并部署 → 勾选「同步云函数本地触发器配置」**，否则触发器不生效）：

```json
{
  "triggers": [
    {
      "name": "meterReminderEvening",
      "type": "timer",
      "config": "0 0 10 * * * *"
    },
    {
      "name": "meterReminderNight",
      "type": "timer",
      "config": "0 0 13 * * * *"
    }
  ],
  "permissions": {
    "openapi": [
      "subscribeMessage.send"
    ]
  }
}
```

- [ ] **Step 2: 复制 month-end 纯函数并跑测试**

把 `miniprogram/utils/month-end.js` 与 `month-end.test.js` 原样复制到 `cloudfunctions/sendMeterReminder/` 下（去掉 `module.exports` 之外无差异）。

Run: `node cloudfunctions/sendMeterReminder/month-end.test.js`
Expected: `month-end tests passed`

- [ ] **Step 3: 写云函数入口**

`cloudfunctions/sendMeterReminder/index.js`：

```js
const cloud = require('wx-server-sdk');
const { isLastDayOfMonthBeijing, formatBeijingTime } = require('./month-end');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// ==== 配置区：改文案/模板改这里，重新部署即可 ====
const TEMPLATE_ID = 'J9g9WGKUHvl40BGLE-k6LZIUTojypWyV8qs2vC7Rudw';
const THING7_TEXT = '月底了，请准时录入水电读数';
// ===============================================

// 部署提示：在微信开发者工具中右键本函数目录 → 上传并部署（云端安装依赖）
// 并勾选「同步云函数本地触发器配置」，否则 config.json 里的定时触发器不会创建

async function listAdminOpenids() {
  const MAX = 100; // 家庭场景管理员远少于 100
  const { data } = await db.collection('admins').limit(MAX).get();
  return data.map((doc) => doc._id);
}

async function sendTo(openid, timeText) {
  try {
    const res = await cloud.openapi.subscribeMessage.send({
      touser: openid,
      templateId: TEMPLATE_ID,
      // 触发器无 page 上下文，跳首页由用户点消息后自行操作
      page: 'pages/index/index',
      miniprogramState: 'formal',
      data: {
        time2: { value: timeText },
        thing7: { value: THING7_TEXT },
      },
    });
    return { openid, ok: true, res };
  } catch (e) {
    // 43101: 用户未订阅或额度已用尽 —— 预期内，静默
    if (e.errCode === 43101 || (e.errcode === 43101)) {
      return { openid, ok: false, skipped: true };
    }
    console.error(`send failed for ${openid}:`, e.errCode || e.errcode, e.message);
    return { openid, ok: false, skipped: false };
  }
}

exports.main = async () => {
  const now = new Date();
  if (!isLastDayOfMonthBeijing(now)) {
    return { sent: 0, reason: 'not-month-end' };
  }
  const timeText = formatBeijingTime(now);
  const openids = await listAdminOpenids();
  const results = [];
  for (const openid of openids) {
    results.push(await sendTo(openid, timeText));
  }
  const sent = results.filter((r) => r.ok).length;
  const skipped = results.filter((r) => r.skipped).length;
  console.log(`meter reminder: sent=${sent} skipped(no-quota)=${skipped} total=${results.length}`);
  return { sent, skipped, total: results.length };
};
```

- [ ] **Step 4: 语法自检**

Run: `node --check cloudfunctions/sendMeterReminder/index.js`
Expected: 无输出，exit 0

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions/sendMeterReminder
git commit -m "feat: 月末抄表提醒云函数（18:00/21:00 双触发）"
```

---

### Task 3: 首页「订阅抄表提醒」入口

**Files:**
- Modify: `miniprogram/pages/index/index.wxml`（在 greeting-actions 内 ⚙ 按钮后加一个 🔔 按钮）
- Modify: `miniprogram/pages/index/index.js`（新增 onSubscribeReminder）
- Modify: `miniprogram/pages/index/index.wxss`（复用 settings-link 样式，无需新增——先确认）

**Interfaces:**
- Consumes: 模板 ID（与云函数同一常量值，前端硬编码一份；个人项目可接受双份维护）
- Produces: 无后续依赖

- [ ] **Step 1: wxml 加按钮**

在 `miniprogram/pages/index/index.wxml` 的 `greeting-actions` view 内、⚙ 按钮之后插入：

```xml
      <view class="settings-link" bindtap="onSubscribeReminder" hover-class="press">
        <text class="settings-link-glyph">🔔</text>
      </view>
```

- [ ] **Step 2: index.js 加订阅逻辑**

在 `miniprogram/pages/index/index.js` 的 `onHeaderSettings` 方法后新增：

```js
  // 订阅抄表提醒：每点一次并「允许」攒 1 条额度，月末当天会发 2 条（18:00/21:00）
  // 多点几次可攒多条，避免 21:00 那条因额度不足收不到
  async onSubscribeReminder() {
    const TEMPLATE_ID = 'J9g9WGKUHvl40BGLE-k6LZIUTojypWyV8qs2vC7Rudw';
    try {
      const res = await wx.requestSubscribeMessage({ tmplIds: [TEMPLATE_ID] });
      if (res[TEMPLATE_ID] === 'accept') {
        wx.showToast({ title: '已订阅，多点几次攒额度', icon: 'none' });
      } else {
        wx.showToast({ title: '已拒绝，将收不到提醒', icon: 'none' });
      }
    } catch (e) {
      // errMsg 可能是 requestSubscribeMessage:fail 禁用/用户关闭订阅功能
      wx.showToast({ title: '订阅不可用，请检查设置', icon: 'none' });
    }
  },
```

- [ ] **Step 3: 手动验证（微信开发者工具）**

工具 → 编译 → 首页右上应出现 🔔；点击弹出订阅授权弹窗（真机上才会真实弹，模拟器可能直接 reject）。确认 wxml 无编译错误、页面正常渲染。

- [ ] **Step 4: Commit**

```bash
git add miniprogram/pages/index/index.wxml miniprogram/pages/index/index.js
git commit -m "feat: 首页订阅抄表提醒入口"
```

---

### Task 4: 部署与端到端验证（人工操作，写成 checklist）

**Files:** 无代码改动（可选：把验证记录追加到 spec 文档末尾）

- [ ] **Step 1: 安装云函数依赖**

Run: `cd cloudfunctions/sendMeterReminder && npm install`
Expected: 生成 node_modules，无 error

- [ ] **Step 2: 上传部署（含触发器）**

微信开发者工具 → 资源管理器右键 `cloudfunctions/sendMeterReminder` → **上传并部署：云端安装依赖**；随后再右键 → **同步云函数本地触发器配置**（或上传时确认勾选触发器）。部署后到 云开发控制台 → 云函数 → sendMeterReminder → 触发器，确认存在两条 timer（每天 10:00/13:00 UTC）。

- [ ] **Step 3: 临时触发验证**

云开发控制台 → 云函数 → sendMeterReminder → 手动「测试运行」一次。看返回：
- 非月末日 → `{ sent: 0, reason: 'not-month-end' }`（逻辑正确的证据）
- 想验证真实发送：临时把 index.js 的月末判断短路（`if (false && !isLastDay...)`），重新部署 → 测试运行 → 真机收消息 → 恢复代码再部署。

- [ ] **Step 4: 真机订阅并确认收消息**

真机预览 → 首页点 🔔（可点两次攒 2 条）→ 短路部署后测试运行 → 微信「服务通知」应收到「收租日期」消息，time2 为当前时间、thing7 为提醒文案，点击进入小程序首页。

- [ ] **Step 5: 恢复并收尾**

恢复月末判断（如做过短路）→ 重新部署 → git status 确认无遗漏文件 → 在 spec 文档末尾追加一行验证记录（日期 + 结果）。

```bash
git status
git log --oneline -4
```
