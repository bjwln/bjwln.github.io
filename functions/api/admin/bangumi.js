import { json, initBangumiTables, handleOptions } from '../../_lib';

function checkAuth(request, env) {
  const token = request.headers.get('X-Admin-Token');
  return env.ADMIN_TOKEN && token === env.ADMIN_TOKEN;
}

const str = (v, max = 500) => (v == null ? '' : String(v).trim().slice(0, max));

// GET /api/admin/bangumi —— 管理端列表（与公开接口同构）
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!checkAuth(request, env)) return json({ error: 'unauthorized' }, 401);
  try {
    await initBangumiTables(env);
  } catch (e) {
    return json({ error: 'init failed: ' + e.message }, 500);
  }
  const cats = await env.DB.prepare('SELECT id, name, sort FROM bangumi_categories ORDER BY sort, id').all();
  const items = await env.DB.prepare(
    `SELECT id, title, author, image, link, intro, episode, total, sync_url, latest_title, latest_cover, latest_url, latest_pubdate, watched_url, status, category_id, sort
     FROM bangumi_items ORDER BY sort, id`
  ).all();
  return json({ categories: cats.results || [], items: items.results || [] });
}

// POST /api/admin/bangumi —— { action: item.save | item.delete | category.save | category.delete, ... }
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!checkAuth(request, env)) return json({ error: 'unauthorized' }, 401);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'invalid json' }, 400);
  }
  try {
    await initBangumiTables(env);
  } catch (e) {
    return json({ error: 'init failed: ' + e.message }, 500);
  }
  const action = str(body.action, 40);
  const db = env.DB;

  if (action === 'item.save') {
    const title = str(body.title, 200);
    if (!title) return json({ error: '标题不能为空' }, 400);
    const values = {
      title,
      author: str(body.author, 100),
      image: str(body.image, 1000),
      link: str(body.link, 1000),
      intro: str(body.intro, 2000),
      episode: str(body.episode, 50),
      total: str(body.total, 50),
      sync_url: str(body.sync_url, 500),
      watched_url: str(body.watched_url, 500),
      status: str(body.status, 20) || '在看',
      category_id: body.category_id ? Number(body.category_id) : null,
      sort: Number(body.sort) || 0,
      updated_at: Date.now(),
    };
    if (body.id) {
      await db.prepare(
        `UPDATE bangumi_items SET title=?2, author=?3, image=?4, link=?5, intro=?6, episode=?7,
         total=?8, sync_url=?9, watched_url=?10, status=?11, category_id=?12, sort=?13, updated_at=?14 WHERE id=?1`
      ).bind(Number(body.id), values.title, values.author, values.image, values.link, values.intro,
        values.episode, values.total, values.sync_url, values.watched_url, values.status, values.category_id, values.sort, values.updated_at).run();
    } else {
      await db.prepare(
        `INSERT INTO bangumi_items (title, author, image, link, intro, episode, total, sync_url, watched_url, status, category_id, sort, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`
      ).bind(values.title, values.author, values.image, values.link, values.intro, values.episode,
        values.total, values.sync_url, values.watched_url, values.status, values.category_id, values.sort, values.updated_at).run();
    }
    return json({ ok: true });
  }

  // 一键追平:把「看到」直接设为「更新至」
  if (action === 'item.catchup') {
    const id = Number(body.id);
    if (!id) return json({ error: 'missing id' }, 400);
    const row = await db.prepare('SELECT total FROM bangumi_items WHERE id = ?1').bind(id).first();
    if (!row || !row.total) return json({ error: '该条目没有「更新至」数据' }, 400);
    await db.prepare('UPDATE bangumi_items SET episode = ?2, updated_at = ?3 WHERE id = ?1')
      .bind(id, row.total, Date.now()).run();
    return json({ ok: true, episode: row.total });
  }

  // 自动同步:更新最新集数、最新视频信息与卡片介绍(最新一集剧情),不动其他字段
  if (action === 'item.setTotal') {
    const id = Number(body.id);
    if (!id) return json({ error: 'missing id' }, 400);
    await db.prepare(`UPDATE bangumi_items SET total = ?2, latest_title = ?3, latest_cover = ?4,
      latest_url = ?5, latest_pubdate = ?6, intro = ?7, updated_at = ?8 WHERE id = ?1`)
      .bind(id, str(body.total, 50), str(body.latest_title, 300), str(body.latest_cover, 1000),
        str(body.latest_url, 1000), body.latest_pubdate ? Number(body.latest_pubdate) : null,
        str(body.intro, 2000), Date.now()).run();
    return json({ ok: true });
  }

  if (action === 'item.delete') {
    const id = Number(body.id);
    if (!id) return json({ error: 'missing id' }, 400);
    await db.prepare('DELETE FROM bangumi_items WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }

  if (action === 'category.save') {
    const name = str(body.name, 50);
    if (!name) return json({ error: '分类名不能为空' }, 400);
    const sort = Number(body.sort) || 0;
    if (body.id) {
      await db.prepare('UPDATE bangumi_categories SET name = ?2, sort = ?3 WHERE id = ?1')
        .bind(Number(body.id), name, sort).run();
    } else {
      await db.prepare('INSERT INTO bangumi_categories (name, sort) VALUES (?1, ?2)').bind(name, sort).run();
    }
    return json({ ok: true });
  }

  if (action === 'category.delete') {
    const id = Number(body.id);
    if (!id) return json({ error: 'missing id' }, 400);
    await db.prepare('UPDATE bangumi_items SET category_id = NULL WHERE category_id = ?').bind(id).run();
    await db.prepare('DELETE FROM bangumi_categories WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }

  return json({ error: 'unknown action' }, 400);
}

export async function onRequestOptions() {
  return handleOptions();
}
