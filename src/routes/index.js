const express = require('express');
const { query } = require('express-validator');
const newsController = require('../controllers/newsController');
const validate = require('../middleware/validate');

const router = express.Router();

// Получение последних новостей
router.get('/latest', newsController.getLatestNews);

// Поиск новостей
router.get('/search', [
  query('q').notEmpty().trim().escape(),
  validate
], newsController.searchNews);

// Получение новостей по дате
router.get('/latest-by-date', [
  query('date').notEmpty().isISO8601().withMessage('Date must be in ISO format (YYYY-MM-DD)'),
  validate
], newsController.getNewsByDate);

// Обновление новостей
router.post('/fetch', async (req, res) => {
  try {
    await newsController.fetchNews();
    res.json({ success: true, message: 'News fetched and saved' });
  } catch (error) {
    logger.error('Fetch news error:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Failed to fetch news' });
  }
});

router.get('/article', [
query('link').notEmpty(),
validate
], newsController.parseArticle);

module.exports = router;
