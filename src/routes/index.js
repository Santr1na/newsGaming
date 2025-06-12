const express = require('express');
const router = express.Router();

const newsRoutes = require('./newsRoutes');

router.use('/news', newsRoutes);

module.exports = router;