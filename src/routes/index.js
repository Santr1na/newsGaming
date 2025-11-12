const express = require('express');
const { query } = require('express-validator');
const newsController = require('../controllers/newsController');
const validate = require('../middleware/validate');
const router = express.Router();

router.get('/latest', newsController.getLatestNews);

router.get('/search', [
  query('q').notEmpty().trim().escape(),
  validate
], newsController.searchNews);

router.get('/latest-by-date', [
  query('date').notEmpty().isISO8601().withMessage('Date must be in ISO format (YYYY-MM-DD)'),
  validate
], newsController.getNewsByDate);

router.post('/fetch', async (req, res, next) => {
  try {
    await newsController.fetchNews();
    res.json({ success: true, message: 'News fetched and saved' });
  } catch (error) {
    logger.error('Fetch news error:', { message: error.message, stack: error.stack });
    next(error);
  }
});

router.get('/article', [
  query('link').notEmpty(),
  validate
], newsController.parseArticle);

module.exports = router;
