const cache = require('memory-cache');
const RSSParser = require('rss-parser');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/errors');

// Configure RSSParser with custom media fields
const parser = new RSSParser({
  customFields: {
    item: ['media:content', 'media:thumbnail']
  }
});
const CACHE_DURATION = parseInt(process.env.CACHE_DURATION_MS) || 300000; // 5 minutes

class GamesController {
  // Enhanced getTopGames with error logging, normalization, filtering, and graceful handling
  getTopGames = async (req, res, next) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const filter = req.query.q ? req.query.q.toLowerCase() : null;

      // Log request parameters for debugging
      logger.info(`Fetching top games with page: ${page}, limit: ${limit}, filter: ${filter}`);

      const cachedGames = cache.get('top_games');
      if (cachedGames) {
        let filteredGames = cachedGames;
        if (filter) {
          filteredGames = cachedGames.filter(game =>
            (game.title && game.title.toLowerCase().includes(filter)) ||
            (game.description && game.description.toLowerCase().includes(filter))
          );
        }
        // Graceful handling if filtered results are empty
        if (filteredGames.length === 0) {
          return res.json({
            success: true,
            data: [],
            message: 'No game reviews available for the given filter.',
            pagination: {
              current: page,
              total: 0,
              hasMore: false
            }
          });
        }
        return this.paginateResults(res, filteredGames, page, limit);
      }

      const feedUrl = process.env.IGN_REVIEWS_FEED_URL;
      logger.info(`Parsing RSS feed from: ${feedUrl}`);
      const feed = await parser.parseURL(feedUrl);
      
      let games = feed.items.map(item => ({
        title: item.title || 'No Title',
        description: item.contentSnippet || 'No Description',
        link: item.link || '#',
        pubDate: item.pubDate || new Date().toISOString(),
        score: this.extractScore(item.contentSnippet),
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

      // Additional query filtering
      if (filter) {
        games = games.filter(game =>
          (game.title && game.title.toLowerCase().includes(filter)) ||
          (game.description && game.description.toLowerCase().includes(filter))
        );
      }

      // Graceful handling for empty feed
      if (!games || games.length === 0) {
        return res.json({
          success: true,
          data: [],
          message: 'No game reviews available at this time.',
          pagination: {
            current: page,
            total: 0,
            hasMore: false
          }
        });
      }

      // Optionally sort by score (items with no score will be treated as 0)
      games.sort((a, b) => (b.score || 0) - (a.score || 0));

      cache.put('top_games', games, CACHE_DURATION);
      this.paginateResults(res, games, page, limit);
    } catch (error) {
      // Enhanced error logging with feed URL and query details
      logger.error('Error fetching top games:', {
        error: error.toString(),
        feedUrl: process.env.IGN_REVIEWS_FEED_URL,
        query: req.query
      });
      next(new ApiError('Failed to fetch top games', 500));
    }
  };

  // Enhanced getGameById (if needed, similar improvements can be applied)
  getGameById = async (req, res, next) => {
    try {
      const { id } = req.params;
      const cachedGames = cache.get('top_games');
      const games = cachedGames || await this.fetchGames();
      const game = games.find(g => g.link.includes(id));
      if (!game) {
        return next(new ApiError('Game not found', 404));
      }
      res.json({
        success: true,
        data: game
      });
    } catch (error) {
      logger.error('Error fetching game details:', {
        error: error.toString(),
        gameId: req.params.id
      });
      next(new ApiError('Failed to fetch game details', 500));
    }
  };

  async fetchGames() {
    const feedUrl = process.env.IGN_REVIEWS_FEED_URL;
    const feed = await parser.parseURL(feedUrl);
    let games = feed.items.map(item => ({
      title: item.title || 'No Title',
      description: item.contentSnippet || 'No Description',
      link: item.link || '#',
      pubDate: item.pubDate || new Date().toISOString(),
      score: this.extractScore(item.contentSnippet),
      image:
        item.enclosure?.url ||
        (item['media:content'] && Array.isArray(item['media:content']) && item['media:content'][0]?.$?.url) ||
        (item['media:thumbnail'] && Array.isArray(item['media:thumbnail']) && item['media:thumbnail'][0]?.$?.url) ||
        'https://via.placeholder.com/150'
    }));
    games.sort((a, b) => (b.score || 0) - (a.score || 0));
    cache.put('top_games', games, CACHE_DURATION);
    return games;
  }

  extractScore(content) {
    const scoreMatch = content.match(/(\d+(\.\d+)?)\s*\/\s*10/);
    return scoreMatch ? parseFloat(scoreMatch[1]) : null;
  }

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
}

module.exports = new GamesController();
