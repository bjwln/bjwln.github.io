'use strict';

// Generates /hot-posts.json at build time with post metadata.
// The hot page merges this with runtime PV data from /api/all.
hexo.extend.generator.register('hot-posts-json', function (locals) {
  var posts = locals.posts.sort('-date').toArray().map(function (post) {
    // Normalize path to match what page-counter.js stores in D1:
    // window.location.pathname.replace(/\/$/, '') -> e.g. "/2026/07/15/my-post"
    // Normalize: strip leading slashes first so we always get a single leading "/"
    var urlPath = '/' + post.path.replace(/^\/+/, '').replace(/index\.html$/, '').replace(/\/+$/, '');

    var categories = [];
    if (post.categories && post.categories.data) {
      categories = post.categories.data.map(function (c) { return c.name; });
    }

    return {
      path: urlPath,
      title: post.title,
      date: post.date.format('YYYY-MM-DD'),
      cover: post.cover || '',
      categories: categories
    };
  });

  return {
    path: 'hot-posts.json',
    data: JSON.stringify(posts)
  };
});
