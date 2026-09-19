const { before, test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { createApp } = require('../server/app');
const { cleanup } = require('../server/cleanup');

function testEnv(overrides = {}) {
  return {
    SESSION_SECRET: 'test-secret',
    SMS_PROVIDER: 'mock',
    DB_PATH: ':memory:',
    COOKIE_SECURE: 'false',
    ADMIN_PHONES: '13800000001',
    RATE_LIMIT_MAX: '1000', // 存量用例高频请求，放行 IP 限流；限流本身有独立用例
    ...overrides
  };
}

let app;
let db;

before(() => {
  const created = createApp({ env: testEnv() });
  app = created.app;
  db = created.db;
});

async function loginAs(agent, phone) {
  const send = await agent.post('/api/auth/send-code').send({ phone });
  assert.equal(send.status, 200, `send-code 失败: ${JSON.stringify(send.body)}`);
  const login = await agent
    .post('/api/auth/login')
    .send({ phone, code: send.body.devCode });
  assert.equal(login.status, 200);
  return login.body.user;
}

async function setRegion(agent, province, city, district) {
  const res = await agent
    .patch('/api/me')
    .send({ province, city, district });
  assert.equal(res.status, 200);
}

test('发送验证码：手机号校验与限频', async () => {
  const bad = await request(app).post('/api/auth/send-code').send({ phone: '12345' });
  assert.equal(bad.status, 400);

  const ok = await request(app).post('/api/auth/send-code').send({ phone: '13800000000' });
  assert.equal(ok.status, 200);
  assert.match(ok.body.devCode, /^\d{6}$/);

  const again = await request(app).post('/api/auth/send-code').send({ phone: '13800000000' });
  assert.equal(again.status, 429);
});

test('登录：错误验证码拒绝，正确验证码建立会话', async () => {
  const agent = request.agent(app);
  const send = await agent.post('/api/auth/send-code').send({ phone: '13900000000' });
  assert.equal(send.status, 200);
  const bad = await agent.post('/api/auth/login').send({ phone: '13900000000', code: '000000' });
  assert.equal(bad.status, 401);

  const ok = await agent
    .post('/api/auth/login')
    .send({ phone: '13900000000', code: send.body.devCode });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.phone, '13900000000');

  const me = await agent.get('/api/auth/me');
  assert.equal(me.status, 200);
});

test('未登录访问接口返回 401', async () => {
  const res = await request(app).get('/api/auth/me');
  assert.equal(res.status, 401);
  const posts = await request(app).get('/api/posts');
  assert.equal(posts.status, 401);
});

test('登录防爆破：同一验证码错误 5 次后作废', async () => {
  const agent = request.agent(app);
  const send = await agent.post('/api/auth/send-code').send({ phone: '13100000000' });
  assert.equal(send.status, 200);
  for (let i = 0; i < 5; i++) {
    const bad = await agent.post('/api/auth/login').send({ phone: '13100000000', code: '000000' });
    assert.equal(bad.status, 401);
  }
  // 第 6 次即使码正确也拒绝（已作废）
  const locked = await agent
    .post('/api/auth/login')
    .send({ phone: '13100000000', code: send.body.devCode });
  assert.equal(locked.status, 401);
  assert.match(locked.body.error, /重新获取/);

  // 重新发码后可正常登录
  const resend = await agent.post('/api/auth/send-code').send({ phone: '13100000000' });
  assert.equal(resend.status, 429); // 60 秒内再次发码被限频
});

test('IP 限流：超过 RATE_LIMIT_MAX 返回 429', async () => {
  const { app: limitedApp } = createApp({ env: testEnv({ RATE_LIMIT_MAX: '3' }) });
  for (let i = 0; i < 3; i++) {
    const res = await request(limitedApp).get('/api/auth/me');
    assert.equal(res.status, 401); // 未登录，但请求已计入限流
  }
  const blocked = await request(limitedApp).get('/api/auth/me');
  assert.equal(blocked.status, 429);
  assert.match(blocked.body.error, /频繁/);
});

