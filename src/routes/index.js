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