const express = require('express');
const { query } = require('express-validator');
const newsController = require('../controllers/newsController');
const validate = require('../middleware/validate');
const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     NewsItem:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         link:
 *           type: string
 *         pubDate:
 *           type: string
 *           format: date-time
 *         image:
 *           type: string
 *         author:
 *           type: string
 *         category:
 *           type: string
 *           enum: [rumors, recommendations, polls, soon, update]
 *     PaginatedResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/NewsItem'
 *         pagination:
 *           type: object
 *           properties:
 *             current:
 *               type: integer
 *             total:
 *               type: integer
 *             hasMore:
 *               type: boolean
 */

/**
 * @swagger
 * /api/news/latest:
 *   get:
 *     tags: [News]
 *     summary: Get latest gaming news
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [rumors, recommendations, polls, soon, update]
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       500:
 *         description: Server error
 */
router.get('/latest', newsController.getLatestNews);

/**
 * @swagger
 * /api/news/search:
 *   get:
 *     tags: [News]
 *     summary: Search gaming news
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/NewsItem'
 *       400:
 *         description: Invalid query
 *       500:
 *         description: Server error
 */
router.get('/search', [
  query('q').notEmpty().trim().escape(),
  validate
], newsController.searchNews);

/**
 * @swagger
 * /api/news/latest-by-date:
 *   get:
 *     tags: [News]
 *     summary: Get news by date
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/NewsItem'
 *       404:
 *         description: No news found
 *       500:
 *         description: Server error
 */
router.get('/latest-by-date', [
  query('date').notEmpty().isISO8601().withMessage('Date must be in ISO format (YYYY-MM-DD)'),
  validate
], newsController.getNewsByDate);

/**
 * @swagger
 * /api/news/fetch:
 *   post:
 *     tags: [News]
 *     summary: Fetch news from RSS
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 */
router.post('/fetch', async (req, res, next) => {
  try {
    await newsController.fetchNews();
    res.json({ success: true, message: 'News fetched and saved' });
  } catch (error) {
    logger.error('Fetch news error:', { message: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * @swagger
 * /api/news/article:
 *   get:
 *     tags: [News]
 *     summary: Parse article content
 *     parameters:
 *       - in: query
 *         name: link
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 content:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                       content:
 *                         type: string
 *       400:
 *         description: Link required
 *       500:
 *         description: Server error
 */
router.get('/article', [
  query('link').notEmpty(),
  validate
], newsController.parseArticle);

module.exports = router;
