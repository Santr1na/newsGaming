const express = require('express');
const { query } = require('express-validator');
const newsController = require('../controllers/newsController');
const validate = require('../middleware/validate');
const logger = require('../utils/logger');

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
 *           description: Заголовок новости
 *         description:
 *           type: string
 *           description: Краткое описание или отрывок статьи
 *         link:
 *           type: string
 *           description: URL полной статьи
 *         pubDate:
 *           type: string
 *           format: date-time
 *           description: Дата публикации
 *         image:
 *           type: string
 *           description: URL изображения статьи
 *         author:
 *           type: string
 *           description: Автор новости
 *           nullable: true
 *         category:
 *           type: string
 *           enum: [rumors, recommendations, polls, soon, update]
 *           description: Категория новости
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
 * /news/latest:
 *   get:
 *     tags: [News]
 *     summary: Получить последние игровые новости
 *     description: Возвращает игровые новости с пагинацией и фильтрацией по категории, дате и языку
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Номер страницы для пагинации
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Количество элементов на странице
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [rumors, recommendations, polls, soon, update]
 *         description: Категория новостей
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Начальная дата (ISO, например, 2024-01-01T00:00:00Z)
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Конечная дата (ISO, например, 2025-06-12T23:59:59Z)
 *       - in: query
 *         name: lang
 *         schema:
 *           type: string
 *           enum: [en, ru]
 *           default: en
 *         description: Язык перевода (en или ru)
 *     responses:
 *       200:
 *         description: Успешный ответ с новостями
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/PaginatedResponse'
 *       500:
 *         description: Ошибка сервера
 */
router.get('/latest', newsController.getLatestNews);

/**
 * @swagger
 * /news/search:
 *   get:
 *     tags: [News]
 *     summary: Поиск игровых новостей
 *     description: Поиск новостей по строке запроса с поддержкой языка
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Строка поискового запроса
 *       - in: query
 *         name: lang
 *         schema:
 *           type: string
 *           enum: [en, ru]
 *           default: en
 *         description: Язык перевода (en или ru)
 *     responses:
 *       200:
 *         description: Результаты поиска
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
 *         description: Неверный поисковый запрос
 *       500:
 *         description: Ошибка сервера
 */
router.get('/search', [
  query('q').notEmpty().trim().escape(),
  validate
], newsController.searchNews);

/**
 * @swagger
 * /news/fetch:
 *   post:
 *     tags: [News]
 *     summary: Manually fetch news from RSS feeds
 *     description: Triggers news fetching and saving to database
 *     responses:
 *       200:
 *         description: News fetched successfully
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
router.post('/fetch', async (req, res) => {
  try {
    await newsController.fetchNews();
    res.json({ success: true, message: 'News fetched and saved' });
  } catch (error) {
    logger.error('Fetch news error:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Failed to fetch news' });
  }
});

module.exports = router;
