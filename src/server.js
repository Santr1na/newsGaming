const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { rateLimit } = require('express-rate-limit');
require('dotenv').config();

const errorHandler = require('./middleware/errorHandler');
const routes = require('./routes');
const logger = require('./utils/logger');
const swaggerSetup = require('./utils/swagger');

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
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
});
app.use(limiter);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  logger.info(`Server running on http://localhost:${port}`);
});

swaggerSetup(app);

app.use('/api', routes);

app.use(errorHandler);

module.exports = app;