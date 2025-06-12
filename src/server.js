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

mongoose.connect(process.env.MONGO_URI)
  .then(() => logger.info('MongoDB connected'))
  .catch(err => {
    logger.error('MongoDB connection error:', {
      message: err.message,
      stack: err.stack
    });
    process.exit(1); // Exit on failure
  });

   // Security middleware
   app.use(helmet());
   app.use(cors());
   app.use(express.json());
   app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

   // Rate limiting
   const limiter = rateLimit({
     windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
     max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
   });
   app.use(limiter);

   // API Documentation
   swaggerSetup(app);

   // Routes
   app.use('/api', routes);

   // Error handling
   app.use(errorHandler);

   module.exports = app;