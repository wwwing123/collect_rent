# 收租小程序

家庭自用微信小程序，跟踪 7 个出租房（101、201、301、302、401、402、旧屋）按月应收账单。

## 运行

1. 微信开发者工具打开本目录
2. 修改 `miniprogram/app.js` 的 `globalData.env` 为云开发环境 ID
3. 右键 `cloudfunctions/rentApi` → 上传并部署-云端安装依赖
4. 工具 → 构建 npm
5. 编译

## 测试

```bash
npm test
```

运行 `computeBill` 单元测试（5 个用例）。