const logger = require('../utils/logger');
const { ApiError } = require('../utils/errors');

function errorHandler(err, req, res, next) {
  logger.error(err);

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.statusCode
      }
    });
  }

  res.status(500).json({
    success: false,
    error: {
      message: 'Internal server error',
      code: 500
    }
  });
}

module.exports = errorHandler;