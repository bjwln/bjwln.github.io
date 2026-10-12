'use strict'

const pagination = require('hexo-pagination')

hexo.extend.generator.register('index', locals => {
  const config = hexo.config
  const posts = locals.posts.filter(post => !post.research).sort(config.index_generator.order_by)

  posts.data.sort((a, b) => (b.sticky || 0) - (a.sticky || 0))

  return pagination(config.index_generator.path || '', posts, {
    perPage: config.index_generator.per_page,
    layout: config.index_generator.layout || ['index', 'archive'],
    format: (config.pagination_dir || 'page') + '/%d/',
    data: {
      __index: true
    }
  })
})
