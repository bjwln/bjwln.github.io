import { json, initTables, initBangumiTables, handleOptions } from '../../_lib';

// GET /api/admin/export —— 导出 D1 全部业务数据(JSON 备份)
export async function onRequestGet(context) {
  const { request, env } = context;
  const token = request.headers.get('X-Admin-Token');
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) return json({ error: 'unauthorized' }, 401);
  try {
    await initTables(env);
    await initBangumiTables(env);
  } catch (e) {
    return json({ error: 'init failed: ' + e.message }, 500);
  }
  const [pages, comments, categories, items] = await Promise.all([
    env.DB.prepare('SELECT path, pv, uv FROM page_views ORDER BY path').all(),
    env.DB.prepare('SELECT id, path, parent_id, nickname, email, website, content, created_at, status FROM comments ORDER BY id').all(),
    env.DB.prepare('SELECT id, name, sort FROM bangumi_categories ORDER BY id').all(),
    env.DB.prepare('SELECT id, title, author, image, link, intro, episode, status, category_id, sort, updated_at FROM bangumi_items ORDER BY id').all(),
  ]);
  return json({
    exported_at: new Date().toISOString(),
    tables: {
      page_views: pages.results || [],
      comments: comments.results || [],
      bangumi_categories: categories.results || [],
      bangumi_items: items.results || [],
    },
  });
}

export async function onRequestOptions() {
  return handleOptions();
}
