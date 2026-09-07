// 解码 search.json 中的 HTML 数字实体，避免本地搜索摘要被截断成 "#x3D;" 之类的乱码。
// 注意：hexo-generator-searchdb 的生成器直接返回 JSON 字符串、不经过 hexo.render，
// after_render:json 过滤器不会触发；因此在这里重新注册一个同名路由的生成器，
// 包装调用其原始生成器并在输出层解码（本地 scripts 晚于插件加载，路由注册后者覆盖前者）。
// 只解码数字实体和 &lt;/&gt;，不解码 &quot;/&amp;，避免破坏 JSON 结构。
let searchdbJson;
try {
  searchdbJson = require('hexo-generator-searchdb/lib/json_generator');
} catch (e) {
  // searchdb 未安装时跳过
}

if (searchdbJson) {
  hexo.extend.generator.register('search-json-decoded', function (locals) {
    const result = searchdbJson.call(this, locals);
    if (result && typeof result.data === 'string' && result.data.includes('&#')) {
      result.data = result.data
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
    }
    return result;
  });
}
