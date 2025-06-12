const cache = require('memory-cache');
const RSSParser = require('rss-parser');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/errors');
const News = require('../models/news');

const parser = new RSSParser({
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['dc:creator', 'creator']
    ]
  }
});
const CACHE_DURATION = parseInt(process.env.CACHE_DURATION_MS) || 300000; // 5 минут

class NewsController {
  // Функция для категоризации новостей
  categorizeNews(item) {
    const titleLower = item.title.toLowerCase();
    if (titleLower.includes('rumor') || titleLower.includes('слух')) return 'rumors';
    if (titleLower.includes('announc') || titleLower.includes('анонс')) return 'soon';
    if (titleLower.includes('poll') || titleLower.includes('опрос')) return 'polls';
    if (titleLower.includes('recommend') || titleLower.includes('рекоменд')) return 'recommendations';
    return 'update'; // Категория по умолчанию
  }

  getLatestNews = async (req, res, next) => {
    try {
      const { page = 1, limit = 10, category, from, to } = req.query;

      // Формируем запрос для базы данных
      const query = {};
      if (category) query.category = category;
      if (from && to) {
        query.pubDate = { $gte: new Date(from), $lte: new Date(to) };
      } else if (from) {
        query.pubDate = { $gte: new Date(from) };
      } else if (to) {
        query.pubDate = { $lte: new Date(to) };
      }

      // Проверяем кэш
      const cacheKey = `news_${page}_${limit}_${category || 'all'}_${from || 'no-from'}_${to || 'no-to'}`;
      const cachedNews = cache.get(cacheKey);
      if (cachedNews) {
        return res.json(cachedNews);
      }

      // Проверяем базу данных
      const newsFromDB = await News.find(query)
        .sort({ pubDate: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .exec();
      const total = await News.countDocuments(query);

      // Если в базе данных достаточно новостей, возвращаем их
      if (newsFromDB.length >= limit || (page - 1) * limit + newsFromDB.length >= total) {
        const response = {
          success: true,
          data: newsFromDB,
          pagination: {
            current: parseInt(page),
            total,
            hasMore: page * limit < total
          }
        };
        cache.put(cacheKey, response, CACHE_DURATION);
        return res.json(response);
      }

      // Если данных недостаточно, обновляем из RSS
      const feed = await parser.parseURL(process.env.IGN_NEWS_FEED_URL);
      const newsItems = feed.items.map(item => ({
        title: item.title,
        description: item.contentSnippet,
        link: item.link,
        pubDate: new Date(item.pubDate),
        image:
          item.enclosure?.url ||
          (item.mediaContent ? (Array.isArray(item.mediaContent) ? item.mediaContent[0]?.$?.url : item.mediaContent.$?.url) : null) ||
          (item.mediaThumbnail ? (Array.isArray(item.mediaThumbnail) ? item.mediaThumbnail[0]?.$?.url : item.mediaThumbnail.$?.url) : null) ||
          'https://via.placeholder.com/150',
        author: item.creator || item.author || 'IGN',
        category: this.categorizeNews(item)
      }));

      // Сохраняем новости в базу данных
      for (const item of newsItems) {
        await News.updateOne(
          { link: item.link }, // Уникальный ключ для избежания дубликатов
          { $set: item },
          { upsert: true }
        );
      }

      // Повторный запрос из базы данных
      const updatedNews = await News.find(query)
        .sort({ pubDate: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .exec();
      const updatedTotal = await News.countDocuments(query);

      const response = {
        success: true,
        data: updatedNews,
        pagination: {
          current: parseInt(page),
          total: updatedTotal,
          hasMore: page * limit < updatedTotal
        }
      };
      cache.put(cacheKey, response, CACHE_DURATION);
      res.json(response);
    } catch (error) {
      logger.error('Ошибка получения новостей:', error);
      next(new ApiError('Не удалось получить новости', 500));
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
      logger.error('Ошибка поиска новостей:', error);
      next(new ApiError('Не удалось выполнить поиск новостей', 500));
    }
  };

  async fetchNews() {
    const feed = await parser.parseURL(process.env.IGN_NEWS_FEED_URL);
    const news = feed.items.map(item => ({
      title: item.title,
      description: item.contentSnippet,
      link: item.link,
      pubDate: new Date(item.pubDate),
      image:
        item.enclosure?.url ||
        (item.mediaContent ? (Array.isArray(item.mediaContent) ? item.mediaContent[0]?.$?.url : item.mediaContent.$?.url) : null) ||
        (item.mediaThumbnail ? (Array.isArray(item.mediaThumbnail) ? item.mediaThumbnail[0]?.$?.url : item.mediaThumbnail.$?.url) : null) ||
        'https://via.placeholder.com/150',
      author: item.creator || item.author || 'IGN',
      category: this.categorizeNews(item)
    }));

    // Сохраняем новости в базу данных
    for (const item of news) {
      await News.updateOne(
        { link: item.link },
        { $set: item },
        { upsert: true }
      );
    }
    return news;
  }
}

module.exports = new NewsController();