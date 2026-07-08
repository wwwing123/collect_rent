# 收据样式微调

**日期**: 2026-07-08
**状态**: 待评审
**前置设计**: [2026-07-07-receipt-image-redesign-design.md](2026-07-07-receipt-image-redesign-design.md)
**可视化参考**: [docs/preview-receipt.html](../../preview-receipt.html)（BEFORE vs AFTER 并排对照）

## 背景

`2026-07-07` 重设计后，`receipt.js` 已经能输出与 `shouju.png` 参考图视觉基本一致的收据图片。本次用户提出 9 条样式微调，并在视觉对照预览过程中又发现 4 个 `receipt.js` 原本就有的渲染 bug。本次设计把这两类改动合并，统一落到代码里。

## 范围

**包含**
- 调整 `miniprogram/utils/receipt.js` 的 `drawReceipt` 与所有 `drawXxx` 辅助函数
- 修复 `getReceiptUserName` 漏掉 `room.code` 的 bug
- 更新 `miniprogram/utils/receipt.test.js` 以匹配新的 `userName` 输出格式
- 调整 `miniprogram/pages/receipt/preview/index.js` 中的画布尺寸常量

**不包含**
- 不修改账单/房间数据模型
- 不修改云函数 `rentApi`
- 不修改数据库 schema
- 不修改房间编辑页和账单编辑页
- 不引入新的字体加载逻辑（直接使用系统已装的 Microsoft YaHei / 微软雅黑）

## 设计决策

### 一、用户提出的 9 条样式调整

| # | 调整项 | 旧值 | 新值 |
|---|---|---|---|
| 1 | 大标题"收  据" | 偏左（W/2 - 80），bold 48px | 居中（W/2），bold **40px** |
| 2 | 用户名称/日期行 | 22px 不加粗；userName 漏掉 room.code | label 不加粗，value/日期 **加粗**；userName = `${address} ${room.code}` |
| 3 | 表头字体 | SimSun bold（粗体不明显） | **Microsoft YaHei bold**（全局换字体，见下） |
| 4 | 租金行 | 描述跨 cols 1-4，金额在 col 5 | **保持** 描述跨 cols 1-4 居中，金额在 col 5（右对齐） |
| 5 | 拆分行金额合并 | 垃圾费/网络费金额各占 1 列 | 垃圾费金额跨 **cols 1-2**，网络费金额跨 **cols 4-5**，小计入 col 6 |
| 6 | 实用列宽度 | 90px | **120px** |
| 7 | 合计行 | CN 跨 4 列不加粗，金额在 col 6 | CN 跨 **5 列加粗**，金额跨 **cols 5-6** |
| 8 | 项目列宽度 | 180px | 175px（-5px 让位给金额小计列） |
| 9 | 签名行间距 | TABLE_BOTTOM + 80 | TABLE_BOTTOM + **30** |

### 二、视觉对照过程中发现的 4 个渲染 bug（同步修复）

| # | Bug | 原因 | 修复 |
|---|---|---|---|
| A | 表格顶部没有横线 | `drawTableGrid` 只画了表头下方到合计行下方的横线，漏了 `y = HEADER_Y` | 在 `drawTableGrid` 顶部加一条 `moveTo(PADDING, HEADER_Y) → lineTo(W-PADDING, HEADER_Y)` |
| B | 合并单元格内部还有竖线 | 所有 8 条列竖线都从 `HEADER_Y` 画到 `TABLE_BOTTOM`，没有按行跳过合并区域 | 改为按行分小段绘制；每个合并区域内的列竖线该行跳过 |
| C | 拆分行（垃圾费+网络费）下方没有横线 | `for (let r = 1; r <= ROW_COUNT; r++)` 只画到 r=4，r=5（拆分行下边）漏了 | 改为 `r <= ROW_COUNT + 1` |
| D | 右侧"存根/客户"是整体旋转 90°（每个字横躺） | `ctx.rotate(-Math.PI/2)` 后整段文字都旋转 | 改为逐字单独画，每字正立，从上往下竖直堆叠 |

### 三、字体全局更换

`FONT` 常量从 `SimSun, "宋体", serif` 改为 `"Microsoft YaHei", "微软雅黑", sans-serif`，原因：

- SimSun 的 bold 渲染在 WeChat 小程序 Canvas 上加粗效果不明显（用户原话："加粗确实不明显"）
- Microsoft YaHei 在中文字重上有清晰的 regular/bold 区分
- 微信小程序 Canvas 已支持该字体（无需引入字体文件）

**影响面**：`drawHeader` / `drawTable` / `drawTableHeader` / `drawTableTotal` / `drawSignature` / `drawVerticalText` 六处都用 `FONT` 常量，一次替换全收据。

### 四、画布尺寸与版心

