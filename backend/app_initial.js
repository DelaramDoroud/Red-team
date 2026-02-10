import { RedisStore } from 'connect-redis';
import cors from 'cors';
import express from 'express';
import session from 'express-session';
import fs from 'fs';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { createClient } from 'redis';
import { createStream } from 'rotating-file-stream';
import { fileURLToPath } from 'url';
import models from '#root/models/init-models.js';
import apiRouter from '#root/routes/index.js';
import {
  scheduleActiveCodingPhaseChallenges,
  scheduleActivePeerReviewChallenges,
} from '#root/services/challenge-scheduler.js';
import errorInit from '#root/services/express-error.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isTestEnv =
  process.env.NODE_ENV === 'test' || process.env.ENVIRONMENT === 'test';
const disableAccessLogs = isTestEnv || process.env.DISABLE_HTTP_LOGS === 'true';
const isProductionEnv = process.env.NODE_ENV === 'production';

const app = express();

const createAccessLogStream = () => {
  if (isTestEnv) return process.stdout;

  try {
    const logDirectory = path.join(__dirname, 'log');
    fs.mkdirSync(logDirectory, { recursive: true });

    return createStream('access.log', {
      interval: '1d', // rotate daily
      path: logDirectory,
    });
  } catch (error) {
    console.error('Failed to initialize file access logger, using stdout.', {
      error,
    });
    return process.stdout;
  }
};

const accessLogStream = createAccessLogStream();

const parseAllowedOrigins = () => {
  const raw = process.env.CORS_ALLOWED_ORIGINS || '';
  const values = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (values.length > 0) return values;

  if (isTestEnv) return ['http://localhost:3000'];
  if (!isProductionEnv) {
    return ['http://localhost:3000', 'http://127.0.0.1:3000'];
  }
  return [];
};

const allowedOrigins = parseAllowedOrigins();
if (!isTestEnv && allowedOrigins.length === 0) {
  throw new Error('CORS_ALLOWED_ORIGINS must be configured.');
}

const sessionSecret = process.env.SECRET;
if (!isTestEnv && (!sessionSecret || sessionSecret.trim().length < 32)) {
  throw new Error('SECRET must be set and at least 32 characters long.');
}

const effectiveSessionSecret = isTestEnv
  ? sessionSecret || 'test-secret'
  : sessionSecret;

let sessionStore;
if (!isTestEnv) {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL must be configured for session storage.');
  }

  const redisClient = createClient({ url: redisUrl });

  redisClient.on('error', (error) => {
    console.error('Redis session store error:', error);
  });
  await redisClient.connect();

  sessionStore = new RedisStore({
    client: redisClient,
    prefix: process.env.REDIS_SESSION_PREFIX || 'codymatch:sess:',
  });
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: (origin, callback) => {
      if (isTestEnv) {
        callback(null, true);
        return;
      }
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed by CORS policy'));
    },
    credentials: true,
  })
);
if (!disableAccessLogs)
  app.use(morgan('combined', { stream: accessLogStream }));
app.use(express.json());
app.use(
  session({
    secret: effectiveSessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProductionEnv,
      sameSite: 'lax',
    },
  })
);

app.use(apiRouter);

await models.init();
if (process.env.NODE_ENV !== 'test') {
  try {
    await scheduleActiveCodingPhaseChallenges();
    await scheduleActivePeerReviewChallenges();
  } catch (error) {
    console.error('Failed to schedule coding phase end timers:', error);
  }
}

let queueInitialized = false;
if (process.env.ENABLE_CODE_EXECUTION_QUEUE !== 'false') {
  try {
    const { initializeQueue } = await import(
      '#root/services/code-execution-queue.js'
    );
    await initializeQueue();
    queueInitialized = true;
  } catch (error) {
    console.error('Failed to initialize code execution queue:', error);
  }
}

// Only start worker if queue was successfully initialized
if (queueInitialized && process.env.ENABLE_CODE_EXECUTION_WORKER !== 'false') {
  try {
    const { startWorker } = await import(
      '#root/services/code-execution-worker.js'
    );
    await startWorker();
  } catch (error) {
    console.error('Failed to start code execution worker:', error);
  }
}

errorInit(app);

export default app;
