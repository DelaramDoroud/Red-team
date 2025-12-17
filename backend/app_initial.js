import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createStream } from 'rotating-file-stream';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import apiRouter from '#root/routes/index.js';
import errorInit from '#root/services/express-error.js';
import models from '#root/models/init-models.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

const accessLogStream = createStream('access.log', {
  interval: '1d', // rotate daily
  path: path.join(__dirname, 'log'),
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: true, // reflect request origin
    credentials: true,
  })
);
app.use(morgan('combined', { stream: accessLogStream }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SECRET || 'test-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  })
);

app.use(apiRouter);

await models.init();

let queueInitialized = false;
if (process.env.ENABLE_CODE_EXECUTION_QUEUE !== 'false') {
  try {
    const { initializeQueue } =
      await import('#root/services/code-execution-queue.js');
    await initializeQueue();
    queueInitialized = true;
  } catch (error) {
    console.error('Failed to initialize code execution queue:', error);
  }
}

// Only start worker if queue was successfully initialized
if (queueInitialized && process.env.ENABLE_CODE_EXECUTION_WORKER !== 'false') {
  try {
    const { startWorker } =
      await import('#root/services/code-execution-worker.js');
    await startWorker();
  } catch (error) {
    console.error('Failed to start code execution worker:', error);
  }
}

errorInit(app);

export default app;
