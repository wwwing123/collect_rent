# 抄表提醒推送 · 增量设计文档

| | |
|---|---|
| 日期 | 2026-07-03 |
| 状态 | 待用户审阅 |
| 项目 | `d:\snc_wai\collect_rent` |
| 前置 | [2026-07-02-collect-rent-design.md](./2026-07-02-collect-rent-design.md)（本需求原列于其 §1.3 YAGNI，现纳入） |

## 1. 目标

每月最后一天 **18:00 与 21:00**（北京时间）各向所有家庭管理员（`admins` 白名单）的微信推送一次订阅消息，提醒录入当月水电表读数。

### 范围内
- 小程序首页新增「订阅抄表提醒」入口（`wx.requestSubscribeMessage`）
- 新云函数 `sendMeterReminder` + 定时触发器（每天 UTC 10:00 与 13:00，即北京 18:00/21:00）
- 月末判断：北京时间明天为 1 号则发送，否则直接退出
- 固定提醒文案

### 范围外（YAGNI）
- 发送历史表、失败重试、用户级订阅状态管理 UI
- 服务号模板消息、动态未录房间清单、抄表负责人指定

## 2. 微信平台约束与决策

- 采用**一次性订阅消息**：用户每点一次「允许」攒 1 条额度，发一条扣一条。额度存微信侧，服务端不建表。
- **一天发两条 = 每人每月消耗 2 条额度**，用户每点一次「订阅」攒 1 条——建议入口文案提示"多点几次可攒多次提醒"。
- 个人主体申请不到「长期订阅」，接受一次性额度模型。
- 模板（已申请）：
  - **template_id**: `J9g9WGKUHvl40BGLE-k6LZIUTojypWyV8qs2vC7Rudw`
  - 标题「收租日期」；字段：`time2`（时间）、`thing7`（事物，≤20 字）

## 3. 架构

```
[用户侧] 首页「订阅抄表提醒」按钮
   → wx.requestSubscribeMessage({ tmplIds: [TEMPLATE_ID] })
   → 微信侧为该 openid 额度 +1

[服务端] 云函数 sendMeterReminder，cron 每天 UTC 10:00 与 13:00（北京 18:00/21:00）
   → 北京时间 = UTC+8，函数内判断"明天是否 1 号"
   → 非月末：return
   → 是月末：查 admins 全部 openid
   → 逐个 openapi.subscribeMessage.send(...)，try/catch 隔离
   → errcode 43101（用户额度用尽/未订阅）：静默跳过
```

### 3.1 新云函数 `cloudfunctions/sendMeterReminder`

独立于 `rentApi`：timer 事件的 `event` 结构与 `event.type` 分发不兼容；`subscribeMessage.send` 需要 `config.json` 单独声明 openapi 权限。

**`config.json`**：
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
    "openapi": ["subscribeMessage.send"]
  }
}
```

**`index.js` 要点**：
- 顶部常量：`TEMPLATE_ID`、`THING7_TEXT = '月底了，请准时录入水电读数'`（15 字，限 20 字内；改文案改代码重新部署，模板不动）
- 月末判断抽纯函数 `isLastDayOfMonthBeijing(now)`：`new Date(now + 8h)`，取明天日期，`date === 1` 则月末
- `time2` 值：发送时刻格式化，如 `2026年7月31日 18:00`
- 逐个 send，`errcode !== 0` 时 console 记日志；43101 特判静默（预期内）

### 3.2 前端改动（首页）

- 首页右上 ⚙️ 设置区或卡片列表下方加「订阅抄表提醒」`van-button`
- 点击 → `wx.requestSubscribeMessage` → `accept`/`reject` 分别 toast
- 用户可反复点，随点随攒额度；不做额度展示（微信不给查）

## 4. 错误处理

| 情形 | 处理 |
|---|---|
| 单个用户 43101（额度尽） | 静默跳过，其余人照发 |
| 其他 errcode | console.error 记日志（云开发控制台可查） |
| admins 查询失败 | 整次退出，等次日触发（月末错过后不补发，家庭场景可接受） |
| 用户点「拒绝」订阅 | 仅 toast 提示，无后续引导 |

## 5. 测试

- `isLastDayOfMonthBeijing` 单测：覆盖 12/31→1/1、2/28（平/闰年）、4/30、UTC 边界时刻（UTC 16:00 = 北京 0:00 前后）
- 端到端验证：临时把 cron 改成 `0 * * * * * *`（每分钟），次日真机收消息后改回
- 部署触发器：`cloudfunctions/sendMeterReminder` 上传时需勾选「云函数本地配置中的触发器」

## 6. 已知限制

- 一次性额度：成员需不定期回小程序点「订阅」按钮，否则当月收不到（微信产品规则，无解）
- 个人主体模板类目受限；若此模板日后被平台下架，需重新申请并改 `TEMPLATE_ID`
