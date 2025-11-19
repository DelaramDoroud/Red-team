import express from 'express';
import config from '#root/config/config.mjs';

const router = express.Router();

router.get('/config', (_req, res) => {
  res.json(config);
});

export default router;