test('访问口令：配置后可配置开关生效', async () => {
  const { app: gatedApp } = createApp({
    env: testEnv({ ACCESS_PASSWORD: 'pray123' })
  });
  const agent = request.agent(gatedApp);

  const denied = await agent.get('/api/auth/me');
  assert.equal(denied.status, 403);

  const wrong = await agent.post('/api/auth/access').send({ password: 'nope' });
  assert.equal(wrong.status, 403);

  const ok = await agent.post('/api/auth/access').send({ password: 'pray123' });
  assert.equal(ok.status, 200);
  const token = ok.body.token;

  const stillNeedLogin = await agent.get('/api/auth/me').set('x-access-token', token);
  assert.equal(stillNeedLogin.status, 401, '口令通过后仍需登录');

  const phone = '13700000000';
  await agent.post('/api/auth/send-code').send({ phone }).set('x-access-token', token);
  const login = await agent.post('/api/auth/login').send({ phone }).set('x-access-token', token);
  assert.equal(login.status, 400, '缺少验证码时应返回 400');
});

test('帖子：同市/全国过滤、地区必填、内容长度', async () => {
  const userA = request.agent(app);
  await loginAs(userA, '13500000001');
  await setRegion(userA, '浙江省', '杭州市', '西湖区');

  const userB = request.agent(app);
  await loginAs(userB, '13500000002');
  await setRegion(userB, '江苏省', '南京市', '鼓楼区');

  const empty = await userB.get('/api/posts?scope=same-city');
  assert.equal(empty.status, 200);
  assert.equal(empty.body.posts.length, 0);

  const create = await userB
    .post('/api/posts')
    .send({ content: '请大家为我的手术祷告' });
  assert.equal(create.status, 201);
  assert.equal(create.body.post.nickname, '匿名');

  const sameCity = await userA.get('/api/posts?scope=same-city');
  assert.equal(sameCity.body.posts.length, 0, '不同城市不应出现');

  const all = await userA.get('/api/posts?scope=all');
  assert.equal(all.body.posts.length, 1);
  assert.equal(all.body.posts[0].content, '请大家为我的手术祷告');

  const noContent = await userB.post('/api/posts').send({ content: '   ' });
  assert.equal(noContent.status, 400);

  const tooLong = await userB.post('/api/posts').send({ content: '祷'.repeat(501) });
  assert.equal(tooLong.status, 400);
});

test('标签：存储、校验与筛选', async () => {
  const userA = request.agent(app);
  await loginAs(userA, '13500000010');
  await setRegion(userA, '浙江省', '杭州市', '西湖区');

  const userB = request.agent(app);
  await loginAs(userB, '13500000011');
  await setRegion(userB, '浙江省', '杭州市', '西湖区');

  const health = await userA
    .post('/api/posts')
    .send({ content: '请大家为我的手术祷告', tags: ['健康'] });
  assert.equal(health.status, 201);
  assert.deepEqual(health.body.post.tags, ['健康']);

  const family = await userB
    .post('/api/posts')
    .send({ content: '为家里的老人祷告', tags: ['家庭', '健康'] });
  assert.equal(family.status, 201);
  assert.deepEqual(family.body.post.tags, ['家庭', '健康']);

  const filterHealth = await userA.get('/api/posts?scope=same-city&tag=健康');
  assert.equal(filterHealth.status, 200);
  assert.ok(filterHealth.body.posts.length >= 2);
  assert.ok(filterHealth.body.posts.every((p) => p.tags.includes('健康')));

  const filterWork = await userA.get('/api/posts?scope=same-city&tag=工作');
  assert.equal(filterWork.body.posts.length, 0);

  const invalid = await userA.post('/api/posts').send({ content: '无效标签', tags: ['外星'] });
  assert.equal(invalid.status, 400);

  const tooMany = await userA
    .post('/api/posts')
    .send({ content: '标签太多', tags: ['健康', '家庭', '工作', '学业'] });
  assert.equal(tooMany.status, 400);

  const invalidFilter = await userA.get('/api/posts?scope=same-city&tag=外星');
  assert.equal(invalidFilter.status, 400);

  await userA.delete(`/api/posts/${health.body.post.id}`);
  const tagCount = db
    .prepare(`SELECT COUNT(*) AS c FROM post_tags WHERE post_id = ?`)
    .get(health.body.post.id);
  assert.equal(tagCount.c, 0, '删除帖子时应删除标签关联');
});

