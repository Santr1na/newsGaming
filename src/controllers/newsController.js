const cache = require('memory-cache');
   const RSSParser = require('rss-parser');
   const logger = require('../utils/logger');
   const News = require('../models/news'); // Исправлен путь

   const parser = new RSSParser({
     customFields: {
       item: [['media:content', 'mediaContent'], ['media:thumbnail', 'newsThumbnail'], ['dc:creator', 'creator']]
     }
   });

   const CACHE_DURATION = parseInt(process.env.CACHE_DURATION_MS) || 60000;
   const MAX_NEWS_LIMIT = parseInt(process.env.MAX_NEWS_LIMIT) || 1000;

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

         const response = { success: true, data: newsFromDB, pagination: { current: parseInt(page), total, hasMore: page * limit < total } };
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
         res.json({ success: true, data: news });
       } catch (error) {
         logger.error('Error searching news:', {
           message: error.message,
           stack: error.stack,
           query: req.query
         });
         res.status(500).json({ success: false, message: 'Failed to search news' });
       }
     };

     fetchNews = async () => {
       const feedUrls = [
         process.env.IGN_NEWS_FEED,
         process.env.IGN_REVIEWS_FEED,
         process.env.GAMESPOT_NEWS_FEED,
         process.env.GAMESPOT_REVIEWS_FEED,
         process.env.POLYGON_FEED,
         process.env.KOTAKU_FEED,
         process.env.EUROGAMER_FEED,
         process.env.PCGAMER_FEED
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
             .map(item => {
               const pubDate = new Date(item.pubDate || item.isoDate);
               const cleanedDescription = (item.contentSnippet || item.content || '')
                 .replace(/\n\s*\n/g, '\n')
                 .replace(/\n/g, ' ')
                 .trim();
               return {
                 title: item.title,
                 description: cleanedDescription,
                 link: item.link,
                 pubDate,
                 image: item.enclosure?.url ||
                   (item.mediaContent ? (Array.isArray(item.mediaContent) ? item.mediaContent[0]?.$?.url : item.mediaContent.$?.url) : null) ||
                   (item.newsThumbnail ? (Array.isArray(item.newsThumbnail) ? item.newsThumbnail[0]?.$?.url : item.newsThumbnail.$?.url) : null) ||
                   'https://via.placeholder.com/150',
                 author: item.creator || item.author || 'Unknown',
                 category: this.categorizeNews(item)
               };
             });
           newsItems.push(...items);
           logger.info(`Fetched ${items.length} items from ${url}`);
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
     };
   }

   module.exports = new NewsController();