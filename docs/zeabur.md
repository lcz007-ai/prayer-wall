# 部署到 Zeabur

Zeabur（zeabur.com）是容器型 PaaS：长驻 Node 进程、支持原生模块（better-sqlite3）、可挂持久卷存 SQLite，与本项目架构完全兼容。

两种部署位置，按用户所在地区选：

| 方案 | 国内访问 | 适用 |
|---|---|---|
| 默认区域（香港 / 新加坡等海外节点） | ⚠️ 可用但不稳（无国内节点/CDN，跨境延迟，晚高峰波动） | 开发测试、小范围试用 |
| **大陆托管服务器 + 预备案子域名** | ✅ 国内直连，接近国内云水平 | 正式给国内用户使用（见第 5 节） |

> 挂载持久卷（Volume）需要付费计划（Developer $5/月起）。没有持久卷时每次重新部署都会清空数据库，**切勿裸跑生产**。

## 1. 前置准备

- GitHub 仓库已推送本项目代码（仓库根目录已含 `zbpack.json`，Zeabur 会自动按它构建）
- Zeabur 账号（可用 GitHub 登录），并订阅付费计划

## 2. 创建服务

1. Zeabur 控制台 → New Project → 区域选 **Hong Kong** 或 **Singapore**（若已在大陆服务器上部署，则在对应服务器的项目下新建服务，见第 5 节）
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

## 5. 国内访问方案：大陆托管服务器 + 预备案子域名

默认 `*.zeabur.app` 域名解析到海外节点（香港、新加坡等），国内访问“能用但不稳”：无国内节点与 CDN 加速，跨境 HTTPS 握手延迟明显，部分地区/运营商晚高峰易卡顿或偶发打不开。若使用者集中在中国大陆，建议改用 Zeabur 的大陆托管服务器。

### 5.1 购买大陆区域服务器

Zeabur 支持购买托管服务器（非已停售的共享集群），可选有中国大陆区域的云服务商：

| 云服务商 | 大陆区域 | 支持预备案子域名 |
|---|---|---|
| 阿里云 | ✅ | ✅ |
| 腾讯云 | ✅ | ✅ |
| 火山引擎 | ✅ | ⌛️ |
| 华为云 | ✅ | ✅ |
| DigitalOcean / Hetzner | ❌ | ❌ |
| AWS / GCP | ❌ | ❌ |

在 Zeabur 购买服务器时选大陆区域（如阿里云/腾讯云），再把本项目部署到该服务器上；持久卷、环境变量等配置与前面各节一致。

### 5.2 用预备案子域名免去等待

按中国大陆法规，大陆境内服务器需完成 ICP 备案才能用域名访问。Zeabur 提供“预备案子域名”功能：

1. 账号需完成**中国大陆实名认证**（填姓名 + 身份证号，会跳转阿里云实名服务）
2. 服务 → 网络 → 创建域名，实名通过后自动生成并绑定一个 Zeabur 提供的**已备案域名**
3. 此后即可用该域名 HTTPS 访问，合法合规，无需自己等待备案流程

### 5.3 注意事项

- 官方明确**不建议**把预备案子域名当作商用正式域名；若长期使用，建议走正式备案流程（Zeabur 免费提供备案申请的服务与支持）
- 本项目为教会内部使用，属非商用场景，但若服务范围扩大仍建议自备备案域名
- 实名信息与合规责任归使用者，禁止用于违反当地法律法规的行为
- 大陆服务器的持久卷同样需挂载（第 3 节），否则重新部署会丢库

## 6. 域名

服务 → Networking → Generate Domain（得到 `*.zeabur.app`）或 Bind Custom Domain 绑自己的域名（CNAME 指向 Zeabur 给出的地址）。短信、Cookie 等均不受域名影响。

## 7. 安卓 App 壳

打包 App 时在 `client/.env.production` 设：

```
VITE_API_BASE=https://你的域名
```

再 `npm run build:app`。同时 Zeabur 服务的 `CORS_ORIGIN` 需包含 `https://localhost`（Capacitor WebView 默认源）。

## 8. 运维注意

- **备份**：Zeabur 控制台可随时下载 Volume 内容；建议定期导出 `app.db`（SQLite 单文件，直接拷贝即备份，WAL 模式下建议先停写或用 `VACUUM INTO`）
- **单实例**：SQLite 单写者，服务保持 1 实例，勿开多副本
- **日志**：控制台 Logs 可看 `[mock-sms]`、`[cleanup]` 等运行输出
- 回滚：Deployments 页面可一键回退到历史版本（数据库结构迁移是追加式 ALTER，回滚代码不破坏数据）
