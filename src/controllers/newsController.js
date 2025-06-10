const cache = require('memory-cache');
const RSSParser = require('rss-parser');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/errors');

// Configure RSSParser to pick up media fields
const parser = new RSSParser({
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['dc:creator', 'creator'] // Поддержка dc:creator
    ]
  }
});
const CACHE_DURATION = parseInt(process.env.CACHE_DURATION_MS) || 300000; // 5 minutes

class NewsController {
  getLatestNews = async (req, res, next) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const cachedNews = cache.get('latest_news');
      if (cachedNews) {
        return this.paginateResults(res, cachedNews, page, limit);
      }
      const feed = await parser.parseURL(process.env.IGN_NEWS_FEED_URL);
      const news = feed.items.map(item => ({
        title: item.title,
        description: item.contentSnippet,
        link: item.link,
        pubDate: item.pubDate,
        image:
          item.enclosure?.url ||
          (item.mediaContent ? (Array.isArray(item.mediaContent) ? item.mediaContent[0]?.$?.url : item.mediaContent.$?.url) : null) ||
          (item.mediaThumbnail ? (Array.isArray(item.mediaThumbnail) ? item.mediaThumbnail[0]?.$?.url : item.mediaThumbnail.$?.url) : null) ||
          'https://via.placeholder.com/150',
        author: item.creator || item.author || 'IGN' // Добавляем author, используем dc:creator, author или "IGN" по умолчанию
      }));
      console.log(news);
      cache.put('latest_news', news, CACHE_DURATION);
      this.paginateResults(res, news, page, limit);
    } catch (error) {
      logger.error('Error fetching latest news:', error);
      next(new ApiError('Failed to fetch latest news', 500));
    }
  };

  paginateResults(res, data, page, limit) {
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const results = data.slice(startIndex, endIndex);
    res.json({
      success: true,
      data: results,
      pagination: {
        current: page,
        total: Math.ceil(data.length / limit),
        hasMore: endIndex < data.length
      }
    });
  }

  searchNews = async (req, res, next) => {
    try {
      const { q } = req.query;
      const cachedNews = cache.get('latest_news');
      const news = cachedNews || await this.fetchNews();
      const searchResults = news.filter(item =>
        item.title.toLowerCase().includes(q.toLowerCase()) ||
        item.description.toLowerCase().includes(q.toLowerCase())
      );
      res.json({
        success: true,
        data: searchResults
      });
    } catch (error) {
      logger.error('Error searching news:', error);
      next(new ApiError('Failed to search news', 500));
    }
  };

  async fetchNews() {
    const feed = await parser.parseURL(process.env.IGN_NEWS_FEED_URL);
    const news = feed.items.map(item => ({
      title: item.title,
      description: item.contentSnippet,
      link: item.link,
      pubDate: item.pubDate,
      image:
        item.enclosure?.url ||
        (item.mediaContent && Array.isArray(item.mediaContent) && item.mediaContent[0]?.$?.url) ||
        (item.mediaThumbnail && Array.isArray(item.mediaThumbnail) && item.mediaThumbnail[0]?.$?.url) ||
        'https://via.placeholder.com/150',
      author: item.creator || item.author || 'IGN' // Добавляем author
    }));
    cache.put('latest_news', news, CACHE_DURATION);
    return news;
  }
}

module.exports = new NewsController();
