# 博客本地管理端

为 Hexo 博客定制的本地后台管理系统,直接读写 `source/` 下的文件,并整合 Cloudflare 线上的评论与浏览量数据。深色单页 UI,无构建步骤。

## 启动

```bash
npm run admin
# 打开 http://127.0.0.1:4001
```

- 管理端默认只监听本机(127.0.0.1),无密码;若在「设置」里切换为 `0.0.0.0`(局域网访问),请务必同时设置访问密码。
- 修改监听地址/端口后需重启 `npm run admin`。

## 功能模块

| 模块 | 说明 |
|---|---|
| 📊 仪表盘 | 文章/草稿/字数/标签/分类统计,线上 PV/UV/评论数,最近文章与热门页面 |
| 📝 文章 | 列表搜索筛选;frontmatter 表单化编辑 + Markdown 编辑器(分栏实时预览、工具栏、Ctrl+S);**粘贴/拖拽/上传图片**自动存入同名资源文件夹并插入引用;标题/日期修改会提示 permalink 变化(浏览量统计断档风险) |
| 📥 草稿箱 | `source/_drafts/` 标准草稿流程,一键发布到 `_posts`(md + 资源文件夹一起移动) |
| 📄 页面 | 扫描 `source/**/index.md` 自定义页面(科研/追番/热门/归档等),编辑 frontmatter 与正文;未知字段(如 `type`/`top_img: false`)原样保留 |
| 🗑 回收站 | 删除的文章进 `admin/data/trash/`(md + 图片一起),可恢复或彻底删除 |
| 🗂 数据文件 | `research.yml` 结构化编辑(项目信息/计划/进度轴/时间线,**link 断链校验** + 文章标题下拉补全);`bangumi.yml` 条目编辑(封面直传 `images/bangumi/`);`widget.yml` 源码编辑(写入前 YAML 校验) |
| 🏷 标签分类 | 汇总计数;跨文章(含草稿)批量重命名 |
| 🖼 媒体库 | 浏览 `images/` 与全部文章资源文件夹,上传/删除/复制引用路径 |
| 💬 评论管理 | 代理线上 `functions/` 的 admin API,列表 + 删除(需在设置里填 ADMIN_TOKEN) |
| 📈 流量统计 | 线上 PV/UV 排行、修正、删除 |
| 🚀 构建发布 | hexo server 本地预览启停;本地构建验证(`hexo clean && generate`);一键发布 = git add + commit(可自定义信息)+ push,CI 自动部署两端;日志实时查看 |
| ⚙️ 设置 | Cloudflare Token、监听地址、端口、访问密码、编辑器字号 |

## 使用提示

1. **Cloudflare Token**:即 Cloudflare Pages 项目环境变量 `ADMIN_TOKEN`(评论/统计接口的管理密码),在「设置」里填一次即可,保存在本机 `admin/data/settings.json`(已 gitignore)。
2. **改标题/日期 = 改 URL**:permalink 是 `:year/:month/:day/:title/`,编辑器会弹出提醒;已积累的浏览量按旧路径统计,不会自动迁移。
3. **frontmatter 格式归一化**:结构化保存用 js-yaml 序列化,内容完全等价,但引号风格、数组缩进可能与手写的略有差异(`tags: [a,b]` 会变成列表缩进格式),Hexo 渲染结果不受影响。
4. **发布即 push**:发布按钮等价于 `publish-blog.bat`(git add → commit → push),push 后 GitHub Actions 自动构建部署到 GitHub Pages 和 Cloudflare Pages。
5. **测试脚本**:`node admin/test/api-test.js` 可对全部接口做回归自测(自动创建并清理测试数据)。

## 目录结构

```
admin/
  server.js          # Express 入口,所有 REST 路由
  lib/
    util.js          # 路径安全/原子写/字数统计等
    frontmatter.js   # frontmatter 拆解与序列化(日期保持字符串)
    posts.js         # 文章/草稿 CRUD、资源文件夹、图片上传
    trash.js         # 回收站(移动而非删除)
    pages.js         # 自定义页面扫描与编辑
    datafiles.js     # research/bangumi/widget.yml 结构化读写 + 校验
    taxonomy.js      # 标签/分类聚合与批量重命名
    media.js         # 媒体库 + /asset 静态图片服务
    build.js         # hexo server/generate/git 发布进程管理与日志
    cf.js            # Cloudflare 线上接口代理
    settings.js      # 本地设置持久化
  public/            # 前端 SPA(index.html + app.js + style.css + marked)
  data/              # 运行时数据(gitignore):settings.json + trash/
  test/api-test.js   # API 回归测试
```

## 安全设计

- 所有文件路径接口做目录穿越校验(`safeJoin`),媒体删除限定在 `source/images/` 与文章资源文件夹内
- 写文件先写临时文件再原子改名,避免中途崩溃损坏文章
- 上传限图片/PDF 类型与 20MB 大小;上传文件名修复 latin1 乱码并清理非法字符
- 设置了访问密码后所有 `/api/*` 都要求 `X-Admin-Token`
