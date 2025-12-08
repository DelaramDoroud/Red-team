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
app.use(cors());
app.use(morgan('combined', { stream: accessLogStream }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

app.use(apiRouter);

await models.init();

if (process.env.ENABLE_CODE_EXECUTION_QUEUE !== 'false') {
  try {
    const { initializeQueue } =
      await import('#root/services/code-execution-queue.js');
    await initializeQueue();
  } catch (error) {
    console.error('Failed to initialize code execution queue:', error);
  }
}

errorInit(app);

export default app;
