const express = require('express');
const { param } = require('express-validator');
const gamesController = require('../controllers/gamesController');
const validate = require('../middleware/validate');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Game:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *           description: The title of the game
 *         description:
 *           type: string
 *           description: Game description or review excerpt
 *         link:
 *           type: string
 *           description: URL to the full review
 *         pubDate:
 *           type: string
 *           format: date-time
 *           description: Review publication date
 *         score:
 *           type: number
 *           format: float
 *           description: Game review score out of 10
 *         image:
 *           type: string
 *           description: URL to the game's image
 */

/**
 * @swagger
 * /api/games/top:
 *   get:
 *     tags: [Games]
 *     summary: Get top rated games
 *     description: Retrieves a list of top-rated games with their reviews
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
 *         description: List of top rated games
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
 *                     $ref: '#/components/schemas/Game'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     current:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     hasMore:
 *                       type: boolean
 *       500:
 *         description: Server error
 */
router.get('/top', gamesController.getTopGames);

/**
 * @swagger
 * /api/games/{id}:
 *   get:
 *     tags: [Games]
 *     summary: Get game details by ID
 *     description: Retrieves detailed information about a specific game
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Game identifier from the URL
 *     responses:
 *       200:
 *         description: Detailed game information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Game'
 *       404:
 *         description: Game not found
 *       500:
 *         description: Server error
 */
router.get('/:id', [
  param('id').notEmpty().trim(),
  validate
], gamesController.getGameById);

module.exports = router;