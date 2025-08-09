const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
require('dotenv').config();
const mongoose = require('mongoose');
const NodeCache = require('node-cache');
const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./utils/logger');
const swaggerSetup = require('./utils/swagger');
const newsController = require('./controllers/newsController');

const app = express();
app.set('trust proxy', 1);
const port = process.env.PORT || 9000;
const cache = new NodeCache({ stdTTL: 86400 });

// MongoDB подключение
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

// Модель новости
const NewsSchema = new mongoose.Schema({
  title: String,
  description: String,
  link: String,
  pubDate: Date,
  image: String,
  author: String,
  category: String
});
const News = mongoose.model('News', NewsSchema);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use('/images', express.static(path.join(__dirname, 'images')));

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  limit: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: async (req) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    return { success: false, message: 'Too many requests' };
  }
});
app.use(limiter);

// Swagger
swaggerSetup(app);

// Routes
app.use('/news', require('./routes/news'));

// Запуск сервера
app.listen(port, async () => {
  logger.info(`Server running on http://localhost:${port}`);
  try {
    logger.info('Fetching news on startup...');
    const newsItems = await newsController.fetchNews();
    logger.info(`Initial news fetch completed: ${newsItems.length} items`);
  } catch (error) {
    logger.error('Error fetching news on startup:', {
      message: error.message,
      stack: error.stack
    });
  }
});

// Периодическое обновление новостей
cron.schedule('*/10 * * * *', async () => {
  try {
    logger.info('Running scheduled news fetch...');
    const newsItems = await newsController.fetchNews();
    logger.info(`Scheduled news fetch completed: ${newsItems.length} items`);
  } catch (error) {
    logger.error('Error during scheduled news fetch:', {
      message: error.message,
      stack: error.stack
    });
  }
});

module.exports = app;
