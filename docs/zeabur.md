# 部署到 Zeabur

Zeabur（zeabur.com）是容器型 PaaS：长驻 Node 进程、支持原生模块（better-sqlite3）、可挂持久卷存 SQLite，与本项目架构完全兼容。推荐选**香港 / 新加坡**区域（国内访问较快）。

> 挂载持久卷（Volume）需要付费计划（Developer $5/月起）。没有持久卷时每次重新部署都会清空数据库，**切勿裸跑生产**。

## 1. 前置准备

- GitHub 仓库已推送本项目代码（仓库根目录已含 `zbpack.json`，Zeabur 会自动按它构建）
- Zeabur 账号（可用 GitHub 登录），并订阅付费计划

## 2. 创建服务

1. Zeabur 控制台 → New Project → 区域选 **Hong Kong** 或 **Singapore**
2. Add Service → Git → 选本仓库，Zeabur 识别为 Node.js 项目并按 `zbpack.json` 执行：
   - 构建：`npm install --include=dev && npm run build`（装 devDeps 里的 vite 并产出 `client/dist`）
   - 启动：`npm start`（即 `node server/index.js`，会同时伺服 API 与前端静态文件）

## 3. 挂载持久卷（关键）

服务 → **Volumes / 存储** → Attach Volume：

- **Mount Directory**：`/data`
- 容量：1 GB 起步（SQLite 单文件，很小）

数据库将存于 `/data/app.db`（含 WAL 边车文件），重新部署不丢失。项目的 `db.js` 启动时会自动创建目录、建表并执行旧库迁移（含 `failed_attempts`、`status` 列），首次启动即完成初始化。

## 4. 环境变量

服务 → Variables，按下表配置：

| 变量 | 值 | 说明 |
|---|---|---|
| `HOST` | `0.0.0.0` | **必设**，默认 127.0.0.1 外网不可达 |
| `DB_PATH` | `/data/app.db` | 指向持久卷 |
| `TRUST_PROXY` | `true` | 平台反代后取真实 IP，否则 IP 限流误伤 |
| `COOKIE_SECURE` | `true` | 平台默认 HTTPS |
| `SESSION_SECRET` | 随机长字符串 | 会话签名密钥 |
| `NODE_ENV` | `production` | |
| `RATE_LIMIT_MAX` | `60` | 可选，/api/auth 每分钟每 IP 上限 |
| `ADMIN_PHONES` | 如 `13800000000` | 管理员手机号 |
| `SMS_PROVIDER` | `mock` 或 `aliyun` | 上线前改 aliyun |
| `ALIYUN_ACCESS_KEY_ID` / `ALIYUN_ACCESS_KEY_SECRET` / `ALIYUN_SIGN_NAME` / `ALIYUN_TEMPLATE_CODE` | 阿里云短信控制台获取 | SMS_PROVIDER=aliyun 时必填 |
| `ACCESS_PASSWORD` | 可选 | 整站访问口令 |
| `CORS_ORIGIN` | 可选 | 安卓 App 壳跨域来源（`https://localhost`），Web 同源部署无需 |

改完环境变量后 Redeploy 生效。

## 5. 域名

服务 → Networking → Generate Domain（得到 `*.zeabur.app`）或 Bind Custom Domain 绑自己的域名（CNAME 指向 Zeabur 给出的地址）。短信、Cookie 等均不受域名影响。

## 6. 安卓 App 壳

打包 App 时在 `client/.env.production` 设：

```
VITE_API_BASE=https://你的域名
```

再 `npm run build:app`。同时 Zeabur 服务的 `CORS_ORIGIN` 需包含 `https://localhost`（Capacitor WebView 默认源）。

## 7. 运维注意

- **备份**：Zeabur 控制台可随时下载 Volume 内容；建议定期导出 `app.db`（SQLite 单文件，直接拷贝即备份，WAL 模式下建议先停写或用 `VACUUM INTO`）
- **单实例**：SQLite 单写者，服务保持 1 实例，勿开多副本
- **日志**：控制台 Logs 可看 `[mock-sms]`、`[cleanup]` 等运行输出
- 回滚：Deployments 页面可一键回退到历史版本（数据库结构迁移是追加式 ALTER，回滚代码不破坏数据）
