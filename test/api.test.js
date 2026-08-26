const { before, test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { createApp } = require('../server/app');

function testEnv(overrides = {}) {
  return {
    SESSION_SECRET: 'test-secret',
    SMS_PROVIDER: 'mock',
    DB_PATH: ':memory:',
    COOKIE_SECURE: 'false',
    ADMIN_PHONES: '13800000001',
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
  assert.equal(send.status, 200);
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
