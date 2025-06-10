const { validationResult } = require('express-validator');
const { ApiError } = require('../utils/errors');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError('Validation error', 400, errors.array());
  }
  next();
}

module.exports = validate;