| 项 | 旧 | 新 |
|---|---|---|
| `W`（画布宽） | 900 | **930** |
| `H`（画布高） | 560 | **460**（缩矮 100px 去掉底部空白） |
| `PADDING`（左右） | 50 | **70**（让出空间给右侧竖排文字） |
| `HEADER_Y`（表格顶 y） | 175 | **145**（用户名称行紧凑贴近表格） |
| `TITLE_Y`（标题 y） | 80 | **60**（标题上移 20px） |
| `TABLE_W` | 800 | **790**（= W - 2×PADDING） |

### 五、列宽（`COL_WIDTHS`）

```
旧：[180, 90, 90, 90, 90, 130, 130]                = 800
新：[175, 85, 85, 120, 75, 160, 90]                = 790
                       ^      ^   ^   ^
                       实用  单价 金额 备注
```

`COL_X` 重新计算：

| idx | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|---|
| 旧 | 50 | 230 | 320 | 410 | 500 | 590 | 720 | 850 |
| 新 | 70 | 245 | 330 | 415 | 535 | 610 | 770 | 860 |

### 六、各行布局

#### 标题区
- 大标题"收  据"：bold 40px，居中（W/2 = 465）
- NO 编号：24px，右对齐（W - PADDING = 860），橙色 `#ff8c00`
- y = 60

#### 用户名称行
- y = 120，无下边横线
- "用户名称:"：22px **不加粗**（label），左对齐
- 用户名（`南东新村6巷92号 101`）：22px **加粗**（value），紧接 label
- 日期（`2026年6月30日`）：22px **加粗**，右对齐
- 数据来源：`getReceiptUserName` 修复为 `${PROPERTY_ADDRESS} ${room.code} ${room.name}`（漏掉的 room.code 已补上）

#### 表头（y = 145）
- 7 列：`项 目` / `上 月` / `本 月` / `实 用` / `单 价` / `金额小计(元)` / `备 注`
- bold 22px，全部加粗
- 字体：Microsoft YaHei（粗细明显）

#### 水费/电费行
- 6 个单元格：label（左对齐） / 上月（居中） / 本月（居中） / 实用（居中） / 单价（居中） / 金额（右对齐）
- 22px 不加粗

#### 租金行
- label：col 0，左对齐
- 描述：cols 1-4（span 4），**居中**
- 金额：col 5，右对齐
- 备注：col 6，空白

#### 拆分行
- 垃圾费 label：col 0，左对齐
- 垃圾费金额：cols 1-2（span 2），右对齐
- 网络费 label：col 3，左对齐
- 网络费金额：cols 4-5（span 2），右对齐
- 小计：col 6，右对齐（占用备注列）

#### 合计行
- CN 大写文字：cols 0-4（span 5），左对齐，**bold**
- ¥金额：cols 5-6（span 2），右对齐，bold 24px
- 备注：被金额合并掉

#### 签名行
- y = TABLE_BOTTOM + 30 = 403
- 开票人：左对齐 x=70，下划线 x=170→330
- 收款人：左对齐 x=600，下划线 x=700→860（靠最右）
- 22px，不加粗

#### 右侧竖排文字
- x = W - 25 = 905
- 起始 y = HEADER_Y + 20 = 165
- 行高 20px
- 10 个字符：存 / 根 / （ / 白 / ） / [空 30px] / 客 / 户 / （ / 红 / ）
- 每字正立，从上往下竖直堆叠
- 20px，不加粗

### 七、`getReceiptUserName` 修复

旧实现（`miniprogram/utils/receipt.js:5-10`）：

```js
export function getReceiptUserName(room) {
  if (!room) return PROPERTY_ADDRESS;
  if (room.code === '旧屋') return room.name || '';
  const name = room.name ? ` ${room.name}` : '';
  return `${PROPERTY_ADDRESS}${name}`;   // 漏了 room.code
}
```

新实现：

```js
export function getReceiptUserName(room) {
  if (!room) return PROPERTY_ADDRESS;
  if (room.code === '旧屋') return room.name || '';
  const code = room.code ? ` ${room.code}` : '';
  const name = room.name ? ` ${room.name}` : '';
  return `${PROPERTY_ADDRESS}${code}${name}`;
}
```

**测试更新**：
- `receipt.test.js:12-15`（普通房间拼接前缀）：预期值从 `'南东新村6巷92号 A栋403房'` 改为 `'南东新村6巷92号 101 A栋403房'`
- `receipt.test.js:22-25`（name 为空时只有前缀）：预期值从 `'南东新村6巷92号'` 改为 `'南东新村6巷92号 101'`（新实现无论 name 是否为空都拼接 code）

**显示层面的取捨**：用户口头要求"A栋403"字眼不要了。`docs/preview-receipt.html` 的预览中 `userName` 硬编码为 `'南东新村6巷92号 101'`（不含 "A栋403"），这是**期望的最终显示效果**。

`receipt.js` 的 `getReceiptUserName` 新实现严格按 `${PROPERTY_ADDRESS} ${room.code} ${room.name}` 拼接，**不主动过滤 room.name**。要达到预览效果，需要房间数据本身的 `room.name` 字段不包含 "A栋403" 字样（数据层调整，不在本次实施范围）。

