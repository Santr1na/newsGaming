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
 *           description: The title of the news article
 *         description:
 *           type: string
 *           description: A brief description or excerpt of the article
 *         link:
 *           type: string
 *           description: URL to the full article
 *         pubDate:
 *           type: string
 *           format: date-time
 *           description: Publication date
 *         image:
 *           type: string
 *           description: URL to the article's image
 *         author:
 *           type: string
 *           description: The author of the news article
 *	     nullable: true
 *   responses:
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
 *     summary: Get latest game announcements
 *     description: Retrieves the latest gaming news articles with pagination
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Successful response with news articles
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/PaginatedResponse'
 *       500:
 *         description: Server error
 */
router.get('/latest', newsController.getLatestNews);

/**
 * @swagger
 * /api/news/search:
 *   get:
 *     tags: [News]
 *     summary: Search game news
 *     description: Search through gaming news articles using a query string
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query string
 *     responses:
 *       200:
 *         description: Successful search results
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
 *         description: Invalid search query
 *       500:
 *         description: Server error
 */
router.get('/search', [
  query('q').notEmpty().trim().escape(),
  validate
], newsController.searchNews);

module.exports = router;