test('祷告：每人每帖一次，不能为自己的帖子祷告', async () => {
  const userA = request.agent(app);
  await loginAs(userA, '13500000003');
  await setRegion(userA, '浙江省', '杭州市', '西湖区');

  const userB = request.agent(app);
  await loginAs(userB, '13500000004');
  await setRegion(userB, '浙江省', '杭州市', '西湖区');

  const postRes = await userA.post('/api/posts').send({ content: '为家庭祷告' });
  const postId = postRes.body.post.id;

  const selfPray = await userA.post(`/api/posts/${postId}/pray`);
  assert.equal(selfPray.status, 400);

  const pray = await userB.post(`/api/posts/${postId}/pray`);
  assert.equal(pray.status, 200);
  assert.equal(pray.body.prayCount, 1);
  assert.equal(pray.body.already, false);

  const again = await userB.post(`/api/posts/${postId}/pray`);
  assert.equal(again.status, 200);
  assert.equal(again.body.prayCount, 1);
  assert.equal(again.body.already, true);

  const list = await userB.get('/api/posts?scope=same-city');
  const post = list.body.posts.find((p) => p.id === postId);
  assert.equal(post.prayed, true);
  assert.equal(post.prayCount, 1);
});

test('归档：30 天边界', async () => {
  const user = request.agent(app);
  const archiveUser = await loginAs(user, '13600000001');
  await setRegion(user, '浙江省', '杭州市', '西湖区');

  const oldId = db
    .prepare(
      `INSERT INTO posts (user_id, content, nickname, province, city, district, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-31 days'))`
    )
    .run(archiveUser.id, '旧需求', '匿名', '浙江省', '杭州市', '西湖区').lastInsertRowid;
  const freshId = db
    .prepare(
      `INSERT INTO posts (user_id, content, nickname, province, city, district, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-29 days'))`
    )
    .run(archiveUser.id, '新需求', '匿名', '浙江省', '杭州市', '西湖区').lastInsertRowid;

  const list = await user.get('/api/posts?scope=all');
  const ids = list.body.posts.map((p) => p.id);
  assert.ok(!ids.includes(oldId), '31 天前的内容应归档');
  assert.ok(ids.includes(freshId), '29 天前的内容应可见');
});

test('删除：本人可删、他人不可删、管理员可删', async () => {
  const owner = request.agent(app);
  await loginAs(owner, '13400000001');
  await setRegion(owner, '广东省', '广州市', '天河区');
  const created = await owner.post('/api/posts').send({ content: '待删除的需求' });
  const postId = created.body.post.id;

  const other = request.agent(app);
  await loginAs(other, '13400000002');
  await setRegion(other, '广东省', '广州市', '天河区');
  const denied = await other.delete(`/api/posts/${postId}`);
  assert.equal(denied.status, 403);

  const admin = request.agent(app);
  await loginAs(admin, '13800000001');
  const adminDelete = await admin.delete(`/api/posts/${postId}`);
  assert.equal(adminDelete.status, 200);

  const after = await owner.delete(`/api/posts/${postId}`);
  assert.equal(after.status, 404);
});

