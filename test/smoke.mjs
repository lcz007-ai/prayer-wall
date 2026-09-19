import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 3210;
const baseUrl = `http://127.0.0.1:${port}`;
const dbPath = path.join(os.tmpdir(), `prayer-wall-smoke-${Date.now()}.db`);
const screenshotDir = path.join(root, 'test', 'screenshots');

let server;
let browser;
let page;
const consoleErrors = [];

function fail(message) {
  console.error(`SMOKE FAIL: ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

async function waitForServer() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const res = await fetch(`${baseUrl}/api/auth/me`);
      if (res.status === 401) return;
    } catch {
      // server not ready yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  fail('server did not start');
}

async function login(phone) {
  await page.locator('input[placeholder="手机号"]').fill(phone);
  const sendPromise = page.waitForResponse((r) => r.url().includes('/api/auth/send-code'));
  await page.locator('button.ghost-btn').click();
  const sendResponse = await sendPromise;
  const sendBody = await sendResponse.json().catch(() => ({}));
  console.log(`send-code ${phone} -> ${sendResponse.status()}`, sendBody);
  await page
    .locator('.dev-hint')
    .or(page.locator('.form-error'))
    .waitFor({ timeout: 5000 });
  const errorText = await page.locator('.form-error').textContent().catch(() => '');
  if (errorText) fail(`send-code failed: ${errorText}`);
  const hint = await page.locator('.dev-hint').textContent();
  const code = hint.replace(/\D/g, '').slice(-6);
  if (!/^\d{6}$/.test(code)) fail(`invalid dev code: ${hint}`);
  await page.locator('input[placeholder="验证码"]').fill(code);
  await page.locator('button.primary-btn').click();
  await page.locator('.topbar').waitFor({ timeout: 5000 });
}

async function selectRegion() {
  await page.locator('.region-grid select').nth(0).selectOption({ label: '浙江省' });
  await page.locator('.region-grid select').nth(1).selectOption({ label: '杭州市' });
  await page.locator('.region-grid select').nth(2).selectOption({ label: '西湖区' });
  await page.locator('.sheet button.primary-btn').click();
  await page.waitForTimeout(300);
}

async function createPost(content) {
  await page.locator('button.fab').click();
  await page.locator('textarea').fill(content);
  await page.locator('.tag-row .tag-chip.active').first().waitFor({ timeout: 3000 });
  await captureDesign();
  await page.locator('.sheet form button.primary-btn').click();
  await page.locator(`.sticker-content`, { hasText: content }).waitFor({ timeout: 5000 });
}

async function assertLayout(label) {
  const problems = await page.evaluate(() => {
    const bad = [];
    const html = document.documentElement;
    if (html.scrollWidth > html.clientWidth + 1) {
      bad.push(`页面横向溢出 ${html.scrollWidth} > ${html.clientWidth}`);
    }
    document.querySelectorAll('.sticker-content').forEach((el) => {
      if (el.scrollWidth > el.clientWidth + 1) bad.push('贴纸内容横向溢出');
    });
    const topbar = document.querySelector('.topbar')?.getBoundingClientRect();
    const scopeBar = document.querySelector('.scope-bar')?.getBoundingClientRect();
    if (topbar && scopeBar && scopeBar.top < topbar.bottom - 1) {
      bad.push('顶部导航与范围切换重叠');
    }
    return bad;
  });
  if (problems.length) fail(`${label}: ${problems.join('；')}`);
}

const design = {};

async function captureDesign() {
  const data = await page.evaluate(() => {
    const style = (el) => getComputedStyle(el);
    const body = style(document.body);
    const primary = document.querySelector('.primary-btn');
    const fab = document.querySelector('.fab');
    const sticker = document.querySelector('.sticker');
    const chip = document.querySelector('.tag-chip');
    const authPage = document.querySelector('.auth-page');
    const out = { bodyBg: body.backgroundColor };
    if (authPage) out.authBgImage = style(authPage).backgroundImage;
    if (primary) {
      out.primaryBg = style(primary).backgroundColor;
      out.primaryRadius = style(primary).borderRadius;
    }
    if (fab) out.fabRadius = style(fab).borderRadius;
    if (sticker) {
      out.stickerRadius = style(sticker).borderRadius;
      out.stickerBorder = `${style(sticker).borderWidth} ${style(sticker).borderStyle}`;
      out.stickerTilt = style(sticker).getPropertyValue('--tilt').trim();
      out.stickerBg = style(sticker).backgroundColor;
    }
    if (chip) out.chipRadius = style(chip).borderRadius;
    return out;
  });
  Object.assign(design, data);
}

function assertNordicDesign(label) {
  const expect = (ok, name) => { if (!ok) fail(`${label}: ${name} 未通过`); };
  expect(design.bodyBg === 'rgb(246, 243, 237)', '背景应为米白');
  expect(design.authBgImage === 'none', '登录页应去掉渐变');
  expect(design.primaryBg === 'rgb(29, 53, 87)', '主按钮应为墨蓝');
  expect(design.primaryRadius === '6px', '主按钮应为 6px 圆角');
  expect(design.fabRadius === '6px', '悬浮按钮应为 6px 圆角');
  expect(design.stickerRadius === '6px', '贴纸应为 6px 圆角');
  expect(design.stickerBorder !== undefined && design.stickerBorder !== '0px none', '贴纸应有细描边');
  expect(design.stickerTilt !== undefined && design.stickerTilt !== '' && design.stickerTilt !== '0deg', '贴纸应有轻微旋转');
  expect(design.stickerBg !== undefined && design.stickerBg !== 'rgba(0, 0, 0, 0)', '贴纸应有北欧色');
  expect(design.chipRadius !== undefined && design.chipRadius !== '0px', '标签应为药丸');
}
async function logout() {
  await page.locator('button[aria-label="退出登录"]').click();
  await page.locator('.auth-card').waitFor({ timeout: 5000 });
}

async function run() {
  fs.mkdirSync(screenshotDir, { recursive: true });
  server = spawn(process.execPath, ['server/index.js'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      DB_PATH: dbPath,
      SMS_PROVIDER: 'mock',
      SESSION_SECRET: 'smoke-test-secret',
      COOKIE_SECURE: 'false',
      ADMIN_PHONES: '',
      NODE_ENV: 'production'
    },
    stdio: 'ignore'
  });
  await waitForServer();

  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !/401/.test(msg.text())) consoleErrors.push(msg.text());
  });
  page.on('dialog', (dialog) => dialog.accept());

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.locator('.auth-card h1', { hasText: '守望贴纸墙' }).waitFor();
  await captureDesign();

  // 第一个用户：登录、选择地区、发布
  await login('13800001234');
  await selectRegion();
  await createPost('请大家为家里的老人身体祷告');

  await page.locator('.tag-bar button', { hasText: '健康' }).click();
  await page.locator('.sticker-content', { hasText: '请大家为家里的老人身体祷告' }).waitFor();
  await page.locator('.tag-bar button', { hasText: '全部' }).click();
  await page.locator('.sticker-content', { hasText: '请大家为家里的老人身体祷告' }).waitFor();

  await page.locator('.segmented button', { hasText: '全国' }).click();
  await page.locator('.segmented button', { hasText: '附近' }).click();
  await page.locator('.sticker-content', { hasText: '请大家为家里的老人身体祷告' }).waitFor();
  await assertLayout('mobile');
  await captureDesign();
  await assertNordicDesign('mobile');

  // 第二个用户：登录、选择地区、发布另一条
  await logout();
  await login('13800005678');
  await selectRegion();
  await createPost('请为我明天的面试祷告');

  await logout();
  await login('13800001234');

  // 第一个用户为第二个用户祷告
  const target = page.locator('.sticker', { hasText: '请为我明天的面试祷告' });
  await target.locator('.pray-btn').click();
  await page.waitForTimeout(300);
  const countText = await target.locator('.pray-btn span').textContent();
  if (countText.trim() !== '1') fail(`pray count should be 1, got ${countText}`);
  if (!(await target.locator('.pray-btn').evaluate((el) => el.classList.contains('prayed')))) {
    fail('pray button should be marked prayed');
  }

  // 删除自己的帖子
  const own = page.locator('.sticker', { hasText: '请大家为家里的老人身体祷告' });
  await own.locator('button[aria-label="删除"]').click();
  await page.waitForTimeout(300);
  if (await page.locator('.sticker', { hasText: '请大家为家里的老人身体祷告' }).count()) {
    fail('own post should be deleted');
  }

  await page.screenshot({ path: path.join(screenshotDir, 'mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(200);
  await assertLayout('desktop');
  await page.screenshot({ path: path.join(screenshotDir, 'desktop.png'), fullPage: true });

  if (consoleErrors.length) {
    console.error('console errors:', consoleErrors);
    fail(`browser console errors: ${consoleErrors.join(' | ')}`);
  }
  console.log('SMOKE PASS');
}

try {
  await run();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  try {
    await browser?.close();
  } catch {
    // ignore
  }
  server?.kill();
  try {
    fs.rmSync(dbPath, { force: true });
    fs.rmSync(`${dbPath}-wal`, { force: true });
    fs.rmSync(`${dbPath}-shm`, { force: true });
  } catch {
    // ignore
  }
}
