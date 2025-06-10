const express = require('express');
const router = express.Router();

const gamespotNewsController = require('../controllers/gamespotNewsController');
const gamespotReviewsController = require('../controllers/gamespotReviewsController');
const polygonController = require('../controllers/polygonController');
const kotakuController = require('../controllers/kotakuController');
const eurogamerController = require('../controllers/eurogamerController');
const pcgamerController = require('../controllers/pcgamerController');
const newsController = require('../controllers/newsController'); // IGN news

// GameSpot endpoints
router.get('/gamespot/news', gamespotNewsController.getNews);
router.get('/gamespot/reviews', gamespotReviewsController.getReviews);

// Other sources
router.get('/polygon', polygonController.getFeed);
router.get('/kotaku', kotakuController.getFeed);
router.get('/eurogamer', eurogamerController.getFeed);
router.get('/pcgamer', pcgamerController.getFeed);
router.get('/ign/news', newsController.getLatestNews);

module.exports = router;