实际操作：
- 若 `room.name = ''` 或 `null`：显示 `南东新村6巷92号 101`（与预览一致）✓
- 若 `room.name = 'A栋403房'`：显示 `南东新村6巷92号 101 A栋403房`（含 "A栋403"，需清理数据）
- 若 `room.name = 'B栋202'`：显示 `南东新村6巷92号 101 B栋202`（如果想显示 B 栋信息）

## 实现方式

`receipt.js` 的主要重构点：

1. **新增 `SKIP_VERTICALS` 映射表**：在文件顶部定义哪些 `(rowIdx, colX_idx)` 在该行被合并，`drawTableGrid` 按行分小段画竖线，命中合并区域就跳过
2. **`drawVerticalText` 改为逐字渲染**：去掉 `ctx.rotate`，用 `forEach` 把每个字画在独立的 y 坐标上
3. **`drawTableTotal` 增加 `TOTAL_SPAN` 分支**：处理 CN 跨 5 列、金额跨 2 列（cols 5-6）的新布局
4. **`drawHeader` 用户名称行拆 3 段渲染**：label 不加粗，value/日期加粗
5. **删除 `drawHeader` 中 y=148 横线**：用户名称行紧凑贴近表格
6. **更新所有几何常量**：`W` / `H` / `PADDING` / `HEADER_Y` / `TITLE_Y` / `TITLE_SIZE` / `COL_WIDTHS` / `SIG_GAP` / `SIG_RIGHT_LABEL_X` 等

## 文件变更清单

| 文件 | 改动 |
|---|---|
| `miniprogram/utils/receipt.js` | 全文重写 `drawReceipt` 与所有 `drawXxx` 辅助函数；调整所有几何常量；新增 `SKIP_VERTICALS`；修复 `getReceiptUserName` |
| `miniprogram/utils/receipt.test.js` | 更新第 13-15 行的 `getReceiptUserName` 测试预期值 |
| `miniprogram/pages/receipt/preview/index.js` | 同步 `RECEIPT_W` / `RECEIPT_H` 常量（900→930，560→460） |
| `docs/preview-receipt.html` | （新文件）BEFORE vs AFTER 可视化对照页面，仅用于本次设计评审，**不属于实施范围** |

## 验收标准

打开 [docs/preview-receipt.html](../../preview-receipt.html) 浏览器双击预览，AFTER 画布应满足：

1. 大标题"收  据"40px 加粗，水平居中于画布
2. 用户名称行：无下方横线；"用户名称:"不加粗，地址房号和日期加粗
3. 表头 7 列 Microsoft YaHei 字体，bold 效果明显
4. 水费/电费行正常 6 列渲染
5. 租金行：描述"2026年7月份房租"在中间 4 列**居中**，金额 1400 在 col 5 右对齐
6. 拆分行：垃圾费金额 15.00 跨 cols 1-2 右对齐，网络费金额 50.00 跨 cols 4-5 右对齐，小计 65.00 在 col 6
7. 合计行：CN 大写文字跨 cols 0-4 **加粗**，"¥1837.17" 在 cols 5-6 右对齐、bold 24px
8. 签名行：开票人在最左、收款人靠最右，中间大段空白
9. 右侧"存根（白）客户（红）"10 字中文竖排，每字正立
10. 表格外框完整：顶部、底部、所有 7 条横线齐全；合并区域内部无竖线，合并区域边界有竖线
11. 整图 930×460，底部 ~39px 空白（比 BEFORE 的 109px 大幅压缩）

实施完成后，在 `miniprogram/pages/receipt/preview` 加载真实数据，导出的 PNG 应与上述 11 条一致。

## 风险与边界

- **首月无 `prevBill`**：`water_usage` / `elec_usage` 为 0，"实用"列显示 `0`（与现有行为一致）
- **垃圾费/网络费为 0**：金额小计列显示 `0.00`
- **房间名为空**（`room.code === '旧屋'`）：`userName` 用 `getReceiptUserName` 的旧规则
- **金额小数位**：金额小计列保持两位小数（`formatAmount` → `toFixed(2)`）
- **中文大写**：复用现有 `formatCNY` 函数
- **金额溢出**：单元格宽度固定，超长金额会被截断（与现有行为一致）
- **画布缩放**：`pixelRatio` 缩放保持不变（仅 W/H 数值改动）
- **字体兼容性**：Microsoft YaHei 在 iOS/Android WeChat Canvas 上都可用；但若用户系统未装该字体，会回退到默认无衬线字体（视觉略变但不影响数据正确性）
- **签名行靠最右**：开票人 underline 在 x=170-330，收款人 underline 在 x=700-860，中间 370px 空白；若用户偏好"中间签名区更宽"，可调整 `SIG_RIGHT_LABEL_X`
