'use strict';

const path = require('path');

// Converts Typora-friendly relative image paths back to Hexo asset URLs.
// Markdown uses "post-folder/file.png" for post assets and "../images/file.png"
// for files under source/images; Hexo itself only resolves bare filenames.
hexo.extend.filter.register('marked:renderer', function (renderer) {
  const image = renderer.image;
  renderer.image = function (args) {
    const { href } = args || {};
    const { postPath } = (this.options || {});
    if (href && postPath && !/^(#|\/\/|https?:|data:)/.test(href)) {
      const slug = path.basename(postPath.replace(/[\\/]+$/, ''));
      if (href.startsWith(slug + '/')) {
        args.href = href.slice(slug.length + 1);
      } else if (href.startsWith('../images/')) {
        args.href = href.slice(3);
      }
    }
    return image.call(this, args);
  };
  return renderer;
});
