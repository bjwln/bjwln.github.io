import { json, initBangumiTables, seedBangumi, handleOptions } from '../_lib';

// GET /api/bangumi —— 追番页公开数据（分类 + 条目）
export async function onRequestGet(context) {
  const { env } = context;
  try {
    await initBangumiTables(env);
    await seedBangumi(env);
  } catch (e) {
    return json({ error: 'init failed: ' + e.message }, 500);
  }
  const cats = await env.DB.prepare('SELECT id, name, sort FROM bangumi_categories ORDER BY sort, id').all();
  const items = await env.DB.prepare(
    `SELECT i.id, i.title, i.author, i.image, i.link, i.intro, i.episode, i.total, i.sync_url, i.status, i.category_id, i.sort,
            c.name AS category_name
     FROM bangumi_items i LEFT JOIN bangumi_categories c ON c.id = i.category_id
     ORDER BY i.sort, i.id`
  ).all();
  const res = json({ categories: cats.results || [], items: items.results || [] });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function onRequestOptions() {
  return handleOptions();
}
