const express = require('express');
   const cors = require('cors');
   const helmet = require('helmet');
   const morgan = require('morgan');
   const { rateLimit } = require('express-rate-limit');
   const cron = require('node-cron');
   require('dotenv').config();

   const errorHandler = require('./middleware/errorHandler');
   const routes = require('./routes');
   const logger = require('./utils/logger');
   const swaggerSetup = require('./utils/swagger');
   const newsController = require('./controllers/newsController');

   const app = express();

   const mongoose = require('mongoose');

   mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 })
     .then(() => logger.info('MongoDB connected successfully'))
     .catch(err => {
       logger.error('MongoDB connection error:', {
         message: err.message,
         stack: err.stack,
         uri: process.env.MONGO_URI ? 'MONGO_URI set' : 'MONGO_URI missing'
       });
       process.exit(1);
     });

   app.use(helmet());
   app.use(cors());
   app.use(express.json());
   app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

   const limiter = rateLimit({
     windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 минут
     max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 запросов на IP
     standardHeaders: true, // Включаем стандартные заголовки RateLimit
     legacyHeaders: false // Отключаем устаревшие заголовки X-RateLimit
   });
   app.use(limiter);

   swaggerSetup(app);

   app.use('/api', routes);

   app.use(errorHandler);

   const port = process.env.PORT || 3000;
   app.listen(port, async () => {
     logger.info(`Server running on http://localhost:${port}`);
     // Вызываем fetchNews при старте сервера
     try {
       logger.info('Fetching news on server startup...');
       await newsController.fetchNews();
       logger.info('Initial news fetch completed');
     } catch (error) {
       logger.error('Error fetching news on startup:', {
         message: error.message,
         stack: error.stack
       });
     }
   });

   // Настраиваем периодический вызов fetchNews (каждые 5 минут)
   cron.schedule('*/1 * * * *', async () => {
     try {
       logger.info('Running scheduled news fetch...');
       await newsController.fetchNews();
       logger.info('Scheduled news fetch completed');
     } catch (error) {
       logger.error('Error during scheduled news fetch:', {
         message: error.message,
         stack: error.stack
       });
     }
   });

   module.exports = app;