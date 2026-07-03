# 收租小程序 · 家庭自用 · 设计文档

| | |
|---|---|
| 日期 | 2026-07-02 |
| 状态 | 草稿，待用户审阅 |
| 项目 | `d:\snc_wai\collect_rent` |

## 1. 目标与范围

### 1.1 目标
家庭内部使用的微信小程序，跟踪 7 间出租房（**101、201、301、302、401、402、旧屋**）的每月应收账单。根据每个房间配置的固定费率和水/电表读数，算出当月合计。所有家庭成员登录后均可查看、录入、修改。

### 1.2 在范围内
- 7 个硬编码房间（不开放增删）
- 每房间配置：月租 / 水单价 / 电电价 / 垃圾费 / 网络费 / **起始水/电表读数** / 备注姓名
- 每房间每月账单：水表度数 + 电表度数 → 自动算出水/电费 + 合计
- **可编辑历史账单**（修改后后续账单自动用新读数重算，无需手动级联）
- 单房间历史表 + 水/电用量趋势图 + 单房间 CSV 导出
- 多管理员登录（WeChat openid 白名单 + 邀请码）

### 1.3 不在范围内（YAGNI）
押金、介绍费、物业费、维修费等其他费用；状态追踪（待收/已收）；推送通知；租客账号；跨房间报表；凭证图片上传；微信支付集成。

## 2. 技术栈

| 层 | 选择 |
|---|---|
| 前端 | 微信小程序（基础库 ≥ 3.0）|
| UI 组件库 | **Vant Weapp** v1.11+ |
| 后端 | 微信云开发（`wx.cloud`）|
| 数据库 | 云开发 NoSQL，三个集合 |
| 云函数 | 单聚合函数 `rentApi`，按 `event.type` 分发 |
| 图表 | **ec-canvas**（Apache ECharts 小程序版）|
| 存储 | 临时 CSV 导出放云存储，24h 后清理 |

## 3. 数据模型

### 3.1 `rooms` 集合 — 每房间一条
| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | string | auto |
| `_openid` | string | 创建者 openid |
| `code` | string | 房号，**唯一索引**。值固定：`"101"`, `"201"`, `"301"`, `"302"`, `"401"`, `"402"`, `"旧屋"` |
| `name` | string | 备注姓名，可空 |
| `rent` | number | 月租 (元) |
| `water_unit_price` | number | 水单价 (元/吨) |
| `elec_unit_price` | number | 电单价 (元/度) |
| `garbage_fee` | number | 垃圾费 (元) |
| `internet_fee` | number | 网络费 (元) |
| `initial_water_reading` | number | **表基线水表读数**（吨，默认 0）。在第一张账单之前的"上次读数" |
| `initial_elec_reading` | number | **表基线电表读数**（度，默认 0）|
| `status` | enum | `active` / `vacant` |
| `created_at`, `updated_at` | Date | |

**种子数据**：首次启动时，若 `rooms` 集合为空，则插入 7 条默认记录（所有数值字段默认 0，name 默认空）。后续不再变动。**房屋无增删 UI**（虽然 §3.1 有 `status` 字段，但 V1 不提供切换 UI，所有房间默认 `active`，是否切换空置后续再说——V1 不纳入）。

### 3.2 `bills` 集合 — 每房间每月一条
| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | string | auto |
| `_openid` | string | 创建者 openid |
| `room_id` | string | 引用 `rooms._id` |
| `year_month` | string | `"YYYY-MM"`，如 `"2026-07"` |
| `water_reading` | number | 本月水表读数（吨）|
| `elec_reading` | number | 本月电表读数（度）|
| `water_fee` | number | 服务端算的水费 |
| `elec_fee` | number | 服务端算的电费 |
| `base_fee` | number | 房间配置快照（rent+garbage+internet） |
| `total` | number | 合计 |
| `created_at`, `updated_at` | Date | |

**复合唯一索引**：`(room_id, year_month)`。

**注**：`prev_water_reading` / `prev_elec_reading` **不存**。它们由查询"上一个已存账单（`year_month` 严格小于当前）"实时计算（首张账单则取 `room.initial_water_reading` / `initial_elec_reading`）。这样保证：编辑任意一张历史账单时，后续账单自动用新读数重算，无需手动级联。

### 3.3 `admins` 集合 — 家庭管理员白名单
| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | string | 直接以 `openid` 作为主键 |
| `name` | string | 显示名 |
| `created_at` | Date | |

首次启动时若为空，第一个登录用户的 `openid` 自动加入。

## 4. 计费规则

`utils/billing.js`：