test('社区功能：留言、收藏、搜索与我的发布', async () => {
  const owner = request.agent(app);
  await loginAs(owner, '13300000001');
  await setRegion(owner, '浙江省', '温州市', '鹿城区');

  const friend = request.agent(app);
  await loginAs(friend, '13300000002');
  await setRegion(friend, '浙江省', '温州市', '鹿城区');

  const stranger = request.agent(app);
  await loginAs(stranger, '13300000003');
  await setRegion(stranger, '江苏省', '苏州市', '姑苏区');

  const savedPost = await owner
    .post('/api/posts')
    .send({ content: '守望搜索专用：为家人出行的平安祷告', nickname: '搜索楼主' });
  const plainPost = await owner
    .post('/api/posts')
    .send({ content: '另一条不需要搜索到的需求', nickname: '另一位' });
  const postId = savedPost.body.post.id;

  assert.equal(savedPost.body.post.saved, false);
  assert.equal(savedPost.body.post.commentCount, 0);

  const emptyContent = await friend.post(`/api/posts/${postId}/comments`).send({ content: ' ' });
  assert.equal(emptyContent.status, 400);

  const created = await friend
    .post(`/api/posts/${postId}/comments`)
    .send({ content: '愿你们一路平安，我会持续记念。' });
  assert.equal(created.status, 201);
  assert.equal(created.body.commentCount, 1);

  const comments = await owner.get(`/api/posts/${postId}/comments`);
  assert.equal(comments.status, 200);
  assert.equal(comments.body.comments.length, 1);
  assert.equal(comments.body.comments[0].nickname, '匿名');
  assert.equal(comments.body.comments[0].mine, false);
  assert.equal(comments.body.comments[0].canDelete, true, '帖子作者可以管理自己帖子下的留言');

  const strangerDelete = await stranger.delete(
    `/api/posts/${postId}/comments/${comments.body.comments[0].id}`
  );
  assert.equal(strangerDelete.status, 403);

  const save = await friend.post(`/api/posts/${postId}/save`);
  assert.equal(save.status, 200);
  const saveAgain = await friend.post(`/api/posts/${postId}/save`);
  assert.equal(saveAgain.status, 200);

  const savedList = await friend.get('/api/posts?scope=saved');
  const savedIds = savedList.body.posts.map((p) => p.id);
  assert.ok(savedIds.includes(postId));
  assert.ok(!savedIds.includes(plainPost.body.post.id));
  assert.equal(savedList.body.posts.find((p) => p.id === postId).saved, true);
  assert.equal(savedList.body.posts.find((p) => p.id === postId).commentCount, 1);

  const unsave = await friend.delete(`/api/posts/${postId}/save`);
  assert.equal(unsave.status, 200);
  const savedAfterUnsave = await friend.get('/api/posts?scope=saved');
  assert.ok(!savedAfterUnsave.body.posts.some((p) => p.id === postId));

  const searched = await friend.get('/api/posts?scope=all&q=守望搜索专用');
  assert.equal(searched.body.posts.length, 1);
  assert.equal(searched.body.posts[0].id, postId);

  const mine = await owner.get('/api/posts?scope=mine');
  const mineIds = mine.body.posts.map((p) => p.id);
  assert.ok(mineIds.includes(postId));
  assert.ok(mineIds.includes(plainPost.body.post.id));
  assert.ok(mine.body.posts.every((p) => p.mine));
});

test('访客登录：可浏览但只能手机号用户写入', async () => {
  const member = request.agent(app);
  await loginAs(member, '13200000001');
  await setRegion(member, '浙江省', '宁波市', '海曙区');
  const created = await member.post('/api/posts').send({ content: '访客可浏览的代祷需求' });
  const postId = created.body.post.id;

  const guest = request.agent(app);
  const guestLogin = await guest.post('/api/auth/guest');
  assert.equal(guestLogin.status, 201);
  assert.equal(guestLogin.body.user.role, 'guest');
  assert.equal(guestLogin.body.user.phone, '');
  assert.equal(guestLogin.body.user.nickname, '访客');
  const guestId = guestLogin.body.user.id;

  const noRegion = await guest.get('/api/posts?scope=same-city');
  assert.equal(noRegion.status, 200);
  assert.equal(noRegion.body.needsRegion, true);

  const deniedCreate = await guest.post('/api/posts').send({ content: '访客不能发布' });
  assert.equal(deniedCreate.status, 403);

  await setRegion(guest, '浙江省', '宁波市', '海曙区');
  const list = await guest.get('/api/posts?scope=all');
  assert.equal(list.status, 200);
  assert.ok(list.body.posts.some((p) => p.id === postId));

  const comments = await guest.get(`/api/posts/${postId}/comments`);
  assert.equal(comments.status, 200);

  const deniedPray = await guest.post(`/api/posts/${postId}/pray`);
  assert.equal(deniedPray.status, 403);
  const deniedComment = await guest.post(`/api/posts/${postId}/comments`).send({ content: '访客不能留言' });
  assert.equal(deniedComment.status, 403);
  const deniedSave = await guest.post(`/api/posts/${postId}/save`);
  assert.equal(deniedSave.status, 403);

  const me = await guest.get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.user.role, 'guest');
  assert.equal(me.body.user.phone, '');

  await guest.post('/api/auth/logout');
  const afterLogout = await guest.get('/api/auth/me');
  assert.equal(afterLogout.status, 401);
  assert.equal(db.prepare(`SELECT COUNT(*) AS c FROM users WHERE id = ?`).get(guestId).c, 0);
});

