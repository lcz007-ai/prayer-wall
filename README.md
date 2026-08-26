# 守望代祷墙

教会内部使用的代祷贴纸墙：手机号登录后，可以查看附近（同市）或全国的最新代祷需求，发布时按内容自动推荐标签、可按标签筛选，还能为其他人的需求献上祷告。

## 技术栈

- 前端：Vue 3 + Vite，移动端优先，无 UI 框架
- 后端：Node.js + Express
- 数据库：SQLite（单文件，内置）
- 短信：阿里云短信（开发环境可用 mock 代替）
- 部署：宝塔面板 + PM2 + 域名 HTTPS

## 本地开发

```bash
npm install
npm run dev
```

后端默认运行在 `http://127.0.0.1:3000`，前端开发服务器默认运行在 `http://127.0.0.1:5173`，`/api` 请求会自动代理到后端。

本地默认使用 mock 短信，登录页会直接显示测试验证码。

## 测试

```bash
npm test
```

测试覆盖登录、访问口令、同市/全国过滤、发布校验、祷告幂等、30 天归档和删除权限。

## 生产构建与启动

```bash
npm run build
npm start
```

生产部署到宝塔 + PM2 的完整步骤见 [docs/deploy.md](docs/deploy.md)。
安卓 App 打包与上架（国内商店）步骤见 [docs/app-android.md](docs/app-android.md)。

## 环境变量

复制 `.env.example` 为 `.env` 后按需修改，所有配置项见示例文件。
