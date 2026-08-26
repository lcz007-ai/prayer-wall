# 安卓 App 打包与上架（国内）

本项目用 Capacitor 把现有 Vue Web 应用打包成安卓原生壳，只上国内安卓商店。

## 前置条件

- 已安装 Android Studio（含 Android SDK）
- 后端已部署到公网 HTTPS 域名（见 deploy.md），`.env` 配置好
- 计划好应用包名（`capacitor.config.json` 里的 `appId`，如 `com.yourorg.prayerwall`，发布后不可修改）

## 1. 配置打包参数

复制 `client/.env.production.example` 为 `client/.env.production`，把 `VITE_API_BASE` 改成后端域名：

```
VITE_API_BASE=https://your-domain.com
```

在服务器 `.env` 中开启跨域（Capacitor 安卓 WebView 的 origin 固定为 `https://localhost`）：

```
CORS_ORIGIN=https://localhost
COOKIE_CROSS_SITE=true
COOKIE_SECURE=true
```

改完重启服务（PM2：`pm2 restart prayer-wall`）。

## 2. 构建并同步到安卓工程

```bash
npm run build:app
```

该命令会构建前端并把产物同步到 `android/` 目录。

## 3. 生成图标与启动图

- 准备 1024x1024 的应用图标（png）
- 用 Android Studio 打开 `android/` 目录
- 替换 `android/app/src/main/res/mipmap-*` 下的图标，和 `drawable` 下的启动图

## 4. 打包签名 APK/AAB

1. Android Studio 打开 `android/`
2. `Build > Generate Signed Bundle / APK`
3. 选择 **Android App Bundle（AAB）**（国内商店也普遍支持 AAB/APK）
4. 新建或选择签名 keystore（务必备份好密码，丢失无法更新）
5. 产物输出到 `android/app/build/outputs/bundle/release/`

## 5. 上架准备（国内商店必需）

- **App 备案**：在工信部备案系统给 App 完成备案，拿到备案号（周期最长，先做）
- **软件著作权**：准备源码文档，找代理或自行申请（多数商店硬性要求）
- **隐私政策**：写明收集手机号、位置（城市）、发布内容的用途；应用内需有"删除内容/注销账号"入口
- **内容审核**：代祷帖属于用户生成内容，商店会要求举报/屏蔽功能，请确认应用内有管理入口（管理员角色已支持删帖）

## 6. 逐个上架国内商店

各商店注册开发者账号后按指引上传 AAB/APK + 填写应用信息（截图、简介、隐私政策、备案号、软著）：

- 华为应用市场（AppGallery）
- 小米应用商店
- OPPO 软件商店
- vivo 应用商店
- 腾讯应用宝

## 7. 后续更新

每次改完代码：

```bash
npm run build:app
```

用 Android Studio 重新签名打包（版本号在 `android/app/build.gradle` 中递增），再上传对应商店。

## 常见问题

- **白屏或接口 404**：确认 `client/.env.production` 的 `VITE_API_BASE` 已设置且是 HTTPS
- **登录后刷新失效**：确认服务器 `COOKIE_CROSS_SITE=true` 且是 HTTPS（`SameSite=None; Secure`）
- **本地真机调试连不上后端**：生产必须 HTTPS；仅本地开发可临时给 `android/app/src/main/AndroidManifest.xml` 的 `<application>` 加 `android:usesCleartextTraffic="true"`，测试完删除