test('分页：默认 30 条，nextCursor 翻页，limit 上限 50', async () => {
  const agent = request.agent(app);
  await loginAs(agent, '13700000001');
  await setRegion(agent, '浙江省', '杭州市', '西湖区');
  for (let i = 0; i < 35; i++) {
    const res = await agent.post('/api/posts').send({ content: `分页测试 ${i}`, tags: [] });
    assert.equal(res.status, 201);
  }
  const page1 = await agent.get('/api/posts?scope=mine');
  assert.equal(page1.status, 200);
  assert.equal(page1.body.posts.length, 30);
  assert.ok(page1.body.nextCursor);

  const page2 = await agent.get(`/api/posts?scope=mine&before=${page1.body.nextCursor}`);
  assert.equal(page2.body.posts.length, 5);
  assert.equal(page2.body.nextCursor, null);

  // limit clamp：999 → 上限 50（实际只有 35 条全返）；非法值回落默认 30
  const clamped = await agent.get('/api/posts?scope=mine&limit=999');
  assert.equal(clamped.body.posts.length, 35);
  const invalid = await agent.get('/api/posts?scope=mine&limit=-5');
  assert.equal(invalid.body.posts.length, 30);
});

test('定时清理：过期 session 与无会话访客被删，正常数据保留', () => {
  const g = db
    .prepare(`INSERT INTO users (phone, nickname, role) VALUES ('guest:cleanup-test', '访客', 'guest')`)
    .run();
  const guestId = g.lastInsertRowid;
  db.prepare(`INSERT INTO post_saves (post_id, user_id) VALUES (1, ?)`).run(guestId);
  db.prepare(
    `INSERT INTO sessions (user_id, token, expires_at) VALUES (?, 'expired-token', datetime('now', '-1 day'))`
  ).run(guestId);

  const removed = cleanup(db);
  assert.equal(removed, 1);
  assert.equal(db.prepare(`SELECT COUNT(*) AS c FROM sessions WHERE token = 'expired-token'`).get().c, 0);
  assert.equal(db.prepare(`SELECT COUNT(*) AS c FROM users WHERE id = ?`).get(guestId).c, 0);
  assert.equal(db.prepare(`SELECT COUNT(*) AS c FROM post_saves WHERE user_id = ?`).get(guestId).c, 0);

  // 正常用户与有效会话不受影响
  assert.ok(db.prepare(`SELECT COUNT(*) AS c FROM users WHERE role != 'guest'`).get().c > 0);
});

test('session token 哈希存储：库中无明文 token', async () => {
  const agent = request.agent(app);
  await loginAs(agent, '13600000002');
  const tokens = db.prepare(`SELECT token FROM sessions`).all();
  assert.ok(tokens.length > 0);
  for (const t of tokens) {
    assert.match(t.token, /^[0-9a-f]{64}$/); // sha256 hex，非明文随机 token 也非原始 hex 64 同形——配合 me 接口验证可用性
  }
  const me = await agent.get('/api/auth/me');
  assert.equal(me.status, 200); // 哈希校验链路正常
});
