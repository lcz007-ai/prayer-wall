# 部署指南

目标环境：一台国内云服务器（推荐阿里云或腾讯云轻量服务器），宝塔面板 + PM2 + Nginx，域名可访问。

## 1. 准备域名和备案

- 将域名解析到服务器公网 IP。
- 域名未备案时，先完成 ICP 备案后再绑定域名上线。备案期间可以先用 `http://服务器IP:3000` 做内部测试，此时把 `.env` 里的 `COOKIE_SECURE=false`。
- 域名已备案时，直接按本文档配置 HTTPS，`COOKIE_SECURE=true`。

## 2. 开通阿里云短信

1. 在阿里云开通短信服务，申请短信签名和验证码模板。模板变量名默认是 `code`，例如：`您的验证码为${code}，5分钟内有效。`
2. 在 RAM 访问控制里创建子用户，授予 `AliyunDysmsFullAccess` 权限，生成 AccessKey ID 和 AccessKey Secret。
3. 把签名名称、模板 CODE、AccessKey 填入 `.env`：

```env
SMS_PROVIDER=aliyun
ALIYUN_ACCESS_KEY_ID=你的AK
ALIYUN_ACCESS_KEY_SECRET=你的SK
ALIYUN_SIGN_NAME=你的签名
ALIYUN_TEMPLATE_CODE=SMS_123456789
ALIYUN_TEMPLATE_PARAM=code
```

## 3. 上传项目并安装依赖

在宝塔面板里安装 Node.js 20 及以上版本（Node.js 版本管理器），然后上传项目到服务器目录，例如 `/www/wwwroot/prayer-wall`。

```bash
cd /www/wwwroot/prayer-wall
npm ci
npm run build
```

## 4. 配置环境变量

```bash
cp .env.example .env
```

按需修改 `.env`：

```env
PORT=3000
HOST=127.0.0.1
DB_PATH=data/app.db
NODE_ENV=production
SESSION_SECRET=用一段足够长的随机字符串
COOKIE_SECURE=true
ADMIN_PHONES=13800000000,13900000000
SMS_PROVIDER=aliyun
RATE_LIMIT_MAX=60
TRUST_PROXY=false
ACCESS_PASSWORD=
```

- `ADMIN_PHONES`：管理员手机号，登录后自动获得删除任意帖子的权限。
- `ACCESS_PASSWORD`：可选的整站访问口令，留空关闭；需要时填一段口令。
- `SESSION_SECRET`：请务必改成随机长字符串。
- `RATE_LIMIT_MAX`：/api/auth 每分钟每 IP 请求上限，默认 60。
- `TRUST_PROXY`：宝塔/nginx 反代部署**必须设为 true**，否则限流把所有用户算作同一个反代 IP，会集体误伤。

## 5. 用 PM2 启动

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

确认启动成功：

```bash
pm2 status
curl http://127.0.0.1:3000/api/auth/me
```

## 6. 配置 Nginx 反向代理和 HTTPS

在宝塔面板添加站点（绑定域名），然后在站点的反向代理或伪静态配置里把请求转发到：

```nginx
proxy_pass http://127.0.0.1:3000;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

在站点设置里申请并启用 SSL 证书（宝塔可自动申请 Let's Encrypt 证书），开启强制 HTTPS。

## 7. 备份 SQLite 数据

在宝塔计划任务里添加一条定时任务（例如每天凌晨）执行：

```bash
cd /www/wwwroot/prayer-wall
mkdir -p backups
sqlite3 data/app.db ".backup 'backups/app-$(date +%F).db'"
```

建议同时把 `backups` 目录同步到对象存储或其他机器。

## 8. 更新版本

```bash
cd /www/wwwroot/prayer-wall
npm ci
npm run build
pm2 restart prayer-wall
```

## 常见问题

- **验证码发不出去**：检查 AccessKey 权限、短信签名和模板是否审核通过、模板变量名是否与 `ALIYUN_TEMPLATE_PARAM` 一致。
- **登录后 Cookie 失效**：如果使用 HTTP 访问，`COOKIE_SECURE` 必须设为 `false`；正式 HTTPS 环境保持 `true`。
- **数据会丢吗**：所有数据都在 `data/app.db`，升级代码不会删除数据文件；部署和回滚时不要覆盖该目录。
