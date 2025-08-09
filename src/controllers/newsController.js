const cache = require('memory-cache');
const RSSParser = require('rss-parser');
const logger = require('../utils/logger');
const News = require('../models/news');
const axios = require('axios');

const parser = new RSSParser({
  customFields: {
    item: [['media:content', 'mediaContent'], ['media:thumbnail', 'newsThumbnail'], ['dc:creator', 'creator']]
  }
});

const CACHE_DURATION = parseInt(process.env.CACHE_DURATION_MS) || 60000;
const MAX_NEWS_LIMIT = parseInt(process.env.MAX_NEWS_LIMIT) || 1000;
const yandexUrl = 'https://translate.api.cloud.yandex.net/translate/v2/translate';
const yandexApiKey = process.env.YANDEX_API_KEY || 'AQVNxDoD3ieMR_Fa-Jc-FWEZyo4YzCx-7bRZzDk_';
const folderId = 'b1gao45322bkr63676l8';
const cacheNode = new (require('node-cache'))({ stdTTL: 86400 }); // Кэш для переводов

// Функция для перевода текста через Yandex
async function translateText(text, targetLang) {
  if (!text || text === '') return text;
  const cacheKey = `${text}:${targetLang}`;
  const cachedTranslation = cacheNode.get(cacheKey);
  if (cachedTranslation) {
    logger.info(`Кэшированный перевод для ${text} (${targetLang}): ${cachedTranslation}`);
    return cachedTranslation;
  }
  try {
    logger.info(`Перевод текста: ${text} на ${targetLang}`);
    const response = await axios.post(yandexUrl, {
      folderId: folderId,
      texts: [text],
      sourceLanguageCode: 'en',
      targetLanguageCode: targetLang
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Api-Key ${yandexApiKey}`
      }
    });
    const translatedText = response.data.translations[0].text;
    cacheNode.set(cacheKey, translatedText);
    logger.info(`Переведено: ${text} -> ${translatedText}`);
    return translatedText;
  } catch (error) {
    logger.error(`Ошибка перевода для ${text}: ${error.message}, Код: ${error.response?.status}`);
    return text;
  }
}

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

  async fetchNews() {
    const feedUrls = [
      process.env.IGN_NEWS_FEED,
      process.env.IGN_REVIEWS_FEED,
      process.env.GAMESPOT_NEWS_FEED,
      process.env.GAMESPOT_REVIEWS_FEED,
      process.env.POLYGON_FEED,
      process.env.EUROGAMER_FEED,
      process.env.PCGAMER_FEED,
      process.env.GAMERANT_FEED,
      process.env.THEGAMER_FEED,
      process.env.VGC_NEWS_FEED,
      process.env.DESTRUCTOID_FEED
    ].filter(url => url);
    logger.info('Fetching RSS feeds:', { feedUrls });

    const newsItems = [];
    for (const url of feedUrls) {
      try {
        logger.info(`Parsing RSS feed: ${url}`);
        const feed = await parser.parseURL(url);
        if (!feed?.items?.length) {
          logger.warn(`Empty feed: ${url}`);
          continue;
        }
        const items = feed.items
          .filter(item => item.title && item.link && (item.pubDate || item.isoDate))
          .map(async (item) => {
            const pubDate = new Date(item.pubDate || item.isoDate);
            const cleanedDescription = (item.contentSnippet || item.content || '')
              .replace(/\n\s*\n/g, '\n')
              .replace(/\n/g, ' ')
              .trim();
            const image = item.enclosure?.url ||
              (item.mediaContent ? (Array.isArray(item.mediaContent) ? item.mediaContent[0]?.$?.url : item.mediaContent.$?.url) : null) ||
              (item.newsThumbnail ? (Array.isArray(item.newsThumbnail) ? item.newsThumbnail[0]?.$?.url : item.newsThumbnail.$?.url) : null) ||
              'https://via.placeholder.com/150';
            const category = this.categorizeNews(item);
            // Перевод на русский и английский
            const translatedRu = {
              title: await translateText(item.title, 'ru'),
              description: await translateText(cleanedDescription, 'ru'),
              category: await translateText(category, 'ru')
            };
            const translatedEn = {
              title: item.title,
              description: cleanedDescription,
              category: category
            };
            return {
              title: item.title,
              description: cleanedDescription,
              link: item.link,
              pubDate,
              image: await enhanceImage(image),
              author: item.creator || item.author || 'Unknown',
              category: category,
              translated: {
                ru: translatedRu,
                en: translatedEn
              }
            };
          });
        const resolvedItems = await Promise.all(items);
        newsItems.push(...resolvedItems);
        logger.info(`Fetched ${resolvedItems.length} items from ${url}`);
      } catch (error) {
        logger.warn(`RSS feed error (${url}): ${error.message}`);
      }
    }
    logger.info(`Total RSS items fetched: ${newsItems.length}`);
    const currentCount = await News.countDocuments();
    logger.info(`Current news count in DB: ${currentCount}`);
    for (const item of newsItems) {
      try {
        if (currentCount >= MAX_NEWS_LIMIT) {
          const oldestNews = await News.findOne().sort({ pubDate: 1 }).exec();
          if (oldestNews) {
            await News.deleteOne({ _id: oldestNews._id });
            logger.info(`Deleted oldest news item: ${oldestNews.link}`);
          }
        }
        const existingNews = await News.findOne({ link: item.link }).exec();
        if (!existingNews) {
          await News.create(item);
          logger.info(`Added new item: ${item.link}`);
        } else {
          await News.updateOne({ link: item.link }, { $set: item });
          logger.info(`Updated existing item: ${item.link}`);
        }
      } catch (error) {
        logger.error(`Failed to process item (${item.link}): ${error.message}`);
      }
    }
    logger.info(`Processed ${newsItems.length} news items, current DB count: ${await News.countDocuments()}`);
    cache.clear();
    return newsItems;
  }

  async getLatestNews(req, res) {
    try {
      const { page = 1, limit = 10, category, from, to, lang = 'en' } = req.query;
      const query = {};
      if (category) query.category = category;
      if (from && to) {
        query.pubDate = { $gte: new Date(from), $lte: new Date(to) };
      } else if (from) {
        query.pubDate = { $gte: new Date(from) };
      } else if (to) {
        query.pubDate = { $lte: new Date(to) };
      }
      logger.info('Query params:', { page, limit, category, from, to, lang });
      const cacheKey = `news_${page}_${limit}_${category || 'all'}_${from || 'no-from'}_${to || 'no-to'}_${lang}`;
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
      const response = {
        success: true,
        data: newsFromDB.map(item => ({
          title: item.translated?.[lang]?.title || item.title,
          description: item.translated?.[lang]?.description || item.description,
          link: item.link,
          pubDate: item.pubDate,
          image: item.image,
          author: item.author,
          category: item.translated?.[lang]?.category || item.category
        })),
        pagination: { current: parseInt(page), total, hasMore: page * limit < total }
      };
      cache.put(cacheKey, response, CACHE_DURATION);
      logger.info(`DB hit: ${newsFromDB.length} items`);
      return res.json(response);
    } catch (error) {
      logger.error('News fetch error:', {
        message: error.message,
        stack: error.stack,
        query: req.query
      });
      res.status(500).json({ success: false, message: 'Failed to fetch news' });
    }
  }

  async searchNews(req, res) {
    try {
      const { q, lang = 'en' } = req.query;
      const query = {
        $or: [
          { title: { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } },
          { 'translated.ru.title': { $regex: q, $options: 'i' } },
          { 'translated.ru.description': { $regex: q, $options: 'i' } }
        ]
      };
      const news = await News.find(query).exec();
      res.json({
        success: true,
        data: news.map(item => ({
          title: item.translated?.[lang]?.title || item.title,
          description: item.translated?.[lang]?.description || item.description,
          link: item.link,
          pubDate: item.pubDate,
          image: item.image,
          author: item.author,
          category: item.translated?.[lang]?.category || item.category
        }))
      });
    } catch (error) {
      logger.error('Error searching news:', {
        message: error.message,
        stack: error.stack,
        query: req.query
      });
      res.status(500).json({ success: false, message: 'Failed to search news' });
    }
  }
}

// Функция для локального улучшения изображений с Sharp
async function enhanceImage(imageUrl) {
  if (!imageUrl || imageUrl === '') return imageUrl;
  const cachedUrl = cacheNode.get(imageUrl);
  if (cachedUrl) {
    logger.info(`Кэшированное изображение для ${imageUrl}: ${cachedUrl}`);
    return cachedUrl;
  }
  try {
    logger.info(`Улучшение изображения: ${imageUrl}`);
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(imageResponse.data);
    const outputDir = path.join(__dirname, '../images');
    await fs.mkdir(outputDir, { recursive: true });
    const outputFilename = `enhanced_${path.basename(imageUrl)}`;
    const outputPath = path.join(outputDir, outputFilename);
    await sharp(imageBuffer)
      .resize({ width: 1000, height: 1500, fit: 'contain', kernel: 'lanczos3', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .sharpen({ sigma: 2.5 })
      .gamma(2.0)
      .toFormat('jpeg', { quality: 95 })
      .toFile(outputPath);
    const enhancedUrl = `/images/${outputFilename}`;
    cacheNode.set(imageUrl, enhancedUrl);
    logger.info(`Улучшенное изображение сохранено: ${enhancedUrl}`);
    return enhancedUrl;
  } catch (error) {
    logger.error(`Ошибка улучшения изображения: ${error.message}`);
    return imageUrl;
  }
}

module.exports = new NewsController();
