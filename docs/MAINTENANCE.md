# 博客维护手册

> 最后更新:2026-10-31。本手册面向"半年后忘记细节的自己",所有内容以当前源码为准。
> 配套报告:桌面 `博客报告/` 文件夹下的整站体检与性能审计报告。

---

## 1. 项目概览

| 项 | 内容 |
| --- | --- |
| 框架 | Hexo 8.1.2 + Butterfly 主题(5.5.6,深度定制,直接改主题源码) |
| 仓库 | github.com/bjwln/bjwln.github.io(本地 `G:\hexo\my-blog`) |
| 线上 | GitHub Pages + Cloudflare Pages(`tysweb.pages.dev`,配置里的 site url) |
| 内容 | 26 篇文章,3 个分类(Cooking / 大模型 / 算法题),13 个标签 |
| 评论/浏览量 | 自建 Cloudflare Pages Functions + D1 数据库(非第三方服务) |

**部署链路**:`publish-blog.bat`(git add → commit "update" → push)→ GitHub Actions(`.github/workflows/deploy.yml`,Node 22 构建)→ GitHub Pages;同时 Cloudflare Pages 拉取仓库自动构建,域名 `tysweb.pages.dev`。

## 2. 目录结构地图

```
G:\hexo\my-blog
├── _config.yml                  # Hexo 主配置(站点信息、permalink、feed/sitemap)
├── _config.butterfly.yml        # 主题配置(菜单、inject 注入、aside、theme_color 等)
├── publish-blog.bat             # 一键发布(git add/commit/push,触发线上部署)
├── scripts/                     # Hexo 自定义脚本(构建期运行)
│   ├── research-index.js        #   首页索引生成器:把 research 文章从首页排除
│   ├── hot-posts.js             #   生成 /hot-posts.json(文章标题/日期/封面/分类/摘要)
│   ├── fix-post-images.js       #   marked 渲染器钩子:Typora 相对图片路径 → Hexo 资源路径
│   ├── mark-highlight.js        #   ==高亮== 语法 → <mark>(Typora 风格)
│   └── search-entity-decode.js  #   修复本地搜索 search.json 的数字实体乱码
├── source/
│   ├── _posts/                  # 文章(每篇一个同名资源文件夹,post_asset_folder: true)
│   ├── _data/                   # research.yml(科研时间线)、bangumi.yml(追番)等数据
│   ├── hot/  bangumi/  research/  timeline 相关页面
│   ├── css/                     # 全站自定义样式(custom.css、starfield.css、pop.css、timeline.css…)
│   └── js/                      # 全站自定义脚本(hot.js、pop-reveal.js、page-counter.js…)
├── themes/butterfly/
│   ├── layout/
│   │   ├── page.pug             # 自定义页面类型路由(research/bangumi/hot…)
│   │   ├── category.pug         # 分类页 → 波浪时间线(已改)
│   │   └── includes/
│   │       ├── page/research.pug / bangumi.pug
│   │       ├── timeline/category-timeline.pug   # 分类时间线模板
│   │       └── layout.pug       # 全局骨架(body class、inject 点)
│   └── source/css/              # 主题 stylus(注意:_page/bangumi.styl 有 unquire 修复,见"坑")
├── functions/                   # Cloudflare Pages Functions(线上 API,非 Hexo 一部分)
│   ├── _lib.js                  #   共享工具(json/CORS/D1 绑定)
│   └── api/                     #   comment(s)、pv、visit、all、admin/*、bangumi*
├── count-worker/                # 独立 Cloudflare Worker(D1 浏览量,旧方案备份)
└── docs/                        # 本手册
```

## 3. 发布流程(标准操作)

1. 本地预览确认:`npx hexo server -p 4399` → http://localhost:4399/
2. 双击 `publish-blog.bat`(或手动 git add/commit/push)
3. GitHub Actions 自动构建发布到 GitHub Pages;Cloudflare Pages 同步部署
4. **铁律:`hexo server` 运行期间绝不执行 `hexo generate` / `hexo clean`**(两边争抢 db.json 会造成 pug/css 编译损坏,表现为"页面无样式"或诡异编译错误)。先停服务器再构建。

清理重建(样式/模板改动后保险起见):

```
npx hexo clean && npx hexo generate && npx hexo server -p 4399
```

## 4. 自定义功能清单

### 4.1 分类页波浪时间线
- **入口**:导航 → 分类 → 任一分类(如「大模型」)
- **文件**:`themes/butterfly/layout/category.pug` → `themes/butterfly/layout/includes/timeline/category-timeline.pug`(模板+布局计算)、`source/css/timeline.css`(样式)、`source/js/timeline.js`(拖拽+浏览量)
- **调整**:pug 顶部常量 `CARD_W / CARD_H / GAP_X / LANE_H / AMP` 控制卡片尺寸、横向间距、泳道高度、波浪幅度;改完 `?v=` 版本号要递增(模板里 CSS/JS 引用带版本参数防缓存)
- 数据源:该分类下全部文章(`_config.yml` 里 `category_generator.per_page: 0` 取消了分页)
- 已修 bug:封面相对路径必须 `url_for()` 包裹;拖拽不能用 `setPointerCapture`(会吞掉卡片点击,move/up 挂 window)

