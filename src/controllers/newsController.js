const cache = require('memory-cache');
const RSSParser = require('rss-parser');
const logger = require('../utils/logger');
const News = require('../models/news');
const geoip = require('geoip-lite');
const cheerio = require('cheerio');
const axios = require('axios');
const parser = new RSSParser({
  customFields: {
    item: [['media:content', 'mediaContent'], ['media:thumbnail', 'newsThumbnail'], ['dc:creator', 'creator']]
  },
  requestOptions: {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
  }
});
const CACHE_DURATION = process.env.CACHE_DURATION_MS || 60000;
const MAX_NEWS_LIMIT = process.env.MAX_NEWS_LIMIT || 1000;
class NewsController {
  categorizeNews(item) {
    const title = (item.title || '').toLowerCase();
    const content = (item.contentSnippet || '').toLowerCase();
    if (title.includes('rumor') || title.includes('слух') || content.includes('rumor')) return 'rumors';
    if (title.includes('announc') || title.includes('анонс') || content.includes('announc')) return 'soon';
    if (title.includes('poll') || title.includes('опрос') || content.includes('poll')) return 'polls';
    if (title.includes('recommend') || title.includes('рекоменд') || content.includes('recommend')) return 'recommendations';
    return 'update';
  }
  getLatestNews = async (req, res, next) => {
    try {
      const geo = geoip.lookup(req.ip);
      const isEU = geo && ['AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU','IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK'].includes(geo.country);
      const { page = 1, limit = 10, category, date, from, to } = req.query;
      let query = {};
      if (category) query.category = category;
      if (date) {
        const start = new Date(date); start.setHours(0,0,0,0);
        const end = new Date(date); end.setHours(23,59,59,999);
        query.pubDate = { $gte: start, $lte: end };
      } else if (from || to) query.pubDate = { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to) }) };
      if (!isEU) query.source = { $nin: ['polygon', 'gamerant', 'thegamer'] };
      const cacheKey = `news_${page}_${limit}_${category||'all'}_${date||'none'}_${from||'none'}_${to||'none'}_${isEU?'eu':'us'}`;
      let response = cache.get(cacheKey);
      if (response) return res.json(response);
      const news = await News.find(query).sort({ pubDate: -1 }).skip((page-1)*limit).limit(+limit).exec();
      const total = await News.countDocuments(query);
      response = { success: true, data: news, pagination: { current: +page, total, hasMore: page*limit < total } };
      cache.put(cacheKey, response, CACHE_DURATION);
      return res.json(response);
    } catch (error) {
      logger.error('News fetch error:', { message: error.message, stack: error.stack, query: req.query });
      next(new Error('Failed to fetch news'));
    }
  };
  searchNews = async (req, res, next) => {
    try {
      const { q } = req.query;
      const news = await News.find({ $or: [{ title: { $regex: q, $options: 'i' } }, { description: { $regex: q, $options: 'i' } }] }).exec();
      res.json({ success: true, data: news });
    } catch (error) {
      logger.error('Search error:', { message: error.message, stack: error.stack, query: req.query });
      next(new Error('Failed to search news'));
    }
  };
  getNewsByDate = async (req, res, next) => {
    try {
      const { date } = req.query;
      const start = new Date(date); start.setHours(0,0,0,0);
      const end = new Date(date); end.setHours(23,59,59,999);
      const news = await News.find({ pubDate: { $gte: start, $lte: end } }).sort({ pubDate: -1 }).exec();
      if (!news.length) return res.status(404).json({ success: false, message: 'No news found' });
      res.json({ success: true, data: news });
    } catch (error) {
      logger.error('Date fetch error:', { message: error.message, stack: error.stack, query: req.query });
      next(new Error('Failed to fetch news by date'));
    }
  };
  fetchNews = async () => {
    const feedUrls = [
      process.env.IGN_NEWS_FEED,
      process.env.IGN_REVIEWS_FEED,
      process.env.GAMESPOT_NEWS_FEED,
      process.env.GAMESPOT_REVIEWS_FEED,
      process.env.POLYGON_FEED,
      process.env.EUROGAMER_FEED,
      process.env.PCGAMER_FEED,
      process.env.GAMERANT_FEED,
      process.env.THEGAMER_FEED
    ].filter(Boolean);
    const newsItems = [];
    const getSource = url => {
      if (url.includes('ign')) return 'ign';
      if (url.includes('gamespot')) return 'gamespot';
      if (url.includes('polygon')) return 'polygon';
      if (url.includes('eurogamer')) return 'eurogamer';
      if (url.includes('pcgamer')) return 'pcgamer';
      if (url.includes('gamerant')) return 'gamerant';
      if (url.includes('thegamer')) return 'thegamer';
      return 'unknown';
    };
    for (const url of feedUrls) {
      try {
        const feed = await parser.parseURL(url);
        if (!feed.items?.length) continue;
        const items = feed.items
          .filter(item => item.title && item.link && (item.pubDate || item.isoDate))
          .map(item => ({
            title: item.title,
            description: (item.contentSnippet || item.content || '').replace(/\n\s*\n/g, '\n').replace(/\n/g, ' ').trim(),
            link: item.link,
            pubDate: new Date(item.pubDate || item.isoDate),
            image: item.enclosure?.url || (item.mediaContent ? (Array.isArray(item.mediaContent) ? item.mediaContent[0]?.$?.url : item.mediaContent.$?.url) : null) || (item.newsThumbnail ? (Array.isArray(item.newsThumbnail) ? item.newsThumbnail[0]?.$?.url : item.newsThumbnail.$?.url) : null) || 'https://via.placeholder.com/150',
            author: item.creator || item.author || 'Unknown',
            category: this.categorizeNews(item),
            source: getSource(url)
          }));
        newsItems.push(...items);
      } catch (error) {}
    }
    let currentCount = await News.countDocuments();
    for (const item of newsItems) {
      if (currentCount >= MAX_NEWS_LIMIT) {
        const oldest = await News.findOne().sort({ pubDate: 1 }).exec();
        if (oldest) await News.deleteOne({ _id: oldest._id });
      }
      const existing = await News.findOne({ link: item.link }).exec();
      if (!existing) await News.create(item);
      else await News.updateOne({ link: item.link }, { $set: item });
      currentCount++;
    }
    cache.clear();
    return newsItems;
  };
  parseArticle = async (req, res, next) => {
    const { link } = req.query;
    if (!link) return res.status(400).json({ error: 'Link required' });
    try {
      const { data: html } = await axios.get(link, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' } });
      const $ = cheerio.load(html);
      $('aside').remove();
      let selector = link.includes('ign.com') ? '.article-content p:not(.advertisement), .article-content h2, .article-content h3, .article-content table, .article-content ol, .article-content ul' :
        link.includes('gamespot.com') ? '.article-body p:not(.ad, .sponsored), .article-body h2, .article-body h3, .article-body table, .article-body ol, .article-body ul' :
        link.includes('pcgamer.com') ? '.content-wrapper p:not(.ad-block, .sponsored, .affiliate, .newsletter-form__wrapper, .newsletter-form__wrapper--inbodyContent, .slice-container, .slice-author-bio, .authorBio-swuqazpYSZeXGJMSzXNqBJ, .slice-container-authorBio, .person-wrapper, .person-nBZd4MkT7sYaFmc8BsVcQ5-fSwi155TTodmvyQm7jW5mmjqEoPoLFik, .slice-container-person, .person__bio, figcaption, figure, aside), .content-wrapper h2:not(:has(p, a, span)), .content-wrapper h3, .content-wrapper table, .content-wrapper ol, .content-wrapper ul' :
        link.includes('gamerant.com') ? '.article-body *, .content-block-regular *, video' :
        link.includes('thegamer.com') ? '.content p:not(.ad, .sponsored), .content h2, .content h3, .content table, .content ol, .content ul, .content-block-regular p:not(.ad, .sponsored), .content-block-regular h2, .content-block-regular h3, .content-block-regular table, .content-block-regular ol, .content-block-regular ul' :
        link.includes('eurogamer.net') ? '.article_body *:not(figure, aside)' :
        link.includes('polygon.com') ? '.content-block-regular *' :
        'article p:not(.ad-block, .sponsored, .affiliate, .newsletter-form__wrapper, .newsletter-form__wrapper--inbodyContent, .slice-container, .slice-author-bio, .authorBio-swuqazpYSZeXGJMSzXNqBJ, .slice-container-authorBio, .person-wrapper, .person-nBZd4MkT7sYaFmc8BsVcQ5-fSwi155TTodmvyQm7jW5mmjqEoPoLFik, .slice-container-person, .display-card-main-content-wrapper), article h2, article h3, article table, article ol, article ul, .content p, .content h2, .content h3, .content table, .content ol, .content ul';
      let elements = $(selector);
      if (!elements.length) {
        selector = 'article p, article h2, article h3, .content p, .content h2, .content h3, .entry-content p, .entry-content h2, .entry-content h3, .post-content p, .post-content h2, .post-content h3, .article-body p, .article-body h2, .article-body h3, article table, .content table, .entry-content table, .post-content table, .article-body table, article ol, .content ol, .entry-content ol, .post-content ol, .article-body ol, article ul, .content ul, .entry-content ul, .post-content ul, .article-body ul';
        elements = $(selector);
      }
      const ignoreClasses = ['ad-block', 'sponsored', 'affiliate', 'newsletter-form__wrapper', 'newsletter-form__wrapper--inbodyContent', 'slice-container', 'slice-author-bio', 'authorBio-swuqazpYSZeXGJMSzXNqBJ', 'slice-container-authorBio', 'person-wrapper', 'person-nBZd4MkT7sYaFmc8BsVcQ5-fSwi155TTodmvyQm7jW5mmjqEoPoLFik', 'slice-container-person', 'display-card-main-content-wrapper'];
      const ignoreTexts = ['The biggest gaming news, reviews and hardware deals', 'Keep up to date with the most important stories and the best deals, as picked by the PC Gamer team', 'Please enable JavaScript to see our live coverage of this event.', 'You must confirm your public display name before commenting', 'Please logout and then login again, you will then be prompted to enter your display name.'];
      const contentParts = [];
      let currentText = '';
      elements.each((i, el) => {
        const element = $(el);
        const text = element.text().trim();
        if (!text) return;
        let include = !ignoreClasses.some(cls => element.hasClass(cls) || element.closest(`.${cls}`).length) && !(element.is('p') && ignoreTexts.includes(text));
        if (include) {
          if (element.is('p') && !element.closest('table').length) currentText += text + '\n\n';
          else if (element.is('table,h2,h3,ol,ul,video')) {
            if (currentText) contentParts.push({ type: 'text', content: currentText.trim() });
            currentText = '';
            contentParts.push({ type: 'html', content: element.outerHtml() });
          }
        }
      });
      if (currentText) contentParts.push({ type: 'text', content: currentText.trim() });
      if (!contentParts.length) contentParts.push({ type: 'text', content: 'Content missing.' });
      res.json({ content: contentParts });
    } catch (error) {
      next(error);
    }
  };
}
module.exports = new NewsController();
