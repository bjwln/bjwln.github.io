'use strict';
const path = require('path');
const fm = require('./frontmatter');
const U = require('./util');
const datafiles = require('./datafiles');

// 科研文章:按计划(research.yml 的 plans)一键创建文章
// 约定与现有数据保持一致:
//   md   = source/_posts/research/<标题>.md(标题中的非法文件名字符会被替换为 -)
//   资源 = source/_posts/research/<标题>/ 同名文件夹,存放 md 引用的图片
//   frontmatter 自动带 research: <计划key> 与 research_order,科研页主题靠 title === timeline[].link 精确匹配
// 创建时同步把条目写入 research.yml 对应计划的 timeline;replaceTimelineIndex 用于把断链/未关联条目就地替换成新文章
// 删除走既有接口:文章本体 DELETE /api/posts/:slug(进回收站),条目由前端改 parsed 后 PUT /api/data/research

const FOLDER = 'research';

async function createArticle({ planKey, title, date, track, summary, label, tags, description, replaceTimelineIndex }) {
  title = String(title || '').trim();
  if (!title) { const e = new Error('标题不能为空'); e.status = 400; throw e; }

  const { parsed, titles } = await datafiles.getResearch();
  const plans = Array.isArray(parsed.plans) ? parsed.plans : [];
  const pi = plans.findIndex(p => p.key === planKey || p.title === planKey);
  if (pi < 0) { const e = new Error('找不到计划: ' + planKey); e.status = 404; throw e; }
  const plan = plans[pi];

  // 标题必须全局唯一,否则科研页按标题匹配会指向错误文章
  if (titles.includes(title)) {
    const e = new Error('已存在同名标题的文章「' + title + '」,科研页按标题匹配会混淆,请换一个标题');
    e.status = 409; throw e;
  }

  const timeline = plan.timeline = Array.isArray(plan.timeline) ? plan.timeline : [];
  const day = String(date || '').trim() || U.fmtDate().slice(0, 10);
  const replace = Number.isInteger(replaceTimelineIndex) && replaceTimelineIndex >= 0 && replaceTimelineIndex < timeline.length;
  const order = replace ? Number(timeline[replaceTimelineIndex].order ?? replaceTimelineIndex) : timeline.length;
  const entry = { date: day, title, track: String(track || ''), summary: String(summary || ''), link: title, label: String(label || ''), order };

  // md + 同名资源文件夹
  const dir = path.join(U.POSTS, FOLDER);
  await U.ensureDir(dir);
  let slug = U.slugify(title);
  if (slug.startsWith('.') || slug.startsWith('_')) {
    const e = new Error('标题生成的文件名以「' + slug[0] + '」开头,Hexo 会忽略这种文件(文章管理端也无法读取),请调整标题');
    e.status = 400; throw e;
  }
  if (await U.pathExists(path.join(dir, slug + '.md'))) slug = slug + '-' + Date.now().toString(36);
  const data = {
    title,
    date: /^\d{4}-\d{2}-\d{2}$/.test(day) ? day + ' 00:00:00' : U.fmtDate(),
    research: plan.key || planKey,
    research_order: order,
  };
  const desc = String(description || '').trim() || String(summary || '').trim();
  if (desc) data.description = desc;
  const tagList = Array.isArray(tags) ? tags.map(t => String(t).trim()).filter(Boolean) : [];
  if (tagList.length) data.tags = tagList;
  await U.atomicWrite(path.join(dir, slug + '.md'), fm.join(data, '\n'));
  await U.ensureDir(path.join(dir, slug)); // 同名资源文件夹

  // 写回 timeline(就地替换或追加)
  if (replace) timeline[replaceTimelineIndex] = entry;
  else timeline.push(entry);
  const saved = await datafiles.putResearch(parsed);

  return { ok: true, slug: FOLDER + '/' + slug, plan: plan.key || planKey, entry, warnings: saved.warnings };
}

module.exports = { createArticle, FOLDER };
