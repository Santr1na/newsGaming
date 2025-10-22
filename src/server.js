const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
require('dotenv').config();

const errorHandler = require('./middleware/errorHandler');
const routes = require('./routes');
const logger = require('./utils/logger');
const swaggerSetup = require('./utils/swagger');
const newsController = require('./controllers/newsController');

const app = express();

app.set('trust proxy', 1);

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

swaggerSetup(app);
app.use('/api/news', routes); // Исправлен путь с /news на /api/news для соответствия Swagger
app.use(errorHandler);

const port = process.env.PORT || 9000;
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
