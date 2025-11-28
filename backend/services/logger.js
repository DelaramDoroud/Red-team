import winston from 'winston';

export default winston.createLogger({
  transports: [
    new winston.transports.Console({
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.simple()
      ),
    }),
  ],
});

/*
logger.debug('debug');
logger.info('info');
logger.warn('warn');
logger.error('error');
*/
