/**
 * 过期数据定时清理：
 * - 过期会话（sessions.expires_at 已过）
 * - 无活跃会话的访客账号（访客不能发帖/祷告，最多留有收藏，连带清理）
 * 单实例内存版，PM2 多实例时多跑一次也无害（幂等）。
 */
function cleanup(db) {
  return db.transaction(() => {
    db.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`).run();
    const orphans = db
      .prepare(
        `SELECT id FROM users WHERE role = 'guest' AND id NOT IN (SELECT user_id FROM sessions)`
      )
      .all();
    if (orphans.length) {
      const placeholders = orphans.map(() => '?').join(',');
      db.prepare(`DELETE FROM post_saves WHERE user_id IN (${placeholders})`).run(...orphans.map((u) => u.id));
      db.prepare(`DELETE FROM users WHERE id IN (${placeholders})`).run(...orphans.map((u) => u.id));
    }
    return orphans.length;
  })();
}

function scheduleCleanup(db, intervalMs = 24 * 60 * 60 * 1000) {
  const run = () => {
    try {
      const n = cleanup(db);
      if (n) console.log(`[cleanup] 清理无会话访客 ${n} 个`);
    } catch (err) {
      console.error('[cleanup] 失败:', err);
    }
  };
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref?.(); // 不阻止进程退出
  return timer;
}

module.exports = { cleanup, scheduleCleanup };
