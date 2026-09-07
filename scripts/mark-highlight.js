// 支持 ==高亮== 语法（Typora 风格），渲染为 <mark>
hexo.extend.filter.register('before_post_render', data => {
  if (!data.content || !data.content.includes('==')) return data;

  // 跳过 Hexo 代码块占位符、fenced code block 和行内代码，避免把代码里的 == 误当高亮语法。
  data.content = data.content
    .split(/(<hexoPostRenderCodeBlock>[\s\S]*?<\/hexoPostRenderCodeBlock>|```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]+`)/g)
    .map((part, index) => (index % 2 === 0 ? part.replace(/==([^=\n]+)==/g, '<mark>$1</mark>') : part))
    .join('');
  return data;
});