### 4.2 首页/追番页/热门页弹出动效(视口触发)
- **文件**:`source/css/pop.css`(关键帧 + 初始隐藏态)、`source/js/pop-reveal.js`(IntersectionObserver 触发 + 快速滚动兜底 + MutationObserver 兼容热门页动态渲染)
- **机制**:卡片带 `.pop-wait`(opacity 0),滚动到即将进入视野(rootMargin 底部 -6%)时换成 `.pop-play` 播放 `pop-spring` 动画;同批进入的错开 110ms(单批上限 550ms)
- **调整**:`pop.css` 里改 `pop-spring` 关键帧/时长;`pop-reveal.js` 里改 rootMargin、批次间隔(110ms);范围由 SELECTOR 常量控制
- 系统开「减少动态效果」时自动全部直接显示;热门页卡片是 JS 渲染的,CSS 默认 opacity 0 属正常

### 4.3 热门页卡片墙(/hot/)
- **文件**:`scripts/hot-posts.js`(构建期生成 `/hot-posts.json`:标题/日期/封面/分类/摘要)、`source/hot/index.md`(样式+骨架)、`source/js/hot.js`(拉 JSON + `/api/all` 合并浏览量、搜索、分类筛选、前 3 名「热门 No.x」角标)
- 摘要截断长度 88 字符在 `hot-posts.js`;筛选/搜索重新渲染时卡片会重播弹出动画

### 4.4 科研页(/research/)
- **文件**:`themes/butterfly/layout/includes/page/research.pug`(服务端算时间线布局)、`source/js/research-timeline.js`、`source/_data/research.yml`(数据:plans/timeline)
- `scripts/research-index.js`:带 `research: true` 的文章不出现在首页索引

### 4.5 评论与浏览量(Cloudflare)
- **代码**:`functions/api/` — `comment.js`/`comments.js`(评论)、`pv.js`/`visit.js`/`all.js`(浏览量,路径键为 `window.location.pathname` 去尾斜杠)、`admin/*`(管理接口,带 X-Admin-Token 鉴权)
- **存储**:D1 数据库 `number_of_visitors`(见 `count-worker/wrangler.toml`);`count-worker/` 是旧方案备份,现役为 Pages Functions
- 前端 `source/js/page-counter.js` 负责上报与展示

### 4.6 星空背景
- **文件**:`source/css/starfield.css` + `source/js/starfield.js`(canvas 星图;暗色模式星空,日间为蓝天渐变+云)
- 隐藏/替换背景时注意 `#web_bg` 与 `#starfield-canvas` 两个层

### 4.7 Typora 兼容脚本(scripts/)
- `fix-post-images.js`:Typora 粘贴的相对图片路径自动转换为 Hexo 资源路径
- `mark-highlight.js`:`==文字==` → 高亮
- `search-entity-decode.js`:修复本地搜索摘要的数字实体乱码

## 5. 已知坑(真实踩过,勿重蹈)

1. **并发构建损坏**:`hexo server` 与 `hexo generate/clean` 同时运行会争抢 `db.json`,产生 pug "with expression" 编译错误或 index.css 输出为空。表现:页面整页无样式。先停一个再跑另一个。
2. **stylus 不认识原生 CSS 函数**:`_page/bangumi.styl` 曾用 `color-mix(in srgb, …)` 导致整个 index.css 编译失败(0 字节)。原生函数一律用 `unquote('…')` 包裹。
3. **封面相对路径**:front-matter 里 `cover: cover.jpg` 这类相对路径,在二级路径页面(如 /timeline/)会解析错位。模板中一律 `url_for(cover)`;正文手写链接同理。
4. **setPointerCapture 吞点击**:可拖拽容器上用它会改变 click 目标导致内部链接失效,标准做法是 pointerdown 在容器、move/up 挂 window。
5. **IntersectionObserver 在后台标签页不触发**:页面不可见时卡片保持隐藏是正常现象,切回前台即恢复。
6. **HTML 实体残留**:从正文提取摘要时记得解码 `&#x2F;` `&amp;` 等(见 `hot-posts.js` 的实体解码段)。
7. **inject 注入的 CSS 用 `media="defer" onload` 异步加载**,排查"样式没生效"时先确认这一点再怀疑别的。

## 6. 常用操作指南

- **写新文章**:`hexo new post "标题"` → 编辑 `source/_posts/标题/index.md`?不,默认生成 `标题.md`,图片放同名资源文件夹;建议 front-matter 补全 description/categories/tags(整站体检发现 26 篇全缺 description)
- **加分类/标签**:直接在文章 front-matter 写;注意 `/tags/` 与 `/categories/` 两个索引页当前不存在(历史删除),文章页里的这两个链接是死的——要么重建 `source/tags/index.md`(type: tags)与 `source/categories/index.md`(type: categories),要么接受现状(见体检报告)
- **改时间线节奏**:见 4.1;改弹出动效:见 4.2
- **排查"页面无样式"**:`curl -s http://localhost:4399/css/index.css?v=5.5.6 | wc -c`,为 0 即编译失败,看服务器日志里的 ParseError;同时检查是否双进程并发
- **看构建产物**:`public/`;**分析体积**:见桌面《性能与资源审计报告》

## 7. 工具与报告位置

- 桌面 `博客报告/`:整站体检报告、性能审计报告(按日期命名)
- 报告脚本(临时):`%TEMP%\hexo-audit\`,可随时删除
