import logger from './logger.mjs';

export default function errorInit(app) {
  app.use((err, _req, res, next) => {
    logger.error(err.stack);
    if (res.headersSent) return next(err);
    res.status(500).json({
      status: 500,
      message: 'Something went wrong!',
      error: process.env.NODE_ENV === 'development' ? err.stack : err.message,
    });
  });
}