```js
function computeBill(room, prevBill, current) {
  const prevWater = prevBill ? prevBill.water_reading : room.initial_water_reading;
  const prevElec  = prevBill ? prevBill.elec_reading  : room.initial_elec_reading;
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

async function getPrevBill(db, roomId, yearMonth) {
  // 找该房间的上一张已存账单（year_month 严格小于 yearMonth，按时间倒序）
  const { data } = await db.collection('bills')
    .where({ room_id: roomId, year_month: db.command.lessThan(yearMonth) })
    .orderBy('year_month', 'desc')
    .limit(1)
    .get();
  return data[0] || null;
}
```

**首次语义**：
- 应用第一次装好时：用户在 租金设置 页填上 `initial_water_reading` / `initial_elec_reading`（如不填默认 0）
- 用户首次保存某房间某月账单时：`prev = initial_*`；`usage = current - initial_*`；fee 按规则算出
- 用户将历史中某张账单的 reading 改掉后：因为 `getPrevBill` 总是查"小于当前 month 的最大 month"，被改账单之后的账单在下次加载/查询时都会重新读到新的 prev，**无需手动级联**。

**保存规则**：写 `bills` 时只快照 `base_fee = room.rent + room.garbage_fee + room.internet_fee`（即"非计量固定费率合计"，不含水/电单价）。其余固定费率不进 bills —— 计算水/电费时永远用 `room.water_unit_price` / `room.elec_unit_price`，历史一致。

**编辑触发重算**：upsertBill 服务端在写入后，可选地向调用方返回 `{ recalculated: [{year_month, total}, ...] }` 让前端知道之后多少张账单被影响（仅作提示用，不要求客户端写回）。

## 5. UI 设计 · 4 屏

### 5.1 首页 — 房间卡片列表
- 路径：`pages/index/index`
- 顶部：标题"收租"，右上角 ⚙️ 入口（系统设置：邀请码、退出登录）
- 主体：7 张 `van-card` 风格卡片（自定义 + Vant `van-button`）
- 每卡片显示：房号 + 备注姓名，右上小字"当月（YYYY·MM）应缴 ¥X"，下三个按钮：
  - **租金设置** → `/pages/rooms/index`
  - **生成账单** → `/pages/bill/edit?roomId=...&yearMonth=YYYY-MM`（默认当月）
  - **历史账单** → `/pages/bill/history?roomId=...`
- `status === 'vacant'` 的卡片："生成账单"按钮 `disabled`

### 5.2 租金设置 — 全 7 房间可编辑
- 路径：`pages/rooms/index`
- 顶部 info banner："此页设置影响所有未来账单的费率；历史账不会回改（但改历史读数会自动重算后续账单）"
- 主体：7 个 `van-collapse-item`，title 形如 `101 · 张老师`
- 每个 item 分两节展开：

**第一节 — 费率**：5 个 `van-field`（label + input type="digit"），网格 2 列：
  - 月租 (元) · 水单价 (元/吨) · 电电价 (元/度) · 垃圾费 (元) · 网络费 (元)

**第二节 — 表基线**：2 个 `van-field`（label + input type="digit"），用于设置**初始读数**（在没有第一张账单时作为 baseline）：
  - 起始水表读数（吨）
  - 起始电表读数（度）
  - 小字说明："搬家/换表时改这里；不填默认为 0"

**第三节 — 备注**：备注姓名 1 个文本字段

- 底部"保存全部" `van-button type="primary"`，成功后 `van-toast`

### 5.3 生成账单 — 单房间单月
- 路径：`pages/bill/edit?roomId=...&yearMonth=...`
- 顶部：房间信息条（"101 · 张老师"）；下方 ← → 月份切换
- 信息条：本月度数录入说明 + 灰字显示"上月度数"；若首次录入提示"本次度数将作为基线，水电费为 0"
- 表单：2 个 `van-field`，type="digit"：水表（吨）/ 电表（度）
- **实时算费**：监听输入 → 调 `computeBill` → `setData` 重渲染
- 应缴明细区（实时）：月租 / 垃圾费 / 网络费 / 水费 / 电费 / 合计
- 底部"保存"按钮 → `rentApi.upsertBill`；已存在则覆盖

### 5.4 历史账单 — 单房间（可编辑）
- 路径：`pages/bill/history?roomId=...`
- 顶部：月度明细表（倒序；每行 7 列：`月份 | 租金 | 水 | 电 | 其他 | 合计 | 操作`）
  - 每行**可点击** → 跳 `/pages/bill/edit?roomId=...&yearMonth=YYYY-MM` 直接编辑
  - 空月份（未录入）显示 + 号，点击进入生成账单页
