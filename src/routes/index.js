const express = require('express');
const router = express.Router();

const feedsRoutes = require('./feedsRoutes');
const newsRoutes = require('./newsRoutes'); // if you already have
const gamesRoutes = require('./gamesRoutes'); // if applicable

router.use('/feeds', feedsRoutes);
router.use('/news', newsRoutes);
router.use('/games', gamesRoutes);

module.exports = router;