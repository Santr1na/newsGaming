const NewsController = require('../controllers/newsController');
const schedule = require('node-schedule');

schedule.scheduleJob('0 */5 * * * *', async () => {
  try {
    await NewsController.fetchNews();
    logger.info('News updated from RSS feeds');
  } catch (error) {
    logger.error('Scheduler error:', {
      message: error.message,
      stack: error.stack
    });
  }
});