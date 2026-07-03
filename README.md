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
