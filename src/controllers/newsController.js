const cache = require('memory-cache');
const RSSParser = require('rss-parser');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/errors');
const News = require('../models/news');

const parser = new RSSParser({
  customFields: {
    item: [['media:content', 'mediaContent'], ['media:thumbnail', 'mediaThumbnail'], ['dc:creator', 'creator']]
  }
});
const CACHE_DURATION = parseInt(process.env.CACHE_DURATION_MS) || 300000;

class NewsController {
  categorizeNews(item) {
    const titleLower = (item.title || '').toLowerCase();
    const contentLower = (item.contentSnippet || '').toLowerCase();
    if (titleLower.includes('rumor') || titleLower.includes('слух') || contentLower.includes('rumor')) return 'rumors';
    if (titleLower.includes('announc') || titleLower.includes('анонс') || contentLower.includes('announc')) return 'soon';
    if (titleLower.includes('poll') || titleLower.includes('опрос') || contentLower.includes('poll')) return 'polls';
    if (titleLower.includes('recommend') || titleLower.includes('рекоменд') || contentLower.includes('recommend')) return 'recommendations';
    return 'update';
  }

  getLatestNews = async (req, res, next) => {
    try {
      const { page = 1, limit = 10, category, from, to } = req.query;
      const query = {};
      if (category) query.category = category;
      if (from && to) {
        query.pubDate = { $gte: new Date(from), $lte: new Date(to) };
      } else if (from) {
        query.pubDate = { $gte: new Date(from) };
      } else if (to) {
        query.pubDate = { $lte: new Date(to) };
      }

      logger.info('Query params:', { page, limit, category, from, to });

      const cacheKey = `news_${page}_${limit}_${category || 'all'}_${from || 'no-from'}_${to || 'no-to'}`;
      const cachedNews = cache.get(cacheKey);
      if (cachedNews) {
        logger.info(`Cache hit: ${cacheKey}`);
        return res.json(cachedNews);
      }

      const newsFromDB = await News.find(query)
        .sort({ pubDate: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .exec();
      const total = await News.countDocuments(query);

      logger.info('DB query result:', { count: newsFromDB.length, total });

      if (newsFromDB.length >= limit || (page - 1) * limit + newsFromDB.length >= total) {
        const response = { success: true, data: newsFromDB, pagination: { current: parseInt(page), total, hasMore: page * limit < total } };
        cache.put(cacheKey, response, CACHE_DURATION);
        logger.info(`DB hit: ${newsFromDB.length} items`);
        return res.json(response);
      }

      const feedUrls = [
        process.env.IGN_NEWS_FEED_URL,
        process.env.IGN_REVIEWS_FEED_URL,
        process.env.GAMESPOT_NEWS_FEED_URL,
        process.env.GAMESPOT_REVIEWS_FEED_URL,
        process.env.POLYGON_FEED_URL,
        process.env.KOTAKU_FEED_URL,
        process.env.EUROGAMER_FEED_URL,
        process.env.PCGAMER_FEED_URL
      ].filter(url => url);

      logger.info('Fetching RSS feeds:', { feedUrls });

      const newsItems = [];
      for (const url of feedUrls) {
        try {
          const feed = await parser.parseURL(url);
          if (!feed?.items?.length) {
            logger.warn(`Empty feed: ${url}`);
            continue;
          }
          const items = feed.items
            .filter(item => item.title && item.link && (item.pubDate || item.isoDate))
            .map(item => ({
              title: item.title,
              description: item.contentSnippet || item.content || '',
              link: item.link,
              pubDate: new Date(item.pubDate || item.isoDate),
              image: item.enclosure?.url ||
                (item.mediaContent ? (Array.isArray(item.mediaContent) ? item.mediaContent[0]?.$?.url : item.mediaContent.$?.url) : null) ||
                (item.mediaThumbnail ? (Array.isArray(item.mediaThumbnail) ? item.mediaThumbnail[0]?.$?.url : item.mediaThumbnail.$?.url) : null) ||
                'https://via.placeholder.com/150',
              author: item.creator || item.author || 'Unknown',
              category: this.categorizeNews(item)
            }));
          newsItems.push(...items);
          logger.info(`Fetched ${items.length} items from ${url}`);
        } catch (error) {
          logger.warn(`RSS feed error (${url}): ${error.message}`);
        }
      }

      logger.info(`Total RSS items fetched: ${newsItems.length}`);

      for (const item of newsItems) {
        try {
          await News.updateOne({ link: item.link }, { $set: item }, { upsert: true });
          logger.info(`Saved item: ${item.link}`);
        } catch (error) {
          logger.error(`Failed to save item (${item.link}): ${error.message}`);
        }
      }

      const updatedNews = await News.find(query)
        .sort({ pubDate: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .exec();
      const updatedTotal = await News.countDocuments(query);

      logger.info('Updated DB query result:', { count: updatedNews.length, updatedTotal });

      const response = { success: true, data: updatedNews, pagination: { current: parseInt(page), total: updatedTotal, hasMore: page * limit < updatedTotal } };
      cache.put(cacheKey, response, CACHE_DURATION);
      logger.info(`RSS + DB: ${updatedNews.length} items`);
      res.json(response);
    } catch (error) {
      logger.error('News fetch error:', {
        message: error.message,
        stack: error.stack,
        query: req.query,
        timestamp: new Date().toISOString()
      });
      next(new ApiError('Не удалось получить новости', 500));
    }
  };

  searchNews = async (req, res, next) => {
    try {
      const { q } = req.query;
      const query = {
        $or: [
          { title: { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } }
        ]
      };
      const news = await News.find(query).exec();
      res.json({
        success: true,
        data: news
      });
    } catch (error) {
      logger.error('Error searching news:', {
        message: error.message,
        stack: error.stack,
        query: req.query
      });
      next(new ApiError('Не удалось выполнить поиск новостей', 500));
    }
  };

  async fetchNews() {
    const feedUrls = [
      process.env.IGN_NEWS_FEED_URL,
      process.env.IGN_REVIEWS_FEED_URL,
      process.env.GAMESPOT_NEWS_FEED_URL,
      process.env.GAMESPOT_REVIEWS_FEED_URL,
      process.env.POLYGON_FEED_URL,
      process.env.KOTAKU_FEED_URL,
      process.env.EUROGAMER_FEED_URL,
      process.env.PCGAMER_FEED_URL
    ].filter(url => url);

    logger.info('Fetching RSS feeds:', { feedUrls });

    const newsItems = [];
    for (const url of feedUrls) {
      try {
        const feed = await parser.parseURL(url);
        if (!feed?.items) {
          logger.warn(`Empty feed: ${url}`);
          continue;
        }
        const items = feed.items
          .filter(item => item.title && item.link && (item.pubDate || item.isoDate))
          .map(item => ({
            title: item.title,
            description: item.contentSnippet || item.content || '',
            link: item.link,
            pubDate: new Date(item.pubDate || item.isoDate),
            image: item.enclosure?.url ||
              (item.mediaContent ? (Array.isArray(item.mediaContent) ? item.mediaContent[0]?.$?.url : item.mediaContent.$?.url) : null) ||
              (item.mediaThumbnail ? (Array.isArray(item.mediaThumbnail) ? item.mediaThumbnail[0]?.$?.url : item.mediaThumbnail.$?.url) : null) ||
              'https://via.placeholder.com/150',
            author: item.creator || item.author || 'Unknown',
            category: this.categorizeNews(item)
          }));
        newsItems.push(...items);
        logger.info(`Fetched ${items.length} items from ${url}`);
      } catch (error) {
        logger.warn(`Failed to parse RSS feed ${url}: ${error.message}`);
      }
    }

    logger.info(`Total RSS items fetched: ${newsItems.length}`);

    for (const item of newsItems) {
      try {
        await News.updateOne(
          { link: item.link },
          { $set: item },
          { upsert: true }
        );
        logger.info(`Saved item: ${item.link}`);
      } catch (error) {
        logger.error(`Failed to save news item ${item.link}: ${error.message}`);
      }
    }
    logger.info(`Saved ${newsItems.length} news items`);
    return newsItems;
  }
}

module.exports = new NewsController();