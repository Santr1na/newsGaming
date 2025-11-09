const cache = require('memory-cache');
const RSSParser = require('rss-parser');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/errors');

const parser = new RSSParser({
  customFields: { item: ['media:content', 'media:thumbnail'] }
});
const CACHE_DURATION = parseInt(process.env.CACHE_DURATION_MS) || 300000;

class GamespotNewsController {
  getNews = async (req, res, next) => {
    try {
      const filter = req.query.q ? req.query.q.toLowerCase() : null;
      const feedUrl = process.env.GAMESPOT_NEWS_FEED_URL;
      logger.info(`GamespotNewsController: Parsing RSS feed from: ${feedUrl}`, { query: req.query });
      const feed = await parser.parseURL(feedUrl);
      let items = feed.items.map(item => ({
        title: item.title || 'No Title',
        description: item.contentSnippet || 'No Description',
        link: item.link || '#',
        pubDate: item.pubDate || new Date().toISOString(),
        image:
            item.enclosure?.url ||
            (
                item['media:content'] ? (
                Array.isArray(item['media:content']) ?
                    item['media:content'][0]?.$?.url :
                    item['media:content'].$?.url
                ) : null
            ) ||
            (
                item['media:thumbnail'] ? (
                Array.isArray(item['media:thumbnail']) ?
                    item['media:thumbnail'][0]?.$?.url :
                    item['media:thumbnail'].$?.url
                ) : null
            ) ||
            'https://via.placeholder.com/150'
        // image:
        //   item.enclosure?.url ||
        //   (item['media:content'] && Array.isArray(item['media:content']) && item['media:content'][0]?.$?.url) ||
        //   (item['media:thumbnail'] && Array.isArray(item['media:thumbnail']) && item['media:thumbnail'][0]?.$?.url) ||
        //   'https://via.placeholder.com/150'
      }));
      if (filter) {
        items = items.filter(i => i.title.toLowerCase().includes(filter) || i.description.toLowerCase().includes(filter));
      }
      if (!items || items.length === 0) {
        return res.json({ success: true, data: [], message: 'No GameSpot news available at this time.' });
      }
      res.json({ success: true, data: items });
    } catch (error) {
      logger.error('GamespotNewsController: Error fetching news:', { error: error.toString(), feedUrl: process.env.GAMESPOT_NEWS_FEED_URL, query: req.query });
      next(new ApiError('Failed to fetch GameSpot news', 500));
    }
  };
}

module.exports = new GamespotNewsController();