- 加载更多：分页（一次取 12 条）
- 中部：ec-canvas 折线图（2 条线：水吨数、电度数；横轴月份，纵轴用量）
- 底部："导出 CSV"按钮 → `rentApi.exportCsv(roomId)` → 返回 `fileID` → `wx.downloadFile` + `wx.openDocument`

## 6. 认证与登录

### 6.1 身份
- 用 WeChat `openid` 作为唯一身份，无需密码
- 每次启动 → `wx.cloud.callFunction({ name: 'rentApi', data: { type: 'getOpenId' } })`

### 6.2 白名单校验
- 拿到 `openid` 后查 `admins` 集合
- 命中 → 进首页
- 未命中 → "未授权"页面（"请联系家庭管理员获取邀请码"）+ 输入邀请码入口

### 6.3 首个管理员
- 启动时若 `admins` 集合为空（用 `count() < 1` 原子判断），第一个登录者自动加入 `admins`

### 6.4 邀请码
- 管理员在系统设置页看到一个 6 位随机字符串，作为家庭邀请码
- 家庭成员首次打开时输入码 → `rentApi.joinFamily(code)` → 加入 `admins`（码匹配即通过；不限制有效期）
- 码泄露风险：陌生人拿到码可加入 → 接受这一风险（家庭场景）
- 邀请码生成在云函数里，存储在一个 `_config` 文档中

## 7. 云函数 — `rentApi`

单一聚合函数，按 `event.type` 分发：

| type | 说明 |
|---|---|
| `getOpenId` | 返回当前用户 openid（同时处理首个管理员自动加入） |
| `getInviteCode` | 返回当前家庭邀请码（首次生成后存 `_config`） |
| `regenerateInviteCode` | 重新生成 |
| `joinFamily` | 用邀请码把当前用户加入 admins |
| `getRooms` | 返回 7 房间 |
| `seedRooms` | 首次启动时种入 7 房间（idempotent：count==0 时执行） |
| `upsertRoom` | 单个房间配置保存 |
| `getBill` | 按 `(room_id, year_month)` 取单条账单 |
| `getPrevBill` | 找该 room 上一个已存的账单（小于当前 year_month 的最大者）|
| `upsertBill` | 新增/覆盖一条账单。**服务端必须重算一次费用**（不能信前端传的 fee 字段）后再写库 |
| `getHistory` | 按 room_id 倒序分页 |
| `exportCsv` | 拼 CSV 字符串 → 写云存储 → 返回 fileID |

所有 type 进入时先做 `admins` 白名单校验，非管理员直接 `{ errCode: 'NOT_AUTHORIZED' }`。`getOpenId` 单独例外（用于首次发现）。

## 8. 工具与组件

- `utils/billing.js` — `computeBill` 纯函数（前后端共用）
- `utils/auth.js` — `isAdmin()` 异步包装 `admins` 查询
- `components/billRow/` — 单行账单展示组件（首页卡片、历史表共用）
- `components/collapsibleRoomForm/` — 租金设置里的折叠表单
- `components/usageChart/` — ec-canvas 包装，水/电双线趋势图

## 9. 实现要点

1. **首张账单的水/电费 = max(0, current - initial)**：由 `computeBill` 自动处理（`prev = initial_*_reading`）；UI 在历史表对未录入月份显示 + 号，点击进入生成账单页。
2. **编辑历史账单自动级联**：upsertBill 写库后，可选向调用方返回 `recalculated: [{year_month, total}, ...]`，提示"已影响后续 N 张账单"。所有重算在下次读账单时由 `computeBill` 自然完成，无需客户端写回。
3. **空置 disabled**：`van-button disabled` + `bindtap` 阻止跳转。历史仍然可看可改（删除现有账单 V1 不提供）。
4. **CSV 导出存云存储**：云函数拼接字符串 → 上传 → 24h 后清理。
5. **缓存**：首页拉到的 7 条账单缓存在 `wx.setStorageSync('billsCache:YYYY-MM', data)`，下次进入秒开；编辑后失效该 cache，下次进入重新拉。
6. **房间无增删 UI**：不要在首页和租金设置里放"添加/删除房间"按钮；7 房间由 seed 完成。
7. **白名单种子并发**：用云函数 `count() < 1` 原子判断后插入 admins。
8. **ec-canvas 集成**：需在 history 页用 `<ec-canvas>` + 引用 `ec-canvas/echarts` 组件，按官方文档初始化（chart 容器尺寸固定 height 240px）。

## 10. 后续（延后处理）

如果 V1 跑通后再讨论：
- 多房间 CSV 合并导出
- 全年合计 / 跨房间对比报表
- 数据备份 / 导出 JSON
- 多家庭（multi-tenant）：当前单家庭假设，将来可能需要 `family_id` 字段
